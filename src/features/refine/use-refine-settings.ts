import { useEffect, useState } from 'react'
import { type EquipmentId, EQUIPMENTS, MAX_LEVEL, type Prices } from './data'

export interface RefineSettings {
  equipment: EquipmentId
  start: number
  end: number
  /** 可接受比最省錢多花的百分比（0 ~ MAX_SLACK_PERCENT） */
  slackPercent: number
  prices: Prices
}

export const MAX_SLACK_PERCENT = 30

/** 預設行情 */
export const DEFAULT_SETTINGS: RefineSettings = {
  equipment: 'weapon5',
  start: 0,
  end: 9,
  slackPercent: 0,
  prices: {
    materials: {
      Etherdeocon: 75_000,
      EnrichedEtherdeocon: 945_000,
      HDEtherdeocon: 1_090_000,
      Etherium: 85_000,
      EnrichedEthernium: 1_040_000,
      HDEthernium: 1_120_000,
    },
    blessing: 4_500_000,
  },
}

const STORAGE_KEY = 'ro-toolbox:refine:v1'

function load(): RefineSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const saved = JSON.parse(raw) as Partial<RefineSettings>
    const equipment = saved.equipment && saved.equipment in EQUIPMENTS ? saved.equipment : DEFAULT_SETTINGS.equipment
    const start = Number.isInteger(saved.start) ? saved.start! : DEFAULT_SETTINGS.start
    const end = Number.isInteger(saved.end) ? saved.end! : DEFAULT_SETTINGS.end
    const validRange = 0 <= start && start < end && end <= MAX_LEVEL
    const slackPercent =
      Number.isInteger(saved.slackPercent) && saved.slackPercent! >= 0 && saved.slackPercent! <= MAX_SLACK_PERCENT
        ? saved.slackPercent!
        : DEFAULT_SETTINGS.slackPercent
    return {
      equipment,
      start: validRange ? start : DEFAULT_SETTINGS.start,
      end: validRange ? end : DEFAULT_SETTINGS.end,
      slackPercent,
      prices: {
        blessing: saved.prices?.blessing ?? DEFAULT_SETTINGS.prices.blessing,
        materials: { ...DEFAULT_SETTINGS.prices.materials, ...saved.prices?.materials },
      },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** 設定存在瀏覽器裡，下次打開還在 */
export function useRefineSettings() {
  const [settings, setSettings] = useState(load)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // 無痕模式等情況存不了，不影響使用
    }
  }, [settings])
  return [settings, setSettings] as const
}
