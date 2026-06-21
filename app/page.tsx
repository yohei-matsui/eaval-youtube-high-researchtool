"use client";

import Image from "next/image";
import { useState, useCallback, useMemo } from "react";
import { Eye, EyeOff, Search, Copy, Check, ChevronUp, ChevronDown, Download } from "lucide-react";
import { SearchVideoItem, SearchResponse } from "@/app/api/search/route";

type MatchType = "partial" | "exact";
type Region = "japan" | "korea" | "usa";
type DateRange = "7" | "28" | "90" | "365" | "730" | "1095" | "custom" | "";
type ViewFilter = "1000" | "10000" | "50000" | "100000" | "custom" | "";
type SpreadFilter = "1.0" | "1.5" | "2.0" | "3.0" | "5.0" | "custom" | "";
type DurationValue = "short" | "medium" | "long";
type SubscriberRange = "u100" | "100-1k" | "1k-5k" | "5k-10k" | "10k-20k" | "20k-50k" | "50k-100k" | "100k-1m";
type SortKey = "publishedAt" | "viewCount" | "spreadRate";
type SortDir = "asc" | "desc";

interface ClientFilters {
  viewMin: ViewFilter;
  viewCustom: string;
  spreadMin: SpreadFilter;
  spreadCustom: string;
  durations: DurationValue[];
  subscriberRanges: SubscriberRange[];
}

