"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_DISPLAY_PREFS,
  DISPLAY_ATTRIBUTES,
  DISPLAY_STORAGE_KEY,
  displayAttributes,
  parseDisplayPrefs,
  type DisplayPrefs,
} from "./display/prefs";

/**
 * Display preferences for the student area: text size, high contrast,
 * reduced motion. Stored per device, applied as <html data-*> attributes
 * (the CSS in globals.css does the rest; useReducedMotion reads the motion
 * attribute for JS-driven animation).
 */

interface DisplayContextValue {
  prefs: DisplayPrefs;
  update: (change: (prefs: DisplayPrefs) => DisplayPrefs) => void;
}

const DisplayContext = createContext<DisplayContextValue>({
  prefs: DEFAULT_DISPLAY_PREFS,
  update: () => {},
});

function apply(prefs: DisplayPrefs) {
  const root = document.documentElement;
  for (const name of DISPLAY_ATTRIBUTES) root.removeAttribute(name);
  for (const [name, value] of Object.entries(displayAttributes(prefs))) {
    root.setAttribute(name, value);
  }
}

export function DisplayProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<DisplayPrefs>(DEFAULT_DISPLAY_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(DISPLAY_STORAGE_KEY);
    } catch {
      // Private mode — defaults.
    }
    setPrefs(parseDisplayPrefs(stored));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    apply(prefs);
    try {
      window.localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Applies for this visit even if it can't persist.
    }
  }, [prefs, loaded]);

  const update = useCallback((change: (current: DisplayPrefs) => DisplayPrefs) => {
    setPrefs((current) => change(current));
  }, []);

  const value = useMemo(() => ({ prefs, update }), [prefs, update]);
  return <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>;
}

export function useDisplayPrefs(): DisplayContextValue {
  return useContext(DisplayContext);
}
