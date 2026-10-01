#!/usr/bin/env node
'use strict';
// Browser regression checks. Every check uses its own throwaway browser context, so the
// notes saved in your own browser are never read or written.
//   node tests/browser.cjs                                  (the page over file://)
//   ATLAS_URL=http://127.0.0.1:8765 node tests/browser.cjs  (a running local server)
//   CHROME=/path/to/chrome node tests/browser.cjs           (another Chrome build)

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const url = process.env.ATLAS_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const onFile = url.startsWith('file:');
const storageKey = 'scout-atlas:v1';
global.window = {};
require(path.resolve(__dirname, '../data.js'));
const data = window.ATLAS_DATA;
const MAX = data.maxEpisode;
const milestones = data.episodes.map(e => e.number);
const at = (list, episode) => list.filter(v => v.from <= episode).sort((a, b) => b.from - a.from)[0];
// Everything the atlas introduces after episode 1: none of it may show while viewing episode 1.
const laterNames = [
  ...data.locations.filter(l => l.firstEpisode > 1).map(l => l.name),
  ...data.characters.flatMap(c => c.name.filter(v => v.from > 1).map(v => v.text))
];
let passed = 0;
const failures = [];

async function test(name, run) {
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
  return page.locator('#location-markers, #location-panel, #recap-view, #characters-view, #timeline-track, #notes-view')
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
async function setCutoff(page, value) {
  await page.locator('#spoiler-button').click();
  await page.locator('#cutoff-input').fill(String(value));
  await page.locator('#progress-form [type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector('#progress-dialog').open);
}
async function view(page, name) { await page.locator(`.primary-nav [data-view="${name}"]`).click(); }
async function episode(page, number) { await page.locator('#episode-select').selectOption(String(number)); }
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
    await page.locator('#location-panel h2').waitFor();
    return page;
  }
  try {
    const page = await createPage();

    await test(`fresh session starts at episode ${MAX} with bounded choices`, async () => {
      assert.equal(await page.locator('#episode-select').inputValue(), String(MAX));
      assert.match(await page.locator('#cutoff-label').innerText(), new RegExp(`episode ${MAX}$`));
      const options = await page.locator('#episode-select option').evaluateAll(items => items.map(item => Number(item.value)));
      assert.deepEqual(options, Array.from({ length: MAX }, (_, index) => index + 1));
      assert.equal(await page.locator('#episode-select optgroup').count(), data.seasons.length);
      assert.equal(await page.locator('#location-markers [data-location]').count(), data.locations.length);
      assert.equal(await page.locator('#timeline-track [data-episode]').count(), milestones.length);
      assert.equal(await page.locator('#cutoff-input').getAttribute('max'), String(MAX));
      assert.equal(await page.locator('meta[http-equiv="Content-Security-Policy"]').count(), 1);
      await assertNoHorizontalOverflow(page, 'desktop map');
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
        const card = await page.locator('#character-historia h3').innerText();
        assert.equal(card, at(historia.name, n).text);
        if (other !== MAX) assert.ok(!(await readUi(page)).includes(at(historia.name, other).text), `${at(historia.name, other).text} shown at E${n}`);
      }
      for (const titan of data.characters.filter(c => c.revealedAs)) {
        const who = data.characters.find(c => c.id === titan.revealedAs.id);
        await episode(page, titan.revealedAs.episode - 1);
        assert.equal(await page.locator(`#character-${titan.id} .reveal-line`).count(), 0, `${titan.id} revealed early`);
        await episode(page, titan.revealedAs.episode);
        assert.match(await page.locator(`#character-${titan.id} .reveal-line`).innerText(), new RegExp(at(who.name, titan.revealedAs.episode).text));
      }
      await view(page, 'map');
      await episode(page, MAX);
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

    await test('unpinned events and whereabouts are not drawn on the map', async () => {
      await episode(page, 39);
      await view(page, 'recap');
      assert.ok(await page.locator('#recap-view .unpinned').count() >= 2, 'E39 events should be listed as not pinned');
      await view(page, 'map');
      const labels = await page.locator('#location-markers [data-location]').evaluateAll(items => items.map(item => item.getAttribute('aria-label')).join(' '));
      assert.ok(!labels.includes('Eren Yeager'), 'Eren must not keep a pin while his whereabouts are unknown');
      await view(page, 'characters');
      assert.match(await page.locator('#character-eren footer').innerText(), /does not place/);
      await view(page, 'map');
      await episode(page, MAX);
    });

    await test('every portrait sits nearer its own pin than any other', async () => {
      try { for (const n of milestones) {
        await episode(page, n);
        const bad = await page.locator('#location-markers').evaluate(root => {
          const centre = el => { const r = el.getBoundingClientRect(); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2]; };
          const rings = [...root.querySelectorAll('.map-marker')].map(m => [m.dataset.location, centre(m.querySelector('.marker-ring'))]);
          return [...root.querySelectorAll('.map-person')].flatMap(chip => {
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
        assert.match(await page.evaluate(() => document.activeElement.id), /character-historia/);
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

    const note = 'Browser regression note: only visible from the last episode. <b>plain text</b>';
    await test('notes persist, stay out of earlier views, and show in later panels', async () => {
      try {
      await chooseLocation(page, 'Shiganshina', 'shiganshina');
      await page.locator('#location-note').fill(note);
      await page.locator('#save-note').click();
      await page.reload({ waitUntil: 'load' });
      assert.equal(await page.locator('#location-note').inputValue(), note);
      await view(page, 'notes');
      assert.ok((await page.locator('#notes-view').innerText()).includes(note));
      assert.equal(await page.locator('#notes-view b').count(), 0, 'Note content must be rendered as text');
      await episode(page, 1);
      assert.ok(!(await page.locator('#notes-view').innerText()).includes(note));
      assert.equal(await page.locator('#note-count').innerText(), '0');
      await view(page, 'map');
      assert.equal(await page.locator('#location-note').inputValue(), '');
      await page.locator('#location-note').fill('An early theory');
      await episode(page, 13);
      await chooseLocation(page, 'Shiganshina', 'shiganshina');
      assert.ok((await page.locator('#location-panel .earlier-notes').innerText()).includes('An early theory'), 'earlier note missing from a later panel');
      await episode(page, MAX);
      await chooseLocation(page, 'Shiganshina', 'shiganshina');
      assert.equal(await page.locator('#location-note').inputValue(), note);
      } finally { await episode(page, MAX); }
    });

    await test('choosing an episode follows the story to its place and marks it', async () => {
      try {
        await episode(page, 13);
        assert.equal(await page.locator('.map-marker.selected').getAttribute('data-location'), 'trost');
        assert.equal(await page.locator('[data-location="trost"]').evaluate(el => el.classList.contains('now')), true);
        assert.match(await page.locator('#location-panel .now-block').innerText(), /This episode/);
        assert.match(await page.locator('#page-description').innerText(), /Episode 13/);
        await episode(page, 14);
        assert.equal(await page.locator('.map-marker.selected').getAttribute('data-location'), 'trost', 'an episode without a milestone keeps the selection');
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
        await page.locator('#layer-territory').uncheck({ force: true });
        assert.equal(await page.locator('#territory-art').evaluate(el => getComputedStyle(el).display), 'none');
        await page.locator('#layer-territory').check({ force: true });
      } finally { await episode(page, MAX); }
    });

    await test('timeline and map light each other up; zoom shows episode tags; new places fade in', async () => {
      try {
        await page.locator('#timeline-track [data-episode="43"]').hover();
        assert.equal(await page.locator('#location-markers').evaluate(el => el.classList.contains('highlighting')), true);
        assert.deepEqual(await page.locator('#location-markers .map-marker.highlight').evaluateAll(els => els.map(el => el.dataset.location)), ['reiss-chapel']);
        await page.mouse.move(5, 5);
        assert.equal(await page.locator('#location-markers').evaluate(el => el.classList.contains('highlighting')), false);
        await page.locator('#zoom-in').click();
        await page.locator('#zoom-in').click();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.match(await page.locator('[data-location="trost"] .marker-caption').textContent(), /^Episodes 5, 8, 13, 38$/);
        await page.locator('#reset-map').click();
        await episode(page, 42);
        await page.locator('#next-milestone').click();
        assert.equal(await page.locator('[data-location="reiss-chapel"]').evaluate(el => el.classList.contains('enter')), true, 'a place new at this episode fades in');
        assert.equal(await page.locator('[data-location="trost"]').evaluate(el => el.classList.contains('enter')), false);
      } finally { await episode(page, MAX); }
    });

    await test('character groups filter with chips; long histories fold away', async () => {
      await view(page, 'characters');
      await page.locator('[data-faction-filter="Titans and Titan shifters"]').click();
      const sections = await page.locator('.character-section h2').evaluateAll(els => els.map(el => el.firstChild.textContent.trim()));
      assert.deepEqual(sections, ['Titans and Titan shifters']);
      await page.locator('[data-faction-filter="all"]').click();
      assert.ok(await page.locator('#character-eren .more-notes summary').count() === 1, 'older notes fold behind a summary');
      await view(page, 'map');
    });

    await test('approximate places are drawn as areas and wall names stay clear of places', async () => {
      const areas = await page.locator('#area-art .place-area').evaluateAll(els => els.map(el => el.dataset.area));
      const expected = data.locations.filter(l => l.area && l.firstEpisode <= MAX).map(l => l.id);
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

    await test('a stale second tab keeps notes saved in the first', async () => {
      const shared = await browser.newContext({ viewport: { width: 1440, height: 1040 } });
      contexts.push(shared);
      const a = await createPage(undefined, undefined, shared);
      const b = await createPage(undefined, undefined, shared);
      await a.locator('#location-note').fill('Saved in tab A');
      await a.locator('#save-note').click();
      await b.waitForFunction(() => document.querySelector('#note-count').textContent !== '0');
      await view(b, 'recap');
      await b.locator('#layer-walls').uncheck({ force: true });
      const notes = await b.evaluate(key => JSON.parse(localStorage.getItem(key)).notes, storageKey);
      assert.ok(Object.values(notes).includes('Saved in tab A'), `tab B wrote ${JSON.stringify(notes)}`);
    });

    await test('lowering the cutoff clamps the view and keeps later notes', async () => {
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
      assert.ok(state.notes[`${MAX}:shiganshina`].includes('Browser regression note'), 'Lowering the cutoff must keep later notes without showing them');
      await page.locator('#spoiler-button').click();
      await page.locator('#cutoff-input').fill(String(MAX + 1));
      assert.match(await page.locator('#cutoff-hint').innerText(), new RegExp(`stops at episode ${MAX}`));
      await page.locator('#progress-form [type="submit"]').click();
      assert.equal(await page.locator('#progress-dialog').evaluate(dialog => dialog.open), true, `Episode ${MAX + 1} must not be accepted`);
      await page.locator('#cutoff-input').fill(String(MAX));
      await page.locator('#progress-form [type="submit"]').click();
      await episode(page, MAX);
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
      assert.match(await page.evaluate(() => document.activeElement.id), /character-kenny/);
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
      await page.locator('#layer-locations').uncheck({ force: true });
      assert.equal(await page.locator('[data-location="trost"] .marker-label').evaluate(el => getComputedStyle(el).display), 'none');
      await page.locator('#layer-locations').check({ force: true });
      await page.locator('#layer-walls').uncheck({ force: true });
      assert.equal(await page.locator('#wall-labels').evaluate(el => getComputedStyle(el).display), 'none');
      await page.locator('#layer-walls').check({ force: true });
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
      await laptop.keyboard.down('Control');
      await laptop.mouse.wheel(0, -300);
      await laptop.keyboard.up('Control');
      assert.notEqual(await laptop.locator('#zoom-level').innerText(), '100%');
    });

    await test('recap event links open the map on the event', async () => {
      await view(page, 'recap');
      await assertNoHorizontalOverflow(page, 'desktop recap');
      const last = data.episodes[data.episodes.length - 1].events.find(e => e.locationId);
      await page.locator(`[data-open-event="${last.id}"]`).click();
      assert.equal(await page.locator('#map-view').isVisible(), true);
      assert.equal(await page.locator('#location-panel [data-event-id]').first().getAttribute('data-event-id'), last.id);
    });

    await test('deleting a note keeps keyboard focus in the notes view', async () => {
      await view(page, 'notes');
      const before = await page.locator('[data-delete-note]').count();
      await page.locator('[data-delete-note]').first().focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('[data-delete-note]').count(), before - 1);
      assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'BODY');
      await view(page, 'map');
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
      assert.doesNotMatch(await malformed.locator('#save-status').innerText(), /unavailable/i);
      const copies = await malformed.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('scout-atlas:v1:unreadable:')).map(key => localStorage.getItem(key)));
      assert.deepEqual(copies, ['{invalid-json']);
    });

    await test('denied browser storage still allows exploration and session notes', async () => {
      const denied = await createPage(undefined, () => {
        Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage denied for regression test', 'SecurityError'); } });
      });
      await denied.locator('#location-note').fill('Kept in this session only');
      await denied.locator('#save-note').click();
      assert.match(await denied.locator('#save-status').innerText(), /Storage unavailable/);
      await view(denied, 'notes');
      assert.ok((await denied.locator('#notes-view').innerText()).includes('Kept in this session only'));
      await episode(denied, 1);
      assert.ok(!(await denied.locator('#notes-view').innerText()).includes('Kept in this session only'));
    });

    const fetched = require('node:fs').existsSync(path.resolve(__dirname, '../portraits/eren-s3.jpg'));
    if (fetched) {
      await test('portraits change with the season art and load', async () => {
        await view(page, 'characters');
        await episode(page, 37);
        assert.match(await page.locator('#character-eren img.avatar').getAttribute('src'), /eren-s2\.jpg$/);
        await episode(page, 38);
        assert.match(await page.locator('#character-eren img.avatar').getAttribute('src'), /eren-s3\.jpg$/);
        await page.waitForFunction(() => [...document.querySelectorAll('#characters-view img.avatar')].every(img => img.complete));
        const broken = await page.locator('#characters-view img.avatar').evaluateAll(imgs => imgs.filter(img => !img.naturalWidth).map(img => img.src));
        assert.deepEqual(broken, []);
        assert.equal(await page.locator('#character-hannes svg.avatar').count(), 1, 'someone without a picture gets a silhouette');
        await view(page, 'map');
        await episode(page, MAX);
      });
    }

    await test('listed portraits that are missing or outside the folder fall back to emblems', async () => {
      const listed = await createPage(undefined, () => {
        Object.defineProperty(window, 'ATLAS_PORTRAITS', { configurable: true, get: () => ({ levi: 'missing-for-test.png', historia: '../outside.png' }), set: () => {} });
      });
      await view(listed, 'characters');
      await listed.waitForFunction(() => !document.querySelector('#character-levi img'));
      assert.equal(await listed.locator('#character-levi svg.avatar').count(), 1);
      assert.equal(await listed.locator('#character-historia img').count(), 0);
    });

    await test('phone layout fits, keeps every tab reachable, and fills the map', async () => {
      const mobile = await createPage({ width: 390, height: 844 });
      await assertNoHorizontalOverflow(mobile, 'mobile map');
      const tabs = await mobile.locator('.primary-nav .nav-item').evaluateAll(items => items.map(item => item.getBoundingClientRect().right));
      assert.ok(tabs.every(right => right <= 390), `a tab is off screen: ${tabs}`);
      const fit = await mobile.evaluate(() => {
        const stage = document.querySelector('#map-stage').getBoundingClientRect();
        return document.querySelector('#atlas-map').viewBox.baseVal.height * document.querySelector('#atlas-map').getScreenCTM().d / stage.height;
      });
      assert.ok(fit > 0.8, `map fills only ${Math.round(fit * 100)}% of its stage`);
      for (const name of ['recap', 'characters', 'notes']) { await view(mobile, name); await assertNoHorizontalOverflow(mobile, `mobile ${name}`); }
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
