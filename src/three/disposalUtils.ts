import * as THREE from 'three';
import { ActiveFloorView } from '../types/floorplan';

function disposeMaterialSafely(
  mat: THREE.Material | null | undefined,
  preserveMaterials?: Set<THREE.Material>
) {
  if (!mat) return;
  if (preserveMaterials?.has(mat)) return;
  if ((mat as THREE.Material & { userData?: Record<string, unknown> }).userData?.isSharedSingleton) {
    return;
  }
  if ((mat as THREE.Material & { userData?: Record<string, unknown> }).userData?.sharedPool) {
    return;
  }
  mat.dispose();
}

/**
 * Recursively disposes non-shared BufferGeometries and non-shared Materials (including X-Ray clone materials)
 * inside a Three.js Object3D subtree to prevent WebGL GPU memory leaks across scene rebuilds.
 * Shared procedural textures (`createSurfacePBRMaps`, `getChainlinkMeshTexture`, etc.) remain cached.
 */
export function disposeSceneGraphBranch(
  root: THREE.Object3D | null | undefined,
  preserveMaterials?: Set<THREE.Material>
): void {
  if (!root) return;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !mesh.geometry.userData?.isSharedSingleton && !mesh.geometry.userData?.sharedPool) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (mat) {
      if (Array.isArray(mat)) {
        for (const m of mat) {
          disposeMaterialSafely(m, preserveMaterials);
        }
      } else {
        disposeMaterialSafely(mat, preserveMaterials);
      }
    }
    if (mesh.userData?.xrayMat) {
      const xMat = mesh.userData.xrayMat as THREE.Material | THREE.Material[];
      if (Array.isArray(xMat)) {
        for (const xm of xMat) {
          disposeMaterialSafely(xm, preserveMaterials);
        }
      } else {
        disposeMaterialSafely(xMat, preserveMaterials);
      }
      mesh.userData.xrayMat = undefined;
    }
    if (mesh.userData?.origMat) {
      const oMat = mesh.userData.origMat as THREE.Material | THREE.Material[];
      if (Array.isArray(oMat)) {
        for (const om of oMat) {
          disposeMaterialSafely(om, preserveMaterials);
        }
      } else {
        disposeMaterialSafely(oMat, preserveMaterials);
      }
      mesh.userData.origMat = undefined;
    }
  });
}

/**
 * Filters 3D raycasting targets to only visible objects belonging to the currently active floor
 * (or all visible objects when in 'all_stacked' / Exploded View), avoiding expensive triangle intersections
 * against hidden or other-floor furniture/openings.
 */
export function collectVisibleRaycastTargets(
  groups: (THREE.Group | null | undefined)[],
  activeFloor: ActiveFloorView,
  isExplodedView: boolean
): THREE.Object3D[] {
  const targets: THREE.Object3D[] = [];
  const filterByFloor = !isExplodedView && activeFloor !== 'all_stacked';

  for (const grp of groups) {
    if (!grp || !grp.visible) continue;
    for (const child of grp.children) {
      if (!child.visible) continue;
      if (filterByFloor) {
        const itemLevel = child.userData?.level ?? child.userData?.zoneLevel;
        if (typeof itemLevel === 'number' && itemLevel !== activeFloor) {
          // Allow basement-to-ground staircases when on EG (0)
          const isCrossFloorStair =
            activeFloor === 0 && itemLevel === -1 && Boolean(child.userData?.isInteractiveAsset);
          if (!isCrossFloorStair) continue;
        }
      }
      targets.push(child);
    }
  }
  return targets;
}
