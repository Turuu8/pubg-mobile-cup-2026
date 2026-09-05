/* ============================================================
   DDAM CUP — entry point
   Firebase Realtime Database is the source of truth: the admin writes
   with set(), every open client receives onValue() and re-renders, so
   the leaderboard and MVP panels update live with no refresh.
============================================================ */
import './style.css';
import html2canvas from 'html2canvas';
import { PLACEMENT, MAPS, NUM_MATCHES, NUM_TEAMS, TOURNAMENT_ID } from './config.js';
import { createStore, blankState, MODE } from './store.js';
import { computeStandings, computePlayers, matchTeamStats } from './scoring.js';
import { ICONS, rankMedal } from './icons.js';
import { enhanceSelects, setSelectState } from './select.js';
import { isConfigured, missingKeys, isLive } from './firebase.js';

/* ---------- view state (not persisted) ---------- */
let state = blankState();
let currentMatch = 1;
let showAllPlayers = false;
let formDirty = false;      // organiser has unsaved SCORE edits in the admin form
let pendingRemote = false;  // a remote update arrived while they were typing
/* Roster edits (team name/tag, player name) save themselves the moment they are
   changed — they are not scores, so they must never wait on a rank or a score.
   While one of those writes round-trips we patch the admin form in place instead
   of re-rendering it, so a half-typed kill/damage column is never wiped. */
let rosterSaving = false;
let lastSelfPublish = null; // `updated` stamp of our own last write, to ignore its echo

const $  = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const num = n => (n || 0).toLocaleString('en-US');
const teamOf = pid => state.teams.find(t => t.players.some(p => p.id === pid));
const firstUnplayedMatch = () => {
  for (let m = 1; m <= NUM_MATCHES; m++) if (!state.results[m]) return m;
  return 1;
};

/* ============================================================
   STORE WIRING — this is what makes the board live
============================================================ */
const store = createStore({
  onState(next, { fromRemote }) {
    // Our own roster write coming back: refresh the read-only halves only.
    if (rosterSaving || (fromRemote && next.updated && next.updated === lastSelfPublish)) {
      state = next;
      renderBoard();
      syncTeamCardHeaders();
      return;
    }
    // Never stomp a half-typed match result with an incoming snapshot.
    if (fromRemote && formDirty) {
      pendingRemote = true;
      state = next;
      renderBoard();          // viewers' half still updates
      renderRemoteNotice();
      return;
    }
    state = next;
    pendingRemote = false;
    if (!state.results[currentMatch] && fromRemote) currentMatch = firstUnplayedMatch();
    renderAll();
  },
  onMode: renderSyncBadge,
});

/* ============================================================
   RENDER — LEADERBOARD
============================================================ */
function renderSectionIcons() {
  $('iconStandings').innerHTML = ICONS.trophy('ico w-4 h-4');
  $('iconFrag').innerHTML      = ICONS.skull('ico w-4 h-4');
  $('iconMap').innerHTML       = ICONS.map('ico w-4 h-4');
}

function renderSyncBadge() {
  const mode = store.getMode();
  const el = $('syncBadge');
  if (!el) return;
  const cfg = {
    [MODE.LIVE]:    ['LIVE', 'text-emerald-300 border-emerald-400/50 bg-emerald-400/10', 'bg-emerald-400 animate-pulse',
                     `Live — synced to Firebase (${TOURNAMENT_ID})`],
    [MODE.SYNCING]: ['SYNC', 'text-gold border-gold/50 bg-gold/10', 'bg-gold animate-pulse',
                     'Connecting to Firebase…'],
    [MODE.LOCAL]:   ['LOCAL', 'text-slate-400 border-line bg-ink/60', 'bg-slate-500',
                     isConfigured
                       ? 'Firebase unreachable — changes are saved on this device only'
                       : `Firebase not configured (missing: ${missingKeys.join(', ') || 'all keys'}) — this device only`],
  }[mode];
  el.className = `inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[9px] font-display font-black uppercase tracking-[.15em] ${cfg[1]}`;
  el.title = cfg[3];
  el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${cfg[2]}"></span>${cfg[0]}`;
}

