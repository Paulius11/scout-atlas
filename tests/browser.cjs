#!/usr/bin/env node
'use strict';
// Browser regression checks. Every check uses its own throwaway browser context, so the
// preferences saved in your own browser are never read or written.
//   node tests/browser.cjs                                  (the page over file://)
//   ATLAS_URL=http://127.0.0.1:8765 node tests/browser.cjs  (a running local server)
//   CHROME=/path/to/chrome node tests/browser.cjs           (another Chrome build)
//   ATLAS_TEST_FILTER='recognizable|Back to this episode' node tests/browser.cjs

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const url = process.env.ATLAS_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const onFile = url.startsWith('file:');
const testFilter = process.env.ATLAS_TEST_FILTER ? new RegExp(process.env.ATLAS_TEST_FILTER, 'i') : null;
const storageKey = 'scout-atlas:v1';
global.window = {};
require(path.resolve(__dirname, '../data.js'));
const data = window.ATLAS_DATA;
const portraitsFile = path.resolve(__dirname, '../portraits/portraits.js');
if (require('node:fs').existsSync(portraitsFile)) require(portraitsFile);
const portraits = window.ATLAS_PORTRAITS || {};
const portraitVersions = id => Array.isArray(portraits[id]) ? portraits[id] : typeof portraits[id] === 'string' ? [{ from: 1, file: portraits[id] }] : [];
const MAX = data.maxEpisode;
const milestones = data.episodes.map(e => e.number);
const at = (list, episode) => list.filter(v => v.from <= episode).sort((a, b) => b.from - a.from)[0];
const pinnedPersonAt = number => data.characters.find(character => character.type !== 'group' && character.firstEpisode <= number &&
  (character.positions || []).filter(position => position.episode <= number).sort((a, b) => b.episode - a.episode)[0]?.locationId);
const lastPinnedEpisode = [...milestones].reverse().find(number => pinnedPersonAt(number));
const locationArea = location => location.mapArea || (location.kind === 'sea' ? 'island' : 'walls');
const mappedLocations = (number, area) => data.locations.filter(location => location.firstEpisode <= number && (
  area === 'world' ? locationArea(location) === 'world' || location.worldPosition
    : area === 'island' ? ['walls', 'island'].includes(locationArea(location)) || location.id === 'paradis'
      : locationArea(location) === area));
const placeSymbols = { 'liberio-hospital': 'hospital', 'liberio-festival': 'festival', 'liberio-basement': 'stairs' };
const episodeParticipants = number => [...new Set(data.episodes.find(episode => episode.number === number).events.flatMap(event => event.people || []))]
  .filter(id => data.characters.some(character => character.id === id && character.type !== 'group' && character.firstEpisode <= number));
const forestSceneEvent = number => data.episodes.find(episode => episode.number === number).events.find(event => event.mapScene);
const sceneParticipants = (event, number) => [...new Set(event.people || [])]
  .filter(id => data.characters.some(character => character.id === id && character.type !== 'group' && character.firstEpisode <= number));
async function mapArea(page) { return page.locator('#map-stage').getAttribute('data-extent'); }
async function expectedMapLocations(page, number) { return mappedLocations(number, await mapArea(page)); }
// Everything the atlas introduces after episode 1: none of it may show while viewing episode 1.
const laterNames = [
  ...data.locations.filter(l => l.firstEpisode > 1).map(l => l.name),
  ...data.characters.flatMap(c => c.name.filter(v => v.from > 1).map(v => v.text))
];
let passed = 0;
const failures = [];

