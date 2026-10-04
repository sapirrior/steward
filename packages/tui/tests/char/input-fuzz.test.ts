import { describe, expect, test } from 'bun:test';
import { InputParser, TerminalEvent } from '../../src/terminal/input.js';

// Simple deterministic PRNG (Linear Congruential Generator)
function createRng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const sampleTokens = [
  'a',
  'Z',
  '1',
  ' ',
  '🚀',
  '中',
  '文',
  '\r',
  '\n',
  '\t',
  '\x08',
  '\x00',
  '\x01',
  '\x04',
  '\x1b[A',
  '\x1b[B',
  '\x1b[C',
  '\x1b[D',
  '\x1b[1;5A',
  '\x1b[1;2B',
  '\x1b[5~',
  '\x1b[6~',
  '\x1b[H',
  '\x1b[F',
  '\x1b[3~',
  '\x1b[Z',
  '\x1b[<64;10;5M',
  '\x1b[<0;20;30M',
  '\x1b[<0;20;30m',
  '\x1b[I',
  '\x1b[O',
  '\x1b[>0;276;0c',
  '\x1b]0;Title\x07',
  '\x1bx',
  '\x1b\x1b',
  '\x1b[200~Pasted Content\x1b[201~',
];

describe('Phase 2: Property & Fuzz Testing for InputParser (P1-P4)', () => {
  test('5,000 Seeded Random Partitions: P1-P4 Invariants Hold', () => {
    const seed = 20261004;
    const rng = createRng(seed);
    const parserDirect = new InputParser();
    const parserPartitioned = new InputParser();

    for (let iteration = 0; iteration < 5000; iteration++) {
      // 1. Build a random composite string from 1 to 5 sample tokens
      const tokenCount = 1 + Math.floor(rng() * 5);
      let composite = '';
      for (let t = 0; t < tokenCount; t++) {
        const tokenIdx = Math.floor(rng() * sampleTokens.length);
        composite += sampleTokens[tokenIdx]!;
      }

      // Direct evaluation
      parserDirect.reset();
      const directEvents = [...parserDirect.feed(composite), ...parserDirect.flush()];

      // Partitioned evaluation (split into 1 to 4 random chunks)
      parserPartitioned.reset();
      const partitionCount = 1 + Math.floor(rng() * 4);
      const splitPoints: number[] = [0];
      for (let p = 0; p < partitionCount - 1; p++) {
        splitPoints.push(Math.floor(rng() * composite.length));
      }
      splitPoints.push(composite.length);
      splitPoints.sort((a, b) => a - b);

      const partitionedEvents: TerminalEvent[] = [];
      for (let p = 0; p < splitPoints.length - 1; p++) {
        const chunk = composite.slice(splitPoints[p]!, splitPoints[p + 1]!);
        if (chunk.length > 0) {
          partitionedEvents.push(...parserPartitioned.feed(chunk));
        }
      }
      partitionedEvents.push(...parserPartitioned.flush());

      // Invariant P1: Fragmentation equivalence
      expect(partitionedEvents).toEqual(directEvents);

      // Invariant P2: No leakage of escape characters or control characters in 'input'
      for (const ev of directEvents) {
        if (ev.type === 'key') {
          expect(ev.input).not.toContain('\x1b');
          // Check no raw C0 control codes in input (0x00 - 0x1f except nothing)
          for (let i = 0; i < ev.input.length; i++) {
            const code = ev.input.charCodeAt(i);
            expect(code < 0x20 && code !== 0x09 && code !== 0x0a).toBe(false);
          }
        }
      }

      // Invariant P3: Parser state is clean after reset / flush
      expect(parserDirect.pending).toBe(false);
      expect(parserPartitioned.pending).toBe(false);
    }
  });
});
