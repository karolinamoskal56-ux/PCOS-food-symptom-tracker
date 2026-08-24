import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { estimatePhaseForDate, cycleSummary } from './cycle.js';

// `window.supabase` comes from vendor-supabase.js (a self-hosted copy of the
// Supabase JS library, loaded via a plain <script> tag in index.html).
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s) => {
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};
const blankDay = () => ({
  foods: [], energy: null, fog: null, migraine: null, sleep: null, movement: '', notes: '',
  snack2: null, snack5: null, crash: null, gym: null, inositol: null,
});
const energyColor = (v) => v >= 4 ? 'var(--sage)' : v === 3 ? 'var(--amber)' : v ? 'var(--clay-soft)' : 'var(--line)';

const state = {
  userId: null,
  email: null,
  entries: [],   // all rows from `entries`, one per logged day
  cycles: [],    // all rows from `cycles`
  currentDate: todayStr(),
  dayData: blankDay(),
};

// ---------- data access ----------

function entryFor(date) {
  const row = state.entries.find(e => e.entry_date === date);
  return row ? { ...blankDay(), ...row } : blankDay();
}

async function loadAllData() {
  const [{ data: entries, error: e1 }, { data: cycles, error: e2 }] = await Promise.all([
    supabase.from('entries').select('*').order('entry_date', { ascending: false }),
    supabase.from('cycles').select('*').order('start_date', { ascending: false }),
  ]);
  if (e1) console.error('load entries failed', e1);
  if (e2) console.error('load cycles failed', e2);
  state.entries = entries || [];
  state.cycles = cycles || [];
}

async function persistCurrentDay(silent) {
  const payload = {
    user_id: state.userId,
    entry_date: state.currentDate,
    foods: state.dayData.foods,
    energy: state.dayData.energy,
    fog: state.dayData.fog,
    migraine: state.dayData.migraine,
    sleep: state.dayData.sleep === '' || state.dayData.sleep === null ? null : Number(state.dayData.sleep),
    movement: state.dayData.movement || null,
    notes: state.dayData.notes || null,
    snack2: state.dayData.snack2,
    snack5: state.dayData.snack5,
    crash: state.dayData.crash,
    gym: state.dayData.gym,
    inositol: state.dayData.inositol,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('entries')
    .upsert(payload, { onConflict: 'user_id,entry_date' })
    .select()
    .single();
  if (error) { console.error('save failed', error); return; }

  const idx = state.entries.findIndex(e => e.entry_date === state.currentDate);
  if (idx >= 0) state.entries[idx] = data; else state.entries.unshift(data);

  if (!silent) {
    const msg = document.getElementById('saveMsg');
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 1600);
  }
  renderRibbon();
}

// ---------- today tab: food ----------

function renderFoodList() {
  const el = document.getElementById('foodList');
  if (!state.dayData.foods.length) {
    el.innerHTML = '<p style="color:var(--ink-soft);font-size:13px;">Nothing logged yet today.</p>';
    return;
  }
  el.innerHTML = state.dayData.foods.map((f, i) => `
    <div class="fooditem">
      <span class="meal-tag">${f.meal}</span>
      <span class="txt">${escapeHtml(f.text)}</span>
      <button class="rm" data-i="${i}" title="Remove">&times;</button>
    </div>
  `).join('');
  el.querySelectorAll('.rm').forEach(btn => {
    btn.onclick = () => {
      state.dayData.foods.splice(+btn.dataset.i, 1);
      renderFoodList();
      persistCurrentDay(true);
    };
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.getElementById('addFoodBtn').onclick = () => {
  const input = document.getElementById('foodInput');
  const meal = document.getElementById('mealType').value;
  const text = input.value.trim();
  if (!text) return;
  state.dayData.foods.push({ meal, text, t: new Date().toISOString() });
  input.value = '';
  renderFoodList();
  persistCurrentDay(true);
};
document.getElementById('foodInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addFoodBtn').click(); }
});

// ---------- today tab: scales / check-in ----------

