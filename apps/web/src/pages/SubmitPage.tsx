/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Submit Website and Document
 * Introduction: Creates real durable submissions for website URLs and document uploads.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import {
  Alert,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { api } from "../api";

export function SubmitPage(props: { onOpenSubmission?: (id: string) => void }) {
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("en");
  const [autoChain, setAutoChain] = useState(true);
  const [mode, setMode] = useState<"STATIC" | "BROWSER">("STATIC");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function submitWebsite() {
    setBusy(true);
    setError("");
    try {
      const submission = await api.submitWebsite({
        url,
        languageHint: language,
        acquisitionMode: mode,
        chainMode: autoChain ? "AUTO_CHAIN" : "MANUAL_STAGE",
        idempotencyKey: `web-ui-${Date.now()}`,
      });
      setResult(submission);
      if (submission.id && props.onOpenSubmission) props.onOpenSubmission(String(submission.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitDocument() {
    if (!file) {
      setError("Choose a file.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("languageHint", language);
      form.append("chainMode", autoChain ? "AUTO_CHAIN" : "MANUAL_STAGE");
      form.append("idempotencyKey", `doc-ui-${Date.now()}`);
      const submission = await api.submitDocument(form);
      setResult(submission);
      if (submission.id && props.onOpenSubmission) props.onOpenSubmission(String(submission.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Submit</Typography>
      <Typography variant="body2" color="text.secondary">
        Supported documents: PDF, DOCX, RTF, TXT (max 25 MB). PPTX is rejected before processing.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {result && (
        <Alert severity="success">
          Submission {String(result.id)} · {String(result.overallStatus)} · stage {String(result.currentStage)}
          {result.lastErrorCode ? ` · ${String(result.lastErrorCode)}: ${String(result.lastErrorMessage || "")}` : ""}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Website</Typography>
          <Stack spacing={1.5}>
            <TextField label="Governed URL" value={url} onChange={(e) => setUrl(e.target.value)} fullWidth />
            <TextField label="Language hint" value={language} onChange={(e) => setLanguage(e.target.value)} size="small" />
            <FormControl size="small">
              <InputLabel>Acquisition mode</InputLabel>
              <Select label="Acquisition mode" value={mode} onChange={(e) => setMode(e.target.value as "STATIC" | "BROWSER")}>
                <MenuItem value="STATIC">STATIC</MenuItem>
                <MenuItem value="BROWSER">BROWSER</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={<Switch checked={autoChain} onChange={(e) => setAutoChain(e.target.checked)} />}
              label="Auto-chain stages"
            />
            <Button variant="contained" disabled={busy || !url} onClick={() => void submitWebsite()}>
              Submit website
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Document</Typography>
          <Stack spacing={1.5}>
            <Button variant="outlined" component="label">
              Choose file
              <input
                hidden
                type="file"
                accept=".pdf,.docx,.rtf,.txt,application/pdf,text/plain,application/rtf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Button>
            <Typography variant="body2">{file ? `${file.name} (${file.type || "unknown"}, ${file.size} bytes)` : "No file selected"}</Typography>
            <FormControlLabel
              control={<Switch checked={autoChain} onChange={(e) => setAutoChain(e.target.checked)} />}
              label="Auto-chain stages"
            />
            <Button variant="contained" disabled={busy || !file} onClick={() => void submitDocument()}>
              Upload document
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
