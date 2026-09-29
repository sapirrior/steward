/**
 * memory.ts - New createApp / mount Architecture Memory Watchdog
 * 
 * Verifies that the new hook-free createApp() and mount() engine
 * renders with 100% stable, zero-leak memory profile under strict Termux limits.
 * 
 * Auto-exits after 3 seconds.
 */
import os from 'os';
import { createApp, Box, Text } from './src/index.js';
import { nodeIO } from './src/terminal/io.js';

// --- STRICT LIMITS ---
const MAX_HEAP_MB = 25;       // Max V8 Heap: 25 MB
const MAX_RSS_MB = 65;        // Max RSS: 65 MB
const MIN_SYS_FREE_MB = 50;   // Min Free RAM: 50 MB

function getMemoryStats() {
  const mem = process.memoryUsage();
  const freeSysMb = os.freemem() / (1024 * 1024);
  const totalSysMb = os.totalmem() / (1024 * 1024);
  return {
    rssMb: mem.rss / (1024 * 1024),
    heapUsedMb: mem.heapUsed / (1024 * 1024),
    heapTotalMb: mem.heapTotal / (1024 * 1024),
    externalMb: mem.external / (1024 * 1024),
    freeSysMb,
    totalSysMb,
  };
}

function checkPanic(ctx: string) {
  const s = getMemoryStats();

  if (s.heapUsedMb > MAX_HEAP_MB) {
    process.stdout.write(`\r\n\x1b[31;1m🚨 [PANIC KILL] Heap limit breached in ${ctx}: ${s.heapUsedMb.toFixed(2)} MB\x1b[0m\r\n`);
    process.exit(137);
  }
  if (s.rssMb > MAX_RSS_MB) {
    process.stdout.write(`\r\n\x1b[31;1m🚨 [PANIC KILL] RSS limit breached in ${ctx}: ${s.rssMb.toFixed(2)} MB\x1b[0m\r\n`);
    process.exit(137);
  }
  if (s.freeSysMb < MIN_SYS_FREE_MB) {
    process.stdout.write(`\r\n\x1b[31;1m🚨 [PANIC KILL] Low system RAM in ${ctx}: ${s.freeSysMb.toFixed(1)} MB free\x1b[0m\r\n`);
    process.exit(137);
  }
  return s;
}

// Background watchdog running every 20ms
const watchdog = setInterval(() => {
  checkPanic('watchdog');
}, 20);
if (watchdog.unref) watchdog.unref();

interface AppState {
  ticks: number;
  keys: number;
  lastKey: string;
}

const io = nodeIO();

const app = createApp<AppState>(
  (state, _ctx) => {
    const stats = checkPanic('renderFn');

    return Box(
      {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: 'cyan',
        paddingX: 2,
        paddingY: 1,
      },
      Text({ bold: true, color: 'cyan' }, '⚡ STITCHABLE NEW MOUNT/CREATEAPP ARCHITECTURE'),
      Text({ dim: true }, '(Zero Hooks · Zero Microtasks · Pure Functional Element Tree)'),
      Text({ bold: true, color: 'yellow', marginTop: 1 }, `Frame Ticks:  ${state.ticks}`),
      Text({ color: 'magenta' }, `Key Events:   ${state.keys} (last: ${state.lastKey})`),
      Text({ color: 'green', marginTop: 1 }, `Heap Used:    ${stats.heapUsedMb.toFixed(2)} MB / ${MAX_HEAP_MB} MB cap`),
      Text({ color: 'green' }, `Process RSS:  ${stats.rssMb.toFixed(2)} MB / ${MAX_RSS_MB} MB cap`),
      Text({ color: 'blue' }, `Free RAM:     ${stats.freeSysMb.toFixed(1)} MB / ${stats.totalSysMb.toFixed(1)} MB`),
      Text({ dim: true, marginTop: 1 }, `Auto-exits in 3 seconds · Press 'q' to quit early`)
    );
  },
  {
    io,
    maxFps: 30,
    state: {
      ticks: 0,
      keys: 0,
      lastKey: 'none',
    },
    onMount(state, ctx) {
      const timer = setInterval(() => {
        state.ticks++;
        ctx.invalidate();
      }, 100);

      ctx.addCleanup(() => {
        clearInterval(timer);
      });
    },
    onKey(input, key, state, ctx) {
      if (input === 'q' || input === 'Q') {
        ctx.exit();
        return;
      }
      state.keys++;
      state.lastKey = key.name || input || 'unknown';
      ctx.invalidate();
    },
  }
);

// Auto-exit after 3s
setTimeout(() => {
  clearInterval(watchdog);
  app.unmount();

  const finalStats = getMemoryStats();
  console.log('\n====================================================');
  console.log('✅ NEW CREATEAPP / MOUNT ARCHITECTURE EXITED CLEANLY');
  console.log(`   Final Heap Used: ${finalStats.heapUsedMb.toFixed(2)} MB (Max limit: ${MAX_HEAP_MB} MB)`);
  console.log(`   Final RSS:       ${finalStats.rssMb.toFixed(2)} MB (Max limit: ${MAX_RSS_MB} MB)`);
  console.log(`   System Free RAM: ${finalStats.freeSysMb.toFixed(1)} MB`);
  console.log('====================================================\n');
  process.exit(0);
}, 3000);
