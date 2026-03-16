import { UniverseStock } from "./universe";
import { StockInput } from "./types";

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
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  for (let i = 0; i < universe.length; i++) {
    const u = universe[i];
    if (onProgress) {
      onProgress(i + 1, universe.length, u.name);
    }

    try {
      // Fetch basic data
      const res = await fetch(`${BASE_URL}/api/stock/${u.ticker}`, { cache: "no-store" });
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

      // Stop once we have 5 solid candidates to avoid unnecessary fetching
      if (candidates.length >= 5) break;

    } catch (e) {
      console.error(`Screener failed for ${u.ticker}`, e);
    }
  }

  // If we couldn't find 5, just return what we have
  return candidates;
}
