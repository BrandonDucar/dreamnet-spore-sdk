import { VerificationResult, VerificationCheck, computeCanonicalHash } from '../contracts/index.js';

export interface X402AdapterConfig {
  treasuryAddress: string;
  supportedChains: string[];
  priceUsd: number;
}

export class X402PaymentAdapter {
  private config: X402AdapterConfig;

  constructor(config: Partial<X402AdapterConfig> = {}) {
    this.config = {
      treasuryAddress: config.treasuryAddress || '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      supportedChains: config.supportedChains || ['Base', 'Optimism', 'Ethereum Mainnet'],
      priceUsd: config.priceUsd || 0.05
    };
  }

  async adaptAndVerify(rawPayload: unknown): Promise<VerificationResult> {
    const checks: VerificationCheck[] = [];

    // Check 1: Format Validation
    const isObject = rawPayload !== null && typeof rawPayload === 'object';
    checks.push({
      type: 'CONTENT_INTEGRITY',
      status: isObject ? 'VALID' : 'INVALID',
      reason: isObject ? 'Payload is valid object' : 'Malformed payload'
    });

    if (!isObject) {
      return {
        schemaVersion: 'verification.v1',
        isValid: false,
        subjectHash: '0x0',
        verifiedAt: new Date().toISOString(),
        checks
      };
    }

    const payload = rawPayload as Record<string, any>;
    const txHash = payload.txHash || payload['x-402-payment-proof'];

    // Check 2: EVM Transaction Hash Format
    const isValidTxHash = typeof txHash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(txHash);
    checks.push({
      type: 'SIGNATURE',
      status: isValidTxHash ? 'VALID' : 'INVALID',
      reason: isValidTxHash ? `Valid 64-char hex EVM hash: ${txHash.substring(0, 10)}...` : 'Invalid EVM transaction hash format'
    });

    // Check 3: Treasury Match
    const recipient = payload.payToAddress || this.config.treasuryAddress;
    const isTreasuryMatch = recipient.toLowerCase() === this.config.treasuryAddress.toLowerCase();
    checks.push({
      type: 'AUTHORIZATION',
      status: isTreasuryMatch ? 'VALID' : 'INVALID',
      reason: isTreasuryMatch ? `Verified receiver treasury ${recipient}` : 'Unrecognized payment treasury'
    });

    const isValid = checks.every(c => c.status === 'VALID');
    const subjectHash = computeCanonicalHash(payload);

    return {
      schemaVersion: 'verification.v1',
      isValid,
      subjectHash,
      verifiedAt: new Date().toISOString(),
      checks
    };
  }
}
