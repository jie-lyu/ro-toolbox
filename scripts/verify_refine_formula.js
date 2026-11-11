// 驗證 RO 精煉期望值公式 —— 對照 https://vkmouse.github.io/simulate-refining/ 的模擬邏輯
// 執行: node verify_refine_formula.js
'use strict';

// ---------- 網站內建資料（抄自 main.39af7b70.js） ----------
const PROB = {
  'W1:N': [1, 1, 1, 1, 1, 1, 1, .6, .4, .19, .18, .18, .18, .18, .18, .17, .17, .17, .15, .15],
  'W2:N': [1, 1, 1, 1, 1, 1, .6, .4, .2, .19, .18, .18, .18, .18, .18, .17, .17, .17, .15, .15],
  'W3:N': [1, 1, 1, 1, 1, .6, .5, .2, .2, .19, .18, .18, .18, .18, .18, .17, .17, .17, .15, .15],
  'W4:N': [1, 1, 1, 1, .6, .4, .4, .2, .2, .09, .08, .08, .08, .08, .08, .07, .07, .07, .05, .05],
  'W5:N': [1, 1, 1, .6, .6, .4, .4, .2, .2, .09, .08, .08, .08, .08, .07, .07, .07, .07, .05, .05],
  'A1:N': [1, 1, 1, 1, .6, .4, .4, .2, .2, .09, .08, .08, .08, .08, .08, .07, .07, .07, .05, .05],
  'A2:N': [1, 1, 1, .6, .6, .4, .4, .2, .2, .09, .08, .08, .08, .08, .07, .07, .07, .07, .05, .05],
  'W1:S': [1, 1, 1, 1, 1, 1, 1, .9, .7, .3, .18, .18, .18, .18, .18, .17, .17, .17, .15, .15],
  'W2:S': [1, 1, 1, 1, 1, 1, .9, .7, .4, .3, .18, .18, .18, .18, .18, .17, .17, .17, .15, .15],
  'W3:S': [1, 1, 1, 1, 1, .9, .8, .4, .4, .3, .18, .18, .18, .18, .18, .17, .17, .17, .15, .15],
  'W4:S': [1, 1, 1, 1, .9, .7, .7, .4, .4, .2, .08, .08, .08, .08, .08, .07, .07, .07, .05, .05],
  'W5:S': [1, 1, 1, .9, .7, .6, .6, .4, .4, .2, .15, .15, .15, .15, .1, .1, .1, .1, .07, .07],
  'A1:S': [1, 1, 1, 1, .9, .7, .7, .4, .4, .2, .08, .08, .08, .08, .08, .07, .07, .07, .05, .05],
  'A2:S': [1, 1, 1, .9, .7, .6, .6, .4, .4, .2, .15, .15, .15, .15, .1, .1, .1, .1, .07, .07],
};
// 失敗懲罰: 'break' = 爆裝, 數字 d = 退 d 級
const MATERIAL = {
  Phracon: { cat: 'N', fail: 'break' }, Emveretarcon: { cat: 'N', fail: 'break' },
  Oridecon: { cat: 'N', fail: 'break' }, EnrichedOridecon: { cat: 'S', fail: 'break' },
  HDOridecon: { cat: 'S', fail: 1 }, Bradium: { cat: 'N', fail: 3 }, HDBradium: { cat: 'S', fail: 1 },
  Etherdeocon: { cat: 'N', fail: 3 }, EnrichedEtherdeocon: { cat: 'S', fail: 1 },
  EtelBradium: { cat: 'N', fail: 'break' }, HDEtherdeocon: { cat: 'S', fail: 'break' },
  HDEtelBradium: { cat: 'S', fail: 'break' },
  Elunium: { cat: 'N', fail: 'break' }, EnrichedElunium: { cat: 'S', fail: 'break' },
  HDElunium: { cat: 'S', fail: 1 }, Carnium: { cat: 'N', fail: 3 }, HDCarnium: { cat: 'S', fail: 1 },
  Etherium: { cat: 'N', fail: 3 }, EnrichedEthernium: { cat: 'S', fail: 1 },
  EtelCarnium: { cat: 'N', fail: 'break' }, HDEthernium: { cat: 'S', fail: 'break' },
  HDEtelCarnium: { cat: 'S', fail: 'break' },
};
const BLESSING_DEMAND = [0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 4, 9, 15, 0, 0, 0, 0, 0, 0];

