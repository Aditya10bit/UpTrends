// API Safeguards to prevent UI crashes and blocking
import { Alert } from 'react-native';

// Circuit breaker pattern to prevent API overload
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold = 5, // Max failures before opening
    private timeout = 60000 // 1 minute timeout
  ) { }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - API temporarily unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return this.state;
  }
}

// Global circuit breaker for Gemini API
export const geminiCircuitBreaker = new CircuitBreaker(3, 30000); // 3 failures, 30s timeout

// Request queue to prevent UI blocking
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private maxConcurrent = 2; // Max 2 concurrent API calls
  private activeRequests = 0;

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.activeRequests >= this.maxConcurrent) return;

    const request = this.queue.shift();
    if (!request) return;

    this.activeRequests++;
    this.processing = true;

    try {
      await request();
    } finally {
      this.activeRequests--;
      this.processing = false;

      // Process next request after a small delay to prevent UI blocking
      setTimeout(() => this.processQueue(), 100);
    }
  }
}

export const apiRequestQueue = new RequestQueue();

// Timeout wrapper to prevent hanging requests
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number = 15000
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    )
  ]);
};

// Safe API caller with all protections
export const safeApiCall = async <T>(
  apiCall: () => Promise<T>,
  fallback: T,
  options: {
    timeout?: number;
    showErrorAlert?: boolean;
    retries?: number;
  } = {}
): Promise<T> => {
  const { timeout = 15000, showErrorAlert = false, retries = 2 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Use circuit breaker and timeout protection
      const result = await geminiCircuitBreaker.execute(async () => {
        return await apiRequestQueue.add(() => withTimeout(apiCall(), timeout));
      });

      return result;
    } catch (error) {
      console.warn(`API call attempt ${attempt + 1} failed:`, error);

      // If it's the last attempt, handle the error
      if (attempt === retries) {
        if (showErrorAlert) {
          Alert.alert(
            'Service Temporarily Unavailable',
            'AI service is busy. Using cached data instead.',
            [{ text: 'OK' }]
          );
        }

        // Return fallback data instead of crashing
        return fallback;
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return fallback;
};

// Memory pressure detection
export const checkMemoryPressure = (): boolean => {
  try {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      const usageRatio = memory.usedJSHeapSize / memory.totalJSHeapSize;
      return usageRatio > 0.8; // 80% memory usage threshold
    }
  } catch (e) {
    // Ignore memory check errors on platforms that don't support it
  }
  return false;
};

// Debounced API calls to prevent rapid firing
export const debounceApiCall = <T extends (...args: any[]) => Promise<any>>(
  func: T,
  delay: number = 1000
): T => {
  let timeoutId: NodeJS.Timeout;
  let lastCall: Promise<any> | null = null;

  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);

    // Return the last pending call if it exists
    if (lastCall) {
      return lastCall;
    }

    lastCall = new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          lastCall = null;
        }
      }, delay);
    });

    return lastCall;
  }) as T;
};

// API health checker
export const checkApiHealth = async (): Promise<boolean> => {
  try {
    // Simple health check - try to get a minimal response
    const healthCheck = await withTimeout(
      fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }),
      5000
    );

    return healthCheck.ok;
  } catch {
    return false;
  }
};