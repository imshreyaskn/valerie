import { useEffect, type RefObject } from 'react';

/**
 * Focus a target input when the user presses `key` (default "/") outside of
 * any text field. Single implementation — previously duplicated (and in one
 * case orphaned) across CommandBar, Evaluations, and the dead filters file.
 */
export function useHotkeyFocus(ref: RefObject<HTMLInputElement | null>, key = '/') {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === key &&
        document.activeElement !== ref.current &&
        !(document.activeElement instanceof HTMLInputElement) &&
        !(document.activeElement instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ref, key]);
}