function renderRemoteNotice() {
  const el = $('remoteNotice');
  if (!el) return;
  el.classList.toggle('hidden', !pendingRemote);
}

function renderMapChips() {
  $('mapChips').innerHTML = MAPS.map((m, i) => {
    const played = !!state.results[i + 1];
    return `<div class="clip-tag px-3 sm:px-4 py-2 border ${played ? 'border-gold/60 bg-gold/15 shadow-[0_0_18px_-8px_rgba(245,158,11,.9)]' : 'border-line bg-ink/40'}">
      <div class="text-[9px] uppercase tracking-[.2em] font-display font-bold ${played ? 'text-gold' : 'text-slate-500'}">Match ${i + 1}</div>
      <div class="text-xs sm:text-sm font-bold ${played ? 'text-white' : 'text-slate-500'}">${m}</div>
    </div>`;
  }).join('');
}

function renderStandings() {
  const rows = computeStandings(state);
  const anyPlayed = rows.some(r => r.mp > 0);

  $('standings').innerHTML = rows.map(r => {
    const champ  = r.rank === 1 && anyPlayed;
    const rowCls = !anyPlayed ? '' : r.rank === 1 ? 'row-champ' : r.rank === 2 ? 'row-2' : r.rank === 3 ? 'row-3' : '';
    const badge  = !anyPlayed ? 'bg-panel2 text-slate-500 border border-line'
                 : r.rank === 1 ? 'bg-gradient-to-br from-gold2 to-amber-600 text-ink shadow-[0_0_18px_-4px_rgba(245,158,11,.9)]'
                 : r.rank === 2 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-ink'
                 : r.rank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white'
                 : 'bg-panel2 text-slate-400 border border-line';
    return `<tr class="${rowCls} hover:bg-white/[.04] transition">
      <td class="py-3.5 pl-4 pr-2"><span class="inline-grid place-items-center w-9 h-9 rounded-lg font-display font-black text-sm ${badge}">${r.rank}</span></td>
      <td class="py-3.5 px-2">
        <div class="flex items-center gap-2.5">
          <span class="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-ink/70 border border-line text-cyan">${esc(r.team.tag)}</span>
          <span class="font-display font-bold text-sm sm:text-base whitespace-nowrap ${champ ? 'champ-name' : 'text-white'}">${esc(r.team.name)}</span>
          ${anyPlayed ? rankMedal(r.rank) : ''}
        </div>
      </td>
      <td class="py-3.5 px-2 text-center font-mono font-bold text-slate-400">${r.mp}</td>
      <td class="py-3.5 px-2 text-center font-mono font-extrabold ${r.wwcd ? 'text-gold' : 'text-slate-600'}">${r.wwcd}</td>
      <td class="py-3.5 px-2 text-center font-mono font-bold text-slate-300">${r.place}</td>
      <td class="py-3.5 px-2 text-center font-mono font-extrabold ${r.kills ? 'text-cyan' : 'text-slate-600'}">${r.kills}</td>
      <td class="py-3.5 px-2 text-center font-mono font-bold text-slate-400 hidden sm:table-cell">${num(r.damage)}</td>
      <td class="py-3.5 pr-4 pl-2 text-right font-display font-black text-lg sm:text-xl ${champ ? 'text-gold' : 'text-white'}">${r.total}</td>
    </tr>`;
  }).join('');

  $('genAt').textContent = new Date().toLocaleString();
}

