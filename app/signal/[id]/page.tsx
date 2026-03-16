"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SavedSignal } from "@/lib/types";
import { getSignal, recordOutcome } from "@/lib/storage";
import AgentCard from "@/components/AgentCard";
import ConsensusPanel from "@/components/ConsensusPanel";

export default function SignalDetailPage() {
  const params = useParams();
  const [signal, setSignal] = useState<SavedSignal | null>(null);
  const [outcomePrice, setOutcomePrice] = useState("");

  useEffect(() => {
    const id = params.id as string;
    const found = getSignal(id);
    if (found) setSignal(found);
  }, [params.id]);

  const handleRecordOutcome = () => {
    if (!signal || !outcomePrice) return;
    recordOutcome(signal.id, Number(outcomePrice));
    const updated = getSignal(signal.id);
    if (updated) setSignal(updated);
    setOutcomePrice("");
  };

  if (!signal) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-500">신호를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const { stock, outputs, consensus, outcome } = signal;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/history"
              className="text-sm text-gray-500 hover:text-white transition-colors"
            >
              &larr; History
            </Link>
            <h1 className="text-2xl font-bold mt-2">
              {stock.name}{" "}
              <span className="text-gray-500 text-lg">{stock.ticker}</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(signal.timestamp).toLocaleString("ko-KR")}
            </p>
          </div>
        </div>

        <ConsensusPanel consensus={consensus} />

        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Agent Analysis (Final Round)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {outputs.map((output) => (
              <AgentCard key={output.agentId} output={output} />
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-gray-700 bg-gray-900 p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Input Data
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">현재가</span>
              <p className="text-white">
                {stock.currentPrice.toLocaleString()}원
              </p>
            </div>
            <div>
              <span className="text-gray-500">PBR / PER</span>
              <p className="text-white">
                {stock.pbr}x / {stock.per}x
              </p>
            </div>
            <div>
              <span className="text-gray-500">ROE</span>
              <p className="text-white">{stock.roe}%</p>
            </div>
            <div>
              <span className="text-gray-500">배당수익률</span>
              <p className="text-white">{stock.dividendYield}%</p>
            </div>
            <div>
              <span className="text-gray-500">52주 범위</span>
              <p className="text-white">
                {stock.week52Low.toLocaleString()} ~{" "}
                {stock.week52High.toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-gray-500">평균 목표가</span>
              <p className="text-white">
                {stock.avgTargetPrice.toLocaleString()}원
              </p>
            </div>
            <div>
              <span className="text-gray-500">외국인 보유</span>
              <p className="text-white">{stock.foreignHoldingPct}%</p>
            </div>
            {stock.foreignNetBuy3D != null && (
              <div>
                <span className="text-gray-500">외국인 3일 순매수</span>
                <p className="text-white">{stock.foreignNetBuy3D}억원</p>
              </div>
            )}
            {stock.shortInterestPct != null && (
              <div>
                <span className="text-gray-500">공매도</span>
                <p className="text-white">{stock.shortInterestPct}%</p>
              </div>
            )}
            {(stock.priceChange1M != null || stock.priceChange3M != null) && (
              <div>
                <span className="text-gray-500">1M / 3M 변동</span>
                <p className="text-white">
                  {stock.priceChange1M != null ? `${stock.priceChange1M}%` : "—"} /{" "}
                  {stock.priceChange3M != null ? `${stock.priceChange3M}%` : "—"}
                </p>
              </div>
            )}
            <div>
              <span className="text-gray-500">매수/중립/매도</span>
              <p className="text-white">
                {stock.buyRatings} / {stock.holdRatings} / {stock.sellRatings}
              </p>
            </div>
            {stock.notes && (
              <div className="col-span-full">
                <span className="text-gray-500">메모</span>
                <p className="text-white">{stock.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-gray-700 bg-gray-900 p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Outcome
          </h2>
          {outcome ? (
            <div className="flex items-center gap-6">
              <div>
                <span className="text-gray-500 text-sm">최종가</span>
                <p className="text-white text-lg font-semibold">
                  {outcome.finalPrice.toLocaleString()}원
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">수익률</span>
                <p
                  className={`text-lg font-semibold ${outcome.pctChange >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {outcome.pctChange > 0 ? "+" : ""}
                  {outcome.pctChange.toFixed(1)}%
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">적중</span>
                <p
                  className={`text-lg font-semibold ${outcome.hit ? "text-green-400" : "text-red-400"}`}
                >
                  {outcome.hit ? "O" : "X"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <input
                type="number"
                placeholder="최종 가격 입력"
                value={outcomePrice}
                onChange={(e) => setOutcomePrice(e.target.value)}
                className="px-3 py-2 bg-black border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleRecordOutcome}
                disabled={!outcomePrice}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Record Outcome
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
