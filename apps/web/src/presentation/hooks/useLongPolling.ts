import { useEffect, useRef, useCallback } from 'react';

interface UseLongPollingOptions {
  callback: () => Promise<void>;
  interval?: number;
  isPollingActive: boolean;
}

export function useLongPolling({
  callback,
  interval = 3000,
  isPollingActive,
}: UseLongPollingOptions): void {
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const lastCallbackRef = useRef<(() => Promise<void>) | null>(null);

  // Store the latest callback
  lastCallbackRef.current = callback;

  const poll = useCallback(async () => {
    // Prevent concurrent polling
    if (isPollingRef.current) {
      console.log('Polling already in progress, skipping...');
      return;
    }

    if (!isPollingActive) {
      console.log('Polling is not active, stopping...');
      return;
    }

    isPollingRef.current = true;

    try {
      if (lastCallbackRef.current) {
        await lastCallbackRef.current();
      }
    } catch (error) {
      console.error('Polling callback error:', error);
    } finally {
      isPollingRef.current = false;
    }

    // Schedule next poll only if still active
    if (isPollingActive) {
      timeoutIdRef.current = setTimeout(poll, interval);
    }
  }, [interval, isPollingActive]);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    if (isPollingActive) {
      console.log('Starting polling...');
      poll();
    } else {
      console.log('Stopping polling...');
      isPollingRef.current = false;
    }

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      isPollingRef.current = false;
    };
  }, [isPollingActive, poll]);
}