import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  DormerWindowConfig,
  ExteriorStepsShapeType,
  FloorplanZone,
  getEffectiveDormerWindows,
  HAEntityState,
  isBinaryEntityActive,
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
  getChainlinkMeshTexture,
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
  obsidianGlass: new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.08,
    metalness: 0.85,
  }),
  warmGlow: new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 1.3,
    roughness: 0.2,
  }),
  concrete: new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.65,
    metalness: 0.05,
  }),
};

const glassMaterialCache = new Map<number, THREE.MeshStandardMaterial>();
const sharedUnitPlaneGeo = new THREE.PlaneGeometry(1, 1);
sharedUnitPlaneGeo.userData = { isSharedSingleton: true };
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

interface VolumetricLightOptions {
  offsetX?: number;
  offsetZ?: number;
  poolOffsetX?: number;
  poolOffsetZ?: number;
  showCone?: boolean;
  coneTopRadius?: number;
  coneBottomRadius?: number;
  coneOpacity?: number;
  coneHeads?: Array<{
    x: number;
    y: number;
    z: number;
    topRadius?: number;
    bottomRadius?: number;
  }>;
}

let _volumetricConeTex: THREE.CanvasTexture | null = null;
function getVolumetricConeTexture(): THREE.CanvasTexture {
  if (_volumetricConeTex) return _volumetricConeTex;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.92)');
  grad.addColorStop(0.18, 'rgba(255, 248, 228, 0.58)');
  grad.addColorStop(0.55, 'rgba(255, 236, 195, 0.22)');
  grad.addColorStop(0.88, 'rgba(255, 224, 165, 0.05)');
  grad.addColorStop(1.0, 'rgba(255, 214, 153, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  _volumetricConeTex = tex;
  return tex;
}

function addVolumetricLightFeatures(
  root: THREE.Group,
  haloRadius: number,
  lightOffsetY: number,
  floorPoolY: number,
  poolRadius: number,
  options?: VolumetricLightOptions
) {
  const offX = options?.offsetX ?? 0;
  const offZ = options?.offsetZ ?? 0;
  const poolX = options?.poolOffsetX ?? offX;
  const poolZ = options?.poolOffsetZ ?? offZ;

  root.userData.lightEmissionOffsetX = offX;
  root.userData.lightEmissionOffsetY = lightOffsetY;
  root.userData.lightEmissionOffsetZ = offZ;

  // Soft optical luminaire bloom disc right at the light source head
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
  haloPlane.position.set(offX, lightOffsetY, offZ);
  root.add(haloPlane);

  // Soft radial IES light pool projected onto the floor/ground directly below the luminaire head
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
  poolPlane.position.set(poolX, floorPoolY, poolZ);
  root.add(poolPlane);

  // Optional 3D downward volumetric light cone originating directly from the lamp head(s)
  if (options?.showCone) {
    const baseConeOpacity = options.coneOpacity ?? 0.2;
    const coneMat = new THREE.MeshBasicMaterial({
      map: getVolumetricConeTexture(),
      color: 0xffd699,
      transparent: true,
      opacity: baseConeOpacity,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const coneGroup = new THREE.Group();
    const heads =
      options.coneHeads && options.coneHeads.length > 0
        ? options.coneHeads
        : [
            {
              x: offX,
              y: lightOffsetY,
              z: offZ,
              topRadius: options.coneTopRadius ?? Math.max(0.08, haloRadius * 0.16),
              bottomRadius: options.coneBottomRadius ?? Math.max(0.65, poolRadius * 0.42),
            },
          ];

    for (const head of heads) {
      const topY = head.y;
      const botY = floorPoolY + 0.01;
      const coneH = Math.max(0.35, topY - botY);
      const topR = head.topRadius ?? 0.14;
      const botR = head.bottomRadius ?? Math.max(0.85, poolRadius * 0.4);
      const targetPoolX = options.coneHeads ? head.x * 1.35 : poolX;
      const targetPoolZ = options.coneHeads ? head.z * 1.35 : poolZ;
      const dx = targetPoolX - head.x;
      const dz = targetPoolZ - head.z;
      const coneLen = Math.hypot(dx, coneH, dz);
      const coneGeo = new THREE.CylinderGeometry(topR, botR, coneLen, 28, 1, true);
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.set(
        (head.x + targetPoolX) * 0.5,
        (topY + botY) * 0.5,
        (head.z + targetPoolZ) * 0.5
      );
      if (Math.hypot(dx, dz) > 0.005) {
        const dir = new THREE.Vector3(head.x - targetPoolX, topY - botY, head.z - targetPoolZ).normalize();
        coneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      }
      coneGroup.add(coneMesh);
    }

    root.add(coneGroup);
    root.userData.lightConeMesh = coneGroup;
    root.userData.lightConeMat = coneMat;
    root.userData.lightConeBaseOpacity = baseConeOpacity;
  }

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
        // Limit shadow map draw calls to top 3 primary structural parts per asset; contact shadow handles ground AO
        child.castShadow = cast && casterCount < 3;
        child.receiveShadow = receive && casterCount < 5;
        casterCount++;
      }
    }
  });
}

function buildExteriorStepsGeometry(opts: {
  shape: ExteriorStepsShapeType;
  plinthH: number;
  stepCount: number;
  stepW: number;
  totalD: number;
  material: 'granite' | 'travertine' | 'anthracite' | 'wood' | 'brick_clinker';
  railing: 'none' | 'both' | 'left' | 'right' | 'glass';
  glassMat: THREE.Material;
  baseYOffset?: number;
  extSign?: number;
  zStartOffset?: number;
}): THREE.Group {
  const {
    shape,
    plinthH,
    stepCount,
    stepW,
    totalD,
    material,
    railing,
    glassMat,
    baseYOffset = 0,
    extSign = 1,
    zStartOffset = 0,
  } = opts;

  const stepsGroup = new THREE.Group();
  const stepMat =
    material === 'anthracite'
      ? MAT.anthracite
      : material === 'wood'
      ? MAT.teakWood
      : material === 'brick_clinker'
      ? MAT.burgundyRed
      : material === 'granite'
      ? new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.58, metalness: 0.08 })
      : MAT.travertine;

  const nosingMat = material === 'anthracite' ? MAT.brushedSteel : MAT.anthracite;
  const landingD = Math.max(0.45, totalD * 0.46);
  const runD = Math.max(0.35, totalD - landingD);
  const treadD = runD / Math.max(1, stepCount);

  if (shape === 'curved_fan') {
    // Semi-circular / fanned radial stone steps
    const topRadius = Math.max(stepW * 0.46, landingD * 0.85);
    const landingCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(topRadius, topRadius, plinthH, 28, 1, false, -Math.PI / 2, Math.PI),
      stepMat
    );
    landingCyl.rotation.y = extSign > 0 ? 0 : Math.PI;
    landingCyl.position.set(0, baseYOffset + plinthH / 2, extSign * zStartOffset);
    stepsGroup.add(landingCyl);

    for (let i = 0; i < stepCount; i++) {
      const stepH = plinthH * ((stepCount - i) / (stepCount + 1));
      const rOuter = topRadius + (i + 1) * treadD;
      const fanStep = new THREE.Mesh(
        new THREE.CylinderGeometry(rOuter, rOuter, stepH, 32, 1, false, -Math.PI / 2, Math.PI),
        stepMat
      );
      fanStep.rotation.y = extSign > 0 ? 0 : Math.PI;
      fanStep.position.set(0, baseYOffset + stepH / 2, extSign * zStartOffset);
      stepsGroup.add(fanStep);
    }
  } else if (shape === 'pyramid_3side') {
    // 3-sided wrap-around pyramid block steps (front + left + right)
    const coreW = Math.max(0.85, stepW - stepCount * treadD * 1.4);
    const landingMesh = new THREE.Mesh(
      new RoundedBoxGeometry(coreW, plinthH, landingD, 3, 0.01),
      stepMat
    );
    landingMesh.position.set(
      0,
      baseYOffset + plinthH / 2,
      extSign * (zStartOffset + landingD / 2)
    );
    stepsGroup.add(landingMesh);

    for (let i = 0; i < stepCount; i++) {
      const stepH = plinthH * ((stepCount - i) / (stepCount + 1));
      const tierW = coreW + (i + 1) * treadD * 1.85;
      const tierD = landingD + (i + 1) * treadD;
      const tierMesh = new THREE.Mesh(
        new RoundedBoxGeometry(tierW, stepH, tierD, 2, 0.008),
        stepMat
      );
      tierMesh.position.set(
        0,
        baseYOffset + stepH / 2,
        extSign * (zStartOffset + tierD / 2)
      );
      stepsGroup.add(tierMesh);
    }
  } else if (shape === 'side_left' || shape === 'side_right') {
    // Corner landing at the door with steps descending sideways along the house facade
    const dirX = shape === 'side_right' ? 1 : -1;
    const podestW = Math.max(1.05, stepW * 0.56);
    const podestD = Math.max(0.82, totalD * 0.72);
    const landingMesh = new THREE.Mesh(
      new RoundedBoxGeometry(podestW, plinthH, podestD, 3, 0.01),
      stepMat
    );
    landingMesh.position.set(
      -dirX * (stepW * 0.16),
      baseYOffset + plinthH / 2,
      extSign * (zStartOffset + podestD / 2)
    );
    stepsGroup.add(landingMesh);

    const sideStepTread = Math.max(0.26, (stepW * 0.75) / Math.max(1, stepCount));
    for (let i = 0; i < stepCount; i++) {
      const stepH = plinthH * ((stepCount - i) / (stepCount + 1));
      const sx =
        -dirX * (stepW * 0.16) +
        dirX * (podestW / 2 + (i + 0.5) * sideStepTread);
      const stepMesh = new THREE.Mesh(
        new RoundedBoxGeometry(sideStepTread + 0.02, stepH, podestD, 2, 0.008),
        stepMat
      );
      stepMesh.position.set(
        sx,
        baseYOffset + stepH / 2,
        extSign * (zStartOffset + podestD / 2)
      );
      stepsGroup.add(stepMesh);
    }

    // Front safety balustrade along the outer edge of the side-step landing
    if (railing !== 'none') {
      const totalSpanW = podestW + stepCount * sideStepTread;
      const frontZ = extSign * (zStartOffset + podestD - 0.05);
      const centerSpanX = -dirX * (stepW * 0.16) + dirX * ((stepCount * sideStepTread) / 2);
      if (railing === 'glass') {
        const glassPanel = new THREE.Mesh(
          new THREE.BoxGeometry(totalSpanW - 0.08, 0.88, 0.02),
          glassMat
        );
        glassPanel.position.set(centerSpanX, baseYOffset + plinthH * 0.65 + 0.44, frontZ);
        stepsGroup.add(glassPanel);
      } else {
        const postL = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, 0.88, 12),
          MAT.brushedSteel
        );
        postL.position.set(
          -dirX * (stepW * 0.16 + podestW / 2 - 0.06),
          baseYOffset + plinthH + 0.44,
          frontZ
        );
        const postR = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, 0.88, 12),
          MAT.brushedSteel
        );
        postR.position.set(
          -dirX * (stepW * 0.16) + dirX * (podestW / 2 + stepCount * sideStepTread - 0.06),
          baseYOffset + 0.44,
          frontZ
        );
        const topBar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, totalSpanW, 12),
          MAT.brushedSteel
        );
        topBar.position.set(centerSpanX, baseYOffset + plinthH / 2 + 0.88, frontZ);
        topBar.rotation.z = Math.PI / 2 - dirX * Math.atan2(plinthH, totalSpanW);
        stepsGroup.add(postL, postR, topBar);
      }
    }
    return stepsGroup;
  } else if (shape === 'double_side_T') {
    // T-shaped central landing with steps descending to BOTH Left & Right along the facade
    const podestW = Math.max(1.0, stepW * 0.48);
    const podestD = Math.max(0.84, totalD * 0.72);
    const landingMesh = new THREE.Mesh(
      new RoundedBoxGeometry(podestW, plinthH, podestD, 3, 0.01),
      stepMat
    );
    landingMesh.position.set(
      0,
      baseYOffset + plinthH / 2,
      extSign * (zStartOffset + podestD / 2)
    );
    stepsGroup.add(landingMesh);

    const sideStepTread = Math.max(0.24, (stepW * 0.42) / Math.max(1, stepCount));
    for (const dirX of [-1, 1]) {
      for (let i = 0; i < stepCount; i++) {
        const stepH = plinthH * ((stepCount - i) / (stepCount + 1));
        const sx = dirX * (podestW / 2 + (i + 0.5) * sideStepTread);
        const stepMesh = new THREE.Mesh(
          new RoundedBoxGeometry(sideStepTread + 0.02, stepH, podestD, 2, 0.008),
          stepMat
        );
        stepMesh.position.set(
          sx,
          baseYOffset + stepH / 2,
          extSign * (zStartOffset + podestD / 2)
        );
        stepsGroup.add(stepMesh);
      }
    }
  } else if (shape === 'corner_L') {
    // L-shaped corner wrap-around steps (front + right side)
    const coreW = Math.max(0.95, stepW - stepCount * treadD * 0.9);
    const landingMesh = new THREE.Mesh(
      new RoundedBoxGeometry(coreW, plinthH, landingD, 3, 0.01),
      stepMat
    );
    landingMesh.position.set(
      -(stepCount * treadD) * 0.45,
      baseYOffset + plinthH / 2,
      extSign * (zStartOffset + landingD / 2)
    );
    stepsGroup.add(landingMesh);

    for (let i = 0; i < stepCount; i++) {
      const stepH = plinthH * ((stepCount - i) / (stepCount + 1));
      const tierW = coreW + (i + 1) * treadD;
      const tierD = landingD + (i + 1) * treadD;
      const tierMesh = new THREE.Mesh(
        new RoundedBoxGeometry(tierW, stepH, tierD, 2, 0.008),
        stepMat
      );
      tierMesh.position.set(
        -(stepCount - (i + 1)) * treadD * 0.45,
        baseYOffset + stepH / 2,
        extSign * (zStartOffset + tierD / 2)
      );
      stepsGroup.add(tierMesh);
    }
  } else {
    // 'straight' or 'kellertreppe_wall' (Straight entrance steps with landing + optional side cheek walls)
    const landingMesh = new THREE.Mesh(
      new RoundedBoxGeometry(stepW, plinthH, landingD, 3, 0.01),
      stepMat
    );
    landingMesh.position.set(
      0,
      baseYOffset + plinthH / 2,
      extSign * (zStartOffset + landingD / 2)
    );
    stepsGroup.add(landingMesh);

    for (let i = 0; i < stepCount; i++) {
      const stepH = plinthH * ((stepCount - i) / (stepCount + 1));
      const sz = extSign * (zStartOffset + landingD + (i + 0.5) * treadD);
      const stepMesh = new THREE.Mesh(
        new RoundedBoxGeometry(stepW, stepH, treadD + 0.02, 2, 0.008),
        stepMat
      );
      stepMesh.position.set(0, baseYOffset + stepH / 2, sz);
      const nosing = new THREE.Mesh(
        new THREE.BoxGeometry(stepW - 0.04, 0.016, 0.038),
        nosingMat
      );
      nosing.position.set(
        0,
        baseYOffset + stepH + 0.002,
        sz + extSign * (treadD / 2 - 0.02)
      );
      stepsGroup.add(stepMesh, nosing);
    }

    if (shape === 'kellertreppe_wall') {
      // Solid masonry cheek walls (Wangenmauern) on both sides of the exterior stair
      for (const sSign of [-1, 1]) {
        const wallMesh = new THREE.Mesh(
          new RoundedBoxGeometry(0.14, plinthH + 0.32, totalD + 0.06, 2, 0.008),
          MAT.warmWhite
        );
        wallMesh.position.set(
          sSign * (stepW / 2 + 0.06),
          baseYOffset + (plinthH + 0.32) / 2,
          extSign * (zStartOffset + totalD / 2)
        );
        const capMesh = new THREE.Mesh(
          new RoundedBoxGeometry(0.18, 0.04, totalD + 0.1, 2, 0.006),
          MAT.anthracite
        );
        capMesh.position.set(
          sSign * (stepW / 2 + 0.06),
          baseYOffset + plinthH + 0.34,
          extSign * (zStartOffset + totalD / 2)
        );
        stepsGroup.add(wallMesh, capMesh);
      }
    }
  }

  // Add side handrails / glass balustrades when requested
  if (railing !== 'none') {
    const railSides: number[] = [];
    if (railing === 'both' || railing === 'glass' || railing === 'left') railSides.push(-1);
    if (railing === 'both' || railing === 'glass' || railing === 'right') railSides.push(1);
    for (const sSign of railSides) {
      const rx = sSign * (stepW / 2 - 0.045);
      if (railing === 'glass') {
        const glassSide = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 0.86, totalD - 0.12),
          glassMat
        );
        glassSide.position.set(
          rx,
          baseYOffset + plinthH * 0.5 + 0.44,
          extSign * (zStartOffset + totalD / 2)
        );
        stepsGroup.add(glassSide);
      }
      const post1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.86, 12),
        MAT.brushedSteel
      );
      post1.position.set(
        rx,
        baseYOffset + plinthH + 0.43,
        extSign * (zStartOffset + 0.14)
      );
      const post2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.86, 12),
        MAT.brushedSteel
      );
      post2.position.set(
        rx,
        baseYOffset + 0.43,
        extSign * (zStartOffset + totalD - 0.08)
      );
      const rLen = Math.hypot(totalD - 0.2, plinthH);
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, rLen, 12),
        MAT.brushedSteel
      );
      bar.position.set(
        rx,
        baseYOffset + plinthH / 2 + 0.86,
        extSign * (zStartOffset + totalD / 2)
      );
      bar.rotation.x = Math.PI / 2 + extSign * Math.atan2(plinthH, totalD - 0.2);
      stepsGroup.add(post1, post2, bar);
    }
  }

  return stepsGroup;
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
export interface DormerDynamicSashRef {
  sashPivot: THREE.Group;
  sashContainer: THREE.Group;
  cx: number;
  sashW: number;
  innerH: number;
  isLeftHinged: boolean;
  isSkylightSash?: boolean;
  isChimneyHatch?: boolean;
  zDir?: number;
  skylightOpenAngle?: number;
}

export interface DormerDynamicUnitRef {
  entityId?: string;
  shutterEntityId?: string;
  fallbackOpenState: 'closed' | 'tilted' | 'open';
  fallbackShutterClosedPct: number;
  shutterCurtainGroup?: THREE.Group;
  sashes: DormerDynamicSashRef[];
}

export function updateDormerDynamicUnits(
  units: DormerDynamicUnitRef[] | undefined,
  entities: Record<string, HAEntityState> | undefined,
  dt = 0.016
): boolean {
  if (!units || units.length === 0) return false;
  let animating = false;

  for (const unit of units) {
    // 1. Update Roller Shutter (Rollladen) from bound HA cover.* entity or manual fallback
    if (unit.shutterCurtainGroup) {
      let targetClosedRatio = THREE.MathUtils.clamp(unit.fallbackShutterClosedPct / 100, 0, 1);
      if (unit.shutterEntityId && entities) {
        const shEnt = entities[unit.shutterEntityId];
        if (shEnt) {
          if (typeof shEnt.attributes?.current_position === 'number') {
            // In Home Assistant cover.*, current_position 100 = fully open (0% closed), 0 = fully closed (100% closed)
            targetClosedRatio = THREE.MathUtils.clamp(
              1 - shEnt.attributes.current_position / 100,
              0,
              1
            );
          } else {
            const st = String(shEnt.state || '').toLowerCase();
            if (st === 'closed' || st === 'closing') {
              targetClosedRatio = 1;
            } else if (st === 'open' || st === 'opening') {
              targetClosedRatio = 0;
            } else {
              targetClosedRatio = isBinaryEntityActive(shEnt) ? 0 : 1;
            }
          }
        }
      }

      const targetScaleY = Math.max(0.001, targetClosedRatio);
      const shouldBeVisible = targetClosedRatio > 0.015;
      unit.shutterCurtainGroup.visible = shouldBeVisible || unit.shutterCurtainGroup.scale.y > 0.02;
      if (Math.abs(unit.shutterCurtainGroup.scale.y - targetScaleY) > 0.003) {
        unit.shutterCurtainGroup.scale.y = THREE.MathUtils.damp(
          unit.shutterCurtainGroup.scale.y,
          targetScaleY,
          6.0,
          dt
        );
        animating = true;
      } else {
        unit.shutterCurtainGroup.scale.y = targetScaleY;
        unit.shutterCurtainGroup.visible = shouldBeVisible;
      }
    }

    // 2. Update Window Sash Open/Tilt/Closed state from bound HA sensor/cover entity
    let effectiveOpenState: 'closed' | 'tilted' | 'open' = unit.fallbackOpenState;
    if (unit.entityId && entities) {
      const winEnt = entities[unit.entityId];
      if (winEnt) {
        const rawSt = String(winEnt.state || '').toLowerCase();
        if (rawSt === 'tilted' || rawSt === 'gekippt') {
          effectiveOpenState = 'tilted';
        } else if (winEnt.domain === 'cover') {
          const pos = winEnt.attributes?.current_position;
          if (typeof pos === 'number') {
            effectiveOpenState = pos > 60 ? 'open' : pos > 15 ? 'tilted' : 'closed';
          } else {
            effectiveOpenState = rawSt === 'open' || rawSt === 'opening' ? 'open' : 'closed';
          }
        } else {
          effectiveOpenState = isBinaryEntityActive(winEnt) ? 'open' : 'closed';
        }
      } else {
        effectiveOpenState = 'closed';
      }
    }

    for (const sRef of unit.sashes) {
      if (sRef.isSkylightSash) {
        if (sRef.isChimneyHatch) {
          const targetRotZ =
            effectiveOpenState === 'open' ? 1.15 : effectiveOpenState === 'tilted' ? 0.28 : 0;
          if (Math.abs(sRef.sashPivot.rotation.z - targetRotZ) > 0.003) {
            sRef.sashPivot.rotation.z = THREE.MathUtils.damp(
              sRef.sashPivot.rotation.z,
              targetRotZ,
              6.5,
              dt
            );
            animating = true;
          }
        } else {
          const zDir = sRef.zDir ?? 1;
          const openAng = sRef.skylightOpenAngle ?? -0.52;
          const targetRotX =
            effectiveOpenState === 'open'
              ? zDir * openAng
              : effectiveOpenState === 'tilted'
              ? zDir * -0.25
              : 0;
          if (Math.abs(sRef.sashPivot.rotation.x - targetRotX) > 0.003) {
            sRef.sashPivot.rotation.x = THREE.MathUtils.damp(
              sRef.sashPivot.rotation.x,
              targetRotX,
              6.5,
              dt
            );
            animating = true;
          }
        }
        continue;
      }

      if (effectiveOpenState === 'tilted') {
        sRef.sashPivot.position.set(sRef.cx, -sRef.innerH / 2, 0.01);
        sRef.sashContainer.position.set(0, sRef.innerH / 2, 0);
        sRef.sashPivot.rotation.y = 0;
        if (Math.abs(sRef.sashPivot.rotation.x - -0.25) > 0.003) {
          sRef.sashPivot.rotation.x = THREE.MathUtils.damp(
            sRef.sashPivot.rotation.x,
            -0.25,
            7.0,
            dt
          );
          animating = true;
        }
      } else if (effectiveOpenState === 'open') {
        const hingeX =
          sRef.cx + (sRef.isLeftHinged ? -sRef.sashW / 2 + 0.018 : sRef.sashW / 2 - 0.018);
        const localOffsetX = sRef.isLeftHinged
          ? sRef.sashW / 2 - 0.018
          : -sRef.sashW / 2 + 0.018;
        sRef.sashPivot.position.set(hingeX, 0, 0.015);
        sRef.sashContainer.position.set(localOffsetX, 0, 0);
        sRef.sashPivot.rotation.x = 0;
        const targetRotY = sRef.isLeftHinged ? -0.65 : 0.65;
        if (Math.abs(sRef.sashPivot.rotation.y - targetRotY) > 0.003) {
          sRef.sashPivot.rotation.y = THREE.MathUtils.damp(
            sRef.sashPivot.rotation.y,
            targetRotY,
            7.0,
            dt
          );
          animating = true;
        }
      } else {
        sRef.sashPivot.position.set(sRef.cx, 0, 0.008);
        sRef.sashContainer.position.set(0, 0, 0);
        if (
          Math.abs(sRef.sashPivot.rotation.x) > 0.003 ||
          Math.abs(sRef.sashPivot.rotation.y) > 0.003
        ) {
          sRef.sashPivot.rotation.x = THREE.MathUtils.damp(sRef.sashPivot.rotation.x, 0, 7.0, dt);
          sRef.sashPivot.rotation.y = THREE.MathUtils.damp(sRef.sashPivot.rotation.y, 0, 7.0, dt);
          animating = true;
        } else {
          sRef.sashPivot.rotation.set(0, 0, 0);
        }
      }
    }
  }

  return animating;
}

