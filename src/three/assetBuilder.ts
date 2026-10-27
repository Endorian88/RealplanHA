import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  DormerWindowConfig,
  FloorplanZone,
  getEffectiveDormerWindows,
  HAEntityState,
  OpeningFrameColor,
  PlacedAsset,
  RoofChimneyItem,
  RoofDormerItem,
  RoofSkylightItem,
  WallOpening,
  ZoneRoofConfig,
} from '../types/floorplan';
import {
  createOledScreenTexture,
  getContactShadowTexture,
  getLightPoolTexture,
} from './proceduralTextures';

const gltfLoader = new GLTFLoader();

// High-efficiency PBR Materials (MeshStandardMaterial avoids expensive multi-lobe clearcoat/sheen fragment shaders on integrated GPUs)
const MAT = {
  matteWhite: new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.28,
    metalness: 0.04,
  }),
  warmWhite: new THREE.MeshStandardMaterial({
    color: 0xf2efe9,
    roughness: 0.36,
    metalness: 0.02,
  }),
  anthracite: new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.3,
    metalness: 0.45,
  }),
  darkMetal: new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.22,
    metalness: 0.88,
  }),
  brushedSteel: new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.18,
    metalness: 0.92,
  }),
  copperGold: new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.2,
    metalness: 0.9,
  }),
  oakWood: new THREE.MeshStandardMaterial({
    color: 0xa67546,
    roughness: 0.34,
    metalness: 0.04,
  }),
  walnutWood: new THREE.MeshStandardMaterial({
    color: 0x5c3a21,
    roughness: 0.28,
    metalness: 0.05,
  }),
  teakWood: new THREE.MeshStandardMaterial({
    color: 0x855231,
    roughness: 0.52,
    metalness: 0.03,
  }),
  boucleFabric: new THREE.MeshStandardMaterial({
    color: 0xe5dfd5,
    roughness: 0.86,
    metalness: 0.0,
  }),
  sageCushion: new THREE.MeshStandardMaterial({
    color: 0x6b8e78,
    roughness: 0.82,
    metalness: 0.0,
  }),
  terracottaCushion: new THREE.MeshStandardMaterial({
    color: 0xc26d53,
    roughness: 0.82,
    metalness: 0.0,
  }),
  charcoalFabric: new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.8,
    metalness: 0.0,
  }),
  travertine: new THREE.MeshStandardMaterial({
    color: 0xe5dfd6,
    roughness: 0.26,
    metalness: 0.06,
  }),
  foliageDark: new THREE.MeshStandardMaterial({
    color: 0x265c29,
    roughness: 0.75,
    metalness: 0.02,
  }),
  foliageLight: new THREE.MeshStandardMaterial({
    color: 0x3f883e,
    roughness: 0.72,
    metalness: 0.02,
  }),
  solarCell: new THREE.MeshStandardMaterial({
    color: 0x081426,
    roughness: 0.1,
    metalness: 0.78,
  }),
  carPaintSilver: new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.16,
    metalness: 0.88,
  }),
  sageGreen: new THREE.MeshStandardMaterial({
    color: 0x5f7464,
    roughness: 0.36,
    metalness: 0.08,
  }),
  bronzeCorten: new THREE.MeshStandardMaterial({
    color: 0x6e4730,
    roughness: 0.32,
    metalness: 0.68,
  }),
  burgundyRed: new THREE.MeshStandardMaterial({
    color: 0x6b1d2f,
    roughness: 0.34,
    metalness: 0.12,
  }),
  frostedGlass: new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.55,
    metalness: 0.05,
    transparent: true,
    opacity: 0.72,
  }),
};

const glassMaterialCache = new Map<number, THREE.MeshStandardMaterial>();
const sharedUnitPlaneGeo = new THREE.PlaneGeometry(1, 1);
let sharedContactShadowMat: THREE.MeshBasicMaterial | null = null;

// Single-pass architectural glass (avoids Three.js's full-scene transmissionRenderTarget pass that doubles GPU draw calls)
export function createGlassMaterial(_isSoftwareGl: boolean, tint = 0xe0f2fe): THREE.Material {
  let mat = glassMaterialCache.get(tint);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: tint,
      roughness: 0.06,
      metalness: 0.16,
      envMapIntensity: 1.35,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    glassMaterialCache.set(tint, mat);
  }
  return mat;
}

function addContactShadow(group: THREE.Group, width: number, depth: number, yOffset = 0.008) {
  if (!sharedContactShadowMat) {
    sharedContactShadowMat = new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }
  const shadowPlane = new THREE.Mesh(sharedUnitPlaneGeo, sharedContactShadowMat);
  shadowPlane.scale.set(width * 1.28, depth * 1.28, 1);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = yOffset;
  group.add(shadowPlane);
}

function addVolumetricLightFeatures(
  root: THREE.Group,
  haloRadius: number,
  lightOffsetY: number,
  floorPoolY: number,
  poolRadius: number
) {
  root.userData.lightEmissionOffsetY = lightOffsetY;

  // Soft optical luminaire bloom disc right at the light source (no hard cone edges!)
  const beamMat = new THREE.MeshBasicMaterial({
    map: getLightPoolTexture(),
    color: 0xffd699,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const haloPlane = new THREE.Mesh(sharedUnitPlaneGeo, beamMat);
  haloPlane.scale.set(haloRadius * 0.95, haloRadius * 0.95, 1);
  haloPlane.rotation.x = -Math.PI / 2;
  haloPlane.position.y = lightOffsetY;
  root.add(haloPlane);

  // Soft radial IES light pool projected onto the floor/ground below the luminaire
  const poolMat = new THREE.MeshBasicMaterial({
    map: getLightPoolTexture(),
    color: 0xffd699,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const poolPlane = new THREE.Mesh(sharedUnitPlaneGeo, poolMat);
  poolPlane.scale.set(poolRadius * 1.45, poolRadius * 1.45, 1);
  poolPlane.rotation.x = -Math.PI / 2;
  poolPlane.position.y = floorPoolY;
  root.add(poolPlane);

  root.userData.volumetricBeamMat = beamMat;
  root.userData.lightPoolMat = poolMat;
  root.userData.volumetricBeamMesh = haloPlane;
  root.userData.lightPoolMesh = poolPlane;
}

function enableShadows(group: THREE.Object3D, cast = true, receive = true) {
  let casterCount = 0;
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mat = (child as THREE.Mesh).material as THREE.Material | undefined;
      if (mat && mat.depthWrite === false) {
        child.castShadow = false;
        child.receiveShadow = false;
      } else {
        // Limit shadow map draw calls to primary structural parts per asset; contact shadow handles ground AO
        child.castShadow = cast && casterCount < 4;
        child.receiveShadow = receive;
        casterCount++;
      }
    }
  });
}

function resolveFrameColorMaterial(color?: OpeningFrameColor): THREE.Material {
  switch (color) {
    case 'white':
      return MAT.matteWhite;
    case 'oak':
      return MAT.oakWood;
    case 'walnut':
      return MAT.walnutWood;
    case 'alu_silver':
      return MAT.brushedSteel;
    case 'matte_black':
      return MAT.darkMetal;
    case 'sage_green':
      return MAT.sageGreen;
    case 'bronze_corten':
      return MAT.bronzeCorten;
    case 'burgundy_red':
      return MAT.burgundyRed;
    case 'anthracite':
    default:
      return MAT.anthracite;
  }
}

/**
 * Builds a multi-window assembly for a Roof Dormer (Dachgaube), where each individual window
 * (`DormerWindowUnit`) has its own width ratio, sash count, hinge side, frame color,
 * mullion style, 3D open/tilt state, and individual roller shutter.
 */
function buildDormerWindowAssembly(
  winTotalW: number,
  winTotalH: number,
  cfg?: DormerWindowConfig,
  isSoftwareGl = false
): THREE.Group {
  const winGroup = new THREE.Group();
  const units = getEffectiveDormerWindows(cfg);
  const unitCount = Math.max(1, units.length);
  const postBetweenUnits = unitCount > 1 ? 0.055 : 0;
  const availableUnitsW = Math.max(0.28, winTotalW - (unitCount - 1) * postBetweenUnits);
  const totalRatio = units.reduce(
    (acc, u) => acc + THREE.MathUtils.clamp(u.widthRatio ?? 1, 0.35, 3.0),
    0
  );

  // Continuous Exterior Aluminum Windowsill (Fensterbank) across the dormer front
  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(winTotalW + 0.08, 0.028, 0.14),
    MAT.brushedSteel
  );
  sill.position.set(0, -winTotalH / 2 - 0.012, 0.042);
  winGroup.add(sill);

  const outerDepth = 0.085;
  const border = 0.042;
  let cursorX = -winTotalW / 2;

  for (let uIdx = 0; uIdx < unitCount; uIdx++) {
    const unit = units[uIdx];
    const ratio = THREE.MathUtils.clamp(unit.widthRatio ?? 1, 0.35, 3.0);
    const unitW = Math.max(0.22, availableUnitsW * (ratio / Math.max(0.1, totalRatio)));
    const unitCenterX = cursorX + unitW / 2;

    // Structural facade mullion / pillar between individual dormer windows
    if (uIdx > 0) {
      const dividerPost = new THREE.Mesh(
        new THREE.BoxGeometry(postBetweenUnits, winTotalH + 0.01, outerDepth + 0.025),
        MAT.warmWhite
      );
      dividerPost.position.set(cursorX - postBetweenUnits / 2, 0, -0.004);
      winGroup.add(dividerPost);
    }

    cursorX += unitW + postBetweenUnits;

    const unitGroup = new THREE.Group();
    unitGroup.position.set(unitCenterX, 0, 0);

    const frameMat = resolveFrameColorMaterial(
      unit.windowFrameColor || cfg?.windowFrameColor || 'anthracite'
    );
    const style = unit.windowStyle || cfg?.windowStyle || 'mullion_cross';
    const sashCount = THREE.MathUtils.clamp(unit.sashCount ?? 1, 1, 2);
    const openState = unit.windowOpenState || cfg?.windowOpenState || 'closed';
    const glassMat =
      style === 'frosted_privacy'
        ? MAT.frostedGlass
        : createGlassMaterial(isSoftwareGl, 0xdbeafe);

    // Outer Blendrahmen for this individual dormer window
    const topBar = new THREE.Mesh(
      new THREE.BoxGeometry(unitW, border, outerDepth),
      frameMat
    );
    topBar.position.set(0, winTotalH / 2 - border / 2, 0);
    const botBar = new THREE.Mesh(
      new THREE.BoxGeometry(unitW, border, outerDepth),
      frameMat
    );
    botBar.position.set(0, -winTotalH / 2 + border / 2, 0);
    const leftBar = new THREE.Mesh(
      new THREE.BoxGeometry(border, winTotalH, outerDepth),
      frameMat
    );
    leftBar.position.set(-unitW / 2 + border / 2, 0, 0);
    const rightBar = leftBar.clone();
    rightBar.position.x = unitW / 2 - border / 2;
    unitGroup.add(topBar, botBar, leftBar, rightBar);

    const innerW = Math.max(0.16, unitW - border * 2);
    const innerH = Math.max(0.2, winTotalH - border * 2);
    const postW = 0.032;
    const sashW = (innerW - (sashCount - 1) * postW) / sashCount;

    for (let s = 0; s < sashCount; s++) {
      const cx = -innerW / 2 + sashW / 2 + s * (sashW + postW);

      if (s > 0) {
        const mullionPost = new THREE.Mesh(
          new THREE.BoxGeometry(postW, innerH, outerDepth * 0.92),
          frameMat
        );
        mullionPost.position.set(cx - sashW / 2 - postW / 2, 0, 0);
        unitGroup.add(mullionPost);
      }

      const sashPivot = new THREE.Group();
      const isLeftHinged =
        sashCount === 1
          ? (unit.hingeSide || (uIdx % 2 === 0 ? 'left' : 'right')) === 'left'
          : s === 0;

      if (openState === 'tilted') {
        sashPivot.position.set(cx, -innerH / 2, 0.01);
        sashPivot.rotation.x = -0.25;
      } else if (openState === 'open') {
        const hingeX = cx + (isLeftHinged ? -sashW / 2 + 0.018 : sashW / 2 - 0.018);
        sashPivot.position.set(hingeX, 0, 0.015);
        sashPivot.rotation.y = isLeftHinged ? -0.65 : 0.65;
      } else {
        sashPivot.position.set(cx, 0, 0.008);
      }

      const localOffsetX =
        openState === 'open'
          ? isLeftHinged
            ? sashW / 2 - 0.018
            : -sashW / 2 + 0.018
          : 0;
      const localOffsetY = openState === 'tilted' ? innerH / 2 : 0;

      const sashContainer = new THREE.Group();
      sashContainer.position.set(localOffsetX, localOffsetY, 0);

      const sBorder = 0.03;
      const sTop = new THREE.Mesh(
        new THREE.BoxGeometry(sashW - 0.005, sBorder, 0.05),
        frameMat
      );
      sTop.position.y = innerH / 2 - sBorder / 2;
      const sBot = sTop.clone();
      sBot.position.y = -innerH / 2 + sBorder / 2;
      const sLeft = new THREE.Mesh(
        new THREE.BoxGeometry(sBorder, innerH - 0.005, 0.05),
        frameMat
      );
      sLeft.position.x = -sashW / 2 + sBorder / 2;
      const sRight = sLeft.clone();
      sRight.position.x = sashW / 2 - sBorder / 2;

      const paneW = Math.max(0.08, sashW - sBorder * 2);
      const paneH = Math.max(0.08, innerH - sBorder * 2);
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(paneW, paneH, 0.018),
        glassMat
      );
      sashContainer.add(sTop, sBot, sLeft, sRight, pane);

      // Window handle (Fenstergriff) on opposite side of hinge
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.013, 0.062, 0.026),
        MAT.brushedSteel
      );
      handle.position.set(
        isLeftHinged ? sashW / 2 - sBorder * 0.5 : -sashW / 2 + sBorder * 0.5,
        -0.02,
        0.03
      );
      sashContainer.add(handle);

      if (style === 'mullion_cross') {
        const vBar = new THREE.Mesh(
          new THREE.BoxGeometry(0.016, paneH, 0.032),
          frameMat
        );
        const hBar = new THREE.Mesh(
          new THREE.BoxGeometry(paneW, 0.016, 0.032),
          frameMat
        );
        hBar.position.y = paneH * 0.08;
        sashContainer.add(vBar, hBar);
      } else if (style === 'industrial_loft') {
        const vBar = new THREE.Mesh(
          new THREE.BoxGeometry(0.015, paneH, 0.034),
          MAT.darkMetal
        );
        sashContainer.add(vBar);
        for (const fy of [-0.18, 0.18]) {
          const hBar = new THREE.Mesh(
            new THREE.BoxGeometry(paneW, 0.015, 0.034),
            MAT.darkMetal
          );
          hBar.position.y = paneH * fy;
          sashContainer.add(hBar);
        }
      } else if (style === 'arched_classic') {
        const transom = new THREE.Mesh(
          new THREE.BoxGeometry(paneW, 0.022, 0.036),
          frameMat
        );
        transom.position.y = paneH * 0.22;
        const topSub = new THREE.Mesh(
          new THREE.BoxGeometry(0.016, paneH * 0.28, 0.032),
          frameMat
        );
        topSub.position.y = paneH * 0.36;
        sashContainer.add(transom, topSub);
      }

      sashPivot.add(sashContainer);
      unitGroup.add(sashPivot);
    }

    // Individual Roller Shutter (Rollladen) per Dormer Window
    const unitHasShutter = unit.hasShutter ?? cfg?.hasShutter ?? false;
    if (unitHasShutter) {
      const shutterBox = new THREE.Mesh(
        new THREE.BoxGeometry(unitW + 0.02, 0.085, 0.105),
        frameMat
      );
      shutterBox.position.set(0, winTotalH / 2 + 0.032, 0.024);
      unitGroup.add(shutterBox);

      const rawPct = unit.shutterClosedPct ?? cfg?.shutterClosedPct ?? 0;
      const pct = THREE.MathUtils.clamp(rawPct, 0, 100) / 100;
      if (pct > 0.02) {
        const slatTotalH = innerH * pct;
        const slatCount = Math.max(2, Math.round(slatTotalH / 0.045));
        const slatH = slatTotalH / slatCount;
        for (let i = 0; i < slatCount; i++) {
          const slat = new THREE.Mesh(
            new THREE.BoxGeometry(innerW + 0.016, slatH - 0.004, 0.016),
            MAT.anthracite
          );
          slat.position.set(
            0,
            winTotalH / 2 - border - (i + 0.5) * slatH,
            0.042
          );
          unitGroup.add(slat);
        }
      }
    }

    winGroup.add(unitGroup);
  }

  return winGroup;
}

