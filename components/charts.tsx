"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartPoint = { label: string; value: number; value2?: number };
export type Slice = { name: string; value: number; color: string };

const money = (v: number) => `$${(v / 100).toFixed(2)}`;

export function AreaTrend({
  data,
  color = "#1769E0",
  secondaryColor = "#9CC3F8",
  height = 240,
  currency = true,
  seriesLabels = ["Value", "Previous"],
}: {
  data: ChartPoint[];
  color?: string;
  secondaryColor?: string;
  height?: number;
  currency?: boolean;
  seriesLabels?: [string, string];
}) {
  const hasSecond = data.some((d) => typeof d.value2 === "number");
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#EDF1F7" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8A99AF" }} dy={6} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#8A99AF" }}
            tickFormatter={(v: number) => (currency ? `$${Math.round(v / 100)}` : String(v))}
            width={52}
          />
          <Tooltip
            formatter={(value, name) => [
              currency ? money(Number(value ?? 0)) : String(value ?? ""),
              String(name ?? ""),
            ]}
            contentStyle={{ borderRadius: 12, border: "1px solid #E5EAF1", fontSize: 12 }}
          />
          <Area type="monotone" dataKey="value" name={seriesLabels[0]} stroke={color} strokeWidth={2.4} fill="url(#trendFill)" />
          {hasSecond ? (
            <Area
              type="monotone"
              dataKey="value2"
              name={seriesLabels[1]}
              stroke={secondaryColor}
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="transparent"
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarsChart({
  data,
  color = "#1769E0",
  height = 240,
  currency = false,
  horizontal = false,
}: {
  data: ChartPoint[];
  color?: string;
  height?: number;
  currency?: boolean;
  horizontal?: boolean;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 12, left: horizontal ? 6 : -18, bottom: 0 }}
          barCategoryGap={horizontal ? 8 : 22}
        >
          <CartesianGrid strokeDasharray="4 4" vertical={horizontal} horizontal={!horizontal} stroke="#EDF1F7" />
          {horizontal ? (
            <>
              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8A99AF" }} />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={118}
                tick={{ fontSize: 11, fill: "#61708A" }}
              />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8A99AF" }} dy={6} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#8A99AF" }}
                tickFormatter={(v: number) => (currency ? `$${Math.round(v / 100)}` : String(v))}
                width={52}
              />
            </>
          )}
          <Tooltip
            cursor={{ fill: "rgba(23,105,224,0.04)" }}
            formatter={(value) => [currency ? money(Number(value ?? 0)) : String(value ?? ""), "Value"]}
            contentStyle={{ borderRadius: 12, border: "1px solid #E5EAF1", fontSize: 12 }}
          />
          <Bar dataKey="value" fill={color} radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({
  data,
  height = 220,
  centerLabel,
  centerValue,
}: {
  data: Slice[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  return (
    <div className="relative w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none">
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E5EAF1", fontSize: 12 }} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => <span style={{ fontSize: 11.5, color: "#61708A" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerValue ? (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] -translate-y-1/2 text-center">
          <p className="text-[20px] font-semibold text-navy">{centerValue}</p>
          {centerLabel ? <p className="text-[11px] text-muted">{centerLabel}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
