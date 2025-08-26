import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Plus, Trash2, Info } from "lucide-react";

// ---------- Utilities ----------
const fmtCurrency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ---------- Types ----------
type Bracket = { upper: number | null; rate: number };

// Clean and sort brackets; coalesce invalid values
function normalizeBrackets(brackets: Bracket[]): Bracket[] {
  const filtered = brackets
    .filter((b) => b.rate >= 0 && (b.upper === null || b.upper >= 0))
    .slice();
  // sort by upper with null (Infinity) last
  filtered.sort((a, b) => {
    if (a.upper === null && b.upper === null) return 0;
    if (a.upper === null) return 1;
    if (b.upper === null) return -1;
    return a.upper - b.upper;
  });
  // ensure last bracket exists (Infinity)
  if (!filtered.length || filtered[filtered.length - 1].upper !== null) {
    filtered.push({ upper: null, rate: filtered.length ? filtered[filtered.length - 1].rate : 0.37 });
  }
  return filtered;
}

// Compute per-bracket allocations for a given taxable income
function computeTax(income: number, bracketsRaw: Bracket[]) {
  const brackets = normalizeBrackets(bracketsRaw);
  let last = 0;
  const lines = [] as {
    from: number;
    to: number | null;
    span: number | null; // if null -> open ended
    amount: number; // income taxed in this bracket
    tax: number;
    rate: number;
  }[];

  for (const b of brackets) {
    const upper = b.upper ?? Infinity;
    const span = upper - last; // may be Infinity
    const taxableHere = Math.max(0, Math.min(income, upper) - last);
    const tax = taxableHere * b.rate;
    lines.push({ from: last, to: b.upper, span: isFinite(span) ? span : null, amount: taxableHere, tax, rate: b.rate });
    last = upper;
    if (income <= upper) break;
  }

  const totalTax = lines.reduce((acc, x) => acc + x.tax, 0);
  const marginalRate = lines.length ? lines[lines.length - 1].rate : 0;
  const avgRate = income > 0 ? totalTax / income : 0;
  return { lines, totalTax, marginalRate, avgRate };
}

// Map a global progress [0,1] to how much income has flowed through all buckets
function flowByProgress(progress: number, _income: number, lines: ReturnType<typeof computeTax>["lines"]) {
  // Total income that *could* flow (capped to income)
  const cumulativeCaps = lines.map((l) => l.amount);
  const totalPossible = cumulativeCaps.reduce((a, b) => a + b, 0);
  const flowing = totalPossible * progress;
  const alloc = [] as number[];
  let remaining = flowing;
  for (const cap of cumulativeCaps) {
    const take = Math.max(0, Math.min(cap, remaining));
    alloc.push(take);
    remaining -= take;
  }
  return alloc; // per-bracket flowed income
}

