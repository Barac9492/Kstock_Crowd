"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { UNIVERSE, SECTORS, UniverseStock } from "@/lib/universe";
import { ScanResult, ScanProgress } from "@/lib/scanner";
import { saveSignal } from "@/lib/storage";

function getSignalStyle(signal: string) {
  switch (signal) {
    case "BUY":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "CAUTION":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

export default function ScanPage() {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(UNIVERSE.map((s) => s.ticker))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const toggleTicker = (ticker: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  const toggleSector = (sector: string) => {
    const sectorTickers = UNIVERSE.filter((s) => s.sector === sector).map(
      (s) => s.ticker
    );
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = sectorTickers.every((t) => next.has(t));
      if (allSelected) sectorTickers.forEach((t) => next.delete(t));
      else sectorTickers.forEach((t) => next.add(t));
      return next;
    });
  };

  const selectAll = () =>
    setSelected(new Set(UNIVERSE.map((s) => s.ticker)));
  const selectNone = () => setSelected(new Set());

  const handleSave = useCallback(
    (result: ScanResult) => {
      const finalOutputs = result.outputs.filter((o) => o.round === 2);
      saveSignal({
        stock: result.stock,
        outputs: finalOutputs,
        consensus: result.consensus,
      });
      setSavedIds((prev) => new Set(prev).add(result.stock.ticker));
    },
    []
  );

  const runScan = async () => {
    setIsRunning(true);
    setError(null);
    setResults([]);
    setProgress(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: [...selected] }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

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
            // Append intermediate results
            if (data.result) {
              setResults((prev) => {
                const updated = [...prev, data.result];
                updated.sort(
                  (a: ScanResult, b: ScanResult) => b.score - a.score
                );
                return updated;
              });
            }
          } else if (data.type === "result") {
            setResults(data.results);
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

  // Group stocks by sector for selection UI
  const stocksBySector: Record<string, UniverseStock[]> = {};
  for (const sector of SECTORS) {
    stocksBySector[sector] = UNIVERSE.filter((s) => s.sector === sector);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">🔍 Universe Scanner</h1>
            <p className="text-sm text-gray-400 mt-1">
              핵심 종목을 자동으로 스캔하고 알파 시그널을 발견합니다
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
              href="/"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Analysis
            </Link>
            <Link
              href="/backtest"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Backtest
            </Link>
            <Link
              href="/history"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              History
            </Link>
          </div>
        </div>

        {/* Stock Selection */}
        {!isRunning && results.length === 0 && (
          <div className="space-y-6">
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-300">
                  종목 선택 ({selected.size}/{UNIVERSE.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    전체 선택
                  </button>
                  <span className="text-gray-600">|</span>
                  <button
                    onClick={selectNone}
                    className="text-xs text-gray-400 hover:text-gray-300"
                  >
                    전체 해제
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {SECTORS.map((sector) => (
                  <div key={sector}>
                    <button
                      onClick={() => toggleSector(sector)}
                      className="text-xs text-gray-500 hover:text-gray-300 mb-2 uppercase tracking-wider"
                    >
                      {sector}
                    </button>
                    <div className="flex flex-wrap gap-2">
                      {stocksBySector[sector].map((stock) => (
                        <button
                          key={stock.ticker}
                          onClick={() => toggleTicker(stock.ticker)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                            selected.has(stock.ticker)
                              ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                              : "border-gray-700 bg-gray-800/50 text-gray-500 hover:border-gray-600"
                          }`}
                        >
                          {stock.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={runScan}
              disabled={selected.size === 0}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold text-lg transition-all shadow-lg shadow-indigo-500/20"
            >
              🚀 Scan {selected.size} Stocks
            </button>

            <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-800/50">
              <div className="text-xs text-gray-500 space-y-1">
                <p>
                  • 각 종목마다 데이터 수집 → 8 에이전트 2라운드 토론을 진행합니다
                </p>
                <p>
                  • {selected.size}종목 기준 약 {Math.ceil(selected.size * 0.5)}
                  -{ Math.ceil(selected.size * 1)}분 소요
                </p>
                <p>
                  • |Alpha Gap| × Conviction 점수로 자동 순위를 매깁니다
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {isRunning && progress && (
          <div className="bg-gray-900/50 rounded-xl p-8 border border-gray-800 mb-8">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3 animate-pulse">🔬</div>
              <h3 className="text-lg font-semibold">스캔 진행 중...</h3>
              <p className="text-sm text-gray-400 mt-1">
                {progress.phase === "fetching_data"
                  ? `${progress.currentName} 데이터 수집 중`
                  : progress.phase === "running_swarm"
                    ? `${progress.currentName} 에이전트 분석 중`
                    : "완료"}
              </p>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>
                  {progress.currentIndex} / {progress.totalStocks} 종목
                </span>
                <span>
                  {Math.round(
                    (progress.currentIndex / progress.totalStocks) * 100
                  )}
                  %
                </span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${(progress.currentIndex / progress.totalStocks) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                📊 스캔 결과 ({results.length}종목)
              </h2>
              {!isRunning && (
                <button
                  onClick={() => {
                    setResults([]);
                    setProgress(null);
                  }}
                  className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  새 스캔
                </button>
              )}
            </div>

            <div className="space-y-3">
              {results.map((r, idx) => (
                <div
                  key={r.stock.ticker}
                  className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-600 font-mono text-sm w-6">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-medium text-white">
                          {r.stock.name}
                          <span className="text-gray-500 text-sm ml-2">
                            {r.stock.ticker}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          현재가 {r.stock.currentPrice.toLocaleString()}원
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-mono">
                          <span className="text-gray-400">SP</span>{" "}
                          <span className="text-white">{r.consensus.sp}%</span>
                          <span className="text-gray-600 mx-1">·</span>
                          <span className="text-gray-400">Gap</span>{" "}
                          <span
                            className={
                              r.consensus.alphaGap > 0
                                ? "text-emerald-400"
                                : r.consensus.alphaGap < 0
                                  ? "text-red-400"
                                  : "text-gray-400"
                            }
                          >
                            {r.consensus.alphaGap > 0 ? "+" : ""}
                            {r.consensus.alphaGap}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          확신도 {r.consensus.conviction}% · 점수 {r.score}
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono border ${getSignalStyle(r.consensus.signal)}`}
                      >
                        {r.consensus.signal}
                      </span>

                      <button
                        onClick={() => handleSave(r)}
                        disabled={savedIds.has(r.stock.ticker)}
                        className={`px-3 py-1 rounded text-xs transition-colors ${
                          savedIds.has(r.stock.ticker)
                            ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                            : "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 hover:bg-indigo-600/30"
                        }`}
                      >
                        {savedIds.has(r.stock.ticker) ? "저장됨" : "저장"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 rounded-xl p-6 border border-red-800/30 mt-6">
            <div className="text-red-400 font-medium mb-2">오류 발생</div>
            <div className="text-sm text-red-300">{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}
