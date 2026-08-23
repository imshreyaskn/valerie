import { useCallback, useRef, useState } from 'react';

/**
 * Clipboard-with-revert, shared by every copy affordance in the app
 * (run IDs, secrets, prompts, JSON). One implementation instead of four.
 *
 * Supports multiple independent slots per component via a `key`:
 *   const { copiedKey, copy } = useCopyToClipboard();
 *   copy(text, runId);  // copiedKey === runId while in the revert window
 */
export function useCopyToClipboard(revertMs = 2000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    (text: string, key = 'default') => {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiedKey(null), revertMs);
    },
    [revertMs]
  );

  return { copiedKey, copy };
}
