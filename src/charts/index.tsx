// Lazy wrappers: pages render these and Recharts is fetched on first use.
// A placeholder of the same height holds the space so the page doesn't jump.
import { lazy, Suspense } from 'react'
import type { DonutChartProps, MoneyChartProps } from './types'

export type { ChartSeries } from './types'

const load = () => import('./charts')
const LazyMoney = lazy(() => load().then(m => ({ default: m.MoneyChart })))
const LazyDonut = lazy(() => load().then(m => ({ default: m.DonutChart })))

/** Start downloading Recharts early, without rendering anything. */
export const preloadCharts = () => { load().catch(() => {}) }

const Placeholder = ({ height }: { height: number }) => <div className="chart-placeholder" style={{ height }} aria-hidden />

export function MoneyChart(props: MoneyChartProps) {
  return <Suspense fallback={<Placeholder height={props.height} />}><LazyMoney {...props} /></Suspense>
}

export function DonutChart(props: DonutChartProps) {
  return <Suspense fallback={<Placeholder height={props.height} />}><LazyDonut {...props} /></Suspense>
}