export function buildPlacedAssetGroup(
  asset: PlacedAsset,
  isSoftwareGl: boolean
): THREE.Group {
  const root = new THREE.Group();
  root.name = `asset_${asset.id}`;
  root.userData = {
    isInteractiveAsset: true,
    assetId: asset.id,
    catalogId: asset.catalogId,
    entityId: asset.entityId,
  };

  if (asset.catalogId === 'custom_glb' && asset.customGlbUrl) {
    const basePad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.42, 0.03, 24),
      MAT.anthracite
    );
    basePad.position.y = 0.015;
    root.add(basePad);

    gltfLoader.load(
      asset.customGlbUrl,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const normScale = 1.4 / maxDim;
        model.position.set(-center.x * normScale, -box.min.y * normScale, -center.z * normScale);
        model.scale.setScalar(normScale);
        enableShadows(model, true, true);
        root.remove(basePad);
        root.add(model);
      },
      undefined,
      () => {}
    );
    return root;
  }

  const glassMat = createGlassMaterial(isSoftwareGl);
  const indicatorMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.8,
    roughness: 0.15,
  });
  root.userData.indicatorMat = indicatorMat;

  switch (asset.catalogId) {
    // =========================================================================
    // 1. RAUCHMELDER, WASSERMELDER, SCHALTSTECKDOSEN & SENSOREN
    // =========================================================================
    case 'smoke_detector': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.1, 0.018, 32), MAT.anthracite);
      base.position.y = 0.035;
      const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.022, 28), MAT.darkMetal);
      chamber.position.y = 0.018;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.082, 0.022, 32), MAT.matteWhite);
      cap.position.y = 0.0;
      const ledRing = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.005, 16, 32), indicatorMat);
      ledRing.rotation.x = Math.PI / 2;
      ledRing.position.y = -0.012;
      const testBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.006, 24), MAT.brushedSteel);
      testBtn.position.y = -0.012;

      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const coverageCone = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.5, 32, 1, true), coneMat);
      coverageCone.position.y = -1.25;
      coverageCone.visible = false;
      root.userData.sensorCone = coverageCone;

      root.add(base, chamber, cap, ledRing, testBtn, coverageCone);
      break;
    }

    case 'smart_plug': {
      const frame = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.11, 0.016, 4, 0.012), MAT.matteWhite);
      frame.position.z = 0.008;
      const plugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.046, 0.07, 28), MAT.matteWhite);
      plugBody.rotation.x = Math.PI / 2;
      plugBody.position.z = 0.044;
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.005, 16, 32), indicatorMat);
      halo.position.z = 0.079;
      const recess = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 24), MAT.anthracite);
      recess.rotation.x = Math.PI / 2;
      recess.position.z = 0.076;
      const pinL = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 10), MAT.darkMetal);
      pinL.position.set(-0.013, 0, 0.078);
      const pinR = pinL.clone();
      pinR.position.x = 0.013;
      const pwrBtn = new THREE.Mesh(new RoundedBoxGeometry(0.016, 0.014, 0.014, 2, 0.003), MAT.brushedSteel);
      pwrBtn.position.set(0, 0.044, 0.046);
      root.add(frame, plugBody, halo, recess, pinL, pinR, pwrBtn);
      break;
    }

    case 'power_strip': {
      addContactShadow(root, 0.44, 0.14);
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.048, 0.11, 4, 0.01), MAT.matteWhite);
      body.position.y = 0.024;
      root.add(body);
      for (let i = 0; i < 5; i++) {
        const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 20), MAT.anthracite);
        sock.position.set(-0.14 + i * 0.062, 0.048, 0);
        root.add(sock);
      }
      const masterSwitch = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.014, 0.052, 2, 0.003), indicatorMat);
      masterSwitch.position.set(0.165, 0.048, 0);
      root.add(masterSwitch);
      break;
    }

    case 'wall_switch_double': {
      const glassFrame = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.14, 0.014, 4, 0.01), MAT.anthracite);
      glassFrame.position.z = 0.007;
      const rockerLeft = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.096, 0.016, 3, 0.004), MAT.matteWhite);
      rockerLeft.position.set(-0.027, 0, 0.016);
      const rockerRight = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.096, 0.016, 3, 0.004), MAT.matteWhite);
      rockerRight.position.set(0.027, 0, 0.016);
      const statusBar = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.006, 0.018), indicatorMat);
      statusBar.position.set(0, -0.056, 0.017);
      root.add(glassFrame, rockerLeft, rockerRight, statusBar);
      break;
    }

    case 'water_leak_sensor': {
      addContactShadow(root, 0.16, 0.16);
      const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.034, 28), MAT.matteWhite);
      puck.position.y = 0.022;
      const ledCap = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.008, 20), indicatorMat);
      ledCap.position.y = 0.04;
      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.016, 12), MAT.copperGold);
        probe.position.set(Math.cos(angle) * 0.05, 0.008, Math.sin(angle) * 0.05);
        root.add(probe);
      }
      root.add(puck, ledCap);
      break;
    }

    case 'presence_sensor_mmwave': {
      const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.025, 20), MAT.anthracite);
      mount.rotation.x = Math.PI / 2;
      mount.position.z = 0.012;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 14), MAT.brushedSteel);
      arm.rotation.x = Math.PI / 2;
      arm.position.z = 0.035;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.054, 24, 20), MAT.matteWhite);
      head.scale.set(1, 1, 0.72);
      head.position.z = 0.068;
      const radarLens = new THREE.Mesh(new THREE.CircleGeometry(0.038, 24), indicatorMat);
      radarLens.position.z = 0.108;

      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const radarCone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.6, 28, 1, true), coneMat);
      radarCone.rotation.x = -Math.PI / 2;
      radarCone.position.set(0, -0.6, 1.85);
      radarCone.visible = false;
      root.userData.sensorCone = radarCone;

      root.add(mount, arm, head, radarLens, radarCone);
      break;
    }

    case 'door_window_sensor': {
      const mainUnit = new THREE.Mesh(new RoundedBoxGeometry(0.042, 0.11, 0.028, 3, 0.006), MAT.matteWhite);
      mainUnit.position.set(-0.022, 0, 0.014);
      const magnetUnit = new THREE.Mesh(new RoundedBoxGeometry(0.018, 0.09, 0.022, 3, 0.005), MAT.matteWhite);
      magnetUnit.position.set(0.02, 0, 0.011);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.03), indicatorMat);
      led.position.set(-0.022, 0.02, 0.016);
      root.add(mainUnit, magnetUnit, led);
      break;
    }

    case 'co2_air_sensor': {
      const frame = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.14, 0.036, 4, 0.012), MAT.matteWhite);
      frame.position.z = 0.018;
      const screen = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.09, 0.008, 2, 0.004), MAT.darkMetal);
      screen.position.set(0, 0.01, 0.036);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.008), indicatorMat);
      bar.position.set(0, -0.048, 0.037);
      root.add(frame, screen, bar);
      break;
    }

    case 'smart_door_lock': {
      const escutcheon = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.24, 0.026, 4, 0.01), MAT.darkMetal);
      escutcheon.position.z = 0.013;
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.056, 28), MAT.brushedSteel);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(0, -0.04, 0.052);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.004, 14, 28), indicatorMat);
      ring.position.set(0, 0.055, 0.029);
      root.add(escutcheon, knob, ring);
      break;
    }

    case 'alarm_keypad': {
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.16, 0.032, 4, 0.01), MAT.anthracite);
      body.position.z = 0.016;
      const display = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.08, 0.008, 2, 0.004), MAT.darkMetal);
      display.position.set(0, 0.022, 0.032);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.014, 0.008), indicatorMat);
      strip.position.set(0, -0.045, 0.032);
      root.add(body, display, strip);
      break;
    }

    // =========================================================================
    // 2. REALISTISCHE LICHTQUELLEN INNEN & AUSSEN (Volumetric Beams + Light Pools)
    // =========================================================================
    case 'ceiling_pendant': {
      const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 28), MAT.darkMetal);
      const outerHousing = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.024, 20, 64), MAT.darkMetal);
      outerHousing.rotation.x = Math.PI / 2;
      outerHousing.position.y = -0.5;
      const outerGlow = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.018, 16, 64), indicatorMat);
      outerGlow.rotation.x = Math.PI / 2;
      outerGlow.position.y = -0.52;
      const innerHousing = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.02, 20, 48), MAT.copperGold);
      innerHousing.rotation.x = Math.PI / 2;
      innerHousing.position.y = -0.36;
      const innerGlow = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.015, 16, 48), indicatorMat);
      innerGlow.rotation.x = Math.PI / 2;
      innerGlow.position.y = -0.375;

      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.52, 8), MAT.brushedSteel);
        wire.position.set(Math.cos(a) * 0.27, -0.26, Math.sin(a) * 0.27);
        root.add(wire);
      }
      root.add(canopy, outerHousing, outerGlow, innerHousing, innerGlow);

      // Realistic Luminaire Halo & Floor Light Pool
      addVolumetricLightFeatures(root, 1.35, -0.46, -2.52, 2.8);
      break;
    }

    case 'recessed_spot_cluster': {
      const track = new THREE.Mesh(new RoundedBoxGeometry(1.15, 0.035, 0.13, 3, 0.006), MAT.darkMetal);
      root.add(track);
      for (let i = -1; i <= 1; i++) {
        const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.075, 24), MAT.anthracite);
        housing.position.set(i * 0.38, -0.042, 0);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 24), indicatorMat);
        lens.position.set(i * 0.38, -0.08, 0);
        root.add(housing, lens);
      }
      addVolumetricLightFeatures(root, 1.2, -0.1, -2.44, 2.5);
      break;
    }

    case 'floor_lamp_arc': {
      addContactShadow(root, 0.65, 0.65);
      const marbleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.07, 32), MAT.travertine);
      marbleBase.position.y = 0.035;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 1.84, 20), MAT.brushedSteel);
      pole.position.set(-0.18, 0.95, 0);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.54, 16), MAT.brushedSteel);
      arm.rotation.z = Math.PI / 2.4;
      arm.position.set(0.04, 1.84, 0);
      const shadeOuter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.25, 0.25, 32, 1, true),
        MAT.boucleFabric
      );
      shadeOuter.position.set(0.26, 1.68, 0);
      const bulbGlow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 20), indicatorMat);
      bulbGlow.position.set(0.26, 1.64, 0);
      root.add(marbleBase, pole, arm, shadeOuter, bulbGlow);
      addVolumetricLightFeatures(root, 0.95, 1.58, 0.015, 2.15);
      break;
    }

    case 'led_strip_profile': {
      const aluChannel = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.038, 0.048), MAT.brushedSteel);
      aluChannel.position.z = 0.024;
      const diffuser = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.026, 0.028), indicatorMat);
      diffuser.position.z = 0.05;
      root.add(aluChannel, diffuser);
      addVolumetricLightFeatures(root, 1.4, -0.05, -2.32, 2.2);
      break;
    }

    case 'wall_sconce_updown': {
      const housing = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.25, 0.12, 4, 0.015), MAT.anthracite);
      housing.position.z = 0.06;
      const lensTop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.016, 0.095), indicatorMat);
      lensTop.position.set(0, 0.126, 0.06);
      const lensBot = lensTop.clone();
      lensBot.position.y = -0.126;
      root.add(housing, lensTop, lensBot);
      addVolumetricLightFeatures(root, 0.85, 0.0, -1.78, 1.65);
      break;
    }

    case 'garden_bollard_light': {
      addContactShadow(root, 0.38, 0.38);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.115, 0.055, 24), MAT.darkMetal);
      base.position.y = 0.027;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.66, 24), MAT.anthracite);
      post.position.y = 0.36;
      const glowHead = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.15, 24), indicatorMat);
      glowHead.position.y = 0.75;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.035, 24), MAT.darkMetal);
      cap.position.y = 0.84;
      root.add(base, post, glowHead, cap);
      addVolumetricLightFeatures(root, 0.9, 0.72, 0.015, 2.25);
      break;
    }

    case 'pool_underwater_light': {
      const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.042, 28), MAT.brushedSteel);
      bezel.position.y = 0.02;
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.022, 28), indicatorMat);
      lens.position.y = 0.036;
      root.add(bezel, lens);
      addVolumetricLightFeatures(root, 2.4, 0.12, 0.02, 3.4);
      break;
    }

    case 'outdoor_bollard_corten_louvre': {
      addContactShadow(root, 0.36, 0.36);
      const cortenMat = new THREE.MeshStandardMaterial({
        color: 0x78442a,
        roughness: 0.52,
        metalness: 0.48,
      });
      const basePlate = new THREE.Mesh(
        new RoundedBoxGeometry(0.22, 0.03, 0.22, 3, 0.008),
        MAT.darkMetal
      );
      basePlate.position.y = 0.015;
      const body = new THREE.Mesh(
        new RoundedBoxGeometry(0.16, 0.62, 0.16, 4, 0.015),
        cortenMat
      );
      body.position.y = 0.325;
      const coreGlow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.052, 0.22, 20),
        indicatorMat
      );
      coreGlow.position.y = 0.74;
      for (let i = 0; i < 4; i++) {
        const louvre = new THREE.Mesh(
          new RoundedBoxGeometry(0.165, 0.014, 0.165, 2, 0.004),
          cortenMat
        );
        louvre.position.y = 0.65 + i * 0.055;
        root.add(louvre);
      }
      const topCap = new THREE.Mesh(
        new RoundedBoxGeometry(0.175, 0.038, 0.175, 3, 0.008),
        cortenMat
      );
      topCap.position.y = 0.88;
      root.add(basePlate, body, coreGlow, topCap);
      addVolumetricLightFeatures(root, 0.95, 0.74, 0.015, 2.4);
      break;
    }

    case 'outdoor_path_mushroom_modern': {
      addContactShadow(root, 0.42, 0.42);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.11, 0.04, 24),
        MAT.darkMetal
      );
      base.position.y = 0.02;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.034, 0.56, 20),
        MAT.anthracite
      );
      stem.position.y = 0.3;
      const glowRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.11, 0.024, 14, 28),
        indicatorMat
      );
      glowRing.rotation.x = Math.PI / 2;
      glowRing.position.y = 0.57;
      const dome = new THREE.Mesh(
        new THREE.ConeGeometry(0.165, 0.095, 28),
        MAT.anthracite
      );
      dome.position.y = 0.62;
      root.add(base, stem, glowRing, dome);
      addVolumetricLightFeatures(root, 1.05, 0.56, 0.015, 2.5);
      break;
    }

    case 'outdoor_ground_recessed_spot': {
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.018, 24),
        MAT.darkMetal
      );
      housing.position.y = 0.009;
      const steelFlange = new THREE.Mesh(
        new THREE.RingGeometry(0.072, 0.118, 28),
        MAT.brushedSteel
      );
      steelFlange.rotation.x = -Math.PI / 2;
      steelFlange.position.y = 0.02;
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.014, 24),
        indicatorMat
      );
      lens.position.y = 0.016;
      root.add(housing, steelFlange, lens);
      addVolumetricLightFeatures(root, 1.35, 0.15, 0.015, 2.3);
      break;
    }

    case 'outdoor_tree_garden_spike': {
      const spike = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.006, 0.14, 14),
        MAT.darkMetal
      );
      spike.position.y = 0.07;
      const bracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.08, 0.03),
        MAT.anthracite
      );
      bracket.position.y = 0.16;
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.22, 0);
      headGroup.rotation.x = -0.52; // Aimed 30° upward toward trees/bushes
      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.056, 0.048, 0.14, 20),
        MAT.anthracite
      );
      cylinder.rotation.x = Math.PI / 2;
      const visorLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.048, 0.016, 20),
        indicatorMat
      );
      visorLens.rotation.x = Math.PI / 2;
      visorLens.position.z = 0.072;
      headGroup.add(cylinder, visorLens);
      root.add(spike, bracket, headGroup);
      addVolumetricLightFeatures(root, 1.25, 0.25, 0.015, 2.6);
      break;
    }

    case 'outdoor_wall_lantern_classic': {
      const wallPlate = new THREE.Mesh(
        new RoundedBoxGeometry(0.11, 0.18, 0.024, 3, 0.006),
        MAT.darkMetal
      );
      wallPlate.position.z = 0.012;
      const scrollArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.024, 0.032, 0.16),
        MAT.darkMetal
      );
      scrollArm.position.set(0, 0.04, 0.09);
      const lanternTop = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.09, 6),
        MAT.darkMetal
      );
      lanternTop.position.set(0, 0.12, 0.16);
      const glassCage = new THREE.Mesh(
        new THREE.CylinderGeometry(0.082, 0.064, 0.18, 6),
        glassMat
      );
      glassCage.position.set(0, -0.01, 0.16);
      const filamentBulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.034, 16, 16),
        indicatorMat
      );
      filamentBulb.position.set(0, -0.01, 0.16);
      const finialBot = new THREE.Mesh(
        new THREE.ConeGeometry(0.045, 0.06, 6),
        MAT.darkMetal
      );
      finialBot.rotation.x = Math.PI;
      finialBot.position.set(0, -0.12, 0.16);
      root.add(wallPlate, scrollArm, lanternTop, glassCage, filamentBulb, finialBot);
      addVolumetricLightFeatures(root, 0.95, -0.02, -1.8, 1.9);
      break;
    }

    case 'outdoor_wall_house_number_led': {
      const backglowPlate = new THREE.Mesh(
        new RoundedBoxGeometry(0.26, 0.22, 0.018, 3, 0.008),
        indicatorMat
      );
      backglowPlate.position.z = 0.016;
      const frontSlate = new THREE.Mesh(
        new RoundedBoxGeometry(0.23, 0.19, 0.022, 3, 0.008),
        MAT.anthracite
      );
      frontSlate.position.z = 0.034;
      const steelHeader = new THREE.Mesh(
        new RoundedBoxGeometry(0.24, 0.028, 0.055, 2, 0.006),
        MAT.brushedSteel
      );
      steelHeader.position.set(0, 0.095, 0.038);
      // Stylish raised "14" digits in brushed stainless steel
      const digit1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.085, 0.012),
        MAT.brushedSteel
      );
      digit1.position.set(-0.04, -0.01, 0.048);
      const digit4V = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.085, 0.012),
        MAT.brushedSteel
      );
      digit4V.position.set(0.045, -0.01, 0.048);
      const digit4H = new THREE.Mesh(
        new THREE.BoxGeometry(0.052, 0.016, 0.012),
        MAT.brushedSteel
      );
      digit4H.position.set(0.028, -0.02, 0.048);
      root.add(backglowPlate, frontSlate, steelHeader, digit1, digit4V, digit4H);
      addVolumetricLightFeatures(root, 0.75, 0.0, -1.7, 1.4);
      break;
    }

    case 'outdoor_solar_stone_globe': {
      addContactShadow(root, 0.48, 0.48);
      const baseRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.16, 0.03, 24),
        MAT.anthracite
      );
      baseRing.position.y = 0.015;
      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 28, 24),
        indicatorMat
      );
      globe.position.y = 0.22;
      root.add(baseRing, globe);
      addVolumetricLightFeatures(root, 1.15, 0.22, 0.015, 2.8);
      break;
    }

    case 'outdoor_pergola_string_lights': {
      const len = Math.max(1.2, asset.customLength ?? 4.2);
      const poleH = Math.max(1.5, asset.customHeight ?? 2.35);
      addContactShadow(root, len + 0.2, 0.35);
      for (const sx of [-len / 2, len / 2]) {
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.14, 0.04, 20),
          MAT.darkMetal
        );
        base.position.set(sx, 0.02, 0);
        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.028, poleH, 16),
          MAT.anthracite
        );
        mast.position.set(sx, poleH / 2, 0);
        root.add(base, mast);
      }
      // Catenary cable curve between the two poles
      const sag = Math.min(0.38, len * 0.075);
      const cableCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-len / 2, poleH - 0.06, 0),
        new THREE.Vector3(0, poleH - 0.06 - sag * 2, 0),
        new THREE.Vector3(len / 2, poleH - 0.06, 0)
      );
      const cableGeo = new THREE.TubeGeometry(cableCurve, 24, 0.008, 8, false);
      const cableMesh = new THREE.Mesh(cableGeo, MAT.darkMetal);
      root.add(cableMesh);

      const bulbCount = Math.max(4, Math.min(18, Math.round(len * 2.2)));
      for (let i = 1; i < bulbCount; i++) {
        const t = i / bulbCount;
        const pt = cableCurve.getPoint(t);
        const socket = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.014, 0.035, 10),
          MAT.darkMetal
        );
        socket.position.set(pt.x, pt.y - 0.02, pt.z);
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.032, 12, 12),
          indicatorMat
        );
        bulb.position.set(pt.x, pt.y - 0.052, pt.z);
        root.add(socket, bulb);
      }
      addVolumetricLightFeatures(root, 1.45, poleH - 0.25, 0.015, Math.max(2.6, len * 0.65));
      break;
    }

    // =========================================================================
    // 3. KLIMA, HAUSHALT & ROBOTIK
    // =========================================================================
    case 'radiator_smart': {
      const panel = new THREE.Mesh(new RoundedBoxGeometry(1.16, 0.62, 0.095, 4, 0.018), MAT.matteWhite);
      panel.position.set(0, 0.31, 0.06);
      for (let i = -5; i <= 5; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.54, 0.1), MAT.warmWhite);
        rib.position.set(i * 0.095, 0.31, 0.06);
        root.add(rib);
      }
      const topGrille = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.022, 0.085), MAT.brushedSteel);
      topGrille.position.set(0, 0.62, 0.06);
      const trvBody = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.085, 20), MAT.matteWhite);
      trvBody.rotation.z = Math.PI / 2;
      trvBody.position.set(0.63, 0.53, 0.06);
      const trvScreen = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.012, 20), indicatorMat);
      trvScreen.rotation.z = Math.PI / 2;
      trvScreen.position.set(0.675, 0.53, 0.06);
      root.add(panel, topGrille, trvBody, trvScreen);
      break;
    }

    case 'ac_split_unit': {
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.94, 0.29, 0.23, 5, 0.035), MAT.matteWhite);
      body.position.z = 0.115;
      const vane = new THREE.Mesh(new THREE.BoxGeometry(0.89, 0.026, 0.065), MAT.brushedSteel);
      vane.position.set(0, -0.12, 0.21);
      vane.rotation.x = 0.35;
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.016, 0.01), indicatorMat);
      led.position.set(0.33, -0.04, 0.232);
      root.add(body, vane, led);
      break;
    }

    case 'robot_vacuum_dock': {
      addContactShadow(root, 0.55, 0.62);
      const tower = new THREE.Mesh(new RoundedBoxGeometry(0.39, 0.45, 0.29, 4, 0.025), MAT.anthracite);
      tower.position.set(0, 0.225, -0.12);
      const silverTrim = new THREE.Mesh(new RoundedBoxGeometry(0.35, 0.18, 0.02, 3, 0.01), MAT.brushedSteel);
      silverTrim.position.set(0, 0.31, 0.028);
      const ramp = new THREE.Mesh(new RoundedBoxGeometry(0.41, 0.026, 0.37, 3, 0.008), MAT.anthracite);
      ramp.position.set(0, 0.013, 0.12);
      const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.178, 0.078, 32), MAT.matteWhite);
      bot.position.set(0, 0.056, 0.14);
      const bumperRing = new THREE.Mesh(new THREE.TorusGeometry(0.176, 0.008, 12, 32), MAT.brushedSteel);
      bumperRing.rotation.x = Math.PI / 2;
      bumperRing.position.set(0, 0.055, 0.14);
      const lidar = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.032, 24), indicatorMat);
      lidar.position.set(0, 0.106, 0.12);
      root.add(tower, silverTrim, ramp, bot, bumperRing, lidar);
      break;
    }

    case 'washing_machine_smart': {
      addContactShadow(root, 0.68, 0.68);
      const cabinet = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.85, 0.62, 4, 0.022), MAT.matteWhite);
      cabinet.position.y = 0.425;
      const drumRing = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.032, 20, 36), MAT.darkMetal);
      drumRing.position.set(0, 0.42, 0.312);
      const chromeInner = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 16, 32), MAT.brushedSteel);
      chromeInner.position.set(0, 0.42, 0.315);
      const drumGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 28), glassMat);
      drumGlass.rotation.x = Math.PI / 2;
      drumGlass.position.set(0, 0.42, 0.295);
      const panel = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.11, 0.025, 3, 0.008), MAT.anthracite);
      panel.position.set(0, 0.76, 0.305);
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.028, 24), indicatorMat);
      dial.rotation.x = Math.PI / 2;
      dial.position.set(0, 0.76, 0.322);
      root.add(cabinet, drumRing, chromeInner, drumGlass, panel, dial);
      break;
    }

    case 'air_purifier': {
      addContactShadow(root, 0.38, 0.38);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.155, 0.58, 32), MAT.matteWhite);
      cyl.position.y = 0.29;
      const topGrille = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.022, 28), MAT.darkMetal);
      topGrille.position.y = 0.585;
      const aqiRing = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.009, 14, 32), indicatorMat);
      aqiRing.rotation.x = Math.PI / 2;
      aqiRing.position.y = 0.598;
      root.add(cyl, topGrille, aqiRing);
      break;
    }

    // =========================================================================
    // 4. MULTIMEDIA & ÜBERWACHUNGSKAMERAS
    // =========================================================================
    case 'smart_tv_wall': {
      addContactShadow(root, 2.25, 0.58);
      const consoleBox = new THREE.Mesh(new RoundedBoxGeometry(2.18, 0.4, 0.46, 4, 0.02), MAT.oakWood);
      consoleBox.position.y = 0.24;
      // Sleek slatted oak front doors
      for (let i = -8; i <= 8; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.015), MAT.walnutWood);
        slat.position.set(i * 0.12, 0.24, 0.232);
        root.add(slat);
      }
      const soundbar = new THREE.Mesh(new RoundedBoxGeometry(1.18, 0.068, 0.115, 3, 0.015), MAT.darkMetal);
      soundbar.position.set(0, 0.48, 0.08);
      // Decorative indoor plant & art books on lowboard
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.16, 20), MAT.travertine);
      pot.position.set(0.84, 0.52, 0.04);
      const plantFoliage = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), MAT.foliageLight);
      plantFoliage.position.set(0.84, 0.68, 0.04);

      const tvFrame = new THREE.Mesh(new RoundedBoxGeometry(1.74, 1.0, 0.032, 3, 0.008), MAT.darkMetal);
      tvFrame.position.set(0, 1.18, -0.12);

      const screenTex = createOledScreenTexture(true, 'RealPlan 3D · ArchViz UE5 Studio');
      const screenMat = new THREE.MeshStandardMaterial({
        map: screenTex,
        emissive: 0xffffff,
        emissiveMap: screenTex,
        emissiveIntensity: 0.72,
        roughness: 0.1,
      });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 0.94), screenMat);
      screen.position.set(0, 1.18, -0.101);
      root.userData.tvScreenMat = screenMat;
      root.add(consoleBox, soundbar, pot, plantFoliage, tvFrame, screen);
      break;
    }

    case 'multiroom_speaker': {
      addContactShadow(root, 0.38, 0.38);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.03, 28), MAT.brushedSteel);
      base.position.y = 0.015;
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.88, 28), MAT.charcoalFabric);
      column.position.y = 0.47;
      const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.022, 28), indicatorMat);
      topCap.position.y = 0.92;
      root.add(base, column, topCap);
      break;
    }

    case 'security_camera_bullet': {
      const wallPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 20), MAT.matteWhite);
      wallPlate.rotation.x = Math.PI / 2;
      wallPlate.position.z = 0.01;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 14), MAT.anthracite);
      arm.rotation.x = Math.PI / 2;
      arm.position.z = 0.07;
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.175, 24), MAT.matteWhite);
      housing.rotation.x = Math.PI / 2.3;
      housing.position.set(0, -0.02, 0.16);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.022, 24), MAT.darkMetal);
      lens.rotation.x = Math.PI / 2.3;
      lens.position.set(0, -0.038, 0.242);
      const irRing = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0045, 12, 24), indicatorMat);
      irRing.rotation.x = 0.2;
      irRing.position.set(0, -0.04, 0.252);

      const fovCone = new THREE.Mesh(
        new THREE.ConeGeometry(1.8, 3.2, 24, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.11,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      fovCone.rotation.x = -Math.PI / 2.3;
      fovCone.position.set(0, -0.45, 1.75);
      fovCone.visible = false;
      root.userData.sensorCone = fovCone;

      root.add(wallPlate, arm, housing, lens, irRing, fovCone);
      break;
    }

    case 'security_camera_dome': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.042, 28), MAT.matteWhite);
      base.position.y = 0.021;
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 28, 20, 0, Math.PI * 2, 0, Math.PI / 2),
        glassMat
      );
      dome.rotation.x = Math.PI;
      dome.position.y = 0.0;
      const innerLens = new THREE.Mesh(new THREE.SphereGeometry(0.032, 20, 20), indicatorMat);
      innerLens.position.y = -0.022;
      root.add(base, dome, innerLens);
      break;
    }

    case 'video_doorbell': {
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.18, 0.036, 4, 0.01), MAT.anthracite);
      body.position.z = 0.018;
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 20), MAT.darkMetal);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 0.045, 0.038);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0045, 14, 28), indicatorMat);
      ring.position.set(0, -0.038, 0.038);
      root.add(body, lens, ring);
      break;
    }

    // =========================================================================
    // 5. AUSSENANLAGEN, GARTEN, POOL & ENERGIE
    // =========================================================================
    case 'robot_lawn_mower': {
      addContactShadow(root, 0.9, 1.0);
      const basePad = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.026, 0.9, 3, 0.008), MAT.anthracite);
      basePad.position.y = 0.013;
      const canopy = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.038, 0.74, 4, 0.012), MAT.matteWhite);
      canopy.position.set(0, 0.42, -0.06);
      const pillarL = new THREE.Mesh(new RoundedBoxGeometry(0.042, 0.4, 0.13, 3, 0.008), MAT.anthracite);
      pillarL.position.set(-0.35, 0.21, -0.32);
      const pillarR = pillarL.clone();
      pillarR.position.x = 0.35;
      const chassis = new THREE.Mesh(new RoundedBoxGeometry(0.47, 0.16, 0.64, 5, 0.035), MAT.darkMetal);
      chassis.position.set(0, 0.12, 0.08);
      const hood = new THREE.Mesh(new RoundedBoxGeometry(0.41, 0.065, 0.46, 4, 0.022), MAT.copperGold);
      hood.position.set(0, 0.21, 0.08);
      const statusLed = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.02, 0.042), indicatorMat);
      statusLed.position.set(0, 0.246, 0.22);
      root.add(basePad, canopy, pillarL, pillarR, chassis, hood, statusLed);
      break;
    }

    case 'pop_up_sprinkler': {
      const turfRing = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.026, 24), MAT.darkMetal);
      turfRing.position.y = 0.013;
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.18, 20), MAT.anthracite);
      riser.position.y = 0.1;
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.038, 20), indicatorMat);
      nozzle.position.y = 0.19;

      const sprayGroup = new THREE.Group();
      const sprayMat = new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const sprayCone = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.98, 32, 1, true), sprayMat);
      sprayCone.rotation.x = Math.PI;
      sprayCone.position.y = 0.62;
      sprayGroup.add(sprayCone);
      root.userData.waterSpray = sprayGroup;

      root.add(turfRing, riser, nozzle, sprayGroup);
      break;
    }

    case 'weather_station_mast': {
      addContactShadow(root, 0.5, 0.5);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.06, 24), MAT.anthracite);
      base.position.y = 0.03;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 1.75, 20), MAT.brushedSteel);
      mast.position.y = 0.9;
      const thermoShield = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.19, 24), MAT.matteWhite);
      thermoShield.position.set(0, 1.35, 0);
      const crossArm = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.022, 0.022), MAT.brushedSteel);
      crossArm.position.set(0, 1.72, 0);
      const windCups = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.03, 16), indicatorMat);
      windCups.position.set(-0.19, 1.76, 0);
      const rainGauge = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.052, 0.125, 20), MAT.anthracite);
      rainGauge.position.set(0.18, 1.77, 0);
      root.add(base, mast, thermoShield, crossArm, windCups, rainGauge);
      break;
    }

    case 'garden_tree_oak': {
      const hScale = (asset.customHeight ?? 3.4) / 3.4;
      const wScale = (asset.customLength ?? 2.4) / 2.4;
      addContactShadow(root, 2.2 * wScale, 2.2 * wScale);
      const treeGroup = new THREE.Group();
      const curb = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.085, 16, 36), MAT.travertine);
      curb.rotation.x = Math.PI / 2;
      curb.position.y = 0.06;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.19, 1.68, 18), MAT.walnutWood);
      trunk.position.y = 0.84;
      const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.98, 2), MAT.foliageDark);
      c1.position.set(0, 2.28, 0);
      const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.78, 2), MAT.foliageLight);
      c2.position.set(0.46, 2.58, 0.26);
      const c3 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 2), MAT.foliageLight);
      c3.position.set(-0.44, 2.42, -0.28);
      const c4 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 2), MAT.foliageDark);
      c4.position.set(0.15, 2.85, -0.25);
      treeGroup.add(curb, trunk, c1, c2, c3, c4);
      treeGroup.scale.set(wScale, hScale, wScale);
      root.add(treeGroup);
      break;
    }

    case 'tree_birch_multi': {
      const hScale = (asset.customHeight ?? 4.2) / 4.2;
      const wScale = (asset.customLength ?? 2.6) / 2.6;
      addContactShadow(root, 2.2 * wScale, 2.2 * wScale);
      const treeGroup = new THREE.Group();
      const birchBarkMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.72,
        metalness: 0.02,
      });
      const birchFoliageMat = new THREE.MeshStandardMaterial({
        color: 0x65a30d,
        roughness: 0.78,
      });
      const curb = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 14, 32), MAT.travertine);
      curb.rotation.x = Math.PI / 2;
      curb.position.y = 0.05;
      treeGroup.add(curb);

      // 3 graceful angled white birch trunks with dark bark lenticel rings
      const trunkSpecs: [number, number, number, number, number][] = [
        [-0.08, 0.05, 3.1, -0.11, 0.06],
        [0.1, -0.04, 2.85, 0.13, -0.05],
        [-0.02, -0.09, 2.65, -0.05, -0.12],
      ];
      for (const [tx, tz, th, rx, rz] of trunkSpecs) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.085, th, 14), birchBarkMat);
        stem.position.set(tx, th / 2, tz);
        stem.rotation.set(rx, 0, rz);
        treeGroup.add(stem);
        for (let b = 0; b < 4; b++) {
          const band = new THREE.Mesh(
            new THREE.CylinderGeometry(0.072 - b * 0.006, 0.074 - b * 0.006, 0.06, 12),
            MAT.anthracite
          );
          band.position.set(tx * (1 + b * 0.35), 0.45 + b * 0.55, tz * (1 + b * 0.35));
          treeGroup.add(band);
        }
      }
      // Airy birch canopy clusters
      const canopyCoords: [number, number, number, number][] = [
        [-0.35, 3.05, 0.18, 0.76],
        [0.42, 2.85, -0.15, 0.72],
        [0.0, 3.55, 0.0, 0.82],
        [-0.18, 2.55, -0.36, 0.65],
        [0.24, 3.28, 0.28, 0.62],
      ];
      for (let i = 0; i < canopyCoords.length; i++) {
        const [cx, cy, cz, cr] = canopyCoords[i];
        const puff = new THREE.Mesh(
          new THREE.IcosahedronGeometry(cr, 2),
          i % 2 === 0 ? birchFoliageMat : MAT.foliageLight
        );
        puff.scale.set(1.0, 1.15, 1.0);
        puff.position.set(cx, cy, cz);
        treeGroup.add(puff);
      }
      treeGroup.scale.set(wScale, hScale, wScale);
      root.add(treeGroup);
      break;
    }

    case 'tree_japanese_maple': {
      const hScale = (asset.customHeight ?? 2.65) / 2.65;
      const wScale = (asset.customLength ?? 2.3) / 2.3;
      addContactShadow(root, 2.1 * wScale, 2.1 * wScale);
      const treeGroup = new THREE.Group();
      const crimsonDark = new THREE.MeshStandardMaterial({
        color: 0x881337,
        roughness: 0.72,
      });
      const crimsonBright = new THREE.MeshStandardMaterial({
        color: 0xbe123c,
        roughness: 0.68,
      });
      const curb = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.075, 14, 32), MAT.anthracite);
      curb.rotation.x = Math.PI / 2;
      curb.position.y = 0.05;
      const mainTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 1.35, 16), MAT.walnutWood);
      mainTrunk.position.set(0, 0.66, 0);
      mainTrunk.rotation.z = 0.08;
      treeGroup.add(curb, mainTrunk);

      // Layered horizontal cloud tiers characteristic of Acer palmatum
      const tiers: [number, number, number, number, number][] = [
        [0, 1.55, 0, 0.92, 0.42],
        [-0.48, 1.85, 0.22, 0.72, 0.38],
        [0.46, 1.98, -0.18, 0.74, 0.38],
        [0.05, 2.28, 0.06, 0.68, 0.36],
      ];
      for (let i = 0; i < tiers.length; i++) {
        const [tx, ty, tz, rad, sy] = tiers[i];
        const tierMesh = new THREE.Mesh(
          new THREE.IcosahedronGeometry(rad, 2),
          i % 2 === 0 ? crimsonDark : crimsonBright
        );
        tierMesh.scale.set(1.15, sy, 1.15);
        tierMesh.position.set(tx, ty, tz);
        treeGroup.add(tierMesh);
      }
      treeGroup.scale.set(wScale, hScale, wScale);
      root.add(treeGroup);
      break;
    }

    case 'tree_pine_conifer': {
      const hScale = (asset.customHeight ?? 4.4) / 4.4;
      const wScale = (asset.customLength ?? 2.7) / 2.7;
      addContactShadow(root, 2.3 * wScale, 2.3 * wScale);
      const treeGroup = new THREE.Group();
      const pineNeedleMat = new THREE.MeshStandardMaterial({
        color: 0x14532d,
        roughness: 0.82,
      });
      const pineBarkMat = new THREE.MeshStandardMaterial({
        color: 0x7c2d12,
        roughness: 0.88,
      });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.21, 2.8, 16), pineBarkMat);
      trunk.position.y = 1.4;
      treeGroup.add(trunk);

      const coneLayers = 5;
      for (let i = 0; i < coneLayers; i++) {
        const frac = i / (coneLayers - 1);
        const radius = 1.28 * (1 - frac * 0.58);
        const coneH = 1.15 * (1 - frac * 0.3);
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(radius, coneH, 14),
          i % 2 === 0 ? pineNeedleMat : MAT.foliageDark
        );
        cone.position.y = 1.65 + i * 0.58;
        cone.rotation.y = i * 0.4;
        treeGroup.add(cone);
      }
      treeGroup.scale.set(wScale, hScale, wScale);
      root.add(treeGroup);
      break;
    }

    case 'tree_mediterranean_olive': {
      const hScale = (asset.customHeight ?? 2.8) / 2.8;
      const wScale = (asset.customLength ?? 2.2) / 2.2;
      addContactShadow(root, 2.0 * wScale, 2.0 * wScale);
      const treeGroup = new THREE.Group();
      const oliveFoliageMat = new THREE.MeshStandardMaterial({
        color: 0x6b8e63,
        roughness: 0.78,
      });
      const oliveSilverMat = new THREE.MeshStandardMaterial({
        color: 0x8da387,
        roughness: 0.74,
      });
      const planterRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.54, 0.32, 24),
        MAT.travertine
      );
      planterRing.position.y = 0.16;
      const gnarledTrunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.24, 1.38, 12),
        MAT.teakWood
      );
      gnarledTrunk.position.y = 0.82;
      gnarledTrunk.rotation.z = -0.07;
      treeGroup.add(planterRing, gnarledTrunk);

      const crownPuffs: [number, number, number, number][] = [
        [0, 1.92, 0, 0.82],
        [-0.44, 1.78, 0.2, 0.62],
        [0.46, 1.84, -0.18, 0.64],
        [0.12, 2.22, 0.18, 0.58],
      ];
      for (let i = 0; i < crownPuffs.length; i++) {
        const [px, py, pz, pr] = crownPuffs[i];
        const puff = new THREE.Mesh(
          new THREE.IcosahedronGeometry(pr, 2),
          i % 2 === 0 ? oliveFoliageMat : oliveSilverMat
        );
        puff.scale.set(1.12, 0.72, 1.12);
        puff.position.set(px, py, pz);
        treeGroup.add(puff);
      }
      treeGroup.scale.set(wScale, hScale, wScale);
      root.add(treeGroup);
      break;
    }

    case 'tree_cypress_column': {
      const hScale = (asset.customHeight ?? 4.5) / 4.5;
      const wScale = (asset.customLength ?? 1.1) / 1.1;
      addContactShadow(root, 1.15 * wScale, 1.15 * wScale);
      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.75, 14), MAT.walnutWood);
      trunk.position.y = 0.375;
      const bodyLower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.48, 2.4, 18),
        MAT.foliageDark
      );
      bodyLower.position.y = 1.65;
      const bodyUpper = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 2.1, 18),
        MAT.foliageLight
      );
      bodyUpper.position.y = 3.45;
      treeGroup.add(trunk, bodyLower, bodyUpper);
      treeGroup.scale.set(wScale, hScale, wScale);
      root.add(treeGroup);
      break;
    }

    case 'tree_fruit_apple': {
      const hScale = (asset.customHeight ?? 3.3) / 3.3;
      const wScale = (asset.customLength ?? 2.8) / 2.8;
      addContactShadow(root, 2.3 * wScale, 2.3 * wScale);
      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 1.55, 16), MAT.walnutWood);
      trunk.position.y = 0.775;
      const cMain = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 2), MAT.foliageLight);
      cMain.position.set(0, 2.1, 0);
      const cLeft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 2), MAT.foliageDark);
      cLeft.position.set(-0.46, 2.25, 0.24);
      const cRight = new THREE.Mesh(new THREE.IcosahedronGeometry(0.74, 2), MAT.foliageDark);
      cRight.position.set(0.45, 2.18, -0.22);
      treeGroup.add(trunk, cMain, cLeft, cRight);

      // Glossy red apples hanging in the crown
      const appleMat = new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        roughness: 0.28,
        metalness: 0.05,
      });
      const appleCoords: [number, number, number][] = [
        [0.58, 1.85, 0.42],
        [-0.52, 1.92, 0.55],
        [0.24, 2.45, 0.68],
        [-0.35, 2.38, -0.58],
        [0.64, 2.15, -0.38],
        [-0.65, 1.95, -0.25],
        [0.05, 1.72, 0.75],
        [-0.12, 2.65, 0.35],
      ];
      for (const [ax, ay, az] of appleCoords) {
        const apple = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), appleMat);
        apple.position.set(ax, ay, az);
        treeGroup.add(apple);
      }
      treeGroup.scale.set(wScale, hScale, wScale);
      root.add(treeGroup);
      break;
    }

    case 'cypress_hedge': {
      const len = Math.max(0.6, asset.customLength ?? 3.0);
      const totalH = Math.max(0.5, asset.customHeight ?? 1.6);
      const curbH = 0.22;
      const foliageH = Math.max(0.3, totalH - curbH + 0.04);
      addContactShadow(root, len + 0.1, 0.62);
      const planter = new THREE.Mesh(
        new RoundedBoxGeometry(len, curbH, 0.55, 4, 0.025),
        MAT.anthracite
      );
      planter.position.y = curbH / 2;
      const hedge = new THREE.Mesh(
        new RoundedBoxGeometry(Math.max(0.4, len - 0.08), foliageH, 0.48, 5, 0.08),
        MAT.foliageDark
      );
      hedge.position.y = curbH + foliageH / 2 - 0.02;
      root.add(planter, hedge);

      // Organic cypress crown tops along the length
      const count = Math.max(2, Math.round(len / 0.55));
      const step = (len - 0.35) / Math.max(1, count - 1);
      for (let i = 0; i < count; i++) {
        const cx = count === 1 ? 0 : -(len - 0.35) / 2 + i * step;
        const tuft = new THREE.Mesh(
          new THREE.ConeGeometry(0.23, 0.38, 10),
          i % 2 === 0 ? MAT.foliageLight : MAT.foliageDark
        );
        tuft.position.set(cx, totalH + 0.06, (i % 2 === 0 ? 1 : -1) * 0.03);
        root.add(tuft);
      }
      break;
    }

    case 'hedge_thuja': {
      const len = Math.max(0.6, asset.customLength ?? 3.6);
      const totalH = Math.max(0.6, asset.customHeight ?? 1.85);
      addContactShadow(root, len + 0.1, 0.64);
      const mulchBed = new THREE.Mesh(
        new RoundedBoxGeometry(len, 0.08, 0.58, 3, 0.015),
        MAT.walnutWood
      );
      mulchBed.position.y = 0.04;
      const mainHedge = new THREE.Mesh(
        new RoundedBoxGeometry(len - 0.04, totalH - 0.06, 0.52, 5, 0.07),
        MAT.foliageDark
      );
      mainHedge.position.y = 0.06 + (totalH - 0.06) / 2;
      root.add(mulchBed, mainHedge);

      const ribs = Math.max(2, Math.round(len / 0.48));
      const step = (len - 0.3) / Math.max(1, ribs - 1);
      for (let i = 0; i < ribs; i++) {
        const rx = ribs === 1 ? 0 : -(len - 0.3) / 2 + i * step;
        const rib = new THREE.Mesh(
          new RoundedBoxGeometry(0.28, totalH - 0.14, 0.55, 3, 0.05),
          i % 2 === 0 ? MAT.foliageLight : MAT.foliageDark
        );
        rib.position.set(rx, 0.06 + (totalH - 0.14) / 2, 0);
        root.add(rib);
      }
      break;
    }

    case 'hedge_boxwood_low': {
      const len = Math.max(0.5, asset.customLength ?? 2.8);
      const totalH = Math.max(0.3, asset.customHeight ?? 0.55);
      addContactShadow(root, len + 0.08, 0.44);
      const soil = new THREE.Mesh(
        new RoundedBoxGeometry(len, 0.05, 0.38, 2, 0.01),
        MAT.walnutWood
      );
      soil.position.y = 0.025;
      const boxwood = new THREE.Mesh(
        new RoundedBoxGeometry(len - 0.02, totalH - 0.04, 0.35, 5, 0.06),
        MAT.foliageLight
      );
      boxwood.position.y = 0.04 + (totalH - 0.04) / 2;
      root.add(soil, boxwood);
      break;
    }

    case 'fence_double_rod': {
      const len = Math.max(0.8, asset.customLength ?? 3.6);
      const totalH = Math.max(0.6, asset.customHeight ?? 1.4);
      addContactShadow(root, len + 0.08, 0.18);
      const bays = Math.max(1, Math.round(len / 1.8));
      const bayW = len / bays;
      for (let i = 0; i <= bays; i++) {
        const px = -len / 2 + i * bayW;
        const post = new THREE.Mesh(
          new RoundedBoxGeometry(0.06, totalH + 0.04, 0.06, 2, 0.008),
          MAT.anthracite
        );
        post.position.set(px, (totalH + 0.04) / 2, 0);
        root.add(post);
      }
      // Horizontal double rods
      const hRows = Math.max(3, Math.floor(totalH / 0.22));
      for (let r = 0; r <= hRows; r++) {
        const ry = 0.08 + (r / hRows) * (totalH - 0.12);
        const rod = new THREE.Mesh(
          new THREE.BoxGeometry(len - 0.04, 0.016, 0.024),
          MAT.anthracite
        );
        rod.position.set(0, ry, 0);
        root.add(rod);
      }
      // Vertical mesh wires
      const vCols = Math.max(6, Math.floor(len / 0.12));
      for (let c = 0; c <= vCols; c++) {
        const vx = -len / 2 + 0.04 + (c / vCols) * (len - 0.08);
        const wire = new THREE.Mesh(
          new THREE.BoxGeometry(0.008, totalH - 0.08, 0.012),
          MAT.darkMetal
        );
        wire.position.set(vx, totalH / 2, 0);
        root.add(wire);
      }
      break;
    }

    case 'fence_wpc_privacy': {
      const len = Math.max(0.8, asset.customLength ?? 3.6);
      const totalH = Math.max(0.8, asset.customHeight ?? 1.8);
      addContactShadow(root, len + 0.1, 0.22);
      const bays = Math.max(1, Math.round(len / 1.8));
      const bayW = len / bays;
      for (let i = 0; i <= bays; i++) {
        const px = -len / 2 + i * bayW;
        const post = new THREE.Mesh(
          new RoundedBoxGeometry(0.075, totalH + 0.05, 0.075, 2, 0.01),
          MAT.brushedSteel
        );
        post.position.set(px, (totalH + 0.05) / 2, 0);
        root.add(post);
      }
      for (let b = 0; b < bays; b++) {
        const cx = -len / 2 + (b + 0.5) * bayW;
        const panel = new THREE.Mesh(
          new RoundedBoxGeometry(bayW - 0.06, totalH - 0.08, 0.032, 2, 0.006),
          MAT.anthracite
        );
        panel.position.set(cx, totalH / 2 + 0.02, 0);
        root.add(panel);
        for (const frac of [0.28, 0.56, 0.84]) {
          const trim = new THREE.Mesh(
            new THREE.BoxGeometry(bayW - 0.06, 0.022, 0.038),
            MAT.brushedSteel
          );
          trim.position.set(cx, totalH * frac, 0);
          root.add(trim);
        }
      }
      break;
    }

    case 'fence_wood_larch': {
      const len = Math.max(0.8, asset.customLength ?? 3.6);
      const totalH = Math.max(0.7, asset.customHeight ?? 1.65);
      addContactShadow(root, len + 0.1, 0.22);
      const bays = Math.max(1, Math.round(len / 1.8));
      const bayW = len / bays;
      for (let i = 0; i <= bays; i++) {
        const px = -len / 2 + i * bayW;
        const post = new THREE.Mesh(
          new RoundedBoxGeometry(0.07, totalH + 0.04, 0.07, 2, 0.008),
          MAT.darkMetal
        );
        post.position.set(px, (totalH + 0.04) / 2, 0);
        root.add(post);
      }
      const slatPitch = 0.115;
      const slatCount = Math.max(4, Math.floor((totalH - 0.1) / slatPitch));
      for (let s = 0; s < slatCount; s++) {
        const sy = 0.1 + s * slatPitch;
        const slat = new THREE.Mesh(
          new RoundedBoxGeometry(len - 0.06, 0.085, 0.032, 2, 0.006),
          s % 2 === 0 ? MAT.teakWood : MAT.oakWood
        );
        slat.position.set(0, sy, 0);
        root.add(slat);
      }
      break;
    }

    case 'fence_picket_classic': {
      const len = Math.max(0.8, asset.customLength ?? 3.2);
      const totalH = Math.max(0.5, asset.customHeight ?? 1.05);
      addContactShadow(root, len + 0.08, 0.2);
      const bays = Math.max(1, Math.round(len / 1.6));
      const bayW = len / bays;
      for (let i = 0; i <= bays; i++) {
        const px = -len / 2 + i * bayW;
        const post = new THREE.Mesh(
          new RoundedBoxGeometry(0.085, totalH + 0.06, 0.085, 2, 0.01),
          MAT.matteWhite
        );
        post.position.set(px, (totalH + 0.06) / 2, 0);
        root.add(post);
      }
      for (const ry of [totalH * 0.26, totalH * 0.74]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(len - 0.06, 0.045, 0.035),
          MAT.warmWhite
        );
        rail.position.set(0, ry, 0);
        root.add(rail);
      }
      const picketCount = Math.max(6, Math.floor(len / 0.12));
      for (let p = 0; p <= picketCount; p++) {
        const px = -len / 2 + 0.06 + (p / picketCount) * (len - 0.12);
        const picket = new THREE.Mesh(
          new RoundedBoxGeometry(0.062, totalH - 0.04, 0.022, 2, 0.005),
          MAT.matteWhite
        );
        picket.position.set(px, totalH / 2 + 0.01, 0.018);
        root.add(picket);
      }
      break;
    }

    case 'fence_gabion_wall': {
      const len = Math.max(0.6, asset.customLength ?? 3.2);
      const totalH = Math.max(0.5, asset.customHeight ?? 1.35);
      addContactShadow(root, len + 0.12, 0.38);
      // Stone core
      const stoneCore = new THREE.Mesh(
        new RoundedBoxGeometry(len - 0.04, totalH - 0.04, 0.28, 3, 0.02),
        MAT.travertine
      );
      stoneCore.position.y = totalH / 2;
      root.add(stoneCore);
      // Layered stone blocks for texture
      const layers = Math.max(3, Math.floor(totalH / 0.24));
      const cols = Math.max(4, Math.floor(len / 0.38));
      for (let r = 0; r < layers; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = -len / 2 + 0.2 + (c / Math.max(1, cols - 1)) * (len - 0.4);
          const by = 0.14 + (r / Math.max(1, layers - 1)) * (totalH - 0.28);
          const cobble = new THREE.Mesh(
            new RoundedBoxGeometry(0.32, 0.18, 0.305, 2, 0.025),
            (r + c) % 2 === 0 ? MAT.travertine : MAT.anthracite
          );
          cobble.position.set(bx, by, 0);
          root.add(cobble);
        }
      }
      // Galvanized steel cage frame
      const cageTop = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.025, 0.32),
        MAT.brushedSteel
      );
      cageTop.position.y = totalH;
      root.add(cageTop);
      break;
    }

    case 'fence_glass_alu': {
      const len = Math.max(0.8, asset.customLength ?? 3.2);
      const totalH = Math.max(0.7, asset.customHeight ?? 1.1);
      addContactShadow(root, len + 0.08, 0.18);
      const bays = Math.max(1, Math.round(len / 1.35));
      const bayW = len / bays;
      for (let i = 0; i <= bays; i++) {
        const px = -len / 2 + i * bayW;
        const post = new THREE.Mesh(
          new RoundedBoxGeometry(0.05, totalH, 0.05, 2, 0.008),
          MAT.anthracite
        );
        post.position.set(px, totalH / 2, 0);
        root.add(post);
      }
      const handrail = new THREE.Mesh(
        new RoundedBoxGeometry(len + 0.04, 0.04, 0.065, 2, 0.01),
        MAT.brushedSteel
      );
      handrail.position.set(0, totalH + 0.01, 0);
      const glassPane = new THREE.Mesh(
        new THREE.BoxGeometry(len - 0.08, totalH - 0.12, 0.018),
        glassMat
      );
      glassPane.position.set(0, totalH / 2, 0);
      root.add(handrail, glassPane);
      break;
    }

    case 'garden_pedestrian_gate': {
      const len = Math.max(0.85, asset.customLength ?? 1.25);
      const totalH = Math.max(0.9, asset.customHeight ?? 1.45);
      addContactShadow(root, len + 0.12, 0.24);
      const postL = new THREE.Mesh(
        new RoundedBoxGeometry(0.09, totalH + 0.08, 0.09, 2, 0.01),
        MAT.anthracite
      );
      postL.position.set(-len / 2 + 0.045, (totalH + 0.08) / 2, 0);
      const postR = postL.clone();
      postR.position.x = len / 2 - 0.045;

      const leafW = len - 0.22;
      const leafH = totalH - 0.1;
      const gateFrame = new THREE.Mesh(
        new RoundedBoxGeometry(leafW, leafH, 0.05, 2, 0.008),
        MAT.darkMetal
      );
      gateFrame.position.set(0, leafH / 2 + 0.06, 0);

      const handle = new THREE.Mesh(
        new RoundedBoxGeometry(0.04, 0.16, 0.12, 2, 0.006),
        MAT.brushedSteel
      );
      handle.position.set(leafW / 2 - 0.06, leafH * 0.55, 0);

      const statusDot = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.06, 0.095),
        indicatorMat
      );
      statusDot.position.set(len / 2 - 0.045, totalH * 0.65, 0);

      root.add(postL, postR, gateFrame, handle, statusDot);
      break;
    }

    case 'walkway_wood_deck': {
      const len = Math.max(0.8, asset.customLength ?? 3.6);
      const pathW = Math.max(0.5, asset.customHeight ?? 1.1);
      // Dark gravel sub-rail beams
      for (const rz of [-pathW * 0.36, pathW * 0.36]) {
        const sleeper = new THREE.Mesh(
          new THREE.BoxGeometry(len - 0.06, 0.022, 0.06),
          MAT.darkMetal
        );
        sleeper.position.set(0, 0.011, rz);
        root.add(sleeper);
      }
      // Transverse oiled larch/teak boardwalk planks
      const plankPitch = 0.16;
      const count = Math.max(4, Math.floor(len / plankPitch));
      const actualStep = len / count;
      for (let i = 0; i < count; i++) {
        const px = -len / 2 + (i + 0.5) * actualStep;
        const plank = new THREE.Mesh(
          new RoundedBoxGeometry(actualStep - 0.022, 0.028, pathW, 2, 0.005),
          i % 2 === 0 ? MAT.teakWood : MAT.oakWood
        );
        plank.position.set(px, 0.032, 0);
        root.add(plank);
      }
      break;
    }

    case 'walkway_natural_stone': {
      const len = Math.max(0.8, asset.customLength ?? 3.6);
      const pathW = Math.max(0.5, asset.customHeight ?? 1.1);
      // Steel lawn edging strips on both sides
      for (const sz of [-pathW / 2, pathW / 2]) {
        const edge = new THREE.Mesh(
          new THREE.BoxGeometry(len, 0.032, 0.018),
          MAT.anthracite
        );
        edge.position.set(0, 0.016, sz);
        root.add(edge);
      }
      const slabPitch = 0.62;
      const count = Math.max(2, Math.floor(len / slabPitch));
      const step = len / count;
      for (let i = 0; i < count; i++) {
        const sx = -len / 2 + (i + 0.5) * step;
        const slab = new THREE.Mesh(
          new RoundedBoxGeometry(step - 0.05, 0.034, pathW - 0.06, 3, 0.008),
          MAT.travertine
        );
        slab.position.set(sx, 0.02, 0);
        root.add(slab);
      }
      break;
    }

    case 'walkway_stepping_stones': {
      const len = Math.max(0.8, asset.customLength ?? 3.6);
      const pathW = Math.max(0.5, asset.customHeight ?? 1.0);
      // Gravel bed base
      const gravelBase = new THREE.Mesh(
        new RoundedBoxGeometry(len, 0.016, pathW, 2, 0.006),
        MAT.charcoalFabric
      );
      gravelBase.position.y = 0.008;
      root.add(gravelBase);

      const stoneCount = Math.max(2, Math.floor(len / 0.58));
      const step = len / stoneCount;
      for (let i = 0; i < stoneCount; i++) {
        const sx = -len / 2 + (i + 0.5) * step;
        const sz = (i % 2 === 0 ? -1 : 1) * (pathW * 0.1);
        const stone = new THREE.Mesh(
          new THREE.CylinderGeometry(step * 0.38, step * 0.4, 0.032, 18),
          MAT.travertine
        );
        stone.scale.set(1, 1, (pathW * 0.65) / (step * 0.76));
        stone.position.set(sx, 0.022, sz);
        root.add(stone);
      }
      break;
    }

    case 'walkway_slate_anthracite': {
      const len = Math.max(0.8, asset.customLength ?? 3.6);
      const pathW = Math.max(0.5, asset.customHeight ?? 1.15);
      // Granite curb borders
      for (const sz of [-pathW / 2 + 0.04, pathW / 2 - 0.04]) {
        const curb = new THREE.Mesh(
          new RoundedBoxGeometry(len, 0.038, 0.075, 2, 0.006),
          MAT.brushedSteel
        );
        curb.position.set(0, 0.019, sz);
        root.add(curb);
      }
      const slabCount = Math.max(2, Math.floor(len / 0.72));
      const step = len / slabCount;
      for (let i = 0; i < slabCount; i++) {
        const sx = -len / 2 + (i + 0.5) * step;
        const slate = new THREE.Mesh(
          new RoundedBoxGeometry(step - 0.035, 0.034, pathW - 0.18, 2, 0.006),
          MAT.anthracite
        );
        slate.position.set(sx, 0.018, 0);
        root.add(slate);
      }
      break;
    }

    case 'stainless_steel_chimney': {
      // High-gloss brushed V4A double-walled exterior stainless steel chimney (Edelstahlaussenkamin)
      const totalH = Math.max(2.0, asset.customHeight ?? 5.2);
      const flueRadius = 0.115; // Ø 230mm double-walled insulated stainless pipe
      const v4aSteel = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.13,
        metalness: 0.95,
      });
      const clampSteel = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.1,
        metalness: 0.98,
      });

      // 1. Wall Support Console at Y = 0.45m (Wandkonsole mit Dreiecksstreben & Kondensatablauf)
      const baseConsoleY = 0.45;
      const wallPlate = new THREE.Mesh(
        new RoundedBoxGeometry(0.36, 0.42, 0.025, 2, 0.005),
        v4aSteel
      );
      wallPlate.position.set(0, baseConsoleY - 0.12, -0.22);
      const supportPlatform = new THREE.Mesh(
        new RoundedBoxGeometry(0.34, 0.03, 0.44, 2, 0.005),
        v4aSteel
      );
      supportPlatform.position.set(0, baseConsoleY, -0.02);
      for (const sx of [-0.13, 0.13]) {
        const strut = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 0.34, 0.035),
          v4aSteel
        );
        strut.position.set(sx, baseConsoleY - 0.14, -0.11);
        strut.rotation.x = 0.68;
        root.add(strut);
      }
      const condensateDrain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.016, 0.18, 14),
        v4aSteel
      );
      condensateDrain.position.set(0, baseConsoleY - 0.09, 0.06);
      root.add(wallPlate, supportPlatform, condensateDrain);

      // 2. Main Vertical Double-Walled Stainless Flue Pipe (from baseConsoleY to totalH - 0.25)
      const pipeLen = Math.max(1.2, totalH - baseConsoleY - 0.22);
      const mainFlue = new THREE.Mesh(
        new THREE.CylinderGeometry(flueRadius, flueRadius, pipeLen, 28),
        v4aSteel
      );
      mainFlue.position.set(0, baseConsoleY + pipeLen / 2, 0.06);
      root.add(mainFlue);

      // 3. Inspection Door & Glowing Sight Glass (Reinigungsöffnung) + Horizontal Wall Feed-Through (Wanddurchführung)
      const inspectBox = new THREE.Mesh(
        new RoundedBoxGeometry(0.16, 0.22, 0.08, 3, 0.01),
        clampSteel
      );
      inspectBox.position.set(0, baseConsoleY + 0.26, 0.15);
      const sightGlow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.02, 16),
        indicatorMat
      );
      sightGlow.rotation.x = Math.PI / 2;
      sightGlow.position.set(0, baseConsoleY + 0.26, 0.19);

      const feedThroughY = Math.min(totalH - 0.6, 1.15);
      const horizontalPipe = new THREE.Mesh(
        new THREE.CylinderGeometry(flueRadius * 0.92, flueRadius * 0.92, 0.36, 24),
        v4aSteel
      );
      horizontalPipe.rotation.x = Math.PI / 2;
      horizontalPipe.position.set(0, feedThroughY, -0.09);
      const wallRosette = new THREE.Mesh(
        new THREE.CylinderGeometry(flueRadius * 1.48, flueRadius * 1.48, 0.03, 28),
        MAT.anthracite
      );
      wallRosette.rotation.x = Math.PI / 2;
      wallRosette.position.set(0, feedThroughY, -0.24);
      root.add(inspectBox, sightGlow, horizontalPipe, wallRosette);

      // 4. Modular Segment Clamping Bands (Klemmbänder every 0.95m) & Wall Brackets (Wandhalter)
      const segCount = Math.max(2, Math.floor(pipeLen / 0.95));
      for (let i = 1; i <= segCount; i++) {
        const bandY = baseConsoleY + (i / (segCount + 0.2)) * pipeLen;
        const clampBand = new THREE.Mesh(
          new THREE.CylinderGeometry(flueRadius + 0.008, flueRadius + 0.008, 0.045, 28),
          clampSteel
        );
        clampBand.position.set(0, bandY, 0.06);
        root.add(clampBand);

        if (i % 2 === 1 && bandY < totalH - 0.8) {
          const bracketCollar = new THREE.Mesh(
            new THREE.CylinderGeometry(flueRadius + 0.014, flueRadius + 0.014, 0.055, 28),
            MAT.anthracite
          );
          bracketCollar.position.set(0, bandY, 0.06);
          for (const bx of [-flueRadius, flueRadius]) {
            const wallArm = new THREE.Mesh(
              new THREE.BoxGeometry(0.022, 0.04, 0.3),
              v4aSteel
            );
            wallArm.position.set(bx, bandY, -0.09);
            root.add(wallArm);
          }
          root.add(bracketCollar);
        }
      }

      // 5. Top Conical Transition, Wind Shield Ring & Meidinger Rain Cap (Regenhaube)
      const topY = baseConsoleY + pipeLen;
      const topCone = new THREE.Mesh(
        new THREE.CylinderGeometry(flueRadius * 0.78, flueRadius, 0.12, 24),
        clampSteel
      );
      topCone.position.set(0, topY + 0.06, 0.06);
      const rainDisc = new THREE.Mesh(
        new THREE.ConeGeometry(flueRadius * 1.45, 0.09, 28),
        clampSteel
      );
      rainDisc.position.set(0, topY + 0.22, 0.06);
      for (let s = 0; s < 3; s++) {
        const ang = (s * Math.PI * 2) / 3;
        const strut = new THREE.Mesh(
          new THREE.CylinderGeometry(0.007, 0.007, 0.14, 8),
          v4aSteel
        );
        strut.position.set(
          Math.cos(ang) * flueRadius * 0.72,
          topY + 0.14,
          0.06 + Math.sin(ang) * flueRadius * 0.72
        );
        root.add(strut);
      }
      root.add(topCone, rainDisc);
      break;
    }

    case 'outdoor_patio_fireplace_steel': {
      addContactShadow(root, 1.1, 0.78);
      const v4aSteel = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.16,
        metalness: 0.92,
      });
      const basePlinth = new THREE.Mesh(
        new RoundedBoxGeometry(1.02, 0.52, 0.68, 3, 0.015),
        MAT.anthracite
      );
      basePlinth.position.y = 0.26;
      // Log storage compartment logs
      for (let i = 0; i < 5; i++) {
        const log = new THREE.Mesh(
          new THREE.CylinderGeometry(0.048, 0.052, 0.56, 12),
          i % 2 === 0 ? MAT.oakWood : MAT.walnutWood
        );
        log.rotation.x = Math.PI / 2;
        log.position.set(-0.24 + i * 0.12, 0.16 + (i % 2) * 0.09, 0.04);
        root.add(log);
      }
      const hearthSlab = new THREE.Mesh(
        new RoundedBoxGeometry(1.06, 0.05, 0.72, 2, 0.01),
        MAT.travertine
      );
      hearthSlab.position.y = 0.54;
      const fireboxBack = new THREE.Mesh(
        new RoundedBoxGeometry(0.92, 0.68, 0.14, 2, 0.01),
        MAT.darkMetal
      );
      fireboxBack.position.set(0, 0.9, -0.24);
      const glassShield = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.52, 0.52),
        glassMat
      );
      glassShield.position.set(0, 0.84, 0.04);
      const emberFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.34, 16),
        indicatorMat
      );
      emberFlame.position.set(0, 0.72, 0.02);
      const steelHood = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.54, 0.48, 4),
        v4aSteel
      );
      steelHood.rotation.y = Math.PI / 4;
      steelHood.position.set(0, 1.46, 0);
      const fluePipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.105, 0.105, 0.72, 24),
        v4aSteel
      );
      fluePipe.position.set(0, 2.02, 0);
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.08, 24),
        v4aSteel
      );
      cap.position.set(0, 2.42, 0);
      root.add(basePlinth, hearthSlab, fireboxBack, glassShield, emberFlame, steelHood, fluePipe, cap);
      addVolumetricLightFeatures(root, 1.35, 0.74, 0.015, 2.4);
      break;
    }

    case 'roof_dormer_gable':
    case 'roof_dormer_shed':
    case 'roof_dormer_flat_modern': {
      const w = Math.max(1.0, asset.customLength ?? (asset.catalogId === 'roof_dormer_gable' ? 1.8 : 2.5));
      const h = Math.max(0.9, asset.customHeight ?? 1.4);
      const d = 1.55;
      const bodyH = h * 0.8;
      const wallT = 0.12;
      const sillH = Math.max(0.22, bodyH * 0.24);
      const lintelH = 0.08;
      const winW = Math.max(0.55, w - wallT * 2 - 0.04);
      const winH = Math.max(0.42, bodyH - sillH - lintelH);

      // Front Kniestock / Brüstung (below window) + Top Lintel + Side Corner Pillars (so window is see-through!)
      const frontSillWall = new THREE.Mesh(
        new THREE.BoxGeometry(w, sillH, wallT),
        MAT.warmWhite
      );
      frontSillWall.position.set(0, sillH / 2, d / 2 - wallT / 2);
      const frontLintelWall = new THREE.Mesh(
        new THREE.BoxGeometry(w, lintelH, wallT),
        MAT.warmWhite
      );
      frontLintelWall.position.set(0, bodyH - lintelH / 2, d / 2 - wallT / 2);
      root.add(frontSillWall, frontLintelWall);

      // Sloped Side Cheeks (Gaubenwangen) extending backward (-Z) into the roof slope!
      // Note: rotation.y = +Math.PI/2 maps local shape X to -Z in 3D, so X = -d/2 maps to Z = +d/2 (front)
      // and X = +d/2 maps to Z = -d/2 (back, rising along the roof slope).
      const backRoofRise = Math.min(bodyH * 0.72, d * 0.48);
      const shedRise = asset.catalogId === 'roof_dormer_shed' ? h * 0.28 : 0;
      const cheekShape = new THREE.Shape();
      cheekShape.moveTo(-d / 2, 0);
      cheekShape.lineTo(-d / 2, bodyH);
      cheekShape.lineTo(d / 2, bodyH + shedRise);
      cheekShape.lineTo(d / 2, backRoofRise);
      cheekShape.closePath();
      const cheekGeo = new THREE.ExtrudeGeometry(cheekShape, {
        depth: wallT,
        bevelEnabled: false,
      });
      const leftCheek = new THREE.Mesh(cheekGeo, MAT.warmWhite);
      leftCheek.rotation.y = Math.PI / 2;
      leftCheek.position.set(-w / 2, 0, 0);
      const rightCheek = new THREE.Mesh(cheekGeo, MAT.warmWhite);
      rightCheek.rotation.y = Math.PI / 2;
      rightCheek.position.set(w / 2 - wallT, 0, 0);
      root.add(leftCheek, rightCheek);

      if (asset.catalogId === 'roof_dormer_shed') {
        const roofLen = Math.hypot(d + 0.28, shedRise);
        const shedAngle = Math.atan2(shedRise, d);
        const shedRoof = new THREE.Mesh(
          new RoundedBoxGeometry(w + 0.24, 0.08, roofLen, 2, 0.01),
          MAT.anthracite
        );
        shedRoof.position.set(0, bodyH + shedRise / 2 + 0.03, 0.03);
        shedRoof.rotation.x = shedAngle;
        root.add(shedRoof);
      } else if (asset.catalogId === 'roof_dormer_gable') {
        const peakH = h * 0.36;
        const gableShape = new THREE.Shape();
        gableShape.moveTo(-w / 2, 0);
        gableShape.lineTo(0, peakH);
        gableShape.lineTo(w / 2, 0);
        gableShape.closePath();
        const gablePrism = new THREE.Mesh(
          new THREE.ExtrudeGeometry(gableShape, { depth: d, bevelEnabled: false }),
          MAT.warmWhite
        );
        gablePrism.position.set(0, bodyH - 0.01, -d / 2);
        root.add(gablePrism);

        const halfOver = w / 2 + 0.16;
        const slopeLen = Math.hypot(halfOver, peakH);
        const roofAng = Math.atan2(peakH, halfOver);
        const leftWing = new THREE.Mesh(
          new THREE.BoxGeometry(slopeLen, 0.075, d + 0.26),
          MAT.anthracite
        );
        leftWing.position.set(-halfOver / 2, bodyH + peakH / 2 + 0.02, 0.04);
        leftWing.rotation.z = roofAng;
        const rightWing = new THREE.Mesh(
          new THREE.BoxGeometry(slopeLen, 0.075, d + 0.26),
          MAT.anthracite
        );
        rightWing.position.set(halfOver / 2, bodyH + peakH / 2 + 0.02, 0.04);
        rightWing.rotation.z = -roofAng;
        root.add(leftWing, rightWing);
      } else {
        const flatRoof = new THREE.Mesh(
          new RoundedBoxGeometry(w + 0.22, 0.1, d + 0.24, 2, 0.012),
          MAT.anthracite
        );
        flatRoof.position.set(0, bodyH + 0.04, 0.03);
        root.add(flatRoof);
      }

      const winGroup = buildDormerWindowAssembly(
        winW,
        winH,
        asset.dormerWindowConfig,
        isSoftwareGl
      );
      winGroup.position.set(0, sillH + winH / 2, d / 2 - 0.02);
      root.add(winGroup);
      break;
    }

    case 'roof_skylight_window':
    case 'roof_skylight_twin': {
      const isTwin = asset.catalogId === 'roof_skylight_twin';
      const w = Math.max(0.7, asset.customLength ?? (isTwin ? 1.85 : 1.14));
      const d = Math.max(0.8, asset.customHeight ?? 1.4);
      const winCfg = asset.dormerWindowConfig;
      const frameMat = resolveFrameColorMaterial(winCfg?.windowFrameColor || 'anthracite');
      const openState = winCfg?.windowOpenState || 'closed';
      const clearGlassMat = createGlassMaterial(isSoftwareGl, 0xbae6fd);

      const tiltGroup = new THREE.Group();
      tiltGroup.rotation.x = 0.42;

      // Hollow 4-sided outer flashing collar (Eindeckrahmen) — open in the middle so glass is 100% transparent!
      const fRim = 0.055;
      const fH = 0.068;
      const fTop = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, fH, fRim), frameMat);
      fTop.position.set(0, 0, -d / 2 + fRim / 2 - 0.02);
      const fBot = fTop.clone();
      fBot.position.z = d / 2 - fRim / 2 + 0.02;
      const fLeft = new THREE.Mesh(new THREE.BoxGeometry(fRim, fH, d + 0.04), frameMat);
      fLeft.position.set(-w / 2 + fRim / 2 - 0.02, 0, 0);
      const fRight = fLeft.clone();
      fRight.position.x = w / 2 - fRim / 2 + 0.02;
      tiltGroup.add(fTop, fBot, fLeft, fRight);

      const sashCount = isTwin ? 2 : (winCfg?.windowCount ?? 1);
      const innerW = w - 0.09;
      const innerD = d - 0.09;
      const sashW = (innerW - (sashCount - 1) * 0.036) / sashCount;
      const sRim = 0.036;

      for (let i = 0; i < sashCount; i++) {
        const sx = -innerW / 2 + sashW / 2 + i * (sashW + 0.036);
        if (i > 0) {
          const midPost = new THREE.Mesh(
            new THREE.BoxGeometry(0.036, fH, innerD),
            frameMat
          );
          midPost.position.set(sx - sashW / 2 - 0.018, 0.01, 0);
          tiltGroup.add(midPost);
        }

        const sashPivot = new THREE.Group();
        sashPivot.position.set(sx, 0.028, 0);
        if (openState === 'tilted') {
          sashPivot.rotation.x = -0.24;
        } else if (openState === 'open') {
          sashPivot.rotation.x = -0.55;
        }

        // Hollow 4-sided sash frame (Flügelrahmen) so the center is completely unobstructed glass
        const sTop = new THREE.Mesh(new THREE.BoxGeometry(sashW, 0.036, sRim), frameMat);
        sTop.position.z = -innerD / 2 + sRim / 2;
        const sBot = sTop.clone();
        sBot.position.z = innerD / 2 - sRim / 2;
        const sLeft = new THREE.Mesh(new THREE.BoxGeometry(sRim, 0.036, innerD - sRim * 2), frameMat);
        sLeft.position.x = -sashW / 2 + sRim / 2;
        const sRight = sLeft.clone();
        sRight.position.x = sashW / 2 - sRim / 2;

        // Top brushed aluminum ventilation handle bar (Velux Griffleiste)
        const ventHandle = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(0.18, sashW - sRim * 2.2), 0.018, 0.026),
          MAT.brushedSteel
        );
        ventHandle.position.set(0, 0.022, -innerD / 2 + sRim * 0.7);

        const glassPane = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(0.12, sashW - sRim * 2), 0.016, Math.max(0.12, innerD - sRim * 2)),
          clearGlassMat
        );
        glassPane.position.y = 0.004;

        sashPivot.add(sTop, sBot, sLeft, sRight, ventHandle, glassPane);
        tiltGroup.add(sashPivot);
      }

      tiltGroup.position.y = 0.18;
      root.add(tiltGroup);
      break;
    }

    case 'chimney_brick_roof': {
      const cw = Math.max(0.45, asset.customLength ?? 0.65);
      const ch = Math.max(1.1, asset.customHeight ?? 2.2);
      const brickMat = new THREE.MeshStandardMaterial({
        color: 0x8b3a2b,
        roughness: 0.85,
        metalness: 0.05,
      });
      // Lead flashing apron (Kaminverwahrung)
      const flashingBase = new THREE.Mesh(
        new THREE.BoxGeometry(cw + 0.16, 0.08, cw + 0.16),
        MAT.darkMetal
      );
      flashingBase.position.y = 0.04;
      // Brick shaft
      const shaft = new THREE.Mesh(
        new RoundedBoxGeometry(cw, ch - 0.18, cw, 2, 0.015),
        brickMat
      );
      shaft.position.y = (ch - 0.18) / 2 + 0.04;
      // Concrete crown slab (Kaminabdeckplatte)
      const crown = new THREE.Mesh(
        new RoundedBoxGeometry(cw + 0.12, 0.075, cw + 0.12, 2, 0.01),
        MAT.travertine
      );
      crown.position.y = ch - 0.1;
      // Dual ceramic/stainless flue pots + rain hood
      for (const fx of cw > 0.7 ? [-cw * 0.22, cw * 0.22] : [0]) {
        const fluePot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.095, 0.105, 0.24, 18),
          MAT.brushedSteel
        );
        fluePot.position.set(fx, ch + 0.04, 0);
        const rainHood = new THREE.Mesh(
          new THREE.ConeGeometry(0.15, 0.08, 18),
          MAT.brushedSteel
        );
        rainHood.position.set(fx, ch + 0.2, 0);
        root.add(fluePot, rainHood);
      }
      root.add(flashingBase, shaft, crown);
      break;
    }

    case 'wood_stove_scandinavian': {
      addContactShadow(root, 0.75, 0.75);
      // Floor glass hearth plate (Funkenschutzplatte)
      const floorGlass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.46, 0.012, 28),
        glassMat
      );
      floorGlass.position.y = 0.006;
      // Cast-iron cylindrical stove body (Schwedenofen)
      const stoveBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.29, 1.12, 28),
        MAT.darkMetal
      );
      stoveBody.position.y = 0.57;
      // Curved panoramic viewing glass & glowing firewood embers
      const fireWindow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.286, 0.286, 0.42, 20, 1, false, -0.58, 1.16),
        glassMat
      );
      fireWindow.position.y = 0.68;
      const fireGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 12),
        new THREE.MeshStandardMaterial({
          color: 0xff6b00,
          emissive: 0xff4500,
          emissiveIntensity: 2.2,
          roughness: 0.3,
        })
      );
      fireGlow.position.set(0, 0.62, 0.08);
      // Flue pipe going up to ceiling/roof (Rauchrohr)
      const fluePipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 1.35, 20),
        MAT.darkMetal
      );
      fluePipe.position.set(0, 1.78, -0.04);
      root.add(floorGlass, stoveBody, fireWindow, fireGlow, fluePipe);
      addVolumetricLightFeatures(root, 0.65, 0.58, 0.015, 1.8);
      break;
    }

    case 'patio_lounge_set': {
      addContactShadow(root, 2.7, 2.3);
      const deckBase = new THREE.Mesh(new RoundedBoxGeometry(2.32, 0.2, 0.9, 4, 0.025), MAT.teakWood);
      deckBase.position.set(0, 0.15, -0.55);
      const cushion = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.16, 0.82, 5, 0.045), MAT.boucleFabric);
      cushion.position.set(0, 0.33, -0.55);
      const backrest = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.42, 0.2, 5, 0.05), MAT.boucleFabric);
      backrest.position.set(0, 0.58, -0.86);
      const p1 = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.32, 0.12, 4, 0.04), MAT.terracottaCushion);
      p1.position.set(-0.72, 0.56, -0.72);
      p1.rotation.z = 0.15;
      const p2 = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.32, 0.12, 4, 0.04), MAT.sageCushion);
      p2.position.set(0.68, 0.56, -0.72);
      p2.rotation.z = -0.12;
      const table = new THREE.Mesh(new RoundedBoxGeometry(1.22, 0.32, 0.72, 4, 0.025), MAT.teakWood);
      table.position.set(0, 0.16, 0.35);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 2.38, 20), MAT.anthracite);
      pole.position.set(1.25, 1.19, -0.65);
      const umbrella = new THREE.Mesh(new THREE.ConeGeometry(1.58, 0.44, 12), MAT.boucleFabric);
      umbrella.position.set(0.15, 2.24, -0.1);
      root.add(deckBase, cushion, backrest, p1, p2, table, pole, umbrella);
      break;
    }

    case 'pool_lounger': {
      addContactShadow(root, 0.9, 2.05);
      const frame = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.2, 1.96, 4, 0.025), MAT.teakWood);
      frame.position.y = 0.14;
      const mat = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.085, 1.32, 4, 0.03), MAT.boucleFabric);
      mat.position.set(0, 0.28, 0.28);
      const head = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.085, 0.62, 4, 0.03), MAT.boucleFabric);
      head.rotation.x = 0.45;
      head.position.set(0, 0.42, -0.62);
      const towel = new THREE.Mesh(new RoundedBoxGeometry(0.54, 0.04, 0.42, 3, 0.015), MAT.terracottaCushion);
      towel.position.set(0, 0.33, 0.52);
      root.add(frame, mat, head, towel);
      break;
    }

    case 'pool_heat_pump': {
      addContactShadow(root, 1.1, 0.6);
      const cabinet = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.75, 0.5, 4, 0.025), MAT.anthracite);
      cabinet.position.y = 0.375;
      const fanGrille = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.032, 28), MAT.darkMetal);
      fanGrille.rotation.x = Math.PI / 2;
      fanGrille.position.set(-0.15, 0.38, 0.252);
      const ledBadge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.02), indicatorMat);
      ledBadge.position.set(0.28, 0.52, 0.252);
      root.add(cabinet, fanGrille, ledBadge);
      break;
    }

    case 'ev_wallbox': {
      const box = new THREE.Mesh(new RoundedBoxGeometry(0.33, 0.45, 0.15, 5, 0.03), MAT.anthracite);
      box.position.z = 0.075;
      const glassFront = new THREE.Mesh(new RoundedBoxGeometry(0.29, 0.39, 0.018, 4, 0.02), MAT.darkMetal);
      glassFront.position.z = 0.152;
      const ledBar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.026, 0.022), indicatorMat);
      ledBar.position.set(0, 0.08, 0.16);
      const cableLoop = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.019, 16, 32), MAT.darkMetal);
      cableLoop.position.set(0, -0.12, 0.09);
      root.add(box, glassFront, ledBar, cableLoop);
      break;
    }

    case 'electric_car': {
      addContactShadow(root, 2.2, 4.65);
      const lowerBody = new THREE.Mesh(
        new RoundedBoxGeometry(1.94, 0.62, 4.48, 6, 0.14),
        MAT.carPaintSilver
      );
      lowerBody.position.y = 0.52;
      const cabin = new THREE.Mesh(
        new RoundedBoxGeometry(1.64, 0.56, 2.38, 6, 0.16),
        MAT.darkMetal
      );
      cabin.position.set(0, 1.06, -0.15);
      const panoRoof = new THREE.Mesh(new RoundedBoxGeometry(1.52, 0.04, 2.15, 3, 0.015), glassMat);
      panoRoof.position.set(0, 1.34, -0.15);
      const frontLightBar = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.05, 0.05), MAT.matteWhite);
      frontLightBar.position.set(0, 0.68, -2.23);
      const rearLightBar = new THREE.Mesh(
        new THREE.BoxGeometry(1.76, 0.05, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.5 })
      );
      rearLightBar.position.set(0, 0.72, 2.23);
      const chargePort = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.14), indicatorMat);
      chargePort.position.set(-0.97, 0.72, -1.35);

      const wheelPositions: [number, number, number][] = [
        [-0.95, 0.34, -1.4],
        [0.95, 0.34, -1.4],
        [-0.95, 0.34, 1.4],
        [0.95, 0.34, 1.4],
      ];
      wheelPositions.forEach(([wx, wy, wz]) => {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 28), MAT.darkMetal);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(wx, wy, wz);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.26, 20), MAT.brushedSteel);
        rim.rotation.z = Math.PI / 2;
        rim.position.set(wx, wy, wz);
        root.add(tire, rim);
      });

      root.add(lowerBody, cabin, panoRoof, frontLightBar, rearLightBar, chargePort);
      break;
    }

    case 'solar_panel_array': {
      for (let row = 0; row < 2; row++) {
        for (let col = -1; col <= 1; col++) {
          const frame = new THREE.Mesh(new RoundedBoxGeometry(1.06, 0.04, 0.96, 2, 0.006), MAT.darkMetal);
          frame.rotation.x = 0.28;
          frame.position.set(col * 1.1, 0.22 + row * 0.08, -0.5 + row * 1.02);
          const cell = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.045, 0.9), MAT.solarCell);
          cell.rotation.x = 0.28;
          cell.position.copy(frame.position);
          root.add(frame, cell);
        }
      }
      break;
    }

    case 'home_battery_inverter': {
      addContactShadow(root, 0.78, 0.42);
      const tower = new THREE.Mesh(new RoundedBoxGeometry(0.68, 1.48, 0.29, 5, 0.03), MAT.matteWhite);
      tower.position.y = 0.74;
      const frontGlass = new THREE.Mesh(new RoundedBoxGeometry(0.62, 1.38, 0.025, 4, 0.02), MAT.anthracite);
      frontGlass.position.set(0, 0.74, 0.146);
      const socBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.05, 0.028), indicatorMat);
      socBar.position.set(0.22, 0.74, 0.152);
      root.add(tower, frontGlass, socBar);
      break;
    }

    // =========================================================================
    // 6. WOHNMÖBEL & INNENEINRICHTUNG (inZOI / UE5 Bevelled Detail)
    // =========================================================================
    case 'sofa_l_shape': {
      addContactShadow(root, 3.1, 2.3);
      const rug = new THREE.Mesh(new RoundedBoxGeometry(3.25, 0.02, 2.45, 3, 0.008), MAT.travertine);
      rug.position.set(0, 0.01, 0.1);
      const mainSeat = new THREE.Mesh(new RoundedBoxGeometry(2.72, 0.38, 0.96, 6, 0.065), MAT.boucleFabric);
      mainSeat.position.set(0, 0.21, -0.45);
      const chaise = new THREE.Mesh(new RoundedBoxGeometry(0.98, 0.38, 1.88, 6, 0.065), MAT.boucleFabric);
      chaise.position.set(0.87, 0.21, 0.0);
      const back = new THREE.Mesh(new RoundedBoxGeometry(2.72, 0.44, 0.24, 6, 0.065), MAT.boucleFabric);
      back.position.set(0, 0.56, -0.82);
      const armLeft = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.52, 0.96, 5, 0.055), MAT.boucleFabric);
      armLeft.position.set(-1.26, 0.28, -0.45);

      // Plush throw pillows
      const pillow1 = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.36, 0.14, 4, 0.05), MAT.terracottaCushion);
      pillow1.position.set(-0.88, 0.54, -0.64);
      pillow1.rotation.z = 0.18;
      const pillow2 = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.36, 0.14, 4, 0.05), MAT.sageCushion);
      pillow2.position.set(-0.15, 0.54, -0.65);
      pillow2.rotation.z = -0.1;
      const pillow3 = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.36, 0.14, 4, 0.05), MAT.charcoalFabric);
      pillow3.position.set(0.82, 0.54, -0.64);

      // Sculpted Coffee Table + Vase + Art Book
      const coffeeTable = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.46, 0.34, 36), MAT.oakWood);
      coffeeTable.position.set(-0.35, 0.18, 0.42);
      const book = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.035, 0.22, 2, 0.005), MAT.anthracite);
      book.position.set(-0.44, 0.365, 0.44);
      book.rotation.y = 0.3;
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.22, 24), MAT.travertine);
      vase.position.set(-0.22, 0.45, 0.35);

      root.add(rug, mainSeat, chaise, back, armLeft, pillow1, pillow2, pillow3, coffeeTable, book, vase);
      break;
    }

    case 'dining_table_oak': {
      addContactShadow(root, 2.35, 1.5);
      const top = new THREE.Mesh(new RoundedBoxGeometry(2.18, 0.065, 1.08, 4, 0.02), MAT.oakWood);
      top.position.y = 0.75;
      const legL = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.72, 0.86, 3, 0.015), MAT.darkMetal);
      legL.position.set(-0.82, 0.36, 0);
      const legR = legL.clone();
      legR.position.x = 0.82;
      const centerpieceBowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.12, 0.09, 28),
        MAT.travertine
      );
      centerpieceBowl.position.set(0, 0.82, 0);
      root.add(top, legL, legR, centerpieceBowl);

      for (let i = -1; i <= 1; i++) {
        for (const side of [-1, 1]) {
          const seat = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.07, 0.48, 4, 0.025), MAT.charcoalFabric);
          seat.position.set(i * 0.66, 0.45, side * 0.68);
          const chairBack = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.4, 0.07, 4, 0.025), MAT.charcoalFabric);
          chairBack.position.set(i * 0.66, 0.66, side * 0.89);
          const chairBase = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.2, 0.42, 16), MAT.darkMetal);
          chairBase.position.set(i * 0.66, 0.21, side * 0.68);
          root.add(seat, chairBack, chairBase);
        }
      }
      break;
    }

    case 'kitchen_island_stone': {
      addContactShadow(root, 2.55, 1.35);
      const base = new THREE.Mesh(new RoundedBoxGeometry(2.36, 0.88, 1.08, 4, 0.02), MAT.anthracite);
      base.position.y = 0.44;
      const stoneTop = new THREE.Mesh(new RoundedBoxGeometry(2.44, 0.065, 1.16, 4, 0.018), MAT.travertine);
      stoneTop.position.y = 0.91;
      const cooktop = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.016, 0.52, 2, 0.005), MAT.darkMetal);
      cooktop.position.set(-0.48, 0.946, 0);
      const sink = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.016, 0.44, 2, 0.005), MAT.brushedSteel);
      sink.position.set(0.55, 0.946, 0);
      const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 16), MAT.brushedSteel);
      faucet.position.set(0.55, 1.1, -0.25);

      // 3 Designer Counter Barstools
      for (let i = -1; i <= 1; i++) {
        const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.18, 0.06, 24), MAT.oakWood);
        stoolSeat.position.set(i * 0.72, 0.66, 0.74);
        const stoolPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.16, 0.64, 20), MAT.darkMetal);
        stoolPole.position.set(i * 0.72, 0.32, 0.74);
        root.add(stoolSeat, stoolPole);
      }
      root.add(base, stoneTop, cooktop, sink, faucet);
      break;
    }

    case 'kitchen_cabinet_wall': {
      addContactShadow(root, 3.05, 0.75);
      const units = new THREE.Mesh(new RoundedBoxGeometry(2.96, 2.24, 0.64, 4, 0.02), MAT.warmWhite);
      units.position.y = 1.12;
      const oven = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.58, 0.035, 3, 0.01), MAT.darkMetal);
      oven.position.set(-0.62, 1.15, 0.32);
      const espressoNiche = new THREE.Mesh(new RoundedBoxGeometry(1.12, 0.64, 0.045, 3, 0.01), MAT.oakWood);
      espressoNiche.position.set(0.45, 1.15, 0.32);
      const coffeeMachine = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.36, 0.28, 3, 0.015), MAT.brushedSteel);
      coffeeMachine.position.set(0.45, 1.04, 0.25);
      root.add(units, oven, espressoNiche, coffeeMachine);
      break;
    }

    case 'office_desk_setup': {
      addContactShadow(root, 1.9, 1.25);
      const deskTop = new THREE.Mesh(new RoundedBoxGeometry(1.78, 0.055, 0.84, 4, 0.018), MAT.walnutWood);
      deskTop.position.y = 0.74;
      const leg1 = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.72, 0.74, 3, 0.01), MAT.darkMetal);
      leg1.position.set(-0.78, 0.36, 0);
      const leg2 = leg1.clone();
      leg2.position.x = 0.78;
      const monitor = new THREE.Mesh(new RoundedBoxGeometry(1.12, 0.44, 0.032, 3, 0.01), MAT.darkMetal);
      monitor.position.set(0, 1.08, -0.22);
      const chair = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.9, 0.58, 5, 0.05), MAT.charcoalFabric);
      chair.position.set(0, 0.45, 0.55);
      root.add(deskTop, leg1, leg2, monitor, chair);
      break;
    }

    case 'double_bed_suite': {
      addContactShadow(root, 2.55, 2.25);
      const frame = new THREE.Mesh(new RoundedBoxGeometry(1.94, 0.32, 2.12, 5, 0.04), MAT.charcoalFabric);
      frame.position.y = 0.16;
      const mattress = new THREE.Mesh(new RoundedBoxGeometry(1.82, 0.26, 2.0, 5, 0.05), MAT.matteWhite);
      mattress.position.set(0, 0.42, 0.02);
      const blanket = new THREE.Mesh(new RoundedBoxGeometry(1.86, 0.28, 1.38, 6, 0.06), MAT.boucleFabric);
      blanket.position.set(0, 0.43, 0.34);
      const throwRunner = new THREE.Mesh(new RoundedBoxGeometry(1.88, 0.29, 0.45, 4, 0.04), MAT.sageCushion);
      throwRunner.position.set(0, 0.44, 0.72);
      const headboard = new THREE.Mesh(new RoundedBoxGeometry(2.48, 1.1, 0.18, 5, 0.045), MAT.charcoalFabric);
      headboard.position.set(0, 0.55, -0.98);
      const pL = new THREE.Mesh(new RoundedBoxGeometry(0.65, 0.22, 0.38, 4, 0.05), MAT.matteWhite);
      pL.position.set(-0.46, 0.62, -0.68);
      pL.rotation.x = 0.25;
      const pR = pL.clone();
      pR.position.x = 0.46;
      root.add(frame, mattress, blanket, throwRunner, headboard, pL, pR);
      break;
    }

    case 'bathroom_vanity_shower': {
      addContactShadow(root, 2.55, 1.65);
      const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.42, 0.58, 36), MAT.matteWhite);
      tub.scale.set(1.68, 1, 0.92);
      tub.position.set(-0.55, 0.29, 0.2);
      const vanity = new THREE.Mesh(new RoundedBoxGeometry(1.22, 0.56, 0.54, 4, 0.02), MAT.oakWood);
      vanity.position.set(0.65, 0.52, -0.45);
      const vanityTop = new THREE.Mesh(new RoundedBoxGeometry(1.24, 0.05, 0.56, 3, 0.01), MAT.travertine);
      vanityTop.position.set(0.65, 0.82, -0.45);
      const mirror = new THREE.Mesh(new RoundedBoxGeometry(1.16, 0.84, 0.03, 4, 0.015), glassMat);
      mirror.position.set(0.65, 1.38, -0.68);
      root.add(tub, vanity, vanityTop, mirror);
      break;
    }

    case 'kitchen_l_shape': {
      addContactShadow(root, 3.25, 2.25);
      // Main back counter run
      const runBack = new THREE.Mesh(new RoundedBoxGeometry(3.12, 0.88, 0.65, 4, 0.02), MAT.anthracite);
      runBack.position.set(0, 0.44, -0.72);
      const topBack = new THREE.Mesh(new RoundedBoxGeometry(3.16, 0.05, 0.68, 3, 0.012), MAT.travertine);
      topBack.position.set(0, 0.905, -0.72);
      // Side L-wing counter run
      const runSide = new THREE.Mesh(new RoundedBoxGeometry(0.65, 0.88, 1.48, 4, 0.02), MAT.anthracite);
      runSide.position.set(-1.23, 0.44, 0.34);
      const topSide = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.05, 1.52, 3, 0.012), MAT.travertine);
      topSide.position.set(-1.23, 0.905, 0.34);
      // Upper wall cabinets in warm oak
      const upperCab = new THREE.Mesh(new RoundedBoxGeometry(3.1, 0.72, 0.38, 4, 0.02), MAT.oakWood);
      upperCab.position.set(0, 1.85, -0.85);
      // Undermount sink & black matte arch faucet
      const sinkBasin = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.02, 0.44, 2, 0.005), MAT.darkMetal);
      sinkBasin.position.set(-0.35, 0.932, -0.72);
      const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 16), MAT.brushedSteel);
      faucet.position.set(-0.35, 1.1, -0.92);
      // Induction stove + extractor hood
      const stove = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.018, 0.5, 2, 0.005), MAT.darkMetal);
      stove.position.set(0.75, 0.932, -0.72);
      // Warm LED under-cabinet light strip
      const underLed = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.015, 0.04), indicatorMat);
      underLed.position.set(0, 1.48, -0.72);
      root.add(runBack, topBack, runSide, topSide, upperCab, sinkBasin, faucet, stove, underLed);
      break;
    }

    case 'fridge_side_by_side': {
      addContactShadow(root, 1.05, 0.85);
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.92, 1.82, 0.72, 4, 0.025), MAT.anthracite);
      body.position.y = 0.91;
      const doorLeft = new THREE.Mesh(new RoundedBoxGeometry(0.43, 1.76, 0.04, 3, 0.012), MAT.brushedSteel);
      doorLeft.position.set(-0.225, 0.91, 0.37);
      const doorRight = new THREE.Mesh(new RoundedBoxGeometry(0.43, 1.76, 0.04, 3, 0.012), MAT.brushedSteel);
      doorRight.position.set(0.225, 0.91, 0.37);
      const instaViewGlass = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.72, 0.048, 2, 0.008), glassMat);
      instaViewGlass.position.set(0.225, 1.24, 0.372);
      const iceDispenser = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.32, 0.045, 2, 0.008), MAT.darkMetal);
      iceDispenser.position.set(-0.225, 1.18, 0.372);
      root.add(body, doorLeft, doorRight, instaViewGlass, iceDispenser);
      break;
    }

    case 'wardrobe_oak_mirror': {
      addContactShadow(root, 2.5, 0.72);
      const corpus = new THREE.Mesh(new RoundedBoxGeometry(2.4, 2.2, 0.62, 4, 0.02), MAT.oakWood);
      corpus.position.y = 1.1;
      const mirrorDoor = new THREE.Mesh(new RoundedBoxGeometry(0.76, 2.1, 0.025, 3, 0.008), glassMat);
      mirrorDoor.position.set(0, 1.1, 0.315);
      const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.1, 0.035), MAT.darkMetal);
      handleL.position.set(-0.42, 1.1, 0.325);
      const handleR = handleL.clone();
      handleR.position.x = 0.42;
      root.add(corpus, mirrorDoor, handleL, handleR);
      break;
    }

    case 'sideboard_walnut': {
      addContactShadow(root, 1.9, 0.55);
      const body = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.58, 0.46, 4, 0.02), MAT.walnutWood);
      body.position.y = 0.49;
      const topSlab = new THREE.Mesh(new RoundedBoxGeometry(1.82, 0.035, 0.48, 3, 0.01), MAT.travertine);
      topSlab.position.y = 0.795;
      for (const lx of [-0.76, 0.76]) {
        const leg = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.2, 0.4, 2, 0.006), MAT.darkMetal);
        leg.position.set(lx, 0.1, 0);
        root.add(leg);
      }
      const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.24, 20), MAT.travertine);
      lampBase.position.set(0.55, 0.93, 0);
      const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.2, 24), MAT.boucleFabric);
      lampShade.position.set(0.55, 1.12, 0);
      root.add(body, topSlab, lampBase, lampShade);
      break;
    }

    case 'bookshelf_divider': {
      addContactShadow(root, 1.7, 0.48);
      for (const sx of [-0.76, 0, 0.76]) {
        const upright = new THREE.Mesh(new THREE.BoxGeometry(0.035, 2.08, 0.36), MAT.darkMetal);
        upright.position.set(sx, 1.04, 0);
        root.add(upright);
      }
      for (let i = 0; i < 5; i++) {
        const shelf = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.035, 0.38, 2, 0.006), MAT.oakWood);
        shelf.position.set(0, 0.22 + i * 0.44, 0);
        root.add(shelf);
      }
      const bookCluster = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.26, 0.22, 2, 0.008), MAT.terracottaCushion);
      bookCluster.position.set(-0.38, 1.23, 0);
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.26, 20), MAT.travertine);
      vase.position.set(0.36, 1.67, 0);
      root.add(bookCluster, vase);
      break;
    }

    case 'fireplace_panorama': {
      addContactShadow(root, 1.5, 0.65);
      const plinth = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.42, 0.55, 4, 0.02), MAT.travertine);
      plinth.position.y = 0.21;
      const fireGlass = new THREE.Mesh(new RoundedBoxGeometry(1.18, 0.48, 0.38, 3, 0.01), glassMat);
      fireGlass.position.y = 0.66;
      const hoodColumn = new THREE.Mesh(new RoundedBoxGeometry(1.36, 1.25, 0.52, 4, 0.02), MAT.anthracite);
      hoodColumn.position.y = 1.52;
      const flameMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 1.35,
        roughness: 0.3,
      });
      const emberBed = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.08, 0.18, 3, 0.02), flameMat);
      emberBed.position.y = 0.48;
      root.add(plinth, fireGlass, hoodColumn, emberBed);
      break;
    }

    case 'single_bed_youth': {
      addContactShadow(root, 1.25, 2.15);
      const frame = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.28, 2.06, 4, 0.03), MAT.oakWood);
      frame.position.y = 0.14;
      const mattress = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.22, 1.96, 4, 0.04), MAT.matteWhite);
      mattress.position.set(0, 0.36, 0.02);
      const duvet = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.24, 1.36, 5, 0.05), MAT.sageCushion);
      duvet.position.set(0, 0.38, 0.32);
      const headboard = new THREE.Mesh(new RoundedBoxGeometry(1.12, 0.92, 0.12, 4, 0.03), MAT.oakWood);
      headboard.position.set(0, 0.46, -0.98);
      const pillow = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.18, 0.36, 4, 0.04), MAT.boucleFabric);
      pillow.position.set(0, 0.52, -0.68);
      pillow.rotation.x = 0.22;
      root.add(frame, mattress, duvet, headboard, pillow);
      break;
    }

    case 'indoor_plant_monstera': {
      addContactShadow(root, 0.72, 0.72);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.42, 28), MAT.travertine);
      pot.position.y = 0.21;
      const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 24), MAT.walnutWood);
      soil.position.y = 0.41;
      const leaf1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), MAT.foliageDark);
      leaf1.scale.set(1.1, 0.7, 1.1);
      leaf1.position.set(0, 0.78, 0);
      const leaf2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), MAT.foliageLight);
      leaf2.position.set(0.18, 1.05, 0.12);
      const leaf3 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), MAT.foliageLight);
      leaf3.position.set(-0.16, 0.96, -0.14);
      root.add(pot, soil, leaf1, leaf2, leaf3);
      break;
    }

    case 'woven_area_rug': {
      const rugMain = new THREE.Mesh(new RoundedBoxGeometry(2.8, 0.022, 2.0, 4, 0.008), MAT.boucleFabric);
      rugMain.position.y = 0.011;
      const innerPattern = new THREE.Mesh(new RoundedBoxGeometry(2.35, 0.025, 1.55, 3, 0.006), MAT.travertine);
      innerPattern.position.y = 0.012;
      root.add(rugMain, innerPattern);
      break;
    }

    case 'walk_in_shower': {
      addContactShadow(root, 1.45, 1.15);
      const tray = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.05, 1.1, 3, 0.012), MAT.travertine);
      tray.position.y = 0.025;
      const drain = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.055, 0.06), MAT.brushedSteel);
      drain.position.set(-0.28, 0.026, 0);
      const glassWall = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.05, 0.022), glassMat);
      glassWall.position.set(-0.2, 1.05, 0.53);
      const framePost = new THREE.Mesh(new THREE.BoxGeometry(0.035, 2.06, 0.035), MAT.darkMetal);
      framePost.position.set(0.28, 1.05, 0.53);
      const rainColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.95, 16), MAT.darkMetal);
      rainColumn.position.set(-0.64, 1.02, 0);
      const rainHead = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 28), MAT.darkMetal);
      rainHead.position.set(-0.42, 1.98, 0);
      root.add(tray, drain, glassWall, framePost, rainColumn, rainHead);
      break;
    }

    case 'wall_hung_toilet': {
      addContactShadow(root, 0.65, 0.72);
      const cisternWall = new THREE.Mesh(new RoundedBoxGeometry(0.58, 1.12, 0.18, 3, 0.015), MAT.travertine);
      cisternWall.position.set(0, 0.56, -0.24);
      const flushPlate = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.16, 0.015, 2, 0.005), MAT.darkMetal);
      flushPlate.position.set(0, 0.94, -0.145);
      const bowl = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.34, 0.54, 5, 0.08), MAT.matteWhite);
      bowl.position.set(0, 0.3, 0.08);
      const lid = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.035, 0.52, 4, 0.015), MAT.matteWhite);
      lid.position.set(0, 0.48, 0.08);
      root.add(cisternWall, flushPlate, bowl, lid);
      break;
    }

    case 'washer_dryer_tower': {
      addContactShadow(root, 0.72, 0.72);
      const washer = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.85, 0.64, 4, 0.022), MAT.matteWhite);
      washer.position.y = 0.425;
      const dryer = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.85, 0.64, 4, 0.022), MAT.matteWhite);
      dryer.position.y = 1.32;
      const pullOutShelf = new THREE.Mesh(new RoundedBoxGeometry(0.64, 0.04, 0.66, 2, 0.008), MAT.anthracite);
      pullOutShelf.position.y = 0.87;
      for (const dy of [0.42, 1.32]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 18, 32), MAT.darkMetal);
        ring.position.set(0, dy, 0.322);
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.04, 24), glassMat);
        glass.rotation.x = Math.PI / 2;
        glass.position.set(0, dy, 0.31);
        root.add(ring, glass);
      }
      root.add(washer, dryer, pullOutShelf);
      break;
    }

    case 'staircase_oak_glass':
    case 'staircase_spiral_steel':
    case 'staircase_curved_landing': {
      const sc = asset.stairConfig || {};
      const defaultShape =
        asset.catalogId === 'staircase_spiral_steel'
          ? 'spiral'
          : asset.catalogId === 'staircase_curved_landing'
          ? 'half_s_curve'
          : 'straight';
      const shape = sc.shape || defaultShape;
      const underClosure =
        sc.underStairClosure ||
        (asset.catalogId === 'staircase_curved_landing' ? 'walled_closed' : 'open');
      const railingSide = sc.railingSide || 'both';
      const railingStyle = sc.railingStyle || 'glass';
      const riserStyle = sc.riserStyle || (underClosure !== 'open' ? 'closed_white' : 'open');
      const treadMat =
        sc.treadMaterial === 'walnut'
          ? MAT.walnutWood
          : sc.treadMaterial === 'anthracite_stone'
          ? MAT.anthracite
          : sc.treadMaterial === 'travertine'
          ? MAT.travertine
          : MAT.oakWood;

      const stairW = THREE.MathUtils.clamp(sc.width ?? 1.06, 0.75, 1.8);
      const totalRise = THREE.MathUtils.clamp(sc.totalRise ?? (asset.customHeight ?? 2.75), 1.6, 3.8);
      const totalRun = THREE.MathUtils.clamp(sc.totalRun ?? (asset.customLength ?? 3.1), 1.8, 4.8);
      const numSteps = Math.round(THREE.MathUtils.clamp(sc.stepCount ?? 14, 8, 20));
      const stepRise = totalRise / numSteps;
      const stepDepth = Math.max(0.24, totalRun / numSteps);

      if (shape === 'spiral') {
        addContactShadow(root, 1.85, 1.85);
        const radius = Math.max(0.75, stairW * 0.78);
        const centerPole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.085, 0.085, totalRise + 0.15, 24),
          MAT.darkMetal
        );
        centerPole.position.y = (totalRise + 0.15) / 2;
        root.add(centerPole);

        for (let i = 0; i < numSteps; i++) {
          const stepPivot = new THREE.Group();
          const y = (i + 1) * stepRise;
          stepPivot.position.y = y;
          stepPivot.rotation.y = (i / numSteps) * Math.PI * 1.75;

          const tread = new THREE.Mesh(
            new RoundedBoxGeometry(radius, 0.048, 0.28, 3, 0.008),
            treadMat
          );
          tread.position.x = radius / 2 + 0.06;
          stepPivot.add(tread);

          if (riserStyle !== 'open') {
            const riserMesh = new THREE.Mesh(
              new THREE.BoxGeometry(radius - 0.04, stepRise, 0.02),
              riserStyle === 'closed_oak' ? treadMat : MAT.warmWhite
            );
            riserMesh.position.set(radius / 2 + 0.06, -stepRise / 2, -0.12);
            stepPivot.add(riserMesh);
          }

          if (railingSide !== 'none') {
            const spindle = new THREE.Mesh(
              new THREE.CylinderGeometry(0.014, 0.014, 0.92, 10),
              MAT.darkMetal
            );
            spindle.position.set(radius + 0.02, 0.46, 0);
            const railSeg = new THREE.Mesh(
              new RoundedBoxGeometry(0.045, 0.045, 0.34, 2, 0.008),
              treadMat
            );
            railSeg.position.set(radius + 0.02, 0.92, 0.08);
            railSeg.rotation.x = -0.35;
            stepPivot.add(spindle, railSeg);
          }

          root.add(stepPivot);
        }
        break;
      }

      addContactShadow(root, stairW + 0.8, totalRun + 0.4);

      // Compute 3D path of each step: [x, y, z, yawRad, treadW, treadD]
      interface StepPlacement {
        x: number;
        y: number;
        z: number;
        yaw: number;
        w: number;
        d: number;
      }
      const placements: StepPlacement[] = [];

      if (shape === 'u_podest') {
        const halfSteps = Math.floor(numSteps / 2);
        const flightRun = totalRun * 0.56;
        const gapX = stairW * 0.56;
        const podestY = halfSteps * stepRise;

        // First flight going up (-Z to +Z on -X side)
        for (let i = 0; i < halfSteps; i++) {
          const t = i / Math.max(1, halfSteps - 1);
          placements.push({
            x: -gapX,
            y: (i + 1) * stepRise,
            z: -flightRun / 2 + t * flightRun,
            yaw: 0,
            w: stairW * 0.88,
            d: stepDepth,
          });
        }

        // Intermediate 180° Landing (Zwischenpodest)
        const landingMesh = new THREE.Mesh(
          new RoundedBoxGeometry(gapX * 2 + stairW * 0.92, 0.065, stairW * 0.95, 3, 0.012),
          treadMat
        );
        landingMesh.position.set(0, podestY, flightRun / 2 + stairW * 0.45);
        root.add(landingMesh);

        // Second flight returning (+Z to -Z on +X side)
        const remSteps = numSteps - halfSteps;
        for (let j = 0; j < remSteps; j++) {
          const t = j / Math.max(1, remSteps - 1);
          placements.push({
            x: gapX,
            y: podestY + (j + 1) * stepRise,
            z: flightRun / 2 - t * flightRun,
            yaw: Math.PI,
            w: stairW * 0.88,
            d: stepDepth,
          });
        }
      } else {
        // Straight or Curved (Bottom Left/Right, Top Left/Right, or Doubly-Curved Bottom & Top 'half_s_curve')
        const hasBottomCurve =
          shape === 'quarter_bottom_left' ||
          shape === 'quarter_bottom_right' ||
          shape === 'half_s_curve';
        const hasTopCurve =
          shape === 'quarter_top_left' ||
          shape === 'quarter_top_right' ||
          shape === 'half_s_curve';
        const botDir = shape === 'quarter_bottom_right' ? 1 : -1;
        const topDir = shape === 'quarter_top_left' ? -1 : 1;

        for (let i = 0; i < numSteps; i++) {
          const u = i / Math.max(1, numSteps - 1);
          let x = 0;
          let z = -totalRun / 2 + u * totalRun;
          let yaw = 0;

          if (hasBottomCurve && u < 0.32) {
            const cFrac = (0.32 - u) / 0.32; // 1 at bottom step, 0 at transition
            const ang = cFrac * (Math.PI * 0.46);
            x += botDir * Math.sin(ang) * (stairW * 0.72) * cFrac;
            z += (1 - Math.cos(ang)) * 0.42;
            yaw = -botDir * ang * 0.85;
          }
          if (hasTopCurve && u > 0.68) {
            const cFrac = (u - 0.68) / 0.32; // 0 at transition, 1 at top step
            const ang = cFrac * (Math.PI * 0.46);
            x += topDir * Math.sin(ang) * (stairW * 0.72) * cFrac;
            z -= (1 - Math.cos(ang)) * 0.42;
            yaw = topDir * ang * 0.85;
          }

          placements.push({
            x,
            y: (i + 1) * stepRise,
            z,
            yaw,
            w: stairW,
            d: stepDepth * 1.06,
          });
        }
      }

      // Render Treads, Risers, Stringers, Under-Stair Wall Closure & Railings
      const wallCloseMat = MAT.warmWhite;
      for (let i = 0; i < placements.length; i++) {
        const p = placements[i];
        const stepGroup = new THREE.Group();
        stepGroup.position.set(p.x, p.y, p.z);
        stepGroup.rotation.y = p.yaw;

        // Step Tread (Trittstufe)
        const tread = new THREE.Mesh(
          new RoundedBoxGeometry(p.w, 0.052, p.d, 3, 0.008),
          treadMat
        );
        stepGroup.add(tread);

        // Optional Riser (Setzstufe geschlossen)
        if (riserStyle !== 'open') {
          const riser = new THREE.Mesh(
            new THREE.BoxGeometry(p.w - 0.02, stepRise + 0.01, 0.024),
            riserStyle === 'closed_oak' ? treadMat : MAT.warmWhite
          );
          riser.position.set(0, -stepRise / 2, -p.d / 2 + 0.02);
          stepGroup.add(riser);
        }

        // Under-Stair Wall / Cabinet Closure (Wandabschluss unter der Treppe!)
        if (underClosure !== 'open') {
          const colH = Math.max(0.05, p.y - 0.025);
          const colMat =
            underClosure === 'built_in_drawers' && i >= 3 ? MAT.oakWood : wallCloseMat;
          const underBlock = new THREE.Mesh(
            new THREE.BoxGeometry(p.w - 0.03, colH, p.d + 0.035),
            colMat
          );
          underBlock.position.set(0, -colH / 2 - 0.02, 0);
          stepGroup.add(underBlock);

          // Add drawer grooves & black handles when 'built_in_drawers' is selected
          if (underClosure === 'built_in_drawers' && i >= 4 && i % 3 === 1 && colH > 0.65) {
            for (const sideSign of [-1, 1]) {
              const handle = new THREE.Mesh(
                new THREE.BoxGeometry(0.018, 0.022, 0.16),
                MAT.darkMetal
              );
              handle.position.set(
                sideSign * (p.w / 2 - 0.01),
                -colH * 0.45,
                0
              );
              stepGroup.add(handle);
            }
          }

          // Add closet storage door & handle on the tall side when 'storage_door' is selected
          if (
            underClosure === 'storage_door' &&
            i === Math.floor(placements.length * 0.72) &&
            colH > 1.35
          ) {
            const doorH = Math.min(1.65, colH - 0.18);
            const doorFrame = new THREE.Mesh(
              new RoundedBoxGeometry(0.035, doorH, 0.68, 2, 0.006),
              MAT.matteWhite
            );
            doorFrame.position.set(p.w / 2 - 0.005, -colH + doorH / 2 + 0.04, -0.08);
            const doorHandle = new THREE.Mesh(
              new RoundedBoxGeometry(0.045, 0.14, 0.028, 2, 0.005),
              MAT.brushedSteel
            );
            doorHandle.position.set(p.w / 2 + 0.018, -colH + doorH * 0.52, -0.28);
            stepGroup.add(doorFrame, doorHandle);
          }
        } else {
          // Open freestanding stair: add central/side dark metal support spine under each step
          const spine = new THREE.Mesh(
            new THREE.BoxGeometry(0.055, stepRise + 0.08, p.d + 0.06),
            MAT.darkMetal
          );
          spine.position.set(-p.w / 2 + 0.06, -stepRise / 2 - 0.02, 0);
          const spineR = spine.clone();
          spineR.position.x = p.w / 2 - 0.06;
          stepGroup.add(spine, spineR);
        }

        // Railings / Balustrades (links, rechts oder beidseitig)
        const railSides: number[] = [];
        if (railingSide === 'both' || railingSide === 'left') railSides.push(-1);
        if (railingSide === 'both' || railingSide === 'right') railSides.push(1);

        for (const sSign of railSides) {
          const rx = sSign * (p.w / 2 - 0.028);
          if (railingStyle === 'glass') {
            const glassSeg = new THREE.Mesh(
              new THREE.BoxGeometry(0.018, 0.9, p.d + 0.04),
              glassMat
            );
            glassSeg.position.set(rx, 0.46, 0);
            const topHandrail = new THREE.Mesh(
              new RoundedBoxGeometry(0.042, 0.038, p.d + 0.06, 2, 0.008),
              treadMat
            );
            topHandrail.position.set(rx, 0.92, 0);
            topHandrail.rotation.x = -Math.atan2(stepRise, p.d);
            stepGroup.add(glassSeg, topHandrail);
          } else if (railingStyle === 'solid_parapet') {
            const parapet = new THREE.Mesh(
              new THREE.BoxGeometry(0.065, 0.92, p.d + 0.05),
              MAT.warmWhite
            );
            parapet.position.set(rx, 0.46, 0);
            const cap = new THREE.Mesh(
              new RoundedBoxGeometry(0.085, 0.035, p.d + 0.06, 2, 0.008),
              treadMat
            );
            cap.position.set(rx, 0.93, 0);
            cap.rotation.x = -Math.atan2(stepRise, p.d);
            stepGroup.add(parapet, cap);
          } else {
            // 'steel_rods' or 'oak_handrail'
            const rod = new THREE.Mesh(
              new THREE.CylinderGeometry(0.012, 0.012, 0.92, 10),
              MAT.darkMetal
            );
            rod.position.set(rx, 0.46, 0);
            const handrail = new THREE.Mesh(
              new RoundedBoxGeometry(0.045, 0.04, p.d + 0.06, 2, 0.008),
              railingStyle === 'oak_handrail' ? treadMat : MAT.darkMetal
            );
            handrail.position.set(rx, 0.92, 0);
            handrail.rotation.x = -Math.atan2(stepRise, p.d);
            stepGroup.add(rod, handrail);
          }
        }

        root.add(stepGroup);
      }
      break;
    }

    // =========================================================================
    // 7. NEUE GARTEN-, FREIZEIT-, GEWÄCHSHAUS-, GARAGEN- & ROLLTOR-ASSETS
    // =========================================================================
    case 'sun_shade_sail': {
      addContactShadow(root, 4.2, 4.2);
      // 4 angled brushed stainless steel masts
      const mastCoords: [number, number, number, number][] = [
        [-1.95, 2.75, -1.95, 0.08],
        [1.95, 2.35, -1.95, -0.08],
        [-1.95, 2.35, 1.95, 0.08],
        [1.95, 2.8, 1.95, -0.08],
      ];
      for (const [mx, mh, mz, tilt] of mastCoords) {
        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.032, 0.042, mh, 16),
          MAT.brushedSteel
        );
        mast.position.set(mx, mh / 2, mz);
        mast.rotation.z = tilt;
        const foot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.1, 0.04, 16),
          MAT.darkMetal
        );
        foot.position.set(mx, 0.02, mz);
        root.add(mast, foot);
      }

      // Hyperbolic tensioned sun shade sail geometry (curved quad)
      const sailGeo = new THREE.PlaneGeometry(3.85, 3.85, 14, 14);
      const posAttr = sailGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i) / 1.925;
        const vy = posAttr.getY(i) / 1.925;
        // Saddle curvature (high at NW & SE corners, lower at NE & SW, slight sag in center)
        const saddle = vx * vy * 0.24 - (1 - (vx * vx + vy * vy) * 0.35) * 0.14;
        posAttr.setZ(i, saddle);
      }
      sailGeo.computeVertexNormals();
      const sailMat = new THREE.MeshStandardMaterial({
        color: 0xf3eee4,
        roughness: 0.78,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });
      const sailMesh = new THREE.Mesh(sailGeo, sailMat);
      sailMesh.rotation.x = -Math.PI / 2;
      sailMesh.position.y = 2.52;
      root.add(sailMesh);
      break;
    }

    case 'climbing_play_tower': {
      addContactShadow(root, 3.8, 3.1);
      // 4 sturdy timber stilts for the main playhouse tower
      for (const px of [-1.25, -0.15]) {
        for (const pz of [-0.55, 0.55]) {
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.095, 2.35, 0.095),
            MAT.teakWood
          );
          post.position.set(px, 1.175, pz);
          root.add(post);
        }
      }
      // Elevated platform deck (at y = 1.25m) + sandbox frame underneath
      const deck = new THREE.Mesh(
        new RoundedBoxGeometry(1.26, 0.07, 1.26, 3, 0.015),
        MAT.oakWood
      );
      deck.position.set(-0.7, 1.25, 0);
      const sandbox = new THREE.Mesh(
        new RoundedBoxGeometry(1.22, 0.22, 1.22, 3, 0.015),
        MAT.teakWood
      );
      sandbox.position.set(-0.7, 0.11, 0);
      const sandFill = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, 0.16, 1.08),
        MAT.travertine
      );
      sandFill.position.set(-0.7, 0.11, 0);
      root.add(deck, sandbox, sandFill);

      // Safety railings around platform
      const railBack = new THREE.Mesh(
        new RoundedBoxGeometry(1.2, 0.62, 0.05, 2, 0.01),
        MAT.oakWood
      );
      railBack.position.set(-0.7, 1.58, -0.56);
      const railWest = new THREE.Mesh(
        new RoundedBoxGeometry(0.05, 0.62, 1.2, 2, 0.01),
        MAT.oakWood
      );
      railWest.position.set(-1.26, 1.58, 0);
      root.add(railBack, railWest);

      // Pitched wooden gable roof
      const roofL = new THREE.Mesh(
        new RoundedBoxGeometry(0.82, 0.055, 1.38, 2, 0.01),
        MAT.walnutWood
      );
      roofL.position.set(-1.02, 2.48, 0);
      roofL.rotation.z = 0.52;
      const roofR = new THREE.Mesh(
        new RoundedBoxGeometry(0.82, 0.055, 1.38, 2, 0.01),
        MAT.walnutWood
      );
      roofR.position.set(-0.38, 2.48, 0);
      roofR.rotation.z = -0.52;
      root.add(roofL, roofR);

      // Wave Slide (Wellenrutsche) extending forward (+Z)
      const slideMat = new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        roughness: 0.22,
        metalness: 0.1,
      });
      const slideChute = new THREE.Mesh(
        new RoundedBoxGeometry(0.48, 0.12, 2.05, 4, 0.03),
        slideMat
      );
      slideChute.position.set(-0.7, 0.64, 1.36);
      slideChute.rotation.x = 0.62;
      root.add(slideChute);

      // Climbing wall with colorful holds on the back/side
      const climbRamp = new THREE.Mesh(
        new RoundedBoxGeometry(0.55, 1.42, 0.06, 2, 0.01),
        MAT.oakWood
      );
      climbRamp.position.set(-0.7, 0.62, -0.88);
      climbRamp.rotation.x = -0.38;
      root.add(climbRamp);

      // Double Swing Beam & A-Frame Legs (+X side)
      const swingBeam = new THREE.Mesh(
        new THREE.BoxGeometry(2.15, 0.095, 0.095),
        MAT.teakWood
      );
      swingBeam.position.set(0.92, 2.15, 0);
      const legA1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.085, 2.28, 0.085),
        MAT.teakWood
      );
      legA1.position.set(1.88, 1.1, -0.52);
      legA1.rotation.x = -0.22;
      const legA2 = legA1.clone();
      legA2.position.z = 0.52;
      legA2.rotation.x = 0.22;
      root.add(swingBeam, legA1, legA2);

      // 2 Swing Seats with ropes
      for (const sx of [0.55, 1.35]) {
        const seat = new THREE.Mesh(
          new RoundedBoxGeometry(0.42, 0.04, 0.18, 2, 0.01),
          MAT.terracottaCushion
        );
        seat.position.set(sx, 0.55, 0);
        for (const rx of [-0.17, 0.17]) {
          const rope = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, 1.6, 8),
            MAT.darkMetal
          );
          rope.position.set(sx + rx, 1.35, 0);
          root.add(rope);
        }
        root.add(seat);
      }
      break;
    }

    case 'garden_trampoline': {
      addContactShadow(root, 3.7, 3.7);
      const radius = 1.72;
      // Circular steel frame + blue/anthracite spring pad at y = 0.82m
      const frameRing = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.045, 14, 36),
        MAT.darkMetal
      );
      frameRing.rotation.x = Math.PI / 2;
      frameRing.position.y = 0.82;

      const padRing = new THREE.Mesh(
        new THREE.TorusGeometry(radius - 0.12, 0.14, 12, 36),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45 })
      );
      padRing.scale.set(1, 1, 0.28);
      padRing.rotation.x = Math.PI / 2;
      padRing.position.y = 0.85;

      // Jumping mat
      const jumpMat = new THREE.Mesh(
        new THREE.CylinderGeometry(radius - 0.24, radius - 0.24, 0.025, 32),
        MAT.anthracite
      );
      jumpMat.position.y = 0.82;
      root.add(frameRing, padRing, jumpMat);

      // 8 W-legs & padded safety enclosure poles
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const px = Math.cos(a) * radius;
        const pz = Math.sin(a) * radius;
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.024, 0.82, 10),
          MAT.brushedSteel
        );
        leg.position.set(px, 0.41, pz);
        const netPole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.028, 1.78, 10),
          MAT.darkMetal
        );
        netPole.position.set(px, 1.71, pz);
        root.add(leg, netPole);
      }

      // Top net fiberglass ring + semi-transparent safety net cylinder
      const topNetRing = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.025, 12, 36),
        MAT.darkMetal
      );
      topNetRing.rotation.x = Math.PI / 2;
      topNetRing.position.y = 2.58;

      const netMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius - 0.03, radius - 0.03, 1.72, 28, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          transparent: true,
          opacity: 0.28,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      netMesh.position.y = 1.71;
      root.add(topNetRing, netMesh);
      break;
    }

    case 'glass_greenhouse': {
      addContactShadow(root, 3.35, 2.55);
      const ghW = 3.15;
      const ghD = 2.35;
      const wallH = 1.55;
      const ridgeH = 2.38;

      // Anthracite foundation curb
      const baseCurb = new THREE.Mesh(
        new RoundedBoxGeometry(ghW + 0.08, 0.14, ghD + 0.08, 2, 0.01),
        MAT.anthracite
      );
      baseCurb.position.y = 0.07;
      root.add(baseCurb);

      // Corner & wall mullions
      for (const gx of [-ghW / 2, 0, ghW / 2]) {
        for (const gz of [-ghD / 2, ghD / 2]) {
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.045, wallH, 0.045),
            MAT.darkMetal
          );
          post.position.set(gx, 0.14 + wallH / 2, gz);
          root.add(post);
        }
      }

      // Glass walls (North, South, West, East)
      const sideGlassN = new THREE.Mesh(
        new THREE.BoxGeometry(ghW - 0.06, wallH - 0.06, 0.02),
        glassMat
      );
      sideGlassN.position.set(0, 0.14 + wallH / 2, -ghD / 2);
      const sideGlassS = sideGlassN.clone();
      sideGlassS.position.z = ghD / 2;
      const sideGlassW = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, wallH - 0.06, ghD - 0.06),
        glassMat
      );
      sideGlassW.position.set(-ghW / 2, 0.14 + wallH / 2, 0);
      const sideGlassE = sideGlassW.clone();
      sideGlassE.position.x = ghW / 2;
      root.add(sideGlassN, sideGlassS, sideGlassW, sideGlassE);

      // Pitched glass roof panels + ridge beam
      const slopeLen = Math.hypot(ghD / 2, ridgeH - (0.14 + wallH));
      const roofAngle = Math.atan2(ridgeH - (0.14 + wallH), ghD / 2);
      const roofPanelN = new THREE.Mesh(
        new THREE.BoxGeometry(ghW, 0.025, slopeLen),
        glassMat
      );
      roofPanelN.position.set(0, (0.14 + wallH + ridgeH) / 2, -ghD / 4);
      roofPanelN.rotation.x = roofAngle;
      const roofPanelS = roofPanelN.clone();
      roofPanelS.position.z = ghD / 4;
      roofPanelS.rotation.x = -roofAngle;

      const ridgeBeam = new THREE.Mesh(
        new THREE.BoxGeometry(ghW + 0.06, 0.055, 0.055),
        MAT.darkMetal
      );
      ridgeBeam.position.set(0, ridgeH, 0);
      root.add(roofPanelN, roofPanelS, ridgeBeam);

      // Interior wooden raised beds with lush tomato & vegetable plants
      for (const bz of [-0.68, 0.68]) {
        const planter = new THREE.Mesh(
          new RoundedBoxGeometry(2.65, 0.42, 0.58, 2, 0.01),
          MAT.teakWood
        );
        planter.position.set(0, 0.35, bz);
        root.add(planter);
        for (let px = -1.0; px <= 1.0; px += 0.5) {
          const bush = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.24, 1),
            px % 1 === 0 ? MAT.foliageLight : MAT.foliageDark
          );
          bush.position.set(px, 0.72, bz);
          root.add(bush);
        }
      }

      // Climate status LED bar at the front gable
      const statusLed = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.035, 0.04),
        indicatorMat
      );
      statusLed.position.set(0, 0.14 + wallH, ghD / 2 + 0.02);
      root.add(statusLed);
      break;
    }

    case 'electric_roller_gate': {
      const gateW = Math.max(1.6, asset.customLength ?? 3.2);
      const gateH = Math.max(1.8, asset.customHeight ?? 2.35);
      // Side guide rails (Führungsschienen)
      const railL = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, gateH, 0.14),
        MAT.anthracite
      );
      railL.position.set(-gateW / 2 + 0.045, gateH / 2, 0);
      const railR = railL.clone();
      railR.position.x = gateW / 2 - 0.045;

      // Top motorized roller box (Rolltorkasten mit Rohrmotor)
      const rollerBox = new THREE.Mesh(
        new RoundedBoxGeometry(gateW + 0.08, 0.28, 0.28, 3, 0.02),
        MAT.darkMetal
      );
      rollerBox.position.set(0, gateH + 0.1, 0);

      // Status / Warning Beacon on the top right
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.045, 0.09, 16),
        indicatorMat
      );
      beacon.position.set(gateW / 2 + 0.06, gateH + 0.12, 0.12);

      // Slatted aluminum roller curtain anchored at top inside rollerBox (rolls up without clipping!)
      const maxH = gateH - 0.04;
      const curtainPivot = new THREE.Group();
      curtainPivot.position.set(0, gateH - 0.02, 0);

      const curtainMesh = new THREE.Mesh(
        new RoundedBoxGeometry(gateW - 0.18, maxH, 0.048, 2, 0.008),
        MAT.brushedSteel
      );
      curtainMesh.position.y = -maxH / 2;
      curtainPivot.add(curtainMesh);
      for (let d = 0.2; d < maxH - 0.12; d += 0.22) {
        const slatLine = new THREE.Mesh(
          new THREE.BoxGeometry(gateW - 0.19, 0.012, 0.054),
          MAT.anthracite
        );
        slatLine.position.y = -d;
        curtainPivot.add(slatLine);
      }

      root.userData.rollerGateCurtain = curtainPivot;
      root.userData.rollerGateMaxH = maxH;
      root.add(railL, railR, rollerBox, beacon, curtainPivot);
      break;
    }

    case 'garage_door_opener_rail': {
      // Ceiling-mounted motorized drive unit (Motorblock) + steel C-rail + moving trolley
      const motorHead = new THREE.Mesh(
        new RoundedBoxGeometry(0.34, 0.15, 0.44, 4, 0.02),
        MAT.anthracite
      );
      motorHead.position.set(0, 0, -1.45);

      // Integrated LED Courtesy Light Panel on underside of motor head
      const ledPanel = new THREE.Mesh(
        new RoundedBoxGeometry(0.24, 0.025, 0.28, 2, 0.008),
        indicatorMat
      );
      ledPanel.position.set(0, -0.078, -1.45);

      // 3.0m Steel Guide Rail (Führungsschiene) extending toward garage door
      const railTrack = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, 0.038, 2.95),
        MAT.brushedSteel
      );
      railTrack.position.set(0, 0.03, 0.1);

      // Moving Belt Trolley + Curved Push Arm + Red Emergency Release Handle
      const carriageGroup = new THREE.Group();
      const trolley = new THREE.Mesh(
        new RoundedBoxGeometry(0.11, 0.065, 0.18, 2, 0.008),
        MAT.darkMetal
      );
      const pushArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.26, 0.045),
        MAT.darkMetal
      );
      pushArm.position.set(0, -0.14, 0.04);
      pushArm.rotation.x = 0.35;
      const redCordKnob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.022, 0.055, 12),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
      );
      redCordKnob.position.set(0.06, -0.22, 0);
      carriageGroup.add(trolley, pushArm, redCordKnob);
      carriageGroup.position.set(0, 0, 1.15);

      root.userData.openerCarriage = carriageGroup;
      root.add(motorHead, ledPanel, railTrack, carriageGroup);
      break;
    }

    case 'electric_sliding_driveway_gate': {
      const gateW = Math.max(2.4, asset.customLength ?? 4.2);
      const gateH = Math.max(0.9, asset.customHeight ?? 1.5);
      const slideSign = asset.gateSlideDirection === 'right' ? 1 : -1;
      addContactShadow(root, gateW + 0.6, 0.48);

      // Heavy concrete/steel drive pillar with motor housing & amber warning beacon
      const motorPillar = new THREE.Mesh(
        new RoundedBoxGeometry(0.32, gateH + 0.15, 0.32, 3, 0.015),
        MAT.anthracite
      );
      motorPillar.position.set(slideSign * (gateW / 2 + 0.18), (gateH + 0.15) / 2, 0);
      const catchPillar = new THREE.Mesh(
        new RoundedBoxGeometry(0.24, gateH + 0.15, 0.24, 3, 0.015),
        MAT.anthracite
      );
      catchPillar.position.set(-slideSign * (gateW / 2 + 0.14), (gateH + 0.15) / 2, 0);

      // External gear motor drive unit next to motor pillar
      const driveMotorBox = new THREE.Mesh(
        new RoundedBoxGeometry(0.26, 0.44, 0.22, 2, 0.012),
        MAT.darkMetal
      );
      driveMotorBox.position.set(slideSign * (gateW / 2 + 0.42), 0.22, -0.14);

      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.044, 0.05, 0.11, 16),
        indicatorMat
      );
      beacon.position.set(slideSign * (gateW / 2 + 0.18), gateH + 0.2, 0);

      // Ground steel floor track extending to the slide side
      const floorTrack = new THREE.Mesh(
        new THREE.BoxGeometry(gateW * 1.98, 0.022, 0.14),
        MAT.brushedSteel
      );
      floorTrack.position.set(slideSign * (gateW * 0.44), 0.011, 0);

      // Sliding Gate Leaf (Schiebetor-Flügel mit Lamellenfüllung & Zahnstange)
      const leafGroup = new THREE.Group();
      const frameThickness = 0.068;

      const topRail = new THREE.Mesh(
        new RoundedBoxGeometry(gateW, frameThickness, 0.075, 2, 0.01),
        MAT.darkMetal
      );
      topRail.position.y = gateH + 0.05 - frameThickness / 2;
      const botRail = new THREE.Mesh(
        new RoundedBoxGeometry(gateW + 0.45, frameThickness * 1.25, 0.085, 2, 0.01),
        MAT.darkMetal
      );
      botRail.position.set(slideSign * 0.2, 0.05 + frameThickness * 0.62, 0);
      const leftStile = new THREE.Mesh(
        new RoundedBoxGeometry(frameThickness, gateH, 0.075, 2, 0.01),
        MAT.darkMetal
      );
      leftStile.position.set(-gateW / 2 + frameThickness / 2, gateH / 2 + 0.05, 0);
      const rightStile = leftStile.clone();
      rightStile.position.x = gateW / 2 - frameThickness / 2;
      const midStile = leftStile.clone();
      midStile.position.x = 0;
      leafGroup.add(topRail, botRail, leftStile, rightStile, midStile);

      // Horizontal anthracite & oak accent louver slats inside the sliding gate leaf
      const innerH = gateH - frameThickness * 2.2;
      const slatCount = Math.max(5, Math.floor(innerH / 0.12));
      for (let i = 0; i < slatCount; i++) {
        const sy = 0.05 + frameThickness * 1.3 + ((i + 0.5) / slatCount) * innerH;
        const isAccentSlat = i === slatCount - 2 || i === slatCount - 3;
        const slat = new THREE.Mesh(
          new THREE.BoxGeometry(gateW - frameThickness * 2, 0.072, 0.042),
          isAccentSlat ? MAT.oakWood : MAT.anthracite
        );
        slat.position.y = sy;
        leafGroup.add(slat);
      }

      // Apply manual opening override if set on the asset
      if (asset.customOpenPct !== undefined) {
        leafGroup.position.x = slideSign * (asset.customOpenPct / 100) * (gateW * 0.88);
      }

      root.userData.slidingDrivewayGate = leafGroup;
      root.userData.slidingGateWidth = gateW;
      root.userData.slidingGateSign = slideSign;
      root.userData.customOpenPct = asset.customOpenPct;
      root.add(motorPillar, catchPillar, driveMotorBox, beacon, floorTrack, leafGroup);
      break;
    }

    case 'entrance_steps_plinth': {
      const w = Math.max(0.9, asset.customLength ?? 1.65);
      const plinthH = Math.max(0.12, asset.customHeight ?? 0.3);
      const stepCount = Math.max(1, Math.min(5, Math.round(plinthH / 0.15)));
      const landingD = 0.72;
      const treadD = 0.28;
      const totalD = landingD + stepCount * treadD;
      addContactShadow(root, w + 0.2, totalD + 0.2);

      // Top Entrance Landing (Podest vor der Haustür auf 30 cm Keller-Sockelhöhe)
      const landingBlock = new THREE.Mesh(
        new RoundedBoxGeometry(w, plinthH, landingD, 3, 0.012),
        MAT.travertine
      );
      landingBlock.position.set(0, plinthH / 2, -totalD / 2 + landingD / 2);
      root.add(landingBlock);

      // Steps descending forward (+Z)
      for (let i = 0; i < stepCount; i++) {
        const stepH = plinthH * ((stepCount - i) / (stepCount + 1));
        const stepBlock = new THREE.Mesh(
          new RoundedBoxGeometry(w, stepH, treadD + 0.02, 2, 0.008),
          MAT.travertine
        );
        const sz = -totalD / 2 + landingD + (i + 0.5) * treadD;
        stepBlock.position.set(0, stepH / 2, sz);
        // Dark granite anti-slip step nosing strip
        const nosing = new THREE.Mesh(
          new THREE.BoxGeometry(w - 0.04, 0.018, 0.045),
          MAT.anthracite
        );
        nosing.position.set(0, stepH + 0.002, sz + treadD / 2 - 0.025);
        root.add(stepBlock, nosing);
      }

      // Brushed stainless steel side handrails
      for (const sx of [-w / 2 + 0.05, w / 2 - 0.05]) {
        const postTop = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, 0.88, 14),
          MAT.brushedSteel
        );
        postTop.position.set(sx, plinthH + 0.44, -totalD / 2 + 0.14);
        const postBot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, 0.88, 14),
          MAT.brushedSteel
        );
        postBot.position.set(sx, 0.44, totalD / 2 - 0.08);
        const railLen = Math.hypot(totalD - 0.22, plinthH);
        const handrail = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, railLen, 14),
          MAT.brushedSteel
        );
        handrail.position.set(sx, plinthH / 2 + 0.88, -0.02);
        handrail.rotation.x = Math.PI / 2 + Math.atan2(plinthH, totalD - 0.22);
        root.add(postTop, postBot, handrail);
      }
      break;
    }

    case 'outbuilding_garden_shed': {
      addContactShadow(root, 3.4, 2.8);
      const body = new THREE.Mesh(
        new RoundedBoxGeometry(3.1, 2.25, 2.4, 3, 0.02),
        MAT.teakWood
      );
      body.position.y = 1.125;
      const roofSlab = new THREE.Mesh(
        new RoundedBoxGeometry(3.45, 0.14, 2.85, 3, 0.02),
        MAT.anthracite
      );
      roofSlab.position.set(0, 2.31, 0.1);
      const doubleDoor = new THREE.Mesh(
        new RoundedBoxGeometry(1.45, 1.95, 0.06, 2, 0.01),
        MAT.darkMetal
      );
      doubleDoor.position.set(-0.35, 0.98, 1.21);
      const sideWindow = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.85, 0.06),
        glassMat
      );
      sideWindow.position.set(0.88, 1.35, 1.21);
      root.add(body, roofSlab, doubleDoor, sideWindow);
      break;
    }

    default: {
      const fallback = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.4, 0.4, 4, 0.03), MAT.matteWhite);
      fallback.position.y = 0.2;
      root.add(fallback);
    }
  }

  enableShadows(root, true, true);
  return root;
}

