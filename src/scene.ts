/**
 * The picture: Test Card's spooky forest, rebuilt to scroll for ever behind a
 * witch, with the trees she has to dodge in front of it.
 *
 * Every drawing comes from src/art/ (Test Card's artwork, synced). The way the
 * sky, the moon, the mist, the lanterns and the watching eyes are painted
 * follows Test Card's src/patterns/halloween.ts painter, palette included; that
 * painter is built around loops and spans, so it is not synced, only followed.
 *
 * Units are the game's: WORLD_H tall, y down. The caller scales the context.
 */

import { bat, deadTree, gravestone, pumpkin, PUMPKIN_BOTTOM, PUMPKIN_FACES, STONE_KINDS, witch } from './art/halloween'
import { fillShapes, mapShapes, tracePath, type Pt, type Shape } from './art/shapes'
import { grass, makeRidge, mix, ridgeShape, silhouette } from './art/scenery'
import { between, hash, pick, rng } from './art/random'
import { GROUND, TUNING, WORLD_H, type Game, type Tree } from './game'
import type { PumpkinFace } from './art/types'

const TAU = Math.PI * 2

/** Test Card's spooky forest palette. */
const FOREST = {
  hills: '#231b3e',
  far: '#2a2142',
  mid: '#150f24',
  near: '#09060f',
  front: '#030205',
  mist: '#8a80c0',
}
/** The trees in her way: darker than the middle wood, lighter than the night, edged with moonlight. */
const OBSTACLE = { fill: '#060409', rim: '#5a4c9e' }
/** Night air between the woods behind and the trees in her way, so the ones that matter stand out. Clear in the sky, so the moon stays bright. */
const HAZE = { colour: '46, 36, 84', alpha: 0.34, from: 280, to: 540 }
const WITCH = { fill: '#0a0710', rim: '#a99cf0' }

/** How fast each layer moves, as a share of the trees' speed. */
const PARALLAX = { stars: 0.01, wisps: 0.03, hills: 0.06, far: 0.15, mid: 0.35, bats: 0.45, play: 1, front: 1.3 }

/** Every copy of something at `x`, repeating every `period`, that falls between x0 and x1. */
function each(x: number, period: number, x0: number, x1: number, fn: (px: number) => void) {
  let px = ((((x - x0) % period) + period) % period) + x0
  for (; px <= x1; px += period) fn(px)
}

/** Every closed polygon wound the same way, so one fill of them all is their union. */
function wound(pts: Pt[]): Pt[] {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    a += p[0] * q[1] - q[0] * p[1]
  }
  return a < 0 ? pts.slice().reverse() : pts
}

function toPath(shapes: Shape[]): Path2D {
  const path = new Path2D()
  for (const s of shapes) tracePath(path, wound(s.pts), s.smooth !== false, true)
  return path
}

type Planted = { x: number; h: number; seed: number }

/** A row of `n` trees over one period, decided before any is drawn. */
function plant(seed: number, period: number, n: number, minH: number, maxH: number): Planted[] {
  const r = rng(seed)
  return Array.from({ length: n }, (_, i) => ({
    x: ((i + between(r, 0.1, 0.9)) / n) * period,
    h: between(r, minH, maxH),
    seed: hash(seed, i),
  }))
}

type Spark = { x: number; y: number; vx: number; vy: number; age: number; life: number; warm: boolean; r: number }

export class Scene {
  private readonly seed: number
  private readonly treePaths = new Map<string, Path2D>()
  private readonly obstaclePaths = new WeakMap<Tree, Path2D>()
  private readonly hills: (x: number) => number
  private readonly canopy: (x: number) => number
  private readonly mists: ((x: number) => number)[]
  private readonly far: Planted[]
  private readonly mid: Planted[]
  private readonly eyes: { tree: Planted; dx: number; dy: number; every: number; at: number }[]
  private readonly stones: { x: number; shapes: Shape[] }[]
  private readonly lanterns: { x: number; size: number; face: PumpkinFace; key: number }[]
  private readonly tufts: { x: number; shapes: Shape[] }[]
  private readonly fringe: { x: number; shapes: Shape[] }[]
  private readonly bats: { x: number; y: number; span: number; dir: number; v: number; hz: number; weave: number }[]
  private sparks: Spark[] = []
  private sparkRand: () => number