function renderMVP() {
  const rows = computePlayers(state);
  const played = rows.some(r => r.mp > 0);
  const top = played ? rows[0] : null;

  $('mvpCard').innerHTML = top ? `
    <div class="mvp-card h-full rounded-2xl border border-gold/50 bg-gradient-to-br from-gold/20 via-panel/80 to-ink/90 backdrop-blur-md p-5 flex flex-col justify-center text-center">
      <div class="text-gold mx-auto mb-1.5 ico-trophy">${ICONS.crown('ico w-10 h-10')}</div>
      <div class="text-[10px] uppercase tracking-[.3em] font-display font-black text-gold">Overall Tournament MVP</div>
      <div class="font-display font-black text-xl sm:text-2xl mt-2 champ-name">${esc(top.player.name)}</div>
      <div class="mt-1.5 flex items-center justify-center gap-2">
        <span class="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-ink/70 border border-line text-cyan">${esc(top.team.tag)}</span>
        <span class="text-sm font-bold text-slate-300">${esc(top.team.name)}</span>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-4">
        <div class="rounded-xl bg-ink/70 border border-line py-2.5">
          <div class="font-display font-black text-2xl text-cyan">${top.kills}</div>
          <div class="text-[9px] uppercase tracking-[.2em] font-bold text-slate-500">Kills</div>
        </div>
        <div class="rounded-xl bg-ink/70 border border-line py-2.5">
          <div class="font-display font-black text-2xl text-white">${num(top.damage)}</div>
          <div class="text-[9px] uppercase tracking-[.2em] font-bold text-slate-500">Damage</div>
        </div>
      </div>
    </div>` : `
    <div class="h-full rounded-2xl border border-dashed border-line bg-ink/40 backdrop-blur-md p-6 grid place-items-center text-center">
      <div>
        <div class="text-slate-600 mx-auto mb-2">${ICONS.crown('ico w-9 h-9')}</div>
        <div class="text-[10px] uppercase tracking-[.3em] font-display font-black text-slate-500">Tournament MVP</div>
        <div class="text-sm text-slate-600 font-semibold mt-1">Awaiting first match</div>
      </div>
    </div>`;

  const list = showAllPlayers ? rows : rows.slice(0, 10);
  $('mvpTable').innerHTML = list.map(r => {
    const mvp = r.rank === 1 && played;
    const chip = !played ? 'text-slate-600'
               : r.rank === 1 ? 'bg-gradient-to-br from-gold2 to-amber-600 text-ink'
               : r.rank === 2 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-ink'
               : r.rank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white'
               : 'text-slate-500';
    const chipCls = (r.rank <= 3 && played) ? `inline-grid place-items-center w-7 h-7 rounded-lg ${chip}` : `pl-1 ${chip}`;
    return `<tr class="${mvp ? 'row-champ' : ''} hover:bg-white/[.04] transition">
      <td class="py-2.5 pl-4 pr-2"><span class="font-display font-black text-xs ${chipCls}">${r.rank}</span></td>
      <td class="py-2.5 px-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-display font-bold text-sm ${mvp ? 'champ-name' : 'text-white'} whitespace-nowrap">${esc(r.player.name)}</span>
          ${mvp ? `<span class="inline-flex items-center gap-1 text-[8px] uppercase tracking-[.15em] font-display font-black px-1.5 py-0.5 rounded bg-gradient-to-br from-gold2 to-amber-600 text-ink whitespace-nowrap shadow-[0_0_14px_-4px_rgba(245,158,11,.9)]">${ICONS.crown('ico w-3 h-3')} MVP</span>` : ''}
        </div>
      </td>
      <td class="py-2.5 px-2">
        <span class="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-ink/70 border border-line text-cyan">${esc(r.team.tag)}</span>
        <span class="text-xs font-semibold text-slate-400 ml-1 hidden sm:inline">${esc(r.team.name)}</span>
      </td>
      <td class="py-2.5 px-2 text-center font-mono font-bold text-slate-400 hidden sm:table-cell">${r.mp}</td>
      <td class="py-2.5 px-2 text-center font-mono font-extrabold text-lg ${r.kills ? 'text-cyan' : 'text-slate-600'}">${r.kills}</td>
      <td class="py-2.5 pr-4 pl-2 text-right font-mono font-bold ${mvp ? 'text-gold' : 'text-slate-300'}">${num(r.damage)}</td>
    </tr>`;
  }).join('');

  $('btnMore').textContent = showAllPlayers ? 'Show top 10' : `Show all ${rows.length}`;
}

