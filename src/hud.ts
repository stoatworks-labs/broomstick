/** The words on screen: the title, the score, and what the forest has to say about it. */

import { WORLD_H, type Game } from './game'
import { hash, pick, rng } from './art/random'

const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif'

const TREE_QUIPS = [
  'That tree was there first.',
  "Brooms don't come with brakes.",
  'The forest would like a word.',
  'The cat saw that coming.',
  'Oak: 1. Witch: 0.',
]
const GROUND_QUIPS = ['The ground was also there first.', 'Landed. Technically.', 'Gravity remains undefeated.']

export function quip(g: Game): string {
  const r = rng(hash(g.seed, 9))
  if (g.score === 0 && g.crash === 'tree') return 'Not one tree. Impressive, in its way.'
  return pick(r, g.crash === 'ground' ? GROUND_QUIPS : TREE_QUIPS)
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, opts: { weight?: number; colour?: string; alpha?: number } = {}) {
  ctx.font = `${opts.weight ?? 600} ${size}px ${SERIF}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = opts.alpha ?? 1
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(3, size * 0.12)
  ctx.strokeStyle = 'rgba(4, 3, 10, 0.85)'
  ctx.strokeText(s, x, y)
  ctx.fillStyle = opts.colour ?? '#f3ecd2'
  ctx.fillText(s, x, y)
  ctx.globalAlpha = 1
}

/** A font size no bigger than `size` that fits `s` in `width`. */
function fit(ctx: CanvasRenderingContext2D, s: string, size: number, width: number, weight = 600): number {
  ctx.font = `${weight} ${size}px ${SERIF}`
  const w = ctx.measureText(s).width
  return w > width ? Math.floor((size * width) / w) : size
}

/** `pilot`: the autopilot is flying, so the best score on screen would be somebody else's. */
export function drawHud(ctx: CanvasRenderingContext2D, g: Game, best: number, newBest: boolean, touch: boolean, pilot = false) {
  const W = g.width
  const cx = W / 2
  const inner = W - 64
  const how = touch ? 'Tap to fly' : 'Click, tap or press Space to fly'

  if (g.mode === 'ready') {
    const title = 'Broomstick'
    text(ctx, title, cx, 210, fit(ctx, title, 120, inner))
    text(ctx, 'Mind the trees.', cx, 300, fit(ctx, 'Mind the trees.', 40, inner, 400), { weight: 400, alpha: 0.85 })
    const blink = 0.55 + 0.45 * Math.sin(g.t * 4)
    text(ctx, how, cx, 700, fit(ctx, how, 38, inner), { colour: '#ffc23a', alpha: blink })
    if (best > 0 && !pilot) text(ctx, `Best ${best}`, cx, 760, 30, { weight: 400, alpha: 0.7 })
    return
  }

  if (g.mode === 'flying' || g.mode === 'falling' || g.mode === 'paused') {
    text(ctx, String(g.score), cx, 120, 84)
  }

  if (g.mode === 'paused') {
    const s = touch ? 'Paused. Tap to carry on.' : 'Paused. Click, tap or Space to carry on.'
    text(ctx, s, cx, WORLD_H / 2, fit(ctx, s, 44, inner))
    return
  }

  if (g.mode === 'over') {
    const k = Math.min(1, g.sinceCrash / 0.35)
    ctx.globalAlpha = 0.55 * k
    ctx.fillStyle = '#05040c'
    ctx.fillRect(0, 0, W, WORLD_H)
    ctx.globalAlpha = 1
    text(ctx, String(g.score), cx, 300, 150, { alpha: k })
    const fresh = newBest && g.score > 0
    const under = pilot ? 'Flown by the autopilot' : fresh ? 'A new best.' : `Best ${best}`
    text(ctx, under, cx, 400, 40, { weight: 400, alpha: k, colour: fresh ? '#ffc23a' : '#f3ecd2' })
    const q = quip(g)
    text(ctx, q, cx, 490, fit(ctx, q, 40, inner, 400), { weight: 400, alpha: k * 0.9 })
    if (g.sinceCrash > 0.6) {
      const again = touch ? 'Tap to try again' : 'Click, tap or press Space to try again'
      text(ctx, again, cx, 640, fit(ctx, again, 38, inner), { colour: '#ffc23a', alpha: 0.55 + 0.45 * Math.sin(g.sinceCrash * 4) })
    }
  }
}
