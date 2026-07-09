// src/models.ts
// Money is integer cents everywhere; convert to display strings only at the edge.

export type DocKind = 'invoice' | 'estimate';
// draft/sent shared; paid = invoices only; accepted/declined = estimates only
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'accepted' | 'declined';

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

export interface Payment {
  id?: number;
  invoiceId?: number;
  amountCents: number;
  paidAtMs: number;
  note: string;
}

export interface Invoice {
  id?: number;
  kind: DocKind;
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
  payments: Payment[];
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

export const paidCents = (inv: Pick<Invoice, 'payments'>): number =>
  inv.payments.reduce((s, p) => s + p.amountCents, 0);

export const balanceCents = (
  inv: Pick<Invoice, 'items' | 'discountCents' | 'taxRate' | 'payments'>,
): number => totalCents(inv) - paidCents(inv);

/** Storage status an invoice should hold after its payments change. */
export const statusAfterPayments = (
  totalC: number,
  paidC: number,
  current: InvoiceStatus,
): InvoiceStatus => {
  if (paidC >= totalC && totalC > 0) return 'paid';
  return current === 'paid' ? 'sent' : current;
};

export const isOverdue = (inv: Invoice): boolean =>
  inv.kind === 'invoice' && inv.status === 'sent' && Date.now() > inv.dueDateMs;

/** Display status: 'sent' past its due date shows as overdue. */
export const effectiveStatus = (
  inv: Invoice,
): InvoiceStatus | 'overdue' | 'partial' => {
  if (isOverdue(inv)) return 'overdue';
  if (
    inv.kind === 'invoice' &&
    inv.status !== 'paid' &&
    paidCents(inv) > 0 &&
    balanceCents(inv) > 0
  ) {
    return 'partial';
  }
  return inv.status;
};

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

/** Build a fresh draft copied from an existing invoice: new number, issued
 *  now, same due-date span, same client snapshot and lines. */
export function duplicateInvoice(
  source: Invoice,
  newNumber: string,
  nowMs: number,
): Invoice {
  const span = Math.max(1, Math.round((source.dueDateMs - source.issueDateMs) / 86400000));
  return {
    ...source,
    id: undefined,
    number: newNumber,
    issueDateMs: nowMs,
    dueDateMs: nowMs + span * 86400000,
    status: 'draft',
    notificationId: null,
    items: source.items.map((l) => ({
      ...l,
      id: undefined,
      invoiceId: undefined,
    })),
    payments: [],
  };
}

/** Convert an estimate into a fresh invoice draft. The estimate's validity
 *  span becomes the invoice's payment terms. */
export function estimateToInvoice(
  est: Invoice,
  invoiceNumber: string,
  nowMs: number,
): Invoice {
  const span = Math.max(1, Math.round((est.dueDateMs - est.issueDateMs) / 86400000));
  return {
    ...est,
    id: undefined,
    kind: 'invoice',
    number: invoiceNumber,
    issueDateMs: nowMs,
    dueDateMs: nowMs + span * 86400000,
    status: 'draft',
    notificationId: null,
    items: est.items.map((l) => ({ ...l, id: undefined, invoiceId: undefined })),
    payments: [],
  };
}

/** Cash collected in a calendar year, from actual payment dates. */
export function collectedInYear(invoices: Invoice[], year: number): number {
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  let sum = 0;
  for (const inv of invoices) {
    if (inv.kind !== 'invoice') continue;
    for (const p of inv.payments) {
      if (p.paidAtMs >= start && p.paidAtMs < end) sum += p.amountCents;
    }
  }
  return sum;
}
