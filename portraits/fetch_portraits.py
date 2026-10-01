#!/usr/bin/env python3
"""Download the official character thumbnails, crop them to square portraits, and write portraits.js.

    python3 portraits/fetch_portraits.py          # needs network once, and Pillow (system python3 has it)

The images are committed next to this script (the scripts repo is private and they are kept for
personal use), so a fresh clone needs no download. Run this only to re-create or re-crop them.

Spoiler boundary: each season's art is shown only from that season's first episode, and each episode
still only from its own episode, so a later design or scene never appears early. Add a source here only
once the viewer has reached it. Only the ids below are fetched; nothing else on these sites is read.

Sources: official character thumbnails and episode stills from shingeki.tv. Five people the official
pages never show up close use their character portraits from MyAnimeList and AniList instead (checked
by eye on 2026-10-01: plain portraits, no later designs). The Armored Titan and the smiling Titan have
no usable picture, so they keep the drawn silhouette.
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
# Single pictures: (atlas id, file name, first overall episode shown, url, crop box on the original).
# Episode stills are named -eNN after the episode they come from and never show before it.
STILLS = [
    ('carla', 'carla-e01.jpg', 1, 'https://shingeki.tv/season1/story/img/01/01_cut_01.jpg', (170, 40, 360, 230)),
    ('colossal', 'colossal-e01.jpg', 1, 'https://shingeki.tv/season1/story/img/01/01_cut_04.jpg', (215, 10, 520, 315)),
    ('hannes', 'hannes-e02.jpg', 2, 'https://shingeki.tv/season1/story/img/02/02_cut_02.jpg', (195, 0, 495, 300)),
    ('pixis', 'pixis-e11.jpg', 11, 'https://shingeki.tv/season1/story/img/11/11_cut_03.jpg', (190, 5, 370, 185)),
    ('female-titan', 'female-titan-e18.jpg', 18, 'https://shingeki.tv/season1/story/img/18/18_cut_04.jpg', (250, 0, 530, 280)),
    ('female-titan', 'female-titan-e24.jpg', 24, 'https://shingeki.tv/season1/story/img/24/24_cut_03.jpg', (140, 0, 440, 300)),
    ('beast', 'beast-e26.jpg', 26, 'https://shingeki.tv/season2/story/img/26/26_01.jpg', (140, 50, 470, 380)),
    ('grisha', 'grisha-e44.jpg', 44, 'https://shingeki.tv/season3/story/img/season3/thumb_44.jpg', (110, 20, 259, 169)),
    ('nick', 'nick-portrait.jpg', 26, 'https://cdn.myanimelist.net/images/characters/6/213227.jpg', (0, 15, 225, 240)),
    ('kenny', 'kenny-portrait.jpg', 39, 'https://cdn.myanimelist.net/images/characters/8/364347.jpg', (0, 15, 225, 240)),
    ('rod', 'rod-portrait.jpg', 40, 'https://s4.anilist.co/file/anilistcdn/character/large/127360-UgSpq6e0DAYz.jpg', (0, 10, 230, 240)),
    ('marlo', 'marlo-portrait.jpg', 41, 'https://cdn.myanimelist.net/images/characters/15/220855.jpg', (0, 15, 225, 240)),
    ('hitch', 'hitch-portrait.jpg', 41, 'https://cdn.myanimelist.net/images/characters/10/220845.jpg', (0, 15, 225, 240)),
]


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (scout-atlas portrait fetch)'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def save(atlas_id, image, box, name):
    flat = Image.new('RGBA', image.size, BACKGROUND + (255,))
    flat.alpha_composite(image.convert('RGBA'))
    flat.crop(box).resize((SIZE, SIZE), Image.LANCZOS).convert('RGB').save(HERE / name, quality=86, optimize=True)


def main():
    manifest = {}
    for first, suffix, pattern, box, keys in SOURCES:
        for atlas_id, key in keys.items():
            name = f'{atlas_id}-{suffix}.jpg'
            save(atlas_id, Image.open(io.BytesIO(fetch(pattern.format(key)))), box, name)
            manifest.setdefault(atlas_id, []).append({'from': first, 'file': name})
            print(f'{name}  from episode {first}')
    for atlas_id, name, first, url, box in STILLS:
        save(atlas_id, Image.open(io.BytesIO(fetch(url))), box, name)
        manifest.setdefault(atlas_id, []).append({'from': first, 'file': name})
        print(f'{name}  from episode {first}')
    # Versions in episode order; none may start before the character is known in data.js.
    first_episode = dict(re.findall(r'id: "([\w-]+)", type: "\w+", firstEpisode: (\d+)', (HERE.parent / 'data.js').read_text(encoding='utf-8')))
    for atlas_id, versions in manifest.items():
        versions.sort(key=lambda version: version['from'])
        versions[0]['from'] = max(versions[0]['from'], int(first_episode[atlas_id]))
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