function renderMatchCards() {
  $('matchCards').innerHTML = MAPS.map((map, i) => {
    const m = i + 1;
    if (!state.results[m]) {
      return `<div class="rounded-xl border border-dashed border-line bg-ink/40 backdrop-blur-md p-5 text-center">
        <div class="font-display font-bold text-xs uppercase tracking-[.2em] text-slate-500">Match ${m} · ${map}</div>
        <div class="text-sm text-slate-600 mt-2 font-semibold">Not played yet</div>
      </div>`;
    }
    const list = state.teams.map(t => ({ t, ...matchTeamStats(state, m, t.id) })).sort((a, b) => a.rank - b.rank);
    const best = state.teams.flatMap(t => t.players.map(p => {
      const pr = (state.results[m][t.id].players || {})[p.id] || { kills: 0, damage: 0 };
      return { name: p.name, ...pr };
    })).sort((a, b) => b.kills - a.kills || b.damage - a.damage)[0];

    return `<div class="rounded-xl glass overflow-hidden">
      <div class="px-4 py-3 glass-2 border-b border-gold/20 flex items-center justify-between">
        <span class="font-display font-bold text-xs uppercase tracking-[.2em] text-white">Match ${m}</span>
        <span class="font-display font-bold text-xs uppercase tracking-[.2em] text-gold">${map}</span>
      </div>
      <div class="divide-y divide-line/50">
        ${list.map(x => `<div class="flex items-center gap-2 px-4 py-2.5 text-sm ${x.rank === 1 ? 'bg-gold/10' : ''}">
          <span class="w-6 font-mono font-extrabold ${x.rank === 1 ? 'text-gold' : 'text-slate-500'}">#${x.rank}</span>
          <span class="flex-1 font-semibold truncate ${x.rank === 1 ? 'text-white' : 'text-slate-300'}">${esc(x.t.name)}</span>
          ${x.rank === 1 ? `<span class="text-gold">${ICONS.trophy('ico w-3.5 h-3.5')}</span>` : ''}
          <span class="font-mono text-xs text-cyan font-bold">${x.kills}K</span>
          <span class="font-mono text-xs font-extrabold text-white w-8 text-right">${x.points}</span>
        </div>`).join('')}
      </div>
      ${best ? `<div class="px-4 py-2.5 bg-ink/60 border-t border-line/70 flex items-center gap-2 text-xs">
        <span class="text-cyan">${ICONS.skull('ico w-3.5 h-3.5')}</span>
        <span class="uppercase tracking-[.15em] font-display font-bold text-slate-500">Top Frag</span>
        <span class="font-bold text-white truncate">${esc(best.name)}</span>
        <span class="ml-auto font-mono font-extrabold text-cyan">${best.kills}K</span>
        <span class="font-mono font-bold text-slate-400">${num(best.damage)}</span>
      </div>` : ''}
    </div>`;
  }).join('');
}

function renderSavedAt() {
  $('savedAt').textContent = state.updated
    ? 'Last updated: ' + new Date(state.updated).toLocaleString()
    : 'No results saved yet';
}

/* ============================================================
   RENDER — ADMIN
============================================================ */
function renderMatchTabs() {
  $('matchTabs').innerHTML = MAPS.map((map, i) => {
    const m = i + 1, on = m === currentMatch, played = !!state.results[m];
    return `<button type="button" data-match="${m}" class="mtab clip-tag px-4 py-3 border text-left transition
      ${on ? 'bg-gold text-ink border-gold shadow-gold' : 'bg-ink/50 border-line hover:border-cyan'}">
      <div class="font-display font-black text-xs uppercase tracking-[.15em] ${on ? 'text-ink' : 'text-white'}">Match ${m}</div>
      <div class="text-[11px] font-bold ${on ? 'text-ink/70' : 'text-slate-400'}">${map}${played ? ' · ✓ saved' : ''}</div>
    </button>`;
  }).join('');
  document.querySelectorAll('.mtab').forEach(b => {
    b.onclick = () => {
      if (formDirty && !confirm('You have unsaved changes for this match. Switch anyway?')) return;
      currentMatch = +b.dataset.match; formDirty = false; renderAdmin();
    };
  });
  $('curMatchLabel').textContent = `Match ${currentMatch} · ${MAPS[currentMatch - 1]}`;
}

