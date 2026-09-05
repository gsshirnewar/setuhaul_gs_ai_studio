/**
 * SetuHaul Agent Guardrails Framework
 * Multi-tiered pre-execution, runtime, and post-execution safety & integrity checks.
 */

export interface GuardrailCheckResult {
  passed: boolean;
  name: string;
  category: 'INPUT' | 'RUNTIME' | 'OUTPUT';
  severity: 'INFO' | 'WARNING' | 'BLOCK';
  message: string;
  details?: Record<string, any>;
}

export interface GuardrailAuditReport {
  overallPassed: boolean;
  blocked: boolean;
  interceptedResponse?: string;
  checks: GuardrailCheckResult[];
  latencyMs: number;
  groundingScore: number; // 0 - 100%
  safetyCategory: 'NORMAL' | 'EMERGENCY' | 'JAILBREAK_ATTEMPT' | 'OFF_TOPIC';
}

// 1. Prompt Injection & Jailbreak Patterns
const JAILBREAK_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?system\s+prompts?/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /jailbreak/i,
  /reveal\s+(your\s+)?(system\s+prompt|instructions|hidden\s+rules)/i,
  /act\s+as\s+(an?\s+unrestricted|a\s+hacker|root|god\s+mode|dan)/i,
  /forget\s+that\s+you\s+are\s+setuhaul/i,
  /bypass\s+all\s+(filters|rules|constraints)/i,
  /drop\s+table\s+/i,
  /<script[\s>]/i,
  /sudo\s+rm\s+-rf/i,
];

// 2. Emergency Safety Patterns
const EMERGENCY_PATTERNS = [
  /\b(accident|crashed|collision|fire|smoke|injured|hospital|bleeding|explosion|toxic\s+leak|hazardous\s+spill|police\s+emergency)\b/i,
  /\b(emergency|911|112|ambulance)\b/i,
];

// 3. Domain Whitelist / Logistics Relevance
const LOGISTICS_KEYWORDS = [
  'eta', 'delay', 'traffic', 'slot', 'dock', 'warehouse', 'appointment', 'booking', 'shipment',
  'order', 'carrier', 'truck', 'trailer', 'reefer', 'breakdown', 'tyre', 'punctured', 'mechanic',
  'reach', 'arrive', 'arriving', 'gate', 'checkin', 'check-in', 'facility', 'status', 'confirm',
  'confirmed', 'reschedule', 'cancel', 'time', 'late', 'early', 'permit', 'pass', 'unload',
  'load', 'driver', 'setuhaul', 'hi', 'hello', 'hey', 'help', 'yes', 'no', 'ok', 'sure', 'first',
  'second', 'third', 'option', 'select', 'book', 'please', 'thanks', 'thank you', 'jaipur', 'delhi',
  'mumbai', 'bengaluru', 'hub'
];

/**
 * Evaluates Input Guardrails before LLM processing
 */