  static readonly PERIOD = { stars: 2400, wisps: 3000, far: 3300, mid: 3600, stones: 2700, lanterns: 3100, front: 2600, canopy: 2400 }

  constructor(seed: number) {
    this.seed = seed
    const P = Scene.PERIOD
    this.hills = makeRidge(hash(seed, 220), 4000, { base: 3, rough: 0.42 })
    this.canopy = makeRidge(hash(seed, 300), P.canopy, { base: 7, rough: 0.55 })
    this.mists = [0, 1, 2, 3].map((k) => makeRidge(hash(seed, 230, k), 1500, { base: 1, octaves: 3, rough: 0.5 }))
    this.far = plant(hash(seed, 240), P.far, 30, 160, 300)
    this.mid = plant(hash(seed, 250), P.mid, 11, 380, 600)
    const er = rng(hash(seed, 251))
    this.eyes = this.mid
      .map((tree) => ({ tree, has: er() < 0.45, dx: between(er, -0.12, 0.12) * tree.h, dy: between(er, 0.4, 0.7) * tree.h, every: between(er, 2, 5), at: er() }))
      .filter((e) => e.has)
    const sr = rng(hash(seed, 260))
    this.stones = Array.from({ length: 6 }, (_, i) => ({
      x: ((i + between(sr, 0.1, 0.9)) / 6) * P.stones,
      shapes: gravestone(between(sr, 30, 52), pick(sr, STONE_KINDS), between(sr, -0.2, 0.2), { stone: '#3a3846', side: '#24222e' }),
    }))
    const lr = rng(hash(seed, 280))
    this.lanterns = Array.from({ length: 5 }, (_, i) => ({
      x: ((i + between(lr, 0.1, 0.9)) / 5) * P.lanterns,
      size: between(lr, 52, 72),
      face: pick(lr, PUMPKIN_FACES),
      key: hash(seed, 281, i),
    }))
    const fr = rng(hash(seed, 290))
    this.tufts = Array.from({ length: 15 }, (_, i) => {
      const x = ((i + fr()) / 15) * P.front
      return { x, shapes: grass(0, WORLD_H + 1, between(fr, 55, 110), hash(seed, 291, i), FOREST.front) }
    })
    // Twigs hanging from the canopy: grass, upside down.
    const cr = rng(hash(seed, 310))
    this.fringe = Array.from({ length: 40 }, (_, i) => {
      const x = ((i + cr()) / 40) * P.canopy
      const y = 22
      const tuft = grass(0, y, between(cr, 28, 72), hash(seed, 311, i), FOREST.near)
      return { x, shapes: mapShapes(tuft, ([px, py]) => [px, 2 * y - py]) }
    })
    const br = rng(hash(seed, 320))
    this.bats = Array.from({ length: 6 }, () => ({
      x: br() * 3000,
      y: between(br, 90, 520),
      span: between(br, 24, 46),
      dir: br() < 0.5 ? -1 : 1,
      v: between(br, 40, 110),
      hz: between(br, 2.5, 4.5),
      weave: between(br, 0.6, 1.6),
    }))
    this.sparkRand = rng(hash(seed, 400))
  }

