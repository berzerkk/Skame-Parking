const COOKIE_PREFIX = "sp_cooldown_";

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const key = encodeURIComponent(name) + "=";
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(key))
    ?.slice(key.length) ?? null;
}

export function startCooldown(key: string, minutes: number) {
  const until = Date.now() + minutes * 60_000;
  setCookie(COOKIE_PREFIX + key, String(until), minutes * 60);
}

export function checkCooldown(key: string): { allowed: boolean; remainingMs: number; until: number } {
  const raw = getCookie(COOKIE_PREFIX + key);
  const until = raw ? Number(raw) : 0;
  const now = Date.now();
  const remainingMs = Math.max(0, until - now);
  return { allowed: remainingMs <= 0, remainingMs, until };
}

export function fmtCountdown(ms: number) {
  const s = Math.ceil(ms / 1000);
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
