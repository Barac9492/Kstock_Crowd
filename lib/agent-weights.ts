import { BacktestReport } from "./backtest-types";

const WEIGHTS_KEY = "swarm_agent_weights";

export interface AgentWeights {
  weights: Record<string, number>;
  source: "backtest" | "manual" | "default";
  updatedAt: string;
  backtestAccuracy?: number;
}

/**
 * Default equal weights for all 8 agents.
 */
const DEFAULT_WEIGHTS: Record<string, number> = {
  value_investor: 0.125,
  momentum_trader: 0.125,
  short_seller: 0.125,
  retail_sentiment: 0.125,
  macro_economist: 0.125,
  sector_specialist: 0.125,
  foreign_institutional: 0.125,
  risk_manager: 0.125,
};

/**
 * Compute weights from backtest results using inverse Brier score.
 * Lower Brier = better calibration = higher weight.
 */
export function computeWeightsFromBacktest(
  report: BacktestReport
): AgentWeights {
  const { agentStats } = report;

  if (agentStats.length === 0) {
    return {
      weights: { ...DEFAULT_WEIGHTS },
      source: "default",
      updatedAt: new Date().toISOString(),
    };
  }

  // Inverse Brier: weight = (1 - brierScore) for each agent
  // Then normalize so they sum to 1
  const rawWeights: Record<string, number> = {};
  let totalRaw = 0;

  for (const stat of agentStats) {
    // Clamp Brier to [0, 1] range
    const brier = Math.max(0, Math.min(1, stat.brierScore));
    const inverseBrier = 1 - brier;
    rawWeights[stat.agentId] = inverseBrier;
    totalRaw += inverseBrier;
  }

  // Normalize
  const weights: Record<string, number> = {};
  for (const [agentId, raw] of Object.entries(rawWeights)) {
    weights[agentId] =
      totalRaw > 0
        ? Math.round((raw / totalRaw) * 10000) / 10000
        : DEFAULT_WEIGHTS[agentId] || 0.125;
  }

  return {
    weights,
    source: "backtest",
    updatedAt: new Date().toISOString(),
    backtestAccuracy: report.overallAccuracy,
  };
}

/**
 * Save weights to localStorage.
 */
export function saveWeights(agentWeights: AgentWeights): void {
  localStorage.setItem(WEIGHTS_KEY, JSON.stringify(agentWeights));
}

/**
 * Load weights from localStorage. Returns default equal weights if none saved.
 */
export function loadWeights(): AgentWeights {
  try {
    const stored = localStorage.getItem(WEIGHTS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Fall through to default
  }
  return {
    weights: { ...DEFAULT_WEIGHTS },
    source: "default",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get weight for a specific agent. Falls back to equal weight.
 */
export function getWeight(
  weights: Record<string, number>,
  agentId: string
): number {
  return weights[agentId] ?? 0.125;
}

/**
 * Format weights for display.
 */
export function formatWeight(weight: number): string {
  return `${Math.round(weight * 1000) / 10}%`;
}
