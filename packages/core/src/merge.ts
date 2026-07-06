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

  reconcileChildren(tasks, tombstones, localTasks, remoteTasks);

  return { tasks, tombstones };
}

/**
 * A task's children list is one field on that task's snapshot, so picking
 * the newer whole snapshot for a parent can silently drop a child the
 * *other* side added — the child a new task record merges in fine (nothing
 * else claims that id), but if the parent object that should reference it
 * loses the LWW pick, nothing points to it and it never renders.
 *
 * For any parent edited on both sides, union in children the winning
 * snapshot is missing, unless that child is already claimed by some other
 * (winning) parent — which means it was actually moved elsewhere, not just
 * dropped, and re-adding it here would duplicate it into two parents.
 */
function reconcileChildren(
  tasks: TaskMap,
  tombstones: TombstoneMap,
  localTasks: TaskMap,
  remoteTasks: TaskMap,
): void {
  const claimedBy = new Set<string>();
  for (const task of Object.values(tasks)) {
    for (const childId of task.children) claimedBy.add(childId);
  }

  for (const [id, merged] of Object.entries(tasks)) {
    const local = localTasks[id];
    const remote = remoteTasks[id];
    if (!local || !remote) continue; // only one side has an opinion on this task — nothing to reconcile

    const seen = new Set(merged.children);
    const additions: string[] = [];
    for (const childId of [...local.children, ...remote.children]) {
      if (seen.has(childId)) continue;
      if (tombstones[childId]) continue; // deleted — don't resurrect
      if (claimedBy.has(childId)) continue; // already placed under a different winning parent (moved, not dropped)
      seen.add(childId);
      claimedBy.add(childId);
      additions.push(childId);
    }
    if (additions.length > 0) {
      tasks[id] = { ...merged, children: [...merged.children, ...additions] };
    }
  }
}

export function isSameTaskMap(a: TaskMap, b: TaskMap): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((id) => a[id] === b[id]);
}
