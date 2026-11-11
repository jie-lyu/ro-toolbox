import { CheckIcon, CopyIcon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatZeny } from './format'

interface PriceInputProps {
  label: string
  hint?: string
  value: number
  onChange: (value: number) => void
  /** 顯示複製名稱的按鈕（材料名可貼到遊戲或交易站搜尋） */
  copyable?: boolean
}

export function PriceInput({ label, hint, value, onChange, copyable = false }: PriceInputProps) {
  const id = useId()
  const labelId = `${id}-label`
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        {/* 不用 <label>：它會擋住選取文字，名稱改用 aria-labelledby 對應輸入框 */}
        <span className="flex min-h-6 items-center gap-0.5">
          <span id={labelId} className="font-medium select-text">
            {label}
          </span>
          {copyable && <CopyButton text={label} />}
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <Input
        id={id}
        aria-labelledby={labelId}
        inputMode="numeric"
        className="text-right tabular-nums"
        value={formatZeny(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 13)
          onChange(digits ? Number(digits) : 0)
        }}
        onFocus={(e) => e.target.select()}
      />
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="text-muted-foreground"
      aria-label={copied ? `已複製 ${text}` : `複製 ${text}`}
      title={copied ? '已複製' : '複製名稱'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
        } catch {
          // 剪貼簿被瀏覽器擋住時，名稱本身仍可手動選取複製
        }
      }}
    >
      {copied ? <CheckIcon className="text-emerald-600" /> : <CopyIcon />}
    </Button>
  )
}
