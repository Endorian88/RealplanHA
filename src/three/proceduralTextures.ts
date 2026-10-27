import * as THREE from 'three';
import { SurfaceMaterialId } from '../types/floorplan';

interface PBRTextureBundle {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

interface BaseCanvasPair {
  colorCanvas: HTMLCanvasElement;
  bumpCanvas: HTMLCanvasElement;
}

const baseCanvasCache = new Map<SurfaceMaterialId, BaseCanvasPair>();
const pbrCache = new Map<string, PBRTextureBundle>();
const oledCache = new Map<string, THREE.CanvasTexture>();
let cachedContactShadowTex: THREE.CanvasTexture | null = null;
let cachedLightPoolTex: THREE.CanvasTexture | null = null;

function getOrCreateBaseCanvases(materialId: SurfaceMaterialId): BaseCanvasPair {
  const existing = baseCanvasCache.get(materialId);
  if (existing) return existing;

  // 512x512 delivers crisp architectural detail while using 75% less VRAM & 4x faster CPU generation than 1024x1024
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  switch (materialId) {
    case 'oak_parquet': {
      ctx.fillStyle = '#b98856';
      ctx.fillRect(0, 0, size, size);
      const planks = 8;
      const plankH = size / planks;
      for (let i = 0; i < planks; i++) {
        const y = i * plankH;
        const hueShift = ((i * 37) % 20) - 10;
        ctx.fillStyle = `rgb(${184 + hueShift}, ${134 + hueShift}, ${86 + Math.floor(hueShift * 0.6)})`;
        ctx.fillRect(0, y, size, plankH - 2);

        bCtx.fillStyle = `rgb(${135 + hueShift}, ${135 + hueShift}, ${135 + hueShift})`;
        bCtx.fillRect(0, y, size, plankH - 2);

        // Oak grain lines
        ctx.strokeStyle = 'rgba(78, 45, 18, 0.16)';
        bCtx.strokeStyle = 'rgba(95, 95, 95, 0.35)';
        ctx.lineWidth = 1.2;
        bCtx.lineWidth = 1.2;
        for (let g = 0; g < 12; g++) {
          const gy = y + (g / 12) * plankH;
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.bezierCurveTo(
            170,
            gy + Math.sin(i * 2 + g) * 5,
            340,
            gy - Math.cos(i + g) * 5,
            size,
            gy
          );
          ctx.stroke();

          bCtx.beginPath();
          bCtx.moveTo(0, gy);
          bCtx.bezierCurveTo(
            170,
            gy + Math.sin(i * 2 + g) * 5,
            340,
            gy - Math.cos(i + g) * 5,
            size,
            gy
          );
          bCtx.stroke();
        }

        // V-groove plank joint
        ctx.fillStyle = 'rgba(48, 28, 12, 0.72)';
        ctx.fillRect(0, y + plankH - 2, size, 2);
        bCtx.fillStyle = '#181818';
        bCtx.fillRect(0, y + plankH - 2, size, 2);

        const splitX = ((i * 173) % 380) + 60;
        ctx.fillRect(splitX, y, 2, plankH);
        bCtx.fillRect(splitX, y, 2, plankH);
      }
      break;
    }

    case 'herringbone_wood': {
      ctx.fillStyle = '#825234';
      ctx.fillRect(0, 0, size, size);
      const step = 64;
      for (let y = -step; y < size + step; y += step) {
        for (let x = -step; x < size + step; x += step) {
          const isEven = Math.round((x + y) / step) % 2 === 0;
          ctx.fillStyle = isEven ? '#946040' : '#73462b';
          ctx.strokeStyle = '#381f10';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + step, y + (isEven ? step / 2 : -step / 2));
          ctx.lineTo(x + step, y + step + (isEven ? step / 2 : -step / 2));
          ctx.lineTo(x, y + step);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          bCtx.fillStyle = isEven ? '#9a9a9a' : '#747474';
          bCtx.strokeStyle = '#202020';
          bCtx.lineWidth = 2;
          bCtx.beginPath();
          bCtx.moveTo(x, y);
          ctx.lineTo(x + step, y + (isEven ? step / 2 : -step / 2));
          bCtx.lineTo(x + step, y + step + (isEven ? step / 2 : -step / 2));
          bCtx.lineTo(x, y + step);
          bCtx.closePath();
          bCtx.fill();
          bCtx.stroke();
        }
      }
      break;
    }

    case 'travertine_stone': {
      ctx.fillStyle = '#dfd8cc';
      ctx.fillRect(0, 0, size, size);
      bCtx.fillStyle = '#909090';
      bCtx.fillRect(0, 0, size, size);

      for (let i = 0; i < 65; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(162,150,134,0.16)';
        const rx = (i * 149) % size;
        const ry = (i * 83) % size;
        const rw = 70 + (i % 70);
        const rh = 10 + (i % 16);
        ctx.fillRect(rx, ry, rw, rh);
        bCtx.fillStyle = i % 2 === 0 ? 'rgba(165,165,165,0.3)' : 'rgba(110,110,110,0.3)';
        bCtx.fillRect(rx, ry, rw, rh);
      }

      ctx.strokeStyle = 'rgba(115, 106, 94, 0.55)';
      ctx.lineWidth = 2.5;
      bCtx.strokeStyle = '#222222';
      bCtx.lineWidth = 3;
      for (let p = 0; p <= size; p += 256) {
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
        ctx.stroke();

        bCtx.beginPath();
        bCtx.moveTo(p, 0);
        bCtx.lineTo(p, size);
        bCtx.stroke();
        bCtx.beginPath();
        bCtx.moveTo(0, p);
        bCtx.lineTo(size, p);
        bCtx.stroke();
      }
      break;
    }

    case 'polished_concrete': {
      ctx.fillStyle = '#949ba3';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(51,65,85,0.07)';
        ctx.beginPath();
        ctx.arc((i * 173) % size, (i * 107) % size, 24 + (i % 45), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'anthracite_tile': {
      ctx.fillStyle = '#262d37';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 65; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fillRect((i * 131) % size, (i * 193) % size, 50, 28);
      }
      ctx.strokeStyle = 'rgba(10, 15, 28, 0.85)';
      ctx.lineWidth = 2.5;
      bCtx.strokeStyle = '#141414';
      bCtx.lineWidth = 3;
      for (let p = 0; p <= size; p += 128) {
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
        ctx.stroke();

        bCtx.beginPath();
        bCtx.moveTo(p, 0);
        bCtx.lineTo(p, size);
        bCtx.stroke();
        bCtx.beginPath();
        bCtx.moveTo(0, p);
        bCtx.lineTo(size, p);
        bCtx.stroke();
      }
      break;
    }

    case 'warm_carpet': {
      ctx.fillStyle = '#cfc6b8';
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 8) {
        for (let x = 0; x < size; x += 8) {
          const delta = ((x * 13 + y * 7) % 18) - 9;
          ctx.fillStyle = `rgb(${207 + delta}, ${198 + delta}, ${184 + delta})`;
          ctx.fillRect(x, y, 7, 7);
          bCtx.fillStyle = `rgb(${128 + delta * 3}, ${128 + delta * 3}, ${128 + delta * 3})`;
          bCtx.fillRect(x, y, 7, 7);
        }
      }
      break;
    }

    case 'wpc_decking': {
      ctx.fillStyle = '#734b32';
      ctx.fillRect(0, 0, size, size);
      const boards = 12;
      const bh = size / boards;
      for (let i = 0; i < boards; i++) {
        const y = i * bh;
        const shade = ((i * 19) % 16) - 8;
        ctx.fillStyle = `rgb(${120 + shade}, ${79 + shade}, ${52 + shade})`;
        ctx.fillRect(0, y, size, bh - 4);
        bCtx.fillStyle = '#a0a0a0';
        bCtx.fillRect(0, y, size, bh - 4);

        ctx.fillStyle = 'rgba(38, 20, 8, 0.28)';
        bCtx.fillStyle = '#555555';
        for (let r = 4; r < bh - 6; r += 6) {
          ctx.fillRect(0, y + r, size, 1.5);
          bCtx.fillRect(0, y + r, size, 1.5);
        }
        ctx.fillStyle = '#1c1008';
        ctx.fillRect(0, y + bh - 4, size, 4);
        bCtx.fillStyle = '#080808';
        bCtx.fillRect(0, y + bh - 4, size, 4);
      }
      break;
    }

    case 'lush_lawn': {
      for (let s = 0; s < 8; s++) {
        ctx.fillStyle = s % 2 === 0 ? '#3b7833' : '#326a2b';
        ctx.fillRect(s * 64, 0, 64, size);
      }
      for (let i = 0; i < 850; i++) {
        const gx = (i * 149) % size;
        const gy = (i * 83) % size;
        ctx.fillStyle = i % 3 === 0 ? '#4c9241' : '#295723';
        ctx.fillRect(gx, gy, 2, 5);
        bCtx.fillStyle = i % 2 === 0 ? '#a8a8a8' : '#585858';
        bCtx.fillRect(gx, gy, 2, 5);
      }
      break;
    }

    case 'driveway_pavers': {
      ctx.fillStyle = '#525962';
      ctx.fillRect(0, 0, size, size);
      const pw = 64;
      const ph = 32;
      for (let row = 0; row < size / ph; row++) {
        const offset = (row % 2) * (pw / 2);
        for (let col = -1; col < size / pw + 1; col++) {
          const x = col * pw + offset;
          const y = row * ph;
          const tone = ((row * 17 + col * 31) % 24) - 12;
          ctx.fillStyle = `rgb(${96 + tone}, ${103 + tone}, ${112 + tone})`;
          ctx.fillRect(x + 2, y + 2, pw - 4, ph - 4);
          bCtx.fillStyle = '#b0b0b0';
          bCtx.fillRect(x + 2, y + 2, pw - 4, ph - 4);
        }
      }
      break;
    }

    case 'pool_water': {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#0284c7');
      grad.addColorStop(0.5, '#0ea5e9');
      grad.addColorStop(1, '#38bdf8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Subtle glass mosaic tile grid visible through water
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.18)';
      ctx.lineWidth = 1.2;
      for (let p = 0; p <= size; p += 32) {
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
        ctx.stroke();
      }

      // OrganicVoronoi-style water caustic ribbons & wave normal bump
      for (let c = 0; c < 48; c++) {
        const cx = (c * 197 + 43) % size;
        const cy = (c * 123 + 29) % size;
        const r = 28 + (c % 34);
        ctx.strokeStyle = c % 2 === 0 ? 'rgba(224, 242, 254, 0.48)' : 'rgba(125, 211, 252, 0.36)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0.2, Math.PI * 1.55);
        ctx.stroke();

        bCtx.strokeStyle = c % 2 === 0 ? '#dadada' : '#525252';
        bCtx.lineWidth = 5;
        bCtx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 1.6);
        bCtx.arc(cx, cy, r, 0, Math.PI * 1.6);
        bCtx.stroke();
      }
      break;
    }

