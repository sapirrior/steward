import { DocumentTree } from '../src/engine/DocumentTree.js';
import StateRenderer from '../src/engine/StateRenderer.js';
import Component from '../src/engine/Component.js';

class DynamicRowComponent extends Component {
  private count = 0;
  tick() {
    this.count++;
    this.markDirty();
  }
  render() {
    return [`Live Dynamic Component Status: frame ${this.count}`];
  }
}

async function runBenchmark() {
  const width = 200;
  const height = 50;
  const historyRowCount = 10000;
  const frameCount = 1000;

  // Intercept process.stdout so benchmark runs cleanly
  const origCols = process.stdout.columns;
  const origRows = process.stdout.rows;
  const origWrite = process.stdout.write;

  process.stdout.columns = width;
  process.stdout.rows = height;
  process.stdout.write = (() => true) as any;

  try {
    const tree = new DocumentTree();
    const historyLines: string[] = [];
    for (let i = 0; i < historyRowCount; i++) {
      historyLines.push(`[History Log #${i}] Information message line with details and standard text`);
    }
    tree.addText(historyLines, false);

    const liveComp = new DynamicRowComponent();
    tree.mountNode({
      id: 'live-bench-node',
      kind: 'custom',
      wrap: false,
      clip: true,
      getLines: (w) => liveComp._getLines(w),
    });

    const renderer = new StateRenderer();

    // Warmup frame
    renderer.render(tree, 0, false);

    if (global.gc) {
      global.gc();
    }
    const memBefore = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    for (let f = 0; f < frameCount; f++) {
      liveComp.tick();
      renderer.render(tree, 0, false);
    }

    const totalTimeMs = performance.now() - startTime;
    const memAfter = process.memoryUsage().heapUsed;
    const memDeltaMb = ((memAfter - memBefore) / (1024 * 1024)).toFixed(2);
    const msPerFrame = (totalTimeMs / frameCount).toFixed(4);

    console.log(`BENCHMARK RESULTS:`);
    console.log(`- Screen: ${width}x${height}`);
    console.log(`- History Rows: ${historyRowCount}`);
    console.log(`- Frames: ${frameCount}`);
    console.log(`- Total Time: ${totalTimeMs.toFixed(2)}ms`);
    console.log(`- Average Time / Frame: ${msPerFrame} ms/frame`);
    console.log(`- Heap Delta: ${memDeltaMb} MB`);
  } finally {
    process.stdout.columns = origCols;
    process.stdout.rows = origRows;
    process.stdout.write = origWrite;
  }
}

runBenchmark();
