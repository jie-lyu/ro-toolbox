const integer = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatZeny = (value: number) => integer.format(Math.round(value))
export const formatCount = (value: number) => decimal.format(value)
export const formatPercent = (value: number) => `${Math.round(value * 100)}%`

const sign = (value: number, text: string) => (value > 0 ? `+${text}` : value < 0 ? `−${text}` : text)
export const formatSignedZeny = (value: number) => sign(Math.round(value), formatZeny(Math.abs(value)))
export const formatSignedCount = (value: number) =>
  sign(Math.abs(value) < 0.005 ? 0 : value, formatCount(Math.abs(value)))
