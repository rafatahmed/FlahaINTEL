/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Knowledge Packs Page
 * Introduction:
 * Systematic product-lane hub: FlahaSOIL | FlahaCALC (irrigation/weather) |
 * FlahaFAST (nutrients) | Markets — never merge CALC with FAST.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-31
 *
 * Fix: Research tab must not call packsForLane("research") (undefined lane → white page).
 */
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { BrandedState } from "../components/BrandedState";
import {
  laneById,
  primaryProductForTheme,
  productChipColor,
  PRODUCT_LANES,
  type ProductLaneId,
} from "../knowledge/productLanes";

type PackItem = {
  id: string;
  sequence: number;
  title: string;
  extractKind: string;
  bodyText?: string | null;
  structured?: Record<string, unknown>;
  sourceUrl?: string | null;
  evidenceArtifactId?: string | null;
  governanceCandidateId?: string | null;
};

type Pack = {
  id: string;
  code: string;
  theme: string;
  title: string;
  summary?: string | null;
  cropTags?: string[];
  regionTags?: string[];
  climateTags?: string[];
  reviewState?: string;
  version?: number;
  items?: PackItem[];
};

type HubTab = "overview" | ProductLaneId | "research";

const NEXT_ACTIONS: Record<string, Array<{ state: string; label: string }>> = {
  DRAFT: [
    { state: "READY_FOR_REVIEW", label: "Submit for review" },
    { state: "ARCHIVED", label: "Archive" },
  ],
  READY_FOR_REVIEW: [
    { state: "APPROVED", label: "Approve (human)" },
    { state: "REJECTED", label: "Reject" },
    { state: "DRAFT", label: "Back to draft" },
  ],
  APPROVED: [
    { state: "READY_FOR_REVIEW", label: "Re-open review" },
    { state: "ARCHIVED", label: "Archive" },
  ],
  REJECTED: [
    { state: "DRAFT", label: "Revise (draft)" },
    { state: "READY_FOR_REVIEW", label: "Re-submit" },
  ],
  ARCHIVED: [{ state: "DRAFT", label: "Restore draft" }],
};

const CASE_NEXT: Record<string, Array<{ status: string; label: string }>> = {
  DRAFT: [{ status: "READY_FOR_REVIEW", label: "Submit case" }],
  READY_FOR_REVIEW: [
    { status: "APPROVED", label: "Approve case" },
    { status: "REJECTED", label: "Reject" },
  ],
  APPROVED: [
    { status: "PRODUCT_TICKET_OPEN", label: "Open product ticket" },
    { status: "CLOSED", label: "Close" },
  ],
  PRODUCT_TICKET_OPEN: [{ status: "CLOSED", label: "Close" }],
  REJECTED: [{ status: "DRAFT", label: "Back to draft" }],
};

function reviewChipColor(state?: string): "default" | "success" | "error" | "warning" {
  if (state === "APPROVED") return "success";
  if (state === "REJECTED") return "error";
  if (state === "READY_FOR_REVIEW") return "warning";
  return "default";
}

function packsForLane(packs: Pack[], laneId: ProductLaneId): Pack[] {
  const def = laneById(laneId);
  if (!def) return [];
  return packs.filter((p) => def.themes.includes(p.theme));
}

function countByReview(packs: Pack[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of packs) {
    const s = p.reviewState || "DRAFT";
    out[s] = (out[s] || 0) + 1;
  }
  return out;
}

function extractProductHints(item: PackItem): string[] {
  const s = item.structured ?? {};
  const tags = new Set<string>();
  const handoff = s.productHandoff;
  if (Array.isArray(handoff)) {
    for (const p of handoff) if (typeof p === "string" && p.trim()) tags.add(p.trim());
  }
  if (typeof s.product === "string" && s.product.trim()) tags.add(s.product.trim());
  if (s.doesNotAutoUpdateFlahaCALC === true) tags.add("FlahaCALC");
  if (s.doesNotAutoUpdateFlahaFAST === true) tags.add("FlahaFAST");
  if (s.doesNotAutoUpdateFlahaSOIL === true) tags.add("FlahaSOIL");
  return [...tags];
}

