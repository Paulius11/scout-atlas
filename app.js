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

  // Versioned fields: the entry with the latest `from` at or before the episode wins.
  const at = (list, episode) => (list || []).reduce((found, item) => (item.from <= episode && (!found || item.from >= found.from) ? item : found), null);
  const seasonOf = number => data.seasons.filter(season => season.first <= number).sort((a, b) => b.first - a.first)[0];
  const seasonText = number => { const season = seasonOf(number); return season ? `Season ${season.season}, episode ${number - season.first + 1}` : `Episode ${number}`; };

  /* ---------- Storage ---------- */
  const readNotes = value => (value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter(([key, note]) => /^\d+:[\w-]+$/.test(key) && typeof note === 'string'))
    : {});
  let storageAvailable = true;
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
  } catch { storageAvailable = false; }

  const cutoff = episodeNumber(stored.cutoff ?? MAX_EPISODE);
  const state = {
    cutoff,
    viewing: Math.min(cutoff, episodeNumber(stored.viewing ?? cutoff)),
    selected: typeof stored.selected === 'string' ? stored.selected : 'shiganshina',
    view: 'map',
    layers: { locations: true, groups: true, walls: true, ...(stored.layers && typeof stored.layers === 'object' ? stored.layers : {}) },
    notes: readNotes(stored.notes),
    activeEvent: null,
    focusCharacter: null,
    characterFilter: '',
    card: null,
    zoom: 1,
    panX: 0,
    panY: 0
  };
  // Note keys this tab changed since its last successful write.
  const pendingNotes = new Set();

  // Other tabs may have saved notes since this tab loaded, so merge instead of overwriting.
  function persist() {
    try {
      let current = {};
      try { current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { current = {}; }
      const notes = readNotes(current.notes);
      for (const key of pendingNotes) {
        if (key in state.notes) notes[key] = state.notes[key]; else delete notes[key];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cutoff: state.cutoff, viewing: state.viewing, selected: state.selected, layers: state.layers, notes }));
      state.notes = notes;
      pendingNotes.clear();
      storageAvailable = true;
      return true;
    } catch {
      storageAvailable = false;
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
  const availableNotes = () => Object.entries(state.notes).filter(([key, note]) => {
    const [episode, locationId] = key.split(':');
    return Number(episode) <= state.viewing && Number(episode) >= 1 && note.trim() && getLocation(locationId);
  });
  const KIND_LABEL = { district: 'District', village: 'Village', castle: 'Castle', capital: 'Seat of the king', forest: 'Approximate area', field: 'Approximate area', chapel: 'Approximate area', wall: 'Approximate sector' };
  const knowledgeLabel = kind => ({ confirmed: 'Confirmed', belief: 'Character belief', approximate: 'Approximate geography' }[kind] || 'Approximate');
  const knowledgeBadge = kind => `<span class="knowledge-badge"><i class="knowledge-dot ${escapeHTML(kind)}"></i>${knowledgeLabel(kind)}</span>`;
  function ensureSelection() {
    if (!getLocation(state.selected)) state.selected = visibleLocations()[0]?.id || null;
  }

  /* ---------- Portraits: a drawn emblem, or an image listed in portraits/portraits.js ---------- */
  const portraitFiles = window.ATLAS_PORTRAITS && typeof window.ATLAS_PORTRAITS === 'object' ? window.ATLAS_PORTRAITS : {};
  const brokenPortraits = new Set();
  // An entry is a file name, or a list of { from, file } versions chosen by the viewing episode.
  const portraitOf = id => {
    const entry = portraitFiles[id];
    const file = Array.isArray(entry) ? at(entry, state.viewing)?.file : entry;
    return typeof file === 'string' && /^[\w.-]+\.(jpe?g|png|webp)$/i.test(file) && !brokenPortraits.has(`${id}/${file}`) ? `portraits/${file}` : null;
  };
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
    if (src) return `<img class="${classes}" src="${escapeHTML(src)}" alt="" data-portrait="${escapeHTML(`${character.id}/${src.slice(10)}`)}">`;
    return `<svg class="${classes}" viewBox="0 0 40 40" aria-hidden="true"><circle class="avatar-disc" cx="20" cy="20" r="18"/><g clip-path="url(#avatar-glyph-clip)">${GLYPHS[character.type] || GLYPHS.person}</g></svg>`;
  }
  function mapAvatar(character, x, y) {
    const src = portraitOf(character.id);
    return `<g class="map-person faction-${factionOf(character)} type-${character.type}" data-person="${escapeHTML(character.id)}" transform="translate(${x} ${y})"><circle class="avatar-disc" r="11.5"/>${src
      ? `<image data-portrait="${escapeHTML(`${character.id}/${src.slice(10)}`)}" href="${escapeHTML(src)}" x="-10.5" y="-10.5" width="21" height="21" clip-path="url(#avatar-clip)" preserveAspectRatio="xMidYMid slice"/>`
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
  const milestones = () => data.episodes.map(episode => episode.number).filter(number => number <= state.cutoff);
  function updateHeader() {
    const season = seasonOf(state.cutoff);
    $('#cutoff-label').textContent = `Watched through episode ${state.cutoff}`;
    $('#spoiler-label').textContent = `Safe through E${state.cutoff}`;
    $('#season-label').textContent = season && season.last === state.cutoff ? `Season ${season.season} complete` : seasonText(state.cutoff);
    $('#progress-fill').style.width = `${state.cutoff / MAX_EPISODE * 100}%`;
    $('#footer-cutoff').textContent = `Your story stops at episode ${state.cutoff}. So does this atlas.`;
    $('#about-ceiling').textContent = `Its story content ends at episode ${MAX_EPISODE} (${seasonText(MAX_EPISODE).toLowerCase()}).`;
    $('#edition-hint').textContent = `This edition covers selected events from episodes 1–${MAX_EPISODE}. Later episodes are not included.`;
    $('#cutoff-input').max = String(MAX_EPISODE);
    const groups = data.seasons.filter(season => season.first <= state.cutoff).map(season => {
      const last = Math.min(state.cutoff, season.last ?? state.cutoff);
      const options = [];
      for (let number = season.first; number <= last; number += 1) {
        const episode = data.episodes.find(entry => entry.number === number);
        options.push(`<option value="${number}" ${number === state.viewing ? 'selected' : ''}>E${pad(number)}${episode ? `  ${escapeHTML(episode.shortTitle)}` : ''}</option>`);
      }
      return `<optgroup label="Season ${season.season}">${options.join('')}</optgroup>`;
    });
    $('#episode-select').innerHTML = groups.join('');
    const numbers = milestones();
    $('#prev-milestone').disabled = !numbers.some(number => number < state.viewing);
    $('#next-milestone').disabled = !numbers.some(number => number > state.viewing);
    $('#note-count').textContent = availableNotes().length;
    $('#character-count').textContent = visibleCharacters().filter(character => character.type !== 'group').length;
    const headings = {
      map: ['Find your bearings.', 'The places, the people, and the pieces coming together.'],
      recap: ['Connect the pieces.', `A briefing built only from what is known through episode ${state.viewing}.`],
      characters: ['Who’s who.', `Everyone the atlas knows about as of episode ${state.viewing}, and only what is known by then.`],
      notes: ['Keep your own record.', 'Your observations. Your questions. Your theories.']
    }[state.view];
    $('#page-title').textContent = headings[0];
    $('#page-description').textContent = headings[1];
    $$('[data-view]').forEach(button => {
      if (!button.classList.contains('nav-item')) return;
      const active = button.dataset.view === state.view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    ['map', 'recap', 'characters', 'notes'].forEach(view => { $(`#${view}-view`).hidden = state.view !== view; });
  }

  /* ---------- Map ---------- */
  // District outlines grow out of their wall and appear only once the district is known.
  const WALLS = { 'Wall Maria': { width: 60, depth: 27, bulge: 25, start: -11 }, 'Wall Rose': { width: 44, depth: 21, bulge: 20, start: -1 }, 'Wall Sina': { width: 32, depth: 20, bulge: 17, start: -2 } };
  const SIDES = { right: [14, 4, 'start'], left: [-14, 4, 'end'], below: [0, 28, 'middle'], above: [0, -34, 'middle'] };
  // Portrait i sits on an arc of radius 25 px around the pin, centred on `base` degrees; slot 3 is "+N".
  const chipOffset = (base, index) => {
    const [angle, radius] = [[0, 25], [-62, 25], [62, 25], [0, 46]][index];
    return [Math.cos((base + angle) * Math.PI / 180) * radius, Math.sin((base + angle) * Math.PI / 180) * radius].map(n => Math.round(n * 10) / 10);
  };
  function renderDistrictArt() {
    $('#district-art').innerHTML = visibleLocations().map(location => {
      if (location.kind === 'capital') return `<ellipse class="district-town" cx="${location.x}" cy="${location.y}" rx="30" ry="24"/>`;
      const wall = location.kind === 'district' && WALLS[location.tags.find(tag => WALLS[tag])];
      if (!wall) return '';
      const angle = Math.atan2(location.y - 405, location.x - 600) * 180 / Math.PI;
      const half = wall.width / 2;
      const outline = `M${wall.start} ${-half}h${wall.depth}q${wall.bulge} ${half} 0 ${wall.width}h${-wall.depth}Z`;
      return `<g transform="translate(${location.x} ${location.y}) rotate(${angle.toFixed(1)})"><path class="district-gate" d="${outline}"/><path class="district-town" d="${outline}"/></g>`;
    }).join('');
  }
  function renderMarkers() {
    $('#location-markers').innerHTML = visibleLocations().map(location => {
      const selected = location.id === state.selected;
      const side = SIDES[location.label?.side] ? location.label.side : 'right';
      const [labelX, labelY, anchor] = SIDES[side];
      const fresh = location.firstEpisode === state.viewing && state.viewing > 1;
      const caption = selected ? 'Exploring' : fresh ? 'New in this episode' : KIND_LABEL[location.kind] || 'Place';
      const here = peopleAt(location.id);
      const shown = here.slice(0, 3);
      // Portraits hug their own pin on a small arc, first on the side away from the label;
      // layoutChips() turns the arc if that side is taken by a neighbour.
      const base = side === 'left' ? 0 : side === 'below' ? -90 : 180;
      const chips = shown.map(({ character }, index) => mapAvatar(character, ...chipOffset(base, index))).join('');
      const more = here.length > 3 ? `<text class="people-more" transform="translate(${chipOffset(base, 3).join(' ')})" y="4" text-anchor="middle">+${here.length - 3}</text>` : '';
      const peopleText = here.map(({ character, position }) => `${nameOf(character)}, last recorded in episode ${position.episode}`).join('; ');
      const label = location.mapLabel || location.name;
      const busy = visibleEvents().some(event => event.locationId === location.id && event.episode === state.viewing);
      const rank = selected ? 0 : busy ? 1 : here.length ? 2 : ['district', 'capital'].includes(location.kind) ? 3 : 4;
      return `<g class="map-marker kind-${escapeHTML(location.kind)}${selected ? ' selected' : ''}${fresh ? ' fresh' : ''}" data-location="${escapeHTML(location.id)}" data-side="${side}" data-rank="${rank}" transform="translate(${Number(location.x)} ${Number(location.y)})" role="button" tabindex="0" aria-pressed="${selected}" aria-label="${escapeHTML(`Explore ${location.name}${peopleText ? `. Last recorded here: ${peopleText}` : ''}`)}">
        <g class="pin"><g class="pin-mark"><title>${escapeHTML(`${location.name} — ${location.subtitle}`)}</title><circle class="marker-hit" r="20"/><circle class="marker-pulse" r="16"/><circle class="marker-ring" r="7.5"/><circle class="marker-center" r="2.5"/></g>
          ${here.length ? `<g class="pin-people">${chips}${more}</g>` : ''}
          <text class="marker-label" x="${labelX}" y="${labelY}" text-anchor="${anchor}">${escapeHTML(label)}</text>
          <text class="marker-caption" x="${labelX}" y="${labelY + 15}" text-anchor="${anchor}">${escapeHTML(caption)}</text>
        </g>
      </g>`;
    }).join('');
  }
  function syncLayers() {
    $('#location-markers').classList.toggle('hide-places', !state.layers.locations);
    $('#location-markers').classList.toggle('hide-people', !state.layers.groups);
    $('#wall-labels').style.display = state.layers.walls ? '' : 'none';
    for (const name of ['locations', 'groups', 'walls']) $(`#layer-${name}`).checked = Boolean(state.layers[name]);
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
      let rects = [];
      for (const base of [away, 90, -90, away + 180]) {
        chips.forEach((chip, index) => chip.setAttribute('transform', `translate(${chipOffset(base, index).join(' ')})`));
        rects = chips.map(chip => inflate(chip.getBoundingClientRect(), 1));
        if (!rects.some(rect => taken.some(other => overlaps(other, rect)) || pins.some(pin => pin.owner !== marker && overlaps(pin.rect, rect)))) break;
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
      ...$$('.map-person, .people-more', marker).map(shape => ({ owner: null, rect: inflate(shape.getBoundingClientRect(), 2) }))
    ]);
    // The overlays drawn on top of the map count as occupied too.
    for (const overlay of $$('.map-stage > .zoom-controls, .map-stage > .map-legend, .map-stage > .compass-rose, .map-stage > .map-caption')) {
      const rect = overlay.getBoundingClientRect();
      if (rect.width) obstacles.push({ owner: null, rect: inflate(rect, 4) });
    }
    const placed = [];
    for (const marker of markers) {
      const label = $('.marker-label', marker);
      const caption = $('.marker-caption', marker);
      if (getComputedStyle(label).display === 'none') continue;
      const preferred = marker.dataset.side;
      const sides = [preferred, ...Object.keys(SIDES).filter(side => side !== preferred)];
      const blocked = rect => placed.some(other => overlaps(other, rect)) || obstacles.some(other => other.owner !== marker && overlaps(other.rect, rect));
      let done = false;
      for (const withCaption of [true, false]) {
        marker.classList.toggle('caption-hidden', !withCaption);
        for (const side of sides) {
          placeLabel(marker, side);
          const rects = [label, ...(withCaption ? [caption] : [])].map(text => inflate(text.getBoundingClientRect(), 1));
          if (!rects.some(blocked)) { placed.push(...rects); done = true; break; }
        }
        if (done) break;
      }
      if (!done) {
        placeLabel(marker, preferred);
        if (marker.classList.contains('selected')) {
          marker.classList.remove('caption-hidden');
          placed.push(...[label, caption].map(text => text.getBoundingClientRect()));
        } else marker.classList.add('label-hidden');
      }
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
    district: '<path d="M0 66H300V104H0Z" fill="#637258"/><path d="M0 65H300M0 75H300M0 86H300M0 97H300" stroke="#263b2c" stroke-width="1"/><path d="M0 61h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12" fill="none" stroke="#8e9a72" stroke-width="4"/><path d="M175 106V84a14 14 0 0 1 28 0v22" fill="#26392b"/><g fill="#4b5c42" stroke="#253626" stroke-width="1"><path d="M9 111V93l17-15 18 15v18Zm29 6V97l20-15 19 15v20Zm37-5V86l16-13 19 13v26Zm37 6V94l22-18 20 18v24Zm115-4V91l16-15 18 15v23Zm32 4V99l22-16 18 16v19Z"/></g><g fill="#a2ac80" opacity=".5"><path d="M22 96h5v6h-5Zm31 5h5v6h-5Zm37-10h5v6h-5Zm38 8h5v6h-5Zm116-3h5v6h-5Zm31 8h5v6h-5Z"/></g>',
    forest: '<g stroke="#a5b18b" stroke-width="7" opacity=".4"><path d="M40 120V0m-1 37L15 10m25 39 31-26M111 120V0m0 53L79 19m32 59 37-28M190 120V0m0 40L168 9m22 47 27-35M259 120V0m0 74-38-20m38-11 25-21"/></g>',
    village: '<path d="M0 86Q150 76 300 88V120H0Z" fill="#3f4f38"/><g fill="#4b5c42" stroke="#253626"><path d="M40 98V82l15-13 15 13v16Z"/><path d="M96 102V89l12-10 12 10v13Z"/><path d="M186 99V83l14-12 14 12v16Z"/><path d="M236 104V93l10-8 10 8v11Z"/></g><path d="M0 108h300M14 102v12m24-12v12m24-12v12m24-12v12m24-12v12m24-12v12m24-12v12m24-12v12m24-12v12m24-12v12m24-12v12m24-12v12" stroke="#76866a" stroke-width="2" opacity=".6"/>',
    castle: '<path d="M0 104Q90 70 160 74T300 100V120H0Z" fill="#3a4a35"/><path d="M118 80V38h7v-6h6v6h7v-6h6v6h7v-6h6v6h7v42Z" fill="#4b5c42" stroke="#253626"/><path d="M170 82V58h6v-5h6v5h6v-5h6v29Z" fill="#46573e" stroke="#253626"/><path d="M134 80V64a6 6 0 0 1 12 0v16" fill="#24362a"/><path d="M129 48h4v6h-4Zm16 0h4v6h-4Z" fill="#a2ac80" opacity=".5"/>',
    wall: '<path d="M0 40H300V120H0Z" fill="#5d6c52"/><path d="M0 36h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14v-8h14v8h14" fill="none" stroke="#8e9a72" stroke-width="5"/><path d="M0 56H300M0 72H300M0 88H300M0 104H300M40 40v16m60 0v16m-30 0v16m90-32v16m60 0v16m-30 0v16m60-48v16" stroke="#34463a" stroke-width="1.2"/>',
    field: '<path d="M0 80Q150 70 300 82V120H0Z" fill="#3e4d37"/><g fill="#2f3f2c"><path d="M20 80q6-14 12 0Zm18 1q5-10 10 0Zm210-2q6-13 12 0Zm18 1q5-10 10 0Z"/></g><path d="M20 100q10-4 20 0m30 6q10-4 20 0m40-10q10-4 20 0m40 8q10-4 20 0m30-6q10-4 20 0" stroke="#7f8f68" stroke-width="1.5" fill="none" opacity=".7"/>',
    chapel: '<path d="M0 84H300V120H0Z" fill="#33432f"/><g stroke="#a5b18b" stroke-width="4" opacity=".3"><path d="M40 84V20m220 64V26"/></g><path d="M128 84V58l22-18 22 18v26Z" fill="#4b5c42" stroke="#253626"/><path d="M144 44V28l6-9 6 9v16" fill="#46573e" stroke="#253626"/><path d="M145 84V70a5 5 0 0 1 10 0v14" fill="#24362a"/><path d="M104 120q46-30 92 0Z" fill="#1b261d"/><path d="M120 116l9-8 6 5 10-9 8 7 9-6 8 7" stroke="#9fc4c0" stroke-width="1.4" fill="none" opacity=".45"/>',
    capital: '<path d="M0 88H300V120H0Z" fill="#3f4f38"/><g fill="#4b5c42" stroke="#253626"><path d="M14 110V86h22v24Zm28 0V78h18v32Zm26 0V90h20v20Zm120 0V82h20v28Zm26 0V88h24v22Zm30 0V80h18v30Z"/><path d="M110 110V66h80v44Z"/><path d="M122 66V50l28-16 28 16v16Z"/><path d="M146 34V20l4-6 4 6v14"/></g><g fill="#a2ac80" opacity=".5"><path d="M130 80h6v8h-6Zm18 0h6v8h-6Zm18 0h6v8h-6Z"/></g>'
  };
  function illustration(location) {
    // Original decorative drawings, never episode screenshots.
    const scene = SCENERY[location.kind] || SCENERY.district;
    return `<div class="panel-illustration" aria-hidden="true"><svg viewBox="0 0 300 120" preserveAspectRatio="xMidYMid slice"><rect width="300" height="120" fill="#28372b"/><circle cx="218" cy="30" r="21" fill="#bdc597" opacity=".12"/><path d="M0 57 24 38 59 48 103 26 147 46 186 35 232 58 279 37 300 47V120H0Z" fill="#3e4d37" opacity=".5"/>${scene}<path d="M0 115Q150 93 300 113V120H0Z" fill="#213023"/></svg><span class="panel-image-tag">${escapeHTML(KIND_LABEL[location.kind] || 'Place')}</span></div>`;
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
    const here = peopleAt(location.id);
    const note = state.notes[`${state.viewing}:${location.id}`] || '';
    const earlier = availableNotes()
      .filter(([key]) => key.split(':')[1] === location.id && Number(key.split(':')[0]) < state.viewing)
      .sort((a, b) => Number(b[0].split(':')[0]) - Number(a[0].split(':')[0]));
    $('#location-panel').innerHTML = `${illustration(location)}<div class="panel-content">
      <p class="panel-kicker">As of episode ${state.viewing}</p><h2>${escapeHTML(location.name)}</h2><p class="panel-subtitle">${escapeHTML(location.subtitle)}</p>${knowledgeBadge('approximate')}
      <section class="panel-block"><h3>The lay of the land</h3><p>${escapeHTML(location.summary)}</p></section>
      <section class="panel-block"><h3>Why it matters</h3><p>${escapeHTML(location.why)}</p></section>
      <section class="panel-block"><h3>What happened here</h3>${events.length ? events.map(eventCard).join('') : '<p>No event is recorded here by the selected episode.</p>'}</section>
      ${here.length ? `<section class="panel-block"><h3>Last recorded here</h3>${here.map(({ character, position }) => `<button class="person-row" data-open-character="${escapeHTML(character.id)}">${avatar(character, 'sm')}<span><strong>${escapeHTML(nameOf(character))}</strong><small>Episode ${position.episode}. ${escapeHTML(position.note)}</small></span></button>`).join('')}</section>` : ''}
      <section class="panel-block"><h3>My field note, episode ${state.viewing}</h3><label class="sr-only" for="location-note">Note about ${escapeHTML(location.name)} at episode ${state.viewing}</label><textarea id="location-note" class="note-input" maxlength="4000" placeholder="A question, a connection, a theory…">${escapeHTML(note)}</textarea><div class="note-save-row"><span id="save-status">${storageAvailable ? 'Saved automatically in this browser' : 'Storage unavailable; kept for this session'}</span><button class="save-note" id="save-note">Save note</button></div>
        ${earlier.length ? `<div class="earlier-notes"><h4>Your earlier notes here</h4>${earlier.map(([key, text]) => `<blockquote><p class="episode-tag">Written at episode ${Number(key.split(':')[0])}</p><p>${escapeHTML(text)}</p></blockquote>`).join('')}</div>` : ''}
      </section>
      <section class="panel-block"><h3>Map accuracy</h3><p>${escapeHTML(location.geography)}</p></section>
    </div>`;
    $('#location-note').addEventListener('input', saveNote);
    $('#save-note').addEventListener('click', () => {
      saveNote();
      toast(storageAvailable ? ($('#location-note').value.trim() ? 'Field note saved on this device.' : 'Empty field note removed.') : 'Browser storage is unavailable. Note kept for this session.');
    });
  }
  function saveNote() {
    const input = $('#location-note');
    if (!input || !state.selected) return;
    const key = `${state.viewing}:${state.selected}`;
    if (input.value.trim()) state.notes[key] = input.value; else delete state.notes[key];
    pendingNotes.add(key);
    persist();
    $('#note-count').textContent = availableNotes().length;
    $('#save-status').textContent = storageAvailable ? 'Saved on this device' : 'Storage unavailable; kept for this session';
  }

  /* ---------- Timeline, recap, characters, notes ---------- */
  function renderTimeline() {
    const episodes = visibleEpisodes();
    $('#timeline-count').textContent = `${episodes.length} of ${data.episodes.length} milestones`;
    $('#timeline-track').innerHTML = episodes.map(episode => `<button class="timeline-event ${episode.number === state.viewing ? 'active' : ''}" data-episode="${episode.number}" aria-label="View episode ${episode.number}: ${escapeHTML(episode.shortTitle)}" ${episode.number === state.viewing ? 'aria-current="step"' : ''}><span class="time-number">Episode ${episode.number}</span><strong>${escapeHTML(episode.shortTitle)}</strong></button>`).join('');
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
    $('#recap-view').innerHTML = `<div class="recap-intro">${icon('shield')}<div><p class="panel-kicker">Briefing, episode ${state.viewing}</p><h2>${currentEpisode ? escapeHTML(currentEpisode.shortTitle) : 'Your story so far'}</h2><p>${escapeHTML(currentEpisode?.description || `No new milestone is mapped for episode ${state.viewing}. Below are the selected events established by this point.`)}</p><p class="coverage-note">A selective recap, newest first. Some events happen in places the atlas cannot pin.</p></div></div><div class="recap-grid">${events.map(event => {
      const location = event.locationId ? getLocation(event.locationId) : null;
      if (event.locationId && !location) return '';
      return `<article class="recap-card"><p class="recap-meta">Episode ${event.episode}${location ? `, ${escapeHTML(location.name)}` : ''}</p><h3>${escapeHTML(event.title)}</h3><p>${escapeHTML(event.summary)}</p>${event.connection ? `<p class="connection-text">${escapeHTML(event.connection)}</p>` : ''}${knowledgeBadge(event.kind)}${peopleList(event.people, { compact: true })}${location ? `<button class="card-link" data-open-event="${escapeHTML(event.id)}">Find it on the map</button>` : '<p class="unpinned">Not pinned on the map</p>'}</article>`;
    }).join('')}</div>`;
  }
  const CHARACTER_SECTIONS = [
    ['Survey Corps', ['survey']],
    ['Titans and Titan shifters', ['titan', 'shifter']],
    ['Training Corps', ['cadet']],
    ['Military and police', ['garrison', 'mp', 'central']],
    ['Civilians and nobility', ['civilian', 'crown']]
  ];
  function characterCard(character) {
    const revealed = revealOf(character);
    const position = lastPosition(character);
    const place = position?.locationId ? getLocation(position.locationId) : null;
    const notes = (character.notes || []).filter(note => note.episode <= state.viewing).sort((a, b) => b.episode - a.episode);
    return `<article class="character-card faction-${factionOf(character)}${revealed ? ' revealed' : ''}${state.focusCharacter === character.id ? ' focused' : ''}" id="character-${escapeHTML(character.id)}" data-character="${escapeHTML(character.id)}" tabindex="-1">
      <header>${avatar(character, 'lg')}<div><h3>${escapeHTML(nameOf(character))}</h3><p class="character-role">${escapeHTML(roleOf(character))}</p></div></header>
      ${revealed ? `<p class="reveal-line">Revealed in episode ${character.revealedAs.episode}: <button class="inline-link" data-open-character="${escapeHTML(revealed.id)}">${escapeHTML(nameOf(revealed))}</button></p>` : ''}
      ${notes.length ? `<ol class="character-notes">${notes.map(note => `<li><span class="note-episode">E${pad(note.episode)}</span><span>${escapeHTML(note.text)}</span></li>`).join('')}</ol>` : ''}
      <footer>${position ? (place
        ? `<button class="card-link" data-open-place="${escapeHTML(place.id)}">Last recorded at ${escapeHTML(place.name)}, episode ${position.episode}</button>`
        : `<span>Last recorded in episode ${position.episode}, somewhere this map does not place.</span>`) : ''}<span class="since">In the atlas from episode ${character.firstEpisode}</span></footer>
    </article>`;
  }
  function renderCharacters() {
    const query = state.characterFilter.trim().toLocaleLowerCase();
    const matches = visibleCharacters().filter(character => character.type !== 'group' && (!query
      || [nameOf(character), roleOf(character), ...(character.aliases || [])].join(' ').toLocaleLowerCase().includes(query)));
    const sections = CHARACTER_SECTIONS.map(([title, keys]) => {
      const members = matches.filter(character => keys.includes(factionOf(character)))
        .sort((a, b) => Boolean(revealOf(a)) - Boolean(revealOf(b)) || a.firstEpisode - b.firstEpisode);
      return members.length ? `<section class="character-section"><h2>${title}<span>${members.length}</span></h2><div class="character-grid">${members.map(characterCard).join('')}</div></section>` : '';
    }).join('');
    $('#characters-view').innerHTML = `<div class="character-tools"><label for="character-filter">Filter characters</label><input id="character-filter" type="search" placeholder="Name or role" value="${escapeHTML(state.characterFilter)}" autocomplete="off"></div>${sections || '<p class="search-empty">No character matches that filter at this episode.</p>'}`;
  }
  function renderNotes() {
    const notes = availableNotes().sort((a, b) => Number(b[0].split(':')[0]) - Number(a[0].split(':')[0]));
    $('#notes-view').innerHTML = notes.length ? `<div class="recap-intro">${icon('note')}<div><h2 id="notes-heading" tabindex="-1">Your personal field journal</h2><p>Notes from episodes 1–${state.viewing}. Each note belongs to a place and the episode you were viewing. Later notes stay out of earlier briefings.</p></div></div><div class="notes-grid">${notes.map(([key, note]) => {
      const [episode, locationId] = key.split(':');
      return `<article class="field-note"><p class="recap-meta">Written at episode ${Number(episode)}</p><h3>${escapeHTML(getLocation(locationId).name)}</h3><p class="note-text">${escapeHTML(note)}</p><div class="note-actions"><button data-open-note="${escapeHTML(key)}">Open on the map</button><button data-delete-note="${escapeHTML(key)}">Delete note</button></div></article>`;
    }).join('')}</div>` : `<div class="empty-state">${icon('note')}<h2 id="notes-heading" tabindex="-1">Every scout keeps a notebook.</h2><p>Select a place on the map and write down a question, a connection, or your own theory. Notes stay in this browser.</p><button class="primary-button" data-view="map">Explore the map</button></div>`;
  }
  function render({ save = true } = {}) {
    closeCard();
    ensureSelection();
    updateHeader();
    renderDistrictArt();
    renderMarkers();
    syncLayers();
    renderPanel();
    renderTimeline();
    renderRecap();
    renderCharacters();
    renderNotes();
    // Search results are rebuilt from the current visibility boundary, never retained across it.
    $('#location-search').value = '';
    $('#search-results').hidden = true;
    $('#search-results').innerHTML = '';
    if (save) persist();
    scheduleLayout();
  }

  /* ---------- Navigation ---------- */
  function showView(view) {
    state.view = view;
    render();
    if (view === 'map') applyCamera();
  }
  function selectLocation(id, { focus = false } = {}) {
    if (!getLocation(id)) return;
    state.selected = id;
    state.view = 'map';
    render();
    $('#location-panel').scrollTop = 0;
    if (focus) {
      const location = getLocation(id);
      state.zoom = 1.45;
      state.panX = 600 - location.x * state.zoom;
      state.panY = 460 - location.y * state.zoom;
    }
    applyCamera();
    $(`[data-location="${state.selected}"]`)?.focus({ preventScroll: true });
  }
  function openCharacter(id) {
    const character = getCharacter(id);
    if (!character) return;
    state.view = 'characters';
    state.focusCharacter = id;
    state.characterFilter = '';
    render();
    const card = $(`#character-${CSS.escape(id)}`);
    card?.scrollIntoView({ block: 'center' });
    card?.focus({ preventScroll: true });
  }
  function setEpisode(number) {
    state.viewing = Math.min(state.cutoff, episodeNumber(number));
    state.activeEvent = null;
    ensureSelection();
    render();
    $('#location-panel').scrollTop = 0;
  }
  function stepMilestone(direction) {
    const numbers = milestones();
    const target = direction > 0 ? numbers.find(number => number > state.viewing) : numbers.filter(number => number < state.viewing).pop();
    if (!target) return;
    const episode = data.episodes.find(entry => entry.number === target);
    const place = episode.events.find(event => event.locationId)?.locationId;
    if (place) state.selected = place;
    setEpisode(target);
  }

  /* ---------- Search: places, people and events known by the viewing episode ---------- */
  function searchAll() {
    const query = $('#location-search').value.trim().toLocaleLowerCase();
    const results = $('#search-results');
    if (!query) { results.hidden = true; results.innerHTML = ''; return; }
    const has = (...values) => values.flat().filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
    const places = visibleLocations().filter(location => has(location.name, location.mapLabel, location.subtitle, location.tags, location.aliases)).slice(0, 6);
    const people = visibleCharacters().filter(character => character.type !== 'group' && has(nameOf(character), roleOf(character), character.aliases)).slice(0, 6);
    const events = visibleEvents().filter(event => event.locationId && getLocation(event.locationId) && has(event.title, event.summary)).slice(-5).reverse();
    const group = (title, items) => (items.length ? `<p class="search-group">${title}</p>${items.join('')}` : '');
    results.innerHTML = (group('Places', places.map(location => `<button data-search-location="${escapeHTML(location.id)}"><span>${escapeHTML(location.name)}</span><small>${escapeHTML(location.subtitle)}</small></button>`))
      + group('People', people.map(character => `<button class="search-person" data-open-character="${escapeHTML(character.id)}">${avatar(character, 'xs')}<span>${escapeHTML(nameOf(character))}<small>${escapeHTML(roleOf(character))}</small></span></button>`))
      + group('Events', events.map(event => `<button data-open-event="${escapeHTML(event.id)}"><span>${escapeHTML(event.title)}</span><small>Episode ${event.episode}, ${escapeHTML(getLocation(event.locationId).name)}</small></button>`)))
      || '<p class="search-empty">Nothing matching is recorded by this episode.</p>';
    results.hidden = false;
  }

  /* ---------- Camera ---------- */
  const map = $('#atlas-map');
  $('defs', map).insertAdjacentHTML('beforeend', '<clipPath id="avatar-clip" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath>');
  function applyCamera() {
    // Keep a good part of the walled area (Wall Maria: x 160–1040, y 40–770) on screen:
    // at least 45% of the view or of the walls, whichever is smaller, along each axis.
    const zoom = state.zoom;
    const needX = Math.min(1200, 880 * zoom) * 0.45;
    const needY = Math.min(920, 730 * zoom) * 0.45;
    state.panX = Math.min(1200 - needX - 160 * zoom, Math.max(needX - 1040 * zoom, state.panX));
    state.panY = Math.min(920 - needY - 40 * zoom, Math.max(needY - 770 * zoom, state.panY));
    $('#map-camera').setAttribute('transform', `translate(${Math.round(state.panX * 100) / 100} ${Math.round(state.panY * 100) / 100}) scale(${zoom})`);
    $('#zoom-level').textContent = `${Math.round(zoom * 100)}%`;
    $('#zoom-out').disabled = zoom <= 0.75;
    $('#zoom-in').disabled = zoom >= 3;
    // Pins, labels and portraits keep one on-screen size whatever the zoom or window width.
    const ctm = map.getScreenCTM();
    if (ctm && ctm.a > 0) map.style.setProperty('--pin-scale', (1 / (ctm.a * zoom)).toFixed(4));
    scheduleLayout();
  }
  function zoomMap(factor, point = { x: 600, y: 460 }) {
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
  $('#reset-map').addEventListener('click', () => { state.zoom = 1; state.panX = 0; state.panY = 0; applyCamera(); });
  window.addEventListener('resize', () => { centerTimeline(); applyCamera(); });

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
  $('#person-card').addEventListener('pointerenter', () => clearTimeout(cardHideTimer));
  $('#person-card').addEventListener('pointerleave', () => { if (!state.card?.pinned) cardHideTimer = setTimeout(closeCard, 220); });

  /* ---------- Controls ---------- */
  $('#episode-select').addEventListener('change', event => setEpisode(event.target.value));
  $('#prev-milestone').addEventListener('click', () => stepMilestone(-1));
  $('#next-milestone').addEventListener('click', () => stepMilestone(1));
  $('#location-search').addEventListener('input', searchAll);
  $('#location-search').addEventListener('keydown', event => {
    if (event.key === 'Escape') $('#search-results').hidden = true;
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
    if (event.key === '/' && !typing && !$('dialog[open]') && state.view === 'map') { event.preventDefault(); $('#location-search').focus(); }
    if (!typing && !$('dialog[open]') && (event.key === '[' || event.key === ']')) stepMilestone(event.key === ']' ? 1 : -1);
    if (event.key === 'Escape') { $('#search-results').hidden = true; closeCard(); }
  });
  for (const name of ['locations', 'groups', 'walls']) {
    $(`#layer-${name}`).addEventListener('change', event => { state.layers[name] = event.target.checked; syncLayers(); persist(); });
  }
  function cutoffHint() {
    const value = Math.trunc(Number($('#cutoff-input').value));
    if (!value || value < 1) { $('#cutoff-hint').textContent = ''; return; }
    if (value > MAX_EPISODE) { $('#cutoff-hint').textContent = `This edition stops at episode ${MAX_EPISODE}.`; return; }
    const episode = data.episodes.find(entry => entry.number === value);
    $('#cutoff-hint').textContent = `Episode ${value} is ${seasonText(value).toLowerCase()}${episode ? `, “${episode.title}”` : ''}.`;
  }
  function showProgress() { $('#cutoff-input').value = state.cutoff; cutoffHint(); $('#progress-dialog').showModal(); }
  $('#cutoff-input').addEventListener('input', cutoffHint);
  $('#edit-progress').addEventListener('click', showProgress);
  $('#spoiler-button').addEventListener('click', showProgress);
  $('#progress-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!$('#progress-form').reportValidity()) return;
    state.cutoff = episodeNumber($('#cutoff-input').value);
    state.viewing = Math.min(state.viewing, state.cutoff);
    state.activeEvent = null;
    render();
    $('#progress-dialog').close();
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
    if (swallowClick) { swallowClick = false; if (event.target.closest('#atlas-map')) return; }
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
    const person = event.target.closest('[data-open-character]');
    if (person) { openCharacter(person.dataset.openCharacter); return; }
    const place = event.target.closest('[data-open-place]');
    if (place) { state.activeEvent = null; selectLocation(place.dataset.openPlace, { focus: true }); return; }
    const timelineEpisode = event.target.closest('[data-episode]');
    if (timelineEpisode) {
      const episode = data.episodes.find(item => item.number === Number(timelineEpisode.dataset.episode));
      if (episode && episode.number <= state.viewing) {
        const first = episode.events.find(item => item.locationId)?.locationId;
        if (first) state.selected = first;
        setEpisode(episode.number);
        $('.timeline-event.active')?.focus({ preventScroll: true });
      }
      return;
    }
    const eventLink = event.target.closest('[data-open-event]');
    if (eventLink) {
      const storyEvent = visibleEvents().find(item => item.id === eventLink.dataset.openEvent);
      if (storyEvent?.locationId) { state.activeEvent = storyEvent.id; selectLocation(storyEvent.locationId, { focus: true }); }
      return;
    }
    const openNote = event.target.closest('[data-open-note]');
    if (openNote && availableNotes().some(([key]) => key === openNote.dataset.openNote)) {
      const [episode, locationId] = openNote.dataset.openNote.split(':');
      state.viewing = Number(episode);
      state.activeEvent = null;
      selectLocation(locationId, { focus: true });
      $('#location-note').focus();
      return;
    }
    const deleteNote = event.target.closest('[data-delete-note]');
    if (deleteNote && availableNotes().some(([key]) => key === deleteNote.dataset.deleteNote)) {
      const key = deleteNote.dataset.deleteNote;
      const buttons = $$('[data-delete-note]');
      const index = buttons.indexOf(deleteNote);
      delete state.notes[key];
      pendingNotes.add(key);
      render();
      const next = $$('[data-open-note]')[Math.min(index, $$('[data-open-note]').length - 1)];
      (next || $('#notes-heading'))?.focus();
      toast('Field note deleted.');
      return;
    }
    if (!event.target.closest('.search-wrap')) $('#search-results').hidden = true;
  });

  // Another tab saved: take its notes and spoiler limit, keep this tab's own view.
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY || event.newValue === null) return;
    let incoming;
    try { incoming = JSON.parse(event.newValue) || {}; } catch { return; }
    const notes = readNotes(incoming.notes);
    for (const key of pendingNotes) { if (key in state.notes) notes[key] = state.notes[key]; else delete notes[key]; }
    state.notes = notes;
    state.cutoff = episodeNumber(incoming.cutoff ?? state.cutoff);
    state.viewing = Math.min(state.viewing, state.cutoff);
    if (document.activeElement?.id === 'location-note') { $('#note-count').textContent = availableNotes().length; return; }
    render({ save: false });
    if (state.view === 'map') applyCamera();
  });

  render();
  applyCamera();
  if (unreadableCopy) toast('Saved data could not be read. A copy was kept in this browser and the atlas started fresh.');
})();
