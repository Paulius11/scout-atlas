# Scout Atlas

An interactive, local Attack on Titan map companion built with HTML, CSS, JavaScript, and SVG. No build step, account, external dependency, or API key is required, and the page makes no network requests (a Content-Security-Policy enforces it).

**This edition covers the complete TV story: 87 regular episodes and both Final Chapters specials.** The user explicitly authorized the finale on 2026-10-05. The specials display as **SP1 / SP2** and use internal ordering 88 / 89 for visibility and saved viewing; they are not presented as ordinary E88 / E89.

The catalog has **87 regular episodes plus two long specials**, each with its own sourced recap. Season 4 is complete, with internal `last: 89` and `maxEpisode: 89`. There are 237 selected events, 21 places, 56 people and Titans, and three groups; 92 events retain unpinned event records. Twenty character entries own 146 dated positions. Six scene records provide four forest scenes and two final-special battle contexts separately from those histories. Fort Salta has an explicitly approximate area in southern Marley from SP1; its drawn centre and extent are illustrative, and its exact position remains unknown. The original finale addition changed no portraits or geometry, and all content records through E87 remain unchanged. **Viewing episode** is the only content control: all 89 entries are selectable, and content beyond the selected episode stays hidden. New visitors start at **E1**; returning visitors keep their saved episode.

## Run it

Open `index.html` directly in a modern browser, or serve the folder:

```bash
cd /opt/odoo/odoo17/scripts/etc/js/scout-atlas
python3 -m http.server 8765 --bind 127.0.0.1
```

Then visit <http://127.0.0.1:8765>. Check first whether a server is already running on that port (`ss -ltnp | grep 8765`).

## What it does

