/* No build step or network requests. The atlas also works directly from file://. */
(() => {
  'use strict';
  const data = window.ATLAS_DATA;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const pad = number => String(number).padStart(2, '0');
  const STORAGE_KEY = 'scout-atlas:v1';
  const MAX_EPISODE = Math.max(1, Math.trunc(Number(data.maxEpisode)) || 1);
  const episodeNumber = value => Math.min(MAX_EPISODE, Math.max(1, Math.trunc(Number(value)) || 1));
  const isMapStyle = value => value === 'parchment' || value === 'night';
  const episodeTitles = new Map((data.episodeTitles || data.episodes).map(episode => [episode.number, episode.title]));
  const titleOfEpisode = number => episodeTitles.get(number) || `Episode ${number}`;

  // Versioned fields: the entry with the latest `from` at or before the episode wins.
  const at = (list, episode) => (list || []).reduce((found, item) => (item.from <= episode && (!found || item.from >= found.from) ? item : found), null);
  const seasonOf = number => data.seasons.filter(season => season.first <= number).sort((a, b) => b.first - a.first)[0];
  const seasonText = number => { const season = seasonOf(number); return season ? `Season ${season.season}, episode ${number - season.first + 1}` : `Episode ${number}`; };

  /* ---------- Storage ---------- */
  let unreadableCopy = null;
  let stored = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        stored = JSON.parse(raw);
        if (!stored || typeof stored !== 'object' || Array.isArray(stored)) throw new TypeError('Saved state is not an object');
      } catch {
        // Keep the unreadable value so it can be repaired by hand, then start fresh.
        stored = {};
        unreadableCopy = `${STORAGE_KEY}:unreadable:${new Date().toISOString()}`;
        try { localStorage.setItem(unreadableCopy, raw); } catch { unreadableCopy = null; }
      }
    }
  } catch { /* Exploration also works when browser storage is unavailable. */ }

  // `edition` is the atlas's ceiling when this browser last saved. Content extensions are explicitly
  // authorized by the viewer, so a viewer at the old ceiling follows it up. Saves from before the
  // field existed come from the episode-47 edition.
  const LEGACY_EDITION = 47;
  const savedEdition = Number.isInteger(stored.edition) ? stored.edition : LEGACY_EDITION;
  const extended = stored.cutoff !== undefined && MAX_EPISODE > savedEdition && Math.trunc(Number(stored.cutoff)) >= savedEdition;
  const cutoff = extended ? MAX_EPISODE : episodeNumber(stored.cutoff ?? MAX_EPISODE);
  const state = {
    cutoff,
    viewing: Math.min(cutoff, episodeNumber(stored.viewing ?? cutoff)),
    // A first visit opens where the current episode happens; later visits keep the last place.
    selected: typeof stored.selected === 'string' ? stored.selected
      : data.episodes.find(entry => entry.number === Math.min(cutoff, episodeNumber(stored.viewing ?? cutoff)))?.events.find(event => event.locationId)?.locationId || 'shiganshina',
    view: 'map',
    mapStyle: isMapStyle(stored.mapStyle) ? stored.mapStyle : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'parchment' : 'night'),
    layers: { locations: true, groups: true, territory: true, walls: true, ...(stored.layers && typeof stored.layers === 'object' ? stored.layers : {}) },
    activeEvent: null,
    focusCharacter: null,
    characterFilter: '',
    characterFaction: 'all',
    changesOnly: false,
    panelExpanded: !window.matchMedia('(max-width: 760px)').matches,
    card: null,
    zoom: 1,
    mapExtent: 'walls',
    panX: 0,
    panY: 0
  };
  function persist() {
    try {
      let current = {};
      try { current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { current = {}; }
      const saved = { cutoff: state.cutoff, edition: MAX_EPISODE, viewing: state.viewing, selected: state.selected, mapExtent: state.mapExtent, mapStyle: state.mapStyle, layers: state.layers };
      // Preserve legacy notes without exposing a removed feature or erasing existing user data.
      if (Object.prototype.hasOwnProperty.call(current, 'notes')) saved.notes = current.notes;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      return true;
    } catch {
      return false;
    }
  }

  let toastTimeout;
  function toast(message) {
    clearTimeout(toastTimeout);
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 3200);
  }

  /* ---------- What is visible at the viewing episode ---------- */
  const locationsById = new Map(data.locations.map(location => [location.id, location]));
  const charactersById = new Map(data.characters.map(character => [character.id, character]));
  const visibleLocations = () => data.locations.filter(location => location.firstEpisode <= state.viewing);
  const getLocation = id => { const location = locationsById.get(id); return location && location.firstEpisode <= state.viewing ? location : undefined; };
  const visibleEpisodes = () => data.episodes.filter(episode => episode.number <= state.viewing);
  const visibleEvents = () => visibleEpisodes().flatMap(episode => episode.events.map(event => ({ ...event, episode: episode.number })));
  const visibleCharacters = () => data.characters.filter(character => character.firstEpisode <= state.viewing);
  const getCharacter = id => { const character = charactersById.get(id); return character && character.firstEpisode <= state.viewing ? character : undefined; };
  const nameOf = character => at(character.name, state.viewing)?.text || character.id;
  const roleOf = character => at(character.role, state.viewing)?.text || '';
  const factionOf = character => at(character.faction, state.viewing)?.key || 'civilian';
  const revealOf = character => (character.revealedAs && character.revealedAs.episode <= state.viewing ? getCharacter(character.revealedAs.id) : undefined);
  const lastPosition = character => (character.positions || []).filter(position => position.episode <= state.viewing).sort((a, b) => b.episode - a.episode)[0] || null;
  const peopleAt = locationId => visibleCharacters().flatMap(character => {
    const position = lastPosition(character);
    return position && position.locationId === locationId ? [{ character, position }] : [];
  });
  // Held/lost ground and gate states, as of the viewing episode.
  const statusHistory = target => (data.status || []).filter(item => item.target === target && item.from <= state.viewing).sort((a, b) => a.from - b.from);
  const statusOf = target => statusHistory(target).pop() || null;
  const KIND_LABEL = { district: 'District', village: 'Village', castle: 'Castle', capital: 'Seat of the king', forest: 'Approximate area', field: 'Approximate area', chapel: 'Approximate area', wall: 'Approximate sector', sea: 'Around the island', island: 'Island', country: 'Regional marker', city: 'City', site: 'Schematic position' };
  const knowledgeLabel = kind => ({ confirmed: 'Confirmed', belief: 'Character belief', approximate: 'Approximate geography' }[kind] || 'Approximate');
  const knowledgeBadge = kind => `<span class="knowledge-badge"><i class="knowledge-dot ${escapeHTML(kind)}"></i>${knowledgeLabel(kind)}</span>`;
  function ensureSelection() {
    if (!getLocation(state.selected)) state.selected = visibleLocations()[0]?.id || null;
  }
  // This episode's recorded changes, including events without an established map position.
  function mapChanges() {
    return [
      ...visibleEvents().filter(event => event.episode === state.viewing).map(event => ({ ...event, type: 'Event' })),
      ...visibleLocations().filter(location => location.firstEpisode === state.viewing).map(location => ({
        id: `new-${location.id}`, locationId: location.id, title: `New place: ${location.name}`, summary: location.subtitle, type: 'Place'
      })),
      ...(data.status || []).filter(item => item.from === state.viewing).map(item => ({
        id: `status-${item.target}`, locationId: item.target.startsWith('gate:') ? item.target.slice(5) : null,
        title: item.target.startsWith('gate:') ? `Gate ${item.state}` : 'Territory changed', summary: item.note, type: 'Status'
      }))
    ];
  }
  function renderChanges() {
    const changes = mapChanges();
    const panel = $('#episode-changes-panel');
    panel.hidden = !state.changesOnly;
    $('#show-changes').setAttribute('aria-pressed', String(state.changesOnly));
    panel.innerHTML = `<header><strong>Episode ${state.viewing}</strong><span role="status">${changes.length} recorded ${changes.length === 1 ? 'change' : 'changes'}</span></header><div class="change-list">${changes.length ? changes.map(change => {
      const place = getLocation(change.locationId);
      const copy = `<strong>${escapeHTML(change.title)}</strong><small>${place || change.placeName ? `${escapeHTML(place?.name || change.placeName)} · ` : ''}${escapeHTML(change.summary)}</small>`;
      return place ? `<button data-change-place="${escapeHTML(place.id)}"${change.type === 'Event' ? ` data-change-event="${escapeHTML(change.id)}"` : ''}>${copy}</button>` : `<div class="change-unpinned">${copy}<span>${change.type === 'Event' ? 'Not pinned on the map' : 'Territory'}</span></div>`;
    }).join('') : '<p class="search-empty">No changes are recorded for this episode. Earlier records remain on the map.</p>'}</div>`;
    $('#location-markers').classList.toggle('changes-mode', state.changesOnly);
    $('#territory-art').classList.toggle('changed-territory', state.changesOnly && changes.some(change => change.type === 'Status' && !change.locationId));
  }

  /* ---------- Portraits: a drawn emblem, or an image listed in portraits/portraits.js ---------- */
  const portraitFiles = window.ATLAS_PORTRAITS && typeof window.ATLAS_PORTRAITS === 'object' ? window.ATLAS_PORTRAITS : {};
  const brokenPortraits = new Set();
  // Source images stay unchanged; optional crop/sourceSize metadata frames their faces in SVG.
  const portraitVersion = id => {
    const entry = portraitFiles[id];
    return Array.isArray(entry) ? at(entry, state.viewing) : { file: entry };
  };
  const portraitOf = id => {
    const file = portraitVersion(id)?.file;
    return typeof file === 'string' && /^[\w.-]+\.(jpe?g|png|webp)$/i.test(file) && !brokenPortraits.has(`${id}/${file}`) ? `portraits/${file}` : null;
  };
  const portraitFrame = id => {
    const version = portraitVersion(id);
    const crop = version?.crop;
    const size = version?.sourceSize;
    if (!Array.isArray(crop) || crop.length !== 4 || !Array.isArray(size) || size.length !== 2
      || ![...crop, ...size].every(Number.isFinite)) return null;
    const [x, y, width, height] = crop;
    return x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= size[0] && y + height <= size[1]
      ? { crop, size } : null;
  };
  function framedPortrait(id, src, frame) {
    return `<image href="${escapeHTML(src)}" width="${frame.size[0]}" height="${frame.size[1]}" preserveAspectRatio="none" data-portrait="${escapeHTML(`${id}/${src.slice(10)}`)}"/>`;
  }
  // A listed file that fails to load falls back to the emblem.
  document.addEventListener('error', event => {
    const key = event.target.closest?.('[data-portrait]')?.dataset.portrait;
    if (!key || brokenPortraits.has(key)) return;
    brokenPortraits.add(key);
    render({ save: false });
  }, true);
  // Drawn silhouettes on a 40x40 grid for anyone without a picture: a person, a Titan, or a
  // regiment's wings. Colour comes from the regiment (see .faction-* in styles.css).
  const GLYPHS = {
    person: '<circle class="avatar-glyph" cx="20" cy="15.5" r="6.3"/><path class="avatar-glyph" d="M7.5 34c1.4-7 6.3-11 12.5-11s11.1 4 12.5 11Z"/>',
    titan: '<path class="avatar-glyph" d="M11 20c0-7 4-12 9-12s9 5 9 12c0 5-3 9-9 9s-9-4-9-9Z"/><path class="avatar-cut" d="M15.5 17.5h3m3 0h3M14.5 22.5q5.5 3.5 11 0M16.5 23v1.6m2.3-.8v1.8m2.4-1.8v1.8m2.3-2.6v1.6"/><path class="avatar-glyph soft" d="M6 36c2-4 7-6 14-6s12 2 14 6Z"/>',
    group: '<path class="avatar-glyph" d="M19 12c-5 1-9.5 6-10.5 14 3-2.5 6.5-3.5 10.5-3.5Z"/><path class="avatar-glyph soft" d="M21 12c5 1 9.5 6 10.5 14-3-2.5-6.5-3.5-10.5-3.5Z"/><path class="avatar-line" d="M12 29h16"/>'
  };
  function avatar(character, size = 'md') {
    const src = portraitOf(character.id);
    const classes = `avatar avatar-${size} faction-${factionOf(character)} type-${character.type}`;
    const frame = src && portraitFrame(character.id);
    if (frame) return `<svg class="${classes} image-portrait" viewBox="${frame.crop.join(' ')}" aria-hidden="true">${framedPortrait(character.id, src, frame)}</svg>`;
    if (src) return `<img class="${classes}" src="${escapeHTML(src)}" alt="" data-portrait="${escapeHTML(`${character.id}/${src.slice(10)}`)}">`;
    return `<svg class="${classes}" viewBox="0 0 40 40" aria-hidden="true"><circle class="avatar-disc" cx="20" cy="20" r="18"/><g clip-path="url(#avatar-glyph-clip)">${GLYPHS[character.type] || GLYPHS.person}</g></svg>`;
  }
  function mapAvatar(character, x, y, entering = false) {
    const src = portraitOf(character.id);
    const frame = src && portraitFrame(character.id);
    return `<g class="map-person faction-${factionOf(character)} type-${character.type}${entering ? ' enter' : ''}" data-person="${escapeHTML(character.id)}" transform="translate(${x} ${y})"><circle class="avatar-disc" r="11.5"/>${src
      ? (frame ? `<foreignObject x="-10.5" y="-10.5" width="21" height="21" clip-path="url(#avatar-clip)"><svg width="21" height="21" viewBox="${frame.crop.join(' ')}">${framedPortrait(character.id, src, frame)}</svg></foreignObject>` : `<image data-portrait="${escapeHTML(`${character.id}/${src.slice(10)}`)}" href="${escapeHTML(src)}" x="-10.5" y="-10.5" width="21" height="21" clip-path="url(#avatar-clip)" preserveAspectRatio="xMidYMid slice"/>`)
      : `<g transform="translate(-10.5 -10.5) scale(.525)" clip-path="url(#avatar-glyph-clip)">${GLYPHS[character.type] || GLYPHS.person}</g>`}</g>`;
  }
  function peopleList(ids, { compact = false } = {}) {
    const people = (ids || []).map(getCharacter).filter(Boolean);
    if (!people.length) return '';
    return `<ul class="people-list${compact ? ' compact' : ''}">${people.map(character => {
      const revealed = revealOf(character);
      const label = revealed ? `${nameOf(character)} (${nameOf(revealed)})` : nameOf(character);
      return `<li><button class="person-chip" data-open-character="${escapeHTML(character.id)}" title="${escapeHTML(label)}">${avatar(character, 'xs')}<span>${escapeHTML(label)}</span></button></li>`;
    }).join('')}</ul>`;
  }

  /* ---------- Header, views and controls ---------- */
  function applyMapStyle() {
    document.documentElement.dataset.mapStyle = state.mapStyle;
    $$('button[data-map-style]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mapStyle === state.mapStyle)));
  }
  const milestones = () => data.episodes.map(episode => episode.number).filter(number => number <= state.cutoff);
  function updateHeader() {
    $('#about-ceiling').textContent = `Its story content ends at episode ${MAX_EPISODE} (${seasonText(MAX_EPISODE).toLowerCase()}).`;
    $('#edition-hint').textContent = `Leave the limit at ${MAX_EPISODE} to browse every episode included in this atlas.`;
    $('#cutoff-input').max = String(MAX_EPISODE);
    const groups = data.seasons.filter(season => season.first <= state.cutoff).map(season => {
      const last = Math.min(state.cutoff, season.last ?? state.cutoff);
      const options = [];
      for (let number = season.first; number <= last; number += 1) {
        options.push(`<option value="${number}" ${number === state.viewing ? 'selected' : ''}>E${pad(number)}  ${escapeHTML(titleOfEpisode(number))}</option>`);
      }
      return `<optgroup label="Season ${season.season}">${options.join('')}</optgroup>`;
    });
    $('#episode-select').innerHTML = groups.join('');
    $('#episode-select').title = titleOfEpisode(state.viewing);
    $('#expanded-map-episode').textContent = `Episode ${state.viewing} · ${titleOfEpisode(state.viewing)}`;
    $('#expanded-gallery-episode').textContent = `Episode ${state.viewing} · ${titleOfEpisode(state.viewing)}`;
    const numbers = milestones();
    $('#prev-milestone').disabled = !numbers.some(number => number < state.viewing);
    $('#next-milestone').disabled = !numbers.some(number => number > state.viewing);
    $('#character-count').textContent = visibleCharacters().filter(character => character.type !== 'group').length;
    const milestone = data.episodes.find(entry => entry.number === state.viewing);
    const headings = {
      map: ['Explore the atlas.', milestone ? `Episode ${milestone.number} · ${milestone.description}` : `Episode ${state.viewing} has no milestone of its own; the map shows everything known by then.`],
      recap: ['The story so far.', `A briefing built only from what is known through episode ${state.viewing}.`],
      characters: ['The people.', `Everyone the atlas knows about as of episode ${state.viewing}, and only what is known by then.`]
    }[state.view];
    $('#page-title').textContent = headings[0];
    $('#page-description').textContent = headings[1];
    $$('[data-view]').forEach(button => {
      if (!button.classList.contains('nav-item')) return;
      const active = button.dataset.view === state.view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    ['map', 'recap', 'characters'].forEach(view => { $(`#${view}-view`).hidden = state.view !== view; });
  }

  /* ---------- Map ---------- */
  // District outlines grow out of their wall and appear only once the district is known.
  const WALLS = { 'Wall Maria': { width: 60, depth: 27, bulge: 25, start: -11 }, 'Wall Rose': { width: 44, depth: 21, bulge: 20, start: -1 }, 'Wall Sina': { width: 32, depth: 20, bulge: 17, start: -2 } };
  const SIDES = { right: [14, 4, 'start'], left: [-14, 4, 'end'], below: [0, 28, 'middle'], above: [0, -34, 'middle'], farRight: [36, 4, 'start'], farLeft: [-36, 4, 'end'], farAbove: [0, -52, 'middle'], farBelow: [0, 47, 'middle'], fartherBelow: [0, 72, 'middle'] };
  const PLACE_SYMBOLS = {
    hospital: '<path d="M-4 0H4M0-4V4"/>',
    festival: '<path d="M-3 5V-5M-3-5H4L2-2H-3"/>',
    stairs: '<path d="M-5-4H-2V-1H1V2H4V5"/>'
  };
  // Portrait i sits on an arc of radius 25 px around the pin, centred on `base` degrees; slot 3 is "+N".
  const chipOffset = (base, index) => {
    const [angle, radius] = [[0, 25], [-62, 25], [62, 25], [0, 46]][index];
    return [Math.cos((base + angle) * Math.PI / 180) * radius, Math.sin((base + angle) * Math.PI / 180) * radius].map(n => Math.round(n * 10) / 10);
  };
  const geometry = data.mapGeometry;
  const VIEW = geometry.wallsView;
  const mapAreaOf = location => location.mapArea || (location.kind === 'sea' ? 'island' : 'walls');
  const mapView = () => ({ walls: VIEW, island: geometry.islandView, world: geometry.worldView, liberio: geometry.liberioView })[state.mapExtent] || VIEW;
  const availableMapAreas = () => ['walls', ...(getLocation('sea') ? ['island'] : []),
    ...(state.viewing >= geometry.worldFrom ? ['world'] : []), ...(state.viewing >= geometry.liberioFrom ? ['liberio'] : [])];
  const locationsOnMap = () => visibleLocations().filter(location => state.mapExtent === 'world'
    ? mapAreaOf(location) === 'world' || location.worldPosition
    : state.mapExtent === 'island' ? ['walls', 'island'].includes(mapAreaOf(location)) || location.id === 'paradis'
      : mapAreaOf(location) === state.mapExtent);
  const pointOnMap = location => state.mapExtent === 'world' && location.worldPosition ? location.worldPosition
    : state.mapExtent === 'island' && location.id === 'paradis' ? { x: geometry.islandView.cx, y: geometry.islandView.cy } : location;
  function episodeMapFocus(number) {
    const episode = data.episodes.find(entry => entry.number === number);
    if (episode?.mapFocus) return episode.mapFocus;
    const place = episode?.events.find(event => event.locationId && getLocation(event.locationId));
    if (place) {
      const location = getLocation(place.locationId);
      return { area: location.opensMap || mapAreaOf(location), locationId: location.id };
    }
    const named = episode?.events.find(event => event.placeName)?.placeName;
    if (named?.startsWith('Liberio') && getLocation('liberio')) return { area: 'liberio', locationId: 'liberio' };
    if (named === 'Fort Slava' && getLocation('marley')) return { area: 'world', locationId: 'marley' };
    return null;
  }
  function episodeFocusDestination() {
    const focus = episodeMapFocus(state.viewing);
    if (!focus || !availableMapAreas().includes(focus.area)) return null;
    const locationId = focus.locationId || (focus.area === 'world' ? 'marley' : null);
    return getLocation(locationId) ? { area: focus.area, locationId } : null;
  }
  function syncEpisodeReturn() {
    const destination = episodeFocusDestination();
    const focused = destination && state.mapExtent === destination.area && state.selected === destination.locationId
      && Math.abs(state.zoom - 1) < .001 && Math.abs(state.panX) < .01 && Math.abs(state.panY) < .01;
    const button = $('#return-to-episode');
    button.disabled = !destination || focused;
    button.hidden = button.disabled;
    button.title = !destination ? 'No map setting is established for this episode'
      : focused ? 'Already at this episode’s setting' : 'Return to this episode’s setting';
  }
  function syncMapArea() {
    if (!availableMapAreas().includes(state.mapExtent)) { state.mapExtent = 'walls'; state.zoom = 1; state.panX = 0; state.panY = 0; }
    const locations = locationsOnMap();
    if (!locations.some(location => location.id === state.selected)) {
      const home = state.mapExtent === 'world' && getLocation(state.selected)?.regionId === 'marley' ? 'liberio'
        : { world: 'paradis', island: 'sea', liberio: 'liberio' }[state.mapExtent];
      state.selected = locations.find(location => location.id === home)?.id || locations[0]?.id || state.selected;
    }
  }
  const savedArea = stored.mapExtent;
  if (availableMapAreas().includes(savedArea)) state.mapExtent = savedArea;
  else {
    const focus = state.viewing >= 60 && episodeMapFocus(state.viewing);
    if (focus) { state.mapExtent = focus.area; state.selected = focus.locationId || 'marley'; }
    else if (getLocation(state.selected)) state.mapExtent = getLocation(state.selected).opensMap || mapAreaOf(getLocation(state.selected));
  }
  const RINGS = Object.fromEntries(Object.entries(geometry.wallRadiusKm).map(([name, km]) => [name, [km * geometry.unitsPerKm, km * geometry.unitsPerKm]]));
  // Main walls, name paths, and the overview share the same episode-one scale.
  for (const [name, [rx, ry]] of Object.entries(RINGS)) {
    $$(`[data-wall="${name}"]`).forEach(ellipse => {
      ellipse.setAttribute('rx', rx); ellipse.setAttribute('ry', ry);
    });
    for (const [suffix, sweep] of [['', 1], ['-low', 0]]) {
      $(`#wall-path-${name}${suffix}`).setAttribute('d', `M${600 - rx} 405A${rx} ${ry} 0 0 ${sweep} ${600 + rx} 405`);
    }
  }
  $('#map-overview svg').setAttribute('viewBox', `${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`);
  const ellipsePath = ([rx, ry]) => `M${600 - rx} 405a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
  // Markers, portraits and outlines that were not on screen in the previous render fade in once.
  let shownBefore = null;
  function renderTerritory() {
    const belt = statusOf('belt:maria-rose');
    $('#territory-art').innerHTML = belt?.state === 'lost'
      ? `<path class="lost-ground" fill-rule="evenodd" d="${ellipsePath(RINGS.maria)} ${ellipsePath(RINGS.rose)}"><title>Lost to the Titans since episode ${belt.from}</title></path>`
      : '';
    const walls = statusOf('walls:all');
    const fallen = walls?.state === 'fallen';
    $('#atlas-map').classList.toggle('former-walls', fallen);
    $('#map-overview').classList.toggle('former-walls', fallen);
    $('#island-wall-label text').textContent = fallen ? 'Former walls' : 'The walls';
    $('#wall-status-note').hidden = !fallen;
    $('#wall-status-note').textContent = fallen ? walls.note : '';
  }
  const coastPoints = geometry.islandOutline.map(([x, y]) => [600 + (x - geometry.islandReferenceCenter[0]) * geometry.islandReferenceScale, 405 + (y - geometry.islandReferenceCenter[1]) * geometry.islandReferenceScale]);
  // Closed curves round the reference's outline without turning it into an oval.
  const COAST = `M${coastPoints[0].join(' ')}${coastPoints.map((p, i, points) => {
    const previous = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    const after = points[(i + 2) % points.length];
    const a = p.map((v, axis) => v + (next[axis] - previous[axis]) / 8);
    const b = next.map((v, axis) => v - (after[axis] - p[axis]) / 8);
    return `C${a.join(' ')} ${b.join(' ')} ${next.join(' ')}`;
  }).join('')}Z`;
  function renderSea() {
    const sea = visibleLocations().find(location => location.kind === 'sea');
    $('#map-extent-switch').hidden = availableMapAreas().length < 2;
    $$('[data-map-extent]').forEach(button => { button.hidden = !availableMapAreas().includes(button.dataset.mapExtent); });
    if (!sea && state.mapExtent === 'island') { state.mapExtent = 'walls'; state.zoom = 1; state.panX = 0; state.panY = 0; }
    const water = `M-10000 -10000H10000V10000H-10000Z ${COAST}`;
    // One illustrative coast approach, rather than claiming a desert surrounds the whole island.
    const desert = sea && Number.isInteger(sea.desertFrom) && sea.desertFrom <= state.viewing
      ? `<g clip-path="url(#island-clip)"><path class="desert" d="M-320 650Q80 560 130 830T-140 1190Z"><title>Illustrative coastal terrain; its extent is not established</title></path><path class="desert-dunes" d="M-320 650Q80 560 130 830T-140 1190Z"/></g>`
      : '';
    $('#sea-art').innerHTML = sea
      ? `<defs><clipPath id="island-clip"><path d="${COAST}"/></clipPath></defs>${desert}<path class="sea-water" fill-rule="evenodd" d="${water}"/><path class="sea-waves" fill-rule="evenodd" d="${water}"/><path class="coastline" d="${COAST}"/>`
      : '';
    $('#overview-coast').setAttribute('d', sea ? COAST : '');
  }
  // The wider coast uses the visible part of the same episode-57 reference as the island.
  const MAINLAND = 'M0 100H616C613 151 629 203 659 247S730 295 724 357 681 436 689 494 736 535 738 589 774 607 745 646 802 669 839 651 852 700 900 710 915 757 998 775H0Z';
  const WORLD_ISLAND = geometry.islandOutline.map(([x, y]) => `${x * geometry.worldReferenceScale + geometry.worldReferenceOffset[0]},${y * geometry.worldReferenceScale + geometry.worldReferenceOffset[1]}`).join(' ');
  const CITY_BLOCKS = Array.from({ length: 5 }, (_, column) => Array.from({ length: 4 }, (_, row) =>
    `<rect x="${225 + column * 153}" y="${210 + row * 137}" width="120" height="103" rx="8"/>`).join('')).join('');
  function renderGeography() {
    const regional = ['world', 'liberio'].includes(state.mapExtent);
    $('#paradis-map-art').style.display = regional ? 'none' : '';
    $('#overview-walls').style.display = regional ? 'none' : '';
    $('#overview-coast').style.display = regional ? 'none' : '';
    let art = '', overview = '';
    if (state.mapExtent === 'world') {
      art = `<rect x="0" y="100" width="1200" height="675" class="sea-water"/><rect x="0" y="100" width="1200" height="675" class="sea-waves"/><path class="regional-land" d="${MAINLAND}"/><polygon class="regional-land" points="${WORLD_ISLAND}"/><g class="world-contours" fill="none"><path d="M100 210Q300 80 520 280M110 330Q350 250 580 420M170 500Q390 440 680 640"/></g>`;
      overview = `<path class="overview-land" d="${MAINLAND}"/><polygon class="overview-land" points="${WORLD_ISLAND}"/>`;
    } else if (state.mapExtent === 'liberio') {
      art = `<rect width="1200" height="920" fill="var(--carto-ground)"/><g class="city-blocks"><title>Illustrative blocks, not a verified street plan</title>${CITY_BLOCKS}</g><rect class="city-boundary" x="195" y="180" width="840" height="595" rx="38"/><g class="city-streets" fill="none"><path d="M175 461H1050M600 155V800"/></g>`;
      overview = '<rect class="overview-land" x="195" y="180" width="840" height="595" rx="38"/>';
    }
    $('#regional-map-art').innerHTML = art;
    $('#overview-region').innerHTML = overview;
    const accuracy = state.mapExtent === 'world' ? 'Established island and mainland; city markers and distances are approximate.'
      : state.mapExtent === 'liberio' ? 'Established places; their local layout is schematic, not a verified street plan.'
        : 'Wall radii follow the episode-one distances. Local positions, district sizes and coastline distances are approximate.';
    $('#map-accuracy-note').textContent = accuracy;
    const episode = data.episodes.find(episode => episode.number === state.viewing);
    const focusNote = episode?.mapFocus?.area === state.mapExtent ? episode.mapFocus.note : '';
    const unknown = episode?.events.find(event => !event.locationId && event.placeName);
    $('#map-area-note').textContent = regional
      ? `${focusNote || (unknown ? `${unknown.placeName}: exact position not established.` : '')} ${accuracy}`.trim()
      : focusNote || '';
    $('#map-area-note').hidden = !regional && !focusNote;
    $('.legend-lost-item').hidden = regional || !(state.layers.territory && statusOf('belt:maria-rose')?.state === 'lost');
    $('#wall-status-note').hidden = regional || !statusOf('walls:all');
  }
  function renderAreas() {
    $('#area-art').innerHTML = locationsOnMap().filter(location => location.area && state.mapExtent !== 'world').map(location =>
      `<ellipse class="place-area${location.id === state.selected ? ' selected' : ''}" data-area="${escapeHTML(location.id)}" cx="${pointOnMap(location).x}" cy="${pointOnMap(location).y}" rx="${Number(location.area.rx)}" ry="${Number(location.area.ry)}"/>`).join('');
  }
  function renderDistrictArt() {
    $('#district-art').innerHTML = visibleLocations().map(location => {
      const fresh = shownBefore && !shownBefore.has(location.id) ? ' enter' : '';
      if (location.kind === 'capital') return `<ellipse class="district-town${fresh}" cx="${location.x}" cy="${location.y}" rx="30" ry="24"/>`;
      const wall = location.kind === 'district' && WALLS[location.tags.find(tag => WALLS[tag])];
      if (!wall) return '';
      const angle = Math.atan2(location.y - 405, location.x - 600) * 180 / Math.PI;
      const half = wall.width / 2;
      const outline = `M${wall.start} ${-half}h${wall.depth}q${wall.bulge} ${half} 0 ${wall.width}h${-wall.depth}Z`;
      const gate = statusOf(`gate:${location.id}`);
      return `<g class="district${fresh}" transform="translate(${location.x} ${location.y}) rotate(${angle.toFixed(1)})">${gate ? `<title>Gate ${gate.state} in episode ${gate.from}</title>` : ''}<path class="district-gate${gate ? ` gate-${gate.state}` : ''}" d="${outline}"/><path class="district-town" d="${outline}"/></g>`;
    }).join('');
  }
  function renderMarkers() {
    const changes = mapChanges();
    $('#location-markers').innerHTML = locationsOnMap().map(location => {
      const selected = location.id === state.selected;
      const side = SIDES[location.label?.side] ? location.label.side : 'right';
      const [labelX, labelY, anchor] = SIDES[side];
      const fresh = location.firstEpisode === state.viewing && state.viewing > 1;
      const now = visibleEvents().some(event => event.locationId === location.id && event.episode === state.viewing);
      // Areas say "approximate" with their dashed outline, so they need no caption of their own.
      const caption = selected ? 'Exploring' : now ? 'This episode' : fresh ? 'New in this episode' : location.area ? '' : KIND_LABEL[location.kind] || 'Place';
      const episodes = [...new Set(visibleEvents().filter(event => event.locationId === location.id).map(event => event.episode))];
      const here = state.mapExtent === 'world' ? [] : peopleAt(location.id);
      const shown = here.slice(0, 3);
      // Portraits hug their own pin on a small arc, first on the side away from the label;
      // layoutChips() turns the arc if that side is taken by a neighbour.
      const base = side === 'left' ? 0 : side === 'below' ? -90 : 180;
      const chips = shown.map(({ character }, index) => mapAvatar(character, ...chipOffset(base, index), shownBefore && !shownBefore.has(`${character.id}@${location.id}`))).join('');
      const more = here.length > 3 ? `<text class="people-more" transform="translate(${chipOffset(base, 3).join(' ')})" y="4" text-anchor="middle">+${here.length - 3}</text>` : '';
      const peopleText = here.map(({ character, position }) => `${nameOf(character)}, last recorded in episode ${position.episode}`).join('; ');
      const label = location.mapLabel || location.name;
      const primary = ['district', 'capital', 'island', 'country', 'city', 'site'].includes(location.kind);
      const rank = selected ? 0 : now ? 1 : here.length ? 2 : primary ? 3 : 4;
      const change = changes.find(item => item.locationId === location.id);
      const classes = ['map-marker', `kind-${location.kind}`, !primary && 'minor', selected && 'selected', fresh && 'fresh', now && 'now', change && 'changed', location.area && 'is-area', location.mapAccuracy === 'approximate' && 'approximate-position', shownBefore && !shownBefore.has(location.id) && 'enter'].filter(Boolean).join(' ');
      const point = pointOnMap(location);
      const symbol = Object.hasOwn(PLACE_SYMBOLS, location.mapSymbol) ? PLACE_SYMBOLS[location.mapSymbol] : null;
      return `<g class="${escapeHTML(classes)}" data-location="${escapeHTML(location.id)}" data-side="${side}" data-rank="${rank}" data-caption="${escapeHTML(caption)}" data-change="${escapeHTML(change?.title || '')}" data-episodes="${episodes.join(', ')}" transform="translate(${Number(point.x)} ${Number(point.y)})" role="button" tabindex="0" aria-pressed="${selected}" aria-label="${escapeHTML(`Explore ${location.name}${location.mapAccuracy === 'approximate' ? '. Approximate map position' : ''}${peopleText ? `. Last recorded here: ${peopleText}` : ''}`)}">
        <g class="pin"><g class="pin-mark"><title>${escapeHTML(`${location.name} — ${location.subtitle}`)}</title><circle class="marker-hit" r="20"/><circle class="marker-pulse" r="16"/><circle class="marker-ring" r="7.5"/>${symbol ? `<g class="marker-symbol" data-map-symbol="${escapeHTML(location.mapSymbol)}" aria-hidden="true">${symbol}</g>` : '<circle class="marker-center" r="2.5"/>'}</g>
          ${here.length ? `<g class="pin-people">${chips}${more}</g>` : ''}
          <path class="label-leader"/>
          <text class="marker-label" x="${labelX}" y="${labelY}" text-anchor="${anchor}">${escapeHTML(label)}</text>
          <text class="marker-caption" x="${labelX}" y="${labelY + 15}" text-anchor="${anchor}">${escapeHTML(caption)}</text>
        </g>
      </g>`;
    }).join('');
    $('#location-markers').classList.toggle('has-now', Boolean($('#location-markers .map-marker.now')));
    shownBefore = new Set([...visibleLocations().map(location => location.id), ...visibleLocations().flatMap(location => peopleAt(location.id).map(({ character }) => `${character.id}@${location.id}`))]);
    $('#overview-places').innerHTML = locationsOnMap().map(location => `<circle cx="${pointOnMap(location).x}" cy="${pointOnMap(location).y}" r="${location.id === state.selected ? 22 : 12}" class="${location.id === state.selected ? 'selected' : ''}"/>`).join('');
  }
  function syncLayers() {
    $('#location-markers').classList.toggle('hide-places', !state.layers.locations);
    $('#area-art').style.display = state.layers.locations ? '' : 'none';
    $('#location-markers').classList.toggle('hide-people', !state.layers.groups);
    $('#territory-art').style.display = state.layers.territory ? '' : 'none';
    $('#district-art').classList.toggle('no-status', !state.layers.territory);
    $('.legend-lost-item').hidden = !(state.layers.territory && statusOf('belt:maria-rose')?.state === 'lost');
    $('#wall-labels').style.display = state.layers.walls ? '' : 'none';
    for (const name of ['locations', 'groups', 'territory', 'walls']) $(`#layer-${name}`).checked = Boolean(state.layers[name]);
  }

  // Labels keep a constant screen size, so crowded places compete for room. Place the most
  // relevant labels first; each tries its preferred side, then the others, then drops its
  // caption. A label that still collides is hidden; its name stays in the tooltip and aria-label.
  const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const inflate = (rect, by) => ({ left: rect.left - by, right: rect.right + by, top: rect.top - by, bottom: rect.bottom + by });
  function placeLabel(marker, side) {
    const [x, y, anchor] = SIDES[side];
    [[$('.marker-label', marker), 0], [$('.marker-caption', marker), 15]].forEach(([text, dy]) => {
      text.setAttribute('x', x);
      text.setAttribute('y', y + dy);
      text.setAttribute('text-anchor', anchor);
    });
    const leader = $('.label-leader', marker);
    const endpoint = { farRight: [28, 0], farLeft: [-28, 0], farAbove: [0, -36], farBelow: [0, 30], fartherBelow: [0, 56] }[side];
    leader.setAttribute('d', endpoint ? `M0 0L${endpoint.join(' ')}` : '');
  }
  let layoutFrame = 0;
  const scheduleLayout = () => { cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(layoutLabels); };
  function layoutChips(markers) {
    const pins = markers.map(marker => ({ owner: marker, rect: inflate($('.marker-ring', marker).getBoundingClientRect(), 2) }));
    const taken = [];
    for (const marker of markers) {
      const chips = $$('.pin-people > *', marker);
      if (!chips.length) continue;
      const away = marker.dataset.side === 'left' ? 0 : marker.dataset.side === 'below' ? -90 : 180;
      const ownPin = pins.find(pin => pin.owner === marker).rect;
      const centre = rect => [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2];
      const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
      let rects = [];
      for (const base of [away, 90, -90, away + 180, 45, 135, 225, 315]) {
        chips.forEach((chip, index) => chip.setAttribute('transform', `translate(${chipOffset(base, index).join(' ')})`));
        rects = chips.map(chip => inflate(chip.getBoundingClientRect(), 1));
        if (!rects.some(rect => taken.some(other => overlaps(other, rect)) || pins.some(pin => pin.owner !== marker && (
          overlaps(pin.rect, rect) || distance(centre(rect), centre(pin.rect)) < distance(centre(rect), centre(ownPin))
        )))) break;
      }
      taken.push(...rects);
    }
  }
  function layoutLabels() {
    if (state.view !== 'map') return;
    const markers = $$('#location-markers .map-marker').sort((a, b) => a.dataset.rank - b.dataset.rank);
    layoutChips(markers);
    requestAnimationFrame(positionCard);
    markers.forEach(marker => marker.classList.remove('label-hidden', 'caption-hidden'));
    // A label may touch its own pin but never any portrait, its own included.
    const obstacles = markers.flatMap(marker => [
      { owner: marker, rect: inflate($('.marker-ring', marker).getBoundingClientRect(), 2) },
      ...$$('.map-person, .people-more', marker).map(shape => ({ owner: null, chipsOf: marker, rect: inflate(shape.getBoundingClientRect(), 2) }))
    ]);
    // The overlays drawn on top of the map count as occupied too.
    for (const overlay of $$('.map-stage > .zoom-controls, .map-stage > .map-legend, .map-stage > .compass-rose, .map-stage > .map-overview, .map-stage > .map-extent-switch, .map-stage > .map-scale, .map-stage > .map-episode-return')) {
      const rect = overlay.getBoundingClientRect();
      if (rect.width) obstacles.push({ owner: null, rect: inflate(rect, 4) });
    }
    // Zoomed in, a place's caption lists the episodes it appears in (the map as a story index).
    const zoomed = map.dataset.detail === 'detail';
    for (const marker of markers) {
      const eps = marker.dataset.episodes;
      const change = marker.dataset.change;
      $('.marker-caption', marker).textContent = state.changesOnly && change ? (change.length > 34 ? `${change.slice(0, 31)}…` : change) : zoomed && eps ? `${eps.includes(',') ? 'Episodes' : 'Episode'} ${eps}` : marker.dataset.caption;
    }
    // Labels must stay inside the map.
    const stage = inflate($('#map-stage').getBoundingClientRect(), -4);
    if (window.matchMedia('(max-width: 760px)').matches) stage.bottom = Math.min(stage.bottom, $('#location-panel').getBoundingClientRect().top - 4);
    const outside = rect => rect.left < stage.left || rect.right > stage.right || rect.top < stage.top || rect.bottom > stage.bottom;
    const placed = [];
    for (const marker of markers) {
      const label = $('.marker-label', marker);
      const caption = $('.marker-caption', marker);
      if (getComputedStyle(label).display === 'none') continue;
      const preferred = marker.dataset.side;
      const sides = [preferred, ...Object.keys(SIDES).filter(side => side !== preferred)];
      // Strict first; then a label may touch its own portraits rather than disappear.
      const blockedBy = loose => rect => outside(rect) || placed.some(other => overlaps(other, rect))
        || obstacles.some(other => other.owner !== marker && !(loose && other.chipsOf === marker) && overlaps(other.rect, rect));
      let done = false;
      for (const [loose, withCaption] of [[false, true], [false, false], [true, true], [true, false]]) {
        marker.classList.toggle('caption-hidden', !withCaption);
        for (const side of sides) {
          placeLabel(marker, side);
          const rects = [label, ...(withCaption ? [caption] : [])].map(text => inflate(text.getBoundingClientRect(), 1));
          if (!rects.some(blockedBy(loose))) { placed.push(...rects); done = true; break; }
        }
        if (done) break;
      }
      if (!done) {
        if (marker.classList.contains('selected')) {
          // Keep the selected name; its secondary caption may yield in a crowded area.
          marker.classList.add('caption-hidden');
          const inside = sides.find(side => { placeLabel(marker, side); return !blockedBy(false)(label.getBoundingClientRect()); })
            || sides.find(side => { placeLabel(marker, side); return !outside(label.getBoundingClientRect()); }) || preferred;
          placeLabel(marker, inside);
          placed.push(label.getBoundingClientRect());
        } else { placeLabel(marker, preferred); marker.classList.add('label-hidden'); }
      }
    }
    layoutWallNames([...placed, ...obstacles.map(other => other.rect)]);
  }
  // Wall names run along their wall. Each takes the first spot along the arc that no label,
  // pin or portrait is using, and grows with zoom at half the rate (√zoom).
  const WALL_SPOTS = [['', 19, '50%'], ['', 19, '36%'], ['', 19, '64%'], ['-low', -8, '50%'], ['-low', -8, '36%'], ['-low', -8, '64%'], ['', 19, '24%'], ['', 19, '76%']];
  function layoutWallNames(taken) {
    for (const text of $$('#wall-labels text')) {
      const path = $('textPath', text);
      const base = path.getAttribute('href').replace(/-low$/, '');
      // Top of the arc first, then the bottom; the first spot nothing else uses wins.
      const fits = WALL_SPOTS.find(([suffix, dy, offset]) => {
        path.setAttribute('href', base + suffix);
        text.setAttribute('dy', dy);
        path.setAttribute('startOffset', offset);
        const rect = text.getBoundingClientRect();
        return !taken.some(other => overlaps(other, rect));
      }) || WALL_SPOTS[0];
      path.setAttribute('href', base + fits[0]);
      text.setAttribute('dy', fits[1]);
      path.setAttribute('startOffset', fits[2]);
      taken.push(text.getBoundingClientRect());
    }
  }

  /* ---------- Person card: hover a portrait on the map, click to pin ---------- */
  let cardShowTimer;
  let cardHideTimer;
  function personCardHTML(character, location, position, pinned) {
    // "What they are doing there": the recorded note, then this place's events that involve
    // them from the episode they were recorded here, newest first.
    const doing = visibleEvents()
      .filter(event => event.locationId === location.id && (event.people || []).includes(character.id) && event.episode >= position.episode)
      .sort((a, b) => b.episode - a.episode)
      .slice(0, 2);
    return `<button class="card-close" data-close-card aria-label="Close">×</button>
      <div class="person-card-head">${avatar(character, 'xl')}<div><p class="panel-kicker">${escapeHTML(location.name)}, episode ${position.episode}</p><h3>${escapeHTML(nameOf(character))}</h3><p class="character-role">${escapeHTML(roleOf(character))}</p></div></div>
      <p class="person-card-note">${escapeHTML(position.note)}</p>
      ${doing.length ? `<p class="person-card-sub">What happens here</p><ol class="character-notes">${doing.map(event => `<li><span class="note-episode">E${pad(event.episode)}</span><span><strong>${escapeHTML(event.title)}.</strong> ${escapeHTML(event.summary)}</span></li>`).join('')}</ol>` : ''}
      <div class="person-card-actions">${character.type === 'group' ? '' : `<button class="card-link" data-open-character="${escapeHTML(character.id)}">Open character card</button>`}${pinned ? '' : '<span class="person-card-hint">Click the portrait to keep this open</span>'}</div>`;
  }
  function openCard(chip, pinned) {
    clearTimeout(cardShowTimer);
    clearTimeout(cardHideTimer);
    const character = getCharacter(chip.dataset.person);
    const location = getLocation(chip.closest('[data-location]')?.dataset.location);
    const position = character && lastPosition(character);
    if (!character || !location || position?.locationId !== location.id) return;
    state.card = { id: character.id, locationId: location.id, pinned };
    const card = $('#person-card');
    card.innerHTML = personCardHTML(character, location, position, pinned);
    card.classList.toggle('pinned', pinned);
    card.setAttribute('role', pinned ? 'dialog' : 'tooltip');
    card.setAttribute('aria-label', nameOf(character));
    card.hidden = false;
    positionCard();
  }
  function closeCard() {
    clearTimeout(cardShowTimer);
    clearTimeout(cardHideTimer);
    state.card = null;
    $('#person-card').hidden = true;
  }
  function positionCard() {
    const card = $('#person-card');
    if (!state.card || card.hidden) return;
    const chip = $(`[data-location="${CSS.escape(state.card.locationId)}"] .map-person[data-person="${CSS.escape(state.card.id)}"]`);
    if (!chip) { closeCard(); return; }
    const stage = $('#map-stage').getBoundingClientRect();
    // Narrow maps dock the card along the bottom; wide ones float it beside the portrait.
    const docked = stage.width < 560;
    card.classList.toggle('docked', docked);
    if (docked) { card.style.left = ''; card.style.top = ''; return; }
    const rect = chip.getBoundingClientRect();
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    let left = rect.right - stage.left + 12;
    if (left + width > stage.width - 8) left = rect.left - stage.left - 12 - width;
    left = Math.max(8, Math.min(stage.width - width - 8, left));
    const top = Math.max(8, Math.min(stage.height - height - 8, rect.top - stage.top + rect.height / 2 - height / 2));
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }

  /* ---------- Location panel ---------- */
  const SCENERY = {
    district: '<path d="M0 66H300V104H0Z" fill="var(--scene-wall)"/><path d="M0 65H300M0 75H300M0 86H300M0 97H300" stroke="var(--scene-dark)" stroke-width="1"/><path d="M0 61h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12" fill="none" stroke="var(--scene-light)" stroke-width="4"/><path d="M175 106V84a14 14 0 0 1 28 0v22" fill="var(--scene-dark)"/><g fill="var(--scene-mid)" stroke="var(--scene-dark)" stroke-width="1"><path d="M9 111V93l17-15 18 15v18Zm29 6V97l20-15 19 15v20Zm37-5V86l16-13 19 13v26Zm37 6V94l22-18 20 18v24Zm115-4V91l16-15 18 15v23Zm32 4V99l22-16 18 16v19Z"/></g><g fill="var(--scene-light)" opacity=".5"><path d="M22 96h5v6h-5Zm31 5h5v6h-5Zm37-10h5v6h-5Zm38 8h5v6h-5Zm116-3h5v6h-5Zm31 8h5v6h-5Z"/></g>',
    forest: '<g stroke="var(--scene-light)" stroke-width="7" opacity=".4"><path d="M40 120V0m-1 37L15 10m25 39 31-26M111 120V0m0 53L79 19m32 59 37-28M190 120V0m0 40L168 9m22 47 27-35M259 120V0m0 74-38-20m38-11 25-21"/></g>',
    village: '<path d="M0 86Q150 76 300 88V120H0Z" fill="var(--scene-ground)"/><g fill="var(--scene-mid)" stroke="var(--scene-dark)"><path d="M40 98V82l15-13 15 13v16Z"/><path d="M96 102V89l12-10 12 10v13Z"/><path d="M186 99V83l14-12 14 12v16Z"/><path d="M236 104V93l10-8 10 8v11Z"/></g><path d="M0 108h300M14 102v12m24-12v12m24-12v12m24-12v12m24-12v12m24-12v12m24-12v12m24-12v12m24-12v12m24-12v12m24-12v12m24-12v12" stroke="var(--scene-wall)" stroke-width="2" opacity=".6"/>',
    castle: '<path d="M0 104Q90 70 160 74T300 100V120H0Z" fill="var(--scene-ground)"/><path d="M118 80V38h7v-6h6v6h7v-6h6v6h7v-6h6v6h7v42Z" fill="var(--scene-mid)" stroke="var(--scene-dark)"/><path d="M170 82V58h6v-5h6v5h6v-5h6v29Z" fill="var(--scene-mid)" stroke="var(--scene-dark)"/><path d="M134 80V64a6 6 0 0 1 12 0v16" fill="var(--scene-dark)"/><path d="M129 48h4v6h-4Zm16 0h4v6h-4Z" fill="var(--scene-light)" opacity=".5"/>',
    wall: '<path d="M0 40H300V120H0Z" fill="var(--scene-wall)"/><path d="M0 36h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14" fill="none" stroke="var(--scene-light)" stroke-width="5"/><path d="M0 56H300M0 72H300M0 88H300M0 104H300M40 40v16m60 0v16m-30 0v16m90-32v16m60 0v16m-30 0v16m60-48v16" stroke="var(--scene-dark)" stroke-width="1.2"/>',
    field: '<path d="M0 80Q150 70 300 82V120H0Z" fill="var(--scene-ground)"/><g fill="var(--scene-dark)"><path d="M20 80q6-14 12 0Zm18 1q5-10 10 0Zm210-2q6-13 12 0Zm18 1q5-10 10 0Z"/></g><path d="M20 100q10-4 20 0m30 6q10-4 20 0m40-10q10-4 20 0m40 8q10-4 20 0m30-6q10-4 20 0" stroke="var(--scene-wall)" stroke-width="1.5" fill="none" opacity=".7"/>',
    chapel: '<path d="M0 84H300V120H0Z" fill="var(--scene-ground)"/><g stroke="var(--scene-light)" stroke-width="4" opacity=".3"><path d="M40 84V20m220 64V26"/></g><path d="M128 84V58l22-18 22 18v26Z" fill="var(--scene-mid)" stroke="var(--scene-dark)"/><path d="M144 44V28l6-9 6 9v16" fill="var(--scene-mid)" stroke="var(--scene-dark)"/><path d="M145 84V70a5 5 0 0 1 10 0v14" fill="var(--scene-dark)"/><path d="M104 120q46-30 92 0Z" fill="var(--scene-dark)"/><path d="M120 116l9-8 6 5 10-9 8 7 9-6 8 7" stroke="var(--scene-reflection)" stroke-width="1.4" fill="none" opacity=".45"/>',
    sea: '<path d="M0 70H300V120H0Z" fill="var(--scene-reflection)" opacity=".35"/><path d="M0 64h10v8h10v-8h10v8h10v-8h10v8h10v-8h10v8h10V76H0Z" fill="var(--scene-wall)"/><g fill="none" stroke="var(--scene-light)" stroke-width="2" stroke-linecap="round" opacity=".55"><path d="M120 84q10-7 20 0t20 0 20 0M200 96q10-7 20 0t20 0 20 0M110 104q10-7 20 0t20 0M230 78q8-6 16 0t16 0M40 98q10-7 20 0t20 0"/></g>',
    capital: '<path d="M0 88H300V120H0Z" fill="var(--scene-ground)"/><g fill="var(--scene-mid)" stroke="var(--scene-dark)"><path d="M14 110V86h22v24Zm28 0V78h18v32Zm26 0V90h20v20Zm120 0V82h20v28Zm26 0V88h24v22Zm30 0V80h18v30Z"/><path d="M110 110V66h80v44Z"/><path d="M122 66V50l28-16 28 16v16Z"/><path d="M146 34V20l4-6 4 6v14"/></g><g fill="var(--scene-light)" opacity=".5"><path d="M130 80h6v8h-6Zm18 0h6v8h-6Zm18 0h6v8h-6Z"/></g>'
  };
  function illustration(location) {
    // Original decorative drawings, never episode screenshots.
    const scene = SCENERY[location.kind] || (['city', 'site'].includes(location.kind) ? SCENERY.capital : ['country', 'island'].includes(location.kind) ? SCENERY.field : SCENERY.district);
    return `<div class="panel-illustration" aria-hidden="true"><svg viewBox="0 0 300 120" preserveAspectRatio="xMidYMid slice"><rect width="300" height="120" fill="var(--scene-sky)"/><circle cx="218" cy="30" r="21" fill="var(--scene-light)" opacity=".12"/><path d="M0 57 24 38 59 48 103 26 147 46 186 35 232 58 279 37 300 47V120H0Z" fill="var(--scene-ground)" opacity=".5"/>${scene}<path d="M0 115Q150 93 300 113V120H0Z" fill="var(--scene-dark)"/></svg><span class="panel-image-tag">${escapeHTML(KIND_LABEL[location.kind] || 'Place')}</span></div>`;
  }
  function eventCard(event) {
    return `<article class="event-card" data-event-id="${escapeHTML(event.id)}"><p class="episode-tag">Episode ${event.episode}</p><h4>${escapeHTML(event.title)}</h4><p>${escapeHTML(event.summary)}</p>${event.connection ? `<p class="connection-text">${escapeHTML(event.connection)}</p>` : ''}<div class="event-foot">${knowledgeBadge(event.kind)}</div>${peopleList(event.people, { compact: true })}</article>`;
  }
  function renderPanel() {
    const location = getLocation(state.selected);
    if (!location) { $('#location-panel').innerHTML = '<div class="panel-content"><p>No places are known at this point.</p></div>'; return; }
    const events = visibleEvents().filter(event => event.locationId === location.id);
    // Put the selected event first while keeping the other recorded events available.
    events.sort((a, b) => (state.activeEvent ? (b.id === state.activeEvent) - (a.id === state.activeEvent) : 0) || b.episode - a.episode);
    const thisEpisode = events.filter(event => event.episode === state.viewing);
    const earlierEvents = events.filter(event => event.episode !== state.viewing);
    const gates = statusHistory(`gate:${location.id}`);
    const lost = statusOf('belt:maria-rose')?.state === 'lost' && location.tags.some(tag => tag === 'Between the walls' || tag === 'Beyond Wall Rose') ? statusOf('belt:maria-rose') : null;
    const here = peopleAt(location.id);
    const latest = thisEpisode[0] || events[0];
    $('#location-panel').innerHTML = `<button type="button" id="place-peek" class="place-peek" aria-controls="place-details"><span class="sheet-handle" aria-hidden="true"></span><span class="place-peek-copy"><strong>${escapeHTML(location.name)}</strong><small>${latest ? `E${latest.episode} · ${escapeHTML(latest.title)}` : 'No event recorded here yet'}</small></span><span class="peek-action"></span></button><div id="place-details">${illustration(location)}<div class="panel-content">
      <header class="place-heading"><p class="panel-kicker">As of episode ${state.viewing}</p><h2>${escapeHTML(location.name)}</h2><p class="panel-subtitle">${escapeHTML(location.subtitle)}</p></header>${knowledgeBadge('approximate')}
      ${gates.length || lost ? `<p class="status-line">${gates.map(gate => `<span class="status-chip gate-${escapeHTML(gate.state)}">Gate ${escapeHTML(gate.state)}, E${gate.from}</span>`).join('')}${lost ? `<span class="status-chip gate-breached">Lost ground since E${lost.from}</span>` : ''}</p>` : ''}
      ${thisEpisode.length ? `<section class="panel-block now-block"><h3>This episode</h3>${thisEpisode.map(eventCard).join('')}</section>` : ''}
      <section class="panel-block"><h3>${thisEpisode.length ? 'Earlier here' : 'What happened here'}</h3>${earlierEvents.length ? earlierEvents.map(eventCard).join('') : `<p>${thisEpisode.length ? 'Nothing earlier is recorded here.' : 'No event is recorded here by the selected episode.'}</p>`}</section>
      ${here.length ? `<section class="panel-block"><h3>Last recorded here</h3>${here.map(({ character, position }) => `<button class="person-row" data-open-character="${escapeHTML(character.id)}">${avatar(character, 'sm')}<span><strong>${escapeHTML(nameOf(character))}</strong><small>Episode ${position.episode}. ${escapeHTML(position.note)}</small></span></button>`).join('')}</section>` : ''}
      <section class="panel-block"><h3>About this place</h3><p>${escapeHTML(location.summary)}</p><p class="why-text">${escapeHTML(location.why)}</p></section>
      <p class="panel-footnote" id="place-geography-note"><strong>Map accuracy.</strong> ${escapeHTML(location.geographyNote || location.geography)}</p>
    </div></div>`;
    syncPanel();
  }
  function syncPanel() {
    const panel = $('#location-panel');
    const phone = window.matchMedia('(max-width: 760px)').matches;
    const details = $('#place-details');
    panel.hidden = !phone && !state.panelExpanded;
    if (details) details.hidden = !state.panelExpanded;
    panel.classList.toggle('details-open', state.panelExpanded);
    const peek = $('#place-peek');
    if (peek) {
      peek.setAttribute('aria-expanded', String(state.panelExpanded));
      peek.setAttribute('aria-label', `${state.panelExpanded ? 'Collapse' : 'Show'} details for ${getLocation(state.selected)?.name || 'this place'}`);
      $('.peek-action', peek).textContent = state.panelExpanded ? (phone ? 'Less' : 'Hide details') : 'More';
    }
    $('#map-panel-toggle').setAttribute('aria-expanded', String(state.panelExpanded));
    $('#map-panel-toggle').textContent = state.panelExpanded ? 'Hide details' : 'Place details';
    $('#map-stage').classList.toggle('has-sheet', phone);
    $('#map-stage').style.setProperty('--sheet-height', `${phone ? panel.offsetHeight : 0}px`);
    $('#map-stage').style.setProperty('--sheet-peek-height', `${phone ? peek?.offsetHeight || 90 : 0}px`);
  }
  function setPanelExpanded(expanded) {
    state.panelExpanded = expanded;
    syncPanel();
    applyCamera();
  }

  /* ---------- Timeline, recap, characters ---------- */
  function renderTimeline() {
    const episodes = visibleEpisodes();
    $('#timeline-count').textContent = `${episodes.length} of ${data.episodes.length} milestones`;
    $('#timeline-track').innerHTML = episodes.map(episode => {
      const places = [...new Set(episode.events.map(event => event.locationId).filter(Boolean))].map(getLocation).filter(Boolean);
      const settings = [...new Set(episode.events.map(event => event.placeName).filter(Boolean))];
      const where = places.length ? places.map(place => place.mapLabel || place.name).join(', ') : settings.join(', ') || 'Not pinned on the map';
      return `<button class="timeline-event ${episode.number === state.viewing ? 'active' : ''}" data-episode="${episode.number}" title="${escapeHTML(episode.title)}" aria-label="View episode ${episode.number}: ${escapeHTML(episode.title)}, ${escapeHTML(where)}" ${episode.number === state.viewing ? 'aria-current="step"' : ''}><span class="time-number">E${pad(episode.number)}</span><strong>${escapeHTML(episode.title)}</strong><span class="time-place">${escapeHTML(where)}</span></button>`;
    }).join('');
    centerTimeline();
  }
  function centerTimeline() {
    const active = $('.timeline-event.active');
    const track = $('#timeline-track');
    if (active && state.view === 'map') track.scrollLeft += active.getBoundingClientRect().left - track.getBoundingClientRect().left - track.clientWidth / 2 + active.clientWidth / 2;
  }
  function renderRecap() {
    const currentEpisode = data.episodes.find(episode => episode.number === state.viewing);
    const events = visibleEvents().slice().reverse();
    $('#recap-view').innerHTML = `<div class="recap-intro">${icon('shield')}<div><p class="panel-kicker">Briefing, episode ${state.viewing}</p><h2>${escapeHTML(titleOfEpisode(state.viewing))}</h2><p>${escapeHTML(currentEpisode?.description || `No new milestone is mapped for episode ${state.viewing}. Below are the selected events established by this point.`)}</p><p class="coverage-note">A selective recap, newest first. Some events happen in places the atlas cannot pin.</p></div></div><div class="recap-grid">${events.map((event, index) => {
      const location = event.locationId ? getLocation(event.locationId) : null;
      if (event.locationId && !location) return '';
      return `<article id="recap-${escapeHTML(event.id)}" tabindex="-1" class="recap-card${index === 0 ? ' recap-lead' : ''}">${index === 0 ? '<p class="recap-label">Latest recorded moment</p>' : ''}<p class="recap-meta">Episode ${event.episode}${location || event.placeName ? `, ${escapeHTML(location?.name || event.placeName)}` : ''}</p><h3>${escapeHTML(event.title)}</h3><p>${escapeHTML(event.summary)}</p>${event.connection ? `<p class="connection-text">${escapeHTML(event.connection)}</p>` : ''}${knowledgeBadge(event.kind)}${peopleList(event.people, { compact: true })}${location ? `<button class="card-link" data-open-event="${escapeHTML(event.id)}">Find it on the map</button>` : '<p class="unpinned">Not pinned on the map</p>'}</article>`;
    }).join('')}</div>`;
  }
  const CHARACTER_SECTIONS = [
    ['Survey Corps', ['survey']],
    ['Titans and Titan shifters', ['titan', 'shifter']],
    ['Marleyan military', ['marley']],
    ['Anti-Marleyan Volunteers', ['volunteer']],
    ['Yeagerists', ['yeagerist']],
    ['Training Corps', ['cadet']],
    ['Military and police', ['garrison', 'mp', 'central']],
    ['Civilians and nobility', ['civilian', 'crown']]
  ];
  const currentEpisode = () => data.episodes.find(episode => episode.number === state.viewing);
  const episodeParticipants = () => new Set((currentEpisode()?.events || []).flatMap(event => event.people || []));
  function episodeInvolvement(character) {
    const episode = currentEpisode();
    const event = episode?.events.find(event => (event.people || []).includes(character.id));
    if (!event) return '';
    const curated = episode.characterInvolvement?.[character.id];
    if (curated) return curated;
    const note = (character.notes || []).find(note => note.episode === state.viewing)?.text.trim();
    if (note) return note.match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] || note;
    return /flashback/i.test(event.connection || '')
      ? `Appears in the flashback “${event.title}”.` : `Appears in “${event.title}”.`;
  }
  function characterCard(character) {
    const involvement = state.characterFaction === 'episode' ? episodeInvolvement(character) : '';
    return `<article class="character-card faction-${factionOf(character)}${revealOf(character) ? ' revealed' : ''}${state.focusCharacter === character.id ? ' focused' : ''}" id="character-${escapeHTML(character.id)}" data-character="${escapeHTML(character.id)}" tabindex="-1">
      <h3 class="character-card-heading"><button type="button" class="character-card-button" data-show-character="${escapeHTML(character.id)}" aria-label="Open details for ${escapeHTML(nameOf(character))}"${involvement ? ` aria-describedby="character-involvement-${escapeHTML(character.id)}"` : ''} aria-haspopup="dialog" aria-controls="character-detail-dialog" aria-expanded="false">${avatar(character, 'lg')}<span class="character-card-copy"><span class="character-name">${escapeHTML(nameOf(character))}</span><span class="character-role" title="${escapeHTML(roleOf(character))}">${escapeHTML(roleOf(character))}</span>${involvement ? `<span class="character-involvement" id="character-involvement-${escapeHTML(character.id)}">${escapeHTML(involvement)}</span>` : ''}</span><svg class="icon character-card-chevron" aria-hidden="true"><use href="#i-next"/></svg></button></h3>
    </article>`;
  }
  function characterDetails(character) {
    const revealed = revealOf(character);
    const position = lastPosition(character);
    const place = position?.locationId ? getLocation(position.locationId) : null;
    const notes = (character.notes || []).filter(note => note.episode <= state.viewing).sort((a, b) => b.episode - a.episode);
    const noteItem = note => `<li><span class="note-episode">E${pad(note.episode)}</span><span>${escapeHTML(note.text)}</span></li>`;
    return `<div class="character-detail-identity">${avatar(character, 'lg')}<p class="character-description">${escapeHTML(roleOf(character))}</p></div>
        ${revealed ? `<p class="reveal-line">Revealed in episode ${character.revealedAs.episode}: <button class="inline-link" data-open-character="${escapeHTML(revealed.id)}">${escapeHTML(nameOf(revealed))}</button></p>` : ''}
        ${notes.length ? `<section class="character-detail-notes"><h3>Known so far</h3><ol class="character-notes">${notes.slice(0, 3).map(noteItem).join('')}</ol>${notes.length > 3 ? `<details class="more-notes"><summary>Earlier (${notes.length - 3})</summary><ol class="character-notes">${notes.slice(3).map(noteItem).join('')}</ol></details>` : ''}</section>` : ''}
        <footer class="character-detail-footer">${position ? (place
          ? `<button class="card-link" data-open-place="${escapeHTML(place.id)}">Last recorded at ${escapeHTML(place.name)}, episode ${position.episode}</button>`
          : `<span>Last recorded in episode ${position.episode}, somewhere this map does not place.</span>`) : ''}<span class="since">In the atlas from episode ${character.firstEpisode}</span></footer>
    `;
  }
  function renderCharacters() {
    const query = state.characterFilter.trim().toLocaleLowerCase();
    const participants = episodeParticipants();
    const episodeMode = state.characterFaction === 'episode';
    const matches = visibleCharacters().filter(character => character.type !== 'group' && (!query
      || [nameOf(character), roleOf(character), ...(character.aliases || [])].join(' ').toLocaleLowerCase().includes(query)));
    const sortCharacters = (a, b) => Boolean(revealOf(a)) - Boolean(revealOf(b)) || a.firstEpisode - b.firstEpisode;
    const episodeMatches = matches.filter(character => participants.has(character.id));
    const displayed = episodeMode ? episodeMatches : matches;
    const sections = state.characterFaction === 'all' || episodeMode
      ? (displayed.length ? `<h2 class="sr-only">Characters</h2><div class="character-grid${episodeMode ? ' episode-character-grid' : ''}">${displayed.sort(sortCharacters).map(characterCard).join('')}</div>` : '')
      : CHARACTER_SECTIONS.filter(([title]) => state.characterFaction === title).map(([title, keys]) => {
      const members = matches.filter(character => keys.includes(factionOf(character)))
        .sort(sortCharacters);
      return members.length ? `<section class="character-section"><h2>${title}<span>${members.length}</span></h2><div class="character-grid">${members.map(characterCard).join('')}</div></section>` : '';
    }).join('');
    const counts = Object.fromEntries(CHARACTER_SECTIONS.map(([title, keys]) => [title, matches.filter(character => keys.includes(factionOf(character))).length]));
    const chips = [['all', 'Everyone', matches.length], ['episode', 'This episode', episodeMatches.length], ...CHARACTER_SECTIONS.map(([title]) => [title, title, counts[title]])]
      .filter(([, , count], index) => index < 2 || count)
      .map(([value, label, count]) => `<button class="filter-chip" data-faction-filter="${escapeHTML(value)}" aria-pressed="${state.characterFaction === value}">${escapeHTML(label)} <span>${count}</span></button>`).join('');
    // The one expansion button lives beside the title on phones, and beside search elsewhere.
    $('#mobile-gallery-action').replaceChildren();
    const coverage = episodeMode ? `<p class="episode-cast-note" role="status">E${pad(state.viewing)} · Characters named in this episode’s recorded events.</p>` : '';
    const empty = episodeMode ? 'No character in this episode’s recorded events matches that filter.' : 'No character matches that filter at this episode.';
    $('#characters-view').innerHTML = `<div class="character-tools"><div class="filter-chips" role="group" aria-label="Show characters by episode or group">${chips}</div><label class="sr-only" for="character-filter">Filter characters</label><div class="gallery-actions"><input id="character-filter" type="search" placeholder="Filter by name or role" value="${escapeHTML(state.characterFilter)}" autocomplete="off"><button type="button" id="expand-gallery" class="expand-gallery" aria-label="Expand gallery" title="Expand gallery" aria-haspopup="dialog" aria-controls="expanded-gallery-dialog">${icon('expand')}<span class="expand-gallery-label">Expand gallery</span></button></div></div>${coverage}${sections || `<p class="search-empty">${empty}</p>`}`;
    syncGalleryAction();
  }
  function render({ save = true } = {}) {
    if (state.view !== 'characters') closeCharacterDetails({ restoreFocus: false });
    if (state.view !== 'map') closeExpandedMap();
    if (state.view !== 'characters') closeExpandedGallery();
    closeCard();
    ensureSelection();
    syncMapArea();
    updateHeader();
    renderSea();
    renderTerritory();
    renderDistrictArt();
    renderAreas();
    renderMarkers();
    renderChanges();
    syncLayers();
    renderGeography();
    renderPanel();
    renderTimeline();
    renderRecap();
    renderCharacters();
    syncCharacterDetails();
    // Search results are rebuilt from the current visibility boundary, never retained across it.
    $('#location-search').value = '';
    $('#search-results').hidden = true;
    $('#search-results').innerHTML = '';
    if (save) persist();
    applyCamera();
  }

  /* ---------- Navigation ---------- */
  function showView(view) {
    state.view = view;
    render();
    if (view === 'map') applyCamera();
    if (window.matchMedia('(max-width: 760px)').matches) $('main').scrollIntoView({ block: 'start' });
  }
  function selectLocation(id, { focus = false } = {}) {
    const location = getLocation(id);
    if (!location) return;
    state.selected = id;
    const area = location.opensMap || mapAreaOf(location);
    if (state.mapExtent !== area) { state.mapExtent = area; state.zoom = 1; state.panX = 0; state.panY = 0; }
    state.view = 'map';
    state.panelExpanded = !window.matchMedia('(max-width: 760px)').matches;
    render();
    $('#location-panel').scrollTop = 0;
    if (focus && !location.opensMap) {
      const point = pointOnMap(location);
      state.zoom = 1.45;
      state.panX = mapView().cx - point.x * state.zoom;
      state.panY = mapView().cy - point.y * state.zoom;
    }
    applyCamera();
    $(`[data-location="${state.selected}"]`)?.focus({ preventScroll: true });
  }
  function openCharacter(id) {
    const character = getCharacter(id);
    if (!character) return;
    // Identity links within a detail panel keep the underlying gallery and return target.
    if (characterDetailDialog.open) { showCharacterDetails(id); return; }
    state.view = 'characters';
    state.focusCharacter = id;
    state.characterFilter = '';
    state.characterFaction = 'all';
    render();
    const card = $(`#character-${CSS.escape(id)}`);
    card?.scrollIntoView({ block: 'center' });
    card?.querySelector('.character-card-button')?.focus({ preventScroll: true });
    showCharacterDetails(id);
  }
  function setEpisode(number, { follow = false } = {}) {
    state.viewing = Math.min(state.cutoff, episodeNumber(number));
    state.activeEvent = null;
    state.panelExpanded = !window.matchMedia('(max-width: 760px)').matches;
    // Follow the story: a milestone episode selects the place where it happens.
    const destination = follow && episodeFocusDestination();
    if (destination) {
      state.mapExtent = destination.area;
      state.selected = destination.locationId;
      state.zoom = 1; state.panX = 0; state.panY = 0;
    }
    ensureSelection();
    render();
    $('#location-panel').scrollTop = 0;
  }
  function stepMilestone(direction) {
    const numbers = milestones();
    const target = direction > 0 ? numbers.find(number => number > state.viewing) : numbers.filter(number => number < state.viewing).pop();
    if (!target) return;
    setEpisode(target, { follow: true });
  }

  /* ---------- Search: places, people and events known by the viewing episode ---------- */
  function searchAll() {
    const query = $('#location-search').value.trim().toLocaleLowerCase();
    const results = $('#search-results');
    if (!query) { results.hidden = true; results.innerHTML = ''; return; }
    const has = (...values) => values.flat().filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
    const places = visibleLocations().filter(location => has(location.name, location.mapLabel, location.subtitle, location.tags, location.aliases)).slice(0, 6);
    const people = visibleCharacters().filter(character => character.type !== 'group' && has(nameOf(character), roleOf(character), character.aliases)).slice(0, 6);
    const events = visibleEvents().filter(event => (!event.locationId || getLocation(event.locationId)) && has(event.title, event.summary, event.placeName)).slice(-5).reverse();
    const group = (title, items) => (items.length ? `<p class="search-group">${title}</p>${items.join('')}` : '');
    results.innerHTML = (group('Places', places.map(location => `<button data-search-location="${escapeHTML(location.id)}"><span>${escapeHTML(location.name)}</span><small>${escapeHTML(location.subtitle)}</small></button>`))
      + group('People', people.map(character => `<button class="search-person" data-open-character="${escapeHTML(character.id)}">${avatar(character, 'xs')}<span>${escapeHTML(nameOf(character))}<small>${escapeHTML(roleOf(character))}</small></span></button>`))
      + group('Events', events.map(event => `<button data-open-event="${escapeHTML(event.id)}"><span>${escapeHTML(event.title)}</span><small>Episode ${event.episode} · ${escapeHTML(getLocation(event.locationId)?.name || event.placeName || 'Recap')}${event.locationId ? '' : ' · Read recap'}</small></button>`)))
      || '<p class="search-empty">Nothing matching is recorded by this episode.</p>';
    results.hidden = false;
  }

  /* ---------- Camera ---------- */
  const map = $('#atlas-map');
  map.addEventListener('focusin', scheduleLayout);
  map.addEventListener('focusout', scheduleLayout);
  $('defs', map).insertAdjacentHTML('beforeend', '<clipPath id="avatar-clip" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath>');
  function applyCamera() {
    // In a tall expanded window, use its full height instead of shrinking the drawing
    // to fit the phone's width. The camera stays centred and the remaining ground can be panned.
    const stage = $('#map-stage');
    const view = mapView();
    const viewWidth = state.mapExtent === 'walls' && $('#expanded-map-dialog').open && map.clientHeight > 0
      ? Math.min(view.width, view.height * map.clientWidth / map.clientHeight) : view.width;
    map.setAttribute('viewBox', `${view.cx - viewWidth / 2} ${view.y} ${viewWidth} ${view.height}`);
    const viewport = map.viewBox.baseVal;
    const bounds = state.mapExtent === 'island'
      ? { left: Math.min(...coastPoints.map(p => p[0])), right: Math.max(...coastPoints.map(p => p[0])), top: Math.min(...coastPoints.map(p => p[1])), bottom: Math.max(...coastPoints.map(p => p[1])) }
      : state.mapExtent === 'walls' ? { left: 600 - RINGS.maria[0], right: 600 + RINGS.maria[0], top: 405 - RINGS.maria[1], bottom: 405 + RINGS.maria[1] }
        : { left: view.x, right: view.x + view.width, top: view.y, bottom: view.y + view.height };
    // Keep a substantial portion of the chosen map area on screen while panning.
    const zoom = state.zoom;
    const needX = Math.min(viewport.width, (bounds.right - bounds.left) * zoom) * 0.45;
    const needY = Math.min(viewport.height, (bounds.bottom - bounds.top) * zoom) * 0.45;
    state.panX = Math.min(viewport.x + viewport.width - needX - bounds.left * zoom, Math.max(viewport.x + needX - bounds.right * zoom, state.panX));
    state.panY = Math.min(viewport.y + viewport.height - needY - bounds.top * zoom, Math.max(viewport.y + needY - bounds.bottom * zoom, state.panY));
    $('#map-camera').setAttribute('transform', `translate(${Math.round(state.panX * 100) / 100} ${Math.round(state.panY * 100) / 100}) scale(${zoom})`);
    $('#zoom-level').textContent = `${Math.round(zoom * 100)}%`;
    $('#zoom-out').disabled = zoom <= 0.75;
    $('#zoom-in').disabled = zoom >= 3;
    // Pins, labels and portraits keep one on-screen size whatever the zoom or window width.
    const ctm = map.getScreenCTM();
    if (ctm && ctm.a > 0) map.style.setProperty('--pin-scale', (1 / (ctm.a * zoom)).toFixed(4));
    const detailZoom = zoom * VIEW.height / view.height;
    map.style.setProperty('--wall-scale', (1 / Math.sqrt(detailZoom)).toFixed(4));
    map.dataset.detail = detailZoom < 1 ? 'overview' : detailZoom < 1.5 ? 'places' : 'detail';
    stage.dataset.extent = state.mapExtent;
    $$('[data-map-extent]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mapExtent === state.mapExtent)));
    const fallen = statusOf('walls:all')?.state === 'fallen';
    const mapTitle = state.mapExtent === 'world' ? 'Across the sea' : state.mapExtent === 'liberio' ? 'Liberio' : state.mapExtent === 'island' ? 'Paradis Island' : fallen ? 'Former walled territory' : 'The walled territory';
    $('#map-title-text').textContent = mapTitle;
    $('#expanded-map-title').textContent = mapTitle;
    $('#map-geography-badge').textContent = state.mapExtent === 'world' ? 'Approximate geography' : state.mapExtent === 'liberio' ? 'Schematic city' : state.mapExtent === 'island' ? 'Approximate coast' : fallen ? 'Former boundaries' : 'Scaled walls';
    $('#map-scale').hidden = state.mapExtent !== 'walls';
    map.setAttribute('aria-label', `${mapTitle}. ${state.mapExtent === 'liberio' ? 'Schematic local positions.' : state.mapExtent === 'world' ? 'Approximate geographic overview.' : 'Schematic map.'} Select a place to explore its story. Arrow keys move the map, plus and minus zoom.`);
    if (ctm?.a > 0) {
      $('#map-scale span').style.width = `${100 * geometry.unitsPerKm * ctm.a * zoom}px`;
      for (const id of ['sea-waves', 'dunes']) $(`#${id}`).setAttribute('patternTransform', `scale(${0.65 / (ctm.a * zoom)})`);
      // Texture and lighting cover the visible viewport, including SVG letterboxing.
      const box = map.getBoundingClientRect();
      const inverse = ctm.inverse();
      const topLeft = new DOMPoint(box.left, box.top).matrixTransform(inverse);
      const bottomRight = new DOMPoint(box.right, box.bottom).matrixTransform(inverse);
      const surface = { x: (topLeft.x - state.panX) / zoom - 2, y: (topLeft.y - state.panY) / zoom - 2,
        width: (bottomRight.x - topLeft.x) / zoom + 4, height: (bottomRight.y - topLeft.y) / zoom + 4 };
      $$('.map-surface').forEach(rect => { for (const [name, value] of Object.entries(surface)) rect.setAttribute(name, value); });
    }
    updateOverview(viewWidth);
    syncEpisodeReturn();
    scheduleLayout();
  }
  function updateOverview(viewWidth) {
    const overview = $('#map-overview');
    const view = mapView();
    overview.hidden = state.zoom <= 1.15 && viewWidth >= view.width;
    $('#map-overview svg').setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
    if (overview.hidden || !map.getScreenCTM()?.a) return;
    const stage = $('#map-stage').getBoundingClientRect();
    const sheetTop = window.matchMedia('(max-width: 760px)').matches ? $('#location-panel').getBoundingClientRect().top : stage.bottom;
    const topLeft = mapPoint(stage.left, stage.top);
    const bottomRight = mapPoint(stage.right, Math.min(stage.bottom, sheetTop));
    const left = Math.max(view.x, (topLeft.x - state.panX) / state.zoom);
    const top = Math.max(view.y, (topLeft.y - state.panY) / state.zoom);
    const right = Math.min(view.x + view.width, (bottomRight.x - state.panX) / state.zoom);
    const bottom = Math.min(view.y + view.height, (bottomRight.y - state.panY) / state.zoom);
    const rect = $('#overview-viewport');
    for (const [name, value] of Object.entries({ x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) })) rect.setAttribute(name, value.toFixed(2));
  }
  function zoomMap(factor, point = { x: mapView().cx, y: mapView().cy }) {
    const previous = state.zoom;
    state.zoom = Math.max(0.75, Math.min(3, state.zoom * factor));
    const ratio = state.zoom / previous;
    state.panX = point.x - (point.x - state.panX) * ratio;
    state.panY = point.y - (point.y - state.panY) * ratio;
    applyCamera();
  }
  const mapPoint = (x, y) => new DOMPoint(x, y).matrixTransform(map.getScreenCTM().inverse());
  let hintTimeout;
  function mapHint(text) {
    const hint = $('#map-hint');
    hint.textContent = text;
    hint.classList.add('visible');
    clearTimeout(hintTimeout);
    hintTimeout = setTimeout(() => hint.classList.remove('visible'), 1800);
  }

  // Mouse and pen drag the map. Touch scrolls the page with one finger and moves the map with two.
  let drag = null;
  map.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' || event.button !== 0 || event.target.closest('.map-marker')) return;
    const point = mapPoint(event.clientX, event.clientY);
    drag = { id: event.pointerId, x: point.x, y: point.y, panX: state.panX, panY: state.panY, startX: event.clientX, startY: event.clientY, moved: false };
    map.setPointerCapture(event.pointerId);
    map.classList.add('dragging');
  });
  map.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const point = mapPoint(event.clientX, event.clientY);
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true;
    state.panX = drag.panX + point.x - drag.x;
    state.panY = drag.panY + point.y - drag.y;
    applyCamera();
  });
  // A drag ends with a click on the map; swallow it so a pinned card survives panning.
  let swallowClick = false;
  const endDrag = () => { if (drag?.moved) swallowClick = true; drag = null; map.classList.remove('dragging'); };
  map.addEventListener('pointerup', endDrag);
  map.addEventListener('pointercancel', endDrag);
  map.addEventListener('lostpointercapture', endDrag);
  map.addEventListener('wheel', event => {
    if (!(event.ctrlKey || event.metaKey)) { mapHint(/Mac/.test(navigator.platform) ? 'Hold ⌘ and scroll to zoom the map' : 'Hold Ctrl and scroll to zoom the map'); return; }
    event.preventDefault();
    zoomMap(event.deltaY < 0 ? 1.12 : 1 / 1.12, mapPoint(event.clientX, event.clientY));
  }, { passive: false });
  let pinch = null;
  let touchHintShown = false;
  const touchCenter = touches => ({ x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 });
  const touchDistance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  map.addEventListener('touchstart', event => {
    if (event.touches.length !== 2) return;
    event.preventDefault();
    const center = touchCenter(event.touches);
    const point = mapPoint(center.x, center.y);
    pinch = { distance: touchDistance(event.touches), zoom: state.zoom, worldX: (point.x - state.panX) / state.zoom, worldY: (point.y - state.panY) / state.zoom };
  }, { passive: false });
  map.addEventListener('touchmove', event => {
    if (pinch && event.touches.length === 2) {
      event.preventDefault();
      const center = touchCenter(event.touches);
      const point = mapPoint(center.x, center.y);
      state.zoom = Math.max(0.75, Math.min(3, pinch.zoom * touchDistance(event.touches) / pinch.distance));
      state.panX = point.x - pinch.worldX * state.zoom;
      state.panY = point.y - pinch.worldY * state.zoom;
      applyCamera();
    } else if (event.touches.length === 1 && !touchHintShown) {
      touchHintShown = true;
      mapHint('Use two fingers to move or zoom the map');
    }
  }, { passive: false });
  map.addEventListener('touchend', event => { if (event.touches.length < 2) pinch = null; });
  map.addEventListener('keydown', event => {
    const marker = event.target.closest('[data-location]');
    if (marker && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      state.activeEvent = null;
      selectLocation(marker.dataset.location);
      return;
    }
    const moves = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] };
    if (moves[event.key]) { state.panX += moves[event.key][0]; state.panY += moves[event.key][1]; applyCamera(); }
    else if (event.key === '+' || event.key === '=') zoomMap(1.25);
    else if (event.key === '-' || event.key === '_') zoomMap(1 / 1.25);
    else if (event.key === '0') { state.zoom = 1; state.panX = 0; state.panY = 0; applyCamera(); }
    else return;
    event.preventDefault();
  });
  $('#zoom-in').addEventListener('click', () => zoomMap(1.25));
  $('#zoom-out').addEventListener('click', () => zoomMap(1 / 1.25));
  function resetMap() { state.zoom = 1; state.panX = 0; state.panY = 0; applyCamera(); }
  $$('[data-map-extent]').forEach(button => button.addEventListener('click', () => {
    if (!availableMapAreas().includes(button.dataset.mapExtent)) return;
    state.mapExtent = button.dataset.mapExtent;
    closeCard();
    state.zoom = 1; state.panX = 0; state.panY = 0;
    render();
  }));
  $('#reset-map').addEventListener('click', resetMap);
  $('#return-to-episode').addEventListener('click', () => {
    const destination = episodeFocusDestination();
    if (!destination) return;
    state.mapExtent = destination.area;
    state.selected = destination.locationId;
    state.activeEvent = null;
    state.zoom = 1; state.panX = 0; state.panY = 0;
    render();
    $('#location-panel').scrollTop = 0;
    $(`[data-location="${CSS.escape(destination.locationId)}"]`)?.focus({ preventScroll: true });
  });
  $('#map-overview').addEventListener('click', () => { resetMap(); map.focus({ preventScroll: true }); });
  window.addEventListener('resize', () => { centerTimeline(); syncPanel(); applyCamera(); });
  new ResizeObserver(() => { syncPanel(); if (state.view === 'map') applyCamera(); }).observe($('#location-panel'));

  /* ---------- Expanded map: the same map, with the whole window to explore ---------- */
  const expandedMapDialog = $('#expanded-map-dialog');
  const mapStage = $('#map-stage');
  const locationPanel = $('#location-panel');
  const mapToolbar = $('.map-toolbar');
  const episodeControl = $('.episode-control');
  const changesPanel = $('#episode-changes-panel');
  const mapStyleSwitch = $('#map-style-switch');
  // Anchors let every original control return to the same place without duplicate IDs/listeners.
  const mapHomes = [mapStage, locationPanel, mapToolbar, episodeControl, changesPanel, mapStyleSwitch].map(element => {
    const anchor = document.createComment('Map control home');
    element.before(anchor);
    return { element, anchor };
  });
  $('#map-options-content').append($('.layer-section'));
  let atlasScrollY = 0;
  function restoreExpandedMap() {
    if (!$('#expanded-map-slot').contains(mapStage)) return;
    for (const { element, anchor } of mapHomes) anchor.after(element);
    $('#map-options').open = false;
    $('#map-options-label').textContent = 'Layers';
    document.body.classList.remove('map-expanded');
    syncPanel();
    applyCamera();
    window.scrollTo({ top: atlasScrollY, behavior: 'instant' });
    if (state.view === 'map') $('#expand-map').focus({ preventScroll: true });
  }
  function closeExpandedMap() {
    if (expandedMapDialog.open) expandedMapDialog.close();
    restoreExpandedMap();
  }
  $('#expand-map').addEventListener('click', () => {
    if (expandedMapDialog.open) return;
    atlasScrollY = window.scrollY;
    $('#expanded-map-slot').append(mapStage, locationPanel);
    $('#expanded-toolbar-slot').append(mapToolbar);
    $('#expanded-episode-slot').append(episodeControl);
    $('#expanded-changes-slot').append(changesPanel);
    $('#map-options-content').prepend(mapStyleSwitch);
    $('#map-options-label').textContent = 'Layers & style';
    $('#map-options').open = false;
    document.body.classList.add('map-expanded');
    expandedMapDialog.showModal();
    syncPanel();
    applyCamera();
    $('#close-expanded-map').focus({ preventScroll: true });
  });
  $('#close-expanded-map').addEventListener('click', closeExpandedMap);
  expandedMapDialog.addEventListener('close', restoreExpandedMap);
  expandedMapDialog.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if ($('#map-options').open) { $('#map-options').open = false; $('#map-options summary').focus(); }
    else if (!$('#search-results').hidden) { $('#search-results').hidden = true; $('#location-search').focus(); }
    else if (state.card) closeCard();
    else if (state.panelExpanded && event.target.closest('#location-panel')) { setPanelExpanded(false); (window.matchMedia('(max-width: 760px)').matches ? $('#place-peek') : $('#map-panel-toggle')).focus(); }
    else closeExpandedMap();
  });
  $('#map-panel-toggle').addEventListener('click', () => setPanelExpanded(!state.panelExpanded));
  locationPanel.addEventListener('click', event => { if (event.target.closest('#place-peek')) setPanelExpanded(!state.panelExpanded); });
  let sheetGesture = null;
  let suppressSheetClick = false;
  locationPanel.addEventListener('pointerdown', event => {
    // A swipe may suppress its click entirely; a new interaction must still work.
    suppressSheetClick = false;
    const peek = event.target.closest('#place-peek');
    if (event.pointerType !== 'touch' || !peek) return;
    sheetGesture = { id: event.pointerId, y: event.clientY };
    peek.setPointerCapture(event.pointerId);
  });
  locationPanel.addEventListener('pointerup', event => {
    if (!sheetGesture || sheetGesture.id !== event.pointerId) return;
    const delta = event.clientY - sheetGesture.y;
    sheetGesture = null;
    if (Math.abs(delta) < 35) return;
    suppressSheetClick = true;
    setPanelExpanded(delta < 0);
  });
  locationPanel.addEventListener('pointercancel', () => { sheetGesture = null; });
  locationPanel.addEventListener('click', event => {
    if (!suppressSheetClick) return;
    suppressSheetClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  $('#show-changes').addEventListener('click', () => { state.changesOnly = !state.changesOnly; renderChanges(); scheduleLayout(); });

  /* ---------- Character details: native focus trap, episode-aware content, gallery return ---------- */
  const characterDetailDialog = $('#character-detail-dialog');
  let detailCharacterId = null;
  let detailReturnId = null;
  let detailScrollY = 0;
  let detailGalleryScrollTop = 0;
  function restoreCharacterDetails({ restoreFocus = true } = {}) {
    if (!detailCharacterId) return;
    const returnId = detailReturnId;
    detailCharacterId = null;
    detailReturnId = null;
    document.body.classList.remove('character-detail-open');
    $('#character-detail-title').textContent = '';
    $('#character-detail-episode').textContent = '';
    $('#character-detail-body').replaceChildren();
    $$('.character-card-button').forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (restoreFocus && state.view === 'characters') {
      const button = returnId && $(`[data-show-character="${CSS.escape(returnId)}"]`);
      (button || $('#character-filter'))?.focus({ preventScroll: true });
      window.scrollTo({ top: detailScrollY, behavior: 'instant' });
      $('#expanded-gallery-slot').scrollTop = detailGalleryScrollTop;
    }
  }
  function closeCharacterDetails(options) {
    if (characterDetailDialog.open) characterDetailDialog.close();
    restoreCharacterDetails(options);
  }
  function syncCharacterDetails() {
    if (!detailCharacterId) return;
    const character = getCharacter(detailCharacterId);
    if (!character || state.view !== 'characters') {
      state.focusCharacter = null;
      closeCharacterDetails();
      return;
    }
    const body = $('#character-detail-body');
    const hadBodyFocus = body.contains(document.activeElement);
    $('#character-detail-title').textContent = nameOf(character);
    $('#character-detail-episode').textContent = `As of E${pad(state.viewing)} · ${titleOfEpisode(state.viewing)}`;
    body.innerHTML = characterDetails(character);
    $$('.character-card').forEach(card => card.classList.toggle('focused', card.dataset.character === character.id));
    $$('.character-card-button').forEach(button => button.setAttribute('aria-expanded', String(button.dataset.showCharacter === character.id)));
    if (hadBodyFocus) $('#close-character-detail').focus({ preventScroll: true });
  }
  function showCharacterDetails(id) {
    if (!getCharacter(id)) return;
    if (!characterDetailDialog.open) {
      detailReturnId = document.activeElement.closest('[data-show-character]')?.dataset.showCharacter || id;
      detailScrollY = window.scrollY;
      detailGalleryScrollTop = $('#expanded-gallery-slot').scrollTop;
    }
    detailCharacterId = id;
    state.focusCharacter = id;
    syncCharacterDetails();
    $('#character-detail-body').scrollTop = 0;
    if (!characterDetailDialog.open) {
      document.body.classList.add('character-detail-open');
      characterDetailDialog.showModal();
    }
    $('#close-character-detail').focus({ preventScroll: true });
  }
  $('#close-character-detail').addEventListener('click', () => closeCharacterDetails());
  characterDetailDialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeCharacterDetails();
  });
  characterDetailDialog.addEventListener('close', () => {
    if (!characterDetailDialog.open) restoreCharacterDetails();
  });

  /* ---------- Expanded gallery: reuse the same cards, filters and episode boundary ---------- */
  const expandedGalleryDialog = $('#expanded-gallery-dialog');
  const charactersView = $('#characters-view');
  const charactersHome = charactersView.parentElement;
  let galleryScrollY = 0;
  function syncGalleryAction({ inGallery = false } = {}) {
    const button = $('#expand-gallery');
    if (!button) return;
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    const target = !inGallery && !expandedGalleryDialog.open && mobile && state.view === 'characters'
      ? $('#mobile-gallery-action') : $('.gallery-actions', charactersView);
    if (button.parentElement !== target) {
      const hadFocus = document.activeElement === button;
      target.append(button);
      if (hadFocus) button.focus({ preventScroll: true });
    }
  }
  window.matchMedia('(max-width: 760px)').addEventListener('change', () => syncGalleryAction());
  function restoreExpandedGallery() {
    if (!$('#expanded-gallery-slot').contains(charactersView)) return;
    charactersHome.insertBefore(charactersView, $('.page-footer'));
    document.body.classList.remove('gallery-expanded');
    syncGalleryAction();
    window.scrollTo({ top: galleryScrollY, behavior: 'instant' });
    if (state.view === 'characters') $('#expand-gallery')?.focus({ preventScroll: true });
  }
  function closeExpandedGallery() {
    if (expandedGalleryDialog.open) expandedGalleryDialog.close();
    restoreExpandedGallery();
  }
  function openExpandedGallery() {
    if (state.view !== 'characters' || expandedGalleryDialog.open) return;
    galleryScrollY = window.scrollY;
    syncGalleryAction({ inGallery: true });
    $('#expanded-gallery-slot').append(charactersView);
    document.body.classList.add('gallery-expanded');
    expandedGalleryDialog.showModal();
    $('#close-expanded-gallery').focus({ preventScroll: true });
  }
  $('#close-expanded-gallery').addEventListener('click', closeExpandedGallery);
  expandedGalleryDialog.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    // Search inputs otherwise consume Escape to clear the current filter.
    event.preventDefault();
    closeExpandedGallery();
  });
  expandedGalleryDialog.addEventListener('close', restoreExpandedGallery);

  $('#location-markers').addEventListener('pointerover', event => {
    const chip = event.target.closest('.map-person');
    if (!chip || event.pointerType === 'touch' || state.card?.pinned) return;
    clearTimeout(cardHideTimer);
    clearTimeout(cardShowTimer);
    cardShowTimer = setTimeout(() => openCard(chip, false), 90);
  });
  $('#location-markers').addEventListener('pointerout', event => {
    if (!event.target.closest('.map-person') || state.card?.pinned) return;
    clearTimeout(cardShowTimer);
    cardHideTimer = setTimeout(closeCard, 220);
  });
  // Hovering a milestone lights up its places; hovering a place dims milestones that never touch it.
  function highlightEpisode(number) {
    const episode = data.episodes.find(entry => entry.number === number);
    const places = episode ? new Set(episode.events.map(event => event.locationId).filter(Boolean)) : null;
    $('#location-markers').classList.toggle('highlighting', Boolean(places?.size));
    $$('#location-markers .map-marker').forEach(marker => marker.classList.toggle('highlight', Boolean(places?.has(marker.dataset.location))));
  }
  function highlightPlace(id) {
    $$('#timeline-track .timeline-event').forEach(item => {
      const episode = data.episodes.find(entry => entry.number === Number(item.dataset.episode));
      item.classList.toggle('dim', Boolean(id) && !episode.events.some(event => event.locationId === id));
    });
  }
  $('#timeline-track').addEventListener('pointerover', event => { const item = event.target.closest('[data-episode]'); if (item) highlightEpisode(Number(item.dataset.episode)); });
  $('#timeline-track').addEventListener('pointerleave', () => highlightEpisode(null));
  $('#timeline-track').addEventListener('focusin', event => { const item = event.target.closest('[data-episode]'); if (item) highlightEpisode(Number(item.dataset.episode)); });
  $('#timeline-track').addEventListener('focusout', () => highlightEpisode(null));
  $('#location-markers').addEventListener('pointerover', event => { const marker = event.target.closest('.map-marker'); if (marker && !event.target.closest('.map-person')) highlightPlace(marker.dataset.location); });
  $('#location-markers').addEventListener('pointerleave', () => highlightPlace(null));
  $('#person-card').addEventListener('pointerenter', () => clearTimeout(cardHideTimer));
  $('#person-card').addEventListener('pointerleave', () => { if (!state.card?.pinned) cardHideTimer = setTimeout(closeCard, 220); });

  /* ---------- Controls ---------- */
  $('#episode-select').addEventListener('change', event => setEpisode(event.target.value, { follow: true }));
  $('#prev-milestone').addEventListener('click', () => stepMilestone(-1));
  $('#next-milestone').addEventListener('click', () => stepMilestone(1));
  $('#location-search').addEventListener('input', searchAll);
  $('#location-search').addEventListener('keydown', event => {
    if (event.key === 'Escape' && !expandedMapDialog.open) $('#search-results').hidden = true;
    if (event.key === 'ArrowDown') { event.preventDefault(); $('#search-results button')?.focus(); }
    if (event.key === 'Enter') {
      const first = $('#search-results button');
      if (first && !$('#search-results').hidden) first.click();
    }
  });
  $('#search-results').addEventListener('keydown', event => {
    const buttons = $$('button', $('#search-results'));
    const index = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); buttons[(index + 1) % buttons.length]?.focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); if (index <= 0) $('#location-search').focus(); else buttons[index - 1].focus(); }
  });
  $('#characters-view').addEventListener('input', event => {
    if (event.target.id !== 'character-filter') return;
    state.characterFilter = event.target.value;
    state.focusCharacter = null;
    const caret = event.target.selectionStart;
    renderCharacters();
    const input = $('#character-filter');
    input.focus();
    input.setSelectionRange(caret, caret);
  });
  document.addEventListener('keydown', event => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    const otherDialog = $$('dialog[open]').some(dialog => dialog !== expandedMapDialog);
    if (event.key === '/' && !typing && !otherDialog && state.view === 'map') { event.preventDefault(); $('#location-search').focus(); }
    if (!typing && !otherDialog && (event.key === '[' || event.key === ']')) stepMilestone(event.key === ']' ? 1 : -1);
    if (event.key === 'Escape') { $('#search-results').hidden = true; closeCard(); }
  });
  for (const name of ['locations', 'groups', 'territory', 'walls']) {
    $(`#layer-${name}`).addEventListener('change', event => { state.layers[name] = event.target.checked; syncLayers(); persist(); });
  }
  function cutoffHint() {
    const value = Math.trunc(Number($('#cutoff-input').value));
    if (!value || value < 1) { $('#cutoff-hint').textContent = ''; return; }
    if (value > MAX_EPISODE) { $('#cutoff-hint').textContent = `This edition stops at episode ${MAX_EPISODE}.`; return; }
    $('#cutoff-hint').textContent = `Episode ${value} is ${seasonText(value).toLowerCase()}, “${titleOfEpisode(value)}”.`;
  }
  function showSettings() { $('#cutoff-input').value = state.cutoff; cutoffHint(); $('#settings-dialog').showModal(); }
  $('#cutoff-input').addEventListener('input', cutoffHint);
  $('#settings-button').addEventListener('click', showSettings);
  $('#settings-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!$('#settings-form').reportValidity()) return;
    state.cutoff = episodeNumber($('#cutoff-input').value);
    state.viewing = Math.min(state.viewing, state.cutoff);
    state.activeEvent = null;
    render();
    $('#settings-dialog').close();
    toast(`Spoiler limit set to episode ${state.cutoff}.`);
  });
  $('#about-button').addEventListener('click', () => $('#about-dialog').showModal());
  $('#map-guide').addEventListener('click', () => $('#about-dialog').showModal());
  $$('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }));
  document.addEventListener('click', event => {
    if (!event.target.closest('#map-options')) $('#map-options').open = false;
    if (swallowClick) { swallowClick = false; if (event.target.closest('#atlas-map')) return; }
    const mapStyleButton = event.target.closest('button[data-map-style]');
    if (mapStyleButton && isMapStyle(mapStyleButton.dataset.mapStyle)) {
      state.mapStyle = mapStyleButton.dataset.mapStyle;
      // Change only the palette so the camera and open cards stay intact.
      applyMapStyle();
      persist();
      return;
    }
    if (event.target.closest('#expand-gallery')) { openExpandedGallery(); return; }
    const characterCardButton = event.target.closest('[data-show-character]');
    if (characterCardButton) { showCharacterDetails(characterCardButton.dataset.showCharacter); return; }
    const chip = event.target.closest('.map-person');
    if (chip) { openCard(chip, true); return; }
    if (event.target.closest('[data-close-card]')) { closeCard(); return; }
    if (state.card && !event.target.closest('#person-card')) closeCard();
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) { showView(viewButton.dataset.view); return; }
    const marker = event.target.closest('[data-location]');
    if (marker) { state.activeEvent = null; selectLocation(marker.dataset.location); return; }
    const result = event.target.closest('[data-search-location]');
    if (result) { state.activeEvent = null; selectLocation(result.dataset.searchLocation, { focus: true }); return; }
    const change = event.target.closest('[data-change-place]');
    if (change) { state.activeEvent = change.dataset.changeEvent || null; selectLocation(change.dataset.changePlace, { focus: true }); return; }
    const factionChip = event.target.closest('[data-faction-filter]');
    if (factionChip) { state.characterFaction = factionChip.dataset.factionFilter; state.focusCharacter = null; renderCharacters(); $(`[data-faction-filter="${CSS.escape(state.characterFaction)}"]`)?.focus(); return; }
    const person = event.target.closest('[data-open-character]');
    if (person) { openCharacter(person.dataset.openCharacter); return; }
    const place = event.target.closest('[data-open-place]');
    if (place) { state.activeEvent = null; selectLocation(place.dataset.openPlace, { focus: true }); return; }
    const timelineEpisode = event.target.closest('[data-episode]');
    if (timelineEpisode) {
      const episode = data.episodes.find(item => item.number === Number(timelineEpisode.dataset.episode));
      if (episode && episode.number <= state.viewing) {
        setEpisode(episode.number, { follow: true });
        $('.timeline-event.active')?.focus({ preventScroll: true });
      }
      return;
    }
    const eventLink = event.target.closest('[data-open-event]');
    if (eventLink) {
      const storyEvent = visibleEvents().find(item => item.id === eventLink.dataset.openEvent);
      if (storyEvent?.locationId) { state.activeEvent = storyEvent.id; selectLocation(storyEvent.locationId, { focus: true }); }
      else if (storyEvent) {
        closeExpandedMap();
        showView('recap');
        const card = $(`#recap-${CSS.escape(storyEvent.id)}`);
        card?.scrollIntoView({ block: 'center' });
        card?.focus({ preventScroll: true });
      }
      return;
    }
    if (!event.target.closest('.search-wrap')) $('#search-results').hidden = true;
  });

  // Another tab saved: take its spoiler limit, keep this tab's own view.
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY || event.newValue === null) return;
    let incoming;
    try { incoming = JSON.parse(event.newValue) || {}; } catch { return; }
    state.cutoff = episodeNumber(incoming.cutoff ?? state.cutoff);
    state.viewing = Math.min(state.viewing, state.cutoff);
    render({ save: false });
    if (state.view === 'map') applyCamera();
  });

  applyMapStyle();
  render();
  applyCamera();
  $('#map-legend').addEventListener('toggle', scheduleLayout);
  if (unreadableCopy) toast('Saved data could not be read. A copy was kept in this browser and the atlas started fresh.');
  else if (extended) toast(`The atlas now reaches episode ${MAX_EPISODE}, and your spoiler limit followed.`);
})();
