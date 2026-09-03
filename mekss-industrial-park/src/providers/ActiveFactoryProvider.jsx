import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthProvider';
import { factoryApi } from '../services/api/factory.api';

const STORAGE_KEY = 'activeFactoryId';

const ActiveFactoryContext = createContext(null);

export const useActiveFactory = () => {
  const context = useContext(ActiveFactoryContext);
  if (!context) throw new Error('useActiveFactory must be used within an ActiveFactoryProvider');
  return context;
};

export const ActiveFactoryProvider = ({ children }) => {
  const { user } = useAuth();
  const isOwner = user?.role === 'FACTORY_OWNER';
  const [activeFactoryId, setActiveFactoryIdState] = useState(() => localStorage.getItem(STORAGE_KEY) || '');

  const { data: factories = [], isLoading } = useQuery({
    queryKey: ['factories', 'owner-list', user?.id],
    queryFn: () => factoryApi.getFactories().then((res) => (Array.isArray(res.data) ? res.data : res.data?.items || [])),
    enabled: Boolean(isOwner && user?.id),
  });

  const setActiveFactoryId = useCallback((id) => {
    const next = id || '';
    setActiveFactoryIdState(next);
    if (next) localStorage.setItem(STORAGE_KEY, next);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (!isOwner) {
      if (activeFactoryId) setActiveFactoryId('');
      return;
    }
    if (!factories.length) return;
    const exists = factories.some((f) => f.id === activeFactoryId);
    if (!exists) setActiveFactoryId(factories[0].id);
  }, [isOwner, factories, activeFactoryId, setActiveFactoryId]);

  const activeFactory = useMemo(
    () => factories.find((f) => f.id === activeFactoryId) || null,
    [factories, activeFactoryId],
  );

  const value = useMemo(
    () => ({
      factories,
      activeFactory,
      activeFactoryId: activeFactory?.id || '',
      setActiveFactoryId,
      isLoading,
    }),
    [factories, activeFactory, setActiveFactoryId, isLoading],
  );

  return <ActiveFactoryContext.Provider value={value}>{children}</ActiveFactoryContext.Provider>;
};
