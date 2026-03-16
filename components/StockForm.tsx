"use client";

import { useState, useCallback } from "react";
import { StockInput } from "@/lib/types";

interface StockFormProps {
  onSubmit: (stock: StockInput) => void;
  disabled?: boolean;
}

// Fields that have no reliable free API source
const OPTIONAL_KEYS = new Set([
  "foreignNetBuy3D",
  "shortInterestPct",
  "priceChange1M",
  "priceChange3M",
]);

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number";
  step?: string;
  unit?: string;
}

const DISPLAY_GROUPS: { label: string; fields: FieldDef[] }[] = [
  {
    label: "기본 정보",
    fields: [
      { key: "name", label: "종목명", type: "text" },
      { key: "currentPrice", label: "현재가", type: "number", unit: "원" },
    ],
  },
  {
    label: "밸류에이션",
    fields: [
      { key: "pbr", label: "PBR", type: "number", step: "0.01", unit: "x" },
      { key: "per", label: "PER", type: "number", step: "0.1", unit: "x" },
      { key: "roe", label: "ROE", type: "number", step: "0.1", unit: "%" },
      { key: "dividendYield", label: "배당수익률", type: "number", step: "0.1", unit: "%" },
    ],
  },
  {
    label: "애널리스트 컨센서스",
    fields: [
      { key: "avgTargetPrice", label: "평균 목표가", type: "number", unit: "원" },
      { key: "highTargetPrice", label: "최고 목표가", type: "number", unit: "원" },
      { key: "lowTargetPrice", label: "최저 목표가", type: "number", unit: "원" },
      { key: "buyRatings", label: "매수 의견", type: "number" },
      { key: "holdRatings", label: "중립 의견", type: "number" },
      { key: "sellRatings", label: "매도 의견", type: "number" },
    ],
  },
  {
    label: "수급",
    fields: [
      { key: "foreignHoldingPct", label: "외국인 보유율", type: "number", step: "0.1", unit: "%" },
      { key: "foreignNetBuy3D", label: "외국인 3일 순매수", type: "number", unit: "억원" },
      { key: "shortInterestPct", label: "공매도 비율", type: "number", step: "0.1", unit: "%" },
    ],
  },
  {
    label: "가격 흐름",
    fields: [
      { key: "week52High", label: "52주 최고", type: "number", unit: "원" },
      { key: "week52Low", label: "52주 최저", type: "number", unit: "원" },
      { key: "priceChange1M", label: "1개월 변동률", type: "number", step: "0.1", unit: "%" },
      { key: "priceChange3M", label: "3개월 변동률", type: "number", step: "0.1", unit: "%" },
    ],
  },
];

