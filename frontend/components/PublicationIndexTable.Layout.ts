import { Publication, PublicationKey } from "modules/publication";
import { TransitionEventHandler, useState } from "react";

type ColId = PublicationKey;

const ATTRIBUTES = Publication.ATTRIBUTES;

// ─── Configuration ───────────────────────────────────────────────────────────
// Sizing knobs only. The animation's *timing* is the table's `duration-300`
// Tailwind class (a plain CSS transition), not a value here.

const STRIP_REM = 1; // width a collapsed column shrinks to, in rem
const SIGNAL_REM = 2.5; // width of the optional leading signal column, in rem

// Relative column widths (default 1): the two titles get more room, Year the
// least (it only ever holds a 4-digit value).
const WEIGHT: Partial<Record<ColId, number>> = {
  originalTitle: 1.5,
  title: 1.5,
  year: 0.6,
};

// The content columns that stretch to absorb the space a collapse frees up.
const GROWABLE: readonly ColId[] = [
  "originalTitle",
  "originalAuthors",
  "title",
  "authors",
];
// Columns that never grow, so they can't absorb a collapse (Year).
const FIXED: readonly ColId[] = ["year"];

const weightOf = (col: ColId) => WEIGHT[col] ?? 1;
const sumWeights = (cols: readonly ColId[]) =>
  cols.reduce((total, col) => total + weightOf(col), 0);
const TOTAL_WEIGHT = sumWeights(ATTRIBUTES);

const isCollapsed = (
  col: ColId,
  hidden: readonly ColId[],
  collapsible: boolean,
) =>
  collapsible &&
  Publication.ATTRIBUTE_IS_TOGGLEABLE[col] &&
  hidden.includes(col);

// ─── One `grid-template-columns` value ───────────────────────────────────────
// The model: a collapsed column becomes a fixed `STRIP_REM` strip. Whatever is
// left — the table minus the signal column and every strip — is split across the
// visible columns by weight. A collapse "frees" the weight of the columns it hid;
// `allocate` decides which visible column(s) claim that freed weight, and is the
// ONLY thing that differs between the two stages. Since the freed weight is always
// handed back out in full, the denominator stays `TOTAL_WEIGHT` and the tracks add
// back up to 100%.

const round = (n: number) => Math.round(n * 1e4) / 1e4;

// A single track as CSS: a percentage of the table, plus a rem offset.
const formatTrack = (pct: number, rem: number) => {
  const p = round(pct);
  const r = round(rem);
  return r === 0
    ? `${p}%`
    : `calc(${p}% ${r < 0 ? "-" : "+"} ${Math.abs(r)}rem)`;
};

function template(
  hidden: readonly ColId[],
  hasSignal: boolean,
  collapsible: boolean,
  allocate: (col: ColId, freedWeight: number) => number,
): string {
  const collapsed = (col: ColId) => isCollapsed(col, hidden, collapsible);
  const strips = ATTRIBUTES.filter(collapsed);
  const freedWeight = sumWeights(strips);

  // The visible columns share the table minus the signal column and every strip.
  const reservedRem = (hasSignal ? SIGNAL_REM : 0) + strips.length * STRIP_REM;

  const tracks = ATTRIBUTES.map((col) => {
    if (collapsed(col)) return `${STRIP_REM}rem`;
    const share = (weightOf(col) + allocate(col, freedWeight)) / TOTAL_WEIGHT;
    return formatTrack(100 * share, -reservedRem * share);
  });

  const signal = hasSignal ? `${SIGNAL_REM}rem` : null;
  return [signal, ...tracks].filter(Boolean).join(" ");
}

// Stage 2 — settled: the visible growable columns share the freed weight, in
// proportion to their own weight.
function settledTemplate(
  hidden: readonly ColId[],
  hasSignal: boolean,
  collapsible: boolean,
): string {
  const growableWeight = sumWeights(
    GROWABLE.filter((col) => !isCollapsed(col, hidden, collapsible)),
  );
  return template(hidden, hasSignal, collapsible, (col, freedWeight) =>
    GROWABLE.includes(col) ? (freedWeight * weightOf(col)) / growableWeight : 0,
  );
}

