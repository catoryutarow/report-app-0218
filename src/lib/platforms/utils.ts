import type { Platform } from "@/lib/firebase/firestore";

/** Platform display color for UI badges/icons */
export const platformColors: Record<Platform, string> = {
  ig_feed: "bg-pink-100 text-pink-700 border-pink-200",
  ig_reel: "bg-purple-100 text-purple-700 border-purple-200",
  yt_long: "bg-red-100 text-red-700 border-red-200",
  yt_short: "bg-orange-100 text-orange-700 border-orange-200",
  tiktok: "bg-cyan-100 text-cyan-700 border-cyan-200",
  x: "bg-slate-100 text-slate-700 border-slate-200",
  ga4: "bg-blue-100 text-blue-700 border-blue-200",
  gsc: "bg-green-100 text-green-700 border-green-200",
};

/**
 * Get thumbnail URL for a post. YouTube thumbnails are available
 * without API key via img.youtube.com.
 */
export function getThumbnailUrl(platformId: string, postKey: string): string | null {
  if ((platformId === "yt_long" || platformId === "yt_short") && postKey && !postKey.startsWith("csv_")) {
    return `https://img.youtube.com/vi/${postKey}/mqdefault.jpg`;
  }
  return null;
}

/** Platform emoji for quick visual identification */
export const platformEmoji: Record<Platform, string> = {
  ig_feed: "📸",
  ig_reel: "🎬",
  yt_long: "🎥",
  yt_short: "📱",
  tiktok: "🎵",
  x: "𝕏",
  ga4: "📊",
  gsc: "🔍",
};
