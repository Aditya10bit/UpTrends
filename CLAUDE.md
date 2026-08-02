# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**UpTrends** is an Expo (SDK 53) React Native app — an AI fashion stylist. It uses Google Gemini AI for image analysis and outfit generation, Firebase (Auth/Firestore/Storage) for backend, and Expo Router v5 for file-based navigation. There is **no test suite** — `expo lint` is the only automated check. This is a monorepo-less single app with an `android/` native folder (bare workflow, but uses Expo prebuild config).

## Commands

```bash
npm start                 # Start Expo dev server
npm run android           # Run on Android (expo run:android)
npm run ios               # Run on iOS simulator
npm run web               # Start web build
npm run lint              # eslint via expo lint
npm run security-check    # node scripts/validate-security.js — scans for hardcoded keys / misconfigured env
npm run pre-deploy        # security-check + lint (run before committing/EAS builds)
```

**EAS builds** (`eas.json`): profiles are `development`, `preview`, `production`, `android-stable`. Production builds an APK with cache disabled and a pinned Node 20.19.4. `app.config.js` supplies public Firebase fallback values so EAS cloud builds succeed without a local `.env`.

## Environment Variables

- Client-exposed vars use the `EXPO_PUBLIC_` prefix (loaded via `react-native-dotenv` babel plugin). Required set: `EXPO_PUBLIC_GEMINI_API_KEY` plus the six `EXPO_PUBLIC_FIREBASE_*` values (see `.env.example`).
- **Firebase config resolution** (`firebaseConfig.ts`): reads `Constants.expoConfig?.extra.<KEY>` first (works in EAS builds), then falls back to `process.env`. The same Firebase values are hardcoded as fallbacks in `app.config.js:75-80` for cloud builds — these are public client keys.
- **Gemini key resolution** (`services/geminiService.ts:49-87`): a user-provided key stored in AsyncStorage under `user_gemini_api_key` takes precedence over the bundled `EXPO_PUBLIC_GEMINI_API_KEY`. After the user saves or removes a custom key, call `invalidateApiKeyCache()` to force re-resolution.

## Architecture

### Navigation (`app/`)
Expo Router file-based routing. `app/_layout.tsx` declares every route as a `<Stack.Screen>` (headers hidden, slide-from-right animation); all routes in the folder are wired there. Home dashboard is `app/index.tsx`; auth gate is `app/auth.tsx`. `contexts/AuthContext.tsx` owns routing — it auto-redirects to `/` when signed in and `/auth` when not, using a 100ms timeout to avoid navigation race conditions (do not bypass this for manual redirects).

### Service layer (`services/`) — all AI + data logic lives here
Screens are mostly UI; business logic is in services. The four AI services are **large monoliths** — read them before assuming a helper exists:

- `geminiService.ts` (~4,250 lines) — the hub. All image/outfit/body analysis, weather- and topography-aware outfit generation, context validation, and the central `genAI` export. **`genAI` is NOT a real `GoogleGenerativeAI` instance** — it's a wrapper whose `generateContent` resolves the correct API key at call time and adds exponential-backoff retry on 429/503. Model configs are `models.fast` / `.balanced` / `.quality` (all `gemini-3.5-flash`, differing only in output tokens). Includes a 30-min response cache, a priority request queue, and `extractJSON()` for parsing Gemini's markdown-wrapped JSON.
- `twinningService.ts` (~2,000 lines) — couple/friend outfit matching (`analyzeTwinningPhotos`) + shopping link builders.
- `digitalWardrobeService.ts` (~1,360 lines) — "My Closet": `WardrobeItem` CRUD (Firestore + local AsyncStorage cache), AI clothing analysis, wardrobe-based outfit generation, stylist chat, AR-try-on analysis.
- `styleCheckService.ts` — outfit rating/scoring, color palettes, image quality validation.
- Supporting: `weatherService.ts` (cached weather), `topographyService.ts` (cached location/culture data), `outfitService.ts`, `userService.ts` (Firestore profile CRUD), `analyticsService.ts` (AI request counters, local + Firestore sync).

### Firebase init pattern
`firebaseConfig.ts` exports `app`, `auth`, `db`, `storage`, plus `isFirebaseInitialized` and `initializationError`. On missing env vars it logs a warning and leaves these **`undefined`** rather than throwing. **Every consumer must guard on `isFirebaseInitialized`/undefined before using `auth`/`db`** — the app is designed to run in a degraded (no-backend) mode. `initializeAuth` uses `getReactNativePersistence(AsyncStorage)` for persistent login.

### AI resilience stack (read `ANDROID_STABILITY_GUIDE.md`)
The app is deliberately layered to survive Gemini failures, and new AI calls are expected to use these layers:

1. `config/security.ts` — `geminiRateLimiter` (15 calls/min). Check `canMakeCall()` before issuing.
2. `utils/apiSafeguards.ts` — `geminiCircuitBreaker`, `apiRequestQueue` (max 2 concurrent), `withTimeout`, `safeApiCall(fn, fallback, opts)`.
3. `services/geminiService.ts` — response cache + retry/backoff.
4. `hooks/useRobustLoading.ts` — `useRobustLoading`/`useRobustApiCall` for screen loading states (auto-retry, fallback-after-delay, timeout).

Pattern for screens: **always return fallback/cached data instead of crashing** — `safeApiCall(apiCall, fallbackData)` or the `useRobustApiCall` hook. Never let a Gemini failure propagate to a crash.

### Image validation
Every image that reaches Gemini is pre-validated with `validateImageContext(imageUri, expectedContext)` (and `validateMultipleImagesContext` for multi-image) in `geminiService.ts` — e.g. wardrobe uploads assert "a single clothing item". This blocks irrelevant images and hallucinated metadata. New image-processing features should follow this pattern. Images are compressed (wardrobe caps at ~200KB) before being sent.

### Styling
No NativeWind — styling is `StyleSheet.create` + the `useTheme()` context. `themes/light.ts` and `themes/dark.ts` define full palettes including **screen-specific accent colors** (`homeAccent`, `wardrobeAccent`, `twinningAccent`, etc.) and per-screen gradients/status-bar colors that screens consume directly. `tailwind.config.js` and `nativewind-env.d.ts` are leftover from an abandoned migration — don't rely on them.

## Key gotchas

- **`newArchEnabled: false`** and React 19 / RN 0.79.6 / Expo ~53 are pinned in `app.config.js`/`package.json`. Be cautious bumping versions — earlier SDK/architecture changes caused repeated build failures (see git history: `Remove worklets packages`, `Temp downgrade AsyncStorage for EAS build`).
- `app.config.js` Android manifest sets `allowBackup: false` and forbids cleartext traffic; if a URL fetch fails on Android, check for a non-HTTPS URL first.
- `dist/` is EAS build output; `.easignore` excludes things `.gitignore` doesn't. `help.txt` in the root is an unrelated file accidentally committed — ignore it.
- Shopping links: `twinningService.generateShoppingLinks` builds Amazon/Pinterest/Google/Myntra search URLs; `components/ShoppingLinks.tsx` renders them and opens via `expo-web-browser`.
- There are no tests and no TypeScript strict mode (`"strict": false` in `tsconfig.json`). `npm run lint` (expo lint) is the only gate.
