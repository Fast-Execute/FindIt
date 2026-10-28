// Run with: node --test lib/taps.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createTapCounter } from "./taps.ts";

const run = (counter, times, startAt = 1000, step = 200) =>
  Array.from({ length: times }, (_, i) => counter.tap(startAt + i * step));

test("fires on the 7th quick tap and not before", () => {
  const counter = createTapCounter({ needed: 7, gapMs: 1000 });
  assert.deepEqual(run(counter, 7), [false, false, false, false, false, false, true]);
});

test("six taps is not enough", () => {
  const counter = createTapCounter({ needed: 7, gapMs: 1000 });
  assert.equal(run(counter, 6).includes(true), false);
});

test("a pause longer than the gap starts the count over", () => {
  const counter = createTapCounter({ needed: 7, gapMs: 1000 });
  run(counter, 5, 1000);
  // 5 taps, a 3 second pause, then 6 more: never reaches 7 in one run.
  assert.equal(run(counter, 6, 6000).includes(true), false);
  // But 7 fresh taps after another pause does.
  assert.equal(run(counter, 7, 20000).at(-1), true);
});

test("a gap exactly at the limit still counts", () => {
  const counter = createTapCounter({ needed: 3, gapMs: 500 });
  assert.deepEqual([counter.tap(0), counter.tap(500), counter.tap(1000)], [false, false, true]);
});

test("starts over after firing: the 8th tap is not another trigger", () => {
  const counter = createTapCounter({ needed: 7, gapMs: 1000 });
  assert.equal(run(counter, 7).at(-1), true);
  assert.deepEqual(run(counter, 6, 5000), [false, false, false, false, false, false]);
  assert.equal(counter.tap(5000 + 6 * 200), true, "needs a full new run of 7");
});

test("works for the very first tap when the clock starts at zero", () => {
  const counter = createTapCounter({ needed: 2, gapMs: 1000 });
  assert.deepEqual([counter.tap(0), counter.tap(100)], [false, true]);
});

test("reset forgets progress", () => {
  const counter = createTapCounter({ needed: 3, gapMs: 1000 });
  counter.tap(0);
  counter.tap(100);
  counter.reset();
  assert.equal(counter.tap(200), false);
  assert.equal(counter.tap(300), false);
  assert.equal(counter.tap(400), true);
});
