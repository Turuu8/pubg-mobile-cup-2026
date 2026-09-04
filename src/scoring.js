/* ============================================================
   SCORING — PMGC point system
   Placement (10/6/5/4/2/1) + 1 point per kill.
   Unchanged by the Firebase refactor; pure functions over state.
============================================================ */
import { PLACEMENT, NUM_MATCHES } from './config.js';

/* Team kills for one match = sum of that team's 4 player kills. */
export function matchTeamStats(state, matchNo, teamId) {
  const r = state.results[matchNo] && state.results[matchNo][teamId];
  if (!r) return null;
  let kills = 0, damage = 0;
  for (const pid in r.players) {
    kills  += r.players[pid].kills  || 0;
    damage += r.players[pid].damage || 0;
  }
  const place = PLACEMENT[r.rank] || 0;
  return { rank: r.rank, kills, damage, place, points: place + kills };
}

export function computeStandings(state) {
  const rows = state.teams.map(t => {
    let mp = 0, kills = 0, damage = 0, place = 0, wwcd = 0, bestRank = 99;
    for (let m = 1; m <= NUM_MATCHES; m++) {
      const s = matchTeamStats(state, m, t.id);
      if (!s) continue;
      mp++; kills += s.kills; damage += s.damage; place += s.place;
      if (s.rank === 1) wwcd++;
      bestRank = Math.min(bestRank, s.rank);
    }
    return { team: t, mp, kills, damage, place, wwcd, bestRank, total: place + kills };
  });

  rows.sort((a, b) =>
    b.total - a.total ||        // 1. total points
    b.kills - a.kills ||        // 2. total kills
    b.wwcd  - a.wwcd  ||        // 3. chicken dinners
    a.bestRank - b.bestRank ||  // 4. best single placement
    a.team.name.localeCompare(b.team.name)
  );
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

export function computePlayers(state) {
  const rows = [];
  state.teams.forEach(t => t.players.forEach(p => {
    let mp = 0, kills = 0, damage = 0;
    for (let m = 1; m <= NUM_MATCHES; m++) {
      const r = state.results[m] && state.results[m][t.id];
      if (!r || !r.players || !r.players[p.id]) continue;
      mp++;
      kills  += r.players[p.id].kills  || 0;
      damage += r.players[p.id].damage || 0;
    }
    rows.push({ player: p, team: t, mp, kills, damage });
  }));

  rows.sort((a, b) =>
    b.kills - a.kills ||        // 1. total kills
    b.damage - a.damage ||      // 2. total damage
    a.player.name.localeCompare(b.player.name)
  );
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
