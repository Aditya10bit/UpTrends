# UpTrends — AI-Powered Fashion Stylist

A React Native (Expo SDK 53) app that acts as your personal AI fashion stylist. Upload photos of your wardrobe, get body-type-aware outfit recommendations, discover your style from inspiration photos, and shop the look — all powered by Google Gemini AI with a multi-provider fallback chain.

---

## ✨ Core Features

### 🎨 Style Shazam (Style Check + Inspiration)
Upload any outfit photo and the AI breaks it down into components (top, bottom, outerwear, shoes, accessories). It then matches each piece against your **digital closet** — telling you what you already own (`exact` / `similar` match) and generating precise shopping queries for missing items (`missing` with `searchQuery`). Works for venue vibes, celebrity looks, or Pinterest saves.

### 👗 My Closet (Digital Wardrobe)
- **Add items** by photo — AI analyzes garment type, colors, pattern, fabric, season, occasion
- **Organize** by category (tops, bottoms, dresses, outerwear, shoes, accessories)
- **Wardrobe analytics** — completeness score, missing categories, outfit potential count
- **AI stylist chat** — ask "what goes with this blazer?" and get contextual answers
- **Persisted** to Firestore + local AsyncStorage cache for offline access

### 🧵 Make Me an Outfit
Select items from your closet (or upload new ones) and the AI generates **multiple complete outfit combinations** with:
- Occasion tags (casual, date night, formal, party, gym)
- Weather awareness (via cached weather API)
- Shopping links for any missing pieces
- Compatibility scoring

### 📸 Upload Aesthetic
Upload a venue/setting photo (restaurant, beach, office, party) and get **outfit recommendations tailored to that vibe**. Each suggested item now gets its **own dedicated shopping link** (Amazon, Myntra, Pinterest, Google Shopping) — no more combined "shirt pants" queries.

### ⭐ Style Check
Rate your own outfit selfie. AI scores fit, color harmony, occasion appropriateness, and gives **specific improvement tips** (e.g., "swap black shoes for brown to warm up the look"). Tracks your style progress over time.

### 👫 Twinning (Couples & Friends)
- **Date Mode** — upload two photos, get coordinated couple outfits with color harmony
- **Friends Mode** — group outfit coordination for events/weddings
- Shared shopping lists so everyone buys the right pieces

### 🌤️ Today's Outfit (Weather + Location Aware)
Open the app → instant outfit for **right now**. Uses your GPS location (optional) + cached weather + cultural topography data to suggest what to wear today. No manual input needed.

### 🧠 Body Analysis
Upload a full-body photo → AI estimates body type (slim, athletic, heavy, average, pear, hourglass, rectangle, inverted triangle), suggests flattering silhouettes, neckline recommendations, and color palettes for your skin tone.

### 💬 Aria — Your AI Stylist Chat
Persistent chat with **saved history** (up to 5 conversations in Firestore, synced across devices). Ask follow-ups: "make it more formal", "I hate yellow", "what shoes?". Context-aware because it knows your closet, body type, and preferences.

### 🎯 Mix & Match
Interactive lane picker: lock tops / bottoms / shoes individually, shuffle the rest. Great for "I have this skirt, what top works?"

### 🔐 Auth & Profile
- Email/password + **Google Sign-In** (native module, SHA-1 registered)
- Profile stores gender, height, weight, skin tone, body type, city
- **Fuzzy body-type matcher** on edit — type "athlet" → suggests "Athletic"

---

## 🛡️ AI Resilience Architecture

The app never crashes on AI failures. Layered fallback chain:

| Layer | What it does |
|-------|--------------|
| **User's own Gemini key** | Unlimited, direct API (stored in AsyncStorage) |
| **Shared Gemini (proxy)** | 20 req/day per model via Cloudflare Worker |
| **Grok (proxy)** | 25 req/day |
| **DeepSeek (proxy)** | 50 req/day |
| **Groq → Mistral → OpenRouter → Cohere** | Sequential fallback in worker |
| **Cached responses** | 30-min in-memory cache on repeated prompts |
| **Local fallbacks** | Every screen returns sensible defaults if all AI fails |

**Image analysis** (Style Check, Upload Aesthetic, Body Analysis, Wardrobe upload) always uses **direct Gemini** (multimodal required). **Text-only** calls (chat, outfit generation, shopping links) go through the proxy for multi-provider resilience.

---

## 🛍️ Shopping Links (Verified on Android APK)

| Platform | URL Format | Opens In |
|----------|------------|----------|
| Amazon | `https://www.amazon.com/s?k=QUERY` | Chrome Custom Tab |
| Myntra | `https://www.myntra.com/QUERY` | Chrome Custom Tab |
| Pinterest | `https://www.pinterest.com/search/pins/?q=QUERY` | Chrome Custom Tab |
| Google Shopping | `https://www.google.com/search?tbm=shop&q=QUERY` | Chrome Custom Tab |

