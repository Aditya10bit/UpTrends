// --- Type Definitions ---
type UserProfile = {
  height: string;         // e.g. "170" (cm)
  bodyType: string;       // e.g. "Slim"
  skinTone: string;       // e.g. "Fair"
  // preferredStyle removed - now using gender instead
  city?: string;          // optional
  gender?: string;        // optional ("male"/"female")
};

type Outfit = {
  id: string | number;
  category: string;
  appearance: {
    height?: string[];     // e.g. ["short", "average"]
    bodyType?: string[];   // e.g. ["Slim", "Average"]
    skinTone?: string[];   // e.g. ["Fair", "Dusky"]
  };
  tags?: string[];
  city?: string;
  zone?: string;
  // ...other fields
};

// --- Helper Functions ---
function normalizeHeight(height: string): string {
  const num = Number(height);
  if (!isNaN(num)) {
    if (num < 165) return 'short';
    if (num <= 180) return 'average';
    return 'tall';
  }
  return '';
}

function getUserFields(user: UserProfile, category: string): string[] {
  const fields = [];
  if (user.gender) fields.push(user.gender.toLowerCase());
  if (user.height) fields.push(normalizeHeight(user.height));
  if (user.bodyType) fields.push(user.bodyType.toLowerCase());
  if (user.skinTone) fields.push(user.skinTone.toLowerCase());
  if (user.gender) fields.push(user.gender.toLowerCase());
  if (category) fields.push(category.replace(/-/g, ' ').replace('male ', '').replace('female ', '').toLowerCase());
  return fields;
}

// --- Main Filtering Function ---
export function filterOutfits(
  outfits: Outfit[],
  userProfile: UserProfile,
  category: string
): Outfit[] {
  const userFields = getUserFields(userProfile, category);

  // Score each outfit for number of matching fields
  const scored = outfits.map((outfit) => {
    let score = 0;
    const appearance = outfit.appearance || {};
    // Check height, bodyType, skinTone
    if (appearance.height && appearance.height.map(h => h.toLowerCase()).includes(normalizeHeight(userProfile.height))) score++;
    if (appearance.bodyType && appearance.bodyType.map(b => b.toLowerCase()).includes(userProfile.bodyType?.toLowerCase() || '')) score++;
    if (appearance.skinTone && appearance.skinTone.map(s => s.toLowerCase()).includes(userProfile.skinTone?.toLowerCase() || '')) score++;
    // Gender-based filtering
    if (userProfile.gender) {
      const cat = (outfit.category || '').toLowerCase();
      const tags = (outfit.tags || []).map(t => t.toLowerCase());
      if (cat.includes(userProfile.gender.toLowerCase()) || tags.includes(userProfile.gender.toLowerCase())) score++;
    }
    // City/zone match (optional)
    if (userProfile.city && (outfit.city || outfit.zone)) {
      if ((outfit.city || outfit.zone)?.toLowerCase() === userProfile.city.toLowerCase()) score++;
    }
    // "any" support: if any field in appearance is "any", always match
    if (
      (appearance.height && appearance.height.map(h => h.toLowerCase()).includes('any')) ||
      (appearance.bodyType && appearance.bodyType.map(b => b.toLowerCase()).includes('any')) ||
      (appearance.skinTone && appearance.skinTone.map(s => s.toLowerCase()).includes('any'))
    ) {
      score += 2; // boost for general outfits
    }
    return { outfit, score };
  });

  // Find max score
  const maxScore = Math.max(...scored.map(s => s.score), 0);

  // Return all outfits with max score >= 2 (at least 2 fields match), else fallback to "any"
  const best = scored.filter(s => s.score === maxScore && maxScore >= 2).map(s => s.outfit);
  if (best.length > 0) return best;

  // Fallback: outfits with "any" in any field
  return outfits.filter(o => {
    const a = o.appearance || {};
    return (
      (a.height && a.height.map(h => h.toLowerCase()).includes('any')) ||
      (a.bodyType && a.bodyType.map(b => b.toLowerCase()).includes('any')) ||
      (a.skinTone && a.skinTone.map(s => s.toLowerCase()).includes('any'))
    );
  });
}
