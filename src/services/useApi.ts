import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, hasPendingApiRequests } from './apiClient';

export function usePendingRequests() {
  const [pending, setPending] = useState(hasPendingApiRequests);
  useEffect(() => {
    const update = () => setPending(hasPendingApiRequests());
    window.addEventListener('api-pending', update);
    update();
    return () => window.removeEventListener('api-pending', update);
  }, []);
  return pending;
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setData(null); setError(null); setLoading(Boolean(path));
    if (path) apiRequest<T>(path).then(value => { if (active) setData(value); }).catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : 'Le service est indisponible.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, revision]);
  return { data, error, loading, reload };
}

export function useAction() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(null);
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Cette action a échoué. Réessayez.'); }
    finally { busy.current = false; setPending(false); }
  };
  return { run, pending, error };
}
