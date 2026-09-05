import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT } from './systemPrompt';
import { TOOL_DEFINITIONS, dispatchToolCall } from './tools';
import { db } from '../db/dataStore';
import { AgentHarness, HarnessExecutionReport } from './harness';
import { GuardrailAuditReport } from './guardrails';

export interface ToolCallRecord {
  toolName: string;
  args: Record<string, any>;
  result: any;
}

export interface AgentTurnResponse {
  message: string;
  toolCalls: ToolCallRecord[];
  mode: 'gemini' | 'mock';
  guardrails?: GuardrailAuditReport;
  harnessReport?: HarnessExecutionReport;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function runAgentTurn(
  driverId: string,
  userMessage: string,
  chatHistory: { sender: 'driver' | 'agent'; text: string }[] = []
): Promise<AgentTurnResponse> {
  const harness = new AgentHarness(driverId);
  harness.startTurn();

  // 1. Pre-execution Phase: Input Guardrails
  const inputCheck = harness.evaluateInput(userMessage);
  if (inputCheck.shouldBlock && inputCheck.interceptedResponse) {
    const report = harness.compileReport('gemini', 0, 100, inputCheck.safetyCategory);
    return {
      message: inputCheck.interceptedResponse,
      toolCalls: [],
      mode: 'gemini',
      guardrails: report.guardrails,
      harnessReport: report,
    };
  }

  const ai = getGeminiClient();
  const toolCalls: ToolCallRecord[] = [];

  if (ai) {
    try {
      const modelName = 'gemini-3.7-flash';

      // Build conversation contents for Gemini
      const contents: any[] = [];

      for (const h of chatHistory) {
        contents.push({
          role: h.sender === 'driver' ? 'user' : 'model',
          parts: [{ text: h.text }],
        });
      }

      contents.push({
        role: 'user',
        parts: [{ text: userMessage }],
      });

      let iteration = 0;
      const maxIterations = 5;

      while (iteration < maxIterations) {
        iteration++;
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0.1,
            tools: [{ functionDeclarations: TOOL_DEFINITIONS as any }],
          },
        });

        const candidate = response.candidates?.[0];
        const content = candidate?.content;
        const functionCalls = content?.parts?.filter(p => p.functionCall)?.map(p => p.functionCall) || [];

        if (functionCalls.length > 0) {
          // Model wants to call one or more tools
          contents.push(content);

          const toolResponseParts: any[] = [];
          for (const call of functionCalls) {
            if (!call) continue;
            const toolName = call.name;
            const args = (call.args || {}) as Record<string, any>;

            // Runtime Phase: Validate Tool Call Guardrail
            const toolValidation = harness.validateToolCall(toolName, args);
            let result: any;

            if (!toolValidation.passed) {
              result = { status: 'error', message: toolValidation.error || 'Guardrail blocked unauthorized tool parameters.' };
            } else {
              result = await dispatchToolCall(toolName, args, driverId);
            }

            toolCalls.push({
              toolName,
              args,
              result,
            });

            toolResponseParts.push({
              functionResponse: {
                name: toolName,
                response: { output: result },
              },
            });
          }

          contents.push({
            role: 'user',
            parts: toolResponseParts,
          });
        } else {
          // Model returned text response
          const rawText = content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
          
          // Post-execution Phase: Output Guardrails & Grounding Verification
          const outputRes = harness.evaluateOutput(rawText || 'I have processed your request.', toolCalls);
          const finalReport = harness.compileReport('gemini', iteration, outputRes.groundingScore, 'NORMAL');

          return {
            message: outputRes.sanitizedText,
            toolCalls,
            mode: 'gemini',
            guardrails: finalReport.guardrails,
            harnessReport: finalReport,
          };
        }
      }

      const outputRes = harness.evaluateOutput('Your request has been processed.', toolCalls);
      const finalReport = harness.compileReport('gemini', iteration, outputRes.groundingScore, 'NORMAL');