export function KnowledgePacksPage(props?: {
  initialLane?: HubTab;
  initialSoilTool?: "packs" | "bank" | "cases" | "import";
}) {
  const [lane, setLane] = useState<HubTab>(props?.initialLane ?? "overview");
  const [soilTool, setSoilTool] = useState<"packs" | "bank" | "cases" | "import">(
    props?.initialSoilTool ?? "packs",
  );

  useEffect(() => {
    if (props?.initialLane) setLane(props.initialLane);
    if (props?.initialSoilTool) setSoilTool(props.initialSoilTool);
  }, [props?.initialLane, props?.initialSoilTool]);
  const [extractKind, setExtractKind] = useState<string>("");
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [bankLevel, setBankLevel] = useState<string>("");
  const [bankCuration, setBankCuration] = useState(true);
  const [bank, setBank] = useState<{
    count: number;
    live: boolean;
    onlyApproved: boolean;
    note?: string;
    entries: Array<Record<string, unknown>>;
  } | null>(null);
  const [cases, setCases] = useState<Array<Record<string, unknown>>>([]);
  const [caseBusy, setCaseBusy] = useState(false);
  const [bridge, setBridge] = useState<{ soilApi: { configured: boolean; note: string } } | null>(
    null,
  );
  const [soilTestId, setSoilTestId] = useState("");

  // 4R-A research index
  const [researchTopics, setResearchTopics] = useState<Array<Record<string, unknown>>>([]);
  const [researchTotal, setResearchTotal] = useState(0);
  const [researchFacets, setResearchFacets] = useState<{
    themes: Array<{ value: string; label: string; count: number }>;
    productLanes: Array<{ value: string; label: string; count: number }>;
    crops: Array<{ value: string; label: string; count: number }>;
    regions: Array<{ value: string; label: string; count: number }>;
    parameters: Array<{ value: string; label: string; count: number }>;
    extractKinds: Array<{ value: string; label: string; count: number }>;
    topicCount: number;
    entryCount: number;
  } | null>(null);
  const [researchTheme, setResearchTheme] = useState("");
  const [researchCrop, setResearchCrop] = useState("");
  const [researchRegion, setResearchRegion] = useState("");
  const [researchKind, setResearchKind] = useState("");
  const [researchQ, setResearchQ] = useState("");
  const [researchSelectedId, setResearchSelectedId] = useState("");
  const [researchDetail, setResearchDetail] = useState<Record<string, unknown> | null>(null);
  const [researchBusy, setResearchBusy] = useState(false);
  /** Research desk: literature (4R-L) | collections (4R-B) | topics (4R-A) */
  const [researchView, setResearchView] = useState<"topics" | "literature" | "collections">(
    "literature",
  );
  const [litSources, setLitSources] = useState<Array<Record<string, unknown>>>([]);
  const [litTotal, setLitTotal] = useState(0);
  const [litFacets, setLitFacets] = useState<{
    sourceCount: number;
    domains: Array<{ value: string; label: string; count: number }>;
    keywords: Array<{ value: string; label: string; count: number }>;
    trustTiers: Array<{ value: string; label: string; count: number }>;
  } | null>(null);
  const [litDomain, setLitDomain] = useState("");
  const [litQ, setLitQ] = useState("");
  const [litIncludeCatalog, setLitIncludeCatalog] = useState(true);
  const [litSelectedId, setLitSelectedId] = useState("");
  const [litDetail, setLitDetail] = useState<Record<string, unknown> | null>(null);
  const [collections, setCollections] = useState<Array<Record<string, unknown>>>([]);
  const [colSelectedId, setColSelectedId] = useState("");
  const [colDetail, setColDetail] = useState<Record<string, unknown> | null>(null);
  const [colBiblio, setColBiblio] = useState<string>("");
  const [colNewCode, setColNewCode] = useState("");
  const [colNewTitle, setColNewTitle] = useState("");
  const [colAddTargetId, setColAddTargetId] = useState("");
  const [crossrefDoi, setCrossrefDoi] = useState("");
  const [crossrefPreview, setCrossrefPreview] = useState<{
    citationApa: string;
    citationInText: string;
    citationComplete: boolean;
    draft: Record<string, unknown>;
  } | null>(null);
  const [crossrefSearchQ, setCrossrefSearchQ] = useState("");
  const [crossrefHits, setCrossrefHits] = useState<Array<Record<string, unknown>>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.knowledgePacks({
        extractKind: extractKind || undefined,
      });
      setPacks((res.packs || []) as Pack[]);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load knowledge packs.");
    } finally {
      setLoading(false);
    }
  }, [extractKind]);

  const loadBank = useCallback(async () => {
    try {
      const b = await api.knowledgeThresholdBank({
        soilTestLevel: bankLevel || undefined,
        onlyApproved: !bankCuration,
      });
      setBank(b);
    } catch {
      setBank(null);
    }
  }, [bankLevel, bankCuration]);

  const loadCases = useCallback(async () => {
    try {
      const res = await api.flahaSoilComparisons();
      setCases(res.cases || []);
    } catch {
      setCases([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (lane === "soil" && (soilTool === "bank" || soilTool === "packs")) void loadBank();
  }, [lane, soilTool, loadBank]);

  useEffect(() => {
    if (lane === "soil" && (soilTool === "cases" || soilTool === "import")) void loadCases();
  }, [lane, soilTool, loadCases]);

  const loadResearch = useCallback(async () => {
    try {
      const [topicsRes, facetsRes] = await Promise.all([
        api.researchTopics({
          theme: researchTheme || undefined,
          crop: researchCrop || undefined,
          region: researchRegion || undefined,
          extractKind: researchKind || undefined,
          q: researchQ || undefined,
          limit: 100,
        }),
        api.researchFacets(),
      ]);
      setResearchTopics(topicsRes.topics || []);
      setResearchTotal(topicsRes.total || 0);
      setResearchFacets(facetsRes);
    } catch {
      setResearchTopics([]);
      setResearchTotal(0);
      setResearchFacets(null);
    }
  }, [researchTheme, researchCrop, researchRegion, researchKind, researchQ]);

  const loadLiterature = useCallback(async () => {
    try {
      const [listRes, facetsRes] = await Promise.all([
        api.researchLiterature({
          domain: litDomain || undefined,
          q: litQ || undefined,
          includeCatalog: litIncludeCatalog,
          limit: 100,
        }),
        api.researchLiteratureFacets(litIncludeCatalog),
      ]);
      setLitSources(listRes.sources || []);
      setLitTotal(listRes.total || 0);
      setLitFacets(facetsRes);
    } catch {
      setLitSources([]);
      setLitTotal(0);
      setLitFacets(null);
    }
  }, [litDomain, litQ, litIncludeCatalog]);

  const loadCollections = useCallback(async () => {
    try {
      const res = await api.researchCollections();
      setCollections(res.collections || []);
    } catch {
      setCollections([]);
    }
  }, []);

  useEffect(() => {
    if (lane !== "research") return;
    // Keep collection list available for “Add to collection” on Literature detail.
    void loadCollections();
    if (researchView === "topics") void loadResearch();
    else if (researchView === "literature") void loadLiterature();
  }, [lane, researchView, loadResearch, loadLiterature, loadCollections]);

  useEffect(() => {
    if (!colSelectedId) {
      setColDetail(null);
      setColBiblio("");
      return;
    }
    void api
      .researchCollection(colSelectedId)
      .then((r) => setColDetail(r.collection))
      .catch(() => setColDetail(null));
    void api
      .researchCollectionBibliography(colSelectedId)
      .then((b) => setColBiblio(b.text || (b.references || []).join("\n\n")))
      .catch(() => setColBiblio(""));
  }, [colSelectedId]);

  useEffect(() => {
    if (!researchSelectedId) {
      setResearchDetail(null);
      return;
    }
    void api
      .researchTopic(researchSelectedId)
      .then((r) => setResearchDetail(r.topic))
      .catch(() => setResearchDetail(null));
  }, [researchSelectedId]);

  useEffect(() => {
    if (!litSelectedId) {
      setLitDetail(null);
      return;
    }
    void api
      .researchLiteratureOne(litSelectedId)
      .then((r) => setLitDetail(r.source))
      .catch(() => setLitDetail(null));
  }, [litSelectedId]);

  async function rebuildResearchIndex() {
    setResearchBusy(true);
    setInfo("");
    try {
      const res = await api.researchRebuild({ note: "ui rebuild" });
      setInfo(
        `Research index rebuilt: ${res.topicCount} topics · ${res.entryCount} entries · ${res.packCount} pack(s) · ${res.literatureCount ?? 0} literature.`,
      );
      await loadResearch();
      await loadLiterature();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research rebuild failed.");
    } finally {
      setResearchBusy(false);
    }
  }

  async function reviewLiterature(id: string, reviewState: string) {
    setResearchBusy(true);
    setInfo("");
    try {
      await api.researchLiteratureReview(id, { reviewState, note: "ui review" });
      setInfo(`Literature source → ${reviewState}`);
      await loadLiterature();
      if (litSelectedId === id) {
        const r = await api.researchLiteratureOne(id);
        setLitDetail(r.source);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Literature review failed.");
    } finally {
      setResearchBusy(false);
    }
  }

  async function createCollection() {
    if (!colNewCode.trim() || !colNewTitle.trim()) {
      setError("Collection code and title are required.");
      return;
    }
    setResearchBusy(true);
    setInfo("");
    try {
      const res = await api.researchCollectionCreate({
        code: colNewCode.trim(),
        title: colNewTitle.trim(),
      });
      setInfo(`Collection created: ${String(res.collection.code)}`);
      setColNewCode("");
      setColNewTitle("");
      await loadCollections();
      setColSelectedId(String(res.collection.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create collection failed.");
    } finally {
      setResearchBusy(false);
    }
  }

  async function addLitToCollection(literatureSourceId: string, collectionId: string) {
    if (!collectionId) {
      setError("Select a target collection first.");
      return;
    }
    setResearchBusy(true);
    try {
      await api.researchCollectionAddMember(collectionId, { literatureSourceId });
      setInfo("Added literature to collection.");
      if (colSelectedId === collectionId) {
        const r = await api.researchCollection(collectionId);
        setColDetail(r.collection);
        const b = await api.researchCollectionBibliography(collectionId);
        setColBiblio(b.text || "");
      }
      await loadCollections();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add to collection failed.");
    } finally {
      setResearchBusy(false);
    }
  }

  async function attachClaimFromLit(literatureSourceId: string) {
    setResearchBusy(true);
    setInfo("");
    try {
      const res = await api.researchLiteratureAttachClaim(literatureSourceId, {});
      setInfo(
        `Draft claim item on pack ${res.packCode} (${res.packReviewState}). Human-edit then approve pack — not product write.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Attach claim failed.");
    } finally {
      setResearchBusy(false);
    }
  }

  async function removeCollectionMember(collectionId: string, memberId: string) {
    setResearchBusy(true);
    try {
      await api.researchCollectionRemoveMember(collectionId, memberId);
      const r = await api.researchCollection(collectionId);
      setColDetail(r.collection);
      const b = await api.researchCollectionBibliography(collectionId);
      setColBiblio(b.text || "");
      await loadCollections();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove member failed.");
    } finally {
      setResearchBusy(false);
    }
  }

  async function lookupCrossrefDoi() {
    if (!crossrefDoi.trim()) {
      setError("Enter a DOI to look up on Crossref.");
      return;
    }
    setResearchBusy(true);
    setInfo("");
    setCrossrefPreview(null);
    try {
      const res = await api.researchCrossrefLookup(crossrefDoi.trim());
      setCrossrefPreview({
        citationApa: res.citationApa,
        citationInText: res.citationInText,
        citationComplete: res.citationComplete,
        draft: res.draft,
      });
      setInfo(`Crossref: ${String(res.draft.title || "").slice(0, 80)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crossref lookup failed.");
    } finally {
      setResearchBusy(false);
    }
  }

  async function registerFromCrossref(approve: boolean) {
    const doi = String(crossrefPreview?.draft?.doi || crossrefDoi).trim();
    if (!doi) {
      setError("Look up a DOI first.");
      return;
    }
    setResearchBusy(true);
    setInfo("");
    try {
      const res = await api.researchCrossrefRegister({
        doi,
        approve,
        domainTags: litDomain ? [litDomain] : undefined,
      });
      setInfo(
        `${res.created ? "Registered" : "Updated"} literature ${String(res.source.code)} · ${String(res.source.reviewState)} (Crossref).`,
      );
      setLitIncludeCatalog(true);
      await loadLiterature();
      setLitSelectedId(String(res.source.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crossref register failed.");
    } finally {
      setResearchBusy(false);
    }
  }

  async function searchCrossref() {
    if (!crossrefSearchQ.trim()) {
      setError("Enter a Crossref search query.");
      return;
    }
    setResearchBusy(true);
    try {
      const res = await api.researchCrossrefSearch(crossrefSearchQ.trim(), 8);
      setCrossrefHits(res.items || []);
      setInfo(`Crossref search: ${res.total} hits (showing ${res.items?.length || 0}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crossref search failed.");
    } finally {
      setResearchBusy(false);
    }
  }

  useEffect(() => {
    void api
      .flahaSoilBridgeStatus()
      .then(setBridge)
      .catch(() => setBridge(null));
  }, []);

  const soilPacks = useMemo(() => packsForLane(packs, "soil"), [packs]);
  const calcPacks = useMemo(() => packsForLane(packs, "calc"), [packs]);
  const fastPacks = useMemo(() => packsForLane(packs, "fast"), [packs]);
  const marketPacks = useMemo(() => packsForLane(packs, "markets"), [packs]);

  const lanePacks = useMemo(() => {
    // Research is not a product lane — never call packsForLane("research") (white-page crash).
    if (lane === "overview" || lane === "research") return packs;
    return packsForLane(packs, lane);
  }, [packs, lane]);

  useEffect(() => {
    if (lane === "overview" || lane === "research") return;
    setSelectedId((prev) => {
      if (lanePacks.some((p) => p.id === prev)) return prev;
      return lanePacks[0]?.id || "";
    });
  }, [lane, lanePacks]);

  const selected =
    lanePacks.find((p) => p.id === selectedId) ?? packs.find((p) => p.id === selectedId);
  const activeLane = lane === "overview" || lane === "research" ? null : laneById(lane);

  async function review(to: string) {
    if (!selected) return;
    setBusy(true);
    setInfo("");
    try {
      const res = await api.reviewKnowledgePack(selected.id, {
        reviewState: to,
        note: note.trim() || undefined,
      });
      const product = primaryProductForTheme(selected.theme);
      setInfo(
        `Review → ${to} · primary product ${product} · engines not updated. Auto-approve: ${String(res.governance?.autoApprove)}`,
      );
      setNote("");
      await load();
      if (lane === "soil") await loadBank();
      setSelectedId(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }

  /** 4I-B: download read-only product handoff envelope (APPROVED only). */
  async function exportHandoff() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const target =
        selected.theme === "IRRIGATION"
          ? "FlahaCALC"
          : selected.theme === "NUTRITION"
            ? "FlahaFAST"
            : selected.theme === "SOIL"
              ? "FlahaSOIL"
              : undefined;
      const res = await api.knowledgePackHandoff(selected.id, target ? { targetProduct: target } : {});
      const env = res.envelope;
      const blob = new Blob([`${JSON.stringify(env, null, 2)}\n`], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `handoff-${String(target || "product")}-${selected.code || selected.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setInfo(
        `Handoff exported · ${String(target)} · exportId ${res.exportId.slice(0, 8)}… · sha ${res.sha256.slice(0, 12)}… · autoApplyBlocked=${String((env as { autoApplyBlocked?: boolean }).autoApplyBlocked)}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Handoff export failed.");
    } finally {
      setBusy(false);
    }
  }

  async function importReport(file: File) {
    setCaseBusy(true);
    setInfo("");
    try {
      const res = await api.importFlahaSoilReport(file);
      setInfo(
        `FlahaSOIL only: imported ${file.name}: ${res.casesCreated} case(s). FlahaCALC/FAST not touched.`,
      );
      await loadCases();
      setSoilTool("cases");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report import failed.");
    } finally {
      setCaseBusy(false);
    }
  }

  async function importFromSoilApi() {
    if (!soilTestId.trim()) return;
    setCaseBusy(true);
    setInfo("");
    try {
      const res = (await api.importFlahaSoilFromApi(soilTestId.trim())) as {
        casesCreated?: number;
        parsed?: { reportNumber?: string };
      };
      setInfo(`FlahaSOIL API import: ${res.casesCreated ?? 0} case(s). Report ${res.parsed?.reportNumber || "—"}.`);
      await loadCases();
      setSoilTool("cases");
    } catch (e) {
      setError(e instanceof Error ? e.message : "SOIL API import failed.");
    } finally {
      setCaseBusy(false);
    }
  }

  async function openCaseFromBank(packItemId: string, parameter: string) {
    setCaseBusy(true);
    setInfo("");
    try {
      const demo: Record<string, number> = {
        ecDsM: 1.0,
        pH: 7.2,
        sar: 0.15,
        organicMatterPercent: 2.5,
      };
      await api.createFlahaSoilComparisonFromThreshold({
        packItemId,
        flahaSoilValue: demo[parameter] ?? null,
        flahaSoilObservation: `Opened from threshold bank for ${parameter}.`,
        flahaSoilReportNumber: "FLH-2026-001",
        flahaSoilTestLevel: "ADVANCED",
        recommendedHumanAction: "review-in-PA",
      });
      setInfo(`FlahaSOIL comparison case opened for ${parameter} (DRAFT).`);
      await loadCases();
      setSoilTool("cases");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open comparison case.");
    } finally {
      setCaseBusy(false);
    }
  }

  async function transitionCase(id: string, status: string) {
    setCaseBusy(true);
    try {
      const body: { status: string; note?: string; productTicketRef?: string } = {
        status,
        note: note.trim() || undefined,
      };
      if (status === "PRODUCT_TICKET_OPEN") {
        body.productTicketRef = note.trim() || `SOIL-TICKET-${id.slice(0, 8)}`;
      }
      await api.transitionFlahaSoilComparison(id, body);
      setInfo(`FlahaSOIL case → ${status}.`);
      await loadCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Case transition failed.");
    } finally {
      setCaseBusy(false);
    }
  }

  if (loading && !packs.length) {
    return <BrandedState label="Loading knowledge hub…" loading />;
  }

  const laneCounts: Record<ProductLaneId, number> = {
    soil: soilPacks.length,
    calc: calcPacks.length,
    fast: fastPacks.length,
    markets: marketPacks.length,
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Knowledge hub</Typography>
        <Typography variant="body2" color="text.secondary">
          Structured packs by <strong>sister product</strong>. Three engines stay separate:{" "}
          <strong>FlahaSOIL</strong> (soil) · <strong>FlahaCALC</strong> (irrigation & weather) ·{" "}
          <strong>FlahaFAST</strong> (nutrient management). Human review only — never auto-update product code.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {info && (
        <Alert severity="success" onClose={() => setInfo("")}>
          {info}
        </Alert>
      )}

      <Tabs
        value={lane}
        onChange={(_, v: HubTab) => setLane(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Tab value="overview" label={`Overview (${packs.length})`} />
        <Tab
          value="research"
          label={`Research (${researchFacets?.topicCount ?? researchTotal ?? "—"})`}
        />
        <Tab value="soil" label={`FlahaSOIL (${laneCounts.soil})`} />
        <Tab value="calc" label={`FlahaCALC (${laneCounts.calc})`} />
        <Tab value="fast" label={`FlahaFAST (${laneCounts.fast})`} />
        <Tab value="markets" label={`Markets (${laneCounts.markets})`} />
      </Tabs>

      {/* ═══════════════ RESEARCH DESK (4R-A topics + 4R-L literature) ═══════════════ */}
      {lane === "research" && (
        <Stack spacing={2}>
          <Alert severity="info">
            <strong>Research desk (Stage D):</strong> multi-domain library + finder.{" "}
            <strong>Literature</strong> = citable sources (APA 7th / ASA–CSSA–SSSA) — aboutness, not product writes.{" "}
            <strong>Topics</strong> = facet index over APPROVED packs + SOURCE_APPROVED literature. Not Markets
            prices, not FKP wiki.
          </Alert>

          <Tabs
            value={researchView}
            onChange={(_, v: "topics" | "literature" | "collections") => setResearchView(v)}
            sx={{ borderBottom: 1, borderColor: "divider", minHeight: 40 }}
          >
            <Tab value="literature" label={`Literature (${litFacets?.sourceCount ?? litTotal ?? "—"})`} />
            <Tab value="collections" label={`Collections (${collections.length})`} />
            <Tab value="topics" label={`Topics (${researchFacets?.topicCount ?? researchTotal ?? "—"})`} />
          </Tabs>

          {researchView === "literature" && (
            <Stack spacing={2}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Crossref DOI enricher (public API · polite mailto pool)
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
                    <TextField
                      size="small"
                      label="DOI"
                      placeholder="10.1002/saj2.XXXXX or https://doi.org/..."
                      value={crossrefDoi}
                      onChange={(e) => setCrossrefDoi(e.target.value)}
                      sx={{ minWidth: 280, flex: 1 }}
                    />
                    <Button
                      size="small"
                      variant="contained"
                      disabled={researchBusy}
                      onClick={() => void lookupCrossrefDoi()}
                    >
                      Lookup DOI
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={researchBusy || !crossrefPreview}
                      onClick={() => void registerFromCrossref(false)}
                    >
                      Register catalogued
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      disabled={researchBusy || !crossrefPreview}
                      onClick={() => void registerFromCrossref(true)}
                    >
                      Register + approve
                    </Button>
                  </Box>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mt: 1.5 }}>
                    <TextField
                      size="small"
                      label="Crossref search"
                      placeholder="soil moisture maize"
                      value={crossrefSearchQ}
                      onChange={(e) => setCrossrefSearchQ(e.target.value)}
                      sx={{ minWidth: 220, flex: 1 }}
                    />
                    <Button size="small" variant="outlined" disabled={researchBusy} onClick={() => void searchCrossref()}>
                      Search Crossref
                    </Button>
                  </Box>
                  {crossrefPreview && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        In-text: <code>{crossrefPreview.citationInText}</code> ·{" "}
                        {crossrefPreview.citationComplete ? "citation complete" : "incomplete"} · type{" "}
                        {String(crossrefPreview.draft.documentType || "")}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: "Georgia, serif", mt: 0.5, whiteSpace: "pre-wrap" }}
                      >
                        {crossrefPreview.citationApa}
                      </Typography>
                    </Box>
                  )}
                  {crossrefHits.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Search hits (click DOI to load):
                      </Typography>
                      <List dense>
                        {crossrefHits.map((h) => (
                          <ListItemButton
                            key={String(h.doi)}
                            onClick={() => {
                              setCrossrefDoi(String(h.doi || ""));
                              setCrossrefPreview({
                                citationApa: "",
                                citationInText: "",
                                citationComplete: Boolean(h.doi && h.year && h.title),
                                draft: h,
                              });
                              void (async () => {
                                setResearchBusy(true);
                                try {
                                  const res = await api.researchCrossrefLookup(String(h.doi));
                                  setCrossrefPreview({
                                    citationApa: res.citationApa,
                                    citationInText: res.citationInText,
                                    citationComplete: res.citationComplete,
                                    draft: res.draft,
                                  });
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : "Lookup failed.");
                                } finally {
                                  setResearchBusy(false);
                                }
                              })();
                            }}
                          >
                            <ListItemText
                              primary={String(h.title || "").slice(0, 100)}
                              secondary={`${String(h.year ?? "n.d.")} · ${String(h.doi || "")}`}
                            />
                          </ListItemButton>
                        ))}
                      </List>
                    </Box>
                  )}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Metadata from api.crossref.org — not full-text, not auto product write. Prefer real DOIs;
                    set <code>FLAHA_CROSSREF_MAILTO</code> for polite pool. Domain filter below applied on
                    register when set.
                  </Typography>
                </CardContent>
              </Card>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Domain</InputLabel>
                  <Select label="Domain" value={litDomain} onChange={(e) => setLitDomain(e.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    {(litFacets?.domains || []).map((t) => (
                      <MenuItem key={t.value} value={t.value}>
                        {t.label} ({t.count})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label="Search title / citation"
                  value={litQ}
                  onChange={(e) => setLitQ(e.target.value)}
                />
                <Button
                  size="small"
                  variant={litIncludeCatalog ? "contained" : "outlined"}
                  onClick={() => setLitIncludeCatalog((v) => !v)}
                >
                  {litIncludeCatalog ? "Include catalogued" : "Approved only"}
                </Button>
                <Button size="small" variant="outlined" onClick={() => void loadLiterature()}>
                  Apply
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={researchBusy}
                  onClick={() => void rebuildResearchIndex()}
                >
                  {researchBusy ? "Rebuilding…" : "Rebuild topic index"}
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Showing {litSources.length} of {litTotal}. Also:{" "}
                <code>npm run knowledge:crossref -- --doi=...</code> · Keywords = aboutness · APA 7th.
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 1fr) 1.3fr" },
                  alignItems: "start",
                }}
              >
                <Card variant="outlined">
                  <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                    <List dense disablePadding sx={{ maxHeight: 520, overflow: "auto" }}>
                      {litSources.length === 0 ? (
                        <Box sx={{ p: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            No literature yet. Run{" "}
                            <code>npm run knowledge:register-literature -- --approve</code> for multi-domain
                            samples, or POST /api/research/literature.
                          </Typography>
                        </Box>
                      ) : (
                        litSources.map((s) => (
                          <ListItemButton
                            key={String(s.id)}
                            selected={litSelectedId === String(s.id)}
                            onClick={() => setLitSelectedId(String(s.id))}
                            sx={{ borderBottom: 1, borderColor: "divider" }}
                          >
                            <ListItemText
                              primary={
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {String(s.title)}
                                </Typography>
                              }
                              secondary={`${String(s.year ?? "n.d.")} · ${String(s.reviewState)} · ${(s.domainTags as string[] | undefined)?.slice(0, 3).join(", ") || "—"}`}
                            />
                          </ListItemButton>
                        ))
                      )}
                    </List>
                  </CardContent>
                </Card>
                <Card variant="outlined">
                  <CardContent>
                    {!litDetail ? (
                      <Typography color="text.secondary" variant="body2">
                        Select a source for APA citation, keywords, and review actions.
                      </Typography>
                    ) : (
                      <Stack spacing={1.5}>
                        <Typography variant="h6">{String(litDetail.title)}</Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          <Chip size="small" color="primary" label={String(litDetail.reviewState)} />
                          <Chip size="small" label={String(litDetail.trustTier)} />
                          <Chip size="small" variant="outlined" label={String(litDetail.documentType)} />
                          <Chip size="small" variant="outlined" label={String(litDetail.primaryTheme)} />
                          {Boolean(litDetail.citationComplete) ? (
                            <Chip size="small" color="success" label="citation complete" />
                          ) : (
                            <Chip size="small" color="warning" label="citation incomplete" />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          In-text: <code>{String(litDetail.citationInText || "")}</code>
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: "Georgia, serif", lineHeight: 1.5 }}>
                          {String(litDetail.citationApa || "")}
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {((litDetail.domainTags as string[]) || []).map((d) => (
                            <Chip key={d} size="small" variant="outlined" label={`domain:${d}`} />
                          ))}
                          {((litDetail.keywords as string[]) || []).slice(0, 12).map((k) => (
                            <Chip key={k} size="small" label={k} />
                          ))}
                          {((litDetail.productLanes as string[]) || []).map((p) => (
                            <Chip key={p} size="small" color="secondary" label={p} />
                          ))}
                        </Box>
                        {Boolean(litDetail.localPathHint) && (
                          <Typography variant="caption" color="text.secondary">
                            Library path hint: <code>{String(litDetail.localPathHint)}</code>
                          </Typography>
                        )}
                        <Divider />
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
                          {String(litDetail.reviewState) === "CATALOGUED" && (
                            <Button
                              size="small"
                              variant="contained"
                              disabled={researchBusy}
                              onClick={() => void reviewLiterature(String(litDetail.id), "SOURCE_APPROVED")}
                            >
                              Approve source
                            </Button>
                          )}
                          {String(litDetail.reviewState) === "SOURCE_APPROVED" && (
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={researchBusy}
                              onClick={() => void reviewLiterature(String(litDetail.id), "CATALOGUED")}
                            >
                              Back to catalogued
                            </Button>
                          )}
                          {String(litDetail.reviewState) !== "REJECTED" &&
                            String(litDetail.reviewState) !== "ARCHIVED" && (
                              <Button
                                size="small"
                                color="error"
                                disabled={researchBusy}
                                onClick={() => void reviewLiterature(String(litDetail.id), "REJECTED")}
                              >
                                Reject
                              </Button>
                            )}
                          <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel>Add to collection</InputLabel>
                            <Select
                              label="Add to collection"
                              value={colAddTargetId}
                              onChange={(e) => setColAddTargetId(e.target.value)}
                            >
                              <MenuItem value="">—</MenuItem>
                              {collections.map((c) => (
                                <MenuItem key={String(c.id)} value={String(c.id)}>
                                  {String(c.title)}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={researchBusy || !colAddTargetId}
                            onClick={() => void addLitToCollection(String(litDetail.id), colAddTargetId)}
                          >
                            Add to collection
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={researchBusy}
                            onClick={() => void attachClaimFromLit(String(litDetail.id))}
                          >
                            Draft claim on pack
                          </Button>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          Approving a <strong>source</strong> does not create a scientific claim.{" "}
                          <strong>Draft claim</strong> creates a DRAFT pack item with APA evidence (4R-E) — still
                          human-approved, never product write.
                        </Typography>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </Stack>
          )}

          {researchView === "collections" && (
            <Stack spacing={2}>
              <Alert severity="success">
                <strong>Collections (4R-B):</strong> named dossiers for writing/reports. Add literature members →
                export <strong>APA 7th</strong> reference list (ASA/CSSA/SSSA desk default). Not product engines.
              </Alert>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
                <TextField
                  size="small"
                  label="New code"
                  value={colNewCode}
                  onChange={(e) => setColNewCode(e.target.value)}
                  placeholder="qa-tomato-moisture-2026"
                />
                <TextField
                  size="small"
                  label="New title"
                  value={colNewTitle}
                  onChange={(e) => setColNewTitle(e.target.value)}
                  sx={{ minWidth: 240 }}
                />
                <Button
                  size="small"
                  variant="contained"
                  disabled={researchBusy}
                  onClick={() => void createCollection()}
                >
                  Create collection
                </Button>
                <Button size="small" variant="outlined" onClick={() => void loadCollections()}>
                  Refresh
                </Button>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 1fr) 1.4fr" },
                  alignItems: "start",
                }}
              >
                <Card variant="outlined">
                  <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                    <List dense disablePadding sx={{ maxHeight: 520, overflow: "auto" }}>
                      {collections.length === 0 ? (
                        <Box sx={{ p: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            No collections yet. Create one, then add literature from the Literature tab.
                          </Typography>
                        </Box>
                      ) : (
                        collections.map((c) => (
                          <ListItemButton
                            key={String(c.id)}
                            selected={colSelectedId === String(c.id)}
                            onClick={() => setColSelectedId(String(c.id))}
                            sx={{ borderBottom: 1, borderColor: "divider" }}
                          >
                            <ListItemText
                              primary={
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {String(c.title)}
                                </Typography>
                              }
                              secondary={`${String(c.code)} · ${String(c.status)} · ${String(c.memberCount ?? 0)} members`}
                            />
                          </ListItemButton>
                        ))
                      )}
                    </List>
                  </CardContent>
                </Card>
                <Card variant="outlined">
                  <CardContent>
                    {!colDetail ? (
                      <Typography color="text.secondary" variant="body2">
                        Select a collection to manage members and copy APA bibliography.
                      </Typography>
                    ) : (
                      <Stack spacing={1.5}>
                        <Typography variant="h6">{String(colDetail.title)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          <code>{String(colDetail.code)}</code> · {String(colDetail.status)}
                        </Typography>
                        {Boolean(colDetail.summary) && (
                          <Typography variant="body2">{String(colDetail.summary)}</Typography>
                        )}
                        <Divider />
                        <Typography variant="subtitle2">Members</Typography>
                        {((colDetail.members as Array<Record<string, unknown>>) || []).length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            Empty — open Literature, select a source, choose this collection, Add to collection.
                          </Typography>
                        ) : (
                          ((colDetail.members as Array<Record<string, unknown>>) || []).map((m) => {
                            const lit = m.literature as Record<string, unknown> | null;
                            return (
                              <Card key={String(m.id)} variant="outlined">
                                <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {lit ? String(lit.title) : String(m.memberKind)}
                                  </Typography>
                                  {lit && (
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      {String(lit.year ?? "n.d.")} · {String(lit.reviewState)} ·{" "}
                                      {String(lit.code)}
                                    </Typography>
                                  )}
                                  <Button
                                    size="small"
                                    color="error"
                                    disabled={researchBusy}
                                    onClick={() =>
                                      void removeCollectionMember(String(colDetail.id), String(m.id))
                                    }
                                  >
                                    Remove
                                  </Button>
                                </CardContent>
                              </Card>
                            );
                          })
                        )}
                        <Divider />
                        <Typography variant="subtitle2">APA 7th bibliography</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Desk default ASA/CSSA/SSSA · APA 7th. Paste into manuscript as unnumbered hanging-indent
                          list.
                        </Typography>
                        <TextField
                          multiline
                          minRows={6}
                          fullWidth
                          value={colBiblio}
                          InputProps={{ readOnly: true }}
                          sx={{ fontFamily: "Georgia, serif", "& textarea": { fontSize: 13 } }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!colBiblio}
                          onClick={() => {
                            void navigator.clipboard?.writeText(colBiblio);
                            setInfo("Bibliography copied to clipboard.");
                          }}
                        >
                          Copy bibliography
                        </Button>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </Stack>
          )}

          {researchView === "topics" && (
            <Stack spacing={2}>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Theme</InputLabel>
                  <Select
                    label="Theme"
                    value={researchTheme}
                    onChange={(e) => setResearchTheme(e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    {(researchFacets?.themes || []).map((t) => (
                      <MenuItem key={t.value} value={t.value}>
                        {t.label} ({t.count})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Crop</InputLabel>
                  <Select label="Crop" value={researchCrop} onChange={(e) => setResearchCrop(e.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    {(researchFacets?.crops || []).map((t) => (
                      <MenuItem key={t.value} value={t.value}>
                        {t.label} ({t.count})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Region</InputLabel>
                  <Select
                    label="Region"
                    value={researchRegion}
                    onChange={(e) => setResearchRegion(e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    {(researchFacets?.regions || []).map((t) => (
                      <MenuItem key={t.value} value={t.value}>
                        {t.label} ({t.count})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Extract kind</InputLabel>
                  <Select
                    label="Extract kind"
                    value={researchKind}
                    onChange={(e) => setResearchKind(e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    {(researchFacets?.extractKinds || []).map((t) => (
                      <MenuItem key={t.value} value={t.value}>
                        {t.label} ({t.count})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label="Search title"
                  value={researchQ}
                  onChange={(e) => setResearchQ(e.target.value)}
                />
                <Button size="small" variant="outlined" onClick={() => void loadResearch()}>
                  Apply
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={researchBusy}
                  onClick={() => void rebuildResearchIndex()}
                >
                  {researchBusy ? "Rebuilding…" : "Rebuild index"}
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {researchFacets
                  ? `${researchFacets.topicCount} topics · ${researchFacets.entryCount} entries · showing ${researchTopics.length} of ${researchTotal}`
                  : "Index empty — approve packs/literature then Rebuild index."}
              </Typography>

              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 1fr) 1.2fr" },
                  alignItems: "start",
                }}
              >
                <Card variant="outlined">
                  <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                    <List dense disablePadding sx={{ maxHeight: 520, overflow: "auto" }}>
                      {researchTopics.length === 0 ? (
                        <Box sx={{ p: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            No topics. Approve packs and/or literature sources, then{" "}
                            <strong>Rebuild index</strong>.
                          </Typography>
                        </Box>
                      ) : (
                        researchTopics.map((t) => (
                          <ListItemButton
                            key={String(t.id)}
                            selected={researchSelectedId === String(t.id)}
                            onClick={() => setResearchSelectedId(String(t.id))}
                            sx={{ borderBottom: 1, borderColor: "divider" }}
                          >
                            <ListItemText
                              primary={
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {String(t.title)}
                                </Typography>
                              }
                              secondary={`${String(t.productLane)} · ${String(t.theme)} · ${String(t.entryCount)} entries`}
                            />
                          </ListItemButton>
                        ))
                      )}
                    </List>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent>
                    {!researchDetail ? (
                      <Typography color="text.secondary" variant="body2">
                        Select a topic to see linked pack items and literature references.
                      </Typography>
                    ) : (
                      <Stack spacing={1.5}>
                        <Typography variant="h6">{String(researchDetail.title)}</Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          <Chip size="small" color="primary" label={String(researchDetail.theme)} />
                          <Chip size="small" label={String(researchDetail.productLane)} />
                          {Boolean(researchDetail.cropLabel) && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`crop:${String(researchDetail.cropLabel)}`}
                            />
                          )}
                          {Boolean(researchDetail.regionLabel) && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`region:${String(researchDetail.regionLabel)}`}
                            />
                          )}
                          {Boolean(researchDetail.parameterKey) && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`param:${String(researchDetail.parameterKey)}`}
                            />
                          )}
                          {Boolean(researchDetail.extractKind) && (
                            <Chip size="small" variant="outlined" label={String(researchDetail.extractKind)} />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          topicKey: <code>{String(researchDetail.topicKey)}</code>
                        </Typography>
                        <Divider />
                        <Typography variant="subtitle2">Entries</Typography>
                        {((researchDetail.entries as Array<Record<string, unknown>>) || []).map((e) => (
                          <Card key={String(e.id)} variant="outlined">
                            <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {String(e.itemTitle)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                {String(e.entryKind || "PACK_ITEM")} · {String(e.packCode)} ·{" "}
                                {String(e.extractKind)} · {String(e.reviewState)}
                                {e.evidencePresent ? " · evidence" : ""}
                              </Typography>
                              {Boolean(e.snippet) && (
                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                  {String(e.snippet)}
                                </Typography>
                              )}
                              {String(e.entryKind) === "LITERATURE" ? (
                                <Button
                                  size="small"
                                  sx={{ mt: 0.5 }}
                                  onClick={() => {
                                    setResearchView("literature");
                                    setLitSelectedId(String(e.literatureSourceId || e.packId));
                                  }}
                                >
                                  Open literature
                                </Button>
                              ) : (
                                <Button
                                  size="small"
                                  sx={{ mt: 0.5 }}
                                  onClick={() => {
                                    const laneGuess = String(researchDetail.productLane || "");
                                    if (laneGuess.includes("SOIL")) setLane("soil");
                                    else if (laneGuess.includes("CALC")) setLane("calc");
                                    else if (laneGuess.includes("FAST")) setLane("fast");
                                    else if (laneGuess.includes("Market")) setLane("markets");
                                    setSelectedId(String(e.packId));
                                  }}
                                >
                                  Open pack
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </Stack>
          )}
        </Stack>
      )}

      {/* ═══════════════ OVERVIEW ═══════════════ */}
      {lane === "overview" && (
        <Stack spacing={2}>
          <Alert severity="info">
            <strong>Product matrix (locked):</strong> packs use theme → product. Irrigation packs never go to
            FlahaFAST; nutrient packs never go to FlahaCALC. Soil tools (bank, cases, import) only under FlahaSOIL.
          </Alert>

          <Box sx={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Product</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Theme</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Domain</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>In scope</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Out of scope</th>
                  <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Packs</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCT_LANES.map((meta) => (
                  <tr
                    key={meta.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setLane(meta.id)}
                  >
                    <td style={{ padding: 8, verticalAlign: "top" }}>
                      <Chip size="small" color={meta.color} label={meta.product} />
                    </td>
                    <td style={{ padding: 8, verticalAlign: "top" }}>
                      <code>{meta.themes.join(", ")}</code>
                    </td>
                    <td style={{ padding: 8, verticalAlign: "top" }}>{meta.domain}</td>
                    <td style={{ padding: 8, verticalAlign: "top", maxWidth: 220 }}>
                      {meta.inScope.slice(0, 3).map((x) => (
                        <Typography key={x} variant="caption" sx={{ display: "block" }}>
                          · {x}
                        </Typography>
                      ))}
                    </td>
                    <td style={{ padding: 8, verticalAlign: "top", maxWidth: 200 }}>
                      {meta.outOfScope.slice(0, 2).map((x) => (
                        <Typography key={x} variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          · {x}
                        </Typography>
                      ))}
                    </td>
                    <td style={{ padding: 8, verticalAlign: "top", textAlign: "right", fontWeight: 700 }}>
                      {laneCounts[meta.id]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr 1fr" },
            }}
          >
            {PRODUCT_LANES.map((meta) => {
              const list = packsForLane(packs, meta.id);
              const by = countByReview(list);
              return (
                <Card key={meta.id} variant="outlined" sx={{ height: "100%" }}>
                  <CardActionArea onClick={() => setLane(meta.id)} sx={{ height: "100%", alignItems: "stretch" }}>
                    <CardContent>
                      <Chip size="small" color={meta.color} label={meta.product} sx={{ mb: 1 }} />
                      <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                        {list.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                        theme <code>{meta.themes.join(", ")}</code>
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1, minHeight: 48 }}>
                        {meta.domain}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {Object.entries(by)
                          .map(([s, n]) => `${s}:${n}`)
                          .join(" · ") || "none yet"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        {meta.tools.join(" · ")}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
          </Box>

          {!packs.length && (
            <Alert severity="warning">
              No packs. Seed: <code>npm run knowledge:seed-samples</code>
            </Alert>
          )}
        </Stack>
      )}

      {/* ═══════════════ PRODUCT LANE ═══════════════ */}
      {lane !== "overview" && activeLane && (
        <Stack spacing={2}>
          <Card variant="outlined" sx={{ bgcolor: "action.hover" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 1 }}>
                <Chip color={activeLane.color} label={activeLane.product} />
                <Chip size="small" variant="outlined" label={`theme: ${activeLane.themes.join(", ")}`} />
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {activeLane.domain}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                }}
              >
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    In scope
                  </Typography>
                  {activeLane.inScope.map((x) => (
                    <Typography key={x} variant="caption" sx={{ display: "block" }}>
                      · {x}
                    </Typography>
                  ))}
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700 }} color="text.secondary">
                    Out of scope (other product)
                  </Typography>
                  {activeLane.outOfScope.map((x) => (
                    <Typography key={x} variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      · {x}
                    </Typography>
                  ))}
                </Box>
              </Box>
              {lane === "calc" && (
                <Alert severity="info" sx={{ mt: 1.5 }}>
                  <strong>FlahaCALC only</strong> — irrigation & weather. Nutrient recipes belong under{" "}
                  <Button size="small" onClick={() => setLane("fast")}>
                    FlahaFAST
                  </Button>
                  .
                </Alert>
              )}
              {lane === "fast" && (
                <Alert severity="info" sx={{ mt: 1.5 }}>
                  <strong>FlahaFAST only</strong> — nutrient management. ETo / Kc / irrigation depth belong under{" "}
                  <Button size="small" onClick={() => setLane("calc")}>
                    FlahaCALC
                  </Button>
                  .
                </Alert>
              )}
              {lane === "soil" && (
                <Alert severity="success" sx={{ mt: 1.5 }}>
                  <strong>FlahaSOIL only</strong> — soil lab & comparison tools below. Not irrigation scheduling or
                  nutrient recipes.
                </Alert>
              )}
            </CardContent>
          </Card>

          {lane === "soil" && (
            <Tabs value={soilTool} onChange={(_, v) => setSoilTool(v)} variant="scrollable" scrollButtons="auto">
              <Tab value="packs" label={`Packs (${soilPacks.length})`} />
              <Tab value="bank" label={`Threshold bank (${bank?.count ?? "…"})`} />
              <Tab value="cases" label={`Comparison cases (${cases.length})`} />
              <Tab value="import" label="Report import" />
            </Tabs>
          )}

          {(lane !== "soil" || soilTool === "packs") && (
            <>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Extract kind</InputLabel>
                  <Select
                    label="Extract kind"
                    value={extractKind}
                    onChange={(e) => setExtractKind(e.target.value)}
                  >
                    <MenuItem value="">All kinds</MenuItem>
                    <MenuItem value="THRESHOLD">THRESHOLD</MenuItem>
                    <MenuItem value="METHOD">METHOD</MenuItem>
                    <MenuItem value="EQUATION">EQUATION</MenuItem>
                    <MenuItem value="COMPARISON_NOTE">COMPARISON_NOTE</MenuItem>
                    <MenuItem value="NOTE">NOTE</MenuItem>
                    <MenuItem value="REFERENCE">REFERENCE</MenuItem>
                  </Select>
                </FormControl>
                <Button size="small" variant="outlined" onClick={() => void load()} disabled={loading}>
                  Refresh
                </Button>
              </Box>

              {!lanePacks.length ? (
                <Alert severity="warning">
                  No packs for <strong>{activeLane.product}</strong> (theme{" "}
                  <code>{activeLane.themes.join(", ")}</code>).
                  <Box component="span" sx={{ display: "block", mt: 0.5 }}>
                    Expected samples: {activeLane.sampleCodes.map((c) => (
                      <code key={c} style={{ marginRight: 8 }}>
                        {c}
                      </code>
                    ))}
                  </Box>
                  Run <code>npm run knowledge:seed-samples</code> in <code>apps/api</code>
                  {lane === "markets" && <> · or rebuild analyst packs on Markets</>}.
                </Alert>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 320px) 1fr" },
                    alignItems: "start",
                  }}
                >
                  <Card variant="outlined">
                    <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
                        <Typography variant="subtitle2">
                          {activeLane.product} packs ({lanePacks.length})
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Primary product only — not mixed with other engines
                        </Typography>
                      </Box>
                      <List dense disablePadding sx={{ maxHeight: 480, overflow: "auto" }}>
                        {lanePacks.map((p) => (
                          <ListItemButton
                            key={p.id}
                            selected={p.id === selectedId}
                            onClick={() => setSelectedId(p.id)}
                            alignItems="flex-start"
                            sx={{ borderBottom: 1, borderColor: "divider" }}
                          >
                            <ListItemText
                              primary={
                                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {p.title}
                                  </Typography>
                                  <Chip
                                    size="small"
                                    label={p.reviewState || "DRAFT"}
                                    color={reviewChipColor(p.reviewState)}
                                  />
                                </Box>
                              }
                              secondary={`${p.code} · ${p.theme} → ${primaryProductForTheme(p.theme)} · ${p.items?.length ?? 0} items`}
                            />
                          </ListItemButton>
                        ))}
                      </List>
                    </CardContent>
                  </Card>

                  <Stack spacing={1.5}>
                    {!selected ? (
                      <Alert severity="info">Select a pack on the left.</Alert>
                    ) : (
                      <>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6">{selected.title}</Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block", mb: 1 }}
                            >
                              {selected.code} · v{selected.version ?? 1} · theme {selected.theme} →{" "}
                              {primaryProductForTheme(selected.theme)}
                            </Typography>
                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1.5 }}>
                              <Chip
                                size="small"
                                color={productChipColor(activeLane.product)}
                                label={activeLane.product}
                              />
                              <Chip size="small" color="primary" label={selected.theme} />
                              <Chip
                                size="small"
                                label={selected.reviewState || "DRAFT"}
                                color={reviewChipColor(selected.reviewState)}
                              />
                              {(selected.regionTags || []).map((t) => (
                                <Chip key={`r-${t}`} size="small" variant="outlined" label={`region:${t}`} />
                              ))}
                              {(selected.cropTags || []).map((t) => (
                                <Chip key={`c-${t}`} size="small" variant="outlined" label={`crop:${t}`} />
                              ))}
                            </Box>
                            <Typography variant="body2" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>
                              {selected.summary || "—"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                              Flag: <code>{activeLane.neverAutoUpdateFlag}</code> — approving this pack does not write{" "}
                              {activeLane.product} code.
                            </Typography>
                            <Divider sx={{ my: 1.5 }} />
                            <Typography variant="subtitle2" gutterBottom>
                              Human review
                            </Typography>
                            <TextField
                              size="small"
                              fullWidth
                              label="Review note (optional)"
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              sx={{ mb: 1 }}
                            />
                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                              {(NEXT_ACTIONS[selected.reviewState || "DRAFT"] || []).map((a) => (
                                <Button
                                  key={a.state}
                                  size="small"
                                  variant={a.state === "APPROVED" ? "contained" : "outlined"}
                                  color={a.state === "REJECTED" ? "error" : "primary"}
                                  disabled={busy}
                                  onClick={() => void review(a.state)}
                                >
                                  {a.label}
                                </Button>
                              ))}
                              {selected.reviewState === "APPROVED" &&
                                ["IRRIGATION", "NUTRITION", "SOIL"].includes(selected.theme || "") && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="secondary"
                                  disabled={busy}
                                  onClick={() => void exportHandoff()}
                                >
                                  Export handoff ({primaryProductForTheme(selected.theme)})
                                </Button>
                              )}
                            </Box>
                            {selected.reviewState !== "APPROVED" && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                                4I-B handoff export requires <strong>APPROVED</strong> packs only.
                              </Typography>
                            )}
                          </CardContent>
                        </Card>

                        {(selected.items || []).map((item) => {
                          const isComparison = item.extractKind === "COMPARISON_NOTE";
                          const s = item.structured ?? {};
                          const param = typeof s.parameter === "string" ? s.parameter : null;
                          const equationId = typeof s.equationId === "string" ? s.equationId : null;
                          const hints = extractProductHints(item);
                          return (
                            <Card
                              key={item.id}
                              variant="outlined"
                              sx={{
                                borderColor: isComparison ? "warning.main" : undefined,
                                bgcolor: isComparison ? "rgba(237, 108, 2, 0.04)" : undefined,
                              }}
                            >
                              <CardContent>
                                <Box
                                  sx={{
                                    display: "flex",
                                    gap: 1,
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    mb: 0.5,
                                  }}
                                >
                                  <Chip
                                    size="small"
                                    label={item.extractKind}
                                    color={isComparison ? "warning" : "default"}
                                  />
                                  {param && (
                                    <Chip size="small" variant="outlined" label={`param:${param}`} />
                                  )}
                                  {equationId && (
                                    <Chip size="small" color="info" variant="outlined" label={equationId} />
                                  )}
                                  {hints.map((h) => (
                                    <Chip
                                      key={h}
                                      size="small"
                                      color={productChipColor(h)}
                                      variant="outlined"
                                      label={h}
                                    />
                                  ))}
                                  {(item.evidenceArtifactId ||
                                    (typeof s.evidenceArtifactId === "string" && s.evidenceArtifactId)) && (
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      label={`artifact:${String(item.evidenceArtifactId || s.evidenceArtifactId).slice(0, 8)}…`}
                                      title={String(item.evidenceArtifactId || s.evidenceArtifactId)}
                                    />
                                  )}
                                  {item.governanceCandidateId && (
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      label={`candidate:${item.governanceCandidateId.slice(0, 8)}…`}
                                    />
                                  )}
                                  {item.sourceUrl && (
                                    <Chip size="small" variant="outlined" label="has sourceUrl" />
                                  )}
                                  {isComparison && (
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      color="success"
                                      label="FlahaSOIL comparison only"
                                    />
                                  )}
                                  <Typography variant="subtitle1">{item.title}</Typography>
                                </Box>
                                {(item.evidenceArtifactId || item.governanceCandidateId) && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                    Evidence:{" "}
                                    {item.evidenceArtifactId && (
                                      <code>artifact {item.evidenceArtifactId}</code>
                                    )}
                                    {item.governanceCandidateId && (
                                      <code> · candidate {item.governanceCandidateId}</code>
                                    )}
                                  </Typography>
                                )}
                                {item.bodyText && (
                                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    {item.bodyText}
                                  </Typography>
                                )}
                                {Object.keys(s).length > 0 && (
                                  <Box
                                    component="pre"
                                    sx={{
                                      m: 0,
                                      p: 1.5,
                                      bgcolor: "action.hover",
                                      borderRadius: 1,
                                      fontSize: 12,
                                      overflow: "auto",
                                      maxHeight: 220,
                                    }}
                                  >
                                    {JSON.stringify(s, null, 2)}
                                  </Box>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </>
                    )}
                  </Stack>
                </Box>
              )}
            </>
          )}

          {/* Soil-only tools */}
          {lane === "soil" && soilTool === "bank" && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Literature threshold bank — FlahaSOIL only
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {bank?.note || "—"} Live: {String(bank?.live ?? false)} · entries: {bank?.count ?? 0}. Not used for
                  FlahaCALC irrigation or FlahaFAST nutrients.
                </Typography>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1.5 }}>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Level</InputLabel>
                    <Select label="Level" value={bankLevel} onChange={(e) => setBankLevel(e.target.value)}>
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="PRELIMINARY">PRELIMINARY</MenuItem>
                      <MenuItem value="MODERATE">MODERATE</MenuItem>
                      <MenuItem value="ADVANCED">ADVANCED</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    size="small"
                    variant={bankCuration ? "contained" : "outlined"}
                    onClick={() => setBankCuration(true)}
                  >
                    Curation
                  </Button>
                  <Button
                    size="small"
                    variant={!bankCuration ? "contained" : "outlined"}
                    onClick={() => setBankCuration(false)}
                  >
                    Live only
                  </Button>
                </Box>
                <Box sx={{ overflowX: "auto", maxHeight: 360 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: 6 }}>Parameter</th>
                        <th style={{ textAlign: "left", padding: 6 }}>Threshold</th>
                        <th style={{ textAlign: "left", padding: 6 }}>Levels</th>
                        <th style={{ textAlign: "left", padding: 6 }}>State</th>
                        <th style={{ textAlign: "left", padding: 6 }}>Title</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(bank?.entries || []).map((e) => (
                        <tr key={String(e.itemId)}>
                          <td style={{ padding: 6 }}>
                            <code>{String(e.parameter || "—")}</code>
                          </td>
                          <td style={{ padding: 6 }}>
                            {String(e.operator || "")}{" "}
                            {e.value != null
                              ? String(e.value)
                              : e.valueMin != null
                                ? `${String(e.valueMin)}–${String(e.valueMax)}`
                                : "—"}{" "}
                            {String(e.unit || "")}
                          </td>
                          <td style={{ padding: 6 }}>
                            {Array.isArray(e.soilTestLevels)
                              ? (e.soilTestLevels as string[]).join(", ")
                              : "—"}
                          </td>
                          <td style={{ padding: 6 }}>{String(e.packReviewState || "—")}</td>
                          <td style={{ padding: 6 }}>
                            {String(e.title || "—")}{" "}
                            <Button
                              size="small"
                              disabled={caseBusy || !e.itemId}
                              onClick={() =>
                                void openCaseFromBank(String(e.itemId), String(e.parameter || ""))
                              }
                            >
                              Open case
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {!bank?.entries?.length && (
                        <tr>
                          <td colSpan={5} style={{ padding: 8, color: "#6B7280" }}>
                            Empty bank. Seed + approve SOIL packs for Live mode.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Box>
              </CardContent>
            </Card>
          )}

          {lane === "soil" && soilTool === "cases" && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  FlahaSOIL comparison cases
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Literature vs soil report observations. Human only — never writes FlahaSOIL engines. Not CALC or
                  FAST.
                </Typography>
                {!cases.length ? (
                  <Typography variant="body2" color="text.secondary">
                    No cases. Open from threshold bank or import a soil report.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {cases.map((c) => (
                      <Box
                        key={String(c.id)}
                        sx={{
                          p: 1.5,
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 1,
                          display: "flex",
                          flexDirection: { xs: "column", md: "row" },
                          gap: 1,
                          alignItems: { md: "center" },
                        }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {String(c.title)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            <code>{String(c.parameter)}</code> · lit{" "}
                            {String(c.literatureValue ?? c.literatureRange ?? "—")} · SOIL{" "}
                            {String(c.flahaSoilValue ?? "—")}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={String(c.status)}
                          color={c.status === "APPROVED" ? "success" : "default"}
                        />
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                          {(CASE_NEXT[String(c.status)] || []).map((a) => (
                            <Button
                              key={a.status}
                              size="small"
                              variant="outlined"
                              disabled={caseBusy}
                              onClick={() => void transitionCase(String(c.id), a.status)}
                            >
                              {a.label}
                            </Button>
                          ))}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          )}

          {lane === "soil" && soilTool === "import" && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Import FlahaSOIL report
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Soil PDF/JSON only → DRAFT comparison cases. Does not import Mahaseel/Amman or CALC/FAST exports.
                  API: {bridge?.soilApi.configured ? bridge.soilApi.note : "not configured"}.
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
                  <Button variant="contained" component="label" disabled={caseBusy} size="small">
                    Upload PDF / JSON
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.json,application/pdf,application/json"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void importReport(f);
                      }}
                    />
                  </Button>
                  <TextField
                    size="small"
                    label="soilTestId"
                    value={soilTestId}
                    onChange={(e) => setSoilTestId(e.target.value)}
                    disabled={!bridge?.soilApi.configured}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={caseBusy || !bridge?.soilApi.configured || !soilTestId.trim()}
                    onClick={() => void importFromSoilApi()}
                  >
                    Import from SOIL API
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </Stack>
      )}
    </Stack>
  );
}
