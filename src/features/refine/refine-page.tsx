import { ChevronRightIcon } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { type EquipmentId, EQUIPMENTS, MAX_LEVEL, type Material, REFINE_FEE, type RefineOption } from './data'
import { formatCount, formatPercent, formatSignedCount, formatSignedZeny, formatZeny } from './format'
import { type RefinePlan, optimizePlan } from './optimizer'
import { PriceInput } from './price-input'
import { DEFAULT_SETTINGS, MAX_SLACK_PERCENT, useRefineSettings } from './use-refine-settings'

export function RefinePage() {
  const [settings, setSettings] = useRefineSettings()
  const equipment = EQUIPMENTS[settings.equipment]
  const plan = useMemo(
    () => optimizePlan(equipment, settings.prices, settings.start, settings.end, settings.slackPercent / 100),
    [equipment, settings.prices, settings.start, settings.end, settings.slackPercent],
  )

  useEffect(() => {
    document.title = '精煉 · RO Toolbox'
  }, [])

  const setMaterialPrice = (id: string, value: number) =>
    setSettings((s) => ({ ...s, prices: { ...s.prices, materials: { ...s.prices.materials, [id]: value } } }))
  const setBlessingPrice = (value: number) => setSettings((s) => ({ ...s, prices: { ...s.prices, blessing: value } }))

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 p-4 md:p-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <div>
          <h1 className="text-xl font-semibold">精煉</h1>
          <p className="text-sm text-muted-foreground">
            依材料行情找出最省錢的精煉做法，也可以多花一點換更少的精煉次數。只考慮失敗不會爆裝的選項。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>裝備與範圍</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label>裝備</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                className="w-full"
                value={settings.equipment}
                onValueChange={(value) => value && setSettings((s) => ({ ...s, equipment: value as EquipmentId }))}
              >
                {Object.values(EQUIPMENTS).map((e) => (
                  <ToggleGroupItem key={e.id} value={e.id} className="flex-1">
                    {e.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="grid gap-3">
              <div className="flex items-baseline justify-between">
                <Label>精煉範圍</Label>
                <span className="text-sm font-medium tabular-nums">
                  +{settings.start} → +{settings.end}
                </span>
              </div>
              <Slider
                min={0}
                max={MAX_LEVEL}
                step={1}
                minStepsBetweenThumbs={1}
                value={[settings.start, settings.end]}
                onValueChange={([start, end]) => setSettings((s) => ({ ...s, start, end }))}
                aria-label="精煉範圍"
                thumbLabels={['起點精煉值', '目標精煉值']}
              />
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>+0</span>
                <span>+{MAX_LEVEL}</span>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="flex items-baseline justify-between">
                <Label>可接受多花</Label>
                <span className="text-sm font-medium tabular-nums">
                  {settings.slackPercent === 0 ? '0%（最省錢）' : `${settings.slackPercent}%`}
                </span>
              </div>
              <Slider
                min={0}
                max={MAX_SLACK_PERCENT}
                step={1}
                value={[settings.slackPercent]}
                onValueChange={([slackPercent]) => setSettings((s) => ({ ...s, slackPercent }))}
                aria-label="可接受多花的百分比"
                thumbLabels={['可接受多花的百分比']}
              />
              <p className="text-xs text-muted-foreground">在比最省錢多花不超過這個比例的做法中，挑平均精煉次數最少的。</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>行情</CardTitle>
            <CardDescription>可依你伺服器的行情修改，設定會存在這個瀏覽器。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {equipment.materials.map((m) => (
              <PriceInput
                key={m.id}
                label={m.name}
                hint={materialHint(m)}
                value={settings.prices.materials[m.id] ?? 0}
                onChange={(v) => setMaterialPrice(m.id, v)}
                copyable
              />
            ))}
            <PriceInput
              label="鐵匠的祝福"
              hint="+7~+13，失敗不變"
              copyable
              value={settings.prices.blessing}
              onChange={setBlessingPrice}
            />
            <Button
              variant="ghost"
              size="sm"
              className="justify-self-start text-muted-foreground"
              onClick={() => setSettings((s) => ({ ...s, prices: DEFAULT_SETTINGS.prices }))}
            >
              恢復預設價格
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid content-start gap-4">
        <Summary plan={plan} />
        <StepsCard plan={plan} />
        <UsageCard plan={plan} blessingPrice={settings.prices.blessing} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          期望值是大量重複精煉的平均，單次運氣可能差很多。+10 以上只有會爆的材料，所以一定搭配鐵匠的祝福。精煉費以每次
          {formatZeny(REFINE_FEE.low)}（+0~+9）、{formatZeny(REFINE_FEE.high)}（+10 以上）計算。成功率與材料規則沿用
          <a
            className="underline underline-offset-2"
            href="https://vkmouse.github.io/simulate-refining/"
            target="_blank"
            rel="noreferrer"
          >
            RO 精煉模擬器
          </a>
          （2022.09.08）。
        </p>
      </div>
    </div>
  )
}

function materialHint(m: Material) {
  const range = `+${m.from}~+${m.to}`
  return m.penalty.kind === 'down' ? `${range}，失敗退 ${m.penalty.levels} 級` : `${range}，需搭配祝福`
}

function optionLabel(o: RefineOption) {
  return o.blessing ? `${o.material.name} + 祝福 ×${o.blessingCount}` : o.material.name
}

function failLabel(o: RefineOption) {
  if (o.probability >= 1) return '—'
  if (o.failTo === o.level) return '不變'
  return `退到 +${o.failTo}`
}

function Summary({ plan }: { plan: RefinePlan }) {
  const materialCost = plan.materials.reduce((sum, m) => sum + m.cost, 0)
  const tiles = [
    { label: '期望總花費', value: formatZeny(plan.totalCost), unit: 'z' },
    { label: '平均精煉次數', value: formatCount(plan.totalAttempts), unit: '次' },
    { label: '平均祝福用量', value: formatCount(plan.blessingCount), unit: '個' },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          +{plan.start} → +{plan.end} {plan.slack > 0 ? `做法（可多花 ${Math.round(plan.slack * 100)}%）` : '最省錢做法'}
        </CardTitle>
        <CardDescription>
          材料 {formatZeny(materialCost)} · 祝福 {formatZeny(plan.blessingCost)} · 精煉費 {formatZeny(plan.feeCost)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">{t.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {t.value}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{t.unit}</span>
              </div>
            </div>
          ))}
        </div>
        {plan.slack > 0 && <SlackComparison plan={plan} />}
      </CardContent>
    </Card>
  )
}

function SlackComparison({ plan }: { plan: RefinePlan }) {
  const extraCost = plan.totalCost - plan.cheapest.totalCost
  const savedAttempts = plan.cheapest.totalAttempts - plan.totalAttempts
  if (savedAttempts < 0.005) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        多花 {Math.round(plan.slack * 100)}% 以內找不到次數更少的做法，和最省錢做法相同。
      </p>
    )
  }
  return (
    <p className="rounded-lg border border-dashed p-3 text-sm leading-relaxed">
      比最省錢多花 <strong className="tabular-nums">{formatZeny(extraCost)}</strong>
      <span className="text-muted-foreground tabular-nums">
        （+{((extraCost / plan.cheapest.totalCost) * 100).toFixed(1)}%）
      </span>
      ，平均少敲 <strong className="tabular-nums">{formatCount(savedAttempts)}</strong> 下
      <span className="text-muted-foreground tabular-nums">
        （{formatCount(plan.cheapest.totalAttempts)} → {formatCount(plan.totalAttempts)}）
      </span>
      ，相當於每少敲一下多花 <strong className="tabular-nums">{formatZeny(extraCost / savedAttempts)}</strong> z。
    </p>
  )
}

