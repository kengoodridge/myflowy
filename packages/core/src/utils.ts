import type { Task } from './types';

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

export function initialRoot(): Task {
  return {
    id: 'root',
    text: '',
    checked: false,
    pinned: false,
    collapsed: false,
    children: [],
  };
}
