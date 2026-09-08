import { useSyncExternalStore, useCallback } from 'react';

/**
 * Lightweight custom media query hook using useSyncExternalStore (React 18+)
 * completely replacing MUI's useMediaQuery.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === 'undefined') return () => {};
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener('change', onStoreChange);
      return () => mediaQueryList.removeEventListener('change', onStoreChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Convenient hook for mobile screen detection (< 768px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767.98px)');
}

export default useMediaQuery;
