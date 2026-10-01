# Scout Atlas

An interactive, local Attack on Titan map companion built with HTML, CSS, JavaScript, and SVG. No build step, account, external dependency, or API key is required, and the page makes no network requests (a Content-Security-Policy enforces it).

**This edition stops at overall episode 47 (Season 3, episode 10).** It is configured for a viewer who has finished episode 47. Nothing from episode 48 or later is bundled: no later titles, places, people, identities, explanations, or images.

The content is a **selective recap of 22 milestones**, not a complete episode guide: overall episodes 1, 5, 8, 13, 16, 18, 22, 25, 28, 29, 31, 37 and every episode from 38 to 47. The viewing episode decides what the interface reveals; your completed-episode cutoff limits how far you can advance.

## Run it

Open `index.html` directly in a modern browser, or serve the folder:

```bash
cd /opt/odoo/odoo17/scripts/etc/js/scout-atlas
python3 -m http.server 8765 --bind 127.0.0.1
```

Then visit <http://127.0.0.1:8765>. Check first whether a server is already running on that port (`ss -ltnp | grep 8765`).

## What it does

- **Map.** Twelve places across the three walls, filling the stage. It follows the story: choosing an episode selects the place where it happens, rings it in brass and steps everything else back. Approximate places are dashed areas rather than precise pins. The land between Wall Maria and Wall Rose is hatched as lost from episode 2, and district gates show as breached or sealed at the right episodes. Wall names run along their walls. Pins, labels and portraits keep one on-screen size; labels move, drop their caption or hide rather than overlap, and never leave the map. Zoomed in, each place lists the episodes it appears in. Hovering a milestone in the timeline lights up its places, and new places fade in when you step episodes.
- **Portrait cards.** Point at a portrait on the map for a larger picture, where and when that person was recorded, and what happens there involving them. Click the portrait to pin the card (Escape or a click elsewhere closes it); on a phone, tap it. The card links to the full character card.
- **Characters.** Everyone the atlas knows about as of the viewing episode, grouped by regiment, with dated notes. Names and identities change at the episode that reveals them (for example, a Titan card shows who it turned out to be only from that episode on).
- **Portraits.** A picture next to every name: on the map, in event cards and in the character list. Main characters show official art that changes with the season; everyone else a drawn silhouette. See [Portraits](#portraits).
- **The story so far.** Every event up to the viewing episode, newest first. Events whose place is not established are listed as *not pinned on the map*.
- **Field notes.** One note per place per viewing episode. A place's earlier notes appear under the editor; later notes never show in earlier views.
- **Search** covers places (including alternative spellings such as Karanese or Wall Sheena), people and events, always within the viewing episode.

Keyboard: `/` search, `[` and `]` previous and next milestone. With the map focused: arrow keys move, `+` and `-` zoom, `0` resets. On a trackpad or mouse, hold Ctrl (⌘ on a Mac) and scroll to zoom; plain scrolling scrolls the page. On a phone, one finger scrolls the page and two fingers move or zoom the map.

The map separates **confirmed events**, **characters' beliefs**, and **approximate geography**. A portrait on the map means *last recorded here*, not live tracking; when a person's whereabouts are not established, they have no pin. All map proportions, terrain, and district outlines are schematic; cardinal positions of named districts are kept. This edition does not draw movement routes.

## Local storage

Notes and viewing/cutoff preferences use this browser's local storage, key `scout-atlas:v1`. Nothing is transmitted or synced between devices. Opening `index.html` directly and opening it through the local server use different storage. Two tabs can be open at once: each merges the other's notes instead of overwriting them. If the saved value ever cannot be read, it is kept under `scout-atlas:v1:unreadable:<time>` and the atlas starts fresh. When storage is unavailable, the interface still works, but notes last only for the session.

## Portraits

26 of the 28 people and Titans have a picture.
- **Main characters:** official character art from the anime's site, cropped to round portraits. Season 2 art is used up to episode 37 and Season 3 art from episode 38.
- **Supporting cast and three Titans:** Carla, Hannes, Pixis, Grisha, and the Colossal, Female and Beast Titans are cropped from official episode stills. Each still shows only from its own episode, so Grisha's (from episode 44) appears only from 44.
- **Faces the official pages never show up close:** Pastor Nick, Kenny, Rod, Marlo and Hitch use their character portraits from MyAnimeList or AniList.
- **No picture:** the Armored Titan and the smiling Titan keep a drawn Titan silhouette. No usable image exists without risking who they turn out to be.

The pictures are official or fan-database art kept for personal use, committed in `portraits/` (the scripts repo is private), so a fresh clone has them and nothing needs downloading. To re-create or re-crop them:

```bash
python3 scripts/etc/js/scout-atlas/portraits/fetch_portraits.py   # only to refresh; needs Pillow and the network
```

The script writes the images and [`portraits/portraits.js`](portraits/portraits.js). Each id maps to a file, or to a list of `{ from, file }` versions chosen by the viewing episode. To add your own picture, put it in `portraits/` and add a line, for example `rod: "rod.jpg"`. Supported: `.jpg`, `.jpeg`, `.png`, `.webp`, file names only; a file that fails to load falls back to the silhouette. **Use pictures from episodes you have already watched.** The data lint rejects season art listed before its season starts.

Character ids: `eren`, `mikasa`, `armin`, `levi`, `erwin`, `hange`, `jean`, `connie`, `sasha`, `historia`, `ymir`, `reiner`, `bertholdt`, `annie`, `hannes`, `pixis`, `nick`, `kenny`, `rod`, `marlo`, `hitch`, `grisha`, `carla`, `colossal`, `armored`, `female-titan`, `beast`, `smiling-titan`.

## Sources and spoiler boundaries

Summaries are short, original paraphrases. Season 1 milestones draw on the anime's [official episode summaries](https://shingeki.tv/season1/story/episode_01.php); Season 2 and 3 use the official [Season 2](https://shingeki.tv/season2/story/episode.php) and [Season 3](https://shingeki.tv/season3/story/) story pages, with licensed distributor listings, Attack on Titan Wiki pages and the Wikipedia season article for details the promotional summaries omit. Every episode, event, place, character and position carries a `sourceUrl` for provenance.

**External sources are not bounded by this app's spoiler cutoff.** They can contain later information. The app does not fetch or embed their contents.

Place cards contain only what is known at the episode they first appear. `firstEpisode` is this edition's visibility threshold, not a claim that something first appears in that exact episode. All curated content through episode 47 remains inspectable in the JavaScript source. Personal notes are user-authored and cannot be automatically certified free of spoilers.

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
node scripts/etc/js/scout-atlas/tests/data-lint.cjs    # 20 checks, ~30 ms, no browser
node scripts/etc/js/scout-atlas/tests/browser.cjs      # 31 checks, ~30 s, headless Chrome
ATLAS_URL=http://127.0.0.1:8765 node scripts/etc/js/scout-atlas/tests/browser.cjs
```

Run them from `/opt/odoo/odoo17` or anywhere else: Playwright resolves from the workspace's `node_modules`. The browser checks use `/usr/bin/google-chrome` (override with `CHROME=`) in isolated contexts and never touch your own browser's notes.

The data lint checks ids, references, seasons, geometry and kinds, and that **no text visible at episode N names a place, person or name version the atlas only introduces after N**. The browser checks cover episode boundaries (derived from the data, not a hand-written list), identities changing at their episode, unpinned events, portraits staying beside their own pin, label overlap at every milestone on desktop and laptop screens, notes across reloads and two tabs, the cutoff, search, map controls, wheel and keyboard, storage failures, portraits, phone layout, and that no request leaves the folder.

## Dataset structure

Every episode number is an **overall anime episode number**.

```js
{
  maxEpisode: 47,
  seasons: [{ season: 1, first: 1, last: 25 }, { season: 2, first: 26, last: 37 }, { season: 3, first: 38 }],
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
  status: [{ target: "gate:trost", from: 5, state: "breached", note: "…", sourceUrl: "https://…" }],  // or target "belt:maria-rose", state "lost"
  locations: [{
    id: "orvud", name: "Orvud District", subtitle: "Northern district · Wall Sina",
    x: 600, y: 274, firstEpisode: 45,
    kind: "district",   // district | village | castle | forest | wall | field | chapel | capital
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

Versioned lists (`name`, `role`, `faction`) use the entry with the latest `from` at or before the viewing episode. Coordinates use a `1200 × 920` canvas (the map shows the part around the walls, x 120–1080, y 0–832); wall ellipses are centred at `(600, 405)` with horizontal/vertical radii `440/365`, `298/246` and `162/131`.

## Extending it

Add episodes only after the viewer has finished them and names the new last episode. Then raise `maxEpisode`, add or extend the current `seasons` entry, write the milestones, places and character updates, and run both checks. Report additions by episode number, never by what happens in them. The step-by-step procedure is in `scripts/AIworkflows/etc/scout-atlas/LESSONS.md`.
