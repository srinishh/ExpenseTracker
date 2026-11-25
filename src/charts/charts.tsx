// Everything that touches Recharts lives here, so Recharts ships in its own chunk
// and loads after the page around it. Import charts through ./index, never this file.
import {
  Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { fmt } from '../utils'
import type { DonutChartProps, MoneyChartProps } from './types'

const TICK = { fill: 'var(--muted)', fontSize: 12 }

export function MoneyChart({ data, series, height, xKey = 'label', horizontal, legend = true, margin, categoryWidth = 110 }: MoneyChartProps) {
  const money = { tickFormatter: (v: number) => fmt(v, { compact: true }), tick: TICK, axisLine: false, tickLine: false }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={!!horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...money} />
            <YAxis type="category" dataKey={xKey} width={categoryWidth} tick={TICK} axisLine={false} tickLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={TICK} axisLine={false} tickLine={false} />
            <YAxis {...money} width={64} />
          </>
        )}
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'var(--hover)' }} />
        {legend && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map(s => s.type === 'line'
          ? <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} type="monotone" />
          : <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={s.stack} radius={s.radius}
              maxBarSize={s.maxBarSize} barSize={s.barSize} />)}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function DonutChart({ data, colors, height }: DonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="var(--surface)">
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Pie>
        <Tooltip content={<MoneyTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string; payload?: { fill?: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="tooltip">
      {label && <div className="tooltip-title">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="tooltip-row">
          <span className="dot" style={{ background: p.color ?? p.payload?.fill }} />
          <span>{p.name}</span><b>{fmt(p.value)}</b>
        </div>
      ))}
    </div>
  )
}
