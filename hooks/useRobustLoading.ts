import { useCallback, useEffect, useRef, useState } from 'react';

interface UseRobustLoadingOptions {
  timeout?: number; // Max loading time before auto-fallback
  fallbackDelay?: number; // Delay before showing fallback
  maxRetries?: number; // Max automatic retries
}

interface LoadingState {
  isLoading: boolean;
  error: Error | null;
  retryCount: number;
  showFallback: boolean;
  timedOut: boolean;
}

export const useRobustLoading = (options: UseRobustLoadingOptions = {}) => {
  const {
    timeout = 30000, // 30 seconds max
    fallbackDelay = 10000, // Show fallback after 10 seconds
    maxRetries = 2
  } = options;

  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    error: null,
    retryCount: 0,
    showFallback: false,
    timedOut: false
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
    }
  }, []);

  const executeWithLoading = useCallback(async <T>(
    asyncFunction: (signal?: AbortSignal) => Promise<T>,
    fallbackData?: T
  ): Promise<T> => {
    // Clear any existing timeouts
    clearTimeouts();
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      showFallback: false,
      timedOut: false
    }));

    // Set fallback timeout
    fallbackTimeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, showFallback: true }));
    }, fallbackDelay);

    // Set main timeout
    timeoutRef.current = setTimeout(() => {
      abortControllerRef.current?.abort();
      setState(prev => ({ 
        ...prev, 
        timedOut: true,
        isLoading: false,
        showFallback: true 
      }));
    }, timeout);

    try {
      const result = await asyncFunction(signal);
      
      clearTimeouts();
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: null,
        showFallback: false,
        retryCount: 0
      }));
      
      return result;
    } catch (error) {
      clearTimeouts();
      
      if (signal.aborted) {
        console.warn('Request was aborted due to timeout');
        if (fallbackData !== undefined) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            showFallback: true,
            timedOut: true
          }));
          return fallbackData;
        }
      }

      const currentRetryCount = state.retryCount + 1;
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error,
        retryCount: currentRetryCount,
        showFallback: currentRetryCount >= maxRetries
      }));

      // Auto-retry if under max retries
      if (currentRetryCount < maxRetries && !signal.aborted) {
        console.log(`Auto-retrying... Attempt ${currentRetryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * currentRetryCount));
        return executeWithLoading(asyncFunction, fallbackData);
      }

      // If we have fallback data, return it instead of throwing
      if (fallbackData !== undefined) {
        return fallbackData;
      }

      throw error;
    }
  }, [state.retryCount, timeout, fallbackDelay, maxRetries, clearTimeouts]);

  const retry = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      retryCount: 0,
      showFallback: false,
      timedOut: false
    }));
  }, []);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    clearTimeouts();
    setState(prev => ({
      ...prev,
      isLoading: false,
      error: null,
      showFallback: false
    }));
  }, [clearTimeouts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeouts();
      abortControllerRef.current?.abort();
    };
  }, [clearTimeouts]);

  return {
    ...state,
    executeWithLoading,
    retry,
    cancel,
    // Helper methods
    isLoadingTooLong: state.isLoading && state.showFallback,
    shouldShowFallback: state.showFallback || state.timedOut || (state.error && state.retryCount >= maxRetries),
    canRetry: !state.isLoading && (state.error || state.timedOut),
  };
};

// Hook for API calls specifically
export const useRobustApiCall = <T>(
  fallbackData: T,
  options: UseRobustLoadingOptions = {}
) => {
  const loading = useRobustLoading({
    timeout: 20000, // 20 seconds for API calls
    fallbackDelay: 8000, // Show fallback after 8 seconds
    maxRetries: 1, // Only 1 retry for API calls
    ...options
  });

  const callApi = useCallback(async (
    apiFunction: () => Promise<T>
  ): Promise<T> => {
    return loading.executeWithLoading(
      async (signal) => {
        // Wrap API call with timeout check
        return new Promise<T>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('API call timeout'));
          }, 15000); // 15 second API timeout

          apiFunction()
            .then(result => {
              clearTimeout(timeoutId);
              if (!signal?.aborted) {
                resolve(result);
              }
            })
            .catch(error => {
              clearTimeout(timeoutId);
              if (!signal?.aborted) {
                reject(error);
              }
            });

          // Handle abort signal
          signal?.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('Request aborted'));
          });
        });
      },
      fallbackData
    );
  }, [loading, fallbackData]);

  return {
    ...loading,
    callApi
  };
};