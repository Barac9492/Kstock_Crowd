"use client";

import { useState, useCallback } from "react";
import { StockInput } from "@/lib/types";

interface StockFormProps {
  onSubmit: (stock: StockInput) => void;
  disabled?: boolean;
}

const FIELD_GROUPS = [
  {
    label: "기본 정보",
    fields: [
      { key: "ticker", label: "종목코드", placeholder: "005930", type: "text" },
      { key: "name", label: "종목명", placeholder: "삼성전자", type: "text" },
      { key: "currentPrice", label: "현재가 (원)", placeholder: "72000", type: "number" },
    ],
  },
  {
    label: "밸류에이션",
    fields: [
      { key: "pbr", label: "PBR", placeholder: "1.2", type: "number", step: "0.01" },
      { key: "per", label: "PER", placeholder: "15.3", type: "number", step: "0.1" },
      { key: "roe", label: "ROE (%)", placeholder: "8.5", type: "number", step: "0.1" },
      { key: "dividendYield", label: "배당수익률 (%)", placeholder: "2.1", type: "number", step: "0.1" },
    ],
  },
  {
    label: "애널리스트 컨센서스",
    fields: [
      { key: "avgTargetPrice", label: "평균 목표가", placeholder: "85000", type: "number" },
      { key: "highTargetPrice", label: "최고 목표가", placeholder: "95000", type: "number" },
      { key: "lowTargetPrice", label: "최저 목표가", placeholder: "75000", type: "number" },
      { key: "buyRatings", label: "매수 의견", placeholder: "20", type: "number" },
      { key: "holdRatings", label: "중립 의견", placeholder: "5", type: "number" },
      { key: "sellRatings", label: "매도 의견", placeholder: "1", type: "number" },
    ],
  },
  {
    label: "수급",
    fields: [
      { key: "foreignHoldingPct", label: "외국인 보유율 (%)", placeholder: "52.3", type: "number", step: "0.1" },
      { key: "foreignNetBuy3D", label: "외국인 3일 순매수 (억원)", placeholder: "500", type: "number" },
      { key: "shortInterestPct", label: "공매도 비율 (%)", placeholder: "1.5", type: "number", step: "0.1" },
    ],
  },
  {
    label: "가격 흐름",
    fields: [
      { key: "week52High", label: "52주 최고", placeholder: "88000", type: "number" },
      { key: "week52Low", label: "52주 최저", placeholder: "55000", type: "number" },
      { key: "priceChange1M", label: "1개월 변동률 (%)", placeholder: "-3.2", type: "number", step: "0.1" },
      { key: "priceChange3M", label: "3개월 변동률 (%)", placeholder: "5.1", type: "number", step: "0.1" },
    ],
  },
] as const;

const INITIAL_STATE: Record<string, string> = {
  ticker: "",
  name: "",
  currentPrice: "",
  pbr: "",
  per: "",
  roe: "",
  dividendYield: "",
  avgTargetPrice: "",
  highTargetPrice: "",
  lowTargetPrice: "",
  buyRatings: "",
  holdRatings: "",
  sellRatings: "",
  foreignHoldingPct: "",
  foreignNetBuy3D: "",
  shortInterestPct: "",
  week52High: "",
  week52Low: "",
  priceChange1M: "",
  priceChange3M: "",
  notes: "",
};

export default function StockForm({ onSubmit, disabled }: StockFormProps) {
  const [form, setForm] = useState(INITIAL_STATE);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFetch = useCallback(async () => {
    const ticker = form.ticker.trim();
    if (!ticker) return;
    setFetching(true);
    setFetchError("");
    try {
      const res = await fetch(`/api/stock/${ticker}`);
      const json = await res.json();
      if (!res.ok) {
        setFetchError(json.error || "조회 실패");
        return;
      }
      setForm((prev) => {
        const next = { ...prev };
        for (const [key, val] of Object.entries(json)) {
          if (val != null && key in next) {
            next[key] = String(val);
          }
        }
        return next;
      });
    } catch {
      setFetchError("네트워크 오류");
    } finally {
      setFetching(false);
    }
  }, [form.ticker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stock: StockInput = {
      ticker: form.ticker,
      name: form.name,
      currentPrice: Number(form.currentPrice),
      pbr: Number(form.pbr),
      per: Number(form.per),
      roe: Number(form.roe),
      dividendYield: Number(form.dividendYield),
      avgTargetPrice: Number(form.avgTargetPrice),
      highTargetPrice: Number(form.highTargetPrice),
      lowTargetPrice: Number(form.lowTargetPrice),
      buyRatings: Number(form.buyRatings),
      holdRatings: Number(form.holdRatings),
      sellRatings: Number(form.sellRatings),
      foreignHoldingPct: Number(form.foreignHoldingPct),
      foreignNetBuy3D: Number(form.foreignNetBuy3D),
      shortInterestPct: Number(form.shortInterestPct),
      week52High: Number(form.week52High),
      week52Low: Number(form.week52Low),
      priceChange1M: Number(form.priceChange1M),
      priceChange3M: Number(form.priceChange3M),
      notes: form.notes,
    };
    onSubmit(stock);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Ticker + 조회 button */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          기본 정보
        </h3>
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">종목코드</label>
            <input
              type="text"
              placeholder="005930"
              value={form.ticker}
              onChange={(e) => handleChange("ticker", e.target.value)}
              required
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleFetch}
              disabled={disabled || fetching || !form.ticker.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              {fetching ? "조회 중..." : "조회"}
            </button>
          </div>
        </div>
        {fetchError && (
          <p className="text-red-400 text-xs mb-2">{fetchError}</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Remaining 기본 정보 fields (name, currentPrice) */}
          {FIELD_GROUPS[0].fields
            .filter((f) => f.key !== "ticker")
            .map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-gray-500 mb-1">
                  {field.label}
                </label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={form[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  required
                  disabled={disabled}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
            ))}
        </div>
      </div>

      {/* Remaining field groups (skip 기본 정보 since rendered above) */}
      {FIELD_GROUPS.slice(1).map((group) => (
        <div key={group.label}>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {group.label}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {group.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-gray-500 mb-1">
                  {field.label}
                </label>
                <input
                  type={field.type}
                  step={"step" in field ? field.step : undefined}
                  placeholder={field.placeholder}
                  value={form[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  required
                  disabled={disabled}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          메모
        </h3>
        <textarea
          placeholder="뉴스, 이슈, 특이사항 등 자유롭게 입력..."
          value={form.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          disabled={disabled}
          rows={3}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
      >
        {disabled ? "분석 중..." : "Run Swarm"}
      </button>
    </form>
  );
}
