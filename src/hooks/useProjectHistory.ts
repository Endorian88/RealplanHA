import React, { useEffect, useRef, useState } from 'react';
import { FloorplanProject } from '../types/floorplan';

const cloneSnapshot = (proj: FloorplanProject): FloorplanProject =>
  typeof structuredClone === 'function' ? structuredClone(proj) : JSON.parse(JSON.stringify(proj));

export interface UseProjectHistoryResult {
  historyCounts: { undo: number; redo: number };
  handleUndo: () => void;
  handleRedo: () => void;
  skipNextRemoteEchoRef: React.MutableRefObject<boolean>;
}

/**
 * Encapsulates Undo / Redo snapshot history for FloorplanProject,
 * coalescing rapid drag updates (< 450ms) into single undo steps and ignoring
 * non-structural UI/dock preference updates.
 */
export function useProjectHistory(
  project: FloorplanProject,
  setProject: React.Dispatch<React.SetStateAction<FloorplanProject>>
): UseProjectHistoryResult {
  const undoStackRef = useRef<FloorplanProject[]>([]);
  const redoStackRef = useRef<FloorplanProject[]>([]);
  const lastCommittedProjectRef = useRef<FloorplanProject>(project);
  const lastPushTimeRef = useRef<number>(0);
  const isUndoRedoActionRef = useRef<boolean>(false);
  const skipNextRemoteEchoRef = useRef<boolean>(false);
  const [historyCounts, setHistoryCounts] = useState<{ undo: number; redo: number }>({
    undo: 0,
    redo: 0,
  });

  useEffect(() => {
    if (isUndoRedoActionRef.current) {
      lastCommittedProjectRef.current = project;
      isUndoRedoActionRef.current = false;
      return;
    }
    if (skipNextRemoteEchoRef.current) {
      lastCommittedProjectRef.current = project;
      return;
    }
    const prevSnapshot = lastCommittedProjectRef.current;
    if (prevSnapshot === project) return;

    // If only dockPreferences changed inside liveCockpitConfig, update lastCommittedProjectRef without polluting Undo stack
    const isOnlyDockPrefChange =
      prevSnapshot.zones === project.zones &&
      prevSnapshot.openings === project.openings &&
      prevSnapshot.assets === project.assets &&
      prevSnapshot.customWalls === project.customWalls &&
      prevSnapshot.powerLines === project.powerLines &&
      prevSnapshot.northAngle === project.northAngle &&
      prevSnapshot.liveCockpitConfig?.dockPreferences !==
        project.liveCockpitConfig?.dockPreferences;

    if (isOnlyDockPrefChange) {
      lastCommittedProjectRef.current = project;
      return;
    }

    const now = performance.now();
    if (now - lastPushTimeRef.current > 450) {
      undoStackRef.current.push(cloneSnapshot(prevSnapshot));
      if (undoStackRef.current.length > 50) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      setHistoryCounts({
        undo: undoStackRef.current.length,
        redo: 0,
      });
    }
    lastPushTimeRef.current = now;
    lastCommittedProjectRef.current = project;
  }, [project]);

  const handleUndo = () => {
    if (undoStackRef.current.length === 0) return;
    const prevSnapshot = undoStackRef.current.pop()!;
    redoStackRef.current.push(cloneSnapshot(project));
    isUndoRedoActionRef.current = true;
    lastPushTimeRef.current = 0;
    setProject(prevSnapshot);
    setHistoryCounts({
      undo: undoStackRef.current.length,
      redo: redoStackRef.current.length,
    });
  };

  const handleRedo = () => {
    if (redoStackRef.current.length === 0) return;
    const nextSnapshot = redoStackRef.current.pop()!;
    undoStackRef.current.push(cloneSnapshot(project));
    isUndoRedoActionRef.current = true;
    lastPushTimeRef.current = 0;
    setProject(nextSnapshot);
    setHistoryCounts({
      undo: undoStackRef.current.length,
      redo: redoStackRef.current.length,
    });
  };

  return {
    historyCounts,
    handleUndo,
    handleRedo,
    skipNextRemoteEchoRef,
  };
}
