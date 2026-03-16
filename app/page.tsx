"use client";

import { useState } from "react";
import Link from "next/link";
import { StockInput, AgentOutput, ConsensusResult } from "@/lib/types";
import { runSwarm } from "@/lib/agents";
import { computeConsensus } from "@/lib/consensus";
import { saveSignal } from "@/lib/storage";
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

  const handleSubmit = async (input: StockInput) => {
    setRunning(true);
    setAgentOutputs([]);
    setConsensus(null);
    setStock(input);
    setSaved(false);
    setError(null);

    try {
      const outputs = await runSwarm(input, (output) => {
        setAgentOutputs((prev) => [...prev, output]);
      });

      const result = computeConsensus(outputs, input);
      setConsensus(result);
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
          <h1 className="text-2xl font-bold">Swarm</h1>
          <Link
            href="/history"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            History
          </Link>
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