All links open via `expo-web-browser` → `Linking` fallback → Chrome intent on Android. Per-item links on Upload Aesthetic; combined links on other screens.

---

## 🔔 Smart Notifications
Local notifications (expo-notifications) for:
- Daily outfit reminder (configurable time)
- Weather change alerts ("rain expected — bring a jacket")
- Event countdowns (plans persisted to AsyncStorage)
- **Deep links** — tap notification → opens exact event plan screen

---

## 🎨 Theme System
- **Obsidian Editorial** design language: Playfair Display (headings) + Inter (body)
- Light / Dark modes with **per-screen accent colors**:
  - `homeAccent` (lavender), `wardrobeAccent` (rose), `twinningAccent` (pink), `styleCheckAccent` (emerald), `bodyAnalysisAccent` (amber), `uploadAestheticAccent` (violet), `makeOutfitAccent` (indigo), `fashionAccent` (teal), `mixMatchAccent` (orange), `profileAccent` (slate)
- Glassmorphism cards, gradient status bars, spring animations (Reanimated 3)

---

## ⚙️ Tech Stack

| Category | Tech |
|----------|------|
| Framework | Expo SDK 53, React Native 0.79.6, React 19 |
| Navigation | Expo Router v5 (file-based) |
| AI | Google Gemini (`@google/generative-ai`) + Cloudflare Worker proxy (7 providers) |
| Backend | Firebase Auth / Firestore / Storage |
| Persistence | AsyncStorage (React Native persistence for Auth) |
| Styling | `StyleSheet.create` + `useTheme()` context (no NativeWind) |
| Animations | React Native Reanimated 3 |
| Image | expo-image-picker, expo-file-system (base64 conversion) |
| Notifications | expo-notifications ~0.31.5 (local only) |
| Browser | expo-web-browser + Linking fallback |
| Linting | `expo lint` (ESLint) |

---

## 📁 Project Structure (Key Files)

```
app/
  _layout.tsx           # All routes declared here (Stack screens)
  index.tsx             # Home dashboard
  auth.tsx              # Login / signup / Google Sign-In
  fashion.tsx           # Category explorer (Today's Outfit, Street, Formal, etc.)
  style-shazam.tsx      # Upload photo → component breakdown + closet match
  upload-aesthetic.tsx  # Venue photo → per-item outfit + shop links
  make-outfit.tsx       # Closet items → multiple outfit combos
  mix-match.tsx         # Interactive lane picker
  style-check.tsx       # Outfit selfie → AI rating + tips
  body-analysis.tsx     # Full-body photo → body type + recommendations
  twinning/date.tsx     # Couple coordination
  twinning/friends.tsx  # Group coordination
  profile.tsx           # Profile + analytics + AI key management
  profile-edit/[uid].tsx # Edit profile (fuzzy body-type matcher)
  stylist-chat.tsx      # Aria chat with saved history sidebar
  category/[slug].tsx   # Dynamic category detail

services/
  geminiService.ts      # ~4250 lines — hub for all AI calls, cache, retry, proxy fallback
  aiProxyService.ts     # Cloudflare Worker wrapper (text-only)
  digitalWardrobeService.ts # Closet CRUD, AI analysis, outfit generation, chat
  wardrobeService.ts    # Legacy closet service (being phased out)
  outfitService.ts      # Today's Outfit logic (weather + topography)
  twinningService.ts    # Couple/friend matching + shopping links
  styleCheckService.ts  # Outfit scoring, color palettes
  weatherService.ts     # Cached weather API
  topographyService.ts  # Cached location/culture data
  userService.ts        # Firestore profile CRUD
  analyticsService.ts   # AI request counters (local + Firestore sync)
  googleSignInService.ts # Native Google Sign-In
  notificationService.ts # Local notification scheduling

contexts/
  AuthContext.tsx       # Auto-redirects: signed in → /, signed out → /auth
  ThemeContext.tsx      # Light/dark + per-screen accents

components/
  AnimatedSplash.tsx    # Custom splash (logo swap, theme colors, timeline)
  ShoppingLinks.tsx     # Renders platform links, opens via WebBrowser
  OutfitCard.tsx        # Outfit display with shop buttons
  StyleRatingCard.tsx   # Style Check result card
  OutfitAnalysisChart.tsx # Wardrobe analytics visualization
  PremiumBackground.tsx # Gradient mesh background
  KeyUpgradeModal.tsx   # Prompt to add own Gemini key
  SavedChatsSidebar.tsx # Drawer for stylist chat history

config/
  security.ts           # Rate limiter, API key validation
  firebaseConfig.ts     # Firebase init (guarded, degraded mode OK)

utils/
  apiSafeguards.ts      # Circuit breaker, request queue, timeout, safeApiCall
  displayName.ts        # Username helpers
  openExternalUrl.ts    # Linking → WebBrowser → Chrome intent chain
  colorResolver.ts      # Color name → hex / HSL mapping
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20.x (pinned in `eas.json`)
- Expo CLI (`npm i -g expo-cli`)
- Android Studio / Xcode for native builds
- Firebase project (Auth + Firestore + Storage enabled)
- Google AI Studio API key (Gemini)

### Install & Run

```bash
# 1. Clone & install
git clone <your-repo-url>
cd uptrends
npm install

