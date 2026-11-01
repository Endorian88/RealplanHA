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
  private domCoordsCache = new Map<
    string,
    { x: number; y: number; visible: boolean; subpixel: boolean }
  >();

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
   * Hides a projected DOM element when behind the camera or out of bounds.
   */
  public applyDomHidden(key: string, el: HTMLElement): void {
    const prev = this.domCoordsCache.get(key);
    if (!prev || prev.visible) {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      this.domCoordsCache.set(key, {
        x: prev?.x ?? -9999,
        y: prev?.y ?? -9999,
        visible: false,
        subpixel: false,
      });
    }
  }

  /**
   * Hybrid Subpixel-Glide & Stationary Crisp-Snap DOM projection:
   * - While `isCameraMoving === true`: uses sub-pixel `translate3d(x.xxpx, y.yypx, 0)` so cards & badges
   *   glide with zero 1-pixel stair-stepping during camera tours and orbits.
   * - When `isCameraMoving === false`: snaps to integer pixel coordinates with 2D `translate(rx, ry)`
   *   so stationary card typography is 100% razor-sharp.
   */
  public applyDomTransformIfMoved(
    key: string,
    el: HTMLElement,
    sx: number,
    sy: number,
    anchorSuffixOrVisible: string | boolean = '',
    maybeAnchorSuffix = '',
    isCameraMoving = false
  ): void {
    const isVisible = typeof anchorSuffixOrVisible === 'boolean' ? anchorSuffixOrVisible : true;
    const anchorSuffix =
      typeof anchorSuffixOrVisible === 'string' ? anchorSuffixOrVisible : maybeAnchorSuffix;

    if (!isVisible) {
      this.applyDomHidden(key, el);
      return;
    }

    const suffix = anchorSuffix
      ? anchorSuffix.startsWith(' ')
        ? anchorSuffix
        : ` ${anchorSuffix}`
      : '';

    if (isCameraMoving) {
      const fx = Math.round(sx * 100) / 100;
      const fy = Math.round(sy * 100) / 100;
      const prev = this.domCoordsCache.get(key);
      if (
        prev &&
        prev.visible &&
        prev.subpixel &&
        Math.abs(prev.x - fx) < 0.12 &&
        Math.abs(prev.y - fy) < 0.12
      ) {
        return;
      }

      el.style.opacity = '1';
      el.style.pointerEvents = '';
      el.style.transform = `translate3d(${fx}px, ${fy}px, 0)${suffix}`;
      this.domCoordsCache.set(key, { x: fx, y: fy, visible: true, subpixel: true });
      return;
    }

    const rx = Math.round(sx);
    const ry = Math.round(sy);
    const prev = this.domCoordsCache.get(key);
    if (prev && prev.visible && !prev.subpixel && prev.x === rx && prev.y === ry) {
      return;
    }

    el.style.opacity = '1';
    el.style.pointerEvents = '';
    el.style.transform = `translate(${rx}px, ${ry}px)${suffix}`;
    this.domCoordsCache.set(key, { x: rx, y: ry, visible: true, subpixel: false });
  }

  public invalidateDomCache(): void {
    this.domCoordsCache.clear();
  }

  public invalidateAll(): void {
    this.prevViewportW = 0;
    this.prevViewportH = 0;
    this.domCoordsCache.clear();
  }
}

