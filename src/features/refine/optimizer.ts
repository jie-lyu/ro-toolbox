// 精煉路線最佳化（只考慮失敗不爆裝的做法）
//
// 記 G_i = 從 +i 第一次升到 +i+1 的期望花費。敲一次花 c，成功率 p，失敗掉到 +f：
//   G_i = [ c + (1 - p) · (G_f + … + G_(i-1)) ] / p      （祝福：f = i，括號內為 0）
// 從 +i 往上走的過程只會踩到 ≤ i 的級數，所以 G_i 只取決於 ≤ i 的選擇，
// 而且 G_i 隨較低級的 G 單調遞增。因此由 +0 往上逐級挑 G_i 最小的做法，
// 就同時讓每一個 G_i 都最小，總期望花費 G_s + … + G_(e-1) 也就最小。
//
// 「可接受多花 X%」：在期望花費 ≤ 最省錢 × (1 + X%) 的做法組合中，挑平均次數最少的。
// 這個問題不能逐級貪心，但有選擇的級數很少（武器 Lv5／防具 Lv2 約 1,000 種組合），直接窮舉。

import { type Equipment, type Material, type Prices, type RefineOption, optionsAt } from './data'

export interface ScoredOption {
  option: RefineOption
  /** 下面各級照本方案做時，選這個做法從 +i 升到 +i+1 的期望花費（G_i） */
  costToNext: number
  /** 同上，平均要敲幾次 */
  attemptsToNext: number
  /** 只把這一級換成這個做法（其他級不變）時，整趟的期望花費 */
  totalCost: number
  /** 同上，整趟的平均次數 */
  totalAttempts: number
}

export interface PlanStep {
  level: number
  choice: ScoredOption
  /** 這一級所有可用做法，依升一級期望花費由小到大 */
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
  /** 可接受比最省錢多花的比例（0.1 = 10%） */
  slack: number
  steps: PlanStep[]
  totalCost: number
  totalAttempts: number
  /** 最省錢做法的期望花費與次數，用來和本方案比較 */
  cheapest: { totalCost: number; totalAttempts: number }
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

/** 下面各級的升級量為 g 時，用 option 從 +i 升到 +i+1 的期望累積量 */
function scoreOption(option: RefineOption, g: number[], amount: number): number {
  let fallback = 0
  for (let j = option.failTo; j < option.level; j++) fallback += g[j]
  return (amount + (1 - option.probability) * fallback) / option.probability
}

/** 固定做法時，每一級升一級的期望累積量。unit(option) 是敲一次累積的量 */
function perLevel(policy: RefineOption[], unit: (option: RefineOption) => number): number[] {
  const g: number[] = []
  for (let i = 0; i < policy.length; i++) g[i] = scoreOption(policy[i], g, unit(policy[i]))
  return g
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
  const g = perLevel(policy.slice(0, end), unit)
  let total = 0
  for (let i = start; i < end; i++) total += g[i]
  return total
}

function levelOptions(equipment: Equipment, prices: Prices, end: number): RefineOption[][] {
  return Array.from({ length: end }, (_, i) => {
    const options = optionsAt(equipment, i, prices)
    if (options.length === 0) throw new NoSafeOptionError(i)
    return options
  })
}

/** 由 +0 往上逐級挑最省的做法，回傳 +0 ~ +(end-1) 每一級的選擇 */
export function bestPolicy(equipment: Equipment, prices: Prices, end: number) {
  const options = levelOptions(equipment, prices, end)
  const g: number[] = []
  const policy: RefineOption[] = []
  for (let i = 0; i < end; i++) {
    let best = options[i][0]
    let bestCost = Infinity
    for (const option of options[i]) {
      const cost = scoreOption(option, g, option.cost)
      if (cost < bestCost) {
        best = option
        bestCost = cost
      }
    }
    policy[i] = best
    g[i] = bestCost
  }
  return { policy, g }
}

const MAX_COMBINATIONS = 200_000

/**
 * 在期望花費 ≤ 最省錢 × (1 + slack) 的做法組合中，挑平均次數最少的（同次數取較省錢）。
 * slack = 0 時即為最省錢做法（若有同花費的做法，取次數較少者）。
 */
export function cheapestWithinSlack(equipment: Equipment, prices: Prices, start: number, end: number, slack: number) {
  const options = levelOptions(equipment, prices, end)
  const cheapest = bestPolicy(equipment, prices, end).policy
  const minCost = expectedTotal(cheapest, start, end, (o) => o.cost)
  const budget = minCost * (1 + slack) * (1 + 1e-12)

  // 失敗可能連續掉級，起點以下每一級都可能用到，所以全部有選擇的級數都要窮舉
  const free = options.map((list, i) => (list.length > 1 ? i : -1)).filter((i) => i >= 0)
  const combinations = free.reduce((n, i) => n * options[i].length, 1)
  if (combinations > MAX_COMBINATIONS) throw new RangeError(`做法組合太多（${combinations}）`)

  const policy = [...cheapest]
  let best = { policy: [...cheapest], cost: minCost, attempts: expectedTotal(cheapest, start, end, () => 1) }
  const visit = (k: number) => {
    if (k === free.length) {
      const cost = expectedTotal(policy, start, end, (o) => o.cost)
      if (cost > budget) return
      const attempts = expectedTotal(policy, start, end, () => 1)
      const fewer = attempts < best.attempts * (1 - 1e-12)
      const tie = !fewer && attempts <= best.attempts * (1 + 1e-12) && cost < best.cost
      if (fewer || tie) best = { policy: [...policy], cost, attempts }
      return
    }
    for (const option of options[free[k]]) {
      policy[free[k]] = option
      visit(k + 1)
    }
  }
  visit(0)
  return { policy: best.policy, options, cheapest: { totalCost: minCost, totalAttempts: expectedTotal(cheapest, start, end, () => 1) } }
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

export function optimizePlan(equipment: Equipment, prices: Prices, start: number, end: number, slack = 0): RefinePlan {
  if (!(0 <= start && start < end)) throw new RangeError('精煉範圍不正確')
  const { policy, options, cheapest } = cheapestWithinSlack(equipment, prices, start, end, Math.max(0, slack))

  const gCost = perLevel(policy, (o) => o.cost)
  const gAttempts = perLevel(policy, () => 1)
  const score = (option: RefineOption): ScoredOption => {
    const swapped = [...policy]
    swapped[option.level] = option
    return {
      option,
      costToNext: scoreOption(option, gCost, option.cost),
      attemptsToNext: scoreOption(option, gAttempts, 1),
      totalCost: expectedTotal(swapped, start, end, (o) => o.cost),
      totalAttempts: expectedTotal(swapped, start, end, () => 1),
    }
  }

  let cumulative = 0
  const cumulativeAt: number[] = []
  for (let i = start; i < end; i++) cumulativeAt[i] = cumulative += gCost[i]

  const steps = reachableLevels(policy, start, end).map((level) => ({
    level,
    choice: score(policy[level]),
    alternatives: options[level].map(score).sort((a, b) => a.costToNext - b.costToNext),
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
    slack,
    steps,
    totalCost: cumulative,
    totalAttempts: expectedTotal(policy, start, end, () => 1),
    cheapest,
    materials,
    blessingCount: expectedTotal(policy, start, end, (o) => o.blessingCount),
    blessingCost: expectedTotal(policy, start, end, (o) => o.blessingCost),
    feeCost: expectedTotal(policy, start, end, (o) => o.fee),
  }
}
