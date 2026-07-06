import type { Task } from './types';

export function uuid(): string {
  return crypto.randomUUID();
}

export function initialRoot(): Task {
  return {
    id: 'root',
    text: '',
    checked: false,
    pinned: false,
    collapsed: false,
    children: [],
    updatedAt: new Date().toISOString(),
  };
}
