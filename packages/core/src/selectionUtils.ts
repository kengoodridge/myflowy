import type { TaskMap } from './types';
import { findParent } from './treeUtils';

export function getTopLevelSelected(selectedIds: Set<string>, tasks: TaskMap): string[] {
  return [...selectedIds].filter((id) => {
    const parentId = findParent(id, tasks);
    return !parentId || !selectedIds.has(parentId);
  });
}

function serializeSubtree(id: string, tasks: TaskMap, indent = 0): string {
  const task = tasks[id];
  if (!task) return '';
  const line = '\t'.repeat(indent) + task.text;
  if (task.children.length === 0) return line;
  const childLines = task.children.map((c) => serializeSubtree(c, tasks, indent + 1)).join('\n');
  return line + '\n' + childLines;
}

export function serializeSubtrees(topLevelIds: string[], tasks: TaskMap): string {
  return topLevelIds.map((id) => serializeSubtree(id, tasks)).join('\n');
}
