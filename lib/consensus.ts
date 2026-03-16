import { AgentOutput, StockInput, ConsensusResult } from "./types";

export function computeConsensus(
  outputs: AgentOutput[],
  stock: StockInput,
  weights?: Record<string, number>
): ConsensusResult {
  const probs = outputs.map((o) => o.probability);

  // Weighted or simple average for Swarm Probability
  let sp: number;
  if (weights) {
    const totalWeight = outputs.reduce(
      (s, o) => s + (weights[o.agentId] ?? 1 / 8),
      0
    );
    sp = Math.round(
      outputs.reduce(
        (s, o) => s + o.probability * (weights[o.agentId] ?? 1 / 8),
        0
      ) / (totalWeight || 1)
    );
  } else {
    sp = Math.round(probs.reduce((s, p) => s + p, 0) / probs.length);
  }

  // Market-Implied Probability from analyst target spread
  const range = stock.highTargetPrice - stock.lowTargetPrice;
  const upside = stock.avgTargetPrice - stock.currentPrice;
  const rawMip = range > 0 ? (upside / range) * 60 + 20 : 50;
  const totalRatings =
    stock.buyRatings + stock.holdRatings + stock.sellRatings;
  const buyRatio = totalRatings > 0 ? stock.buyRatings / totalRatings : 0.5;
  const mip = Math.round(
    Math.max(10, Math.min(90, rawMip + (buyRatio - 0.5) * 20))
  );

  const alphaGap = sp - mip;

  // Conviction: inverse of standard deviation
  const mean = probs.reduce((s, p) => s + p, 0) / probs.length;
  const stdDev = Math.sqrt(
    probs.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / probs.length
  );
  const conviction = Math.round(
    Math.max(0, Math.min(100, 100 - stdDev * 3.3))
  );

  const signal: ConsensusResult["signal"] =
    alphaGap > 15 && conviction > 60
      ? "BUY"
      : alphaGap < -15 && conviction > 60
        ? "CAUTION"
        : "MONITOR";

  // Actionable Retail Targets (TP / SL) for BUY signals
  let takeProfitPrice: number | undefined = undefined;
  let stopLossPrice: number | undefined = undefined;

  if (signal === "BUY" && stock.currentPrice) {
    // TP upside is bounded between 10% and 30% or the alpha gap
    const targetUpsidePct = Math.min(30, Math.max(10, alphaGap));
    takeProfitPrice = Math.round(stock.currentPrice * (1 + targetUpsidePct / 100));
    // Risk/Reward ratio 1:2 -> Stop loss is half the distance of TP
    const slDistance = (takeProfitPrice - stock.currentPrice) / 2;
    stopLossPrice = Math.round(stock.currentPrice - slDistance);
  }

  return { sp, mip, alphaGap, conviction, signal, takeProfitPrice, stopLossPrice };
}

export function getAlphaGapColor(alphaGap: number, sp: number): string {
  if (sp >= 50) {
    if (alphaGap > 0) return "text-emerald-400";
    if (alphaGap < 0) return "text-red-400";
    return "text-gray-400";
  } else {
    // If SP is pessimistic (< 50%), a positive gap just means "less pessimistic" than the market,
    // so it shouldn't be green. But if it's negative, it's "even worse", so keep red.
    if (alphaGap < 0) return "text-red-400";
    return "text-gray-400";
  }
}
