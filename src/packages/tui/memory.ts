/**
 * memory.ts - Low-Level Engine TUI Memory & Panic Guard
 * 
 * Directly tests TerminalEngine, DocumentTree, StateRenderer, and Component
 * WITHOUT high-level JSX / React hooks / reconciler.
 * 
 * Automatically terminates IMMEDIATELY if memory spikes to prevent Android OOM crashes.
 */
import os from 'os';
import { TerminalEngine } from './src/engine/TerminalEngine.js';
import Component from './src/engine/Component.js';
import { nodeIO } from './src/terminal/io.js';
import { parseInputChunk } from './src/terminal/input.js';

// --- STRICT PANIC THRESHOLDS (Android Termux Safe) ---
const MAX_HEAP_MB = 30;         // Max V8 Heap: 30 MB
const MAX_RSS_MB = 65;          // Max Resident Set: 65 MB
const MIN_SYS_FREE_MB = 60;     // Min Free System RAM: 60 MB

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

function checkPanic(context: string) {
  const s = getMemoryStats();

  if (s.heapUsedMb > MAX_HEAP_MB) {
    process.stdout.write(`\r\n\x1b[31;1m🚨 [PANIC KILL] Heap breached in ${context}: ${s.heapUsedMb.toFixed(2)} MB (Max: ${MAX_HEAP_MB} MB)\x1b[0m\r\n`);
    process.exit(137);
  }
  if (s.rssMb > MAX_RSS_MB) {
    process.stdout.write(`\r\n\x1b[31;1m🚨 [PANIC KILL] RSS breached in ${context}: ${s.rssMb.toFixed(2)} MB (Max: ${MAX_RSS_MB} MB)\x1b[0m\r\n`);
    process.exit(137);
  }
  if (s.freeSysMb < MIN_SYS_FREE_MB) {
    process.stdout.write(`\r\n\x1b[31;1m🚨 [PANIC KILL] Low system RAM in ${context}: ${s.freeSysMb.toFixed(2)} MB free\x1b[0m\r\n`);
    process.exit(137);
  }
  return s;
}

// Low-level component directly overriding _getLines
class LowLevelUI extends Component {
  ticks = 0;
  keyPresses = 0;
  lastKey = 'none';

  _getLines(width: number): string[] {
    const stats = checkPanic('LowLevelUI._getLines');
    const border = '─'.repeat(Math.max(10, Math.min(width - 4, 70)));

    return [
      `\x1b[1;36m┌${border}┐\x1b[0m`,
      `\x1b[1;36m│\x1b[0m \x1b[1;32m⚡ LOW-LEVEL TERMINAL ENGINE MEMORY WATCHDOG\x1b[0m`,
      `\x1b[1;36m│\x1b[0m \x1b[90m(Pure TerminalEngine + StateRenderer - Zero Hooks/JSX)\x1b[0m`,
      `\x1b[1;36m├${border}┤\x1b[0m`,
      `\x1b[1;36m│\x1b[0m \x1b[1mFrame Ticks:\x1b[0m    \x1b[33m${this.ticks}\x1b[0m`,
      `\x1b[1;36m│\x1b[0m \x1b[1mKey Inputs:\x1b[0m     \x1b[35m${this.keyPresses}\x1b[0m (last key: \x1b[36m${this.lastKey}\x1b[0m)`,
      `\x1b[1;36m│\x1b[0m \x1b[1mProcess RSS:\x1b[0m    \x1b[32m${stats.rssMb.toFixed(2)} MB\x1b[0m \x1b[90m(Cap: ${MAX_RSS_MB} MB)\x1b[0m`,
      `\x1b[1;36m│\x1b[0m \x1b[1mHeap Used:\x1b[0m      \x1b[32m${stats.heapUsedMb.toFixed(2)} MB\x1b[0m \x1b[90m(Cap: ${MAX_HEAP_MB} MB)\x1b[0m`,
      `\x1b[1;36m│\x1b[0m \x1b[1mHeap Total:\x1b[0m     \x1b[90m${stats.heapTotalMb.toFixed(2)} MB\x1b[0m`,
      `\x1b[1;36m│\x1b[0m \x1b[1mSystem Free:\x1b[0m    \x1b[34m${stats.freeSysMb.toFixed(1)} MB\x1b[0m / \x1b[90m${stats.totalSysMb.toFixed(1)} MB\x1b[0m`,
      `\x1b[1;36m├${border}┤\x1b[0m`,
      `\x1b[1;36m│\x1b[0m \x1b[90mPress \x1b[1;37m'q'\x1b[0m\x1b[90m or \x1b[1;37m'Ctrl+C'\x1b[0m\x1b[90m to exit cleanly. Press any key to test input.\x1b[0m`,
      `\x1b[1;36m└${border}┘\x1b[0m`,
    ];
  }
}

async function main() {
  const io = nodeIO();
  const engine = new TerminalEngine({
    io,
    maxFps: 30,
    mouse: false,
    scrollKeys: true,
  });

  engine.ensureAlternateScreen();

  const ui = new LowLevelUI();
  ui.wrap = false;
  ui.clip = true;
  engine.mount(ui);

  // Background watchdog interval checking every 25ms
  const watchdog = setInterval(() => {
    checkPanic('watchdog');
  }, 25);
  if (watchdog.unref) watchdog.unref();

  // Tick timer updating state every 100ms
  const timer = setInterval(() => {
    ui.ticks++;
    ui.markDirty();
    engine.requestFrame();
  }, 100);

  // Auto-exit after 3 seconds for safe automated verification
  const autoTimeout = setTimeout(() => {
    cleanup();
  }, 3000);

  // Input handling
  const removeInput = engine.addInputListener((chunk) => {
    const events = parseInputChunk(typeof chunk === 'string' ? chunk : String(chunk));
    for (const ev of events) {
      if ((ev.key.ctrl && ev.key.name === 'c') || ev.input === 'q' || ev.input === 'Q') {
        cleanup();
        return true;
      }
      ui.keyPresses++;
      ui.lastKey = ev.key.name || ev.input || 'unknown';
      ui.markDirty();
      engine.requestFrame();
    }
  });

  function cleanup() {
    clearTimeout(autoTimeout);
    clearInterval(timer);
    clearInterval(watchdog);
    removeInput();
    engine.unmount(ui);
    engine.dispose();

    const finalStats = getMemoryStats();
    console.log('\n====================================================');
    console.log('✅ Low-Level Terminal Engine Exited Cleanly');
    console.log(`   Final RSS:       ${finalStats.rssMb.toFixed(2)} MB`);
    console.log(`   Final Heap Used: ${finalStats.heapUsedMb.toFixed(2)} MB`);
    console.log(`   Free System RAM: ${finalStats.freeSysMb.toFixed(1)} MB`);
    console.log('====================================================\n');
    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error('Fatal engine error:', err);
  process.exit(1);
});