function renderTeamCards() {
  const res = state.results[currentMatch] || {};
  $('teamCards').innerHTML = state.teams.map(t => {
    const r = res[t.id] || { players: {} };
    const rankOpts = [1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${r.rank == n ? 'selected' : ''}>#${n} — ${PLACEMENT[n]} pts</option>`).join('');
    const playerRows = t.players.map(p => {
      const pr = (r.players && r.players[p.id]) || {};
      return `<div class="grid grid-cols-[1fr_64px_84px] gap-2 items-center" data-player="${p.id}">
        <input type="text" value="${esc(p.name)}" maxlength="18" placeholder="Player name"
          class="p-name bg-ink/60 border border-line rounded-lg px-2.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold min-w-0">
        <input type="number" min="0" max="99" value="${pr.kills != null ? pr.kills : ''}" placeholder="K"
          class="p-kills bg-ink/60 border border-line rounded-lg px-2 py-2 text-sm font-mono font-bold text-cyan text-center focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan min-w-0">
        <input type="number" min="0" max="99999" value="${pr.damage != null ? pr.damage : ''}" placeholder="DMG"
          class="p-dmg bg-ink/60 border border-line rounded-lg px-2 py-2 text-sm font-mono font-bold text-slate-200 text-center focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan min-w-0">
      </div>`;
    }).join('');

    return `<div class="team-card rounded-2xl glass overflow-hidden" data-team="${t.id}">
      <div class="px-4 py-3 glass-2 border-b border-gold/20 flex items-center gap-2.5 flex-wrap">
        <span class="tc-tag font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-ink/70 border border-line text-cyan">${esc(t.tag)}</span>
        <span class="tc-name font-display font-bold text-sm text-white">${esc(t.name)}</span>
        <div class="sel ml-auto">
          <select class="t-rank select-esports" aria-label="Rank position for ${esc(t.name)}">
            <option value="">Rank —</option>${rankOpts}
          </select>
        </div>
      </div>
      <div class="px-4 pt-3 pb-2 grid grid-cols-[1fr_64px_84px] gap-2 text-[9px] uppercase tracking-[.18em] font-display font-bold text-slate-500">
        <span>Player</span><span class="text-center">Kills</span><span class="text-center">Damage</span>
      </div>
      <div class="px-4 pb-3 space-y-2">${playerRows}</div>
      <div class="px-4 py-2.5 bg-ink/60 border-t border-line/70 flex items-center gap-4 text-xs">
        <span class="uppercase tracking-[.15em] font-display font-bold text-slate-500">Team Kills</span>
        <span class="t-kills font-mono font-extrabold text-cyan text-base">0</span>
        <span class="uppercase tracking-[.15em] font-display font-bold text-slate-500 ml-auto">Match Pts</span>
        <span class="t-pts font-display font-black text-white text-base">—</span>
      </div>
    </div>`;
  }).join('');

  /* Scores + rank: these are what "Add / Update Match Result" publishes, so they
     mark the form dirty and wait for the rank validation. */
  document.querySelectorAll('#teamCards .t-rank, #teamCards .p-kills, #teamCards .p-dmg').forEach(el => {
    el.addEventListener('input', () => { formDirty = true; updateLive(); });
    el.addEventListener('change', () => { formDirty = true; updateLive(); });
  });

  /* Player names: roster data, not match data. Saved on blur/Enter on their own,
     with no rank or score required. */
  document.querySelectorAll('#teamCards .p-name').forEach(el => {
    const pid = el.closest('[data-player]').dataset.player;
    el.addEventListener('change', () => savePlayerName(pid, el));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
  });

  enhanceSelects(document.getElementById('teamCards'));
  updateLive();
}

/* Repaint just the team-card headers after a roster write, so the open admin
   form keeps every value the organiser has typed but not yet published. */
function syncTeamCardHeaders() {
  document.querySelectorAll('#teamCards .team-card').forEach(card => {
    const t = state.teams.find(x => x.id === card.dataset.team);
    if (!t) return;
    const tag = card.querySelector('.tc-tag'), name = card.querySelector('.tc-name');
    if (tag)  tag.textContent  = t.tag;
    if (name) name.textContent = t.name;
    const sel = card.querySelector('.t-rank');
    if (sel) sel.setAttribute('aria-label', `Rank position for ${t.name}`);
  });
}

/* ============================================================
   ROSTER SAVES — team name / tag / player name
   Independent of scores: no rank, no kills, no damage required.
   `mutate` edits a clone of the current state; the write goes to Firebase
   immediately and every viewer's board updates.
============================================================ */
async function saveRoster(mutate, okMsg) {
  const next = structuredClone(state);
  if (mutate(next) === false) return;   // nothing actually changed
  rosterSaving = true;
  let res;
  try {
    res = await store.publish(next);
  } finally {
    rosterSaving = false;
  }
  lastSelfPublish = res.updated || null;
  renderTeamEditorValues();
  if (!res.ok)          toast('⚠ Saved on this device only — Firebase write failed', true);
  else if (res.local)   toast(`${okMsg} — saved on this device only`);
  else if (okMsg)       toast(`✓ ${okMsg}`);
}

async function savePlayerName(pid, el) {
  const t = teamOf(pid);
  const p = t && t.players.find(x => x.id === pid);
  if (!p) return;
  const v = el.value.trim();
  if (!v) { el.value = p.name; return; }        // blank is not a name — revert
  if (v === p.name) return;
  await saveRoster(nx => {
    const nt = nx.teams.find(x => x.players.some(y => y.id === pid));
    nt.players.find(y => y.id === pid).name = v;
  }, 'Player name saved');
}

/* Live team-kill aggregation + duplicate-rank check as the organiser types. */
function updateLive() {
  const counts = {};
  document.querySelectorAll('#teamCards .team-card').forEach(card => {
    const rank = card.querySelector('.t-rank').value;
    if (rank) counts[rank] = (counts[rank] || 0) + 1;
  });

  let dup = false, blanks = 0;
  document.querySelectorAll('#teamCards .team-card').forEach(card => {
    const rank = card.querySelector('.t-rank').value;
    let kills = 0;
    card.querySelectorAll('[data-player]').forEach(row => {
      kills += Math.max(0, parseInt(row.querySelector('.p-kills').value || 0, 10) || 0);
    });
    card.querySelector('.t-kills').textContent = kills;

    const pts = card.querySelector('.t-pts');
    if (!rank) { pts.textContent = '—'; pts.className = 't-pts font-display font-black text-slate-600 text-base'; blanks++; }
    else {
      pts.textContent = PLACEMENT[rank] + kills;
      pts.className = 't-pts font-display font-black text-base ' + (rank === '1' ? 'text-gold' : 'text-white');
    }
    const isDup = rank && counts[rank] > 1;
    if (isDup) dup = true;
    setSelectState(card.querySelector('.t-rank'), { error: !!isDup, empty: !rank });
  });

  $('rankWarn').textContent =
    dup ? '⚠ Duplicate rank positions' : (blanks && blanks < NUM_TEAMS ? '⚠ Some teams have no rank' : '');
}

function renderTeamEditor() {
  $('teamEditor').innerHTML = state.teams.map((t, i) => `
    <div class="flex items-center gap-2">
      <input value="${esc(t.tag)}" data-i="${i}" data-f="tag" maxlength="4"
        class="tin w-14 bg-ink/60 border border-line rounded px-2 py-1.5 text-[11px] font-mono font-extrabold text-cyan uppercase focus:outline-none focus:border-cyan">
      <input value="${esc(t.name)}" data-i="${i}" data-f="name" maxlength="24"
        class="tin flex-1 min-w-0 bg-ink/60 border border-line rounded px-2 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-gold">
    </div>`).join('');

  /* Team name / tag save themselves on blur or Enter — no rank, no scores. */
  document.querySelectorAll('.tin').forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    el.addEventListener('change', () => {
      const i = +el.dataset.i, f = el.dataset.f;
      const v = f === 'tag' ? el.value.trim().toUpperCase() : el.value.trim();
      if (!v) { el.value = state.teams[i][f]; return; }   // blank is not a name — revert
      if (v === state.teams[i][f]) { el.value = v; return; }
      el.value = v;
      saveRoster(nx => { nx.teams[i][f] = v; }, f === 'tag' ? 'Team tag saved' : 'Team name saved');
    });
  });
}

