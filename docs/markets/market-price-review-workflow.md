<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Market Price Auto-Approve vs Human Review Workflow
Introduction:
Documents how market price rows are auto-approved by channel policy or held for human review.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-30
-->

# Market price review workflow

## Principle

**Humans remain in charge.** Auto-approve is a **channel policy**, not silent unlimited publication.

- Default for every channel: `HUMAN_REQUIRED`
- Trusted official bulletins may use `AUTO_APPROVE_OFFICIAL`
- Admins can flip policy anytime (`PATCH /api/markets/channels/:code/review-mode`)
- Auto decisions are audited (`reviewDecisionSource = CHANNEL_POLICY`)
- Humans can still approve, reject, or batch-review any row

## Channel policy (`MarketChannel.reviewMode`)

| Mode | Harvest behavior |
|------|------------------|
| `HUMAN_REQUIRED` | Rows → `PENDING_REVIEW` / `reviewDecisionSource=NONE` |
| `AUTO_APPROVE_OFFICIAL` | If eligible → `APPROVED` / `CHANNEL_POLICY`; else fall back to pending |

### Eligibility for auto-approve (all required)

1. `reviewMode = AUTO_APPROVE_OFFICIAL`
2. `verificationStatus = ACCEPTED`
3. `ownershipVerified = true`
4. `enabled = true`

If any gate fails, harvest leaves the row pending even when mode is auto.

## Row audit fields (`MarketPriceObservation`)

| Field | Meaning |
|-------|---------|
| `reviewState` | `PENDING_REVIEW` \| `APPROVED` \| `REJECTED` |
| `reviewDecisionSource` | `NONE` (pending) \| `HUMAN` \| `CHANNEL_POLICY` |
| `reviewedById` / `reviewedAt` | Set for human decisions; auto sets `reviewedAt` only |
| `reviewNote` | Human note, or policy string for auto |

## Re-harvest rules (same commodity/day key)

| Prior state | Same fingerprint | Content changed |
|-------------|------------------|-----------------|
| Human `REJECTED` | Keep rejection | Re-apply policy |
| Human `APPROVED` | Keep approval | Re-apply policy |
| Policy `APPROVED` | Keep approval | Re-apply policy |
| `PENDING_REVIEW` | Re-apply policy (mode may have changed) | Re-apply policy |

## API

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| `GET` | `/api/markets/prices?reviewState=PENDING_REVIEW` | inspect | Review queue |
| `GET` | `/api/markets/prices/review-summary` | inspect | Pending / auto / human counts |
| `POST` | `/api/markets/prices/:id/review` | governance_review | Single approve/reject |
| `POST` | `/api/markets/prices/review/batch` | governance_review | Batch (max 200) |
| `PATCH` | `/api/markets/channels/:code/review-mode` | governance_admin | Set policy |

### Batch body

```json
{
  "priceIds": ["uuid-1", "uuid-2"],
  "reviewState": "APPROVED",
  "note": "Spot-checked MoCI 2026-07-30"
}
```

### Review-mode body

```json
{ "reviewMode": "HUMAN_REQUIRED" }
```

## First-wave registry default

Accepted, ownership-verified QA/JO channels in `market-channel-registry.json` are seeded with `AUTO_APPROVE_OFFICIAL`. Schema/DB default for any new channel remains `HUMAN_REQUIRED`.

## What this is not

- Not AI auto-approve of scientific knowledge packs
- Not a bypass of source ownership / ACCEPTED verification
- Not irreversible: admin can force human mode; human can reject auto rows

## Related

- Schema: `MarketChannel.reviewMode`, `MarketPriceReviewDecisionSource`
- Policy code: `apps/api/src/market/reviewPolicy.ts`
- Service: `recordPriceBatch`, `reviewPrice`, `reviewPriceBatch`, `setChannelReviewMode`
