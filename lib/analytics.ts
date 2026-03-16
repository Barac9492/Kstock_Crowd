import { SavedSignal, ConsensusResult } from "./types";

export interface PerformanceMetrics {
  totalSignals: number;
  closedSignals: number;
  openSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  avgReturn: number;
  bestReturn: number;
  worstReturn: number;
  totalReturn: number; // Sum of all closed returns
  currentStreak: number; // Positive = winning streak, negative = losing
  maxWinStreak: number;
  maxLoseStreak: number;
  avgHoldDays: number;
  signalAccuracy: {
    BUY: { total: number; correct: number; rate: number };
    CAUTION: { total: number; correct: number; rate: number };
    MONITOR: { total: number; correct: number; rate: number };
  };
  monthlySummary: {
    month: string;
    signals: number;
    wins: number;
    avgReturn: number;
  }[];
}

/**
 * Compute comprehensive performance analytics from saved signals.
 */
export function computePerformance(signals: SavedSignal[]): PerformanceMetrics {
  const closed = signals.filter((s) => s.outcome);
  const open = signals.filter((s) => !s.outcome);

  const wins = closed.filter((s) => s.outcome!.hit);
  const losses = closed.filter((s) => !s.outcome!.hit);
  const returns = closed.map((s) => s.outcome!.pctChange);

  // Streaks
  let currentStreak = 0;
  let maxWin = 0;
  let maxLose = 0;
  let tempStreak = 0;

  // Sort by date for streak calculation
  const sorted = [...closed].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const s of sorted) {
    if (s.outcome!.hit) {
      tempStreak = tempStreak > 0 ? tempStreak + 1 : 1;
      maxWin = Math.max(maxWin, tempStreak);
    } else {
      tempStreak = tempStreak < 0 ? tempStreak - 1 : -1;
      maxLose = Math.max(maxLose, Math.abs(tempStreak));
    }
  }
  currentStreak = tempStreak;

  // Signal type accuracy
  const bySignal = (signal: ConsensusResult["signal"]) => {
    const matching = closed.filter((s) => s.consensus.signal === signal);
    const correct = matching.filter((s) => {
      if (signal === "BUY") return s.outcome!.pctChange >= 10;
      if (signal === "CAUTION") return s.outcome!.pctChange < 0;
      return true; // MONITOR is always "correct" (neutral)
    });
    return {
      total: matching.length,
      correct: correct.length,
      rate: matching.length > 0 ? Math.round((correct.length / matching.length) * 100) : 0,
    };
  };

  // Monthly summary
  const monthMap = new Map<string, { signals: number; wins: number; returns: number[] }>();
  for (const s of closed) {
    const month = new Date(s.timestamp).toISOString().slice(0, 7); // YYYY-MM
    const entry = monthMap.get(month) || { signals: 0, wins: 0, returns: [] };
    entry.signals++;
    if (s.outcome!.hit) entry.wins++;
    entry.returns.push(s.outcome!.pctChange);
    monthMap.set(month, entry);
  }

  const monthlySummary = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      signals: data.signals,
      wins: data.wins,
      avgReturn: Math.round((data.returns.reduce((s, r) => s + r, 0) / data.returns.length) * 10) / 10,
    }));

  // Average hold days
  const holdDays = closed
    .filter((s) => s.outcome?.recordedAt)
    .map((s) => {
      const start = new Date(s.timestamp).getTime();
      const end = new Date(s.outcome!.recordedAt!).getTime();
      return Math.floor((end - start) / (24 * 60 * 60 * 1000));
    });

  return {
    totalSignals: signals.length,
    closedSignals: closed.length,
    openSignals: open.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0,
    avgReturn:
      returns.length > 0
        ? Math.round((returns.reduce((s, r) => s + r, 0) / returns.length) * 10) / 10
        : 0,
    bestReturn: returns.length > 0 ? Math.max(...returns) : 0,
    worstReturn: returns.length > 0 ? Math.min(...returns) : 0,
    totalReturn: Math.round(returns.reduce((s, r) => s + r, 0) * 10) / 10,
    currentStreak,
    maxWinStreak: maxWin,
    maxLoseStreak: maxLose,
    avgHoldDays:
      holdDays.length > 0
        ? Math.round(holdDays.reduce((s, d) => s + d, 0) / holdDays.length)
        : 90,
    signalAccuracy: {
      BUY: bySignal("BUY"),
      CAUTION: bySignal("CAUTION"),
      MONITOR: bySignal("MONITOR"),
    },
    monthlySummary,
  };
}

/**
 * Compute Kelly Criterion fraction for position sizing.
 * Kelly% = W - (1-W)/R
 * where W = win probability, R = avg win / avg loss ratio
 * We use fractional Kelly (half Kelly) for safety.
 */
export function kellyFraction(
  winRate: number, // 0-100
  avgWin: number,  // average % gain on wins
  avgLoss: number  // average % loss on losses (positive number)
): number {
  if (winRate <= 0 || avgWin <= 0 || avgLoss <= 0) return 0;

  const W = winRate / 100;
  const R = avgWin / avgLoss;
  const kelly = W - (1 - W) / R;

  // Half Kelly for safety, capped at 25%
  return Math.max(0, Math.min(0.25, kelly * 0.5));
}

/**
 * Compute position size recommendation for a specific signal.
 */
export function computePositionSize(
  consensus: ConsensusResult,
  portfolioValue: number,
  metrics: PerformanceMetrics
): {
  kellyPct: number;
  recommendedAmount: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
} {
  const alphaGapAbs = Math.abs(consensus.alphaGap);
  const conviction = consensus.conviction;

  // Base Kelly from historical performance
  const avgWin = metrics.wins > 0
    ? metrics.bestReturn * 0.5 // Conservative estimate
    : 10; // Default target
  const avgLoss = metrics.losses > 0
    ? Math.abs(metrics.worstReturn) * 0.5
    : 5;
  const baseKelly = kellyFraction(metrics.winRate || 50, avgWin, avgLoss);

  // Adjust by current signal strength
  const signalMultiplier = Math.min(1.5, (alphaGapAbs / 20) * (conviction / 80));
  const adjustedKelly = Math.min(0.25, baseKelly * signalMultiplier);

  const recommendedAmount = Math.round(portfolioValue * adjustedKelly);

  const confidence: "high" | "medium" | "low" =
    alphaGapAbs > 20 && conviction > 70
      ? "high"
      : alphaGapAbs > 10 && conviction > 50
        ? "medium"
        : "low";

  const reasoning =
    `Kelly ${(adjustedKelly * 100).toFixed(1)}% ` +
    `(기본 ${(baseKelly * 100).toFixed(1)}% × 신호강도 ${signalMultiplier.toFixed(2)}) ` +
    `| AlphaGap ${consensus.alphaGap > 0 ? "+" : ""}${consensus.alphaGap} · 확신도 ${conviction}%`;

  return {
    kellyPct: Math.round(adjustedKelly * 1000) / 10,
    recommendedAmount,
    confidence,
    reasoning,
  };
}