/* Push the stored roster back into the editor inputs without rebuilding them,
   so the field the organiser is tabbing through keeps focus. */
function renderTeamEditorValues() {
  document.querySelectorAll('#teamEditor .tin').forEach(el => {
    const t = state.teams[+el.dataset.i];
    if (t && document.activeElement !== el) el.value = t[el.dataset.f];
  });
}

function renderLegend() {
  $('ptsLegend').innerHTML = Object.entries(PLACEMENT).map(([r, p]) => `
    <li class="flex justify-between items-center">
      <span class="flex items-center gap-1.5 ${r === '1' ? 'text-gold font-bold' : 'text-slate-300'}">${r === '1' ? ICONS.trophy('ico w-3.5 h-3.5') : ''}#${r} Place</span>
      <span class="font-mono font-extrabold ${r === '1' ? 'text-gold' : 'text-white'}">${p} pts</span>
    </li>`).join('');
}

function renderBoard() { renderMapChips(); renderStandings(); renderMVP(); renderMatchCards(); renderSavedAt(); }
function renderAdmin() { renderMatchTabs(); renderTeamCards(); renderRemoteNotice(); }
function renderAll()   { renderSectionIcons(); renderBoard(); renderAdmin(); renderTeamEditor(); renderLegend(); renderSyncBadge(); }

