// services/eventPlannerService.ts
// AI Event Planner — the "proactive closet companion" entry point.
//
// User describes an upcoming event (occasion + date + vibe) and the planner:
//   1. reads the user's closet + profile,
//   2. asks Gemini (ONE metadata-only call — no images) for a full event look
//      that REUSES owned items and only flags what's missing,
//   3. builds shopping links for the gaps (reuses generateOutfitLinks so the
//      Pinterest/Amazon/Myntra stopword filters from the closet-aware work apply),
//   4. returns a reminder plan string the UI hands to notificationService.
//
// Never throws — the whole thing runs under safeApiCall with a deterministic
// fallback, matching the app's AI-resilience stack (see CLAUDE.md).

import { genAI, extractJSON, generateOutfitLinks, OutfitLink } from './geminiService';
import { getWardrobe, WardrobeItem } from './digitalWardrobeService';
import { getUserProfile } from './userService';
import { safeApiCall } from '../utils/apiSafeguards';

export interface EventPlanInput {
  occasion: string; // e.g. "Diwali dinner", "Office party", "Friend's wedding"
  date: string; // ISO date "YYYY-MM-DD"
  vibe?: string; // optional style direction
  location?: string;
  temperature?: number;
  condition?: string;
  gender?: string;
}

export interface EventOutfitItem {
  type: string; // top / bottom / footwear / outerwear / dress / accessory
  name: string;
  color: string;
  owned: boolean; // true = reuse from closet, false = gap to buy
}

export interface EventPlanResult {
  eventId: string;
  eventName: string;
  date: string;
  outfitName: string;
  items: EventOutfitItem[];
  missingItems: string[];
  reasoning: string;
  styleTips: string[];
  shoppingLinks: OutfitLink[];
  daysUntil: number;
}

