"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { SavedSignal } from "@/lib/types";
import { getAllSignals } from "@/lib/storage";
import {
  computePerformance,
  computePositionSize,
  PerformanceMetrics,
} from "@/lib/analytics";
import { checkUnrealizedPnL, UnrealizedPnL } from "@/lib/outcome-tracker";

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color || "text-white"}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function PortfolioPage() {
  const [signals, setSignals] = useState<SavedSignal[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [unrealized, setUnrealized] = useState<UnrealizedPnL[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const all = getAllSignals();
    setSignals(all);
    setMetrics(computePerformance(all));
    setLoading(false);

    // Fetch unrealized P&L for open positions
    checkUnrealizedPnL().then(setUnrealized).catch(() => {});
  }, []);

  const open = signals.filter((s) => !s.outcome);
  const closed = signals.filter((s) => s.outcome);
  const unrealizedMap = new Map(unrealized.map((u) => [u.signalId, u]));

  // Sector distribution
  const sectorMap = new Map<string, number>();
  for (const s of open) {
    // Simple sector assignment by name pattern
    const name = s.stock.name;
    let sector = "기타";
    if (name.includes("전자") || name.includes("하이닉스")) sector = "반도체";
    else if (name.includes("카카오") || name.includes("네이버")) sector = "인터넷";
    else if (name.includes("차") || name.includes("기아")) sector = "자동차";
    else if (name.includes("SDI") || name.includes("에너지")) sector = "배터리";
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + 1);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">📈 Portfolio</h1>
            <p className="text-sm text-gray-400 mt-1">
              포트폴리오 현황 & 성과 분석
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
              Analysis
            </Link>
            <Link href="/scan" className="text-sm text-gray-400 hover:text-white transition-colors">
              Scan
            </Link>
            <Link href="/backtest" className="text-sm text-gray-400 hover:text-white transition-colors">
              Backtest
            </Link>
            <Link href="/history" className="text-sm text-gray-400 hover:text-white transition-colors">
              History
            </Link>
          </div>
        </div>

        {signals.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <div className="text-4xl mb-4">📊</div>
            <p>저장된 신호가 없습니다</p>
            <Link href="/" className="text-indigo-400 text-sm hover:underline mt-2 inline-block">
              분석 시작하기 →
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Summary Stats */}
            {metrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="총 신호"
                  value={`${metrics.totalSignals}`}
                  sub={`진행 ${metrics.openSignals} · 마감 ${metrics.closedSignals}`}
                />
                <StatCard
                  label="승률"
                  value={`${metrics.winRate}%`}
                  sub={`${metrics.wins}W ${metrics.losses}L`}
                  color={metrics.winRate >= 50 ? "text-emerald-400" : "text-red-400"}
                />
                <StatCard
                  label="총 수익"
                  value={`${metrics.totalReturn > 0 ? "+" : ""}${metrics.totalReturn}%`}
                  sub={`평균 ${metrics.avgReturn > 0 ? "+" : ""}${metrics.avgReturn}%`}
                  color={metrics.totalReturn >= 0 ? "text-emerald-400" : "text-red-400"}
                />
                <StatCard
                  label="연승"
                  value={
                    metrics.currentStreak > 0
                      ? `${metrics.currentStreak}W 🔥`
                      : metrics.currentStreak < 0
                        ? `${Math.abs(metrics.currentStreak)}L`
                        : "-"
                  }
                  sub={`최대승 ${metrics.maxWinStreak} · 최대패 ${metrics.maxLoseStreak}`}
                  color={metrics.currentStreak > 0 ? "text-emerald-400" : metrics.currentStreak < 0 ? "text-red-400" : "text-gray-400"}
                />
              </div>
            )}

            {/* Open Positions */}
            {open.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  진행중 포지션 ({open.length})
                </h2>
                <div className="space-y-2">
                  {open.map((s) => {
                    const pnl = unrealizedMap.get(s.id);
                    const daysElapsed = Math.floor(
                      (Date.now() - new Date(s.timestamp).getTime()) / (24 * 60 * 60 * 1000)
                    );
                    return (
                      <Link
                        key={s.id}
                        href={`/signal/${s.id}`}
                        className="block bg-gray-900/50 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-white">
                              {s.stock.name}
                            </span>
                            <span className="text-gray-500 text-sm">
                              {s.stock.ticker}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-mono ${
                                s.consensus.signal === "BUY"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : s.consensus.signal === "CAUTION"
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-gray-500/20 text-gray-400"
                              }`}
                            >
                              {s.consensus.signal}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-500">
                              D+{daysElapsed} / 90
                            </span>
                            {pnl ? (
                              <span
                                className={`font-mono ${
                                  pnl.pctChange >= 0
                                    ? "text-emerald-400"
                                    : "text-red-400"
                                }`}
                              >
                                {pnl.pctChange >= 0 ? "+" : ""}
                                {pnl.pctChange.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                            <span className="text-gray-500 text-xs">
                              Gap {s.consensus.alphaGap > 0 ? "+" : ""}
                              {s.consensus.alphaGap}
                            </span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500/50 rounded-full"
                            style={{ width: `${Math.min(100, (daysElapsed / 90) * 100)}%` }}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sector Distribution */}
            {sectorMap.size > 0 && (
              <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                <h3 className="text-sm font-medium text-gray-300 mb-4">
                  섹터 분포 (진행중)
                </h3>
                <div className="flex gap-3 flex-wrap">
                  {[...sectorMap.entries()].map(([sector, count]) => (
                    <div
                      key={sector}
                      className="bg-gray-800/50 rounded-lg px-4 py-2 text-center"
                    >
                      <div className="text-sm font-medium text-white">{sector}</div>
                      <div className="text-xs text-gray-400">{count}종목</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signal Accuracy by Type */}
            {metrics && metrics.closedSignals > 0 && (
              <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                <h3 className="text-sm font-medium text-gray-300 mb-4">
                  시그널 정확도
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {(["BUY", "CAUTION", "MONITOR"] as const).map((type) => {
                    const data = metrics.signalAccuracy[type];
                    if (data.total === 0) return null;
                    return (
                      <div key={type} className="text-center">
                        <div
                          className={`text-sm font-semibold mb-1 ${
                            type === "BUY"
                              ? "text-emerald-400"
                              : type === "CAUTION"
                                ? "text-red-400"
                                : "text-gray-400"
                          }`}
                        >
                          {type}
                        </div>
                        <div className="text-2xl font-bold text-white">
                          {data.rate}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {data.correct}/{data.total}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Monthly Summary */}
            {metrics && metrics.monthlySummary.length > 0 && (
              <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                <h3 className="text-sm font-medium text-gray-300 mb-4">
                  월별 실적
                </h3>
                <div className="space-y-2">
                  {metrics.monthlySummary.map((m) => (
                    <div
                      key={m.month}
                      className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0"
                    >
                      <span className="text-sm text-gray-400 font-mono">
                        {m.month}
                      </span>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-500">
                          {m.signals}건
                        </span>
                        <span className="text-gray-400">
                          {m.wins}W
                        </span>
                        <span
                          className={`font-mono ${
                            m.avgReturn >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {m.avgReturn >= 0 ? "+" : ""}
                          {m.avgReturn}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Performance Extremes */}
            {metrics && metrics.closedSignals > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="최고 수익"
                  value={`+${metrics.bestReturn.toFixed(1)}%`}
                  color="text-emerald-400"
                />
                <StatCard
                  label="최악 수익"
                  value={`${metrics.worstReturn.toFixed(1)}%`}
                  color="text-red-400"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
