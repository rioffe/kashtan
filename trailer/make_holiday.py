#!/usr/bin/env python3
"""A holiday promo for Kashtan, straight from the game: I run round the yard building snowmen, more go up round the yard and down
the gravel lane, then a slalom between them on the Orlyonok to Jingle Bells, and Happy Holidays over the yard at dusk.

    python3 make_holiday.py                          # 1920x1080, in English -> kashtan-holiday-en-1920x1080-landscape-51s.mp4
    python3 make_holiday.py --lang ru                # the end card in Russian (lv: Latvian) -> kashtan-holiday-ru-...
    python3 make_holiday.py --stills                 # look at the shots first (first, middle and last frame of each)
    python3 make_holiday.py --music-only             # just the soundtrack's music -> work/holiday/music.wav

It uses the trailer's machinery (make_trailer.py, render.mjs, audio.mjs, cards.mjs) with its own shots (holiday-shots.js) and its
own music (music.mjs). The edit is counted in bars of the music, so every cut falls on a bar line.
"""
import argparse, json, math, os, shutil, subprocess, sys, time

import make_trailer as mt

HERE = mt.HERE
BPM = 144
BAR = 240 / BPM                     # 5/3 s: 50 frames at 30 fps
# The edit: (shot in holiday-shots.js, bars, how it comes in: 0 is a cut on its first bar line, more is a dissolve that long, centred on it).
# The music (music.mjs) is laid out on the same bars: two of intro, the verse's eight, the chorus's sixteen, a four-bar ending.
EDIT = [
    ('h-window', 2, 0),     # intro: a winter morning, my window swinging open onto the snowy yard
    ('h-run',    4, 0),     # verse: out of the door, running, a snowman up on each bar I stop on
    ('h-yard',   2, 0),     #   the rest of the yard's, one on each beat
    ('h-lane',   2, 0),     #   and down the gravel lane, one on each beat
    ('h-go',     2, 0),     # chorus: "Jingle bells" - off on the Orlyonok round the chestnut, the bell rung
    ('h-pov1',   2, 0),     #   through my eyes, the three ahead
    ('h-weave',  2, 0),     #   weaving them, the house behind
    ('h-turn',   2, 0),     #   left into the lane; "hey!" and the bell
    ('h-front',  2, 0),     #   the slalom from in front, a snowman passed on every bar
    ('h-pov2',   2, 0),     #   through my eyes between them
    ('h-above',  2, 0),     #   from straight above
    ('h-after',  2, 0),     #   after him, the last two and on towards Stabu; the bell on "sleigh"
    ('h-dusk',   4, 1.0),   # ending: dusk, the yard full of snowmen, the windows lit, snowing; Happy Holidays
]
TAIL = 1.0          # seconds after the last bar: the last chord ringing under the end card as it fades
# the end card, in two parts: [card in cards.mjs, comes in on this bar (fraction allowed), fade]; both stay to the end
CARDS = [('holiday', 26.35, 0.9), ('holiday-play', 27.6, 0.9)]


def plan_edit(fps, only=None):
    shots, bar = [], 0
    for name, bars, xf in EDIT:
        shots.append({'name': name, 'bar0': bar, 'bars': bars, 'xf': xf})
        bar += bars
    total = bar * BAR + TAIL
    # each shot from half its dissolve in before its bar to half the next one's after its last; in whole frames from the start
    for i, s in enumerate(shots):
        a = s['bar0'] * BAR - s['xf'] / 2
        nxt = shots[i + 1] if i + 1 < len(shots) else None
        b = (nxt['bar0'] * BAR + nxt['xf'] / 2) if nxt else total
        fa, fb = round(a * fps), round(b * fps)
        s.update({'start': fa / fps, 'frames': fb - fa, 'dur': (fb - fa) / fps, 'lead': s['bar0'] * BAR - fa / fps, 'card': None, 'move': 1})
    if only:
        names = [s['name'] for s in shots]
        bad = [n for n in only if n not in names]
        if bad:
            mt.die(f"no shot called {', '.join(bad)} (the shots: {', '.join(names)})")
        shots = [s for s in shots if s['name'] in only]
        t = 0.0   # (a few shots alone: one after another, cut; each still knows its own place in the music)
        for s in shots:
            s['start'], s['xf'] = t, 0
            t += s['dur']
        total = t
    cards = [] if only else [{'card': c, 'in': b * BAR, 'out': total + 1, 'fade': f} for c, b, f in CARDS]
    return shots, cards, total


