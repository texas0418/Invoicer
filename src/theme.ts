// src/theme.ts
export const T = {
  accent: '#2563eb',
  ink: '#1a1a2e',
  muted: '#6b7280',
  faint: '#f3f4f6',
  rule: '#e5e7eb',
  danger: '#dc2626',
  ok: '#16a34a',
  bg: '#ffffff',
} as const;

export const statusColor = (s: string): string =>
  s === 'paid' ? T.ok : s === 'overdue' ? T.danger : s === 'sent' ? T.accent : T.muted;
