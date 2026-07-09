// src/backupFormat.ts
// Pure backup serialization/validation — no native imports, testable in Node.

import { CatalogItem, Client, Invoice } from './models';

export const BACKUP_VERSION = 1;

export interface BackupSettings {
  bizName: string;
  bizAddress: string;
  bizEmail: string;
  bizPhone: string;
  invoicePrefix: string;
  nextNumber: number;
  defaultTaxRate: number;
  defaultPaymentLink: string;
  currencySymbol: string;
  template: string;
  isPro: boolean;
  /** base64 of the logo image, or null */
  logoBase64: string | null;
  logoExt: 'png' | 'jpg' | null;
}

export interface Backup {
  version: number;
  exportedAt: string; // ISO
  settings: BackupSettings;
  clients: Client[];
  items: CatalogItem[];
  invoices: Invoice[]; // lines nested in items[], ids ignored on restore
}

export function buildBackup(
  settings: BackupSettings,
  clients: Client[],
  items: CatalogItem[],
  invoices: Invoice[],
): Backup {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    clients,
    items,
    // Strip runtime-only fields: db ids get reassigned, notification ids
    // are meaningless on another device.
    invoices: invoices.map((inv) => ({
      ...inv,
      id: undefined,
      notificationId: null,
      items: inv.items.map((l) => ({ ...l, id: undefined, invoiceId: undefined })),
      payments: (inv.payments ?? []).map((p) => ({
        ...p,
        id: undefined,
        invoiceId: undefined,
      })),
    })),
  };
}

export type ParseResult =
  | { ok: true; backup: Backup }
  | { ok: false; error: string };

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

export function parseBackup(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'This file is not a valid backup (not JSON).' };
  }
  const b = raw as Partial<Backup>;
  if (!b || typeof b !== 'object') {
    return { ok: false, error: 'This file is not a valid backup.' };
  }
  if (b.version !== BACKUP_VERSION) {
    return {
      ok: false,
      error: `Unsupported backup version (${String(b.version)}). This app reads version ${BACKUP_VERSION}.`,
    };
  }
  if (!b.settings || !Array.isArray(b.clients) || !Array.isArray(b.items) || !Array.isArray(b.invoices)) {
    return { ok: false, error: 'Backup is missing required sections.' };
  }
  for (const inv of b.invoices) {
    if (!isStr(inv.number) || !isNum(inv.issueDateMs) || !isNum(inv.dueDateMs) || !isStr(inv.clientName) || !Array.isArray(inv.items)) {
      return { ok: false, error: `Invoice "${String((inv as { number?: unknown }).number)}" is malformed.` };
    }
    for (const l of inv.items) {
      if (!isStr(l.description) || !isNum(l.quantity) || !isNum(l.unitPriceCents)) {
        return { ok: false, error: `A line item in invoice "${inv.number}" is malformed.` };
      }
    }
    if (inv.payments != null) {
      if (!Array.isArray(inv.payments)) {
        return { ok: false, error: `Payments in invoice "${inv.number}" are malformed.` };
      }
      for (const p of inv.payments) {
        if (!isNum(p.amountCents) || !isNum(p.paidAtMs)) {
          return { ok: false, error: `A payment in invoice "${inv.number}" is malformed.` };
        }
      }
    }
  }
  for (const c of b.clients) {
    if (!isStr((c as Client).name)) {
      return { ok: false, error: 'A client entry is malformed.' };
    }
  }
  for (const i of b.items) {
    if (!isStr((i as CatalogItem).description) || !isNum((i as CatalogItem).unitPriceCents)) {
      return { ok: false, error: 'A saved-item entry is malformed.' };
    }
  }
  return { ok: true, backup: b as Backup };
}