    case 'gravel_bed': {
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 650; i++) {
        const px = (i * 113) % size;
        const py = (i * 167) % size;
        const shade = 135 + (i % 75);
        ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 8})`;
        ctx.beginPath();
        ctx.arc(px, py, 3 + (i % 5), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'pathway_stone': {
      // Natural polygonal flagstone path with dark mortar/moss joints
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, 0, size, size);
      bCtx.fillStyle = '#303030';
      bCtx.fillRect(0, 0, size, size);
      const cell = 128;
      for (let row = 0; row < size / cell; row++) {
        for (let col = 0; col < size / cell; col++) {
          const sx = col * cell + 8;
          const sy = row * cell + 8;
          const sw = cell - 16;
          const sh = cell - 16;
          const tone = ((row * 29 + col * 43) % 30) - 15;
          ctx.fillStyle = `rgb(${168 + tone}, ${162 + tone}, ${152 + tone})`;
          ctx.beginPath();
          ctx.roundRect(sx, sy, sw, sh, 16);
          ctx.fill();

          bCtx.fillStyle = '#c8c8c8';
          bCtx.beginPath();
          bCtx.roundRect(sx, sy, sw, sh, 16);
          bCtx.fill();
        }
      }
      break;
    }

    case 'pathway_wood': {
      // Oiled Larch / Teak boardwalk planks over dark gravel sub-base
      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, 0, size, size);
      bCtx.fillStyle = '#202020';
      bCtx.fillRect(0, 0, size, size);
      const planks = 8;
      const ph = size / planks;
      for (let i = 0; i < planks; i++) {
        const y = i * ph + 5;
        const shade = ((i * 23) % 18) - 9;
        ctx.fillStyle = `rgb(${156 + shade}, ${104 + shade}, ${62 + shade})`;
        ctx.fillRect(8, y, size - 16, ph - 10);
        bCtx.fillStyle = '#bdbdbd';
        bCtx.fillRect(8, y, size - 16, ph - 10);
      }
      break;
    }

    case 'pathway_stepping': {
      // Japanese stepping stones set in decorative quartz gravel / lawn joint
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 420; i++) {
        const px = (i * 113) % size;
        const py = (i * 167) % size;
        ctx.fillStyle = i % 2 === 0 ? '#9ca3af' : '#4b5563';
        ctx.fillRect(px, py, 4, 4);
      }
      for (let row = 0; row < 2; row++) {
        const cy = row * 256 + 128;
        const cx = row % 2 === 0 ? 220 : 292;
        ctx.fillStyle = '#d6d3d1';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 135, 86, 0, 0, Math.PI * 2);
        ctx.fill();
        bCtx.fillStyle = '#dcdcdc';
        bCtx.beginPath();
        bCtx.ellipse(cx, cy, 135, 86, 0, 0, Math.PI * 2);
        bCtx.fill();
      }
      break;
    }

    case 'pathway_cobble': {
      // Traditional arched granite cobblestone path
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, size, size);
      const cw = 48;
      const ch = 48;
      for (let r = 0; r < size / ch; r++) {
        const off = (r % 2) * 24;
        for (let c = -1; c < size / cw + 1; c++) {
          const x = c * cw + off + 4;
          const y = r * ch + 4;
          const t = ((r * 19 + c * 37) % 28) - 14;
          ctx.fillStyle = `rgb(${122 + t}, ${126 + t}, ${134 + t})`;
          ctx.beginPath();
          ctx.roundRect(x, y, cw - 8, ch - 8, 8);
          ctx.fill();
          bCtx.fillStyle = '#bcbcbc';
          bCtx.beginPath();
          bCtx.roundRect(x, y, cw - 8, ch - 8, 8);
          bCtx.fill();
        }
      }
      break;
    }

    case 'asphalt_road': {
      // Dark rolled asphalt street with aggregate grain, curb border, and dashed center line
      ctx.fillStyle = '#262b33';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 950; i++) {
        const px = (i * 137) % size;
        const py = (i * 193) % size;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(10,14,20,0.14)';
        ctx.fillRect(px, py, 3, 3);
        bCtx.fillStyle = i % 2 === 0 ? '#989898' : '#646464';
        bCtx.fillRect(px, py, 3, 3);
      }
      // Subtle road edge lines & dashed white center line
      ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
      ctx.fillRect(0, size / 2 - 5, size * 0.56, 10);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.fillRect(0, 12, size, 6);
      ctx.fillRect(0, size - 18, size, 6);
      break;
    }

    case 'sidewalk_pavers': {
      // Concrete / granite sidewalk slabs with curb joint
      ctx.fillStyle = '#646b75';
      ctx.fillRect(0, 0, size, size);
      const sw = 128;
      const sh = 128;
      for (let r = 0; r < size / sh; r++) {
        for (let c = 0; c < size / sw; c++) {
          const tone = ((r * 23 + c * 41) % 18) - 9;
          ctx.fillStyle = `rgb(${150 + tone}, ${156 + tone}, ${164 + tone})`;
          ctx.fillRect(c * sw + 4, r * sh + 4, sw - 8, sh - 8);
          bCtx.fillStyle = '#b8b8b8';
          bCtx.fillRect(c * sw + 4, r * sh + sh * 0.02, sw - 8, sh - 8);
        }
      }
      break;
    }
  }

  const pair = { colorCanvas, bumpCanvas };
  baseCanvasCache.set(materialId, pair);
  return pair;
}

export function createSurfacePBRMaps(
  materialId: SurfaceMaterialId,
  repeatX: number,
  repeatZ: number,
  maxAnisotropy = 4
): PBRTextureBundle {
  const rx = Math.max(1, Math.round(repeatX * 2) / 2);
  const rz = Math.max(1, Math.round(repeatZ * 2) / 2);
  const cacheKey = `${materialId}_${rx}_${rz}`;
  if (pbrCache.has(cacheKey)) {
    return pbrCache.get(cacheKey)!;
  }

  const { colorCanvas, bumpCanvas } = getOrCreateBaseCanvases(materialId);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(rx, rz);
  map.anisotropy = Math.min(maxAnisotropy, 4);
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(rx, rz);
  bumpMap.anisotropy = Math.min(maxAnisotropy, 4);
  bumpMap.needsUpdate = true;

  const bundle = { map, bumpMap };
  pbrCache.set(cacheKey, bundle);
  return bundle;
}

/**
 * Soft Radial Contact Shadow / Ambient Occlusion Texture placed underneath furniture & vehicles
 */
export function getContactShadowTexture(): THREE.CanvasTexture {
  if (cachedContactShadowTex) return cachedContactShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 9, 64, 64, 62);
  grad.addColorStop(0, 'rgba(5, 8, 16, 0.68)');
  grad.addColorStop(0.55, 'rgba(5, 8, 16, 0.32)');
  grad.addColorStop(1, 'rgba(5, 8, 16, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  cachedContactShadowTex = new THREE.CanvasTexture(canvas);
  cachedContactShadowTex.colorSpace = THREE.SRGBColorSpace;
  return cachedContactShadowTex;
}

/**
 * Realistic IES-style Floor/Wall Light Pool Texture for active luminaires
 */
export function getLightPoolTexture(): THREE.CanvasTexture {
  if (cachedLightPoolTex) return cachedLightPoolTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.35)');
  grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.08)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  cachedLightPoolTex = new THREE.CanvasTexture(canvas);
  cachedLightPoolTex.colorSpace = THREE.SRGBColorSpace;
  return cachedLightPoolTex;
}

export function createOledScreenTexture(isPlaying: boolean, title: string): THREE.CanvasTexture {
  const key = `${isPlaying}_${title}`;
  if (oledCache.has(key)) return oledCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 144;
  const ctx = canvas.getContext('2d')!;

  if (isPlaying) {
    const grad = ctx.createLinearGradient(0, 0, 256, 144);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.45, '#1e3a8a');
    grad.addColorStop(0.8, '#b45309');
    grad.addColorStop(1, '#090d16');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 144);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(30, 45, 95, 60);
    ctx.fillRect(105, 32, 110, 72);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.65)';
    ctx.fillRect(45, 62, 55, 32);
    ctx.fillRect(122, 52, 70, 42);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(title.slice(0, 34), 16, 126);
  } else {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 256, 144);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.fillText('STANDBY · 22:45', 86, 75);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  oledCache.set(key, tex);
  return tex;
}

const chainlinkCache = new Map<string, THREE.CanvasTexture>();

export function getChainlinkMeshTexture(
  colorOrIsAnthracite: boolean | string = false,
  repeatX = 6,
  repeatY = 2
): THREE.CanvasTexture {
  const isAnthracite =
    typeof colorOrIsAnthracite === 'string'
      ? colorOrIsAnthracite.includes('334155') || colorOrIsAnthracite.includes('475569')
      : colorOrIsAnthracite;
  const key = `${isAnthracite ? 'anth' : 'green'}_${Math.round(repeatX)}_${Math.round(repeatY)}`;
  if (chainlinkCache.has(key)) return chainlinkCache.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);

  ctx.strokeStyle = isAnthracite ? 'rgba(71, 85, 105, 0.92)' : 'rgba(34, 112, 62, 0.92)';
  ctx.lineWidth = 4.5;

  const step = 32;
  for (let y = -128; y <= 256; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y + 128);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, y + 128);
    ctx.lineTo(128, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.max(1, repeatX), Math.max(1, repeatY));
  tex.needsUpdate = true;
  chainlinkCache.set(key, tex);
  return tex;
}

const wallFinishCache = new Map<string, THREE.CanvasTexture>();

export function createWallFinishTexture(
  finish: string,
  baseHex: string,
  repeatX = 2,
  repeatY = 1
): THREE.CanvasTexture | null {
  if (!finish || finish === 'plaster') return null;
  const rx = Math.max(1, Math.round(repeatX * 2) / 2);
  const ry = Math.max(1, Math.round(repeatY * 2) / 2);
  const key = `${finish}_${baseHex}_${rx}_${ry}`;
  if (wallFinishCache.has(key)) return wallFinishCache.get(key)!;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (finish === 'wood_slats') {
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, size, size);
    const slats = 16;
    const sw = size / slats;
    for (let i = 0; i < slats; i++) {
      const tone = ((i * 17) % 16) - 8;
      ctx.fillStyle = `rgb(${182 + tone}, ${130 + tone}, ${80 + tone})`;
      ctx.fillRect(i * sw + 3, 0, sw - 6, size);
    }
  } else if (finish === 'brick_exposed') {
    ctx.fillStyle = '#d6d3d1';
    ctx.fillRect(0, 0, size, size);
    const rows = 8;
    const cols = 4;
    const bh = size / rows;
    const bw = size / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (bw / 2);
      for (let c = -1; c <= cols; c++) {
        const tone = ((r * 29 + c * 19) % 26) - 13;
        ctx.fillStyle = `rgb(${168 + tone}, ${78 + Math.floor(tone * 0.6)}, ${56 + Math.floor(tone * 0.5)})`;
        ctx.fillRect(c * bw + off + 3, r * bh + 3, bw - 6, bh - 6);
      }
    }
  } else if (finish === 'stone_tile') {
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, size, size);
    const cell = 64;
    for (let r = 0; r < size / cell; r++) {
      for (let c = 0; c < size / cell; c++) {
        const tone = ((r * 13 + c * 23) % 18) - 9;
        ctx.fillStyle = `rgb(${205 + tone}, ${198 + tone}, ${188 + tone})`;
        ctx.fillRect(c * cell + 2, r * cell + 2, cell - 4, cell - 4);
      }
    }
  } else if (finish === 'concrete_loft') {
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(30,41,59,0.09)';
      ctx.beginPath();
      ctx.arc((i * 73) % size, (i * 131) % size, 16 + (i % 24), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, size - 8, size - 8);
  } else if (finish === 'wallpaper_accent') {
    ctx.fillStyle = baseHex || '#1e293b';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    for (let i = -size; i < size * 2; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i + size, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
    }
  } else if (finish === 'glass_block') {
    // White/light-grey mortar joints between glass blocks
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, size, size);
    const grid = 4;
    const cell = size / grid;
    const joint = 6;
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        const bx = c * cell + joint / 2;
        const by = r * cell + joint / 2;
        const bw = cell - joint;
        const bh = cell - joint;
        const grad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
        grad.addColorStop(0, '#cffafe');
        grad.addColorStop(0.5, '#a5f3fc');
        grad.addColorStop(1, '#67e8f9');
        ctx.fillStyle = grad;
        ctx.fillRect(bx, by, bw, bh);
        // Inner glass block wave/pillow border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 3;
        ctx.strokeRect(bx + 5, by + 5, bw - 10, bh - 10);
        // Specular diagonal highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx + 10, by + bh - 12);
        ctx.lineTo(bx + bw - 12, by + 10);
        ctx.stroke();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.needsUpdate = true;
  wallFinishCache.set(key, tex);
  return tex;
}

