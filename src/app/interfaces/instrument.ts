import { CandleData } from "./candle-data";

export interface CryptoQuoteMapping {
    symbol: string;
    exchange: string;
}

export interface Mappings {
    cryptoquote: CryptoQuoteMapping;
}

export interface Profile {
    name: string;
    gics: Record<string, never>;
}

export interface Instrument {
    id: string;
    symbol: string;
    kind: string;
    exchange: string;
    description: string;
    tickSize: number;
    currency: string;
    baseCurrency: string;
    mappings: Mappings;
    profile: Profile;
}

export interface InstrumentWithUpdates extends Instrument {
    updates: {
        type: string,
        instrumentId: string,
        provider: string,
        bid: {
          timestamp: string,
          price: number,
          volume: number
        }
    } | null;
    candleData?: CandleData[];
}