"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StockInput, AgentOutput, ConsensusResult } from "@/lib/types";
import { saveSignal } from "@/lib/storage";
import { MarketRegimeData } from "@/lib/regime";
import StockForm from "@/components/StockForm";
import AgentCard from "@/components/AgentCard";
import ConsensusPanel from "@/components/ConsensusPanel";

export default function Home() {
  const [running, setRunning] = useState(false);
  const [agentOutputs, setAgentOutputs] = useState<AgentOutput[]>([]);
  const [consensus, setConsensus] = useState<ConsensusResult | null>(null);
  const [stock, setStock] = useState<StockInput | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regime, setRegime] = useState<MarketRegimeData | null>(null);

  // Auto-fetch market regime on page load
  useEffect(() => {
    fetch("/api/regime")
      .then((r) => r.json())
      .then((data) => {
        if (data.regime) setRegime(data);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (input: StockInput) => {
    setRunning(true);
    setAgentOutputs([]);
    setConsensus(null);
    setStock(input);
    setSaved(false);
    setError(null);

    try {
      // Enrich stock data with news and regime context
      const enriched = { ...input };

      // Fetch news for this ticker
      try {
        const newsRes = await fetch(`/api/news/${input.ticker}`);
        if (newsRes.ok) {
          const newsData = await newsRes.json();
          if (newsData.headlinesText) enriched.newsContext = newsData.headlinesText;
        }
      } catch {}

      // Add regime context if available
      if (regime) {
        enriched.regimeContext = `${regime.label} | KOSPI ${regime.kospiLevel.toLocaleString()} (${regime.kospiVsMa != null ? `MA20 대비 ${regime.kospiVsMa > 0 ? '+' : ''}${regime.kospiVsMa}%` : ''}) | 원달러 ${regime.usdkrw.toLocaleString()}원`;
      }

      setStock(enriched);

      const res = await fetch("/api/swarm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enriched),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream unavailable");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const match = line.match(/^data: (.+)$/);
          if (!match) continue;
          const event = JSON.parse(match[1]);

          if (event.type === "agent") {
            setAgentOutputs((prev) => [...prev, event.output]);
          } else if (event.type === "consensus") {
            setConsensus(event.consensus);
          } else if (event.type === "error") {
            setError(event.message);
          }
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "분석 중 오류가 발생했습니다."
      );
    } finally {
      setRunning(false);
    }
  };

  const handleSave = () => {
    if (!stock || !consensus || agentOutputs.length === 0) return;
    const finalOutputs = agentOutputs.filter((o) => o.round === 2);
    saveSignal({ stock, outputs: finalOutputs, consensus });
    setSaved(true);
  };

  const round1 = agentOutputs.filter((o) => o.round === 1);
  const round2 = agentOutputs.filter((o) => o.round === 2);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Swarm</h1>
            {regime && (
              <span className="text-xs px-2 py-1 rounded-full bg-gray-800 border border-gray-700">
                {regime.label}
              </span>
            )}
          </div>
          <div className="flex gap-4">
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
              href="/history"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              History
            </Link>
          </div>
        </div>

        <StockForm onSubmit={handleSubmit} disabled={running} />

        {error && (
          <div className="mt-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {round1.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Round 1 — Independent Analysis
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {round1.map((output) => (
                <AgentCard key={`r1-${output.agentId}`} output={output} />
              ))}
            </div>
          </div>
        )}

        {round2.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Round 2 — After Debate
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {round2.map((output) => (
                <AgentCard key={`r2-${output.agentId}`} output={output} />
              ))}
            </div>
          </div>
        )}

        {consensus && (
          <div className="mt-8 space-y-4">
            <ConsensusPanel consensus={consensus} />
            <button
              onClick={handleSave}
              disabled={saved}
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                saved
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {saved ? "Saved" : "Save Signal"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
