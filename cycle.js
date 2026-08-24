// Cycle-phase estimation.
//
// This is a rough estimate built from *your own logged period dates* —
// nothing more. It assumes a standard ~14-day luteal phase (the days
// between ovulation and the next period), which is the one part of the
// cycle that stays fairly constant even when the rest doesn't. PCOS can
// make ovulation timing irregular, so treat this as a rough label, not a
// prediction — accuracy improves the more cycles you log.

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PERIOD_LEN = 5;
const DEFAULT_CYCLE_LEN = 28;
const LUTEAL_LEN = 14;

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / DAY_MS);
}

// cycles: array of { start_date, end_date } (end_date may be null), any order.
export function averageCycleLength(cycles) {
  const starts = [...new Set(cycles.map(c => c.start_date))].sort();
  if (starts.length < 2) return null;
  const diffs = [];
  for (let i = 1; i < starts.length; i++) diffs.push(daysBetween(starts[i - 1], starts[i]));
  return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
}

export function averagePeriodLength(cycles) {
  const withEnd = cycles.filter(c => c.end_date);
  if (!withEnd.length) return null;
  const lens = withEnd.map(c => daysBetween(c.start_date, c.end_date) + 1);
  return Math.round(lens.reduce((a, b) => a + b, 0) / lens.length);
}

// Estimates the cycle phase for a given date, based on logged period history.
// Returns null if there's no logged period on or before that date yet.
export function estimatePhaseForDate(dateStr, cycles) {
  const sorted = [...cycles].sort((a, b) => a.start_date < b.start_date ? -1 : 1);
  let current = null;
  let next = null;
  for (const c of sorted) {
    if (c.start_date <= dateStr) current = c;
    else if (!next) next = c;
  }
  if (!current) return null;

  const cycleDay = daysBetween(current.start_date, dateStr) + 1;
  const periodLen = current.end_date
    ? daysBetween(current.start_date, current.end_date) + 1
    : (averagePeriodLength(sorted) || DEFAULT_PERIOD_LEN);

  const priorCycles = sorted.filter(c => c.start_date < current.start_date);
  const cycleLen = next
    ? daysBetween(current.start_date, next.start_date)
    : (averageCycleLength([...priorCycles, current]) || DEFAULT_CYCLE_LEN);

  const ovulationDay = cycleLen - LUTEAL_LEN;

  if (cycleDay <= periodLen) return { phase: 'Menstrual', cycleDay, cycleLen };
  if (cycleDay <= ovulationDay - 2) return { phase: 'Follicular', cycleDay, cycleLen };
  if (cycleDay <= ovulationDay + 1) return { phase: 'Ovulatory', cycleDay, cycleLen };
  if (cycleDay <= cycleLen) return { phase: 'Luteal', cycleDay, cycleLen };
  return { phase: 'Luteal (running long)', cycleDay, cycleLen };
}

export function cycleSummary(cycles) {
  const count = new Set(cycles.map(c => c.start_date)).size;
  return {
    count,
    avgCycleLength: averageCycleLength(cycles),
    avgPeriodLength: averagePeriodLength(cycles),
  };
}
