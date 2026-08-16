// utils/displayName.ts
// Single source of truth for how we greet the user by name.
//
// Order: Firestore profile displayName (what the user actually sets in the app,
// profile.tsx writes it there) → Firebase auth displayName → email → fallback.
// Used by the home screen greeting, the body-analysis chat greeting, and
// anywhere else we address the user.

interface NameUser {
  displayName?: string | null;
  email?: string | null;
}

export const resolveDisplayName = (
  user: NameUser | null | undefined,
  profile?: { displayName?: string | null } | null,
  fallback = 'Fashion Explorer'
): string => {
  const fromProfile = profile?.displayName?.trim();
  if (fromProfile) return fromProfile;
  const fromUser = user?.displayName?.trim();
  if (fromUser) return fromUser;
  const fromEmail = user?.email?.trim();
  if (fromEmail) return fromEmail;
  return fallback;
};