export function buildOpeningGroup(opening: WallOpening, isSoftwareGl: boolean): THREE.Group {
  const group = new THREE.Group();
  group.position.set(opening.x, opening.sillHeight, opening.z);
  group.rotation.y = opening.rotationY;

  const hingeSide = opening.hingeSide || 'left';
  const openDirection = opening.openDirection || 'inward';
  const isTwoSash =
    opening.sashCount === 2 ||
    ((!opening.sashCount || opening.sashCount === 'auto') &&
      (opening.type === 'double_patio_door' || opening.width >= 1.35));

  const frameMat =
    opening.frameColor === 'white'
      ? MAT.matteWhite
      : opening.frameColor === 'oak'
      ? MAT.oakWood
      : opening.frameColor === 'walnut'
      ? MAT.walnutWood
      : opening.frameColor === 'alu_silver'
      ? MAT.brushedSteel
      : opening.frameColor === 'matte_black'
      ? MAT.darkMetal
      : opening.frameColor === 'sage_green'
      ? MAT.sageGreen
      : opening.frameColor === 'bronze_corten'
      ? MAT.bronzeCorten
      : opening.frameColor === 'burgundy_red'
      ? MAT.burgundyRed
      : MAT.anthracite;

  const designStyle = opening.openingDesign || 'modern_single';

  group.userData = {
    isInteractiveOpening: true,
    openingId: opening.id,
    entityId: opening.entityId || opening.shutterEntityId,
    tiltEntityId: opening.tiltEntityId,
    shutterEntityId: opening.shutterEntityId,
    hingeSide,
    openDirection,
  };

  const glassMat =
    designStyle === 'frosted_privacy'
      ? MAT.frostedGlass
      : createGlassMaterial(isSoftwareGl, 0xdbeafe);
  const frameDepth = 0.21;

  // Helper to add decorative window mullions / muntin bars (Sprossen / Loft-Gitter / Kämpfer) onto a window/patio sash
  const addWindowDesignBars = (targetSash: THREE.Group, paneW: number, paneH: number) => {
    if (designStyle === 'mullion_cross') {
      const vBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.024, paneH - 0.04, 0.038),
        frameMat
      );
      vBar.position.set(0, paneH / 2, 0);
      const hBar = new THREE.Mesh(
        new THREE.BoxGeometry(paneW - 0.04, 0.024, 0.038),
        frameMat
      );
      hBar.position.set(0, paneH * 0.56, 0);
      targetSash.add(vBar, hBar);
    } else if (designStyle === 'industrial_loft') {
      const vBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, paneH - 0.04, 0.038),
        MAT.darkMetal
      );
      vBar.position.set(0, paneH / 2, 0);
      targetSash.add(vBar);
      for (const frac of [0.33, 0.67]) {
        const hBar = new THREE.Mesh(
          new THREE.BoxGeometry(paneW - 0.04, 0.018, 0.038),
          MAT.darkMetal
        );
        hBar.position.set(0, paneH * frac, 0);
        targetSash.add(hBar);
      }
    } else if (designStyle === 'arched_classic') {
      const transom = new THREE.Mesh(
        new THREE.BoxGeometry(paneW - 0.03, 0.034, 0.045),
        frameMat
      );
      transom.position.set(0, paneH * 0.72, 0);
      const topMullion = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, paneH * 0.26, 0.038),
        frameMat
      );
      topMullion.position.set(0, paneH * 0.85, 0);
      targetSash.add(transom, topMullion);
    }
  };

  // Outer Frame (Blendrahmen)
  const topBar = new THREE.Mesh(
    new THREE.BoxGeometry(opening.width, 0.068, frameDepth),
    frameMat
  );
  topBar.position.y = opening.height - 0.034;

  const leftPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.068, opening.height, frameDepth),
    frameMat
  );
  leftPost.position.set(-opening.width / 2 + 0.034, opening.height / 2, 0);

  const rightPost = leftPost.clone();
  rightPost.position.x = opening.width / 2 - 0.034;
  group.add(topBar, leftPost, rightPost);

  // Bottom Frame & Inner/Outer Windowsills (Fensterbank innen & außen) for Windows
  if (opening.type === 'window' || opening.type === 'floor_window') {
    const bottomBar = new THREE.Mesh(
      new THREE.BoxGeometry(opening.width, 0.062, frameDepth),
      frameMat
    );
    bottomBar.position.y = 0.031;
    group.add(bottomBar);

    if (opening.sillHeight > 0.12) {
      const sillBoard = new THREE.Mesh(
        new RoundedBoxGeometry(opening.width + 0.14, 0.036, frameDepth + 0.14, 3, 0.008),
        MAT.travertine
      );
      sillBoard.position.set(0, -0.015, 0);
      group.add(sillBoard);
    }
  }

  const leafPivot = new THREE.Group();
  if (opening.type === 'garage_door') {
    const innerW = opening.width - 0.14;
    const innerH = opening.height - 0.08;
    const numPanels = 4;
    const panelH = innerH / numPanels;
    const dirSign = openDirection === 'outward' ? 1 : -1;
    const zTrackOffset = dirSign * 0.036;
    const panelSurfaceMat =
      designStyle === 'sectional_wood_ribbed' ? MAT.teakWood : frameMat;

    // Overhead horizontal & vertical J-track rails inside the garage
    const trackMat = MAT.brushedSteel;
    for (const sideX of [-innerW / 2 - 0.016, innerW / 2 + 0.016]) {
      const horizTrack = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.032, innerH * 0.96),
        trackMat
      );
      horizTrack.position.set(
        sideX,
        innerH - 0.035,
        zTrackOffset + dirSign * (innerH * 0.48)
      );
      group.add(horizTrack);
    }

    // 4 Articulated Sectional Panels guided by top & bottom rollers in the interior J-track
    const garagePanels: THREE.Group[] = [];
    for (let i = 0; i < numPanels; i++) {
      const pGroup = new THREE.Group();
      const baseCenterY = (i + 0.5) * panelH;
      pGroup.position.set(0, baseCenterY, zTrackOffset);
      pGroup.userData.panelIndex = i;
      pGroup.userData.baseCenterY = baseCenterY;
      pGroup.userData.panelHeight = panelH;

      const panelMesh = new RoundedBoxGeometry(innerW - 0.01, panelH - 0.014, 0.048, 2, 0.008);
      const mesh = new THREE.Mesh(panelMesh, panelSurfaceMat);
      pGroup.add(mesh);

      // Brushed aluminum horizontal trim strip
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(innerW - 0.04, 0.012, 0.054),
        MAT.brushedSteel
      );
      trim.position.y = -panelH / 2 + 0.01;
      pGroup.add(trim);

      // Vision glass slots (on all upper panels for sectional_flush_glass, or top panel for standard)
      if (designStyle === 'sectional_flush_glass' ? i >= 1 : i === numPanels - 1) {
        const slotCount = Math.max(2, Math.floor(innerW / 1.1));
        const slotW = (innerW - 0.4) / slotCount - 0.12;
        for (let s = 0; s < slotCount; s++) {
          const sx = -innerW / 2 + 0.26 + slotW / 2 + s * (slotW + 0.12);
          const visionSlot = new THREE.Mesh(
            new THREE.BoxGeometry(
              slotW,
              panelH * (designStyle === 'sectional_flush_glass' ? 0.68 : 0.42),
              0.056
            ),
            glassMat
          );
          visionSlot.position.set(sx, 0.01, 0);
          pGroup.add(visionSlot);
        }
      }

      leafPivot.add(pGroup);
      garagePanels.push(pGroup);
    }

    group.userData.garageGate = leafPivot;
    group.userData.garagePanels = garagePanels;
    group.userData.garageInnerH = innerH;
    group.userData.garageOpenProgress = 0;
    group.add(leafPivot);
  } else if (opening.type === 'door') {
    const hingeSign = hingeSide === 'right' ? 1 : -1;
    const panelW = opening.width - 0.12;
    const panelH = opening.height - 0.06;
    const doorCenterX = -hingeSign * (panelW / 2);

    // Place hinge pivot at the left (-w/2) or right (+w/2) jamb
    leafPivot.position.set(hingeSign * (opening.width / 2 - 0.06), 0, 0);

    const doorBaseMat =
      opening.frameColor === 'white'
        ? MAT.matteWhite
        : opening.frameColor === 'anthracite'
        ? MAT.anthracite
        : opening.frameColor === 'walnut'
        ? MAT.walnutWood
        : opening.frameColor === 'alu_silver'
        ? MAT.brushedSteel
        : opening.frameColor === 'matte_black'
        ? MAT.darkMetal
        : opening.frameColor === 'sage_green'
        ? MAT.sageGreen
        : opening.frameColor === 'bronze_corten'
        ? MAT.bronzeCorten
        : opening.frameColor === 'burgundy_red'
        ? MAT.burgundyRed
        : MAT.oakWood;

    if (designStyle === 'full_glass_office') {
      // Loft / Office Full-Glass Door with perimeter frame
      const glassLeaf = new THREE.Mesh(
        new THREE.BoxGeometry(panelW - 0.12, panelH - 0.12, 0.028),
        glassMat
      );
      glassLeaf.position.set(doorCenterX, panelH / 2, 0);
      const stileL = new THREE.Mesh(
        new RoundedBoxGeometry(0.065, panelH, 0.058, 2, 0.008),
        doorBaseMat
      );
      stileL.position.set(doorCenterX - panelW / 2 + 0.032, panelH / 2, 0);
      const stileR = stileL.clone();
      stileR.position.x = doorCenterX + panelW / 2 - 0.032;
      const railT = new THREE.Mesh(
        new RoundedBoxGeometry(panelW, 0.065, 0.058, 2, 0.008),
        doorBaseMat
      );
      railT.position.set(doorCenterX, panelH - 0.032, 0);
      const railB = railT.clone();
      railB.position.y = 0.032;
      leafPivot.add(glassLeaf, stileL, stileR, railT, railB);
    } else {
      const doorPanel = new THREE.Mesh(
        new RoundedBoxGeometry(panelW, panelH, 0.058, 3, 0.012),
        doorBaseMat
      );
      doorPanel.position.set(doorCenterX, panelH / 2, 0);
      leafPivot.add(doorPanel);

      if (designStyle === 'entrance_glass_sidelight') {
        // Modern Entrance Door with Vertical Frosted Vision Glass Insert & Stainless Trim
        const visionStrip = new THREE.Mesh(
          new THREE.BoxGeometry(Math.min(0.22, panelW * 0.26), panelH * 0.72, 0.064),
          MAT.frostedGlass
        );
        visionStrip.position.set(doorCenterX, panelH * 0.52, 0);
        const steelBorder = new THREE.Mesh(
          new THREE.BoxGeometry(Math.min(0.26, panelW * 0.3), panelH * 0.75, 0.061),
          MAT.brushedSteel
        );
        steelBorder.position.set(doorCenterX, panelH * 0.52, 0);
        leafPivot.add(steelBorder, visionStrip);
      } else if (designStyle === 'entrance_wood_slats') {
        // Architectural Entrance Door with Vertical Acoustic Oak Slats
        const slatCount = Math.max(4, Math.floor((panelW - 0.24) / 0.065));
        for (let s = 0; s < slatCount; s++) {
          const sx =
            doorCenterX -
            (panelW - 0.28) / 2 +
            (s / Math.max(1, slatCount - 1)) * (panelW - 0.28);
          const slat = new THREE.Mesh(
            new THREE.BoxGeometry(0.032, panelH - 0.14, 0.066),
            MAT.oakWood
          );
          slat.position.set(sx, panelH / 2, 0);
          leafPivot.add(slat);
        }
      } else if (designStyle === 'classic_panel_cottage') {
        // Classic Landhaus / Cottage Panel Door with upper window & lower cassette panel
        const upperGlass = new THREE.Mesh(
          new RoundedBoxGeometry(panelW * 0.56, panelH * 0.32, 0.064, 2, 0.008),
          glassMat
        );
        upperGlass.position.set(doorCenterX, panelH * 0.72, 0);
        const crossV = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, panelH * 0.32, 0.068),
          doorBaseMat
        );
        crossV.position.set(doorCenterX, panelH * 0.72, 0);
        const crossH = new THREE.Mesh(
          new THREE.BoxGeometry(panelW * 0.56, 0.02, 0.068),
          doorBaseMat
        );
        crossH.position.set(doorCenterX, panelH * 0.72, 0);
        const lowerCassette = new THREE.Mesh(
          new RoundedBoxGeometry(panelW * 0.58, panelH * 0.34, 0.066, 2, 0.008),
          doorBaseMat
        );
        lowerCassette.position.set(doorCenterX, panelH * 0.28, 0);
        leafPivot.add(upperGlass, crossV, crossH, lowerCassette);
      }
    }

    // Door handle on the opposite side of the hinge (Long Stainless Bar Pull for Entrance designs, Lever for standard)
    const handleX = -hingeSign * (panelW - 0.12);
    const handleY = Math.min(1.03, panelH * 0.5);
    const handlePivot = new THREE.Group();
    handlePivot.position.set(handleX, handleY + 0.02, 0);

    if (
      designStyle === 'entrance_glass_sidelight' ||
      designStyle === 'entrance_wood_slats'
    ) {
      // 1.15m Vertical Stainless Steel Bar Handle (Stoßgriff / Stangengriff)
      const barPull = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, Math.min(1.18, panelH * 0.58), 16),
        MAT.brushedSteel
      );
      barPull.position.set(handleX, panelH * 0.5, 0.048);
      const barPullBack = barPull.clone();
      barPullBack.position.z = -0.048;
      leafPivot.add(barPull, barPullBack, handlePivot);
    } else {
      const handlePlate = new THREE.Mesh(
        new RoundedBoxGeometry(0.04, 0.18, 0.075, 2, 0.006),
        MAT.brushedSteel
      );
      handlePlate.position.set(handleX, handleY, 0);
      const lever = new THREE.Mesh(
        new RoundedBoxGeometry(0.13, 0.022, 0.13, 2, 0.005),
        MAT.brushedSteel
      );
      lever.position.set(hingeSign * 0.045, 0, 0);
      handlePivot.add(lever);
      leafPivot.add(handlePlate, handlePivot);
    }

    // Subtle 3D Hinge Knuckles (Türbänder) on the hinge side
    for (const hy of [0.32, panelH - 0.28]) {
      const knuckle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.09, 10),
        MAT.brushedSteel
      );
      knuckle.position.set(0, hy, openDirection === 'inward' ? -0.032 : 0.032);
      leafPivot.add(knuckle);
    }

    group.userData.swingDoor = leafPivot;
    group.userData.doorHandlePivot = handlePivot;
    group.add(leafPivot);
  } else if (opening.type === 'double_patio_door') {
    const innerW = opening.width - 0.136;
    const innerH = opening.height - 0.12;
    const halfLeafW = innerW / 2 + 0.02;
    const slideDir = hingeSide === 'right' ? -1 : 1;

    // Fixed leaf
    const fixedGroup = new THREE.Group();
    fixedGroup.position.set(slideDir * (innerW / 4), 0.06, -0.02);
    const fixedPane = new THREE.Mesh(
      new THREE.BoxGeometry(halfLeafW, innerH, 0.026),
      glassMat
    );
    fixedPane.position.y = innerH / 2;
    const fixedFrameTop = new THREE.Mesh(
      new THREE.BoxGeometry(halfLeafW, 0.045, 0.055),
      frameMat
    );
    fixedFrameTop.position.y = innerH - 0.02;
    const fixedFrameBot = fixedFrameTop.clone();
    fixedFrameBot.position.y = 0.02;
    fixedGroup.add(fixedPane, fixedFrameTop, fixedFrameBot);
    addWindowDesignBars(fixedGroup, halfLeafW, innerH);
    group.add(fixedGroup);

    // Movable sliding leaf (Hebeschiebetür)
    const slidingGroup = new THREE.Group();
    slidingGroup.position.set(-slideDir * (innerW / 4), 0.06, 0.022);
    const slidePane = new THREE.Mesh(
      new THREE.BoxGeometry(halfLeafW, innerH, 0.026),
      glassMat
    );
    slidePane.position.y = innerH / 2;
    const slideFrameTop = fixedFrameTop.clone();
    const slideFrameBot = fixedFrameBot.clone();
    const centerStile = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, innerH, 0.06),
      frameMat
    );
    centerStile.position.set(slideDir * (halfLeafW / 2 - 0.025), innerH / 2, 0);
    const leftStile = centerStile.clone();
    leftStile.position.x = -slideDir * (halfLeafW / 2 - 0.025);

    const patioHandlePivot = new THREE.Group();
    patioHandlePivot.position.set(-slideDir * (halfLeafW / 2 - 0.08), innerH * 0.48, 0);
    const patioHandle = new THREE.Mesh(
      new RoundedBoxGeometry(0.026, 0.22, 0.095, 2, 0.005),
      MAT.brushedSteel
    );
    patioHandle.position.y = -0.06;
    patioHandlePivot.add(patioHandle);

    slidingGroup.add(
      slidePane,
      slideFrameTop,
      slideFrameBot,
      centerStile,
      leftStile,
      patioHandlePivot
    );
    addWindowDesignBars(slidingGroup, halfLeafW, innerH);
    group.userData.slidingPane = slidingGroup;
    group.userData.patioHandlePivot = patioHandlePivot;
    group.userData.slidingBaseX = -slideDir * (innerW / 4);
    group.userData.slidingDir = slideDir;
    group.add(slidingGroup);
  } else {
    // Standard or Floor-to-Ceiling Window (supports 14° Tilt AND 1- or 2-Sash Swing Open!)
    const innerW = opening.width - 0.136;
    const innerH = opening.height - 0.12;
    const hingeSign = hingeSide === 'right' ? 1 : -1;

    // Tilt Pivot at bottom of window frame (for 14° Kipp-Stellung)
    const tiltPivot = new THREE.Group();
    tiltPivot.position.set(0, 0.06, 0);

    if (isTwoSash) {
      const halfW = innerW / 2;
      // Left Sash Pivot (hinged on left outer frame at -innerW / 2)
      const leftSwingPivot = new THREE.Group();
      leftSwingPivot.position.set(-innerW / 2, 0, 0);
      const leftSash = new THREE.Group();
      leftSash.position.set(halfW / 2, 0, 0);

      const paneL = new THREE.Mesh(
        new THREE.BoxGeometry(halfW - 0.01, innerH, 0.028),
        glassMat
      );
      paneL.position.y = innerH / 2;
      const topL = new THREE.Mesh(
        new THREE.BoxGeometry(halfW, 0.042, 0.068),
        frameMat
      );
      topL.position.y = innerH - 0.021;
      const botL = topL.clone();
      botL.position.y = 0.021;
      const stL = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, innerH, 0.068),
        frameMat
      );
      stL.position.set(-halfW / 2 + 0.021, innerH / 2, 0);
      const stCenterL = stL.clone();
      stCenterL.position.x = halfW / 2 - 0.021;
      leftSash.add(paneL, topL, botL, stL, stCenterL);
      addWindowDesignBars(leftSash, halfW, innerH);
      leftSwingPivot.add(leftSash);

      // Right Sash Pivot (hinged on right outer frame at +innerW / 2)
      const rightSwingPivot = new THREE.Group();
      rightSwingPivot.position.set(innerW / 2, 0, 0);
      const rightSash = new THREE.Group();
      rightSash.position.set(-halfW / 2, 0, 0);

      const paneR = paneL.clone();
      const topR = topL.clone();
      const botR = botL.clone();
      const stR = stL.clone();
      stR.position.x = halfW / 2 - 0.021;
      const stCenterR = stL.clone();
      stCenterR.position.x = -halfW / 2 + 0.021;

      const winHandlePivot = new THREE.Group();
      winHandlePivot.position.set(-halfW / 2 + 0.032, innerH * 0.48, 0);
      const winHandle = new THREE.Mesh(
        new RoundedBoxGeometry(0.022, 0.12, 0.11, 2, 0.005),
        MAT.brushedSteel
      );
      winHandle.position.y = -0.04;
      winHandlePivot.add(winHandle);

      rightSash.add(paneR, topR, botR, stR, stCenterR, winHandlePivot);
      addWindowDesignBars(rightSash, halfW, innerH);
      rightSwingPivot.add(rightSash);

      tiltPivot.add(leftSwingPivot, rightSwingPivot);
      leafPivot.add(tiltPivot);
      group.userData.tiltPivot = tiltPivot;
      // Primary swing pivot follows hingeSide, secondary swings symmetrically
      group.userData.windowSwingPivot =
        hingeSide === 'right' ? rightSwingPivot : leftSwingPivot;
      group.userData.windowSwingPivotSecondary =
        hingeSide === 'right' ? leftSwingPivot : rightSwingPivot;
      group.userData.winHandlePivot = winHandlePivot;
      group.add(leafPivot);
    } else {
      // Single-Sash Window (Dreh-Kipp)
      const windowSwingPivot = new THREE.Group();
      windowSwingPivot.position.set(hingeSign * (innerW / 2), 0, 0);

      const sashContainer = new THREE.Group();
      sashContainer.position.set(-hingeSign * (innerW / 2), 0, 0);

      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(innerW, innerH, 0.028),
        glassMat
      );
      pane.position.y = innerH / 2;
      sashContainer.add(pane);

      const sashTop = new THREE.Mesh(
        new THREE.BoxGeometry(innerW, 0.042, 0.068),
        frameMat
      );
      sashTop.position.y = innerH - 0.021;
      const sashBot = sashTop.clone();
      sashBot.position.y = 0.021;
      const sashLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, innerH, 0.068),
        frameMat
      );
      sashLeft.position.set(-innerW / 2 + 0.021, innerH / 2, 0);
      const sashRight = sashLeft.clone();
      sashRight.position.x = innerW / 2 - 0.021;
      sashContainer.add(sashTop, sashBot, sashLeft, sashRight);
      addWindowDesignBars(sashContainer, innerW, innerH);

      const winHandlePivot = new THREE.Group();
      winHandlePivot.position.set(-hingeSign * (innerW / 2 - 0.045), innerH * 0.48, 0);
      const winHandle = new THREE.Mesh(
        new RoundedBoxGeometry(0.022, 0.12, 0.11, 2, 0.005),
        MAT.brushedSteel
      );
      winHandle.position.y = -0.04;
      winHandlePivot.add(winHandle);
      sashContainer.add(winHandlePivot);

      windowSwingPivot.add(sashContainer);
      tiltPivot.add(windowSwingPivot);
      leafPivot.add(tiltPivot);
      group.userData.tiltPivot = tiltPivot;
      group.userData.windowSwingPivot = windowSwingPivot;
      group.userData.winHandlePivot = winHandlePivot;
      group.add(leafPivot);
    }
  }

  if (opening.shutterEntityId) {
    // Place shutter housing & guide rails on the exterior side opposite to the window sash swing/tilt
    const extSign = openDirection === 'inward' ? -1 : 1;
    const shutterZ = extSign * (frameDepth / 2 - 0.012);
    const maxH = Math.max(0.2, opening.height - 0.072);
    const topAnchorY = opening.height - 0.036;

    const headerBox = new THREE.Mesh(
      new RoundedBoxGeometry(opening.width - 0.02, 0.11, 0.085, 3, 0.012),
      frameMat
    );
    headerBox.position.set(0, opening.height - 0.02, shutterZ);
    group.add(headerBox);

    // Side shutter guide channels (Rollladen-Führungsschienen)
    for (const sx of [-opening.width / 2 + 0.048, opening.width / 2 - 0.048]) {
      const guideRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, maxH, 0.042),
        frameMat
      );
      guideRail.position.set(sx, topAnchorY - maxH / 2, shutterZ);
      group.add(guideRail);
    }

    // Top-anchored shutter curtain group so scaling Y rolls it cleanly into headerBox without clipping!
    const shutterPivot = new THREE.Group();
    shutterPivot.position.set(0, topAnchorY, shutterZ);

    const shutterBody = new THREE.Mesh(
      new THREE.BoxGeometry(opening.width - 0.11, maxH, 0.022),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.42, metalness: 0.58 })
    );
    shutterBody.position.y = -maxH / 2;
    shutterPivot.add(shutterBody);

    // Subtle horizontal roller-shutter slat lines
    const slatCount = Math.min(18, Math.max(4, Math.floor(maxH / 0.095)));
    for (let s = 1; s < slatCount; s++) {
      const sy = -(s / slatCount) * maxH;
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(opening.width - 0.115, 0.008, 0.026),
        MAT.anthracite
      );
      slat.position.y = sy;
      shutterPivot.add(slat);
    }

    group.add(shutterPivot);
    group.userData.shutterMesh = shutterPivot;
    group.userData.maxShutterHeight = maxH;
    group.userData.shutterTopAnchorY = topAnchorY;
  }

  // Optional Exterior Front-Door Steps & Landing (e.g. when Kellergeschoss protrudes 30 cm above ground!)
  if (
    opening.hasExteriorSteps &&
    (opening.type === 'door' || opening.type === 'double_patio_door')
  ) {
    const plinthH = THREE.MathUtils.clamp(opening.exteriorPlinthHeight ?? 0.3, 0.12, 1.2);
    const stepCount = Math.round(THREE.MathUtils.clamp(opening.exteriorStepsCount ?? 2, 1, 6));
    const stepW = Math.max(opening.width + 0.36, opening.exteriorStepsWidth ?? opening.width + 0.45);
    const totalD = THREE.MathUtils.clamp(opening.exteriorStepsDepth ?? 1.15, 0.65, 2.4);
    const landingD = Math.max(0.42, totalD * 0.48);
    const treadD = (totalD - landingD) / Math.max(1, stepCount);
    const extSign = openDirection === 'inward' ? 1 : -1;

    const stepMat =
      opening.exteriorStepsMaterial === 'anthracite'
        ? MAT.anthracite
        : opening.exteriorStepsMaterial === 'wood'
        ? MAT.teakWood
        : opening.exteriorStepsMaterial === 'granite'
        ? new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.62, metalness: 0.08 })
        : MAT.travertine;

    const stepsGroup = new THREE.Group();
    // Top landing flush with the door threshold (y = 0 at door sill, descending to y = -plinthH on the exterior)
    const landingMesh = new THREE.Mesh(
      new RoundedBoxGeometry(stepW, plinthH, landingD, 3, 0.01),
      stepMat
    );
    landingMesh.position.set(
      0,
      -plinthH / 2,
      extSign * (frameDepth / 2 + landingD / 2)
    );
    stepsGroup.add(landingMesh);

    for (let i = 0; i < stepCount; i++) {
      const stepH = plinthH * ((stepCount - i) / (stepCount + 1));
      const sz = extSign * (frameDepth / 2 + landingD + (i + 0.5) * treadD);
      const stepMesh = new THREE.Mesh(
        new RoundedBoxGeometry(stepW, stepH, treadD + 0.02, 2, 0.008),
        stepMat
      );
      stepMesh.position.set(0, -plinthH + stepH / 2, sz);
      stepsGroup.add(stepMesh);
    }

    const railMode = opening.exteriorStepsRailing || 'none';
    const railSides: number[] = [];
    if (railMode === 'both' || railMode === 'left') railSides.push(-1);
    if (railMode === 'both' || railMode === 'right') railSides.push(1);
    for (const sSign of railSides) {
      const rx = sSign * (stepW / 2 - 0.045);
      const post1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.86, 12),
        MAT.brushedSteel
      );
      post1.position.set(rx, 0.43, extSign * (frameDepth / 2 + 0.14));
      const post2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.86, 12),
        MAT.brushedSteel
      );
      post2.position.set(rx, -plinthH + 0.43, extSign * (frameDepth / 2 + totalD - 0.08));
      const rLen = Math.hypot(totalD - 0.2, plinthH);
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, rLen, 12),
        MAT.brushedSteel
      );
      bar.position.set(rx, -plinthH / 2 + 0.86, extSign * (frameDepth / 2 + totalD / 2));
      bar.rotation.x = Math.PI / 2 + extSign * Math.atan2(plinthH, totalD - 0.2);
      stepsGroup.add(post1, post2, bar);
    }

    group.add(stepsGroup);
  }

  enableShadows(group, true, true);
  return group;
}

