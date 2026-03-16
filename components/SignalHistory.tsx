"use client";

import { useState } from "react";
import Link from "next/link";
import { SavedSignal } from "@/lib/types";
import { getAlphaGapColor } from "@/lib/consensus";
import { UnrealizedPnL } from "@/lib/outcome-tracker";

interface SignalHistoryProps {
  signals: SavedSignal[];
  unrealized?: UnrealizedPnL[];
  onCheckOutcomes?: () => void;
  isChecking?: boolean;
}

function getSignalStyle(signal: string) {
  switch (signal) {
    case "BUY":
      return "bg-green-900/50 text-green-400";
    case "CAUTION":
      return "bg-red-900/50 text-red-400";
    default:
      return "bg-yellow-900/50 text-yellow-400";
  }
}

export default function SignalHistory({
  signals,
  unrealized = [],
  onCheckOutcomes,
  isChecking = false,
}: SignalHistoryProps) {
  const closed = signals.filter((s) => s.outcome);
  const hits = closed.filter((s) => s.outcome?.hit);
  const open = signals.filter((s) => !s.outcome);

  // Map unrealized P&L by signal ID
  const unrealizedMap = new Map(unrealized.map((u) => [u.signalId, u]));

  return (
    <div>
      {/* Summary stats */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-gray-400">
          저장된 신호: {signals.length} / 마감: {closed.length} / 적중:{" "}
          {hits.length}{" "}
          {closed.length > 0 && (
            <span>({Math.round((hits.length / closed.length) * 100)}%)</span>
          )}
          {open.length > 0 && (
            <span className="text-gray-500 ml-2">
              · 진행중: {open.length}
            </span>
          )}
        </div>
        {onCheckOutcomes && (
          <button
            onClick={onCheckOutcomes}
            disabled={isChecking}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              isChecking
                ? "border-gray-700 text-gray-600 cursor-not-allowed"
                : "border-indigo-600/30 text-indigo-400 hover:bg-indigo-600/10"
            }`}
          >
            {isChecking ? "확인 중..." : "📡 결과 확인"}
          </button>
        )}
      </div>

      {signals.length === 0 ? (
        <p className="text-gray-600 text-center py-12">
          저장된 신호가 없습니다. 메인 페이지에서 분석을 실행하세요.
        </p>
      ) : (
        <div className="space-y-2">
          {signals.map((s) => {
            const pnl = unrealizedMap.get(s.id);
            return (
              <Link
                key={s.id}
                href={`/signal/${s.id}`}
                className="block rounded-lg border border-gray-800 bg-gray-900 p-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-white">
                      {s.stock.name}
                    </span>
                    <span className="text-gray-500 text-sm">
                      {s.stock.ticker}
                    </span>
                    <span className="text-gray-600 text-xs">
                      {new Date(s.timestamp).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm ${getAlphaGapColor(s.consensus.alphaGap, s.consensus.sp)}`}>
                      SP {s.consensus.sp}% / MIP {s.consensus.mip}% / Gap{" "}
                      {s.consensus.alphaGap > 0 ? "+" : ""}
                      {s.consensus.alphaGap}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${getSignalStyle(s.consensus.signal)}`}
                    >
                      {s.consensus.signal}
                    </span>
                    {s.outcome ? (
                      <span
                        className={`text-xs font-semibold ${s.outcome.hit ? "text-green-400" : "text-red-400"}`}
                      >
                        {s.outcome.pctChange > 0 ? "+" : ""}
                        {s.outcome.pctChange.toFixed(1)}%
                      </span>
                    ) : pnl ? (
                      <span className="text-xs">
                        <span
                          className={
                            pnl.pctChange >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }
                        >
                          {pnl.pctChange >= 0 ? "+" : ""}
                          {pnl.pctChange.toFixed(1)}%
                        </span>
                        <span className="text-gray-600 ml-1">
                          D-{pnl.daysRemaining}
                        </span>
                      </span>
                    ) : !s.outcome ? (
                      <span className="text-xs text-gray-600">진행중</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