export function evaluateInputGuardrails(userMessage: string): {
  report: GuardrailCheckResult[];
  shouldBlock: boolean;
  interceptedResponse?: string;
  safetyCategory: 'NORMAL' | 'EMERGENCY' | 'JAILBREAK_ATTEMPT' | 'OFF_TOPIC';
} {
  const results: GuardrailCheckResult[] = [];
  const text = userMessage.trim();

  // Check 1: Prompt Injection / Jailbreak Guard
  let isJailbreak = false;
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(text)) {
      isJailbreak = true;
      break;
    }
  }

  if (isJailbreak) {
    results.push({
      name: 'Prompt Injection & Security Shield',
      category: 'INPUT',
      passed: false,
      severity: 'BLOCK',
      message: 'Blocked adversarial prompt injection or system override attempt.',
      details: { trigger: 'System integrity protection triggered.' },
    });
    return {
      report: results,
      shouldBlock: true,
      interceptedResponse: 'Security Alert: Adversarial prompt detected. SetuHaul dispatch agents operate exclusively under strict deterministic freight security protocols. How can I assist with your active shipment or dock slot?',
      safetyCategory: 'JAILBREAK_ATTEMPT',
    };
  } else {
    results.push({
      name: 'Prompt Injection & Security Shield',
      category: 'INPUT',
      passed: true,
      severity: 'INFO',
      message: 'Zero malicious prompt injection signatures detected.',
    });
  }

  // Check 2: Physical Emergency & Road Safety Guard
  let isEmergency = false;
  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.test(text)) {
      isEmergency = true;
      break;
    }
  }

  if (isEmergency) {
    results.push({
      name: 'Safety & Emergency Protocol Guard',
      category: 'INPUT',
      passed: false,
      severity: 'BLOCK',
      message: 'Critical safety or incident keyword detected. Escalating immediately to Emergency Response.',
      details: { flagged: true },
    });
    return {
      report: results,
      shouldBlock: true,
      interceptedResponse: '🚨 EMERGENCY SAFETY PROTOCOL ACTIVATED: If you or anyone else is injured or in immediate danger, please call National Emergency Services (112) or local highway patrol immediately. Our 24/7 Operations Control Center has been alerted with your telemetry and shipment coordinates.',
      safetyCategory: 'EMERGENCY',
    };
  } else {
    results.push({
      name: 'Safety & Emergency Protocol Guard',
      category: 'INPUT',
      passed: true,
      severity: 'INFO',
      message: 'No road emergency or physical hazards detected.',
    });
  }

  // Check 3: Domain Relevance & Scope Guard
  const textLower = text.toLowerCase();
  const words = textLower.split(/\s+/);
  const matchedKeywords = words.filter(w => LOGISTICS_KEYWORDS.some(k => w.includes(k) || k.includes(w)));
  const isRelevant = matchedKeywords.length > 0 || text.length < 15 || /^\d+/.test(text);

  if (!isRelevant && text.length > 40) {
    results.push({
      name: 'Logistics Domain Relevance Scope',
      category: 'INPUT',
      passed: false,
      severity: 'WARNING',
      message: 'Input appears outside freight operations & dock scheduling domain.',
      details: { matchedKeywordsCount: matchedKeywords.length },
    });
  } else {
    results.push({
      name: 'Logistics Domain Relevance Scope',
      category: 'INPUT',
      passed: true,
      severity: 'INFO',
      message: 'Query adheres to freight operations, ETA management, and dock scheduling.',
    });
  }

  return {
    report: results,
    shouldBlock: false,
    safetyCategory: 'NORMAL',
  };
}

/**
 * Validates Tool Call Parameters at Runtime (Schema & Tenant Guard)
 */
export function evaluateToolCallGuardrail(
  toolName: string,
  args: Record<string, any>,
  driverId: string
): { passed: boolean; error?: string; checkResult: GuardrailCheckResult } {
  // Check 1: Tenant Validation
  if (args.driver_id && args.driver_id !== driverId) {
    return {
      passed: false,
      error: `Unauthorized cross-driver access attempt. Session driver: ${driverId}, target: ${args.driver_id}`,
      checkResult: {
        name: 'Tenant Isolation Guard',
        category: 'RUNTIME',
        passed: false,
        severity: 'BLOCK',
        message: 'Prevented cross-driver identity spoofing in tool arguments.',
        details: { expectedDriverId: driverId, attempted: args.driver_id },
      },
    };
  }

  // Check 2: Schema validation per tool
  if (toolName === 'report_delay_or_eta') {
    if (args.confidence_code && !['HIGH', 'MEDIUM', 'LOW'].includes(args.confidence_code)) {
      return {
        passed: false,
        error: `Invalid confidence_code '${args.confidence_code}'. Must be HIGH, MEDIUM, or LOW.`,
        checkResult: {
          name: 'Tool Schema Validator',
          category: 'RUNTIME',
          passed: false,
          severity: 'BLOCK',
          message: 'Invalid confidence_code enumeration.',
        },
      };
    }
  }

  if (toolName === 'select_slot') {
    if (!args.slot_id || typeof args.slot_id !== 'string') {
      return {
        passed: false,
        error: 'Missing required slot_id string in select_slot.',
        checkResult: {
          name: 'Tool Schema Validator',
          category: 'RUNTIME',
          passed: false,
          severity: 'BLOCK',
          message: 'Malformed or missing slot_id parameter.',
        },
      };
    }
  }

  return {
    passed: true,
    checkResult: {
      name: `Runtime Sandbox: ${toolName}`,
      category: 'RUNTIME',
      passed: true,
      severity: 'INFO',
      message: `Tool arguments verified against schema and tenant isolation rules.`,
      details: { toolName, args },
    },
  };
}

/**
 * Post-execution Output Guardrail: Prevents Hallucinations & False Confirmations
 */
