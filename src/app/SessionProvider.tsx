import { createContext, startTransition, useContext, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DemoProfile } from '../domain/types';
import { readSession, writeSession } from '../services/demoSession';
import { hasPendingApiRequests } from '../services/apiClient';
import { demoProfiles } from './profiles';

interface SessionContextValue {
  profile: DemoProfile | null;
  selectProfile: (id: string) => boolean;
  logout: () => boolean;
  storageWarning: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<DemoProfile | null>(() => demoProfiles.find(p => p.id === readSession()) ?? null);
  const [storageWarning, setStorageWarning] = useState(false);

  function selectProfile(id: string) {
    if (hasPendingApiRequests()) return false;
    const next = demoProfiles.find(p => p.id === id);
    if (!next) return false;
    setStorageWarning(!writeSession(next.id));
    setProfile(next);
    return true;
  }

  function logout() {
    if (hasPendingApiRequests()) return false;
    setStorageWarning(!writeSession(null));
    startTransition(() => { setProfile(null); navigate('/'); });
    return true;
  }

  return <SessionContext.Provider value={{ profile, selectProfile, logout, storageWarning }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('SessionProvider absent');
  return session;
}