function renderScales() {
  const d = state.dayData;
  document.querySelectorAll('#energyScale button').forEach(b => b.classList.toggle('sel', +b.dataset.val === d.energy));
  document.querySelectorAll('#fogScale button').forEach(b => b.classList.toggle('sel', +b.dataset.val === d.fog));
  document.querySelectorAll('#migraineOpts button').forEach(b => b.classList.toggle('sel', b.dataset.val === d.migraine));
  document.getElementById('sleepInput').value = d.sleep ?? '';
  document.getElementById('movementInput').value = d.movement || '';
  document.getElementById('notesInput').value = d.notes || '';

  document.querySelectorAll('#snack2Opts button').forEach(b => b.classList.toggle('sel', b.dataset.val === d.snack2));
  document.querySelectorAll('#snack5Opts button').forEach(b => b.classList.toggle('sel', b.dataset.val === d.snack5));
  document.querySelectorAll('#crashOpts button').forEach(b => b.classList.toggle('sel', b.dataset.val === d.crash));
  document.querySelectorAll('#gymOpts button').forEach(b => b.classList.toggle('sel', b.dataset.val === d.gym));
  document.querySelectorAll('#inositolOpts button').forEach(b => b.classList.toggle('sel', b.dataset.val === d.inositol));
}

document.getElementById('energyScale').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  state.dayData.energy = +e.target.dataset.val; renderScales();
});
document.getElementById('fogScale').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  state.dayData.fog = +e.target.dataset.val; renderScales();
});
document.getElementById('migraineOpts').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  state.dayData.migraine = e.target.dataset.val; renderScales();
});
document.getElementById('snack2Opts').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  state.dayData.snack2 = e.target.dataset.val; renderScales(); persistCurrentDay(true);
});
document.getElementById('snack5Opts').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  state.dayData.snack5 = e.target.dataset.val; renderScales(); persistCurrentDay(true);
});
document.getElementById('crashOpts').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  state.dayData.crash = e.target.dataset.val; renderScales(); persistCurrentDay(true);
});
document.getElementById('gymOpts').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  state.dayData.gym = e.target.dataset.val; renderScales(); persistCurrentDay(true);
});
document.getElementById('inositolOpts').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  state.dayData.inositol = e.target.dataset.val; renderScales(); persistCurrentDay(true);
});

document.getElementById('saveDayBtn').onclick = () => {
  state.dayData.sleep = document.getElementById('sleepInput').value;
  state.dayData.movement = document.getElementById('movementInput').value;
  state.dayData.notes = document.getElementById('notesInput').value;
  persistCurrentDay(false);
};

// ---------- tabs ----------

document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['today', 'history', 'doctor'].forEach(t => {
      document.getElementById('tab-' + t).style.display = (t === btn.dataset.tab) ? 'block' : 'none';
    });
    if (btn.dataset.tab === 'history') renderHistory();
  };
});

// ---------- ribbon ----------

