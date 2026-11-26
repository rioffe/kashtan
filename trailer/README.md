# Kashtan trailer

These scripts make the Kashtan trailer straight from the game: any size, any length, with the game's own music.
`make_trailer.py` is the one to run. It renders the shots in headless Chrome, records the soundtrack live, sets
the captions in the game's type and puts it all together with ffmpeg.

`kashtan-trailer-1080p.mp4` here is the full cut: 1920×1080, 30 fps, 63.5 s. To make it again, run
`python3 make_trailer.py --size 1080p --duration 63.5 --out kashtan-trailer-1080p.mp4`. The music won't be identical, because it's generative.

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
python3 make_trailer.py --size 1920x1080 --duration 60          # -> kashtan-trailer-1920x1080-60s.mp4
python3 make_trailer.py --size 4k --duration 90 --out kashtan-4k.mp4
python3 make_trailer.py --size 1080x1920 --duration 30          # portrait
python3 make_trailer.py --size 720p --duration 30 --stills      # look at the shots first (see below)
```

| option | default | |
|---|---|---|
| `--size` | `1920x1080` | `WIDTHxHEIGHT`, or `720p`, `1080p`, `1440p`, `4k` |
| `--duration` | `60` | length in seconds (8 at least) |
| `--fps` | `30` | frames per second |
| `--supersample` | 2 up to 1440p, 1 above | draws each frame 2× larger and scales it down. Leaves and fences come out much sharper. |
| `--crf` | `16` | x264 quality. 16 is close to lossless (about 25 Mbit/s at 1080p); 20–22 gives a lighter file for the web. |
| `--shots` | chosen to fit | only these shots, comma-separated, e.g. `--shots gate,candles,cat,year` |
| `--silent` | | no soundtrack. Skips the real-time sound pass. |
| `--stills` | | draws only the first, middle and last frame of each shot, then tiles them |
| `--out` | `kashtan-trailer-WxH-Ns.mp4` | output file |
| `--work` | `work/` | folder for the intermediate files |
| `--port` | any free one | port the copy of the game is served on (127.0.0.1 only) |

### How it fits the length

The full cut has 16 shots and runs 63.5 s. Each shot's camera move is defined from start to finish, so a shot can
run longer or shorter and the camera just moves faster or slower over the same path.

- **Shorter than about 53 s:** shots are dropped rather than cut below 85% of their length. They go in the order
  of `DROP` in `make_trailer.py`: rain, room, church, lie, garden, fire, synagogue, bike, cat, roof, chess. The
  gateway, candles, autumn, winter and the closing year always stay.
- **Then the rest are stretched or shrunk** so the total comes out exactly right.
- **Captions** sit inside their shot. A caption that would have less than 2 s on screen is left out. The title
  card always comes in over the last shot.

| duration | what you get |
|---|---|
| 15 s | 5 shots (gateway, candles, autumn, winter, year), title only |
| 30 s | 7 shots: those plus chess and roof, every caption |
| 45 s | 13 shots: everything but rain, room and church |
| 60 s | all 16, each at 0.95× |
| 90 s | all 16 at 1.37×, slower moves |

The script prints the plan before it starts: which shots, how long each, what was left out.

### Other sizes

Any size works. The shots were framed for 16:9, though. Portrait or square frames show the middle of the same view,
taller and narrower. The captions are laid out for 1920×1080 and scaled to fit the frame.

### How long it takes

On an M5 Max, a 60 s trailer takes:

- **Pictures:** about 3 minutes at 1080p with supersampling. 4K takes longer.
- **Sound:** as long as the trailer, because it's recorded live.
- **Captions:** a few seconds.
- **Putting it together:** about 30 s.

## Looking before rendering

```sh
python3 make_trailer.py --size 1080p --duration 60 --stills
```

This writes `work/stills/NN-<shot>-{a,b,c}.jpg` (first, middle and last frame of each shot) at the supersampled
size, plus `work/stills/sheet-N.jpg`, which tiles four shots to an image. It takes under a minute. Use it after
changing a shot, or after changing the game, since a new bush can end up in front of a camera.

## The files

| file | what it does |
|---|---|
| `make_trailer.py` | The driver. It holds the edit (`EDIT`: the shots in order, their lengths in the full cut and the caption over each) and the drop order (`DROP`). It plans the cut and writes `work/plan.json`. Then it serves the copy of the game, runs the three scripts below, and puts the trailer together with ffmpeg: 0.6 s crossfades, the captions faded in and out, a fade from and to black, and the sound compressed and normalized to −16 LUFS. |
| `shots.js` | The shots. Each one sets the world up (season, time of day, weather, the fire, a snowman, the cat…) and gives the camera for each moment of the shot. It runs inside the game's page. |
| `render.mjs` | The pictures. It steps the game one frame at a time on a virtual clock and pipes each frame to ffmpeg, which scales it down into `work/clips/<shot>.mp4`. |
| `audio.mjs` | The sound. It plays the same shots through in real time and records the game's audio output into `work/audio.webm`. |
| `cards.mjs` | The captions and the title card, as transparent PNGs in `work/cards/`. The wording lives here. |
| `lib.mjs` | Shared helpers: finds puppeteer and Chrome, opens the game. |
| `work/` | Everything intermediate. Safe to delete. |

## Changing the trailer

- **A shot's length, the order, or which caption goes where:** edit `EDIT` in `make_trailer.py`.
- **What's left out of short trailers first:** edit `DROP`.
- **A caption's wording:** edit `CARDS` in `cards.mjs`. To add a caption, add a card there and name it in `EDIT`.
- **A camera or the state of the world:** edit the shot in `shots.js`. A shot looks like this:

  ```js
  { name: 'autumn', warm: 150,
    setup(){ world({ S: 3.36, tod: 0.45 }); },
    cam: u => look(vmix(V(2.3, 1.75, -128.3), V(3.9, 1.75, -130.2), ease(u)), V(T.TREE.x, mix(6.5, 7.5, u), T.TREE.z)) },
  ```

  `u` goes from 0 at the shot's first frame to 1 at its last. `look(from, to)` points the camera.
  `vmix` / `ease` / `orbit` move it, and `tiltUp` tilts from the foot of a building to its top (the church and synagogue shots). `V(x, y, z)` is a point in metres: the tree is at `T.TREE` (12, 0, −137),
  the house front is at z = −150, the lane runs along x = −8.4, and Stabu iela is at z ≈ −37.
- **The settings `world()` takes:**
  - `S` is the season: 0 is December, 1 March, 2 June, 3 September. Mid-winter is about 0.42, May about 1.65.
  - `tod` is the time of day (0.5 is noon).
  - `weather` is `fair`, `cloudy` or `rain` (snow in winter).
  - `fov` is the lens.
- **Other shot fields:**
  - `warm`: frames (at 30 fps) to run before the shot starts, to let leaves fall, rain soak in or a fire catch.
  - `acam`: where the shot is heard from in the sound pass. The church and synagogue shots use it to carry the
    synagogue's violin under the town.
  - Anything in the game is reachable through `T`. For example, `T.cat`, `T.fire`, `T.CHESS` and `T.BIKE`.
- **A new shot:** add it to `SHOTS` in `shots.js` and to `EDIT`.

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
  the camera in `shots.js`.
- **To see what Chrome is drawing with**: open `chrome://gpu` in the same Chrome. Headless Chrome on a Mac uses
  the Apple GPU through Metal.
