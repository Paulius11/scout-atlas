#!/usr/bin/env python3
"""Download the official character thumbnails, crop them to square portraits, and write portraits.js.

    python3 portraits/fetch_portraits.py          # needs network once, and Pillow (system python3 has it)

The images are official promotional art from shingeki.tv, kept for personal use: they are git-ignored
(see .gitignore) and never committed. Run this again on another machine instead of copying them.

Spoiler boundary: each season's art is shown only from that season's first episode, so a later design
never appears while the viewer looks at an earlier episode. Add a season here only once the viewer has
reached it. Only the ids below are fetched; nothing else on the official sites is read.
"""
import io
import json
import pathlib
import re
import urllib.request

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
SIZE = 160  # px; the largest avatar is 54 px, so this is sharp at 2x and 3x
# atlas id -> file key on the official site
SEASON_2 = {  # https://shingeki.tv/season2/character/img/thumb_<key>.jpg, 240x260, head and shoulders
    'eren': 'eren', 'mikasa': 'mikasa', 'armin': 'armin', 'jean': 'jean', 'annie': 'annie', 'sasha': 'sasha',
    'historia': 'krista', 'connie': 'connie', 'reiner': 'reiner', 'bertholdt': 'bertolt', 'ymir': 'ymir',
    'levi': 'levi', 'erwin': 'erwin', 'hange': 'zoe',
}
SEASON_3 = {  # https://shingeki.tv/season3/character/img/thumb_<key>.png, 188x280
    'eren': 'eren', 'mikasa': 'mikasa', 'armin': 'armin', 'jean': 'jean', 'sasha': 'sasha', 'historia': 'krista',
    'connie': 'connie', 'levi': 'levi', 'erwin': 'erwin', 'hange': 'zoe',
}
SOURCES = [
    # (first overall episode shown, file suffix, url pattern, crop box (left, top, right, bottom) on the original)
    (1, 's2', 'https://shingeki.tv/season2/character/img/thumb_{}.jpg', (20, 4, 220, 204), SEASON_2),
    (38, 's3', 'https://shingeki.tv/season3/character/img/thumb_{}.png', (0, 6, 188, 194), SEASON_3),
]
BACKGROUND = (58, 44, 34)  # the thumbnails' own brown, for any transparent pixels


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (scout-atlas portrait fetch)'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def main():
    manifest = {}
    for first, suffix, pattern, box, keys in SOURCES:
        for atlas_id, key in keys.items():
            image = Image.open(io.BytesIO(fetch(pattern.format(key)))).convert('RGBA')
            flat = Image.new('RGBA', image.size, BACKGROUND + (255,))
            flat.alpha_composite(image)
            portrait = flat.crop(box).resize((SIZE, SIZE), Image.LANCZOS).convert('RGB')
            name = f'{atlas_id}-{suffix}.jpg'
            portrait.save(HERE / name, quality=86, optimize=True)
            manifest.setdefault(atlas_id, []).append({'from': first, 'file': name})
            print(f'{name}  from episode {first}')
    # The earliest version starts where the character does in data.js.
    first_episode = dict(re.findall(r'id: "([\w-]+)", type: "\w+", firstEpisode: (\d+)', (HERE.parent / 'data.js').read_text(encoding='utf-8')))
    for atlas_id, versions in manifest.items():
        versions[0]['from'] = int(first_episode[atlas_id])
    body = ',\n'.join(f'  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' for k, v in sorted(manifest.items()))
    (HERE / 'portraits.js').write_text(
        '/* Portraits, written by fetch_portraits.py. Each id maps to a file name, or to a list of\n'
        ' * { from, file } versions: the version with the latest `from` at or before the viewing episode is\n'
        ' * shown, so later character designs never appear early. Characters not listed get a drawn\n'
        ' * silhouette. Add your own images the same way; use pictures from episodes already watched.\n'
        ' */\n'
        f'window.ATLAS_PORTRAITS = {{\n{body}\n}};\n', encoding='utf-8')
    print(f'portraits.js: {len(manifest)} characters')


if __name__ == '__main__':
    main()