function StepsCard({ plan }: { plan: RefinePlan }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [showBelowStart, setShowBelowStart] = useState(false)
  const belowStartCount = plan.steps.filter((s) => s.belowStart).length
  const steps = showBelowStart ? plan.steps : plan.steps.filter((s) => !s.belowStart)
  return (
    <Card>
      <CardHeader>
        <CardTitle>每一級的選擇</CardTitle>
        <CardDescription>點一列可以比較這一級的其他做法，以及只換這一級時整趟花費與次數的變化。</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">精煉值</TableHead>
              <TableHead>採用做法</TableHead>
              <TableHead className="text-right">成功率</TableHead>
              <TableHead>失敗時</TableHead>
              <TableHead className="text-right">平均次數</TableHead>
              <TableHead className="text-right">升一級期望花費</TableHead>
              <TableHead className="text-right">累計期望花費</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {belowStartCount > 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="py-1.5">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-muted-foreground"
                    onClick={() => setShowBelowStart((v) => !v)}
                  >
                    {showBelowStart
                      ? '隱藏起點以下的級數'
                      : `顯示失敗掉級才會用到的 ${belowStartCount} 級（+${plan.steps[0].level} ~ +${plan.start - 1}）`}
                  </Button>
                </TableCell>
              </TableRow>
            )}
            {steps.map((step) => {
              const o = step.choice.option
              const open = expanded === step.level
              const canExpand = step.alternatives.length > 1
              return (
                <Fragment key={step.level}>
                  <TableRow
                    className={cn(canExpand && 'cursor-pointer', step.belowStart && 'text-muted-foreground')}
                    onClick={() => canExpand && setExpanded(open ? null : step.level)}
                    aria-expanded={canExpand ? open : undefined}
                  >
                    <TableCell className="font-medium tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <ChevronRightIcon
                          className={cn('size-3.5 transition-transform', open && 'rotate-90', !canExpand && 'invisible')}
                        />
                        +{step.level}→{step.level + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        {o.material.name}
                        {o.blessing && <Badge variant="secondary">祝福 ×{o.blessingCount}</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPercent(o.probability)}</TableCell>
                    <TableCell>{failLabel(o)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(step.expectedAttempts)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatZeny(step.choice.costToNext)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {step.cumulativeCost === null ? '—' : formatZeny(step.cumulativeCost)}
                    </TableCell>
                  </TableRow>
                  {open && (
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell />
                      <TableCell colSpan={6} className="py-3">
                        <Alternatives step={step} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function Alternatives({ step }: { step: RefinePlan['steps'][number] }) {
  const chosen = step.choice
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-muted-foreground">
        <tr>
          <th className="pb-1 text-left font-normal">做法</th>
          <th className="pb-1 pl-3 text-right font-normal">成功率</th>
          <th className="pb-1 pl-3 text-left font-normal">失敗時</th>
          <th className="pb-1 pl-3 text-right font-normal">升一級期望花費</th>
          <th className="pb-1 pl-3 text-right font-normal">整趟花費差</th>
          <th className="pb-1 pl-3 text-right font-normal">整趟次數差</th>
          <th className="pb-1 pl-3 text-right font-normal">換算</th>
        </tr>
      </thead>
      <tbody>
        {step.alternatives.map((alt) => {
          const isChosen = alt.option === chosen.option
          const dCost = alt.totalCost - chosen.totalCost
          const dAttempts = alt.totalAttempts - chosen.totalAttempts
          return (
            <tr key={optionLabel(alt.option)} className={cn(isChosen && 'font-medium')}>
              <td className="py-0.5">
                <span className="inline-flex items-center gap-1.5">
                  {optionLabel(alt.option)}
                  {isChosen && <Badge variant="secondary">採用</Badge>}
                </span>
              </td>
              <td className="py-0.5 pl-3 text-right tabular-nums">{formatPercent(alt.option.probability)}</td>
              <td className="py-0.5 pl-3">{failLabel(alt.option)}</td>
              <td className="py-0.5 pl-3 text-right tabular-nums">{formatZeny(alt.costToNext)}</td>
              <td className="py-0.5 pl-3 text-right tabular-nums">{isChosen ? '—' : formatSignedZeny(dCost)}</td>
              <td className="py-0.5 pl-3 text-right tabular-nums">{isChosen ? '—' : formatSignedCount(dAttempts)}</td>
              <td className="py-0.5 pl-3 text-right text-muted-foreground tabular-nums">
                {isChosen ? '' : tradeOffLabel(dCost, dAttempts)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** 換成這個做法時，每少敲一下要多花多少（或每多敲一下能省多少） */
function tradeOffLabel(dCost: number, dAttempts: number) {
  const fewer = dAttempts < -0.005
  const more = dAttempts > 0.005
  if (fewer && dCost > 0) return `每少敲一下多花 ${formatZeny(dCost / -dAttempts)}`
  if (more && dCost < 0) return `每多敲一下省 ${formatZeny(-dCost / dAttempts)}`
  if (dCost >= 0 && !fewer) return '較差'
  return '較好'
}

function UsageCard({ plan, blessingPrice }: { plan: RefinePlan; blessingPrice: number }) {
  const rows = [
    ...plan.materials.map((m) => ({ name: m.material.name, count: m.count, cost: m.cost })),
    ...(plan.blessingCount > 0 ? [{ name: '鐵匠的祝福', count: plan.blessingCount, cost: plan.blessingCount * blessingPrice }] : []),
    { name: '精煉費', count: plan.totalAttempts, cost: plan.feeCost },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>平均要準備的材料</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>項目</TableHead>
              <TableHead className="text-right">平均數量</TableHead>
              <TableHead className="text-right">花費</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(r.count)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatZeny(r.cost)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-medium">
              <TableCell>合計</TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums">{formatZeny(plan.totalCost)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
