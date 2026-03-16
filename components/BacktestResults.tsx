"use client";

import { BacktestReport, BacktestResult } from "@/lib/backtest-types";
import BacktestAgentReport from "./BacktestAgentReport";

interface Props {
  report: BacktestReport;
}

function signalBadge(signal: string, correct: boolean) {
  const colors: Record<string, string> = {
    BUY: correct
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : "bg-red-500/20 text-red-400 border-red-500/30",
    CAUTION: correct
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : "bg-red-500/20 text-red-400 border-red-500/30",
    MONITOR:
      "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  return `px-2 py-0.5 rounded text-xs font-mono border ${colors[signal] || colors.MONITOR}`;
}

export default function BacktestResults({ report }: Props) {
  const { overallAccuracy, overallBrierScore, signalBreakdown, results, agentStats, recommendations } = report;

  return (
    <div className="space-y-8">
      {/* Overall Summary Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">전체 정확도</div>
          <div
            className={`text-3xl font-bold ${
              overallAccuracy >= 60
                ? "text-emerald-400"
                : overallAccuracy >= 40
                  ? "text-yellow-400"
                  : "text-red-400"
            }`}
          >
            {overallAccuracy}%
          </div>
          <div className="text-xs text-gray-500 mt-1">{report.totalCases}건 중</div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Brier Score</div>
          <div
            className={`text-3xl font-bold ${
              overallBrierScore <= 0.2
                ? "text-emerald-400"
                : overallBrierScore <= 0.3
                  ? "text-yellow-400"
                  : "text-red-400"
            }`}
          >
            {overallBrierScore.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500 mt-1">낮을수록 좋음</div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">BUY 신호 적중</div>
          <div className="text-3xl font-bold text-blue-400">
            {signalBreakdown.buy.total > 0
              ? `${Math.round((signalBreakdown.buy.correct / signalBreakdown.buy.total) * 100)}%`
              : "—"}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {signalBreakdown.buy.correct}/{signalBreakdown.buy.total}건
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">CAUTION 신호 적중</div>
          <div className="text-3xl font-bold text-orange-400">
            {signalBreakdown.caution.total > 0
              ? `${Math.round((signalBreakdown.caution.correct / signalBreakdown.caution.total) * 100)}%`
              : "—"}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {signalBreakdown.caution.correct}/{signalBreakdown.caution.total}건
          </div>
        </div>
      </div>

      {/* Case-by-case Results */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">케이스별 결과</h3>
        <div className="space-y-3">
          {results.map((r: BacktestResult) => (
            <div
              key={r.caseId}
              className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-medium text-white">{r.label}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {r.stock.name} ({r.stock.ticker}) · 분석가: {r.stock.currentPrice.toLocaleString()}원
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={signalBadge(r.consensus.signal, r.predictionCorrect)}>
                    {r.consensus.signal}
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-mono text-gray-300">SP {r.consensus.sp}%</div>
                    <div
                      className={`text-sm font-bold ${r.outcome.hit ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {r.outcome.pctChange >= 0 ? "+" : ""}
                      {r.outcome.pctChange.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                <span>결과가: {r.outcome.finalPrice.toLocaleString()}원</span>
                <span>AlphaGap: {r.consensus.alphaGap}</span>
                <span>확신도: {r.consensus.conviction}%</span>
                <span
                  className={r.predictionCorrect ? "text-emerald-500" : "text-red-500"}
                >
                  {r.predictionCorrect ? "✓ 적중" : "✗ 실패"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Performance */}
      <BacktestAgentReport stats={agentStats} />

      {/* AI Recommendations */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">🤖 AI 개선 권고</h3>
        <div className="space-y-3">
          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 rounded-lg p-4 border border-indigo-800/30"
            >
              <div className="flex gap-3">
                <span className="text-indigo-400 font-bold shrink-0">{idx + 1}.</span>
                <p className="text-gray-300 text-sm leading-relaxed">{rec}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
