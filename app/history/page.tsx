"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SavedSignal } from "@/lib/types";
import { getAllSignals } from "@/lib/storage";
import SignalHistory from "@/components/SignalHistory";

export default function HistoryPage() {
  const [signals, setSignals] = useState<SavedSignal[]>([]);

  useEffect(() => {
    setSignals(getAllSignals());
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Signal History</h1>
          <div className="flex gap-4">
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

        <SignalHistory signals={signals} />
      </div>
    </div>
  );
}
