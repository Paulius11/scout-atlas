#!/usr/bin/env node
'use strict';
// Checks data.js as data: integrity, geometry, and the spoiler boundary. Pure Node, ~30 ms.
//   node tests/data-lint.cjs      (exit 1 on any problem)
// It loads data.js the way the page does: a classic script assigning window.ATLAS_DATA.

const path = require('node:path');

const fs = require('node:fs');

global.window = {};
require(path.resolve(__dirname, '../data.js'));
const portraitsFile = path.resolve(__dirname, '../portraits/portraits.js');
if (fs.existsSync(portraitsFile)) require(portraitsFile);
const d = window.ATLAS_DATA;
const portraits = window.ATLAS_PORTRAITS || {};
const problems = [];
let checks = 0;
function check(name, run) {
  checks += 1;
  run(message => problems.push(`${name}: ${message}`));
}

const events = d.episodes.flatMap(e => e.events.map(event => ({ ...event, episode: e.number })));
const place = Object.fromEntries(d.locations.map(l => [l.id, l]));
const person = Object.fromEntries(d.characters.map(c => [c.id, c]));
const positions = d.characters.flatMap(c => (c.positions || []).map(p => ({ ...p, owner: c })));
const VERSIONED = ['name', 'role', 'faction'];
const KINDS = ['district', 'village', 'castle', 'forest', 'wall', 'field', 'chapel', 'capital'];
const FACTIONS = ['civilian', 'cadet', 'survey', 'garrison', 'mp', 'central', 'crown', 'shifter', 'titan'];
// Wall ellipses from index.html (#wall-geometry). ring() is 1 on the wall and < 1 inside it.
const walls = { maria: [440, 365], rose: [298, 246], sina: [162, 131] };
const ring = (l, wall) => ((l.x - 600) / walls[wall][0]) ** 2 + ((l.y - 405) / walls[wall][1]) ** 2;

