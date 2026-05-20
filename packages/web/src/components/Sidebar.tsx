import React from 'react';

const SHORTCUTS = [
  { key: 'Enter', action: 'Add task below' },
  { key: 'Backspace', action: 'Delete empty task' },
  { key: 'Tab', action: 'Indent task' },
  { key: 'Shift+Tab', action: 'Outdent task' },
  { key: 'Ctrl+↑', action: 'Move task up' },
  { key: 'Ctrl+↓', action: 'Move task down' },
  { key: '↑ / ↓', action: 'Navigate tasks' },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <h2>Keyboard Shortcuts</h2>
      <table>
        <tbody>
          {SHORTCUTS.map(({ key, action }) => (
            <tr key={key}>
              <td>
                <kbd>{key}</kbd>
              </td>
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
  );
}
