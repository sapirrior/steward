import { getPendingEffects, type EffectRecord } from '../reconciler/hooks.js';
import type TerminalEngine from '../engine/TerminalEngine.js';

export class AppScheduler {
  private engine: TerminalEngine;
  private isBatching = false;
  private pendingUpdate = false;
  private updateCallback: () => void;

  constructor(engine: TerminalEngine, onUpdate: () => void) {
    this.engine = engine;
    this.updateCallback = onUpdate;
  }

  scheduleUpdate(): void {
    if (this.pendingUpdate) return;
    this.pendingUpdate = true;

    queueMicrotask(() => {
      if (!this.pendingUpdate) return;
      this.pendingUpdate = false;
      this.engine.batch(() => {
        this.updateCallback();
      });
    });
  }

  flushEffects(): void {
    const effects = getPendingEffects();
    if (effects.length === 0) return;

    const layoutEffects: EffectRecord[] = [];
    const passiveEffects: EffectRecord[] = [];

    for (const eff of effects) {
      if (eff.isLayout) {
        layoutEffects.push(eff);
      } else {
        passiveEffects.push(eff);
      }
    }

    // 1. Run layout effects synchronously in post-frame flush
    this.runEffectList(layoutEffects);

    // 2. Run passive useEffects in subsequent microtask
    if (passiveEffects.length > 0) {
      queueMicrotask(() => {
        this.runEffectList(passiveEffects);
      });
    }
  }

  private runEffectList(effects: EffectRecord[]): void {
    for (const eff of effects) {
      const slot = eff.instance.hookSlots[eff.hookIndex];
      if (slot && slot.kind === 'effect') {
        // Run previous cleanup if any
        if (typeof slot.destroy === 'function') {
          try {
            slot.destroy();
          } catch (e) {
            console.error('Error during effect cleanup:', e);
          }
          slot.destroy = undefined;
        }

        // Run new creator
        try {
          const destroy = eff.create();
          if (typeof destroy === 'function') {
            slot.destroy = destroy;
          }
        } catch (e) {
          console.error('Error during effect execution:', e);
        }
      }
    }
  }
}
