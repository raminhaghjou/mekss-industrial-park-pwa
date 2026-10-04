import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthProvider';
import { factoryApi } from '../services/api/factory.api';
import { ACTIVE_FACTORY_STORAGE_KEY, FACTORY_SELECTION_PENDING_KEY } from '../services/api/base.api';

const STORAGE_KEY = ACTIVE_FACTORY_STORAGE_KEY;
const OWNER_LIST_KEY = ['factories', 'owner-list'];

const ActiveFactoryContext = createContext(null);

export const useActiveFactory = () => {
  const context = useContext(ActiveFactoryContext);
  if (!context) throw new Error('useActiveFactory must be used within an ActiveFactoryProvider');
  return context;
};

export const ActiveFactoryProvider = ({ children }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOwner = user?.role === 'FACTORY_OWNER';
  const [activeFactoryId, setActiveFactoryIdState] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [selectionPending, setSelectionPending] = useState(() => localStorage.getItem(FACTORY_SELECTION_PENDING_KEY) === '1');

  const { data: factories = [], isLoading, isSuccess } = useQuery({
    queryKey: [...OWNER_LIST_KEY, user?.id],
    queryFn: () => factoryApi.getOwnedFactories().then((res) => (Array.isArray(res.data) ? res.data : res.data?.items || [])),
    enabled: Boolean(isOwner && user?.id),
  });

  const storeActiveFactoryId = useCallback((id) => {
    const next = id || '';
    setActiveFactoryIdState(next);
    if (next) localStorage.setItem(STORAGE_KEY, next);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  /** Switches the active unit and drops cached data that belonged to the previous one. */
  const setActiveFactoryId = useCallback((id) => {
    const next = id || '';
    const changed = next !== (localStorage.getItem(STORAGE_KEY) || '');
    storeActiveFactoryId(next);
    localStorage.removeItem(FACTORY_SELECTION_PENDING_KEY);
    setSelectionPending(false);
    if (changed) {
      // Reset (not just invalidate) so no screen keeps showing the previous unit's data; active queries refetch.
      void queryClient.resetQueries({
        predicate: (query) => !(query.queryKey[0] === OWNER_LIST_KEY[0] && query.queryKey[1] === OWNER_LIST_KEY[1]),
      });
    }
  }, [queryClient, storeActiveFactoryId]);

  useEffect(() => {
    if (!isOwner) {
      if (user && activeFactoryId) storeActiveFactoryId('');
      return;
    }
    // A failed load (offline / server error) must not wipe the saved selection.
    if (!isSuccess) return;
    if (!factories.length) {
      if (activeFactoryId) storeActiveFactoryId('');
      return;
    }
    if (factories.length === 1) {
      if (factories[0].id !== activeFactoryId) storeActiveFactoryId(factories[0].id);
      if (localStorage.getItem(FACTORY_SELECTION_PENDING_KEY)) {
        localStorage.removeItem(FACTORY_SELECTION_PENDING_KEY);
        setSelectionPending(false);
      }
    }
  }, [isOwner, user, isSuccess, factories, activeFactoryId, storeActiveFactoryId]);

  // Requests read the id from localStorage, so a switch in another tab must re-sync this tab too.
  useEffect(() => {
    if (!isOwner) return undefined;
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      const next = event.newValue || '';
      if (next === activeFactoryId) return;
      setActiveFactoryIdState(next);
      void queryClient.resetQueries({
        predicate: (query) => !(query.queryKey[0] === OWNER_LIST_KEY[0] && query.queryKey[1] === OWNER_LIST_KEY[1]),
      });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [isOwner, activeFactoryId, queryClient]);

  const activeFactory = useMemo(
    () => factories.find((f) => f.id === activeFactoryId) || null,
    [factories, activeFactoryId],
  );

  const needsSelection = Boolean(
    isOwner && !isLoading && factories.length > 1 && (selectionPending || !activeFactory),
  );

  const value = useMemo(
    () => ({
      factories,
      activeFactory,
      activeFactoryId: activeFactory?.id || '',
      setActiveFactoryId,
      isLoading: Boolean(isOwner && isLoading),
      needsSelection,
    }),
    [factories, activeFactory, setActiveFactoryId, isOwner, isLoading, needsSelection],
  );

  return <ActiveFactoryContext.Provider value={value}>{children}</ActiveFactoryContext.Provider>;
};