export function updateAssetVisualState(
  assetGroup: THREE.Group,
  entity: HAEntityState | undefined,
  showSensorCones: boolean,
  elapsedTime: number,
  dimFactor = 1.0,
  dt = 0.016
): boolean {
  let isAssetAnimating = false;
  const indicatorMat = assetGroup.userData.indicatorMat as THREE.MeshStandardMaterial | undefined;
  const sensorCone = assetGroup.userData.sensorCone as THREE.Mesh | undefined;
  const waterSpray = assetGroup.userData.waterSpray as THREE.Group | undefined;
  const volumetricBeamMat = assetGroup.userData.volumetricBeamMat as THREE.MeshBasicMaterial | undefined;
  const lightPoolMat = assetGroup.userData.lightPoolMat as THREE.MeshBasicMaterial | undefined;
  const volumetricBeamMesh = assetGroup.userData.volumetricBeamMesh as THREE.Mesh | undefined;
  const lightPoolMesh = assetGroup.userData.lightPoolMesh as THREE.Mesh | undefined;
  const rollerGateCurtain = assetGroup.userData.rollerGateCurtain as THREE.Group | undefined;
  const openerCarriage = assetGroup.userData.openerCarriage as THREE.Group | undefined;
  const slidingDrivewayGate = assetGroup.userData.slidingDrivewayGate as THREE.Group | undefined;

  if (sensorCone) {
    sensorCone.visible = showSensorCones;
  }

  if (!entity) {
    if (waterSpray) waterSpray.visible = false;
    if (volumetricBeamMesh) volumetricBeamMesh.visible = false;
    if (lightPoolMesh) lightPoolMesh.visible = false;
    return false;
  }

  // Smoothly Animate Electric Roller Gate, Ceiling Garage Door Opener Carriage & Sliding Driveway Gate
  if (entity.domain === 'cover') {
    const isCoverOpen = entity.state === 'open' || (entity.attributes.current_position ?? 0) > 20;
    const openRatio =
      entity.attributes.current_position !== undefined
        ? entity.attributes.current_position / 100
        : isCoverOpen
        ? 1.0
        : 0.0;

    if (rollerGateCurtain) {
      const targetScaleY = Math.max(0.05, 1 - openRatio * 0.94);
      if (Math.abs(rollerGateCurtain.scale.y - targetScaleY) > 0.002) {
        rollerGateCurtain.scale.y = THREE.MathUtils.damp(
          rollerGateCurtain.scale.y,
          targetScaleY,
          5.5,
          dt
        );
        isAssetAnimating = true;
      }
    }

    if (openerCarriage) {
      // Trolley glides smoothly along the 3m ceiling rail from z = +1.25 (closed) to z = -0.85 (open)
      const targetZ = 1.25 - openRatio * 2.1;
      if (Math.abs(openerCarriage.position.z - targetZ) > 0.002) {
        openerCarriage.position.z = THREE.MathUtils.damp(
          openerCarriage.position.z,
          targetZ,
          5.5,
          dt
        );
        isAssetAnimating = true;
      }
    }

    if (slidingDrivewayGate) {
      const gateW = assetGroup.userData.slidingGateWidth || 4.0;
      const slideSign = assetGroup.userData.slidingGateSign ?? -1;
      const manualPct = assetGroup.userData.customOpenPct;
      const effectiveRatio = manualPct !== undefined ? manualPct / 100 : openRatio;
      const targetX = slideSign * effectiveRatio * (gateW * 0.88);
      if (Math.abs(slidingDrivewayGate.position.x - targetX) > 0.002) {
        slidingDrivewayGate.position.x = THREE.MathUtils.damp(
          slidingDrivewayGate.position.x,
          targetX,
          5.0,
          dt
        );
        isAssetAnimating = true;
      }
    }
  }

  if (waterSpray) {
    const isValveOpen = entity.state === 'open' || entity.state === 'on';
    waterSpray.visible = isValveOpen;
    if (isValveOpen) {
      waterSpray.rotation.y = elapsedTime * 2.4;
      const pulse = 0.92 + Math.sin(elapsedTime * 8) * 0.08;
      waterSpray.scale.set(pulse, 1, pulse);
      isAssetAnimating = true;
    }
  }

  if (!indicatorMat) return isAssetAnimating;

  if (
    entity.attributes.device_class === 'smoke' ||
    entity.attributes.device_class === 'moisture'
  ) {
    const isAlarm =
      entity.state === 'detected' ||
      entity.state === 'on' ||
      Boolean(entity.attributes.alarm_test_active);
    if (isAlarm) {
      const flash = Math.sin(elapsedTime * 14) > 0 ? 4.2 : 0.4;
      indicatorMat.color.setHex(0xef4444);
      indicatorMat.emissive.setHex(0xef4444);
      indicatorMat.emissiveIntensity = flash;
      if (sensorCone) sensorCone.visible = true;
      isAssetAnimating = true;
    } else {
      indicatorMat.color.setHex(0x10b981);
      indicatorMat.emissive.setHex(0x10b981);
      indicatorMat.emissiveIntensity = 0.95 * dimFactor;
    }
    return isAssetAnimating;
  }

  if (entity.domain === 'light') {
    const isOn = entity.state === 'on';
    if (isOn) {
      const [r, g, b] = entity.attributes.rgb_color || [255, 214, 153];
      const brightnessRatio = ((entity.attributes.brightness ?? 255) / 255) * dimFactor;
      indicatorMat.color.setRGB(r / 255, g / 255, b / 255);
      indicatorMat.emissive.setRGB(r / 255, g / 255, b / 255);
      indicatorMat.emissiveIntensity = (1.15 + brightnessRatio * 1.65) * dimFactor;

      if (volumetricBeamMesh && volumetricBeamMat) {
        volumetricBeamMesh.visible = dimFactor > 0.2;
        volumetricBeamMat.color.setRGB(r / 255, g / 255, b / 255);
        volumetricBeamMat.opacity = 0.38 * brightnessRatio;
      }
      if (lightPoolMesh && lightPoolMat) {
        lightPoolMesh.visible = dimFactor > 0.2;
        lightPoolMat.color.setRGB(r / 255, g / 255, b / 255);
        lightPoolMat.opacity = 0.34 * brightnessRatio;
      }
    } else {
      indicatorMat.color.setHex(0x475569);
      indicatorMat.emissive.setHex(0x000000);
      indicatorMat.emissiveIntensity = 0;
      if (volumetricBeamMesh) volumetricBeamMesh.visible = false;
      if (lightPoolMesh) lightPoolMesh.visible = false;
    }
    return isAssetAnimating;
  }

  const isActive =
    entity.state === 'on' ||
    entity.state === 'cleaning' ||
    entity.state === 'open' ||
    entity.state === 'detected' ||
    entity.state === 'heat' ||
    entity.state === 'playing' ||
    entity.state === 'streaming' ||
    entity.state === 'armed_home' ||
    entity.state === 'armed_away';

  if (isActive) {
    const activeHex =
      entity.domain === 'climate' || entity.domain === 'cover'
        ? 0xf59e0b
        : entity.domain === 'alarm_control_panel'
        ? 0x0ea5e9
        : 0x10b981;
    indicatorMat.color.setHex(activeHex);
    indicatorMat.emissive.setHex(activeHex);
    indicatorMat.emissiveIntensity = 1.65 * dimFactor;
  } else {
    indicatorMat.color.setHex(0x475569);
    indicatorMat.emissive.setHex(0x0f172a);
    indicatorMat.emissiveIntensity = 0.12;
  }
  return isAssetAnimating;
}

