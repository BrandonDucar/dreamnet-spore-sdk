import { VerificationResult } from '../contracts/index.js';
export interface X402AdapterConfig {
    treasuryAddress: string;
    supportedChains: string[];
    priceUsd: number;
}
export declare class X402PaymentAdapter {
    private config;
    constructor(config?: Partial<X402AdapterConfig>);
    adaptAndVerify(rawPayload: unknown): Promise<VerificationResult>;
}
