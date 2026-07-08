// src/models.ts
// Money is integer cents everywhere; convert to display strings only at the edge.

export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export interface Client {
  id?: number;
  name: string;
  address: string;
  email: string;
}

export interface CatalogItem {
  id?: number;
  description: string;
  unitPriceCents: number;
}

export interface LineItem {
  id?: number;
  invoiceId?: number;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Invoice {
  id?: number;
  number: string;
  issueDateMs: number;
  dueDateMs: number;
  // Client snapshot: copied at creation so later client edits don't rewrite
  // historical invoices.
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  taxRate: number; // 0.125 = 12.5%
  discountCents: number;
  currencySymbol: string;
  paymentLink: string;
  notes: string;
  status: InvoiceStatus;
  notificationId: string | null;
  items: LineItem[];
}

export interface BusinessProfile {
  name: string;
  address: string;
  email: string;
  phone: string;
}

export const lineAmountCents = (l: LineItem): number =>
  Math.round(l.quantity * l.unitPriceCents);

export const subtotalCents = (inv: Pick<Invoice, 'items'>): number =>
  inv.items.reduce((s, l) => s + lineAmountCents(l), 0);

export const taxCents = (
  inv: Pick<Invoice, 'items' | 'discountCents' | 'taxRate'>,
): number => Math.round((subtotalCents(inv) - inv.discountCents) * inv.taxRate);

export const totalCents = (
  inv: Pick<Invoice, 'items' | 'discountCents' | 'taxRate'>,
): number => subtotalCents(inv) - inv.discountCents + taxCents(inv);

export const isOverdue = (inv: Invoice): boolean =>
  inv.status === 'sent' && Date.now() > inv.dueDateMs;

/** Display status: 'sent' past its due date shows as overdue. */
export const effectiveStatus = (inv: Invoice): InvoiceStatus | 'overdue' =>
  isOverdue(inv) ? 'overdue' : inv.status;

export function formatCents(cents: number, symbol: string): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const units = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const rem = (abs % 100).toString().padStart(2, '0');
  return `${sign}${symbol}${units}.${rem}`;
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
