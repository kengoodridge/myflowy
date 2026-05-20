import type { Task, TaskMap } from '@myflowy/core';
import { uuid } from '@myflowy/core';
import type { SyncEngine } from '@myflowy/core';

export class TaskStore extends EventTarget {
  private engine: SyncEngine;
  private tasks: TaskMap = {};

  constructor(engine: SyncEngine) {
    super();
    this.engine = engine;
  }

  async initialize(): Promise<void> {
    this.tasks = await this.engine.initialize();
    this.emit();
  }

  async syncFromDrive(): Promise<void> {
    const remote = await this.engine.syncFromDrive();
    if (remote) {
      this.tasks = remote;
      this.emit();
    }
  }

  getTasks(): TaskMap {
    return this.tasks;
  }

  updateTask(task: Task): void {
    this.tasks = { ...this.tasks, [task.id]: task };
    this.emit();
    this.engine.setTask(task).catch(console.error);
  }

  addTask(parentId: string, afterId: string | null): string {
    const id = uuid();
    const newTask: Task = {
      id,
      text: '',
      checked: false,
      pinned: false,
      collapsed: false,
      children: [],
    };
    const parent = this.tasks[parentId];
    const children = [...parent.children];
    if (afterId === null) {
      children.push(id);
    } else {
      const afterIndex = children.indexOf(afterId);
      children.splice(afterIndex + 1, 0, id);
    }
    const updatedParent = { ...parent, children };
    this.tasks = { ...this.tasks, [id]: newTask, [parentId]: updatedParent };
    this.emit();
    this.engine.setTask(newTask).catch(console.error);
    this.engine.setTask(updatedParent).catch(console.error);
    return id;
  }

  removeTask(id: string, parentId: string): void {
    const parent = this.tasks[parentId];
    const updatedParent = { ...parent, children: parent.children.filter((c) => c !== id) };
    const { [id]: _removed, ...rest } = this.tasks;
    this.tasks = { ...rest, [parentId]: updatedParent };
    this.emit();
    this.engine.removeTask(id).catch(console.error);
    this.engine.setTask(updatedParent).catch(console.error);
  }

  indentTask(id: string, parentId: string): void {
    const parent = this.tasks[parentId];
    const idx = parent.children.indexOf(id);
    if (idx === 0) return;
    const newParentId = parent.children[idx - 1];
    const newParent = this.tasks[newParentId];
    const updatedParent = { ...parent, children: parent.children.filter((c) => c !== id) };
    const updatedNewParent = { ...newParent, children: [...newParent.children, id] };
    this.tasks = { ...this.tasks, [parentId]: updatedParent, [newParentId]: updatedNewParent };
    this.emit();
    this.engine.setTask(updatedParent).catch(console.error);
    this.engine.setTask(updatedNewParent).catch(console.error);
  }

  outdentTask(id: string, parentId: string, grandparentId: string): void {
    const parent = this.tasks[parentId];
    const grandparent = this.tasks[grandparentId];
    const parentIdx = grandparent.children.indexOf(parentId);
    const updatedParent = { ...parent, children: parent.children.filter((c) => c !== id) };
    const gpChildren = [...grandparent.children];
    gpChildren.splice(parentIdx + 1, 0, id);
    const updatedGrandparent = { ...grandparent, children: gpChildren };
    this.tasks = { ...this.tasks, [parentId]: updatedParent, [grandparentId]: updatedGrandparent };
    this.emit();
    this.engine.setTask(updatedParent).catch(console.error);
    this.engine.setTask(updatedGrandparent).catch(console.error);
  }

  moveTaskUp(id: string, parentId: string): void {
    const parent = this.tasks[parentId];
    const idx = parent.children.indexOf(id);
    if (idx === 0) return;
    const children = [...parent.children];
    [children[idx - 1], children[idx]] = [children[idx], children[idx - 1]];
    const updatedParent = { ...parent, children };
    this.tasks = { ...this.tasks, [parentId]: updatedParent };
    this.emit();
    this.engine.setTask(updatedParent).catch(console.error);
  }

  moveTaskDown(id: string, parentId: string): void {
    const parent = this.tasks[parentId];
    const idx = parent.children.indexOf(id);
    if (idx === parent.children.length - 1) return;
    const children = [...parent.children];
    [children[idx], children[idx + 1]] = [children[idx + 1], children[idx]];
    const updatedParent = { ...parent, children };
    this.tasks = { ...this.tasks, [parentId]: updatedParent };
    this.emit();
    this.engine.setTask(updatedParent).catch(console.error);
  }

  private emit(): void {
    this.dispatchEvent(new Event('change'));
  }
}