const escapePrompt = (s: string) => (s || '').replace(/["\n]/g, ' ').trim();

/** Compact, readable closet summary for the prompt (metadata only). */
const buildWardrobeContext = (items: WardrobeItem[]): string => {
  if (!items.length) return '(empty closet)';
  const byType: Record<string, string[]> = {};
  for (const it of items) {
    const type = it.type || 'item';
    (byType[type] = byType[type] || []).push(
      `${it.name} (${Array.isArray(it.colors) && it.colors.length ? it.colors.slice(0, 2).join('/') : it.primaryColor || 'unknown color'}, ${it.subType || 'unknown style'})`
    );
  }
  return Object.entries(byType)
    .map(([type, list]) => `• ${type}: ${list.slice(0, 6).join(', ')}${list.length > 6 ? ` +${list.length - 6} more` : ''}`)
    .join('\n');
};

const runPlanEvent = async (
  input: EventPlanInput,
  items: WardrobeItem[],
  gender: string
): Promise<EventPlanResult> => {
  const wardrobeContext = buildWardrobeContext(items);
  const weatherLine =
    input.temperature != null
      ? `\nWeather: ${input.condition || 'clear'}, ~${Math.round(input.temperature)}°C${input.location ? ` in ${input.location}` : ''}`
      : input.location
        ? `\nLocation: ${input.location}`
        : '';

  const prompt = `You are the personal stylist planner in a fashion app. The user is ${gender}.
Upcoming event: "${escapePrompt(input.occasion)}" on ${input.date}.
Style direction: "${escapePrompt(input.vibe || 'let your expertise decide')}".${weatherLine}

MY CLOSET (what the user already owns):
${wardrobeContext}

Plan a complete event outfit that REUSES items from MY CLOSET wherever they fit, and only flags pieces the user does NOT already own. Prefer the user's actual items over buying new ones.

Return ONLY strict JSON (no markdown) with exactly this shape:
{
  "outfitName": "short catchy look name",
  "items": [
    { "type": "top", "name": "item name", "color": "color", "owned": true },
    { "type": "bottom", "name": "item name", "color": "color", "owned": true },
    { "type": "footwear", "name": "item name", "color": "color", "owned": true },
    { "type": "outerwear", "name": "item name", "color": "color", "owned": false }
  ],
  "reasoning": "one short paragraph on why this look works for the occasion and weather",
  "styleTips": ["tip 1", "tip 2", "tip 3"],
  "missingItems": ["only items with owned=false, as plain shoppable phrases like 'navy blazer' or 'white sneakers'"]
}
Rules: 3-6 items. "owned": true must ONLY be for items that genuinely exist in MY CLOSET above. "missingItems" must exactly match the not-owned items. No repeated items.`;

  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let parsed: {
    outfitName?: string;
    items?: EventOutfitItem[];
    reasoning?: string;
    styleTips?: string[];
    missingItems?: string[];
  };
  try {
    parsed = JSON.parse(extractJSON(text));
  } catch (e) {
    throw new Error('Could not parse planner response');
  }

  const itemsArr = (parsed.items || []).filter((it) => it && typeof it === 'object');
  const missing = Array.isArray(parsed.missingItems)
    ? parsed.missingItems.map((m: any) => String(m)).filter((m) => m.trim().length > 0)
    : itemsArr.filter((it) => !it.owned).map((it) => `${it.name}${it.color && it.color !== 'unknown' ? ` ${it.color}` : ''}`);

  const shoppingLinks = missing.length
    ? await generateOutfitLinks(missing.join(', '), input.occasion)
    : [];

  const daysUntil = Math.max(0, Math.ceil((new Date(input.date + 'T12:00:00').getTime() - Date.now()) / 86400000));

  return {
    eventId: `evt_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4).toString(36)}`,
    eventName: escapePrompt(input.occasion),
    date: input.date,
    outfitName: parsed.outfitName || `Your ${escapePrompt(input.occasion)} look`,
    items: itemsArr,
    missingItems: missing,
    reasoning: parsed.reasoning || 'A tailored look built from your closet for this occasion.',
    styleTips: Array.isArray(parsed.styleTips) ? parsed.styleTips.slice(0, 3) : ['Fit first: get the proportions right.', 'Keep accessories minimal.', 'Check the forecast the night before.'],
    shoppingLinks,
    daysUntil,
  };
};

const getFallbackEventPlan = async (
  input: EventPlanInput,
  items: WardrobeItem[],
  gender: string
): Promise<EventPlanResult> => {
  const pick = (types: string[]): WardrobeItem | undefined =>
    items.find((it) => types.includes(it.type));

  const top = pick(['top', 'outerwear']) || pick(['dress', 'ethnic', 'formal_set']);
  const bottom = pick(['bottom']);
  const shoes = pick(['footwear']);
  const dress = pick(['dress', 'ethnic', 'formal_set']);
  const cold = input.temperature != null && input.temperature <= 18;

  const owned: EventOutfitItem[] = [];
  const missing: string[] = [];
  const add = (type: string, ownedItem: WardrobeItem | undefined, fallbackName: string) => {
    if (ownedItem) {
      owned.push({
        type,
        name: ownedItem.name,
        color: ownedItem.primaryColor || 'versatile',
        owned: true,
      });
    } else {
      missing.push(fallbackName);
    }
  };

  const isFormal = /wedding|party|dinner|gala|diwali|festival|ceremony|date/i.test(input.occasion);

  if (dress && (isFormal || !top)) {
    owned.push({ type: dress.type, name: dress.name, color: dress.primaryColor || 'versatile', owned: true });
  } else {
    add('top', top, 'smart top');
  }
  if (!(dress && (isFormal || !top))) {
    add('bottom', bottom, isFormal ? 'tailored trousers' : 'clean jeans or chinos');
  }
  add('footwear', shoes, isFormal ? 'formal shoes' : 'clean sneakers');
  if (cold) add('outerwear', items.find((it) => it.type === 'outerwear'), 'light blazer or jacket');

  const eventName = escapePrompt(input.occasion);
  const daysUntil = Math.max(0, Math.ceil((new Date(input.date + 'T12:00:00').getTime() - Date.now()) / 86400000));

  // generateOutfitLinks is pure URL building (no AI) — safe to run in fallback so
  // the degraded path still hands the user shop links for their gaps.
  let shoppingLinks: OutfitLink[] = [];
  if (missing.length > 0) {
    try {
      shoppingLinks = await generateOutfitLinks(missing.join(', '), eventName);
    } catch (e) {
      shoppingLinks = [];
    }
  }

  return {
    eventId: `evt_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4).toString(36)}`,
    eventName,
    date: input.date,
    outfitName: `${eventName} ready`,
    items: owned,
    missingItems: missing,
    reasoning: `Pulled together from your closet so you show up ready for ${eventName}.${missing.length ? ` You're missing ${missing.join(', ')} — grab those to complete the look.` : ' You already own everything needed.'}`,
    styleTips: ['Keep it comfortable — you should enjoy the event, not fuss over your clothes.', 'Neutral base, one statement piece.', 'Confirm the dress code with the host if unsure.'],
    shoppingLinks,
    daysUntil,
  };
};

/** Main entry — always returns a usable plan (falls back deterministically). */
export const planEvent = async (input: EventPlanInput): Promise<EventPlanResult> => {
  const [items, profile] = await Promise.all([
    getWardrobe().catch(() => [] as WardrobeItem[]),
    getUserProfile().catch(() => null),
  ]);
  const gender = input.gender || profile?.gender || 'male';
  return safeApiCall(
    () => runPlanEvent(input, items, gender),
    await getFallbackEventPlan(input, items, gender),
    { timeout: 30000 }
  );
};
