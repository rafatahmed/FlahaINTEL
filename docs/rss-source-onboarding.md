# Authoritative RSS source onboarding

Phase 1.2 reviews RSS candidates in three small batches: institutional core, agriculture and data, and media. The machine-readable [source registry](rss-source-registry.json) is the source of truth for individual feed URLs, publisher evidence, test results, content samples, database source IDs, and limitations.

## Acceptance method

A candidate is accepted only when all of the following are true:

1. A publisher-operated page identifies the exact feed endpoint.
2. Ownership is recorded independently from runtime status.
3. The existing hardened transport accepts the URL and any redirects, enforces its request bounds, and returns parseable RSS or Atom content.
4. At least three entries are manually reviewed for relevant and suitable content.
5. The first operational collection succeeds.
6. An immediate second collection succeeds and adds no duplicate articles.

Preflight uses the existing hardened transport and `rss-parser` without Prisma or API writes. Response timings are observations from one local test session, not performance guarantees. Rejected and degraded audit entries remain in the registry.

## Accepted sources

- FAO Global Newsroom
- UN News Global
- ReliefWeb Updates
- USDA News Releases
- European Commission Agriculture News
- Al Jazeera English
- BBC News

Six sources were added to PostgreSQL. The existing BBC source was reused. Across the acceptance runs, 140 articles were added and 14 successful collection runs were created. Every accepted source added zero articles on its second run.

## Degraded candidates

- USDA NASS News and Events is safe and parseable, but its newest feed entry is materially older than the publisher's current newsroom.
- USDA NASS Today's Reports is safe and parseable, but contained only one undated item, preventing the required three-entry review.
- NASA Earth Observatory Image of the Day was rejected by the hardened destination classifier before retrieval.
- NASA Earth Observatory Natural Events was rejected by the hardened destination classifier before retrieval.

The NASA Earth Observatory failures appear consistent with a public-address classification false positive on the publisher's current hosting path. No application code was changed during this registry phase, so the feeds remain degraded rather than accepted.

## Rejected candidates

- FAO Near East and North Africa News did not expose an exact RSS endpoint on its official regional newsroom. No guessed path was tested.
- WHO Eastern Mediterranean News advertised an official endpoint, but repeated hardened preflights returned an HTML error page instead of parseable RSS or Atom.
- NASA JPL News continues to return publisher-side HTTP 403. Its existing source and failed operational records were retained unchanged.

NASA JPL should be disabled to avoid repeated scheduled failures, but changing its current enabled state requires explicit approval.

## Safety findings

- All accepted feeds used publisher-operated endpoints and passed the hardened public-destination checks.
- Redirects were followed only through the existing redirect revalidation path.
- No rejected or degraded candidate was inserted for testing.
- Publisher-side HTTP failures and malformed responses were treated as source outcomes, not collector defects.
- Preflight did not create source, article, or collection-run records.

## Coverage gaps

- No dedicated FAO Near East and North Africa feed is accepted.
- No working WHO Eastern Mediterranean feed is accepted.
- USDA NASS statistical coverage remains degraded because its available feeds did not meet freshness or sample-review requirements.
- NASA Earth observation remains absent pending review of the destination-classification false positive.
- Accepted feeds are predominantly English. ReliefWeb is multilingual, but no dedicated Arabic feed has been accepted.
- Regional institutional coverage is weaker for the Near East and North Africa than for global, United States, and European Union sources.

## Database impact

No Prisma schema or migration change was required. Phase 1.2 added only accepted operational sources, their articles, and their two acceptance collection runs. Existing failed records were not deleted or reset.

