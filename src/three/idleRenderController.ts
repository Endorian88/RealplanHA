import * as THREE from 'three';
import { PerformanceMode } from '../types/floorplan';

/**
 * Smart Idle Rendering & Adaptive Frame Pacing Controller.
 * - Wakes up immediately on user interaction, camera damping, or Home Assistant state changes.
 * - Caps frame rate at ~30 FPS in 'eco' mode to keep wall tablets & low-power devices cool.
 * - Throttles to a low-power ~5 FPS check when the scene is completely static.
 * - Uses WebGL2 fenceSync (`afterDraw`) on software WebGL renderers so headless/CPU contexts never stall.
 */
export class IdleRenderController {
  public wakeUpUntil = 0;
  private frameId = 0;
  private idleTimeoutId = 0;
  private lastEcoFrameTime = 0;
  private readonly isSoftwareGl: boolean;
  private readonly renderer: THREE.WebGLRenderer;

  constructor(renderer: THREE.WebGLRenderer, isSoftwareGl: boolean) {
    this.renderer = renderer;
    this.isSoftwareGl = isSoftwareGl;
    this.wakeUp(2000);
  }

  public wakeUp(durationMs = 950): void {
    const target = performance.now() + durationMs;
    if (target > this.wakeUpUntil) {
      this.wakeUpUntil = target;
    }
  }

  public shouldSkipEcoFrame(now: number, performanceMode: PerformanceMode): boolean {
    if (performanceMode === 'eco' && now - this.lastEcoFrameTime < 31) {
      return true;
    }
    this.lastEcoFrameTime = now;
    return false;
  }

  public scheduleNextFrame(tickCallback: () => void, isAnimating: boolean, now: number): void {
    if (this.isSoftwareGl) {
      this.afterDraw(tickCallback);
    } else if (isAnimating || now < this.wakeUpUntil) {
      this.frameId = requestAnimationFrame(tickCallback);
    } else {
      // Smart Idle Sleep: when camera & animations are stationary, drop to low-power ~5.5 FPS check
      this.idleTimeoutId = window.setTimeout(() => {
        this.frameId = requestAnimationFrame(tickCallback);
      }, 180);
    }
  }

  public requestImmediateFrame(tickCallback: () => void): void {
    this.frameId = requestAnimationFrame(tickCallback);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    gl.flush();
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const poll = () => {
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose(): void {
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    clearTimeout(this.idleTimeoutId);
  }
}