  /** A background tree, built once into one path at its own origin. */
  private drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, seed: number, depth: number, colour: string) {
    const key = `${seed}:${Math.round(h)}:${depth}`
    let path = this.treePaths.get(key)
    if (!path) {
      path = toPath(deadTree(0, 0, Math.round(h), seed, colour, depth))
      this.treePaths.set(key, path)
    }
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = colour
    ctx.fill(path)
    ctx.restore()
  }

  private drawObstacleTree(ctx: CanvasRenderingContext2D, tree: Tree, x: number) {
    let path = this.obstaclePaths.get(tree)
    if (!path) {
      path = toPath(tree.shapes)
      this.obstaclePaths.set(tree, path)
    }
    ctx.save()
    ctx.translate(x, tree.base)
    // Moonlight from the upper right catches one edge.
    ctx.save()
    ctx.translate(2.5, -2.5)
    ctx.fillStyle = OBSTACLE.rim
    ctx.fill(path)
    ctx.restore()
    ctx.fillStyle = OBSTACLE.fill
    ctx.fill(path)
    ctx.restore()
  }

  draw(ctx: CanvasRenderingContext2D, g: Game, time: number, dt: number) {
    const W = g.width
    const s = g.scroll
    const x0 = -300
    const x1 = W + 300

    // Sky, stars, moon, and thin cloud across it.
    const sky = ctx.createLinearGradient(0, 0, 0, 780)
    sky.addColorStop(0, '#04050e')
    sky.addColorStop(0.5, '#16123a')
    sky.addColorStop(1, '#43305f')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, WORLD_H)
    this.drawStars(ctx, s * PARALLAX.stars, W, time)
    drawMoon(ctx, Math.min(W * 0.76, W - 150), 180, 82, this.seed)
    this.drawWisps(ctx, s * PARALLAX.wisps, x0, x1, time)
    this.drawBats(ctx, s * PARALLAX.bats, W, time, 0)

    // Far hills, mist at their foot.
    fillShapes(ctx, [ridgeShape(this.hills, x0, x1, 680, 130, WORLD_H, FOREST.hills, s * PARALLAX.hills, 8)])
    this.drawMist(ctx, 0, s * PARALLAX.hills, time, x0, x1, 670, 80, 0.22)

    // The far wood.
    const g1 = 740
    ctx.fillStyle = FOREST.far
    ctx.fillRect(0, g1 - 1, W, WORLD_H - g1 + 1)
    for (const tr of this.far) each(tr.x - s * PARALLAX.far, Scene.PERIOD.far, x0, x1, (px) => this.drawTree(ctx, px, g1 + 1, tr.h, tr.seed, 3, FOREST.far))

    // The middle wood, and the eyes in it.
    const g2 = 830
    ctx.fillStyle = FOREST.mid
    ctx.fillRect(0, g2 - 1, W, WORLD_H - g2 + 1)
    const midOff = s * PARALLAX.mid
    for (const tr of this.mid) each(tr.x - midOff, Scene.PERIOD.mid, x0, x1, (px) => this.drawTree(ctx, px, g2 + 1, tr.h, tr.seed, 4, FOREST.mid))
    this.drawEyes(ctx, midOff, g2, x0, x1, time)
    this.drawMist(ctx, 1, midOff, time, x0, x1, g2 - 30, 70, 0.2)
    this.drawBats(ctx, s * PARALLAX.bats, W, time, 1)

    const haze = ctx.createLinearGradient(0, HAZE.from, 0, HAZE.to)
    haze.addColorStop(0, `rgba(${HAZE.colour}, 0)`)
    haze.addColorStop(1, `rgba(${HAZE.colour}, ${HAZE.alpha})`)
    ctx.fillStyle = haze
    ctx.fillRect(0, HAZE.from, W, GROUND - HAZE.from)

    // The forest floor, with stones and lanterns on it.
    ctx.fillStyle = FOREST.near
    ctx.fillRect(0, GROUND, W, WORLD_H - GROUND)
    for (const st of this.stones) {
      each(st.x - s, Scene.PERIOD.stones, x0, x1, (px) => {
        ctx.save()
        ctx.translate(px, GROUND + 4)
        fillShapes(ctx, st.shapes)
        ctx.restore()
      })
    }

    // The trees in her way.
    for (const o of g.obstacles) {
      const x = o.at - s
      if (x < x0 || x > x1) continue
      this.drawObstacleTree(ctx, o.below, x)
      this.drawObstacleTree(ctx, o.above, x)
    }

    for (const ln of this.lanterns) {
      each(ln.x - s, Scene.PERIOD.lanterns, x0, x1, (px) => drawLanternOnGround(ctx, px, GROUND + 12, ln.size, ln.face, ln.key, time))
    }

    // The canopy she can't fly above, with twigs hanging from it.
    this.drawCanopy(ctx, s, x0, x1)

    // Her, and the sparks off her broom.
    this.updateSparks(g, dt)
    this.drawSparks(ctx)
    this.drawWitch(ctx, g, time)

    // Brambles and grass right in front, fastest of all, and a last wisp of mist.
    for (const tf of this.tufts) {
      each(tf.x - s * PARALLAX.front, Scene.PERIOD.front, x0, x1, (px) => {
        ctx.save()
        ctx.translate(px, 0)
        fillShapes(ctx, tf.shapes)
        ctx.restore()
      })
    }
    ctx.fillStyle = FOREST.front
    ctx.fillRect(0, 985, W, WORLD_H - 985)
    this.drawMist(ctx, 2, s * PARALLAX.front, time, x0, x1, 950, 60, 0.12)
  }

  private drawStars(ctx: CanvasRenderingContext2D, off: number, W: number, time: number) {
    const r = rng(hash(this.seed, 61))
    const period = Scene.PERIOD.stars
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 160; i++) {
      const x = r() * period
      const y = r() * 620
      const bright = between(r, 0.35, 1)
      const size = r() < 0.08 ? 3.2 : 1.8
      const hz = between(r, 0.15, 0.6)
      ctx.globalAlpha = bright * (0.55 + 0.45 * Math.sin(TAU * hz * time + i)) * (1 - (y / 620) * 0.7)
      each(x - off, period, 0, W, (px) => ctx.fillRect(px, y, size, size))
    }
    ctx.globalAlpha = 1
  }

  private drawWisps(ctx: CanvasRenderingContext2D, off: number, x0: number, x1: number, time: number) {
    const r = rng(hash(this.seed, 203))
    ctx.fillStyle = '#241c44'
    ctx.globalAlpha = 0.6
    for (let i = 0; i < 5; i++) {
      const cx = r() * Scene.PERIOD.wisps
      const cy = between(r, 110, 330)
      const len = between(r, 250, 550)
      const th = between(r, 10, 22)
      const bob = Math.sin(TAU * 0.04 * time + i * 1.9) * 12
      each(cx - off, Scene.PERIOD.wisps, x0 - len, x1 + len, (px) => {
        ctx.beginPath()
        ctx.ellipse(px + bob, cy, len / 2, th, 0, 0, TAU)
        ctx.ellipse(px + bob + len * 0.18, cy - th * 0.9, len * 0.28, th * 0.8, 0, 0, TAU)
        ctx.fill()
      })
    }
    ctx.globalAlpha = 1
  }

  /** A bank of mist: a soft ridge drifting on its own over whatever its layer scrolls. */
  private drawMist(ctx: CanvasRenderingContext2D, k: number, off: number, time: number, x0: number, x1: number, y: number, depth: number, alpha: number) {
    const h = this.mists[k]!
    const drift = time * (14 + k * 6)
    const band = ridgeShape(h, x0, x1, y, 50, y + depth, FOREST.mist, off + drift, 6)
    const fade = ctx.createLinearGradient(0, y - 50, 0, y + depth)
    fade.addColorStop(0, FOREST.mist + '00')
    fade.addColorStop(0.35, FOREST.mist + Math.round(alpha * 255).toString(16).padStart(2, '0'))
    fade.addColorStop(1, FOREST.mist + '00')
    ctx.fillStyle = fade
    ctx.beginPath()
    tracePath(ctx, band.pts, false, true)
    ctx.fill()
  }

  private drawEyes(ctx: CanvasRenderingContext2D, off: number, ground: number, x0: number, x1: number, time: number) {
    const eye = 5.5
    for (const e of this.eyes) {
      const open = (time / e.every + e.at) % 1 < 0.06 ? 0.12 : 1
      each(e.tree.x - off + e.dx, Scene.PERIOD.mid, x0, x1, (px) => {
        const y = ground - e.dy
        const glow = ctx.createRadialGradient(px, y, 0, px, y, eye * 6)
        glow.addColorStop(0, `rgba(255, 210, 80, ${0.35 * open})`)
        glow.addColorStop(1, 'rgba(255, 210, 80, 0)')
        ctx.fillStyle = glow
        ctx.fillRect(px - eye * 6, y - eye * 6, eye * 12, eye * 12)
        ctx.fillStyle = '#ffd54a'
        for (const side of [-1, 1]) {
          ctx.beginPath()
          ctx.ellipse(px + side * eye * 1.4, y, eye, eye * open, 0, 0, TAU)
          ctx.fill()
        }
      })
    }
  }

  /** Bats in two depths: far ones behind the middle wood, near ones in front of it. */
  private drawBats(ctx: CanvasRenderingContext2D, off: number, W: number, time: number, layer: 0 | 1) {
    const span = W + 400
    this.bats.forEach((b, i) => {
      if (i % 2 !== layer) return
      const scale = layer ? 1 : 0.6
      const x = ((((b.x + b.dir * b.v * time - off) % span) + span) % span) - 200
      const y = b.y + Math.sin(time * b.weave + i) * 24
      ctx.save()
      ctx.translate(x, y)
      fillShapes(ctx, bat(b.span * scale, (time * b.hz) % 1, layer ? '#0c0915' : '#1a1430'))
      ctx.restore()
    })
  }

  private drawCanopy(ctx: CanvasRenderingContext2D, off: number, x0: number, x1: number) {
    // ridgeShape closes to `bottom`; with amp negative and bottom above, the ragged edge hangs down.
    const band = ridgeShape(this.canopy, x0, x1, 0, -40, -60, FOREST.near, off, 8)
    band.pts = band.pts.map(([x, y]) => [x, y + 12])
    fillShapes(ctx, [band])
    for (const f of this.fringe) {
      each(f.x - off, Scene.PERIOD.canopy, x0, x1, (px) => {
        ctx.save()
        ctx.translate(px, 0)
        fillShapes(ctx, f.shapes)
        ctx.restore()
      })
    }
  }

  private drawWitch(ctx: CanvasRenderingContext2D, g: Game, time: number) {
    const w = g.witch
    const L = TUNING.broom
    const flutter = (time * (g.mode === 'falling' || g.mode === 'over' ? 0.6 : 1.7)) % 1
    const shapes = witch(L, flutter, true, WITCH.fill)
    ctx.save()
    ctx.translate(w.x, w.y)
    ctx.rotate(w.angle)
    // A faint halo, so she can be found against a black tree.
    const halo = ctx.createRadialGradient(0, -0.25 * L, 0, 0, -0.25 * L, L * 0.95)
    halo.addColorStop(0, 'rgba(160, 130, 255, 0.36)')
    halo.addColorStop(0.6, 'rgba(150, 120, 255, 0.12)')
    halo.addColorStop(1, 'rgba(150, 120, 255, 0)')
    ctx.fillStyle = halo
    ctx.fillRect(-1.1 * L, -1.2 * L, 2.2 * L, 1.9 * L)
    ctx.save()
    ctx.translate(2.2, -2.2)
    fillShapes(ctx, silhouette(shapes, WITCH.rim))
    ctx.restore()
    fillShapes(ctx, shapes)
    ctx.restore()
  }

  /** Sparks off the end of the broom while she flies; they stay where she left them. */
  private updateSparks(g: Game, dt: number) {
    const w = g.witch
    const L = TUNING.broom
    const r = this.sparkRand
    const moving = g.mode === 'flying' || g.mode === 'ready'
    const speed = g.mode === 'flying' ? TUNING.speed : g.mode === 'ready' ? TUNING.speed * 0.5 : 0
    if (moving && dt > 0) {
      const n = Math.min(6, Math.round(dt * 90 + r()))
      const c = Math.cos(w.angle)
      const sn = Math.sin(w.angle)
      for (let i = 0; i < n; i++) {
        const u = between(r, -0.82, -0.7)
        const v = between(r, -0.1, 0.09)
        this.sparks.push({
          x: w.x + (u * c - v * sn) * L,
          y: w.y + (u * sn + v * c) * L,
          vx: -between(r, 10, 70),
          vy: between(r, -40, 40),
          age: 0,
          life: between(r, 0.4, 0.9),
          warm: r() < 0.6,
          r: between(r, 1.4, 3.4),
        })
      }
    }
    for (const p of this.sparks) {
      p.age += dt
      p.x += (p.vx - speed) * dt
      p.y += p.vy * dt
      p.vy += 30 * dt
    }
    this.sparks = this.sparks.filter((p) => p.age < p.life)
  }

  private drawSparks(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const p of this.sparks) {
      const k = 1 - p.age / p.life
      ctx.globalAlpha = k * 0.9
      ctx.fillStyle = p.warm ? '#ffb347' : '#cfa8ff'
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * (0.5 + 0.5 * k), 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  }
}

function drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, seed: number) {
  const glow = ctx.createRadialGradient(x, y, radius * 0.8, x, y, radius * 4)
  glow.addColorStop(0, 'rgba(220, 215, 255, 0.35)')
  glow.addColorStop(0.35, 'rgba(160, 150, 230, 0.12)')
  glow.addColorStop(1, 'rgba(120, 110, 200, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(x - radius * 4, y - radius * 4, radius * 8, radius * 8)
  ctx.fillStyle = '#f3ecd2'
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, TAU)
  ctx.fill()
  const r = rng(hash(seed, 77))
  ctx.fillStyle = '#cbc19f'
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU
    const d = Math.sqrt(r()) * radius * 0.72
    const cr = radius * between(r, 0.06, 0.17)
    ctx.globalAlpha = between(r, 0.3, 0.55)
    ctx.beginPath()
    ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, cr, cr * 0.85, a, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  const limb = ctx.createRadialGradient(x, y, radius * 0.55, x, y, radius)
  limb.addColorStop(0, 'rgba(140, 130, 110, 0)')
  limb.addColorStop(1, 'rgba(140, 130, 110, 0.35)')
  ctx.fillStyle = limb
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, TAU)
  ctx.fill()
}

/** A candle's brightness 0..1 at `time`: a slow breath and a quick flicker. */
function candle(time: number, key: number): number {
  const r = rng(hash(key, 501))
  const a = between(r, 0.8, 1.6)
  const b = between(r, 5, 9)
  return 0.78 + 0.12 * Math.sin(TAU * a * time + r() * TAU) + 0.1 * Math.sin(TAU * b * time + r() * TAU)
}

