// Cloudflare Worker AI Proxy
// This worker securely stores all API keys and routes requests to multiple LLM providers

export default {
  async fetch(request, env, ctx) {
    // CORS headers for mobile app access
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const { prompt, modelType = 'balanced', forceProvider, image } = await request.json();

      if (!prompt) {
        return new Response(JSON.stringify({ error: 'Prompt required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Provider fallback chain - try each in order
      const providers = [
        { name: 'gemini', call: () => callGemini(env, prompt, modelType, image) },
        { name: 'grok', call: () => callGrok(env, prompt) },
        { name: 'deepseek', call: () => callDeepSeek(env, prompt) },
        { name: 'groq', call: () => callGroq(env, prompt) },
        { name: 'mistral', call: () => callMistral(env, prompt) },
        { name: 'openrouter', call: () => callOpenRouter(env, prompt) },
        { name: 'cohere', call: () => callCohere(env, prompt) },
      ];

      const attempted = [];

      for (const provider of providers) {
        if (forceProvider && provider.name !== forceProvider) {
          continue; // Skip if we are forcing a specific provider
        }
        try {
          console.log(`[AI Proxy] Trying ${provider.name}...`);
          const result = await provider.call();
          console.log(`[AI Proxy] ✅ Success from ${provider.name}`);
          return new Response(JSON.stringify({
            result,
            provider: provider.name,
            timestamp: Date.now()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          const errorMsg = error.message || String(error);
          console.error(`[AI Proxy] ${provider.name} failed:`, errorMsg);
          attempted.push({ provider: provider.name, error: errorMsg });

          // If quota/rate limit, try next provider
          if (isQuotaOrOverloaded(errorMsg)) {
            continue;
          }
          // For other errors, also try next provider
          continue;
        }
      }

      // All providers failed
      return new Response(JSON.stringify({
        error: 'All AI providers exhausted. Please add your own API key.',
        attempted
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('[AI Proxy] Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

// Check if error is quota/rate limit/overload
function isQuotaOrOverloaded(errorMsg) {
  const lower = errorMsg.toLowerCase();
  return lower.includes('429') ||
         lower.includes('quota') ||
         lower.includes('rate limit') ||
         lower.includes('503') ||
         lower.includes('overloaded') ||
         lower.includes('unavailable') ||
         lower.includes('exhausted');
}

// ============ PROVIDER IMPLEMENTATIONS ============

// Gemini (Google)
async function callGemini(env, prompt, modelType, image) {
  const models = {
    fast: 'gemini-3.5-flash-lite',
    balanced: 'gemini-3.5-flash',
    quality: 'gemini-3.5-pro'
  };

  const model = models[modelType] || models.balanced;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const parts = [{ text: prompt }];
  if (image && image.data && image.mimeType) {
    parts.push({
      inlineData: {
        data: image.data,
        mimeType: image.mimeType
      }
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: parts }],
      generationConfig: {
        maxOutputTokens: modelType === 'fast' ? 1024 : 4096,
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Gemini error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Grok (X.AI) - OpenAI-compatible
async function callGrok(env, prompt) {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.GROK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'grok-2-latest',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Grok error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// DeepSeek - OpenAI-compatible
async function callDeepSeek(env, prompt) {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `DeepSeek error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Groq - OpenAI-compatible (ultra fast)
async function callGroq(env, prompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Groq error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Mistral AI - OpenAI-compatible
async function callMistral(env, prompt) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Mistral error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// OpenRouter - OpenAI-compatible (aggregates many models)
async function callOpenRouter(env, prompt) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://uptrends.app',
      'X-Title': 'UpTrends AI Stylist'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-70b-instruct',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `OpenRouter error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Cohere
async function callCohere(env, prompt) {
  const response = await fetch('https://api.cohere.ai/v1/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.COHERE_API_KEY}`
    },
    body: JSON.stringify({
      model: 'command-r-plus',
      message: prompt
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Cohere error: ${response.status}`);
  }

  const data = await response.json();
  return data.text || '';
}
