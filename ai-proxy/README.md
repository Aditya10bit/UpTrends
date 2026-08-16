# UpTrends AI Proxy - Cloudflare Worker

This worker securely proxies AI requests to multiple LLM providers with automatic fallback.

## Setup Instructions

### Step 1: Create Cloudflare Account (Free)

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up (free tier is enough)
3. Verify your email

### Step 2: Install Wrangler CLI

Open PowerShell in this folder and run:

```powershell
npm install -g wrangler
```

### Step 3: Login to Cloudflare

```powershell
wrangler login
```

This will open your browser. Authorize the app.

### Step 4: Create the Worker

```powershell
wrangler init uptrends-ai-proxy
```

When prompted:
- Would you like to use git? → **No**
- What type of application? → **"Hello World" Worker**
- Do you want to deploy? → **No** (we'll deploy after adding secrets)

### Step 5: Replace the Generated Files

Delete the generated `src/index.js` and copy `worker.js` content.

Or just run from the `ai-proxy` folder:

```powershell
# Create wrangler.toml config
```

### Step 6: Create wrangler.toml

Create `wrangler.toml` in this folder:

```toml
name = "uptrends-ai-proxy"
main = "worker.js"
compatibility_date = "2024-01-01"

[vars]
# Public vars go here (none needed)

# Secrets are set via: wrangler secret put SECRET_NAME
```

### Step 7: Add Your API Keys as Secrets

Run each command and paste the key when prompted:

```powershell
wrangler secret put GEMINI_API_KEY
# Paste your Gemini key: AIza...

wrangler secret put GROK_API_KEY
# Paste: xai-******** (your xAI key)

wrangler secret put DEEPSEEK_API_KEY
# Paste: sk-******** (your DeepSeek key)

wrangler secret put GROQ_API_KEY
# Paste: gsk_******** (your Groq key)

wrangler secret put MISTRAL_API_KEY
# Paste: ******** (your Mistral key)

wrangler secret put OPENROUTER_API_KEY
# Paste: sk-or-v1-******** (your OpenRouter key)

wrangler secret put COHERE_API_KEY
# Paste: ******** (your Cohere key)
```

### Step 8: Deploy

```powershell
wrangler deploy
```

You'll get a URL like:
```
https://uptrends-ai-proxy.<your-subdomain>.workers.dev
```

### Step 9: Test It

```powershell
curl -X POST https://uptrends-ai-proxy.<your-subdomain>.workers.dev `
  -H "Content-Type: application/json" `
  -d "{\"prompt\": \"Say hello in 5 words\", \"modelType\": \"fast\"}"
```

Expected response:
```json
{
  "result": "Hello, how are you?",
  "provider": "gemini",
  "timestamp": 1234567890
}
```

### Step 10: Add to Your App

In your `.env`:
```
EXPO_PUBLIC_AI_PROXY_URL=https://uptrends-ai-proxy.<your-subdomain>.workers.dev
```

---

## How It Works

1. Your app sends `POST` to the proxy with `{ prompt, modelType }`
2. Proxy tries providers in order: Gemini → Grok → DeepSeek → Groq → Mistral → OpenRouter → Cohere
3. First successful response is returned
4. If all fail, returns error telling user to add their own key

## Cost

- **Free tier**: 100,000 requests/day
- **Paid**: $5/month for 10M requests (if you need more)

## Security

- Keys are stored as Cloudflare secrets (not in code)
- CORS allows your mobile app to call it
- No keys are exposed in the APK

## Models Used

| Provider | Fast | Balanced | Quality |
|----------|------|----------|---------|
| Gemini | 1.5-flash-8b | 1.5-flash | 1.5-pro |
| Grok | grok-beta | grok-beta | grok-beta |
| DeepSeek | deepseek-chat | deepseek-chat | deepseek-chat |
| Groq | llama-3.1-70b | llama-3.1-70b | llama-3.1-70b |
| Mistral | mistral-large | mistral-large | mistral-large |
| OpenRouter | llama-3.1-70b | llama-3.1-70b | llama-3.1-70b |
| Cohere | command | command | command |
