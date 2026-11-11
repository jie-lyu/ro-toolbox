// 精煉資料：沿用 https://vkmouse.github.io/simulate-refining/ (2022.09.08) 的成功率表與材料規則。
// 只收錄武器等級 5、防具等級 2，精煉範圍 +0 ~ +14。

export const MAX_LEVEL = 14

export type ProbabilityCategory = 'normal' | 'special'

/** 失敗懲罰：爆裝，或退 levels 級 */
export type FailurePenalty = { kind: 'break' } | { kind: 'down'; levels: number }

export interface Material {
  id: string
  name: string
  category: ProbabilityCategory
  penalty: FailurePenalty
  /** 可使用的精煉值範圍（含頭含尾，指「從 +from 敲」） */
  from: number
  to: number
}

export interface Equipment {
  id: EquipmentId
  name: string
  materials: Material[]
}

export type EquipmentId = 'weapon5' | 'armor2'

/** 第 i 個元素 = 從 +i 敲到 +i+1 的成功率。武器 Lv5 與防具 Lv2 在網站上是同一張表。 */
const PROBABILITY: Record<ProbabilityCategory, number[]> = {
  normal: [1, 1, 1, 0.6, 0.6, 0.4, 0.4, 0.2, 0.2, 0.09, 0.08, 0.08, 0.08, 0.08],
  special: [1, 1, 1, 0.9, 0.7, 0.6, 0.6, 0.4, 0.4, 0.2, 0.15, 0.15, 0.15, 0.15],
}

/** 使用鐵匠的祝福時每次消耗的數量（+7 ~ +13 才能用），失敗時精煉值不變 */
export const BLESSING_DEMAND: Record<number, number> = {
  7: 1,
  8: 2,
  9: 3,
  10: 4,
  11: 4,
  12: 9,
  13: 15,
}

export const EQUIPMENTS: Record<EquipmentId, Equipment> = {
  weapon5: {
    id: 'weapon5',
    name: '武器等級 5',
    materials: [
      { id: 'Etherdeocon', name: '乙太神之金屬', category: 'normal', penalty: { kind: 'down', levels: 3 }, from: 0, to: 9 },
      { id: 'EnrichedEtherdeocon', name: '濃縮乙太神之金屬', category: 'special', penalty: { kind: 'down', levels: 1 }, from: 0, to: 9 },
      { id: 'HDEtherdeocon', name: '高濃縮乙太神之金屬', category: 'special', penalty: { kind: 'break' }, from: 10, to: 13 },
    ],
  },
  armor2: {
    id: 'armor2',
    name: '防具等級 2',
    materials: [
      { id: 'Etherium', name: '乙太鋁', category: 'normal', penalty: { kind: 'down', levels: 3 }, from: 0, to: 9 },
      { id: 'EnrichedEthernium', name: '濃縮乙太鋁', category: 'special', penalty: { kind: 'down', levels: 1 }, from: 0, to: 9 },
      { id: 'HDEthernium', name: '高濃縮乙太鋁', category: 'special', penalty: { kind: 'break' }, from: 10, to: 13 },
    ],
  },
}

export interface Prices {
  /** 材料單價，key 為 Material.id */
  materials: Record<string, number>
  blessing: number
}

/** 單次精煉費（固定值，不開放修改） */
export const REFINE_FEE = { low: 10_000, high: 100_000 } as const

export function refineFee(level: number): number {
  return level < 10 ? REFINE_FEE.low : REFINE_FEE.high
}

/** 某一級可用的一種做法 */
export interface RefineOption {
  level: number
  material: Material
  blessing: boolean
  blessingCount: number
  probability: number
  /** 失敗後的精煉值（祝福 = 原地不動） */
  failTo: number
  /** 敲一次的總成本 = 材料 + 精煉費 + 祝福 */
  cost: number
  materialCost: number
  blessingCost: number
  fee: number
}

export function probabilityOf(material: Material, level: number): number {
  return PROBABILITY[material.category][level]
}

/** 列出 +level 的所有「失敗不爆」做法 */
export function optionsAt(equipment: Equipment, level: number, prices: Prices): RefineOption[] {
  const result: RefineOption[] = []
  for (const material of equipment.materials) {
    if (level < material.from || level > material.to) continue
    const probability = probabilityOf(material, level)
    const materialCost = prices.materials[material.id] ?? 0
    const fee = refineFee(level)
    const blessingChoices = level in BLESSING_DEMAND ? [false, true] : [false]
    for (const blessing of blessingChoices) {
      // 成功率 100% 時祝福沒有意義
      if (blessing && probability >= 1) continue
      let failTo: number
      if (blessing || probability >= 1) failTo = level
      else if (material.penalty.kind === 'down') failTo = Math.max(0, level - material.penalty.levels)
      else continue // 會爆裝，排除
      const blessingCount = blessing ? BLESSING_DEMAND[level] : 0
      const blessingCost = blessingCount * prices.blessing
      result.push({
        level,
        material,
        blessing,
        blessingCount,
        probability,
        failTo,
        cost: materialCost + fee + blessingCost,
        materialCost,
        blessingCost,
        fee,
      })
    }
  }
  return result
}
