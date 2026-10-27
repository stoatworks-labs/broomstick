/**
 * The rules: a witch, gravity, and trees. Pure — no canvas, no clock, no DOM —
 * so the tests can fly a whole run in a loop and ask what happened.
 *
 * World units: the screen is WORLD_H tall, y down, whatever the window's size.
 * Its width is whatever the window's shape makes it. Trees sit on a track: an
 * obstacle's `at` is its distance along it, and it is on screen at
 * `at - game.scroll`. The witch stays at one x and the track moves under her.
 */

import { deadTree } from './art/halloween'
import { bounds, type Pt, type Shape } from './art/shapes'
import { between, hash, rng } from './art/random'

export const WORLD_H = 1000
/** The forest floor. Touch it and the run is over. */
export const GROUND = 900
/** The underside of the canopy. She cannot fly higher; it doesn't end the run. */
export const CEILING = 34

export const TUNING = {
  /** Downward acceleration, units/s². */
  gravity: 2600,
  /** Velocity a flap sets, units/s (negative is up). */
  flap: -760,
  maxFall: 1100,
  /** How fast the trees come at her, units/s. */
  speed: 330,
  /** Track distance from one pair of trees to the next. */
  spacing: 620,
  /** Height of the clear space between the two trees of a pair. */
  gap: 290,
  /** Where the middle of a gap may be. */
  gapCentre: [290, 610] as [number, number],
  /** Most the gap may move from one pair to the next. */
  gapStep: 240,
  /** Widest a tree may be. Test Card's trees are as wide as they are tall, so most are drawn narrower. */
  treeWidth: 260,
  /**
   * Branches thinner than this share of the trunk are drawn but never hit: the
   * outermost twigs, which poke a little way into a gap. Test Card's trees thin
   * each fork to 0.62 of the last, so 0.2 forgives the last fork of four and no more.
   */
  twig: 0.2,
  /** Length of her broom, which sets her size. */
  broom: 120,
}

/** A branch thick enough to hit: its polygon, in the tree's own frame, and its box. */
export type Solid = { pts: Pt[]; x0: number; y0: number; x1: number; y1: number }

export type Tree = {
  seed: number
  /** World y of the tree's root: the ground, or just above the top of the screen for a hanging tree. */
  base: number
  /** Everything to draw, in the tree's frame: x from the trunk, y from `base`, y down. */
  shapes: Shape[]
  solids: Solid[]
}

export type Obstacle = {
  id: number
  /** Distance along the track of the trunks. */
  at: number
  gapTop: number
  gapBottom: number
  /** Growing up from the forest floor. */
  below: Tree
  /** Hanging down from the canopy. */
  above: Tree
  passed: boolean
}

export type Mode = 'ready' | 'flying' | 'falling' | 'over' | 'paused'

export type Witch = {
  /** Where her broom is, the point she turns about. x is fixed for a run. */
  x: number
  y: number
  vy: number
  /** Radians, clockwise: nose up is negative. */
  angle: number
}

export type Game = {
  mode: Mode
  seed: number
  /** Seconds since this run's game began, ready screen included. */
  t: number
  /** Seconds since she crashed, or 0. */
  sinceCrash: number
  /** Distance travelled along the track. */
  scroll: number
  /** Visible width in world units. */
  width: number
  witch: Witch
  obstacles: Obstacle[]
  nextId: number
  score: number
  /** What hit her: 'tree', 'ground', or null while she's flying. */
  crash: 'tree' | 'ground' | null
  rand: () => number
}

/** Where she flies, across the screen: a third of the way in, but never far from the left edge on a wide screen. */
export function witchX(width: number): number {
  return Math.round(Math.min(width * 0.3, 420))
}

/** Where she bobs on the ready screen. */
const READY_Y = 470

export function newGame(seed: number, width: number): Game {
  return {
    mode: 'ready',
    seed,
    t: 0,
    sinceCrash: 0,
    scroll: 0,
    width,
    witch: { x: witchX(width), y: READY_Y, vy: 0, angle: 0 },
    obstacles: [],
    nextId: 0,
    score: 0,
    crash: null,
    rand: rng(hash(seed, 1)),
  }
}

