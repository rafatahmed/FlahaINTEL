/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Simple Line Chart
 * Introduction: Lightweight SVG line chart for market price trends (no chart library).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { Box, Typography } from "@mui/material";

export type ChartPoint = { x: string; y: number };

export function SimpleLineChart(props: {
  points: ChartPoint[];
  height?: number;
  yLabel?: string;
  color?: string;
}) {
  const { points, height = 220, yLabel = "", color = "#2E7D32" } = props;
  if (!points.length) {
    return (
      <Box sx={{ height, display: "grid", placeItems: "center", bgcolor: "action.hover", borderRadius: 1 }}>
        <Typography color="text.secondary" variant="body2">No trend points yet.</Typography>
      </Box>
    );
  }

  const width = 640;
  const padL = 48;
  const padR = 12;
  const padT = 16;
  const padB = 36;
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = maxY - minY || 1;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const coords = points.map((p, i) => {
    const x = padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = padT + innerH - ((p.y - minY) / spanY) * innerH;
    return { x, y, label: p.x, value: p.y };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const yTicks = [minY, minY + spanY / 2, maxY];

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Price trend">
        {yTicks.map((t) => {
          const y = padT + innerH - ((t - minY) / spanY) * innerH;
          return (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#6B7280">
                {t.toFixed(3)}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c) => (
          <circle key={c.label + c.value} cx={c.x} cy={c.y} r={3.5} fill={color} />
        ))}
        {coords.map((c, i) =>
          i === 0 || i === coords.length - 1 || coords.length <= 6 ? (
            <text key={`x-${c.label}`} x={c.x} y={height - 10} textAnchor="middle" fontSize={10} fill="#6B7280">
              {c.label.slice(5)}
            </text>
          ) : null,
        )}
        {yLabel ? (
          <text x={12} y={14} fontSize={11} fill="#6B7280">
            {yLabel}
          </text>
        ) : null}
      </svg>
    </Box>
  );
}