check('unique ids', bad => {
  const ids = [...d.episodes, ...events, ...d.locations, ...d.characters].map(x => x.id);
  ids.filter((id, i) => ids.indexOf(id) !== i).forEach(bad);
});
check('episodes ascending and unique', bad => {
  d.episodes.forEach((e, i) => { if (i && e.number <= d.episodes[i - 1].number) bad(e.id); });
});
check('seasons are contiguous and cover every episode', bad => {
  if (d.seasons[0]?.first !== 1) bad('the first season must start at episode 1');
  d.seasons.forEach((s, i) => {
    const next = d.seasons[i + 1];
    if (next && s.last !== next.first - 1) bad(`season ${s.season} must end right before season ${next.season}`);
    if (!next && s.last !== undefined && s.last < d.maxEpisode) bad('maxEpisode lies after the last season');
    if (s.last !== undefined && s.last > d.maxEpisode) bad(`season ${s.season} ends after maxEpisode`);
  });
  if (d.seasons[d.seasons.length - 1].first > d.maxEpisode) bad('the last season starts after maxEpisode');
});
check('nothing past maxEpisode', bad => {
  const late = (label, n) => { if (n > d.maxEpisode) bad(`${label} (${n})`); };
  d.episodes.forEach(e => late(e.id, e.number));
  d.locations.forEach(l => late(l.id, l.firstEpisode));
  d.characters.forEach(c => {
    late(c.id, c.firstEpisode);
    VERSIONED.forEach(field => (c[field] || []).forEach(v => late(`${c.id}.${field}`, v.from)));
    (c.notes || []).forEach(n => late(`${c.id} note`, n.episode));
    if (c.revealedAs) late(`${c.id} reveal`, c.revealedAs.episode);
  });
  positions.forEach(p => late(`${p.owner.id} position`, p.episode));
});
check('references resolve', bad => {
  events.filter(e => e.locationId !== null && !place[e.locationId]).forEach(e => bad(`${e.id} -> ${e.locationId}`));
  events.forEach(e => (e.people || []).filter(id => !person[id]).forEach(id => bad(`${e.id} -> person ${id}`)));
  positions.filter(p => p.locationId !== null && !place[p.locationId]).forEach(p => bad(`${p.owner.id}@E${p.episode} -> ${p.locationId}`));
  d.characters.filter(c => c.revealedAs && !person[c.revealedAs.id]).forEach(c => bad(`${c.id} reveal -> ${c.revealedAs.id}`));
});
// app.js silently drops anything that points at something not yet visible.
check('everything referenced is visible by then', bad => {
  events.filter(e => e.locationId && place[e.locationId]?.firstEpisode > e.episode).forEach(e => bad(`${e.id} uses ${e.locationId}`));
  events.forEach(e => (e.people || []).filter(id => person[id]?.firstEpisode > e.episode).forEach(id => bad(`${e.id} shows ${id}`)));
  positions.filter(p => p.locationId && place[p.locationId]?.firstEpisode > p.episode).forEach(p => bad(`${p.owner.id}@E${p.episode} uses ${p.locationId}`));
  positions.filter(p => p.episode < p.owner.firstEpisode).forEach(p => bad(`${p.owner.id}@E${p.episode} before the character is known`));
  d.characters.forEach(c => (c.notes || []).filter(n => n.episode < c.firstEpisode).forEach(n => bad(`${c.id} note at E${n.episode}`)));
  d.characters.filter(c => c.revealedAs && person[c.revealedAs.id]?.firstEpisode > c.revealedAs.episode).forEach(c => bad(`${c.id} revealed as someone not yet known`));
});
check('every versioned field has a value from the first episode', bad => {
  d.characters.forEach(c => VERSIONED.forEach(field => {
    const list = c[field] || [];
    if (!list.some(v => v.from <= c.firstEpisode)) bad(`${c.id}.${field}`);
    list.forEach((v, i) => { if (i && v.from <= list[i - 1].from) bad(`${c.id}.${field} not ascending`); });
  }));
});
check('every place has an event', bad => {
  d.locations.filter(l => !events.some(e => e.locationId === l.id)).forEach(l => bad(l.id));
});
check('https sourceUrl on every record', bad => {
  [...d.episodes, ...events, ...d.locations, ...d.characters, ...positions]
    .filter(x => !/^https:\/\//.test(x.sourceUrl || ''))
    .forEach(x => bad(x.id || `${x.owner.id}@E${x.episode}`));
});
check('known kinds, types and factions', bad => {
  events.filter(e => !['confirmed', 'belief', 'approximate'].includes(e.kind)).forEach(e => bad(`${e.id}: ${e.kind}`));
  d.locations.filter(l => !KINDS.includes(l.kind)).forEach(l => bad(`${l.id}: ${l.kind}`));
  d.characters.filter(c => !['person', 'titan', 'group'].includes(c.type)).forEach(c => bad(`${c.id}: ${c.type}`));
  d.characters.forEach(c => (c.faction || []).filter(f => !FACTIONS.includes(f.key)).forEach(f => bad(`${c.id}: ${f.key}`)));
  d.locations.filter(l => l.label && !['left', 'right', 'below'].includes(l.label.side)).forEach(l => bad(`${l.id} label side`));
});
check('coordinates on the 1200x920 canvas', bad => {
  d.locations.filter(l => l.x < 0 || l.x > 1200 || l.y < 0 || l.y > 920).forEach(l => bad(l.id));
});
check('a district sits on its wall', bad => {
  d.locations.filter(l => l.kind === 'district').forEach(l => {
    const wall = /Sina/.test(l.subtitle) ? 'sina' : /Rose/.test(l.subtitle) ? 'rose' : 'maria';
    const r = ring(l, wall);
    if (Math.abs(r - 1) > 0.06) bad(`${l.id}: ${r.toFixed(3)} on ${wall}`);
  });
});
check('tags agree with the wall geometry', bad => {
  const between = (l, outer, inner) => ring(l, outer) < 1 && ring(l, inner) > 1;
  d.locations.forEach(l => {
    if (l.tags.includes('Inside Wall Rose') && !between(l, 'rose', 'sina')) bad(`${l.id} is not inside Rose and outside Sina`);
    if (l.tags.some(t => /Between the walls|Beyond Wall Rose/.test(t)) && !between(l, 'maria', 'rose')) bad(`${l.id} is not between Rose and Maria`);
    if (l.tags.includes('Between Sina and Rose') && !between(l, 'rose', 'sina')) bad(`${l.id} is not between Sina and Rose`);
  });
});
check('a village is not captioned as a district', bad => {
  d.locations.filter(l => /village/i.test(`${l.subtitle} ${l.tags.join(' ')}`) && l.kind === 'district').forEach(l => bad(l.id));
});

// The spoiler boundary inside the ceiling: text visible at episode N may not name a place,
// person or name version the atlas only introduces after N.
const introduced = new Map();
const introduce = (token, episode) => { if (!introduced.has(token) || introduced.get(token) > episode) introduced.set(token, episode); };
const IGNORED_WORDS = new Set(['The', 'Titan', 'Pastor', 'District', 'Royal', 'Family', 'Wall']);
d.locations.forEach(l => introduce(l.name, l.firstEpisode));
d.characters.forEach(c => (c.name || []).forEach(v => {
  introduce(v.text, v.from);
  if (c.type === 'person') v.text.split(/\s+/).filter(word => word.length >= 4 && !IGNORED_WORDS.has(word)).forEach(word => introduce(word, v.from));
}));
check('aliases never carry a later name', bad => {
  d.characters.forEach(c => (c.aliases || []).forEach(alias => (c.name || []).filter(v => v.from > c.firstEpisode)
    .filter(v => alias.includes(v.text) || v.text.split(/\s+/).some(word => word.length >= 4 && alias.includes(word) && introduced.get(word) > c.firstEpisode))
    .forEach(v => bad(`${c.id} alias "${alias}" contains "${v.text}"`))));
});
check('no text names something before it is introduced', bad => {
  const texts = [];
  d.episodes.forEach(e => {
    texts.push([e.number, `${e.id} title`, `${e.title} ${e.shortTitle} ${e.description}`]);
    e.events.forEach(ev => texts.push([e.number, ev.id, `${ev.title} ${ev.summary} ${ev.connection || ''}`]));
  });
  d.locations.forEach(l => texts.push([l.firstEpisode, l.id, `${l.subtitle} ${l.summary} ${l.why} ${l.geography} ${l.mapLabel || ''} ${(l.aliases || []).join(' ')}`]));
  d.characters.forEach(c => {
    (c.role || []).forEach(v => texts.push([v.from, `${c.id} role`, v.text]));
    (c.notes || []).forEach(n => texts.push([n.episode, `${c.id} note E${n.episode}`, n.text]));
    (c.positions || []).forEach(p => texts.push([p.episode, `${c.id} position E${p.episode}`, p.note]));
    (c.aliases || []).forEach(alias => texts.push([c.firstEpisode, `${c.id} alias`, alias]));
  });
  for (const [episode, label, text] of texts) {
    for (const [token, first] of introduced) {
      if (first > episode && new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) bad(`${label} (E${episode}) mentions "${token}", introduced at E${first}`);
    }
  }
});

check('status records: known targets and states, visible in time, sourced', bad => {
  (d.status || []).forEach(item => {
    const [kind, id] = item.target.split(':');
    if (kind === 'gate') {
      if (!place[id] || place[id].kind !== 'district') bad(`${item.target}: not a district`);
      else if (item.from < place[id].firstEpisode) bad(`${item.target} at E${item.from} before the district is visible`);
      if (!['breached', 'sealed'].includes(item.state)) bad(`${item.target}: state ${item.state}`);
    } else if (item.target !== 'belt:maria-rose' || !['lost', 'held'].includes(item.state)) bad(`${item.target}: unknown target or state`);
    if (item.from > d.maxEpisode) bad(`${item.target} past the ceiling`);
    if (!/^https:\/\//.test(item.sourceUrl || '')) bad(`${item.target} has no https source`);
  });
});
check('areas stay on the canvas', bad => {
  d.locations.filter(l => l.area).forEach(l => {
    if (l.x - l.area.rx < 0 || l.x + l.area.rx > 1200 || l.y - l.area.ry < 0 || l.y + l.area.ry > 920) bad(l.id);
  });
});
check('portraits: known ids, safe file names, ordered versions', bad => {
  for (const [id, entry] of Object.entries(portraits)) {
    if (!person[id]) bad(`${id} is not a character`);
    const versions = typeof entry === 'string' ? [{ from: 1, file: entry }] : entry;
    if (!Array.isArray(versions)) { bad(`${id}: not a file name or a list`); continue; }
    versions.forEach((v, i) => {
      if (!/^[\w.-]+\.(jpe?g|png|webp)$/i.test(v.file || '')) bad(`${id}: bad file name ${v.file}`);
      if (v.from > d.maxEpisode) bad(`${id}: version from E${v.from} is past the ceiling`);
      if (i && v.from <= versions[i - 1].from) bad(`${id}: versions not ascending`);
    });
  }
});
// Season art (file names ending -s<N>) may only show from that season's first episode on.
// One reviewed exception: the official Season 1 thumbnails are sepia sketches, so Season 2's stand in
// for Season 1. Same character designs; checked by eye on 2026-10-01. Never add a later season here.
const ART_MAY_START_IN = { 2: 1 };
check('portraits: no season art before its season', bad => {
  for (const [id, entry] of Object.entries(portraits)) {
    (Array.isArray(entry) ? entry : [{ from: 1, file: entry }]).forEach(v => {
      // Episode stills (-eNN) never show before their own episode.
      const still = Number((/-e(\d+)\./.exec(v.file) || [])[1]);
      if (still && v.from < still) bad(`${id}: ${v.file} shown from E${v.from}, before its episode`);
      const season = Number((/-s(\d+)\./.exec(v.file) || [])[1]);
      if (!season) return;
      const allowed = d.seasons.find(s => s.season === (ART_MAY_START_IN[season] ?? season))?.first;
      if (allowed === undefined || v.from < allowed) bad(`${id}: ${v.file} shown from E${v.from}, allowed from E${allowed}`);
    });
  }
});

console.log(`${checks} data checks, ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
problems.forEach(p => console.log(`  ${p}`));
process.exitCode = problems.length ? 1 : 0;
