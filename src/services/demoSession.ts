const SESSION_KEY = 'agridataconnect.demo.session.v1';

// Only the selected profile is stored here. Business persistence belongs to step 2.
export function readSession(): string | null {
  try { return sessionStorage.getItem(SESSION_KEY); }
  catch { return null; }
}

export function writeSession(profileId: string | null): boolean {
  try {
    if (profileId) sessionStorage.setItem(SESSION_KEY, profileId);
    else sessionStorage.removeItem(SESSION_KEY);
    return true;
  } catch { return false; }
}
