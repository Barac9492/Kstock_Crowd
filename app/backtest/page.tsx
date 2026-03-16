"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { BacktestReport, BacktestProgress } from "@/lib/backtest-types";
import { SavedSignal } from "@/lib/types";
import { getAllSignals } from "@/lib/storage";
import { computeWeightsFromBacktest, saveWeights, formatWeight, loadWeights } from "@/lib/agent-weights";
import { saveEvolvedAgents, EvolutionResult } from "@/lib/agent-evolution";
import BacktestResults from "@/components/BacktestResults";

export default function BacktestPage() {
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [progress, setProgress] = useState<BacktestProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useHistory, setUseHistory] = useState(false);
  const [historySignals, setHistorySignals] = useState<SavedSignal[]>([]);
  const [weightsApplied, setWeightsApplied] = useState(false);
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolveResult, setEvolveResult] = useState<EvolutionResult | null>(null);

  const handleApplyWeights = useCallback(() => {
    if (!report) return;
    const agentWeights = computeWeightsFromBacktest(report);
    saveWeights(agentWeights);
    setWeightsApplied(true);
  }, [report]);

  const currentWeights = typeof window !== 'undefined' ? loadWeights() : null;

  const handleEvolve = async () => {
    if (!report) return;
    setIsEvolving(true);
    setError(null);
    try {
      const res = await fetch("/api/evolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report }),
      });
      if (!res.ok) throw new Error("Evolution failed");
      const data = await res.json();
      saveEvolvedAgents(data);
      setEvolveResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evolution error");
    } finally {
      setIsEvolving(false);
    }
  };

  // Load completed signals from history
  const loadHistory = useCallback(() => {
    const all = getAllSignals();
    const completed = all.filter((s) => s.outcome);
    setHistorySignals(completed);
    setUseHistory(true);
  }, []);

  const runBacktest = async () => {
    setIsRunning(true);
    setError(null);
    setReport(null);
    setProgress(null);

    try {
      // Build cases from history signals if selected
      const body: Record<string, unknown> = {};
      if (useHistory && historySignals.length > 0) {
        body.cases = historySignals.map((s) => ({
          id: s.id,
          label: `${s.stock.name} (${new Date(s.timestamp).toLocaleDateString("ko-KR")})`,
          stock: s.stock,
          outcome: s.outcome,
        }));
      }

      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "progress") {
            setProgress(data);
          } else if (data.type === "result") {
            setReport(data.report);
          } else if (data.type === "error") {
            setError(data.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRunning(false);
    }
  };

  const phaseLabels: Record<string, string> = {
    running_swarm: "에이전트 분석 중",
    computing_stats: "통계 산출 중",
    generating_recommendations: "AI 권고 생성 중",
    done: "완료",
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">📊 Backtesting</h1>
            <p className="text-sm text-gray-400 mt-1">
              과거 데이터로 에이전트 정확도를 검증하고 개선합니다
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/portfolio"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Portfolio
            </Link>
            <Link
              href="/scan"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Scan
            </Link>
            <Link
              href="/"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Analysis
            </Link>
            <Link
              href="/history"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              History
            </Link>
          </div>
        </div>

        {/* Controls */}
        {!isRunning && !report && (
          <div className="space-y-6">
            {/* Data Source Selection */}
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-4">
                데이터 소스 선택
              </h3>
              <div className="flex gap-4">
                <button
                  onClick={() => setUseHistory(false)}
                  className={`flex-1 py-4 px-4 rounded-lg border transition-all ${
                    !useHistory
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                      : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div className="text-lg font-semibold mb-1">📦 내장 데이터</div>
                  <div className="text-xs opacity-70">
                    삼성전자, SK하이닉스, 네이버, 카카오, 현대차 (5건)
                  </div>
                </button>
                <button
                  onClick={loadHistory}
                  className={`flex-1 py-4 px-4 rounded-lg border transition-all ${
                    useHistory
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                      : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div className="text-lg font-semibold mb-1">📋 내 히스토리</div>
                  <div className="text-xs opacity-70">
                    결과가 기록된 과거 신호 사용
                  </div>
                </button>
              </div>

              {useHistory && (
                <div className="mt-4 text-sm text-gray-400">
                  {historySignals.length > 0 ? (
                    <span className="text-emerald-400">
                      ✓ {historySignals.length}건의 완료된 신호를 찾았습니다
                    </span>
                  ) : (
                    <span className="text-yellow-400">
                      ⚠ 결과가 기록된 신호가 없습니다. 먼저 History 페이지에서
                      결과를 입력하세요.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Run Button */}
            <button
              onClick={runBacktest}
              disabled={useHistory && historySignals.length === 0}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold text-lg transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
            >
              🚀 Run Backtest
            </button>

            {/* Info */}
            <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-800/50">
              <div className="text-xs text-gray-500 space-y-1">
                <p>
                  • 각 케이스마다 8명의 에이전트가 2라운드 토론을 진행합니다 (케이스당 ~16 API calls)
                </p>
                <p>• 5건 기준 약 2-3분 소요됩니다</p>
                <p>
                  • Brier Score는 확률 예측의 정확도를 측정합니다 (0 = 완벽, 1 = 최악)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {isRunning && progress && (
          <div className="bg-gray-900/50 rounded-xl p-8 border border-gray-800">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3 animate-pulse">🔬</div>
              <h3 className="text-lg font-semibold text-white">
                백테스팅 진행 중...
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {phaseLabels[progress.phase] || progress.phase}
              </p>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>
                  {progress.currentCase} / {progress.totalCases} 케이스
                </span>
                <span>
                  {Math.round((progress.currentCase / progress.totalCases) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${(progress.currentCase / progress.totalCases) * 100}%`,
                  }}
                />
              </div>
            </div>

            {progress.currentLabel && (
              <div className="text-center text-sm text-gray-400">
                현재: <span className="text-white">{progress.currentLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 rounded-xl p-6 border border-red-800/30 mb-8">
            <div className="text-red-400 font-medium mb-2">오류 발생</div>
            <div className="text-sm text-red-300">{error}</div>
            <button
              onClick={() => {
                setError(null);
                setReport(null);
              }}
              className="mt-4 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-lg text-sm transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* Results */}
        {report && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                백테스트 결과
              </h2>
              <button
                onClick={() => {
                  setReport(null);
                  setProgress(null);
                }}
                className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-600"
              >
                새 테스트
              </button>
            </div>
            <BacktestResults report={report} />

            {/* Apply Weights */}
            <div className="mt-8 bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white">에이전트 가중치 적용</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    백테스트 결과 기반으로 Brier Score가 낮은(정확한) 에이전트에 더 높은 가중치를 부여합니다
                  </p>
                  {currentWeights && currentWeights.source !== 'default' && (
                    <p className="text-xs text-indigo-400 mt-1">
                      현재: {currentWeights.source} 기반 가중치 (정확도 {currentWeights.backtestAccuracy}%)
                    </p>
                  )}
                </div>
                <button
                  onClick={handleApplyWeights}
                  disabled={weightsApplied}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${weightsApplied ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/30 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                >
                  {weightsApplied ? '✓ 적용됨' : '가중치 적용'}
                </button>
              </div>
              {weightsApplied && report && (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {report.agentStats.map((stat) => {
                    const w = computeWeightsFromBacktest(report).weights[stat.agentId] || 0.125;
                    return (
                      <div key={stat.agentId} className="text-center bg-gray-800/50 rounded-lg py-2 px-1">
                        <div className="text-xs text-gray-400 truncate">{stat.name}</div>
                        <div className="text-sm font-mono text-white">{formatWeight(w)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Evolve Agents */}
            <div className="mt-4 bg-purple-900/20 rounded-xl p-6 border border-purple-800/30">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-purple-300">에이전트 자가 진화 (Self-Evolution)</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    오판 사례를 분석하여 하위 에이전트의 페르소나와 판단 기준을 AI 시뮬레이션으로 교정합니다
                  </p>
                </div>
                <button
                  onClick={handleEvolve}
                  disabled={isEvolving || !!evolveResult}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                    evolveResult
                      ? "bg-purple-900/50 text-purple-400 border border-purple-700/50 cursor-not-allowed"
                      : isEvolving
                        ? "bg-gray-800 text-gray-500 cursor-wait animate-pulse"
                        : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                  }`}
                >
                  {isEvolving ? "진화 중..." : evolveResult ? "✓ 진화 완료" : "초진화 결행 🧬"}
                </button>
              </div>

              {evolveResult && (
                <div className="mt-4 space-y-3">
                  <div className="text-sm text-purple-400 font-medium mb-3">
                    {evolveResult.summary}
                  </div>
                  {evolveResult.evolvedAgents.map((agent) => (
                    <div key={agent.agentId} className="bg-gray-900/50 rounded-lg p-3 text-sm border border-gray-800">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white">{agent.originalName}</span>
                        <span className="text-xs px-2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Evolved
                        </span>
                      </div>
                      <div className="text-xs text-red-400 mb-1">약점 파악: {agent.weaknesses}</div>
                      <div className="text-xs text-emerald-400 mb-2">교정 방향: {agent.changes}</div>
                      <div className="text-xs text-gray-400 bg-black/50 p-2 rounded">
                        {agent.evolvedPersona}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
