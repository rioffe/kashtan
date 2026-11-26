#!/usr/bin/env python3
"""Make a Kashtan trailer of any size and length, straight from the game.

    python3 make_trailer.py --size 1920x1080 --duration 60
    python3 make_trailer.py --size 3840x2160 --duration 90 --out kashtan-4k.mp4
    python3 make_trailer.py --size 1280x720 --duration 30 --stills      # just look at the shots first

See README.md for what it does and how to change the shots.
"""
import argparse, json, os, shutil, socket, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)                       # the game: ../index.html and ../models/

# The edit: the shots in order (each is defined in shots.js), how long each runs at its natural pace, the card (cards.mjs)
# shown over it, and whether it is one of the extended cut's own shots (True: used only when every shot fits at full length).
EDIT = [
    ('gate',      5.5, 'intro',   False),  # spring: in through the gateway, down the lane
    ('lilac',     4.0, None,      True),   #   the lilacs in front of our house
    ('candles',   4.5, 'candles', False),  # the chestnut in flower
    ('window',    5.0, None,      True),   #   my window swinging open onto the tree
    ('rain',      3.5, None,      False),  # rain and puddles on the lane
    ('garden',    3.5, None,      False),  # summer: a sunflower in the old ladies' gardens
    ('apples',    4.0, None,      True),   #   apples ripening
    ('cat',       3.5, None,      False),  # the cat dozing on a limb of the chestnut
    ('climb',     4.5, 'climb',   True),   #   up in the chestnut, looking out
    ('lie',       4.0, None,      False),  # lying under the tree at a pink June dusk
    ('autumn',    4.5, 'autumn',  False),  # autumn: the leaves coming down
    ('creeper',   4.0, None,      True),   #   the Virginia creeper gone crimson
    ('conkers',   4.5, 'conkers', True),   #   conkers dropping and splitting their husks
    ('fire',      4.0, None,      False),  # roasting chestnuts at dusk
    ('winter',    4.0, None,      False),  # winter: a snowman at dusk, snowing
    ('snownight', 4.0, None,      True),   #   the lane on a snowy night
    ('car',       4.0, 'car',     True),   #   my Formula 1 on the table
    ('room',      3.5, None,      False),  # my desk at night
    ('chess',     4.5, 'chess',   False),  # Dad's chess set playing Fischer - Spassky
    ('bike',      6.5, None,      False),  # the town: on the Orlyonok down Stabu iela, looking up at the houses at the end
    ('church',    4.5, None,      False),  # St. Gertrude's, tilting up the tower to the cross
    ('clock',     4.0, None,      True),   #   its clock keeping the hour
    ('synagogue', 4.5, None,      False),  # the synagogue, tilting up to its gables; held, then faded slowly (its violin carried on)
    ('roof',      4.5, 'roof',    False),  # the roof of the tall house across Stabu
    ('year',     10.0, 'title',   False),  # the year turning round the tree, the title over May
]
# Which shots leave first when there is not room for all. The extended cut's own shots go while the rest cannot all run at
# their full length (so up to about 63 s the cut is the standard one); then the standard shots, while they would have to be
# squeezed below MIN_STRETCH. Gate, candles, autumn, winter and year always stay.
DROP = ['snownight', 'apples', 'clock', 'creeper', 'lilac', 'car', 'window', 'conkers', 'climb',
        'rain', 'room', 'church', 'lie', 'garden', 'fire', 'synagogue', 'bike', 'cat', 'roof', 'chess']
# Shots that stop on their last view: hold it this many seconds once the camera has done moving (not stretched with the rest),
# and fade into the next shot this slowly instead of the usual XF.
TIMING = {'synagogue': {'hold': 2.0, 'fade': 1.8}}
XF = 0.6             # crossfade between shots, seconds
MIN_STRETCH = 0.85   # shots are not cut below 85% of their length while there are shots left to drop
MIN_CAPTION = 2.0    # a caption with less time than this on screen is left out


def die(msg):
    sys.exit('make_trailer: ' + msg)


