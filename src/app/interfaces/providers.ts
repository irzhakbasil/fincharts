export type Provider = "active-tick" | "alpaca" | "cryptoquote" | "dxfeed" | "oanda" | "simulation";

export type Exchange = "" | "MSFX" | "XNAS" | "XNYS" | "BATS" | "NASDAQ" | "NYSE" | "BINANCE";

export interface ProviderExchanges {
    "oanda": Exchange[];
    "dxfeed": Exchange[];
    "simulation": Exchange[];
    "alpaca": Exchange[];
    "cryptoquote": Exchange[];
    "active-tick": Exchange[];
}
