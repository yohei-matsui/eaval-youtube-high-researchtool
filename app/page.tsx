"use client";

import Image from "next/image";
import { useState, useCallback, useMemo } from "react";
import { Eye, EyeOff, Search, ExternalLink, ChevronUp, ChevronDown, Download } from "lucide-react";
import { SearchVideoItem, SearchResponse } from "@/app/api/search/route";

type MatchType = "partial" | "exact";
type Region = "japan" | "korea" | "usa";
type DateRange = "7" | "28" | "90" | "365" | "730" | "1095" | "custom" | "";
type ViewFilter = "1000" | "10000" | "50000" | "100000" | "custom" | "";
type SpreadFilter = "1.0" | "1.5" | "2.0" | "3.0" | "5.0" | "custom" | "";
type DurationFilter = "short" | "medium" | "long" | "";
type SortKey = "publishedAt" | "viewCount" | "spreadRate";
type SortDir = "asc" | "desc";

interface ClientFilters {
  viewMin: ViewFilter;
  viewCustom: string;
  spreadMin: SpreadFilter;
  spreadCustom: string;
  duration: DurationFilter;
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

    if (filters.duration) {
      const sec = v.durationSeconds;
      if (filters.duration === "short" && sec >= 180) return false;
      if (filters.duration === "medium" && (sec < 180 || sec >= 1200)) return false;
      if (filters.duration === "long" && sec < 1200) return false;
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
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === o.value
              ? "bg-red-500 text-white shadow-sm"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SortHeader({
  label, sortKey, currentKey, currentDir, onSort,
}: {
  label: string; sortKey: SortKey; currentKey: SortKey; currentDir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = currentKey === sortKey;
  return (
    <button type="button" onClick={() => onSort(sortKey)} className="flex items-center gap-1 font-medium hover:text-red-600 transition-colors">
      {label}
      <span className="flex flex-col">
        <ChevronUp className={`h-3 w-3 -mb-1 ${active && currentDir === "asc" ? "text-red-500" : "text-gray-300"}`} />
        <ChevronDown className={`h-3 w-3 ${active && currentDir === "desc" ? "text-red-500" : "text-gray-300"}`} />
      </span>
    </button>
  );
}

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

const durationOptions: { label: string; value: DurationFilter }[] = [
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

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  // Search params (trigger API call)
  const [queryInput, setQueryInput] = useState("");
  const [originalQuery, setOriginalQuery] = useState("");
  const [translating, setTranslating] = useState(false);
  const [matchType, setMatchType] = useState<MatchType>("partial");
  const [region, setRegion] = useState<Region>("japan");
  const [dateRange, setDateRange] = useState<DateRange>("");
  const [dateCustomDays, setDateCustomDays] = useState("");

  // Client-side filters
  const [clientFilters, setClientFilters] = useState<ClientFilters>({
    viewMin: "",
    viewCustom: "",
    spreadMin: "",
    spreadCustom: "",
    duration: "",
  });

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "viewCount", dir: "desc" });
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
      // 日本に戻したら元のクエリを復元
      if (originalQuery) setQueryInput(originalQuery);
      return;
    }

    // 初回翻訳前に元のクエリを保存
    if (region === "japan") setOriginalQuery(queryInput);

