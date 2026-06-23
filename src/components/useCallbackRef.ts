"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Gibt eine stabile Funktion zurueck, die immer die neueste Version des
 * uebergebenen Callbacks aufruft. Praktisch fuer Effekte, die nicht bei jeder
 * Neudefinition neu laufen sollen.
 */
export function useCallbackRef<A extends any[], R>(fn: (...args: A) => R) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
