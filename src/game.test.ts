import { describe, expect, test } from 'vitest'
import { CEILING, GROUND, TUNING, autopilot, growTree, hitPoints, inside, newGame, pause, press, step, touches, type Game } from './game'

const DT = 1 / 240

/** The game's own autopilot, which `?pilot` flies the real page with. */
function pilot(g: Game) {
  if (autopilot(g)) press(g)
}

function fly(g: Game, seconds: number, each?: (g: Game) => void) {
  for (let i = 0; i < seconds / DT && g.mode !== 'over'; i++) {
    each?.(g)
    step(g, DT)
  }
}

describe('flight', () => {
  test('a flap sends her up and gravity brings her back down', () => {
    const g = newGame(7, 1600)
    press(g)
    expect(g.mode).toBe('flying')
    const y0 = g.witch.y
    step(g, DT)
    expect(g.witch.y).toBeLessThan(y0)
    fly(g, 0.6)
    expect(g.witch.y).toBeGreaterThan(y0)
  })

  test('left alone she falls to the forest floor, and that is the end', () => {
    const g = newGame(7, 1600)
    press(g)
    fly(g, 5)
    expect(g.mode).toBe('over')
    expect(g.crash).toBe('ground')
    expect(Math.max(...hitPoints(g.witch).map((p) => p[1]))).toBeCloseTo(GROUND, 0)
  })

  test('flapping without stopping never takes her through the canopy', () => {
    const g = newGame(7, 1600)
    press(g)
    let highest = Infinity
    fly(g, 1.5, (g) => {
      press(g)
      highest = Math.min(highest, ...hitPoints(g.witch).map((p) => p[1]))
    })
    expect(highest).toBeGreaterThanOrEqual(CEILING - 0.01)
  })

  test('paused, nothing moves; the press that resumes does not flap', () => {
    const g = newGame(7, 1600)
    press(g)
    fly(g, 0.2)
    pause(g)
    const before = { y: g.witch.y, scroll: g.scroll }
    fly(g, 2)
    expect({ y: g.witch.y, scroll: g.scroll }).toEqual(before)
    expect(press(g)).toBe('resume')
    expect(g.witch.vy).toBe(0)
    step(g, DT)
    expect(g.witch.y).toBeGreaterThan(before.y)
  })

  test('a press on the game-over screen does nothing until it has been up a moment', () => {
    const g = newGame(7, 1600)
    press(g)
    fly(g, 5)
    expect(g.mode).toBe('over')
    expect(press(g)).toBe(null)
    for (let i = 0; i < 0.7 / DT; i++) step(g, DT)
    expect(press(g)).toBe('restart')
  })
})

describe('trees', () => {
  test('a tree reaches exactly as far as asked with its solid branches, and is no wider than allowed', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const reach of [140, 260, 380, 480]) {
        for (const hanging of [false, true]) {
          const tree = growTree(seed * 977, 0, reach, hanging)
          const ys = tree.solids.flatMap((s) => s.pts.map((p) => p[1]))
          const xs = tree.shapes.flatMap((s) => s.pts.map((p) => p[0]))
          if (hanging) expect(Math.max(...ys)).toBeCloseTo(reach, 6)
          else expect(Math.min(...ys)).toBeCloseTo(-reach, 6)
          expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(TUNING.treeWidth + 1e-6)
        }
      }
    }
  })

  test('the trunk is solid and the middle of the gap is clear', () => {
    const below = growTree(42, GROUND, 300, false)
    expect(touches(below, 500, [[500, GROUND - 40]])).toBe(true)
    expect(touches(below, 500, [[500, GROUND - 300 - 60]])).toBe(false)
    const above = growTree(43, 0, 300, true)
    expect(touches(above, 500, [[500, 40]])).toBe(true)
    expect(touches(above, 500, [[500, 360]])).toBe(false)
  })

  test('only the outermost twigs are forgiven, and they reach only a little way into the gap', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const reach of [150, 300, 450]) {
        const tree = growTree(seed * 131, GROUND, reach, false)
        expect(tree.solids.length).toBeGreaterThan(tree.shapes.length * 0.3)
        expect(tree.solids.length).toBeLessThan(tree.shapes.length)
        const drawnTop = Math.min(...tree.shapes.flatMap((s) => s.pts.map((p) => p[1])))
        expect(-drawnTop - reach).toBeLessThan(Math.max(30, reach * 0.2))
      }
    }
  })

  test('point in polygon', () => {
    const sq: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]
    expect(inside([5, 5], sq)).toBe(true)
    expect(inside([15, 5], sq)).toBe(false)
  })
})

describe('a whole run', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    test(`a pilot aiming for the middle of each gap gets past 50 trees (seed ${seed})`, () => {
      const g = newGame(seed, 1600)
      press(g)
      const gaps = new Map<number, { top: number; bottom: number; below: number; above: number }>()
      fly(g, 120, (g) => {
        pilot(g)
        for (const o of g.obstacles) {
          if (gaps.has(o.id)) continue
          const belowTop = Math.min(...o.below.solids.flatMap((s) => s.pts.map((p) => p[1]))) + o.below.base
          const aboveBottom = Math.max(...o.above.solids.flatMap((s) => s.pts.map((p) => p[1]))) + o.above.base
          gaps.set(o.id, { top: o.gapTop, bottom: o.gapBottom, below: belowTop, above: aboveBottom })
        }
        if (g.score >= 50) g.mode = 'over'
      })
      expect(g.crash).toBe(null)
      expect(g.score).toBe(50)
      for (const gap of gaps.values()) {
        expect(gap.bottom - gap.top).toBe(TUNING.gap)
        expect(gap.below).toBeCloseTo(gap.bottom, 6)
        expect(gap.above).toBeCloseTo(gap.top, 6)
      }
    })
  }

  test('each tree scores once, as she passes its trunk', () => {
    const g = newGame(11, 1600)
    press(g)
    let scored = 0
    for (let i = 0; i < 30 / DT && g.mode === 'flying'; i++) {
      pilot(g)
      if (step(g, DT).scored) scored++
    }
    expect(scored).toBe(g.score)
    expect(g.score).toBeGreaterThan(10)
  })

  test('told to stop after five, the autopilot flies into the sixth tree', () => {
    const g = newGame(4, 1600)
    press(g)
    fly(g, 60, (g) => {
      if (autopilot(g, 5)) press(g)
    })
    expect(g.mode).toBe('over')
    expect(g.crash).toBe('tree')
    expect(g.score).toBe(5)
  })

  test('flying level at the height of a trunk ends the run against the tree', () => {
    const g = newGame(3, 1600)
    press(g)
    fly(g, 30, (g) => {
      // Hold her just above the floor, where every trunk is.
      if (g.witch.y > GROUND - 60 && g.witch.vy > 0) press(g)
    })
    expect(g.mode).toBe('over')
    expect(g.crash).toBe('tree')
    expect(g.score).toBe(0)
  })
})