- **Reading layout.** The map opens directly with its area title and geography badge; the introductory **A scout’s field guide / Explore the atlas** block has been removed. **Viewing episode** sits in this map header, bringing the controls closer to the drawing and freeing space above it. The same picker remains available in Story, People and the expanded map. Atlas settings and its separate Spoiler limit have been removed, alongside the earlier Watch progress panel, progress bar and repeated status. The gallery expansion icon sits beside the page heading on phones, leaving character search its own full-width row. Place events use fine dividers; Story features the latest recorded moment above its supporting entries. **Map / Story / People** navigation stays at the bottom on phones, with room beneath content and above system gestures.
- **Viewing episode.** Choose any entry from E1 through SP2. The selected episode controls Map, Story, People, search and expanded views; earlier episodes hide later geography, identities, observations and events. A fresh browser starts at E1, and an existing save keeps its viewing episode. Tabs can explore different episodes without changing each other's view.
- **Episode titles.** Full English titles for the 87 regular episodes and both specials appear in the episode picker, milestone timeline and recap heading. Specials use SP1 / SP2 throughout episode labels, dated observations, character details and expanded views. Every catalog entry has a sourced recap and a timeline entry. The later seven-part streaming cut of the finale is not duplicated in the catalog.
- **Expanded map.** The expand icon beside the zoom and reset controls opens the map across the window, with episode controls, search and selected-place details. **Layers & style** holds the existing switches and palette choices. Pan, zoom, portraits and milestone shortcuts continue to work. Use **Back to atlas** or Escape to return; the selected place, episode and zoom are kept. Escape dismisses an open menu, search result or portrait card first. On a tall phone screen, compact controls leave more room for the drawing, which fills the available height and can be panned across.
- **Place details.** Desktop panels collapse with **Hide details**, giving the map more room. On a phone, the selected place appears in a compact bottom panel with its latest recorded event. Tap **More** or swipe up for the full story; tap **Less** or swipe down to continue exploring. The full panel scrolls independently and leaves part of the map visible.
- **Map areas.** **Walls / Island / World / Liberio** lets you explore the walled territory, the coast, the relationship across the sea and local mainland places at readable scales. World and Liberio unlock at episode 57. World shows Paradis, sea and mainland together under **Across the sea**, with **Approximate geography**. Liberio uses a separate **Schematic city** diagram, including its hospital from episode 62 and festival square and basement from 63. The area buttons have their own toolbar row on small screens and also work in the expanded map.
- **Episode focus.** Changing the episode opens its relevant area automatically, whether you use the picker, previous/next controls, keyboard shortcuts or timeline. You can switch areas manually, and that choice is saved. Place links and pinned search results open their target area; a setting without a supported local anchor uses broad context rather than a guessed pin. Explicit focus opens Liberio at E66, World with departure context at E67, and Island/Paradis at E68–74. Both final specials open World with Fort Salta selected. Flashbacks and secondary scenes do not override that main setting.
- **Forest scenes this episode.** A compact strip above the map names the current forest setting and event, with portraits that open character details and a link to the recorded event. Unpinned events open their recap; E72 retains the historical Ragako place link for the earlier account. The exact-position-unknown note makes clear why no new pin appears. It is available in Walls and Island with the People layer on and moves with the controls into the expanded map. Selecting the existing expedition-forest place also shows its related episode scene in the place panel. Related context does not establish that the settings are the same physical forest; scene appearances remain separate from dated last-recorded map positions.
- **Final-battle context.** From SP1, World shows a dashed **Fort Salta · exact position unknown** area in southern Marley. Selecting it opens the setting details. A single scene card for the selected special names the battle setting, links to its recorded recap and offers clickable portraits of its relevant battle participants. These portraits describe episode appearances rather than last-recorded map positions; other settings, visions and later scenes are excluded. The uncertainty caption stays visible while zooming. In the expanded map, the scene card scrolls within a limited height so it leaves room for the drawing. Both SP1 and SP2 focus this area automatically, with manual area switching and **Back to this episode** available.
- **Back to this episode.** The labelled button on the map returns to the current episode's area and place and resets its camera, without changing the viewing episode. It appears after exploring away in normal and expanded views and stays hidden when already focused or no supported setting exists. On phones it yields while Key is open and returns when Key closes; the legend scrolls within the available space and clears background labels while open; the overview sits above the zoom controls so both remain usable.
- **Place symbols.** Liberio's hospital uses a medical cross, the festival square a pennant and the basement descending stairs. These symbols retain their screen size while zooming, their full accessible place names and the dashed rings for approximate positions. The hospital's short map label avoids repeating the city name.
- **Map overview and detail.** Zooming out simplifies secondary names and portraits; keyboard focus still exposes a place's name. Zooming in reveals full episode captions. A small overview inset follows the current area when zoomed in or cropped by a tall expanded window. Click it to reset that area's view.
- **Changes this episode.** Highlight the current episode's recorded events, newly known places and gate or territory changes. A compact list explains each item and opens established places. Events without a known location stay unpinned; episodes with no recorded changes say so explicitly.
- **Map styles.** The sun and moon buttons in the main navigation select **Parchment** for warm paper and ink details or **Night** for a dark field map. They sit at the bottom of the desktop sidebar and beside the brand on phones. The place panel, decorative drawings, timeline, Story and People views follow the same palette. The expanded map keeps these choices in **Layers & style**. The initial style follows your system preference, and your choice is saved in this browser. Switching preserves the selected place, zoom and episode. Open **Key** when you need the legend. The footer's **How to read this map** opens the reading guide; its duplicate sidebar button and fan-project paragraph have been removed.
- **Map geography.** The walls are circular and use the episode-one radii: Sina 250 km, Rose 380 km and Maria 480 km, so the gaps are 130 km and 100 km. A distance bar follows that stated scale; World and Liberio do not claim surveyed distances. District sizes and local place positions remain illustrative. The island outline retains its trace from the episode-57 map, which also supplies the relationship across the sea. The island view fits the whole coast in normal and expanded windows, including phones. Its distance from the walls is approximate; the sea marker represents the coast generally. Episode 59 adds one illustrative patch of coastal sand, whose extent is unknown. Liberio's streets and spacing between local places are explicitly schematic. Fort Slava has mainland context but no invented map position. The territory between Maria and Rose is hatched as lost from episode 2 until episode 59. Gates reflect the recorded breaches and repairs. Pins keep one screen size, and crowded labels can use short leader lines. Portraits stay closer to their own place than neighbouring pins.
- **Portrait cards.** Point at a portrait on the map for a larger picture, where and when that person was recorded, and what happens there involving them. Click the portrait to pin the card (Escape or a click elsewhere closes it); on a phone, tap it. The card links to that person's gallery and detail panel.
- **Characters.** **Everyone** remains the default continuous compact portrait grid; faction filters keep their counts and let you narrow the list. Five columns fit a typical desktop gallery; phones use two. **This episode** shows individuals named in the selected episode's recorded events, with one sentence explaining each person's involvement. This view covers the atlas's recorded participants rather than a complete episode cast. Its horizontal cards use at least 250 px on desktop and one column on phones so the full sentence remains visible. Everyone, This episode and faction chips select exclusive views; search narrows the selected view. Select anywhere on a character card, or use Enter or Space, to read the full role, latest three dated observations and last recorded place link in a detail panel: at the right side of the window on desktop, or as a bottom sheet on phones. Older observations fold into **Earlier**. Closing the panel returns keyboard focus to the card and keeps the gallery's scroll position and filters. **Expand gallery** opens the Characters tab across the window with the same search and views; use **Back to gallery** or Escape to return. Names, identities, portraits and all details follow the viewing episode.
- **Season 4 records.** Regular episodes 60–87 and both final specials have sourced recaps and dated character updates. SP1 adds seven events, 22 curated involvement entries and 18 profile notes; SP2 adds nine events, 22 involvement entries and 22 profile notes. Faction filters appear only when their members are known. Later observations clear older map positions when the person is elsewhere or their whereabouts are unknown. From episode 80, the wall circles show dashed former boundaries, explained in **Key**; earlier episodes restore their original appearance.
- **Portraits.** All 56 people and Titans have a bundled picture by episode 87, used in the gallery, detail panels, events and map. Pictures follow their own safe episode threshold; an earlier view can show a silhouette until an image is established. Groups keep regiment emblems. See [Portraits](#portraits).
- **The story so far.** Every event up to the viewing episode, newest first. Verified setting names also appear for events listed as *not pinned on the map*, without invented coordinates. Flashbacks and planned destinations are distinguished from current observations.
- **Search** covers places (including alternative spellings such as Karanese or Wall Sheena), people and all events, always within the viewing episode. An unpinned result opens its matching recap and places keyboard focus there, including when searching an expanded map.

Keyboard: `/` search, `[` and `]` previous and next milestone. With the map focused: arrow keys move, `+` and `-` zoom, `0` resets. On a trackpad or mouse, hold Ctrl (⌘ on a Mac) and scroll to zoom; plain scrolling scrolls the page. On a phone, one finger scrolls the page and two fingers move or zoom the map.

The map separates **confirmed events**, **characters' beliefs**, and **approximate geography**. A portrait on the map means *last recorded here*, not live tracking; when a person's whereabouts are not established, they have no pin. Wall radii share one stated scale; island and world distances, city streets, terrain, local coordinates and district outlines remain approximate. A schematic place anchor establishes a setting, not a surveyed coordinate. Cardinal positions of named districts are kept. This edition does not draw movement routes.

## Local storage

Map style, layers, manual map area and viewing episode use this browser's local storage, key `scout-atlas:v1`. A valid saved `viewing` value takes priority. An older save with no viewing value can use its legacy `cutoff` as the initial viewing episode; otherwise the atlas starts at E1. That value is clamped to the catalog. New saves omit the old `cutoff` and `edition` fields; an edition update does not advance the selected episode. Each open tab keeps its own active episode and preferences, so exploring in one tab does not change another. Styles and layers remain available and saved locally; nothing is transmitted or synced between devices. Opening `index.html` directly and opening it through the local server use different storage. If the saved value cannot be read, it is kept under `scout-atlas:v1:unreadable:<time>` and the atlas starts fresh at E1. Exploration still works when storage is unavailable. The Field notes tab and place-note editors have been removed; existing notes remain in storage without being displayed or modified, including notes saved by another tab.

## Portraits

All 56 people and Titans have pictures by episode 87, across 71 image versions. The 30 previously missing entries now have portraits, and three groups retain their regiment emblems. The portrait folder is about 3.5 MB and works offline.

- **Main characters:** the existing official Season 2 and Season 3 art remains. Season 2 art stands in for the early episodes; Season 3 art appears from episode 38.
- **Supporting cast:** official character thumbnails and reviewed fan-database portraits fill the remaining faces. Hannes and Grisha now have pictures from episode 1, and Historia from episode 4. Carla's earlier crop showed Mikasa; it has been replaced with a reviewed Carla portrait.
- **Titans:** reviewed episode frames show the Titan forms without revealing an identity early. The Female Titan now has an image from episode 17. The four-legged Titan's image starts at episode 55, after its atlas introduction at 54; the War Hammer image starts at 65, after its name is known at 61. Those earlier views intentionally keep a silhouette.
- **Source framing:** 35 additional image files keep their downloaded bytes unchanged. [`additional-sources.json`](portraits/additional-sources.json) records each source URL, review date, SHA-256 hash, safe episode, `crop` and `sourceSize`, with episode references where needed. SVG frames the face from that metadata rather than rewriting the image. Existing cropped portrait files remain in use.

The pictures are official or fan-database art kept for personal use in `portraits/` (the scripts repo is private), so a fresh clone has them and nothing needs downloading. To refresh source files and rebuild the manifest, or rebuild only the local metadata:

```bash
python3 scripts/etc/js/scout-atlas/portraits/fetch_portraits.py   # refresh; needs Pillow and the network
python3 scripts/etc/js/scout-atlas/portraits/fetch_portraits.py --manifest-only   # offline metadata rebuild
```

The script reads both the legacy crop recipes and the additional source catalog, so regeneration keeps the supporting cast. It writes [`portraits/portraits.js`](portraits/portraits.js); `--manifest-only` uses existing files and makes no downloads or image changes. Each id maps to a file, or to `{ from, file, crop?, sourceSize? }` versions chosen by the viewing episode. Add reviewed new images to the source catalog with their safe threshold and provenance, then rebuild the manifest. Supported: `.jpg`, `.jpeg`, `.png`, `.webp`, file names only; a file that fails to load falls back to the silhouette. **Use pictures within the viewer's authorized episode range.** The data lint rejects season art or episode stills listed before their safe episode, validates framing and requires a bundled picture for every person and Titan by the edition ceiling.

Character ids: `eren`, `mikasa`, `armin`, `levi`, `erwin`, `hange`, `jean`, `connie`, `sasha`, `historia`, `ymir`, `reiner`, `bertholdt`, `annie`, `hannes`, `pixis`, `nick`, `kenny`, `rod`, `marlo`, `hitch`, `keith`, `grisha`, `dina`, `zeke`, `kruger`, `carla`, `colossal`, `armored`, `female-titan`, `beast`, `four-legged-titan`, `smiling-titan`, `gabi`, `falco`, `colt`, `magath`, `udo`, `zofia`, `pieck`, `porco`, `willy`, `tybur-sister`, `kiyomi`, `yelena`, `onyankopon`, `niccolo`, `floch`, `kaya`, `louise`, `xaver`, `founder-ymir`, `marcel`, `ramzi`, `jaw-titan`, `war-hammer`.

## Sources and spoiler boundaries

Summaries are short, original paraphrases. Season 1 milestones draw on the anime's [official episode summaries](https://shingeki.tv/season1/story/episode_01.php); Season 2 and 3 use the official [Season 2](https://shingeki.tv/season2/story/episode.php) and [Season 3](https://shingeki.tv/season3/story/) story pages, with licensed distributor listings, Attack on Titan Wiki pages and season episode tables for details the promotional summaries omit. Episodes 60–87 were checked against the [official Final Season metadata](https://shingeki.tv/final/story/episode_data.php), the bounded English episode table and individual episode references. Every episode, event, place, character and position carries a `sourceUrl` for provenance; new character observations also carry their own source.

**External sources are not bounded by the viewing episode.** They can contain later information. The app does not fetch or embed their contents.

On 2026-10-05, the viewer explicitly authorized both Final Chapters specials. This supersedes the earlier E74 research boundary and permits finale recaps and character updates. On 2026-10-06, the viewer chose to remove Atlas settings and use Viewing episode as the sole display boundary, retain the current picker layout and start new visitors at E1. They also approved an approximate Fort Salta area, a scene card with clickable battle participants and automatic focus in both specials. This is a labelled regional illustration, not a verified coordinate. Existing viewing and map preferences remain.

Place cards contain only what is known at the entry where they first appear. `firstEpisode` is this edition's ordered visibility threshold, not a claim that something first appears at that exact point. All curated content, including both final specials, remains inspectable in the JavaScript source.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure, map artwork, dialogs, Content-Security-Policy |
| `styles.css` | Layout, type, regiment colours, responsive rules |
| `app.js` | Rendering, episode filtering, label layout, camera, local state |
| `data.js` | Seasons, milestones, places, characters and positions |
| `portraits/portraits.js` | Which picture each character shows, by episode |
| `portraits/additional-sources.json` | Reviewed source URLs, hashes, episode thresholds and face framing |
| `portraits/fetch_portraits.py` | Refreshes images and rebuilds the manifest; `--manifest-only` works offline |
| `tests/data-lint.cjs` | Data checks, including the spoiler boundary |
| `tests/browser.cjs` | Browser regression checks |

`data.js` and `portraits/portraits.js` are classic scripts assigning globals, so the page works on both `file://` and HTTP. Both must load before `app.js`.

## Checks

```bash
node scripts/etc/js/scout-atlas/tests/data-lint.cjs    # 38 checks, no browser
node scripts/etc/js/scout-atlas/tests/browser.cjs      # headless Chrome
ATLAS_URL=http://127.0.0.1:8765 node scripts/etc/js/scout-atlas/tests/browser.cjs
```

Run them from `/opt/odoo/odoo17` or anywhere else: Playwright resolves from the workspace's `node_modules`. The browser checks use `/usr/bin/google-chrome` (override with `CHROME=`) in isolated contexts and never touch your own browser's saved preferences.

Fort Salta verification completed on 2026-10-07: syntax and all 38 data checks pass. Fourteen focused file and 14 HTTP browser checks pass; the final area-click and drag checks pass six cases on each transport. The geometry review passes 24 states across 320, 390 and 1440 px, both palettes, both specials and normal/expanded maps. Six final mouse and keyboard interaction checks also pass, with no page errors or layout issues. These are geometry and interaction checks; no axe audit or fresh full browser-suite run was performed in this pass. The [workflow archive](../../../AIworkflows/etc/scout-atlas/ARCHIVE.md#fort-salta-context) records the corrections and full verification scope.

The data lint checks ids, references, seasons, geometry and kinds, and that **no text visible at episode N names a place, person or name version the atlas only introduces after N**. The browser checks cover map-area reveal boundaries, automatic episode focus, manual switching, navigation between areas and city label/portrait separation, episode boundaries (derived from the data, not a hand-written list), identities changing at their episode, unpinned events, portraits staying beside their own pin, label overlap at every milestone on desktop and laptop screens, removal of field notes and Atlas settings, retention of legacy saved data, first-visit E1, full catalog availability, saved-viewing migration, independent tab viewing, search, map controls, wheel and keyboard, storage failures, saved map styles, full episode titles, expanded maps and galleries, filter and focus restoration, gallery density, expanded-map episode updates, progressive map detail, overview tracking, episode changes, phone panel taps and swipes, portraits, character-card keyboard access and detail panels, phone navigation staying reachable without covering content, phone layout, and that no request leaves the folder.

## Dataset structure

Regular episode numbers are **overall anime episode numbers**. The two final specials use
internal ordering 88 / 89 and display as SP1 / SP2; those ordered values are not ordinary episode
labels for the alternative seven-part streaming cut.

```js
{
  maxEpisode: 89,
  seasons: [{ season: 1, first: 1, last: 25 }, { season: 2, first: 26, last: 37 }, { season: 3, first: 38, last: 59 }, { season: 4, first: 60, last: 89 }],
  episodes: [{
    id: "episode-43", number: 43, title: "Sin", shortTitle: "Under the chapel",
    description: "An episode-specific orientation.", sourceUrl: "https://…",
    mapFocus: { area: "walls", locationId: "reiss-chapel" }, // optional explicit focus; keeps a flashback from choosing the area
    events: [{
      id: "episode-43-event-1",
      locationId: "reiss-chapel",          // or null when the place is not established
      placeName: "…",                      // optional verified setting, including unpinned events
      people: ["eren", "historia", "rod"], // shown as portraits
      title: "…", summary: "…", connection: "…",
      kind: "confirmed",                   // confirmed | belief | approximate
      sourceUrl: "https://…"
    }]
  }],
  status: [{ target: "gate:trost", from: 4, state: "breached", note: "…", sourceUrl: "https://…" }],  // also "belt:maria-rose" / "lost" or "held", and "walls:all" / "fallen"
  locations: [{
    id: "orvud", name: "Orvud District", subtitle: "Northern district · Wall Sina",
    x: 600, y: 196.6667, firstEpisode: 45,
    kind: "district",   // district | village | castle | forest | wall | field | chapel | capital | sea | island | country | city | site
    mapArea: "walls",  // optional; walls by default, or island | world | liberio
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

Versioned lists (`name`, `role`, `faction`) use the entry with the latest `from` at or before the viewing episode. Wall places use the original `1200 × 920` coordinate area. `mapGeometry` is the shared source for circular wall radii, main and overview SVGs, name paths, the wall distance scale, island outline and separate `worldView`/`liberioView` extents. The walls are centred at `(600, 405)` and use `5/6` SVG units per kilometre. The coast has a wider extent, so its marker can sit outside the wall coordinate area. `mapArea` defaults to `walls`; the sea belongs to `island`, country/island overview anchors to `world`, and the city and local sites to `liberio`. `worldPosition` supplies a separate overview anchor when a place also belongs to a local diagram. `regionId` gives context without establishing a precise pin; `mapAccuracy` and `geographyNote` explain schematic placement. A location can use `opensMap: "island"` for a drill-down link. Geography references are recorded in `mapGeometry`; the app never fetches them.

Optional event `mapScene` metadata contains `relatedLocationId`, `name`, `mapArea` and `geography` for unpinned episode settings. Optional `people` selects scene-specific participants instead of the event list, and `description` explains the context; neither assigns a geographical position. It drives the scene strip and related place-panel context, without assigning `locationId` or changing character `positions`. An episode's optional `characterInvolvement` map provides exact-episode one-sentence explanations for This episode cards; otherwise the renderer uses an exact-episode character note, then neutral event-title context. Participation comes from `events[].people` and excludes group entries.

The two final entries have `number: 88` / `89` and `displayCode: "SP1"` / `"SP2"`. Numbers order visibility and storage; display codes label the UI. Both specials focus the labelled approximate Fort Salta area in World. Its illustrative centre and extent locate regional context only; event `locationId` values and dated character `positions` remain unchanged. Odiha retains unpinned context. The [official two-part announcement](https://shingeki.tv/news/archives/7606) and [divided-release announcement](https://shingeki.tv/news/archives/8042) explain why this catalog adds two long specials instead of seven duplicate streaming cuts.

## Extending it

Add episodes only within the viewer's authorized range: a completed episode number or an explicit request to include a range is enough. Then raise `maxEpisode`, add or extend the current `seasons` entry, write the milestones, places and character updates, and run both checks. Report additions by episode number, never by what happens in them. The step-by-step procedure is in `scripts/AIworkflows/etc/scout-atlas/LESSONS.md`.