def plan_edit(duration, fps, only=None):
    """Which shots, how long each, where each starts; and when each card is shown."""
    if only:
        names = [e[0] for e in EDIT]
        bad = [n for n in only if n not in names]
        if bad:
            die(f"no shot called {', '.join(bad)} (the shots: {', '.join(names)})")
        shots = [e for e in EDIT if e[0] in only]
    else:
        shots = list(EDIT)
    fade = lambda e: TIMING.get(e[0], {}).get('fade', XF)                                    # (into the next shot)
    fixed = lambda e: TIMING.get(e[0], {}).get('hold', 0) + TIMING.get(e[0], {}).get('fade', 0)   # (seconds not stretched)
    total = lambda sh, k: sum(e[1] * k + fixed(e) for e in sh) - sum(fade(e) for e in sh[:-1])
    extended = {e[0] for e in EDIT if e[3]}
    dropped = []
    if not only:
        for name in DROP:
            if total(shots, 1.0 if name in extended else MIN_STRETCH) <= duration:
                if name in extended:
                    continue   # (the extended shots that fit at full length stay; the standard ones are judged next)
                break
            shots = [e for e in shots if e[0] != name]
            dropped.append(name)
    k = (duration - sum(fixed(e) for e in shots) + sum(fade(e) for e in shots[:-1])) / sum(e[1] for e in shots)
    plan, t, xf_in = [], 0.0, 0.0
    for e in shots:
        name, d, card = e[0], e[1], e[2]
        frames = max(2, round((d * k + fixed(e)) * fps))
        dur = frames / fps
        # xf: the crossfade in from the shot before; move: the part of the shot over which its camera moves (then it holds)
        plan.append({'name': name, 'dur': dur, 'frames': frames, 'start': t, 'card': card, 'xf': xf_in, 'move': min(1.0, d * k / dur)})
        xf_in = fade(e)
        t += dur - xf_in
    end = plan[-1]['start'] + plan[-1]['dur']
    if min(s['dur'] for s in plan) < 2 * XF + 0.3:
        print(f'note: at {duration:g} s the shortest shot is {min(s["dur"] for s in plan):.1f} s; the crossfades will eat most of it')
    cards, skipped = [], []
    for i, s in enumerate(plan):
        if not s['card']:
            continue
        if s['card'] == 'title':
            a, b, f = s['start'] + 0.43 * s['dur'], end, 1.2
        else:
            a, b = s['start'] + (0.9 if i == 0 else s['xf'] + 0.1), s['start'] + s['dur'] - 0.5
            f = 0.6
            if b - a < MIN_CAPTION:
                skipped.append(s['card'])
                continue
        cards.append({'card': s['card'], 'in': a, 'out': b, 'fade': min(f, (b - a) / 3)})
    return plan, cards, end, k, dropped, skipped


def build_site(work):
    """A copy of the game with one line added that lets the scripts reach its insides (window.__T)."""
    site = os.path.join(work, 'site')
    os.makedirs(site, exist_ok=True)
    src = open(os.path.join(GAME, 'index.html'), encoding='utf-8').read()
    anchor = 'setLang(LANG); updateNutHUD(); syncButtons(); frame();'
    if src.count(anchor) != 1:
        die("index.html has changed where the trailer hooks in (the line 'setLang(LANG); updateNutHUD(); syncButtons(); frame();')")
    hook = ("window.__T = new Proxy({}, { get: (_, k) => typeof k === 'string' ? eval(k) : undefined, "
            "set: (_, k, __v) => { eval(k + ' = __v'); return true; } });\n")
    open(os.path.join(site, 'index.html'), 'w', encoding='utf-8').write(src.replace(anchor, hook + anchor))
    link = os.path.join(site, 'models')
    if os.path.islink(link) or os.path.exists(link):
        os.remove(link)
    os.symlink(os.path.join(GAME, 'models'), link)
    return site


def serve(site, port):
    if not port:
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0))
            port = s.getsockname()[1]
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', site],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            socket.create_connection(('127.0.0.1', port), timeout=0.2).close()
            return srv, port
        except OSError:
            time.sleep(0.1)
    srv.kill()
    die(f'could not serve the game on port {port}')


def node(script, *args):
    subprocess.run(['node', os.path.join(HERE, script), *args], check=True, cwd=HERE)


