# Broomstick user guide

Broomstick is a small game for a web browser: a witch on a broomstick, a cat riding on the back,
and a forest at night full of dead trees that were there first. Flap to keep her in the air, and
thread her through the gap between each pair of trees.

Play it at <https://broomstick.stoatworks-labs.com>, on a phone or a computer. It's one web page
with nothing to install, and once it has loaded it doesn't talk to anything.

> **Status (27 October 2026):** there are no numbered releases. The page at
> broomstick.stoatworks-labs.com is the product, and this guide describes it as it stood on that
> date.
>
> **Verified:** 18 unit tests of the rules: flight, pausing, the trees and their gaps, scoring, and
> the autopilot, which flies through 50 pairs of trees on each of six seeds without touching one
> and, told to stop at a score, crashes into the next tree on that score (24 runs). The game has been played in Chromium in the
> Claude desktop app's browser pane at desktop and phone sizes, both as the built page served with
> the live site's headers and on the live site itself.
>
> **Not verified:** Safari, Firefox, an actual phone (only a phone-sized window), sound on iOS, and
> the frame rate on a slow device.
>
> This codebase was created with AI assistance, directed and reviewed by a human author.

---

## Playing

The title screen says "Broomstick" and "Mind the trees." Press (see **Controls**) and she's off
with a flap. From then on she falls unless you flap again, and every flap sends her up at the same
speed, however fast she was falling.

The trees come in pairs: one growing up from the forest floor, one hanging down from the canopy,
with a clear gap between them. Each pair is a point, counted as their trunks pass her. Touch a
solid branch or the forest floor and the run is over: after a tree she tumbles to the ground, and
then up come your score, your best and a remark from the forest, which is rarely sympathetic.

What stays the same:

- The gap is always the same height, a bit under a third of the screen. Where it sits changes from
  pair to pair, but never by more than a set step, and the tests fly the autopilot through 300 of
  them without a touch.
- It never speeds up. The trees just keep coming.
- The canopy at the top stops her climbing but doesn't end the run. The hanging trees grow out of
  it, though, so hugging the top doesn't help.

After a crash the game ignores presses until she's on the floor and just over half a second has
passed since the hit, so a last panicked flap doesn't throw your score away. Once "try again" appears, a press takes you back to the title,
and the next press starts a new run through new trees.

---

## Controls

| Input | Does |
| --- | --- |
| Space, ↑, W, Enter, click or tap | Flap. Also starts a run, carries on after a pause, and leaves the game-over screen once it says "try again" |
| P or Esc | Pause, or carry on if paused |
| M, or the speaker button at the top right | Sound off or on |

- One press, one flap. Holding a key down doesn't keep flapping.
- Keys pressed with Ctrl, Cmd or Alt are left to the browser, so Cmd-P prints rather than pausing.
- Click or tap anywhere but the speaker button.
- On a keyboard that isn't QWERTY, W, P and M are wherever a QWERTY keyboard has them. Space, ↑,
  Enter, Esc and the speaker button work on any keyboard.

---

## What counts as a hit

Each tree is one of Test Card's dead trees: a trunk that forks, and forks again, thinner each time.
The trunk and every branch at least a fifth as thick as the trunk are solid. The thinnest twigs, out
at the tips, are drawn but forgiven: they poke a little way into the gap and she flies straight
through them. Each tree is scaled so that its solid branches end at the edge of the gap.

What can hit something is fifteen points on the witch: on her hat, head, nose, body, hand and boot,
the front of the broom and the brush. A solid branch has to reach one of those points to count, so
a thin one can slip between two of them. Her cloak, her hair, the tip of her hat and the cat are
scenery. The cat would dispute that.

The forest floor ends a run the moment any of those points touches it. The gravestones, the
lanterns and the long grass along the front are scenery on top of it, and so are the bats and the
eyes in the wood.

A pair counts as soon as its trunks pass her, so clipping the back of a tree you've just got past
still keeps the point.

---

## Pausing

**P** or **Esc** pauses a run, and the same keys or any flap control carry on. Carrying on doesn't
flap: she starts again from a standstill and begins to drop, so have a flap ready.

It also pauses itself when:

- the tab is hidden,
- the window loses focus, for instance when you click into another app,
- the window changes shape a lot, as when a phone is turned on its side, so you can see where the
  trees have got to before carrying on. A phone's address bar sliding away is too small a change to
  count.

