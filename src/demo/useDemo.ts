import { useCallback, useEffect, useRef, useState } from "react";

import type { Geometry } from "../geometry/devices";
import { FAMILY_ORDER, type GradientPresetId, type MaskFamily } from "../recipe/types";
import { PARAM_TRAVEL } from "../ui/gestures";
import { DEMO, type DemoSheet } from "./script";

export type Point = { x: number; y: number };

/**
 * Where the finger is, how it is moving, and what it has left behind.
 *
 * `angle` and `speed` are what make the contact patch read as a brush rather
 * than as a cursor: a fingertip dragged across glass is an ellipse pointing the
 * way it is going, not a circle.
 */
export type Finger = {
  x: number;
  y: number;
  /**
   * How hard the fingertip is pressing, 0 to 1.
   *
   * Not a boolean, because the interesting part of a press is the moment
   * between the two: flesh spreads under load, it does not switch.
   */
  press: number;
  /** Direction of travel, radians. */
  angle: number;
  /** 0 at rest, 1 at full speed. Drives the stretch of the contact patch. */
  speed: number;
  /** Recent positions, oldest first. */
  trail: Point[];
  /** 0 for none, otherwise how far the tap ring has spread, 0 to 1. */
  ripple: number;
};

/**
 * The load through a tap, over the length of its step.
 *
 * Eased on the way in and on the way out, so the pad spreads and recovers
 * rather than snapping to a size and back.
 */
function pressure(p: number): number {
  if (p < 0.1) return 0;
  if (p < 0.3) return ease((p - 0.1) / 0.2);
  if (p < 0.42) return 1;
  if (p < 0.55) return 1 - ease((p - 0.42) / 0.13);
  return 0;
}

/** The two corner buttons, so a tap can be shown landing on one. */
export type DemoSpots = { source: Point; export: Point };

/**
 * Everything the script is allowed to touch.
 *
 * Deliberately the same setters the interface calls, and nothing else: a demo
 * that reached into the state directly could show a combination the app cannot
 * reach, which is the one thing a demonstration must not do.
 */
export type DemoTargets = {
  family: (f: MaskFamily) => void;
  familyValue: () => MaskFamily;
  param: (v: number) => void;
  paramValue: () => number;
  palette: (id: GradientPresetId) => void;
  sheet: (s: DemoSheet) => void;
  peek: (on: boolean) => void;
};

/** How many positions the stroke keeps behind the fingertip. */
const TRAIL = 16;
/** Points between two samples above which the stroke gets filled in. */
const GAP = 8;
/** Points per frame that count as full speed, for the stretch. */
const FAST = 12;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Ease in and out, with a little wind up and a little overshoot.
 *
 * A hand does not stop dead on the value it was aiming for, it goes slightly
 * past and settles. The coefficient is a third of the usual "back" easing:
 * enough to be felt, not enough to look like a spring.
 */