export function evaluateOutputGuardrails(
  modelText: string,
  toolExecutionHistory: { toolName: string; args: any; result: any }[]
): {
  sanitizedText: string;
  report: GuardrailCheckResult[];
  groundingScore: number;
} {
  const results: GuardrailCheckResult[] = [];
  let sanitized = modelText;
  let groundingScore = 100;

  // Extract all valid slot IDs and dock numbers from tool results
  const validSlotIds = new Set<string>();
  const validDockCodes = new Set<string>();
  let hasWarehouseConfirmedAppt = false;

  for (const tool of toolExecutionHistory) {
    if (tool.toolName === 'get_fresh_feasible_options' && tool.result?.options) {
      for (const opt of tool.result.options) {
        if (opt.slot_id) validSlotIds.add(opt.slot_id.toUpperCase());
        if (opt.dock_code) validDockCodes.add(opt.dock_code.toUpperCase());
      }
    }
    if (tool.toolName === 'select_slot' && tool.result?.slot_id) {
      validSlotIds.add(tool.result.slot_id.toUpperCase());
      if (tool.result.dock_code) validDockCodes.add(tool.result.dock_code.toUpperCase());
    }
    if (tool.toolName === 'get_my_exception_or_appointment_status' && tool.result?.appointment) {
      if (tool.result.appointment.is_warehouse_confirmed) {
        hasWarehouseConfirmedAppt = true;
      }
    }
  }

  // Check 1: Slot ID Hallucination Detection
  const mentionedSlotMatches = modelText.match(/SLOT-[A-Z]+-\d+/gi) || [];
  let hallucinatedSlots = 0;
  for (const match of mentionedSlotMatches) {
    const upper = match.toUpperCase();
    if (validSlotIds.size > 0 && !validSlotIds.has(upper)) {
      hallucinatedSlots++;
    }
  }

  if (hallucinatedSlots > 0) {
    groundingScore -= 30;
    results.push({
      name: 'Fact-Grounding & Slot Verification',
      category: 'OUTPUT',
      passed: false,
      severity: 'WARNING',
      message: `Detected ${hallucinatedSlots} ungrounded slot reference(s) not present in authoritative backend data.`,
      details: { hallucinatedCount: hallucinatedSlots },
    });
  } else {
    results.push({
      name: 'Fact-Grounding & Slot Verification',
      category: 'OUTPUT',
      passed: true,
      severity: 'INFO',
      message: 'All mentioned slots and operational constraints match backend query results.',
    });
  }

  // Check 2: Unauthorized Confirmation / False Promise Guardrail
  // If model says "booking confirmed" or "your slot is confirmed" when status is only pending confirmation
  const isClaimingConfirmed = /\b(your\s+(booking|slot|appointment)\s+is\s+confirmed|successfully\s+confirmed\s+your\s+slot)\b/i.test(modelText);
  if (isClaimingConfirmed && !hasWarehouseConfirmedAppt) {
    const isPendingBooking = toolExecutionHistory.some(t => t.toolName === 'select_slot' && t.result?.status === 'pending_confirmation');
    if (isPendingBooking) {
      // Auto-correct false confirmation to accurate pending warehouse confirmation
      sanitized = sanitized.replace(
        /\b(your\s+(booking|slot|appointment)\s+is\s+confirmed|is\s+now\s+confirmed)\b/gi,
        'has been requested (pending warehouse confirmation)'
      );
      groundingScore -= 10;
      results.push({
        name: 'Warehouse Confirmation Compliance Policy',
        category: 'OUTPUT',
        passed: false,
        severity: 'WARNING',
        message: 'Auto-corrected unconfirmed guarantee to "Pending Warehouse Confirmation" to comply with double-check standard.',
      });
    }
  } else {
    results.push({
      name: 'Warehouse Confirmation Compliance Policy',
      category: 'OUTPUT',
      passed: true,
      severity: 'INFO',
      message: 'Accurately distinguishes requested/pending vs confirmed warehouse appointments.',
    });
  }

  // Check 3: Raw System Prompt Leakage Scrubbing
  if (/systemPrompt|TOOL_DEFINITIONS|getGeminiClient/i.test(sanitized)) {
    sanitized = sanitized.replace(/(systemPrompt|TOOL_DEFINITIONS|getGeminiClient)/gi, '[REDACTED]');
    results.push({
      name: 'Internal System Data Leakage Filter',
      category: 'OUTPUT',
      passed: false,
      severity: 'WARNING',
      message: 'Scrubbed internal identifier references from user-facing text.',
    });
  } else {
    results.push({
      name: 'Internal System Data Leakage Filter',
      category: 'OUTPUT',
      passed: true,
      severity: 'INFO',
      message: 'Zero internal metadata leaks in generated response.',
    });
  }

  return {
    sanitizedText: sanitized,
    report: results,
    groundingScore: Math.max(0, groundingScore),
  };
}