interface SlopeHoleRect {
  x: number;
  z: number;
  w: number;
  l: number;
}

/**
 * Builds a roof slope slab geometry (`widthX` along ridge, `thicknessY` thick, `slopeLenZ` along slope)
 * with rectangular 3D holes punched through at every skylight & dormer position so skylights are 100% see-through.
 */
function createRoofSlopeGeometryWithHoles(
  widthX: number,
  thicknessY: number,
  slopeLenZ: number,
  holes: SlopeHoleRect[]
): THREE.BufferGeometry {
  if (!holes || holes.length === 0) {
    return new THREE.BoxGeometry(widthX, thicknessY, slopeLenZ);
  }

  const halfW = widthX / 2;
  const halfL = slopeLenZ / 2;
  const margin = 0.08;

  // Filter and clamp valid non-overlapping holes in 2D shape space (u = x, v = -z)
  const accepted: { minU: number; maxU: number; minV: number; maxV: number }[] = [];
  for (const h of holes) {
    const minU = Math.max(-halfW + margin, h.x - h.w / 2);
    const maxU = Math.min(halfW - margin, h.x + h.w / 2);
    const centerV = -h.z;
    const minV = Math.max(-halfL + margin, centerV - h.l / 2);
    const maxV = Math.min(halfL - margin, centerV + h.l / 2);
    if (maxU - minU < 0.18 || maxV - minV < 0.18) continue;

    // Skip if overlapping an already accepted hole to keep triangulation watertight
    const overlaps = accepted.some(
      (a) =>
        !(
          maxU + 0.04 <= a.minU ||
          minU - 0.04 >= a.maxU ||
          maxV + 0.04 <= a.minV ||
          minV - 0.04 >= a.maxV
        )
    );
    if (!overlaps) {
      accepted.push({ minU, maxU, minV, maxV });
    }
  }

  if (accepted.length === 0) {
    return new THREE.BoxGeometry(widthX, thicknessY, slopeLenZ);
  }

  const shape = new THREE.Shape();
  shape.moveTo(-halfW, -halfL);
  shape.lineTo(halfW, -halfL);
  shape.lineTo(halfW, halfL);
  shape.lineTo(-halfW, halfL);
  shape.closePath();

  for (const rect of accepted) {
    const holePath = new THREE.Path();
    holePath.moveTo(rect.minU, rect.minV);
    holePath.lineTo(rect.minU, rect.maxV);
    holePath.lineTo(rect.maxU, rect.maxV);
    holePath.lineTo(rect.maxU, rect.minV);
    holePath.closePath();
    shape.holes.push(holePath);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thicknessY,
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -thicknessY / 2, 0);
  geo.computeVertexNormals();
  return geo;
}

