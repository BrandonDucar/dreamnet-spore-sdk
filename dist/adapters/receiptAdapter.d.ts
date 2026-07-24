import { VerificationResult } from '../contracts/index.js';
/**
 * Generic Ecosystem-Neutral Receipt Adapter Interface
 * Compatible with ZAO, Sparkz, LangGraph, OpenAI Agents, Temporal, MCP, OpenClaw, and GitHub Actions.
 */
export interface GenericReceiptAdapter<TExternal, TPortable> {
    adapterId: string;
    targetRuntime: string;
    wrap(input: TExternal): TPortable;
    unwrap(input: TPortable): TExternal;
    verify?(input: TPortable): Promise<VerificationResult>;
}
