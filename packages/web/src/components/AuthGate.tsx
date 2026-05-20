import React from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { setAccessToken } from '@myflowy/core';

const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';
const STORAGE_KEY = 'myflowy_access_token';

interface SignInButtonProps {
  onSignIn: (token: string) => void;
}

function SignInButton({ onSignIn }: SignInButtonProps) {
  const login = useGoogleLogin({
    scope: SCOPES,
    onSuccess: (response) => {
      const token = response.access_token;
      localStorage.setItem(STORAGE_KEY, token);
      setAccessToken(token);
      onSignIn(token);
    },
    onError: () => console.error('[AuthGate] Sign in failed'),
  });

  return (
    <div className="auth-gate">
      <h1>MyFlowy</h1>
      <button onClick={() => login()}>Sign in with Google</button>
    </div>
  );
}

export interface AuthGateProps {
  clientId: string;
  isAuthenticated: boolean;
  onSignIn: (token: string) => void;
  children: React.ReactNode;
}

export function AuthGate({ clientId, isAuthenticated, onSignIn, children }: AuthGateProps) {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      {isAuthenticated ? <>{children}</> : <SignInButton onSignIn={onSignIn} />}
    </GoogleOAuthProvider>
  );
}