export interface BuildRoofOptions {
  /** When true, indoor room walls on 1. OG / DG already render the Kniestock & lower Giebel walls with window cutouts */
  hasUpperFloorRoomsInsideRoof?: boolean;
  /** When true (e.g. when viewing 1. OG or DG in focus), renders main roof slopes as a translucent cutaway shell so rooms inside the roof remain clearly visible while showing roof geometry & solid dormers/skylights */
  floorFocusCutaway?: boolean;
}

/**
 * Evaluates the exact roof underside height (relative to the roof's base plane `roofBaseY`)
 * at a given world coordinate `(worldX, worldZ)` for a `hostZone`.
 * Returns `null` if `(worldX, worldZ)` is outside the roof's footprint.
 */
export function evaluateRoofUndersideHeight(
  hostZone: FloorplanZone,
  worldX: number,
  worldZ: number
): number | null {
  const cfg = hostZone.roofConfig;
  if (!cfg || cfg.type === 'none') return null;

  const rot = -(hostZone.rotationY ?? 0);
  const dx = worldX - hostZone.x;
  const dz = worldZ - hostZone.z;
  const lx = dx * Math.cos(rot) + dz * Math.sin(rot);
  const lz = -dx * Math.sin(rot) + dz * Math.cos(rot);

  if (
    Math.abs(lx) > hostZone.width / 2 + 0.45 ||
    Math.abs(lz) > hostZone.depth / 2 + 0.45
  ) {
    return null;
  }

  const ridgeAlongX = (cfg.ridgeDirection || 'x') === 'x';
  const wallSpan = Math.max(0.8, ridgeAlongX ? hostZone.depth : hostZone.width);
  const wallLen = Math.max(0.8, ridgeAlongX ? hostZone.width : hostZone.depth);

  const cx = ridgeAlongX ? lx : -lz;
  const cz = ridgeAlongX ? lz : lx;

  const eavesOverhang = THREE.MathUtils.clamp(cfg.overhang ?? 0.35, 0, 1.25);
  const gableOverhang = THREE.MathUtils.clamp(
    cfg.gableOverhang ?? cfg.overhang ?? 0.25,
    0,
    1.25
  );

  const span = Math.max(1.2, wallSpan + eavesOverhang * 2);
  const length = Math.max(1.2, wallLen + gableOverhang * 2);
  const halfSpan = span / 2;
  const halfLen = length / 2;

  const pitchRad = THREE.MathUtils.degToRad(
    THREE.MathUtils.clamp(cfg.pitchDeg ?? 35, 8, 60)
  );
  const spanMode = cfg.roofSpanMode || 'single_floor';

  const kniestockH =
    cfg.type === 'flat'
      ? 0
      : THREE.MathUtils.clamp(
          cfg.kniestockHeight ?? (spanMode !== 'single_floor' ? 0.75 : 0.65),
          0,
          1.85
        );

  const spitzbodenH = THREE.MathUtils.clamp(cfg.spitzbodenHeight ?? 2.75, 2.1, 3.2);
  const rawRidgeH = halfSpan * Math.tan(pitchRad);

  const ridgeH =
    cfg.type === 'flat'
      ? 0.22
      : spanMode === 'og_and_dg_in_roof'
      ? Math.min(7.5, Math.max(rawRidgeH, spitzbodenH + 1.95 - kniestockH))
      : spanMode === 'og_in_roof'
      ? Math.min(6.2, Math.max(rawRidgeH, 2.65 - kniestockH))
      : Math.min(5.5, Math.max(0.55, rawRidgeH));

  const ySlopeBase = 0.04 + kniestockH;

  let yRoof = ySlopeBase + ridgeH;

  if (cfg.type === 'flat') {
    return 2.65;
  } else if (cfg.type === 'gable') {
    const tSpan = Math.min(1, Math.abs(cz) / Math.max(0.2, halfSpan));
    yRoof = ySlopeBase + ridgeH * (1 - tSpan);
  } else if (cfg.type === 'hipped' || cfg.type === 'tent') {
    const ridgeRun = cfg.type === 'tent' ? 0 : Math.max(0, halfLen - halfSpan);
    const tZ = Math.abs(cz) / Math.max(0.2, halfSpan);
    const tX =
      Math.max(0, Math.abs(cx) - ridgeRun) / Math.max(0.2, halfLen - ridgeRun);
    const tHip = Math.min(1, Math.max(tZ, tX));
    yRoof = ySlopeBase + ridgeH * (1 - tHip);
  } else if (cfg.type === 'mono_pitch') {
    const monoH = Math.min(4.2, span * Math.tan(pitchRad * 0.65));
    const tMono = THREE.MathUtils.clamp((halfSpan - cz) / Math.max(0.2, span), 0, 1);
    yRoof = ySlopeBase + monoH * tMono;
  } else if (cfg.type === 'mansard') {
    const lowerH = ridgeH * 0.65;
    const upperH = ridgeH * 0.35;
    const breakZ = halfSpan * 0.62;
    const absCz = Math.abs(cz);
    if (absCz <= breakZ) {
      yRoof = ySlopeBase + lowerH + upperH * (1 - absCz / Math.max(0.1, breakZ));
    } else {
      const tLow = Math.min(
        1,
        (absCz - breakZ) / Math.max(0.1, halfSpan - breakZ)
      );
      yRoof = ySlopeBase + lowerH * (1 - tLow);
    }
  } else if (cfg.type === 'barrel') {
    const scaleY = Math.min(1.0, (ridgeH / Math.max(0.2, halfSpan)) * 0.85);
    const clampedZ = Math.min(halfSpan, Math.abs(cz));
    yRoof =
      ySlopeBase +
      Math.sqrt(Math.max(0, halfSpan * halfSpan - clampedZ * clampedZ)) * scaleY;
  }

  // Also check if (cx, cz) lies inside any Roof Dormer (Dachgaube) so walls/windows under a dormer can rise into the dormer
  const dormersList = getEffectiveRoofDormers(cfg, wallLen);
  const tanSlope = ridgeH / Math.max(0.2, halfSpan);
  for (const dItem of dormersList) {
    const zDir = dItem.side === 'back' ? -1 : 1;
    if (cfg.type === 'mono_pitch' && zDir < 0) continue;
    if (cz * zDir < 0) continue;
    const dWidth = THREE.MathUtils.clamp(
      dItem.width ?? 1.5,
      0.75,
      Math.max(0.85, wallLen * 0.78)
    );
    const dHeight = THREE.MathUtils.clamp(
      dItem.height ?? 1.3,
      0.65,
      Math.max(0.75, ridgeH * 0.86)
    );
    const xPos = THREE.MathUtils.clamp(
      dItem.offsetAlongRidge ?? 0,
      -Math.max(0.1, wallLen / 2 - dWidth * 0.55),
      Math.max(0.1, wallLen / 2 - dWidth * 0.55)
    );
    if (Math.abs(cx - xPos) <= dWidth / 2 + 0.08) {
      const zWallAbs = wallSpan / 2;
      const eavesSetback = THREE.MathUtils.clamp(
        dItem.eavesSetback ?? 0.35,
        0,
        Math.max(0.2, wallSpan * 0.36)
      );
      const zFrontAbs = THREE.MathUtils.clamp(
        zWallAbs - eavesSetback,
        halfSpan * 0.25,
        halfSpan - 0.08
      );
      const dDepth = Math.min(
        zFrontAbs - 0.05,
        Math.max(0.85, dHeight / Math.max(0.24, tanSlope) + 0.06)
      );
      const absCz = Math.abs(cz);
      if (absCz <= zFrontAbs + 0.12 && absCz >= zFrontAbs - dDepth - 0.12) {
        const yRoofTopAtFront =
          ySlopeBase + ridgeH * (1 - zFrontAbs / halfSpan) + 0.032;
        yRoof = Math.max(yRoof, yRoofTopAtFront + dHeight);
      }
    }
  }

  return yRoof;
}