// Stage 1 — collapsing: one absorbing column takes ALL the freed weight, so the
// gap closes toward it before stage 2 spreads the space out.
function collapsingTemplate(
  hidden: readonly ColId[],
  hasSignal: boolean,
  collapsible: boolean,
  absorber: ColId,
): string {
  return template(hidden, hasSignal, collapsible, (col, freedWeight) =>
    col === absorber ? freedWeight : 0,
  );
}

// ─── Which column absorbs the collapse (the direction) ───────────────────────
// The hidden column folds toward the table edge it sits nearer to, judged by the
// total weight on each side (measured on the full layout, so already-collapsed
// strips still count). The lighter side is the nearer one: fold that way, and the
// visible column on the *far* side grows to fill. Returns null when we can't tell
// what was just hidden, or nothing on the far side can grow.
function chooseAbsorber(
  hidden: readonly ColId[],
  justHidden: ColId | null,
): ColId | null {
  if (justHidden === null) return null;
  const k = ATTRIBUTES.indexOf(justHidden);

  const canGrow = (col: ColId) => !hidden.includes(col) && !FIXED.includes(col);
  const weightBetween = (from: number, to: number) =>
    sumWeights(ATTRIBUTES.slice(from, to));

  const foldsLeft =
    weightBetween(0, k) < weightBetween(k + 1, ATTRIBUTES.length);
  const farSide = ATTRIBUTES.filter(
    (col, i) => canGrow(col) && (foldsLeft ? i > k : i < k),
  );
  if (farSide.length === 0) return null;
  // Fold left → the rightmost far-side column grows; fold right → the leftmost.
  return foldsLeft ? farSide[farSide.length - 1] : farSide[0];
}

// The single column that was just hidden (present now, absent before), or null if
// this wasn't exactly one column being hidden (a restore, a reset, a bulk change).
function justHiddenColumn(
  previous: readonly string[],
  hidden: readonly ColId[],
): ColId | null {
  const added = hidden.filter((col) => !previous.includes(col));
  return added.length === 1 ? added[0] : null;
}

// ─── The hook ────────────────────────────────────────────────────────────────
// Plays the collapse in two stages. Hiding a column starts stage 1 (`collapsing`,
// toward the chosen absorber); when stage 1's grid transition ends, we switch to
// stage 2 (`settled`). Restores and multi-column changes skip stage 1 and settle
// straight away. State is adjusted *during render* on a change, so stage 1 paints
// with no flash of the settled layout; the stage-1→2 handoff rides the grid's own
// `transitionend`, so there's no timer to keep in step with the CSS duration.
//
// Returns the CSS variables the table reads — `--rb-cols-collapsing` /
// `--rb-cols-settled`, picked by the `collapsing:`/`settled:` Tailwind variants
// off `data-phase` — plus the `transitionend` handler that ends stage 1.

type Phase = { name: "settled" } | { name: "collapsing"; absorber: ColId };

export function useColumnLayout(
  hidden: readonly ColId[],
  hasSignal: boolean,
  collapsible: boolean,
): {
  vars: Record<string, string>;
  phase: "collapsing" | "settled";
  onSettle: TransitionEventHandler<HTMLDivElement>;
} {
  const key = hidden.join(",");
  const [state, setState] = useState<{ key: string; phase: Phase }>({
    key,
    phase: { name: "settled" },
  });

  if (state.key !== key) {
    const previous = state.key ? state.key.split(",") : [];
    const absorber = chooseAbsorber(hidden, justHiddenColumn(previous, hidden));
    setState({
      key,
      phase: absorber ? { name: "collapsing", absorber } : { name: "settled" },
    });
  }

  const onSettle: TransitionEventHandler<HTMLDivElement> = (event) => {
    const ownGridTransition =
      event.target === event.currentTarget &&
      event.propertyName === "grid-template-columns";
    if (ownGridTransition && state.phase.name === "collapsing") {
      setState({ key, phase: { name: "settled" } });
    }
  };

  const settled = settledTemplate(hidden, hasSignal, collapsible);
  const collapsing =
    state.phase.name === "collapsing"
      ? collapsingTemplate(hidden, hasSignal, collapsible, state.phase.absorber)
      : settled;

  return {
    vars: {
      "--rb-cols-collapsing": collapsing,
      "--rb-cols-settled": settled,
    },
    phase: state.phase.name,
    onSettle,
  };
}
