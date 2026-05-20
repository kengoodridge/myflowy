import type { TaskMap } from './types';

export function getVisibleOrder(rootId: string, tasks: TaskMap): string[] {
  const order: string[] = [];

  function visit(id: string): void {
    const task = tasks[id];
    if (!task) return;
    if (id !== rootId) order.push(id);
    if (!task.collapsed) {
      for (const childId of task.children) {
        visit(childId);
      }
    }
  }

  visit(rootId);
  return order;
}

export function findParent(id: string, tasks: TaskMap): string | null {
  for (const [taskId, task] of Object.entries(tasks)) {
    if (task.children.includes(id)) return taskId;
  }
  return null;
}

export function isAncestorOf(ancestorId: string, id: string, tasks: TaskMap): boolean {
  const ancestor = tasks[ancestorId];
  if (!ancestor) return false;
  if (ancestor.children.includes(id)) return true;
  return ancestor.children.some((childId) => isAncestorOf(childId, id, tasks));
}
