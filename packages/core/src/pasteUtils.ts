import type { Task, TaskMap } from './types';

export interface TaskEditor {
  addTask(parentId: string, afterId: string | null): string;
  updateTask(task: Task): void;
  getTasks(): TaskMap;
}

interface ParsedLine {
  level: number;
  text: string;
}

function countIndent(line: string): number {
  let level = 0;
  let i = 0;
  while (i < line.length) {
    if (line[i] === '\t') {
      level++;
      i++;
    } else if (line[i] === ' ') {
      let spaces = 0;
      while (i < line.length && line[i] === ' ') { spaces++; i++; }
      level += Math.max(1, Math.round(spaces / 2));
    } else {
      break;
    }
  }
  return level;
}

export function parsePastedText(text: string): ParsedLine[] {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return [];

  const parsed = lines.map((line) => ({ level: countIndent(line), text: line.trim() }));
  const minLevel = Math.min(...parsed.map((p) => p.level));
  return parsed.map((p) => ({ ...p, level: p.level - minLevel }));
}

export function insertParsedLines(
  lines: ParsedLine[],
  store: TaskEditor,
  afterTaskId: string,
  parentId: string,
): string {
  const parentStack: string[] = [];
  parentStack[0] = parentId;

  const lastAtLevel: (string | null)[] = [];
  lastAtLevel[0] = afterTaskId;

  let lastId = afterTaskId;

  for (const { level, text } of lines) {
    const itemParentId = parentStack[level] ?? parentStack[parentStack.length - 1];
    const afterId = lastAtLevel[level] ?? null;

    const newId = store.addTask(itemParentId, afterId);
    store.updateTask({ ...store.getTasks()[newId], text });

    lastAtLevel[level] = newId;
    lastId = newId;

    parentStack[level + 1] = newId;
    for (let l = level + 2; l < lastAtLevel.length; l++) lastAtLevel[l] = null;
  }

  return lastId;
}
