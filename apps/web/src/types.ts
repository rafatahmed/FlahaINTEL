export interface SourceSummary { id: string; name: string }

export interface Article {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  author: string | null;
  publishedAt: string | null;
  collectedAt: string;
  source: SourceSummary;
}

export interface CollectionRun {
  id: string;
  status: "SUCCESS" | "FAILURE";
  startedAt: string;
  finishedAt: string;
  itemsFound: number;
  itemsAdded: number;
  error: string | null;
}

export interface RssSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastCollectedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  collectionRuns: CollectionRun[];
}