export function resize(g: Game, width: number) {
  g.width = width
  g.witch.x = witchX(width)
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

/** Twice the area over the perimeter: the thickness of a long thin polygon. */
export function thickness(pts: Pt[]): number {
  let a = 0
  let p = 0
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i]!
    const r = pts[(i + 1) % pts.length]!
    a += q[0] * r[1] - r[0] * q[1]
    p += Math.hypot(r[0] - q[0], r[1] - q[1])
  }
  return p ? Math.abs(a) / p : 0
}

function solid(pts: Pt[]): Solid {
  const b = bounds([{ pts }])
  return { pts, ...b }
}

/**
 * A dead tree that reaches exactly `reach` from its root with its solid
 * branches — the twigs may go further — and is no wider than `maxWidth`.
 * `hanging` turns it upside down, to hang from the canopy.
 */
export function growTree(seed: number, base: number, reach: number, hanging: boolean, t = TUNING): Tree {
  // Test Card's tree at a nominal size, then scaled to fit.
  const N = 1000
  const raw = deadTree(0, 0, N, seed, '#000', 4)
  const all = bounds(raw)
  // The root flare and the trunk are drawn first, and are always solid.
  const trunk = thickness(raw[1]!.pts)
  const keep = raw.map((s, i) => i < 2 || thickness(s.pts) >= t.twig * trunk)
  let top = 0
  raw.forEach((s, i) => {
    if (!keep[i]) return
    for (const [, y] of s.pts) top = Math.min(top, y)
  })
  const f = reach / -top
  const kx = Math.min(1, t.treeWidth / ((all.x1 - all.x0) * f))
  const sy = hanging ? -f : f
  const move = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x * f * kx, y * sy])
  const shapes = raw.map((s) => ({ ...s, pts: move(s.pts) }))
  const solids = shapes.filter((_, i) => keep[i]).map((s) => solid(s.pts))
  return { seed, base, shapes, solids }
}

/** Root of a hanging tree: just above the top of the screen, inside the canopy. */
const HANG_FROM = -12

function makeObstacle(g: Game, at: number, previousCentre: number | null, t = TUNING): Obstacle {
  const [lo, hi] = t.gapCentre
  let centre = between(g.rand, lo, hi)
  if (previousCentre !== null) {
    centre = Math.max(previousCentre - t.gapStep, Math.min(previousCentre + t.gapStep, centre))
  }
  const gapTop = Math.round(centre - t.gap / 2)
  const gapBottom = gapTop + t.gap
  const id = g.nextId++
  return {
    id,
    at,
    gapTop,
    gapBottom,
    below: growTree(hash(g.seed, id, 1), GROUND + 4, GROUND + 4 - gapBottom, false, t),
    above: growTree(hash(g.seed, id, 2), HANG_FROM, gapTop - HANG_FROM, true, t),
    passed: false,
  }
}

// ---------------------------------------------------------------------------
// The witch
// ---------------------------------------------------------------------------

/**
 * The points of her that can hit something, in units of her broom, y down,
 * facing +x, from Test Card's drawing: hat, head, nose, torso, hand, boot, the
 * front of the broom and the brush. Her cloak, her hair, the tip of her hat and
 * the cat are scenery.
 */
export const HIT_POINTS: Pt[] = [
  [0.02, -0.5], [0.17, -0.39], [-0.06, -0.375],
  [0.07, -0.29], [0.115, -0.335], [0.15, -0.33],
  [-0.03, -0.17], [0.06, -0.1],
  [0.27, -0.06], [0.17, 0.14], [0.06, 0.12], [-0.12, 0.06],
  [0.53, -0.058], [-0.55, -0.01], [-0.72, 0.0],
]

/** Her hit points in world units, where she is now. */
export function hitPoints(w: Witch, t = TUNING): Pt[] {
  const L = t.broom
  const c = Math.cos(w.angle)
  const s = Math.sin(w.angle)
  return HIT_POINTS.map(([u, v]) => [w.x + (u * c - v * s) * L, w.y + (u * s + v * c) * L])
}