      return {
        message: outputRes.sanitizedText,
        toolCalls,
        mode: 'gemini',
        guardrails: finalReport.guardrails,
        harnessReport: finalReport,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
        console.warn('Gemini API quota exceeded (429), transitioning smoothly to deterministic rules engine.');
      } else {
        console.warn('Gemini unavailable, using deterministic rules engine:', errMsg);
      }
    }
  }

  // Deterministic Mock Agent Fallback
  return runMockAgent(driverId, userMessage, toolCalls, harness);
}

async function runMockAgent(
  driverId: string,
  userMessage: string,
  toolCalls: ToolCallRecord[],
  harness?: AgentHarness
): Promise<AgentTurnResponse> {
  const activeHarness = harness || new AgentHarness(driverId);
  const textLower = userMessage.toLowerCase();

  const completeMockTurn = (rawMsg: string): AgentTurnResponse => {
    const outputRes = activeHarness.evaluateOutput(rawMsg, toolCalls);
    const finalReport = activeHarness.compileReport('mock', 1, outputRes.groundingScore, 'NORMAL');
    return {
      message: outputRes.sanitizedText,
      toolCalls,
      mode: 'mock',
      guardrails: finalReport.guardrails,
      harnessReport: finalReport,
    };
  };

  // 1. Initial context check
  const ctx = await dispatchToolCall('get_my_current_context', {}, driverId);
  activeHarness.validateToolCall('get_my_current_context', {});
  toolCalls.push({ toolName: 'get_my_current_context', args: {}, result: ctx });

  if (ctx.status === 'pending_approval') {
    const driverName = ctx.driver_name || 'Driver';
    const vehicle = ctx.vehicle_registration || 'Submitted Vehicle';
    return completeMockTurn(
      `Welcome to Setuhaul Mr ${driverName}! Your driver registration is currently being processed and reviewed by our facility coordinator.\n\nYour profile and vehicle credentials (${vehicle}) have been submitted for review. Automated dock slot reservation and gate check-in permits will be activated as soon as the coordinator approves your account.\n\nI am here to assist with any questions about the registration process or facility guidelines.`
    );
  }

  if (ctx.status === 'escalate') {
    return completeMockTurn(
      "I apologize, but no active shipment was found for your account. I am escalating this to our operations dispatch team for immediate assistance."
    );
  }

  if (ctx.status === 'needs_information') {
    // Check if user specified an order reference in their message
    for (const choice of ctx.choices) {
      if (textLower.includes(choice.order_reference.toLowerCase()) || textLower.includes(choice.destination_facility.toLowerCase())) {
        const sel = await dispatchToolCall('select_my_shipment_by_order_reference', { order_reference: choice.order_reference }, driverId);
        activeHarness.validateToolCall('select_my_shipment_by_order_reference', { order_reference: choice.order_reference });
        toolCalls.push({ toolName: 'select_my_shipment_by_order_reference', args: { order_reference: choice.order_reference }, result: sel });
        return completeMockTurn(
          `Got it, selected shipment with order reference ${choice.order_reference} to ${choice.destination_facility}. How can I assist you with this shipment today?`
        );
      }
    }

    const choiceList = ctx.choices.map((c: any) => `• Order: ${c.order_reference} (Destination: ${c.destination_facility}, Expected: ${c.expected_eta.split('T')[1].substring(0, 5)})`).join('\n');
    return completeMockTurn(
      `You currently have ${ctx.choice_count} active shipments assigned. Please select which shipment you are referring to:\n\n${choiceList}`
    );
  }

  // 2. Status inquiry
  if (textLower.includes('status') || textLower.includes('confirmed') || textLower.includes('active') || textLower.includes('is my')) {
    const statusRes = await dispatchToolCall('get_my_exception_or_appointment_status', {}, driverId);
    activeHarness.validateToolCall('get_my_exception_or_appointment_status', {});
    toolCalls.push({ toolName: 'get_my_exception_or_appointment_status', args: {}, result: statusRes });

    if (statusRes.appointment) {
      const appt = statusRes.appointment;
      const startTime = appt.slot_start_ts ? appt.slot_start_ts.split('T')[1].substring(0, 5) : '';
      const endTime = appt.slot_end_ts ? appt.slot_end_ts.split('T')[1].substring(0, 5) : '';

      if (appt.is_warehouse_confirmed) {
        return completeMockTurn(
          `Your appointment is CONFIRMED for slot ${startTime}–${endTime} at dock ${appt.dock_code} (Warehouse Confirmation Ref: ${appt.warehouse_confirmation_ref}).`
        );
      } else {
        return completeMockTurn(
          `Your appointment for slot ${startTime}–${endTime} at dock ${appt.dock_code} is currently PENDING WAREHOUSE CONFIRMATION (Status: ${appt.status}). Capacity is held, awaiting warehouse coordinator confirmation.`
        );
      }
    } else {
      return completeMockTurn(
        `Your shipment (${statusRes.order_reference}) has status ${statusRes.current_status} with latest ETA ${statusRes.effective_eta?.split('T')[1]?.substring(0, 5) || 'unspecified'}. No active dock appointment is scheduled. Would you like to check feasible slot options?`
      );
    }
  }

  // 3. Slot selection / Booking request
  const slotMatch = userMessage.match(/SLOT-[A-Z]+-\d+/i);
  if (slotMatch || textLower.includes('book') || textLower.includes('first') || textLower.includes('second') || textLower.includes('select')) {
    let slotId = slotMatch ? slotMatch[0].toUpperCase() : null;

    if (!slotId) {
      const fresh = await dispatchToolCall('get_fresh_feasible_options', { max_options: 5 }, driverId);
      activeHarness.validateToolCall('get_fresh_feasible_options', { max_options: 5 });
      toolCalls.push({ toolName: 'get_fresh_feasible_options', args: { max_options: 5 }, result: fresh });

      if (fresh.options && fresh.options.length > 0) {
        if (textLower.includes('second') && fresh.options.length > 1) {
          slotId = fresh.options[1].slot_id;
        } else {
          slotId = fresh.options[0].slot_id;
        }
      }
    }

    if (slotId) {
      const bookRes = await dispatchToolCall('select_slot', { slot_id: slotId }, driverId);
      activeHarness.validateToolCall('select_slot', { slot_id: slotId });
      toolCalls.push({ toolName: 'select_slot', args: { slot_id: slotId }, result: bookRes });

      if (bookRes.status === 'pending_confirmation') {
        const sTime = bookRes.slot_start_ts.split('T')[1].substring(0, 5);
        const eTime = bookRes.slot_end_ts.split('T')[1].substring(0, 5);
        return completeMockTurn(
          `Your request for slot ${slotId} (${sTime}–${eTime} at dock ${bookRes.dock_code}) has been submitted. Your booking is pending warehouse confirmation. Capacity has been reserved.`
        );
      } else if (bookRes.status === 'conflict') {
        const fresh = await dispatchToolCall('get_fresh_feasible_options', { max_options: 5 }, driverId);
        activeHarness.validateToolCall('get_fresh_feasible_options', { max_options: 5 });
        toolCalls.push({ toolName: 'get_fresh_feasible_options', args: { max_options: 5 }, result: fresh });
        return completeMockTurn(
          `That slot was just taken or is no longer available. Here are the latest available options:\n` +
            fresh.options.map((o: any) => `• ${o.slot_id}: ${o.slot_start_ts.split('T')[1].substring(0, 5)}–${o.slot_end_ts.split('T')[1].substring(0, 5)} (Dock ${o.dock_code})`).join('\n')
        );
      } else {
        return completeMockTurn(
          `Unable to book slot ${slotId}: ${bookRes.message || 'Invalid selection'}. Escalating to operations coordinator.`
        );
      }
    }
  }

  // 4. Delay / ETA reporting
  const etaMatch = userMessage.match(/(\d{1,2}:\d{2})/);
  if (etaMatch || textLower.includes('late') || textLower.includes('delay') || textLower.includes('traffic') || textLower.includes('reach')) {
    let etaTime = etaMatch ? etaMatch[1] : '11:20';
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
    if (textLower.includes('low') || textLower.includes('maybe') || textLower.includes('approx') || textLower.includes('around') || textLower.includes('by one hour')) {
      confidence = textLower.includes('maybe') || textLower.includes('around') ? 'MEDIUM' : 'LOW';
    }

    let reason: string | undefined = undefined;
    if (textLower.includes('traffic')) reason = 'TRAFFIC';
    else if (textLower.includes('tyre') || textLower.includes('breakdown') || textLower.includes('mechanical')) reason = 'BREAKDOWN';
    else if (textLower.includes('weather')) reason = 'WEATHER';

    const etaRes = await dispatchToolCall('report_delay_or_eta', {
      declared_eta_ts: `2026-08-04T${etaTime.padStart(5, '0')}:00+05:30`,
      confidence_code: confidence,
      delay_reason_code: reason,
    }, driverId);
    activeHarness.validateToolCall('report_delay_or_eta', { declared_eta_ts: etaTime, confidence_code: confidence, delay_reason_code: reason });
    toolCalls.push({ toolName: 'report_delay_or_eta', args: { declared_eta_ts: etaTime, confidence_code: confidence, delay_reason_code: reason }, result: etaRes });

    // Fetch fresh feasible options
    const freshRes = await dispatchToolCall('get_fresh_feasible_options', { max_options: 5 }, driverId);
    activeHarness.validateToolCall('get_fresh_feasible_options', { max_options: 5 });
    toolCalls.push({ toolName: 'get_fresh_feasible_options', args: { max_options: 5 }, result: freshRes });

    if (freshRes.status === 'escalate' || !freshRes.options || freshRes.options.length === 0) {
      return completeMockTurn(
        `I have recorded your updated ETA of ${etaTime} with ${confidence} confidence. However, no feasible same-day dock slots are available matching your vehicle/shipment requirements. I have escalated this exception to the operations team for manual reassignment.`
      );
    }

    const optionsList = freshRes.options.map((o: any) =>
      `• ${o.slot_id}: ${o.slot_start_ts.split('T')[1].substring(0, 5)}–${o.slot_end_ts.split('T')[1].substring(0, 5)} at Dock ${o.dock_code} ${o.needs_approval ? '(Requires warehouse approval)' : ''}`
    ).join('\n');

    return completeMockTurn(
      `I have recorded your updated ETA of ${etaTime} with ${confidence} confidence.\n\nHere are the available dock slot options:\n${optionsList}\n\nPlease reply with your preferred slot ID (e.g. ${freshRes.options[0].slot_id}) to request booking.`
    );
  }

  // 5. Default greeting / general options
  const freshRes = await dispatchToolCall('get_fresh_feasible_options', { max_options: 3 }, driverId);
  activeHarness.validateToolCall('get_fresh_feasible_options', { max_options: 3 });
  toolCalls.push({ toolName: 'get_fresh_feasible_options', args: { max_options: 3 }, result: freshRes });

  if (freshRes.options && freshRes.options.length > 0) {
    const optionsList = freshRes.options.map((o: any) =>
      `• ${o.slot_id}: ${o.slot_start_ts.split('T')[1].substring(0, 5)}–${o.slot_end_ts.split('T')[1].substring(0, 5)} at Dock ${o.dock_code}`
    ).join('\n');

    return completeMockTurn(
      `Hello! I am connected to your shipment ${ctx.order_reference} arriving at ${ctx.facility_name}. Current effective ETA is ${ctx.effective_eta?.split('T')[1]?.substring(0, 5) || 'on schedule'}.\n\nAvailable slots:\n${optionsList}\n\nLet me know if you need to update your ETA or request a slot.`
    );
  }

  return completeMockTurn(
    `Hello! I am connected to your shipment ${ctx.order_reference} at ${ctx.facility_name}. How can I assist you with dock booking or ETA reporting?`
  );
}
