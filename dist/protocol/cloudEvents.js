export const SPORE_CLOUD_EVENT_TYPE_PREFIX = 'ink.dreamnet.spore';
export const SPORE_ENVELOPE_MEDIA_TYPE = 'application/vnd.dreamnet.spore-envelope.v1+json';
export const SPORE_ENVELOPE_SCHEMA = 'https://schemas.dreamnet.ink/spore/spore-envelope.v1.json';
function eventType(kind) {
    return `${SPORE_CLOUD_EVENT_TYPE_PREFIX}.${kind.toLowerCase().replaceAll('_', '-')}.v1`;
}
export function toSporeCloudEvent(envelope) {
    const event = {
        specversion: '1.0',
        id: envelope.id,
        source: envelope.issuer.id,
        type: eventType(envelope.kind),
        datacontenttype: SPORE_ENVELOPE_MEDIA_TYPE,
        dataschema: SPORE_ENVELOPE_SCHEMA,
        time: envelope.issuedAt,
        sporekind: envelope.kind,
        data: envelope,
    };
    if (envelope.subject)
        event.subject = envelope.subject;
    return event;
}
export function fromSporeCloudEvent(event) {
    if (!event || typeof event !== 'object') {
        throw new TypeError('CloudEvent does not contain a structurally readable Spore envelope.');
    }
    const envelope = event.data;
    if (!envelope ||
        typeof envelope.kind !== 'string' ||
        typeof envelope.id !== 'string' ||
        typeof envelope.issuer?.id !== 'string') {
        throw new TypeError('CloudEvent does not contain a structurally readable Spore envelope.');
    }
    const valid = event.specversion === '1.0' &&
        event.id === envelope?.id &&
        event.source === envelope?.issuer?.id &&
        event.type === eventType(envelope?.kind) &&
        event.datacontenttype === SPORE_ENVELOPE_MEDIA_TYPE &&
        event.dataschema === SPORE_ENVELOPE_SCHEMA &&
        event.time === envelope?.issuedAt &&
        event.sporekind === envelope?.kind &&
        event.subject === envelope?.subject;
    if (!valid)
        throw new TypeError('CloudEvent metadata does not match its Spore envelope.');
    return envelope;
}
