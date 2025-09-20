// Security configuration and validation
export const validateEnvironment = () => {
  const requiredEnvVars = [
    'EXPO_PUBLIC_GEMINI_API_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

// API key validation
export const getSecureApiKey = (): string => {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }
  
  if (!apiKey.startsWith('AIza')) {
    throw new Error('Invalid Gemini API key format');
  }
  
  return apiKey;
};

// Rate limiting for API calls
export class RateLimiter {
  private calls: number[] = [];
  private maxCalls: number;
  private timeWindow: number;

  constructor(maxCalls: number = 10, timeWindowMs: number = 60000) {
    this.maxCalls = maxCalls;
    this.timeWindow = timeWindowMs;
  }

  canMakeCall(): boolean {
    const now = Date.now();
    // Remove calls outside the time window
    this.calls = this.calls.filter(callTime => now - callTime < this.timeWindow);
    
    if (this.calls.length >= this.maxCalls) {
      return false;
    }
    
    this.calls.push(now);
    return true;
  }

  getTimeUntilNextCall(): number {
    if (this.calls.length < this.maxCalls) {
      return 0;
    }
    
    const oldestCall = Math.min(...this.calls);
    return this.timeWindow - (Date.now() - oldestCall);
  }
}

// Create rate limiter instance for Gemini API
export const geminiRateLimiter = new RateLimiter(15, 60000); // 15 calls per minute