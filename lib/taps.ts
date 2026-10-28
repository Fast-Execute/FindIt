// Counts rapid consecutive taps. Pure (the caller supplies the clock) so it can be
// unit-tested: node --test lib/taps.test.mjs
//
// A tap that arrives more than `gapMs` after the previous one starts a new count, so
// the target has to be tapped `needed` times in one quick run. Returns true on the
// tap that completes the run, then starts over.

export function createTapCounter(options: { needed: number; gapMs: number }) {
  let count = 0;
  let last: number | null = null;

  return {
    tap(now: number): boolean {
      if (last === null || now - last > options.gapMs) count = 0;
      last = now;
      count += 1;
      if (count >= options.needed) {
        count = 0;
        last = null;
        return true;
      }
      return false;
    },
    reset() {
      count = 0;
      last = null;
    },
  };
}