/* ============================================================
   ACTIONS
============================================================ */
$('resultForm').addEventListener('submit', async e => {
  e.preventDefault();
  const entry = {}, ranks = [];
  let missing = false;
  const nameEdits = [];

  document.querySelectorAll('#teamCards .team-card').forEach(card => {
    const rank = parseInt(card.querySelector('.t-rank').value, 10);
    if (!rank) { missing = true; return; }
    ranks.push(rank);
    const players = {};
    card.querySelectorAll('[data-player]').forEach(row => {
      const pid = row.dataset.player;
      const name = row.querySelector('.p-name').value.trim();
      if (name) nameEdits.push([pid, name]);
      players[pid] = {
        kills:  Math.max(0, parseInt(row.querySelector('.p-kills').value || 0, 10) || 0),
        damage: Math.max(0, parseInt(row.querySelector('.p-dmg').value   || 0, 10) || 0),
      };
    });
    entry[card.dataset.team] = { rank, players };
  });

  if (missing) return toast('⚠ Every team needs a rank position', true);
  if (new Set(ranks).size !== NUM_TEAMS) return toast('⚠ Each rank #1–#6 must be used once', true);

  const next = structuredClone(state);
  // player names are part of the roster, shared across all matches
  nameEdits.forEach(([pid, name]) => {
    const t = next.teams.find(x => x.players.some(p => p.id === pid));
    const p = t && t.players.find(x => x.id === pid);
    if (p) p.name = name;
  });
  next.results[currentMatch] = entry;

  formDirty = false; pendingRemote = false;
  const btn = e.submitter || $('btnSave');
  const label = btn && btn.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }
  const res = await store.publish(next);
  lastSelfPublish = res.updated || null;
  if (btn) { btn.disabled = false; btn.textContent = label; }

  toast(res.ok && !res.local
    ? `✓ Match ${currentMatch} (${MAPS[currentMatch - 1]}) published live`
    : `Match ${currentMatch} saved on this device only`, !res.ok);
});

$('btnClearMatch').onclick = async () => {
  if (!state.results[currentMatch]) return toast('Nothing to clear', true);
  if (!confirm(`Clear all results for Match ${currentMatch} (${MAPS[currentMatch - 1]})? Every viewer's board updates immediately.`)) return;
  const next = structuredClone(state);
  delete next.results[currentMatch];
  formDirty = false;
  const res = await store.publish(next);
  lastSelfPublish = res.updated || null;
  toast(`Match ${currentMatch} cleared`);
};

/* Scores only. Team names, tags and player names are the roster — the organiser
   spent time typing them, and a score reset must not throw them away. */
