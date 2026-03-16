import { SavedSignal } from "./types";

const STORAGE_KEY = "swarm_signals";

/**
 * Get all saved signals from localStorage.
 */
function getAllSignals(): SavedSignal[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/**
 * Check and auto-record outcomes for matured signals.
 * Calls the stock API to get current price for each signal past T+90 days.
 * Returns the list of newly resolved signal IDs.
 */
export async function checkOutcomes(
  baseUrl: string = ""
): Promise<string[]> {
  const all = getAllSignals();
  const now = Date.now();
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const resolved: string[] = [];

  const updated = [...all];

  for (let i = 0; i < updated.length; i++) {
    const signal = updated[i];

    // Skip if already has outcome
    if (signal.outcome) continue;

    // Check if 90 days have passed
    const signalDate = new Date(signal.timestamp).getTime();
    if (now - signalDate < NINETY_DAYS_MS) continue;

    // Fetch current price
    try {
      const res = await fetch(`${baseUrl}/api/stock/${signal.stock.ticker}`);
      if (!res.ok) continue;
      const data = await res.json();

      if (!data.currentPrice) continue;

      const finalPrice = data.currentPrice;
      const pctChange =
        ((finalPrice - signal.stock.currentPrice) / signal.stock.currentPrice) *
        100;

      updated[i] = {
        ...signal,
        outcome: {
          finalPrice,
          pctChange: Math.round(pctChange * 10) / 10,
          hit: pctChange >= 10,
          recordedAt: new Date().toISOString(),
        },
      };

      resolved.push(signal.id);
    } catch {
      // Skip on error
      continue;
    }
  }

  if (resolved.length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  return resolved;
}

export interface UnrealizedPnL {
  signalId: string;
  ticker: string;
  name: string;
  entryPrice: number;
  currentPrice: number;
  pctChange: number;
  daysElapsed: number;
  daysRemaining: number;
}

/**
 * Check unrealized P&L for open signals (those without outcomes and within 90 days).
 */
export async function checkUnrealizedPnL(
  baseUrl: string = ""
): Promise<UnrealizedPnL[]> {
  const all = getAllSignals();
  const now = Date.now();
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const results: UnrealizedPnL[] = [];

  for (const signal of all) {
    // Skip if already has outcome
    if (signal.outcome) continue;

    const signalDate = new Date(signal.timestamp).getTime();
    const elapsed = now - signalDate;

    // Skip if past 90 days (should be caught by checkOutcomes)
    if (elapsed >= NINETY_DAYS_MS) continue;

    try {
      const res = await fetch(`${baseUrl}/api/stock/${signal.stock.ticker}`);
      if (!res.ok) continue;
      const data = await res.json();

      if (!data.currentPrice) continue;

      const pctChange =
        ((data.currentPrice - signal.stock.currentPrice) /
          signal.stock.currentPrice) *
        100;
      const daysElapsed = Math.floor(elapsed / (24 * 60 * 60 * 1000));

      results.push({
        signalId: signal.id,
        ticker: signal.stock.ticker,
        name: signal.stock.name,
        entryPrice: signal.stock.currentPrice,
        currentPrice: data.currentPrice,
        pctChange: Math.round(pctChange * 10) / 10,
        daysElapsed,
        daysRemaining: 90 - daysElapsed,
      });
    } catch {
      continue;
    }
  }

  return results;
}
