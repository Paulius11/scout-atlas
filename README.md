# Scout Atlas

An interactive, local Attack on Titan map companion built with HTML, CSS, JavaScript, and SVG. No build step, account, external dependency, or API key is required, and the page makes no network requests (a Content-Security-Policy enforces it).

**This edition stops at overall episode 59, the end of Season 3.** It is configured for a viewer who has finished episode 59. Nothing from episode 60 or later is bundled: no later titles, places, people, identities, explanations, or images.

The content covers **all 59 episodes in Seasons 1–3**, with 136 selected events. Each episode has its own recap; some events have no established map position. The viewing episode decides what the interface reveals; your completed-episode cutoff limits how far you can advance.

## Run it

Open `index.html` directly in a modern browser, or serve the folder:

```bash
cd /opt/odoo/odoo17/scripts/etc/js/scout-atlas
python3 -m http.server 8765 --bind 127.0.0.1
```

Then visit <http://127.0.0.1:8765>. Check first whether a server is already running on that port (`ss -ltnp | grep 8765`).

## What it does

- **Reading layout.** A compact heading aligns the title, episode picker and spoiler badge on one desktop row, with responsive controls on smaller screens. Place events use fine dividers; Story features the latest recorded moment above its supporting entries. On phones, **Map / Story / People** navigation stays at the bottom, with room beneath content and above system gestures.
- **Episode titles.** Full English titles for every episode from 1 to 59 appear in the episode picker, milestone timeline and recap heading. Every episode has a sourced recap and an entry in the timeline.
- **Expanded map.** The expand icon beside the zoom and reset controls opens the map across the window, with episode controls, search and selected-place details. **Layers & style** holds the existing switches and palette choices. Pan, zoom, portraits and milestone shortcuts continue to work. Use **Back to atlas** or Escape to return; the selected place, episode and zoom are kept. Escape dismisses an open menu, search result or portrait card first. On a tall phone screen, the drawing fills the available height and can be panned across.
- **Place details.** Desktop panels collapse with **Hide details**, giving the map more room. On a phone, the selected place appears in a compact bottom panel with its latest recorded event. Tap **More** or swipe up for the full story; tap **Less** or swipe down to continue exploring. The full panel scrolls independently and leaves part of the map visible.
- **Map overview and detail.** Zooming out simplifies secondary names and portraits; keyboard focus still exposes a place's name. Zooming in reveals full episode captions. A small overview inset shows the visible area inside the walls when zoomed in or cropped by a tall expanded window. Click it to reset the view.
- **Changes this episode.** Highlight the current episode's recorded events, newly known places and gate or territory changes. A compact list explains each item and opens established places. Events without a known location stay unpinned; episodes with no recorded changes say so explicitly.
- **Map styles.** Choose **Parchment** for warm paper and ink details, or **Night** for a dark field map. The place panel, decorative drawings, timeline, Story and People views follow the same palette. The switch is in the map toolbar on desktop and phone. The initial style follows your system preference, and your choice is saved in this browser. Switching preserves the selected place, zoom and episode. Open **Key** when you need the legend.
- **Map.** Fourteen places across the three walls and the coast. The walls are circular and use the episode-one radii: Sina 250 km, Rose 380 km and Maria 480 km, so the gaps are 130 km and 100 km. A distance bar follows the camera. District sizes and local place positions remain illustrative. From episode 57, **Walls / Island** switches between the detailed walled territory and the wider island outline, traced from the map in that episode. The island view fits the whole coast in normal and expanded windows, including phones. Its distance from the walls is approximate; the sea marker represents the coast generally. Episode 59 adds one illustrative patch of coastal sand, whose extent is unknown. The territory between Maria and Rose is hatched as lost from episode 2 until episode 59. Gates reflect the recorded breaches and repairs. Pins keep one screen size, and crowded labels can use short leader lines. Portraits stay closer to their own place than neighbouring pins.
- **Portrait cards.** Point at a portrait on the map for a larger picture, where and when that person was recorded, and what happens there involving them. Click the portrait to pin the card (Escape or a click elsewhere closes it); on a phone, tap it. The card links to the full character card.
- **Characters.** Compact portrait cards for everyone the atlas knows about as of the viewing episode, grouped by regiment. Five columns fit a typical desktop gallery; phones use two. Open **About** for the full role, dated story observations and recorded place links, and **Earlier** for longer histories. **Expand gallery** opens the Characters tab across the window with the same search and group filters. Use **Back to gallery** or Escape to return; filters and keyboard focus are preserved. Names and identities change at the episode that reveals them (for example, a Titan card shows who it turned out to be only from that episode on).
- **Portraits.** A picture next to every name: on the map, in event cards and in the character list. Main characters show official art that changes with the season; everyone else a drawn silhouette. See [Portraits](#portraits).
- **The story so far.** Every event up to the viewing episode, newest first. Events whose place is not established are listed as *not pinned on the map*.
- **Search** covers places (including alternative spellings such as Karanese or Wall Sheena), people and events, always within the viewing episode.

Keyboard: `/` search, `[` and `]` previous and next milestone. With the map focused: arrow keys move, `+` and `-` zoom, `0` resets. On a trackpad or mouse, hold Ctrl (⌘ on a Mac) and scroll to zoom; plain scrolling scrolls the page. On a phone, one finger scrolls the page and two fingers move or zoom the map.

The map separates **confirmed events**, **characters' beliefs**, and **approximate geography**. A portrait on the map means *last recorded here*, not live tracking; when a person's whereabouts are not established, they have no pin. Wall radii share one stated scale; island distances, terrain, local coordinates and district outlines remain approximate. Cardinal positions of named districts are kept. This edition does not draw movement routes.

## Local storage

Map style and viewing/cutoff preferences use this browser's local storage, key `scout-atlas:v1`. When a new edition extends the atlas, a browser that was caught up with the previous edition moves its cutoff up to the new last episode and says so; one set to an earlier episode keeps its limit. Nothing is transmitted or synced between devices. Opening `index.html` directly and opening it through the local server use different storage. If the saved value cannot be read, it is kept under `scout-atlas:v1:unreadable:<time>` and the atlas starts fresh. Exploration still works when storage is unavailable. The Field notes tab and place-note editors have been removed; existing notes remain in storage without being displayed or modified.

## Portraits

26 of the 33 people and Titans have a picture.
- **Main characters:** official character art from the anime's site, cropped to round portraits. Season 2 art is used up to episode 37 and Season 3 art from episode 38.
- **Supporting cast and three Titans:** Carla, Hannes, Pixis, Grisha, and the Colossal, Female and Beast Titans are cropped from official episode stills. Each still shows only from its own episode, so Grisha's (from episode 44) appears only from 44.
- **Faces the official pages never show up close:** Pastor Nick, Kenny, Rod, Marlo and Hitch use their character portraits from MyAnimeList or AniList.
- **No picture:** the Armored Titan and the smiling Titan keep a drawn Titan silhouette. No usable image exists without risking who they turn out to be.
- **Not yet pictured:** Keith Shadis, Dina, Zeke and Kruger keep their emblems, and the four-legged Titan (from episode 54) a silhouette. The official Season 3 character list has no art for them, and Titans are never looked up by name.

The pictures are official or fan-database art kept for personal use, committed in `portraits/` (the scripts repo is private), so a fresh clone has them and nothing needs downloading. To re-create or re-crop them:

```bash
python3 scripts/etc/js/scout-atlas/portraits/fetch_portraits.py   # only to refresh; needs Pillow and the network
```

The script writes the images and [`portraits/portraits.js`](portraits/portraits.js). Each id maps to a file, or to a list of `{ from, file }` versions chosen by the viewing episode. To add your own picture, put it in `portraits/` and add a line, for example `rod: "rod.jpg"`. Supported: `.jpg`, `.jpeg`, `.png`, `.webp`, file names only; a file that fails to load falls back to the silhouette. **Use pictures from episodes you have already watched.** The data lint rejects season art listed before its season starts.

Character ids: `eren`, `mikasa`, `armin`, `levi`, `erwin`, `hange`, `jean`, `connie`, `sasha`, `historia`, `ymir`, `reiner`, `bertholdt`, `annie`, `hannes`, `pixis`, `nick`, `kenny`, `rod`, `marlo`, `hitch`, `keith`, `grisha`, `dina`, `zeke`, `kruger`, `carla`, `colossal`, `armored`, `female-titan`, `beast`, `four-legged-titan`, `smiling-titan`.

## Sources and spoiler boundaries

Summaries are short, original paraphrases. Season 1 milestones draw on the anime's [official episode summaries](https://shingeki.tv/season1/story/episode_01.php); Season 2 and 3 use the official [Season 2](https://shingeki.tv/season2/story/episode.php) and [Season 3](https://shingeki.tv/season3/story/) story pages, with licensed distributor listings, Attack on Titan Wiki pages and the Wikipedia season article for details the promotional summaries omit. Every episode, event, place, character and position carries a `sourceUrl` for provenance.

**External sources are not bounded by this app's spoiler cutoff.** They can contain later information. The app does not fetch or embed their contents.

Place cards contain only what is known at the episode they first appear. `firstEpisode` is this edition's visibility threshold, not a claim that something first appears in that exact episode. All curated content through episode 59 remains inspectable in the JavaScript source.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure, map artwork, dialogs, Content-Security-Policy |
| `styles.css` | Layout, type, regiment colours, responsive rules |
| `app.js` | Rendering, episode filtering, label layout, camera, local state |
| `data.js` | Seasons, milestones, places, characters and positions |
| `portraits/portraits.js` | Which picture each character shows, by episode |
| `portraits/fetch_portraits.py` | Re-creates the committed portrait images (download and crop) |
| `tests/data-lint.cjs` | Data checks, including the spoiler boundary |
| `tests/browser.cjs` | Browser regression checks |

`data.js` and `portraits/portraits.js` are classic scripts assigning globals, so the page works on both `file://` and HTTP. Both must load before `app.js`.

## Checks

```bash
node scripts/etc/js/scout-atlas/tests/data-lint.cjs    # 23 checks, ~30 ms, no browser
node scripts/etc/js/scout-atlas/tests/browser.cjs      # 45 checks, headless Chrome
ATLAS_URL=http://127.0.0.1:8765 node scripts/etc/js/scout-atlas/tests/browser.cjs
```

Run them from `/opt/odoo/odoo17` or anywhere else: Playwright resolves from the workspace's `node_modules`. The browser checks use `/usr/bin/google-chrome` (override with `CHROME=`) in isolated contexts and never touch your own browser's saved preferences.

The data lint checks ids, references, seasons, geometry and kinds, and that **no text visible at episode N names a place, person or name version the atlas only introduces after N**. The browser checks cover episode boundaries (derived from the data, not a hand-written list), identities changing at their episode, unpinned events, portraits staying beside their own pin, label overlap at every milestone on desktop and laptop screens, removal of field notes, retention of legacy saved data, cutoff synchronization between tabs, the cutoff, search, map controls, wheel and keyboard, storage failures, saved map styles, full episode titles, expanded maps and galleries, filter and focus restoration, gallery density, expanded-map tools and cutoff updates, progressive map detail, overview tracking, episode changes, phone panel taps and swipes, portraits, keyboard access to character disclosures, phone navigation staying reachable without covering footer controls, phone layout, and that no request leaves the folder.

## Dataset structure

Every episode number is an **overall anime episode number**.

```js
{
  maxEpisode: 59,
  seasons: [{ season: 1, first: 1, last: 25 }, { season: 2, first: 26, last: 37 }, { season: 3, first: 38, last: 59 }],   // a season in progress has no `last`
  episodes: [{
    id: "episode-43", number: 43, title: "Sin", shortTitle: "Under the chapel",
    description: "An episode-specific orientation.", sourceUrl: "https://…",
    events: [{
      id: "episode-43-event-1",
      locationId: "reiss-chapel",          // or null when the place is not established
      people: ["eren", "historia", "rod"], // shown as portraits
      title: "…", summary: "…", connection: "…",
      kind: "confirmed",                   // confirmed | belief | approximate
      sourceUrl: "https://…"
    }]
  }],
  status: [{ target: "gate:trost", from: 4, state: "breached", note: "…", sourceUrl: "https://…" }],  // or target "belt:maria-rose", state "lost"
  locations: [{
    id: "orvud", name: "Orvud District", subtitle: "Northern district · Wall Sina",
    x: 600, y: 196.6667, firstEpisode: 45,
    kind: "district",   // district | village | castle | forest | wall | field | chapel | capital | sea
    label: { side: "left" },   // optional: right (default) | left | below
    area: { rx: 40, ry: 30 },  // optional: approximate places are drawn as a dashed area (map units)
    aliases: ["Orvud"],        // searched, never shown
    summary: "…", why: "…", geography: "…", tags: ["Wall Sina"], sourceUrl: "https://…"
  }],
  characters: [{
    id: "historia", type: "person",   // person | titan | group
    firstEpisode: 16,
    name: [{ from: 16, text: "Krista Lenz" }, { from: 30, text: "Historia" }, { from: 40, text: "Historia Reiss" }],
    role: [{ from: 16, text: "Survey Corps, 104th" }],
    faction: [{ from: 16, key: "survey" }],   // colours the portrait
    aliases: ["Krista"],
    notes: [{ episode: 40, text: "Rod Reiss says he is her father." }],
    positions: [{ episode: 43, locationId: "reiss-chapel", note: "…", sourceUrl: "https://…" }],
    revealedAs: { episode: 24, id: "annie" },   // titans only
    sourceUrl: "https://…"
  }]
}
```

Versioned lists (`name`, `role`, `faction`) use the entry with the latest `from` at or before the viewing episode. Local places use a `1200 × 920` coordinate area. `mapGeometry` is the shared source for circular wall radii, the main and overview SVGs, name paths, the distance scale, and the island outline. The walls are centred at `(600, 405)` and use `5/6` SVG units per kilometre. The coast has a separate wider extent, so its marker can sit outside the local coordinate area. Geography references are recorded in `mapGeometry`; the app never fetches them.

## Extending it

Add episodes only after the viewer has finished them and names the new last episode. Then raise `maxEpisode`, add or extend the current `seasons` entry, write the milestones, places and character updates, and run both checks. Report additions by episode number, never by what happens in them. The step-by-step procedure is in `scripts/AIworkflows/etc/scout-atlas/LESSONS.md`.
