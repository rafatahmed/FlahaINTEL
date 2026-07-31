/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Jordan Amman Excel Import Deduplication
 * Introduction: Skip duplicate files and calendar days already present for Amman channel.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */

export type JoExcelFileScan = {
  file: string;
  contentHash: string;
  /** Unique ISO days found in the file */
  observedDays: string[];
  rowCount: number;
};

export type JoDayDecision =
  | { action: "import"; reason: string }
  | { action: "skip"; reason: string };

/**
 * Per calendar day: skip if already in DB (unless force) or already claimed by earlier file in batch.
 */
export function planJoAmmanDays(params: {
  /** days present in this file */
  daysInFile: string[];
  /** days already written or claimed earlier in this import run */
  claimedDays: Set<string>;
  /** days already in DB with ≥1 row */
  daysInDb: Set<string>;
  force?: boolean;
}): Map<string, JoDayDecision> {
  const out = new Map<string, JoDayDecision>();
  for (const day of params.daysInFile) {
    if (params.claimedDays.has(day)) {
      out.set(day, { action: "skip", reason: "day_already_claimed_in_batch" });
      continue;
    }
    if (!params.force && params.daysInDb.has(day)) {
      out.set(day, { action: "skip", reason: "day_already_in_database" });
      continue;
    }
    out.set(day, {
      action: "import",
      reason: params.force && params.daysInDb.has(day) ? "force_reimport_day" : "new_day",
    });
  }
  return out;
}

export function planJoAmmanFiles(
  files: JoExcelFileScan[],
): Array<JoExcelFileScan & { fileAction: "import" | "skip"; fileSkipReason?: string }> {
  const seenHash = new Map<string, string>();
  return files.map((f) => {
    const prev = seenHash.get(f.contentHash);
    if (prev) {
      return {
        ...f,
        fileAction: "skip" as const,
        fileSkipReason: `duplicate_file_bytes (of ${prev})`,
      };
    }
    seenHash.set(f.contentHash, f.file);
    return { ...f, fileAction: "import" as const };
  });
}