// 把「使用者設定」轉成每一級的 (p, 失敗型態, 單次成本 c, 祝福用量 b)
function build(cfg) {
  const L = [];
  for (let i = 0; i < 20; i++) {
    const name = cfg.materials[i];
    const m = MATERIAL[name];
    const bless = i >= 7 && i < 14 && !cfg.weaponRefine && !!cfg.blessing[i];
    const bonus = cfg.weaponRefine && i < 10 && m.cat === 'N' ? 0.1 : 0;
    const p = Math.round(100 * Math.min(PROB[cfg.equip + ':' + m.cat][i] + bonus, 1)) / 100;
    const b = bless ? BLESSING_DEMAND[i] : 0;
    const fee = i < 10 ? cfg.price.feeBefore10 : cfg.price.feeAfter10;
    L.push({
      p, b,
      fail: bless ? 'stay' : m.fail, // 祝福: 失敗原地不動
      matPrice: cfg.price[name] || 0, fee,
      c: (cfg.price[name] || 0) + fee + b * cfg.price.blessing, // 單次精煉總成本
    });
  }
  return L;
}
const failTarget = (L, i) => (L[i].fail === 'stay' ? i : L[i].fail === 'break' ? -1 : Math.max(0, i - L[i].fail));

// ---------- (1) 蒙地卡羅：照網站的寫法逐行重現 ----------
function simulate(cfg, N, rng = Math.random) {
  const L = build(cfg), { start: s, end: e } = cfg;
  const T = Array(20).fill(0), B = Array(20).fill(0), S = Array(20).fill(0);
  for (let n = 0; n < N; n++) {
    const succ = Array(20).fill(0);
    let cur = s;
    while (cur !== -1 && cur !== e) {
      const prev = cur;
      cur = rng() < L[prev].p ? prev + 1 : failTarget(L, prev);
      T[prev]++; B[prev] += L[prev].b;
      if (cur > prev) succ[prev] = 1; // 注意: 網站是 numSuccess = 1（每個樣本每級最多記一次）
    }
    for (let i = 0; i < 20; i++) S[i] += succ[i];
  }
  // 價格期望值: 網站的遞推 o[l] = o[l-1]*a[l-1]/a[l] + 單價*數量/a[l]
  const rows = [];
  for (let i = 0; i < 20; i++) if (S[i] !== 0) rows.push(i);
  const chain = (unit, qty, init = 0, initCount = 0) => {
    const o = []; let prevO = init, prevA = initCount;
    for (const i of rows) { const v = prevO * prevA / S[i] + unit(i) * qty(i) / S[i]; o.push(v); prevO = v; prevA = S[i]; }
    return o;
  };
  const eq = chain(() => 0, () => 0, cfg.price.equipment, N);
  const mat = chain(i => L[i].matPrice, i => T[i]);
  const bl = chain(() => cfg.price.blessing, i => B[i]);
  const fee = chain(i => L[i].fee, i => T[i]);
  return rows.map((i, k) => ({ level: i, T: T[i] / N, B: B[i] / N, S: S[i] / N, cost: eq[k] + mat[k] + bl[k] + fee[k] }));
}