/** Even–odd ray cast: is p inside the polygon? */
export function inside(p: Pt, pts: Pt[]): boolean {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!
    const [xj, yj] = pts[j]!
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** Does any of `points` (world units) touch a solid branch of `tree`, whose trunk is at screen x `x`? */
export function touches(tree: Tree, x: number, points: Pt[]): boolean {
  for (const [px, py] of points) {
    const lx = px - x
    const ly = py - tree.base
    for (const s of tree.solids) {
      if (lx < s.x0 || lx > s.x1 || ly < s.y0 || ly > s.y1) continue
      if (inside([lx, ly], s.pts)) return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// One step
// ---------------------------------------------------------------------------

export type Events = { flapped: boolean; scored: boolean; crashed: boolean; landed: boolean }

/** Press: the one input there is. What it does depends on the mode. */
export function press(g: Game): 'flap' | 'start' | 'resume' | 'restart' | null {
  if (g.mode === 'ready') {
    g.mode = 'flying'
    g.witch.vy = TUNING.flap
    return 'start'
  }
  if (g.mode === 'flying') {
    g.witch.vy = TUNING.flap
    return 'flap'
  }
  if (g.mode === 'paused') {
    // Carry on from a standstill rather than with a flap: the press that resumes is not aimed at anything.
    g.mode = 'flying'
    g.witch.vy = 0
    return 'resume'
  }
  if (g.mode === 'over' && g.sinceCrash > 0.6) return 'restart'
  return null
}

export function pause(g: Game) {
  if (g.mode === 'flying') g.mode = 'paused'
}

/** Nose up when climbing, down when falling, eased toward. */
function targetAngle(vy: number): number {
  return Math.max(-0.32, Math.min(0.55, vy / 1500))
}

export function step(g: Game, dt: number, t = TUNING): Events {
  const ev: Events = { flapped: false, scored: false, crashed: false, landed: false }
  if (g.mode === 'paused') return ev
  g.t += dt
  const w = g.witch

  if (g.mode === 'ready') {
    g.scroll += t.speed * 0.5 * dt
    w.y = READY_Y + Math.sin(g.t * 2.6) * 14
    w.angle = Math.cos(g.t * 2.6) * 0.05
    return ev
  }

  if (g.mode === 'over') {
    g.sinceCrash += dt
    return ev
  }

  w.vy = Math.min(t.maxFall, w.vy + t.gravity * dt)
  w.y += w.vy * dt

  if (g.mode === 'falling') {
    g.sinceCrash += dt
    // Tumbling, nose first, to the forest floor.
    w.angle = Math.min(1.25, w.angle + 3.2 * dt)
    const lowest = Math.max(...hitPoints(w, t).map((p) => p[1]))
    if (lowest >= GROUND) {
      w.y -= lowest - GROUND
      w.vy = 0
      g.mode = 'over'
      ev.landed = true
    }
    return ev
  }

  // Flying.
  w.angle += (targetAngle(w.vy) - w.angle) * Math.min(1, dt * 10)
  g.scroll += t.speed * dt

  // Trees ahead, made before they come on screen and dropped once they're behind her.
  const last = g.obstacles[g.obstacles.length - 1]
  if (!last) {
    g.obstacles.push(makeObstacle(g, g.scroll + g.width + t.treeWidth, null, t))
  } else if (last.at - g.scroll < g.width + t.treeWidth) {
    g.obstacles.push(makeObstacle(g, last.at + t.spacing, (last.gapTop + last.gapBottom) / 2, t))
  }
  while (g.obstacles.length && g.obstacles[0]!.at - g.scroll < -t.treeWidth - 200) g.obstacles.shift()

  let pts = hitPoints(w, t)
  const highest = Math.min(...pts.map((p) => p[1]))
  if (highest < CEILING) {
    w.y += CEILING - highest
    w.vy = Math.max(0, w.vy)
    pts = hitPoints(w, t)
  }

  for (const o of g.obstacles) {
    const x = o.at - g.scroll
    if (!o.passed && x < w.x) {
      o.passed = true
      g.score++
      ev.scored = true
    }
    if (Math.abs(x - w.x) > t.treeWidth / 2 + t.broom) continue
    if (touches(o.below, x, pts) || touches(o.above, x, pts)) {
      crash(g, 'tree')
      ev.crashed = true
      return ev
    }
  }

  const lowest = Math.max(...pts.map((p) => p[1]))
  if (lowest >= GROUND) {
    w.y -= lowest - GROUND
    crash(g, 'ground')
    ev.crashed = true
    ev.landed = true
    g.mode = 'over'
  }
  return ev
}

function crash(g: Game, what: 'tree' | 'ground') {
  g.crash = what
  g.mode = 'falling'
  g.sinceCrash = 0
  // A knock back off the branch, then gravity.
  g.witch.vy = what === 'tree' ? Math.min(g.witch.vy, -180) : 0
}