/**
 * Procedural 3D Roof, Kniestock/Drempel, Multi-Window Roof Dormers (Dachgauben),
 * Transparent Skylights (Dachflächenfenster) & Chimneys Builder
 */
export function buildZoneRoofGroup(
  zone: FloorplanZone,
  options?: BuildRoofOptions
): THREE.Group {
  const group = new THREE.Group();
  const cfg = zone.roofConfig;
  if (!cfg || cfg.type === 'none') return group;

  const ridgeAlongX = (cfg.ridgeDirection || 'x') === 'x';
  const wallSpan = Math.max(0.8, ridgeAlongX ? zone.depth : zone.width);
  const wallLen = Math.max(0.8, ridgeAlongX ? zone.width : zone.depth);

  // Separate Eaves Overhang (Traufüberstand) vs. Gable Overhang (Giebel-/Ortgangüberstand)
  const eavesOverhang = THREE.MathUtils.clamp(cfg.overhang ?? 0.35, 0, 1.25);
  const gableOverhang = THREE.MathUtils.clamp(
    cfg.gableOverhang ?? cfg.overhang ?? 0.25,
    0,
    1.25
  );

  const span = Math.max(1.2, wallSpan + eavesOverhang * 2);
  const length = Math.max(1.2, wallLen + gableOverhang * 2);
  const halfSpan = span / 2;
  const halfLen = length / 2;

  const pitchRad = THREE.MathUtils.degToRad(
    THREE.MathUtils.clamp(cfg.pitchDeg ?? 35, 8, 60)
  );
  const spanMode = cfg.roofSpanMode || 'single_floor';

  // Kniestock / Drempel height (e.g. 0.0m = roof sits directly on EG ceiling, 0.75m = 75cm Kniestock on 1. OG)
  const kniestockH =
    cfg.type === 'flat'
      ? 0
      : THREE.MathUtils.clamp(
          cfg.kniestockHeight ?? (spanMode !== 'single_floor' ? 0.75 : 0),
          0,
          1.85
        );

  const spitzbodenH = THREE.MathUtils.clamp(cfg.spitzbodenHeight ?? 2.75, 2.1, 3.2);
  const rawRidgeH = halfSpan * Math.tan(pitchRad);

  const ridgeH =
    cfg.type === 'flat'
      ? 0.22
      : spanMode === 'og_and_dg_in_roof'
      ? Math.min(7.5, Math.max(rawRidgeH, spitzbodenH + 1.95 - kniestockH))
      : spanMode === 'og_in_roof'
      ? Math.min(6.2, Math.max(rawRidgeH, 2.65 - kniestockH))
      : Math.min(5.5, Math.max(0.55, rawRidgeH));

  const ySlopeBase = 0.04 + kniestockH;
  const isFocusCutaway = Boolean(options?.floorFocusCutaway);

  const matPalette: Record<
    string,
    { hex: number; rough: number; metal: number; fasciaHex: number }
  > = {
    anthracite_tile: { hex: 0x262c36, rough: 0.62, metal: 0.12, fasciaHex: 0x1e293b },
    terracotta_tile: { hex: 0x9a3412, rough: 0.68, metal: 0.05, fasciaHex: 0x292524 },
    standing_seam_zinc: { hex: 0x64748b, rough: 0.36, metal: 0.68, fasciaHex: 0x334155 },
    slate_dark: { hex: 0x1e293b, rough: 0.52, metal: 0.18, fasciaHex: 0x0f172a },
    flat_gravel: { hex: 0x78716c, rough: 0.88, metal: 0.04, fasciaHex: 0x334155 },
    green_sedum: { hex: 0x3f6212, rough: 0.9, metal: 0.02, fasciaHex: 0x334155 },
  };
  const pal = matPalette[cfg.material || 'anthracite_tile'] || matPalette.anthracite_tile;

  // Main roof slope material (becomes a translucent architectural shell in floorFocusCutaway mode so you can look right into 1. OG / DG!)
  const roofMat = new THREE.MeshStandardMaterial({
    color: pal.hex,
    roughness: pal.rough,
    metalness: pal.metal,
    side: THREE.DoubleSide,
    transparent: isFocusCutaway,
    opacity: isFocusCutaway ? 0.22 : 1.0,
    depthWrite: !isFocusCutaway,
  });
  // Solid roof material used for dormers (Dachgauben) so dormers always stay crisp & solid even in floor focus view
  const dormerRoofMat = isFocusCutaway
    ? new THREE.MeshStandardMaterial({
        color: pal.hex,
        roughness: pal.rough,
        metalness: pal.metal,
        side: THREE.DoubleSide,
      })
    : roofMat;
  const fasciaMat = new THREE.MeshStandardMaterial({
    color: pal.fasciaHex,
    roughness: 0.45,
    metalness: 0.35,
  });
  const gableWallMat = new THREE.MeshStandardMaterial({
    color: zone.wallColor || 0xe2e8f0,
    roughness: 0.8,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const upperGableWallMat = isFocusCutaway
    ? new THREE.MeshStandardMaterial({
        color: zone.wallColor || 0xe2e8f0,
        roughness: 0.8,
        metalness: 0.02,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      })
    : gableWallMat;

  // Content group oriented so local X is ridge axis (length) and local Z is span axis
  const core = new THREE.Group();
  if (!ridgeAlongX) {
    core.rotation.y = Math.PI / 2;
  }
  group.add(core);

  // Perimeter Eave Soffit / Fascia Strips (Traufkästen) ONLY along the eaves overhang
  // (Never place a solid horizontal box across the interior of the roof, so skylights & OG/DG rooms stay completely open!)
  if (cfg.type !== 'flat') {
    const eaveStripD = Math.max(0.14, eavesOverhang + 0.08);
    for (const zSign of [-1, 1]) {
      const eaveSoffit = new THREE.Mesh(
        new THREE.BoxGeometry(length, 0.065, eaveStripD),
        fasciaMat
      );
      eaveSoffit.position.set(
        0,
        ySlopeBase - 0.01,
        zSign * (halfSpan - eaveStripD / 2)
      );
      core.add(eaveSoffit);
    }
  }

  // Optional Kniestock / Drempel masonry walls along eaves when no explicit upper-floor room walls already cover them
  if (kniestockH > 0.02 && cfg.type !== 'flat' && !options?.hasUpperFloorRoomsInsideRoof) {
    const wallT = 0.14;
    for (const zSign of [-1, 1]) {
      const kWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallLen, kniestockH, wallT),
        gableWallMat
      );
      kWall.position.set(
        0,
        0.04 + kniestockH / 2,
        zSign * (wallSpan / 2 - wallT / 2)
      );
      kWall.castShadow = true;
      kWall.receiveShadow = true;
      core.add(kWall);
    }
  }

  // Optional Intermediate Spitzboden / DG Floor Slab inside the roof when in 'og_and_dg_in_roof' mode
  if (
    spanMode === 'og_and_dg_in_roof' &&
    cfg.hasSpitzbodenFloor !== false &&
    cfg.type !== 'flat' &&
    !options?.hasUpperFloorRoomsInsideRoof
  ) {
    const relY = spitzbodenH - ySlopeBase;
    if (relY > 0.2 && relY < ridgeH - 0.55) {
      const spanRatioAtSpitz = Math.max(0.18, 1 - relY / ridgeH);
      const spitzSpanW = Math.max(0.8, span * spanRatioAtSpitz - 0.16);
      const spitzSlabShape = new THREE.Shape();
      spitzSlabShape.moveTo(-wallLen / 2 + 0.12, -spitzSpanW / 2);
      spitzSlabShape.lineTo(wallLen / 2 - 0.12, -spitzSpanW / 2);
      spitzSlabShape.lineTo(wallLen / 2 - 0.12, spitzSpanW / 2);
      spitzSlabShape.lineTo(-wallLen / 2 + 0.12, spitzSpanW / 2);
      spitzSlabShape.closePath();

      // Cut stairwell opening (Treppenöffnung zum Spitzboden) so you can see into the DG
      const holeW = Math.min(2.4, wallLen * 0.28);
      const holeD = Math.min(1.2, spitzSpanW * 0.36);
      if (spitzSpanW > 1.8 && wallLen > 3.2) {
        const stairHole = new THREE.Path();
        stairHole.moveTo(-holeW / 2, -holeD / 2);
        stairHole.lineTo(-holeW / 2, holeD / 2);
        stairHole.lineTo(holeW / 2, holeD / 2);
        stairHole.lineTo(holeW / 2, -holeD / 2);
        stairHole.closePath();
        spitzSlabShape.holes.push(stairHole);
      }

      const spitzGeo = new THREE.ExtrudeGeometry(spitzSlabShape, {
        depth: 0.12,
        bevelEnabled: false,
      });
      spitzGeo.rotateX(-Math.PI / 2);
      const spitzMesh = new THREE.Mesh(spitzGeo, MAT.warmWhite);
      spitzMesh.position.set(0, spitzbodenH - 0.06, 0);
      spitzMesh.receiveShadow = true;
      core.add(spitzMesh);
    }
  }

  // Pre-collect 3D slope cutout holes for Skylights (Dachfenster) & Dormers (Dachgauben)
  const dormersList = cfg.type !== 'flat' ? getEffectiveRoofDormers(cfg, wallLen) : [];
  const skylightsList = cfg.skylights || [];

  const slopeLenGable = Math.hypot(halfSpan, ridgeH);
  const slopeAngleGable = Math.atan2(ridgeH, halfSpan);
  const tanSlope = ridgeH / Math.max(0.2, halfSpan);

  const frontSlopeHoles: SlopeHoleRect[] = [];
  const backSlopeHoles: SlopeHoleRect[] = [];
  const flatDeckHoles: SlopeHoleRect[] = [];

  // 1. Add skylight holes so every skylight is 100% transparent through the roof slab
  for (const sky of skylightsList) {
    const zDir = sky.side === 'back' ? -1 : 1;
    const sWidth = THREE.MathUtils.clamp(sky.width ?? 1.14, 0.55, Math.max(0.7, wallLen * 0.65));
    const sLen = THREE.MathUtils.clamp(sky.length ?? 1.4, 0.6, Math.max(0.7, halfSpan * 0.85));
    const xPos = THREE.MathUtils.clamp(
      sky.offsetAlongRidge ?? 0,
      -Math.max(0.1, wallLen / 2 - sWidth * 0.55),
      Math.max(0.1, wallLen / 2 - sWidth * 0.55)
    );
    const t = THREE.MathUtils.clamp(sky.slopePosition ?? 0.5, 0.18, 0.84);

    if (cfg.type === 'flat') {
      flatDeckHoles.push({
        x: xPos,
        z: zDir * (halfSpan * t * 0.55),
        w: sWidth - 0.04,
        l: sLen - 0.04,
      });
    } else if (cfg.type === 'mono_pitch') {
      const monoH = Math.min(4.2, span * Math.tan(pitchRad * 0.65));
      const monoSlopeLen = Math.hypot(span, monoH);
      const tFull = zDir > 0 ? 0.5 + t * 0.42 : 0.5 - t * 0.42;
      frontSlopeHoles.push({
        x: xPos,
        z: (tFull - 0.5) * monoSlopeLen,
        w: sWidth - 0.04,
        l: sLen - 0.04,
      });
    } else {
      const localZ = zDir * (t - 0.5) * slopeLenGable;
      const hole: SlopeHoleRect = {
        x: xPos,
        z: localZ,
        w: sWidth - 0.04,
        l: sLen - 0.04,
      };
      if (zDir > 0) {
        frontSlopeHoles.push(hole);
      } else {
        backSlopeHoles.push(hole);
      }
    }
  }

  // 2. Add dormer cutout holes on the roof slopes so the main roof does not cut through the dormer interior
  for (const dItem of dormersList) {
    const zDir = dItem.side === 'back' ? -1 : 1;
    if (cfg.type === 'mono_pitch' && zDir < 0) continue;
    const dWidth = THREE.MathUtils.clamp(
      dItem.width ?? 1.5,
      0.75,
      Math.max(0.85, wallLen * 0.78)
    );
    const dHeight = THREE.MathUtils.clamp(
      dItem.height ?? 1.3,
      0.65,
      Math.max(0.75, ridgeH * 0.86)
    );
    const xPos = THREE.MathUtils.clamp(
      dItem.offsetAlongRidge ?? 0,
      -Math.max(0.1, wallLen / 2 - dWidth * 0.55),
      Math.max(0.1, wallLen / 2 - dWidth * 0.55)
    );
    const zWallAbs = wallSpan / 2;
    const eavesSetback = THREE.MathUtils.clamp(
      dItem.eavesSetback ?? 0.35,
      0,
      Math.max(0.2, wallSpan * 0.36)
    );
    const zFrontAbs = THREE.MathUtils.clamp(
      zWallAbs - eavesSetback,
      halfSpan * 0.25,
      halfSpan - 0.08
    );
    const dDepth = Math.min(
      zFrontAbs - 0.06,
      Math.max(0.8, dHeight / Math.max(0.24, tanSlope))
    );
    const tFront = zFrontAbs / halfSpan;
    const tBack = Math.max(0.08, (zFrontAbs - dDepth) / halfSpan);
    const tMid = (tFront + tBack) / 2;
    const holeSlopeLen = Math.max(0.35, ((tFront - tBack) * slopeLenGable) - 0.08);
    const localZ = zDir * (tMid - 0.5) * slopeLenGable;
    const hole: SlopeHoleRect = {
      x: xPos,
      z: localZ,
      w: Math.max(0.4, dWidth - 0.2),
      l: holeSlopeLen,
    };
    if (zDir > 0) {
      frontSlopeHoles.push(hole);
    } else {
      backSlopeHoles.push(hole);
    }
  }

  // 3. Build Main Roof Geometry
  if (cfg.type === 'flat') {
    const parapetT = 0.14;
    const parapetH = 0.24;
    const deckGeo = createRoofSlopeGeometryWithHoles(
      length - parapetT * 2,
      0.08,
      span - parapetT * 2,
      flatDeckHoles
    );
    const deck = new THREE.Mesh(deckGeo, roofMat);
    deck.position.y = 0.1;
    deck.receiveShadow = true;
    core.add(deck);

    // 4 Attic parapet walls with zinc coping
    const pNorth = new THREE.Mesh(new THREE.BoxGeometry(length, parapetH, parapetT), fasciaMat);
    pNorth.position.set(0, parapetH / 2 + 0.04, -halfSpan + parapetT / 2);
    const pSouth = pNorth.clone();
    pSouth.position.z = halfSpan - parapetT / 2;
    const pWest = new THREE.Mesh(
      new THREE.BoxGeometry(parapetT, parapetH, span - parapetT * 2),
      fasciaMat
    );
    pWest.position.set(-halfLen + parapetT / 2, parapetH / 2 + 0.04, 0);
    const pEast = pWest.clone();
    pEast.position.x = halfLen - parapetT / 2;
    core.add(pNorth, pSouth, pWest, pEast);
  } else if (cfg.type === 'gable') {
    const southGeo = createRoofSlopeGeometryWithHoles(
      length,
      0.08,
      slopeLenGable,
      frontSlopeHoles
    );
    const southSlope = new THREE.Mesh(southGeo, roofMat);
    southSlope.position.set(0, ySlopeBase + ridgeH / 2, halfSpan / 2);
    southSlope.rotation.x = slopeAngleGable;
    southSlope.castShadow = true;
    southSlope.receiveShadow = true;

    const northGeo = createRoofSlopeGeometryWithHoles(
      length,
      0.08,
      slopeLenGable,
      backSlopeHoles
    );
    const northSlope = new THREE.Mesh(northGeo, roofMat);
    northSlope.position.set(0, ySlopeBase + ridgeH / 2, -halfSpan / 2);
    northSlope.rotation.x = -slopeAngleGable;
    northSlope.castShadow = true;
    northSlope.receiveShadow = true;

    const ridgeCap = new THREE.Mesh(
      new THREE.BoxGeometry(length + 0.04, 0.09, 0.15),
      fasciaMat
    );
    ridgeCap.position.set(0, ySlopeBase + ridgeH + 0.01, 0);
    core.add(southSlope, northSlope, ridgeCap);

    // Gable Bargeboards / Windfedern (Ortgangbretter) at both gable overhang ends (±halfLen)
    for (const xSign of [-1, 1]) {
      const bx = xSign * (halfLen - 0.025);
      const bargeFront = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.13, slopeLenGable + 0.04),
        fasciaMat
      );
      bargeFront.position.set(bx, ySlopeBase + ridgeH / 2 - 0.01, halfSpan / 2);
      bargeFront.rotation.x = slopeAngleGable;

      const bargeBack = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.13, slopeLenGable + 0.04),
        fasciaMat
      );
      bargeBack.position.set(bx, ySlopeBase + ridgeH / 2 - 0.01, -halfSpan / 2);
      bargeBack.rotation.x = -slopeAngleGable;
      core.add(bargeFront, bargeBack);
    }

    // Timber Purlins (Firstpfette & Mittelpfetten) visible under gable overhangs when gableOverhang > 0.08
    if (gableOverhang > 0.08) {
      const purlinPositions: [number, number][] = [
        [0, ySlopeBase + ridgeH - 0.1],
        [-wallSpan * 0.25, ySlopeBase + ridgeH * (1 - (wallSpan * 0.25) / halfSpan) - 0.09],
        [wallSpan * 0.25, ySlopeBase + ridgeH * (1 - (wallSpan * 0.25) / halfSpan) - 0.09],
      ];
      for (const [pz, py] of purlinPositions) {
        if (py > ySlopeBase + 0.08) {
          const purlin = new THREE.Mesh(
            new THREE.BoxGeometry(length - 0.04, 0.12, 0.12),
            fasciaMat
          );
          purlin.position.set(0, py, pz);
          core.add(purlin);
        }
      }
    }

    // Gable end masonry walls (inset to actual building wallLen & wallSpan so gableOverhang projects cleanly!)
    {
      const gableTopH = ridgeH * (wallSpan / span);
      const baseCutY =
        options?.hasUpperFloorRoomsInsideRoof ? Math.min(2.68, ySlopeBase + ridgeH - 0.25) : 0.04;
      const yAtWall = Math.max(baseCutY, ySlopeBase + ridgeH * (1 - wallSpan / 2 / halfSpan));
      if (ySlopeBase + ridgeH > baseCutY + 0.12 && gableTopH > 0.1) {
        const halfSpanAtBase =
          baseCutY <= ySlopeBase
            ? wallSpan / 2
            : Math.min(
                wallSpan / 2,
                halfSpan * Math.max(0.08, 1 - (baseCutY - ySlopeBase) / Math.max(0.2, ridgeH))
              );
        const triShape = new THREE.Shape();
        triShape.moveTo(-halfSpanAtBase, baseCutY);
        triShape.lineTo(halfSpanAtBase, baseCutY);
        if (baseCutY < yAtWall - 0.02) {
          triShape.lineTo(wallSpan / 2, yAtWall);
        }
        triShape.lineTo(0, ySlopeBase + ridgeH);
        if (baseCutY < yAtWall - 0.02) {
          triShape.lineTo(-wallSpan / 2, yAtWall);
        }
        triShape.closePath();

        const triGeo = new THREE.ExtrudeGeometry(triShape, { depth: 0.15, bevelEnabled: false });
        const westGable = new THREE.Mesh(triGeo, upperGableWallMat);
        westGable.rotation.y = Math.PI / 2;
        westGable.position.set(-wallLen / 2, 0, 0);
        westGable.castShadow = !isFocusCutaway;
        westGable.receiveShadow = true;

        const eastGable = new THREE.Mesh(triGeo, upperGableWallMat);
        eastGable.rotation.y = Math.PI / 2;
        eastGable.position.set(wallLen / 2 - 0.15, 0, 0);
        eastGable.castShadow = !isFocusCutaway;
        eastGable.receiveShadow = true;

        core.add(westGable, eastGable);
      }
    }
  } else if (cfg.type === 'hipped' || cfg.type === 'tent') {
    const ridgeRun =
      cfg.type === 'tent' ? 0 : Math.max(0, halfLen - halfSpan);
    const pos = new Float32Array([
      // South face (2 triangles)
      -halfLen, ySlopeBase, halfSpan,
      halfLen, ySlopeBase, halfSpan,
      ridgeRun, ySlopeBase + ridgeH, 0,

      -halfLen, ySlopeBase, halfSpan,
      ridgeRun, ySlopeBase + ridgeH, 0,
      -ridgeRun, ySlopeBase + ridgeH, 0,

      // North face (2 triangles)
      halfLen, ySlopeBase, -halfSpan,
      -halfLen, ySlopeBase, -halfSpan,
      -ridgeRun, ySlopeBase + ridgeH, 0,

      halfLen, ySlopeBase, -halfSpan,
      -ridgeRun, ySlopeBase + ridgeH, 0,
      ridgeRun, ySlopeBase + ridgeH, 0,

      // West hip triangle
      -halfLen, ySlopeBase, -halfSpan,
      -halfLen, ySlopeBase, halfSpan,
      -ridgeRun, ySlopeBase + ridgeH, 0,

      // East hip triangle
      halfLen, ySlopeBase, halfSpan,
      halfLen, ySlopeBase, -halfSpan,
      ridgeRun, ySlopeBase + ridgeH, 0,
    ]);
    const hipGeo = new THREE.BufferGeometry();
    hipGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    hipGeo.computeVertexNormals();
    const hipMesh = new THREE.Mesh(hipGeo, roofMat);
    hipMesh.castShadow = true;
    hipMesh.receiveShadow = true;
    core.add(hipMesh);

    if (ridgeRun > 0.05) {
      const ridgeCap = new THREE.Mesh(
        new THREE.BoxGeometry(ridgeRun * 2 + 0.08, 0.09, 0.14),
        fasciaMat
      );
      ridgeCap.position.set(0, ySlopeBase + ridgeH + 0.01, 0);
      core.add(ridgeCap);
    }
  } else if (cfg.type === 'mono_pitch') {
    const monoH = Math.min(4.2, span * Math.tan(pitchRad * 0.65));
    const slopeLen = Math.hypot(span, monoH);
    const slopeAngle = Math.atan2(monoH, span);

    const monoGeo = createRoofSlopeGeometryWithHoles(
      length,
      0.09,
      slopeLen,
      frontSlopeHoles
    );
    const monoSlab = new THREE.Mesh(monoGeo, roofMat);
    monoSlab.position.set(0, ySlopeBase + monoH / 2, 0);
    monoSlab.rotation.x = slopeAngle;
    monoSlab.castShadow = true;
    monoSlab.receiveShadow = true;
    core.add(monoSlab);

    if (!options?.hasUpperFloorRoomsInsideRoof) {
      const wedgeShape = new THREE.Shape();
      wedgeShape.moveTo(-wallSpan / 2, 0.04);
      wedgeShape.lineTo(wallSpan / 2, 0.04);
      wedgeShape.lineTo(wallSpan / 2, ySlopeBase);
      wedgeShape.lineTo(-wallSpan / 2, ySlopeBase + monoH * (wallSpan / span));
      wedgeShape.closePath();
      const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, { depth: 0.15, bevelEnabled: false });
      const westWedge = new THREE.Mesh(wedgeGeo, gableWallMat);
      westWedge.rotation.y = Math.PI / 2;
      westWedge.position.set(-wallLen / 2, 0, 0);
      const eastWedge = new THREE.Mesh(wedgeGeo, gableWallMat);
      eastWedge.rotation.y = Math.PI / 2;
      eastWedge.position.set(wallLen / 2 - 0.15, 0, 0);
      core.add(westWedge, eastWedge);
    }
  } else if (cfg.type === 'mansard') {
    const lowerH = ridgeH * 0.65;
    const upperH = ridgeH * 0.35;
    const breakZ = halfSpan * 0.62;
    const lowerSlopeLen = Math.hypot(halfSpan - breakZ, lowerH);
    const lowerAngle = Math.atan2(lowerH, halfSpan - breakZ);
    const upperSlopeLen = Math.hypot(breakZ, upperH);
    const upperAngle = Math.atan2(upperH, breakZ);

    for (const dir of [-1, 1]) {
      const lowerSlope = new THREE.Mesh(
        new THREE.BoxGeometry(length, 0.08, lowerSlopeLen),
        roofMat
      );
      lowerSlope.position.set(0, ySlopeBase + lowerH / 2, dir * ((halfSpan + breakZ) / 2));
      lowerSlope.rotation.x = dir * lowerAngle;
      lowerSlope.castShadow = true;

      const upperSlope = new THREE.Mesh(
        new THREE.BoxGeometry(length, 0.08, upperSlopeLen),
        roofMat
      );
      upperSlope.position.set(0, ySlopeBase + lowerH + upperH / 2, dir * (breakZ / 2));
      upperSlope.rotation.x = dir * upperAngle;
      upperSlope.castShadow = true;
      core.add(lowerSlope, upperSlope);
    }

    if (!options?.hasUpperFloorRoomsInsideRoof) {
      const mShape = new THREE.Shape();
      const wHalf = Math.min(wallSpan / 2, halfSpan);
      const bZ = Math.min(wHalf, breakZ);
      mShape.moveTo(-wHalf, 0.04);
      mShape.lineTo(wHalf, 0.04);
      mShape.lineTo(wHalf, ySlopeBase);
      mShape.lineTo(bZ, ySlopeBase + lowerH);
      mShape.lineTo(0, ySlopeBase + ridgeH);
      mShape.lineTo(-bZ, ySlopeBase + lowerH);
      mShape.lineTo(-wHalf, ySlopeBase);
      mShape.closePath();
      const mGeo = new THREE.ExtrudeGeometry(mShape, { depth: 0.15, bevelEnabled: false });
      const westM = new THREE.Mesh(mGeo, gableWallMat);
      westM.rotation.y = Math.PI / 2;
      westM.position.set(-wallLen / 2, 0, 0);
      const eastM = new THREE.Mesh(mGeo, gableWallMat);
      eastM.rotation.y = Math.PI / 2;
      eastM.position.set(wallLen / 2 - 0.15, 0, 0);
      core.add(westM, eastM);
    }
  } else if (cfg.type === 'barrel') {
    const arcShape = new THREE.Shape();
    arcShape.absarc(0, 0, halfSpan, 0, Math.PI, false);
    arcShape.lineTo(-halfSpan, 0);
    const barrelGeo = new THREE.ExtrudeGeometry(arcShape, {
      depth: length,
      bevelEnabled: false,
      curveSegments: 24,
    });
    const barrelMesh = new THREE.Mesh(barrelGeo, roofMat);
    barrelMesh.rotation.y = Math.PI / 2;
    barrelMesh.position.set(-halfLen, ySlopeBase, 0);
    barrelMesh.scale.y = Math.min(1.0, (ridgeH / halfSpan) * 0.85);
    barrelMesh.castShadow = true;
    barrelMesh.receiveShadow = true;
    core.add(barrelMesh);
  }

  // 4. Individual Roof Dormers (Dachgauben) with Accurate Non-Sinking Kniestock & Multi-Window Support
  if (cfg.type !== 'flat') {
    for (const dItem of dormersList) {
      const zDir = dItem.side === 'back' ? -1 : 1;
      if (cfg.type === 'mono_pitch' && zDir < 0) continue;

      const dWidth = THREE.MathUtils.clamp(
        dItem.width ?? 1.5,
        0.75,
        Math.max(0.85, wallLen * 0.78)
      );
      const dHeight = THREE.MathUtils.clamp(
        dItem.height ?? 1.3,
        0.65,
        Math.max(0.75, ridgeH * 0.86)
      );
      const xPos = THREE.MathUtils.clamp(
        dItem.offsetAlongRidge ?? 0,
        -Math.max(0.1, wallLen / 2 - dWidth * 0.55),
        Math.max(0.1, wallLen / 2 - dWidth * 0.55)
      );

      // Position dormer front face relative to the building wall (eavesSetback) and compute EXACT roof surface height yBase
      // so the dormer Kniestock / Brüstung sits cleanly ON TOP of the roof tiles and NEVER sinks into the roof!
      const zWallAbs = wallSpan / 2;
      const eavesSetback = THREE.MathUtils.clamp(
        dItem.eavesSetback ?? 0.35,
        0,
        Math.max(0.2, wallSpan * 0.36)
      );
      const zFrontAbs = THREE.MathUtils.clamp(
        zWallAbs - eavesSetback,
        halfSpan * 0.25,
        halfSpan - 0.08
      );
      const yRoofTopAtFront =
        ySlopeBase + ridgeH * (1 - zFrontAbs / halfSpan) + 0.032;

      const dDepth = Math.min(
        zFrontAbs - 0.05,
        Math.max(0.85, dHeight / Math.max(0.24, tanSlope) + 0.06)
      );

      const dormer = new THREE.Group();
      dormer.position.set(xPos, yRoofTopAtFront, zDir * zFrontAbs);
      if (zDir < 0) {
        dormer.rotation.y = Math.PI;
      }

      const dType = dItem.type || 'gable';
      const cheekT = 0.11;
      const sillH = THREE.MathUtils.clamp(
        dItem.sillHeight ?? 0.30,
        0.08,
        Math.max(0.16, dHeight * 0.5)
      );
      const lintelH = 0.08;
      const cornerPostW = Math.max(0.09, Math.min(0.16, dWidth * 0.085));
      const winW = Math.max(0.42, dWidth - cornerPostW * 2);
      const winH = Math.max(0.36, dHeight - sillH - lintelH);

      // Front Apron Flashing (Zink-/Bleischürze am Gauben-Kniestock auf den Dachziegeln)
      const apronFlashing = new THREE.Mesh(
        new THREE.BoxGeometry(dWidth + 0.06, 0.025, 0.14),
        fasciaMat
      );
      apronFlashing.position.set(0, 0.01, 0.04);
      apronFlashing.rotation.x = slopeAngleGable;
      dormer.add(apronFlashing);

      // Visible Gauben-Kniestock / Brüstung (below window, completely above the main roof!)
      const frontSillWall = new THREE.Mesh(
        new THREE.BoxGeometry(dWidth, sillH, cheekT),
        gableWallMat
      );
      frontSillWall.position.set(0, sillH / 2, -cheekT / 2);
      frontSillWall.castShadow = true;
      frontSillWall.receiveShadow = true;

      // Top Lintel Wall (Sturz über den Gaubenfenstern)
      const frontLintelWall = new THREE.Mesh(
        new THREE.BoxGeometry(dWidth, lintelH, cheekT),
        gableWallMat
      );
      frontLintelWall.position.set(0, dHeight - lintelH / 2, -cheekT / 2);

      // Left & Right Front Corner Pillars framing the dormer window opening
      const leftFrontPost = new THREE.Mesh(
        new THREE.BoxGeometry(cornerPostW, winH, cheekT),
        gableWallMat
      );
      leftFrontPost.position.set(
        -dWidth / 2 + cornerPostW / 2,
        sillH + winH / 2,
        -cheekT / 2
      );
      const rightFrontPost = leftFrontPost.clone();
      rightFrontPost.position.x = dWidth / 2 - cornerPostW / 2;

      dormer.add(frontSillWall, frontLintelWall, leftFrontPost, rightFrontPost);

      // Sloped Side Cheeks (Gaubenwangen) extending backward (-Z) into the rising main roof slope!
      // IMPORTANT: In Three.js, `rotation.y = Math.PI / 2` maps shape +X to 3D -Z (into the roof toward the ridge).
      // Therefore, shape X must go from 0 (front face at Z = 0) to +dDepth (back edge at Z = -dDepth),
      // so the dormer cheeks ALWAYS point into the roof and NEVER away from the roof!
      const backRoofRise = Math.min(dHeight - 0.04, dDepth * tanSlope);
      const shedRise = dType === 'shed' ? Math.min(ridgeH * 0.38, dHeight * 0.34) : 0;

      const cheekShape = new THREE.Shape();
      cheekShape.moveTo(0, 0);
      cheekShape.lineTo(0, dHeight);
      cheekShape.lineTo(dDepth, dHeight + shedRise);
      cheekShape.lineTo(dDepth, backRoofRise);
      cheekShape.closePath();

      const cheekGeo = new THREE.ExtrudeGeometry(cheekShape, {
        depth: cheekT,
        bevelEnabled: false,
      });
      const leftCheek = new THREE.Mesh(cheekGeo, gableWallMat);
      leftCheek.rotation.y = Math.PI / 2;
      leftCheek.position.set(-dWidth / 2, 0, 0);
      leftCheek.castShadow = true;
      leftCheek.receiveShadow = true;

      const rightCheek = new THREE.Mesh(cheekGeo, gableWallMat);
      rightCheek.rotation.y = Math.PI / 2;
      rightCheek.position.set(dWidth / 2 - cheekT, 0, 0);
      rightCheek.castShadow = true;
      rightCheek.receiveShadow = true;
      dormer.add(leftCheek, rightCheek);

      if (dType === 'shed') {
        const roofSlopeLen = Math.hypot(dDepth + 0.24, shedRise);
        const shedAngle = Math.atan2(shedRise, dDepth);
        const shedCap = new THREE.Mesh(
          new THREE.BoxGeometry(dWidth + 0.22, 0.075, roofSlopeLen),
          dormerRoofMat
        );
        shedCap.position.set(0, dHeight + shedRise / 2 + 0.03, -dDepth / 2 + 0.04);
        shedCap.rotation.x = shedAngle;
        shedCap.castShadow = true;
        dormer.add(shedCap);
      } else if (dType === 'gable') {
        const capPeak = dHeight * 0.36;
        const gShape = new THREE.Shape();
        gShape.moveTo(-dWidth / 2, 0);
        gShape.lineTo(0, capPeak);
        gShape.lineTo(dWidth / 2, 0);
        gShape.closePath();
        const gPrism = new THREE.Mesh(
          new THREE.ExtrudeGeometry(gShape, { depth: dDepth, bevelEnabled: false }),
          gableWallMat
        );
        gPrism.position.set(0, dHeight - 0.01, -dDepth);
        gPrism.castShadow = true;
        dormer.add(gPrism);

        const halfOver = dWidth / 2 + 0.14;
        const capSlopeLen = Math.hypot(halfOver, capPeak);
        const capAngle = Math.atan2(capPeak, halfOver);
        const leftCap = new THREE.Mesh(
          new THREE.BoxGeometry(capSlopeLen, 0.068, dDepth + 0.22),
          dormerRoofMat
        );
        leftCap.position.set(-halfOver / 2, dHeight + capPeak / 2 + 0.015, -dDepth / 2 + 0.05);
        leftCap.rotation.z = capAngle;
        leftCap.castShadow = true;
        const rightCap = new THREE.Mesh(
          new THREE.BoxGeometry(capSlopeLen, 0.068, dDepth + 0.22),
          dormerRoofMat
        );
        rightCap.position.set(halfOver / 2, dHeight + capPeak / 2 + 0.015, -dDepth / 2 + 0.05);
        rightCap.rotation.z = -capAngle;
        rightCap.castShadow = true;
        dormer.add(leftCap, rightCap);
      } else if (dType === 'trapezoid') {
        const topW = dWidth * 0.56;
        const capPeak = dHeight * 0.26;
        const trapShape = new THREE.Shape();
        trapShape.moveTo(-dWidth / 2, 0);
        trapShape.lineTo(-topW / 2, capPeak);
        trapShape.lineTo(topW / 2, capPeak);
        trapShape.lineTo(dWidth / 2, 0);
        trapShape.closePath();
        const trapPrism = new THREE.Mesh(
          new THREE.ExtrudeGeometry(trapShape, { depth: dDepth + 0.14, bevelEnabled: false }),
          dormerRoofMat
        );
        trapPrism.position.set(0, dHeight - 0.01, -dDepth - 0.02);
        trapPrism.castShadow = true;
        const topCap = new THREE.Mesh(
          new THREE.BoxGeometry(topW + 0.12, 0.06, dDepth + 0.18),
          fasciaMat
        );
        topCap.position.set(0, dHeight + capPeak + 0.02, -dDepth / 2 + 0.04);
        dormer.add(trapPrism, topCap);
      } else if (dType === 'arched') {
        const archR = dWidth / 2 + 0.06;
        const archShape = new THREE.Shape();
        archShape.absarc(0, 0, archR, 0, Math.PI, false);
        archShape.closePath();
        const archGeo = new THREE.ExtrudeGeometry(archShape, {
          depth: dDepth + 0.18,
          bevelEnabled: false,
          curveSegments: 20,
        });
        const archCap = new THREE.Mesh(archGeo, dormerRoofMat);
        archCap.scale.y = 0.48;
        archCap.position.set(0, dHeight - 0.01, -dDepth - 0.02);
        archCap.castShadow = true;
        dormer.add(archCap);
      } else {
        // flat_box (Flachdach-Kastengaube)
        const flatCap = new THREE.Mesh(
          new THREE.BoxGeometry(dWidth + 0.18, 0.085, dDepth + 0.22),
          fasciaMat
        );
        flatCap.position.set(0, dHeight + 0.04, -dDepth / 2 + 0.05);
        flatCap.castShadow = true;
        dormer.add(flatCap);
      }

      // Multi-Window Assembly inside the Dormer Front Face (each window individually configurable!)
      const winAssembly = buildDormerWindowAssembly(
        winW,
        winH,
        {
          windows: dItem.windows,
          windowCount: dItem.windowCount ?? 2,
          windowStyle: dItem.windowStyle ?? 'mullion_cross',
          windowFrameColor: dItem.windowFrameColor ?? 'anthracite',
          windowOpenState: dItem.windowOpenState ?? 'closed',
          hasShutter: dItem.hasShutter ?? false,
          shutterClosedPct: dItem.shutterClosedPct ?? 0,
        },
        false
      );
      winAssembly.position.set(0, sillH + winH / 2, -0.02);
      dormer.add(winAssembly);

      core.add(dormer);
    }
  }

  // 5. Individual Roof Skylights / Dachflächenfenster (with Hollow Flashing, White Reveal & See-Through Glass!)
  if (skylightsList.length > 0) {
    const skylightGlassMat = createGlassMaterial(false, 0xbae6fd);

    for (const sky of skylightsList) {
      const zDir = sky.side === 'back' ? -1 : 1;
      const sWidth = THREE.MathUtils.clamp(sky.width ?? 1.14, 0.55, Math.max(0.7, wallLen * 0.65));
      const sLen = THREE.MathUtils.clamp(sky.length ?? 1.4, 0.6, Math.max(0.7, halfSpan * 0.85));
      const xPos = THREE.MathUtils.clamp(
        sky.offsetAlongRidge ?? 0,
        -Math.max(0.1, wallLen / 2 - sWidth * 0.55),
        Math.max(0.1, wallLen / 2 - sWidth * 0.55)
      );
      const t = THREE.MathUtils.clamp(sky.slopePosition ?? 0.5, 0.18, 0.84);
      const frameMat = resolveFrameColorMaterial(sky.frameColor || 'anthracite');
      const style = sky.style || 'velux_pivot';
      const openState = sky.openState || 'closed';

      const skyGroup = new THREE.Group();
      if (cfg.type === 'flat' || style === 'flat_roof_dome') {
        const ySurface =
          cfg.type === 'flat' ? 0.14 : ySlopeBase + ridgeH * (1 - t);
        const zSurface =
          cfg.type === 'flat' ? zDir * (halfSpan * t * 0.55) : zDir * (halfSpan * t);
        skyGroup.position.set(xPos, ySurface, zSurface);
        if (cfg.type !== 'flat') {
          skyGroup.rotation.x = zDir * slopeAngleGable;
        }

        // Hollow 4-sided insulated upstand curb (Aufsetzkranz) + hollow collar so dome is 100% transparent!
        const curbT = 0.055;
        const curbH = 0.18;
        const cTop = new THREE.Mesh(new THREE.BoxGeometry(sWidth, curbH, curbT), MAT.warmWhite);
        cTop.position.set(0, curbH / 2, -sLen / 2 + curbT / 2);
        const cBot = cTop.clone();
        cBot.position.z = sLen / 2 - curbT / 2;
        const cLeft = new THREE.Mesh(
          new THREE.BoxGeometry(curbT, curbH, sLen - curbT * 2),
          MAT.warmWhite
        );
        cLeft.position.set(-sWidth / 2 + curbT / 2, curbH / 2, 0);
        const cRight = cLeft.clone();
        cRight.position.x = sWidth / 2 - curbT / 2;

        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(
            Math.min(sWidth, sLen) * 0.48,
            20,
            12,
            0,
            Math.PI * 2,
            0,
            Math.PI * 0.45
          ),
          skylightGlassMat
        );
        dome.scale.set(
          sWidth / Math.min(sWidth, sLen),
          0.42,
          sLen / Math.min(sWidth, sLen)
        );
        dome.position.y = curbH;
        if (openState !== 'closed') {
          dome.rotation.x = -0.25;
        }
        skyGroup.add(cTop, cBot, cLeft, cRight, dome);
      } else {
        // Sloped roof skylight aligned with the 3D hole cut into the roof slope
        const zSurface = zDir * (halfSpan * t);
        const ySurface = ySlopeBase + ridgeH * (1 - t);
        skyGroup.position.set(xPos, ySurface, zSurface);
        skyGroup.rotation.x = zDir * slopeAngleGable;

        // 1. Hollow 4-sided White Interior Reveal Lining (Innenfutter / Laibung) through the roof thickness
        const revT = 0.028;
        const revH = 0.12;
        const rTop = new THREE.Mesh(
          new THREE.BoxGeometry(sWidth - 0.02, revH, revT),
          MAT.warmWhite
        );
        rTop.position.set(0, -0.02, -sLen / 2 + revT / 2 + 0.01);
        const rBot = rTop.clone();
        rBot.position.z = sLen / 2 - revT / 2 - 0.01;
        const rLeft = new THREE.Mesh(
          new THREE.BoxGeometry(revT, revH, sLen - revT * 2 - 0.02),
          MAT.warmWhite
        );
        rLeft.position.set(-sWidth / 2 + revT / 2 + 0.01, -0.02, 0);
        const rRight = rLeft.clone();
        rRight.position.x = sWidth / 2 - revT / 2 - 0.01;
        skyGroup.add(rTop, rBot, rLeft, rRight);

        // 2. Hollow 4-sided Exterior Flashing Collar (Eindeckrahmen) — open in the center!
        const fRim = 0.055;
        const fH = 0.065;
        const fTop = new THREE.Mesh(
          new THREE.BoxGeometry(sWidth + 0.06, fH, fRim),
          frameMat
        );
        fTop.position.set(0, 0.035, -sLen / 2 - 0.03 + fRim / 2);
        const fBot = fTop.clone();
        fBot.position.z = sLen / 2 + 0.03 - fRim / 2;
        const fLeft = new THREE.Mesh(
          new THREE.BoxGeometry(fRim, fH, sLen + 0.06 - fRim * 2),
          frameMat
        );
        fLeft.position.set(-sWidth / 2 - 0.03 + fRim / 2, 0.035, 0);
        const fRight = fLeft.clone();
        fRight.position.x = sWidth / 2 + 0.03 - fRim / 2;
        skyGroup.add(fTop, fBot, fLeft, fRight);

        // 3. Individual Skylight Sashes with Hollow Frames & Crystal-Clear Transparent Glass
        const paneCount =
          style === 'velux_twin' ? 2 : style === 'panoramic_studio' ? 3 : 1;
        const innerW = sWidth - 0.06;
        const innerL = sLen - 0.06;
        const postW = 0.036;
        const paneW = (innerW - (paneCount - 1) * postW) / paneCount;
        const sRim = 0.034;

        for (let p = 0; p < paneCount; p++) {
          const px = -innerW / 2 + paneW / 2 + p * (paneW + postW);
          if (p > 0) {
            const midBar = new THREE.Mesh(
              new THREE.BoxGeometry(postW, fH, innerL),
              frameMat
            );
            midBar.position.set(px - paneW / 2 - postW / 2, 0.038, 0);
            skyGroup.add(midBar);
          }

          const sashPivot = new THREE.Group();
          sashPivot.position.set(px, 0.055, 0);

          if (openState === 'tilted') {
            sashPivot.rotation.x = zDir * -0.25;
          } else if (openState === 'open') {
            sashPivot.rotation.x = zDir * (style === 'cabrio_balcony' ? -0.78 : -0.52);
          }

          // Hollow 4-sided sash rim
          const sTop = new THREE.Mesh(
            new THREE.BoxGeometry(paneW, 0.034, sRim),
            frameMat
          );
          sTop.position.z = -innerL / 2 + sRim / 2;
          const sBot = sTop.clone();
          sBot.position.z = innerL / 2 - sRim / 2;
          const sLeft = new THREE.Mesh(
            new THREE.BoxGeometry(sRim, 0.034, innerL - sRim * 2),
            frameMat
          );
          sLeft.position.x = -paneW / 2 + sRim / 2;
          const sRight = sLeft.clone();
          sRight.position.x = paneW / 2 - sRim / 2;

          // Brushed steel top ventilation handle bar
          const handleBar = new THREE.Mesh(
            new THREE.BoxGeometry(Math.max(0.15, paneW - sRim * 2.2), 0.016, 0.024),
            MAT.brushedSteel
          );
          handleBar.position.set(0, 0.02, -innerL / 2 + sRim * 0.65);

          const glassPane = new THREE.Mesh(
            new THREE.BoxGeometry(
              Math.max(0.1, paneW - sRim * 2),
              0.016,
              Math.max(0.1, innerL - sRim * 2)
            ),
            skylightGlassMat
          );
          glassPane.position.y = 0.004;

          sashPivot.add(sTop, sBot, sLeft, sRight, handleBar, glassPane);
          skyGroup.add(sashPivot);
        }
      }
      core.add(skyGroup);
    }
  }

  // 6. Individual Building Chimneys / Schornsteine & Dachkamine
  if (cfg.chimneys && cfg.chimneys.length > 0) {
    for (const chim of cfg.chimneys) {
      const cStyle = chim.style || 'brick_classic';
      const cw = THREE.MathUtils.clamp(chim.width ?? 0.58, 0.35, 1.4);
      const ch = THREE.MathUtils.clamp(chim.height ?? 1.45, 0.65, 3.2);
      const cx = THREE.MathUtils.clamp(chim.offsetX ?? 0, -halfLen * 0.88, halfLen * 0.88);
      const cz = THREE.MathUtils.clamp(chim.offsetZ ?? 0, -halfSpan * 0.82, halfSpan * 0.82);

      const distFromRidgeRatio = Math.min(1, Math.abs(cz) / Math.max(0.2, halfSpan));
      const roofSurfaceY =
        cfg.type === 'flat'
          ? 0.22
          : ySlopeBase + ridgeH * (1 - distFromRidgeRatio * 0.85);

      const chimGroup = new THREE.Group();
      chimGroup.position.set(cx, roofSurfaceY, cz);

      if (cStyle === 'stainless_flue') {
        const baseCone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.24, 0.22, 20),
          MAT.brushedSteel
        );
        baseCone.position.y = 0.05;
        const pipe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, ch + 0.5, 22),
          MAT.brushedSteel
        );
        pipe.position.y = (ch + 0.1) / 2;
        pipe.castShadow = true;
        const rainHood = new THREE.Mesh(
          new THREE.ConeGeometry(0.2, 0.1, 20),
          MAT.brushedSteel
        );
        rainHood.position.y = ch + 0.42;
        chimGroup.add(baseCone, pipe, rainHood);
      } else {
        const shaftMat =
          cStyle === 'plaster_modern'
            ? MAT.warmWhite
            : cStyle === 'slate_clad'
            ? MAT.anthracite
            : new THREE.MeshStandardMaterial({
                color: 0x8b3a2b,
                roughness: 0.84,
                metalness: 0.05,
              });

        const depthZ = cStyle === 'double_brick_flue' ? cw * 0.72 : cw;
        const widthX = cStyle === 'double_brick_flue' ? cw * 1.28 : cw;

        const flashing = new THREE.Mesh(
          new THREE.BoxGeometry(widthX + 0.14, 0.28, depthZ + 0.14),
          MAT.darkMetal
        );
        flashing.position.y = -0.04;

        const totalShaftH = ch + 0.7;
        const shaft = new THREE.Mesh(
          new RoundedBoxGeometry(widthX, totalShaftH, depthZ, 2, 0.012),
          shaftMat
        );
        shaft.position.y = ch / 2 - 0.35;
        shaft.castShadow = true;
        shaft.receiveShadow = true;

        const crown = new THREE.Mesh(
          new RoundedBoxGeometry(widthX + 0.12, 0.07, depthZ + 0.12, 2, 0.01),
          cStyle === 'slate_clad' ? MAT.darkMetal : MAT.travertine
        );
        crown.position.y = ch + 0.02;

        chimGroup.add(flashing, shaft, crown);

        const flueOffsets =
          cStyle === 'double_brick_flue' || widthX >= 0.72
            ? [-widthX * 0.24, widthX * 0.24]
            : [0];
        for (const fx of flueOffsets) {
          const pot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.085, 0.095, 0.22, 16),
            cStyle === 'brick_classic' || cStyle === 'double_brick_flue'
              ? new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 })
              : MAT.brushedSteel
          );
          pot.position.set(fx, ch + 0.15, 0);
          const cap = new THREE.Mesh(
            new THREE.ConeGeometry(0.135, 0.07, 16),
            MAT.darkMetal
          );
          cap.position.set(fx, ch + 0.3, 0);
          chimGroup.add(pot, cap);
        }
      }

      core.add(chimGroup);
    }
  }

  return group;
}