# 2. Environment
cp .env.example .env
# Edit .env with your keys (see .env.example for all required vars)

# 3. Start dev server
npm start

# 4. Run on device/emulator
npm run android   # or: npx expo run:android
npm run ios       # or: npx expo run:ios
npm run web       # Expo web build
```

### Required `.env` Variables

```env
# Gemini (user can also add their own in-app via Profile → API Key)
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_key

# Firebase (client-safe — also hardcoded in app.config.js for EAS builds)
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...

# Optional: Cloudflare Worker AI Proxy (enables 7-provider fallback)
EXPO_PUBLIC_AI_PROXY_URL=https://uptrends-ai-proxy.<subdomain>.workers.dev

# Optional: Google Sign-In web client ID (for native auth)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
```

### Validate Before Commit

```bash
npm run lint              # ESLint via expo lint
npm run security-check    # Scans for hardcoded keys / misconfigured env
npm run pre-deploy        # Runs both (do this before EAS builds)
```

---

## 🏗️ Building APK / IPA

### Local Build (fastest iteration)

```bash
# Debug APK
npx expo run:android --variant debug

# Release APK (unsigned)
npx expo run:android --variant release

# Signed release (requires keystore in gradle.properties)
cd android && ./gradlew assembleRelease
```

### EAS Cloud Build

```bash
# Preview (internal distribution)
eas build -p android --profile preview

# Production (Play Store ready)
eas build -p android --profile production
```

**Profiles in `eas.json`:**
- `development` — dev client
- `preview` — internal APK, cache disabled
- `production` — Play Store AAB, cache disabled, Node 20.19.4 pinned
- `android-stable` — stable release branch

---

## 🔧 Cloudflare Worker Proxy (Optional — Multi-Provider Fallback)

The proxy gives you **7 AI providers** behind one endpoint. Deploy once, add URL to `.env`.

### Deploy Worker

```bash
cd ai-proxy
npm install -g wrangler
wrangler login
wrangler init uptrends-ai-proxy   # No git, Hello World, No deploy
```

Create `wrangler.toml`:
```toml
name = "uptrends-ai-proxy"
main = "worker.js"
compatibility_date = "2024-01-01"
```

Add secrets (one-time):
```powershell
wrangler secret put GEMINI_API_KEY
wrangler secret put GROK_API_KEY
wrangler secret put DEEPSEEK_API_KEY
wrangler secret put GROQ_API_KEY
wrangler secret put MISTRAL_API_KEY
wrangler secret put OPENROUTER_API_KEY
wrangler secret put COHERE_API_KEY
```

Deploy:
```bash
wrangler deploy
```

Copy the worker URL → `.env` as `EXPO_PUBLIC_AI_PROXY_URL`.

**Provider limits (shared keys):**
| Provider | Daily Limit |
|----------|-------------|
| Gemini Flash / Flash-Lite | 20 / model |
| Grok | 25 |
| DeepSeek | 50 |
| Groq | 30 |
| Mistral | 30 |
| OpenRouter | Varies |
| Cohere | 20 |

---

## 🧪 Testing & Quality

- **No test suite** — `expo lint` is the only automated gate
- TypeScript `strict: false` — runtime resilience over compile-time strictness
- Manual verification checklist before release:
  - [ ] `npm run pre-deploy` passes
  - [ ] App launches on Android + iOS
  - [ ] Auth flow works (email + Google)
  - [ ] Each AI screen returns fallback data when offline
  - [ ] Shopping links open in Chrome on device
  - [ ] Notifications fire + deep link works
  - [ ] Theme toggle persists + per-screen accents render

---

## 📸 Screenshots

<!-- Add screenshots here: home, style-shazam, upload-aesthetic, my-closet, stylist-chat, twinning, profile -->

---

## 🤝 Contributing

1. Fork → feature branch → PR
2. Run `npm run pre-deploy` before pushing
3. Keep AI calls in `services/` — screens stay thin
4. Follow the fallback pattern: **never let an AI error crash the UI**

---

## 📄 License

MIT — free for personal and commercial use.

---

## 🙏 Acknowledgements

- Google Gemini AI for multimodal fashion understanding
- Firebase for zero-config backend
- Expo team for the best RN developer experience
- Cloudflare Workers for the proxy infrastructure
- All open-source libraries that make this possible