/** How far through a blink, wink or chomp a lantern is: mostly 0, now and then up to 1 and back. */
function expression(time: number, key: number): number {
  const r = rng(hash(key, 502))
  const every = between(r, 2.5, 4)
  const p = (time / every + r()) % 1
  const len = 0.14
  return p < len ? Math.sin((Math.PI * p) / len) : 0
}

/** A jack-o'-lantern sitting on the ground at (x, ground), with a shadow. */
export function drawLanternOnGround(ctx: CanvasRenderingContext2D, x: number, ground: number, size: number, face: PumpkinFace, key: number, time: number) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.beginPath()
  ctx.ellipse(x, ground, size * 0.5, size * 0.07, 0, 0, TAU)
  ctx.fill()
  drawLantern(ctx, x, ground - size * PUMPKIN_BOTTOM, size, face, candle(time, key), expression(time, key))
}

/** A jack-o'-lantern `size` wide, its body centred on (cx, cy), lit to `lit` 0..1. */
export function drawLantern(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, face: PumpkinFace | null, lit: number, expr: number) {
  const pk = pumpkin(face, expr)
  if (face) {
    const halo = ctx.createRadialGradient(cx, cy, size * 0.2, cx, cy, size * 1.1)
    halo.addColorStop(0, `rgba(255, 150, 50, ${0.42 * lit})`)
    halo.addColorStop(1, 'rgba(255, 120, 30, 0)')
    ctx.fillStyle = halo
    ctx.fillRect(cx - size * 1.1, cy - size * 1.1, size * 2.2, size * 2.2)
  }
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(size, size)
  fillShapes(ctx, pk.body)
  if (pk.holes.length) {
    ctx.fillStyle = mix('#7a3a10', '#ffd27a', lit)
    for (const w of pk.walls) {
      ctx.beginPath()
      tracePath(ctx, w.pts, w.smooth, true)
      ctx.fill()
    }
    const flame = ctx.createRadialGradient(0, 0.06, 0.02, 0, 0.06, 0.4)
    flame.addColorStop(0, mix('#c86a10', '#fff4b8', lit))
    flame.addColorStop(0.45, mix('#a84a08', '#ffc23a', lit))
    flame.addColorStop(1, mix('#6a2000', '#ff7212', lit))
    ctx.fillStyle = flame
    for (const hole of pk.holes) {
      ctx.beginPath()
      tracePath(ctx, hole.pts, hole.smooth, true)
      ctx.fill()
    }
  }
  ctx.restore()
}
