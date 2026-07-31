/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Mahaseel Import Deduplication
 * Introduction:
 * Pure helpers to skip duplicate PDFs (same bytes or same bulletin period)
 * before writing historical Mahaseel rows.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */

export type BulletinPeriodKey = string;

/** periodFrom|periodTo ISO dates */
export function periodKey(periodFrom: string, periodTo: string): BulletinPeriodKey {
  return `${periodFrom}|${periodTo}`;
}

export type ScannedMahaseelPdf = {
  file: string;
  contentHash: string;
  periodFrom: string;
  periodTo: string;
  rowCount: number;
};

export type DedupeDecision =
  | { action: "import"; reason: string }
  | { action: "skip"; reason: string; duplicateOf?: string };

/**
 * Decide import order and skips for a scanned PDF batch.
 * - First file with a content hash wins; later identical hashes skip.
 * - First file with a periodFrom|periodTo wins; later same period skip.
 * - force=true still de-dupes within batch (identical files) but allows
 *   re-import of periods already seen in DB (caller handles DB skip separately).
 */
export function planMahaseelImport(
  scanned: ScannedMahaseelPdf[],
  opts: {
    /** period keys already present in DB with enough rows */
    periodsInDb: Set<BulletinPeriodKey>;
    /** min existing DB rows for period to treat as "already imported" */
    minRowsForPeriodSkip?: number;
    /** existing row counts by period key */
    dbRowCountByPeriod?: Map<BulletinPeriodKey, number>;
    force?: boolean;
  },
): Array<ScannedMahaseelPdf & { decision: DedupeDecision }> {
  const minRows = opts.minRowsForPeriodSkip ?? 1;
  const dbCounts = opts.dbRowCountByPeriod ?? new Map<string, number>();
  const seenHash = new Map<string, string>();
  const seenPeriod = new Map<string, string>();

  return scanned.map((item) => {
    const hashPrev = seenHash.get(item.contentHash);
    if (hashPrev) {
      return {
        ...item,
        decision: {
          action: "skip",
          reason: "duplicate_file_bytes",
          duplicateOf: hashPrev,
        },
      };
    }

    const pk = periodKey(item.periodFrom, item.periodTo);
    const periodPrev = seenPeriod.get(pk);
    if (periodPrev) {
      return {
        ...item,
        decision: {
          action: "skip",
          reason: "duplicate_bulletin_period_in_batch",
          duplicateOf: periodPrev,
        },
      };
    }

    if (!opts.force) {
      const dbCount = dbCounts.get(pk) ?? (opts.periodsInDb.has(pk) ? minRows : 0);
      if (dbCount >= minRows) {
        return {
          ...item,
          decision: {
            action: "skip",
            reason: "period_already_in_database",
            duplicateOf: `db:${pk} rows=${dbCount}`,
          },
        };
      }
    }

    seenHash.set(item.contentHash, item.file);
    seenPeriod.set(pk, item.file);
    return {
      ...item,
      decision: {
        action: "import",
        reason: opts.force && (dbCounts.get(pk) ?? 0) > 0 ? "force_reimport_period" : "new_bulletin",
      },
    };
  });
}
