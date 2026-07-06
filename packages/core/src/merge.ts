import type { Task, TaskMap, TombstoneMap } from './types';

export interface MergeResult {
  tasks: TaskMap;
  tombstones: TombstoneMap;
}

/**
 * Per-task last-write-wins merge. Every task and tombstone carries an ISO
 * timestamp; for each id we keep whichever of {local task, remote task,
 * local tombstone, remote tombstone} has the latest timestamp. This confines
 * a conflict to the single task edited on both sides instead of one side's
 * whole snapshot clobbering the other's.
 */
export function mergeTaskState(
  localTasks: TaskMap,
  localTombstones: TombstoneMap,
  remoteTasks: TaskMap,
  remoteTombstones: TombstoneMap,
): MergeResult {
  const ids = new Set<string>([
    ...Object.keys(localTasks),
    ...Object.keys(remoteTasks),
    ...Object.keys(localTombstones),
    ...Object.keys(remoteTombstones),
  ]);

  const tasks: TaskMap = {};
  const tombstones: TombstoneMap = {};

  for (const id of ids) {
    // Remote candidates are pushed before local ones and Array#sort is
    // stable, so a tie on timestamp resolves in favor of the local copy —
    // that keeps an unchanged, already-synced task's object reference
    // stable instead of needlessly replacing it with an identical remote copy.
    const candidates: Array<{ ts: string; task?: Task }> = [];
    if (remoteTombstones[id]) candidates.push({ ts: remoteTombstones[id] });
    if (localTombstones[id]) candidates.push({ ts: localTombstones[id] });
    if (remoteTasks[id]) candidates.push({ ts: remoteTasks[id].updatedAt, task: remoteTasks[id] });
    if (localTasks[id]) candidates.push({ ts: localTasks[id].updatedAt, task: localTasks[id] });

    candidates.sort((a, b) => a.ts.localeCompare(b.ts));
    const winner = candidates[candidates.length - 1];
    if (winner.task) {
      tasks[id] = winner.task;
    } else {
      tombstones[id] = winner.ts;
    }
  }

  return { tasks, tombstones };
}

export function isSameTaskMap(a: TaskMap, b: TaskMap): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((id) => a[id] === b[id]);
}