    setTranslating(true);
    const translated = await translateText(
      region === "japan" ? queryInput : (originalQuery || queryInput),
      targetLang
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <Image src="/eaval-logo.png" alt="EAVAL" width={32} height={32} className="flex-shrink-0" />
        <div className="flex flex-col">
          <span className="text-lg font-bold text-gray-900">YouTube 高精度検索ツール</span>
          <span className="text-xs text-gray-400">by 株式会社EAVAL</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Overview */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center space-y-4">
          <h1 className="text-xl font-bold text-gray-900 leading-relaxed">
            YouTubeを<span className="text-red-500">高精度</span>に検索し、リサーチを効率化するツールです
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed max-w-2xl mx-auto">
            キーワード・公開地域・公開日・動画時間・再生回数・拡散率を組み合わせて絞り込み。<br />
            各チャンネルの実力を基準にした「<strong className="text-gray-800">拡散率</strong>」で、そのチャンネルの中で異常に伸びた動画を発見できます。<br />
            韓国・アメリカのトレンドも、キーワードを自動翻訳して即検索。
          </p>

          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 pt-2">使い方</p>

          <div className="flex items-stretch gap-1.5 pt-1">
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
                <div className="flex flex-1 flex-col items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50 px-2 py-4 text-center">
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white text-red-400 shadow-sm ring-1 ring-gray-100">
                    {item.icon}
                    <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                      {item.step}
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-[11px] font-bold leading-tight text-gray-800">{item.label}</p>
                  <p className="text-[10px] leading-snug text-gray-500">{item.desc}</p>
                </div>
                {i < 3 && (
                  <div className="shrink-0 px-0.5 pt-5 text-gray-300">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700 text-left mt-2">
            <strong>拡散率について：</strong> 各チャンネルの最新50本の再生回数の中央値をベースラインとし、その動画が何倍の再生数を得ているかを示します。チャンネルの規模に関係なく「本当に伸びた動画」を見つけるのに使えます。
          </div>
        </div>

        {/* API Key */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">API設定</h2>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">YouTube Data API キー</label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 pr-10 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition"
              />
              <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showKey ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              <a href="https://note.com/yuki_tech/n/na82ad826df1f" target="_blank" rel="noopener noreferrer" className="underline">YouTube Data API v3の取得方法はこちら（参考サイト）</a>
            </p>
          </div>
        </div>

        {/* Search card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">検索条件</h2>

          {/* Query + match type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">検索キーワード</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canSearch && handleSearch()}
                placeholder="例: ダイエット 筋トレ"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition"
              />
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
                <button
                  type="button"
                  onClick={() => setMatchType("partial")}
                  className={`px-3 py-2.5 transition-colors ${matchType === "partial" ? "bg-red-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  部分一致
                </button>
                <button
                  type="button"
                  onClick={() => setMatchType("exact")}
                  className={`px-3 py-2.5 transition-colors ${matchType === "exact" ? "bg-red-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  完全一致
                </button>
              </div>
            </div>
            {matchType === "exact" && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                完全一致：取得した動画のタイトルにキーワードが含まれるものだけ表示します
              </p>
            )}
          </div>

          {/* Region */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              公開地域
              {translating && (
                <span className="ml-2 text-xs font-normal text-blue-500 animate-pulse">キーワードを翻訳中…</span>
              )}
            </label>
            <div className="flex gap-2">
              {regionOptions.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => handleRegionChange(r.value)}
                  disabled={translating}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                    region === r.value
                      ? "bg-red-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">公開日</label>
            <ChipGroup options={dateOptions} value={dateRange} onChange={(v) => setDateRange(v as DateRange)} />
            {dateRange === "custom" && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min={1}
                  value={dateCustomDays}
                  onChange={(e) => setDateCustomDays(e.target.value)}
                  placeholder="日数"
                  className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
                <span className="text-sm text-gray-500">日以内</span>
              </div>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">動画時間</label>
            <ChipGroup options={durationOptions} value={clientFilters.duration} onChange={(v) => updateFilter("duration", v as DurationFilter)} />
          </div>

          {/* View count */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">再生回数</label>
            <ChipGroup options={viewOptions} value={clientFilters.viewMin} onChange={(v) => updateFilter("viewMin", v as ViewFilter)} />
            {clientFilters.viewMin === "custom" && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min={0}
                  value={clientFilters.viewCustom}
                  onChange={(e) => updateFilter("viewCustom", e.target.value)}
                  placeholder="例: 30000"
                  className="w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
                <span className="text-sm text-gray-500">回以上</span>
              </div>
            )}
          </div>

          {/* Spread rate */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              拡散率
              {data && (
                <span className="ml-2 text-xs font-normal text-gray-400">
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
                  className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
                <span className="text-sm text-gray-500">x以上</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSearch}
            disabled={!canSearch}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Search className="h-4 w-4" />
            {loading ? "検索中…" : "検索"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <svg className="animate-spin h-7 w-7 text-red-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className="text-sm">検索結果を取得中（最大200件）…</span>
          </div>
        )}

        {data && (
          <>
            {/* Summary */}
            <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex flex-wrap items-center gap-4 shadow-sm text-sm text-gray-600">
              <span>検索: <strong className="text-gray-900">「{data.query}」</strong></span>
              <span>地域: <strong className="text-gray-900">{regionOptions.find(r => r.code === data.region)?.label ?? data.region}</strong></span>
              <span>取得: <strong className="text-gray-900">{data.totalFetched}件</strong></span>
              <span className="text-xs text-gray-400">拡散率 = 各チャンネルの最新50本の中央値を基準</span>
            </div>

            {/* Results */}
            {filtered.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">{paged.length} / {filtered.length}件</span>
                  <button
                    type="button"
                    onClick={() => exportCsv(filtered, searchedQuery)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSVダウンロード
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                        <th className="px-4 py-3 text-left w-10">#</th>
                        <th className="px-4 py-3 text-left">動画</th>
                        <th className="px-4 py-3 text-left whitespace-nowrap">チャンネル</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">
                          <SortHeader label="公開日" sortKey="publishedAt" currentKey={sort.key} currentDir={sort.dir} onSort={handleSort} />
                        </th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">
                          <SortHeader label="再生回数" sortKey="viewCount" currentKey={sort.key} currentDir={sort.dir} onSort={handleSort} />
                        </th>
                        <th className="px-4 py-3 text-right whitespace-nowrap text-gray-400">CH中央値</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">
                          <SortHeader label="拡散率" sortKey="spreadRate" currentKey={sort.key} currentDir={sort.dir} onSort={handleSort} />
                        </th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paged.map((v, i) => (
                        <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <img src={v.thumbnailUrl} alt="" className="h-10 w-[72px] object-cover rounded flex-shrink-0 bg-gray-100" />
                              <span className="text-gray-800 line-clamp-2 leading-snug">{v.title}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap max-w-[120px] truncate">
                            <a
                              href={`https://www.youtube.com/channel/${v.channelId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-red-500 transition-colors"
                            >
                              {v.channelName}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">{fmtDate(v.publishedAt)}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">{fmt(v.viewCount)}</td>
                          <td className="px-4 py-3 text-right text-gray-400 text-xs whitespace-nowrap">{fmt(Math.round(v.channelBaseline))}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                              v.spreadRate >= 3 ? "bg-red-100 text-red-700"
                              : v.spreadRate >= 1.5 ? "bg-orange-100 text-orange-700"
                              : v.spreadRate >= 1 ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-500"
                            }`}>
                              {v.spreadRate.toFixed(2)}x
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <a
                              href={`https://www.youtube.com/watch?v=${v.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hasMore && (
                  <div className="px-4 py-4 border-t border-gray-100 text-center">
                    <button
                      type="button"
                      onClick={() => setPage((p) => p + 1)}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    >
                      次の10件を見る
                      <span className="text-xs text-gray-400">（残り {filtered.length - paged.length}件）</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center text-gray-400 text-sm shadow-sm">
                条件に一致する動画がありません
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
