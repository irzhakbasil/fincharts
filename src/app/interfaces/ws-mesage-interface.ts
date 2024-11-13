export interface L1Subscription {
    type: string;
    id: string;
    instrumentId: string;
    provider: string;
    subscribe: boolean;
    kinds: string[];
}