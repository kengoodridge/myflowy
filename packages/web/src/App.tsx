import React, { useState, useEffect } from 'react';
import { IDBLocalStore, SyncEngine, setAccessToken } from '@myflowy/core';
import { TaskStore } from './store/TaskStore';
import { useTasks } from './hooks/useTasks';
import { AuthGate } from './components/AuthGate';
import { TaskTree } from './components/TaskTree';
import { Controls } from './components/Controls';
import { Sidebar } from './components/Sidebar';
import './styles/index.css';

const STORAGE_KEY = 'myflowy_access_token';

const localStore = new IDBLocalStore();
const engine = new SyncEngine(localStore);
const taskStore = new TaskStore(engine);

export function App() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const tasks = useTasks(taskStore);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (token) setAccessToken(token);
    taskStore.initialize().then(() => {
      if (token) taskStore.syncFromDrive().catch(console.error);
    });
    return () => engine.destroy();
  }, []); // intentionally empty — run once on mount

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

  return (
    <AuthGate clientId={CLIENT_ID} isAuthenticated={!!token} onSignIn={setToken}>
      <TaskTree
        rootId="root"
        tasks={tasks}
        store={taskStore}
        focusId={focusId}
        onFocusRequest={setFocusId}
      />
      <Controls
        tasks={tasks}
        store={taskStore}
        focusId={focusId}
        onFocusRequest={setFocusId}
      />
      <Sidebar />
    </AuthGate>
  );
}
