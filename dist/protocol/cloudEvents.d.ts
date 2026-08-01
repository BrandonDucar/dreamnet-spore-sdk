import type { SporeEnvelope, SporeEnvelopeKind } from './envelope.js';
export declare const SPORE_CLOUD_EVENT_TYPE_PREFIX: "ink.dreamnet.spore";
export declare const SPORE_ENVELOPE_MEDIA_TYPE: "application/vnd.dreamnet.spore-envelope.v1+json";
export declare const SPORE_ENVELOPE_SCHEMA: "https://schemas.dreamnet.ink/spore/spore-envelope.v1.json";
export interface SporeCloudEvent<TPayload = unknown> {
    specversion: '1.0';
    id: string;
    source: string;
    type: string;
    datacontenttype: typeof SPORE_ENVELOPE_MEDIA_TYPE;
    dataschema: typeof SPORE_ENVELOPE_SCHEMA;
    time: string;
    subject?: string;
    sporekind: SporeEnvelopeKind;
    data: SporeEnvelope<TPayload>;
}
export declare function toSporeCloudEvent<TPayload>(envelope: SporeEnvelope<TPayload>): SporeCloudEvent<TPayload>;
export declare function fromSporeCloudEvent<TPayload>(event: SporeCloudEvent<TPayload>): SporeEnvelope<TPayload>;