// ---------- 小工具: 高斯消去解 A x = y ----------
function solve(A, y) {
  const n = y.length, M = A.map((r, i) => [...r, y[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) {
      const f = M[r][c] / M[c][c];
      if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

// ---------- (2) 公式 A：前向遞推（封閉式） ----------
// X_{i+1} = X_i + (c_i + (1-p_i) R_i) / p_i ,  X_s = P
//   祝福: R_i = 0     爆裝: R_i = X_i     退 d 級: R_i = X_i - X_{max(0,i-d)}
function formulaRecursion(cfg) {
  const L = build(cfg), { start: s, end: e } = cfg, P = cfg.price.equipment;
  const G = Array(20).fill(NaN); // G_i = X_{i+1} - X_i
  const X = Array(21).fill(NaN);
  // s 以下的級數只在「退級」時才會踩到；若那裡是爆裝型，前向遞推不適用 (留 NaN)
  for (let i = 0; i < s; i++) {
    const f = L[i].fail, q = 1 - L[i].p;
    if (f === 'stay') G[i] = L[i].c / L[i].p;
    else if (f !== 'break') { let R = 0; for (let j = Math.max(0, i - f); j < i; j++) R += G[j]; G[i] = (L[i].c + q * R) / L[i].p; }
  }
  X[s] = P;
  for (let i = s - 1; i >= 0; i--) X[i] = X[i + 1] - G[i]; // 形式上的延伸值
  for (let i = s; i < e; i++) {
    const f = L[i].fail, q = 1 - L[i].p;
    const R = f === 'stay' ? 0 : f === 'break' ? X[i] : (q === 0 ? 0 : X[i] - X[Math.max(0, i - f)]);
    G[i] = (L[i].c + q * R) / L[i].p;
    X[i + 1] = X[i] + G[i];
  }
  return X; // X[k] = 做出一件 +k 的期望總成本
}

// ---------- (3) 公式 B：一般解（線性方程組） ----------
// V_i = c_i + p_i V_{i+1} + q_i W_i , V_e = 0 ; W_i = V_i | P + V_s | V_{max(0,i-d)} ; 答案 = P + V_s
function formulaLinear(cfg, end = cfg.end) {
  const L = build(cfg), s = cfg.start, e = end, P = cfg.price.equipment;
  const A = Array.from({ length: e }, () => Array(e).fill(0)), y = Array(e).fill(0);
  for (let i = 0; i < e; i++) {
    const { p, c } = L[i], q = 1 - p, t = failTarget(L, i);
    A[i][i] += 1; y[i] += c;
    if (i + 1 < e) A[i][i + 1] -= p;
    if (t === -1) { A[i][s] -= q; y[i] += q * P; } else A[i][t] -= q;
  }
  return P + solve(A, y)[s];
}

// ---------- (4) 模擬表格每一欄的極限值（單次樣本的吸收馬可夫鏈） ----------
function tableLimits(cfg) {
  const L = build(cfg), { start: s, end: e } = cfg, P = cfg.price.equipment;
  // tau_j = 每個樣本在第 j 級的期望精煉次數 = e_s^T (I - Q)^{-1}
  const At = Array.from({ length: e }, () => Array(e).fill(0)), y = Array(e).fill(0);
  for (let i = 0; i < e; i++) {
    At[i][i] += 1;
    const t = failTarget(L, i), q = 1 - L[i].p;
    if (i + 1 < e) At[i + 1][i] -= L[i].p;
    if (t >= 0) At[t][i] -= q;
  }
  y[s] = 1;
  const tau = solve(At, y);
  // sigma_i = 一個樣本中「第 i 級至少成功一次」的機率
  const sigma = [];
  for (let i = 0; i < e; i++) {
    const A = Array.from({ length: e }, () => Array(e).fill(0)), r = Array(e).fill(0);
    for (let k = 0; k < e; k++) {
      A[k][k] += 1;
      const t = failTarget(L, k), q = 1 - L[k].p;
      if (k === i) r[k] += L[k].p; else if (k + 1 < e) A[k][k + 1] -= L[k].p;
      if (t >= 0) A[k][t] -= q;
    }
    sigma.push(solve(A, r)[s]);
  }
  const rows = []; let acc = P;
  for (let i = 0; i < e; i++) {
    if (!(tau[i] > 1e-12)) continue;
    acc += L[i].c * tau[i];
    rows.push({ level: i, T: tau[i], B: L[i].b * tau[i], S: sigma[i], cost: acc / sigma[i] });
  }
  return rows;
}

// ---------- 測試案例 ----------
const price = { equipment: 5e6, blessing: 3e6, feeBefore10: 1e4, feeAfter10: 1e5,
  Phracon: 200, Bradium: 3e4, HDBradium: 6e5, Etherdeocon: 5e4, EnrichedEtherdeocon: 4e5, EtelBradium: 8e4,
  Oridecon: 5e3, HDOridecon: 3e5 };
const mats = (lo, hi) => Array.from({ length: 20 }, (_, i) => (i < 10 ? lo : hi));
const bl = (...ix) => { const a = Array(20).fill(false); ix.forEach(i => (a[i] = true)); return a; };
const cases = [
  { name: '0. 網站預設: 武器Lv1 4→11, 不用祝福, 10 用鈽鐳 (退 3)', equip: 'W1', start: 4, end: 11, materials: mats('Phracon', 'Bradium'), blessing: bl() },
  { name: 'A. 武器Lv1 4→11, 7~10 全用祝福', equip: 'W1', start: 4, end: 11, materials: mats('Phracon', 'Bradium'), blessing: bl(7, 8, 9, 10) },
  { name: 'B. 武器Lv1 4→10, 不用祝福 (失敗爆裝)', equip: 'W1', start: 4, end: 10, materials: mats('Phracon', 'Bradium'), blessing: bl() },
  { name: 'C. 武器Lv1 4→12, 只在 9 用祝福; 10,11 鈽鐳失敗退 3', equip: 'W1', start: 4, end: 12, materials: mats('Phracon', 'Bradium'), blessing: bl(9) },
  { name: 'D. 武器Lv1 10→13, 高密度鈽鐳 (退 1), 會掉到起點以下', equip: 'W1', start: 10, end: 13, materials: mats('Phracon', 'HDBradium'), blessing: bl(7, 8, 9) },
  { name: 'E. 武器Lv5 0→12, 乙太神金 (退 3) + 乙太鈽鐳 (爆)', equip: 'W5', start: 0, end: 12, materials: mats('Etherdeocon', 'EtelBradium'), blessing: bl() },
  { name: 'F. 神工匠武器精煉 +10%: 武器Lv4 0→10 神之金屬', equip: 'W4', start: 0, end: 10, materials: mats('Oridecon', 'Bradium'), blessing: bl(), weaponRefine: true },
  { name: 'G. 邊界: 10→12 鈽鐳退 3, 而 7~9 不用祝福會爆 (前向遞推不適用)', equip: 'W1', start: 10, end: 12, materials: mats('Phracon', 'Bradium'), blessing: bl() },
];

const N = Number(process.argv[2] || 400000);
const fmt = x => (Number.isFinite(x) ? Math.round(x).toLocaleString('en-US') : String(x)).padStart(16);
const f4 = x => x.toFixed(4).padStart(9);
for (const c of cases) {
  const cfg = { weaponRefine: false, ...c, price };
  const sim = simulate(cfg, N), lim = tableLimits(cfg), X = formulaRecursion(cfg);
  console.log('\n=== ' + c.name + `  (N=${N.toLocaleString()}) ===`);
  console.log('精煉值   | 次數/樣本 模擬   理論 | 成功率 模擬    理論 |   價格期望值 模擬      表格極限值 |  真實期望成本 遞推      線性方程組');
  for (const r of sim) {
    const t = lim.find(x => x.level === r.level) || {};
    const i = r.level;
    console.log(`${String(i).padStart(2)}➔${String(i + 1).padEnd(2)}   |${f4(r.T)}${f4(t.T ?? NaN)} |${f4(r.S)}${f4(t.S ?? NaN)} |${fmt(r.cost)}${fmt(t.cost ?? NaN)} |${fmt(i >= cfg.start ? X[i + 1] : NaN)}${fmt(i >= cfg.start ? formulaLinear(cfg, i + 1) : NaN)}`);
  }
}
