import type { PlatformConfig } from "./types";
import { igFeedConfig } from "./ig-feed";
import { igReelConfig } from "./ig-reel";
import { ytLongConfig } from "./yt-long";
import { ytShortConfig } from "./yt-short";
import { tiktokConfig } from "./tiktok";
import { xConfig } from "./x";

export type { PlatformConfig, MetricDefinition, KpiDefinition, TagDimension } from "./types";

const platforms: Record<string, PlatformConfig> = {
  ig_feed: igFeedConfig,
  ig_reel: igReelConfig,
  yt_long: ytLongConfig,
  yt_short: ytShortConfig,
  tiktok: tiktokConfig,
  x: xConfig,
};

export function getPlatformConfig(platformId: string): PlatformConfig {
  const config = platforms[platformId];
  if (!config) throw new Error(`Unknown platform: ${platformId}`);
  return config;
}

export function getAllPlatforms(): PlatformConfig[] {
  return Object.values(platforms);
}

export function getPlatformIds(): string[] {
  return Object.keys(platforms);
}
