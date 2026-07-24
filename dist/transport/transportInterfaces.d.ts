import { StandardObservation } from '../observation/observationContract.js';
export type ObservationHandler = (observation: StandardObservation) => Promise<void>;
export type Unsubscribe = () => void;
export interface ObservationTransport {
    publish(observation: StandardObservation): Promise<void>;
    subscribe(handler: ObservationHandler): Promise<Unsubscribe>;
}
export declare class InMemoryTransport implements ObservationTransport {
    private handlers;
    publish(observation: StandardObservation): Promise<void>;
    subscribe(handler: ObservationHandler): Promise<Unsubscribe>;
}
