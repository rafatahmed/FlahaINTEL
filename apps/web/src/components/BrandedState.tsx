import { Box, CircularProgress, Stack, Typography } from "@mui/material";

interface BrandedStateProps {
  label: string;
  loading?: boolean;
}

export function BrandedState({ label, loading = false }: BrandedStateProps) {
  return <Stack role="status" aria-live="polite" spacing={1} sx={{ alignItems: "center", py: 3 }}>
    <Box
      component="img"
      src="/brand/flahaintel/flahaintel-logo-mark.png"
      alt=""
      aria-hidden="true"
      sx={{ width: 52, height: "auto", opacity: 0.14 }}
    />
    {loading
      ? <CircularProgress size={24} aria-label={label} />
      : <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>{label}</Typography>}
  </Stack>;
}
