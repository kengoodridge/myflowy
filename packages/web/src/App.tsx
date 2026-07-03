import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IDBLocalStore, SyncEngine, setAccessToken,
  getVisibleOrder, findParent, getTopLevelSelected, serializeSubtrees,
} from '@myflowy/core';
import { TaskStore } from './store/TaskStore';
import { useTasks } from './hooks/useTasks';
import { AuthGate } from './components/AuthGate';
import { SyncBanner } from './components/SyncBanner';
import { TaskTree } from './components/TaskTree';
import { Breadcrumb } from './components/Breadcrumb';
import { PinnedPanel } from './components/PinnedPanel';
import { Controls } from './components/Controls';
import { Sidebar } from './components/Sidebar';
import { getIdleResyncMs } from './config';
import './styles/index.css';

const STORAGE_KEY = 'myflowy_access_token';

const localStore = new IDBLocalStore();
const engine = new SyncEngine(localStore);
const taskStore = new TaskStore(engine);
const IDLE_RESYNC_MS = getIdleResyncMs();

type SyncState =
  | { status: 'idle' }
  | { status: 'synced'; at: Date }
  | { status: 'auth-error' }
  | { status: 'error'; message: string };

export function App() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const tasks = useTasks(taskStore);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [rootId, setRootId] = useState('root');
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelectingRef = useRef(false);
  const selectionAnchorRef = useRef<string | null>(null);

  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    if (token) setAccessToken(token);
    taskStore.initialize().then(() => {
      if (token) taskStore.syncFromDrive().catch(console.error);
      const tasks = taskStore.getTasks();
      if (tasks['root'] && tasks['root'].children.length === 0) {
        const firstId = taskStore.addTask('root', null);
        setFocusId(firstId);
      }
    });
    return () => engine.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleAuthError = () => setSyncState({ status: 'auth-error' });
    const handleSyncComplete = (e: Event) => {
      const { ok, message } = (e as CustomEvent<{ ok: boolean; message: string }>).detail;
      setSyncState(ok ? { status: 'synced', at: new Date() } : { status: 'error', message });
    };
    taskStore.addEventListener('auth-error', handleAuthError);
    taskStore.addEventListener('sync-complete', handleSyncComplete);
    return () => {
      taskStore.removeEventListener('auth-error', handleAuthError);
      taskStore.removeEventListener('sync-complete', handleSyncComplete);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const runIdleResync = () => {
      taskStore.syncFromDrive()
        .then(() => setSyncState({ status: 'synced', at: new Date() }))
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          setSyncState({ status: 'error', message });
        })
        .finally(() => {
          idleTimer = setTimeout(runIdleResync, IDLE_RESYNC_MS);
        });
    };
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(runIdleResync, IDLE_RESYNC_MS);
    };
    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
    ];
    for (const eventName of events) {
      window.addEventListener(eventName, resetIdleTimer);
    }
    resetIdleTimer();
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      for (const eventName of events) {
        window.removeEventListener(eventName, resetIdleTimer);
      }
    };
  }, [token]);

  const handleReconnect = useCallback((newToken: string) => {
    localStorage.setItem(STORAGE_KEY, newToken);
    setAccessToken(newToken);
    setSyncState({ status: 'idle' });
    taskStore.syncFromDrive()
      .then(() => engine.flushToDrive())
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setSyncState({ status: 'error', message });
      });
  }, []);

  useEffect(() => {
    const onMouseUp = () => { isSelectingRef.current = false; };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;

      if (e.key === 'z') {
        e.preventDefault();
        taskStore.undo();
        setFocusId(null);
        return;
      }

      if (e.key !== 'c' && e.key !== 'x') return;
      const sel = selectedIdsRef.current;
      if (sel.size === 0) return;
      e.preventDefault();
      const t = tasksRef.current;
      const topLevel = getTopLevelSelected(sel, t);
      const text = serializeSubtrees(topLevel, t);
      navigator.clipboard.writeText(text).catch(console.error);
      if (e.key === 'x') {
        const deletions = topLevel.map((id) => ({ id, parentId: findParent(id, t) }));
        taskStore.beginBatch();
        for (const { id, parentId } of deletions) {
          if (parentId) taskStore.removeTaskDeep(id, parentId);
        }
        taskStore.endBatch();
        setSelectedIds(new Set());
        setFocusId(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRowEnter = useCallback((id: string, hasButton: boolean) => {
    if (!hasButton) return;
    window.getSelection()?.removeAllRanges();
    if (!isSelectingRef.current) {
      isSelectingRef.current = true;
      selectionAnchorRef.current = id;
      setSelectedIds(new Set([id]));
    } else {
      const anchor = selectionAnchorRef.current;
      if (!anchor) return;
      const order = getVisibleOrder(rootId, taskStore.getTasks());
      const anchorIdx = order.indexOf(anchor);
      const currentIdx = order.indexOf(id);
      if (anchorIdx === -1 || currentIdx === -1) return;
      const [start, end] = anchorIdx <= currentIdx
        ? [anchorIdx, currentIdx]
        : [currentIdx, anchorIdx];
      setSelectedIds(new Set(order.slice(start, end + 1)));
    }
  }, [rootId]);

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

  return (
    <AuthGate clientId={CLIENT_ID} isAuthenticated={!!token} onSignIn={setToken}>
      {syncState.status === 'auth-error' && (
        <SyncBanner onReconnect={handleReconnect} />
      )}
      {syncState.status === 'error' && (
        <div className="sync-banner sync-banner--error">
          <span>Drive sync failed: {syncState.message}</span>
          <button onClick={() => setSyncState({ status: 'idle' })}>Dismiss</button>
        </div>
      )}
      <PinnedPanel tasks={tasks} store={taskStore} onNavigate={setRootId} />
      <Breadcrumb rootId={rootId} tasks={tasks} onNavigate={setRootId} />
      {syncState.status === 'synced' && (
        <div className="sync-ok">
          Drive synced {formatAge(syncState.at)}
        </div>
      )}
      <TaskTree
        rootId={rootId}
        tasks={tasks}
        store={taskStore}
        focusId={focusId}
        onFocusRequest={setFocusId}
        onZoom={setRootId}
        selectedIds={selectedIds}
        onRowEnter={handleRowEnter}
      />
      {/* <Controls tasks={tasks} store={taskStore} focusId={focusId} onFocusRequest={setFocusId} /> */}
      <Sidebar open={showHelp} onToggle={() => setShowHelp((v) => !v)} />
    </AuthGate>
  );
}

function formatAge(d: Date): string {
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  return `${Math.round(sec / 60)}m ago`;
}
