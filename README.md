# Kashtan (Каштан)

A meditation on a chestnut tree — 78 Engelsa iela (now Stabu iela), Rīga, 1984.

*For my childhood friends — Ivars, Normunds, Zhanis, Laila and Ivonne.*

**Play:** https://rioffe.github.io/kashtan/

Come in from Stabu iela through the gateway and walk the gravel lane between the rusting garages and the old ladies' gardens to the
chestnut tree at the end. Watch it through four seasons and any time of day, in fair weather, cloud or rain; climb it,
lie under it and look at the stars, sit at the third-floor window, kick the trunk, gather
chestnuts in autumn and roast them over a fire. Generative meditative music throughout.

Behind the garages and the gardens stand the squat red-brick workshops with their tin roofs, a rowan past the last garage, and a
Virginia creeper on the low workshop wall. The gardens are full of apple, pear and plum trees, lilac, elder and mock orange, red
currant and gooseberry bushes, and beds of tulips, peonies, dahlias, gladioli, pansies and sunflowers that come and go with the
months. The neighbourhood cat (black, with white paws and a white breast) turns up out of nowhere: on the garage roofs, in the
gardens (sometimes with a mouse or a bird), or dozing on a limb of the chestnut.

Clamber onto the garage roofs and run along them, scramble from there (or up a garden shed, or a ladder someone left against
the wall) onto the tin roofs of the workshops. In winter, build a snowman, and come spring, watch him lean, lose his nose and
melt into the grass.

Out through the gateway is the town: five blocks of Rīga's Art Nouveau every way, unmended since the war, with cobbled streets,
pavements, street lamps on wires, smoke from the chimneys in the heating season and windows lit by the hour. The sun stands where
it stood over Rīga in 1984. At the end of the cobbled street behind ours is St. Gertrude's Old Church among its lindens; three
blocks south across Stabu is the Great Choral Synagogue, and as you come near it the music gives way to a violin playing
*Oyfn Pripetshik*.

Two more things are yours. Leaning against the wall to the right of our entrance is the Orlyonok, the bicycle my parents finally
bought me when I was twelve: click it and ride round the yard and out into the streets. Up in my room are the desk lamp, the Easter
cactus on the sill, and, on the table, the Post machine book, an Elektronika B3-34 calculator, a porcelain *Young bather*, and a
1984 Ferrari Formula 1 built from Salvo bricks. Dad's chess set is set up on the sofa.

Plays in English, Russian (Русский) or Latvian (Latviešu): pick on the title screen or with the
EN / RU / LV button (or `?lang=ru`, `?lang=lv`).

## Controls
**Walking**
- **WASD / arrows** walk · **drag** to look · **Shift** run · **Space** jump / clamber onto a roof (or just keep walking into a garage)
- **E** at the trunk (or **C**) climb · **L** lie down · **V** go up to my window · **Esc** (or **G**) back out, one step at a time
- **F** kick the trunk (**K** too) · walk under the tree in autumn to gather chestnuts, **R** to roast them over a fire · **B** build a snowman (in winter)
- **1–4** seasons · **T** time of day (dawn, day, dusk, night) · **Y** weather: fair, cloudy, rain (snow in deep winter) · **M** music
- **↻ Drift** (on the bar) lets the year turn on its own

**In the tree:** **W / S** or **E / Q** climb up and down · **A / D** shuffle along the branch · **F** shake the branch.

**On the Orlyonok:** click the bike to get on · **W** pedal · **S** brake · **A / D** steer · **Space** rings the bell ·
**P** parks it where you are · **Esc** gets off at the door.

**In my room** (**V**): **WASD** to move · click the window (**F**) to open it (walk up to it and lean out over the yard),
the lamp (**O**) to switch it on, any book on the shelf to open the [Post machine](https://rioffe.github.io/post-machine/).
Click the chair (**X**) to sit at the table, then click anything on it to look closer: drag to turn it, scroll to
zoom, **Esc** to get up. Click a thing a second time to use it: the calculator switches on, the book opens the Post machine,
and the Formula 1 races downhill in [Riga Downhill](https://rioffe.github.io/riga-downhill/). Click the chessboard to sit
down on the sofa beside it.

**On iPad / touch screens:** the stick (bottom left) walks (push it all the way to run); drag anywhere
to look; ⤒ jumps or clambers onto a roof, and rings the bell on the bike; ↩︎ (under the season's name) does what Esc does;
P parks the bike. Buttons appear when they apply: *Higher* / *Lower* in the tree, *Kick the trunk*, *Roast chestnuts*,
*Build a snowman*. Tap the window, the lamp, a book or anything on the table in my room.
Tip: in Safari, *Share → Add to Home Screen* runs it full-screen.

## Three-tap secrets
Tap (or click) three times in quick succession, about a second for all three:

- **The season's name** (top left): the cat comes to you, even up the tree. On a keyboard, hold **Option / Alt** and
  type **K-I-S** (or **C-A-T**).
- **The chessboard:** in my room, sit down on the sofa by Dad's chess set, then tap the board three times. It plays
  itself the sixth game of Fischer and Spassky, Reykjavík 1972. **Esc** / ↩︎ sets the pieces back.
- **The tall house across Stabu from the gateway:** while walking (not on the bike), tap the six-storey house three
  times. You go up the stairs, through the attic and out by the hatch onto its roof, with all of Rīga round you and our
  chestnut over the roofs. Walk its tin slopes round the chimneys and dormers; **Esc** / ↩︎ brings you back down to its door.

## Running it locally
Everything is in `index.html` (Three.js 0.160 from unpkg), except the bather figurine, which loads from
`models/bather.glb`. Browsers won't fetch that from a page opened as a file, so serve the folder:

```sh
python3 -m http.server 8765    # then open http://localhost:8765/
```

`[` and `]` bring up a debug panel for the street lamps' brightness.

See [`setting.md`](setting.md) for the original brief.
