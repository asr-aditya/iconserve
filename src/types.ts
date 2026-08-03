export interface Env {
  ASSETS: Fetcher;
  ICONS: R2Bucket;
  AI: Ai;
  DEFAULT_SET_ORDER: string;
  INDEXNOW_KEY?: string;
  ANALYTICS?: AnalyticsEngineDataset;
  // Armature MCP analytics (set via `wrangler secret put`; SDK no-ops when absent).
  ANALYTICS_INGEST_API_KEY?: string;
  ANALYTICS_INGEST_URL?: string;
}

export interface CatalogEntry {
  id: string; // "<set>/<name>"
  name: string;
  set: string;
  title: string;
  license: string;
  defaultStyle: string;
  styles: string[];
  strokeWidth: number | null;
  category: string | null;
  tags: string[];
  aliases: string[];
}
