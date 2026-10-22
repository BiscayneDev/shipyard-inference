/**
 * Site sign-in allowlist. Pure, so the rule can be tested without a network.
 * Fail closed: an unset or empty list admits nobody. Comparison is case-insensitive on the trimmed address.
 */
export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes("@"))
}

export function isAllowedEmail(email: string | null | undefined, raw: string | undefined): boolean {
  if (!email) return false
  const allowed = parseAllowlist(raw)
  return allowed.length > 0 && allowed.includes(email.trim().toLowerCase())
}
