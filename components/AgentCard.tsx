"use client";

import { AgentOutput } from "@/lib/types";

interface AgentCardProps {
  output: AgentOutput;
}

function getProbColor(prob: number): string {
  if (prob >= 70) return "text-green-400";
  if (prob >= 50) return "text-yellow-400";
  if (prob >= 30) return "text-orange-400";
  return "text-red-400";
}

function getProbBg(prob: number): string {
  if (prob >= 70) return "bg-green-900/30 border-green-800";
  if (prob >= 50) return "bg-yellow-900/30 border-yellow-800";
  if (prob >= 30) return "bg-orange-900/30 border-orange-800";
  return "bg-red-900/30 border-red-800";
}

export default function AgentCard({ output }: AgentCardProps) {
  return (
    <div
      className={`rounded-xl border p-4 ${getProbBg(output.probability)} transition-all animate-in fade-in`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-white text-sm">{output.name}</h3>
        <span className={`text-2xl font-bold ${getProbColor(output.probability)}`}>
          {output.probability}%
        </span>
      </div>
      <p className="text-gray-300 text-sm leading-relaxed">{output.reasoning}</p>
    </div>
  );
}
