import { StockInput, AgentOutput, ConsensusResult, SavedSignal } from "./types";

const STORAGE_KEY = "swarm_signals";

export function saveSignal(signal: {
  stock: StockInput;
  outputs: AgentOutput[];
  consensus: ConsensusResult;
}): SavedSignal {
  const saved: SavedSignal = {
    ...signal,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  const existing = getAllSignals();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([saved, ...existing]));
  return saved;
}

export function getAllSignals(): SavedSignal[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function getSignal(id: string): SavedSignal | undefined {
  return getAllSignals().find((s) => s.id === id);
}

export function recordOutcome(id: string, finalPrice: number): void {
  const all = getAllSignals();
  const updated = all.map((s) => {
    if (s.id !== id) return s;
    const pctChange =
      ((finalPrice - s.stock.currentPrice) / s.stock.currentPrice) * 100;
    return {
      ...s,
      outcome: {
        finalPrice,
        pctChange,
        hit: pctChange >= 10,
        recordedAt: new Date().toISOString(),
      },
    };
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
