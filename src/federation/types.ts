/**
 * Spore Federation Protocol V1 Core Types & Interfaces
 * 
 * Invariants:
 * 1. Wire protocol is transport-agnostic and runtime-neutral.
 * 2. Top-level envelope fields are strictly bounded (UNKNOWN_FIELD_REJECTED).
 * 3. RFC 8785 JSON Canonicalization Scheme (JCS) + SHA-256 + Ed25519 signatures.
 */

import type { KeyObject } from 'node:crypto';

export type SporeEnvelopeType = 'mission' | 'receipt' | 'capability_query' | 'event';

export interface SporeEnvelopeV1<TPayload = Record<string, unknown>> {
  v: 'spore-envelope-v1';
  type: SporeEnvelopeType;
  issuer: string;
  recipient: string;
  nonce: string;
  created_at: string;
  expires_at: string;
  payload: TPayload;
  id: string;
  signature: string;
  key_id?: string;
}

export interface ApplicationReceiptV1 {
  receipt_id: string;
  mission_id: string;
  original_envelope_id: string;
  state: 'completed' | 'failed' | 'rejected';
  original_payload_hash: string;
  observed_effect_hash: string;
  completed_at: string;
  details?: Record<string, unknown>;
}

export interface SporePublicKeyInfo {
  key_id: string;
  type: 'Ed25519VerificationKey2020';
  purpose: string;
  publicKeyPem: string;
  status: 'ACTIVE' | 'REVOKED';
}

export interface SporeManifestEndpoints {
  inbound_mission_push: string;
  inbound_receipt_push: string;
  outbound_inbox_pull: string;
  proof_of_possession: string;
  credential_verification: string;
  state_inspection: string;
}

export interface SporeAddressingConventions {
  internal_agents: string;
  external_peers: string;
  routing_pattern: string;
}

export interface SporeSdkInfo {
  repository: string;
  protocol_version: string;
  version: string;
  commit?: string;
  tag?: string;
  conformance_command: string;
}

export interface SporeManifestV1 {
  v: 'spore-manifest-v1';
  protocol_version?: string;
  civilization_id: string;
  name: string;
  description: string;
  sdk?: SporeSdkInfo;
  public_keys: SporePublicKeyInfo[];
  supported_protocols: string[];
  endpoints: SporeManifestEndpoints;
  addressing_conventions: SporeAddressingConventions;
  created_at: string;
  expires_at: string;
  manifest_digest: string;
  status: string;
}

export interface SporeKeypair {
  publicKey: KeyObject;
  privateKey: KeyObject;
  publicKeyPem: string;
  privateKeyPem: string;
}

export interface SporeVerificationResult {
  valid: boolean;
  code?: string;
  error?: string;
  computedHash?: string;
}
