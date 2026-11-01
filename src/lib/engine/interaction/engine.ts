/**
 * AII Creative Engine — InteractionEngine
 * Maps InteractionMappings + input state → next RuntimeState, one frame at a time.
 */

import type { InteractionMapping } from "@/types/domain";
import type {
  InteractionInputState,
  RuntimeState,
  RuntimeObjectState,
} from "@/lib/engine/types";
import { applyEasing, clamp01, normalize, lerp } from "./easing";

// ============================================================
// InteractionEngine
// ============================================================

export class InteractionEngine {
  /** Smoothed value history, keyed by rule.id */
  private _smoothed: Map<string, number> = new Map();

  /**
   * Process all interaction rules for one frame.
   * Pure: does not mutate `currentState`.
   */
  process(
    rules: InteractionMapping[],
    inputs: InteractionInputState,
    currentState: RuntimeState
  ): RuntimeState {
    // Deep-clone current state so we never mutate the input
    const nextState: RuntimeState = {};
    for (const [id, obj] of Object.entries(currentState)) {
      nextState[id] = { ...obj, transform: { ...obj.transform } };
    }

    for (const rule of rules) {
      // Skip rules that reference objects not in the current state
      const objState = nextState[rule.objectId];
      if (objState === undefined) continue;

      // 1. Extract raw input value
      const rawValue = this._getRawInput(rule.input, inputs);

      // 2. Normalize to [0, 1]
      const t = normalize(rawValue, rule.inputMin, rule.inputMax);

      // 3. Apply easing
      const easedT = applyEasing(t, rule.easing);

      // 4. Map to output range
      const targetValue = lerp(rule.outputMin, rule.outputMax, easedT);

      // 5. Apply exponential smoothing
      //    smoothing=0 → alpha=1 (instant)
      //    smoothing=1 → alpha=0.03 (near-frozen)
      const alpha = 1 - rule.smoothing * 0.97;
      const prev = this._smoothed.get(rule.id) ?? targetValue;
      const smoothedValue = lerp(prev, targetValue, alpha);
      this._smoothed.set(rule.id, smoothedValue);

      // 6. Apply smoothed value to object state
      this._applyOutput(rule.output, smoothedValue, objState);
    }

    return nextState;
  }

  /** Clear all smoothing history (e.g. on scene reset). */
  reset(): void {
    this._smoothed.clear();
  }

  // ── private helpers ──────────────────────────────────────────

  private _getRawInput(
    input: InteractionMapping["input"],
    inputs: InteractionInputState
  ): number {
    switch (input) {
      case "audio_frequency":
        return inputs.audio?.overall ?? 0;
      case "audio_bass":
        return inputs.audio?.bass ?? 0;
      case "audio_mid":
        return inputs.audio?.mid ?? 0;
      case "audio_treble":
        return inputs.audio?.treble ?? 0;
      case "audio_volume":
        return inputs.audio?.overall ?? 0;

      case "pointer_move_x":
        return inputs.pointer.x;
      case "pointer_move_y":
        return inputs.pointer.y;
      case "pointer_click":
        return inputs.pointer.clickThisFrame ? 1 : 0;
      case "pointer_drag_x":
        return inputs.pointer.dx;
      case "pointer_drag_y":
        return inputs.pointer.dy;

      case "scroll_y":
        return inputs.scrollY;

      case "timeline_trigger":
        return inputs.timelineMs > 0 ? 1 : 0;

      default: {
        const _: never = input;
        void _;
        return 0;
      }
    }
  }

  private _applyOutput(
    output: InteractionMapping["output"],
    value: number,
    state: RuntimeObjectState
  ): void {
    switch (output) {
      case "position_x":
        state.transform.x = value;
        break;
      case "position_y":
        state.transform.y = value;
        break;
      case "scale_x":
        state.transform.scaleX = value;
        break;
      case "scale_y":
        state.transform.scaleY = value;
        break;
      case "rotation":
        state.transform.rotation = value;
        break;
      case "opacity":
        state.transform.opacity = clamp01(value);
        break;

      case "color_hue":
        state.colorHue = value;
        break;
      case "color_brightness":
        state.colorBrightness = value;
        break;

      case "visibility":
        state.visible = value > 0.5;
        break;

      case "particle_count":
        state.particleCount = Math.max(0, Math.round(value));
        break;
      case "particle_speed":
        state.particleSpeed = Math.max(0, value);
        break;

      case "scene_transition":
        // Handled by the runtime layer — not applied to object state
        break;

      default: {
        const _: never = output;
        void _;
        break;
      }
    }
  }
}
