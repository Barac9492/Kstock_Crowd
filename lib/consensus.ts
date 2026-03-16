import { AgentOutput, StockInput, ConsensusResult } from "./types";

export function computeConsensus(
  outputs: AgentOutput[],
  stock: StockInput
): ConsensusResult {
  const probs = outputs.map((o) => o.probability);
  const sp = Math.round(probs.reduce((s, p) => s + p, 0) / probs.length);

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

  return { sp, mip, alphaGap, conviction, signal };
}
