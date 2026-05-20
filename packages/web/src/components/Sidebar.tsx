import React from 'react';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS = [
  { key: 'Enter',              action: 'New task below' },
  { key: 'Backspace',          action: 'Delete empty task' },
  { key: 'Tab',                action: 'Indent' },
  { key: 'Shift+Tab',          action: 'Outdent' },
  { key: `${mod}+↑`,          action: 'Move task up' },
  { key: `${mod}+↓`,          action: 'Move task down' },
  { key: '↑ / ↓',             action: 'Navigate tasks' },
  { key: `${mod}+Z`,          action: 'Undo' },
  { key: `${mod}+C`,          action: 'Copy selected' },
  { key: `${mod}+X`,          action: 'Cut selected' },
  { key: `${mod}+Enter`,      action: 'Toggle done' },
  { key: `${mod}+Backspace`,  action: 'Delete with children' },
];

export interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

export function Sidebar({ open, onToggle }: SidebarProps) {
  return (
    <>
      <button
        className={`help-toggle${open ? ' help-toggle--active' : ''}`}
        onClick={onToggle}
        title={open ? 'Hide help' : 'Keyboard shortcuts & about'}
        aria-label="Toggle help"
      >
        ℹ
      </button>
      {open && (
        <aside className="sidebar">
          <h2>Keyboard Shortcuts</h2>
          <table>
            <tbody>
              {SHORTCUTS.map(({ key, action }) => (
                <tr key={key}>
                  <td><kbd>{key}</kbd></td>
                  <td>{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <section>
            <h2>About</h2>
            <p>
              <strong>MyFlowy</strong> — a local-first outliner backed by Google Drive.
            </p>
          </section>
        </aside>
      )}
    </>
  );
}
