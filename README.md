# RO Toolbox

RO 工具箱。目前的功能：

- **精煉**：輸入材料行情與精煉範圍，算出每一級最省錢的做法（只考慮失敗不爆裝的選項）、期望總花費與平均材料用量。支援武器等級 5、防具等級 2，+0 ~ +14。

成功率表與材料規則沿用 [RO 精煉模擬器](https://vkmouse.github.io/simulate-refining/)（2022.09.08）。

## 開發

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

技術：Vite、React、TanStack Router（檔案路由，`src/routes`）、shadcn/ui、Tailwind CSS v4。

## 演算法

記 `G_i` 為從 +i 第一次升到 +i+1 的期望花費。敲一次花 `c`、成功率 `p`、失敗掉到 +f（祝福時 f = i）：

```
G_i = [ c + (1 − p) · (G_f + … + G_(i−1)) ] / p
```

每次只能升一級，要到 +e 必須依序經過每一級，所以從 +s 到 +e 的期望總花費為 `G_s + G_(s+1) + … + G_(e−1)`。

從 +i 往上只會踩到 ≤ i 的級數，且 `G_i` 隨較低級的 `G` 單調遞增，所以由 +0 往上逐級挑 `G_i` 最小的做法即為整體最佳解。

這是在「只考慮失敗不爆裝的做法」前提下、使期望花費最小的解，不考慮單次運氣的波動。測試（`src/features/refine/optimizer.test.ts`）用窮舉、線性方程組與蒙地卡羅模擬交叉驗證。

`scripts/verify_refine_formula.js` 是最初對照原網站模擬邏輯推導期望值公式的驗證腳本（`node scripts/verify_refine_formula.js`）。

## 部署

推到 GitHub 的 `main` 分支後，`.github/workflows/deploy.yml` 會自動建置並發佈到 GitHub Pages（repo 的 Settings → Pages → Source 需選 GitHub Actions）。
