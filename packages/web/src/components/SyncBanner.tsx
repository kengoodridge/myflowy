import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';

const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';

interface SyncBannerProps {
  onReconnect: (token: string) => void;
}

export function SyncBanner({ onReconnect }: SyncBannerProps) {
  const login = useGoogleLogin({
    scope: SCOPES,
    onSuccess: (response) => onReconnect(response.access_token),
    onError: () => console.error('[SyncBanner] Re-auth failed'),
  });

  return (
    <div className="sync-banner">
      <span>Drive sync paused — session expired</span>
      <button onClick={() => login()}>Sign in again</button>
    </div>
  );
}
