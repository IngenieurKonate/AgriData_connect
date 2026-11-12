import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BusinessData } from '../domain/types';
import { DemoRepository, type RepositoryErrorCode } from '../mocks/repository/demoRepository';

interface BusinessDataContextValue {
  data: BusinessData | null;
  error: RepositoryErrorCode | null;
  persistent: boolean;
}

const BusinessDataContext = createContext<BusinessDataContextValue | null>(null);

export function BusinessDataProvider({ children }: { children: ReactNode }) {
  const repository = useRef<DemoRepository | null>(null);
  if (!repository.current) repository.current = new DemoRepository();
  const [state, setState] = useState(() => repository.current!.load());
  useEffect(() => {
    const refresh = () => setState(repository.current!.load());
    window.addEventListener('business-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('business-updated', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const value = useMemo(() => ({
    ...state,
  }), [state]);
  return <BusinessDataContext.Provider value={value}>{children}</BusinessDataContext.Provider>;
}

export function useBusinessData() {
  const context = useContext(BusinessDataContext);
  if (!context) throw new Error('BusinessDataProvider is missing');
  return context;
}
