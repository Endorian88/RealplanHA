import * as THREE from 'three';

const _viewProjMatrix = new THREE.Matrix4();

/**
 * Caches camera View-Projection matrices and 2D screen coordinates for projected HUD badges,
 * room status cards, and callout leader cards.
 * - Avoids redundant DOM `style.transform` / `style.opacity` mutations when coordinates move by < 0.35px.
 * - Quantizes offscreen alert pin coordinates (> 1.5px threshold) to prevent React state re-render storms.
 */
export class ProjectionThrottleCache {
  private prevMatrixElements = new Float32Array(16);
  private prevViewportW = 0;
  private prevViewportH = 0;
  private domCoordsCache = new Map<string, { x: number; y: number; visible: boolean }>();

  /**
   * Returns true if the camera matrix or viewport size changed since the last check.
   */
  public hasCameraOrViewportMoved(
    camera: THREE.PerspectiveCamera,
    viewportW: number,
    viewportH: number
  ): boolean {
    _viewProjMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const el = _viewProjMatrix.elements;
    let changed = viewportW !== this.prevViewportW || viewportH !== this.prevViewportH;

    if (!changed) {
      for (let i = 0; i < 16; i++) {
        if (Math.abs(el[i] - this.prevMatrixElements[i]) > 1e-5) {
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      this.prevMatrixElements.set(el);
      this.prevViewportW = viewportW;
      this.prevViewportH = viewportH;
    }

    return changed;
  }

  /**
   * Updates a DOM element's transform and opacity only if its screen position changed by >= 0.35px
   * or its visibility changed.
   */
  public applyDomTransformIfMoved(
    key: string,
    el: HTMLElement,
    sx: number,
    sy: number,
    isVisible: boolean,
    anchorSuffix = ''
  ): void {
    const prev = this.domCoordsCache.get(key);
    if (!isVisible) {
      if (!prev || prev.visible) {
        el.style.opacity = '0';
        this.domCoordsCache.set(key, { x: sx, y: sy, visible: false });
      }
      return;
    }

    if (
      prev &&
      prev.visible &&
      Math.abs(prev.x - sx) < 0.35 &&
      Math.abs(prev.y - sy) < 0.35
    ) {
      return;
    }

    el.style.opacity = '1';
    el.style.transform = anchorSuffix
      ? `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) ${anchorSuffix}`
      : `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
    this.domCoordsCache.set(key, { x: sx, y: sy, visible: true });
  }

  public invalidateDomCache(): void {
    this.domCoordsCache.clear();
  }
}