function renderRibbon() {
  const el = document.getElementById('ribbon');
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  el.innerHTML = days.map(date => {
    const data = entryFor(date);
    const hasData = data.energy || data.foods.length;
    const pct = data.energy ? (data.energy / 5 * 100) : 8;
    const color = energyColor(data.energy);
    const dot = (data.migraine && data.migraine !== 'none') ? '<div class="dot"></div>' : '<div style="height:6px;margin-top:4px;"></div>';
    const lbl = new Date(date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric' });
    return `<div class="rday ${hasData ? '' : 'empty'}" data-date="${date}" title="${fmtDate(date)}">
      <div class="bar"><div class="fill" style="height:${pct}%;background:${color};"></div></div>
      ${dot}
      <div class="lbl">${lbl}</div>
    </div>`;
  }).join('');
  el.querySelectorAll('.rday').forEach(cell => {
    cell.onclick = () => {
      state.currentDate = cell.dataset.date;
      state.dayData = entryFor(state.currentDate);
      renderFoodList(); renderScales();
      document.querySelector('nav.tabs button[data-tab="today"]').click();
    };
  });
}

// ---------- history ----------

function renderHistory() {
  const el = document.getElementById('historyList');
  if (!state.entries.length) {
    el.innerHTML = '<div class="empty-state">No entries yet. Start logging on the Today tab and your history will build up here.</div>';
    return;
  }
  const all = state.entries.map(row => ({ date: row.entry_date, data: { ...blankDay(), ...row } }));
  const tracked = all.filter(x => x.data.snack2 || x.data.snack5 || x.data.crash || x.data.gym || x.data.inositol);

  let summaryHtml = '';
  if (tracked.length) {
    const bothSnacks = tracked.filter(x => x.data.snack2 === 'yes' && x.data.snack5 === 'yes');
    const missedOne = tracked.filter(x => x.data.snack2 === 'no' || x.data.snack5 === 'no');
    const rate = (arr, cond) => arr.length ? Math.round(arr.filter(cond).length / arr.length * 100) : null;
    const hardCrashBoth = rate(bothSnacks, x => x.data.crash === 'hard');
    const hardCrashMissed = rate(missedOne, x => x.data.crash === 'hard');
    const gymBoth = rate(bothSnacks, x => x.data.gym === 'yes');
    const gymMissed = rate(missedOne, x => x.data.gym === 'yes');
    const inositolDays = tracked.filter(x => x.data.inositol);
    const inositolRate = rate(inositolDays, x => x.data.inositol === 'yes');
    summaryHtml = `<div class="ribbon-card">
      <div class="ribbon-title">Snack days vs. missed-snack days (${tracked.length} tracked days)</div>
      <div style="font-size:13px;color:var(--ink-soft);line-height:1.8;">
        Both snacks (${bothSnacks.length} days): hard crash ${hardCrashBoth === null ? '—' : hardCrashBoth + '%'} of days · gym ${gymBoth === null ? '—' : gymBoth + '%'} of days<br>
        Missed a snack (${missedOne.length} days): hard crash ${hardCrashMissed === null ? '—' : hardCrashMissed + '%'} of days · gym ${gymMissed === null ? '—' : gymMissed + '%'} of days
        ${inositolDays.length ? `<br>Inositol taken ${inositolRate === null ? '—' : inositolRate + '%'} of tracked days (${inositolDays.length} days logged)` : ''}
      </div>
    </div>`;
  }

  const rows = all.filter(x => x.data.energy || x.data.foods.length || x.data.notes || x.data.snack2 || x.data.snack5 || x.data.crash || x.data.gym || x.data.inositol || x.data.migraine || x.data.sleep || x.data.movement).map(({ date, data }) => {
    const foodsTxt = data.foods.length ? data.foods.map(f => `${f.meal}: ${escapeHtml(f.text)}`).join(' · ') : '<span style="color:var(--ink-soft)">No food logged</span>';
    const tags = [];
    const phase = estimatePhaseForDate(date, state.cycles);
    if (phase) tags.push(`<span class="tag phase">${phase.phase}</span>`);
    if (data.energy) tags.push(`<span class="tag energy" style="background:${energyColor(data.energy)}">Energy ${data.energy}/5</span>`);
    if (data.fog) tags.push(`<span class="tag">Fog ${data.fog}/5</span>`);
    if (data.migraine && data.migraine !== 'none') tags.push(`<span class="tag migraine">Migraine: ${data.migraine}</span>`);
    if (data.sleep) tags.push(`<span class="tag">${data.sleep}h sleep</span>`);
    if (data.movement) tags.push(`<span class="tag">${data.movement}</span>`);
    if (data.snack2) tags.push(`<span class="tag" style="${data.snack2 === 'yes' ? 'border-color:var(--sage);color:var(--pine);' : ''}">2pm snack: ${data.snack2 === 'yes' ? '✓' : '✕'}</span>`);
    if (data.snack5) tags.push(`<span class="tag" style="${data.snack5 === 'yes' ? 'border-color:var(--sage);color:var(--pine);' : ''}">5pm snack: ${data.snack5 === 'yes' ? '✓' : '✕'}</span>`);
    if (data.crash && data.crash !== 'none') tags.push(`<span class="tag migraine" style="background:${data.crash === 'hard' ? 'var(--clay)' : 'var(--clay-soft)'};border-color:transparent;">Crash: ${data.crash}</span>`);
    if (data.gym) tags.push(`<span class="tag" style="${data.gym === 'yes' ? 'border-color:var(--sage);color:var(--pine);' : ''}">Gym: ${data.gym === 'yes' ? '✓' : '✕'}</span>`);
    if (data.inositol) tags.push(`<span class="tag" style="${data.inositol === 'yes' ? 'border-color:var(--plum);color:var(--plum);' : ''}">Inositol: ${data.inositol === 'yes' ? '✓' : '✕'}</span>`);
    return `<div class="hist-day">
      <div class="hd"><span class="date">${fmtDate(date)}</span><div class="tags">${tags.join('')}</div></div>
      <div class="foods">${foodsTxt}</div>
      ${data.notes ? `<div class="note">"${escapeHtml(data.notes)}"</div>` : ''}
    </div>`;
  }).join('') || '<div class="empty-state">No entries yet.</div>';

  el.innerHTML = summaryHtml + rows;
}

// ---------- doctor summary ----------

document.getElementById('docBuildBtn').onclick = () => {
  const from = document.getElementById('docFrom').value;
  const to = document.getElementById('docTo').value;
  const out = document.getElementById('doctorOutput');
  if (!from || !to) { out.innerHTML = '<p style="color:var(--clay)">Pick both a start and end date.</p>'; return; }

  const all = state.entries
    .filter(row => row.entry_date >= from && row.entry_date <= to)
    .sort((a, b) => a.entry_date < b.entry_date ? -1 : 1)
    .map(row => ({ date: row.entry_date, data: { ...blankDay(), ...row } }));

  if (!all.length) { out.innerHTML = '<p style="color:var(--ink-soft)">No entries in that range.</p>'; return; }

  const withData = all.filter(x => x.data.energy || x.data.foods.length || x.data.notes || (x.data.migraine && x.data.migraine !== 'none'));
  const migraineDays = withData.filter(x => x.data.migraine && x.data.migraine !== 'none').length;
  const avg = (vals) => vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—';
  const avgEnergy = avg(withData.map(x => x.data.energy).filter(Boolean));
  const avgFog = avg(withData.map(x => x.data.fog).filter(Boolean));

  const cs = cycleSummary(state.cycles);

  let html = `<h3>Summary: ${fmtDate(from)} – ${fmtDate(to)}</h3>
    <div class="drow"><b>Days logged:</b> ${withData.length} of ${all.length} in range</div>
    <div class="drow"><b>Average energy:</b> ${avgEnergy} / 5</div>
    <div class="drow"><b>Average brain fog:</b> ${avgFog} / 5</div>
    <div class="drow"><b>Migraine days:</b> ${migraineDays}</div>
    <div class="drow"><b>Cycles logged (all time):</b> ${cs.count}${cs.avgCycleLength ? ` &nbsp; <b>Average cycle length:</b> ${cs.avgCycleLength} days` : ''}</div>
    <div class="drow" style="color:var(--ink-soft);font-style:italic;font-size:12.5px;">Cycle phases below are estimates based on self-logged period dates, not a medical prediction.</div>`;

  html += withData.map(({ date, data }) => {
    const foodsTxt = data.foods.length ? data.foods.map(f => `${f.meal.toLowerCase()}: ${escapeHtml(f.text)}`).join('; ') : 'no food logged';
    const phase = estimatePhaseForDate(date, state.cycles);
    return `<h3>${fmtDate(date)}</h3>
      <div class="drow"><b>Energy:</b> ${data.energy || '—'}/5 &nbsp; <b>Fog:</b> ${data.fog || '—'}/5 &nbsp; <b>Migraine:</b> ${data.migraine && data.migraine !== 'none' ? data.migraine : 'none'} &nbsp; <b>Sleep:</b> ${data.sleep || '—'}h &nbsp; <b>Movement:</b> ${data.movement || '—'}</div>
      <div class="drow"><b>Cycle phase (estimate):</b> ${phase ? phase.phase : '—'}</div>
      <div class="drow"><b>Food:</b> ${foodsTxt}</div>
      ${data.notes ? `<div class="drow"><b>Notes:</b> ${escapeHtml(data.notes)}</div>` : ''}`;
  }).join('');

  out.innerHTML = html;
};
document.getElementById('docPrintBtn').onclick = () => window.print();

// ---------- cycle widget ----------

function renderCycleWidget() {
  const phase = estimatePhaseForDate(todayStr(), state.cycles);
  const pill = document.getElementById('phasePill');
  pill.textContent = phase ? `${phase.phase} · day ${phase.cycleDay}` : 'Not enough data yet';

  const cs = cycleSummary(state.cycles);
  document.getElementById('cycleMeta').textContent = cs.avgCycleLength
    ? `Average cycle: ${cs.avgCycleLength} days (from ${cs.count} logged)`
    : (cs.count ? 'Log one more period to see an average cycle length.' : 'Log a period start below to begin estimating phase.');

  const sorted = [...state.cycles].sort((a, b) => a.start_date < b.start_date ? 1 : -1);
  const hist = document.getElementById('cycleHistory');
  hist.innerHTML = sorted.slice(0, 4).map(c => {
    const len = c.end_date ? `${Math.round((new Date(c.end_date) - new Date(c.start_date)) / 86400000) + 1}d` : 'ongoing';
    return `<div class="chrow"><span>${fmtDate(c.start_date)}${c.end_date ? ' – ' + fmtDate(c.end_date) : ''}</span><span>${len}</span></div>`;
  }).join('');
}

async function logCycle() {
  const startVal = document.getElementById('periodStartInput').value;
  const endVal = document.getElementById('periodEndInput').value;
  if (!startVal && !endVal) return;

  if (startVal) {
    const payload = { user_id: state.userId, start_date: startVal, updated_at: new Date().toISOString() };
    if (endVal) payload.end_date = endVal;
    const { data, error } = await supabase.from('cycles').upsert(payload, { onConflict: 'user_id,start_date' }).select().single();
    if (error) { console.error('cycle save failed', error); return; }
    const idx = state.cycles.findIndex(c => c.start_date === startVal);
    if (idx >= 0) state.cycles[idx] = data; else state.cycles.unshift(data);
  } else {
    // Only an end date was given — close the most recent open period.
    const open = [...state.cycles].filter(c => !c.end_date).sort((a, b) => a.start_date < b.start_date ? 1 : -1)[0];
    if (!open) { alert('Log a period start first.'); return; }
    const { data, error } = await supabase.from('cycles').update({ end_date: endVal, updated_at: new Date().toISOString() }).eq('id', open.id).select().single();
    if (error) { console.error('cycle update failed', error); return; }
    const idx = state.cycles.findIndex(c => c.id === open.id);
    state.cycles[idx] = data;
  }

  document.getElementById('periodStartInput').value = '';
  document.getElementById('periodEndInput').value = '';
  renderCycleWidget();
  renderRibbon();
}
document.getElementById('logCycleBtn').onclick = logCycle;

// ---------- export ----------

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

document.getElementById('exportJsonBtn').onclick = () => {
  const payload = { entries: state.entries, cycles: state.cycles, exported_at: new Date().toISOString() };
  downloadBlob(`food-symptom-log-${todayStr()}.json`, JSON.stringify(payload, null, 2), 'application/json');
};

document.getElementById('exportCsvBtn').onclick = () => {
  const cols = ['date', 'energy', 'fog', 'migraine', 'sleep', 'movement', 'snack2', 'snack5', 'crash', 'gym', 'inositol', 'cycle_phase', 'foods', 'notes'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [...state.entries].sort((a, b) => a.entry_date < b.entry_date ? -1 : 1).map(row => {
    const phase = estimatePhaseForDate(row.entry_date, state.cycles);
    const foods = (row.foods || []).map(f => `${f.meal}: ${f.text}`).join(' | ');
    return [row.entry_date, row.energy, row.fog, row.migraine, row.sleep, row.movement, row.snack2, row.snack5, row.crash, row.gym, row.inositol, phase ? phase.phase : '', foods, row.notes]
      .map(esc).join(',');
  });
  downloadBlob(`food-symptom-log-${todayStr()}.csv`, [cols.join(','), ...rows].join('\n'), 'text/csv');
};

// ---------- auth ----------

document.getElementById('authSendBtn').onclick = async () => {
  const email = document.getElementById('authEmail').value.trim();
  const msg = document.getElementById('authMsg');
  msg.classList.remove('err');
  if (!email) { msg.textContent = 'Enter your email first.'; msg.classList.add('err'); return; }
  msg.textContent = 'Sending link…';
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  if (error) { msg.textContent = error.message; msg.classList.add('err'); return; }
  msg.textContent = 'Check your email for a sign-in link.';
};

document.getElementById('signOutBtn').onclick = async () => {
  await supabase.auth.signOut();
};

async function showApp(session) {
  state.userId = session.user.id;
  state.email = session.user.email;
  document.getElementById('accountEmail').textContent = state.email;
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appRoot').classList.remove('hidden');

  await loadAllData();
  state.currentDate = todayStr();
  state.dayData = entryFor(state.currentDate);

  const today = todayStr();
  document.getElementById('docFrom').value = today;
  document.getElementById('docTo').value = today;

  renderFoodList();
  renderScales();
  renderRibbon();
  renderCycleWidget();
}

function showAuth() {
  document.getElementById('appRoot').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
}

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) showApp(session); else showAuth();
});

(async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await showApp(session); else showAuth();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
