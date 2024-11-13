export interface CandleData {
    t: string | Date;  // ISO 8601 timestamp
    o: number;         // open price
    h: number;         // high price
    l: number;         // low price
    c: number;         // close price
    v: number;         // volume
}

export interface CandleResponse {
    data: CandleData[];
}