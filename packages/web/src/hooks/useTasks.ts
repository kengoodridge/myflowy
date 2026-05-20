import { useState, useEffect, useCallback } from 'react';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';

export function useTasks(store: TaskStore): TaskMap {
  const [tasks, setTasks] = useState<TaskMap>(() => store.getTasks());

  const handleChange = useCallback(() => {
    setTasks(store.getTasks());
  }, [store]);

  useEffect(() => {
    store.addEventListener('change', handleChange);
    return () => store.removeEventListener('change', handleChange);
  }, [store, handleChange]);

  return tasks;
}
