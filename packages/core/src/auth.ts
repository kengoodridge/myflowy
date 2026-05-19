let _token: string | null = null;

export function getAccessToken(): string | null {
  return _token;
}

export function setAccessToken(token: string): void {
  _token = token;
}

export function clearAccessToken(): void {
  _token = null;
}
