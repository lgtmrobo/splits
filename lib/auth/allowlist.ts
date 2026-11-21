// Who may sign in. ALLOWED_EMAILS is a comma-separated list; the first
// address is the owner (gets a full Strava history import on connect).
// ALLOWED_EMAIL (singular) is still read for older single-user setups.

export function allowedEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS ?? process.env.ALLOWED_EMAIL ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().includes(email.toLowerCase());
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails()[0] === email.toLowerCase();
}
