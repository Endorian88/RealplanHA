import {
  buildDefaultAutoPowerLines,
  FloorplanProject,
  FloorplanZone,
} from '../types/floorplan';

export const STORAGE_KEY = 'realplan3d_estate_project_v7_empty';

export const EMPTY_FLOORPLAN_PROJECT: FloorplanProject = {
  title: 'Mein Smart Home Grundriss',
  version: '2.0.0',
  zones: [],
  openings: [],
  assets: [],
};

/**
 * Normalizes a FloorplanProject and ensures that no two doors, windows, shutters,
 * or roller gates accidentally share the same default simulated entityId/tiltEntityId/shutterEntityId.
 */
export function deduplicateProjectOpeningsAndGates(proj: FloorplanProject): FloorplanProject {
  if (!proj || typeof proj !== 'object') {
    return EMPTY_FLOORPLAN_PROJECT;
  }
  const usedPrimary = new Set<string>();
  const usedTilt = new Set<string>();
  const usedShutter = new Set<string>();

  const seenZoneIds = new Set<string>();
  const nextZones = (Array.isArray(proj.zones) ? proj.zones : [])
    .filter((z) => {
      if (!z || typeof z.id !== 'string' || !z.id || seenZoneIds.has(z.id)) return false;
      seenZoneIds.add(z.id);
      return true;
    })
    .map((z) => ({
      ...z,
      name: typeof z.name === 'string' && z.name.trim() ? z.name : z.id,
      x: Number.isFinite(z.x) ? z.x : 0,
      z: Number.isFinite(z.z) ? z.z : 0,
      width: Number.isFinite(z.width) && z.width > 0.2 ? z.width : 4,
      depth: Number.isFinite(z.depth) && z.depth > 0.2 ? z.depth : 4,
      zoneType: z.zoneType === 'outdoor' ? 'outdoor' : 'indoor',
    })) as FloorplanZone[];

  const seenOpeningIds = new Set<string>();
  const uniqueOpenings = (Array.isArray(proj.openings) ? proj.openings : []).filter((op) => {
    if (!op || typeof op.id !== 'string' || !op.id || seenOpeningIds.has(op.id)) return false;
    seenOpeningIds.add(op.id);
    return true;
  });

  const seenAssetIds = new Set<string>();
  const uniqueAssets = (Array.isArray(proj.assets) ? proj.assets : []).filter((a) => {
    if (
      !a ||
      typeof a.id !== 'string' ||
      !a.id ||
      typeof a.catalogId !== 'string' ||
      seenAssetIds.has(a.id)
    ) {
      return false;
    }
    seenAssetIds.add(a.id);
    return true;
  });

  const seenWallIds = new Set<string>();
  const nextCustomWalls = Array.isArray(proj.customWalls)
    ? proj.customWalls.filter((w) => {
        if (
          !w ||
          typeof w.id !== 'string' ||
          !w.id ||
          !Number.isFinite(w.x1) ||
          !Number.isFinite(w.z1) ||
          !Number.isFinite(w.x2) ||
          !Number.isFinite(w.z2) ||
          seenWallIds.has(w.id)
        ) {
          return false;
        }
        seenWallIds.add(w.id);
        return true;
      })
    : undefined;

  const nextOpenings = uniqueOpenings.map((op, idx) => {
    const cleanId = op.id.replace(/[^a-zA-Z0-9_]/g, '_') || `op_${idx}`;
    let entityId = op.entityId;
    let tiltEntityId = op.tiltEntityId;
    let shutterEntityId = op.shutterEntityId;

    if (entityId) {
      if (usedPrimary.has(entityId)) {
        const prefix =
          op.type === 'garage_door' || op.type === 'double_patio_door'
            ? 'cover.opening'
            : 'binary_sensor.opening';
        entityId = `${prefix}_${cleanId}`;
      }
      usedPrimary.add(entityId);
    }

    if (tiltEntityId) {
      if (usedTilt.has(tiltEntityId)) {
        tiltEntityId = `binary_sensor.opening_${cleanId}_tilt`;
      }
      usedTilt.add(tiltEntityId);
    }

    if (shutterEntityId) {
      if (usedShutter.has(shutterEntityId)) {
        shutterEntityId = `cover.rollladen_${cleanId}`;
      }
      usedShutter.add(shutterEntityId);
    }

    if (
      entityId !== op.entityId ||
      tiltEntityId !== op.tiltEntityId ||
      shutterEntityId !== op.shutterEntityId
    ) {
      return {
        ...op,
        entityId,
        tiltEntityId,
        shutterEntityId,
      };
    }
    return op;
  });

  const nextAssets = uniqueAssets.map((asset, idx) => {
    const safePos: [number, number, number] =
      Array.isArray(asset.position) &&
      asset.position.length >= 3 &&
      typeof asset.position[0] === 'number' &&
      typeof asset.position[1] === 'number' &&
      typeof asset.position[2] === 'number'
        ? asset.position
        : [0, 0, 0];
    const normalizedAsset =
      safePos === asset.position ? asset : { ...asset, position: safePos };
    const isGateOrCover =
      normalizedAsset.catalogId === 'electric_roller_gate' ||
      normalizedAsset.catalogId === 'electric_sliding_driveway_gate' ||
      normalizedAsset.catalogId === 'garden_pedestrian_gate' ||
      normalizedAsset.catalogId === 'garage_door_opener_rail';
    if (isGateOrCover && normalizedAsset.entityId) {
      if (usedPrimary.has(normalizedAsset.entityId)) {
        const cleanAssetId = normalizedAsset.id.replace(/[^a-zA-Z0-9_]/g, '_') || `gate_${idx}`;
        const uniqueGateEntity = `cover.tor_${cleanAssetId}`;
        usedPrimary.add(uniqueGateEntity);
        return { ...normalizedAsset, entityId: uniqueGateEntity };
      }
      usedPrimary.add(normalizedAsset.entityId);
    }
    return normalizedAsset;
  });

  // Preserve an explicit empty powerLines array if the user deleted all power lines
  const nextPowerLines = Array.isArray(proj.powerLines)
    ? proj.powerLines
    : buildDefaultAutoPowerLines({ zones: nextZones, assets: nextAssets });

  return {
    ...proj,
    zones: nextZones,
    openings: nextOpenings,
    assets: nextAssets,
    powerLines: nextPowerLines,
    ...(nextCustomWalls ? { customWalls: nextCustomWalls } : {}),
  };
}

/**
 * Loads the initial FloorplanProject from localStorage, falling back to an empty project.
 */
export function loadInitialProjectFromStorage(): FloorplanProject {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.zones) && Array.isArray(parsed.assets)) {
        return deduplicateProjectOpeningsAndGates(parsed);
      }
    }
  } catch {
    // Fallback to empty project
  }
  return EMPTY_FLOORPLAN_PROJECT;
}
