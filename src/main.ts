/** The page: a canvas, a clock, and one button's worth of input. */

import { autopilot, newGame, pause, press, resize, step, WORLD_H, type Game } from './game'
import { Scene } from './scene'
import { drawHud } from './hud'
import { witch } from './art/halloween'
import { fillShapes } from './art/shapes'
import { hash } from './art/random'
import * as sound from './sound'

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const ctx = canvas.getContext('2d', { alpha: false })!
const muteButton = document.querySelector<HTMLButtonElement>('#mute')!

/** The rules run at a fixed rate whatever the screen's, so a 60 Hz and a 120 Hz screen fly the same. */
const STEP = 1 / 240

const BEST = 'broomstick.best'
let best = 0
try {
  best = Number(localStorage.getItem(BEST)) || 0
} catch {
  // Storage blocked: a best that lasts as long as the page.
}
let newBest = false
let touch = matchMedia('(pointer: coarse)').matches

/**
 * For demos and the video, from the address:
 *   ?pilot      the autopilot flies her (the one the tests fly), and nothing pauses on its own
 *   ?pilot=12   ...for 12 points, then it flies into the next tree
 *   ?seed=7     the first run's trees and the forest behind them are always the same
 * Press to start, as usual. An autopilot's score is never kept as the best.
 */
const params = new URLSearchParams(location.search)
const pilotParam = params.get('pilot')
const pilotUntil =
  pilotParam === null ? null : pilotParam === '' || !Number.isFinite(Number(pilotParam)) ? Infinity : Math.max(0, Math.floor(Number(pilotParam)))
const seedParam = params.get('seed')

const seedNow = () => (Date.now() ^ (performance.now() * 1000)) >>> 0
let scale = 1
let game: Game = newGame(seedParam ? Number(seedParam) >>> 0 : seedNow(), 1000)
const scene = new Scene(seedParam ? hash(Number(seedParam), 7) : seedNow())

/**
 * What happens, as a `broomstick` event on window, for script running in the page itself
 * (a browser driven by a script, as the video is filmed, or the console): start, score,
 * crash, over and restart, each with the score so far. The page refuses to be framed, so
 * it isn't for an embedding page.
 */
function announce(type: 'start' | 'score' | 'crash' | 'over' | 'restart') {
  window.dispatchEvent(new CustomEvent('broomstick', { detail: { type, score: game.score, crash: game.crash } }))
}

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  scale = h / WORLD_H
  const width = w / scale
  // A turned phone moves her across the screen and the trees with it: stop, and let the player look
  // first. An address bar sliding away only nudges the picture, and carries on. A demo flies on.
  if (pilotUntil === null && Math.abs(width - game.width) > game.width * 0.15) pause(game)
  resize(game, width)
}
new ResizeObserver(fitCanvas).observe(canvas)
fitCanvas()

function onPress() {
  sound.unlock()
  const what = press(game)
  if (what === 'restart') {
    game = newGame(seedNow(), game.width)
    newBest = false
    announce('restart')
    return
  }
  if (what === 'flap' || what === 'start') sound.flap()
  if (what === 'start') announce('start')
}

function finish() {
  newBest = pilotUntil === null && game.score > best
  if (newBest) {
    best = game.score
    try {
      localStorage.setItem(BEST, String(best))
    } catch {
      // Not remembered past this page.
    }
  }
}

canvas.addEventListener('pointerdown', (e) => {
  touch = e.pointerType === 'touch'
  e.preventDefault()
  onPress()
})
// A touch only counts as a gesture that may start sound when the finger lifts.
canvas.addEventListener('pointerup', () => sound.unlock())
window.addEventListener('keydown', (e) => {
  // Cmd-P prints and Cmd-M minimises: a shortcut is the browser's, not a flap or a pause.
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') {
    e.preventDefault()
    touch = false
    if (!e.repeat) onPress()
  } else if (e.code === 'KeyP' || e.code === 'Escape') {
    if (game.mode === 'flying') pause(game)
    else if (game.mode === 'paused') onPress()
  } else if (e.code === 'KeyM') {
    toggleMute()
  }
})
// A demo flies on in a window nobody is looking at.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && pilotUntil === null) pause(game)
})
window.addEventListener('blur', () => {
  if (pilotUntil === null) pause(game)
})

function showMute() {
  const m = sound.isMuted()
  muteButton.setAttribute('aria-pressed', String(m))
  muteButton.setAttribute('aria-label', m ? 'Sound is off' : 'Sound is on')
  muteButton.title = m ? 'Sound off (M)' : 'Sound on (M)'
}
function toggleMute() {
  sound.setMuted(!sound.isMuted())
  showMute()
}
muteButton.addEventListener('click', () => {
  sound.unlock()
  toggleMute()
  muteButton.blur()
})
showMute()

// For play-testing from the console in `npm run dev`; not in a build.
if (import.meta.env.DEV) {
  const advance = (seconds: number, each?: (g: Game) => void) => {
    for (let i = 0; i < seconds / STEP && game.mode !== 'over'; i++) {
      each?.(game)
      step(game, STEP)
    }
  }
  const paint = () => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    scene.draw(ctx, game, time, 0)
    drawHud(ctx, game, best, newBest, touch, pilotUntil !== null)
  }
  Object.assign(window, { broomstick: { game: () => game, press: onPress, advance, paint } })
}

let last = performance.now()
let carry = 0
let time = 0
function frame(now: number) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
  last = now
  time += dt
  carry += dt
  while (carry >= STEP) {
    carry -= STEP
    if (pilotUntil !== null && autopilot(game, pilotUntil) && press(game) === 'flap') sound.flap()
    const ev = step(game, STEP)
    if (ev.scored) {
      sound.score()
      announce('score')
    }
    if (ev.crashed) {
      sound.thud()
      announce('crash')
    }
    if (ev.landed) {
      finish()
      announce('over')
    }
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  scene.draw(ctx, game, time, game.mode === 'paused' ? 0 : dt)
  drawHud(ctx, game, best, newBest, touch, pilotUntil !== null)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

// The tab's icon: the witch across the moon, drawn with the same art.
{
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#f3ecd2'
  g.beginPath()
  g.arc(32, 32, 30, 0, Math.PI * 2)
  g.fill()
  g.translate(31, 44)
  g.rotate(-0.12)
  fillShapes(g, witch(52, 0.25, true, '#0a0710'))
  const link = document.createElement('link')
  link.rel = 'icon'
  link.href = c.toDataURL('image/png')
  document.head.appendChild(link)
}
