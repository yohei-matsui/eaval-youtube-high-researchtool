"use client";

import { useState, useCallback, useMemo } from "react";
import { Eye, EyeOff, Search, ExternalLink, ChevronUp, ChevronDown } from "lucide-react";
import { FilterVideoItem, ChannelFilterResponse } from "@/app/api/channel-filter/route";

type DateRange = "7" | "28" | "90" | "365" | "730" | "1095" | "custom";
type ViewFilter = "1000" | "10000" | "50000" | "100000" | "custom";
type SpreadFilter = "1.0" | "1.5" | "2.0" | "3.0" | "5.0" | "custom";
type SortKey = "publishedAt" | "viewCount" | "spreadRate";
type SortDir = "asc" | "desc";

interface Filters {
  dateRange: DateRange | "";
  dateCustomDays: string;
  viewMin: ViewFilter | "";
  viewCustom: string;
  spreadMin: SpreadFilter | "";
  spreadCustom: string;
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

function fmtSubs(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万人`;
  return `${n.toLocaleString()}人`;
}

function applyFilters(videos: FilterVideoItem[], filters: Filters): FilterVideoItem[] {
  const now = Date.now();
  return videos.filter((v) => {
    if (filters.dateRange) {
      let days: number | null = null;
      if (filters.dateRange === "custom") {
        const p = parseInt(filters.dateCustomDays);
        if (!isNaN(p) && p > 0) days = p;
      } else {
        days = parseInt(filters.dateRange);
      }
      if (days !== null && new Date(v.publishedAt).getTime() < now - days * 86400000) return false;
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

    return true;
  });
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T | "";
  onChange: (v: T | "") => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(value === o.value ? "" : o.value)}
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

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [channelInput, setChannelInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ChannelFilterResponse | null>(null);

  const [filters, setFilters] = useState<Filters>({
    dateRange: "", dateCustomDays: "",
    viewMin: "", viewCustom: "",
    spreadMin: "", spreadCustom: "",
  });

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "publishedAt", dir: "desc" });

  const updateFilter = useCallback(<K extends keyof Filters>(key: K, val: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));
  }, []);

  const handleFetch = useCallback(async () => {
    if (!apiKey.trim() || !channelInput.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/channel-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-youtube-api-key": apiKey.trim() },
        body: JSON.stringify({ channelInput: channelInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "エラーが発生しました"); return; }
      setData(json as ChannelFilterResponse);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [apiKey, channelInput]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return [...applyFilters(data.videos, filters)].sort((a, b) => {
      let diff = 0;
      if (sort.key === "publishedAt") diff = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
      else if (sort.key === "viewCount") diff = a.viewCount - b.viewCount;
      else diff = a.spreadRate - b.spreadRate;
      return sort.dir === "desc" ? -diff : diff;
    });
  }, [data, filters, sort]);

  const dateOptions: { label: string; value: DateRange }[] = [
    { label: "直近7日", value: "7" }, { label: "直近28日", value: "28" },
    { label: "直近90日", value: "90" }, { label: "直近1年", value: "365" },
    { label: "直近2年", value: "730" }, { label: "直近3年", value: "1095" },
    { label: "カスタム", value: "custom" },
  ];

  const viewOptions: { label: string; value: ViewFilter }[] = [
    { label: "1,000回以上", value: "1000" }, { label: "1万回以上", value: "10000" },
    { label: "5万回以上", value: "50000" }, { label: "10万回以上", value: "100000" },
    { label: "カスタム", value: "custom" },
  ];

  const spreadOptions: { label: string; value: SpreadFilter }[] = [
    { label: "1.0x以上", value: "1.0" }, { label: "1.5x以上", value: "1.5" },
    { label: "2.0x以上", value: "2.0" }, { label: "3.0x以上", value: "3.0" },
    { label: "5.0x以上", value: "5.0" }, { label: "カスタム", value: "custom" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-red-500"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        <span className="text-lg font-bold text-gray-900">YouTube チャンネルフィルター</span>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Overview */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">このツールについて</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            YouTubeチャンネルの動画を一括で取得し、<strong className="text-gray-900">公開日・再生回数・拡散率</strong>の3軸でフィルタリングできるツールです。
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            チャンネル全体の再生回数の中央値をベースラインとして算出した「<strong className="text-gray-900">拡散率</strong>」を使えば、単純な再生回数の大小ではなく、<strong className="text-gray-900">そのチャンネルにとって異常に伸びた動画</strong>を見つけることができます。
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            どんなテーマ・切り口・タイトルが視聴者に刺さったのかを把握でき、自分のチャンネル運営やコンテンツ企画に活かすことができます。
          </p>
        </div>

        {/* How to use */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">使い方</h2>
          <ol className="space-y-3">
            {[
              { n: 1, title: "APIキーを取得", desc: "Google Cloud Console で YouTube Data API v3 を有効にし、APIキーを発行します。" },
              { n: 2, title: "チャンネルを入力", desc: "調べたいチャンネルのURL（例: https://www.youtube.com/@channelname）またはハンドル名を入力して「取得」を押します。" },
              { n: 3, title: "フィルターで絞り込む", desc: "公開日・再生回数・拡散率のフィルターをチップで選択します。複数を組み合わせることも可能です。" },
              { n: 4, title: "結果を確認", desc: "条件に一致した動画が一覧表示されます。列ヘッダーをクリックするとソートできます。タイトル右のアイコンからYouTubeで動画を開けます。" },
            ].map(({ n, title, desc }) => (
              <li key={n} className="flex gap-4">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700">
            <strong>拡散率について：</strong> 取得した動画全体の再生回数の中央値をベースラインとし、各動画の再生回数がその何倍かを示します。チャンネル平均と比べて特に伸びた動画を見つけるのに使えます。
          </div>
        </div>

        {/* Input card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">接続設定</h2>

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
              APIキーは
              <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline ml-1">Google Cloud Console</a>
              で取得できます
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">チャンネルURL / ハンドル名</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="https://www.youtube.com/@channelname  または  @channelname"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition"
              />
              <button
                type="button"
                onClick={handleFetch}
                disabled={loading || !apiKey.trim() || !channelInput.trim()}
                className="flex items-center gap-2 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Search className="h-4 w-4" />
                {loading ? "取得中…" : "取得"}
              </button>
            </div>
            <p className="text-xs text-gray-400">最大200本の動画を取得します（ショート動画 ≤3分 は除外）</p>
          </div>
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
            <span className="text-sm">動画データを取得中（最大200本）…</span>
          </div>
        )}

        {data && (
          <>
            {/* Channel info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm">
              {data.channelThumbnail && (
                <img src={data.channelThumbnail} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-100" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{data.channelName}</p>
                <p className="text-sm text-gray-500 flex gap-3 flex-wrap">
                  <span>登録者 {fmtSubs(data.subscriberCount)}</span>
                  <span>取得動画 {data.totalFetched}本</span>
                  <span>ベースライン（中央値） <strong className="text-gray-700">{fmt(Math.round(data.baseline))}回</strong></span>
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">フィルター</h2>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">公開日</p>
                <ChipGroup options={dateOptions} value={filters.dateRange} onChange={(v) => updateFilter("dateRange", v as DateRange | "")} />
                {filters.dateRange === "custom" && (
                  <div className="flex items-center gap-2 pt-1">
                    <input type="number" min={1} value={filters.dateCustomDays} onChange={(e) => updateFilter("dateCustomDays", e.target.value)}
                      placeholder="日数" className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
                    <span className="text-sm text-gray-500">日以内</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">再生回数</p>
                <ChipGroup options={viewOptions} value={filters.viewMin} onChange={(v) => updateFilter("viewMin", v as ViewFilter | "")} />
                {filters.viewMin === "custom" && (
                  <div className="flex items-center gap-2 pt-1">
                    <input type="number" min={0} value={filters.viewCustom} onChange={(e) => updateFilter("viewCustom", e.target.value)}
                      placeholder="例: 30000" className="w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
                    <span className="text-sm text-gray-500">回以上</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  拡散率
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    ベースライン {fmt(Math.round(data.baseline))}回 に対する倍率
                  </span>
                </p>
                <ChipGroup options={spreadOptions} value={filters.spreadMin} onChange={(v) => updateFilter("spreadMin", v as SpreadFilter | "")} />
                {filters.spreadMin === "custom" && (
                  <div className="flex items-center gap-2 pt-1">
                    <input type="number" min={0} step={0.1} value={filters.spreadCustom} onChange={(e) => updateFilter("spreadCustom", e.target.value)}
                      placeholder="例: 2.5" className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
                    <span className="text-sm text-gray-500">x以上</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400 pt-1">
                表示: <span className="font-semibold text-gray-600">{filtered.length}本</span> / {data.totalFetched}本
              </p>
            </div>

            {/* Results */}
            {filtered.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                        <th className="px-4 py-3 text-left w-10">#</th>
                        <th className="px-4 py-3 text-left">動画</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">
                          <SortHeader label="公開日" sortKey="publishedAt" currentKey={sort.key} currentDir={sort.dir} onSort={handleSort} />
                        </th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">
                          <SortHeader label="再生回数" sortKey="viewCount" currentKey={sort.key} currentDir={sort.dir} onSort={handleSort} />
                        </th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">
                          <SortHeader label="拡散率" sortKey="spreadRate" currentKey={sort.key} currentDir={sort.dir} onSort={handleSort} />
                        </th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map((v, i) => (
                        <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <img src={v.thumbnailUrl} alt="" className="h-10 w-[72px] object-cover rounded flex-shrink-0 bg-gray-100" />
                              <span className="text-gray-800 line-clamp-2 leading-snug">{v.title}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">{fmtDate(v.publishedAt)}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">{fmt(v.viewCount)}</td>
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
                            <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                              className="text-gray-400 hover:text-red-500 transition-colors">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