// ---------- Main Component ----------
export default function App() {
  // Example from the user's slide (approximate, 2018 married-filing-joint numbers)
  const [brackets, setBrackets] = useState<Bracket[]>([
    { upper: 19050, rate: 0.10 },
    { upper: 77400, rate: 0.12 },
    { upper: 165000, rate: 0.22 },
    { upper: 315000, rate: 0.24 },
    { upper: 400000, rate: 0.32 },
    { upper: 600000, rate: 0.35 },
    { upper: null, rate: 0.37 },
  ]);

  // Income & deductions -> taxable income
  const [grossIncome, setGrossIncome] = useState<number>(200000);
  const [deductions, setDeductions] = useState<number>(0);
  const taxableIncome = Math.max(0, Math.round(grossIncome - deductions));

  // Animation controls
  const [playing, setPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(1); // 1 = fully allocated by default
  const durationMs = 4200; // total animation time
  const rafRef = useRef<number | null>(null);
  const tStart = useRef<number | null>(null);

  // Derived tax computation
  const result = useMemo(() => computeTax(taxableIncome, brackets), [taxableIncome, brackets]);
  const flowed = useMemo(() => flowByProgress(progress, taxableIncome, result.lines), [progress, taxableIncome, result.lines]);

  // Animate with requestAnimationFrame
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      tStart.current = null;
      return;
    }
    const step = (t: number) => {
      if (tStart.current == null) tStart.current = t;
      const elapsed = t - tStart.current;
      const p = Math.min(1, elapsed / durationMs);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setPlaying(false);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const maxFiniteUpper = useMemo(() => {
    const finite = normalizeBrackets(brackets).filter((b) => b.upper !== null).map((b) => b.upper as number);
    return finite.length ? finite[finite.length - 1] : 250000;
  }, [brackets]);

  // Handlers
  const addBracket = () => {
    const lastFinite = normalizeBrackets(brackets).filter((b) => b.upper !== null).slice(-1)[0];
    const newUpper = lastFinite ? Math.round((lastFinite.upper as number) * 1.3) : 50000;
    const newRate = brackets.length ? Math.min(0.55, brackets[brackets.length - 1].rate + 0.03) : 0.10;
    const withoutInfinity = brackets.filter((_b, i) => i !== brackets.length - 1);
    setBrackets([...withoutInfinity, { upper: newUpper, rate: newRate }, { upper: null, rate: Math.min(0.60, newRate + 0.05) }]);
  };

  const resetExample = () => {
    setBrackets([
      { upper: 19050, rate: 0.10 },
      { upper: 77400, rate: 0.12 },
      { upper: 165000, rate: 0.22 },
      { upper: 315000, rate: 0.24 },
      { upper: 400000, rate: 0.32 },
      { upper: 600000, rate: 0.35 },
      { upper: null, rate: 0.37 },
    ]);
    setGrossIncome(200000);
    setDeductions(0);
    setPlaying(false);
    setProgress(1);
  };

  const play = () => {
    setProgress(0);
    setPlaying(true);
  };

  // Calculate per-bracket *visible* fill ratio under current progress
  const visibleFillRatios = result.lines.map((line, i) => {
    const flowedHere = flowed[i] ?? 0;
    if (line.span == null) return Math.min(1, flowedHere / (line.amount || 1)); // for open-ended, scale by actual amount
    return Math.min(1, flowedHere / line.span);
  });

  // Colors palette (kept neutral by default; Tailwind will assign theme colors)
  const bucketColors = [
    "bg-sky-300",
    "bg-blue-300",
    "bg-indigo-300",
    "bg-violet-300",
    "bg-fuchsia-300",
    "bg-pink-300",
    "bg-rose-300",
  ];

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Progressive Tax Bracket Visualizer</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={play}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 shadow-sm bg-slate-900 text-white hover:bg-slate-800"
            >
              <Play className="h-4 w-4" />
              Play
            </button>
            <button
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 shadow-sm bg-white ring-1 ring-slate-200 hover:bg-slate-100"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Info className="h-4 w-4" />} {playing ? "Pause" : "Idle"}
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                setProgress(1);
              }}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 shadow-sm bg-white ring-1 ring-slate-200 hover:bg-slate-100"
            >
              <RotateCcw className="h-4 w-4" />
              Fill Instantly
            </button>
          </div>
        </header>

        {/* Top metrics */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Metric label="Gross Income" value={fmtCurrency(grossIncome)} />
          <Metric label="Deductions" value={fmtCurrency(deductions)} />
          <Metric label="Taxable Income" value={fmtCurrency(taxableIncome)} highlight />
          <Metric label="Total Tax (at full fill)" value={fmtCurrency(result.totalTax)} />
        </section>

        {/* Controls */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
            <h2 className="font-semibold mb-3">Income & Deductions</h2>
            <LabeledNumber
              label="Gross income"
              value={grossIncome}
              onChange={(v) => setGrossIncome(Math.max(0, v))}
              min={0}
              max={Math.max(100000, maxFiniteUpper * 1.5)}
              step={1000}
            />
            <LabeledNumber
              label="Deductions (standard + itemized)"
              value={deductions}
              onChange={(v) => setDeductions(Math.max(0, v))}
              min={0}
              max={grossIncome}
              step={1000}
            />
            <p className="mt-2 text-sm text-slate-600">Taxable income = max(0, gross − deductions).</p>
          </div>

          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Tax Brackets</h2>
              <div className="flex items-center gap-2">
                <button onClick={addBracket} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-4 w-4"/>Add bracket</button>
                <button onClick={resetExample} className="rounded-xl px-3 py-2 ring-1 ring-slate-200 hover:bg-slate-100">Reset example</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-slate-600">
                    <th className="py-2">#</th>
                    <th className="py-2">Upper bound</th>
                    <th className="py-2">Rate</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizeBrackets(brackets).map((b, i) => (
                    <tr key={i} className="border-t border-slate-200">
                      <td className="py-2 pr-3">{i + 1}</td>
                      <td className="py-2 pr-3">
                        {b.upper === null ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">∞ (top)</span>
                        ) : (
                          <input
                            type="number"
                            className="w-40 rounded-lg border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-400"
                            value={b.upper}
                            min={0}
                            step={1000}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              const nb = [...brackets];
                              // find the index of this row within original brackets list (may be different last Infinity row)
                              // We'll rebuild by: take all except last Infinity, edit the i-th finite row.
                              const finite = nb.filter((x) => x.upper !== null);
                              const inf = nb.find((x) => x.upper === null) ?? { upper: null, rate: 0.37 };
                              const idx = Math.min(i, finite.length - 1);
                              finite[idx] = { ...finite[idx], upper: isNaN(v) ? 0 : v };
                              // sort finite and rebuild list ending with Infinity
                              finite.sort((a, b) => (a.upper! - b.upper!));
                              setBrackets([...finite, inf]);
                            }}
                          />
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={Math.round(b.rate * 1000) / 10}
                            min={0}
                            max={99}
                            step={0.1}
                            onChange={(e) => {
                              const v = Math.max(0, Number(e.target.value) / 100);
                              const nb = [...brackets];
                              nb[i] = { ...nb[i], rate: v };
                              setBrackets(nb);
                            }}
                            className="w-24 rounded-lg border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-400"
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        {b.upper === null ? null : (
                          <button
                            onClick={() => {
                              const finite = brackets.filter((x) => x.upper !== null);
                              const inf = brackets.find((x) => x.upper === null)!;
                              const idx = i; // row index corresponds to finite index
                              finite.splice(idx, 1);
                              setBrackets([...finite, inf]);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 ring-1 ring-slate-200 hover:bg-slate-100"
                          >
                            <Trash2 className="h-4 w-4" />
                            remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">Rows are sorted by upper bound automatically; the last row is the open-ended top bracket.</p>
          </div>
        </section>

        {/* Visual buckets */}
        <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 p-4 mb-6">
          <h2 className="font-semibold mb-4">How income fills the brackets</h2>
          <div className="flex items-end gap-3 overflow-x-auto pb-4">
            {result.lines.map((line, i) => {
              const color = bucketColors[i % bucketColors.length];
              const height = 220; // px
              const filledPx = Math.min(height, (visibleFillRatios[i] * height));
              const displayLabel = `${line.to ? `${fmtCurrency(line.from)}–${fmtCurrency(line.to)}` : `${fmtCurrency(line.from)}+`}`;
              return (
                <div key={i} className="flex w-48 min-w-[11rem] flex-col items-stretch">
                  <div className="relative h-[240px] w-full rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 overflow-hidden">
                    {/* bucket body */}
                    <div className="absolute inset-x-0 bottom-0">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: filledPx }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className={`w-full ${color}`}
                      />
                    </div>
                    {/* rate badge */}
                    <div className="absolute top-2 right-2 rounded-full bg-slate-900/80 text-white text-xs px-2 py-1">{Math.round(line.rate * 100)}%</div>
                    {/* amount labels */}
                    <div className="absolute inset-x-0 bottom-2 text-center text-xs font-medium text-slate-700">
                      {flowed[i] > 0 && <div>Taxed: {fmtCurrency(Math.min(flowed[i], line.amount))}</div>}
                    </div>
                  </div>
                  <div className="mt-2 text-sm font-medium">Bracket {i + 1}</div>
                  <div className="text-xs text-slate-600">{displayLabel}</div>
                </div>
              );
            })}
          </div>

          {/* Flow progress bar showing total tax composed by bracket */}
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Tax from each bracket (builds as the flow runs)</h3>
            <div className="relative h-6 w-full rounded-full bg-slate-100 overflow-hidden ring-1 ring-slate-200">
              <div className="absolute inset-y-0 left-0 flex w-full">
                {result.lines.map((l, i) => {
                  const taxCap = l.tax;
                  const proportion = l.amount ? (flowed[i] / l.amount) : 0;
                  const taxNow = Math.max(0, Math.min(1, proportion)) * taxCap;
                  const widthPct = result.totalTax > 0 ? (taxNow / result.totalTax) * 100 : 0;
                  return (
                    <motion.div
                      key={i}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className={`h-full ${bucketColors[i % bucketColors.length]} border-r border-white/60 last:border-r-0`}
                      title={`Bracket ${i + 1}: ${Math.round(l.rate * 100)}%  — tax now ${fmtCurrency(taxNow)}`}
                    />
                  );
                })}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-600 flex items-center justify-between">
              <span>Current progress: {(progress * 100).toFixed(0)}%</span>
              <span>
                Total tax so far: {fmtCurrency(result.lines.reduce((sum, l, i) => {
                  const proportion = l.amount ? Math.min(1, (flowed[i] / l.amount)) : 0;
                  return sum + l.tax * proportion;
                }, 0))}
              </span>
            </div>
          </div>
        </section>

        {/* Table of bracket math */}
        <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-3">
            <div>
              <h2 className="font-semibold">Bracket-by-bracket math</h2>
              <p className="text-sm text-slate-600">Shows how much of your taxable income lands in each bracket and the tax owed for that slice.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric small label="Average rate" value={fmtPct(result.avgRate)} />
              <Metric small label="Marginal rate" value={fmtPct(result.marginalRate)} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-600">
                  <th className="py-2">Bracket</th>
                  <th className="py-2">Range</th>
                  <th className="py-2">Rate</th>
                  <th className="py-2">Income in bracket</th>
                  <th className="py-2">Tax from bracket</th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map((l, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="py-2">{i + 1}</td>
                    <td className="py-2">{l.to ? `${fmtCurrency(l.from)} – ${fmtCurrency(l.to)}` : `${fmtCurrency(l.from)}+`}</td>
                    <td className="py-2">{Math.round(l.rate * 100)}%</td>
                    <td className="py-2">{fmtCurrency(l.amount)}</td>
                    <td className="py-2">{fmtCurrency(l.tax)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td className="py-2" colSpan={3}>Totals</td>
                  <td className="py-2">{fmtCurrency(result.lines.reduce((a, x) => a + x.amount, 0))}</td>
                  <td className="py-2">{fmtCurrency(result.totalTax)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-10 text-center text-xs text-slate-500">
          Tip: Adjust income, deductions, and bracket rows, then hit <span className="font-semibold">Play</span> to watch the buckets fill from left to right. The top bar shows how total tax builds from each bracket.
        </footer>
      </div>
    </div>
  );
}

// ---------- Small components ----------
function Metric({ label, value, highlight = false, small = false }: { label: string; value: string; highlight?: boolean; small?: boolean }) {
  return (
    <div className={`rounded-2xl ${highlight ? "bg-amber-50 ring-1 ring-amber-200" : "bg-white ring-1 ring-slate-200"} shadow-sm p-3 ${small ? "" : "md:p-4"}`}>
      <div className={`text-xs uppercase tracking-wide ${highlight ? "text-amber-700" : "text-slate-500"}`}>{label}</div>
      <div className={`font-semibold ${small ? "text-sm" : "text-lg"}`}>{value}</div>
    </div>
  );
}

function LabeledNumber({ label, value, onChange, min = 0, max = 1000000, step = 1000 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-sm text-slate-700">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          className="w-48 rounded-lg border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-400"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <input
          type="range"
          className="w-full"
          min={min}
          max={max}
          step={step}
          value={Math.min(value, max)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