def contact_sheets(work, plan):
    """The stills tiled four shots to a sheet, first / middle / last frame across."""
    st = os.path.join(work, 'stills')
    for g in range(0, len(plan), 4):
        rows = [(i, s['name']) for i, s in enumerate(plan[g:g + 4], g)]
        ins, filt = [], []
        for r, (i, n) in enumerate(rows):
            for c in 'abc':
                ins += ['-i', os.path.join(st, f'{i:02d}-{n}-{c}.jpg')]
            filt.append(f'[{3 * r}:v]scale=640:-2[a{r}];[{3 * r + 1}:v]scale=640:-2[b{r}];[{3 * r + 2}:v]scale=640:-2[c{r}];[a{r}][b{r}][c{r}]hstack=3[r{r}]')
        filt.append(''.join(f'[r{r}]' for r in range(len(rows))) + (f'vstack={len(rows)}[o]' if len(rows) > 1 else 'null[o]'))
        out = os.path.join(st, f'sheet-{g // 4 + 1}.jpg')
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *ins, '-filter_complex', ';'.join(filt), '-map', '[o]', '-q:v', '3', out], check=True)
        print('  ' + out)


def assemble(work, plan, cards, total, w, h, fps, crf, out, silent):
    args = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-stats', '-y']
    for s in plan:
        args += ['-i', os.path.join(work, 'clips', s['name'] + '.mp4')]
    for c in cards:
        args += ['-loop', '1', '-framerate', str(fps), '-t', f'{total:.3f}', '-i', os.path.join(work, 'cards', c['card'] + '.png')]
    if not silent:
        args += ['-i', os.path.join(work, 'audio.wav')]
    n, A = len(plan), len(plan) + len(cards)
    g = [f'[{i}:v]settb=AVTB,fps={fps},format=yuv444p,setpts=PTS-STARTPTS[v{i}]' for i in range(n)]
    prev = 'v0'
    for k in range(1, n):
        g.append(f"[{prev}][v{k}]xfade=transition=fade:duration={plan[k]['xf']}:offset={plan[k]['start']:.3f}[x{k}]")
        prev = f'x{k}'
    g.append(f'[{prev}]trim=0:{total:.3f},format=yuv444p[base]')
    prev = 'base'
    for j, c in enumerate(cards):
        a, b, f = c['in'], c['out'], c['fade']
        g.append(f'[{n + j}:v]scale={w}:{h},format=rgba,fade=t=in:st={a:.3f}:d={f:.2f}:alpha=1,fade=t=out:st={b - f:.3f}:d={f:.2f}:alpha=1[c{j}]')
        g.append(f"[{prev}][c{j}]overlay=enable='between(t,{a:.3f},{b:.3f})':format=auto[o{j}]")
        prev = f'o{j}'
    vf = min(1.6, total * 0.05)
    g.append(f'[{prev}]fade=t=in:st=0:d=1.0,fade=t=out:st={total - vf:.3f}:d={vf:.2f},format=yuv420p[vout]')
    maps = ['-map', '[vout]']
    if not silent:
        af = min(2.5, total * 0.08)
        g.append(f'[{A}:a]atrim=0:{total:.3f},asetpts=PTS-STARTPTS,acompressor=threshold=0.05:ratio=2.5:attack=20:release=400,'
                 f'loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.8,afade=t=out:st={total - af:.3f}:d={af:.2f},aresample=48000[aout]')
        maps += ['-map', '[aout]', '-c:a', 'aac', '-b:a', '256k']
    args += ['-filter_complex', ';'.join(g), *maps, '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-profile:v', 'high',
             '-pix_fmt', 'yuv420p', '-r', str(fps), '-g', str(2 * fps), '-movflags', '+faststart', '-t', f'{total:.3f}', out]
    subprocess.run(args, check=True)


