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
const KINDS = ['district', 'village', 'castle', 'forest', 'wall', 'field', 'chapel', 'capital', 'sea', 'island', 'country', 'city', 'site'];
const MAP_AREAS = ['walls', 'island', 'world', 'liberio'];
const locationArea = location => location.mapArea || (location.kind === 'sea' ? 'island' : 'walls');
const mapBounds = area => area === 'walls' ? { x: 0, y: 0, width: 1200, height: 920 } : d.mapGeometry[`${area}View`];
const inBounds = (point, bounds) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= bounds.x
  && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
const FACTIONS = ['civilian', 'cadet', 'survey', 'garrison', 'mp', 'central', 'crown', 'shifter', 'titan', 'marley', 'volunteer', 'yeagerist'];
// The same geometry supplies the main map, labels, overview and these containment checks.
const walls = Object.fromEntries(Object.entries(d.mapGeometry.wallRadiusKm).map(([name, km]) => [name, [km * d.mapGeometry.unitsPerKm, km * d.mapGeometry.unitsPerKm]]));
const ring = (l, wall) => ((l.x - 600) / walls[wall][0]) ** 2 + ((l.y - 405) / walls[wall][1]) ** 2;

check('unique ids', bad => {
  const ids = [...d.episodes, ...events, ...d.locations, ...d.characters].map(x => x.id);
  ids.filter((id, i) => ids.indexOf(id) !== i).forEach(bad);
});
check('episodes ascending and unique', bad => {
  d.episodes.forEach((e, i) => { if (i && e.number <= d.episodes[i - 1].number) bad(e.id); });
});
check('every allowed episode has a sourced recap', bad => {
  for (let number = 1; number <= d.maxEpisode; number++) {
    const episode = d.episodes.find(entry => entry.number === number);
    if (!episode?.events.length) bad(`E${number} has no recorded events`);
  }
});
check('wall proportions match the episode-one distances', bad => {
  const radii = d.mapGeometry.wallRadiusKm;
  if (radii.sina !== 250 || radii.rose - radii.sina !== 130 || radii.maria - radii.rose !== 100) bad('wall radii do not match the stated distances');
  if (!(d.mapGeometry.unitsPerKm > 0)) bad('wall scale must be positive');
});
check('episode titles cover exactly the allowed episodes', bad => {
  const titles = d.episodeTitles || [];
  if (titles.length !== d.maxEpisode) bad('the title catalog must stop at maxEpisode');
  titles.forEach((episode, index) => {
    if (episode.number !== index + 1) bad(`unexpected title number at entry ${index + 1}`);
    if (typeof episode.title !== 'string' || !episode.title.trim()) bad(`E${episode.number} has no title`);
    if (!/^https:\/\//.test(episode.sourceUrl || '')) bad(`E${episode.number} has no title source`);
  });
});
check('milestones use the published episode title', bad => {
  const titles = new Map((d.episodeTitles || []).map(episode => [episode.number, episode.title]));
  d.episodes.forEach(episode => {
    if (titles.get(episode.number) !== episode.title) bad(`E${episode.number} differs from the title catalog`);
  });
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
check('story boundaries are valid overall episode numbers', bad => {
  const within = (label, number) => {
    if (!Number.isInteger(number) || number < 1 || number > d.maxEpisode) bad(`${label}: ${number}`);
  };
  d.locations.forEach(l => within(`${l.id} introduction`, l.firstEpisode));
  d.characters.forEach(c => {
    within(`${c.id} introduction`, c.firstEpisode);
    VERSIONED.forEach(field => (c[field] || []).forEach(v => within(`${c.id}.${field}`, v.from)));
    (c.notes || []).forEach(n => within(`${c.id} note`, n.episode));
    if (c.revealedAs) within(`${c.id} reveal`, c.revealedAs.episode);
    (c.positions || []).forEach((position, index, list) => {
      within(`${c.id} position`, position.episode);
      if (index && position.episode <= list[index - 1].episode) bad(`${c.id} positions must be chronological, with one observation per episode`);
    });
  });
  (d.status || []).forEach(item => within(item.target, item.from));
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
check('event settings and explanations are nonempty text', bad => {
  events.forEach(event => ['placeName', 'connection', 'geographyNote'].forEach(field => {
    if (event[field] !== undefined && (typeof event[field] !== 'string' || !event[field].trim())) bad(`${event.id}.${field}`);
  }));
});
check('episode character explanations only describe visible recorded participants', bad => {
  d.episodes.filter(episode => episode.characterInvolvement !== undefined).forEach(episode => {
    const explanations = episode.characterInvolvement;
    if (!explanations || typeof explanations !== 'object' || Array.isArray(explanations)) {
      bad(`E${episode.number}: explanations must be keyed by character id`);
      return;
    }
    const participants = new Set(episode.events.flatMap(event => event.people || []));
    Object.entries(explanations).forEach(([id, text]) => {
      if (!person[id] || person[id].type === 'group' || person[id].firstEpisode > episode.number || !participants.has(id)) {
        bad(`E${episode.number}: ${id} is not a visible individual in its recorded events`);
      }
      if (typeof text !== 'string' || !text.trim()) bad(`E${episode.number}: ${id} needs nonempty explanation text`);
    });
  });
});
check('places fit their declared map area', bad => {
  d.locations.forEach(l => {
    const bounds = mapBounds(locationArea(l));
    if (!bounds || !inBounds(l, bounds)) bad(l.id);
  });
});
check('map areas have valid geometry and episode boundaries', bad => {
  for (const area of ['world', 'liberio']) {
    const bounds = mapBounds(area);
    if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height, bounds.cx, bounds.cy].every(Number.isFinite)
      || bounds.width <= 0 || bounds.height <= 0 || !inBounds({ x: bounds.cx, y: bounds.cy }, bounds)) bad(`${area}: invalid bounds`);
    const from = d.mapGeometry[`${area}From`];
    if (!Number.isInteger(from) || from < 1 || from > d.maxEpisode) bad(`${area}: invalid reveal`);
  }
  d.locations.forEach(location => {
    const area = locationArea(location);
    if (!MAP_AREAS.includes(area)) bad(`${location.id}: unknown map area`);
    if (['world', 'liberio'].includes(area) && location.firstEpisode < d.mapGeometry[`${area}From`]) bad(`${location.id}: before its map reveal`);
    if (location.opensMap && !MAP_AREAS.includes(location.opensMap)) bad(`${location.id}: unknown destination map`);
    if (location.regionId && (!place[location.regionId] || place[location.regionId].firstEpisode > location.firstEpisode)) bad(`${location.id}: parent region is not known`);
  });
  d.episodes.filter(episode => episode.mapFocus).forEach(episode => {
    const focus = episode.mapFocus;
    if (!MAP_AREAS.includes(focus.area)) bad(`E${episode.number}: unknown focus area`);
    if (focus.note !== undefined && (typeof focus.note !== 'string' || !focus.note.trim())) bad(`E${episode.number}: invalid focus geography explanation`);
    if (['world', 'liberio'].includes(focus.area) && episode.number < d.mapGeometry[`${focus.area}From`]) bad(`E${episode.number}: focus area is not revealed`);
    if (focus.locationId && (!place[focus.locationId] || place[focus.locationId].firstEpisode > episode.number)) bad(`E${episode.number}: focus place is not known`);
    else if (focus.locationId && locationArea(place[focus.locationId]) !== focus.area
      && !(focus.area === 'world' && place[focus.locationId].worldPosition)
      && !(focus.area === 'island' && focus.locationId === 'paradis')) bad(`E${episode.number}: focus place belongs to another map area`);
  });
});
check('E66–74 focus follows the current setting without inventing local coordinates', bad => {
  for (let number = 66; number <= 74; number++) {
    const episode = d.episodes.find(entry => entry.number === number);
    const expectedArea = number === 66 ? 'liberio' : number === 67 ? 'world' : 'island';
    const expectedPlace = number <= 67 ? 'liberio' : 'paradis';
    if (episode?.mapFocus?.area !== expectedArea || episode.mapFocus.locationId !== expectedPlace) bad(`E${number}: wrong current-setting focus`);
    if (episode?.officialSourceUrl !== `https://shingeki.tv/final/story/#/episode/${number}`) bad(`E${number}: missing its official episode reference`);
  }
  const flight = d.episodes.find(entry => entry.number === 67);
  if (flight?.events.some(event => event.locationId !== null)) bad('the return flight has no established point on the map');
});
check('the return from Liberio clears raid positions and preserves later location uncertainty', bad => {
  const latest = (id, number) => (person[id]?.positions || []).filter(position => position.episode <= number).at(-1);
  for (const id of ['eren', 'levi', 'scouts']) {
    if (latest(id, 66)?.locationId !== 'liberio') bad(`${id}: the recorded raid location changed before departure`);
    const departure = latest(id, 67);
    if (departure?.episode !== 67 || departure.locationId !== null) bad(`${id}: the return airship must clear the old Liberio pin`);
    for (let number = 67; number <= 73; number++) {
      if (latest(id, number)?.locationId === 'liberio') bad(`${id}: stale Liberio position at E${number}`);
    }
  }
  if (latest('eren', 73)?.locationId !== 'shiganshina') bad('Eren: the E73 observation is not reflected');
  if (latest('levi', 73)?.episode !== 73 || latest('levi', 73)?.locationId !== null) bad('Levi: the detention forest must remain unpinned');
  if (latest('eren', 74)?.locationId !== 'shiganshina') bad('Eren: an E74 flashback must not replace his current observed setting');
  if (latest('levi', 74)?.episode !== 74 || latest('levi', 74)?.locationId !== null) bad('Levi: the E74 observation must remain unpinned');
  if (latest('zeke', 74)?.episode !== 74 || latest('zeke', 74)?.locationId !== null) bad('Zeke: the E74 observation must remain unpinned');
});
check('world pins and approximate geography describe their limits', bad => {
  d.locations.forEach(location => {
    if (location.worldPosition && (!inBounds(location.worldPosition, mapBounds('world')) || locationArea(location) === 'world')) bad(`${location.id}: invalid world pin`);
    if (location.mapAccuracy !== undefined && !['approximate', 'established'].includes(location.mapAccuracy)) bad(`${location.id}: unknown accuracy`);
    if (location.mapAccuracy === 'approximate' && (typeof location.geographyNote !== 'string' || !location.geographyNote.trim())) bad(`${location.id}: approximate placement needs an explanation`);
    if (['world', 'liberio'].includes(locationArea(location)) && location.mapAccuracy !== 'approximate') bad(`${location.id}: invented scale or placement precision`);
  });
});
check('place symbols identify supported local settings', bad => {
  const symbols = new Set(['hospital', 'festival', 'stairs']);
  d.locations.filter(location => location.mapSymbol !== undefined).forEach(location => {
    if (!symbols.has(location.mapSymbol)) bad(`${location.id}: unsupported place symbol`);
    if (location.kind !== 'site' || locationArea(location) !== 'liberio') bad(`${location.id}: a local place symbol needs a local site`);
  });
  for (const [id, symbol] of Object.entries({ 'liberio-hospital': 'hospital', 'liberio-festival': 'festival', 'liberio-basement': 'stairs' })) {
    if (place[id]?.mapSymbol !== symbol) bad(`${id}: missing its recognizable place symbol`);
  }
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
// A displayed identity may contain a generic description such as "a soldier's sister".
// Only proper-name words carry a separate introduction boundary; the full identity still does.
const properNameWords = text => text.split(/\s+/).filter(word => word.length >= 4 && /^[A-Z]/.test(word) && !IGNORED_WORDS.has(word));
d.locations.forEach(l => introduce(l.name, l.firstEpisode));
d.characters.forEach(c => (c.name || []).forEach(v => {
  introduce(v.text, v.from);
  if (c.type === 'person') properNameWords(v.text).forEach(word => introduce(word, v.from));
}));
check('aliases never carry a later name', bad => {
  d.characters.forEach(c => (c.aliases || []).forEach(alias => (c.name || []).filter(v => v.from > c.firstEpisode)
    .filter(v => alias.includes(v.text) || properNameWords(v.text).some(word => alias.includes(word) && introduced.get(word) > c.firstEpisode))
    .forEach(v => bad(`${c.id} alias "${alias}" contains "${v.text}"`))));
});
check('no text names something before it is introduced', bad => {
  const texts = [];
  d.episodes.forEach(e => {
    texts.push([e.number, `${e.id} title`, `${e.title} ${e.shortTitle} ${e.description}`]);
    e.events.forEach(ev => texts.push([e.number, ev.id, `${ev.title} ${ev.summary} ${ev.connection || ''} ${ev.placeName || ''} ${ev.geographyNote || ''}`]));
  });
  d.locations.forEach(l => texts.push([l.firstEpisode, l.id, `${l.subtitle} ${l.summary} ${l.why} ${l.geography} ${l.geographyNote || ''} ${l.mapLabel || ''} ${(l.aliases || []).join(' ')}`]));
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
    } else if (item.target === 'walls:all') {
      if (item.state !== 'fallen') bad(`${item.target}: state ${item.state}`);
    } else if (item.target !== 'belt:maria-rose' || !['lost', 'held'].includes(item.state)) bad(`${item.target}: unknown target or state`);
    if (item.from > d.maxEpisode) bad(`${item.target} past the ceiling`);
    if (!/^https:\/\//.test(item.sourceUrl || '')) bad(`${item.target} has no https source`);
  });
});
check('the sea: at most one, and its desert within the ceiling', bad => {
  const seas = d.locations.filter(l => l.kind === 'sea');
  if (seas.length > 1) bad(`${seas.length} places of kind sea; the map draws one coast`);
  seas.filter(l => l.desertFrom !== undefined).forEach(l => {
    if (!Number.isInteger(l.desertFrom) || l.desertFrom < l.firstEpisode || l.desertFrom > d.maxEpisode) bad(`${l.id} desertFrom ${l.desertFrom}`);
  });
});
check('areas stay on the canvas', bad => {
  d.locations.filter(l => l.area).forEach(l => {
    const bounds = mapBounds(locationArea(l));
    if (!bounds || !Number.isFinite(l.area.rx) || !Number.isFinite(l.area.ry) || l.area.rx <= 0 || l.area.ry <= 0
      || !inBounds({ x: l.x - l.area.rx, y: l.y - l.area.ry }, bounds)
      || !inBounds({ x: l.x + l.area.rx, y: l.y + l.area.ry }, bounds)) bad(l.id);
  });
});
check('portraits: known ids, safe file names, ordered versions', bad => {
  for (const [id, entry] of Object.entries(portraits)) {
    if (!person[id]) bad(`${id} is not a character`);
    const versions = typeof entry === 'string' ? [{ from: 1, file: entry }] : entry;
    if (!Array.isArray(versions)) { bad(`${id}: not a file name or a list`); continue; }
    versions.forEach((v, i) => {
      if (!/^[\w.-]+\.(jpe?g|png|webp)$/i.test(v.file || '')) bad(`${id}: bad file name ${v.file}`);
      else if (!fs.existsSync(path.resolve(__dirname, '../portraits', v.file))) bad(`${id}: missing file ${v.file}`);
      if (!Number.isInteger(v.from) || v.from < 1) bad(`${id}: invalid starting episode`);
      if (Array.isArray(entry) && v.from < person[id]?.firstEpisode) bad(`${id}: picture appears before the character`);
      if (v.from > d.maxEpisode) bad(`${id}: version from E${v.from} is past the ceiling`);
      if (i && v.from <= versions[i - 1].from) bad(`${id}: versions not ascending`);
      if (v.crop !== undefined || v.sourceSize !== undefined) {
        const crop = v.crop, size = v.sourceSize;
        if (!Array.isArray(crop) || crop.length !== 4 || !Array.isArray(size) || size.length !== 2
          || ![...crop, ...size].every(Number.isFinite)) { bad(`${id}: invalid source frame`); return; }
        const [x, y, width, height] = crop;
        if (x < 0 || y < 0 || width <= 0 || height <= 0 || width !== height
          || x + width > size[0] || y + height > size[1]) bad(`${id}: source frame does not fit the image`);
      }
    });
  }
});
check('every person and Titan has a bundled portrait by the edition ceiling', bad => {
  for (const character of d.characters.filter(character => character.type !== 'group')) {
    const entry = portraits[character.id];
    const versions = Array.isArray(entry) ? entry : typeof entry === 'string' ? [{ from: 1, file: entry }] : [];
    if (!versions.some(version => version.from <= d.maxEpisode)) bad(`${character.id}: no picture`);
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