const S = 0.35;
const C2 = 1.70158 * S * 1.525;
const ease = (t: number) =>
  t < 0.5
    ? (Math.pow(2 * t, 2) * ((C2 + 1) * 2 * t - C2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((C2 + 1) * (2 * t - 2) + C2) + 2) / 2;

/** A quadratic Bezier, which is the cheapest curve that is not a straight line. */
const bezier = (a: Point, c: Point, b: Point, t: number): Point => {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
};

/**
 * The control point of that curve: to one side of the straight line, by a tenth
 * of its own length.
 *
 * Nobody drags in a straight line. A perfectly straight path is the single
 * clearest tell that a screen is being driven by a script.
 */
function arc(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = len * 0.1;
  return {
    x: (from.x + to.x) / 2 - (dy / len) * bow,
    y: (from.y + to.y) / 2 + (dx / len) * bow,
  };
}

/**
 * Plays `DEMO`.
 *
 * The player owns the clock and the finger; the script owns what happens and
 * for how long. Nothing here knows what a mask is.
 */
export function useDemo(targets: DemoTargets, geometry: Geometry, spots: DemoSpots) {
  const [running, setRunning] = useState(false);
  const [finger, setFinger] = useState<Finger | null>(null);

  const raf = useRef<number | null>(null);
  // Read through refs: the loop outlives the render that started it, and it
  // must drive the current state rather than the state as it was at press.
  const live = useRef(targets);
  live.current = targets;
  const scene = useRef({ geometry, spots });
  scene.current = { geometry, spots };

  const stop = useCallback(() => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    setRunning(false);
    setFinger(null);
  }, []);

  // A loop still running after the screen is gone is how a demo becomes a leak.
  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    stop();
    setRunning(true);

    let index = 0;
    let began = 0;
    let paramFrom = 0;
    let from: Point = { x: 0, y: 0 };
    let to: Point = { x: 0, y: 0 };
    let ctrl: Point = { x: 0, y: 0 };
    // Steps that change something once (a family, a sheet) rather than over
    // their whole duration.
    let fired = false;
    // Motion of the fingertip, carried between frames.
    let trail: Point[] = [];
    let prev: Point = { x: 0, y: 0 };
    let angle = 0;
    let speed = 0;

    const enter = (now: number) => {
      const step = DEMO[index];
      const { geometry: g, spots: s } = scene.current;
      const mid = { x: g.width / 2, y: g.height / 2 };

      began = now;
      fired = false;
      trail = [];
      speed = 0;
      from = mid;
      to = mid;

      switch (step.kind) {
        case "param": {
          paramFrom = clamp01(live.current.paramValue());
          // Down increases, over PARAM_TRAVEL points for the full range. Both
          // come from the gesture itself, so the finger cannot describe a drag
          // the app would refuse.
          to = { x: mid.x, y: mid.y + (step.to - paramFrom) * PARAM_TRAVEL };
          break;
        }
        case "family": {
          const forward =
            FAMILY_ORDER.indexOf(step.to) > FAMILY_ORDER.indexOf(live.current.familyValue());
          // The pages move under the finger: the next family is a drag left.
          from = { x: g.width * (forward ? 0.78 : 0.22), y: mid.y };
          to = { x: g.width * (forward ? 0.22 : 0.78), y: mid.y };
          break;
        }
        case "sheet": {
          from = step.to === "source" ? s.source : s.export;
          to = from;
          break;
        }
        default:
          break;
      }

      ctrl = arc(from, to);
      prev = from;
    };

    /** One sample of the stroke, and the finger state that comes out of it. */
    const move = (at: Point, press: number) => {
      const dx = at.x - prev.x;
      const dy = at.y - prev.y;
      const step = Math.hypot(dx, dy);
      if (step > 0.5) {
        angle = Math.atan2(dy, dx);
      }
      // Smoothed, because a patch that resizes on every frame reads as flicker
      // rather than as speed.
      speed += (Math.min(1, step / FAST) - speed) * 0.25;

      // A sample per frame is beads on a string as soon as the hand moves
      // quickly: the gaps between them are wider than the marks themselves.
      // Filling in makes it one stroke, and makes the stroke longer the faster
      // the movement, which is what a brush does.
      const between = Math.min(3, Math.floor(step / GAP));
      for (let i = 1; i <= between; i += 1) {
        const k = i / (between + 1);
        trail.push({ x: prev.x + dx * k, y: prev.y + dy * k });
      }
      trail.push(at);
      while (trail.length > TRAIL) {
        trail.shift();
      }
      prev = at;
      setFinger({ x: at.x, y: at.y, press, angle, speed, trail: [...trail], ripple: 0 });
    };

    const tick = () => {
      const now = Date.now();
      const step = DEMO[index];
      const p = step.ms <= 0 ? 1 : Math.min(1, (now - began) / step.ms);
      const e = ease(p);

      switch (step.kind) {
        case "param":
          live.current.param(clamp01(paramFrom + (step.to - paramFrom) * e));
          // A drag is a light, steady contact: the pad is spread by the
          // movement rather than by the load.
          move(bezier(from, ctrl, to, e), 0.4);
          break;

        case "family":
          move(bezier(from, ctrl, to, e), 0.4);
          if (!fired && p >= 0.3) {
            fired = true;
            live.current.family(step.to);
          }
          break;

        case "palette":
          // The thumbnails are inside a native sheet, presented above every
          // view of ours, so there is nowhere to draw a finger. Nothing is
          // drawn rather than something in the wrong place.
          setFinger(null);
          if (!fired && p >= 0.2) {
            fired = true;
            live.current.palette(step.to);
          }
          break;

        case "sheet":
          // A tap: the patch lands, presses, and a ring spreads out of it while
          // the sheet comes up. Gone before the sheet reaches it.
          setFinger(
            step.to === null || p > 0.62
              ? null
              : {
                  x: from.x,
                  y: from.y,
                  press: pressure(p),
                  angle: 0,
                  speed: 0,
                  trail: [],
                  ripple: p < 0.18 ? 0 : Math.min(1, (p - 0.18) / 0.4),
                },
          );
          if (!fired && p >= 0.3) {
            fired = true;
            live.current.sheet(step.to);
          }
          break;

        case "peek":
          // The long press, and the one place the squash has time to be seen:
          // the pad settles over about half a second and stays spread for as
          // long as the finger is down. Held still, so no stroke is left.
          setFinger(
            step.on
              ? {
                  x: from.x,
                  y: from.y,
                  press: ease(Math.min(1, p / 0.4)),
                  angle: 0,
                  speed: 0,
                  trail: [],
                  ripple: 0,
                }
              : null,
          );
          if (!fired) {
            fired = true;
            live.current.peek(step.on);
          }
          break;

        case "hold":
          setFinger(null);
          break;
      }

      if (p >= 1) {
        index += 1;
        if (index >= DEMO.length) {
          stop();
          return;
        }
        enter(now);
      }
      raf.current = requestAnimationFrame(tick);
    };

    enter(Date.now());
    raf.current = requestAnimationFrame(tick);
  }, [stop]);

  return { running, finger, start, stop };
}
