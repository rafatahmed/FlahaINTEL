/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Artifact Hygiene CLI
 * Introduction: Reconcile ArtifactStore staging vs registry; report orphans (G10).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 *
 * Usage:
 *   npm run ops:artifact-hygiene
 *   npm run ops:artifact-hygiene -- --json
 */
import {
  FilesystemArtifactRepository,
  FilesystemArtifactStore,
} from "@flaha-intel/artifact-store";
import { getProductionConfig } from "../production/config.js";

const json = process.argv.includes("--json");

async function main() {
  const prod = getProductionConfig();
  const root = prod.artifactRoot;
  const repository = new FilesystemArtifactRepository(root);
  const store = new FilesystemArtifactStore(root, repository);
  await store.initialize();
  const report = await store.reconcile();

  const summary = {
    gate: "G10",
    artifactRoot: root,
    orphanedStagingKeys: report.orphanedStagingKeys.length,
    missingRegisteredKeys: report.missingRegisteredKeys.length,
    unregisteredPromotedKeys: report.unregisteredPromotedKeys.length,
    checksumMismatches: report.checksumMismatches.length,
    samples: {
      orphanedStagingKeys: report.orphanedStagingKeys.slice(0, 20),
      missingRegisteredKeys: report.missingRegisteredKeys.slice(0, 20),
      unregisteredPromotedKeys: report.unregisteredPromotedKeys.slice(0, 20),
      checksumMismatches: report.checksumMismatches.slice(0, 10),
    },
    note:
      "Hygiene is report-only. Delete orphans only after operator review. Markets/RSS work without orphan previews.",
  };

  if (json) {
    console.log(JSON.stringify({ ...summary, full: report }, null, 2));
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
