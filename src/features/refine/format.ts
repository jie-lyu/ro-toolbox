const integer = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatZeny = (value: number) => integer.format(Math.round(value))
export const formatCount = (value: number) => decimal.format(value)
export const formatPercent = (value: number) => `${Math.round(value * 100)}%`
