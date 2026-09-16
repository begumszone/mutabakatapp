import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'mutabakat.theme';

/** Remembers the reader's choice, and follows the OS until they make one. */
export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // Private browsing, or storage switched off: fall through to the OS.
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Not being able to remember the choice is not worth breaking the page.
    }
  }, [theme]);

  return [theme, setTheme];
}
