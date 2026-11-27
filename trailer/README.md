# Kashtan trailer

These scripts make the Kashtan trailer straight from the game: any size, any length, with the game's own music.
`make_trailer.py` is the one to run. It renders the shots in headless Chrome, records the soundtrack live, sets
the captions in the game's type and puts it all together with ffmpeg. [ARCHITECTURE.md](ARCHITECTURE.md) explains
how the parts fit together.

The videos aren't kept in the repository (`.gitignore` leaves out `*.mp4` and `work/`). These commands make the
current ones. The music is generative, so it's never quite the same twice.

| video | command |
|---|---|
| standard cut, 1080p, 69.8 s | `python3 make_trailer.py --size 1080p --duration 69.8` |
| Instagram Reel, 30 s | `python3 make_trailer.py --size 1080x1920 --duration 30 --crf 18` |
| extended cut, 4K, 104 s | `python3 make_trailer.py --size 4k --duration 104 --crf 18` |
| extended cut, 2.39:1 master | `python3 make_trailer.py --size 3840x1608 --duration 104 --best` |
| extended cut, 2.39:1 master, 2160 high | `python3 make_trailer.py --size 5160x2160 --duration 104 --best` (HEVC) |
| YouTube copy of the 4K cut | see [For YouTube](#for-youtube) |
| holiday promo, 1080p, 51 s | `python3 make_holiday.py` (see [The holiday promo](#the-holiday-promo)) |

## What you need

- **macOS with Google Chrome.** Chrome draws the frames on the GPU through Metal. To use another Chrome, set
  `CHROME=/path/to/chrome`.
- **Node 18+ and puppeteer.** Either `npm i -g puppeteer` or a `node_modules/puppeteer` next to these scripts.
- **ffmpeg** with libx264.
- **Python 3.**
- **Internet access.** The game loads Three.js from unpkg, and the captions use Google Fonts.

The game itself (`../index.html`) is never changed. The scripts work on a copy of it in `work/site/`.

## Making a trailer

```sh
cd trailer
python3 make_trailer.py --size 1920x1080 --duration 60            # -> kashtan-trailer-1920x1080-landscape-60s.mp4
python3 make_trailer.py --size 4k --duration 104 --crf 18         # the extended cut in 4K: all 25 shots
python3 make_trailer.py --size 3840x1608 --duration 104 --best    # the same at 2.39:1, at the highest quality
python3 make_trailer.py --size 1080x1920 --duration 30 --crf 18   # an Instagram Reel -> kashtan-trailer-1080x1920-portrait-30s.mp4
python3 make_trailer.py --size 720p --duration 30 --stills        # look at the shots first (see below)
```

| option | default | |
|---|---|---|
| `--size` | `1920x1080` | `WIDTHxHEIGHT`, or `720p`, `1080p`, `1440p`, `4k` (also `2160p`) |
| `--duration` | `60` | length in seconds (8 at least) |
| `--fps` | `30` | frames per second |
| `--supersample` | 2 up to 1440p, 1 above | draws each frame up to 2× larger (any factor from 1 to 2) and scales it down. Leaves and fences come out much sharper. Capped so the drawn frame stays within Chrome's limit of 7680×4320 worth of pixels: 5160×2160 is drawn at 1.72×. |
| `--best` | | the highest quality, for a master: supersample 2 at any size (or as near as Chrome allows), frames passed along at JPEG quality 0.97 instead of 0.94, CRF 12 with x264's slower preset and film tuning (CRF 14 with x265's slow preset for HEVC) unless `--crf` says otherwise, 320 kbit/s audio. Slow, and a big file. |
| `--codec` | `h264`, or `hevc` above 4096×2304 | `h264` plays everywhere. `hevc` is 10-bit HEVC tagged `hvc1` (QuickTime plays it); the script picks it for frames larger than H.264 plays on most machines, such as 5160×2160. |
| `--crf` | `16` | x264 quality. 16 is close to lossless (about 25 Mbit/s at 1080p); 20–22 gives a lighter file for the web. |
| `--shots` | chosen to fit | only these shots, comma-separated, e.g. `--shots gate,candles,cat,year` |
| `--silent` | | no soundtrack. Skips the real-time sound pass. |
| `--stills` | | draws only the first, middle and last frame of each shot, then tiles them |
| `--out` | `kashtan-trailer-WxH-LAYOUT-Ns.mp4` | output file. The layout is `landscape`, `scope`, `portrait` or `square`. |
| `--work` | `work/` | folder for the intermediate files |
| `--port` | any free one | port the copy of the game is served on (127.0.0.1 only) |

### How it fits the length

There are 25 shots. 16 make the standard cut, which runs 69.8 s. The other 9 belong to the extended cut and bring it
to 103.5 s:

- **Spring:** the lilacs in front of the house; the window swinging open onto the tree.
- **Summer:** a crane over the gardens to an apple tree; the view from the top of the chestnut.
- **Autumn:** the creeper gone crimson; conkers dropping and splitting their husks.
- **Winter:** the lane on a snowy night.
- **Room:** the Salvo Ferrari on the desk.
- **Town:** St. Gertrude's clock.

Each shot's camera move is defined from start to finish, so a shot can run longer or shorter and the camera just
moves faster or slower over the same path.

- **Up to 69.8 s you get the standard cut.** An extended shot is only used when every shot can run at its full
  length, so they come in one by one above 69.8 s, in this order: the tree view, the conkers, the window, the
  Ferrari, the lilacs, the creeper, the clock, the apples, the snowy night. All 25 fit from 103.5 s.
- **Shorter than about 59 s:** standard shots are dropped rather than cut below 85% of their length. They go in the
  order of `DROP` in `make_trailer.py`: rain, room, church, lie, garden, fire, synagogue, bike, cat, roof, chess. The
  gateway, candles, autumn, winter and the closing year always stay.
- **Then the rest are stretched or shrunk** so the total comes out exactly right.
- **Captions** sit inside their shot, coming in once the fade into it is over and leaving as the next shot fades
  in. A caption that would have less than 2 s on screen is left out. The title card always comes in over the last
  shot. The synagogue carries a longer caption on its history, set a little smaller so it stays at three lines. The
  extended cut has three more: over the tree view, the conkers and the Ferrari.

| duration | what you get |
|---|---|
| 15 s | 5 shots (gateway, candles, autumn, winter, year), title only |
| 30 s | 7 shots: those plus chess and roof, with all their captions |
| 45 s | 10 shots: the standard cut without rain, room, church, lie, garden and fire |
| 60 s | the standard 16, each at 0.87× |
| 69.8 s | the standard 16 at their natural length |
| 75 s | 17: the standard cut plus the tree view |
| 90 s | 21: plus the conkers, the window, the Ferrari and the lilacs |
| 104 s | all 25, each at 1.01× |

The script prints the plan before it starts: which shots, how long each, what was left out.

### Other sizes

Any size works. The script picks a layout from the shape of the frame and puts it in the file name.

- **Landscape** (wider than tall): the shots as framed, with the captions low in the frame as in the game. The
  captions are laid out for 1920×1080 and scaled to fit.
- **Scope** (wider than 2.1:1, like a 2.39:1 film at `3840x1608` or `5160x2160`): the landscape captions and the 16:9
  frame widened. Each shot keeps the 16:9 lens, so it sees just as much above and below (the church's spire, the
  synagogue's gables) and far more to the sides: a 50° lens sees about 96° across, a little stretched at the edges.
  A shot can set `scopeFov` to see less.
- **Portrait and square** (Instagram Reels, Stories, TikTok, YouTube Shorts): the captions get their own layout.
  It's 1080 wide with larger type, and lines wrap where they fit. Everything stays clear of the apps' own furniture:
  the bottom quarter (name, caption, sound), the top tenth, and the buttons down the right.
  - **A wider lens.** A tall frame sees far less across than a 16:9 one at the same lens, so each shot gets a wider
    one: its `tallFov`, or 1.3× its `fov`. That shows more sky and ground instead of losing the sides.
  - **Two shots set it themselves.** The chess close-up uses a much wider lens so the whole board fits. The closing
    shot centres on the tree so its crown sits over the title.

For Instagram, a Reel at `--size 1080x1920 --duration 30 --crf 18` is about 70 MB. A feed post at `1080x1350` (4:5)
crops less of each view. Check a new size with `--stills` first.

### For YouTube

YouTube takes the 4K extended cut as it is (1.1 GB at about 84 Mbit/s). For a faster upload, this makes a copy at
about 46 Mbit/s, just over the top of YouTube's recommended 35–45 Mbit/s for 4K at 30 fps, at roughly half the size:

```sh
ffmpeg -i kashtan-trailer-extended-3840x2160-landscape-104s.mp4 -map 0:v:0 -map 0:a:0 \
  -c:v libx264 -preset slow -tune film -profile:v high -level:v 5.1 -pix_fmt yuv420p \
  -crf 17 -maxrate 50M -bufsize 100M -g 60 -keyint_min 30 -bf 2 -flags +cgop \
  -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709 -color_range tv \
  -c:a copy -movflags +faststart kashtan-trailer-extended-3840x2160-landscape-104s-youtube.mp4
```

At 1:1 the copy is a little softer than the master in the finest detail (leaf veins, corrugated roofs). YouTube
re-encodes everything to well under this bitrate, so after processing the two look much the same. A keyframe
every 2 s (`-g 60`) matters: one every half second spends a large part of the bitrate on keyframes at 4K.

For a thumbnail, take a frame from the end card after the title is fully in and before the fade to black (about
3 s before the end of the 104 s cut, 2.6 s before the end of the 30 s Reel):

```sh
ffmpeg -sseof -3 -i kashtan-trailer-extended-3840x2160-landscape-104s.mp4 -frames:v 1 -vf scale=1280:720 thumbnail.jpg
ffmpeg -sseof -2.6 -i kashtan-reel-1080x1920-portrait-30s.mp4 -frames:v 1 reel-cover.jpg   # a Reel's cover
```

### How long it takes

On an M5 Max, a 60 s trailer takes:

- **Pictures:** about 3 minutes at 1080p with supersampling. 4K takes longer.
- **Sound:** as long as the trailer, because it's recorded live.
- **Captions:** a few seconds.
- **Putting it together:** about 30 s.

Whole runs, start to finish: the 30 s Reel about 2½ minutes, the 69.8 s standard cut about 5, the 104 s extended
cut in 4K about 10, the same at 2.39:1 with `--best` (3840×1608, drawn at 7680×3216) about 18, and at 5160×2160
(drawn at 8875×3715, encoded HEVC) about 32.

## Looking before rendering

```sh
python3 make_trailer.py --size 1080p --duration 60 --stills
```

This writes `work/stills/NN-<shot>-{a,b,c}.jpg` (first, middle and last frame of each shot) at the supersampled
size, plus `work/stills/sheet-N.jpg`, which tiles four shots to an image. It takes under a minute. Use it after
changing a shot, or after changing the game, since a new bush can end up in front of a camera.

## The holiday promo

```sh
python3 make_holiday.py                         # -> kashtan-holiday-1920x1080-landscape-51s.mp4
python3 make_holiday.py --size 720p --stills    # look at its shots first (work/holiday/stills/)
python3 make_holiday.py --music-only            # just the music -> work/holiday/music.wav
python3 make_holiday.py --shots h-front,h-pov2  # a few shots alone, cut together, no end card
```

A 51 s holiday promo, 13 shots. On a winter morning my window swings open onto the snowy yard. I run out of the door,
and a snowman goes up on each bar I stop on. The rest go up round the yard and down the gravel lane, one on each
beat. Then the ride on the Orlyonok: round the chestnut, weaving the three before the house, left into the lane and
down it between the eight. The end card, Happy Holidays and then Play Kashtan for more fun, comes over the yard at
dusk, full of snowmen, the windows lit and snow falling.

It uses the trailer's machinery with its own shots (`holiday-shots.js`, loaded after `shots.js`) and its own
music (`music.mjs`). Its intermediate files go in `work/holiday/`.

- **The music.** Jingle Bells (James Lord Pierpont, 1857, public domain), arranged for the cut and played on
  synthesized instruments in Chrome's Web Audio, offline. So it's the same every run and sits on the cut's bars to the
  sample. The arrangement has glockenspiel (the game's own bell), electric piano, horns, a plucked bass, strings,
  sleigh bells, a woodblock and brushes. 144 beats a minute puts a bar on exactly 50 frames.
  - 2 bars of intro: the last line, "one horse open sleigh".
  - 8 bars of the verse while the snowmen go up.
  - 16 bars of the chorus for the ride.
  - A 4-bar ending under the end card.

  The game's own generative music is left out. Its other sounds stay under the tune at `--ambient` (3, so the bike bell rings as loud as the tune): the wind,
  my steps, the crunch of each snowman going up, the freewheel ticking and the bike bell, rung on "Jingle", on
  "hey!" and on the last "sleigh".
- **Cut to the bar.** `EDIT` in `make_holiday.py` counts in bars, and every cut lands on a bar line. The one dissolve
  is into the dusk shot, centred on its bar. Each shot is told where it falls in the music, so beats line up inside
  shots too: the snowmen going up on the beat, and the ride passing one lane snowman on each bar of the chorus's
  second half.
- **One ride.** The ride is a single path, a natural cubic spline through `RIDE_PTS` in `holiday-shots.js`. Its
  timing goes through `RIDE_KEYS`, with each lane snowman passed on its bar. The ride's clock is the music's, so the
  eight ride shots are eight views of the same ride and it carries on across the cuts. The steering and the lean come
  from the path's curvature and the speed, with the lean balanced for the turn (tan lean = v²κ/g). The rider pedals on
  the straights and coasts through the tighter turns. The game's bike draws him: `BIKE.step` with no time passing,
  given the ride's position, heading, steering, lean and cranks.
- **Seen from outside**, the rider's head and fur hat are given real materials. In the game they're colour-masked
  so they only cast a shadow and never get in the eye's way. The first-person shots put the masks back and roll with
  the bike, at half the game's roll.
- **The snowmen** are the game's own (`makeSnowman`), sixteen of them at `SPOTS`, seeded so they come out the same
  every run. They're posed as far built as the shot wants through the game's `updateSnowmen`, and are kept out of
  its list of snowmen, which holds eight at most.

## The files

| file | what it does |
|---|---|
| `make_trailer.py` | The driver. It holds the edit (`EDIT`: the shots in order, each one's natural length, the caption over it, and whether it belongs to the extended cut only) and the drop order (`DROP`). It plans the cut and writes `work/plan.json`. Then it serves the copy of the game, runs the three scripts below, and puts the trailer together with ffmpeg: 0.6 s crossfades (slower where `TIMING` says), the captions faded in and out, a fade from and to black, and the sound compressed and normalized to −16 LUFS. |
| `shots.js` | The shots. Each one sets the world up (season, time of day, weather, the fire, a snowman, the cat…) and gives the camera for each moment of the shot. It runs inside the game's page. |
| `render.mjs` | The pictures. It steps the game one frame at a time on a virtual clock and pipes each frame to ffmpeg as a JPEG; ffmpeg scales it down into `work/clips/<shot>.mp4`, encoded near-losslessly. A frame that comes back wholly black is drawn again. |
| `audio.mjs` | The sound. It plays the same shots through in real time and records the game's audio output into `work/audio.webm`. |
| `cards.mjs` | The captions and the title card, as transparent PNGs in `work/cards/`. The wording lives here. |
| `lib.mjs` | Shared helpers: finds puppeteer and Chrome, opens the game. |
| `make_holiday.py` | The holiday promo's driver: its edit in bars (`EDIT`), its end card (`CARDS`). It plans the cut and runs the same scripts, plus `music.mjs`, then mixes the game's sound under the music. |
| `holiday-shots.js` | The holiday promo's shots: the snowmen, the ride, the bike posed along it. Loaded after `shots.js`, whose helpers it uses. |
| `music.mjs` | The holiday promo's music, Jingle Bells, synthesized offline into `work/holiday/music.wav`. |
| `ARCHITECTURE.md`, `.pdf` | How the parts fit together. The PDF is built from the Markdown with `spec2pdf.sh --no-click ARCHITECTURE.md`, run in this folder (pandoc, XeLaTeX and mermaid-filter; the script is in the speccheck project). |
| `work/` | Everything intermediate. Safe to delete. |

## Changing the trailer

- **A shot's length, the order, or which caption goes where:** edit `EDIT` in `make_trailer.py`.
- **What's left out of short trailers first:** edit `DROP`.
- **A shot that should stop and hold its last view:** add it to `TIMING` in `make_trailer.py` with `hold` (seconds to
  hold once its camera has stopped) and `fade` (how slowly to fade into the next shot). The synagogue holds 2 s and
  fades over 1.8 s. These seconds aren't stretched or shrunk with the rest. The shot after a slow fade is made
  longer by what the fade takes beyond the usual 0.6 s, so it keeps its own time on screen and its caption.
- **A caption's wording:** edit `CARDS` in `cards.mjs`. To add a caption, add a card there and name it in `EDIT`.
- **A camera or the state of the world:** edit the shot in `shots.js`. A shot looks like this:

  ```js
  { name: 'autumn', warm: 150,
    setup(){ world({ S: 3.36, tod: 0.45 }); },
    cam: u => look(vmix(V(2.3, 1.75, -128.3), V(3.9, 1.75, -130.2), ease(u)), V(T.TREE.x, mix(6.5, 7.5, u), T.TREE.z)) },
  ```

  `u` goes from 0 at the shot's first frame to 1 at its last (or to where it starts holding, for a shot in
  `TIMING`). `look(from, to)` points the camera. `vmix` / `ease` / `orbit` move it, and `tiltUp` tilts from the foot
  of a building to its top (the church and synagogue shots). `V(x, y, z)` is a point in metres: the tree is at
  `T.TREE` (12, 0, −137), the house front is at z = −150, the lane runs along x = −8.4, and Stabu iela is at
  z ≈ −37.
- **The settings `world()` takes:**
  - `S` is the season: 0 is December, 1 March, 2 June, 3 September. Mid-winter is about 0.42, May about 1.65.
  - `tod` is the time of day (0.5 is noon).
  - `weather` is `fair`, `cloudy` or `rain` (snow in winter).
  - `fov` is the lens for a 16:9 frame (vertical, so scope frames use it too and see more to the sides);
    `tallFov` (optional) is the one for portrait and square frames, `scopeFov` (optional) for scope.
  - `mode`: `free` (the default) leaves the camera to the shot. The desk shots use `window`, the only mode in which
    the desk lamp lights the room; the bike shot uses `walk`, and the bike steers and carries the eye.
  - `lamp`: whether the desk lamp is on (default on); `cloud` overrides the weather's cloud cover.
- **Other shot fields:**
  - `warm`: frames (at 30 fps) to run before the shot starts, to let leaves fall, rain soak in or a fire catch.
  - `acam`: where the shot is heard from in the sound pass. The church and synagogue shots use it to carry the
    synagogue's violin under the town.
  - Anything in the game is reachable through `T`. For example, `T.cat`, `T.fire`, `T.CHESS` and `T.BIKE`.
- **A new shot:** add it to `SHOTS` in `shots.js` and to `EDIT`. Mark it `True` there if it should only appear in
  extended cuts, and give it a place in `DROP`.

## How it works

- **A copy of the game.** `make_trailer.py` copies `../index.html` into `work/site/` and adds one line. That line
  lets the scripts read and set the game's own variables through `window.__T`. The game's `?s=…&noui` debug
  switches skip the title screen and hide the interface.
- **The pictures run on a virtual clock.** `performance.now()` and `requestAnimationFrame` are replaced, so time
  only moves when `render.mjs` says so, exactly 1/fps per frame. Each frame is taken from the canvas right after
  it's drawn. The motion is perfectly smooth whether a frame takes 5 ms or 500 ms to draw.
- **The sound can't be stepped like that.** The game's music is generative and runs on the audio clock. So
  `audio.mjs` plays the trailer through once in real time and records the output. Every connection the game makes
  to the speakers is also wired to a recorder. Ambient sounds (birds, rain, the fire, the bike bell, the violin)
  follow the shots. The music changes key with the season, which is why the cut runs through the year in order.

## When something goes wrong

- **"index.html has changed where the trailer hooks in"**: the line the hook goes before was edited. Update
  `anchor` in `build_site()`.
- **Captions in Georgia instead of Cormorant Garamond**: Google Fonts didn't load. `cards.mjs` says so when it
  happens.
- **A black or empty shot, or the camera inside a bush after changing the game**: check with `--stills`, then move
  the camera in `shots.js`. (A single black frame is drawn again automatically, up to three times.)
- **The desk dark in a room shot**: the lamp only lights the room in the game's `window` mode; give the shot
  `mode: 'window'` in `world()`.
- **To see what Chrome is drawing with**: open `chrome://gpu` in the same Chrome. Headless Chrome on a Mac uses
  the Apple GPU through Metal.