function fmt(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}千`;
  return n.toLocaleString();
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function applyClientFilters(
  videos: SearchVideoItem[],
  query: string,
  matchType: MatchType,
  filters: ClientFilters
): SearchVideoItem[] {
  const q = query.trim().toLowerCase();
  return videos.filter((v) => {
    if (q) {
      const title = v.title.toLowerCase();
      if (matchType === "exact" && !title.includes(q)) return false;
    }
    if (filters.viewMin) {
      let min: number | null = null;
      if (filters.viewMin === "custom") {
        const p = parseInt(filters.viewCustom.replace(/,/g, ""));
        if (!isNaN(p)) min = p;
      } else {
        min = parseInt(filters.viewMin);
      }
      if (min !== null && v.viewCount < min) return false;
    }
    if (filters.spreadMin) {
      let minRate: number | null = null;
      if (filters.spreadMin === "custom") {
        const p = parseFloat(filters.spreadCustom);
        if (!isNaN(p)) minRate = p;
      } else {
        minRate = parseFloat(filters.spreadMin);
      }
      if (minRate !== null && v.spreadRate < minRate) return false;
    }
    if (filters.durations.length > 0) {
      const sec = v.durationSeconds;
      const match = filters.durations.some((d) => {
        if (d === "short") return sec < 180;
        if (d === "medium") return sec >= 180 && sec < 1200;
        if (d === "long") return sec >= 1200;
        return false;
      });
      if (!match) return false;
    }
    if (filters.subscriberRanges.length > 0) {
      const s = v.subscriberCount;
      const match = filters.subscriberRanges.some((r) => {
        if (r === "u100")      return s < 100;
        if (r === "100-1k")    return s >= 100 && s < 1000;
        if (r === "1k-5k")    return s >= 1000 && s < 5000;
        if (r === "5k-10k")   return s >= 5000 && s < 10000;
        if (r === "10k-20k")  return s >= 10000 && s < 20000;
        if (r === "20k-50k")  return s >= 20000 && s < 50000;
        if (r === "50k-100k") return s >= 50000 && s < 100000;
        if (r === "100k-1m")  return s >= 100000 && s < 1000000;
        return false;
      });
      if (!match) return false;
    }
    return true;
  });
}

function exportCsv(videos: SearchVideoItem[], query: string) {
  const header = ["#", "タイトル", "チャンネル", "公開日", "再生回数", "CH中央値", "拡散率", "URL"];
  const rows = videos.map((v, i) => [
    i + 1,
    `"${v.title.replace(/"/g, '""')}"`,
    `"${v.channelName.replace(/"/g, '""')}"`,
    fmtDate(v.publishedAt),
    v.viewCount,
    Math.round(v.channelBaseline),
    v.spreadRate.toFixed(2),
    `https://www.youtube.com/watch?v=${v.id}`,
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `youtube_search_${query}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Chip group: single-select ────────────────────────────────────────── */
function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(value === o.value ? ("" as T) : o.value)}
          className={`px-3 py-1 text-xs font-medium transition-all ${
            value === o.value ? "lg-chip-on" : "lg-chip"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Sort header ──────────────────────────────────────────────────────── */
function SortHeader({
  label, sortKey, currentKey, currentDir, onSort,
}: {
  label: string; sortKey: SortKey; currentKey: SortKey; currentDir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = currentKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 font-medium transition-colors"
      style={{ color: active ? "#e63946" : undefined }}
    >
      {label}
      <span className="flex flex-col">
        <ChevronUp className={`h-3 w-3 -mb-1 ${active && currentDir === "asc" ? "text-red-500" : "text-gray-300"}`} />
        <ChevronDown className={`h-3 w-3 ${active && currentDir === "desc" ? "text-red-500" : "text-gray-300"}`} />
      </span>
    </button>
  );
}

/* ── Section label ────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "rgba(0,0,0,0.32)" }}>
      {children}
    </p>
  );
}

/* ─── Static data ─────────────────────────────────────────────────────── */
const regionOptions: { label: string; value: Region; code: string }[] = [
  { label: "🇯🇵 日本", value: "japan", code: "JP" },
  { label: "🇰🇷 韓国", value: "korea", code: "KR" },
  { label: "🇺🇸 アメリカ", value: "usa", code: "US" },
];

const dateOptions: { label: string; value: DateRange }[] = [
  { label: "直近7日", value: "7" },
  { label: "直近28日", value: "28" },
  { label: "直近90日", value: "90" },
  { label: "直近1年", value: "365" },
  { label: "直近2年", value: "730" },
  { label: "直近3年", value: "1095" },
  { label: "カスタム", value: "custom" },
];

const viewOptions: { label: string; value: ViewFilter }[] = [
  { label: "1,000回以上", value: "1000" },
  { label: "1万回以上", value: "10000" },
  { label: "5万回以上", value: "50000" },
  { label: "10万回以上", value: "100000" },
  { label: "カスタム", value: "custom" },
];

const subscriberRangeOptions: { label: string; value: SubscriberRange }[] = [
  { label: "100人未満",         value: "u100" },
  { label: "100〜1000人未満",   value: "100-1k" },
  { label: "1000〜5000人未満",  value: "1k-5k" },
  { label: "5000〜1万人未満",   value: "5k-10k" },
  { label: "1万〜2万人未満",    value: "10k-20k" },
  { label: "2万〜5万人未満",    value: "20k-50k" },
  { label: "5万〜10万人未満",   value: "50k-100k" },
  { label: "10万〜100万人未満", value: "100k-1m" },
];

const durationOptions: { label: string; value: DurationValue }[] = [
  { label: "3分未満", value: "short" },
  { label: "3〜20分", value: "medium" },
  { label: "20分以上", value: "long" },
];

const spreadOptions: { label: string; value: SpreadFilter }[] = [
  { label: "1.0x以上", value: "1.0" },
  { label: "1.5x以上", value: "1.5" },
  { label: "2.0x以上", value: "2.0" },
  { label: "3.0x以上", value: "3.0" },
  { label: "5.0x以上", value: "5.0" },
  { label: "カスタム", value: "custom" },
];

async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text.trim()) return text;
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ja|${targetLang}`
    );
    const data = await res.json();
    return data.responseData?.translatedText ?? text;
  } catch {
    return text;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Main Page
════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [originalQuery, setOriginalQuery] = useState("");
  const [translating, setTranslating] = useState(false);
  const [matchType, setMatchType] = useState<MatchType>("partial");
  const [region, setRegion] = useState<Region>("japan");
  const [dateRange, setDateRange] = useState<DateRange>("");
  const [dateCustomDays, setDateCustomDays] = useState("");
  const [clientFilters, setClientFilters] = useState<ClientFilters>({
    viewMin: "", viewCustom: "", spreadMin: "", spreadCustom: "", durations: [], subscriberRanges: [],
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "viewCount", dir: "desc" });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [searchedQuery, setSearchedQuery] = useState("");

  const updateFilter = useCallback(<K extends keyof ClientFilters>(key: K, val: ClientFilters[K]) => {
    setClientFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  }, []);

  const handleRegionChange = useCallback(async (newRegion: Region) => {
    setRegion(newRegion);
    if (!queryInput.trim()) return;
    const targetLang = newRegion === "korea" ? "ko" : newRegion === "usa" ? "en" : "ja";
    if (newRegion === "japan") {
      if (originalQuery) setQueryInput(originalQuery);
      return;
    }
    if (region === "japan") setOriginalQuery(queryInput);
    setTranslating(true);
    const translated = await translateText(
      region === "japan" ? queryInput : (originalQuery || queryInput), targetLang
    );
    setQueryInput(translated);
    setTranslating(false);
  }, [queryInput, originalQuery, region]);

  const handleSort = useCallback((key: SortKey) => {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));
  }, []);

  const getPublishedAfterDays = (): string | null => {
    if (!dateRange) return null;
    if (dateRange === "custom") {
      const p = parseInt(dateCustomDays);
      return !isNaN(p) && p > 0 ? String(p) : null;
    }
    return dateRange;
  };

  const handleSearch = useCallback(async () => {
    if (!apiKey.trim() || !queryInput.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    const publishedAfterDays = getPublishedAfterDays();
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-youtube-api-key": apiKey.trim() },
        body: JSON.stringify({ query: queryInput.trim(), region, publishedAfterDays }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "エラーが発生しました"); return; }
      setData(json as SearchResponse);
      setSearchedQuery(queryInput.trim());
      setPage(1);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, queryInput, region, dateRange, dateCustomDays]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return [...applyClientFilters(data.videos, searchedQuery, matchType, clientFilters)].sort((a, b) => {
      let diff = 0;
      if (sort.key === "publishedAt") diff = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
      else if (sort.key === "viewCount") diff = a.viewCount - b.viewCount;
      else diff = a.spreadRate - b.spreadRate;
      return sort.dir === "desc" ? -diff : diff;
    });
  }, [data, searchedQuery, matchType, clientFilters, sort]);

  const paged = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
  const hasMore = paged.length < filtered.length;
  const canSearch = apiKey.trim() && queryInput.trim() && !loading;

  return (
    <div className="lg-base">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="lg-header sticky top-0 z-20 px-6 py-3.5 flex items-center gap-3">
        <Image src="/eaval-logo.png" alt="EAVAL" width={30} height={30} className="flex-shrink-0 rounded-lg" />
        <div className="flex flex-col">
          <span className="text-[15px] font-bold" style={{ color: "#111827" }}>YouTube 高精度検索ツール</span>
          <span className="text-[11px]" style={{ color: "rgba(0,0,0,0.35)" }}>by 株式会社EAVAL</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-5">

        {/* ── Overview panel ──────────────────────────────────────────── */}
        <div className="lg-panel p-8 space-y-5 text-center">
          <h1 className="text-xl font-bold leading-relaxed" style={{ color: "#111827" }}>
            YouTubeを<span style={{ color: "#e63946" }}>高精度</span>に検索し、リサーチを効率化するツールです
          </h1>
          <p className="text-sm leading-relaxed max-w-2xl mx-auto" style={{ color: "#6b7280" }}>
            キーワード・公開地域・公開日・動画時間・再生回数・拡散率を組み合わせて絞り込み。<br />
            各チャンネルの実力を基準にした「<strong style={{ color: "#374151" }}>拡散率</strong>」で、そのチャンネルの中で異常に伸びた動画を発見できます。<br />
            韓国・アメリカのトレンドも、キーワードを自動翻訳して即検索。
          </p>

          <SectionLabel>使い方</SectionLabel>

          {/* How-to steps */}
          <div className="flex items-stretch gap-2 pt-1">
            {([
              {
                step: "1",
                icon: (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
                  </svg>
                ),
                label: "APIキーを\n取得",
                desc: "Google Cloud ConsoleでYouTube Data API v3を有効化してキーを発行する",
              },
              {
                step: "2",
                icon: (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                ),
                label: "検索条件を\n設定",
                desc: "キーワード・地域・公開日・動画時間・再生回数・拡散率を設定して検索",
              },
              {
                step: "3",
                icon: (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25" />
                  </svg>
                ),
                label: "結果を\n絞り込む",
                desc: "取得した動画を再生回数・拡散率でさらに絞り込み。チャンネル別ベースラインで公平に比較",
              },
              {
                step: "4",
                icon: (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                  </svg>
                ),
                label: "リサーチに\n活かす",
                desc: "伸びた動画のテーマ・タイトルを把握し、コンテンツ企画や競合分析に役立てる",
              },
            ] as const).map((item, i) => (
              <div key={item.step} className="flex flex-1 items-start">
                <div className="lg-step-card flex flex-1 flex-col items-center gap-2.5 px-2 py-4 text-center">
                  {/* Icon with step badge */}
                  <div className="relative flex h-11 w-11 items-center justify-center lg-step-icon" style={{ color: "#e63946" }}>
                    {item.icon}
                    <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: "linear-gradient(145deg,#f04050,#c01020)", boxShadow: "0 2px 6px rgba(220,38,38,0.4)" }}>
                      {item.step}
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-[11px] font-bold leading-tight" style={{ color: "#1f2937" }}>{item.label}</p>
                  <p className="text-[10px] leading-snug" style={{ color: "#9ca3af" }}>{item.desc}</p>
                </div>
                {i < 3 && (
                  <div className="shrink-0 px-0.5 pt-5" style={{ color: "rgba(0,0,0,0.18)" }}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Amber info */}
          <div className="lg-amber px-4 py-3 text-xs text-left mt-1" style={{ color: "#78350f" }}>
            <strong>拡散率について：</strong>
            各チャンネルの最新50本の再生回数の中央値をベースラインとし、その動画が何倍の再生数を得ているかを示します。チャンネルの規模に関係なく「本当に伸びた動画」を見つけるのに使えます。
          </div>
        </div>

        {/* ── API Key panel ───────────────────────────────────────────── */}
        <div className="lg-panel p-6 space-y-4">
          <SectionLabel>API設定</SectionLabel>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "#374151" }}>YouTube Data API キー</label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                className="lg-input w-full px-3 py-2.5 pr-10 text-sm"
                style={{ color: "#111827" }}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "rgba(0,0,0,0.3)" }}
              >
                {showKey ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs" style={{ color: "rgba(0,0,0,0.38)" }}>
              <a
                href="https://note.com/yuki_tech/n/na82ad826df1f"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dashed underline-offset-2 hover:opacity-70 transition-opacity"
              >
                YouTube Data API v3の取得方法はこちら（参考サイト）
              </a>
            </p>
          </div>
        </div>

        {/* ── Search conditions panel ─────────────────────────────────── */}
        <div className="lg-panel p-6 space-y-6">
          <SectionLabel>検索条件</SectionLabel>

          {/* Keyword + match type */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "#374151" }}>検索キーワード</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canSearch && handleSearch()}
                placeholder="例: ダイエット 筋トレ"
                className="lg-input flex-1 px-3 py-2.5 text-sm"
                style={{ color: "#111827" }}
              />
              {/* Match type — segment control */}
              <div className="lg-seg-wrap flex text-sm font-medium">
                <button
                  type="button"
                  onClick={() => setMatchType("partial")}
                  className={`px-3 py-2 transition-all ${matchType === "partial" ? "lg-seg-active" : "lg-seg-idle"}`}
                >
                  部分一致
                </button>
                <button
                  type="button"
                  onClick={() => setMatchType("exact")}
                  className={`px-3 py-2 transition-all ${matchType === "exact" ? "lg-seg-active" : "lg-seg-idle"}`}
                >
                  完全一致
                </button>
              </div>
            </div>
            {matchType === "exact" && (
              <div className="lg-amber px-3 py-2 text-xs" style={{ color: "#92400e" }}>
                完全一致：取得した動画のタイトルにキーワードが含まれるものだけ表示します
              </div>
            )}
          </div>

          {/* Region — segment control */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2" style={{ color: "#374151" }}>
              公開地域
              {translating && (
                <span className="text-xs font-normal animate-pulse" style={{ color: "#60a5fa" }}>
                  キーワードを翻訳中…
                </span>
              )}
            </label>
            <div className="lg-seg-wrap flex w-fit text-sm font-medium">
              {regionOptions.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => handleRegionChange(r.value)}
                  disabled={translating}
                  className={`px-4 py-2 transition-all disabled:opacity-50 ${region === r.value ? "lg-seg-active" : "lg-seg-idle"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "#374151" }}>公開日</label>
            <ChipGroup options={dateOptions} value={dateRange} onChange={(v) => setDateRange(v as DateRange)} />
            {dateRange === "custom" && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min={1}
                  value={dateCustomDays}
                  onChange={(e) => setDateCustomDays(e.target.value)}
                  placeholder="日数"
                  className="lg-input w-28 px-3 py-2 text-sm"
                  style={{ color: "#111827" }}
                />
                <span className="text-sm" style={{ color: "#6b7280" }}>日以内</span>
              </div>
            )}
          </div>

          {/* Duration — multi-select */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "#374151" }}>
              動画時間
              <span className="ml-2 text-xs font-normal" style={{ color: "rgba(0,0,0,0.32)" }}>複数選択可</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {durationOptions.map((o) => {
                const selected = clientFilters.durations.includes(o.value as DurationValue);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      const v = o.value as DurationValue;
                      updateFilter("durations",
                        selected
                          ? clientFilters.durations.filter((d) => d !== v)
                          : [...clientFilters.durations, v]
                      );
                    }}
                    className={`px-3 py-1 text-xs font-medium transition-all ${selected ? "lg-chip-on" : "lg-chip"}`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subscriber count — multi-select */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "#374151" }}>
              チャンネル登録者数
              <span className="ml-2 text-xs font-normal" style={{ color: "rgba(0,0,0,0.32)" }}>複数選択可</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {subscriberRangeOptions.map((o) => {
                const selected = clientFilters.subscriberRanges.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      updateFilter("subscriberRanges",
                        selected
                          ? clientFilters.subscriberRanges.filter((r) => r !== o.value)
                          : [...clientFilters.subscriberRanges, o.value]
                      );
                    }}
                    className={`px-3 py-1 text-xs font-medium transition-all ${selected ? "lg-chip-on" : "lg-chip"}`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* View count */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "#374151" }}>再生回数</label>
            <ChipGroup options={viewOptions} value={clientFilters.viewMin} onChange={(v) => updateFilter("viewMin", v as ViewFilter)} />
            {clientFilters.viewMin === "custom" && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min={0}
                  value={clientFilters.viewCustom}
                  onChange={(e) => updateFilter("viewCustom", e.target.value)}
                  placeholder="例: 30000"
                  className="lg-input w-40 px-3 py-2 text-sm"
                  style={{ color: "#111827" }}
                />
                <span className="text-sm" style={{ color: "#6b7280" }}>回以上</span>
              </div>
            )}
          </div>

          {/* Spread rate */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "#374151" }}>
              拡散率
              {data && (
                <span className="ml-2 text-xs font-normal" style={{ color: "rgba(0,0,0,0.32)" }}>
                  各チャンネルの最新50本の中央値に対する倍率
                </span>
              )}
            </label>
            <ChipGroup options={spreadOptions} value={clientFilters.spreadMin} onChange={(v) => updateFilter("spreadMin", v as SpreadFilter)} />
            {clientFilters.spreadMin === "custom" && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={clientFilters.spreadCustom}
                  onChange={(e) => updateFilter("spreadCustom", e.target.value)}
                  placeholder="例: 2.5"
                  className="lg-input w-28 px-3 py-2 text-sm"
                  style={{ color: "#111827" }}
                />
                <span className="text-sm" style={{ color: "#6b7280" }}>x以上</span>
              </div>
            )}
          </div>

          {/* Search button */}
          <button
            type="button"
            onClick={handleSearch}
            disabled={!canSearch}
            className="lg-search-btn w-full flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-white"
          >
            <Search className="h-4 w-4" />
            {loading ? "検索中…" : "検索"}
          </button>
        </div>

        {/* ── Error ───────────────────────────────────────────────────── */}
        {error && (
          <div className="lg-red-info px-4 py-3 text-sm" style={{ color: "#b91c1c" }}>{error}</div>
        )}

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "rgba(0,0,0,0.3)" }}>
            <svg className="animate-spin h-7 w-7" viewBox="0 0 24 24" fill="none" style={{ color: "#e63946" }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className="text-sm">検索結果を取得中（最大200件）…</span>
          </div>
        )}

        {/* ── Results ─────────────────────────────────────────────────── */}
        {data && (
          <>
            {/* Summary bar */}
            <div className="lg-panel px-5 py-3.5 flex flex-wrap items-center gap-4 text-sm" style={{ color: "#6b7280" }}>
              <span>検索: <strong style={{ color: "#111827" }}>「{data.query}」</strong></span>
              <span>地域: <strong style={{ color: "#111827" }}>{regionOptions.find(r => r.code === data.region)?.label ?? data.region}</strong></span>
              <span>取得: <strong style={{ color: "#111827" }}>{data.totalFetched}件</strong></span>
              <span className="text-xs" style={{ color: "rgba(0,0,0,0.3)" }}>拡散率 = 各チャンネルの最新50本の中央値を基準</span>
            </div>

            {filtered.length > 0 ? (
              <div className="lg-panel overflow-hidden">
                {/* Table header controls */}
                <div className="flex items-center justify-between px-5 py-3 lg-divider">
                  <span className="text-sm" style={{ color: "rgba(0,0,0,0.4)" }}>{paged.length} / {filtered.length}件</span>
                  <button
                    type="button"
                    onClick={() => exportCsv(filtered, searchedQuery)}
                    className="lg-csv-btn flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                    style={{ color: "#4b5563" }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSVダウンロード
                  </button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr className="text-xs" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", background: "rgba(0,0,0,0.015)", color: "#9ca3af" }}>
                        <th className="px-4 py-3 text-left w-10">#</th>
                        <th className="px-4 py-3 text-left">動画</th>
                        <th className="px-4 py-3 text-left whitespace-nowrap">チャンネル</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">
                          <SortHeader label="公開日" sortKey="publishedAt" currentKey={sort.key} currentDir={sort.dir} onSort={handleSort} />
                        </th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">
                          <SortHeader label="再生回数" sortKey="viewCount" currentKey={sort.key} currentDir={sort.dir} onSort={handleSort} />
                        </th>
                        <th className="px-4 py-3 text-right whitespace-nowrap" style={{ color: "rgba(0,0,0,0.28)" }}>CH中央値</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">
                          <SortHeader label="拡散率" sortKey="spreadRate" currentKey={sort.key} currentDir={sort.dir} onSort={handleSort} />
                        </th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((v, i) => (
                        <tr
                          key={v.id}
                          className="lg-row transition-colors"
                          style={{ borderTop: "1px solid rgba(0,0,0,0.035)" }}
                        >
                          <td className="px-4 py-3 text-xs" style={{ color: "rgba(0,0,0,0.25)" }}>{i + 1}</td>
                          <td className="px-4 py-3">
                            <a
                              href={`https://www.youtube.com/watch?v=${v.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 group"
                            >
                              <img
                                src={v.thumbnailUrl}
                                alt=""
                                className="h-10 w-[72px] object-cover rounded-lg flex-shrink-0"
                                style={{ background: "rgba(0,0,0,0.06)" }}
                              />
                              <span
                                className="line-clamp-2 leading-snug transition-colors"
                                style={{ color: "#1f2937" }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "#e63946")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "#1f2937")}
                              >
                                {v.title}
                              </span>
                            </a>
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap max-w-[120px] truncate">
                            <a
                              href={`https://www.youtube.com/channel/${v.channelId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="transition-colors"
                              style={{ color: "#9ca3af" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#e63946")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
                            >
                              {v.channelName}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap text-xs" style={{ color: "#6b7280" }}>{fmtDate(v.publishedAt)}</td>
                          <td className="px-4 py-3 text-right font-semibold whitespace-nowrap" style={{ color: "#111827" }}>{fmt(v.viewCount)}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap text-xs" style={{ color: "rgba(0,0,0,0.3)" }}>{fmt(Math.round(v.channelBaseline))}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 text-xs font-semibold ${
                              v.spreadRate >= 3 ? "lg-badge-red"
                              : v.spreadRate >= 1.5 ? "lg-badge-orange"
                              : v.spreadRate >= 1 ? "lg-badge-yellow"
                              : "lg-badge-gray"
                            }`}>
                              {v.spreadRate.toFixed(2)}x
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              title="URLをコピー"
                              onClick={() => {
                                navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${v.id}`);
                                setCopiedId(v.id);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className="transition-colors"
                              style={{ color: "rgba(0,0,0,0.28)" }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#e63946")}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(0,0,0,0.28)")}
                            >
                              {copiedId === v.id
                                ? <Check className="h-4 w-4" style={{ color: "#16a34a" }} />
                                : <Copy className="h-4 w-4" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Load more */}
                {hasMore && (
                  <div className="px-4 py-4 text-center" style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
                    <button
                      type="button"
                      onClick={() => setPage((p) => p + 1)}
                      className="lg-more-btn inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium"
                      style={{ color: "#374151" }}
                    >
                      次の10件を見る
                      <span className="text-xs" style={{ color: "rgba(0,0,0,0.3)" }}>
                        （残り {filtered.length - paged.length}件）
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="lg-panel py-16 text-center text-sm" style={{ color: "rgba(0,0,0,0.3)" }}>
                条件に一致する動画がありません
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
