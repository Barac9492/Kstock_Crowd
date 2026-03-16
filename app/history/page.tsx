"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { SavedSignal } from "@/lib/types";
import { getAllSignals } from "@/lib/storage";
import { checkOutcomes, checkUnrealizedPnL, UnrealizedPnL } from "@/lib/outcome-tracker";
import SignalHistory from "@/components/SignalHistory";

export default function HistoryPage() {
  const [signals, setSignals] = useState<SavedSignal[]>([]);
  const [unrealized, setUnrealized] = useState<UnrealizedPnL[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    setSignals(getAllSignals());
  }, []);

  const handleCheckOutcomes = useCallback(async () => {
    setIsChecking(true);
    try {
      // Check matured signals first
      const resolved = await checkOutcomes();
      if (resolved.length > 0) {
        // Refresh signals list
        setSignals(getAllSignals());
      }

      // Then check unrealized P&L for open signals
      const pnl = await checkUnrealizedPnL();
      setUnrealized(pnl);
    } catch (err) {
      console.error("Outcome check failed:", err);
    } finally {
      setIsChecking(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Signal History</h1>
          <div className="flex gap-4">
            <Link
              href="/recommend"
              className="text-sm font-semibold text-amber-500 hover:text-amber-400 transition-colors"
            >
              Recommend
            </Link>
            <Link
              href="/scan"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Scan
            </Link>
            <Link
              href="/backtest"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Backtest
            </Link>
            <Link
              href="/"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              New Analysis
            </Link>
          </div>
        </div>

        <SignalHistory
          signals={signals}
          unrealized={unrealized}
          onCheckOutcomes={handleCheckOutcomes}
          isChecking={isChecking}
        />
      </div>
    </div>
  );
}