export default function StockForm({ onSubmit, disabled }: StockFormProps) {
  const [ticker, setTicker] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  // null = phase 1, object = phase 2
  const [fetchedData, setFetchedData] = useState<Record<string, string> | null>(null);
  // Track which fields are being edited (click-to-edit)
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  const handleFetch = useCallback(async () => {
    const t = ticker.trim();
    if (!t) return;
    setFetching(true);
    setFetchError("");
    try {
      const res = await fetch(`/api/stock/${t}`);
      const json = await res.json();
      if (!res.ok) {
        setFetchError(json.error || "조회 실패");
        return;
      }
      const data: Record<string, string> = { ticker: t };
      for (const [key, val] of Object.entries(json)) {
        if (val != null) data[key] = String(val);
      }
      setFetchedData(data);
      setEditingFields(new Set());
    } catch {
      setFetchError("네트워크 오류");
    } finally {
      setFetching(false);
    }
  }, [ticker]);

  const handleFieldChange = (key: string, value: string) => {
    setFetchedData((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const startEditing = (key: string) => {
    setEditingFields((prev) => new Set(prev).add(key));
  };

  const handleReset = () => {
    setFetchedData(null);
    setEditingFields(new Set());
    setNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fetchedData) return;

    const d = fetchedData;
    const stock: StockInput = {
      ticker: d.ticker || ticker.trim(),
      name: d.name || "",
      currentPrice: Number(d.currentPrice) || 0,
      pbr: Number(d.pbr) || 0,
      per: Number(d.per) || 0,
      roe: Number(d.roe) || 0,
      dividendYield: Number(d.dividendYield) || 0,
      avgTargetPrice: Number(d.avgTargetPrice) || 0,
      highTargetPrice: Number(d.highTargetPrice) || 0,
      lowTargetPrice: Number(d.lowTargetPrice) || 0,
      buyRatings: Number(d.buyRatings) || 0,
      holdRatings: Number(d.holdRatings) || 0,
      sellRatings: Number(d.sellRatings) || 0,
      foreignHoldingPct: Number(d.foreignHoldingPct) || 0,
      week52High: Number(d.week52High) || 0,
      week52Low: Number(d.week52Low) || 0,
      notes: notes,
    };

    // Only include optional fields if they have values
    if (d.foreignNetBuy3D) stock.foreignNetBuy3D = Number(d.foreignNetBuy3D);
    if (d.shortInterestPct) stock.shortInterestPct = Number(d.shortInterestPct);
    if (d.priceChange1M) stock.priceChange1M = Number(d.priceChange1M);
    if (d.priceChange3M) stock.priceChange3M = Number(d.priceChange3M);

    onSubmit(stock);
  };

  // Phase 1: Ticker input only
  if (!fetchedData) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="종목코드 입력 (예: 005930)"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleFetch();
              }
            }}
            disabled={disabled || fetching}
            className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-lg placeholder-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleFetch}
            disabled={disabled || fetching || !ticker.trim()}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            {fetching ? "조회 중..." : "조회"}
          </button>
        </div>
        {fetchError && (
          <p className="text-red-400 text-sm">{fetchError}</p>
        )}
      </div>
    );
  }

  // Phase 2: Review fetched data
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header with stock name and reset button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            {fetchedData.name}{" "}
            <span className="text-gray-500 text-base">{fetchedData.ticker}</span>
          </h2>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={disabled}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
        >
          다시 조회
        </button>
      </div>

      {/* Data groups */}
      {DISPLAY_GROUPS.map((group) => (
        <div key={group.label}>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {group.label}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {group.fields.map((field) => {
              const value = fetchedData[field.key] || "";
              const isOptional = OPTIONAL_KEYS.has(field.key);
              const isMissing = !value;
              const isEditing = editingFields.has(field.key) || (isOptional && isMissing);

              if (isEditing || (isOptional && isMissing)) {
                // Editable input for missing optional fields or click-to-edit
                return (
                  <div key={field.key}>
                    <label className="block text-xs text-gray-500 mb-1">
                      {field.label}
                      {isOptional && (
                        <span className="text-amber-500 ml-1">(선택)</span>
                      )}
                    </label>
                    <input
                      type={field.type}
                      step={field.step}
                      placeholder={isOptional ? "미확인" : "입력"}
                      value={value}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      disabled={disabled}
                      className={`w-full px-3 py-2 bg-gray-900 border rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50 ${
                        isOptional && isMissing
                          ? "border-amber-600/50"
                          : "border-gray-700"
                      }`}
                    />
                  </div>
                );
              }

              // Read-only display (click to edit)
              return (
                <div
                  key={field.key}
                  onClick={() => !disabled && startEditing(field.key)}
                  className="cursor-pointer group"
                >
                  <label className="block text-xs text-gray-500 mb-1">
                    {field.label}
                  </label>
                  <div className="px-3 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-white group-hover:border-gray-600 transition-colors">
                    {field.type === "number" && (field.unit === "원")
                      ? `${Number(value).toLocaleString()}${field.unit}`
                      : `${value}${field.unit || ""}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Notes */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          메모
        </h3>
        <textarea
          placeholder="뉴스, 이슈, 특이사항 등 자유롭게 입력..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
