import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthGate } from '../components/AuthGate';

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGoogleLogin: vi.fn(),
}));

vi.mock('@myflowy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@myflowy/core')>();
  return { ...actual, setAccessToken: vi.fn() };
});

import { useGoogleLogin } from '@react-oauth/google';

describe('AuthGate', () => {
  beforeEach(() => {
    vi.mocked(useGoogleLogin).mockReturnValue(vi.fn());
    localStorage.clear();
  });

  it('renders children when authenticated', () => {
    render(
      <AuthGate clientId="test-id" isAuthenticated={true} onSignIn={vi.fn()}>
        <div>App content</div>
      </AuthGate>
    );
    expect(screen.getByText('App content')).toBeInTheDocument();
  });

  it('renders sign-in button when not authenticated', () => {
    render(
      <AuthGate clientId="test-id" isAuthenticated={false} onSignIn={vi.fn()}>
        <div>App content</div>
      </AuthGate>
    );
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText('App content')).not.toBeInTheDocument();
  });

  it('calls the login function when sign-in button is clicked', () => {
    const mockLogin = vi.fn();
    vi.mocked(useGoogleLogin).mockReturnValue(mockLogin);

    render(
      <AuthGate clientId="test-id" isAuthenticated={false} onSignIn={vi.fn()}>
        <div>App content</div>
      </AuthGate>
    );

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(mockLogin).toHaveBeenCalledOnce();
  });
});
