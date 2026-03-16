"use client";

import { ConsensusResult } from "@/lib/types";
import { getAlphaGapColor } from "@/lib/consensus";

interface ConsensusPanelProps {
  consensus: ConsensusResult;
}

function getSignalStyle(signal: ConsensusResult["signal"]) {
  switch (signal) {
    case "BUY":
      return "bg-green-600 text-white";
    case "CAUTION":
      return "bg-red-600 text-white";
    case "MONITOR":
      return "bg-yellow-600 text-black";
  }
}

export default function ConsensusPanel({ consensus }: ConsensusPanelProps) {
  const { sp, mip, alphaGap, conviction, signal } = consensus;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white">Consensus</h2>
        <span
          className={`px-4 py-1.5 rounded-full font-bold text-sm ${getSignalStyle(signal)}`}
        >
          {signal}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Swarm Prob
          </div>
          <div className="text-3xl font-bold text-white">{sp}%</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Market Implied
          </div>
          <div className="text-3xl font-bold text-gray-400">{mip}%</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Alpha Gap
          </div>
          <div
            className={`text-3xl font-bold ${getAlphaGapColor(alphaGap, sp)}`}
          >
            {alphaGap > 0 ? "+" : ""}
            {alphaGap}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Conviction
          </div>
          <div className="text-3xl font-bold text-blue-400">{conviction}%</div>
        </div>
      </div>
    </div>
  );
}
