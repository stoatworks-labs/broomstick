/**
 * Three sounds, made on the spot with Web Audio: a whoosh for a flap, a ting
 * for a tree passed, a thud for the end. No files to fetch.
 *
 * The context is made on the first press, which is when browsers allow it.
 */

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null
let muted = false

const KEY = 'broomstick.muted'
try {
  muted = localStorage.getItem(KEY) === '1'
} catch {
  // Storage blocked: sound on, and not remembered.
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem(KEY, m ? '1' : '0')
  } catch {
    // Not remembered; it still applies now.
  }
}

/** Call from a user gesture. */
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = new AC()
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

function out(gain: number, at: number, length: number): GainNode | null {
  if (!ctx || muted) return null
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, at + length)
  g.connect(ctx.destination)
  return g
}

export function flap() {
  if (!ctx || !noise) return
  const t = ctx.currentTime
  const g = out(0.22, t, 0.16)
  if (!g) return
  const src = ctx.createBufferSource()
  src.buffer = noise
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.4
  bp.frequency.setValueAtTime(700, t)
  bp.frequency.exponentialRampToValueAtTime(2400, t + 0.14)
  src.connect(bp).connect(g)
  src.start(t)
  src.stop(t + 0.17)
}

export function score() {
  if (!ctx) return
  const t = ctx.currentTime
  const g = out(0.09, t, 0.35)
  if (!g) return
  for (const [f, d] of [[988, 0], [1319, 0.07]] as const) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    o.connect(g)
    o.start(t + d)
    o.stop(t + 0.36)
  }
}

export function thud() {
  if (!ctx || !noise) return
  const t = ctx.currentTime
  const g = out(0.5, t, 0.4)
  if (!g) return
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(42, t + 0.3)
  o.connect(g)
  o.start(t)
  o.stop(t + 0.42)
  const src = ctx.createBufferSource()
  src.buffer = noise
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 600
  const ng = ctx.createGain()
  ng.gain.value = 0.5
  src.connect(lp).connect(ng).connect(g)
  src.start(t)
  src.stop(t + 0.2)
}