def main():
    ap = argparse.ArgumentParser(description='Make the Kashtan holiday promo.', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    ap.add_argument('--lang', default='en', choices=['en', 'ru', 'lv'], help="the end card's language (and the game's): English, Russian, Latvian")
    ap.add_argument('--size', default='1920x1080', help='WIDTHxHEIGHT, or 720p, 1080p, 1440p, 4k')
    ap.add_argument('--fps', type=int, default=30, help='frames per second (30 puts a bar on exactly 50 frames)')
    ap.add_argument('--supersample', type=float, help='draw each frame this many times larger and scale it down (default 2 up to 1440p, 1 above)')
    ap.add_argument('--crf', type=int, default=16, help='x264 quality: lower is better and bigger')
    ap.add_argument('--shots', help='only these shots, comma-separated (cut together, without the end card)')
    ap.add_argument('--stills', action='store_true', help='only the first, middle and last frame of each shot, tiled')
    ap.add_argument('--silent', action='store_true', help='no sound at all')
    ap.add_argument('--music-only', action='store_true', help='only make the music (work/holiday/music.wav)')
    ap.add_argument('--ambient', type=float, default=3.0, help="how loud the game's own sound is under the music (3: the bike bell as loud as the tune)")
    ap.add_argument('--out', help='output file (default: kashtan-holiday-LANG-WxH-LAYOUT-Ns.mp4 here)')
    ap.add_argument('--work', default=os.path.join(HERE, 'work', 'holiday'), help='folder for the intermediate files')
    ap.add_argument('--port', type=int, default=0, help='port to serve the game on (default: any free one)')
    a = ap.parse_args()
    sys.stdout.reconfigure(line_buffering=True)

    presets = {'720p': (1280, 720), '1080p': (1920, 1080), '1440p': (2560, 1440), '4k': (3840, 2160), '2160p': (3840, 2160)}
    try:
        w, h = presets.get(a.size.lower()) or tuple(int(v) for v in a.size.lower().split('x'))
    except ValueError:
        mt.die(f'--size {a.size}: want WIDTHxHEIGHT, e.g. 1920x1080')
    w, h = w + w % 2, h + h % 2
    ss = a.supersample or (2 if w * h <= 2560 * 1440 else 1)
    ss = min(ss, max(1.0, math.floor(math.sqrt(mt.MAX_DRAWN / (w * h)) * 100) / 100))
    only = [s.strip() for s in a.shots.split(',')] if a.shots else None
    plan, cards, total = plan_edit(a.fps, only)
    layout = 'scope' if w / h > 2.1 else 'landscape' if w > h else 'square' if w == h else 'portrait'
    out = os.path.abspath(a.out or os.path.join(HERE, f'kashtan-holiday-{a.lang}-{w}x{h}-{layout}-{round(total)}s.mp4'))
    work = os.path.abspath(a.work)
    print(f'{a.lang}: {w}x{h} {layout} at {a.fps} fps, drawn at {int(w * ss)}x{int(h * ss)}; {total:.1f} s, {len(plan)} shots, {BPM} a minute ({BAR:.3f} s a bar)')
    print('  ' + '  '.join(f"{s['name']} {s['dur']:.2f}" for s in plan))

    os.makedirs(work, exist_ok=True)
    music = os.path.join(work, 'music.wav')
    plan_json = {'lang': a.lang, 'width': w, 'height': h, 'fps': a.fps, 'supersample': ss, 'xf': 0, 'total': total, 'layout': layout, 'jpegq': 0.94,
                 'shots': plan, 'cards': cards, 'shotFiles': ['shots.js', 'holiday-shots.js'], 'gameMusic': False,
                 'music': {'bpm': BPM, 'bars': sum(e[1] for e in EDIT), 'tail': TAIL, 'out': music}}
    t0 = time.time()
    if a.music_only:
        json.dump(plan_json, open(os.path.join(work, 'plan.json'), 'w'), indent=1)
        mt.node('music.mjs', work)
        print(f'\n{music}  ({time.time() - t0:.0f} s)')
        return
    for sub in ('clips', 'cards', 'stills'):
        shutil.rmtree(os.path.join(work, sub), ignore_errors=True)
    site = mt.build_site(work)
    srv, port = mt.serve(site, a.port)
    plan_json.update({'port': port, 'site': site})
    json.dump(plan_json, open(os.path.join(work, 'plan.json'), 'w'), indent=1)
    try:
        if a.stills:
            print('\nstills')
            mt.node('render.mjs', 'stills', work)
            mt.contact_sheets(work, plan)
            return
        print('\npictures')
        mt.node('render.mjs', 'render', work)
        if not a.silent:
            print('\nmusic')
            mt.node('music.mjs', work)
            print('\nsound')
            mt.node('audio.mjs', work)
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(work, 'audio.webm'), '-c:a', 'pcm_s16le',
                            os.path.join(work, 'audio.wav')], check=True)
        if cards:
            print('\nwords')
            mt.node('cards.mjs', work)
        print('\ntogether')
        mt.assemble(work, plan, cards, total, w, h, a.fps, a.crf, out, a.silent, music=None if a.silent else music, ambient=a.ambient)
    finally:
        srv.terminate()
    print(f'\n{out}\n{w}x{h}, {total:.1f} s, {os.path.getsize(out) / 1e6:.0f} MB, made in {time.time() - t0:.0f} s')


if __name__ == '__main__':
    main()
