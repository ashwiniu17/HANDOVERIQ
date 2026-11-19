// Quick checks that give instant feedback in forms. The backend repeats every
// rule and is the one that actually enforces them.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter your e-mail address.";
  if (!EMAIL.test(email)) return "Enter a valid e-mail address.";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Enter a password.";
  if (value.trim().length < 8) return "Use at least 8 characters.";
  if (value.length > 128) return "Use at most 128 characters.";
  return null;
}

export function validateRequired(value: string, label: string, max = 120): string | null {
  const text = value.trim();
  if (!text) return `Enter ${label}.`;
  if (text.length > max) return `Use at most ${max} characters.`;
  return null;
}

export function firstError(errors: Record<string, string | null>): Record<string, string> {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Record<string, string>;
}
