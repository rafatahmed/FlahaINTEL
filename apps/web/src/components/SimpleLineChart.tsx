/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Simple Line Chart
 * Introduction: Lightweight multi-series SVG line chart for market price trends.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-31
 */
import { Box, Typography } from "@mui/material";

export type ChartPoint = { x: string; y: number };

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  points: ChartPoint[];
};

const DEFAULT_COLORS = ["#2E7D32", "#1565C0", "#E65100", "#6A1B9A", "#00838F", "#C62828", "#F9A825", "#455A64"];

export function SimpleLineChart(props: {
  /** Single-series convenience (legacy). */
  points?: ChartPoint[];
  /** Multi-series (preferred for Mahaseel grade/method). */
  series?: ChartSeries[];
  height?: number;
  yLabel?: string;
  color?: string;
}) {
  const { height = 240, yLabel = "", color = DEFAULT_COLORS[0]! } = props;

  const series: ChartSeries[] = (() => {
    if (props.series?.length) return props.series;
    if (props.points?.length) {
      return [{ id: "default", label: yLabel || "Price", color, points: props.points }];
    }
    return [];
  })();

  const allPoints = series.flatMap((s) => s.points);
  if (!allPoints.length) {
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
          No trend points yet. Select a commodity and ensure the date window has observations.
        </Typography>
      </Box>
    );
  }

  const width = 720;
  const padL = 48;
  const padR = 16;
  const padT = 20;
  const padB = series.length > 1 ? 52 : 36;
  const ys = allPoints.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = maxY - minY || 1;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  // Shared x-axis: union of dates, sorted
  const xLabels = [...new Set(allPoints.map((p) => p.x))].sort();
  const xIndex = new Map(xLabels.map((x, i) => [x, i]));
  const xAt = (label: string) => {
    if (xLabels.length === 1) return padL + innerW / 2;
    const i = xIndex.get(label) ?? 0;
    return padL + (i / (xLabels.length - 1)) * innerW;
  };
  const yAt = (v: number) => padT + innerH - ((v - minY) / spanY) * innerH;

  const yTicks = [minY, minY + spanY / 2, maxY];

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Price trend"
      >
        {yTicks.map((t) => {
          const y = yAt(t);
          return (
            <g key={`yt-${t}`}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#6B7280">
                {t.toFixed(2)}
              </text>
            </g>
          );
        })}

        {series.map((s) => {
          const coords = s.points
            .slice()
            .sort((a, b) => a.x.localeCompare(b.x))
            .map((p) => ({ x: xAt(p.x), y: yAt(p.y), label: p.x, value: p.y }));
          if (!coords.length) return null;
          const path = coords
            .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
            .join(" ");
          return (
            <g key={s.id}>
              {coords.length > 1 ? (
                <path
                  d={path}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.4}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {coords.map((c) => (
                <circle
                  key={`${s.id}-${c.label}-${c.value}`}
                  cx={c.x}
                  cy={c.y}
                  r={coords.length === 1 ? 5 : 3.5}
                  fill={s.color}
                >
                  <title>{`${s.label}: ${c.value} @ ${c.label}`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {xLabels.map((label, i) => {
          if (xLabels.length > 8 && i !== 0 && i !== xLabels.length - 1 && i % Math.ceil(xLabels.length / 6) !== 0) {
            return null;
          }
          return (
            <text
              key={`x-${label}`}
              x={xAt(label)}
              y={height - (series.length > 1 ? 28 : 10)}
              textAnchor="middle"
              fontSize={10}
              fill="#6B7280"
            >
              {label.length >= 10 ? label.slice(5) : label}
            </text>
          );
        })}

        {yLabel ? (
          <text x={12} y={14} fontSize={11} fill="#6B7280">
            {yLabel}
          </text>
        ) : null}

        {series.length > 1
          ? series.map((s, i) => {
              const lx = padL + (i % 4) * 160;
              const ly = height - 12;
              return (
                <g key={`leg-${s.id}`}>
                  <rect x={lx} y={ly - 8} width={10} height={10} fill={s.color} rx={1} />
                  <text x={lx + 14} y={ly} fontSize={10} fill="#374151">
                    {s.label.length > 22 ? `${s.label.slice(0, 20)}…` : s.label}
                  </text>
                </g>
              );
            })
          : null}
      </svg>
    </Box>
  );
}

export function seriesColor(index: number): string {
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length]!;
}
