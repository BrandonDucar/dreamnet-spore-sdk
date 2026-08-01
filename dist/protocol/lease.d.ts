import { type KeyLike } from 'node:crypto';
import { type SporeEnvelope, type SporeIssuer } from './envelope.js';
export interface SporeLeasePayload {
    schemaVersion: 'spore-lease.v1';
    tenantId: string;
    sporeId: string;
    state: 'ACTIVE' | 'PAUSED' | 'REVOKED';
    capabilities: string[];
    notBefore: string;
    policyRef: string;
}
export interface CreateSporeLeaseOptions {
    issuer: SporeIssuer;
    audience: string[];
    issuedAt: string;
    expiresAt: string;
    nonce: string;
    payload: SporeLeasePayload;
    parents?: string[];
}
export interface LeaseRequest {
    tenantId: string;
    sporeId: string;
    capability: string;
    audience: string;
    now?: Date;
}
export interface LeaseDecision {
    allowed: boolean;
    reason: 'LEASE_ACTIVE' | 'LEASE_MISSING' | 'LEASE_INVALID' | 'LEASE_INACTIVE' | 'LEASE_NOT_YET_ACTIVE' | 'TENANT_MISMATCH' | 'SPORE_MISMATCH' | 'CAPABILITY_DENIED';
}
export declare function assertSporeLeasePayload(payload: SporeLeasePayload): void;
export declare function createSporeLease(options: CreateSporeLeaseOptions, privateKey: KeyLike): SporeEnvelope<SporeLeasePayload>;
export declare function evaluateSporeLease(lease: SporeEnvelope<SporeLeasePayload> | undefined, request: LeaseRequest, issuerPublicKey: KeyLike): LeaseDecision;
