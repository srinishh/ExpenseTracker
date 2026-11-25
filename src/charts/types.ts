type Radius = [number, number, number, number]

export type ChartSeries = {
  key: string
  name: string
  color: string
  type?: 'bar' | 'line'
  stack?: string
  radius?: Radius
  maxBarSize?: number
  barSize?: number
}

export type MoneyChartProps = {
  data: object[]
  series: ChartSeries[]
  height: number
  /** Key of the category axis (months, names). Defaults to "label". */
  xKey?: string
  /** Bars run left to right, with categories down the side. */
  horizontal?: boolean
  legend?: boolean
  margin?: { top?: number; right?: number; bottom?: number; left?: number }
  categoryWidth?: number
}

export type DonutChartProps = {
  data: { name: string; value: number }[]
  colors: readonly string[]
  height: number
}
