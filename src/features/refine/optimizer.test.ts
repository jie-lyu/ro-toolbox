import { describe, expect, it } from 'vitest'
import { EQUIPMENTS, MAX_LEVEL, type Prices, type RefineOption, optionsAt } from './data'
import { bestPolicy, expectedTotal, optimizePlan } from './optimizer'

const prices: Prices = {
  materials: {
    Etherdeocon: 60_000,
    EnrichedEtherdeocon: 450_000,
    HDEtherdeocon: 2_500_000,
    Etherium: 40_000,
    EnrichedEthernium: 300_000,
    HDEthernium: 1_800_000,
  },
  blessing: 2_800_000,
}

/** 獨立做法：把馬可夫鏈寫成線性方程組 V_i = c_i + p V_(i+1) + q V_fail，用高斯消去求 V_start */
function solveLinear(policy: RefineOption[], start: number, end: number): number {
  const n = end
  const m = Array.from({ length: n }, () => Array<number>(n + 1).fill(0))
  for (let i = 0; i < n; i++) {
    const { probability: p, failTo, cost } = policy[i]
    m[i][i] += 1
    if (i + 1 < n) m[i][i + 1] -= p
    m[i][failTo] -= 1 - p
    m[i][n] += cost
  }
  for (let c = 0; c < n; c++) {
    let pivot = c
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r
    ;[m[c], m[pivot]] = [m[pivot], m[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = m[r][c] / m[c][c]
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k]
    }
  }
  return m[start][n] / m[start][start]
}

function* allPolicies(levelOptions: RefineOption[][], i = 0, acc: RefineOption[] = []): Generator<RefineOption[]> {
  if (i === levelOptions.length) {
    yield acc
    return
  }
  for (const option of levelOptions[i]) {
    acc[i] = option
    yield* allPolicies(levelOptions, i + 1, acc)
  }
}

const relClose = (a: number, b: number) => expect(Math.abs(a - b) / Math.max(1, Math.abs(b))).toBeLessThan(1e-9)

describe.each(Object.values(EQUIPMENTS))('$name', (equipment) => {
  it('每一級 +0 ~ +13 都有失敗不爆的做法', () => {
    for (let i = 0; i < MAX_LEVEL; i++) expect(optionsAt(equipment, i, prices).length).toBeGreaterThan(0)
  })

  it('期望花費與線性方程組解一致', () => {
    for (const [start, end] of [[0, 14], [5, 12], [9, 13], [3, 8]]) {
      const plan = optimizePlan(equipment, prices, start, end)
      const { policy } = bestPolicy(equipment, prices, end)
      relClose(plan.totalCost, solveLinear(policy, start, end))
      relClose(plan.totalCost, plan.materials.reduce((s, m) => s + m.cost, 0) + plan.blessingCost + plan.feeCost)
    }
  })

  it('窮舉所有做法組合，找不到比它更省的', () => {
    for (const [start, end] of [[3, 10], [6, 11], [8, 14]]) {
      const plan = optimizePlan(equipment, prices, start, end)
      const levelOptions = Array.from({ length: end }, (_, i) => optionsAt(equipment, i, prices))
      let best = Infinity
      for (const policy of allPolicies(levelOptions)) {
        best = Math.min(best, expectedTotal(policy, start, end, (o) => o.cost))
      }
      relClose(plan.totalCost, best)
      // 交叉檢查遞推本身
      const { policy } = bestPolicy(equipment, prices, end)
      relClose(expectedTotal(policy, start, end, (o) => o.cost), solveLinear(policy, start, end))
    }
  })

  it('蒙地卡羅模擬落在期望值附近', () => {
    const start = 6
    const end = 11
    const plan = optimizePlan(equipment, prices, start, end)
    const byLevel = new Map(plan.steps.map((s) => [s.level, s.choice.option]))
    let seed = 42
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
    const n = 20_000
    let sum = 0
    let sumSq = 0
    for (let k = 0; k < n; k++) {
      let level = start
      let cost = 0
      while (level < end) {
        const o = byLevel.get(level)!
        cost += o.cost
        level = rand() < o.probability ? level + 1 : o.failTo
      }
      sum += cost
      sumSq += cost * cost
    }
    const mean = sum / n
    const se = Math.sqrt((sumSq / n - mean * mean) / n)
    expect(Math.abs(mean - plan.totalCost)).toBeLessThan(4 * se)
  })
})