function buildDormerWindowAssembly(
  winTotalW: number,
  winTotalH: number,
  cfg?: DormerWindowConfig,
  isSoftwareGl = false
): THREE.Group {
  const winGroup = new THREE.Group();
  const dynamicUnits: DormerDynamicUnitRef[] = [];
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
    const unitSashes: DormerDynamicSashRef[] = [];

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
      unitSashes.push({
        sashPivot,
        sashContainer,
        cx,
        sashW,
        innerH,
        isLeftHinged,
      });
    }

    // Individual Roller Shutter (Rollladen) per Dormer Window — supports both manual % and live HA cover.* entity!
    const effectiveShutterEntityId = unit.shutterEntityId || cfg?.shutterEntityId;
    const unitHasShutter =
      Boolean(effectiveShutterEntityId) || (unit.hasShutter ?? cfg?.hasShutter ?? false);
    let shutterCurtainGroup: THREE.Group | undefined;

    if (unitHasShutter) {
      const shutterBox = new THREE.Mesh(
        new THREE.BoxGeometry(unitW + 0.02, 0.085, 0.105),
        frameMat
      );
      shutterBox.position.set(0, winTotalH / 2 + 0.032, 0.024);
      unitGroup.add(shutterBox);

      // Build full-height top-anchored slat curtain so it can smoothly animate 0%..100% in real time
      shutterCurtainGroup = new THREE.Group();
      shutterCurtainGroup.position.set(0, winTotalH / 2 - border, 0.042);

      const fullSlatCount = Math.max(4, Math.round(innerH / 0.042));
      const slatH = innerH / fullSlatCount;
      for (let i = 0; i < fullSlatCount; i++) {
        const slat = new THREE.Mesh(
          new THREE.BoxGeometry(innerW + 0.016, slatH - 0.004, 0.016),
          MAT.anthracite
        );
        slat.position.set(0, -(i + 0.5) * slatH, 0);
        shutterCurtainGroup.add(slat);
      }

      const rawPct = unit.shutterClosedPct ?? cfg?.shutterClosedPct ?? 0;
      const pct = THREE.MathUtils.clamp(rawPct, 0, 100) / 100;
      shutterCurtainGroup.scale.y = Math.max(0.001, pct);
      shutterCurtainGroup.visible = pct > 0.015;
      unitGroup.add(shutterCurtainGroup);
    }

    dynamicUnits.push({
      entityId: unit.entityId || cfg?.entityId,
      shutterEntityId: effectiveShutterEntityId,
      fallbackOpenState: openState,
      fallbackShutterClosedPct: unit.shutterClosedPct ?? cfg?.shutterClosedPct ?? 0,
      shutterCurtainGroup,
      sashes: unitSashes,
    });

    winGroup.add(unitGroup);
  }

  winGroup.userData.dormerDynamicUnits = dynamicUnits;
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
    customOpenPct: asset.customOpenPct,
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
      addVolumetricLightFeatures(root, 0.72, 1.58, 0.015, 2.15, {
        offsetX: 0.26,
        poolOffsetX: 0.26,
        showCone: true,
        coneTopRadius: 0.16,
        coneBottomRadius: 0.95,
        coneOpacity: 0.16,
      });
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
      addVolumetricLightFeatures(root, 0.58, -0.02, -1.8, 1.9, {
        offsetZ: 0.16,
        poolOffsetZ: 0.24,
        showCone: true,
        coneTopRadius: 0.08,
        coneBottomRadius: 0.92,
        coneOpacity: 0.16,
      });
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
    case 'radiator_smart':
    case 'bathroom_towel_radiator':
    case 'wall_radiator_modern': {
      const rc = asset.radiatorConfig || {};
      const defaultType =
        asset.catalogId === 'bathroom_towel_radiator'
          ? 'towel_bathroom'
          : asset.catalogId === 'wall_radiator_modern'
          ? 'vertical_designer'
          : 'flat_panel';
      const rType = rc.radiatorType || defaultType;
      const defaultW =
        rType === 'vertical_designer' ? 0.6 : rType === 'towel_bathroom' ? 0.6 : 1.15;
      const defaultH =
        rType === 'vertical_designer' ? 1.8 : rType === 'towel_bathroom' ? 1.55 : 0.62;
      const w = THREE.MathUtils.clamp(asset.customLength ?? asset.customWidth ?? defaultW, 0.3, 2.6);
      const h = THREE.MathUtils.clamp(asset.customHeight ?? defaultH, 0.3, 2.3);

      const finishHex =
        rc.finishColor ||
        (asset.catalogId === 'wall_radiator_modern' || asset.catalogId === 'bathroom_towel_radiator'
          ? '#334155'
          : '#f8fafc');
      const isChrome =
        finishHex.toLowerCase() === '#cbd5e1' || finishHex.toLowerCase() === '#e2e8f0';
      const radMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(finishHex),
        roughness: isChrome ? 0.22 : 0.38,
        metalness: isChrome ? 0.82 : 0.25,
      });

      // Wall mounting brackets at back (z = 0..0.025)
      for (const bx of [-w * 0.35, w * 0.35]) {
        for (const by of [h * 0.22, h * 0.78]) {
          const bracket = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.012, 0.045, 10),
            MAT.brushedSteel
          );
          bracket.rotation.x = Math.PI / 2;
          bracket.position.set(bx, by, 0.022);
          root.add(bracket);
        }
      }

      if (rType === 'towel_bathroom') {
        // Bad-Handtuchheizkörper (Vertical side collectors + horizontal round towel rungs)
        const railL = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, h, 16),
          radMat
        );
        railL.position.set(-w / 2 + 0.025, h / 2, 0.048);
        const railR = railL.clone();
        railR.position.x = w / 2 - 0.025;
        root.add(railL, railR);

        const rungCount = Math.max(5, Math.floor(h / 0.11));
        for (let i = 0; i < rungCount; i++) {
          const ry = 0.09 + (i / Math.max(1, rungCount - 1)) * (h - 0.18);
          // Leave a slight gap every 4 rungs for hanging towels
          if (i % 5 === 3 && rungCount > 7) continue;
          const rung = new THREE.Mesh(
            new THREE.CylinderGeometry(0.011, 0.011, w - 0.04, 14),
            radMat
          );
          rung.rotation.z = Math.PI / 2;
          rung.position.set(0, ry, 0.056);
          root.add(rung);
        }

        // Folded bath towel hanging over middle rung
        const towel = new THREE.Mesh(
          new RoundedBoxGeometry(Math.min(0.38, w * 0.62), Math.min(0.42, h * 0.3), 0.055, 3, 0.02),
          MAT.boucleFabric
        );
        towel.position.set(0.03, h * 0.52, 0.078);
        root.add(towel);
      } else if (rType === 'ribbed_classic') {
        // Klassischer Glieder-/Rippenheizkörper (Deep sculpted vertical cast-iron/steel columns)
        const ribCount = Math.max(5, Math.floor(w / 0.055));
        const spacing = (w - 0.05) / Math.max(1, ribCount - 1);
        for (let i = 0; i < ribCount; i++) {
          const rx = -(w - 0.05) / 2 + i * spacing;
          const rib = new THREE.Mesh(
            new RoundedBoxGeometry(0.034, h - 0.04, 0.105, 3, 0.012),
            radMat
          );
          rib.position.set(rx, h / 2, 0.065);
          root.add(rib);
        }
        // Top and bottom horizontal collector pipes
        for (const py of [0.07, h - 0.07]) {
          const pipe = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, w - 0.03, 14),
            radMat
          );
          pipe.rotation.z = Math.PI / 2;
          pipe.position.set(0, py, 0.065);
          root.add(pipe);
        }
      } else if (rType === 'vertical_designer') {
        // Vertikaler Architektur-Designheizkörper (Flat vertical slats + brushed steel towel bar)
        const backing = new THREE.Mesh(
          new RoundedBoxGeometry(w - 0.02, h - 0.02, 0.045, 3, 0.01),
          radMat
        );
        backing.position.set(0, h / 2, 0.042);
        root.add(backing);

        const slatCount = Math.max(4, Math.floor(w / 0.072));
        const slatSpacing = (w - 0.06) / Math.max(1, slatCount);
        for (let i = 0; i <= slatCount; i++) {
          const sx = -(w - 0.06) / 2 + i * slatSpacing;
          const slat = new THREE.Mesh(
            new RoundedBoxGeometry(0.048, h - 0.03, 0.026, 2, 0.005),
            radMat
          );
          slat.position.set(sx, h / 2, 0.072);
          root.add(slat);
        }

        const chromeBar = new THREE.Mesh(
          new RoundedBoxGeometry(w + 0.03, 0.024, 0.085, 2, 0.006),
          MAT.brushedSteel
        );
        chromeBar.position.set(0, h * 0.66, 0.085);
        root.add(chromeBar);
      } else {
        // Moderner Flachheizkörper (Typ 22 Plan-Flachheizkörper mit oberem Konvektionsgitter)
        const panel = new THREE.Mesh(
          new RoundedBoxGeometry(w, h, 0.095, 4, 0.016),
          radMat
        );
        panel.position.set(0, h / 2, 0.062);
        root.add(panel);

        // Subtle vertical profile grooves
        const grooveCount = Math.max(4, Math.floor(w / 0.095));
        const grooveSpacing = (w - 0.08) / Math.max(1, grooveCount);
        for (let i = 0; i <= grooveCount; i++) {
          const gx = -(w - 0.08) / 2 + i * grooveSpacing;
          const groove = new THREE.Mesh(
            new THREE.BoxGeometry(0.012, h - 0.06, 0.1),
            radMat
          );
          groove.position.set(gx, h / 2, 0.064);
          root.add(groove);
        }

        const topGrille = new THREE.Mesh(
          new THREE.BoxGeometry(w - 0.02, 0.022, 0.088),
          MAT.brushedSteel
        );
        topGrille.position.set(0, h + 0.005, 0.062);
        root.add(topGrille);
      }

      // Smart Home TRV Thermostat Valve on right side with glowing digital ring
      const trvBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.075, 18),
        MAT.matteWhite
      );
      trvBody.rotation.z = Math.PI / 2;
      trvBody.position.set(w / 2 + 0.035, Math.min(h - 0.08, Math.max(0.18, h * 0.82)), 0.062);
      const trvScreen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, 0.012, 18),
        indicatorMat
      );
      trvScreen.rotation.z = Math.PI / 2;
      trvScreen.position.set(w / 2 + 0.074, Math.min(h - 0.08, Math.max(0.18, h * 0.82)), 0.062);
      root.add(trvBody, trvScreen);
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
      const bodyH = h * 0.82;
      const wallT = 0.12;
      const sillH = Math.max(0.22, bodyH * 0.24);
      const lintelH = 0.08;
      const cornerPostW = Math.max(0.1, Math.min(0.18, w * 0.09));
      const winW = Math.max(0.55, w - cornerPostW * 2);
      const winH = Math.max(0.42, bodyH - sillH - lintelH);

      // Front Apron Flashing (Bleischürze / Eindeckrahmen)
      const apronFlashing = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.08, 0.03, 0.16),
        MAT.anthracite
      );
      apronFlashing.position.set(0, 0.01, d / 2 + 0.02);
      root.add(apronFlashing);

      // Front Kniestock / Brüstung (below window) + Top Lintel + Side Corner Pillars
      const frontSillWall = new THREE.Mesh(
        new THREE.BoxGeometry(w, sillH + 0.05, wallT),
        MAT.warmWhite
      );
      frontSillWall.position.set(0, sillH / 2 - 0.025, d / 2 - wallT / 2);
      const frontLintelWall = new THREE.Mesh(
        new THREE.BoxGeometry(w, lintelH, wallT),
        MAT.warmWhite
      );
      frontLintelWall.position.set(0, bodyH - lintelH / 2, d / 2 - wallT / 2);

      const leftFrontPost = new THREE.Mesh(
        new THREE.BoxGeometry(cornerPostW, winH, wallT),
        MAT.warmWhite
      );
      leftFrontPost.position.set(-w / 2 + cornerPostW / 2, sillH + winH / 2, d / 2 - wallT / 2);
      const rightFrontPost = leftFrontPost.clone();
      rightFrontPost.position.x = w / 2 - cornerPostW / 2;

      root.add(frontSillWall, frontLintelWall, leftFrontPost, rightFrontPost);

      // Sloped Side Cheeks (Gaubenwangen) extending backward (-Z) into the roof slope with zero gap!
      // Configurable roofSlopeAngleDeg (defaults to 0°/gentle skirt so it sits flush on Pultdach & Satteldach without a floating triangular gap)
      const slopeDeg = THREE.MathUtils.clamp(
        asset.dormerWindowConfig?.roofSlopeAngleDeg ?? 0,
        0,
        42
      );
      const backRoofRise = Math.min(
        bodyH * 0.65,
        d * Math.tan(THREE.MathUtils.degToRad(slopeDeg))
      );
      const shedRise = asset.catalogId === 'roof_dormer_shed' ? h * 0.24 : 0;
      const embedSkirt = -0.05; // 5cm lower skirt embeds cleanly into roof tiles so there is never an air gap
      const cheekShape = new THREE.Shape();
      cheekShape.moveTo(-d / 2, embedSkirt);
      cheekShape.lineTo(-d / 2, bodyH);
      cheekShape.lineTo(d / 2, bodyH + shedRise);
      cheekShape.lineTo(d / 2, backRoofRise + embedSkirt);
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

      // Rear closure wall (so the dormer never looks hollow from the side or rear)
      const rearWallH = Math.max(0.2, bodyH + shedRise - backRoofRise);
      const rearWall = new THREE.Mesh(
        new THREE.BoxGeometry(w - wallT * 2, rearWallH, wallT * 0.85),
        MAT.warmWhite
      );
      rearWall.position.set(
        0,
        backRoofRise + rearWallH / 2,
        -d / 2 + (wallT * 0.85) / 2
      );
      root.add(rearWall);

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

      const effectiveDormerCfg: DormerWindowConfig = {
        ...asset.dormerWindowConfig,
        entityId: asset.dormerWindowConfig?.entityId || asset.entityId,
      };
      const winGroup = buildDormerWindowAssembly(
        winW,
        winH,
        effectiveDormerCfg,
        isSoftwareGl
      );
      winGroup.position.set(0, sillH + winH / 2, d / 2 - 0.02);
      root.add(winGroup);
      if (winGroup.userData.dormerDynamicUnits) {
        root.userData.dormerDynamicUnits = winGroup.userData.dormerDynamicUnits;
      }
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
      const modCount = Math.max(1, Math.min(36, Math.round(asset.pvModuleCount ?? 6)));
      const tiltDeg = THREE.MathUtils.clamp(asset.pvTiltDeg ?? 16, 0, 45);
      const tiltRad = THREE.MathUtils.degToRad(tiltDeg);
      const cols =
        modCount <= 4
          ? modCount
          : modCount <= 10
          ? Math.ceil(modCount / 2)
          : modCount <= 18
          ? Math.ceil(modCount / 3)
          : Math.ceil(modCount / 4);
      const rows = Math.ceil(modCount / cols);
      const modW = 1.06;
      const modD = 1.62;
      const gapX = 0.05;
      const gapZ = 0.08 + Math.sin(tiltRad) * 0.18;
      const stepX = modW + gapX;
      const stepZ = modD * Math.cos(tiltRad * 0.45) + gapZ;
      const totalZ = (rows - 1) * stepZ;

      const pvContainer = new THREE.Group();
      pvContainer.userData.isPvArrayContainer = true;

      let placed = 0;
      for (let r = 0; r < rows; r++) {
        const remaining = modCount - placed;
        const colsInRow = Math.min(cols, remaining);
        const rowW = (colsInRow - 1) * stepX;
        const pz = -totalZ / 2 + r * stepZ;

        // Aluminum sub-rail under each row
        if (colsInRow > 0) {
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(colsInRow * stepX - 0.08, 0.032, 0.045),
            MAT.brushedSteel
          );
          rail.position.set(0, 0.06, pz);
          pvContainer.add(rail);
        }

        for (let c = 0; c < colsInRow; c++) {
          const px = -rowW / 2 + c * stepX;
          const py = 0.09 + Math.sin(tiltRad) * (modD * 0.38);

          const modGrp = new THREE.Group();
          modGrp.position.set(px, py, pz);
          modGrp.rotation.x = tiltRad;

          const frame = new THREE.Mesh(
            new RoundedBoxGeometry(modW, 0.038, modD, 2, 0.006),
            MAT.darkMetal
          );
          const cell = new THREE.Mesh(
            new THREE.BoxGeometry(modW - 0.05, 0.042, modD - 0.05),
            MAT.solarCell
          );
          // Subtle silver cell grid busbars
          const busBarL = new THREE.Mesh(
            new THREE.BoxGeometry(0.008, 0.044, modD - 0.08),
            MAT.brushedSteel
          );
          busBarL.position.x = -modW * 0.22;
          const busBarR = busBarL.clone();
          busBarR.position.x = modW * 0.22;

          modGrp.add(frame, cell, busBarL, busBarR);

          // Rear support leg when tilted > 5°
          if (tiltDeg > 5) {
            const strutH = Math.max(0.06, Math.sin(tiltRad) * modD * 0.72);
            const strut = new THREE.Mesh(
              new THREE.CylinderGeometry(0.014, 0.016, strutH, 10),
              MAT.brushedSteel
            );
            strut.position.set(px, strutH / 2 + 0.02, pz - modD * 0.34);
            pvContainer.add(strut);
          }

          pvContainer.add(modGrp);
          placed++;
        }
      }
      root.add(pvContainer);
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
      const sc = asset.sofaConfig || {};
      const shape = sc.shape || 'l_right';
      const hasOttoman = Boolean(sc.hasOttoman);
      const showTableAndRug = sc.showCoffeeTableAndRug !== false;

      const totalW = THREE.MathUtils.clamp(
        asset.customLength ?? asset.customWidth ?? (shape === 'single' ? 2.25 : shape === 'u_shape' ? 3.25 : 2.85),
        1.4,
        4.6
      );
      const totalD = THREE.MathUtils.clamp(
        asset.customDepth ?? sc.depth ?? (shape === 'single' ? 1.02 : shape === 'u_shape' ? 2.15 : 1.95),
        0.85,
        3.2
      );
      const seatDepth = Math.min(0.98, totalD * (shape === 'single' ? 0.94 : 0.48));
      const chaiseW = Math.min(1.05, Math.max(0.78, totalW * 0.33));

      addContactShadow(root, totalW + 0.25, totalD + 0.25);

      const fabricMat = sc.fabricColor
        ? new THREE.MeshStandardMaterial({
            color: new THREE.Color(sc.fabricColor),
            roughness: 0.88,
            metalness: 0.02,
          })
        : MAT.boucleFabric;

      const accentPillowMat = sc.cushionColor
        ? new THREE.MeshStandardMaterial({
            color: new THREE.Color(sc.cushionColor),
            roughness: 0.82,
            metalness: 0.02,
          })
        : MAT.terracottaCushion;

      if (showTableAndRug) {
        const rug = new THREE.Mesh(
          new RoundedBoxGeometry(totalW + 0.35, 0.02, totalD + 0.45, 3, 0.008),
          MAT.travertine
        );
        rug.position.set(0, 0.01, 0.08);
        root.add(rug);
      }

      const backZ = -totalD / 2 + seatDepth / 2;
      // Main sofa bench along the back
      const mainSeat = new THREE.Mesh(
        new RoundedBoxGeometry(totalW, 0.38, seatDepth, 6, 0.065),
        fabricMat
      );
      mainSeat.position.set(0, 0.21, backZ);

      // Backrest along the full width
      const back = new THREE.Mesh(
        new RoundedBoxGeometry(totalW, 0.44, 0.22, 6, 0.065),
        fabricMat
      );
      back.position.set(0, 0.56, -totalD / 2 + 0.12);
      root.add(mainSeat, back);

      // Left / Right Chaise Longue wings depending on shape ('single' | 'l_left' | 'l_right' | 'u_shape')
      if (shape === 'l_right' || shape === 'u_shape') {
        const chaiseR = new THREE.Mesh(
          new RoundedBoxGeometry(chaiseW, 0.38, totalD, 6, 0.065),
          fabricMat
        );
        chaiseR.position.set(totalW / 2 - chaiseW / 2, 0.21, 0);
        const armR = new THREE.Mesh(
          new RoundedBoxGeometry(0.22, 0.52, totalD * 0.72, 5, 0.055),
          fabricMat
        );
        armR.position.set(totalW / 2 - 0.1, 0.28, -totalD * 0.12);
        root.add(chaiseR, armR);
      } else {
        const armR = new THREE.Mesh(
          new RoundedBoxGeometry(0.22, 0.52, seatDepth, 5, 0.055),
          fabricMat
        );
        armR.position.set(totalW / 2 - 0.1, 0.28, backZ);
        root.add(armR);
      }

      if (shape === 'l_left' || shape === 'u_shape') {
        const chaiseL = new THREE.Mesh(
          new RoundedBoxGeometry(chaiseW, 0.38, totalD, 6, 0.065),
          fabricMat
        );
        chaiseL.position.set(-totalW / 2 + chaiseW / 2, 0.21, 0);
        const armL = new THREE.Mesh(
          new RoundedBoxGeometry(0.22, 0.52, totalD * 0.72, 5, 0.055),
          fabricMat
        );
        armL.position.set(-totalW / 2 + 0.1, 0.28, -totalD * 0.12);
        root.add(chaiseL, armL);
      } else {
        const armL = new THREE.Mesh(
          new RoundedBoxGeometry(0.22, 0.52, seatDepth, 5, 0.055),
          fabricMat
        );
        armL.position.set(-totalW / 2 + 0.1, 0.28, backZ);
        root.add(armL);
      }

      // Optional Matching Ottoman / Hocker in front or alongside the sofa
      if (hasOttoman) {
        const ottoW = Math.min(0.92, totalW * 0.34);
        const ottoD = Math.min(0.72, Math.max(0.55, totalD * 0.36));
        const ottoX =
          shape === 'l_right'
            ? -totalW * 0.2
            : shape === 'l_left'
            ? totalW * 0.2
            : 0;
        const ottoZ =
          shape === 'single'
            ? totalD / 2 + ottoD * 0.68
            : totalD / 2 - ottoD * 0.45;
        const ottoman = new THREE.Mesh(
          new RoundedBoxGeometry(ottoW, 0.38, ottoD, 6, 0.065),
          fabricMat
        );
        ottoman.position.set(ottoX, 0.2, ottoZ);
        const ottoTray = new THREE.Mesh(
          new RoundedBoxGeometry(ottoW * 0.48, 0.025, ottoD * 0.52, 3, 0.008),
          MAT.oakWood
        );
        ottoTray.position.set(ottoX, 0.4, ottoZ);
        root.add(ottoman, ottoTray);
      }

      // Plush throw pillows along the backrest
      const pillowZ = -totalD / 2 + 0.28;
      const pillow1 = new THREE.Mesh(
        new RoundedBoxGeometry(0.42, 0.36, 0.14, 4, 0.05),
        accentPillowMat
      );
      pillow1.position.set(-totalW * 0.32, 0.54, pillowZ);
      pillow1.rotation.z = 0.16;
      const pillow2 = new THREE.Mesh(
        new RoundedBoxGeometry(0.42, 0.36, 0.14, 4, 0.05),
        MAT.sageCushion
      );
      pillow2.position.set(0, 0.54, pillowZ);
      pillow2.rotation.z = -0.08;
      const pillow3 = new THREE.Mesh(
        new RoundedBoxGeometry(0.44, 0.36, 0.14, 4, 0.05),
        accentPillowMat
      );
      pillow3.position.set(totalW * 0.32, 0.54, pillowZ);
      pillow3.rotation.z = -0.14;
      root.add(pillow1, pillow2, pillow3);

      // Optional Sculpted Coffee Table + Vase + Art Book
      if (showTableAndRug && !hasOttoman) {
        const tableX =
          shape === 'l_right' ? -totalW * 0.16 : shape === 'l_left' ? totalW * 0.16 : 0;
        const tableZ = shape === 'single' ? totalD / 2 + 0.42 : totalD * 0.18;
        const coffeeTable = new THREE.Mesh(
          new THREE.CylinderGeometry(0.48, 0.42, 0.34, 32),
          MAT.oakWood
        );
        coffeeTable.position.set(tableX, 0.18, tableZ);
        const book = new THREE.Mesh(
          new RoundedBoxGeometry(0.26, 0.035, 0.2, 2, 0.005),
          MAT.anthracite
        );
        book.position.set(tableX - 0.08, 0.365, tableZ + 0.02);
        book.rotation.y = 0.3;
        const vase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.07, 0.21, 20),
          MAT.travertine
        );
        vase.position.set(tableX + 0.11, 0.45, tableZ - 0.06);
        root.add(coffeeTable, book, vase);
      }
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

    case 'bathroom_vanity_sink': {
      addContactShadow(root, 1.4, 0.62);
      const cabinet = new THREE.Mesh(
        new RoundedBoxGeometry(1.3, 0.52, 0.52, 4, 0.02),
        MAT.oakWood
      );
      cabinet.position.set(0, 0.62, 0);
      const counterTop = new THREE.Mesh(
        new RoundedBoxGeometry(1.34, 0.04, 0.54, 3, 0.01),
        MAT.travertine
      );
      counterTop.position.set(0, 0.9, 0);
      for (const sx of [-0.34, 0.34]) {
        const basin = new THREE.Mesh(
          new RoundedBoxGeometry(0.44, 0.13, 0.34, 4, 0.04),
          MAT.matteWhite
        );
        basin.position.set(sx, 0.98, 0.03);
        const faucetStem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.016, 0.018, 0.22, 16),
          MAT.darkMetal
        );
        faucetStem.position.set(sx, 1.04, -0.17);
        const faucetSpout = new THREE.Mesh(
          new THREE.BoxGeometry(0.022, 0.022, 0.14),
          MAT.darkMetal
        );
        faucetSpout.position.set(sx, 1.13, -0.11);
        root.add(basin, faucetStem, faucetSpout);
      }
      const mirrorBackGlow = new THREE.Mesh(
        new RoundedBoxGeometry(1.24, 0.78, 0.02, 3, 0.01),
        bulbMat
      );
      mirrorBackGlow.position.set(0, 1.54, -0.24);
      const mirrorGlass = new THREE.Mesh(
        new RoundedBoxGeometry(1.18, 0.72, 0.025, 3, 0.01),
        glassMat
      );
      mirrorGlass.position.set(0, 1.54, -0.225);
      root.add(cabinet, counterTop, mirrorBackGlow, mirrorGlass);
      root.userData.bulbMesh = mirrorBackGlow;
      root.userData.lightEmissionOffsetY = 1.5;
      break;
    }

    case 'wardrobe_sliding_white': {
      addContactShadow(root, 2.15, 0.68);
      const mainCorpus = new THREE.Mesh(
        new RoundedBoxGeometry(1.4, 2.16, 0.6, 4, 0.02),
        MAT.matteWhite
      );
      mainCorpus.position.set(-0.32, 1.08, 0);
      const doorPanel = new THREE.Mesh(
        new RoundedBoxGeometry(0.66, 2.08, 0.025, 3, 0.008),
        MAT.warmWhite
      );
      doorPanel.position.set(-0.65, 1.08, 0.305);
      const oakDoor = new THREE.Mesh(
        new RoundedBoxGeometry(0.66, 2.08, 0.025, 3, 0.008),
        MAT.oakWood
      );
      oakDoor.position.set(0.01, 1.08, 0.312);
      const benchNiche = new THREE.Mesh(
        new RoundedBoxGeometry(0.68, 0.46, 0.58, 3, 0.015),
        MAT.oakWood
      );
      benchNiche.position.set(0.69, 0.23, 0);
      const backSlats = new THREE.Mesh(
        new RoundedBoxGeometry(0.66, 1.68, 0.06, 2, 0.01),
        MAT.oakWood
      );
      backSlats.position.set(0.69, 1.3, -0.25);
      const cushion = new THREE.Mesh(
        new RoundedBoxGeometry(0.64, 0.06, 0.52, 3, 0.02),
        MAT.anthracite
      );
      cushion.position.set(0.69, 0.48, 0.02);
      root.add(mainCorpus, doorPanel, oakDoor, benchNiche, backSlats, cushion);
      break;
    }

    case 'sideboard_lowboard_oak': {
      addContactShadow(root, 2.25, 0.52);
      const body = new THREE.Mesh(
        new RoundedBoxGeometry(2.16, 0.48, 0.44, 4, 0.02),
        MAT.oakWood
      );
      body.position.y = 0.4;
      const topPlate = new THREE.Mesh(
        new RoundedBoxGeometry(2.18, 0.03, 0.46, 3, 0.008),
        MAT.anthracite
      );
      topPlate.position.y = 0.655;
      for (const lx of [-0.92, 0, 0.92]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, 0.16, 0.38),
          MAT.darkMetal
        );
        leg.position.set(lx, 0.08, 0);
        root.add(leg);
      }
      const vaseTall = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.085, 0.28, 20),
        MAT.travertine
      );
      vaseTall.position.set(-0.68, 0.81, 0);
      const artFrame = new THREE.Mesh(
        new RoundedBoxGeometry(0.48, 0.58, 0.025, 2, 0.006),
        MAT.boucleFabric
      );
      artFrame.position.set(0.45, 0.96, -0.14);
      artFrame.rotation.x = -0.12;
      root.add(body, topPlate, vaseTall, artFrame);
      break;
    }

    case 'wall_shelf_bookcase': {
      addContactShadow(root, 2.45, 0.48);
      const backBoard = new THREE.Mesh(
        new RoundedBoxGeometry(2.36, 2.12, 0.04, 3, 0.01),
        MAT.oakWood
      );
      backBoard.position.set(0, 1.06, -0.18);
      const lowerCab = new THREE.Mesh(
        new RoundedBoxGeometry(2.36, 0.52, 0.4, 3, 0.015),
        MAT.matteWhite
      );
      lowerCab.position.set(0, 0.26, 0);
      root.add(backBoard, lowerCab);
      for (let r = 0; r < 4; r++) {
        const shelf = new THREE.Mesh(
          new THREE.BoxGeometry(2.34, 0.03, 0.36),
          MAT.oakWood
        );
        shelf.position.set(0, 0.88 + r * 0.38, -0.02);
        root.add(shelf);
      }
      for (const vx of [-1.16, -0.38, 0.38, 1.16]) {
        const divider = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 1.58, 0.36),
          MAT.oakWood
        );
        divider.position.set(vx, 1.32, -0.02);
        root.add(divider);
      }
      const ledStrip = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.018, 0.04),
        bulbMat
      );
      ledStrip.position.set(0, 1.62, 0.08);
      root.add(ledStrip);
      root.userData.bulbMesh = ledStrip;
      root.userData.lightEmissionOffsetY = 1.6;
      break;
    }

    case 'coffee_table_set': {
      addContactShadow(root, 1.15, 0.88);
      const tableBig = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.035, 32),
        MAT.oakWood
      );
      tableBig.position.set(-0.16, 0.41, 0);
      const baseBig = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.36, 0.39, 24, 1, true),
        MAT.darkMetal
      );
      baseBig.position.set(-0.16, 0.2, 0);
      const tableSmall = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.03, 28),
        MAT.anthracite
      );
      tableSmall.position.set(0.24, 0.33, 0.14);
      const baseSmall = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.25, 0.31, 20, 1, true),
        MAT.darkMetal
      );
      baseSmall.position.set(0.24, 0.155, 0.14);
      root.add(tableBig, baseBig, tableSmall, baseSmall);
      break;
    }

    case 'cozy_armchair_reading': {
      addContactShadow(root, 1.15, 1.15);
      const seat = new THREE.Mesh(
        new RoundedBoxGeometry(0.78, 0.36, 0.74, 5, 0.08),
        MAT.boucleFabric
      );
      seat.position.set(-0.12, 0.32, -0.08);
      const backRest = new THREE.Mesh(
        new RoundedBoxGeometry(0.76, 0.58, 0.22, 5, 0.08),
        MAT.boucleFabric
      );
      backRest.position.set(-0.12, 0.68, -0.36);
      backRest.rotation.x = -0.18;
      const ottoman = new THREE.Mesh(
        new RoundedBoxGeometry(0.54, 0.32, 0.42, 5, 0.07),
        MAT.boucleFabric
      );
      ottoman.position.set(-0.12, 0.18, 0.52);
      const lampBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 0.04, 24),
        MAT.travertine
      );
      lampBase.position.set(0.42, 0.02, -0.35);
      const lampPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.016, 1.62, 16),
        MAT.darkMetal
      );
      lampPole.position.set(0.42, 0.83, -0.35);
      const shade = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 24, 16),
        bulbMat
      );
      shade.position.set(0.24, 1.56, -0.18);
      root.add(seat, backRest, ottoman, lampBase, lampPole, shade);
      root.userData.bulbMesh = shade;
      root.userData.lightEmissionOffsetY = 1.55;
      break;
    }

    case 'staircase_oak_glass':
    case 'staircase_spiral_steel':
    case 'staircase_curved_landing':
    case 'staircase_u_podest':
    case 'staircase_floating_cantilever':
    case 'staircase_double_winder': {
      const sc = asset.stairConfig || {};
      const defaultShape =
        asset.catalogId === 'staircase_spiral_steel'
          ? 'spiral'
          : asset.catalogId === 'staircase_double_winder'
          ? 'double_winder_c_left'
          : asset.catalogId === 'staircase_curved_landing'
          ? 'half_s_curve'
          : asset.catalogId === 'staircase_u_podest'
          ? 'u_podest'
          : asset.catalogId === 'staircase_floating_cantilever'
          ? 'floating_cantilever'
          : 'straight';
      const shape = sc.shape || defaultShape;
      const underClosure =
        sc.underStairClosure ||
        (asset.catalogId === 'staircase_curved_landing' ? 'walled_closed' : 'open');
      const railingSide =
        sc.railingSide ||
        (shape === 'floating_cantilever' ? 'right' : 'both');
      const railingStyle = sc.railingStyle || 'glass';
      const riserStyle =
        sc.riserStyle ||
        (shape === 'floating_cantilever'
          ? 'open'
          : underClosure !== 'open'
          ? 'closed_white'
          : 'open');
      const treadMat =
        sc.treadMaterial === 'walnut'
          ? MAT.walnutWood
          : sc.treadMaterial === 'anthracite_stone'
          ? MAT.anthracite
          : sc.treadMaterial === 'travertine'
          ? MAT.travertine
          : MAT.oakWood;

      // Inset 3D stair width & run by 3cm inside the nominal 2D bounding box so treads/stringers/railings
      // never protrude through exterior or interior walls when placed flush wall-to-wall!
      const rawStairW = THREE.MathUtils.clamp(sc.width ?? asset.customWidth ?? 1.06, 0.65, 6.5);
      const rawTotalRun = THREE.MathUtils.clamp(sc.totalRun ?? asset.customLength ?? 3.1, 1.1, 8.5);
      const stairW = Math.max(0.65, Math.min(1.35, rawStairW - 0.04));
      const totalRise = THREE.MathUtils.clamp(sc.totalRise ?? (asset.customHeight ?? 2.75), 1.6, 3.8);
      const totalRun = Math.max(1.1, rawTotalRun - 0.04);
      const numSteps = Math.round(THREE.MathUtils.clamp(sc.stepCount ?? 14, 8, 20));
      const stepRise = totalRise / numSteps;
      const stepDepth = Math.max(0.2, totalRun / numSteps);

      if (shape === 'spiral') {
        addContactShadow(root, rawStairW * 0.92, rawTotalRun * 0.92);
        const radius = Math.max(0.52, Math.min(rawStairW, rawTotalRun) * 0.45);
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

      addContactShadow(root, rawStairW * 0.94, rawTotalRun * 0.94);

      const stairContentGroup = new THREE.Group();
      root.add(stairContentGroup);

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
        stairContentGroup.add(landingMesh);

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
      } else if (shape === 'u_winder') {
        // 180° Half-space Winder Staircase (Halbgewendelte U-Treppe ohne Zwischenpodest)
        const flightRun = totalRun * 0.55;
        const gapX = stairW * 0.52;
        const nBot = Math.max(3, Math.floor(numSteps * 0.35));
        const nTurn = Math.max(4, Math.floor(numSteps * 0.3));
        const nTop = Math.max(2, numSteps - nBot - nTurn);

        for (let i = 0; i < numSteps; i++) {
          const y = (i + 1) * stepRise;
          if (i < nBot) {
            const t = i / Math.max(1, nBot - 1);
            placements.push({
              x: -gapX,
              y,
              z: -flightRun / 2 + t * (flightRun * 0.72),
              yaw: 0,
              w: stairW * 0.88,
              d: stepDepth * 1.05,
            });
          } else if (i < nBot + nTurn) {
            const k = i - nBot;
            const frac = (k + 0.5) / nTurn;
            const ang = frac * Math.PI; // 0 to 180°
            placements.push({
              x: -Math.cos(ang) * gapX,
              y,
              z: flightRun * 0.25 + Math.sin(ang) * (stairW * 0.65),
              yaw: -ang,
              w: stairW * 0.92,
              d: stepDepth * 1.15,
            });
          } else {
            const k = i - nBot - nTurn;
            const t = k / Math.max(1, nTop - 1);
            placements.push({
              x: gapX,
              y,
              z: flightRun * 0.22 - t * (flightRun * 0.72),
              yaw: Math.PI,
              w: stairW * 0.88,
              d: stepDepth * 1.05,
            });
          }
        }
      } else if (shape === 'l_landing_left' || shape === 'l_landing_right') {
        // 90° L-Shaped Landing Staircase (Podesttreppe 90° L-Form mit Eckpodest)
        const turnDir = shape === 'l_landing_right' ? 1 : -1;
        const splitIdx = Math.floor(numSteps * 0.55);
        const podestY = splitIdx * stepRise;
        const firstRun = totalRun * 0.54;
        const secondRun = totalRun * 0.44;

        for (let i = 0; i < splitIdx; i++) {
          const t = i / Math.max(1, splitIdx - 1);
          placements.push({
            x: 0,
            y: (i + 1) * stepRise,
            z: -firstRun * 0.75 + t * firstRun,
            yaw: 0,
            w: stairW,
            d: stepDepth,
          });
        }

        // Square 90° Corner Landing (Eckpodest)
        const cornerZ = firstRun * 0.25 + stairW * 0.52;
        const cornerLanding = new THREE.Mesh(
          new RoundedBoxGeometry(stairW * 1.02, 0.065, stairW * 1.02, 3, 0.012),
          treadMat
        );
        cornerLanding.position.set(0, podestY, cornerZ);
        stairContentGroup.add(cornerLanding);

        const remSteps = numSteps - splitIdx;
        for (let j = 0; j < remSteps; j++) {
          const t = (j + 1) / Math.max(1, remSteps);
          placements.push({
            x: turnDir * (stairW * 0.52 + t * secondRun),
            y: podestY + (j + 1) * stepRise,
            z: cornerZ,
            yaw: turnDir * (Math.PI / 2),
            w: stairW,
            d: stepDepth,
          });
        }
      } else if (shape === 't_imperial') {
        // Grand T-Shaped Imperial Staircase (Mittelaufgang + Mittelpodest + 2 Seitenläufe nach Links & Rechts)
        const midSteps = Math.max(4, Math.floor(numSteps * 0.55));
        const podestY = midSteps * stepRise;
        const lowerRun = totalRun * 0.52;

        for (let i = 0; i < midSteps; i++) {
          const t = i / Math.max(1, midSteps - 1);
          placements.push({
            x: 0,
            y: (i + 1) * stepRise,
            z: -lowerRun * 0.7 + t * lowerRun,
            yaw: 0,
            w: stairW * 1.25,
            d: stepDepth,
          });
        }

        const podestZ = lowerRun * 0.3 + stairW * 0.55;
        const grandLanding = new THREE.Mesh(
          new RoundedBoxGeometry(stairW * 1.45, 0.07, stairW * 1.05, 3, 0.012),
          treadMat
        );
        grandLanding.position.set(0, podestY, podestZ);
        stairContentGroup.add(grandLanding);

        const upperSteps = Math.max(3, numSteps - midSteps);
        const wingRun = totalRun * 0.42;
        for (const wingSign of [-1, 1]) {
          for (let j = 0; j < upperSteps; j++) {
            const t = (j + 0.8) / upperSteps;
            placements.push({
              x: wingSign * (stairW * 0.72 + t * wingRun),
              y: podestY + (j + 1) * stepRise,
              z: podestZ,
              yaw: wingSign * (Math.PI / 2),
              w: stairW * 0.85,
              d: stepDepth * 0.95,
            });
          }
        }
      } else if (shape === 'curved_arc') {
        // Sweeping Architectural Curved Arc Staircase (Frei geschwungene Bogentreppe)
        const arcRadius = Math.max(1.45, totalRun * 0.58);
        const totalArcAngle = Math.PI * 0.72;
        for (let i = 0; i < numSteps; i++) {
          const u = i / Math.max(1, numSteps - 1);
          const ang = (u - 0.5) * totalArcAngle;
          placements.push({
            x: (Math.cos(ang) - Math.cos(totalArcAngle * 0.5)) * arcRadius * 0.85,
            y: (i + 1) * stepRise,
            z: Math.sin(ang) * arcRadius,
            yaw: -ang,
            w: stairW,
            d: stepDepth * 1.08,
          });
        }
      } else if (
        shape === 'double_winder_c_left' ||
        shape === 'double_winder_c_right' ||
        shape === 'double_winder_s_left' ||
        shape === 'double_winder_s_right' ||
        shape === 'half_s_curve'
      ) {
        // Zweifach gewendelte Innentreppe (Unten UND Oben je ein Viertel / 90° gebogen):
        // - C-Form ('double_winder_c_left' / 'double_winder_c_right'): Unten und oben zur GLEICHEN Raumseite gewendelt
        // - S-Form ('double_winder_s_left' / 'double_winder_s_right' / 'half_s_curve'): Unten und oben mit GLEICHER Laufrichtung (S-Verlauf)
        const isCForm =
          shape === 'double_winder_c_left' || shape === 'double_winder_c_right';
        const botSign =
          shape === 'double_winder_c_right' || shape === 'double_winder_s_right'
            ? 1
            : -1;
        const topSign = isCForm ? botSign : -botSign;

        const botSteps = Math.max(4, Math.round(numSteps * 0.3));
        const topSteps = Math.max(4, Math.round(numSteps * 0.3));
        const midSteps = Math.max(2, numSteps - botSteps - topSteps);
        const midSpanZ = totalRun * 0.48;
        const turnRadius = Math.max(0.68, stairW * 0.88);

        for (let i = 0; i < numSteps; i++) {
          let x = 0;
          let z = 0;
          let yaw = 0;
          let dScale = 1.08;

          if (i < botSteps) {
            // Bottom 90° quarter-turn winder (full 90° turn + lateral entry step)
            const u = (botSteps - i) / botSteps; // 1.0 at bottom step 0 -> 1/botSteps entering straight flight
            const ang = Math.min(Math.PI * 0.5, u * (Math.PI * 0.54));
            const extraLateral = i === 0 ? stepDepth * 0.45 : 0;
            x = botSign * ((1 - Math.cos(ang)) * turnRadius + extraLateral);
            z = -midSpanZ / 2 - Math.sin(ang) * turnRadius;
            yaw = -botSign * ang;
            dScale = 1.22;
          } else if (i < botSteps + midSteps) {
            // Straight central flight
            const mIdx = i - botSteps;
            const uMid = (mIdx + 0.5) / midSteps;
            x = 0;
            z = -midSpanZ / 2 + uMid * midSpanZ;
            yaw = 0;
          } else {
            // Top 90° quarter-turn winder (full 90° turn + lateral exit step)
            const tIdx = i - (botSteps + midSteps) + 1;
            const u = tIdx / topSteps; // 1/topSteps -> 1.0 at top exit step
            const ang = Math.min(Math.PI * 0.5, u * (Math.PI * 0.54));
            const extraLateral = i === numSteps - 1 ? stepDepth * 0.45 : 0;
            x = topSign * ((1 - Math.cos(ang)) * turnRadius + extraLateral);
            z = midSpanZ / 2 + Math.sin(ang) * turnRadius;
            yaw = topSign * ang;
            dScale = 1.22;
          }

          placements.push({
            x,
            y: (i + 1) * stepRise,
            z,
            yaw,
            w: stairW,
            d: stepDepth * dScale,
          });
        }
      } else {
        // Straight, Floating Cantilever, or Single Quarter-Winder (Bottom Left/Right, Top Left/Right)
        const hasBottomCurve =
          shape === 'quarter_bottom_left' || shape === 'quarter_bottom_right';
        const hasTopCurve =
          shape === 'quarter_top_left' || shape === 'quarter_top_right';
        const botDir = shape === 'quarter_bottom_right' ? 1 : -1;
        const topDir = shape === 'quarter_top_left' ? -1 : 1;

        for (let i = 0; i < numSteps; i++) {
          const u = i / Math.max(1, numSteps - 1);
          let x = 0;
          let z = -totalRun / 2 + u * totalRun;
          let yaw = 0;

          if (hasBottomCurve && u < 0.32) {
            const cFrac = (0.32 - u) / 0.32;
            const ang = cFrac * (Math.PI * 0.46);
            x += botDir * Math.sin(ang) * (stairW * 0.72) * cFrac;
            z += (1 - Math.cos(ang)) * 0.42;
            yaw = -botDir * ang * 0.85;
          }
          if (hasTopCurve && u > 0.68) {
            const cFrac = (u - 0.68) / 0.32;
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
        stepGroup.userData.isStairStepGroup = true;
        stepGroup.userData.stepY = p.y;

        // Step Tread (Trittstufe — thicker slab for floating cantilever)
        const treadThickness = shape === 'floating_cantilever' ? 0.072 : 0.052;
        const tread = new THREE.Mesh(
          new RoundedBoxGeometry(p.w, treadThickness, p.d, 3, 0.008),
          treadMat
        );
        stepGroup.add(tread);

        if (shape === 'floating_cantilever') {
          // Concealed wall anchor bracket on the left wall side + warm LED underside strip
          const wallAnchor = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, treadThickness + 0.04, p.d * 0.85),
            MAT.darkMetal
          );
          wallAnchor.position.set(-p.w / 2 + 0.02, 0, 0);
          const ledStrip = new THREE.Mesh(
            new THREE.BoxGeometry(p.w * 0.82, 0.008, 0.024),
            new THREE.MeshBasicMaterial({ color: 0xfde68a })
          );
          ledStrip.position.set(0, -treadThickness / 2 - 0.004, 0);
          stepGroup.add(wallAnchor, ledStrip);
        }

        // Optional Riser (Setzstufe geschlossen)
        if (riserStyle !== 'open' && shape !== 'floating_cantilever') {
          const riser = new THREE.Mesh(
            new THREE.BoxGeometry(p.w - 0.02, stepRise + 0.01, 0.024),
            riserStyle === 'closed_oak' ? treadMat : MAT.warmWhite
          );
          riser.position.set(0, -stepRise / 2, -p.d / 2 + 0.02);
          stepGroup.add(riser);
        }

        // Under-Stair Wall / Cabinet Closure (Wandabschluss unter der Treppe!)
        if (underClosure !== 'open' && shape !== 'floating_cantilever') {
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
        } else if (shape !== 'floating_cantilever') {
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
            glassSeg.userData = { isStairRailing: true, isRailingPostOrPane: true, baseH: 0.9, railX: rx };
            const topHandrail = new THREE.Mesh(
              new RoundedBoxGeometry(0.042, 0.038, p.d + 0.06, 2, 0.008),
              treadMat
            );
            topHandrail.position.set(rx, 0.92, 0);
            topHandrail.rotation.x = -Math.atan2(stepRise, p.d);
            topHandrail.userData = { isStairRailing: true, isHandrailCap: true, baseY: 0.92, railX: rx };
            stepGroup.add(glassSeg, topHandrail);
          } else if (railingStyle === 'solid_parapet') {
            const parapet = new THREE.Mesh(
              new THREE.BoxGeometry(0.065, 0.92, p.d + 0.05),
              MAT.warmWhite
            );
            parapet.position.set(rx, 0.46, 0);
            parapet.userData = { isStairRailing: true, isRailingPostOrPane: true, baseH: 0.92, railX: rx };
            const cap = new THREE.Mesh(
              new RoundedBoxGeometry(0.085, 0.035, p.d + 0.06, 2, 0.008),
              treadMat
            );
            cap.position.set(rx, 0.93, 0);
            cap.rotation.x = -Math.atan2(stepRise, p.d);
            cap.userData = { isStairRailing: true, isHandrailCap: true, baseY: 0.93, railX: rx };
            stepGroup.add(parapet, cap);
          } else {
            // 'steel_rods' or 'oak_handrail'
            const rod = new THREE.Mesh(
              new THREE.CylinderGeometry(0.012, 0.012, 0.92, 10),
              MAT.darkMetal
            );
            rod.position.set(rx, 0.46, 0);
            rod.userData = { isStairRailing: true, isRailingPostOrPane: true, baseH: 0.92, railX: rx };
            const handrail = new THREE.Mesh(
              new RoundedBoxGeometry(0.045, 0.04, p.d + 0.06, 2, 0.008),
              railingStyle === 'oak_handrail' ? treadMat : MAT.darkMetal
            );
            handrail.position.set(rx, 0.92, 0);
            handrail.rotation.x = -Math.atan2(stepRise, p.d);
            handrail.userData = { isStairRailing: true, isHandrailCap: true, baseY: 0.92, railX: rx };
            stepGroup.add(rod, handrail);
          }
        }

        stairContentGroup.add(stepGroup);
      }

      // Fit and center stairContentGroup strictly inside [rawStairW - 0.05, rawTotalRun - 0.05]
      // so L-stairs, U-stairs, winder stairs, and straight stairs never protrude out of room walls in 3D!
      stairContentGroup.updateMatrixWorld(true);
      const stairBox = new THREE.Box3().setFromObject(stairContentGroup);
      if (!stairBox.isEmpty()) {
        const curSpanX = Math.max(0.2, stairBox.max.x - stairBox.min.x);
        const curSpanZ = Math.max(0.2, stairBox.max.z - stairBox.min.z);
        const targetSpanX = Math.max(0.55, rawStairW - 0.05);
        const targetSpanZ = Math.max(0.95, rawTotalRun - 0.05);
        const isMultiFlightShape = shape !== 'straight' && shape !== 'floating_cantilever';
        const scaleX = isMultiFlightShape
          ? targetSpanX / curSpanX
          : Math.min(1, targetSpanX / curSpanX);
        const scaleZ = isMultiFlightShape
          ? targetSpanZ / curSpanZ
          : Math.min(1, targetSpanZ / curSpanZ);
        stairContentGroup.scale.set(scaleX, 1, scaleZ);
        const centerX = (stairBox.min.x + stairBox.max.x) * 0.5 * scaleX;
        const centerZ = (stairBox.min.z + stairBox.max.z) * 0.5 * scaleZ;
        stairContentGroup.position.set(-centerX, 0, -centerZ);
      }
      break;
    }

    // =========================================================================
    // 7. NEUE GARTEN-, FREIZEIT-, GEWÄCHSHAUS-, GARAGEN- & ROLLTOR-ASSETS
    // =========================================================================
    case 'sun_shade_sail': {
      const sailShape = asset.sailShape || 'quad_4mast';
      const corners = getEffectiveSunSailCorners(asset);
      const maxH = Math.max(1.8, asset.customHeight ?? 2.75);
      const lowH = Math.max(1.5, maxH * 0.84);
      const sailColorHex = asset.sailColor || '#f3eee4';

      // Compute bounding box for contact shadow
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (const [cx, cz] of corners) {
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cz < minZ) minZ = cz;
        if (cz > maxZ) maxZ = cz;
      }
      addContactShadow(
        root,
        Math.max(2.0, maxX - minX + 0.4),
        Math.max(2.0, maxZ - minZ + 0.4)
      );

      // Corner heights for hypar tensioning (alternating high/low or high at rear wall for trapezoid_wall)
      const cornerHeights = corners.map((_, idx) => {
        if (sailShape === 'trapezoid_wall') {
          return idx < 2 ? maxH + 0.12 : lowH;
        }
        if (corners.length === 3) {
          return idx === 2 ? lowH : idx === 0 ? maxH : maxH * 0.93;
        }
        return idx % 2 === 0 ? maxH : lowH;
      });

      // Render V4A Stainless Steel Masts (or Wall Anchors for trapezoid_wall rear corners) + Tension Turnbuckles
      corners.forEach(([cx, cz], idx) => {
        const ch = cornerHeights[idx];
        const distFromCenter = Math.hypot(cx, cz) || 1;
        const outDirX = cx / distFromCenter;
        const outDirZ = cz / distFromCenter;
        const mastX = cx + outDirX * 0.16;
        const mastZ = cz + outDirZ * 0.16;

        if (sailShape === 'trapezoid_wall' && idx < 2) {
          // Wall-mounted stainless eye-plate & turnbuckle at the rear wall
          const wallPlate = new THREE.Mesh(
            new RoundedBoxGeometry(0.14, 0.14, 0.025, 2, 0.005),
            MAT.brushedSteel
          );
          wallPlate.position.set(cx, ch, cz - 0.08);
          const cable = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, 0.18, 8),
            MAT.darkMetal
          );
          cable.rotation.x = Math.PI / 2;
          cable.position.set(cx, ch - 0.02, cz - 0.02);
          root.add(wallPlate, cable);
        } else {
          const mast = new THREE.Mesh(
            new THREE.CylinderGeometry(0.032, 0.044, ch + 0.08, 16),
            MAT.brushedSteel
          );
          mast.position.set(mastX, (ch + 0.08) / 2, mastZ);
          mast.rotation.z = -outDirX * 0.065;
          mast.rotation.x = outDirZ * 0.065;
          mast.castShadow = true;

          const foot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.095, 0.11, 0.04, 16),
            MAT.darkMetal
          );
          foot.position.set(mastX, 0.02, mastZ);

          // Stainless steel tension cable from sail corner to mast top
          const cableLen = Math.hypot(mastX - cx, mastZ - cz, 0.04);
          const cable = new THREE.Mesh(
            new THREE.CylinderGeometry(0.007, 0.007, cableLen, 8),
            MAT.brushedSteel
          );
          cable.position.set((cx + mastX) / 2, ch, (cz + mastZ) / 2);
          cable.rotation.z = Math.PI / 2;
          cable.rotation.y = -Math.atan2(mastZ - cz, mastX - cx);

          root.add(mast, foot, cable);
        }
      });

      // Build Custom Tensioned Hypar Sail Geometry (with inward catenary edge scallops & 3D saddle curvature)
      const segs = 16;
      const positions: number[] = [];
      const indices: number[] = [];

      // Normalize 4 corners (for 3-corner triangle, degenerate P2 & P3 smoothly via barycentric/bilinear mapping)
      const p0 = [corners[0][0], cornerHeights[0], corners[0][1]];
      const p1 = [corners[1][0], cornerHeights[1], corners[1][1]];
      const p2 =
        corners.length >= 4
          ? [corners[2][0], cornerHeights[2], corners[2][1]]
          : [corners[2][0], cornerHeights[2], corners[2][1]];
      const p3 =
        corners.length >= 4
          ? [corners[3][0], cornerHeights[3], corners[3][1]]
          : [corners[2][0], cornerHeights[2], corners[2][1]];

      const centerX = corners.reduce((acc, c) => acc + c[0], 0) / corners.length;
      const centerZ = corners.reduce((acc, c) => acc + c[1], 0) / corners.length;

      for (let iy = 0; iy <= segs; iy++) {
        const v = iy / segs;
        for (let ix = 0; ix <= segs; ix++) {
          const u = ix / segs;
          // Bilinear interpolation of the 4 (or 3) corner points
          const rawX =
            (1 - u) * (1 - v) * p0[0] +
            u * (1 - v) * p1[0] +
            u * v * p2[0] +
            (1 - u) * v * p3[0];
          const rawY =
            (1 - u) * (1 - v) * p0[1] +
            u * (1 - v) * p1[1] +
            u * v * p2[1] +
            (1 - u) * v * p3[1];
          const rawZ =
            (1 - u) * (1 - v) * p0[2] +
            u * (1 - v) * p1[2] +
            u * v * p2[2] +
            (1 - u) * v * p3[2];

          // Inward catenary edge pull (characteristic scalloped tensioned sun sail edges)
          const edgeScallop =
            Math.max(4 * u * (1 - u) * (1 - Math.min(u, 1 - u, v, 1 - v) * 2), 0) * 0.08 +
            4 * v * (1 - v) * (1 - Math.abs(u - 0.5) * 1.4) * 0.05;
          const x = THREE.MathUtils.lerp(rawX, centerX, edgeScallop);
          const z = THREE.MathUtils.lerp(rawZ, centerZ, edgeScallop);

          // Center tension sag
          const centerBell = 16 * u * (1 - u) * v * (1 - v);
          const y = rawY - centerBell * 0.14;

          positions.push(x, y, z);
        }
      }

      for (let iy = 0; iy < segs; iy++) {
        for (let ix = 0; ix < segs; ix++) {
          const a = iy * (segs + 1) + ix;
          const b = iy * (segs + 1) + (ix + 1);
          const c = (iy + 1) * (segs + 1) + (ix + 1);
          const d = (iy + 1) * (segs + 1) + ix;
          indices.push(a, d, b);
          indices.push(b, d, c);
        }
      }

      const sailGeo = new THREE.BufferGeometry();
      sailGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      sailGeo.setIndex(indices);
      sailGeo.computeVertexNormals();

      const sailMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(sailColorHex),
        roughness: 0.76,
        metalness: 0.03,
        side: THREE.DoubleSide,
      });
      const sailMesh = new THREE.Mesh(sailGeo, sailMat);
      sailMesh.castShadow = true;
      sailMesh.receiveShadow = true;
      root.add(sailMesh);
      break;
    }

    case 'outdoor_rattan_corner_lounge': {
      const w = Math.max(1.8, asset.customLength ?? 2.85);
      const d = Math.max(1.5, asset.customWidth ?? 2.35);
      addContactShadow(root, w + 0.25, d + 0.25);

      const rattanMat = new THREE.MeshStandardMaterial({
        color: 0x29303b,
        roughness: 0.68,
        metalness: 0.08,
      });
      const cushionMat = MAT.boucleFabric;

      // Main back wing of L-sofa along -Z
      const sofaDepth = 0.84;
      const backWing = new THREE.Mesh(
        new RoundedBoxGeometry(w, 0.34, sofaDepth, 4, 0.02),
        rattanMat
      );
      backWing.position.set(0, 0.18, -d / 2 + sofaDepth / 2);

      const backRestMain = new THREE.Mesh(
        new RoundedBoxGeometry(w, 0.42, 0.14, 3, 0.02),
        rattanMat
      );
      backRestMain.position.set(0, 0.54, -d / 2 + 0.07);

      const seatCushionMain = new THREE.Mesh(
        new RoundedBoxGeometry(w - 0.18, 0.11, sofaDepth - 0.16, 4, 0.03),
        cushionMat
      );
      seatCushionMain.position.set(0.04, 0.39, -d / 2 + sofaDepth / 2 + 0.04);

      // Left L-leg wing along -X
      const sideLen = d - sofaDepth;
      const sideWing = new THREE.Mesh(
        new RoundedBoxGeometry(sofaDepth, 0.34, sideLen, 4, 0.02),
        rattanMat
      );
      sideWing.position.set(-w / 2 + sofaDepth / 2, 0.18, -d / 2 + sofaDepth + sideLen / 2);

      const backRestSide = new THREE.Mesh(
        new RoundedBoxGeometry(0.14, 0.42, sideLen + sofaDepth, 3, 0.02),
        rattanMat
      );
      backRestSide.position.set(-w / 2 + 0.07, 0.54, 0);

      const seatCushionSide = new THREE.Mesh(
        new RoundedBoxGeometry(sofaDepth - 0.16, 0.11, sideLen - 0.08, 4, 0.03),
        cushionMat
      );
      seatCushionSide.position.set(
        -w / 2 + sofaDepth / 2 + 0.04,
        0.39,
        -d / 2 + sofaDepth + sideLen / 2 - 0.02
      );

      // Plush back cushions & decorative outdoor pillows
      const backCushCount = Math.max(3, Math.round(w / 0.68));
      for (let i = 0; i < backCushCount; i++) {
        const cx = -w / 2 + 0.42 + (i / Math.max(1, backCushCount - 1)) * (w - 0.62);
        const bc = new THREE.Mesh(
          new RoundedBoxGeometry(0.56, 0.36, 0.14, 4, 0.04),
          i % 3 === 1 ? MAT.sageCushion : cushionMat
        );
        bc.position.set(cx, 0.58, -d / 2 + 0.22);
        bc.rotation.x = 0.12;
        root.add(bc);
      }

      // Rattan lounge coffee table with tempered glass top + ottoman stool
      const tableW = Math.min(1.15, w * 0.42);
      const tableD = Math.min(0.68, d * 0.32);
      const coffeeTable = new THREE.Mesh(
        new RoundedBoxGeometry(tableW, 0.36, tableD, 3, 0.015),
        rattanMat
      );
      coffeeTable.position.set(0.28, 0.18, 0.18);
      const tableGlass = new THREE.Mesh(
        new RoundedBoxGeometry(tableW - 0.04, 0.018, tableD - 0.04, 2, 0.005),
        glassMat
      );
      tableGlass.position.set(0.28, 0.37, 0.18);

      const ottoman = new THREE.Mesh(
        new RoundedBoxGeometry(0.52, 0.32, 0.52, 3, 0.015),
        rattanMat
      );
      ottoman.position.set(w * 0.28, 0.16, d * 0.32);
      const ottoCushion = new THREE.Mesh(
        new RoundedBoxGeometry(0.5, 0.09, 0.5, 4, 0.025),
        cushionMat
      );
      ottoCushion.position.set(w * 0.28, 0.36, d * 0.32);

      root.add(
        backWing,
        backRestMain,
        seatCushionMain,
        sideWing,
        backRestSide,
        seatCushionSide,
        coffeeTable,
        tableGlass,
        ottoman,
        ottoCushion
      );
      break;
    }

    case 'outdoor_dining_group_8p': {
      const tableLen = Math.max(1.8, asset.customLength ?? 2.35);
      const tableW = 1.05;
      addContactShadow(root, tableLen + 0.9, 2.35);

      // Slatted Teak & Anthracite Aluminum Dining Table
      const frameTop = new THREE.Mesh(
        new RoundedBoxGeometry(tableLen, 0.05, tableW, 3, 0.012),
        MAT.anthracite
      );
      frameTop.position.y = 0.73;
      const teakInlay = new THREE.Mesh(
        new RoundedBoxGeometry(tableLen - 0.08, 0.025, tableW - 0.08, 2, 0.008),
        MAT.teakWood
      );
      teakInlay.position.y = 0.755;

      for (const lx of [-tableLen / 2 + 0.08, tableLen / 2 - 0.08]) {
        for (const lz of [-tableW / 2 + 0.08, tableW / 2 - 0.08]) {
          const leg = new THREE.Mesh(
            new RoundedBoxGeometry(0.06, 0.73, 0.06, 2, 0.008),
            MAT.anthracite
          );
          leg.position.set(lx, 0.365, lz);
          root.add(leg);
        }
      }
      root.add(frameTop, teakInlay);

      // 6 High-back Outdoor Armchairs (3 on North, 3 on South + 2 at Head ends)
      const chairsPerSide = Math.max(2, Math.min(4, Math.round(tableLen / 0.72)));
      for (let i = 0; i < chairsPerSide; i++) {
        const cx =
          chairsPerSide === 1
            ? 0
            : -tableLen * 0.35 + (i / (chairsPerSide - 1)) * (tableLen * 0.7);
        for (const zDir of [-1, 1]) {
          const chairGrp = new THREE.Group();
          chairGrp.position.set(cx, 0, zDir * 0.74);
          if (zDir < 0) chairGrp.rotation.y = Math.PI;

          const seat = new THREE.Mesh(
            new RoundedBoxGeometry(0.5, 0.06, 0.48, 3, 0.015),
            MAT.anthracite
          );
          seat.position.y = 0.43;
          const cushion = new THREE.Mesh(
            new RoundedBoxGeometry(0.46, 0.05, 0.44, 3, 0.015),
            MAT.boucleFabric
          );
          cushion.position.y = 0.47;
          const back = new THREE.Mesh(
            new RoundedBoxGeometry(0.5, 0.48, 0.05, 3, 0.015),
            MAT.anthracite
          );
          back.position.set(0, 0.68, 0.22);
          back.rotation.x = -0.12;
          const base = new THREE.Mesh(
            new RoundedBoxGeometry(0.48, 0.42, 0.46, 2, 0.01),
            MAT.darkMetal
          );
          base.position.y = 0.21;
          chairGrp.add(seat, cushion, back, base);
          root.add(chairGrp);
        }
      }

      // Center Market Parasol Umbrella
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.03, 2.32, 16),
        MAT.anthracite
      );
      pole.position.y = 1.16;
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(1.55, 0.42, 8),
        MAT.boucleFabric
      );
      canopy.position.y = 2.22;
      root.add(pole, canopy);
      break;
    }

    case 'outdoor_bistro_set': {
      addContactShadow(root, 1.55, 1.15);
      // Round Bistro Table
      const baseDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.26, 0.03, 24),
        MAT.anthracite
      );
      baseDisc.position.y = 0.015;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.038, 0.72, 16),
        MAT.anthracite
      );
      stem.position.y = 0.36;
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(0.39, 0.39, 0.032, 28),
        MAT.teakWood
      );
      top.position.y = 0.73;
      root.add(baseDisc, stem, top);

      // 2 Bistro Chairs left & right
      for (const xSign of [-1, 1]) {
        const chair = new THREE.Group();
        chair.position.set(xSign * 0.56, 0, 0);
        chair.rotation.y = xSign * (Math.PI / 2);
        const seat = new THREE.Mesh(
          new THREE.CylinderGeometry(0.21, 0.21, 0.035, 20),
          MAT.teakWood
        );
        seat.position.y = 0.44;
        const back = new THREE.Mesh(
          new RoundedBoxGeometry(0.42, 0.34, 0.03, 3, 0.01),
          MAT.teakWood
        );
        back.position.set(0, 0.68, -0.19);
        const legs = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.19, 0.43, 12),
          MAT.anthracite
        );
        legs.position.y = 0.215;
        chair.add(seat, back, legs);
        root.add(chair);
      }
      break;
    }

    case 'outdoor_beer_tent_set': {
      const len = Math.max(1.4, asset.customLength ?? 2.2);
      addContactShadow(root, len + 0.2, 1.48);
      const frameGreenMat = new THREE.MeshStandardMaterial({
        color: 0x14532d,
        roughness: 0.42,
        metalness: 0.65,
      });

      // Center Beer Table (Biertisch)
      const tableBoard = new THREE.Mesh(
        new RoundedBoxGeometry(len, 0.034, 0.54, 2, 0.006),
        MAT.oakWood
      );
      tableBoard.position.y = 0.76;
      root.add(tableBoard);
      for (const lx of [-len * 0.36, len * 0.36]) {
        const legFrame = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.75, 0.46),
          frameGreenMat
        );
        legFrame.position.set(lx, 0.375, 0);
        root.add(legFrame);
      }

      // 2 Beer Benches (Bierbänke) front & back
      for (const zSign of [-1, 1]) {
        const benchZ = zSign * 0.52;
        const benchBoard = new THREE.Mesh(
          new RoundedBoxGeometry(len, 0.032, 0.27, 2, 0.005),
          MAT.oakWood
        );
        benchBoard.position.set(0, 0.46, benchZ);
        root.add(benchBoard);
        for (const lx of [-len * 0.36, len * 0.36]) {
          const benchLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.028, 0.45, 0.23),
            frameGreenMat
          );
          benchLeg.position.set(lx, 0.225, benchZ);
          root.add(benchLeg);
        }
      }
      break;
    }

    case 'climbing_play_tower': {
      addContactShadow(root, 3.9, 3.2);
      const towerCenterX = -0.75;
      const halfTower = 0.58; // 1.16m x 1.16m tower footprint
      const postH = 2.32;
      const deckY = 1.22;

      // 1. 4 Corner Timber Posts (9x9cm) with galvanized post bases
      for (const dx of [-halfTower, halfTower]) {
        for (const dz of [-halfTower, halfTower]) {
          const px = towerCenterX + dx;
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, postH, 0.09),
            MAT.teakWood
          );
          post.position.set(px, postH / 2, dz);
          post.castShadow = true;
          const baseShoe = new THREE.Mesh(
            new THREE.BoxGeometry(0.11, 0.08, 0.11),
            MAT.brushedSteel
          );
          baseShoe.position.set(px, 0.04, dz);
          root.add(post, baseShoe);
        }
      }

      // 2. Sandbox Frame at Ground Level (y = 0..0.20m) + Sand Fill + Corner Seats
      const sbWallT = 0.045;
      const sbSpan = halfTower * 2 + 0.08;
      for (const sz of [-halfTower, halfTower]) {
        const boardZ = new THREE.Mesh(
          new RoundedBoxGeometry(sbSpan, 0.2, sbWallT, 2, 0.008),
          MAT.teakWood
        );
        boardZ.position.set(towerCenterX, 0.1, sz);
        root.add(boardZ);
      }
      for (const sx of [-halfTower, halfTower]) {
        const boardX = new THREE.Mesh(
          new RoundedBoxGeometry(sbWallT, 0.2, sbSpan, 2, 0.008),
          MAT.teakWood
        );
        boardX.position.set(towerCenterX + sx, 0.1, 0);
        root.add(boardX);
      }
      const sandFill = new THREE.Mesh(
        new THREE.BoxGeometry(halfTower * 2 - 0.04, 0.14, halfTower * 2 - 0.04),
        new THREE.MeshStandardMaterial({ color: 0xe6ccb2, roughness: 0.92 })
      );
      sandFill.position.set(towerCenterX, 0.07, 0);
      root.add(sandFill);

      // 3. Elevated Platform Deck at y = 1.22m with support joists
      const deck = new THREE.Mesh(
        new RoundedBoxGeometry(sbSpan + 0.04, 0.065, sbSpan + 0.04, 2, 0.012),
        MAT.oakWood
      );
      deck.position.set(towerCenterX, deckY, 0);
      deck.castShadow = true;
      deck.receiveShadow = true;
      root.add(deck);

      // 4. Safety Picket Railings around Platform (West closed, East closed above swing, North open on right for climbing wall, South open in center for slide)
      const railTopY = deckY + 0.64;
      const railBotY = deckY + 0.12;
      const addPicketFence = (
        x1: number,
        z1: number,
        x2: number,
        z2: number,
        picketCount: number
      ) => {
        const len = Math.hypot(x2 - x1, z2 - z1);
        const mx = (x1 + x2) / 2;
        const mz = (z1 + z2) / 2;
        const ang = Math.atan2(z2 - z1, x2 - x1);
        const fenceGrp = new THREE.Group();
        fenceGrp.position.set(mx, 0, mz);
        fenceGrp.rotation.y = -ang;

        const topBar = new THREE.Mesh(
          new RoundedBoxGeometry(len, 0.045, 0.045, 2, 0.008),
          MAT.teakWood
        );
        topBar.position.y = railTopY;
        const botBar = new THREE.Mesh(
          new RoundedBoxGeometry(len, 0.04, 0.04, 2, 0.008),
          MAT.teakWood
        );
        botBar.position.y = railBotY;
        fenceGrp.add(topBar, botBar);

        for (let i = 0; i < picketCount; i++) {
          const t = picketCount === 1 ? 0 : (i / (picketCount - 1) - 0.5) * (len - 0.14);
          const picket = new THREE.Mesh(
            new RoundedBoxGeometry(0.065, 0.56, 0.022, 2, 0.005),
            MAT.oakWood
          );
          picket.position.set(t, (railTopY + railBotY) / 2, 0);
          fenceGrp.add(picket);
        }
        root.add(fenceGrp);
      };

      // West railing (full) & East railing (full)
      addPicketFence(
        towerCenterX - halfTower,
        -halfTower,
        towerCenterX - halfTower,
        halfTower,
        7
      );
      addPicketFence(
        towerCenterX + halfTower,
        -halfTower,
        towerCenterX + halfTower,
        halfTower,
        7
      );
      // North railing (left half closed, right half open for climbing ramp entry)
      addPicketFence(
        towerCenterX - halfTower,
        -halfTower,
        towerCenterX - 0.05,
        -halfTower,
        4
      );
      // South railing (left & right wings leaving 0.52m center opening for the wave slide)
      addPicketFence(
        towerCenterX - halfTower,
        halfTower,
        towerCenterX - 0.28,
        halfTower,
        2
      );
      addPicketFence(
        towerCenterX + 0.28,
        halfTower,
        towerCenterX + halfTower,
        halfTower,
        2
      );

      // 5. Pitched Wooden Gable Roof Sitting Directly on the 4 Posts (eaves at y = 2.28m, ridge at y = 2.76m)
      const eaveY = postH - 0.04;
      const ridgeY = 2.76;
      const roofSlopeW = Math.hypot(halfTower + 0.16, ridgeY - eaveY);
      const roofPitch = Math.atan2(ridgeY - eaveY, halfTower + 0.16);
      const roofLenZ = halfTower * 2 + 0.28;

      const roofSlopeL = new THREE.Mesh(
        new RoundedBoxGeometry(roofSlopeW, 0.045, roofLenZ, 2, 0.008),
        MAT.walnutWood
      );
      roofSlopeL.position.set(
        towerCenterX - (halfTower + 0.12) / 2,
        (eaveY + ridgeY) / 2,
        0
      );
      roofSlopeL.rotation.z = roofPitch;
      roofSlopeL.castShadow = true;

      const roofSlopeR = new THREE.Mesh(
        new RoundedBoxGeometry(roofSlopeW, 0.045, roofLenZ, 2, 0.008),
        MAT.walnutWood
      );
      roofSlopeR.position.set(
        towerCenterX + (halfTower + 0.12) / 2,
        (eaveY + ridgeY) / 2,
        0
      );
      roofSlopeR.rotation.z = -roofPitch;
      roofSlopeR.castShadow = true;

      const ridgeBeam = new THREE.Mesh(
        new RoundedBoxGeometry(0.08, 0.08, roofLenZ + 0.04, 2, 0.01),
        MAT.teakWood
      );
      ridgeBeam.position.set(towerCenterX, ridgeY, 0);

      // Front & Back Gable Tympanum Boards
      for (const gz of [-halfTower, halfTower]) {
        const gableBeam = new THREE.Mesh(
          new THREE.BoxGeometry(halfTower * 2 + 0.06, 0.07, 0.06),
          MAT.teakWood
        );
        gableBeam.position.set(towerCenterX, eaveY, gz);
        const kingPost = new THREE.Mesh(
          new THREE.BoxGeometry(0.07, ridgeY - eaveY, 0.055),
          MAT.teakWood
        );
        kingPost.position.set(towerCenterX, (eaveY + ridgeY) / 2, gz);
        root.add(gableBeam, kingPost);
      }
      root.add(roofSlopeL, roofSlopeR, ridgeBeam);

      // 6. Molded Wave Slide (Wellenrutsche) on South Side (+Z), anchored at deck (z = +0.58, y = 1.22) down to ground (z = +2.18, y = 0.04)
      const slideStartZ = halfTower - 0.02;
      const slideEndZ = 2.16;
      const slideRunZ = slideEndZ - slideStartZ;
      const slideDropY = deckY - 0.04;
      const slideLen = Math.hypot(slideRunZ, slideDropY);
      const slidePitch = Math.atan2(slideDropY, slideRunZ);

      const slideGrp = new THREE.Group();
      slideGrp.position.set(
        towerCenterX,
        deckY / 2 + 0.02,
        (slideStartZ + slideEndZ) / 2
      );
      slideGrp.rotation.x = slidePitch;

      const slideMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.24,
        metalness: 0.08,
      });
      const slideBed = new THREE.Mesh(
        new RoundedBoxGeometry(0.44, 0.045, slideLen, 3, 0.015),
        slideMat
      );
      const cheekL = new THREE.Mesh(
        new RoundedBoxGeometry(0.045, 0.13, slideLen, 2, 0.012),
        slideMat
      );
      cheekL.position.set(-0.22, 0.05, 0);
      const cheekR = cheekL.clone();
      cheekR.position.x = 0.22;
      slideGrp.add(slideBed, cheekL, cheekR);
      root.add(slideGrp);

      // 7. Slanted Climbing Wall & Rung Ladder on North-East Side (-Z), anchored from ground (z = -1.22, y = 0) up to deck (z = -0.58, y = 1.22)
      const rampStartZ = -halfTower + 0.02;
      const rampEndZ = -1.24;
      const rampRunZ = Math.abs(rampEndZ - rampStartZ);
      const rampLen = Math.hypot(rampRunZ, deckY);
      const rampPitch = Math.atan2(deckY, rampRunZ);

      const rampGrp = new THREE.Group();
      rampGrp.position.set(
        towerCenterX + 0.26,
        deckY / 2,
        (rampStartZ + rampEndZ) / 2
      );
      rampGrp.rotation.x = -(Math.PI / 2 - rampPitch);

      const rampBoard = new THREE.Mesh(
        new RoundedBoxGeometry(0.52, 0.045, rampLen, 2, 0.008),
        MAT.oakWood
      );
      rampGrp.add(rampBoard);

      // Colorful climbing stones (Klettersteine)
      const holdColors = [0xef4444, 0xf59e0b, 0x10b981, 0x3b82f6, 0xa855f7];
      for (let hIdx = 0; hIdx < 7; hIdx++) {
        const hz = -rampLen * 0.38 + (hIdx / 6) * (rampLen * 0.76);
        const hx = (hIdx % 2 === 0 ? -1 : 1) * 0.12;
        const hold = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.042, 0),
          new THREE.MeshStandardMaterial({
            color: holdColors[hIdx % holdColors.length],
            roughness: 0.5,
          })
        );
        hold.position.set(hx, 0.035, hz);
        rampGrp.add(hold);
      }
      root.add(rampGrp);

      // 8. Double Swing Beam & Properly Converging A-Frame Support on East Side (+X)
      const beamY = 2.08;
      const towerEastX = towerCenterX + halfTower; // -0.17
      const aFrameX = 1.82;

      // Crossbar mounted across the two East tower posts to support the swing beam at z = 0
      const towerCrossbar = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.095, halfTower * 2 + 0.06),
        MAT.teakWood
      );
      towerCrossbar.position.set(towerEastX, beamY - 0.06, 0);

      // Main horizontal swing beam from towerEastX (-0.17) to aFrameX + 0.12 (1.94)
      const swingBeamLen = aFrameX + 0.14 - towerEastX;
      const swingBeam = new THREE.Mesh(
        new THREE.BoxGeometry(swingBeamLen, 0.095, 0.095),
        MAT.teakWood
      );
      swingBeam.position.set((towerEastX + aFrameX + 0.14) / 2, beamY, 0);
      swingBeam.castShadow = true;

      // Two A-frame legs meeting cleanly at (aFrameX, beamY, 0) and spreading to z = ±0.78 on the ground (y = 0)
      const legFootZ = 0.78;
      const legLen = Math.hypot(beamY + 0.08, legFootZ);
      const legTiltAngle = Math.atan2(legFootZ, beamY);

      const legNorth = new THREE.Mesh(
        new THREE.BoxGeometry(0.085, legLen, 0.085),
        MAT.teakWood
      );
      legNorth.position.set(aFrameX, beamY / 2, -legFootZ / 2);
      legNorth.rotation.x = legTiltAngle; // tilts top (+Y) toward +Z (z = 0)!
      legNorth.castShadow = true;

      const legSouth = new THREE.Mesh(
        new THREE.BoxGeometry(0.085, legLen, 0.085),
        MAT.teakWood
      );
      legSouth.position.set(aFrameX, beamY / 2, legFootZ / 2);
      legSouth.rotation.x = -legTiltAngle; // tilts top (+Y) toward -Z (z = 0)!
      legSouth.castShadow = true;

      // Horizontal A-frame cross brace
      const aBrace = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.07, legFootZ * 1.15),
        MAT.teakWood
      );
      aBrace.position.set(aFrameX, beamY * 0.45, 0);

      root.add(towerCrossbar, swingBeam, legNorth, legSouth, aBrace);

      // 2 Swing Seats with Steel Hanging Rings & Vertical Ropes Reaching the Beam Exactly
      const seatY = 0.48;
      const ropeLen = beamY - seatY;
      for (const sx of [0.46, 1.22]) {
        const seat = new THREE.Mesh(
          new RoundedBoxGeometry(0.42, 0.038, 0.18, 2, 0.01),
          MAT.terracottaCushion
        );
        seat.position.set(sx, seatY, 0);
        seat.castShadow = true;
        for (const rx of [-0.17, 0.17]) {
          const clampRing = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.11, 10),
            MAT.brushedSteel
          );
          clampRing.rotation.z = Math.PI / 2;
          clampRing.position.set(sx + rx, beamY, 0);

          const rope = new THREE.Mesh(
            new THREE.CylinderGeometry(0.007, 0.007, ropeLen, 8),
            MAT.darkMetal
          );
          rope.position.set(sx + rx, seatY + ropeLen / 2, 0);
          root.add(clampRing, rope);
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

    case 'garage_lean_to_greenhouse': {
      const ghW = Math.max(2.0, asset.customLength ?? 3.85);
      const ghD = 2.35;
      const ridgeH = Math.max(1.85, asset.customHeight ?? 2.28);
      const curbH = 0.14;
      const wallH = Math.max(1.35, ridgeH - 0.56);
      const eaveY = curbH + wallH;
      const bayCount = 7;
      const bayW = ghW / bayCount;
      addContactShadow(root, ghW + 0.25, ghD + 0.25);

      const brickCurbMat = new THREE.MeshStandardMaterial({
        color: 0x8b4532,
        roughness: 0.88,
        metalness: 0.04,
      });
      const frameBlackMat = new THREE.MeshStandardMaterial({
        color: 0x171d26,
        roughness: 0.36,
        metalness: 0.72,
      });
      // Frosted milky twin-wall polycarbonate (Doppelstegplatten mit Kondenswasser-Optik)
      const frostedPolyMat = new THREE.MeshPhysicalMaterial({
        color: 0xe2e8f0,
        roughness: 0.44,
        metalness: 0.04,
        transmission: 0.58,
        transparent: true,
        opacity: 0.78,
        ior: 1.48,
      });
      // Clearer upper transom band & roof glazing
      const clearPolyMat = new THREE.MeshPhysicalMaterial({
        color: 0xdbeafe,
        roughness: 0.18,
        metalness: 0.08,
        transmission: 0.78,
        transparent: true,
        opacity: 0.52,
        ior: 1.48,
      });
      const shadeClothMat = new THREE.MeshStandardMaterial({
        color: 0x1e5641,
        roughness: 0.82,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });

      // 1. Red-Brown Clinker Brick Perimeter Curb (Backsteinsockel)
      const curbFront = new THREE.Mesh(
        new RoundedBoxGeometry(ghW + 0.06, curbH, 0.12, 2, 0.01),
        brickCurbMat
      );
      curbFront.position.set(0, curbH / 2, ghD / 2);
      const curbBack = curbFront.clone();
      curbBack.position.z = -ghD / 2;
      const curbLeft = new THREE.Mesh(
        new RoundedBoxGeometry(0.12, curbH, ghD + 0.06, 2, 0.01),
        brickCurbMat
      );
      curbLeft.position.set(-ghW / 2, curbH / 2, 0);
      const curbRight = curbLeft.clone();
      curbRight.position.x = ghW / 2;
      root.add(curbFront, curbBack, curbLeft, curbRight);

      // Individual brick joints along the front curb
      const brickSteps = Math.max(8, Math.round(ghW / 0.24));
      for (let bi = 0; bi < brickSteps; bi++) {
        const bx = -ghW / 2 + ((bi + 0.5) / brickSteps) * ghW;
        const brickBlock = new THREE.Mesh(
          new RoundedBoxGeometry(ghW / brickSteps - 0.018, curbH - 0.02, 0.13, 2, 0.006),
          bi % 2 === 0
            ? brickCurbMat
            : new THREE.MeshStandardMaterial({ color: 0x783827, roughness: 0.9 })
        );
        brickBlock.position.set(bx, curbH / 2, ghD / 2);
        root.add(brickBlock);
      }

      // 2. Slightly Sloped Front & Back Wall Frames (7 Bays) + Frosted Lower Polycarbonate + Clear Upper Transom Band
      const lowerWallH = wallH * 0.78;
      const upperTransomH = wallH * 0.22;
      const transomY = curbH + lowerWallH;

      // Horizontal sill, transom & eave rails
      for (const zSide of [-1, 1]) {
        const zPos = (zSide * ghD) / 2;
        const sillBar = new THREE.Mesh(
          new THREE.BoxGeometry(ghW + 0.04, 0.036, 0.042),
          frameBlackMat
        );
        sillBar.position.set(0, curbH + 0.018, zPos);

        const transomBar = new THREE.Mesh(
          new THREE.BoxGeometry(ghW + 0.02, 0.032, 0.04),
          frameBlackMat
        );
        transomBar.position.set(0, transomY, zPos * 0.985);

        const eaveBar = new THREE.Mesh(
          new THREE.BoxGeometry(ghW + 0.04, 0.042, 0.048),
          frameBlackMat
        );
        eaveBar.position.set(0, eaveY, zPos * 0.975);
        root.add(sillBar, transomBar, eaveBar);
      }

      // 8 vertical mullions forming 7 bays + twin-wall panels & wavy green shade cloth
      for (let i = 0; i <= bayCount; i++) {
        const xPos = -ghW / 2 + i * bayW;
        for (const zSide of [-1, 1]) {
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.036, wallH + 0.02, 0.042),
            frameBlackMat
          );
          post.position.set(xPos, curbH + wallH / 2, (zSide * ghD * 0.985) / 2);
          post.rotation.x = -zSide * 0.025;
          root.add(post);
        }

        if (i < bayCount) {
          const bayCenterX = -ghW / 2 + (i + 0.5) * bayW;
          for (const zSide of [-1, 1]) {
            // Frosted lower twin-wall polycarbonate sheet
            const lowerSheet = new THREE.Mesh(
              new THREE.BoxGeometry(bayW - 0.03, lowerWallH - 0.02, 0.014),
              frostedPolyMat
            );
            lowerSheet.position.set(
              bayCenterX,
              curbH + lowerWallH / 2,
              (zSide * ghD * 0.99) / 2
            );
            lowerSheet.rotation.x = -zSide * 0.025;

            // Upper clear transom sheet
            const upperSheet = new THREE.Mesh(
              new THREE.BoxGeometry(bayW - 0.03, upperTransomH - 0.02, 0.012),
              clearPolyMat
            );
            upperSheet.position.set(
              bayCenterX,
              transomY + upperTransomH / 2,
              (zSide * ghD * 0.978) / 2
            );
            upperSheet.rotation.x = -zSide * 0.025;
            root.add(lowerSheet, upperSheet);

            // Green wavy shade cloth inside the upper transom band
            const waveCloth = new THREE.Mesh(
              new THREE.CylinderGeometry(
                0.045,
                0.045,
                bayW - 0.04,
                10,
                1,
                false,
                0,
                Math.PI
              ),
              shadeClothMat
            );
            waveCloth.rotation.z = Math.PI / 2;
            waveCloth.position.set(
              bayCenterX,
              transomY + 0.02,
              (zSide * (ghD * 0.94)) / 2
            );
            root.add(waveCloth);
          }
        }
      }

      // 3. Left & Right Gable End Walls (Left side fits against the garage + side door)
      for (const xSide of [-1, 1]) {
        const xPos = (xSide * ghW) / 2;
        const sideWallLower = new THREE.Mesh(
          new THREE.BoxGeometry(0.014, lowerWallH - 0.02, ghD - 0.06),
          frostedPolyMat
        );
        sideWallLower.position.set(xPos, curbH + lowerWallH / 2, 0);
        const sideWallUpper = new THREE.Mesh(
          new THREE.BoxGeometry(0.012, upperTransomH - 0.02, ghD - 0.08),
          clearPolyMat
        );
        sideWallUpper.position.set(xPos, transomY + upperTransomH / 2, 0);
        const midSidePost = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, wallH, 0.038),
          frameBlackMat
        );
        midSidePost.position.set(xPos, curbH + wallH / 2, 0);
        root.add(sideWallLower, sideWallUpper, midSidePost);
      }

      // Dark anthracite side entrance door frame on the left (garage) side
      const doorFrame = new THREE.Mesh(
        new RoundedBoxGeometry(0.055, wallH - 0.08, 0.78, 2, 0.008),
        frameBlackMat
      );
      doorFrame.position.set(-ghW / 2 - 0.01, curbH + (wallH - 0.08) / 2, 0.35);
      root.add(doorFrame);

      // 4. Pitched 7-Bay Roof with Ridge Beam & 2 Propped-Open Roof Vents (aufgestellte Dachfenster)
      const halfSpan = (ghD * 0.975) / 2;
      const roofRise = ridgeH - eaveY;
      const slopeLen = Math.hypot(halfSpan, roofRise);
      const roofAngle = Math.atan2(roofRise, halfSpan);

      const ridgeBeam = new THREE.Mesh(
        new THREE.BoxGeometry(ghW + 0.06, 0.05, 0.055),
        frameBlackMat
      );
      ridgeBeam.position.set(0, ridgeH, 0);
      root.add(ridgeBeam);

      for (let i = 0; i <= bayCount; i++) {
        const xPos = -ghW / 2 + i * bayW;
        for (const zSide of [-1, 1]) {
          const rafter = new THREE.Mesh(
            new THREE.BoxGeometry(0.032, 0.038, slopeLen + 0.04),
            frameBlackMat
          );
          rafter.position.set(xPos, (eaveY + ridgeH) / 2, (zSide * halfSpan) / 2);
          rafter.rotation.x = zSide * roofAngle;
          root.add(rafter);
        }

        if (i < bayCount) {
          const bayCenterX = -ghW / 2 + (i + 0.5) * bayW;
          const isVentBay = i === 2 || i === 4; // Bays #3 and #5 have propped-open roof vents like the photo!

          // Back roof slope panel
          const backRoofPane = new THREE.Mesh(
            new THREE.BoxGeometry(bayW - 0.028, 0.014, slopeLen - 0.02),
            clearPolyMat
          );
          backRoofPane.position.set(bayCenterX, (eaveY + ridgeH) / 2, -halfSpan / 2);
          backRoofPane.rotation.x = -roofAngle;
          root.add(backRoofPane);

          if (isVentBay) {
            // Lower half fixed roof pane
            const lowerHalfPane = new THREE.Mesh(
              new THREE.BoxGeometry(bayW - 0.028, 0.014, slopeLen * 0.45),
              clearPolyMat
            );
            lowerHalfPane.position.set(
              bayCenterX,
              eaveY + roofRise * 0.22,
              halfSpan * 0.76
            );
            lowerHalfPane.rotation.x = roofAngle;
            root.add(lowerHalfPane);

            // Propped-open upper roof vent window (aufgestellte Dachluke)
            const ventPivot = new THREE.Group();
            ventPivot.position.set(bayCenterX, ridgeH - 0.02, 0.03);
            ventPivot.rotation.x = roofAngle - 0.34; // Lifted open upward!

            const ventFrame = new THREE.Mesh(
              new RoundedBoxGeometry(bayW - 0.02, 0.028, slopeLen * 0.56, 2, 0.005),
              frameBlackMat
            );
            ventFrame.position.set(0, 0.01, slopeLen * 0.28);
            const ventGlass = new THREE.Mesh(
              new THREE.BoxGeometry(bayW - 0.07, 0.014, slopeLen * 0.5),
              clearPolyMat
            );
            ventGlass.position.set(0, 0.012, slopeLen * 0.28);
            ventPivot.add(ventFrame, ventGlass);
            root.add(ventPivot);
          } else {
            const frontRoofPane = new THREE.Mesh(
              new THREE.BoxGeometry(bayW - 0.028, 0.014, slopeLen - 0.02),
              clearPolyMat
            );
            frontRoofPane.position.set(bayCenterX, (eaveY + ridgeH) / 2, halfSpan / 2);
            frontRoofPane.rotation.x = roofAngle;
            root.add(frontRoofPane);
          }
        }
      }

      // 5. Interior Details Visible Through the Frosted Polycarbonate (Blue Rain Barrel, Terracotta Pots & Plants!)
      const blueBarrelMat = new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        roughness: 0.35,
        metalness: 0.1,
      });
      const rainBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.26, 0.88, 20),
        blueBarrelMat
      );
      rainBarrel.position.set(-ghW * 0.16, curbH + 0.44, 0.22);
      const barrelLid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.29, 0.29, 0.05, 20),
        MAT.darkMetal
      );
      barrelLid.position.set(-ghW * 0.16, curbH + 0.89, 0.22);
      root.add(rainBarrel, barrelLid);

      // Terracotta pot on the front-left inside corner (visible in photo)
      const terraPot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.13, 0.32, 16),
        new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.75 })
      );
      terraPot.position.set(-ghW * 0.41, curbH + 0.16, ghD * 0.34);
      root.add(terraPot);

      // Interior planting bed along the back/right with lush vegetable & tomato plants
      const soilBed = new THREE.Mesh(
        new RoundedBoxGeometry(ghW * 0.54, 0.24, 0.72, 2, 0.01),
        MAT.walnutWood
      );
      soilBed.position.set(ghW * 0.16, curbH + 0.12, -0.36);
      root.add(soilBed);
      for (let px = -0.7; px <= 0.7; px += 0.35) {
        const plant = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.22, 1),
          px > 0 ? MAT.foliageLight : MAT.foliageDark
        );
        plant.position.set(ghW * 0.16 + px, curbH + 0.46, -0.36);
        root.add(plant);
      }

      // Aluminum ladder leaning at the rear-left corner (toward the garage roof, just like in the photo!)
      const ladderGrp = new THREE.Group();
      for (const lx of [-0.18, 0.18]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 2.75, 0.05),
          MAT.brushedSteel
        );
        rail.position.set(lx, 1.375, 0);
        ladderGrp.add(rail);
      }
      for (let ry = 0.28; ry <= 2.55; ry += 0.28) {
        const rung = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 0.36, 10),
          MAT.brushedSteel
        );
        rung.rotation.z = Math.PI / 2;
        rung.position.set(0, ry, 0);
        ladderGrp.add(rung);
      }
      ladderGrp.position.set(-ghW * 0.34, 0, -ghD / 2 - 0.12);
      ladderGrp.rotation.x = 0.14;
      root.add(ladderGrp);

      // Climate status LED bar at the front eave
      const statusLed = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.035, 0.04),
        indicatorMat
      );
      statusLed.position.set(0, eaveY + 0.02, ghD / 2 + 0.02);
      root.add(statusLed);
      break;
    }

    case 'glass_greenhouse': {
      const ghW = Math.max(1.8, asset.customLength ?? 3.15);
      const ghD = 2.35;
      const wallH = 1.55;
      const ridgeH = Math.max(1.9, asset.customHeight ?? 2.38);
      addContactShadow(root, ghW + 0.2, ghD + 0.2);

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

    case 'double_swing_driveway_gate': {
      const gateW = Math.max(2.2, asset.customLength ?? 4.0);
      const gateH = Math.max(1.0, asset.customHeight ?? 1.65);
      addContactShadow(root, gateW + 0.5, 0.45);

      const pillarW = 0.26;
      const pillarL = new THREE.Mesh(
        new RoundedBoxGeometry(pillarW, gateH + 0.16, pillarW, 3, 0.015),
        MAT.anthracite
      );
      pillarL.position.set(-gateW / 2 - pillarW / 2, (gateH + 0.16) / 2, 0);
      const pillarR = pillarL.clone();
      pillarR.position.x = gateW / 2 + pillarW / 2;

      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.048, 0.1, 16),
        indicatorMat
      );
      beacon.position.set(-gateW / 2 - pillarW / 2, gateH + 0.21, 0);
      root.add(pillarL, pillarR, beacon);

      const leafW = (gateW - 0.04) / 2;
      const buildSwingLeaf = (sideSign: -1 | 1) => {
        const pivot = new THREE.Group();
        pivot.position.set(sideSign * (gateW / 2), 0, 0);
        const cx = -sideSign * (leafW / 2);

        const topBar = new THREE.Mesh(
          new RoundedBoxGeometry(leafW - 0.02, 0.06, 0.065, 2, 0.008),
          MAT.darkMetal
        );
        topBar.position.set(cx, gateH - 0.03, 0);
        const botBar = topBar.clone();
        botBar.position.y = 0.1;

        const outerStile = new THREE.Mesh(
          new RoundedBoxGeometry(0.06, gateH - 0.06, 0.065, 2, 0.008),
          MAT.darkMetal
        );
        outerStile.position.set(-sideSign * 0.04, gateH / 2 + 0.02, 0);
        const innerStile = outerStile.clone();
        innerStile.position.x = -sideSign * (leafW - 0.04);

        pivot.add(topBar, botBar, outerStile, innerStile);

        // Vertical infill bars + warm wood center accent band
        const barCount = Math.max(6, Math.floor(leafW / 0.13));
        for (let b = 1; b < barCount; b++) {
          const bx = -sideSign * ((b / barCount) * (leafW - 0.08) + 0.04);
          const bar = new THREE.Mesh(
            new THREE.BoxGeometry(0.022, gateH - 0.18, 0.032),
            MAT.anthracite
          );
          bar.position.set(bx, gateH / 2 + 0.03, 0);
          pivot.add(bar);
        }

        const woodBand = new THREE.Mesh(
          new THREE.BoxGeometry(leafW - 0.1, 0.18, 0.042),
          MAT.oakWood
        );
        woodBand.position.set(cx, gateH * 0.52, 0);
        pivot.add(woodBand);
        return pivot;
      };

      const leftLeaf = buildSwingLeaf(-1);
      const rightLeaf = buildSwingLeaf(1);
      if (asset.customOpenPct !== undefined) {
        const ang = (asset.customOpenPct / 100) * (Math.PI * 0.48);
        leftLeaf.rotation.y = ang;
        rightLeaf.rotation.y = -ang;
      }

      root.userData.swingGateLeftLeaf = leftLeaf;
      root.userData.swingGateRightLeaf = rightLeaf;
      root.userData.customOpenPct = asset.customOpenPct;
      root.add(leftLeaf, rightLeaf);
      break;
    }

    case 'entrance_steps_plinth':
    case 'outdoor_stairs_curved_fan':
    case 'outdoor_stairs_pyramid':
    case 'outdoor_stairs_kellertreppe': {
      const ec = asset.exteriorStairConfig || {};
      const defaultExtShape: ExteriorStepsShapeType =
        asset.catalogId === 'outdoor_stairs_curved_fan'
          ? 'curved_fan'
          : asset.catalogId === 'outdoor_stairs_pyramid'
          ? 'pyramid_3side'
          : asset.catalogId === 'outdoor_stairs_kellertreppe'
          ? 'kellertreppe_wall'
          : 'straight';
      const shape = ec.shape || defaultExtShape;
      const w = Math.max(0.85, ec.width ?? asset.customLength ?? 1.75);
      const plinthH = Math.max(
        0.12,
        ec.plinthHeight ??
          asset.customHeight ??
          (asset.catalogId === 'outdoor_stairs_kellertreppe' ? 1.2 : 0.35)
      );
      const stepCount = Math.max(
        1,
        Math.min(8, ec.stepCount ?? Math.max(2, Math.round(plinthH / 0.16)))
      );
      const totalD = Math.max(0.75, ec.depth ?? (0.55 + stepCount * 0.28));
      const material = ec.material || 'travertine';
      const railing =
        ec.railing ||
        (asset.catalogId === 'outdoor_stairs_kellertreppe' ? 'both' : 'none');

      addContactShadow(root, w + 0.35, totalD + 0.35);
      const extGroup = buildExteriorStepsGeometry({
        shape,
        plinthH,
        stepCount,
        stepW: w,
        totalD,
        material,
        railing,
        glassMat,
        baseYOffset: 0,
        extSign: 1,
        zStartOffset: -totalD / 2,
      });
      root.add(extGroup);
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

    case 'fence_chainlink':
    case 'fence_chainlink_anthracite': {
      const isAnthracite = asset.catalogId === 'fence_chainlink_anthracite';
      const len = Math.max(0.8, asset.customLength ?? 3.6);
      const totalH = Math.max(0.6, asset.customHeight ?? 1.25);
      addContactShadow(root, len + 0.08, 0.16);

      const postColorHex = isAnthracite ? 0x1e293b : 0x166534;
      const postMat = new THREE.MeshStandardMaterial({
        color: postColorHex,
        roughness: 0.35,
        metalness: 0.65,
      });

      const bays = Math.max(1, Math.round(len / 2.0));
      const bayW = len / bays;

      // Tubular posts + diagonal end braces (Streben)
      for (let i = 0; i <= bays; i++) {
        const px = -len / 2 + i * bayW;
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.024, totalH + 0.04, 14),
          postMat
        );
        post.position.set(px, (totalH + 0.04) / 2, 0);
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(0.028, 12, 10),
          postMat
        );
        cap.position.set(px, totalH + 0.04, 0);
        root.add(post, cap);
      }

      // Top, middle & bottom horizontal tension wires (Spanndrähte)
      for (const fracY of [0.06, 0.52, 0.96]) {
        const wire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.005, 0.005, len, 8),
          postMat
        );
        wire.rotation.z = Math.PI / 2;
        wire.position.set(0, totalH * fracY, 0);
        root.add(wire);
      }

      // Semi-transparent 3D Diamond Chainlink Wire Mesh
      const meshTex = getChainlinkMeshTexture(isAnthracite ? '#334155' : '#15803d').clone();
      meshTex.needsUpdate = true;
      meshTex.repeat.set(Math.max(1, len * 3.8), Math.max(1, totalH * 3.8));
      const meshMat = new THREE.MeshStandardMaterial({
        map: meshTex,
        alphaMap: meshTex,
        transparent: true,
        alphaTest: 0.15,
        side: THREE.DoubleSide,
        roughness: 0.4,
        metalness: 0.55,
      });
      const meshPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(len - 0.04, totalH - 0.06),
        meshMat
      );
      meshPlane.position.set(0, totalH / 2, 0);
      root.add(meshPlane);
      break;
    }

    case 'road_segment_asphalt': {
      const len = Math.max(1.5, asset.customLength ?? 6.0);
      const roadW = Math.max(2.2, asset.customWidth ?? 3.6);
      const roadH = Math.max(0.03, asset.customHeight ?? 0.06);

      const asphaltMat = new THREE.MeshStandardMaterial({
        color: 0x262930,
        roughness: 0.86,
        metalness: 0.05,
      });
      const curbMat = new THREE.MeshStandardMaterial({
        color: 0x9ca3af,
        roughness: 0.72,
        metalness: 0.04,
      });
      const stripeMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.45,
        emissive: 0xffffff,
        emissiveIntensity: 0.06,
      });

      const roadDeck = new THREE.Mesh(
        new RoundedBoxGeometry(len, roadH, roadW, 2, 0.008),
        asphaltMat
      );
      roadDeck.position.y = roadH / 2;
      root.add(roadDeck);

      // Granite curbstones (Bordsteine) on both sides + drainage gutter
      for (const zSign of [-1, 1]) {
        const curb = new THREE.Mesh(
          new RoundedBoxGeometry(len, roadH + 0.065, 0.16, 2, 0.01),
          curbMat
        );
        curb.position.set(0, (roadH + 0.065) / 2, zSign * (roadW / 2 - 0.08));
        root.add(curb);
      }

      // Dashed white center lane markings (Fahrbahn-Leitlinie)
      const dashCount = Math.max(2, Math.floor(len / 1.1));
      const step = len / dashCount;
      for (let i = 0; i < dashCount; i++) {
        const dx = -len / 2 + (i + 0.5) * step;
        const dash = new THREE.Mesh(
          new THREE.BoxGeometry(step * 0.52, 0.008, 0.11),
          stripeMat
        );
        dash.position.set(dx, roadH + 0.004, 0);
        root.add(dash);
      }
      break;
    }

    case 'sidewalk_segment': {
      const len = Math.max(1.0, asset.customLength ?? 6.0);
      const walkW = Math.max(0.8, asset.customWidth ?? 1.6);
      const walkH = Math.max(0.05, asset.customHeight ?? 0.12);

      const paverMat = new THREE.MeshStandardMaterial({
        color: 0xb8bec6,
        roughness: 0.76,
        metalness: 0.03,
      });
      const curbMat = new THREE.MeshStandardMaterial({
        color: 0x8d949e,
        roughness: 0.68,
        metalness: 0.05,
      });

      const deck = new THREE.Mesh(
        new RoundedBoxGeometry(len, walkH, walkW, 2, 0.01),
        paverMat
      );
      deck.position.y = walkH / 2;
      root.add(deck);

      // Front granite curbstone edge (Hochbordstein)
      const curb = new THREE.Mesh(
        new RoundedBoxGeometry(len, walkH + 0.02, 0.14, 2, 0.008),
        curbMat
      );
      curb.position.set(0, (walkH + 0.02) / 2, walkW / 2 - 0.07);
      root.add(curb);

      // Subtle transverse paver joint lines
      const joints = Math.max(3, Math.floor(len / 0.6));
      for (let i = 1; i < joints; i++) {
        const jx = -len / 2 + (i / joints) * len;
        const seam = new THREE.Mesh(
          new THREE.BoxGeometry(0.012, 0.006, walkW - 0.18),
          MAT.anthracite
        );
        seam.position.set(jx, walkH + 0.003, -0.04);
        root.add(seam);
      }
      break;
    }

    case 'street_lamp_modern_led': {
      const totalH = Math.max(2.4, asset.customHeight ?? 4.2);
      addContactShadow(root, 0.75, 0.75);

      const foundation = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.21, 0.12, 24),
        MAT.anthracite
      );
      foundation.position.y = 0.06;

      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.078, totalH - 0.12, 20),
        MAT.anthracite
      );
      mast.position.y = (totalH - 0.12) / 2 + 0.08;

      // Sleek curved cantilever arm (Auslegerarm)
      const armGroup = new THREE.Group();
      armGroup.position.set(0, totalH - 0.08, 0);
      const armBar = new THREE.Mesh(
        new RoundedBoxGeometry(0.09, 0.055, 0.85, 3, 0.012),
        MAT.anthracite
      );
      armBar.position.set(0, 0.06, 0.38);
      armBar.rotation.x = -0.14;

      const ledHead = new THREE.Mesh(
        new RoundedBoxGeometry(0.24, 0.048, 0.56, 3, 0.012),
        MAT.darkMetal
      );
      ledHead.position.set(0, 0.085, 0.72);

      const ledLens = new THREE.Mesh(
        new THREE.BoxGeometry(0.19, 0.018, 0.46),
        indicatorMat
      );
      ledLens.position.set(0, 0.056, 0.72);

      armGroup.add(armBar, ledHead, ledLens);
      root.add(foundation, mast, armGroup);
      addVolumetricLightFeatures(root, 0.85, totalH - 0.03, 0.018, 4.8, {
        offsetZ: 0.72,
        poolOffsetZ: 0.88,
        showCone: true,
        coneTopRadius: 0.18,
        coneBottomRadius: 2.1,
        coneOpacity: 0.22,
      });
      break;
    }

    case 'street_lamp_classic': {
      const totalH = Math.max(2.2, asset.customHeight ?? 3.8);
      addContactShadow(root, 0.72, 0.72);

      const castIronMat = new THREE.MeshStandardMaterial({
        color: 0x182230,
        roughness: 0.38,
        metalness: 0.75,
      });

      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.22, 0.55, 12),
        castIronMat
      );
      plinth.position.y = 0.275;

      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.028, 12, 24),
        MAT.copperGold
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.55;

      const poleH = totalH - 1.15;
      const flutedPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.046, 0.075, poleH, 16),
        castIronMat
      );
      flutedPole.position.y = 0.55 + poleH / 2;

      const lanternY = 0.55 + poleH;
      const lanternBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.06, 0.08, 6),
        castIronMat
      );
      lanternBase.position.y = lanternY + 0.04;

      const glassCage = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.12, 0.38, 6),
        glassMat
      );
      glassCage.position.y = lanternY + 0.26;

      const warmBulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 16, 16),
        indicatorMat
      );
      warmBulb.position.y = lanternY + 0.25;

      const copperDome = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 0.18, 6),
         castIronMat
      );
      copperDome.position.y = lanternY + 0.52;

      const finial = new THREE.Mesh(
        new THREE.SphereGeometry(0.036, 12, 12),
        MAT.copperGold
      );
      finial.position.y = lanternY + 0.63;

      root.add(plinth, collar, flutedPole, lanternBase, glassCage, warmBulb, copperDome, finial);
      addVolumetricLightFeatures(root, 0.75, lanternY + 0.24, 0.018, 4.4, {
        showCone: true,
        coneTopRadius: 0.14,
        coneBottomRadius: 1.9,
        coneOpacity: 0.2,
      });
      break;
    }

    case 'street_lamp_classic_3head': {
      const totalH = Math.max(2.3, asset.customHeight ?? 3.55);
      addContactShadow(root, 1.05, 1.05);

      const castIronMat = new THREE.MeshStandardMaterial({
        color: 0x182230,
        roughness: 0.36,
        metalness: 0.78,
      });

      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.24, 0.58, 12),
        castIronMat
      );
      plinth.position.y = 0.29;

      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.03, 12, 24),
        MAT.copperGold
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.58;

      const poleH = totalH - 1.25;
      const flutedPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.082, poleH, 16),
        castIronMat
      );
      flutedPole.position.y = 0.58 + poleH / 2;

      const crownY = 0.58 + poleH;
      const crownCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.065, 0.1, 12),
        MAT.copperGold
      );
      crownCollar.position.y = crownY;
      root.add(plinth, collar, flutedPole, crownCollar);

      // Helper to build each ornate hexagonal park lantern head
      const addLanternHead = (hx: number, hy: number, hz: number, scaleHead: number) => {
        const lGrp = new THREE.Group();
        lGrp.position.set(hx, hy, hz);
        lGrp.scale.setScalar(scaleHead);

        const lBase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.055, 0.075, 6),
          castIronMat
        );
        lBase.position.y = 0.035;

        const gCage = new THREE.Mesh(
          new THREE.CylinderGeometry(0.175, 0.11, 0.34, 6),
          glassMat
        );
        gCage.position.y = 0.24;

        // 6 vertical cast-iron lantern ribs
        for (let r = 0; r < 6; r++) {
          const ang = (r / 6) * Math.PI * 2;
          const rib = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, 0.35, 6),
            castIronMat
          );
          rib.position.set(Math.cos(ang) * 0.14, 0.24, Math.sin(ang) * 0.14);
          rib.rotation.z = -Math.cos(ang) * 0.16;
          rib.rotation.x = Math.sin(ang) * 0.16;
          lGrp.add(rib);
        }

        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.072, 16, 16),
          indicatorMat
        );
        bulb.position.y = 0.23;

        const dome = new THREE.Mesh(
          new THREE.ConeGeometry(0.22, 0.16, 6),
          castIronMat
        );
        dome.position.y = 0.48;

        const topFinial = new THREE.Mesh(
          new THREE.SphereGeometry(0.032, 12, 12),
          MAT.copperGold
        );
        topFinial.position.y = 0.58;

        lGrp.add(lBase, gCage, bulb, dome, topFinial);
        root.add(lGrp);
      };

      // Central elevated lantern + 2 symmetrical candelabra scroll arms (or 3-arm radial crown)
      addLanternHead(0, crownY + 0.14, 0, 1.02);

      for (const sideX of [-0.42, 0.42]) {
        const armCurve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(0, crownY - 0.06, 0),
          new THREE.Vector3(sideX * 0.65, crownY - 0.18, 0),
          new THREE.Vector3(sideX, crownY + 0.02, 0)
        );
        const armTube = new THREE.Mesh(
          new THREE.TubeGeometry(armCurve, 12, 0.018, 8, false),
          castIronMat
        );
        const scrollRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.075, 0.012, 10, 20),
          MAT.copperGold
        );
        scrollRing.position.set(sideX * 0.48, crownY - 0.02, 0);
        root.add(armTube, scrollRing);
        addLanternHead(sideX, crownY + 0.02, 0, 0.92);
      }

      addVolumetricLightFeatures(root, 1.15, crownY + 0.26, 0.018, 5.2, {
        showCone: true,
        coneOpacity: 0.18,
        coneHeads: [
          { x: 0, y: crownY + 0.28, z: 0, topRadius: 0.14, bottomRadius: 1.75 },
          { x: -0.42, y: crownY + 0.16, z: 0, topRadius: 0.13, bottomRadius: 1.65 },
          { x: 0.42, y: crownY + 0.16, z: 0, topRadius: 0.13, bottomRadius: 1.65 },
        ],
      });
      break;
    }

    case 'wall_lantern_park_classic': {
      const castIronMat = new THREE.MeshStandardMaterial({
        color: 0x182230,
        roughness: 0.36,
        metalness: 0.78,
      });

      // Ornate wall mounting backplate (Wandkonsole)
      const backPlate = new THREE.Mesh(
        new RoundedBoxGeometry(0.14, 0.28, 0.028, 3, 0.008),
        castIronMat
      );
      backPlate.position.set(0, 0, 0.014);

      const brassMedallion = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.015, 16),
        MAT.copperGold
      );
      brassMedallion.rotation.x = Math.PI / 2;
      brassMedallion.position.set(0, 0.08, 0.026);

      // Curved scroll bracket arm extending to z = 0.24
      const armCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, -0.06, 0.02),
        new THREE.Vector3(0, -0.14, 0.14),
        new THREE.Vector3(0, -0.02, 0.24)
      );
      const armTube = new THREE.Mesh(
        new THREE.TubeGeometry(armCurve, 12, 0.015, 8, false),
        castIronMat
      );
      const scrollOrnament = new THREE.Mesh(
        new THREE.TorusGeometry(0.055, 0.01, 10, 20),
        MAT.copperGold
      );
      scrollOrnament.rotation.y = Math.PI / 2;
      scrollOrnament.position.set(0, -0.03, 0.12);

      // Hexagonal park lantern head matching street_lamp_classic & street_lamp_classic_3head
      const lBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.05, 0.065, 6),
        castIronMat
      );
      lBase.position.set(0, 0.01, 0.24);

      const gCage = new THREE.Mesh(
        new THREE.CylinderGeometry(0.145, 0.095, 0.28, 6),
        glassMat
      );
      gCage.position.set(0, 0.18, 0.24);

      const warmBulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.058, 16, 16),
        indicatorMat
      );
      warmBulb.position.set(0, 0.17, 0.24);

      const dome = new THREE.Mesh(
        new THREE.ConeGeometry(0.185, 0.14, 6),
        castIronMat
      );
      dome.position.set(0, 0.38, 0.24);

      const finial = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 12, 12),
        MAT.copperGold
      );
      finial.position.set(0, 0.46, 0.24);

      root.add(
        backPlate,
        brassMedallion,
        armTube,
        scrollOrnament,
        lBase,
        gCage,
        warmBulb,
        dome,
        finial
      );
      addVolumetricLightFeatures(root, 0.65, 0.15, -1.8, 2.2, {
        offsetZ: 0.24,
        poolOffsetZ: 0.32,
        showCone: true,
        coneTopRadius: 0.11,
        coneBottomRadius: 1.05,
        coneOpacity: 0.18,
      });
      break;
    }

    case 'wall_tv_oled_77': {
      const w = Math.max(0.9, asset.customLength ?? 1.72);
      const h = Math.max(0.55, asset.customHeight ?? 0.98);

      // Ambient Backlight Halo (Ambilight)
      const ambilightPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(w + 0.26, h + 0.22),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      ambilightPlane.position.set(0, 0, 0.008);

      const frame = new THREE.Mesh(
        new RoundedBoxGeometry(w, h, 0.028, 3, 0.006),
        MAT.darkMetal
      );
      frame.position.set(0, 0, 0.024);

      const screenTex = createOledScreenTexture(true, 'OLED 77" · Smart Home Cockpit');
      const screenMat = new THREE.MeshStandardMaterial({
        map: screenTex,
        emissive: 0xffffff,
        emissiveMap: screenTex,
        emissiveIntensity: 0.78,
        roughness: 0.08,
      });
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(w - 0.04, h - 0.04),
        screenMat
      );
      screen.position.set(0, 0, 0.04);
      root.userData.tvScreenMat = screenMat;
      root.add(ambilightPlane, frame, screen);
      break;
    }

    case 'wall_art_framed_triptych': {
      const totalW = Math.max(0.8, asset.customLength ?? 1.65);
      const h = Math.max(0.5, asset.customHeight ?? 0.95);
      const frameW = (totalW - 0.16) / 3;

      const artColors = [0x0f172a, 0xd97706, 0x0284c7];
      for (let i = -1; i <= 1; i++) {
        const fx = i * (frameW + 0.08);
        const outerFrame = new THREE.Mesh(
          new RoundedBoxGeometry(frameW, h, 0.032, 2, 0.005),
          MAT.oakWood
        );
        outerFrame.position.set(fx, 0, 0.018);

        const passepartout = new THREE.Mesh(
          new THREE.PlaneGeometry(frameW - 0.05, h - 0.05),
          MAT.warmWhite
        );
        passepartout.position.set(fx, 0, 0.036);

        const canvasArt = new THREE.Mesh(
          new THREE.PlaneGeometry(frameW - 0.14, h - 0.16),
          new THREE.MeshStandardMaterial({
            color: artColors[i + 1],
            roughness: 0.55,
            metalness: 0.12,
          })
        );
        canvasArt.position.set(fx, 0, 0.039);

        const goldCircle = new THREE.Mesh(
          new THREE.RingGeometry(0.06, 0.11, 24),
          MAT.copperGold
        );
        goldCircle.position.set(fx, (i % 2) * 0.06, 0.042);

        root.add(outerFrame, passepartout, canvasArt, goldCircle);
      }
      break;
    }

    case 'wall_acoustic_wood_panel': {
      const w = THREE.MathUtils.clamp(asset.customLength ?? asset.customWidth ?? 1.2, 0.35, 4.5);
      const h = THREE.MathUtils.clamp(asset.customHeight ?? 2.4, 0.5, 3.2);
      const ac = asset.acousticPanelConfig || {};
      const woodTone = ac.woodTone || 'oak_natural';

      const feltHex = ac.feltColor || '#1e293b';
      const feltMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(feltHex),
        roughness: 0.92,
        metalness: 0.02,
      });

      const feltBacking = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, 0.016),
        feltMat
      );
      feltBacking.position.set(0, h / 2, 0.008);
      root.add(feltBacking);

      const slatColorMap: Record<string, [number, number]> = {
        oak_natural: [0xc89d66, 0xb58852],
        walnut_dark: [0x5c3d28, 0x472d1c],
        ash_light: [0xe3d3b8, 0xd4c1a1],
        teak_warm: [0xa65e2e, 0x8f4e22],
        charcoal_black: [0x27272a, 0x18181b],
      };
      const [colA, colB] = slatColorMap[woodTone] || slatColorMap.oak_natural;
      const slatMatA = new THREE.MeshStandardMaterial({
        color: colA,
        roughness: 0.55,
        metalness: 0.05,
      });
      const slatMatB = new THREE.MeshStandardMaterial({
        color: colB,
        roughness: 0.6,
        metalness: 0.05,
      });

      const slatCount = Math.max(6, Math.floor(w / 0.042));
      const slatSpacing = w / slatCount;
      for (let i = 0; i < slatCount; i++) {
        const sx = -w / 2 + (i + 0.5) * slatSpacing;
        const slat = new THREE.Mesh(
          new THREE.BoxGeometry(slatSpacing * 0.62, h - 0.016, 0.022),
          i % 3 === 0 ? slatMatB : slatMatA
        );
        slat.position.set(sx, h / 2, 0.022);
        root.add(slat);
      }
      break;
    }

    // =========================================================================
    // 8. HAUSTECHNIK & ENERGIE (PV-WECHSELRICHTER, WÄRMEPUMPE, WARMWASSERSPEICHER, ZÄHLERSCHRANK, SMART-HOME-HUB)
    // =========================================================================
    case 'pv_inverter_system': {
      // Wall-mounted PV Hybrid Inverter with heatsink fins, glass status panel, LED bar & DC isolator switch
      const body = new THREE.Mesh(
        new RoundedBoxGeometry(0.64, 0.78, 0.22, 4, 0.025),
        MAT.matteWhite
      );
      body.position.set(0, 0, 0.11);

      const frontGlass = new THREE.Mesh(
        new RoundedBoxGeometry(0.54, 0.46, 0.018, 3, 0.015),
        MAT.darkMetal
      );
      frontGlass.position.set(0, 0.08, 0.22);

      const ledBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.022, 0.01),
        indicatorMat
      );
      ledBar.position.set(0, 0.18, 0.232);

      const dcSwitch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 0.04, 16),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 })
      );
      dcSwitch.rotation.x = Math.PI / 2;
      dcSwitch.position.set(0.18, -0.24, 0.225);

      // Bottom conduit pipes (AC / DC / Smart Meter cables)
      for (const cx of [-0.18, -0.06, 0.06, 0.18]) {
        const conduit = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014, 0.014, 0.28, 12),
          MAT.anthracite
        );
        conduit.position.set(cx, -0.52, 0.08);
        root.add(conduit);
      }

      root.add(body, frontGlass, ledBar, dcSwitch);
      break;
    }

    case 'heat_pump_outdoor_monoblock': {
      addContactShadow(root, 1.38, 0.68);
      // Concrete vibration-damping foundation plinths
      for (const fx of [-0.46, 0.46]) {
        const foot = new THREE.Mesh(
          new RoundedBoxGeometry(0.18, 0.1, 0.52, 2, 0.01),
          MAT.concrete
        );
        foot.position.set(fx, 0.05, 0);
        root.add(foot);
      }

      // Main acoustic monoblock casing (Anthracite + Brushed Alu trim)
      const casing = new THREE.Mesh(
        new RoundedBoxGeometry(1.24, 0.98, 0.48, 4, 0.03),
        MAT.anthracite
      );
      casing.position.set(0, 0.59, 0);

      const topCap = new THREE.Mesh(
        new RoundedBoxGeometry(1.26, 0.045, 0.5, 3, 0.012),
        MAT.brushedSteel
      );
      topCap.position.set(0, 1.09, 0);

      // Left evaporator fan shroud + acoustic owl-wing fan blades
      const fanRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.04, 28),
        MAT.darkMetal
      );
      fanRing.rotation.x = Math.PI / 2;
      fanRing.position.set(-0.22, 0.6, 0.235);

      const fanHub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.06, 18),
        MAT.brushedSteel
      );
      fanHub.rotation.x = Math.PI / 2;
      fanHub.position.set(-0.22, 0.6, 0.245);

      // Louvered grille slats over the fan opening
      for (let s = -4; s <= 4; s++) {
        const slat = new THREE.Mesh(
          new THREE.BoxGeometry(0.72, 0.014, 0.02),
          MAT.brushedSteel
        );
        slat.position.set(-0.22, 0.6 + s * 0.075, 0.252);
        root.add(slat);
      }

      // Right compressor service bay + glowing COP/Status LED strip
      const rightPanel = new THREE.Mesh(
        new RoundedBoxGeometry(0.36, 0.88, 0.02, 2, 0.008),
        MAT.matteWhite
      );
      rightPanel.position.set(0.38, 0.6, 0.238);

      const statusStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.48, 0.012),
        indicatorMat
      );
      statusStrip.position.set(0.22, 0.6, 0.248);

      root.add(casing, topCap, fanRing, fanHub, rightPanel, statusStrip);
      break;
    }

    case 'heat_pump_indoor_unit': {
      addContactShadow(root, 0.78, 0.8);
      // Tall white hydraulic tower cabinet
      const tower = new THREE.Mesh(
        new RoundedBoxGeometry(0.62, 1.82, 0.65, 4, 0.025),
        MAT.matteWhite
      );
      tower.position.set(0, 0.91, 0);

      // Black glass touch controller display + LED temperature ring
      const displayPanel = new THREE.Mesh(
        new RoundedBoxGeometry(0.28, 0.18, 0.018, 2, 0.008),
        MAT.darkMetal
      );
      displayPanel.position.set(0, 1.38, 0.325);

      const tempRing = new THREE.Mesh(
        new THREE.RingGeometry(0.038, 0.052, 24),
        indicatorMat
      );
      tempRing.position.set(0, 1.38, 0.336);

      // Top insulated copper/brass heating manifold pipes (Vorlauf Red & Rücklauf Blue)
      const pipeOffsets: [number, number][] = [
        [-0.18, 0xdc2626],
        [-0.06, 0x2563eb],
        [0.06, 0xdc2626],
        [0.18, 0x2563eb],
      ];
      for (const [px, colHex] of pipeOffsets) {
        const pipe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.022, 0.32, 14),
          MAT.anthracite
        );
        pipe.position.set(px, 1.96, -0.12);
        const collar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.028, 0.035, 14),
          new THREE.MeshStandardMaterial({ color: colHex, roughness: 0.35 })
        );
        collar.position.set(px, 1.85, -0.12);
        root.add(pipe, collar);
      }

      root.add(tower, displayPanel, tempRing);
      break;
    }

    case 'hot_water_buffer_tank': {
      addContactShadow(root, 0.85, 0.85);
      // Cylindrical 300L insulated buffer tank in brushed silver/white jacket
      const cylinderBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 1.68, 28),
        MAT.brushedSteel
      );
      cylinderBody.position.set(0, 0.86, 0);

      const topDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
        MAT.anthracite
      );
      topDome.position.set(0, 1.7, 0);

      // Vertical stratification thermometer strip (Oben Warm / Unten Kalt)
      const thermoFrame = new THREE.Mesh(
        new RoundedBoxGeometry(0.065, 0.72, 0.03, 2, 0.008),
        MAT.darkMetal
      );
      thermoFrame.position.set(0, 1.05, 0.34);

      const hotBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.32, 0.015),
        new THREE.MeshBasicMaterial({ color: 0xf97316 })
      );
      hotBar.position.set(0, 1.2, 0.352);

      const warmBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.3, 0.015),
        indicatorMat
      );
      warmBar.position.set(0, 0.88, 0.352);

      // Side circulation pump & brass safety valve group
      const pumpGroup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.14, 16),
        MAT.copperGold
      );
      pumpGroup.rotation.z = Math.PI / 2;
      pumpGroup.position.set(0.36, 1.15, 0);

      root.add(cylinderBody, topDome, thermoFrame, hotBar, warmBar, pumpGroup);
      break;
    }

    case 'electrical_meter_cabinet': {
      // Three-bay VDE electrical meter & breaker distribution cabinet (Zählerschrank)
      const cabinet = new THREE.Mesh(
        new RoundedBoxGeometry(0.92, 1.36, 0.21, 3, 0.018),
        MAT.matteWhite
      );
      cabinet.position.set(0, 0, 0.105);

      // Inspection window showing Digital Smart Meter + DIN rail breaker rows
      const windowRecess = new THREE.Mesh(
        new RoundedBoxGeometry(0.82, 1.24, 0.016, 2, 0.01),
        MAT.darkMetal
      );
      windowRecess.position.set(0, 0, 0.208);

      // Left Bay: 2 Digital Two-Way Smart Meters (eHZ Zweirichtungszähler)
      for (const my of [0.22, -0.18]) {
        const meterBox = new THREE.Mesh(
          new RoundedBoxGeometry(0.22, 0.28, 0.025, 2, 0.008),
          MAT.anthracite
        );
        meterBox.position.set(-0.24, my, 0.215);
        const lcd = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.065, 0.01),
          indicatorMat
        );
        lcd.position.set(-0.24, my + 0.04, 0.228);
        root.add(meterBox, lcd);
      }

      // Right Bays: 5 rows of miniature circuit breakers (FI/LS-Automaten)
      for (let row = 0; row < 5; row++) {
        const ry = 0.42 - row * 0.21;
        const dinRail = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.075, 0.022),
          MAT.brushedSteel
        );
        dinRail.position.set(0.16, ry, 0.215);
        root.add(dinRail);
      }

      root.add(cabinet, windowRecess);
      break;
    }

    case 'sub_distribution_board_1row':
    case 'sub_distribution_board_3row': {
      // Compact 1-row (12 TE) or 3-row (36 TE) Sub-Distribution Board (Kleine Unterverteilung / Kleinverteiler)
      const is3Row = asset.catalogId === 'sub_distribution_board_3row';
      const boxW = is3Row ? 0.38 : 0.34;
      const boxH = is3Row ? 0.58 : 0.26;
      const boxD = is3Row ? 0.13 : 0.115;
      const rowCount = is3Row ? 3 : 1;

      const enclosure = new THREE.Mesh(
        new RoundedBoxGeometry(boxW, boxH, boxD, 3, 0.014),
        MAT.matteWhite
      );
      enclosure.position.set(0, 0, boxD / 2);

      // Dark interior backplate recess
      const recess = new THREE.Mesh(
        new RoundedBoxGeometry(boxW - 0.05, boxH - 0.06, 0.015, 2, 0.006),
        MAT.darkMetal
      );
      recess.position.set(0, 0, boxD - 0.006);

      // DIN rails with RCD (FI-Schutzschalter), MCB circuit breakers (LS-Automaten) & status LED
      for (let r = 0; r < rowCount; r++) {
        const ry =
          rowCount === 1
            ? 0
            : (rowCount - 1 - r * 2) * (boxH * 0.27);
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(boxW - 0.08, 0.068, 0.018),
          MAT.brushedSteel
        );
        rail.position.set(0, ry, boxD - 0.002);
        root.add(rail);

        // Left RCD / FI block with blue test button
        const fiBlock = new THREE.Mesh(
          new RoundedBoxGeometry(0.065, 0.072, 0.026, 2, 0.004),
          MAT.warmWhite
        );
        fiBlock.position.set(-(boxW - 0.15) / 2, ry, boxD + 0.005);
        const testBtn = new THREE.Mesh(
          new THREE.BoxGeometry(0.016, 0.014, 0.03),
          new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 })
        );
        testBtn.position.set(-(boxW - 0.15) / 2 + 0.014, ry + 0.016, boxD + 0.006);
        root.add(fiBlock, testBtn);

        // Individual MCB switches (LS-Automaten) across the row
        for (let b = 0; b < 6; b++) {
          const bx = -(boxW - 0.15) / 2 + 0.065 + b * 0.028;
          const mcb = new THREE.Mesh(
            new THREE.BoxGeometry(0.024, 0.068, 0.024),
            MAT.matteWhite
          );
          mcb.position.set(bx, ry, boxD + 0.004);
          const toggle = new THREE.Mesh(
            new THREE.BoxGeometry(0.018, 0.012, 0.032),
            b === 0 && r === 0 ? indicatorMat : MAT.anthracite
          );
          toggle.position.set(bx, ry - 0.004, boxD + 0.008);
          root.add(mcb, toggle);
        }
      }

      // Smoked transparent inspection door (Rauchglastür)
      const smokedDoor = new THREE.Mesh(
        new RoundedBoxGeometry(boxW - 0.03, boxH - 0.04, 0.01, 2, 0.008),
        createGlassMaterial(isSoftwareGl, 0x38bdf8)
      );
      smokedDoor.position.set(0, 0, boxD + 0.018);

      // Top & bottom PG cable glands (Kabelverschraubungen)
      for (const cx of [-0.08, 0, 0.08]) {
        const glandTop = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.014, 0.035, 10),
          MAT.anthracite
        );
        glandTop.position.set(cx, boxH / 2 + 0.015, boxD * 0.45);
        root.add(glandTop);
      }

      root.add(enclosure, recess, smokedDoor);
      break;
    }

    case 'smart_home_server_hub': {
      // Wall-mounted 19" Smart Home Server Rack with Glass Door, HA Hub, PoE Switch & Zigbee Antenna
      const rackChassis = new THREE.Mesh(
        new RoundedBoxGeometry(0.54, 0.58, 0.36, 3, 0.018),
        MAT.anthracite
      );
      rackChassis.position.set(0, 0, 0.18);

      // 1U PoE Switch with blinking port LEDs
      const poeSwitch = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.055, 0.26),
        MAT.darkMetal
      );
      poeSwitch.position.set(0, 0.16, 0.2);

      const portLedStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.012, 0.01),
        indicatorMat
      );
      portLedStrip.position.set(0, 0.16, 0.332);

      // Home Assistant Central Hub Unit (Sky-Blue anodized aluminum enclosure)
      const haHub = new THREE.Mesh(
        new RoundedBoxGeometry(0.22, 0.065, 0.2, 3, 0.012),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.6 })
      );
      haHub.position.set(-0.08, 0.0, 0.2);

      // External High-Gain Zigbee / Thread / Matter Antenna on top of rack
      const antennaRod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.012, 0.24, 12),
        MAT.darkMetal
      );
      antennaRod.position.set(0.18, 0.4, 0.22);

      const glassDoor = new THREE.Mesh(
        new RoundedBoxGeometry(0.48, 0.52, 0.012, 2, 0.008),
        createGlassMaterial(isSoftwareGl, 0x38bdf8)
      );
      glassDoor.position.set(0, 0, 0.36);

      root.add(rackChassis, poeSwitch, portLedStrip, haHub, antennaRod, glassDoor);
      break;
    }

    case 'wall_planner_module': {
      // Universeller Wand-Planer: Modular 3D Builder for Kitchens, Living Walls, Wardrobes & Closets
      const wc = asset.wallModuleConfig || {
        category: 'kitchen',
        moduleType: 'drawer_base',
      };
      const modType = wc.moduleType || 'drawer_base';
      const w = THREE.MathUtils.clamp(asset.customLength ?? asset.customWidth ?? 0.8, 0.35, 3.6);
      const d = THREE.MathUtils.clamp(
        asset.customDepth ??
          (wc.category === 'living_wall'
            ? 0.44
            : wc.category === 'wardrobe'
            ? 0.45
            : 0.6),
        0.28,
        0.85
      );
      const isTallModule =
        modType === 'tall_fridge' ||
        modType === 'tall_oven' ||
        modType === 'glass_vitrine' ||
        modType === 'wall_bookshelf' ||
        modType === 'wardrobe_mirror_cabinet' ||
        modType === 'closet_double_door' ||
        modType === 'closet_mirror_door' ||
        modType === 'closet_open_shelving';
      const h = THREE.MathUtils.clamp(
        asset.customHeight ?? (isTallModule ? 2.15 : modType === 'tv_lowboard' ? 0.48 : 0.9),
        0.4,
        2.65
      );

      addContactShadow(root, w + 0.04, d + 0.04);

      const frontMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(wc.frontColor || '#334155'),
        roughness: 0.35,
        metalness: 0.12,
      });
      const topMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(wc.countertopColor || '#d6d3d1'),
        roughness: 0.28,
        metalness: 0.08,
      });
      const woodMat =
        wc.bodyWoodTone === 'walnut_dark' ? MAT.walnutWood : MAT.oakWood;

      if (
        modType === 'sink_unit' ||
        modType === 'cooktop_oven' ||
        modType === 'drawer_base' ||
        modType === 'dishwasher_base' ||
        modType === 'corner_unit'
      ) {
        const baseH = 0.86;
        // Base cabinet carcass
        const carcass = new THREE.Mesh(
          new RoundedBoxGeometry(w - 0.004, baseH, d - 0.02, 3, 0.012),
          frontMat
        );
        carcass.position.set(0, baseH / 2, -0.01);
        // Stone / Wood Countertop slab
        const counterTop = new THREE.Mesh(
          new RoundedBoxGeometry(w + 0.004, 0.045, d + 0.015, 3, 0.008),
          topMat
        );
        counterTop.position.set(0, baseH + 0.022, 0.005);
        root.add(carcass, counterTop);

        // Front drawer / door lines + handles
        const handleBar = new THREE.Mesh(
          new THREE.BoxGeometry(Math.min(0.24, w * 0.4), 0.014, 0.022),
          MAT.brushedSteel
        );
        handleBar.position.set(0, baseH * 0.78, d / 2 + 0.004);
        root.add(handleBar);

        if (modType === 'sink_unit') {
          const basin = new THREE.Mesh(
            new RoundedBoxGeometry(Math.min(0.54, w * 0.68), 0.025, d * 0.58, 2, 0.008),
            MAT.darkMetal
          );
          basin.position.set(0, baseH + 0.038, 0);
          const faucetStem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.014, 0.28, 14),
            MAT.brushedSteel
          );
          faucetStem.position.set(0, baseH + 0.17, -d * 0.22);
          const faucetSpout = new THREE.Mesh(
            new THREE.CylinderGeometry(0.01, 0.01, 0.18, 12),
            MAT.brushedSteel
          );
          faucetSpout.rotation.x = Math.PI / 2.3;
          faucetSpout.position.set(0, baseH + 0.28, -d * 0.14);
          root.add(basin, faucetStem, faucetSpout);
        } else if (modType === 'cooktop_oven') {
          const hob = new THREE.Mesh(
            new RoundedBoxGeometry(Math.min(0.76, w * 0.82), 0.012, d * 0.68, 2, 0.005),
            MAT.obsidianGlass
          );
          hob.position.set(0, baseH + 0.048, 0.01);
          // 4 Induction cooking zones
          for (const [rx, rz] of [
            [-0.14, -0.09],
            [0.14, -0.09],
            [-0.14, 0.09],
            [0.14, 0.09],
          ]) {
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(0.055, 0.072, 24),
              new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(rx * Math.min(1, w / 0.6), baseH + 0.055, rz);
            root.add(ring);
          }
          // Built-in Oven glass window in base front
          const ovenGlass = new THREE.Mesh(
            new RoundedBoxGeometry(Math.min(0.56, w * 0.78), 0.48, 0.018, 2, 0.006),
            MAT.obsidianGlass
          );
          ovenGlass.position.set(0, 0.44, d / 2 - 0.002);
          root.add(hob, ovenGlass);
        } else if (modType === 'drawer_base') {
          for (const dy of [0.24, 0.54]) {
            const seam = new THREE.Mesh(
              new THREE.BoxGeometry(w - 0.03, 0.008, 0.012),
              MAT.darkMetal
            );
            seam.position.set(0, dy, d / 2 - 0.004);
            root.add(seam);
          }
        }

        // Optional Upper Wall Cabinet (Hängeschrank) + warm LED backsplash strip
        if (wc.hasUpperCabinet !== false) {
          const upperH = 0.72;
          const upperD = Math.min(0.36, d * 0.6);
          const upperY = 1.76;
          const upperBox = new THREE.Mesh(
            new RoundedBoxGeometry(w - 0.004, upperH, upperD, 3, 0.012),
             woodMat
          );
          upperBox.position.set(0, upperY, -d / 2 + upperD / 2);
          root.add(upperBox);

          if (wc.hasLedStrip !== false) {
            const ledStrip = new THREE.Mesh(
              new THREE.BoxGeometry(w - 0.04, 0.012, 0.025),
              MAT.warmGlow
            );
            ledStrip.position.set(0, upperY - upperH / 2 - 0.006, -d / 2 + upperD * 0.7);
            root.add(ledStrip);
          }
        }
      } else if (modType === 'tv_lowboard' || modType === 'media_acoustic_wall') {
        const lowH = 0.44;
        const lowboard = new THREE.Mesh(
          new RoundedBoxGeometry(w - 0.004, lowH, d, 3, 0.015),
          frontMat
        );
        lowboard.position.set(0, lowH / 2, 0);
        const topSlab = new THREE.Mesh(
          new RoundedBoxGeometry(w + 0.004, 0.03, d + 0.01, 2, 0.006),
          woodMat
        );
        topSlab.position.set(0, lowH + 0.015, 0);
        root.add(lowboard, topSlab);

        if (modType === 'media_acoustic_wall') {
          // Acoustic slatted backwall + Mounted OLED TV
          const panelH = Math.max(1.6, h - lowH);
          const slatCount = Math.max(6, Math.floor(w / 0.048));
          const slatSpacing = w / slatCount;
          for (let i = 0; i < slatCount; i++) {
            const sx = -w / 2 + (i + 0.5) * slatSpacing;
            const slat = new THREE.Mesh(
              new THREE.BoxGeometry(slatSpacing * 0.62, panelH, 0.022),
              woodMat
            );
            slat.position.set(sx, lowH + panelH / 2, -d / 2 + 0.018);
            root.add(slat);
          }
          const tvW = Math.min(1.65, w * 0.86);
          const tvH = tvW * 0.56;
          const tvScreen = new THREE.Mesh(
            new RoundedBoxGeometry(tvW, tvH, 0.028, 2, 0.006),
            MAT.obsidianGlass
          );
          tvScreen.position.set(0, lowH + 0.35 + tvH / 2, -d / 2 + 0.048);
          root.add(tvScreen);
        }
      } else if (modType === 'wardrobe_bench_hooks') {
        const benchH = 0.46;
        const bench = new THREE.Mesh(
          new RoundedBoxGeometry(w - 0.004, benchH, d, 3, 0.014),
          frontMat
        );
        bench.position.set(0, benchH / 2, 0);
        const seatPad = new THREE.Mesh(
          new RoundedBoxGeometry(w - 0.02, 0.055, d - 0.02, 3, 0.018),
          MAT.boucleFabric
        );
        seatPad.position.set(0, benchH + 0.028, 0);
        const backPanel = new THREE.Mesh(
          new RoundedBoxGeometry(w - 0.01, 1.45, 0.03, 2, 0.008),
          woodMat
        );
        backPanel.position.set(0, benchH + 0.75, -d / 2 + 0.02);
        const hatShelf = new THREE.Mesh(
          new RoundedBoxGeometry(w - 0.01, 0.035, d * 0.65, 2, 0.008),
          frontMat
        );
        hatShelf.position.set(0, benchH + 1.42, -d / 2 + d * 0.32);
        root.add(bench, seatPad, backPanel, hatShelf);

        // Coat hooks
        const hookCnt = Math.max(2, Math.floor(w / 0.22));
        for (let i = 0; i < hookCnt; i++) {
          const hx = -w * 0.35 + (i / Math.max(1, hookCnt - 1)) * (w * 0.7);
          const hook = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.012, 0.06, 10),
            MAT.brushedSteel
          );
          hook.rotation.x = Math.PI / 2;
          hook.position.set(hx, benchH + 1.18, -d / 2 + 0.055);
          root.add(hook);
        }
      } else if (modType === 'wall_upper_cabinet') {
        // Wall-hung upper cabinet (Hängeschrank / Oberschrank)
        const corpus = new THREE.Mesh(
          new RoundedBoxGeometry(w - 0.004, h, d, 3, 0.012),
          frontMat
        );
        corpus.position.set(0, h / 2, 0);
        // Under-cabinet warm LED strip
        const ledStrip = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.88, 0.008, 0.025),
          MAT.warmGlow
        );
        ledStrip.position.set(0, 0.004, d * 0.15);
        root.add(corpus, ledStrip);
      } else if (modType === 'wall_floating_shelf') {
        // Wall-hung floating board (Wandboard / Schweberegal)
        const boardH = Math.min(0.055, h);
        const board = new THREE.Mesh(
          new RoundedBoxGeometry(w, boardH, d, 2, 0.008),
          woodMat
        );
        board.position.set(0, boardH / 2, 0);
        root.add(board);
      } else if (modType === 'wall_tv_panel') {
        // Wall-mounted OLED TV with slim wood/acoustic backpanel
        const backPanel = new THREE.Mesh(
          new RoundedBoxGeometry(w, h, Math.min(0.035, d * 0.45), 2, 0.008),
          woodMat
        );
        backPanel.position.set(0, h / 2, -d / 2 + 0.02);
        const tvScreen = new THREE.Mesh(
          new RoundedBoxGeometry(w * 0.9, h * 0.84, 0.026, 2, 0.006),
          MAT.obsidianGlass
        );
        tvScreen.position.set(0, h / 2, -d / 2 + 0.048);
        root.add(backPanel, tvScreen);
      } else if (modType === 'wall_mirror') {
        // Frameless / backlit wall mirror
        const frame = new THREE.Mesh(
          new RoundedBoxGeometry(w, h, 0.022, 2, 0.008),
          MAT.darkMetal
        );
        frame.position.set(0, h / 2, -d / 2 + 0.015);
        const mirrorGlass = new THREE.Mesh(
          new RoundedBoxGeometry(w - 0.03, h - 0.03, 0.014, 2, 0.006),
          createGlassMaterial(isSoftwareGl, 0xe2e8f0)
        );
        mirrorGlass.position.set(0, h / 2, -d / 2 + 0.026);
        root.add(frame, mirrorGlass);
      } else if (modType === 'wall_acoustic_slats') {
        // Wall-mounted acoustic wood slat module
        const feltBack = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, 0.012),
          MAT.darkMetal
        );
        feltBack.position.set(0, h / 2, -d / 2 + 0.008);
        root.add(feltBack);
        const slatCount = Math.max(5, Math.floor(w / 0.045));
        const slatStep = w / slatCount;
        for (let i = 0; i < slatCount; i++) {
          const sx = -w / 2 + (i + 0.5) * slatStep;
          const slat = new THREE.Mesh(
            new THREE.BoxGeometry(slatStep * 0.62, h, Math.max(0.018, d - 0.01)),
            woodMat
          );
          slat.position.set(sx, h / 2, -d / 2 + 0.022);
          root.add(slat);
        }
      } else {
        // Tall Cabinet / Fridge / Oven Tower / Vitrine / Wardrobe / Closet Module
        const corpus = new THREE.Mesh(
          new RoundedBoxGeometry(w - 0.004, h, d, 4, 0.016),
          modType === 'closet_open_shelving' || modType === 'wall_bookshelf'
            ? woodMat
            : frontMat
        );
        corpus.position.set(0, h / 2, 0);
        root.add(corpus);

        if (modType === 'closet_mirror_door' || modType === 'wardrobe_mirror_cabinet') {
          const mirror = new THREE.Mesh(
            new RoundedBoxGeometry(w - 0.06, h - 0.1, 0.014, 2, 0.006),
            createGlassMaterial(isSoftwareGl, 0xe2e8f0)
          );
          mirror.position.set(0, h / 2, d / 2 + 0.004);
          root.add(mirror);
        } else if (modType === 'glass_vitrine') {
          const glass = new THREE.Mesh(
            new RoundedBoxGeometry(w - 0.08, h * 0.65, 0.016, 2, 0.006),
            createGlassMaterial(isSoftwareGl, 0x38bdf8)
          );
          glass.position.set(0, h * 0.6, d / 2 + 0.004);
          root.add(glass);
        } else if (modType === 'tall_oven') {
          const ovenGlass = new THREE.Mesh(
            new RoundedBoxGeometry(Math.min(0.56, w * 0.82), 0.56, 0.018, 2, 0.006),
            MAT.obsidianGlass
          );
          ovenGlass.position.set(0, 1.15, d / 2 + 0.004);
          root.add(ovenGlass);
        }

        // Vertical door handles
        for (const hx of w >= 0.75 ? [-0.04, 0.04] : [w * 0.35]) {
          const handle = new THREE.Mesh(
            new THREE.BoxGeometry(0.014, 0.36, 0.025),
            MAT.brushedSteel
          );
          handle.position.set(hx, h * 0.5, d / 2 + 0.008);
          root.add(handle);
        }
      }
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
    const innerW = opening.width - 0.132;
    const innerH = opening.height - 0.064;
    const dirSign = openDirection === 'outward' ? 1 : -1;
    const zTrackOffset = dirSign * 0.032;
    const panelSurfaceMat =
      designStyle === 'sectional_wood_ribbed' ? MAT.teakWood : frameMat;

    // Overhead horizontal & vertical J-track rails inside the garage
    const trackMat = MAT.brushedSteel;
    for (const sideX of [-innerW / 2 - 0.014, innerW / 2 + 0.014]) {
      const horizTrack = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.03, innerH * 0.96),
        trackMat
      );
      horizTrack.position.set(
        sideX,
        innerH - 0.025,
        zTrackOffset + dirSign * (innerH * 0.48)
      );
      group.add(horizTrack);
    }

    if (designStyle === 'up_and_over_classic') {
      // 1-Piece Up-and-Over Overhead Gate (Schwingtor / Kipptor mit vertikalen Sicken)
      const swingLeaf = new THREE.Group();
      swingLeaf.position.set(0, innerH / 2, zTrackOffset * 0.5);

      const mainSheet = new THREE.Mesh(
        new RoundedBoxGeometry(innerW + 0.004, innerH + 0.004, 0.046, 2, 0.006),
        panelSurfaceMat
      );
      swingLeaf.add(mainSheet);

      // Vertical beading ribs (Vertikalsicken)
      const ribCount = Math.max(8, Math.floor(innerW / 0.22));
      for (let r = 1; r < ribCount; r++) {
        const rx = -innerW / 2 + (r / ribCount) * innerW;
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(0.014, innerH - 0.08, 0.052),
          MAT.darkMetal
        );
        rib.position.set(rx, 0, 0);
        swingLeaf.add(rib);
      }

      // Center T-handle lock (Knebelgriff)
      const tHandle = new THREE.Mesh(
        new RoundedBoxGeometry(0.14, 0.035, 0.08, 2, 0.006),
        MAT.brushedSteel
      );
      tHandle.position.set(0, -innerH * 0.12, 0.025);
      swingLeaf.add(tHandle);

      leafPivot.add(swingLeaf);
      group.userData.garageGate = leafPivot;
      group.userData.upAndOverLeaf = swingLeaf;
      group.userData.garageInnerH = innerH;
      group.userData.garageOpenProgress = 0;
      group.add(leafPivot);
    } else if (designStyle === 'roller_shutter_gate') {
      // Motorized Roller Shutter Gate inside the wall opening (Lamellen-Rolltor)
      const rollerBox = new THREE.Mesh(
        new RoundedBoxGeometry(innerW + 0.04, 0.18, 0.22, 2, 0.012),
        MAT.darkMetal
      );
      rollerBox.position.set(0, innerH - 0.04, zTrackOffset);
      group.add(rollerBox);

      const curtainPivot = new THREE.Group();
      curtainPivot.position.set(0, innerH, zTrackOffset * 0.4);

      const curtainSheet = new THREE.Mesh(
        new RoundedBoxGeometry(innerW + 0.004, innerH, 0.042, 2, 0.005),
        panelSurfaceMat
      );
      curtainSheet.position.y = -innerH / 2;
      curtainPivot.add(curtainSheet);

      const slatStep = 0.14;
      for (let y = slatStep; y < innerH - 0.06; y += slatStep) {
        const groove = new THREE.Mesh(
          new THREE.BoxGeometry(innerW - 0.01, 0.01, 0.048),
          MAT.brushedSteel
        );
        groove.position.y = -y;
        curtainPivot.add(groove);
      }

      leafPivot.add(curtainPivot);
      group.userData.garageGate = leafPivot;
      group.userData.garageRollerCurtain = curtainPivot;
      group.userData.garageInnerH = innerH;
      group.userData.garageOpenProgress = 0;
      group.add(leafPivot);
    } else if (designStyle === 'double_wing_gate') {
      // Double-Wing Hinged Garage / Coach Barn Gate (Zweiflügel-Garagentor mit Oberlicht-Sprossen)
      const wingW = innerW / 2;
      const buildWing = (sideSign: -1 | 1) => {
        const wPivot = new THREE.Group();
        wPivot.position.set(sideSign * (innerW / 2), 0, 0);
        const cx = -sideSign * (wingW / 2);

        const body = new THREE.Mesh(
          new RoundedBoxGeometry(wingW - 0.004, innerH, 0.052, 2, 0.006),
          panelSurfaceMat
        );
        body.position.set(cx, innerH / 2, 0);
        wPivot.add(body);

        // Upper glazed window with cross mullions in each wing
        const winW = wingW * 0.68;
        const winH = innerH * 0.28;
        const winY = innerH * 0.72;
        const glassPane = new THREE.Mesh(
          new THREE.BoxGeometry(winW, winH, 0.058),
          glassMat
        );
        glassPane.position.set(cx, winY, 0);
        const vMullion = new THREE.Mesh(
          new THREE.BoxGeometry(0.022, winH, 0.062),
          frameMat
        );
        vMullion.position.set(cx, winY, 0);
        wPivot.add(glassPane, vMullion);

        // Lower cassette frame + handle
        const lowerPanel = new THREE.Mesh(
          new RoundedBoxGeometry(wingW * 0.74, innerH * 0.42, 0.06, 2, 0.006),
          MAT.darkMetal
        );
        lowerPanel.position.set(cx, innerH * 0.28, 0);
        wPivot.add(lowerPanel);

        return wPivot;
      };

      const leftWing = buildWing(-1);
      const rightWing = buildWing(1);
      leafPivot.add(leftWing, rightWing);
      group.userData.garageGate = leafPivot;
      group.userData.doubleWingLeft = leftWing;
      group.userData.doubleWingRight = rightWing;
      group.userData.garageInnerH = innerH;
      group.userData.garageOpenProgress = 0;
      group.add(leafPivot);
    } else {
      // 4 Articulated Sectional Panels (Flush-closing from y = 0 to y = innerH with zero gap when closed!)
      const numPanels = 4;
      const panelH = innerH / numPanels;
      const garagePanels: THREE.Group[] = [];
      for (let i = 0; i < numPanels; i++) {
        const pGroup = new THREE.Group();
        const baseCenterY = (i + 0.5) * panelH;
        pGroup.position.set(0, baseCenterY, zTrackOffset * 0.35);
        pGroup.userData.panelIndex = i;
        pGroup.userData.baseCenterY = baseCenterY;
        pGroup.userData.panelHeight = panelH;

        const panelMesh = new RoundedBoxGeometry(
          innerW + 0.004,
          panelH - 0.003,
          0.052,
          2,
          0.006
        );
        const mesh = new THREE.Mesh(panelMesh, panelSurfaceMat);
        pGroup.add(mesh);

        // Brushed aluminum horizontal joint strip
        const trim = new THREE.Mesh(
          new THREE.BoxGeometry(innerW - 0.02, 0.01, 0.056),
          MAT.brushedSteel
        );
        trim.position.y = -panelH / 2 + 0.005;
        pGroup.add(trim);

        // Bottom EPDM rubber floor seal on lowest panel (i === 0)
        if (i === 0) {
          const floorSeal = new THREE.Mesh(
            new THREE.BoxGeometry(innerW + 0.01, 0.022, 0.054),
            MAT.darkMetal
          );
          floorSeal.position.y = -panelH / 2 + 0.004;
          pGroup.add(floorSeal);
        }

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
                0.058
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
    }
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
  } else if (opening.type === 'glass_block_window') {
    // Classic Glass Block Wall Field (Glasbausteine im Mörtelraster, ~19x19x8cm Steine)
    // Uses THREE.InstancedMesh so a full glass block window requires only 3 GPU draw calls instead of 60+!
    const innerW = Math.max(0.28, opening.width - 0.12);
    const innerH = Math.max(0.28, opening.height - 0.12);
    const cols = Math.max(2, Math.min(14, Math.round(innerW / 0.2)));
    const rows = Math.max(2, Math.min(14, Math.round(innerH / 0.2)));
    const cellW = innerW / cols;
    const cellH = innerH / rows;
    const jointT = 0.014;
    const blockDepth = 0.088;

    const glassBlockGroup = new THREE.Group();
    glassBlockGroup.position.set(0, 0.06, 0);

    const mortarMat = MAT.warmWhite;
    const blockGlassMat = createGlassMaterial(isSoftwareGl, 0xa5f3fc);
    const dummy = new THREE.Object3D();

    // Instanced Horizontal mortar joints
    const hJointGeo = new THREE.BoxGeometry(innerW, jointT, blockDepth + 0.008);
    const hJointInst = new THREE.InstancedMesh(hJointGeo, mortarMat, rows + 1);
    for (let r = 0; r <= rows; r++) {
      dummy.position.set(0, r * cellH, 0);
      dummy.updateMatrix();
      hJointInst.setMatrixAt(r, dummy.matrix);
    }
    hJointInst.instanceMatrix.needsUpdate = true;
    glassBlockGroup.add(hJointInst);

    // Instanced Vertical mortar joints
    const vJointGeo = new THREE.BoxGeometry(jointT, innerH, blockDepth + 0.008);
    const vJointInst = new THREE.InstancedMesh(vJointGeo, mortarMat, cols + 1);
    for (let c = 0; c <= cols; c++) {
      dummy.position.set(-innerW / 2 + c * cellW, innerH / 2, 0);
      dummy.updateMatrix();
      vJointInst.setMatrixAt(c, dummy.matrix);
    }
    vJointInst.instanceMatrix.needsUpdate = true;
    glassBlockGroup.add(vJointInst);

    // Instanced Glass Blocks (Glasbausteine)
    const blockGeo = new RoundedBoxGeometry(
      Math.max(0.05, cellW - jointT * 1.15),
      Math.max(0.05, cellH - jointT * 1.15),
      blockDepth,
      2,
      0.012
    );
    const totalBlocks = rows * cols;
    const blockInst = new THREE.InstancedMesh(blockGeo, blockGlassMat, totalBlocks);
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dummy.position.set(
          -innerW / 2 + (c + 0.5) * cellW,
          (r + 0.5) * cellH,
          0
        );
        dummy.updateMatrix();
        blockInst.setMatrixAt(idx++, dummy.matrix);
      }
    }
    blockInst.instanceMatrix.needsUpdate = true;
    glassBlockGroup.add(blockInst);

    group.add(glassBlockGroup);
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
    const plinthH = THREE.MathUtils.clamp(opening.exteriorPlinthHeight ?? 0.3, 0.12, 1.5);
    const stepCount = Math.round(THREE.MathUtils.clamp(opening.exteriorStepsCount ?? 2, 1, 8));
    const stepW = Math.max(opening.width + 0.36, opening.exteriorStepsWidth ?? opening.width + 0.45);
    const totalD = THREE.MathUtils.clamp(opening.exteriorStepsDepth ?? 1.15, 0.65, 2.8);
    const extSign = openDirection === 'inward' ? 1 : -1;
    const extShape: ExteriorStepsShapeType = opening.exteriorStepsShape || 'straight';

    const stepsGroup = buildExteriorStepsGeometry({
      shape: extShape,
      plinthH,
      stepCount,
      stepW,
      totalD,
      material: opening.exteriorStepsMaterial || 'travertine',
      railing: opening.exteriorStepsRailing || 'none',
      glassMat,
      baseYOffset: -plinthH,
      extSign,
      zStartOffset: frameDepth / 2,
    });
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
  dt = 0.016,
  entities?: Record<string, HAEntityState>
): boolean {
  let isAssetAnimating = false;
  const dormerUnits = assetGroup.userData.dormerDynamicUnits as
    | DormerDynamicUnitRef[]
    | undefined;
  if (dormerUnits && dormerUnits.length > 0) {
    if (updateDormerDynamicUnits(dormerUnits, entities, dt)) {
      isAssetAnimating = true;
    }
  }
  const indicatorMat = assetGroup.userData.indicatorMat as THREE.MeshStandardMaterial | undefined;
  const sensorCone = assetGroup.userData.sensorCone as THREE.Mesh | undefined;
  const waterSpray = assetGroup.userData.waterSpray as THREE.Group | undefined;
  const volumetricBeamMat = assetGroup.userData.volumetricBeamMat as THREE.MeshBasicMaterial | undefined;
  const lightPoolMat = assetGroup.userData.lightPoolMat as THREE.MeshBasicMaterial | undefined;
  const volumetricBeamMesh = assetGroup.userData.volumetricBeamMesh as THREE.Mesh | undefined;
  const lightPoolMesh = assetGroup.userData.lightPoolMesh as THREE.Mesh | undefined;
  const lightConeMesh = assetGroup.userData.lightConeMesh as THREE.Object3D | undefined;
  const lightConeMat = assetGroup.userData.lightConeMat as THREE.MeshBasicMaterial | undefined;
  const lightConeBaseOpacity = (assetGroup.userData.lightConeBaseOpacity as number | undefined) ?? 0.2;
  const rollerGateCurtain = assetGroup.userData.rollerGateCurtain as THREE.Group | undefined;
  const openerCarriage = assetGroup.userData.openerCarriage as THREE.Group | undefined;
  const slidingDrivewayGate = assetGroup.userData.slidingDrivewayGate as THREE.Group | undefined;
  const swingGateLeftLeaf = assetGroup.userData.swingGateLeftLeaf as THREE.Group | undefined;
  const swingGateRightLeaf = assetGroup.userData.swingGateRightLeaf as THREE.Group | undefined;

  if (sensorCone) {
    sensorCone.visible = showSensorCones;
  }

  // Smoothly Animate Electric Roller Gate, Ceiling Garage Door Opener Carriage, Sliding Driveway Gate & Double Swing Gate
  // Supports per-asset manual `customOpenPct` override so each gate opens independently even without or with shared HA entities
  const manualPct = assetGroup.userData.customOpenPct as number | undefined;
  if (
    rollerGateCurtain ||
    openerCarriage ||
    slidingDrivewayGate ||
    swingGateLeftLeaf ||
    swingGateRightLeaf
  ) {
    const isCoverOpen =
      entity?.domain === 'cover' &&
      (entity.state === 'open' || (entity.attributes.current_position ?? 0) > 20);
    const entityOpenRatio =
      entity?.domain === 'cover'
        ? entity.attributes.current_position !== undefined
          ? entity.attributes.current_position / 100
          : isCoverOpen
          ? 1.0
          : 0.0
        : 0.0;
    const effectiveRatio = manualPct !== undefined ? manualPct / 100 : entityOpenRatio;

    if (rollerGateCurtain) {
      const targetScaleY = Math.max(0.05, 1 - effectiveRatio * 0.94);
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
      const targetZ = 1.25 - effectiveRatio * 2.1;
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

    if (swingGateLeftLeaf && swingGateRightLeaf) {
      const targetAngle = effectiveRatio * (Math.PI * 0.48);
      if (
        Math.abs(swingGateLeftLeaf.rotation.y - targetAngle) > 0.002 ||
        Math.abs(swingGateRightLeaf.rotation.y - -targetAngle) > 0.002
      ) {
        swingGateLeftLeaf.rotation.y = THREE.MathUtils.damp(
          swingGateLeftLeaf.rotation.y,
          targetAngle,
          5.0,
          dt
        );
        swingGateRightLeaf.rotation.y = THREE.MathUtils.damp(
          swingGateRightLeaf.rotation.y,
          -targetAngle,
          5.0,
          dt
        );
        isAssetAnimating = true;
      }
    }
  }

  if (!entity) {
    if (waterSpray) waterSpray.visible = false;
    if (volumetricBeamMesh) volumetricBeamMesh.visible = false;
    if (lightPoolMesh) lightPoolMesh.visible = false;
    if (lightConeMesh) lightConeMesh.visible = false;
    return isAssetAnimating;
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
      if (lightConeMesh && lightConeMat) {
        lightConeMesh.visible = dimFactor > 0.2;
        lightConeMat.color.setRGB(r / 255, g / 255, b / 255);
        lightConeMat.opacity = lightConeBaseOpacity * brightnessRatio;
      }
    } else {
      indicatorMat.color.setHex(0x475569);
      indicatorMat.emissive.setHex(0x000000);
      indicatorMat.emissiveIntensity = 0;
      if (volumetricBeamMesh) volumetricBeamMesh.visible = false;
      if (lightPoolMesh) lightPoolMesh.visible = false;
      if (lightConeMesh) lightConeMesh.visible = false;
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
  /** Optional live Home Assistant entities map so roof dormers and skylights initialize with live sensor/shutter states */
  entities?: Record<string, HAEntityState>;
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

  const ySlopeBase = kniestockH;

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

  const ySlopeBase = kniestockH;
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
  const matchedWallColor = new THREE.Color(zone.wallColor || '#e4e0d8').multiplyScalar(0.84);
  const gableWallMat = new THREE.MeshStandardMaterial({
    color: matchedWallColor,
    roughness: 0.78,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });
  group.userData.gableWallMat = gableWallMat;
  group.userData.gableWallBaseColor = matchedWallColor.clone();
  const upperGableWallMat = isFocusCutaway
    ? new THREE.MeshStandardMaterial({
        color: matchedWallColor,
        roughness: 0.78,
        metalness: 0.01,
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

  // Eaves Kniestock / Drempel & Ringanker masonry walls along the actual wall line (±wallSpan / 2)
  // Centered on the building boundary (`wallInset = 0`) so they sit 100% flush with the facade walls below!
  if (cfg.type !== 'flat') {
    const wallT = 0.14;
    const eaveWallTopY =
      cfg.type === 'gable' || cfg.type === 'mansard' || cfg.type === 'barrel'
        ? ySlopeBase + ridgeH * Math.max(0, 1 - (wallSpan / 2) / Math.max(0.2, halfSpan))
        : kniestockH;
    const effectiveKWallH = options?.hasUpperFloorRoomsInsideRoof
      ? 0
      : Math.max(kniestockH, eaveWallTopY);
    if (effectiveKWallH > 0.015) {
      for (const zSign of [-1, 1]) {
        const kWall = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(0.4, wallLen + wallT), effectiveKWallH, wallT),
          gableWallMat
        );
        kWall.position.set(
          0,
          effectiveKWallH / 2,
          zSign * (wallSpan / 2)
        );
        kWall.castShadow = true;
        kWall.receiveShadow = true;
        core.add(kWall);
      }
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
  const roofDynamicUnits: DormerDynamicUnitRef[] = [];

  const slopeLenGable = Math.hypot(halfSpan, ridgeH);
  const slopeAngleGable = Math.atan2(ridgeH, halfSpan);
  const tanSlope = ridgeH / Math.max(0.2, halfSpan);
  const monoH = Math.min(4.2, span * Math.tan(pitchRad * 0.65));
  const monoSlopeLen = Math.hypot(span, monoH);
  const monoSlopeAngle = Math.atan2(monoH, span);
  const monoTan = monoH / Math.max(0.2, span);

  /**
   * Evaluates the exact roof surface Y height (in `core` coordinates) at `(xCoord, zSigned)`
   * for all roof geometries (`mono_pitch`, `gable`, `hipped`, `tent`, `mansard`, `barrel`, `flat`).
   */
  const getRoofTopYAt = (zSigned: number, xCoord = 0): number => {
    const zAbs = Math.min(halfSpan, Math.max(0, Math.abs(zSigned)));
    if (cfg.type === 'flat') {
      return 0.14;
    }
    if (cfg.type === 'mono_pitch') {
      // monoSlab center is at (0, ySlopeBase + monoH / 2, 0) rotated by +monoSlopeAngle around X:
      // At z = +halfSpan (front eaves), y = ySlopeBase; at z = -halfSpan (back high edge), y = ySlopeBase + monoH.
      const clampedZ = THREE.MathUtils.clamp(zSigned, -halfSpan, halfSpan);
      return ySlopeBase + monoH * (0.5 - clampedZ / span);
    }
    if (cfg.type === 'mansard') {
      const lowerH = ridgeH * 0.65;
      const upperH = ridgeH * 0.35;
      const breakZ = halfSpan * 0.62;
      if (zAbs >= breakZ) {
        const tLower = (halfSpan - zAbs) / Math.max(0.1, halfSpan - breakZ);
        return ySlopeBase + lowerH * tLower;
      }
      const tUpper = (breakZ - zAbs) / Math.max(0.1, breakZ);
      return ySlopeBase + lowerH + upperH * tUpper;
    }
    if (cfg.type === 'barrel') {
      const scaleY = Math.min(1.0, (ridgeH / halfSpan) * 0.85);
      return ySlopeBase + Math.sqrt(Math.max(0, halfSpan * halfSpan - zAbs * zAbs)) * scaleY;
    }
    if (cfg.type === 'hipped' || cfg.type === 'tent') {
      const ridgeRun = cfg.type === 'tent' ? 0 : Math.max(0, halfLen - halfSpan);
      const xExcess = Math.max(0, Math.abs(xCoord) - ridgeRun);
      const hipDist = Math.max(zAbs, xExcess);
      return ySlopeBase + ridgeH * Math.max(0, 1 - hipDist / Math.max(0.2, halfSpan));
    }
    // Default: gable (Satteldach)
    return ySlopeBase + ridgeH * (1 - zAbs / Math.max(0.2, halfSpan));
  };

  const frontSlopeHoles: SlopeHoleRect[] = [];
  const backSlopeHoles: SlopeHoleRect[] = [];
  const flatDeckHoles: SlopeHoleRect[] = [];

  // 1. Add skylight holes so every skylight is 100% transparent through the roof slab
  for (const sky of skylightsList) {
    const zDir = sky.side === 'back' ? -1 : 1;
    const isSweepHatch = sky.style === 'chimney_sweep_hatch';
    const sWidth = THREE.MathUtils.clamp(
      sky.width ?? (isSweepHatch ? 0.48 : 1.14),
      isSweepHatch ? 0.36 : 0.55,
      Math.max(0.7, wallLen * 0.65)
    );
    const sLen = THREE.MathUtils.clamp(
      sky.length ?? (isSweepHatch ? 0.55 : 1.4),
      isSweepHatch ? 0.42 : 0.6,
      Math.max(0.7, halfSpan * 0.85)
    );
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
      const zSurface3D = zDir * (halfSpan * t);
      const localZ = zSurface3D * (monoSlopeLen / span);
      frontSlopeHoles.push({
        x: xPos,
        z: localZ,
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
    const maxRidgeRef = cfg.type === 'mono_pitch' ? Math.max(ridgeH, monoH) : ridgeH;
    const dHeight = THREE.MathUtils.clamp(
      dItem.height ?? 1.3,
      0.65,
      Math.max(0.75, maxRidgeRef * 0.86)
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
      halfSpan * 0.22,
      halfSpan - 0.08
    );

    if (cfg.type === 'mono_pitch') {
      const maxMonoDepth = Math.min(span * 0.65, zFrontAbs + halfSpan - 0.25);
      const dDepth = Math.min(
        maxMonoDepth,
        Math.max(0.95, Math.min(2.15, dHeight / Math.max(0.28, monoTan * 1.35)))
      );
      const zCenter3D = zDir * (zFrontAbs - dDepth / 2);
      const localZ = zCenter3D * (monoSlopeLen / span);
      const holeSlopeLen = Math.max(0.35, dDepth * (monoSlopeLen / span) - 0.12);
      frontSlopeHoles.push({
        x: xPos,
        z: localZ,
        w: Math.max(0.4, dWidth - 0.22),
        l: holeSlopeLen,
      });
    } else {
      const dDepth = Math.min(
        zFrontAbs - 0.06,
        Math.max(0.8, dHeight / Math.max(0.24, tanSlope))
      );
      const tFront = zFrontAbs / halfSpan;
      const tBack = Math.max(0.08, (zFrontAbs - dDepth) / halfSpan);
      const tMid = (tFront + tBack) / 2;
      const holeSlopeLen = Math.max(0.35, (tFront - tBack) * slopeLenGable - 0.08);
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

    // Gable end masonry walls centered on actual building wallLen & wallSpan (`wallInset = 0`) so gableOverhang projects cleanly and aligns flush with facade walls!
    {
      const gableTopH = ridgeH * (wallSpan / span);
      const baseCutY =
        options?.hasUpperFloorRoomsInsideRoof ? Math.min(2.45, ySlopeBase + ridgeH - 0.25) : 0;
      const yAtWall = Math.max(baseCutY, ySlopeBase + ridgeH * (1 - wallSpan / 2 / halfSpan));
      if (ySlopeBase + ridgeH > baseCutY + 0.08 && gableTopH > 0.1) {
        const halfSpanAtBase =
          baseCutY <= ySlopeBase
            ? wallSpan / 2 + 0.07
            : Math.min(
                wallSpan / 2 + 0.07,
                halfSpan * Math.max(0.08, 1 - (baseCutY - ySlopeBase) / Math.max(0.2, ridgeH))
              );
        const triShape = new THREE.Shape();
        triShape.moveTo(-halfSpanAtBase, baseCutY);
        triShape.lineTo(halfSpanAtBase, baseCutY);
        if (baseCutY < yAtWall - 0.01) {
          triShape.lineTo(wallSpan / 2 + 0.07, yAtWall);
        }
        triShape.lineTo(0, ySlopeBase + ridgeH);
        if (baseCutY < yAtWall - 0.01) {
          triShape.lineTo(-(wallSpan / 2 + 0.07), yAtWall);
        }
        triShape.closePath();

        const triGeo = new THREE.ExtrudeGeometry(triShape, { depth: 0.14, bevelEnabled: false });
        const westGable = new THREE.Mesh(triGeo, upperGableWallMat);
        westGable.rotation.y = Math.PI / 2;
        westGable.position.set(-wallLen / 2 - 0.07, 0, 0);
        westGable.castShadow = !isFocusCutaway;
        westGable.receiveShadow = true;

        const eastGable = new THREE.Mesh(triGeo, upperGableWallMat);
        eastGable.rotation.y = Math.PI / 2;
        eastGable.position.set(wallLen / 2 - 0.07, 0, 0);
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

  // 4. Individual Roof Dormers (Dachgauben) with Accurate Flush Roof-Slope Integration & Multi-Window Support
  if (cfg.type !== 'flat') {
    for (const dItem of dormersList) {
      const zDir = dItem.side === 'back' ? -1 : 1;
      if (cfg.type === 'mono_pitch' && zDir < 0) continue;

      const dWidth = THREE.MathUtils.clamp(
        dItem.width ?? 1.5,
        0.75,
        Math.max(0.85, wallLen * 0.78)
      );
      const maxRidgeRef = cfg.type === 'mono_pitch' ? Math.max(ridgeH, monoH) : ridgeH;
      const dHeight = THREE.MathUtils.clamp(
        dItem.height ?? 1.3,
        0.65,
        Math.max(0.75, maxRidgeRef * 0.86)
      );
      const xPos = THREE.MathUtils.clamp(
        dItem.offsetAlongRidge ?? 0,
        -Math.max(0.1, wallLen / 2 - dWidth * 0.55),
        Math.max(0.1, wallLen / 2 - dWidth * 0.55)
      );

      // Position dormer front face relative to the building wall (eavesSetback) and compute EXACT roof surface height
      // using `getRoofTopYAt` so the dormer sits flush on Pultdach (mono_pitch), Satteldach (gable), Walmdach, Mansarddach, etc.
      const zWallAbs = wallSpan / 2;
      const eavesSetback = THREE.MathUtils.clamp(
        dItem.eavesSetback ?? 0.35,
        0,
        Math.max(0.2, wallSpan * 0.36)
      );
      const zFrontAbs = THREE.MathUtils.clamp(
        zWallAbs - eavesSetback,
        halfSpan * 0.22,
        halfSpan - 0.08
      );
      const zFrontSigned = zDir * zFrontAbs;
      const yRoofTopAtFront = getRoofTopYAt(zFrontSigned, xPos) + 0.012;

      const dDepth =
        cfg.type === 'mono_pitch'
          ? Math.min(
              Math.min(span * 0.65, zFrontAbs + halfSpan - 0.25),
              Math.max(0.95, Math.min(2.15, dHeight / Math.max(0.28, monoTan * 1.35)))
            )
          : Math.min(
              zFrontAbs - 0.05,
              Math.max(0.85, dHeight / Math.max(0.24, tanSlope) + 0.06)
            );

      const dormer = new THREE.Group();
      dormer.position.set(xPos, yRoofTopAtFront, zFrontSigned);
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

      const localRoofSlopeAngle =
        cfg.type === 'mono_pitch' ? monoSlopeAngle : slopeAngleGable;

      // Front Apron Flashing (Zink-/Bleischürze am Gauben-Kniestock auf den Dachziegeln)
      const apronFlashing = new THREE.Mesh(
        new THREE.BoxGeometry(dWidth + 0.06, 0.028, 0.15),
        fasciaMat
      );
      apronFlashing.position.set(0, 0.004, 0.04);
      apronFlashing.rotation.x = localRoofSlopeAngle;
      dormer.add(apronFlashing);

      // Visible Gauben-Kniestock / Brüstung (embedded 5.5cm into roof slab at bottom so zero gap is ever visible)
      const skirtEmbed = 0.055;
      const frontSillWall = new THREE.Mesh(
        new THREE.BoxGeometry(dWidth, sillH + skirtEmbed, cheekT),
        gableWallMat
      );
      frontSillWall.position.set(0, (sillH - skirtEmbed) / 2, -cheekT / 2);
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
      // Sample exact roof surface height along 0..dDepth and embed 5.5cm into the roof slab so there is NEVER a triangular gap!
      const shedRise = dType === 'shed' ? Math.min(maxRidgeRef * 0.38, dHeight * 0.34) : 0;
      const cheekShape = new THREE.Shape();
      cheekShape.moveTo(0, -skirtEmbed);
      cheekShape.lineTo(0, dHeight);
      cheekShape.lineTo(dDepth, dHeight + shedRise);

      const cheekSteps = 8;
      let backRoofRelY = 0;
      for (let step = cheekSteps; step >= 0; step--) {
        const distBack = (step / cheekSteps) * dDepth;
        const sampleZSigned = zDir * (zFrontAbs - distBack);
        const roofYAtSample = getRoofTopYAt(sampleZSigned, xPos);
        const relRoofY = Math.min(
          dHeight + shedRise - 0.04,
          roofYAtSample - yRoofTopAtFront
        );
        if (step === cheekSteps) {
          backRoofRelY = relRoofY;
        }
        cheekShape.lineTo(distBack, relRoofY - skirtEmbed);
      }
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

      // Rear closure wall (so the dormer back is cleanly sealed where it meets a gentle mono_pitch / sloped roof)
      const rearWallH = Math.max(0.12, dHeight + shedRise - backRoofRelY + skirtEmbed);
      const rearClosureWall = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.2, dWidth - cheekT * 2), rearWallH, cheekT),
        gableWallMat
      );
      rearClosureWall.position.set(
        0,
        backRoofRelY - skirtEmbed + rearWallH / 2,
        -dDepth + cheekT / 2
      );
      dormer.add(rearClosureWall);

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
      const dUnits = winAssembly.userData.dormerDynamicUnits as
        | DormerDynamicUnitRef[]
        | undefined;
      if (dUnits && dUnits.length > 0) {
        roofDynamicUnits.push(...dUnits);
      }

      core.add(dormer);
    }
  }

  // 5. Individual Roof Skylights / Dachflächenfenster (with Hollow Flashing, White Reveal & See-Through Glass!)
  if (skylightsList.length > 0) {
    const skylightGlassMat = createGlassMaterial(false, 0xbae6fd);

    for (const sky of skylightsList) {
      const zDir = sky.side === 'back' ? -1 : 1;
      const style = sky.style || 'velux_pivot';
      const isChimneyHatch = style === 'chimney_sweep_hatch';
      const minW = isChimneyHatch ? 0.38 : 0.55;
      const minL = isChimneyHatch ? 0.42 : 0.6;
      const sWidth = THREE.MathUtils.clamp(
        sky.width ?? (isChimneyHatch ? 0.48 : 1.14),
        minW,
        Math.max(0.7, wallLen * 0.65)
      );
      const sLen = THREE.MathUtils.clamp(
        sky.length ?? (isChimneyHatch ? 0.55 : 1.4),
        minL,
        Math.max(0.7, halfSpan * 0.85)
      );
      const xPos = THREE.MathUtils.clamp(
        sky.offsetAlongRidge ?? 0,
        -Math.max(0.1, wallLen / 2 - sWidth * 0.55),
        Math.max(0.1, wallLen / 2 - sWidth * 0.55)
      );
      const t = THREE.MathUtils.clamp(sky.slopePosition ?? 0.5, 0.18, 0.84);
      const frameMat = resolveFrameColorMaterial(sky.frameColor || 'anthracite');
      const openState = sky.openState || 'closed';
      const effectiveSkyAngle =
        cfg.type === 'mono_pitch' ? monoSlopeAngle : zDir * slopeAngleGable;

      const skyGroup = new THREE.Group();
      if (cfg.type === 'flat' || style === 'flat_roof_dome') {
        const zSurface =
          cfg.type === 'flat' ? zDir * (halfSpan * t * 0.55) : zDir * (halfSpan * t);
        const ySurface =
          cfg.type === 'flat' ? 0.14 : getRoofTopYAt(zSurface, xPos);
        skyGroup.position.set(xPos, ySurface, zSurface);
        if (cfg.type !== 'flat') {
          skyGroup.rotation.x = effectiveSkyAngle;
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
        const ySurface = getRoofTopYAt(zSurface, xPos);
        skyGroup.position.set(xPos, ySurface, zSurface);
        skyGroup.rotation.x = effectiveSkyAngle;

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
        const fRim = isChimneyHatch ? 0.042 : 0.055;
        const fH = isChimneyHatch ? 0.055 : 0.065;
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
        const sRim = isChimneyHatch ? 0.028 : 0.034;
        const skySashes: DormerDynamicSashRef[] = [];

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
          if (isChimneyHatch) {
            // Chimney sweep hatch hinges on the side (seitlicher Ausstiegsflügel)
            sashPivot.position.set(-paneW / 2, 0.055, 0);
            if (openState === 'tilted') {
              sashPivot.rotation.z = 0.28;
            } else if (openState === 'open') {
              sashPivot.rotation.z = 1.15;
            }
          } else {
            sashPivot.position.set(px, 0.055, 0);
            if (openState === 'tilted') {
              sashPivot.rotation.x = zDir * -0.25;
            } else if (openState === 'open') {
              sashPivot.rotation.x = zDir * (style === 'cabrio_balcony' ? -0.78 : -0.52);
            }
          }

          const xShift = isChimneyHatch ? paneW / 2 : 0;

          // Hollow 4-sided sash rim
          const sTop = new THREE.Mesh(
            new THREE.BoxGeometry(paneW, 0.034, sRim),
            frameMat
          );
          sTop.position.set(xShift, 0, -innerL / 2 + sRim / 2);
          const sBot = sTop.clone();
          sBot.position.z = innerL / 2 - sRim / 2;
          const sLeft = new THREE.Mesh(
            new THREE.BoxGeometry(sRim, 0.034, innerL - sRim * 2),
            frameMat
          );
          sLeft.position.set(xShift - paneW / 2 + sRim / 2, 0, 0);
          const sRight = sLeft.clone();
          sRight.position.x = xShift + paneW / 2 - sRim / 2;

          // Brushed steel ventilation handle / latch bar
          const handleBar = new THREE.Mesh(
            new THREE.BoxGeometry(Math.max(0.1, paneW - sRim * 2.2), 0.016, 0.022),
            MAT.brushedSteel
          );
          handleBar.position.set(xShift, 0.02, -innerL / 2 + sRim * 0.65);

          const glassPane = new THREE.Mesh(
            new THREE.BoxGeometry(
              Math.max(0.08, paneW - sRim * 2),
              0.016,
              Math.max(0.08, innerL - sRim * 2)
            ),
            skylightGlassMat
          );
          glassPane.position.set(xShift, 0.004, 0);

          sashPivot.add(sTop, sBot, sLeft, sRight, handleBar, glassPane);
          skyGroup.add(sashPivot);

          skySashes.push({
            sashPivot,
            sashContainer: sashPivot,
            cx: px,
            sashW: paneW,
            innerH: innerL,
            isLeftHinged: true,
            isSkylightSash: true,
            isChimneyHatch,
            zDir,
            skylightOpenAngle: style === 'cabrio_balcony' ? -0.78 : -0.52,
          });
        }

        roofDynamicUnits.push({
          entityId: sky.entityId,
          shutterEntityId: sky.shutterEntityId,
          fallbackOpenState: openState,
          fallbackShutterClosedPct: 0,
          sashes: skySashes,
        });

        // If Chimney Sweep Hatch: Add galvanized/anthracite safety step grate (Schornsteinfeger-Trittrost) right below the hatch!
        if (isChimneyHatch) {
          const stepGrate = new THREE.Group();
          stepGrate.position.set(0, 0.045, zDir * (sLen / 2 + 0.22));
          stepGrate.rotation.x = -effectiveSkyAngle; // level horizontal foot step!

          const gratePlate = new THREE.Mesh(
            new RoundedBoxGeometry(Math.max(0.46, sWidth * 0.95), 0.024, 0.25, 2, 0.005),
            MAT.brushedSteel
          );
          const bracketL = new THREE.Mesh(
            new THREE.BoxGeometry(0.035, 0.14, 0.04),
            MAT.darkMetal
          );
          bracketL.position.set(-sWidth * 0.34, -0.06, 0);
          const bracketR = bracketL.clone();
          bracketR.position.x = sWidth * 0.34;
          stepGrate.add(gratePlate, bracketL, bracketR);
          skyGroup.add(stepGrate);
        }
      }
      core.add(skyGroup);
    }
  }

  if (roofDynamicUnits.length > 0) {
    group.userData.dormerDynamicUnits = roofDynamicUnits;
    if (options?.entities) {
      updateDormerDynamicUnits(roofDynamicUnits, options.entities, 1.0);
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

  // 7. Roof-Mounted PV Solar Module Array (directly integrated on the roof slopes & avoiding dormers/skylights!)
  // Supports per-side configuration (`perSide.front`, `perSide.back`, `perSide.left`, `perSide.right`)
  if (cfg.pvConfig?.enabled && !isFocusCutaway) {
    const pvSidesOpt = cfg.pvConfig.sides || 'front';
    const globalExplicitCount =
      cfg.pvConfig.moduleCount && cfg.pvConfig.moduleCount > 0
        ? Math.round(cfg.pvConfig.moduleCount)
        : 0;
    const globalCoverageRatio =
      globalExplicitCount > 0
        ? 0.9
        : THREE.MathUtils.clamp((cfg.pvConfig.coveragePct ?? 75) / 100, 0.25, 0.95);
    const pvCellMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.16,
      metalness: 0.72,
    });
    const pvFrameMat = MAT.brushedSteel;
    const modW = 1.08;
    const modL = 1.68;
    const gap = 0.06;

    if (cfg.type === 'flat') {
      const flatCount =
        cfg.pvConfig.perSide?.front?.moduleCount !== undefined
          ? cfg.pvConfig.perSide.front.moduleCount
          : globalExplicitCount;
      const flatCov =
        flatCount > 0
          ? 0.9
          : THREE.MathUtils.clamp(
              (cfg.pvConfig.perSide?.front?.coveragePct ?? cfg.pvConfig.coveragePct ?? 75) / 100,
              0.25,
              0.95
            );
      const maxCols = Math.max(1, Math.floor(((length - 0.8) * flatCov) / (modW + gap)));
      const maxRows = Math.max(
        1,
        Math.floor(((span - 0.8) * flatCov) / (modL * 0.95 + 0.35))
      );
      const cols =
        flatCount > 0
          ? Math.max(1, Math.min(maxCols, Math.ceil(Math.sqrt(flatCount * 1.4))))
          : maxCols;
      const rows =
        flatCount > 0
          ? Math.max(1, Math.min(maxRows, Math.ceil(flatCount / cols)))
          : maxRows;
      const totalW = cols * modW + (cols - 1) * gap;
      const rowStepZ = modL * 0.95 + 0.35;
      const totalZ = rows * rowStepZ;
      let placedModules = 0;

      for (let r = 0; r < rows; r++) {
        const mz = -totalZ / 2 + (r + 0.5) * rowStepZ;
        for (let c = 0; c < cols; c++) {
          if (flatCount > 0 && placedModules >= flatCount) break;
          const mx = -totalW / 2 + modW / 2 + c * (modW + gap);
          const overlapsHole = flatDeckHoles.some(
            (h) =>
              Math.abs(mx - h.x) < (modW + h.w) / 2 + 0.18 &&
              Math.abs(mz - h.z) < (modL + h.l) / 2 + 0.18
          );
          if (overlapsHole) continue;

          const modGrp = new THREE.Group();
          modGrp.position.set(mx, 0.28, mz);
          modGrp.rotation.x = 0.28; // 16° South tilt on flat roof
          const frame = new THREE.Mesh(new THREE.BoxGeometry(modW, 0.038, modL), pvFrameMat);
          const cell = new THREE.Mesh(
            new THREE.BoxGeometry(modW - 0.04, 0.042, modL - 0.04),
            pvCellMat
          );
          modGrp.add(frame, cell);
          core.add(modGrp);
          placedModules++;
        }
      }
    } else {
      const perSideMap = cfg.pvConfig.perSide;
      const isPerSideMode = pvSidesOpt === 'per_side' || Boolean(perSideMap);

      // Determine which main slopes ('front', 'back') and hip end slopes ('left', 'right') are active
      const allCandidateSides: ('front' | 'back' | 'left' | 'right')[] =
        cfg.type === 'mono_pitch'
          ? ['front']
          : cfg.type === 'hipped' || cfg.type === 'tent'
          ? ['front', 'back', 'left', 'right']
          : ['front', 'back'];

      const activeSlopes = allCandidateSides.filter((sId) => {
        if (isPerSideMode && perSideMap) {
          const sCfg = perSideMap[sId];
          if (sCfg !== undefined) return sCfg.enabled;
          if (sId === 'left' || sId === 'right') return false;
          return pvSidesOpt === 'both' ? true : sId === pvSidesOpt;
        }
        if (sId === 'left' || sId === 'right') return false;
        return pvSidesOpt === 'both' ? true : sId === pvSidesOpt;
      });

      const defaultMaxPerSide =
        globalExplicitCount > 0 && activeSlopes.length > 0
          ? Math.ceil(globalExplicitCount / activeSlopes.length)
          : 0;

      for (const side of activeSlopes) {
        const sideCfg = perSideMap?.[side];
        const sideExplicitCount =
          sideCfg?.moduleCount !== undefined
            ? Math.max(0, Math.round(sideCfg.moduleCount))
            : defaultMaxPerSide;
        const sideCoverageRatio =
          sideExplicitCount > 0
            ? 0.92
            : sideCfg?.coveragePct !== undefined
            ? THREE.MathUtils.clamp(sideCfg.coveragePct / 100, 0.2, 0.95)
            : globalCoverageRatio;

        // Hipped / Tent West ('left') & East ('right') triangular hip slopes
        if ((side === 'left' || side === 'right') && (cfg.type === 'hipped' || cfg.type === 'tent')) {
          const xDir = side === 'right' ? 1 : -1;
          const ridgeRun = cfg.type === 'tent' ? 0 : Math.max(0, halfLen - halfSpan);
          const hipRunX = Math.max(0.6, halfLen - ridgeRun);
          const hipSlopeLen = Math.hypot(hipRunX, ridgeH);
          const hipSlopeAngle = Math.atan2(ridgeH, hipRunX);

          const usableSpanZ = Math.max(1.2, (span - 0.6) * sideCoverageRatio);
          const usableSlope = Math.max(1.2, (hipSlopeLen - 0.5) * sideCoverageRatio);
          const maxCols = Math.max(1, Math.floor(usableSpanZ / (modW + gap)));
          const maxRows = Math.max(1, Math.floor(usableSlope / (modL + gap)));

          const rows =
            sideExplicitCount > 0
              ? Math.max(1, Math.min(maxRows, Math.ceil(Math.sqrt(sideExplicitCount))))
              : maxRows;
          const cols =
            sideExplicitCount > 0
              ? Math.max(1, Math.min(maxCols, Math.ceil(sideExplicitCount / rows)))
              : maxCols;

          const arrayW = cols * modW + (cols - 1) * gap;
          const arrayL = rows * modL + (rows - 1) * gap;

          const hipPivot = new THREE.Group();
          hipPivot.position.set(
            xDir * (ridgeRun + hipRunX / 2),
            ySlopeBase + ridgeH / 2 + 0.065,
            0
          );
          hipPivot.rotation.y = xDir > 0 ? Math.PI / 2 : -Math.PI / 2;
          hipPivot.rotation.order = 'YXZ';
          hipPivot.rotation.x = hipSlopeAngle;

          let placedHip = 0;
          for (let r = 0; r < rows; r++) {
            const localZ = -arrayL / 2 + modL / 2 + r * (modL + gap);
            const tFromPeak = (localZ + hipSlopeLen / 2) / Math.max(0.2, hipSlopeLen);
            const maxHalfWAtRow = tFromPeak * halfSpan - 0.3;
            for (let c = 0; c < cols; c++) {
              if (sideExplicitCount > 0 && placedHip >= sideExplicitCount) break;
              const localX = -arrayW / 2 + modW / 2 + c * (modW + gap);
              if (Math.abs(localX) + modW * 0.42 > maxHalfWAtRow) continue;

              const frame = new THREE.Mesh(new THREE.BoxGeometry(modW, 0.036, modL), pvFrameMat);
              frame.position.set(localX, 0, localZ);
              const cell = new THREE.Mesh(
                new THREE.BoxGeometry(modW - 0.04, 0.04, modL - 0.04),
                pvCellMat
              );
              cell.position.set(localX, 0.002, localZ);
              hipPivot.add(frame, cell);
              placedHip++;
            }
          }
          core.add(hipPivot);
          continue;
        }

        // Front ('front' = Süd/Vorderseite) or Back ('back' = Nord/Rückseite) main roof slopes
        const zDir = side === 'back' ? -1 : 1;
        const slopeHoles = side === 'back' ? backSlopeHoles : frontSlopeHoles;
        const totalSlopeLen = cfg.type === 'mono_pitch' ? monoSlopeLen : slopeLenGable;
        const slopeAngle = cfg.type === 'mono_pitch' ? monoSlopeAngle : zDir * slopeAngleGable;

        const usableX = Math.max(1.2, (wallLen - 0.5) * sideCoverageRatio);
        const usableSlope = Math.max(1.5, (totalSlopeLen - 0.55) * sideCoverageRatio);
        const maxCols = Math.max(1, Math.floor(usableX / (modW + gap)));
        const maxRows = Math.max(1, Math.floor(usableSlope / (modL + gap)));

        const cols =
          sideExplicitCount > 0
            ? Math.max(
                1,
                Math.min(
                  maxCols,
                  Math.ceil(sideExplicitCount / Math.max(1, Math.min(maxRows, 2)))
                )
              )
            : maxCols;
        const rows =
          sideExplicitCount > 0
            ? Math.max(1, Math.min(maxRows, Math.ceil(sideExplicitCount / cols)))
            : maxRows;

        const arrayW = cols * modW + (cols - 1) * gap;
        const arrayL = rows * modL + (rows - 1) * gap;

        const slopeContainer = new THREE.Group();
        if (cfg.type === 'mono_pitch') {
          slopeContainer.position.set(0, ySlopeBase + monoH / 2 + 0.065, 0);
          slopeContainer.rotation.x = slopeAngle;
        } else {
          slopeContainer.position.set(0, ySlopeBase + ridgeH / 2 + 0.065, zDir * (halfSpan / 2));
          slopeContainer.rotation.x = slopeAngle;
        }

        let placedOnThisSide = 0;
        for (let r = 0; r < rows; r++) {
          const localZ = -arrayL / 2 + modL / 2 + r * (modL + gap);
          for (let c = 0; c < cols; c++) {
            if (sideExplicitCount > 0 && placedOnThisSide >= sideExplicitCount) {
              break;
            }
            const localX = -arrayW / 2 + modW / 2 + c * (modW + gap);
            // Skip any module that overlaps a dormer or skylight cutout hole!
            const overlapsCutout = slopeHoles.some(
              (h) =>
                Math.abs(localX - h.x) < (modW + h.w) / 2 + 0.22 &&
                Math.abs(localZ - h.z) < (modL + h.l) / 2 + 0.22
            );
            if (overlapsCutout) continue;

            // For hipped/tent roofs, also ensure module stays within triangular slope bounds
            if (cfg.type === 'hipped' || cfg.type === 'tent') {
              const tFromRidge =
                zDir > 0
                  ? (localZ + totalSlopeLen / 2) / totalSlopeLen
                  : (totalSlopeLen / 2 - localZ) / totalSlopeLen;
              const ridgeRun = cfg.type === 'tent' ? 0 : Math.max(0, halfLen - halfSpan);
              const maxHalfXAtRow = ridgeRun + tFromRidge * halfSpan - 0.35;
              if (Math.abs(localX) + modW / 2 > maxHalfXAtRow) continue;
            }

            const frame = new THREE.Mesh(new THREE.BoxGeometry(modW, 0.036, modL), pvFrameMat);
            frame.position.set(localX, 0, localZ);
            const cell = new THREE.Mesh(
              new THREE.BoxGeometry(modW - 0.04, 0.04, modL - 0.04),
              pvCellMat
            );
            cell.position.set(localX, 0.002, localZ);
            slopeContainer.add(frame, cell);
            placedOnThisSide++;
          }
        }
        core.add(slopeContainer);
      }
    }
  }

  return group;
}

export function getEffectiveSunSailCorners(asset: PlacedAsset): [number, number][] {
  const shape = asset.sailShape || 'quad_4mast';
  const expectedCount = shape === 'triangle_3mast' ? 3 : 4;
  if (asset.sailCorners && asset.sailCorners.length === expectedCount) {
    return asset.sailCorners;
  }
  const w = Math.max(1.5, asset.customLength ?? 4.2);
  const d = Math.max(1.5, asset.customWidth ?? 3.8);
  if (shape === 'triangle_3mast') {
    return [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [0, d / 2],
    ];
  }
  if (shape === 'trapezoid_wall') {
    return [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [+(w * 0.38).toFixed(2), d / 2],
      [-(w * 0.38).toFixed(2), d / 2],
    ];
  }
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ];
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



