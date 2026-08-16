// services/aiProxyService.ts
// Calls the Cloudflare Worker AI proxy for multi-provider fallback
// The proxy stores all shared API keys securely and routes requests through
// Gemini → Grok → DeepSeek → Groq → Mistral → OpenRouter → Cohere

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL;

export interface ProxyResponse {
  result: string;
  provider: string;
  timestamp: number;
}

export interface ProxyError {
  error: string;
  attempted: Array<{ provider: string; error: string }>;
}

/**
 * Calls the AI proxy with prompt. Returns generated text or throws.
 * Proxy handles multi-provider fallback internally.
 */
export const callAIProxy = async (
  prompt: string,
  modelType: 'fast' | 'balanced' | 'quality' = 'balanced',
  image?: { data: string; mimeType: string }
): Promise<string> => {
  if (!PROXY_URL) {
    throw new Error('AI proxy URL not configured');
  }

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, modelType, image }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ProxyError;
    throw new Error(errorData.error || `Proxy error: ${response.status}`);
  }

  const successData = data as ProxyResponse;
  console.log(`[AI Proxy] ✅ Served by ${successData.provider}`);
  return successData.result;
};

/**
 * Check if proxy is configured (has URL in env).
 */
export const isProxyConfigured = (): boolean => {
  return !!PROXY_URL && PROXY_URL.length > 10;
};
