import type { TaskMap } from '@myflowy/core';

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
