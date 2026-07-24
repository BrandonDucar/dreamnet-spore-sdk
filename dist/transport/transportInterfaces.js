export class InMemoryTransport {
    handlers = new Set();
    async publish(observation) {
        for (const handler of this.handlers) {
            await handler(observation).catch(err => {
                console.error('❌ [InMemoryTransport Handler Error]:', err);
            });
        }
    }
    async subscribe(handler) {
        this.handlers.add(handler);
        return () => {
            this.handlers.delete(handler);
        };
    }
}
