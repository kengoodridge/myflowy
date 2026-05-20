import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar';

describe('Sidebar', () => {
  it('renders keyboard shortcuts table', () => {
    render(<Sidebar />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('lists all shortcut keys', () => {
    render(<Sidebar />);
    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('Backspace')).toBeInTheDocument();
    expect(screen.getByText('Tab')).toBeInTheDocument();
    expect(screen.getByText('Shift+Tab')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+↑')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+↓')).toBeInTheDocument();
    expect(screen.getByText('↑ / ↓')).toBeInTheDocument();
  });

  it('renders about section with app name', () => {
    render(<Sidebar />);
    expect(screen.getByText('MyFlowy')).toBeInTheDocument();
  });
});
