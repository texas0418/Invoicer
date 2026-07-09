// src/theme.ts — design tokens. The app shares its palette with the invoice
// PDF (src/invoiceHtml.ts) so the product feels like one object.
export const T = {
  // palette
  ink: '#1a1a2e',
  inkSoft: '#2a2d45',
  paper: '#f6f7f9',
  card: '#ffffff',
  accent: '#2563eb',
  accentSoft: '#e8eefc',
  muted: '#6b7280',
  faint: '#eef0f3',
  rule: '#e5e7eb',
  danger: '#dc2626',
  dangerSoft: '#fdecec',
  warn: '#b45309',
  warnSoft: '#fdf3e3',
  ok: '#16a34a',
  okSoft: '#e7f6ec',
  bg: '#f6f7f9',
  // radii
  rSm: 8,
  rMd: 12,
  rLg: 18,
} as const;

export const statusTint = (
  s: string,
): { fg: string; bg: string } =>
  s === 'paid' || s === 'accepted'
    ? { fg: T.ok, bg: T.okSoft }
    : s === 'overdue' || s === 'declined'
      ? { fg: T.danger, bg: T.dangerSoft }
      : s === 'partial'
        ? { fg: T.warn, bg: T.warnSoft }
    : s === 'sent'
        ? { fg: T.accent, bg: T.accentSoft }
        : { fg: T.muted, bg: T.faint };

export const shadow = {
  shadowColor: '#101322',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
