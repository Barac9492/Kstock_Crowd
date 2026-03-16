"use client";

import { useState } from "react";
import Link from "next/link";
import { UNIVERSE } from "@/lib/universe";
import { runHardScreener } from "@/lib/screener";
import { StockInput } from "@/lib/types";

export default function RecommendPage() {
  const [phase, setPhase] = useState<
    "idle" | "screening" | "debating" | "done"
  >("idle");
  const [progressMsg, setProgressMsg] = useState("");
  const [candidates, setCandidates] = useState<StockInput[]>([]);
  const [resultText, setResultText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const startEngine = async () => {
    setPhase("screening");
    setProgressMsg(`Scanning entire universe (${UNIVERSE.length} stocks)...`);
    setErrorMsg("");
    setResultText("");

    try {
      // 1. Zero-cost Hard Screening
      const filtered = await runHardScreener(UNIVERSE, (curr, total, name) => {
        setProgressMsg(
          `Quant Filter [${curr}/${total}]: Evaluating ${name}...`
        );
      });

      if (filtered.length === 0) {
        setErrorMsg(
          "No stocks passed the strict Mastermind quantitative filters today. The legends refuse to buy."
        );
        setPhase("done");
        return;
      }

      setCandidates(filtered);
      setPhase("debating");
      setProgressMsg(
        `Shortlisted ${filtered.length} candidates. Convening the Mastermind Committee for final selection...`
      );

      // 2. The 1-Call Committee API
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates: filtered }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `API returned HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error("No response body");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setResultText(fullText);
      }

      setPhase("done");
      setProgressMsg("Debate Concluded.");
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      setPhase("done");
    }
  };

  // Safe parsing helper since LLM might output raw JSON or wrapped in markdown
  const parseResult = (text: string) => {
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        return JSON.parse(text.substring(start, end + 1));
      }
      return null;
    } catch {
      return null;
    }
  };

  const parsed = phase === "done" && resultText ? parseResult(resultText) : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-amber-500">
              👑 Mastermind AI Picks
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              비용 효율적인 하드 스크리닝(0원) ➞ Top 5 선별 ➞ 위원회 최종 선정(단 1회 API 호출)
            </p>
          </div>
          <div className="flex gap-4">
            <Link href="/" className="text-sm text-gray-400 hover:text-white">
              Analysis
            </Link>
            <Link href="/scan" className="text-sm text-gray-400 hover:text-white">
              Scan
            </Link>
            <Link href="/portfolio" className="text-sm text-gray-400 hover:text-white">
              Portfolio
            </Link>
          </div>
        </div>

        {/* Control Panel */}
        {phase === "idle" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <div className="text-6xl mb-6">👁️‍🗨️</div>
            <h2 className="text-xl font-bold mb-2">오늘의 알파(Alpha)를 찾습니다</h2>
            <p className="text-gray-400 text-sm mb-8 max-w-lg mx-auto">
              8인의 전설적인 투자자들이 1차 통과된 극소수의 종목군을 놓고 격렬한 토론을 거쳐,
              오늘 시장에서 가장 확률 높은 단 하나의 주식을 선정합니다.
            </p>
            <button
              onClick={startEngine}
              className="bg-amber-600 hover:bg-amber-500 text-black font-bold py-4 px-8 rounded-xl transition-all shadow-lg hover:shadow-amber-500/20"
            >
              Start Mastermind Screener
            </button>
          </div>
        )}

        {/* Progress & Error */}
        {phase !== "idle" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3">
              {phase !== "done" && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-500" />
              )}
              <div className="text-sm font-mono text-gray-300">
                {progressMsg}
              </div>
            </div>
            {errorMsg && (
              <div className="mt-4 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
                {errorMsg}
              </div>
            )}
          </div>
        )}

        {/* Candidates Display (Post-Screening) */}
        {candidates.length > 0 && (phase === "debating" || phase === "done") && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              1차 통과 후보군 ({candidates.length}종목)
            </h3>
            <div className="flex flex-wrap gap-2">
              {candidates.map((c) => (
                <span
                  key={c.ticker}
                  className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-full text-xs text-gray-300"
                >
                  {c.name} ({c.ticker})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Real-time Streaming Raw Text */}
        {phase === "debating" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 font-mono text-xs text-amber-500/70 whitespace-pre-wrap">
            {resultText || "위원장(LLM)이 토론을 종합하고 있습니다..."}
          </div>
        )}

        {/* Final Rendered Result or Error Fallback */}
        {phase === "done" && (
          parsed && parsed.recommendedTicker ? (
            <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border border-indigo-800 rounded-2xl p-8 shadow-xl">
              <div className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">
                Mastermind Top Pick
              </div>
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="text-4xl font-extrabold text-white">
                  {parsed.recommendedName}{" "}
                  <span className="text-xl text-gray-500 font-medium">
                    {parsed.recommendedTicker}
                  </span>
                </h2>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-black/40 rounded-lg p-4 border border-indigo-800/50">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    강력 매도선 (Stop Loss)
                  </div>
                  <div className="text-2xl font-bold text-red-400">
                    {parsed.stopLoss?.toLocaleString()}원
                  </div>
                </div>
                <div className="bg-black/40 rounded-lg p-4 border border-indigo-800/50">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    목표가 (Take Profit)
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {parsed.targetPrice?.toLocaleString()}원
                  </div>
                </div>
              </div>

              <div className="mb-8 p-6 bg-indigo-950/40 rounded-xl border border-indigo-800">
                <h3 className="text-sm font-semibold text-indigo-300 mb-3 flex items-center gap-2">
                  <span>⚖️</span> 위원장 최종 선언
                </h3>
                <p className="text-gray-300 leading-relaxed text-sm">
                  {parsed.reasoning}
                </p>
              </div>

              {parsed.legendQuotes && parsed.legendQuotes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                    거장들의 Comment
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {parsed.legendQuotes.map((q: any, i: number) => (
                      <div key={i} className="bg-gray-900/80 rounded-lg p-4 border border-gray-800">
                        <div className="text-xs font-bold text-gray-400 mb-2">
                          {q.legend}
                        </div>
                        <div className="text-sm text-gray-300 italic">
                          "{q.quote}"
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-red-400 font-bold mb-4">데이터 파싱 실패 (Raw LLM Output):</h3>
              <div className="font-mono text-xs text-gray-300 whitespace-pre-wrap">
                {resultText}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
