/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Simple Bar Chart
 * Introduction: Lightweight SVG bar chart for monthly aggregates and histograms.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { Box, Typography } from "@mui/material";

export type BarItem = {
  label: string;
  value: number;
  color?: string;
};

export function SimpleBarChart(props: {
  items: BarItem[];
  height?: number;
  yLabel?: string;
  color?: string;
  emptyMessage?: string;
}) {
  const {
    items,
    height = 200,
    yLabel = "",
    color = "#1565C0",
    emptyMessage = "No data for this chart.",
  } = props;
  const data = items.filter((i) => Number.isFinite(i.value) && i.value >= 0);
  if (!data.length) {
    return (
      <Box
        sx={{
          height,
          display: "grid",
          placeItems: "center",
          bgcolor: "action.hover",
          borderRadius: 1,
        }}
      >
        <Typography color="text.secondary" variant="body2">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  const width = 720;
  const padL = 48;
  const padR = 12;
  const padT = 20;
  const padB = 40;
  const maxY = Math.max(...data.map((d) => d.value), 1e-9);
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const gap = 4;
  const barW = Math.max(4, (innerW - gap * (data.length - 1)) / data.length);

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Bar chart">
        {[0, 0.5, 1].map((f) => {
          const y = padT + innerH * (1 - f);
          const val = maxY * f;
          return (
            <g key={f}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#6B7280">
                {val >= 10 ? val.toFixed(1) : val.toFixed(2)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / maxY) * innerH;
          const x = padL + i * (barW + gap);
          const y = padT + innerH - h;
          return (
            <g key={`${d.label}-${i}`}>
              <rect x={x} y={y} width={barW} height={Math.max(h, 1)} fill={d.color || color} rx={2}>
                <title>{`${d.label}: ${d.value}`}</title>
              </rect>
              {(data.length <= 16 || i % Math.ceil(data.length / 12) === 0 || i === data.length - 1) && (
                <text
                  x={x + barW / 2}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#6B7280"
                >
                  {d.label.length > 8 ? `${d.label.slice(0, 6)}…` : d.label}
                </text>
              )}
            </g>
          );
        })}
        {yLabel ? (
          <text x={12} y={14} fontSize={11} fill="#6B7280">
            {yLabel}
          </text>
        ) : null}
      </svg>
    </Box>
  );
}
