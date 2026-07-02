import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { ReactNode } from "react";
import { Panel } from "./ui";

type ChartPoint = Record<string, string | number>;

const grid = "rgba(148, 163, 184, 0.08)";
const text = "#64748b";
const lime = "#b7fe1a";

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-a2-green/20 bg-[#080b0f]/95 px-3 py-2 text-xs shadow-panel backdrop-blur">
      <p className="mb-1 font-semibold text-white">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="text-a2-green">
          {item.name}: {item.value}
        </p>
      ))}
    </div>
  );
}

export function AreaChartCard({
  title,
  eyebrow,
  data,
  dataKey,
  children
}: {
  title: string;
  eyebrow: string;
  data: ChartPoint[];
  dataKey: string;
  children?: ReactNode;
}) {
  return (
    <Panel title={title} eyebrow={eyebrow} actions={children}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -18, right: 8, top: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="a2PlayersFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lime} stopOpacity={0.34} />
                <stop offset="95%" stopColor={lime} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey="time" stroke={text} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <YAxis stroke={text} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(183,254,26,0.22)" }} />
            <Area type="monotone" dataKey={dataKey} stroke={lime} strokeWidth={3} fill="url(#a2PlayersFill)" activeDot={{ r: 5, fill: lime, stroke: "#060708", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export function BarChartCard({
  title,
  eyebrow,
  data,
  dataKey
}: {
  title: string;
  eyebrow: string;
  data: ChartPoint[];
  dataKey: string;
}) {
  return (
    <Panel title={title} eyebrow={eyebrow}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -18, right: 8, top: 12, bottom: 0 }}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey="label" stroke={text} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <YAxis stroke={text} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(183,254,26,0.055)" }} />
            <Bar dataKey={dataKey} radius={[7, 7, 2, 2]}>
              {data.map((_, index) => (
                <Cell key={index} fill={index % 2 === 0 ? lime : "#86efac"} opacity={0.88} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export function DonutMetric({ value, label, detail }: { value: number; label: string; detail: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="rounded-lg border border-[#1e2228] bg-black/24 p-4">
      <div className="flex items-center gap-4">
        <div
          className="grid h-20 w-20 place-items-center rounded-full"
          style={{
            background: `conic-gradient(${lime} ${clamped * 3.6}deg, rgba(255,255,255,0.08) 0deg)`
          }}
        >
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#0a0c0e] text-lg font-black text-white">
            {clamped}%
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-1 text-sm text-zinc-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}
