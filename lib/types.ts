export interface StockInput {
  // Required
  ticker: string;
  name: string;
  currentPrice: number;

  // Valuation
  pbr: number;
  per: number;
  roe: number;
  dividendYield: number;

  // Analyst consensus
  avgTargetPrice: number;
  highTargetPrice: number;
  lowTargetPrice: number;
  buyRatings: number;
  holdRatings: number;
  sellRatings: number;

  // Flows
  foreignHoldingPct: number;
  foreignNetBuy3D: number;
  shortInterestPct: number;

  // Price context
  week52High: number;
  week52Low: number;
  priceChange1M: number;
  priceChange3M: number;

  // Free text
  notes: string;
}

export interface AgentOutput {
  agentId: string;
  name: string;
  probability: number;
  reasoning: string;
  round: number;
}

export interface ConsensusResult {
  sp: number;
  mip: number;
  alphaGap: number;
  conviction: number;
  signal: "BUY" | "CAUTION" | "MONITOR";
}

export interface SavedSignal {
  id: string;
  timestamp: string;
  stock: StockInput;
  outputs: AgentOutput[];
  consensus: ConsensusResult;
  outcome?: {
    finalPrice: number;
    pctChange: number;
    hit: boolean;
    recordedAt: string;
  };
}