async function test(name, run) {
  if (testFilter && !testFilter.test(name)) return;
  try {
    await run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}\n     ${String(error.message).split('\n').slice(0, 14).join('\n     ')}`);
  }
}
async function readUi(page) {
  return page.locator('#location-markers, #location-panel, #recap-view, #characters-view, #timeline-track')
    .evaluateAll(elements => elements.map(element => element.textContent + ' ' + [...element.querySelectorAll('[aria-label],[title]')].map(e => `${e.getAttribute('aria-label') || ''} ${e.getAttribute('title') || ''}`).join(' ')).join('\n'));
}
async function assertNoHorizontalOverflow(page, label) {
  const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(size.document <= size.viewport + 1 && size.body <= size.viewport + 1, `${label}: content exceeds viewport: ${JSON.stringify(size)}`);
}
async function chooseLocation(page, query, id) {
  await page.locator('#location-search').fill(query);
  await page.locator(`[data-search-location="${id}"]`).click();
  assert.equal(await page.locator(`[data-location="${id}"]`).getAttribute('aria-pressed'), 'true');
}
async function setLayer(page, name, checked) {
  await page.locator('#map-options').evaluate(element => { element.open = true; });
  await page.locator(`#layer-${name}`).setChecked(checked);
  await page.locator('#map-options').evaluate(element => { element.open = false; });
}
async function setCutoff(page, value) {
  await page.locator('#settings-button').click();
  await page.locator('#cutoff-input').fill(String(value));
  await page.locator('#settings-form [type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector('#settings-dialog').open);
}
async function view(page, name) { await page.locator(`.primary-nav [data-view="${name}"]`).click(); }
async function episode(page, number) { await page.locator('#episode-select').selectOption(String(number)); }
async function characterDetails(page, id) {
  await page.locator(`#character-${id} .character-card-button`).click();
  assert.equal(await page.locator('#character-detail-dialog').evaluate(dialog => dialog.open), true);
  return page.locator('#character-detail-body');
}
async function closeCharacterDetails(page) {
  await page.locator('#close-character-detail').click();
  assert.equal(await page.locator('#character-detail-dialog').evaluate(dialog => dialog.open), false);
}
// Label, caption and portrait boxes of every visible marker, after the label layout has run.
async function labelBoxes(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.locator('#location-markers').evaluate(root => [...root.querySelectorAll('.marker-label, .marker-caption, .map-person')]
    .filter(el => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0)
    .map(el => { const r = el.getBoundingClientRect(); return { owner: el.closest('[data-location]').dataset.location, kind: el.getAttribute('class'), text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
}
const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  const foreign = [];
  const contexts = [];
  async function createPage(viewport = { width: 1440, height: 1040 }, init, context) {
    const ctx = context || await browser.newContext({ viewport });
    if (!context) contexts.push(ctx);
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage();
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (/Content Security Policy|Refused to/.test(message.text())) errors.push(message.text()); });
    page.on('request', request => { if (!request.url().startsWith(new URL('.', url).href)) foreign.push(request.url()); });
    await page.goto(url, { waitUntil: 'load' });
    await page.locator('#location-panel h2').waitFor({ state: 'attached' });
    return page;
  }
  try {
    const page = await createPage();

    await test(`fresh session starts at episode ${MAX} with bounded choices`, async () => {
      assert.equal(await page.locator('#episode-select').inputValue(), String(MAX));
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).cutoff, storageKey), MAX);
      const options = await page.locator('#episode-select option').evaluateAll(items => items.map(item => Number(item.value)));
      assert.deepEqual(options, Array.from({ length: MAX }, (_, index) => index + 1));
      assert.equal(await page.locator('#episode-select optgroup').count(), data.seasons.length);
      assert.equal(await page.locator('#location-markers [data-location]').count(), (await expectedMapLocations(page, MAX)).length);
      assert.equal(await page.locator('#timeline-track [data-episode]').count(), milestones.length);
      assert.equal(await page.locator('#cutoff-input').getAttribute('max'), String(MAX));
      assert.equal(await page.locator('meta[http-equiv="Content-Security-Policy"]').count(), 1);
      await assertNoHorizontalOverflow(page, 'desktop map');
    });

    await test('viewing an earlier episode keeps the saved spoiler limit and later choices available', async () => {
      const browsing = await createPage();
      await episode(browsing, 13);
      assert.equal(await browsing.locator('#episode-select option').count(), MAX, 'browsing the past does not limit later choices');
      assert.equal(await browsing.evaluate(key => JSON.parse(localStorage.getItem(key)).cutoff, storageKey), MAX);
      await browsing.reload({ waitUntil: 'load' });
      assert.equal(await browsing.locator('#episode-select').inputValue(), '13', 'the chosen episode survives reload');
      assert.equal(await browsing.locator('#episode-select option').count(), MAX);
      await episode(browsing, MAX);
      assert.equal(await browsing.locator('#episode-select').inputValue(), String(MAX), 'returning to the current edition needs only the picker');
    });

    await test('settings stay reachable across tabs and phone widths, and Escape cancels an unsaved limit', async () => {
      for (const viewport of [{ width: 1440, height: 1040 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
        const settings = await createPage(viewport);
        for (const name of ['map', 'recap', 'characters']) {
          await view(settings, name);
          const button = settings.getByRole('button', { name: 'Atlas settings', exact: true });
          await button.scrollIntoViewIfNeeded();
          const box = await button.boundingBox();
          assert.ok(box && box.x >= 0 && box.x + box.width <= viewport.width + 1, `${viewport.width}px ${name}: settings are inside the viewport`);
          await button.click();
          assert.equal(await settings.locator('#settings-dialog').evaluate(dialog => dialog.open), true, `${viewport.width}px ${name}: settings open`);
          assert.equal(await settings.locator('#cutoff-input').inputValue(), String(MAX), 'settings reflect the saved limit');
          await settings.locator('#cutoff-input').fill('13');
          await assertNoHorizontalOverflow(settings, `${viewport.width}px ${name} settings`);
          await settings.keyboard.press('Escape');
          assert.equal(await settings.locator('#settings-dialog').evaluate(dialog => dialog.open), false);
          assert.equal(await button.evaluate(element => element === document.activeElement), true, 'closing settings restores focus');
          assert.equal(await settings.locator('#episode-select').inputValue(), String(MAX), 'cancel leaves the chosen episode unchanged');
          assert.equal(await settings.locator('#episode-select option').count(), MAX, 'cancel does not restrict choices');
          assert.equal(await settings.evaluate(key => JSON.parse(localStorage.getItem(key)).cutoff, storageKey), MAX, 'cancel does not save the draft');
        }
        await setCutoff(settings, 13);
        assert.equal(await settings.locator('#episode-select').inputValue(), '13', 'the optional limit still clamps the view');
        await settings.reload({ waitUntil: 'load' });
        assert.equal(await settings.locator('#episode-select option').count(), 13, 'the optional limit survives reload');
        await settings.locator('#settings-button').click();
        assert.equal(await settings.locator('#cutoff-input').inputValue(), '13', 'reopening settings discards any old draft');
        await settings.keyboard.press('Escape');
        await assertNoHorizontalOverflow(settings, `${viewport.width}px saved settings`);
      }
    });

    await test('published titles appear for every allowed episode and stay within the cutoff', async () => {
      const titled = await createPage();
      const options = await titled.locator('#episode-select option').evaluateAll(items => items.map(item => ({ number: Number(item.value), text: item.textContent })));
      assert.deepEqual(options, data.episodeTitles.map(episode => ({ number: episode.number, text: `E${String(episode.number).padStart(2, '0')}  ${episode.title}` })));
      for (const n of [1, 3, 13, MAX]) {
        await episode(titled, n);
        const title = data.episodeTitles.find(item => item.number === n).title;
        assert.equal(await titled.locator('#episode-select').getAttribute('title'), title);
        assert.equal(await titled.locator('#viewing-episode-title').count(), 0, 'the picker title should not be repeated underneath');
        await view(titled, 'recap');
        assert.equal(await titled.locator('.recap-intro h2').innerText(), title);
        await view(titled, 'map');
      }
      for (const milestone of data.episodes) {
        assert.equal(await titled.locator(`.timeline-event[data-episode="${milestone.number}"] strong`).innerText(), milestone.title);
      }
      await setCutoff(titled, 3);
      assert.equal(await titled.locator('#episode-select option').count(), 3);
      // Compare whole titles: a later title can be a prefix of an earlier one ("That Day").
      const allowed = await titled.locator('#episode-select option').evaluateAll(items => items.map(item => item.textContent.replace(/^E\d+\s+/, '')));
      for (const item of data.episodeTitles.filter(item => item.number > 3)) assert.ok(!allowed.includes(item.title), `E${item.number} title is beyond the cutoff`);
    });

    await test('every episode has its own recap and does not borrow a later event', async () => {
      const complete = await createPage();
      await view(complete, 'recap');
      for (const entry of data.episodes) {
        await episode(complete, entry.number);
        assert.equal(await complete.locator('.recap-intro h2').innerText(), entry.title);
        const cards = await complete.locator('.recap-grid').innerText();
        for (const event of entry.events) assert.ok(cards.includes(event.title), `E${entry.number} missing its event`);
        const next = data.episodes.find(item => item.number === entry.number + 1);
        if (next) {
          const futureIds = next.events.map(event => event.id);
          assert.equal(await complete.locator(futureIds.map(id => `[data-open-event="${id}"]`).join(',')).count(), 0, `E${entry.number} shows a later event`);
        }
      }
    });

    await test('walls are circular, share the published scale and keep the scale bar accurate', async () => {
      const scaled = await createPage();
      await scaled.locator('[data-map-extent="walls"]').click();
      for (const [name, km] of Object.entries(data.mapGeometry.wallRadiusKm)) {
        const shape = scaled.locator(`#wall-geometry [data-wall="${name}"]`).nth(1);
        assert.ok(Math.abs(Number(await shape.getAttribute('rx')) - km * data.mapGeometry.unitsPerKm) < .001);
        assert.equal(await shape.getAttribute('ry'), await shape.getAttribute('rx'));
        const bounds = await shape.boundingBox();
        assert.ok(Math.abs(bounds.width - bounds.height) < 1, `${name} is stretched on screen`);
        assert.equal(await scaled.locator(`#map-overview [data-wall="${name}"]`).getAttribute('rx'), await shape.getAttribute('rx'));
      }
      for (let step = 0; step < 2; step++) {
        const bar = await scaled.locator('#map-scale span').boundingBox();
        const maria = await scaled.locator('#wall-geometry [data-wall="maria"]').nth(1).boundingBox();
        assert.ok(Math.abs(bar.width / maria.width - 100 / 960) < .003, '100 km bar disagrees with wall diameter');
        await scaled.locator('#zoom-in').click();
      }
    });

    await test('island view respects the reveal, fits phones and retains controls when expanded', async () => {
      for (const viewport of [{ width: 1440, height: 1040 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
        const island = await createPage(viewport);
        await episode(island, 56);
        assert.equal(await island.locator('#map-extent-switch').isVisible(), false);
        assert.equal(await island.locator('#sea-art .coastline').count(), 0);
        await episode(island, 57);
        assert.equal(await island.locator('#map-extent-switch').isVisible(), true);
        await island.locator('[data-map-extent="island"]').click();
        assert.equal(await island.locator('#map-title-text').innerText(), 'Paradis Island');
        assert.equal(await island.locator('#map-scale').isVisible(), false, 'island distances are approximate');
        for (let expanded = 0; expanded < 2; expanded++) {
          if (expanded) await island.locator('#expand-map').click();
          const coast = await island.locator('.coastline').boundingBox();
          const stage = await island.locator('#atlas-map').boundingBox();
          assert.ok(coast.x > stage.x && coast.y > stage.y && coast.x + coast.width < stage.x + stage.width && coast.y + coast.height < stage.y + stage.height, 'the coast is cropped');
          assert.ok(coast.height > coast.width * 1.3, 'the reference outline should be elongated');
          await assertNoHorizontalOverflow(island, 'island view');
        }
        await island.locator('[data-map-extent="walls"]').click();
        assert.equal(await island.locator('#map-title-text').innerText(), 'The walled territory');
        assert.equal(await island.locator('#map-scale').isVisible(), true);
        await episode(island, 56);
        assert.equal(await island.locator('#map-extent-switch').isVisible(), false);
      }
    });

    await test('mainland views respect their reveal and manual navigation survives reload', async () => {
      const geography = await createPage();
      await episode(geography, 56);
      assert.equal(await mapArea(geography), 'walls');
      for (const area of ['world', 'liberio']) assert.equal(await geography.locator(`[data-map-extent="${area}"]`).isVisible(), false, `${area} appears before its reveal`);
      const earlyText = await readUi(geography);
      for (const location of data.locations.filter(location => ['world', 'liberio'].includes(locationArea(location)))) {
        assert.equal(await geography.locator(`[data-location="${location.id}"]`).count(), 0, `${location.id} has an early map pin`);
        assert.ok(!earlyText.includes(location.name), `${location.id} has an early geographic label`);
      }
      await episode(geography, 57);
      for (const area of ['world', 'liberio']) assert.equal(await geography.locator(`[data-map-extent="${area}"]`).isVisible(), true);
      await geography.locator('[data-map-extent="world"]').click();
      assert.equal(await mapArea(geography), 'world');
      assert.equal(await geography.locator('#map-title-text').innerText(), 'Across the sea');
      assert.equal(await geography.locator('#map-scale').isVisible(), false, 'schematic world distances cannot share the wall scale');
      assert.deepEqual(await geography.locator('#location-markers [data-location]').evaluateAll(markers => markers.map(marker => marker.dataset.location)), mappedLocations(57, 'world').map(location => location.id));
      assert.ok(await geography.locator('[data-location="paradis"]').count());
      assert.ok(await geography.locator('[data-location="marley"]').count());
      await geography.locator('[data-location="liberio"]').click();
      assert.equal(await mapArea(geography), 'liberio', 'the city pin opens its local map');
      await geography.locator('[data-map-extent="world"]').click();
      await geography.locator('[data-location="paradis"]').click();
      assert.equal(await mapArea(geography), 'island', 'the island pin opens its coastline map');
      await chooseLocation(geography, 'Liberio', 'liberio');
      assert.equal(await mapArea(geography), 'liberio', 'search navigates into the city rather than placing its local coordinates on the world');
      assert.equal(await geography.locator('#map-title-text').innerText(), 'Liberio');
      await geography.locator('[data-map-extent="world"]').click();
      await geography.reload({ waitUntil: 'load' });
      assert.equal(await mapArea(geography), 'world', 'a manual map choice survives reload');
      await episode(geography, 1);
      assert.equal(await mapArea(geography), 'walls');
      assert.deepEqual(await geography.locator('#location-markers [data-location]').evaluateAll(markers => markers.map(marker => marker.dataset.location)), ['shiganshina']);
      for (const area of ['world', 'liberio']) assert.equal(await geography.locator(`[data-map-extent="${area}"]`).isVisible(), false);
      assert.ok(!(await geography.locator('#map-area-note').textContent()).includes('Liberio'), 'returning to E1 clears mainland episode context');
    });

    await test('an unknown mainland battlefield is contextualized without inventing a coordinate', async () => {
      const mainland = await createPage();
      await episode(mainland, 60);
      assert.equal(await mapArea(mainland), 'world');
      const entry = data.episodes.find(episode => episode.number === 60);
      const unpinned = entry.events.filter(event => !event.locationId);
      assert.ok(unpinned.length > 0, 'the battlefield remains unpinned');
      assert.equal(data.locations.some(location => /Fort Slava/i.test(location.name)), false, 'unknown battlefield coordinates are not fabricated');
      assert.match(await mainland.locator('#map-area-note').innerText(), /Fort Slava/);
      const pinned = entry.events.filter(event => event.locationId);
      for (const event of unpinned) assert.equal(await mainland.locator(`[data-location="${event.locationId}"]`).count(), 0);
      assert.ok(pinned.every(event => data.locations.some(location => location.id === event.locationId)), 'only established places are linked');
      await view(mainland, 'recap');
      for (const event of unpinned) assert.equal(await mainland.locator(`#recap-${event.id} .unpinned`).count(), 1);
      await view(mainland, 'map');
      await mainland.locator('#location-search').fill(unpinned[0].title);
      assert.equal(await mainland.locator(`[data-open-event="${unpinned[0].id}"]`).count(), 1, 'the unpinned setting remains searchable');
    });

    await test('episode focus follows the mainland story while keeping every known map area available', async () => {
      const focus = await createPage();
      await episode(focus, 59);
      await focus.locator('#next-milestone').click();
      assert.equal(await focus.locator('#episode-select').inputValue(), '60');
      assert.equal(await mapArea(focus), 'world', 'the next-episode arrow follows the story across the sea');
      await focus.locator('#next-milestone').click();
      assert.equal(await focus.locator('#episode-select').inputValue(), '61');
      assert.equal(await mapArea(focus), 'liberio', 'the next arrow opens the city view');
      await focus.locator('#atlas-map').focus();
      await focus.keyboard.press(']');
      assert.equal(await focus.locator('#episode-select').inputValue(), '62');
      assert.equal(await mapArea(focus), 'liberio', 'keyboard navigation respects the present-setting override');
      assert.equal(await focus.locator('.map-marker.selected').getAttribute('data-location'), 'liberio', 'a flashback does not move the current story back to the island');
      await focus.keyboard.press('[');
      assert.equal(await focus.locator('#episode-select').inputValue(), '61');
      assert.equal(await mapArea(focus), 'liberio');
      for (const number of [60, 61, 62]) {
        await episode(focus, 65);
        await focus.locator('[data-map-extent="world"]').click();
        await focus.locator(`#timeline-track [data-episode="${number}"]`).click();
        assert.equal(await focus.locator('#episode-select').inputValue(), String(number));
        assert.equal(await mapArea(focus), number === 60 ? 'world' : 'liberio', `E${number} timeline selection follows its current setting`);
      }
      for (const number of [61, 63, 65, 66]) {
        await episode(focus, number);
        assert.equal(await mapArea(focus), 'liberio', `E${number} follows its known city setting`);
        assert.equal(await focus.locator('#map-title-text').innerText(), 'Liberio');
        assert.deepEqual(await focus.locator('#location-markers [data-location]').evaluateAll(markers => markers.map(marker => marker.dataset.location)), mappedLocations(number, 'liberio').map(location => location.id));
        await focus.locator('[data-map-extent="world"]').click();
        assert.equal(await mapArea(focus), 'world', `E${number} allows a manual overview`);
        assert.equal(await focus.locator('#map-title-text').innerText(), 'Across the sea');
        await focus.locator('[data-map-extent="island"]').click();
        assert.equal(await mapArea(focus), 'island', `E${number} allows a return to Paradis`);
      }
      await episode(focus, 66);
      assert.equal(await mapArea(focus), 'liberio', 'selecting the episode returns focus to its setting');
      await focus.locator('#expand-map').click();
      assert.equal(await focus.locator('#expanded-map-title').innerText(), 'Liberio');
      await focus.locator('[data-map-extent="world"]').click();
      assert.equal(await focus.locator('#expanded-map-title').innerText(), 'Across the sea');
      assert.equal(await focus.locator('#expanded-map-dialog').evaluate(dialog => dialog.open), true, 'switching areas keeps the expanded map open');
      await focus.locator('#close-expanded-map').click();
    });

    await test('E66–73 map focus follows departure and current island action across episode controls', async () => {
      for (const viewport of [{ width: 1440, height: 1040 }, { width: 390, height: 844 }]) {
        const focused = await createPage(viewport, `if (!localStorage.getItem(${JSON.stringify(storageKey)})) localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(JSON.stringify({ cutoff: 73, viewing: 66, edition: MAX }))})`);
        assert.equal(await mapArea(focused), 'liberio');
        await focused.locator('#next-milestone').click();
        assert.equal(await focused.locator('#episode-select').inputValue(), '67');
        assert.equal(await mapArea(focused), 'world', 'departure opens the regional context');
        assert.equal(await focused.locator('.map-marker.selected').getAttribute('data-location'), 'liberio', 'the known departure city supplies context without a guessed flight coordinate');
        assert.match(await focused.locator('#map-area-note').innerText(), /airship.*route.*unpinned.*departure/i, 'the world context explains the unpinned journey');
        assert.equal(await focused.locator('[data-location*="airship"]').count(), 0);
        await view(focused, 'recap');
        for (const event of data.episodes.find(entry => entry.number === 67).events) {
          assert.equal(await focused.locator(`#recap-${event.id} .unpinned`).count(), 1, 'the flight setting stays unpinned in the recap');
        }
        await view(focused, 'map');
        await focused.locator('[data-map-extent="island"]').click();
        await focused.locator('#zoom-in').click();
        await focused.locator('#return-to-episode').click();
        assert.equal(await mapArea(focused), 'world', 'return restores departure context');
        assert.equal(await focused.locator('.map-marker.selected').getAttribute('data-location'), 'liberio');
        assert.equal(await focused.locator('#map-camera').getAttribute('transform'), 'translate(0 0) scale(1)');
        for (let number = 68; number <= 73; number++) {
          await focused.locator('[data-map-extent="world"]').click();
          await episode(focused, number);
          assert.equal(await mapArea(focused), 'island', `E${number} follows current island action`);
          assert.equal(await focused.locator('.map-marker.selected').getAttribute('data-location'), 'paradis', `E${number} uses island context without guessing a local setting`);
        }
        await episode(focused, 69);
        await focused.locator('#atlas-map').focus();
        await focused.keyboard.press(']');
        assert.equal(await focused.locator('#episode-select').inputValue(), '70');
        assert.equal(await mapArea(focused), 'island', 'a secondary mainland event does not override the current setting');
        await focused.locator('#next-milestone').click();
        await focused.locator('#atlas-map').focus();
        await focused.keyboard.press(']');
        assert.equal(await focused.locator('#episode-select').inputValue(), '72');
        assert.equal(await mapArea(focused), 'island', 'an account of an earlier event does not center Ragako');
        assert.equal(await focused.locator('.map-marker.selected').getAttribute('data-location'), 'paradis');
        assert.match(await focused.locator('#map-area-note').innerText(), /restaurant.*unpinned.*Ragako.*earlier/i, 'the episode distinguishes a discussed location from current action');
        for (const number of [70, 72]) {
          await episode(focused, 73);
          await focused.locator('[data-map-extent="world"]').click();
          await focused.locator(`#timeline-track [data-episode="${number}"]`).click();
          assert.equal(await mapArea(focused), 'island', `E${number} timeline navigation follows the current setting`);
          assert.equal(await focused.locator('.map-marker.selected').getAttribute('data-location'), 'paradis');
        }
        await episode(focused, 73);
        await focused.locator('[data-map-extent="world"]').click();
        await focused.locator('#return-to-episode').click();
        assert.equal(await mapArea(focused), 'island');
        assert.equal(await focused.locator('.map-marker.selected').getAttribute('data-location'), 'paradis');
        assert.match(await focused.locator('#map-area-note').innerText(), /restaurant.*forest detention site.*route.*unpinned/i, 'the island context retains the limits of its local settings');
        assert.deepEqual(await focused.evaluate(key => {
          const saved = JSON.parse(localStorage.getItem(key));
          return { cutoff: saved.cutoff, viewing: saved.viewing };
        }, storageKey), { cutoff: 73, viewing: 73 }, 'return keeps the chosen episode and spoiler limit');
        await focused.reload({ waitUntil: 'load' });
        assert.equal(await focused.locator('#episode-select').inputValue(), '73', 'the content update preserves the saved episode');
        await assertNoHorizontalOverflow(focused, `${viewport.width}px E73 focus`);
      }
    });

    await test('E66–73 character locations clear raid portraits and keep uncertain settings unpinned', async () => {
      const cast = await createPage(undefined, `if (!localStorage.getItem(${JSON.stringify(storageKey)})) localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(JSON.stringify({ cutoff: 73, viewing: 66, edition: MAX }))})`);
      for (const number of [66, 67, 68, 73]) {
        await episode(cast, number);
        await cast.locator('[data-map-extent="liberio"]').click();
        for (const id of ['eren', 'levi', 'scouts']) {
          assert.equal(await cast.locator(`#location-markers [data-person="${id}"]`).count(), number === 66 ? 1 : 0, `E${number} ${id} cannot retain a raid portrait after departure`);
        }
        await view(cast, 'characters');
        for (const id of ['eren', 'levi']) {
          const body = await characterDetails(cast, id);
          const place = body.locator('[data-open-place]');
          if (number === 66) {
            assert.equal(await place.getAttribute('data-open-place'), 'liberio', 'earlier observations remain available');
          } else if (number === 73 && id === 'eren') {
            assert.equal(await place.getAttribute('data-open-place'), 'shiganshina', 'the E73 observation replaces the former unknown setting');
          } else {
            assert.equal(await place.count(), 0, `E${number} ${id} retains no fabricated map point`);
          }
          await closeCharacterDetails(cast);
        }
        await view(cast, 'map');
      }
      await cast.locator('[data-map-extent="island"]').click();
      assert.equal(await cast.locator('[data-location="giant-forest"] [data-person="levi"]').count(), 0, 'the detention forest is not merged with the expedition forest');
    });

    await test('E74 follows current island action while flashbacks and the detention route remain unpinned', async () => {
      const focused = await createPage(undefined, `if (!localStorage.getItem(${JSON.stringify(storageKey)})) localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(JSON.stringify({ cutoff: 74, viewing: 73, edition: MAX }))})`);
      await focused.locator('[data-map-extent="world"]').click();
      await focused.locator('#next-milestone').click();
      assert.equal(await focused.locator('#episode-select').inputValue(), '74');
      assert.equal(await mapArea(focused), 'island');
      assert.equal(await focused.locator('.map-marker.selected').getAttribute('data-location'), 'paradis');
      assert.match(await focused.locator('#map-area-note').innerText(), /flashback/i, 'the focus explains the difference between recalled and current settings');
      await focused.locator('[data-map-extent="world"]').click();
      await focused.locator('#return-to-episode').click();
      assert.equal(await mapArea(focused), 'island');
      assert.equal(await focused.locator('.map-marker.selected').getAttribute('data-location'), 'paradis');
      await view(focused, 'characters');
      const eren = await characterDetails(focused, 'eren');
      assert.equal(await eren.locator('[data-open-place]').getAttribute('data-open-place'), 'shiganshina', 'a recalled meeting does not replace the E73 observation');
      await closeCharacterDetails(focused);
      const levi = await characterDetails(focused, 'levi');
      assert.equal(await levi.locator('[data-open-place]').count(), 0, 'the transfer route gets no invented map coordinates');
      assert.match(await levi.locator('footer').innerText(), /episode 74/i, 'the new observation is recorded at E74');
      await closeCharacterDetails(focused);
      await focused.reload({ waitUntil: 'load' });
      assert.equal(await focused.locator('#episode-select').inputValue(), '74', 'the saved episode survives the update');
    });

    await test('forest scenes follow only the current episode and its visible participants without changing map pins', async () => {
      const forest = await createPage();
      const expeditionForest = data.locations.find(location => location.id === 'giant-forest');
      for (const number of [67, 68, 69, 72, 73, 74]) {
        await episode(forest, number);
        await forest.locator('[data-map-extent="island"]').click();
        if (![68, 72, 73, 74].includes(number)) {
          assert.equal(await forest.locator('#map-scenes .map-scene-card').count(), 0, `E${number} does not retain another episode's forest scene`);
          continue;
        }
        const event = forestSceneEvent(number);
        const card = forest.locator('#map-scenes .map-scene-card');
        assert.equal(await card.count(), 1, `E${number} has one source scene`);
        assert.equal(await card.isVisible(), true);
        assert.equal(await card.getAttribute('data-scene-event'), event.id);
        assert.equal(await card.locator('[data-open-event]').getAttribute('data-open-event'), event.id);
        assert.ok((await card.innerText()).includes(event.mapScene.name), 'the scene setting is named');
        assert.ok((await card.innerText()).includes(event.title), 'the recorded event is identified');
        assert.deepEqual((await card.locator('[data-open-character]').evaluateAll(buttons => buttons.map(button => button.dataset.openCharacter))).sort(), sceneParticipants(event, number).sort());
        const people = await card.locator('[data-open-character]').evaluateAll(buttons => buttons.map(button => ({ id: button.dataset.openCharacter, name: button.textContent.trim(), portraits: button.querySelectorAll('[data-portrait]').length })));
        for (const person of people) {
          assert.ok(person.name.includes(at(data.characters.find(character => character.id === person.id).name, number).text), 'scene labels use the episode-visible name');
          assert.equal(person.portraits, 1, 'each person has a real portrait');
        }
        assert.equal(await forest.locator('#location-markers [data-location]').count(), mappedLocations(number, 'island').length, 'a scene card adds no map location');
        assert.equal(await forest.locator('#location-markers [data-location="giant-forest"]').getAttribute('transform'), `translate(${expeditionForest.x} ${expeditionForest.y})`, 'scene context does not move the established forest marker');
        assert.equal(await forest.locator('[data-location="giant-forest"] [data-person="levi"], [data-location="giant-forest"] [data-person="zeke"]').count(), 0, 'scene portraits do not become recorded positions at the expedition forest');
      }
      await episode(forest, 73);
      const futureEvent = forestSceneEvent(74);
      assert.ok(!(await forest.locator('#map-scenes').innerText()).includes(futureEvent.title), 'E74 action is absent from the E73 map scene');
      await episode(forest, 67);
      await chooseLocation(forest, 'Forest of Giant Trees', 'giant-forest');
      assert.equal(await forest.locator('#location-panel .related-scene').count(), 0, 'the place panel has no future forest scene before E68');
    });

    await test('forest scene visibility follows Island and Walls and the People layer', async () => {
      const forest = await createPage();
      await episode(forest, 74);
      for (const area of ['island', 'walls', 'world', 'liberio']) {
        await forest.locator(`[data-map-extent="${area}"]`).click();
        assert.equal(await forest.locator('#map-scenes .map-scene-card:visible').count(), ['island', 'walls'].includes(area) ? 1 : 0, `${area} controls scene visibility`);
      }
      await forest.locator('[data-map-extent="walls"]').click();
      await setLayer(forest, 'groups', false);
      assert.equal(await forest.locator('#map-scenes .map-scene-card:visible').count(), 0, 'hiding People also hides scene portraits');
      await setLayer(forest, 'groups', true);
      assert.equal(await forest.locator('#map-scenes .map-scene-card:visible').count(), 1, 'restoring People restores the scene');
      assert.equal(await forest.locator('#location-markers [data-location]').count(), mappedLocations(74, 'walls').length, 'layers never create an additional forest pin');
    });

    await test('forest scene portraits open character details and its event control preserves pinned and unpinned navigation', async () => {
      const forest = await createPage();
      for (const number of [72, 73, 74]) {
        await view(forest, 'map');
        await episode(forest, number);
        await forest.locator('[data-map-extent="island"]').click();
        const event = forestSceneEvent(number);
        await forest.locator(`#map-scenes [data-scene-event="${event.id}"] [data-open-event]`).click();
        assert.equal(await forest.locator('#episode-select').inputValue(), String(number), 'reading a source event keeps the selected episode');
        if (event.locationId) {
          assert.equal(await forest.locator('#map-view').isVisible(), true);
          assert.equal(await forest.locator('.map-marker.selected').getAttribute('data-location'), event.locationId, 'an established event place remains selectable');
        } else {
          assert.equal(await forest.locator('#recap-view').isVisible(), true, 'an unpinned event opens its recap');
          assert.equal(await forest.locator(`#recap-${event.id}`).evaluate(card => card === document.activeElement), true, 'focus moves to the source recap');
        }
      }
      await view(forest, 'map');
      await episode(forest, 74);
      await forest.locator('[data-map-extent="island"]').click();
      for (const id of ['levi', 'zeke']) {
        await forest.locator(`#map-scenes [data-open-character="${id}"]`).click();
        assert.equal(await forest.locator('#character-detail-dialog').evaluate(dialog => dialog.open), true);
        assert.equal(await forest.locator('#character-detail-title').innerText(), at(data.characters.find(character => character.id === id).name, 74).text);
        assert.equal(await forest.locator('#character-detail-body [data-open-place]').count(), 0, 'a scene portrait keeps the uncertain last-recorded position unpinned');
        await closeCharacterDetails(forest);
        await view(forest, 'map');
      }
    });

    await test('the forest place panel distinguishes related scene context from a recorded forest position', async () => {
      const forest = await createPage();
      for (const number of [68, 72, 73, 74]) {
        await episode(forest, number);
        await chooseLocation(forest, 'Forest of Giant Trees', 'giant-forest');
        const event = forestSceneEvent(number);
        const related = forest.locator('#location-panel .related-scene');
        assert.equal(await related.count(), 1, `E${number} has current related context`);
        const copy = await related.innerText();
        assert.ok(copy.includes(event.mapScene.name));
        assert.ok(copy.includes(event.summary), 'the original event summary is available');
        assert.ok(copy.includes(event.mapScene.geography), 'the relationship to the established forest is explained');
        assert.equal(await related.locator('[data-open-event]').getAttribute('data-open-event'), event.id);
        assert.deepEqual((await related.locator('[data-open-character]').evaluateAll(buttons => buttons.map(button => button.dataset.openCharacter))).sort(), sceneParticipants(event, number).sort());
      }
      await forest.locator('#location-panel .related-scene [data-open-character="levi"]').click();
      assert.equal(await forest.locator('#character-detail-dialog').evaluate(dialog => dialog.open), true, 'related-panel portraits also open details');
      await closeCharacterDetails(forest);
      await view(forest, 'map');
      await episode(forest, 69);
      await chooseLocation(forest, 'Forest of Giant Trees', 'giant-forest');
      assert.equal(await forest.locator('#location-panel .related-scene').count(), 0, 'an episode without that setting does not retain the previous scene');
    });

    await test('forest scene strips fit phone and expanded views without covering the map controls', async () => {
      for (const viewport of [{ width: 1440, height: 1040 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
        const forest = await createPage(viewport);
        await episode(forest, 74);
        for (const expanded of [false, true]) {
          if (expanded) await forest.locator('#expand-map').click();
          const card = forest.locator('#map-scenes .map-scene-card');
          assert.equal(await card.isVisible(), true, 'the current forest scene remains available');
          const stage = await forest.locator('#map-stage').boundingBox();
          const box = await card.boundingBox();
          const scope = await forest.locator(expanded ? '#expanded-map-dialog' : '#map-view').boundingBox();
          assert.ok(box.x >= scope.x - 1 && box.x + box.width <= scope.x + scope.width + 1
            && box.y >= scope.y - 1 && box.y + box.height <= scope.y + scope.height + 1, `${viewport.width}px expanded=${expanded}: scene stays inside its view`);
          assert.equal(overlap({ left: box.x, right: box.x + box.width, top: box.y, bottom: box.y + box.height },
            { left: stage.x, right: stage.x + stage.width, top: stage.y, bottom: stage.y + stage.height }), false, 'scene content does not cover the map or its controls');
          const controls = await card.locator('[data-open-character], [data-open-event]').evaluateAll(buttons => buttons.map(button => {
            const box = button.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height, name: button.textContent.trim(), readable: button.scrollWidth <= button.clientWidth + 1 };
          }));
          assert.ok(controls.length >= 3);
          for (const control of controls) {
            assert.ok(control.x >= box.x - 1 && control.y >= box.y - 1 && control.x + control.width <= box.x + box.width + 1
              && control.y + control.height <= box.y + box.height + 1, 'scene controls are inside their card');
            assert.equal(control.readable, true, 'button labels do not overflow');
            assert.ok(control.width >= 24 && control.height >= 24, 'portrait and source controls remain reachable');
          }
          for (const control of await card.locator('[data-open-character], [data-open-event]').all()) {
            await control.click({ trial: true });
          }
          await assertNoHorizontalOverflow(forest, `${viewport.width}px forest scene expanded=${expanded}`);
          if (expanded) await forest.locator('#close-expanded-map').click();
        }
      }
    });

    await test('Liberio pins use episode-known places and explicitly approximate geography', async () => {
      const city = await createPage();
      for (const number of [61, 62, 63, 65, 66]) {
        await episode(city, number);
        await city.locator('[data-map-extent="liberio"]').click();
        const locations = mappedLocations(number, 'liberio');
        const markers = await city.locator('#location-markers [data-location]').evaluateAll(markers => markers.map(marker => ({
          id: marker.dataset.location, matrix: { x: marker.transform.baseVal.consolidate().matrix.e, y: marker.transform.baseVal.consolidate().matrix.f },
          people: [...marker.querySelectorAll('[data-person]')].map(person => person.dataset.person)
        })));
        assert.deepEqual(markers.map(marker => marker.id), locations.map(location => location.id), `E${number} local geography`);
        const expectedPeople = data.characters.filter(character => character.firstEpisode <= number && locations.some(location => location.id ===
          (character.positions || []).filter(position => position.episode <= number).sort((a, b) => b.episode - a.episode)[0]?.locationId)).map(character => character.id);
        assert.deepEqual(markers.flatMap(marker => marker.people).sort(), expectedPeople.sort(), `E${number} displays every recorded person in this area`);
        for (const marker of markers) {
          const location = locations.find(location => location.id === marker.id);
          assert.deepEqual(marker.matrix, { x: location.x, y: location.y }, `${marker.id} uses local coordinates`);
          for (const id of marker.people) {
            const character = data.characters.find(character => character.id === id);
            const position = (character.positions || []).filter(position => position.episode <= number).sort((a, b) => b.episode - a.episode)[0];
            assert.equal(position?.locationId, marker.id, `E${number} ${id} uses the last recorded location`);
          }
        }
        for (const later of data.locations.filter(location => locationArea(location) === 'liberio' && location.firstEpisode > number)) assert.equal(await city.locator(`[data-location="${later.id}"]`).count(), 0);
      }
      await chooseLocation(city, 'Liberio', 'liberio');
      assert.match(await city.locator('#map-geography-badge').innerText(), /Schematic/i);
      await city.locator('#map-legend summary').click();
      assert.match(await city.locator('#map-accuracy-note').innerText(), /approximate|schematic|scale/i);
      assert.match(await city.locator('#place-geography-note').innerText(), /approximate|schematic|scale/i);
      assert.equal(await city.locator('#map-scale').isVisible(), false);
      await assertNoHorizontalOverflow(city, 'Liberio geography');
    });

    await test('recognizable place symbols appear only when their local settings are known', async () => {
      const symbols = await createPage();
      await setCutoff(symbols, 65);
      for (const number of [56, 57, 61, 62, 63, 65]) {
        await episode(symbols, number);
        if (number >= 57) await symbols.locator('[data-map-extent="liberio"]').click();
        const expected = Object.entries(placeSymbols).filter(([id]) => data.locations.find(location => location.id === id).firstEpisode <= number);
        assert.equal(await symbols.locator('#location-markers [data-map-symbol]').count(), expected.length, `E${number}: only known local symbols appear`);
        for (const [id, symbol] of expected) {
          const marker = symbols.locator(`[data-location="${id}"]`);
          assert.equal(await marker.locator('[data-map-symbol]').getAttribute('data-map-symbol'), symbol, `${id}: the right symbol identifies the place`);
          assert.equal(await marker.locator('[data-map-symbol]').getAttribute('aria-hidden'), 'true', 'decorative symbols do not repeat the accessible place name');
          assert.match(await marker.getAttribute('aria-label'), /Explore .+\. Approximate map position/, 'the accessible name retains geography accuracy');
          assert.notEqual(await marker.locator('.marker-ring').evaluate(element => getComputedStyle(element).strokeDasharray), 'none', 'the symbol retains the approximate-position ring');
        }
      }
      await symbols.locator('[data-map-extent="world"]').click();
      assert.equal(await symbols.locator('#location-markers [data-map-symbol]').count(), 0, 'local symbols do not crowd the world overview');
      await setCutoff(symbols, 61);
      await symbols.locator('[data-map-extent="liberio"]').click();
      assert.equal(await symbols.locator('#location-markers [data-map-symbol]').count(), 0, 'lowering the limit removes all later local symbols');
    });

    await test('recognizable place symbols stay readable inside their rings at every zoom and map size', async () => {
      const sizes = [];
      for (const viewport of [{ width: 1440, height: 1040 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
        const symbols = await createPage(viewport);
        await setCutoff(symbols, 65);
        await episode(symbols, 65);
        for (const style of ['parchment', 'night']) {
          await symbols.locator(`button[data-map-style="${style}"]`).click();
          for (const expanded of [false, true]) {
            if (expanded) await symbols.locator('#expand-map').click();
            for (const zoomed of [false, true]) {
              if (zoomed) await symbols.locator('#zoom-in').click();
              await symbols.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
              const measured = await symbols.locator('#location-markers [data-map-symbol]').evaluateAll(glyphs => glyphs.map(glyph => {
                const marker = glyph.closest('[data-location]');
                const ring = marker.querySelector('.marker-ring').getBoundingClientRect();
                const icon = glyph.getBoundingClientRect();
                return { id: marker.dataset.location, symbol: glyph.dataset.mapSymbol, shape: glyph.innerHTML, ring: { left: ring.left, top: ring.top, right: ring.right, bottom: ring.bottom, width: ring.width, height: ring.height }, icon: { left: icon.left, top: icon.top, right: icon.right, bottom: icon.bottom, width: icon.width, height: icon.height } };
              }));
              assert.equal(measured.length, 3, 'all three recognizable place symbols are rendered');
              assert.equal(new Set(measured.map(item => item.shape)).size, 3, 'the three settings have distinct drawings');
              for (const item of measured) {
                assert.ok(item.icon.width >= 6.8 && item.icon.height >= 6.8, `${viewport.width}px ${item.id}: the symbol is readable`);
                assert.ok(item.icon.left >= item.ring.left - 1 && item.icon.right <= item.ring.right + 1 && item.icon.top >= item.ring.top - 1 && item.icon.bottom <= item.ring.bottom + 1, `${viewport.width}px ${item.id}: the symbol stays inside its ring`);
                sizes.push({ id: item.id, width: item.icon.width, height: item.icon.height, ringWidth: item.ring.width });
              }
            }
            await symbols.locator('#reset-map').click();
            await assertNoHorizontalOverflow(symbols, `${viewport.width}px ${style} recognizable symbols, expanded=${expanded}`);
            if (expanded) await symbols.locator('#close-expanded-map').click();
          }
        }
      }
      for (const id of Object.keys(placeSymbols)) {
        const all = sizes.filter(item => item.id === id);
        for (const property of ['width', 'height', 'ringWidth']) {
          assert.ok(Math.max(...all.map(item => item[property])) - Math.min(...all.map(item => item[property])) < 1, `${id}: ${property} changes across zoom, viewport or expansion`);
        }
      }
    });

    await test('Back to this episode restores its map focus after exploration without changing progress', async () => {
      for (const viewport of [{ width: 1440, height: 1040 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
        const returning = await createPage(viewport);
        await setCutoff(returning, 65);
        await episode(returning, 65);
        const action = returning.locator('#return-to-episode');
        assert.equal(await action.isVisible(), false, 'the return action leaves the map clear while already focused');
        assert.equal(await action.isDisabled(), true, 'the episode is already focused');
        const expected = data.episodes.find(entry => entry.number === 65).mapFocus;
        for (const expanded of [false, true]) {
          if (expanded) await returning.locator('#expand-map').click();
          assert.equal(await action.evaluate(element => Boolean(element.closest('#expanded-map-dialog'))), expanded, 'the same action follows the expanded map');
          await returning.locator('[data-map-extent="world"]').click();
          assert.equal(await action.isEnabled(), true, 'switching areas makes the return action available');
          await chooseLocation(returning, 'Trost', 'trost');
          await returning.locator('#zoom-in').click().catch(error => { throw new Error(`${viewport.width}px expanded=${expanded}: zoom after search: ${error.message}`); });
          await returning.locator('#atlas-map').focus();
          await returning.keyboard.press('ArrowRight');
          const before = await returning.evaluate(key => {
            const saved = JSON.parse(localStorage.getItem(key));
            return { cutoff: saved.cutoff, viewing: saved.viewing };
          }, storageKey);
          assert.notEqual(await returning.locator('#map-camera').getAttribute('transform'), 'translate(0 0) scale(1)', 'exploration changes the camera');
          await action.focus();
          await returning.keyboard.press('Enter');
          assert.equal(await mapArea(returning), expected.area, 'return restores the episode area');
          assert.equal(await returning.locator('.map-marker.selected').getAttribute('data-location'), expected.locationId, 'return selects the episode place');
          assert.equal(await returning.locator('.map-marker.selected').evaluate(element => element === document.activeElement), true, 'keyboard return moves focus to the restored place');
          assert.equal(await returning.locator('#map-camera').getAttribute('transform'), 'translate(0 0) scale(1)', 'return restores the episode camera');
          assert.equal(await returning.locator('#episode-select').inputValue(), '65', 'return does not change the chosen episode');
          assert.deepEqual(await returning.evaluate(key => {
            const saved = JSON.parse(localStorage.getItem(key));
            return { cutoff: saved.cutoff, viewing: saved.viewing };
          }, storageKey), before, 'return preserves the saved episode and spoiler limit');
          assert.equal(await action.isDisabled(), true, 'return is complete');
          assert.equal(await returning.locator('#expanded-map-dialog').evaluate(dialog => dialog.open), expanded, 'return preserves normal or expanded view');
          await returning.locator('#zoom-in').click();
          assert.equal(await action.isEnabled(), true, 'zooming alone enables return');
          await action.click();
          await assertNoHorizontalOverflow(returning, `${viewport.width}px return to episode, expanded=${expanded}`);
          if (expanded) await returning.locator('#close-expanded-map').click();
        }
      }
    });

    await test('Back to this episode respects unknown settings and lowered episode limits', async () => {
      const returning = await createPage();
      await setCutoff(returning, 65);
      await episode(returning, 60);
      await returning.locator('[data-map-extent="island"]').click();
      await returning.locator('#return-to-episode').click();
      assert.equal(await mapArea(returning), 'world', 'an unpinned battlefield returns to broad mainland context');
      assert.equal(await returning.locator('[data-location="fort-slava"]').count(), 0, 'return does not invent a battlefield pin');
      assert.match(await returning.locator('#map-area-note').innerText(), /exact position.*not established/i);
      await episode(returning, 3);
      await returning.locator('#zoom-in').click();
      assert.equal(await returning.locator('#return-to-episode').isDisabled(), true, 'an episode without a supported focus has no return destination');
      await episode(returning, 65);
      await returning.locator('[data-map-extent="world"]').click();
      await setCutoff(returning, 1);
      await returning.locator('#zoom-in').click();
      await returning.locator('#return-to-episode').click();
      assert.equal(await mapArea(returning), 'walls');
      assert.equal(await returning.locator('#episode-select').inputValue(), '1');
      assert.equal(await returning.locator('.map-marker.selected').getAttribute('data-location'), 'shiganshina');
      assert.deepEqual(await returning.locator('#location-markers [data-location]').evaluateAll(markers => markers.map(marker => marker.dataset.location)), ['shiganshina'], 'a former mainland focus cannot survive a lowered limit');
      assert.equal(await returning.locator('#location-markers [data-map-symbol]').count(), 0);
      const copy = await returning.locator('#return-to-episode').evaluate(element => [element.textContent, element.getAttribute('aria-label'), element.getAttribute('title')].join(' '));
      for (const location of data.locations.filter(location => location.firstEpisode > 1)) assert.ok(!copy.includes(location.name), 'the return action does not describe a later place');
    });

    await test('phone Liberio labels stay inside the map and clear of every portrait chip', async () => {
      for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }]) {
        const city = await createPage(viewport);
        await episode(city, 65);
        await city.locator('[data-map-extent="liberio"]').click();
        for (const style of ['parchment', 'night']) {
          await city.locator(`button[data-map-style="${style}"]`).click();
          for (const expanded of [false, true]) {
            if (expanded) await city.locator('#expand-map').click();
            const boxes = await labelBoxes(city);
            const labels = boxes.filter(box => /marker-label/.test(box.kind));
            const portraits = boxes.filter(box => /map-person/.test(box.kind));
            assert.ok(labels.length && portraits.length, `${viewport.width}px ${style}: known labels and portraits are rendered`);
            assert.equal(labels.length, mappedLocations(65, 'liberio').length, `${viewport.width}px ${style}, expanded=${expanded}: every local place has a visible name`);
            const clashes = labels.flatMap(label => portraits.filter(portrait => overlap(label, portrait)).map(portrait => `${label.owner}/${portrait.owner}`));
            assert.deepEqual(clashes, [], `${viewport.width}px ${style}, expanded=${expanded}: labels overlap portrait chips`);
            const stage = await city.locator('#map-stage').boundingBox();
            const outside = labels.filter(label => label.left < stage.x - 1 || label.right > stage.x + stage.width + 1
              || label.top < stage.y - 1 || label.bottom > stage.y + stage.height + 1);
            assert.deepEqual(outside.map(label => label.owner), [], `${viewport.width}px ${style}, expanded=${expanded}: labels are clipped`);
            await assertNoHorizontalOverflow(city, `${viewport.width}px ${style} Liberio, expanded=${expanded}`);
            if (expanded) await city.locator('#close-expanded-map').click();
          }
        }
      }
    });

    await test('Everyone fills one continuous gallery and each card opens readable details', async () => {
      const compact = await createPage();
      await view(compact, 'characters');
      const count = data.characters.filter(character => character.type !== 'group' && character.firstEpisode <= MAX).length;
      assert.equal(await compact.locator('.character-card').count(), count);
      assert.equal(await compact.locator('.character-grid').count(), 1, 'Everyone uses one grid');
      assert.equal(await compact.locator('.character-section h2').count(), 0, 'Everyone has no faction breaks');
      assert.equal(await compact.locator('.character-about').count(), 0, 'cards have no repeated About row');
      const rows = await compact.locator('.character-card').evaluateAll(cards => {
        const rows = new Map();
        for (const card of cards) {
          const y = Math.round(card.getBoundingClientRect().top);
          rows.set(y, (rows.get(y) || 0) + 1);
        }
        return [...rows.values()];
      });
      assert.ok(rows.length > 1);
      assert.ok(rows.slice(0, -1).every(count => count === rows[0]), 'every row except the last should be filled');
      const visible = await compact.locator('.character-card').evaluateAll(cards => cards.filter(card => {
        const rect = card.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= innerHeight;
      }).length);
      assert.ok(visible >= 20, `only ${visible} complete cards fit on a desktop`);
      const body = await characterDetails(compact, 'eren');
      assert.equal(await compact.locator('#character-detail-title').innerText(), at(data.characters.find(character => character.id === 'eren').name, MAX).text);
      assert.equal(await body.locator('.character-description').innerText(), at(data.characters.find(character => character.id === 'eren').role, MAX).text);
      assert.equal(await body.locator('footer').isVisible(), true, 'metadata is available in the details panel');
      await closeCharacterDetails(compact);
      await assertNoHorizontalOverflow(compact, 'compact gallery');
    });

    await test('This episode shows each recorded participant once with an accessible explanation and episode-visible name', async () => {
      const cast = await createPage();
      await view(cast, 'characters');
      assert.equal(await cast.locator('[data-faction-filter="all"]').getAttribute('aria-pressed'), 'true', 'Everyone remains the default');
      await cast.locator('[data-faction-filter="episode"]').click();
      for (const number of [1, 68, 73, 74]) {
        await episode(cast, number);
        assert.equal(await cast.locator('[data-faction-filter="episode"]').getAttribute('aria-pressed'), 'true', 'episode changes retain the chosen mode');
        const cards = await cast.locator('.character-card').evaluateAll(items => items.map(card => {
          const button = card.querySelector('.character-card-button');
          const explanation = card.querySelector('.character-involvement');
          return {
            id: card.dataset.character,
            name: card.querySelector('.character-name').textContent,
            explanation: explanation?.textContent.trim(),
            explanationCount: card.querySelectorAll('.character-involvement').length,
            descriptionResolves: Boolean(explanation?.id && (button.getAttribute('aria-describedby') || '').split(/\s+/).includes(explanation.id)
              && document.getElementById(explanation.id) === explanation)
          };
        }));
        assert.deepEqual(cards.map(card => card.id).sort(), episodeParticipants(number).sort(), `E${number} contains exactly the recorded individuals`);
        assert.equal(await cast.locator('.character-grid').count(), 1, 'episode cast uses a continuous grid');
        assert.equal(await cast.locator('.character-section h2').count(), 0, 'episode cast has no faction breaks');
        assert.match(await cast.locator('#characters-view').innerText(), /recorded events/i, 'coverage distinguishes recorded participants from the entire episode cast');
        for (const card of cards) {
          const character = data.characters.find(character => character.id === card.id);
          assert.equal(card.name, at(character.name, number).text, `E${number} ${card.id} uses the visible name`);
          assert.equal(card.explanationCount, 1, `E${number} ${card.id} has exactly one explanation`);
          assert.ok(card.explanation, `E${number} ${card.id} needs a meaningful explanation`);
          assert.equal(card.descriptionResolves, true, `E${number} ${card.id} is described accessibly`);
          assert.ok(card.explanation.length < 500, `E${number} ${card.id} explanation stays concise`);
          assert.ok(!/\bE(?:7[5-9]|8\d)\b|\bepisode (?:7[5-9]|8\d)\b/i.test(card.explanation), 'the summary cannot refer to a later episode');
        }
      }
    });

    await test('This episode explanations use the selected episode and distinguish a flashback from present action', async () => {
      const cast = await createPage();
      await episode(cast, 1);
      await view(cast, 'characters');
      await cast.locator('[data-faction-filter="episode"]').click();
      assert.equal(await cast.locator('#character-armin .character-involvement').innerText(), data.episodes[0].characterInvolvement?.armin
        || data.characters.find(character => character.id === 'armin').notes.find(note => note.episode === 1).text, 'an introduction uses its current note rather than later history');
      await episode(cast, 68);
      assert.match(await cast.locator('#character-eren .character-involvement').innerText(), /flashback|earlier|recalled/i, 'a recalled arrival is clearly identified');
      await episode(cast, 73);
      assert.equal(await cast.locator('#character-armin .character-involvement').innerText(), data.episodes.find(entry => entry.number === 73).characterInvolvement?.armin
        || data.characters.find(character => character.id === 'armin').notes.find(note => note.episode === 73).text, 'the explanation changes with the selected episode');
      await episode(cast, 74);
      const xaver = await cast.locator('#character-xaver .character-involvement').innerText();
      assert.ok(!/\.\s+[A-Z]/.test(xaver), 'multi-sentence notes are shortened to one sentence');
      assert.match(await cast.locator('#character-grisha .character-involvement').innerText(), /flashback|earlier|recalled|memories|recollection/i, 'a childhood participant is not presented as current action');
    });

    await test('This episode search narrows its participants and Everyone restores the full compact gallery', async () => {
      const cast = await createPage();
      await episode(cast, 74);
      await view(cast, 'characters');
      await cast.locator('[data-faction-filter="episode"]').click();
      await cast.locator('#character-filter').fill('Levi');
      assert.deepEqual(await cast.locator('.character-card').evaluateAll(cards => cards.map(card => card.dataset.character)), ['levi']);
      await cast.locator('#character-filter').fill('Mikasa');
      assert.equal(await cast.locator('.character-card').count(), 0, 'a known person outside the recorded episode is excluded');
      await cast.locator('[data-faction-filter="all"]').click();
      assert.deepEqual(await cast.locator('.character-card').evaluateAll(cards => cards.map(card => card.dataset.character)), ['mikasa'], 'Everyone preserves the search while broadening its scope');
      await cast.locator('#character-filter').fill('');
      const everyone = data.characters.filter(character => character.type !== 'group' && character.firstEpisode <= 74);
      assert.deepEqual((await cast.locator('.character-card').evaluateAll(cards => cards.map(card => card.dataset.character))).sort(), everyone.map(character => character.id).sort());
      assert.equal(await cast.locator('.character-involvement').count(), 0, 'Everyone keeps its compact cards');
      await cast.locator('[data-faction-filter="episode"]').click();
      await cast.locator('#prev-milestone').click();
      assert.equal(await cast.locator('#episode-select').inputValue(), '73');
      assert.equal(await cast.locator('[data-faction-filter="episode"]').getAttribute('aria-pressed'), 'true');
      assert.deepEqual((await cast.locator('.character-card').evaluateAll(cards => cards.map(card => card.dataset.character))).sort(), episodeParticipants(73).sort());
      await cast.locator('#next-milestone').click();
      assert.deepEqual((await cast.locator('.character-card').evaluateAll(cards => cards.map(card => card.dataset.character))).sort(), episodeParticipants(74).sort());
    });

    await test('This episode remains available in the expanded gallery and details restore its filter, search and focus', async () => {
      for (const viewport of [{ width: 1440, height: 1040 }, { width: 390, height: 844 }]) {
        const cast = await createPage(viewport);
        await episode(cast, 74);
        await view(cast, 'characters');
        await cast.locator('[data-faction-filter="episode"]').click();
        await cast.locator('#expand-gallery').click();
        assert.equal(await cast.locator('#expanded-gallery-dialog').evaluate(dialog => dialog.open), true);
        assert.equal(await cast.locator('[data-faction-filter="episode"]').getAttribute('aria-pressed'), 'true');
        assert.deepEqual((await cast.locator('.character-card').evaluateAll(cards => cards.map(card => card.dataset.character))).sort(), episodeParticipants(74).sort());
        await cast.locator('#character-filter').fill('Levi');
        await characterDetails(cast, 'levi');
        assert.equal(await cast.locator('#expanded-gallery-dialog').evaluate(dialog => dialog.open), true);
        await cast.keyboard.press('Escape');
        assert.equal(await cast.locator('#character-detail-dialog').evaluate(dialog => dialog.open), false);
        assert.equal(await cast.locator('#expanded-gallery-dialog').evaluate(dialog => dialog.open), true);
        assert.equal(await cast.locator('#character-levi .character-card-button').evaluate(button => button === document.activeElement), true);
        assert.equal(await cast.locator('#character-filter').inputValue(), 'Levi');
        await assertNoHorizontalOverflow(cast, `${viewport.width}px expanded episode cast`);
        await cast.locator('#close-expanded-gallery').click();
        assert.equal(await cast.locator('[data-faction-filter="episode"]').getAttribute('aria-pressed'), 'true');
        assert.equal(await cast.locator('#character-filter').inputValue(), 'Levi');
        assert.equal(await cast.locator('#expand-gallery').evaluate(button => button === document.activeElement), true);
      }
    });

    await test('map and recap character links reset This episode so a person outside its cast remains reachable', async () => {
      const cast = await createPage();
      await episode(cast, 74);
      const event = data.episodes.find(entry => entry.number === 73).events.find(event => event.people.includes('mikasa'));
      for (const source of ['recap', 'map']) {
        await view(cast, 'characters');
        await cast.locator('[data-faction-filter="episode"]').click();
        assert.equal(await cast.locator('#character-mikasa').count(), 0);
        await view(cast, source);
        if (source === 'recap') await cast.locator(`#recap-${event.id} [data-open-character="mikasa"]`).click();
        else {
          await cast.locator('#location-search').fill('Mikasa');
          await cast.locator('#search-results [data-open-character="mikasa"]').click();
        }
        assert.equal(await cast.locator('#characters-view').isVisible(), true);
        assert.equal(await cast.locator('[data-faction-filter="all"]').getAttribute('aria-pressed'), 'true');
        assert.equal(await cast.locator('#character-detail-dialog').evaluate(dialog => dialog.open), true);
        assert.equal(await cast.locator('#character-detail-title').innerText(), at(data.characters.find(character => character.id === 'mikasa').name, 74).text);
        await closeCharacterDetails(cast);
        assert.equal(await cast.locator('#character-mikasa .character-card-button').evaluate(button => button === document.activeElement), true);
      }
    });

    await test('This episode fits narrow phones with readable explanations and full-card touch targets', async () => {
      for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 740 }]) {
        const cast = await createPage(viewport);
        await episode(cast, 74);
        await view(cast, 'characters');
        await cast.locator('[data-faction-filter="episode"]').click();
        await assertNoHorizontalOverflow(cast, `${viewport.width}px episode cast`);
        const cards = await cast.locator('.character-card').evaluateAll(items => items.map(card => {
          const explanation = card.querySelector('.character-involvement');
          const button = card.querySelector('.character-card-button');
          const c = card.getBoundingClientRect(), e = explanation.getBoundingClientRect(), b = button.getBoundingClientRect();
          const style = getComputedStyle(explanation);
          return { id: card.dataset.character, text: explanation.textContent.trim(), readable: style.display !== 'none' && style.visibility !== 'hidden'
            && explanation.scrollWidth <= explanation.clientWidth + 1 && explanation.scrollHeight <= explanation.clientHeight + 1,
            contained: e.left >= c.left && e.right <= c.right + 1 && e.top >= c.top && e.bottom <= c.bottom + 1,
            width: b.width, height: b.height, cardWidth: c.width, cardHeight: c.height };
        }));
        assert.ok(cards.length > 0);
        for (const card of cards) {
          assert.equal(card.readable, true, `${viewport.width}px ${card.id} explanation is readable in full`);
          assert.equal(card.contained, true, `${viewport.width}px ${card.id} explanation stays inside the card`);
          assert.ok(card.width >= 44 && card.height >= 44, 'card controls keep useful touch targets');
          assert.ok(card.width >= card.cardWidth - 4 && card.height >= card.cardHeight - 4, 'the full card opens details');
        }
        const mode = await cast.locator('[data-faction-filter="episode"]').boundingBox();
        assert.ok(mode.width >= 44 && mode.height >= 36, 'the episode mode keeps a useful hit area');
        await cast.locator('[data-faction-filter="all"]').click();
        assert.equal(await cast.locator('.character-involvement').count(), 0);
        await assertNoHorizontalOverflow(cast, `${viewport.width}px Everyone after episode cast`);
      }
    });

    await test('whole character cards work by mouse, Enter and Space and return to the same filtered gallery', async () => {
      const gallery = await createPage();
      await view(gallery, 'characters');
      await gallery.locator('#character-filter').fill('Levi');
      const matches = await gallery.locator('.character-card').evaluateAll(cards => cards.map(card => card.dataset.character));
      const card = gallery.locator('#character-levi');
      const opener = card.locator('.character-card-button');
      assert.equal(await opener.getAttribute('aria-label'), `Open details for ${at(data.characters.find(character => character.id === 'levi').name, MAX).text}`);
      const cardBox = await card.boundingBox();
      const buttonBox = await opener.boundingBox();
      assert.ok(buttonBox.width >= cardBox.width - 4 && buttonBox.height >= cardBox.height - 4, 'the full card is the click target');
      for (const key of [null, 'Enter', 'Space']) {
        await opener.focus();
        const scroll = await gallery.evaluate(() => scrollY);
        if (key) await gallery.keyboard.press(key);
        else await opener.click({ position: { x: buttonBox.width - 10, y: buttonBox.height - 10 } });
        assert.equal(await gallery.locator('#character-detail-dialog').evaluate(dialog => dialog.open), true, `${key || 'mouse'} opens details`);
        assert.equal(await gallery.evaluate(() => Boolean(document.activeElement.closest('#character-detail-dialog'))), true, 'focus enters the details panel');
        await gallery.keyboard.press('Tab');
        assert.equal(await gallery.evaluate(() => Boolean(document.activeElement.closest('#character-detail-dialog'))), true, 'focus stays in the details panel');
        await gallery.keyboard.press('Escape');
        assert.equal(await gallery.locator('#character-detail-dialog').evaluate(dialog => dialog.open), false);
        assert.equal(await opener.evaluate(element => element === document.activeElement), true, 'focus returns to the initiating card');
        assert.equal(await gallery.locator('#character-filter').inputValue(), 'Levi');
        assert.deepEqual(await gallery.locator('.character-card').evaluateAll(cards => cards.map(card => card.dataset.character)), matches);
        assert.ok(Math.abs(await gallery.evaluate(() => scrollY) - scroll) < 2, 'closing preserves gallery scroll');
      }
    });

    await test('the phone gallery starts higher, uses full-width search and keeps expansion beside the heading', async () => {
      for (const { width, height } of [{ width: 390, height: 844 }, { width: 320, height: 740 }]) {
        const phone = await createPage({ width, height });
        await view(phone, 'characters');
        const first = await phone.locator('.character-card').first().boundingBox();
        assert.ok(first.y < 330, `${width}px: first card starts at ${Math.round(first.y)}px`);
        const visible = await phone.locator('.character-card').evaluateAll(cards => cards.filter(card => {
          const rect = card.getBoundingClientRect();
          const navTop = document.querySelector('.primary-nav').getBoundingClientRect().top;
          return rect.top >= 0 && rect.bottom <= navTop;
        }).length);
        assert.ok(visible >= (width === 390 ? 6 : 4), `${width}px: only ${visible} complete cards are visible`);
        const clipped = await phone.locator('.character-name').evaluateAll(names => names.filter(name => {
          const box = name.getBoundingClientRect();
          const card = name.closest('.character-card').getBoundingClientRect();
          return name.scrollWidth > name.clientWidth + 1 || box.left < card.left || box.right > card.right || box.top < card.top || box.bottom > card.bottom;
        }).map(name => name.textContent));
        assert.deepEqual(clipped, [], 'character names remain readable inside their cards');
        assert.equal(await phone.locator('#expand-gallery').evaluate(element => element.parentElement.id), 'mobile-gallery-action');
        const title = await phone.locator('.page-title-row h1').boundingBox();
        const expansion = await phone.locator('#expand-gallery').boundingBox();
        assert.ok(expansion.y < title.y + title.height && title.y < expansion.y + expansion.height, 'expansion shares the title row');
        const filter = await phone.locator('#character-filter').boundingBox();
        const toolbar = await phone.locator('.gallery-actions').boundingBox();
        assert.ok(filter.width > toolbar.width * .95, 'gallery search fills its row');
        assert.equal((await phone.locator('label[for="episode-select"]').innerText()).trim(), 'Viewing episode');
        await assertNoHorizontalOverflow(phone, `${width}px compact gallery`);
        await phone.locator('#expand-gallery').focus();
        await phone.setViewportSize({ width: 1440, height: 1040 });
        await phone.waitForFunction(() => document.querySelector('#expand-gallery').parentElement.classList.contains('gallery-actions'));
        assert.equal(await phone.locator('#expand-gallery').evaluate(element => element === document.activeElement), true, 'moving expansion to desktop retains focus');
        await phone.setViewportSize({ width, height });
        await phone.waitForFunction(() => document.querySelector('#expand-gallery').parentElement.id === 'mobile-gallery-action');
        assert.equal(await phone.locator('#expand-gallery').evaluate(element => element === document.activeElement), true, 'moving expansion back to the phone heading retains focus');
        assert.equal(await phone.locator('#expand-gallery').count(), 1, 'breakpoint changes move the existing button');
      }
    });

    await test('expanded gallery keeps filters, contains focus, restores the tab and respects episode limits', async () => {
      for (const viewport of [{ width: 1440, height: 1040 }, { width: 390, height: 844 }]) {
        const gallery = await createPage(viewport);
        await view(gallery, 'characters');
        const normalColumns = await gallery.locator('.character-grid').first().evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
        await gallery.locator('#expand-gallery').click();
        assert.equal(await gallery.locator('#expanded-gallery-dialog').evaluate(dialog => dialog.open), true);
        assert.equal(await gallery.locator('#characters-view').evaluate(element => element.parentElement.id), 'expanded-gallery-slot');
        assert.equal(await gallery.locator('#characters-view').count(), 1, 'reuse the existing gallery');
        const expandedColumns = await gallery.locator('.character-grid').first().evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
        if (viewport.width > 760) assert.ok(expandedColumns > normalColumns, 'expanding should fit more columns');
        await gallery.locator('#close-expanded-gallery').focus();
        await gallery.keyboard.press('Tab');
        assert.equal(await gallery.evaluate(() => Boolean(document.activeElement.closest('#expanded-gallery-dialog'))), true, 'keyboard navigation stays in the dialog');
        await gallery.locator('#episode-select').evaluate(element => element.focus());
        assert.equal(await gallery.evaluate(() => Boolean(document.activeElement.closest('#expanded-gallery-dialog'))), true, 'the background is inert while expanded');
        await gallery.locator('#character-filter').fill('Levi');
        const matches = await gallery.locator('.character-card').evaluateAll(cards => cards.map(card => card.dataset.character));
        assert.ok(matches.includes('levi'), 'search includes the requested character');
        assert.ok(matches.length < data.characters.length - 1, 'search narrows the gallery');
        await gallery.keyboard.press('Escape');
        assert.equal(await gallery.locator('#characters-view').evaluate(element => element.parentElement.tagName), 'MAIN');
        assert.equal(await gallery.locator('#character-filter').inputValue(), 'Levi');
        assert.deepEqual(await gallery.locator('.character-card').evaluateAll(cards => cards.map(card => card.dataset.character)), matches, 'returning keeps the same search results');
        assert.equal(await gallery.locator('#expand-gallery').evaluate(element => element === document.activeElement), true);
        assert.equal(await gallery.locator('body').evaluate(element => element.classList.contains('gallery-expanded')), false);
        await gallery.locator('#character-filter').fill('');
        await episode(gallery, lastPinnedEpisode);
        await gallery.locator('#expand-gallery').click();
        // Pick an episode with a real recorded position; a later episode can be entirely unpinned.
        const pinned = pinnedPersonAt(lastPinnedEpisode);
        await characterDetails(gallery, pinned.id);
        assert.equal(await gallery.locator('#expanded-gallery-dialog').evaluate(dialog => dialog.open), true, 'details open above the expanded gallery');
        await gallery.keyboard.press('Escape');
        assert.equal(await gallery.locator('#expanded-gallery-dialog').evaluate(dialog => dialog.open), true, 'closing details keeps the gallery expanded');
        assert.equal(await gallery.locator(`#character-${pinned.id} .character-card-button`).evaluate(element => element === document.activeElement), true);
        await characterDetails(gallery, pinned.id);
        const placeLink = gallery.locator('#character-detail-body [data-open-place]');
        const id = await placeLink.getAttribute('data-open-place');
        await placeLink.click();
        assert.equal(await gallery.locator('#expanded-gallery-dialog').evaluate(dialog => dialog.open), false);
        assert.equal(await gallery.locator('#character-detail-dialog').evaluate(dialog => dialog.open), false);
        assert.equal(await gallery.locator('#map-view').isVisible(), true);
        assert.equal(await gallery.locator('.map-marker.selected').getAttribute('data-location'), id);
        await setCutoff(gallery, 1);
        await view(gallery, 'characters');
        await gallery.locator('#expand-gallery').click();
        assert.equal(await gallery.locator('.character-card').count(), data.characters.filter(character => character.type !== 'group' && character.firstEpisode <= 1).length);
        assert.equal(await gallery.locator('#expanded-gallery-episode').innerText(), `Episode 1 · ${data.episodeTitles[0].title}`);
        await assertNoHorizontalOverflow(gallery, 'expanded early-episode gallery');
        await gallery.locator('#close-expanded-gallery').click();
        assert.equal(await gallery.locator('#expanded-gallery-dialog').evaluate(dialog => dialog.open), false);
        assert.equal(await gallery.locator('#expand-gallery').evaluate(element => element === document.activeElement), true);
      }
    });

    await test('expanded map grows on desktop and phone, preserves exploration and restores focus', async () => {
      for (const viewport of [{ width: 1440, height: 1040 }, { width: 390, height: 844 }]) {
        const expanded = await createPage(viewport);
        await expanded.locator('[data-map-extent="walls"]').click();
        await expanded.locator('#zoom-in').click();
        const selected = await expanded.locator('.map-marker.selected').getAttribute('data-location');
        const camera = await expanded.locator('#map-camera').getAttribute('transform');
        const normal = await expanded.locator('#map-stage').boundingBox();
        const normalScale = await expanded.locator('#atlas-map').evaluate(element => element.getScreenCTM().a);
        await expanded.locator('#expand-map').click();
        await expanded.waitForFunction(() => document.querySelector('#expanded-map-dialog').open);
        const large = await expanded.locator('#map-stage').boundingBox();
        assert.ok(large.width * large.height > normal.width * normal.height * 1.5,
          `${viewport.width}px: expanded map area grew by ${(large.width * large.height / (normal.width * normal.height)).toFixed(3)}; it should exceed 1.5`);
        const largeScale = await expanded.locator('#atlas-map').evaluate(element => element.getScreenCTM().a);
        assert.ok(largeScale > normalScale * 1.25, `${viewport.width}px: expanded drawing scale grew by ${(largeScale / normalScale).toFixed(3)}; it should exceed 1.25`);
        assert.equal(await expanded.locator('#map-camera').getAttribute('transform'), camera);
        assert.equal(await expanded.locator('.map-marker.selected').getAttribute('data-location'), selected);
        assert.equal(await expanded.locator('#expanded-map-episode').innerText(), `Episode ${MAX} · ${data.episodeTitles[MAX - 1].title}`);
        await expanded.locator('#zoom-in').click();
        const largerCamera = await expanded.locator('#map-camera').getAttribute('transform');
        assert.notEqual(largerCamera, camera, 'zoom does not work inside the expanded map');
        await expanded.keyboard.press('Escape');
        await expanded.waitForFunction(() => !document.querySelector('#expanded-map-dialog').open && document.querySelector('#map-stage').parentElement.classList.contains('atlas-body'));
        assert.equal(await expanded.locator('#map-camera').getAttribute('transform'), largerCamera);
        assert.equal(await expanded.locator('#expand-map').evaluate(element => element === document.activeElement), true);
        assert.equal(await expanded.locator('body').evaluate(element => element.classList.contains('map-expanded')), false);
        await expanded.locator('#expand-map').click();
        await expanded.locator('#close-expanded-map').click();
        await expanded.waitForFunction(() => document.querySelector('#map-stage').parentElement.classList.contains('atlas-body'));
        await assertNoHorizontalOverflow(expanded, 'restored map');
      }
    });

    await test('expanded map keeps episode controls, search, layers and place details usable', async () => {
      for (const viewport of [{ width: 1440, height: 1040 }, { width: 390, height: 844 }]) {
        const expanded = await createPage(viewport);
        await expanded.locator('#expand-map').click();
        for (const id of ['episode-select', 'location-search', 'layer-groups', 'location-panel']) {
          assert.equal(await expanded.locator(`#${id}`).count(), 1);
          assert.equal(await expanded.locator(`#${id}`).evaluate(element => Boolean(element.closest('#expanded-map-dialog'))), true);
        }
        await chooseLocation(expanded, 'Trost', 'trost');
        if (viewport.width < 761) {
          assert.match(await expanded.locator('#place-peek').innerText(), /Trost/);
          await expanded.locator('#place-peek').click();
          assert.equal(await expanded.locator('#place-details').isVisible(), true);
          await expanded.keyboard.press('Escape');
          assert.equal(await expanded.locator('#place-details').isVisible(), false);
          assert.equal(await expanded.locator('#expanded-map-dialog').evaluate(dialog => dialog.open), true);
        } else {
          assert.equal(await expanded.locator('#location-panel h2').innerText(), data.locations.find(location => location.id === 'trost').name);
          const width = (await expanded.locator('#map-stage').boundingBox()).width;
          const camera = await expanded.locator('#map-camera').getAttribute('transform');
          await expanded.locator('#map-panel-toggle').click();
          assert.ok((await expanded.locator('#map-stage').boundingBox()).width > width);
          assert.equal(await expanded.locator('#map-camera').getAttribute('transform'), camera);
          await expanded.locator('#map-panel-toggle').click();
        }
        await expanded.locator('#map-options summary').click();
        await expanded.locator('#layer-groups').uncheck();
        assert.equal(await expanded.locator('#location-markers').evaluate(element => element.classList.contains('hide-people')), true);
        await expanded.locator('button[data-map-style="night"]').click();
        assert.equal(await expanded.locator('html').getAttribute('data-map-style'), 'night');
        await expanded.keyboard.press('Escape');
        assert.equal(await expanded.locator('#map-options').evaluate(element => element.open), false);
        assert.equal(await expanded.locator('#expanded-map-dialog').evaluate(dialog => dialog.open), true);
        await expanded.locator('#close-expanded-map').focus();
        await expanded.keyboard.press('/');
        assert.equal(await expanded.locator('#location-search').evaluate(element => element === document.activeElement), true);
        await expanded.locator('#location-search').fill('Trost');
        await expanded.keyboard.press('Escape');
        assert.equal(await expanded.locator('#search-results').isVisible(), false);
        assert.equal(await expanded.locator('#location-search').inputValue(), 'Trost');
        assert.equal(await expanded.locator('#expanded-map-dialog').evaluate(dialog => dialog.open), true);
        await expanded.locator('#location-search').fill('');
        await expanded.locator('#close-expanded-map').focus();
        await expanded.keyboard.press('[');
        assert.equal(await expanded.locator('#episode-select').inputValue(), String(milestones.at(-2)));
        await expanded.locator('#close-expanded-map').click();
        assert.equal(await expanded.locator('#location-panel').evaluate(element => element.parentElement.classList.contains('atlas-body')), true);
        assert.equal(await expanded.locator('#episode-select').evaluate(element => Boolean(element.closest('.page-heading'))), true);
        assert.equal(await expanded.locator('#map-style-switch').evaluate(element => Boolean(element.closest('.map-toolbar'))), true);
        await assertNoHorizontalOverflow(expanded, 'restored map controls');
      }
    });

    await test('an expanded map applies a lowered cutoff from another tab immediately', async () => {
      const expanded = await createPage();
      const other = await createPage(undefined, undefined, expanded.context());
      await expanded.locator('#expand-map').click();
      await expanded.locator('#show-changes').click();
      await other.evaluate(key => localStorage.setItem(key, JSON.stringify({ cutoff: 1 })), storageKey);
      await expanded.waitForFunction(() => document.querySelector('#episode-select').value === '1');
      assert.equal(await expanded.locator('#episode-select option').count(), 1);
      assert.equal(await expanded.locator('#expanded-map-dialog').evaluate(dialog => dialog.open), true);
      assert.equal(await expanded.locator('#location-markers .map-marker').count(), data.locations.filter(location => location.firstEpisode <= 1).length);
      const copy = await expanded.locator('#expanded-map-dialog').innerText();
      for (const name of laterNames) assert.ok(!copy.includes(name), `later name ${name} leaked into the expanded map`);
      await expanded.locator('#close-expanded-map').click();
    });

    await test('zoom reveals detail and the overview tracks the visible area and resets', async () => {
      const zoomed = await createPage();
      await zoomed.locator('[data-map-extent="walls"]').click();
      await zoomed.locator('#zoom-out').click();
      const minor = zoomed.locator('.map-marker.minor:not(.selected):not(.now):not(.changed)').first();
      assert.equal(await minor.locator('.marker-label').isVisible(), false);
      await minor.focus();
      assert.equal(await minor.locator('.marker-label').isVisible(), true, 'keyboard focus still exposes a minor place name');
      await zoomed.locator('#reset-map').click();
      const selected = await zoomed.locator('.map-marker.selected').getAttribute('data-location');
      await zoomed.locator('#zoom-in').click();
      await zoomed.locator('#zoom-in').click();
      assert.equal(await zoomed.locator('#map-overview').isVisible(), true);
      const rect = await zoomed.locator('#overview-viewport').evaluate(element => ({ x: Number(element.getAttribute('x')), width: Number(element.getAttribute('width')), height: Number(element.getAttribute('height')) }));
      assert.ok(rect.width > 0 && rect.width < 960 && rect.height > 0 && rect.height < 832);
      await zoomed.locator('#atlas-map').focus();
      await zoomed.keyboard.press('ArrowRight');
      assert.notEqual(Number(await zoomed.locator('#overview-viewport').getAttribute('x')), rect.x);
      assert.ok(await zoomed.locator('.marker-caption').evaluateAll(elements => elements.some(element => getComputedStyle(element).display !== 'none' && /Episodes? \d/.test(element.textContent))));
      await zoomed.locator('#map-overview').click();
      assert.equal(await zoomed.locator('#zoom-level').innerText(), '100%');
      assert.equal(await zoomed.locator('#map-overview').isVisible(), false);
      assert.equal(await zoomed.locator('#atlas-map').evaluate(element => element === document.activeElement), true, 'reset returns keyboard focus to the map');
      assert.equal(await zoomed.locator('.map-marker.selected').getAttribute('data-location'), selected);
    });

    await test('episode changes show recorded events, new places and status without inventing pins', async () => {
      const changed = await createPage();
      await changed.locator('#show-changes').click();
      const pinned = data.episodes.find(item => item.number === MAX).events.filter(event => event.locationId);
      for (const event of pinned) assert.equal(await changed.locator(`[data-change-event="${event.id}"]`).count(), 1);
      // A later episode can happen entirely beyond this map. Exercise a mapped event
      // without requiring the latest recap to invent a location to satisfy this check.
      const latestMapped = data.episodes.findLast(item => item.events.some(event => event.locationId));
      await episode(changed, latestMapped.number);
      const first = changed.locator('[data-change-place]').first();
      const id = await first.getAttribute('data-change-place');
      await first.click();
      assert.equal(await changed.locator('.map-marker.selected').getAttribute('data-location'), id);
      await episode(changed, 2);
      assert.match(await changed.locator('#episode-changes-panel').innerText(), /Territory changed/);
      assert.equal(await changed.locator('#territory-art').evaluate(element => element.classList.contains('changed-territory')), true);
      const unpinned = data.episodes.find(item => item.events.some(event => !event.locationId));
      await episode(changed, unpinned.number);
      assert.ok(await changed.locator('.change-unpinned').count() > 0);
      assert.equal(await changed.locator('#location-markers .map-marker').count(), (await expectedMapLocations(changed, unpinned.number)).length);
      const empty = Array.from({ length: MAX }, (_, index) => index + 1).find(number => !data.episodes.some(item => item.number === number) && !data.locations.some(item => item.firstEpisode === number) && !(data.status || []).some(item => item.from === number));
      if (empty !== undefined) {
        await episode(changed, empty);
        assert.match(await changed.locator('#episode-changes-panel').innerText(), /No changes are recorded/);
      } else {
        assert.equal(data.episodes.length, MAX, 'every available episode has recorded coverage');
      }
      await changed.locator('#show-changes').click();
      assert.equal(await changed.locator('#episode-changes-panel').isVisible(), false);
    });

    await test('phone place sheet supports taps, swipes and scrolling while leaving map space', async () => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
      contexts.push(ctx);
      const phone = await createPage(undefined, undefined, ctx);
      await phone.locator('#expand-map').tap();
      assert.equal(await phone.locator('#place-details').isVisible(), false);
      await phone.locator('#place-peek').tap();
      assert.equal(await phone.locator('#place-details').isVisible(), true);
      const sizes = await phone.evaluate(() => ({ sheet: document.querySelector('#location-panel').clientHeight, area: document.querySelector('#expanded-map-slot').clientHeight }));
      assert.ok(sizes.sheet < sizes.area * .7, 'the sheet must leave map space');
      await phone.locator('#place-details').evaluate(element => { element.scrollTop = 250; });
      assert.ok(await phone.locator('#place-details').evaluate(element => element.scrollTop > 0));
      await phone.locator('#place-peek').tap();
      const cdp = await ctx.newCDPSession(phone);
      async function swipe(delta) {
        const box = await phone.locator('#place-peek').boundingBox();
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + delta }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      await swipe(-65);
      assert.equal(await phone.locator('#place-details').isVisible(), true);
      await swipe(65);
      assert.equal(await phone.locator('#place-details').isVisible(), false);
      await phone.locator('#place-peek').tap();
      assert.equal(await phone.locator('#place-details').isVisible(), true, 'a tap still works after swiping');
      await assertNoHorizontalOverflow(phone, 'phone place sheet');
    });

    await test('opening a character from the expanded map restores the atlas and shows their card', async () => {
      const expanded = await createPage();
      await episode(expanded, lastPinnedEpisode);
      const character = pinnedPersonAt(lastPinnedEpisode);
      const position = (character.positions || []).filter(position => position.episode <= lastPinnedEpisode).sort((a, b) => b.episode - a.episode)[0];
      const location = data.locations.find(location => location.id === position.locationId);
      await chooseLocation(expanded, location.name, location.id);
      await expanded.locator('#expand-map').click();
      const id = character.id;
      const portrait = expanded.locator(`.map-person[data-person="${id}"]`);
      await portrait.click();
      await expanded.locator('#person-card [data-open-character]').click();
      assert.equal(await expanded.locator('#expanded-map-dialog').evaluate(element => element.open), false);
      assert.equal(await expanded.locator('#characters-view').isVisible(), true);
      assert.equal(await expanded.locator('#character-detail-dialog').evaluate(dialog => dialog.open), true);
      assert.equal(await expanded.locator('#character-detail-title').innerText(), at(data.characters.find(character => character.id === id).name, lastPinnedEpisode).text);
      await closeCharacterDetails(expanded);
      assert.equal(await expanded.locator(`#character-${id} .character-card-button`).evaluate(element => element === document.activeElement), true);
      assert.equal(await expanded.locator('#map-stage').evaluate(element => element.parentElement.classList.contains('atlas-body')), true);
    });

    await test('map style follows the system preference for fresh and legacy saved sessions', async () => {
      for (const colorScheme of ['light', 'dark']) {
        for (const legacy of [false, true]) {
          const ctx = await browser.newContext({ viewport: { width: 1440, height: 1040 }, colorScheme });
          contexts.push(ctx);
          const styled = await createPage(undefined, legacy ? () => {
            localStorage.setItem('scout-atlas:v1', JSON.stringify({ cutoff: 47, viewing: 13, selected: 'shiganshina', notes: { '13:shiganshina': 'A note from before map styles' } }));
          } : undefined, ctx);
          const expected = colorScheme === 'light' ? 'parchment' : 'night';
          assert.equal(await styled.locator('html').getAttribute('data-map-style'), expected, `${colorScheme}, legacy=${legacy}`);
          assert.equal(await styled.locator(`button[data-map-style="${expected}"]`).getAttribute('aria-pressed'), 'true');
          assert.equal(await styled.locator(`button[data-map-style="${expected === 'night' ? 'parchment' : 'night'}"]`).getAttribute('aria-pressed'), 'false');
          if (legacy) {
            assert.equal(await styled.locator('#episode-select').inputValue(), '13');
            assert.equal(await styled.locator('.map-marker.selected').getAttribute('data-location'), 'shiganshina');
            assert.deepEqual(await styled.evaluate(key => JSON.parse(localStorage.getItem(key)).notes, storageKey), { '13:shiganshina': 'A note from before map styles' });
          }
        }
      }
    });

    await test('changing map style preserves exploration, and the choice survives reload', async () => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 1040 }, colorScheme: 'light' });
      contexts.push(ctx);
      const styled = await createPage(undefined, undefined, ctx);
      await episode(styled, 13);
      await chooseLocation(styled, 'Shiganshina', 'shiganshina');
      await styled.locator('#zoom-in').click();
      await setLayer(styled, 'groups', false);
      const camera = await styled.locator('#map-camera').getAttribute('transform');
      const saved = await styled.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
      for (const style of ['night', 'parchment', 'night']) {
        await styled.locator(`button[data-map-style="${style}"]`).focus();
        await styled.keyboard.press('Enter');
        assert.equal(await styled.locator('html').getAttribute('data-map-style'), style);
        assert.equal(await styled.locator(`button[data-map-style="${style}"]`).getAttribute('aria-pressed'), 'true');
        assert.equal(await styled.locator('#map-camera').getAttribute('transform'), camera, 'changing style moved the camera');
        assert.equal(await styled.locator('#episode-select').inputValue(), '13');
        assert.equal(await styled.locator('.map-marker.selected').getAttribute('data-location'), 'shiganshina');
        const current = await styled.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
        assert.deepEqual(current, { ...saved, mapStyle: style }, 'changing style altered other saved state');
      }
      await styled.reload({ waitUntil: 'load' });
      assert.equal(await styled.locator('html').getAttribute('data-map-style'), 'night', 'saved style must override the light system preference');
      assert.equal(await styled.locator('button[data-map-style="night"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await styled.locator('#episode-select').inputValue(), '13');
      assert.equal(await styled.locator('.map-marker.selected').getAttribute('data-location'), 'shiganshina');
      assert.equal(await styled.locator('#layer-groups').isChecked(), false);
    });

    await test('both map styles remain reachable and work by touch on a phone', async () => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark' });
      contexts.push(ctx);
      const mobile = await createPage(undefined, undefined, ctx);
      for (const style of ['parchment', 'night']) {
        const button = mobile.locator(`button[data-map-style="${style}"]`);
        assert.equal(await button.isVisible(), true);
        const bounds = await button.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391, `${style} control is outside the phone viewport`);
        await button.tap();
        assert.equal(await mobile.locator('html').getAttribute('data-map-style'), style);
        assert.equal(await button.getAttribute('aria-pressed'), 'true');
        await assertNoHorizontalOverflow(mobile, `mobile ${style} map`);
      }
    });

    await test('episode 1 shows nothing the atlas introduces later', async () => {
      await episode(page, 1);
      assert.deepEqual(await page.locator('#location-markers [data-location]').evaluateAll(items => items.map(item => item.dataset.location)), ['shiganshina']);
      const ui = await readUi(page);
      for (const name of laterNames) assert.ok(!ui.includes(name), `Later name leaked at episode 1: ${name}`);
      assert.equal(await page.locator('#timeline-track [data-episode]').count(), 1);
      for (const query of laterNames) {
        await page.locator('#location-search').fill(query);
        assert.equal(await page.locator('#search-results button').count(), 0, `Search reveals ${query}`);
      }
      await page.locator('#location-search').fill('');
      await episode(page, MAX);
    });

    await test('names and identities change only at their episode', async () => {
      const historia = data.characters.find(c => c.id === 'historia');
      await view(page, 'characters');
      for (const [n, other] of [[29, 30], [30, 40], [40, MAX]]) {
        await episode(page, n);
        const card = await page.locator('#character-historia .character-name').innerText();
        assert.equal(card, at(historia.name, n).text);
        if (other !== MAX) assert.ok(!(await readUi(page)).includes(at(historia.name, other).text), `${at(historia.name, other).text} shown at E${n}`);
      }
      for (const titan of data.characters.filter(c => c.revealedAs)) {
        const who = data.characters.find(c => c.id === titan.revealedAs.id);
        await episode(page, titan.revealedAs.episode - 1);
        await characterDetails(page, titan.id);
        assert.equal(await page.locator('#character-detail-body .reveal-line').count(), 0, `${titan.id} revealed early`);
        await closeCharacterDetails(page);
        await episode(page, titan.revealedAs.episode);
        await characterDetails(page, titan.id);
        assert.match(await page.locator('#character-detail-body .reveal-line').innerText(), new RegExp(at(who.name, titan.revealedAs.episode).text));
        await closeCharacterDetails(page);
      }
      await view(page, 'map');
      await episode(page, MAX);
    });

    await test('identity links open the related character in the same details panel', async () => {
      const linked = await createPage();
      await episode(linked, 31);
      await view(linked, 'characters');
      await characterDetails(linked, 'armored');
      await linked.locator('#character-detail-body [data-open-character="reiner"]').click();
      assert.equal(await linked.locator('#character-detail-dialog').evaluate(dialog => dialog.open), true);
      assert.equal(await linked.locator('#character-detail-title').innerText(), at(data.characters.find(character => character.id === 'reiner').name, 31).text);
      assert.equal(await linked.locator('#character-detail-dialog').count(), 1, 'related people reuse one panel');
      assert.equal(await linked.evaluate(() => Boolean(document.activeElement.closest('#character-detail-dialog'))), true);
      await closeCharacterDetails(linked);
      assert.equal(await linked.locator('#characters-view').isVisible(), true);
    });

    await test('Season 3 places and people stay hidden at episode 37', async () => {
      await episode(page, 37);
      const later = [...data.locations.filter(l => l.firstEpisode > 37).map(l => l.name), ...data.characters.filter(c => c.firstEpisode > 37).map(c => c.name[0].text)];
      assert.ok(later.length >= 5, 'expected Season 3 content in the data');
      const ui = await readUi(page);
      for (const name of later) assert.ok(!ui.includes(name), `${name} visible at E37`);
      await page.locator('#location-search').fill('Kenny');
      assert.equal(await page.locator('#search-results button').count(), 0);
      await page.locator('#location-search').fill('');
      await episode(page, MAX);
    });

    if (data.seasons.some(season => season.season === 4)) {
      await test('Season 4 is available through the ceiling and stays hidden below episode 60', async () => {
        const bounded = await createPage();
        const season = data.seasons.find(item => item.season === 4);
        assert.equal(season.first, 60);
        const fourth = bounded.locator('#episode-select optgroup').last();
        assert.deepEqual(await fourth.locator('option').evaluateAll(options => options.map(option => Number(option.value))), Array.from({ length: MAX - 59 }, (_, index) => index + 60));
        await setCutoff(bounded, 59);
        assert.equal(await bounded.locator('#episode-select option').count(), 59);
        assert.equal(await bounded.locator('#episode-select optgroup').count(), 3);
        assert.deepEqual(await bounded.locator('#location-markers [data-location]').evaluateAll(items => items.map(item => item.dataset.location)), (await expectedMapLocations(bounded, 59)).map(location => location.id));
        await view(bounded, 'characters');
        assert.deepEqual((await bounded.locator('.character-card').evaluateAll(items => items.map(item => item.dataset.character))).sort(), data.characters.filter(character => character.type !== 'group' && character.firstEpisode <= 59).map(character => character.id).sort());
        const later = data.characters.filter(character => character.firstEpisode > 59);
        assert.ok(later.length > 0, 'Season 4 introduces a cast in the gallery');
        const text = await readUi(bounded);
        for (const character of later) assert.ok(!text.includes(at(character.name, character.firstEpisode).text), `${character.id} appears before Season 4`);
        await view(bounded, 'map');
        for (const character of later) {
          await bounded.locator('#location-search').fill(at(character.name, character.firstEpisode).text);
          assert.equal(await bounded.locator(`[data-open-character="${character.id}"]`).count(), 0, `${character.id} is searchable before introduction`);
        }
        await bounded.locator('#location-search').fill('');
        await setCutoff(bounded, MAX);
        await episode(bounded, MAX);
        await view(bounded, 'recap');
        assert.equal(await bounded.locator('.recap-intro h2').innerText(), data.episodeTitles[MAX - 1].title);
        assert.deepEqual(await bounded.locator('#recap-view .recap-meta').evaluateAll(items => [...new Set(items.map(item => Number(/Episode (\d+)/.exec(item.textContent)[1])))]), [...milestones].reverse());
      });

      await test('Season 4 cards and detail panels follow every character update and clear stale map positions', async () => {
        const cast = await createPage();
        await view(cast, 'characters');
        for (let number = 59; number <= MAX; number++) {
          await episode(cast, number);
          const cards = await cast.locator('.character-card').evaluateAll(items => items.map(item => ({
            id: item.dataset.character,
            name: item.querySelector('.character-name').textContent,
            classes: [...item.classList]
          })));
          const expected = data.characters.filter(character => character.type !== 'group' && character.firstEpisode <= number);
          assert.deepEqual(cards.map(card => card.id).sort(), expected.map(character => character.id).sort(), `E${number} cast`);
          for (const character of expected) {
            const card = cards.find(item => item.id === character.id);
            assert.equal(card.name, at(character.name, number).text, `E${number} ${character.id} name`);
            assert.ok(card.classes.includes(`faction-${at(character.faction, number).key}`), `E${number} ${character.id} faction`);
            const changes = new Set([59, MAX, character.firstEpisode,
              ...character.name.map(item => item.from), ...character.role.map(item => item.from),
              ...character.faction.map(item => item.from), ...(character.notes || []).map(item => item.episode),
              ...(character.positions || []).map(item => item.episode)]);
            if (changes.has(number)) {
              const body = await characterDetails(cast, character.id);
              assert.equal(await cast.locator('#character-detail-title').innerText(), at(character.name, number).text, `E${number} ${character.id} detail name`);
              assert.equal(await body.locator('.character-description').innerText(), at(character.role, number).text, `E${number} ${character.id} role`);
              const noteEpisodes = await body.locator('.note-episode').evaluateAll(notes => notes.map(note => Number(note.textContent.slice(1))));
              assert.deepEqual(noteEpisodes, (character.notes || []).filter(note => note.episode <= number).map(note => note.episode).sort((a, b) => b - a), `E${number} ${character.id} notes`);
              const position = (character.positions || []).filter(item => item.episode <= number).sort((a, b) => b.episode - a.episode)[0];
              const place = await body.locator('[data-open-place]').count() ? await body.locator('[data-open-place]').getAttribute('data-open-place') : null;
              assert.equal(place, position?.locationId || null, `E${number} ${character.id} last place`);
              await closeCharacterDetails(cast);
            }
          }
          const unpinned = expected.filter(character => {
            const position = (character.positions || []).filter(item => item.episode <= number).sort((a, b) => b.episode - a.episode)[0];
            return position && position.locationId === null;
          });
          for (const character of unpinned) assert.equal(await cast.locator(`#location-markers [data-person="${character.id}"]`).count(), 0, `E${number} ${character.id} keeps a stale portrait`);
        }
        await assertNoHorizontalOverflow(cast, 'Season 4 gallery');
      });

      await test('another tab lowering the episode limit refreshes or closes open character details safely', async () => {
        const drawer = await createPage();
        const other = await createPage(undefined, undefined, drawer.context());
        await view(drawer, 'characters');
        await characterDetails(drawer, 'eren');
        await other.evaluate(key => localStorage.setItem(key, JSON.stringify({ cutoff: 13, edition: window.ATLAS_DATA.maxEpisode })), storageKey);
        await drawer.waitForFunction(() => document.querySelector('#episode-select').value === '13');
        if (await drawer.locator('#character-detail-dialog').evaluate(dialog => dialog.open)) {
          assert.equal(await drawer.locator('#character-detail-body .character-description').innerText(), at(data.characters.find(character => character.id === 'eren').role, 13).text);
          assert.ok((await drawer.locator('#character-detail-body .note-episode').evaluateAll(notes => notes.map(note => Number(note.textContent.slice(1))))).every(number => number <= 13));
          await closeCharacterDetails(drawer);
        }
        await setCutoff(drawer, MAX);
        await episode(drawer, MAX);
        await drawer.locator('#expand-gallery').click();
        const introduced = data.characters.find(character => character.type !== 'group' && character.firstEpisode >= 60);
        await characterDetails(drawer, introduced.id);
        await other.evaluate(key => localStorage.setItem(key, JSON.stringify({ cutoff: 59, edition: window.ATLAS_DATA.maxEpisode })), storageKey);
        await drawer.waitForFunction(() => document.querySelector('#episode-select').value === '59');
        assert.equal(await drawer.locator('#character-detail-dialog').evaluate(dialog => dialog.open), false, 'a character no longer introduced must close');
        assert.equal(await drawer.locator(`#character-${introduced.id}`).count(), 0);
        assert.equal(await drawer.locator('#expanded-gallery-dialog').evaluate(dialog => dialog.open), true, 'the underlying expanded gallery remains available');
        assert.equal(await drawer.evaluate(() => Boolean(document.activeElement.closest('#expanded-gallery-dialog'))), true, 'focus stays in the surviving modal');
        await drawer.locator('#close-expanded-gallery').click();
      });

      await test('an unpinned Season 4 event can be found without inventing a map pin', async () => {
        const searched = await createPage();
        const entry = data.episodes.findLast(item => item.number >= 60 && item.events.some(event => !event.locationId && event.placeName));
        assert.ok(entry, 'Season 4 records named settings beyond the schematic map');
        const event = entry.events.find(item => !item.locationId && item.placeName);
        await episode(searched, entry.number);
        const markerCount = await searched.locator('#location-markers .map-marker').count();
        await searched.locator('#expand-map').click();
        await searched.locator('#location-search').fill(event.title);
        const result = searched.locator(`#search-results [data-open-event="${event.id}"]`);
        assert.equal(await result.count(), 1);
        assert.ok((await result.innerText()).includes(event.placeName), 'search names the recorded setting');
        await result.click();
        assert.equal(await searched.locator('#expanded-map-dialog').evaluate(dialog => dialog.open), false);
        assert.equal(await searched.locator('#recap-view').isVisible(), true);
        const card = searched.locator(`#recap-${event.id}`);
        assert.equal(await card.evaluate(element => element === document.activeElement), true, 'search places focus on the matching recap');
        assert.equal(await card.locator('.unpinned').count(), 1);
        assert.equal(await card.locator('[data-open-event]').count(), 0, 'the off-map setting has no fabricated map link');
        assert.equal(await searched.locator('#location-markers .map-marker').count(), markerCount);
        await assertNoHorizontalOverflow(searched, 'unpinned event search');
      });

      await test('the map marks former wall boundaries from episode 80 and restores earlier walls', async () => {
        const historical = await createPage();
        await historical.locator('[data-map-extent="walls"]').click();
        await historical.locator('#map-legend summary').click();
        for (const number of [79, 80, 79]) {
          await episode(historical, number);
          const fallen = number >= 80;
          assert.equal(await historical.locator('#atlas-map').evaluate(element => element.classList.contains('former-walls')), fallen, `E${number} main map`);
          assert.equal(await historical.locator('#map-overview').evaluate(element => element.classList.contains('former-walls')), fallen, `E${number} overview`);
          assert.equal(await historical.locator('#map-title-text').innerText(), fallen ? 'Former walled territory' : 'The walled territory');
          assert.equal(await historical.locator('#wall-status-note').isVisible(), fallen);
          for (const name of Object.keys(data.mapGeometry.wallRadiusKm)) {
            const wall = historical.locator(`#wall-geometry [data-wall="${name}"]`).nth(1);
            assert.equal(await wall.evaluate(element => getComputedStyle(element).strokeDasharray !== 'none'), fallen, `E${number} ${name} boundary style`);
          }
        }
      });
    }

    await test('unpinned events and whereabouts are not drawn on the map', async () => {
      await episode(page, 39);
      await view(page, 'recap');
      assert.ok(await page.locator('#recap-view .unpinned').count() >= 2, 'E39 events should be listed as not pinned');
      await view(page, 'map');
      const labels = await page.locator('#location-markers [data-location]').evaluateAll(items => items.map(item => item.getAttribute('aria-label')).join(' '));
      assert.ok(!labels.includes('Eren Yeager'), 'Eren must not keep a pin while his whereabouts are unknown');
      await view(page, 'characters');
      await characterDetails(page, 'eren');
      assert.match(await page.locator('#character-detail-body footer').innerText(), /does not place/);
      await closeCharacterDetails(page);
      await view(page, 'map');
      await episode(page, MAX);
    });

    await test('every portrait sits nearer its own pin than any other', async () => {
      try { for (const n of milestones) {
        await episode(page, n);
        const bad = await page.locator('#location-markers').evaluate(root => {
          const centre = el => { const r = el.getBoundingClientRect(); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2]; };
          const rings = [...root.querySelectorAll('.map-marker')].filter(m => m.getBoundingClientRect().width > 0).map(m => [m.dataset.location, centre(m.querySelector('.marker-ring'))]);
          return [...root.querySelectorAll('.map-person')].filter(chip => chip.getBoundingClientRect().width > 0).flatMap(chip => {
            const own = chip.closest('.map-marker').dataset.location;
            const [x, y] = centre(chip);
            const nearest = rings.map(([id, [rx, ry]]) => [id, Math.hypot(rx - x, ry - y)]).sort((a, b) => a[1] - b[1])[0][0];
            return nearest === own ? [] : [`${own} portrait nearest ${nearest}`];
          });
        });
        assert.deepEqual(bad, [], `E${n}`);
      } } finally { await episode(page, MAX); }
    });

    await test('hovering a map portrait shows a larger picture and what they are doing there', async () => {
      try {
        await episode(page, 45);
        const chip = page.locator('[data-location="reiss-chapel"] .map-person[data-person="historia"]');
        await chip.hover();
        await page.locator('#person-card').waitFor({ state: 'visible' });
        const text = await page.locator('#person-card').innerText();
        assert.match(text, /Historia Reiss/);
        assert.match(text, /Stands with Rod beneath the chapel/, 'the recorded note for this place');
        assert.match(text, /Historia refuses/, 'this place\'s events involving her, newest first');
        const photo = await page.locator('#person-card .avatar').boundingBox();
        assert.ok(photo.width >= 80, `card picture is only ${photo.width}px`);
        await page.mouse.move(20, 20);
        await page.locator('#person-card').waitFor({ state: 'hidden' });
      } finally { await episode(page, MAX); }
    });

    await test('clicking a portrait pins its card; Escape, a click outside and the card button close it', async () => {
      try {
        await episode(page, 45);
        const selected = await page.locator('.map-marker.selected').getAttribute('data-location');
        const chip = page.locator('[data-location="reiss-chapel"] .map-person[data-person="historia"]');
        await chip.click();
        await page.mouse.move(20, 20);
        await page.waitForTimeout(400);
        assert.equal(await page.locator('#person-card').isVisible(), true, 'a pinned card stays open');
        assert.equal(await page.locator('.map-marker.selected').getAttribute('data-location'), selected, 'clicking a portrait must not select the place');
        const box = await page.locator('#map-stage').boundingBox();
        await page.mouse.move(box.x + box.width - 60, box.y + box.height - 120);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width - 160, box.y + box.height - 140, { steps: 5 });
        await page.mouse.up();
        assert.equal(await page.locator('#person-card').isVisible(), true, 'panning the map keeps a pinned card');
        await page.locator('#reset-map').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#person-card').isVisible(), false);
        await chip.click();
        await page.locator('#location-panel h2').click();
        assert.equal(await page.locator('#person-card').isVisible(), false, 'a click outside closes it');
        await chip.click();
        await page.locator('#person-card [data-open-character="historia"]').click();
        assert.equal(await page.locator('#characters-view').isVisible(), true);
        assert.equal(await page.locator('#character-detail-dialog').evaluate(dialog => dialog.open), true);
        assert.equal(await page.locator('#character-detail-title').innerText(), at(data.characters.find(character => character.id === 'historia').name, 45).text);
        await closeCharacterDetails(page);
        await view(page, 'map');
      } finally { await episode(page, MAX); }
    });

    await test('on a phone, tapping a portrait docks its card under the map', async () => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      contexts.push(ctx);
      const phone = await createPage(undefined, undefined, ctx);
      await episode(phone, 45);
      await phone.locator('[data-location="reiss-chapel"] .map-person[data-person="historia"]').tap();
      await phone.locator('#person-card.docked').waitFor({ state: 'visible' });
      const card = await phone.locator('#person-card').boundingBox();
      const stage = await phone.locator('#map-stage').boundingBox();
      assert.ok(card.x >= stage.x && card.x + card.width <= stage.x + stage.width + 1, 'card stays inside the map');
      const sheet = await phone.locator('#location-panel').boundingBox();
      assert.ok(card.y + card.height <= sheet.y, 'the place sheet must not cover the portrait card');
      await phone.locator('#person-card [data-open-character]').tap();
      assert.equal(await phone.locator('#characters-view').isVisible(), true);
      assert.equal(await phone.locator('#character-detail-dialog').evaluate(dialog => dialog.open), true);
      await assertNoHorizontalOverflow(phone, 'phone character details');
    });

    for (const viewport of [{ width: 1440, height: 1040 }, { width: 1366, height: 768 }]) {
      await test(`no map labels overlap at any milestone (${viewport.width}x${viewport.height})`, async () => {
        const sized = await createPage(viewport);
        for (const n of milestones) {
          await episode(sized, n);
          const boxes = await labelBoxes(sized);
          const clashes = [];
          boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => { if (a.owner !== b.owner && overlap(a, b)) clashes.push(`${a.text} / ${b.text}`); }));
          assert.deepEqual(clashes, [], `E${n}`);
          assert.ok(boxes.some(box => /marker-label/.test(box.kind)), `no labels rendered at E${n}`);
          const stage = await sized.locator('#map-stage').boundingBox();
          const outside = boxes.filter(box => /marker-label/.test(box.kind) && (box.left < stage.x || box.right > stage.x + stage.width || box.top < stage.y || box.bottom > stage.y + stage.height));
          assert.deepEqual(outside.map(box => box.text), [], `E${n}: labels outside the map`);
        }
      });
    }

    await test('field notes are removed while legacy saved notes remain untouched', async () => {
      const legacy = await createPage(undefined, () => {
        if (!sessionStorage.getItem('seeded')) {
          sessionStorage.setItem('seeded', '1');
          localStorage.setItem('scout-atlas:v1', JSON.stringify({ cutoff: 47, viewing: 47, notes: { '47:shiganshina': 'Private legacy text <b>kept</b>' } }));
        }
      });
      for (const n of [MAX, 1, 13]) {
        await episode(legacy, n);
        assert.equal(await legacy.locator('[data-view="notes"], #notes-view, #location-note, #save-note, #note-count').count(), 0);
        assert.ok(!(await legacy.locator('body').innerText()).includes('Private legacy text'));
      }
      await setCutoff(legacy, 13);
      await legacy.locator('button[data-map-style="parchment"]').click();
      await legacy.reload({ waitUntil: 'load' });
      assert.deepEqual(await legacy.evaluate(key => JSON.parse(localStorage.getItem(key)).notes, storageKey), { '47:shiganshina': 'Private legacy text <b>kept</b>' });
      assert.equal(await page.evaluate(key => Object.hasOwn(JSON.parse(localStorage.getItem(key)), 'notes'), storageKey), false, 'fresh sessions should not create note storage');
    });

    await test('choosing an episode follows the story to its place and marks it', async () => {
      try {
        await episode(page, 13);
        assert.equal(await page.locator('.map-marker.selected').getAttribute('data-location'), 'trost');
        assert.equal(await page.locator('[data-location="trost"]').evaluate(el => el.classList.contains('now')), true);
        assert.match(await page.locator('#location-panel .now-block').innerText(), /This episode/);
        assert.match(await page.locator('#page-description').innerText(), /Episode 13/);
        await episode(page, 14);
        assert.equal(await page.locator('.map-marker.selected').getAttribute('data-location'), 'trost', 'an unpinned episode keeps the selection');
      } finally { await episode(page, MAX); }
    });

    await test('held and lost ground and gate states change with the episode', async () => {
      try {
        await episode(page, 1);
        assert.equal(await page.locator('#territory-art .lost-ground').count(), 0, 'Wall Maria is not lost at episode 1');
        assert.equal(await page.locator('#district-art .gate-breached').count(), 1, 'Shiganshina gate breached at episode 1');
        await episode(page, 5);
        assert.equal(await page.locator('#territory-art .lost-ground').count(), 1);
        assert.equal(await page.locator('#district-art .gate-breached').count(), 2, 'Trost breached at episode 5');
        await episode(page, 13);
        assert.equal(await page.locator('#district-art .gate-sealed').count(), 1, 'Trost sealed at episode 13');
        await setLayer(page, 'territory', false);
        assert.equal(await page.locator('#territory-art').evaluate(el => getComputedStyle(el).display), 'none');
        await setLayer(page, 'territory', true);
      } finally { await episode(page, MAX); }
    });

    await test('timeline and map light each other up; zoom shows episode tags; new places fade in', async () => {
      try {
        await page.locator('[data-map-extent="walls"]').click();
        await page.locator('#timeline-track [data-episode="43"]').hover();
        assert.equal(await page.locator('#location-markers').evaluate(el => el.classList.contains('highlighting')), true);
        assert.deepEqual(await page.locator('#location-markers .map-marker.highlight').evaluateAll(els => els.map(el => el.dataset.location)), ['reiss-chapel']);
        await page.mouse.move(5, 5);
        assert.equal(await page.locator('#location-markers').evaluate(el => el.classList.contains('highlighting')), false);
        await page.locator('#zoom-in').click();
        await page.locator('#zoom-in').click();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const trostEpisodes = data.episodes.filter(e => e.events.some(ev => ev.locationId === 'trost')).map(e => e.number);
        assert.equal(await page.locator('[data-location="trost"] .marker-caption').textContent(), `Episodes ${trostEpisodes.join(', ')}`);
        await page.locator('#reset-map').click();
        await episode(page, 42);
        await page.locator('#next-milestone').click();
        assert.equal(await page.locator('[data-location="reiss-chapel"]').evaluate(el => el.classList.contains('enter')), true, 'a place new at this episode fades in');
        assert.equal(await page.locator('[data-location="trost"]').evaluate(el => el.classList.contains('enter')), false);
      } finally { await episode(page, MAX); }
    });

    await test('character groups filter with chips and older history remains available in details', async () => {
      await view(page, 'characters');
      await page.locator('[data-faction-filter="Titans and Titan shifters"]').click();
      const sections = await page.locator('.character-section h2').evaluateAll(els => els.map(el => el.firstChild.textContent.trim()));
      assert.deepEqual(sections, ['Titans and Titan shifters']);
      assert.equal(await page.locator('.character-grid').count(), 1);
      await page.locator('[data-faction-filter="all"]').click();
      assert.equal(await page.locator('.character-section h2').count(), 0);
      const body = await characterDetails(page, 'eren');
      assert.equal(await body.locator('ol.character-notes').first().isVisible(), true, 'recent notes are readable immediately');
      assert.equal(await body.locator('.more-notes summary').count(), 1, 'older notes fold behind a summary');
      assert.equal(await body.locator('.more-notes ol').isVisible(), false);
      await body.locator('.more-notes summary').click();
      assert.equal(await body.locator('.more-notes ol').isVisible(), true, 'older history remains readable');
      await closeCharacterDetails(page);
      await view(page, 'map');
    });

    await test('approximate places are drawn as areas and wall names stay clear of places', async () => {
      await page.locator('[data-map-extent="walls"]').click();
      const areas = await page.locator('#area-art .place-area').evaluateAll(els => els.map(el => el.dataset.area));
      const expected = mappedLocations(MAX, 'walls').filter(l => l.area).map(l => l.id);
      assert.deepEqual(areas.sort(), expected.sort());
      for (const n of milestones) {
        await episode(page, n);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const clashes = await page.evaluate(() => {
          const walls = [...document.querySelectorAll('#wall-labels text')].map(t => t.getBoundingClientRect());
          const others = [...document.querySelectorAll('#location-markers .marker-ring, #location-markers .map-person, #location-markers .marker-label')].filter(el => getComputedStyle(el).display !== 'none').map(el => el.getBoundingClientRect());
          const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
          return walls.flatMap((w, i) => others.filter(o => hit(w, o)).map(() => i));
        });
        assert.deepEqual(clashes, [], `E${n}: a wall name overlaps a place`);
      }
      await episode(page, MAX);
    });

    await test('another tab synchronizes the cutoff without erasing legacy data', async () => {
      const shared = await browser.newContext({ viewport: { width: 1440, height: 1040 } });
      contexts.push(shared);
      const a = await createPage(undefined, undefined, shared);
      const b = await createPage(undefined, undefined, shared);
      await a.evaluate(key => {
        const saved = JSON.parse(localStorage.getItem(key));
        saved.notes = { '47:shiganshina': 'Kept from an older tab' };
        localStorage.setItem(key, JSON.stringify(saved));
      }, storageKey);
      await view(b, 'recap');
      await setCutoff(a, 13);
      await b.waitForFunction(() => document.querySelector('#episode-select').value === '13');
      assert.equal(await b.locator('#recap-view').isVisible(), true, 'the other tab keeps its own view');
      await view(b, 'map');
      await setLayer(b, 'walls', false);
      assert.deepEqual(await b.evaluate(key => JSON.parse(localStorage.getItem(key)).notes, storageKey), { '47:shiganshina': 'Kept from an older tab' });
    });

    await test('lowering the cutoff clamps the view and persists the limit', async () => {
      await chooseLocation(page, 'Utgard', 'utgard');
      await setCutoff(page, 13);
      assert.equal(await page.locator('#episode-select').inputValue(), '13');
      assert.equal(await page.locator('#episode-select option').count(), 13);
      assert.equal(await page.locator('#location-panel h2').innerText(), 'Shiganshina');
      assert.equal(await page.locator('[data-location="utgard"]').count(), 0);
      await page.reload({ waitUntil: 'load' });
      assert.equal(await page.locator('#episode-select').inputValue(), '13');
      const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
      assert.equal(state.cutoff, 13);
      await page.locator('#settings-button').click();
      await page.locator('#cutoff-input').fill(String(MAX + 1));
      assert.match(await page.locator('#cutoff-hint').innerText(), new RegExp(`stops at episode ${MAX}`));
      await page.locator('#settings-form [type="submit"]').click();
      assert.equal(await page.locator('#settings-dialog').evaluate(dialog => dialog.open), true, `Episode ${MAX + 1} must not be accepted`);
      await page.locator('#cutoff-input').fill(String(MAX));
      await page.locator('#settings-form [type="submit"]').click();
      await episode(page, MAX);
    });

    await test('a viewer caught up with an older edition follows the ceiling up; others keep their limit', async () => {
      const open = saved => createPage(undefined, `if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(JSON.stringify(saved))}); }`);
      const cases = [
        // [saved state, expected cutoff, expect the "spoiler limit followed" toast]
        [{ cutoff: 47, viewing: 40 }, MAX, MAX > 47],   // saved before `edition` existed: the episode-47 edition
        [{ cutoff: 47, edition: 47, viewing: 47 }, MAX, MAX > 47],
        ...(MAX > 59 ? [
          [{ cutoff: 59, edition: 59, viewing: 59 }, MAX, true],
          [{ cutoff: 58, edition: 59, viewing: 58 }, 58, false]
        ] : []),
        [{ cutoff: 13, viewing: 13 }, 13, false],
        [{ cutoff: 46, edition: 47, viewing: 46 }, 46, false],
        [{ cutoff: MAX, edition: MAX, viewing: MAX }, MAX, false]
      ];
      for (const [saved, expected, followed] of cases) {
        const p = await open(saved);
        const label = JSON.stringify(saved);
        assert.equal(await p.locator('#episode-select option').count(), expected, label);
        assert.equal(await p.locator('#episode-select').inputValue(), String(Math.min(saved.viewing, expected)), `${label}: the viewing episode stays put`);
        assert.equal(await p.locator('#toast').evaluate(el => el.classList.contains('visible')), followed, `${label}: toast`);
        if (followed) assert.match(await p.locator('#toast').innerText(), new RegExp(`episode ${MAX}\\b`));
        const stored = await p.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
        assert.deepEqual([stored.cutoff, stored.edition], [expected, MAX], `${label}: saved`);
        await p.locator('#settings-button').click();
        assert.equal(await p.locator('#cutoff-input').inputValue(), String(expected), `${label}: settings reflect the migrated limit`);
        await p.keyboard.press('Escape');
        await p.close();
      }
    });

    await test('the sea and coastline appear only from the episode that reveals them', async () => {
      const sea = data.locations.find(location => location.kind === 'sea');
      try {
        await episode(page, sea.firstEpisode - 1);
        assert.equal(await page.locator('#sea-art path').count(), 0, 'no sea before it is revealed');
        assert.equal(await page.locator(`[data-location="${sea.id}"]`).count(), 0);
        await episode(page, sea.firstEpisode);
        await page.locator('[data-map-extent="island"]').click();
        assert.equal(await page.locator('#sea-art .coastline').count(), 1);
        assert.equal(await page.locator(`[data-location="${sea.id}"]`).count(), 1);
        // The marker must sit in the water, outside the coastline.
        const inWater = await page.evaluate(id => {
          const coast = document.querySelector('#sea-art .coastline');
          const marker = document.querySelector(`[data-location="${id}"]`).transform.baseVal.consolidate().matrix;
          return !coast.isPointInFill(new DOMPoint(marker.e, marker.f));
        }, sea.id);
        assert.ok(inWater, 'the sea marker sits outside the coastline');
        if (sea.desertFrom) {
          await episode(page, sea.desertFrom - 1);
          await page.locator('[data-map-extent="island"]').click();
          assert.equal(await page.locator('#sea-art .desert').count(), 0, 'no desert before its episode');
          await episode(page, sea.desertFrom);
          await page.locator('[data-map-extent="island"]').click();
          assert.equal(await page.locator('#sea-art .desert').count(), 1, 'the desert appears at its episode');
        }
      } finally {
        await episode(page, MAX);
      }
    });

    await test('search covers places, aliases, people and events', async () => {
      const results = async query => { await page.locator('#location-search').fill(query); return page.locator('#search-results button').evaluateAll(b => b.map(x => x.dataset.searchLocation || x.dataset.openCharacter || x.dataset.openEvent)); };
      assert.deepEqual(await results('Karanese'), ['karanes']);
      assert.ok((await results('Kenny')).includes('kenny'));
      assert.ok((await results('boulder')).some(id => id?.startsWith('episode-13')));
      await episode(page, 20);
      assert.deepEqual(await results('Krista'), ['historia']);
      assert.deepEqual(await results('Historia'), [], 'the later name must not be searchable at E20');
      await page.locator('#location-search').fill('');
      await episode(page, MAX);
      await page.locator('#location-search').fill('Kenny');
      await page.locator('[data-open-character="kenny"]').first().click();
      assert.equal(await page.locator('#characters-view').isVisible(), true);
      assert.equal(await page.locator('#character-detail-dialog').evaluate(dialog => dialog.open), true);
      assert.equal(await page.locator('#character-detail-title').innerText(), at(data.characters.find(character => character.id === 'kenny').name, MAX).text);
      await closeCharacterDetails(page);
      await view(page, 'map');
    });

    await test('map controls: zoom, reset, layers, keyboard, and bounded panning', async () => {
      await chooseLocation(page, 'Trost', 'trost');
      assert.equal(await page.locator('#zoom-level').innerText(), '145%');
      await page.locator('#zoom-in').click();
      assert.notEqual(await page.locator('#zoom-level').innerText(), '145%');
      await page.locator('#reset-map').click();
      assert.equal(await page.locator('#map-camera').getAttribute('transform'), 'translate(0 0) scale(1)');
      await page.locator('#atlas-map').focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('+');
      assert.notEqual(await page.locator('#map-camera').getAttribute('transform'), 'translate(0 0) scale(1)');
      await page.keyboard.press('0');
      const box = await page.locator('#map-stage').boundingBox();
      for (let i = 0; i < 6; i++) {
        await page.mouse.move(box.x + 40, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width - 5, box.y + box.height / 2, { steps: 4 });
        await page.mouse.up();
      }
      const inView = await page.evaluate(() => {
        const s = document.querySelector('#map-stage').getBoundingClientRect();
        return [...document.querySelectorAll('#location-markers .marker-ring')].filter(r => { const b = r.getBoundingClientRect(); return b.right > s.left && b.left < s.right && b.bottom > s.top && b.top < s.bottom; }).length;
      });
      assert.ok(inView > 0, 'the map was dragged completely out of view');
      await page.locator('#reset-map').click();
      await setLayer(page, 'locations', false);
      assert.equal(await page.locator('[data-location="trost"] .marker-label').evaluate(el => getComputedStyle(el).display), 'none');
      await setLayer(page, 'locations', true);
      await setLayer(page, 'walls', false);
      assert.equal(await page.locator('#wall-labels').evaluate(el => getComputedStyle(el).display), 'none');
      await setLayer(page, 'walls', true);
      assert.equal(await page.locator('#next-milestone').isDisabled(), true, 'no milestone after the last one');
      await episode(page, 1);
      await page.locator('#next-milestone').click();
      assert.equal(await page.locator('#episode-select').inputValue(), String(milestones[1]));
      await page.locator('#prev-milestone').click();
      assert.equal(await page.locator('#episode-select').inputValue(), '1');
      await episode(page, MAX);
    });

    await test('the mouse wheel scrolls the page; Ctrl+wheel zooms the map', async () => {
      const laptop = await createPage({ width: 1366, height: 700 });
      const box = await laptop.locator('#map-stage').boundingBox();
      await laptop.mouse.move(box.x + box.width / 2, box.y + 100);
      await laptop.mouse.wheel(0, 300);
      await laptop.waitForTimeout(150);
      assert.ok(await laptop.evaluate(() => scrollY) > 0, 'page did not scroll');
      assert.equal(await laptop.locator('#zoom-level').innerText(), '100%');
      // Page scrolling can move a short map away from the pointer. Start the
      // separate zoom gesture over the map again, as a user would.
      await laptop.locator('#map-stage').scrollIntoViewIfNeeded();
      const zoomBox = await laptop.locator('#map-stage').boundingBox();
      await laptop.mouse.move(zoomBox.x + zoomBox.width / 2, zoomBox.y + 100);
      await laptop.keyboard.down('Control');
      await laptop.mouse.wheel(0, -300);
      await laptop.keyboard.up('Control');
      await laptop.waitForFunction(() => document.querySelector('#zoom-level').textContent !== '100%');
      assert.notEqual(await laptop.locator('#zoom-level').innerText(), '100%');
    });

    await test('recap event links open the map on the event', async () => {
      await view(page, 'recap');
      await assertNoHorizontalOverflow(page, 'desktop recap');
      const last = data.episodes.findLast(entry => entry.events.some(event => event.locationId)).events.find(event => event.locationId);
      await page.locator(`[data-open-event="${last.id}"]`).click();
      assert.equal(await page.locator('#map-view').isVisible(), true);
      assert.equal(await page.locator('#location-panel [data-event-id]').first().getAttribute('data-event-id'), last.id);
    });

    if (onFile) {
      await test('the brand link stays on the atlas over file://', async () => {
        const home = await createPage();
        await home.locator('a.brand').click();
        await home.waitForLoadState('load');
        assert.equal(await home.locator('#atlas-map').count(), 1);
      });
    }

    await test('unreadable saved data is kept aside and the atlas starts fresh', async () => {
      const malformed = await createPage(undefined, () => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('scout-atlas:v1', '{invalid-json'); } });
      assert.equal(await malformed.locator('#episode-select').inputValue(), String(MAX));
      await episode(malformed, 13);
      assert.equal(await malformed.evaluate(key => JSON.parse(localStorage.getItem(key)).viewing, storageKey), 13);
      const copies = await malformed.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('scout-atlas:v1:unreadable:')).map(key => localStorage.getItem(key)));
      assert.deepEqual(copies, ['{invalid-json']);
    });

    await test('denied browser storage still allows exploration', async () => {
      const denied = await createPage(undefined, () => {
        Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage denied for regression test', 'SecurityError'); } });
      });
      await episode(denied, 1);
      assert.equal(await denied.locator('#episode-select').inputValue(), '1');
      await view(denied, 'recap');
      assert.equal(await denied.locator('#recap-view').isVisible(), true);
      await setCutoff(denied, 13);
      await view(denied, 'map');
      await episode(denied, 13);
      await denied.locator('#zoom-in').click();
      assert.notEqual(await denied.locator('#zoom-level').innerText(), '100%');
    });

    const fetched = require('node:fs').existsSync(path.resolve(__dirname, '../portraits/eren-s3.jpg'));
    if (fetched) {
      await test('portraits change with the season art and episode stills stay behind their boundary', async () => {
        await view(page, 'characters');
        await episode(page, 37);
        assert.match(await page.locator('#character-eren [data-portrait]').getAttribute('data-portrait'), /eren-s2\.jpg$/);
        await episode(page, 38);
        assert.match(await page.locator('#character-eren [data-portrait]').getAttribute('data-portrait'), /eren-s3\.jpg$/);
        assert.equal(await page.locator('#character-armored [data-portrait]').count(), 1, 'the Armored Titan has a real picture');
        await episode(page, 43);
        const earlyGrisha = at(portraitVersions('grisha'), 43);
        assert.equal(await page.locator('#character-grisha [data-portrait]').getAttribute('data-portrait'), `grisha/${earlyGrisha.file}`);
        assert.equal(await page.locator('#character-grisha [data-portrait="grisha/grisha-e44.jpg"]').count(), 0, 'the E44 still never appears before E44');
        await episode(page, 44);
        assert.match(await page.locator('#character-grisha [data-portrait]').getAttribute('data-portrait'), /grisha-e44\.jpg$/);
        await view(page, 'map');
        await episode(page, MAX);
      });

      await test('every visible person and Titan has a real portrait and all bundled versions decode', async () => {
        const illustrated = await createPage();
        await view(illustrated, 'characters');
        const cast = data.characters.filter(character => character.type !== 'group' && character.firstEpisode <= MAX);
        assert.equal(cast.length, 56, 'the E87 cast contains 56 people and Titans');
        assert.equal(await illustrated.locator('.character-card').count(), cast.length);
        for (const character of cast) {
          const portrait = illustrated.locator(`#character-${character.id} [data-portrait]`);
          const version = at(portraitVersions(character.id), MAX);
          assert.ok(version, `${character.id} has a portrait version by the ceiling`);
          assert.equal(await portrait.count(), 1, `${character.id} has exactly one real gallery picture`);
          assert.equal(await portrait.getAttribute('data-portrait'), `${character.id}/${version.file}`);
          const actual = await portrait.evaluate(element => ({
            tag: element.tagName.toLowerCase(),
            source: element.getAttribute('src') || element.getAttribute('href'),
            framed: Boolean(element.closest('svg.avatar.image-portrait')),
            viewBox: element.closest('svg.avatar.image-portrait')?.getAttribute('viewBox') || null,
            sourceSize: element.tagName.toLowerCase() === 'image' ? [Number(element.getAttribute('width')), Number(element.getAttribute('height'))] : null
          }));
          assert.ok(['img', 'image'].includes(actual.tag), `${character.id} uses an HTML or SVG image`);
          assert.equal(actual.source, `portraits/${version.file}`);
          if (version.crop) {
            assert.equal(actual.framed, true, `${character.id} uses its source framing`);
            assert.deepEqual(actual.viewBox.split(/\s+/).map(Number), version.crop, `${character.id} frame`);
            assert.deepEqual(actual.sourceSize, version.sourceSize, `${character.id} source dimensions`);
          }
        }
        const versions = Object.values(portraits).flatMap(entry => Array.isArray(entry) ? entry : [{ from: 1, file: entry }]);
        const files = [...new Set(versions.map(version => version.file))];
        const decoded = await illustrated.evaluate(async files => Promise.all(files.map(async file => {
          const image = new Image();
          image.src = new URL(`portraits/${file}`, location.href).href;
          try {
            await image.decode();
            return { file, width: image.naturalWidth, height: image.naturalHeight };
          } catch (error) { return { file, error: error.name }; }
        })), files);
        assert.deepEqual(decoded.filter(image => image.error || !image.width || !image.height), [], 'every bundled portrait decodes, including SVG image sources');
        for (const version of versions.filter(version => version.sourceSize)) {
          const image = decoded.find(image => image.file === version.file);
          assert.deepEqual([image.width, image.height], version.sourceSize, `${version.file} framing matches the decoded image`);
        }
        await assertNoHorizontalOverflow(illustrated, 'fully illustrated gallery');
      });

      await test('every dated portrait version appears from its own episode and never earlier', async () => {
        const dated = await createPage();
        await view(dated, 'characters');
        for (const [id] of Object.entries(portraits)) {
          const character = data.characters.find(character => character.id === id);
          if (!character || character.type === 'group') continue;
          for (const version of portraitVersions(id)) {
            if (version.from > 1) {
              await episode(dated, version.from - 1);
              assert.equal(await dated.locator(`#characters-view [data-portrait="${id}/${version.file}"]`).count(), 0, `${id}/${version.file} is hidden before E${version.from}`);
              const previous = at(portraitVersions(id), version.from - 1);
              const picture = dated.locator(`#character-${id} [data-portrait]`);
              if (character.firstEpisode <= version.from - 1 && previous) {
                assert.equal(await picture.getAttribute('data-portrait'), `${id}/${previous.file}`, `${id} retains its earlier picture`);
              } else assert.equal(await picture.count(), 0, `${id} has no fabricated earlier portrait`);
            }
            await episode(dated, Math.max(version.from, character.firstEpisode));
            assert.equal(await dated.locator(`#character-${id} [data-portrait]`).getAttribute('data-portrait'), `${id}/${version.file}`, `${id}/${version.file} appears at E${version.from}`);
          }
        }
      });

      await test('framed map portraits keep the same bounds as their marker disc', async () => {
        const frameEpisodes = [...new Set(data.characters.flatMap(character => (character.positions || []).map(position => position.episode)))].filter(number =>
          data.characters.some(character => {
            const version = at(portraitVersions(character.id), number);
            const position = (character.positions || []).filter(position => position.episode <= number).sort((a, b) => b.episode - a.episode)[0];
            return version?.crop && position?.locationId;
          }));
        assert.ok(frameEpisodes.length > 0, 'a framed portrait has a recorded map position');
        for (const viewport of [{ width: 1440, height: 1040 }, { width: 390, height: 844 }]) {
          const mapped = await createPage(viewport);
          let count = 0;
          for (const number of frameEpisodes) {
            await episode(mapped, number);
            await mapped.locator('#reset-map').click();
            for (let zoom = 0; zoom < 2; zoom++) {
              if (zoom) await mapped.locator('#zoom-in').click();
              const frames = await mapped.locator('#location-markers .map-person').evaluateAll(chips => chips.filter(chip => chip.querySelector('foreignObject [data-portrait]')).map(chip => {
                const disc = chip.querySelector('.avatar-disc');
                const box = chip.getBoundingClientRect();
                const discBox = disc.getBoundingClientRect();
                const local = chip.getBBox();
                const localDisc = disc.getBBox();
                const frame = chip.querySelector('foreignObject');
                return { id: chip.dataset.person,
                  screen: [box.x, box.y, box.width, box.height],
                  disc: [discBox.x, discBox.y, discBox.width, discBox.height],
                  local: [local.x, local.y, local.width, local.height],
                  localDisc: [localDisc.x, localDisc.y, localDisc.width, localDisc.height],
                  frameSize: [Number(frame.getAttribute('width')), Number(frame.getAttribute('height'))] };
              }));
              count += frames.length;
              for (const frame of frames) {
                assert.deepEqual(frame.frameSize, [21, 21], `${frame.id} retains a small map frame`);
                assert.ok(frame.screen.every((value, index) => Math.abs(value - frame.disc[index]) <= 2), `E${number} ${frame.id} image inflates its on-screen marker bounds`);
                assert.ok(frame.local.every((value, index) => Math.abs(value - frame.localDisc[index]) <= 2), `E${number} ${frame.id} source geometry inflates collision bounds`);
              }
            }
          }
          assert.ok(count > 0, `${viewport.width}px renders framed map portraits`);
          await assertNoHorizontalOverflow(mapped, `${viewport.width}px framed map portraits`);
        }
      });
    }

    await test('missing and unsafe portraits fall back to emblems for both image rendering paths', async () => {
      for (const framed of [false, true]) {
        const listed = await createPage(undefined, framed ? () => {
          Object.defineProperty(window, 'ATLAS_PORTRAITS', { configurable: true, get: () => ({
            levi: [{ from: 14, file: 'missing-framed-for-test.png', crop: [0, 0, 100, 100], sourceSize: [100, 100] }],
            historia: [{ from: 4, file: '../outside.png', crop: [0, 0, 100, 100], sourceSize: [100, 100] }]
          }), set: () => {} });
        } : () => {
          Object.defineProperty(window, 'ATLAS_PORTRAITS', { configurable: true, get: () => ({ levi: 'missing-for-test.png', historia: '../outside.png' }), set: () => {} });
        });
        await view(listed, 'characters');
        await listed.waitForFunction(() => !document.querySelector('#character-levi [data-portrait]'));
        assert.equal(await listed.locator('#character-levi svg.avatar:not(.image-portrait)').count(), 1);
        assert.equal(await listed.locator('#character-historia [data-portrait]').count(), 0);
      }
    });

    await test('phone layout fits, keeps every tab reachable, and fills the map', async () => {
      const mobile = await createPage({ width: 390, height: 844 });
      await mobile.locator('[data-map-extent="walls"]').click();
      await assertNoHorizontalOverflow(mobile, 'mobile map');
      const tabs = await mobile.locator('.primary-nav .nav-item').evaluateAll(items => items.map(item => item.getBoundingClientRect().right));
      assert.ok(tabs.every(right => right <= 390), `a tab is off screen: ${tabs}`);
      const nav = mobile.locator('.primary-nav');
      const atTop = await nav.boundingBox();
      await mobile.locator('.page-footer button').scrollIntoViewIfNeeded();
      const afterScroll = await nav.boundingBox();
      assert.equal(Math.round(afterScroll.y + afterScroll.height), 844, 'phone navigation stays at the bottom');
      assert.equal(Math.round(afterScroll.y), Math.round(atTop.y), 'navigation stays reachable while scrolling');
      const footer = await mobile.locator('.page-footer button').boundingBox();
      assert.ok(footer.y + footer.height <= afterScroll.y, 'bottom navigation must not cover the last control');
      const fit = await mobile.evaluate(() => {
        const stage = document.querySelector('#atlas-map').getBoundingClientRect();
        return document.querySelector('#atlas-map').viewBox.baseVal.height * document.querySelector('#atlas-map').getScreenCTM().d / stage.height;
      });
      assert.ok(fit > 0.8, `map fills only ${Math.round(fit * 100)}% of its stage`);
      for (const name of ['recap', 'characters']) { await view(mobile, name); await assertNoHorizontalOverflow(mobile, `mobile ${name}`); }
      await setCutoff(mobile, 1);
      assert.equal(await mobile.locator('#episode-select').inputValue(), '1');
      await assertNoHorizontalOverflow(mobile, 'mobile episode 1');
    });

    await test('no network, no page errors, no CSP violations', async () => {
      assert.deepEqual(foreign, [], 'requests outside the app folder');
      assert.deepEqual(errors, [], 'page errors or CSP violations');
    });
  } finally {
    await Promise.all(contexts.map(context => context.close().catch(() => {})));
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failures.length} failed. Target: ${url}`);
  if (failures.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(`\nFAIL after ${passed} successful checks: ${error.stack || error.message}`);
  process.exitCode = 1;
});