$('btnReset').onclick = async () => {
  if (!confirm('Reset every match result — ranks, kills and damage — for all 3 matches?\n\nTeam names, team tags and player names are KEPT. This cannot be undone.')) return;
  const next = structuredClone(state);
  next.results = {};
  currentMatch = 1; formDirty = false; pendingRemote = false;
  const res = await store.publish(next);
  lastSelfPublish = res.updated || null;
  toast(res.ok && !res.local ? '✓ Scores reset — rosters kept' : 'Scores reset on this device only', !res.ok);
};

$('btnMore').onclick = () => { showAllPlayers = !showAllPlayers; renderMVP(); };

$('btnReload').onclick = () => { pendingRemote = false; formDirty = false; renderAll(); toast('✓ Loaded the latest results'); };

/* view switching */
document.querySelectorAll('.tabbtn').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.tabbtn').forEach(x => { x.classList.remove('active'); x.classList.add('text-slate-400'); });
    b.classList.add('active'); b.classList.remove('text-slate-400');
    const v = b.dataset.view;
    $('view-board').classList.toggle('hidden', v !== 'board');
    $('view-admin').classList.toggle('hidden', v !== 'admin');
    if (v === 'board') renderBoard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
});

/* export PNG */
$('btnPng').onclick = async () => {
  const btn = $('btnPng'), old = btn.textContent;
  btn.textContent = 'Rendering…'; btn.disabled = true;
  document.body.classList.add('exporting');
  try {
    const canvas = await html2canvas($('capture'), {
      backgroundColor: '#0f172a',
      scale: Math.min(3, (window.devicePixelRatio || 1) * 2),
      useCORS: true, logging: false,
    });
    const a = document.createElement('a');
    a.download = `ddam-cup-standings-${new Date().toISOString().slice(0, 10)}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    toast('✓ PNG downloaded');
  } catch (err) {
    console.error(err);
    toast('Export failed — use Printable view', true);
  }
  document.body.classList.remove('exporting');
  btn.textContent = old; btn.disabled = false;
};

$('btnPrint').onclick = () => window.print();

$('btnCopy').onclick = async () => {
  const teams = computeStandings(state), players = computePlayers(state).slice(0, 5);
  const txt = ['🏆 DDAM CUP — OVERALL STANDINGS', '']
    .concat(teams.map(r => `${r.rank}. ${r.team.name} — ${r.total} pts (${r.kills} kills, ${r.wwcd} WWCD, ${r.mp} matches)`))
    .concat(['', '💀 TOP FRAGGERS', ''])
    .concat(players.map(p => `${p.rank}. ${p.player.name} [${p.team.tag}] — ${p.kills} kills, ${num(p.damage)} dmg${p.rank === 1 ? '  👑 MVP' : ''}`))
    .concat(['', `Maps: ${MAPS.map((m, i) => `M${i + 1} ${m}`).join(' / ')}`, `Updated: ${new Date().toLocaleString()}`])
    .join('\n');
  try { await navigator.clipboard.writeText(txt); toast('✓ Copied to clipboard'); }
  catch { prompt('Copy the standings:', txt); }
};

/* warn before losing half-typed results */
window.addEventListener('beforeunload', e => {
  if (formDirty) { e.preventDefault(); e.returnValue = ''; }
});

/* toast */
let toastTimer;
function toast(msg, bad) {
  const wrap = $('toast'), el = $('toastMsg');
  el.textContent = msg;
  el.className = 'px-5 py-3 rounded-xl bg-panel2 border font-display font-bold text-xs uppercase tracking-widest toast-in ' +
    (bad ? 'border-rose-500/60 text-rose-300' : 'border-gold/50 shadow-gold text-gold');
  wrap.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => wrap.classList.add('hidden'), 2600);
}

/* ---------- go ---------- */
currentMatch = firstUnplayedMatch();
store.start();
if (!isConfigured) {
  console.warn('[ddam-cup] Firebase not configured — running local-only. Missing:', missingKeys.join(', '));
} else if (!isLive()) {
  console.warn('[ddam-cup] Firebase failed to initialise — running local-only.');
}
