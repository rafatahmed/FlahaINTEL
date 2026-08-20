/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Jobs Outcome Copy Tests
 * Introduction: Locks Tika-only extractor wording for the Jobs detail panel.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-19
 * Last modified: 2026-08-20
 */
import { describe, expect, it } from "vitest";
import { explainExtractorError, jobOutcomeSummary, jobStateLabel, providerLabel } from "./jobsOutcome";

describe("jobOutcomeSummary", () => {
  it("names Tika and keeps the last error when extraction fails", () => {
    const summary = jobOutcomeSummary({
      state: "DEAD_LETTER",
      selectedProviderId: "document.apache-tika",
      attemptCount: 1,
      maxAttempts: 3,
      attempts: [
        {
          state: "FAILED",
          providerId: "document.apache-tika",
          errorDetails: { message: "TIKA_PARSE_FAILURE" },
        },
      ],
    });
    expect(summary.severity).toBe("error");
    expect(summary.title).toBe("Tika failed");
    expect(summary.body).toContain("could not extract this file");
    expect(summary.body).toContain("will not retry");
    expect(summary.body).not.toContain("TIKA_PARSE_FAILURE");
  });

  it("maps raw runtime errors to operator language", () => {
    expect(explainExtractorError("TIKA_JAVA_MISSING missing=/usr/bin/java")).toContain("could not find Java");
    expect(explainExtractorError("TIKA_RUNTIME_MISSING missing=/opt/tika.jar")).toContain("jar or allowlist");
    expect(explainExtractorError("TIKA_PARSE_FAILURE exit=1 jar=/opt/tika.jar")).toContain("could not extract this file");
    expect(explainExtractorError("Worker has no adapter for document.docling-slim.")).toContain("cannot run the selected extractor");
    expect(jobStateLabel("DEAD_LETTER")).toBe("Stopped");
  });

  it("labels Tika as the document extractor", () => {
    expect(providerLabel("document.apache-tika")).toContain("Tika");
    expect(providerLabel("document.docling-slim")).toContain("retired");
  });
});
