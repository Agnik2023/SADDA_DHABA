const STORAGE_KEY = "sadda-last-order-token";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

export function getLastOrderToken(): string | null {
  try {
    const token = window.localStorage.getItem(STORAGE_KEY);
    return token && TOKEN_PATTERN.test(token) ? token : null;
  } catch {
    return null;
  }
}

export function saveLastOrderToken(token: string): void {
  if (!TOKEN_PATTERN.test(token)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // The current status page still works even if storage is unavailable.
  }
}

export function isValidOrderToken(token: string | null | undefined): token is string {
  return Boolean(token && TOKEN_PATTERN.test(token));
}