def main():
    ap = argparse.ArgumentParser(description='Make a Kashtan trailer of any size and length.',
                                 formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    ap.add_argument('--size', default='1920x1080', help='WIDTHxHEIGHT of the video, or 720p, 1080p, 1440p, 4k')
    ap.add_argument('--duration', type=float, default=60, help='length in seconds')
    ap.add_argument('--fps', type=int, default=30, help='frames per second')
    ap.add_argument('--supersample', type=int, choices=[1, 2], help='draw each frame this many times larger and scale it down '
                    '(sharper leaves; default 2 up to 1440p, 1 above)')
    ap.add_argument('--crf', type=int, default=16, help='x264 quality: lower is better and bigger (16 is near transparent, 20 is lighter)')
    ap.add_argument('--shots', help='only these shots, comma-separated, in the usual order (default: chosen to fit the duration)')
    ap.add_argument('--silent', action='store_true', help='no soundtrack (skips the real-time sound pass)')
    ap.add_argument('--stills', action='store_true', help='only draw the first, middle and last frame of each shot, and tile them')
    ap.add_argument('--out', help='output file (default: kashtan-trailer-WxH-LAYOUT-Ns.mp4 here)')
    ap.add_argument('--work', default=os.path.join(HERE, 'work'), help='folder for the intermediate files')
    ap.add_argument('--port', type=int, default=0, help='port to serve the game on (default: any free one)')
    a = ap.parse_args()
    sys.stdout.reconfigure(line_buffering=True)

    presets = {'720p': (1280, 720), '1080p': (1920, 1080), '1440p': (2560, 1440), '4k': (3840, 2160), '2160p': (3840, 2160)}
    try:
        w, h = presets.get(a.size.lower()) or tuple(int(v) for v in a.size.lower().split('x'))
    except ValueError:
        die(f'--size {a.size}: want WIDTHxHEIGHT, e.g. 1920x1080')
    if w % 2 or h % 2:
        w, h = w + w % 2, h + h % 2
        print(f'note: H.264 wants even sizes; making it {w}x{h}')
    if a.duration < 8:
        die('--duration: at least 8 seconds')
    ss = a.supersample or (2 if w * h <= 2560 * 1440 else 1)
    if abs(w / h - 16 / 9) > 0.02:
        print(f'note: the shots are framed for 16:9; at {w}x{h} the same views are cropped or widened')
    for tool in ('node', 'ffmpeg'):
        if not shutil.which(tool):
            die(f'{tool} is not installed')
    if not os.path.exists(os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')):
        die('Google Chrome not found (set CHROME=/path/to/chrome)')

    only = [s.strip() for s in a.shots.split(',')] if a.shots else None
    plan, cards, total, k, dropped, skipped = plan_edit(a.duration, a.fps, only)
    layout = 'landscape' if w > h else 'square' if w == h else 'portrait'
    out = os.path.abspath(a.out or os.path.join(HERE, f'kashtan-trailer-{w}x{h}-{layout}-{round(a.duration)}s.mp4'))
    work = os.path.abspath(a.work)
    print(f'{w}x{h} {layout} at {a.fps} fps, drawn at {w * ss}x{h * ss}; {total:.1f} s, {len(plan)} shots, each at {k:.2f}x its usual length')
    if dropped:
        print('  left out to fit: ' + ', '.join(dropped))
    if skipped:
        print('  captions too short to read, left out: ' + ', '.join(skipped))
    if k > 2:
        print('  note: that is slow going; for a long trailer consider --fps 30 and a longer EDIT in make_trailer.py')
    print('  ' + '  '.join(f"{s['name']} {s['dur']:.1f}" for s in plan))

    for sub in ('clips', 'cards', 'stills'):
        shutil.rmtree(os.path.join(work, sub), ignore_errors=True)
    os.makedirs(work, exist_ok=True)
    site = build_site(work)
    srv, port = serve(site, a.port)
    json.dump({'width': w, 'height': h, 'fps': a.fps, 'supersample': ss, 'port': port, 'site': site, 'xf': XF, 'total': total,
               'layout': layout, 'shots': plan, 'cards': cards}, open(os.path.join(work, 'plan.json'), 'w'), indent=1)
    t0 = time.time()
    try:
        if a.stills:
            print('\nstills')
            node('render.mjs', 'stills', work)
            contact_sheets(work, plan)
            return
        print('\npictures')
        node('render.mjs', 'render', work)
        if not a.silent:
            print('\nsound')
            node('audio.mjs', work)
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(work, 'audio.webm'), '-c:a', 'pcm_s16le',
                            os.path.join(work, 'audio.wav')], check=True)
        print('\nwords')
        node('cards.mjs', work)
        print('\ntogether')
        assemble(work, plan, cards, total, w, h, a.fps, a.crf, out, a.silent)
    finally:
        srv.terminate()
    mb = os.path.getsize(out) / 1e6
    print(f'\n{out}\n{w}x{h}, {total:.1f} s, {mb:.0f} MB, made in {time.time() - t0:.0f} s')


if __name__ == '__main__':
    main()