export function getEffectiveRoofDormers(
  cfg: ZoneRoofConfig,
  ridgeLen: number
): RoofDormerItem[] {
  if (cfg.dormers && cfg.dormers.length > 0) {
    return cfg.dormers;
  }
  const dType = cfg.dormerType || 'none';
  if (dType === 'none' || cfg.type === 'flat') {
    return [];
  }
  const dCount = THREE.MathUtils.clamp(cfg.dormerCountPerSide ?? 1, 1, 4);
  const dWidth = THREE.MathUtils.clamp(cfg.dormerWidth ?? 1.5, 0.8, 3.2);
  const dHeight = THREE.MathUtils.clamp(cfg.dormerHeight ?? 1.3, 0.7, 2.4);
  const halfLen = Math.max(0.8, ridgeLen / 2);

  const sideOpt = (cfg.dormerSides as string) || 'south';
  const sides: ('front' | 'back')[] = [];
  if (sideOpt === 'front' || sideOpt === 'south' || sideOpt === 'east' || sideOpt === 'both') {
    sides.push('front');
  }
  if (sideOpt === 'back' || sideOpt === 'north' || sideOpt === 'west' || sideOpt === 'both') {
    sides.push('back');
  }
  if (sides.length === 0) sides.push('front');

  const items: RoofDormerItem[] = [];
  for (const side of sides) {
    for (let i = 0; i < dCount; i++) {
      const offsetAlongRidge =
        dCount === 1
          ? 0
          : Number(
              THREE.MathUtils.lerp(-halfLen * 0.58, halfLen * 0.58, i / (dCount - 1)).toFixed(2)
            );
      items.push({
        id: `legacy_dormer_${side}_${i}`,
        type: dType,
        side,
        offsetAlongRidge,
        width: dWidth,
        height: dHeight,
        sillHeight: 0.3,
        eavesSetback: 0.35,
        windowCount: 2,
        windowStyle: 'mullion_cross',
        windowFrameColor: 'anthracite',
        windowOpenState: 'closed',
      });
    }
  }
  return items;
}



