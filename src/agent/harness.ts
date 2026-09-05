/**
 * SetuHaul LLM Agent Execution & Evaluation Harness
 * Governs the execution lifecycle, step budgets, latency benchmarks,
 * guardrail enforcement, and evaluation reports.
 */

import {
  evaluateInputGuardrails,
  evaluateToolCallGuardrail,
  evaluateOutputGuardrails,
  GuardrailCheckResult,
  GuardrailAuditReport,
} from './guardrails';
import { ToolCallRecord, AgentTurnResponse } from './agent';

export interface HarnessExecutionReport {
  sessionId: string;
  driverId: string;
  turnNumber: number;
  totalLatencyMs: number;
  iterationsCount: number;
  mode: 'gemini' | 'mock';
  guardrails: GuardrailAuditReport;
  toolsInvoked: string[];
}

export class AgentHarness {
  private startTime: number = 0;
  private checks: GuardrailCheckResult[] = [];
  private toolsInvoked: string[] = [];

  constructor(
    public readonly driverId: string,
    public readonly sessionId: string = `HARN-${Date.now()}`
  ) {}

  startTurn(): void {
    this.startTime = Date.now();
    this.checks = [];
    this.toolsInvoked = [];
  }

  /**
   * Pre-execution phase: Input Guardrail checks
   */
  evaluateInput(userMessage: string) {
    const inputRes = evaluateInputGuardrails(userMessage);
    this.checks.push(...inputRes.report);
    return inputRes;
  }

  /**
   * Runtime phase: Tool schema and tenant isolation validation
   */
  validateToolCall(toolName: string, args: Record<string, any>): { passed: boolean; error?: string } {
    this.toolsInvoked.push(toolName);
    const res = evaluateToolCallGuardrail(toolName, args, this.driverId);
    this.checks.push(res.checkResult);
    return { passed: res.passed, error: res.error };
  }

  /**
   * Post-execution phase: Output Guardrails, grounding verification, and safety sanitization
   */
  evaluateOutput(
    modelText: string,
    toolHistory: ToolCallRecord[]
  ): { sanitizedText: string; groundingScore: number } {
    const outputRes = evaluateOutputGuardrails(modelText, toolHistory);
    this.checks.push(...outputRes.report);
    return {
      sanitizedText: outputRes.sanitizedText,
      groundingScore: outputRes.groundingScore,
    };
  }

  /**
   * Finalizes the turn and compiles comprehensive harness audit report
   */
  compileReport(
    mode: 'gemini' | 'mock',
    iterationsCount: number,
    groundingScore: number = 100,
    safetyCategory: 'NORMAL' | 'EMERGENCY' | 'JAILBREAK_ATTEMPT' | 'OFF_TOPIC' = 'NORMAL'
  ): HarnessExecutionReport {
    const latencyMs = Date.now() - this.startTime;
    const overallPassed = this.checks.every(c => c.severity !== 'BLOCK');
    const blocked = this.checks.some(c => c.severity === 'BLOCK');

    return {
      sessionId: this.sessionId,
      driverId: this.driverId,
      turnNumber: 1,
      totalLatencyMs: latencyMs,
      iterationsCount,
      mode,
      toolsInvoked: this.toolsInvoked,
      guardrails: {
        overallPassed,
        blocked,
        checks: this.checks,
        latencyMs,
        groundingScore,
        safetyCategory,
      },
    };
  }
}