Only a run in flight pauses. The title screen, the tumble after a crash and the game-over screen
carry on as they were. While it's paused, she and the trees stay put. The bats and the mist carry on
regardless, as bats and mist will.

---

## Sound

Three sounds, made in the browser as they happen, with no sound files: a whoosh for each flap, a
two-note ting for each pair passed, and a thud when she hits something.

Browsers don't let a page make a noise until you've done something, so sound starts with your first
press. On a phone it starts when your finger lifts off that first tap, which is the moment phones
allow it. I haven't tried sound on an iPhone yet; if you do, let me know how it goes.

**M** or the speaker button turns sound off and on. The button shows a speaker with a cross beside
it while sound is off, and this browser remembers your choice for next time.

---

## Your best score

Your best score is kept in this browser's local storage. The title screen shows it once you have
one, and the game-over screen shows it after every run, or says "A new best." when you've just
beaten it. Another browser, a private window or cleared site data starts again from nothing. If the
browser won't let the page store anything, your best lasts as long as the page is open.

A run flown by the autopilot (below) never counts as your best.

---

## For demos and films

The address takes switches, for the showcase video or a screen left running in a foyer.

| Address | Does |
| --- | --- |
| `?pilot` | The game's own autopilot flies her: the same one the tests fly. Nothing pauses it on its own |
| `?pilot=12` | The same, for 12 points, then it climbs into the next tree and the run ends. `?pilot=0` crashes into the first |
| `?seed=7` | The first run's trees, and the forest behind them, are the same every time |

They combine: `?pilot=12&seed=7`. You still press to start, and to go again after a crash; the
autopilot only flies. Your own presses still flap, should you want to help.

`?seed` fixes the first run only. Go again and the trees are new, though the forest behind stays
as it was until the page is reloaded. A narrower window brings the first tree in sooner.

### The broomstick event

The page announces what happens as a `broomstick` event on `window`. Its `detail` is
`{ type, score, crash }`: the score so far, and what she hit (`'tree'`, `'ground'`, or `null`
before a crash).

| `type` | When |
| --- | --- |
| `start` | The press that starts a run |
| `score` | Each pair she gets past |
| `crash` | She hits a tree or the floor |
| `over` | She has come to rest and the game-over screen is up. After a crash into the floor, `crash` and `over` come together |
| `restart` | The press that leaves the game-over screen for the title, with the score back at 0 |

There's nothing for flaps or pauses. The page refuses to be shown in a frame (its headers say so),
so the event is for something running in the page itself: a browser driven by a script, which is
how the video is filmed, or a line in the developer console.

```js
window.addEventListener('broomstick', (e) => console.log(e.detail))
```

---

## Where the art comes from

The witch, the dead trees, the bats, the jack-o'-lanterns and the gravestones are
[Test Card](https://github.com/stoatworks-labs/test-card)'s Halloween drawings, the same ones in its
spooky forest and haunted house patterns. They were drawn to stand about at the back of a test
pattern. Here the trees have been promoted to obstacles.

Each drawing is code that returns polygons, so it's synced across from Test Card as source (into
`src/art/`) rather than as pictures, and the game downloads no images. The sky, the moon, the mist
and the eyes in the wood are painted the way Test Card's spooky forest paints them, palette
included.

---

## Privacy

The game sends nothing anywhere. It loads nothing from other sites, its drawings are code and its
sounds are made on the spot, and the page's security headers would stop it reaching anywhere else
even if it tried. Your browser asks the site for the page, and that's all the game sends.
Cloudflare, which serves the page, sees that request, and as on other sites it serves, it asks
your browser to report back if a page fails to load.

Two things are kept in this browser's local storage, and neither leaves it: your best score
(`broomstick.best`) and whether sound is off (`broomstick.muted`).

---

## If something is wrong

| Symptom | Cause |
| --- | --- |
| No sound | Nothing has been pressed yet, or sound is off (the speaker button shows a cross). On a phone, sound starts as your finger lifts off the first tap |
| A press after a crash does nothing | Presses are ignored until she's on the floor and just over half a second has passed since the hit. Wait for "try again" |
| A branch went through her and nothing happened | It was a forgiven twig, it slipped between the points that count, or it only touched her cloak, her hair, the tip of her hat or the cat |
| The best score has gone | It's kept in this browser. Another browser, a private window or cleared site data won't have it |

Shout if something else breaks: issues go on the repo,
<https://github.com/stoatworks-labs/broomstick>.
