import { UniverseStock } from "./universe";
import { StockInput } from "./types";

function getQuantScore(data: Partial<StockInput>): number {
  let score = 0;
  // Momentum: 1M and 3M price changes
  if (data.priceChange1M) score += data.priceChange1M;
  if (data.priceChange3M) score += data.priceChange3M * 0.5;
  
  // Foreign/Institutional Flow: 3D net buy in ~억 won
  // For every 100억, add 2 points
  if (data.foreignNetBuy3D && data.foreignNetBuy3D > 0) {
    score += data.foreignNetBuy3D / 50; 
  }

  // Value: Lower PBR adds points (baseline 3)
  if (data.pbr && data.pbr > 0) {
    score += (3 - data.pbr) * 5;
  }
  
  return score;
}

/**
 * Perform a zero-cost quantitative hard screen on the universe.
 * This runs solely on the backend using data fetched from the Naver/Wise APIs (0 LLM cost).
 * Criteria inspired by the 8 legends (e.g., PBR < 2, Foreign Net Buy > 0, Positive Price Momentum).
 */
export async function runHardScreener(
  universe: UniverseStock[],
  onProgress?: (current: number, total: number, ticker: string) => void
): Promise<StockInput[]> {
  const candidates: StockInput[] = [];
  for (let i = 0; i < universe.length; i++) {
    const u = universe[i];
    if (onProgress) {
      onProgress(i + 1, universe.length, u.name);
    }

    try {
      // Fetch basic data
      // Use relative path since this is executed on the client-side
      const res = await fetch(`/api/stock/${u.ticker}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const data: Partial<StockInput> = await res.json();

      if (!data.currentPrice || !data.name) continue;

      // HARD QUANTITATIVE FILTERS
      // 1. Must not have massive foreign sell-off (O'Neil/Soros protection)
      // Loosen: Instead of > 0, we just avoid heavy dumping (e.g., net buy < -500 indicates > 50B KRW selling)
      const foreignBuy = data.foreignNetBuy3D || 0;
      if (foreignBuy < -500) continue;

      // 2. Must not be outrageously overvalued (Graham/Buffett protection)
      // Loosen: PBR limit from 3 to 5 to allow solid growth stocks.
      const pbr = data.pbr || 99;
      if (pbr > 5) continue;

      // 3. Must not be in a massive downtrend (Price > 52W Low + 5%)
      // Loosen: 10% was too tight, 5% cushion above 52W low
      if (data.week52Low && data.currentPrice < data.week52Low * 1.05) continue;

      // 4. Must have some analyst upside (Lynch/Simons)
      // Loosen: Treat gracefully if avgTargetPrice doesn't exist
      if (data.avgTargetPrice && data.currentPrice >= data.avgTargetPrice) continue;

      // If it passes all hurdles, it's a candidate
      candidates.push(data as StockInput);

    } catch (e) {
      console.error(`Screener failed for ${u.ticker}`, e);
    }
  }

  // Sort candidates by quant score descending to get the true strongest stocks
  candidates.sort((a, b) => getQuantScore(b) - getQuantScore(a));

  // Return exactly the best 5
  return candidates.slice(0, 5);
}
