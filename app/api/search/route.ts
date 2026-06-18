import { NextRequest, NextResponse } from "next/server";

export interface SearchVideoItem {
  id: string;
  title: string;
  channelId: string;
  channelName: string;
  viewCount: number;
  publishedAt: string;
  thumbnailUrl: string;
  spreadRate: number;
  durationSeconds: number;
  channelBaseline: number;
  subscriberCount: number;
}

export interface SearchResponse {
  videos: SearchVideoItem[];
  totalFetched: number;
  query: string;
  region: string;
}

function parseDurationSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? "0") * 3600) + (parseInt(m[2] ?? "0") * 60) + parseInt(m[3] ?? "0");
}

async function fetchVideoDetails(
  videoIds: string[],
  apiKey: string
): Promise<Map<string, { viewCount: number; title: string; publishedAt: string; thumbnailUrl: string; channelId: string; channelName: string; durationSeconds: number }>> {
  const map = new Map<string, { viewCount: number; title: string; publishedAt: string; thumbnailUrl: string; channelId: string; channelName: string; durationSeconds: number }>();
  if (videoIds.length === 0) return map;

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "statistics,snippet,contentDetails");
    url.searchParams.set("id", chunk.join(","));
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    for (const item of data.items ?? []) {
      const thumbs = item.snippet?.thumbnails;
      const thumbnailUrl = thumbs?.medium?.url ?? thumbs?.default?.url ?? "";
      const durationSeconds = parseDurationSeconds(item.contentDetails?.duration ?? "");
      map.set(item.id, {
        viewCount: parseInt(item.statistics?.viewCount ?? "0", 10),
        title: item.snippet?.title ?? "",
        publishedAt: item.snippet?.publishedAt ?? "",
        thumbnailUrl,
        channelId: item.snippet?.channelId ?? "",
        channelName: item.snippet?.channelTitle ?? "",
        durationSeconds,
      });
    }
  }
  return map;
}

// チャンネルIDからuploadsプレイリストIDと登録者数を一括取得（channels.list: 1クォータ/回）
async function fetchChannelInfo(
  channelIds: string[],
  apiKey: string
): Promise<Map<string, { uploadPlaylistId: string; subscriberCount: number }>> {
  const map = new Map<string, { uploadPlaylistId: string; subscriberCount: number }>();
  for (let i = 0; i < channelIds.length; i += 50) {
    const chunk = channelIds.slice(i, i + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "contentDetails,statistics");
    url.searchParams.set("id", chunk.join(","));
    url.searchParams.set("key", apiKey);
    const res = await fetch(url.toString());
    const data = await res.json();
    for (const item of data.items ?? []) {
      const uploadPlaylistId = item.contentDetails?.relatedPlaylists?.uploads ?? "";
      const subscriberCount = parseInt(item.statistics?.subscriberCount ?? "0", 10);
      if (uploadPlaylistId) map.set(item.id, { uploadPlaylistId, subscriberCount });
    }
  }
  return map;
}

// アップロードプレイリストから最新50本の再生回数中央値を取得（playlistItems.list: 1クォータ/回）
async function fetchChannelBaseline(uploadPlaylistId: string, apiKey: string): Promise<number> {
  // 最新50本のvideoIdを取得
  const plUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  plUrl.searchParams.set("part", "contentDetails");
  plUrl.searchParams.set("playlistId", uploadPlaylistId);
  plUrl.searchParams.set("maxResults", "50");
  plUrl.searchParams.set("key", apiKey);

  const plRes = await fetch(plUrl.toString());
  const plData = await plRes.json();
  if (plData.error || !plData.items?.length) return 0;

  const videoIds: string[] = plData.items
    .map((item: { contentDetails?: { videoId?: string } }) => item.contentDetails?.videoId)
    .filter(Boolean);

  // 統計情報を取得（videos.list: 1クォータ/回）
  const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  statsUrl.searchParams.set("part", "statistics");
  statsUrl.searchParams.set("id", videoIds.join(","));
  statsUrl.searchParams.set("key", apiKey);

  const statsRes = await fetch(statsUrl.toString());
  const statsData = await statsRes.json();
  if (statsData.error || !statsData.items?.length) return 0;

  const views: number[] = statsData.items.map((item: { statistics?: { viewCount?: string } }) =>
    parseInt(item.statistics?.viewCount ?? "0", 10)
  );

  return calcMedian(views);
}

function calcMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-youtube-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "YouTube API key is required" }, { status: 400 });
  }

  const { query, region, publishedAfterDays } = await request.json();
  if (!query?.trim()) {
    return NextResponse.json({ error: "検索キーワードを入力してください" }, { status: 400 });
  }

  const regionCode = region === "japan" ? "JP" : region === "korea" ? "KR" : "US";

  let publishedAfterIso: string | null = null;
  if (publishedAfterDays) {
    const days = parseInt(publishedAfterDays);
    if (!isNaN(days) && days > 0) {
      const d = new Date(Date.now() - days * 86400000);
      publishedAfterIso = d.toISOString();
    }
  }

  const allIds: string[] = [];
  const seenIds = new Set<string>();
  let pageToken: string | undefined;
  const MAX_VIDEOS = 200;

  while (allIds.length < MAX_VIDEOS) {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "id");
    url.searchParams.set("q", query.trim());
    url.searchParams.set("type", "video");
    url.searchParams.set("regionCode", regionCode);
    url.searchParams.set("order", "relevance");
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", apiKey);
    if (publishedAfterIso) url.searchParams.set("publishedAfter", publishedAfterIso);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    for (const item of data.items ?? []) {
      if (item.id?.videoId && !seenIds.has(item.id.videoId)) {
        seenIds.add(item.id.videoId);
        allIds.push(item.id.videoId);
      }
    }

    pageToken = data.nextPageToken;
    if (!pageToken || allIds.length >= MAX_VIDEOS) break;
  }

  const details = await fetchVideoDetails(allIds.slice(0, MAX_VIDEOS), apiKey);

  const rawVideos: Array<{ id: string; viewCount: number; title: string; publishedAt: string; thumbnailUrl: string; channelId: string; channelName: string; durationSeconds: number }> = [];
  const channelIds = new Set<string>();

  for (const id of allIds.slice(0, MAX_VIDEOS)) {
    const d = details.get(id);
    if (!d) continue;
    rawVideos.push({ id, ...d });
    channelIds.add(d.channelId);
  }

  // Step1: channels.list で uploadsプレイリストID＆登録者数を一括取得（1クォータ/50ch）
  const uniqueChannelIds = [...channelIds];
  const channelInfoMap = await fetchChannelInfo(uniqueChannelIds, apiKey);

  // Step2: 各チャンネルのplaylistItems + videos で中央値を並列取得（2クォータ/ch）
  const channelBaselineMap = new Map<string, number>();

  for (let i = 0; i < uniqueChannelIds.length; i += 10) {
    const chunk = uniqueChannelIds.slice(i, i + 10);
    const results = await Promise.all(
      chunk.map(async (cid) => {
        const info = channelInfoMap.get(cid);
        if (!info) return { cid, b: 0 };
        const b = await fetchChannelBaseline(info.uploadPlaylistId, apiKey);
        return { cid, b };
      })
    );
    for (const { cid, b } of results) {
      channelBaselineMap.set(cid, b);
    }
  }

  const videos: SearchVideoItem[] = rawVideos.map((v) => {
    const channelBaseline = channelBaselineMap.get(v.channelId) ?? 0;
    const subscriberCount = channelInfoMap.get(v.channelId)?.subscriberCount ?? 0;
    return {
      ...v,
      channelBaseline,
      subscriberCount,
      spreadRate: channelBaseline > 0 ? v.viewCount / channelBaseline : 0,
    };
  });

  return NextResponse.json({
    videos,
    totalFetched: videos.length,
    query: query.trim(),
    region: regionCode,
  } satisfies SearchResponse);
}
