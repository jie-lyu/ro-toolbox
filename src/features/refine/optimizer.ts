// 最省錢精煉路線（只考慮失敗不爆裝的做法）
//
// 記 G_i = 從 +i 第一次升到 +i+1 的期望花費。敲一次花 c，成功率 p，失敗掉到 +f：
//   G_i = [ c + (1 - p) · (G_f + … + G_(i-1)) ] / p      （祝福：f = i，括號內為 0）
// 從 +i 往上走的過程只會踩到 ≤ i 的級數，所以 G_i 只取決於 ≤ i 的選擇，
// 而且 G_i 隨較低級的 G 單調遞增。因此由 +0 往上逐級挑 G_i 最小的做法，
// 就同時讓每一個 G_i 都最小，總期望花費 G_s + … + G_(e-1) 也就最小。

import { type Equipment, type Material, type Prices, type RefineOption, optionsAt } from './data'

export interface ScoredOption {
  option: RefineOption
  /** 選這個做法時的 G_i */
  expectedCost: number
}

export interface PlanStep {
  level: number
  choice: ScoredOption
  /** 這一級所有可用做法，依 G_i 由小到大 */
  alternatives: ScoredOption[]
  /** 整趟精煉中，平均在這一級敲幾次 */
  expectedAttempts: number
  /** 從起點做到 +level+1 的累計期望花費（起點以下的級數為 null） */
  cumulativeCost: number | null
  /** 只有失敗掉級才會踩到的級數 */
  belowStart: boolean
}

export interface MaterialUsage {
  material: Material
  count: number
  cost: number
}

export interface RefinePlan {
  start: number
  end: number
  steps: PlanStep[]
  totalCost: number
  totalAttempts: number
  materials: MaterialUsage[]
  blessingCount: number
  blessingCost: number
  feeCost: number
}

export class NoSafeOptionError extends Error {
  readonly level: number
  constructor(level: number) {
    super(`+${level} 沒有失敗不爆的做法`)
    this.level = level
  }
}

function scoreOption(option: RefineOption, g: number[]): number {
  let fallback = 0
  for (let j = option.failTo; j < option.level; j++) fallback += g[j]
  return (option.cost + (1 - option.probability) * fallback) / option.probability
}

/**
 * 固定一組做法（policy[i] = +i 的做法）後，計算從 start 到 end 的期望值。
 * unit(option) 是敲一次累積的量：傳成本就得到期望花費，傳 1 就得到期望次數。
 */
export function expectedTotal(
  policy: RefineOption[],
  start: number,
  end: number,
  unit: (option: RefineOption) => number,
): number {
  const h: number[] = []
  let total = 0
  for (let i = 0; i < end; i++) {
    const option = policy[i]
    let fallback = 0
    for (let j = option.failTo; j < i; j++) fallback += h[j]
    h[i] = (unit(option) + (1 - option.probability) * fallback) / option.probability
    if (i >= start) total += h[i]
  }
  return total
}

/** 從 start 出發、照 policy 敲，可能踩到的級數 */
function reachableLevels(policy: RefineOption[], start: number, end: number): number[] {
  const seen = new Set<number>([start])
  const queue = [start]
  while (queue.length > 0) {
    const level = queue.pop()!
    if (level >= end) continue
    for (const next of [level + 1, policy[level].failTo]) {
      if (next < end && !seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return [...seen].sort((a, b) => a - b)
}

/** 由 +0 往上逐級挑最省的做法，回傳 +0 ~ +(end-1) 每一級的選擇 */
export function bestPolicy(equipment: Equipment, prices: Prices, end: number) {
  const g: number[] = []
  const policy: RefineOption[] = []
  const alternatives: ScoredOption[][] = []
  for (let i = 0; i < end; i++) {
    const scored = optionsAt(equipment, i, prices)
      .map((option) => ({ option, expectedCost: scoreOption(option, g) }))
      .sort((a, b) => a.expectedCost - b.expectedCost)
    if (scored.length === 0) throw new NoSafeOptionError(i)
    alternatives[i] = scored
    policy[i] = scored[0].option
    g[i] = scored[0].expectedCost
  }
  return { policy, g, alternatives }
}

export function optimizePlan(equipment: Equipment, prices: Prices, start: number, end: number): RefinePlan {
  if (!(0 <= start && start < end)) throw new RangeError('精煉範圍不正確')
  const { policy, g, alternatives } = bestPolicy(equipment, prices, end)

  let cumulative = 0
  const cumulativeAt: number[] = []
  for (let i = start; i < end; i++) cumulativeAt[i] = cumulative += g[i]

  const steps = reachableLevels(policy, start, end).map((level) => ({
    level,
    choice: alternatives[level][0],
    alternatives: alternatives[level],
    expectedAttempts: expectedTotal(policy, start, end, (o) => (o.level === level ? 1 : 0)),
    cumulativeCost: level >= start ? cumulativeAt[level] : null,
    belowStart: level < start,
  }))

  const usedMaterials = [...new Set(steps.map((s) => s.choice.option.material))]
  const materials = usedMaterials.map((material) => {
    const count = expectedTotal(policy, start, end, (o) => (o.material === material ? 1 : 0))
    return { material, count, cost: count * (prices.materials[material.id] ?? 0) }
  })

  return {
    start,
    end,
    steps,
    totalCost: cumulative,
    totalAttempts: expectedTotal(policy, start, end, () => 1),
    materials,
    blessingCount: expectedTotal(policy, start, end, (o) => o.blessingCount),
    blessingCost: expectedTotal(policy, start, end, (o) => o.blessingCost),
    feeCost: expectedTotal(policy, start, end, (o) => o.fee),
  }
}
