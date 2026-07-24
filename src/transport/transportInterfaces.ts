import { StandardObservation } from '../observation/observationContract.js';

export type ObservationHandler = (observation: StandardObservation) => Promise<void>;
export type Unsubscribe = () => void;

export interface ObservationTransport {
  publish(observation: StandardObservation): Promise<void>;
  subscribe(handler: ObservationHandler): Promise<Unsubscribe>;
}

export class InMemoryTransport implements ObservationTransport {
  private handlers: Set<ObservationHandler> = new Set();

  async publish(observation: StandardObservation): Promise<void> {
    for (const handler of this.handlers) {
      await handler(observation).catch(err => {
        console.error('❌ [InMemoryTransport Handler Error]:', err);
      });
    }
  }

  async subscribe(handler: ObservationHandler): Promise<Unsubscribe> {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}
