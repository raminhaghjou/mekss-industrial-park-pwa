import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '../services/api/public.api';
import { digitsOnly } from '../utils/digits';

export const CAPTCHA_MAX_LENGTH = 8;

/**
 * Loads a one-time image captcha. Every challenge allows a single server check, so call
 * `refresh()` after each submit attempt; the challenge also renews itself before it expires.
 */
export function useCaptcha(scope = 'default') {
  const query = useQuery({
    queryKey: ['public', 'captcha', scope],
    queryFn: () => publicApi.getCaptcha().then((res) => res.data),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (current) => {
      const seconds = current.state.data?.expiresIn;
      return seconds ? Math.max(15, seconds - 15) * 1000 : false;
    },
  });
  const captchaId = query.data?.captchaId || '';
  const [typed, setTyped] = useState({ forId: '', value: '' });
  const answer = typed.forId === captchaId ? typed.value : '';
  const { refetch } = query;

  const setAnswer = useCallback(
    (value) => setTyped({ forId: captchaId, value: digitsOnly(value, CAPTCHA_MAX_LENGTH) }),
    [captchaId],
  );
  const refresh = useCallback(() => { refetch(); }, [refetch]);

  return {
    captchaId,
    image: query.data?.image || '',
    answer,
    setAnswer,
    refresh,
    isLoading: query.isFetching,
    isError: query.isError && !query.data,
    error: query.error,
    isReady: Boolean(captchaId) && answer.length >= 4,
  };
}
