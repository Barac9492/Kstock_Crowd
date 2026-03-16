import { StockInput, AgentOutput, ConsensusResult } from "./types";

// A historical stock case with known outcome for backtesting
export interface BacktestCase {
  id: string;
  label: string; // e.g. "삼성전자 2024-Q3"
  stock: StockInput;
  outcome: {
    finalPrice: number;
    pctChange: number;
    hit: boolean; // pctChange >= 10%
    period: "3M";
  };
}

// Result of running one case through the swarm
export interface BacktestResult {
  caseId: string;
  label: string;
  stock: StockInput;
  outputs: AgentOutput[];
  consensus: ConsensusResult;
  outcome: BacktestCase["outcome"];
  // Derived
  predictionCorrect: boolean; // Did signal direction match outcome?
  probabilityError: number; // |predicted probability - actual binary outcome * 100|
}

// Per-agent accuracy stats
export interface AgentStats {
  agentId: string;
  name: string;
  avgProbability: number;
  avgError: number; // Mean absolute error vs outcome
  brierScore: number; // Lower is better: mean of (prob/100 - outcome)^2
  accuracy: number; // % of cases where directional call was correct
  bullishBias: number; // avg probability - 50 (positive = bullish tendency)
  bestCase?: { label: string; error: number };
  worstCase?: { label: string; error: number };
}

// Full backtest report
export interface BacktestReport {
  timestamp: string;
  totalCases: number;
  results: BacktestResult[];
  agentStats: AgentStats[];
  overallAccuracy: number; // % signals that matched outcome
  overallBrierScore: number;
  signalBreakdown: {
    buy: { total: number; correct: number };
    caution: { total: number; correct: number };
    monitor: { total: number; correct: number };
  };
  recommendations: string[]; // AI-generated tuning suggestions
}

// Progress callback for streaming
export interface BacktestProgress {
  currentCase: number;
  totalCases: number;
  currentLabel: string;
  phase: "running_swarm" | "computing_stats" | "generating_recommendations" | "done";
}
