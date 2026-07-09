import { formatCents, lineAmountCents, subtotalCents, taxCents, totalCents, effectiveStatus, Invoice } from './src/models';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.log(`FAIL ${name}: got ${got}, want ${want}`);
    failures++;
  } else console.log(`ok   ${name}`);
};

eq('format basic', formatCents(518625, '$'), '$5,186.25');
eq('format zero', formatCents(0, '$'), '$0.00');
eq('format negative', formatCents(-150, '$'), '-$1.50');
eq('format million', formatCents(123456789, '€'), '€1,234,567.89');
eq('format sub-dollar', formatCents(7, '$'), '$0.07');

const inv = {
  items: [
    { description: 'a', quantity: 1, unitPriceCents: 180000 },
    { description: 'b', quantity: 1, unitPriceCents: 240000 },
    { description: 'c', quantity: 3, unitPriceCents: 12000 },
    { description: 'd', quantity: 1, unitPriceCents: 25000 },
  ],
  discountCents: 20000,
  taxRate: 0.125,
};
eq('subtotal', subtotalCents(inv), 481000);
eq('tax', taxCents(inv), 57625);
eq('total', totalCents(inv), 518625);

// float-risk case: 0.1 + 0.2 style quantities
eq('fractional qty rounds', lineAmountCents({ description: 'x', quantity: 0.3, unitPriceCents: 1000 }), 300);
eq('third qty rounds', lineAmountCents({ description: 'x', quantity: 1/3, unitPriceCents: 300 }), 100);

const base: Invoice = {
  kind: 'invoice',
  number: 'T', issueDateMs: 0, dueDateMs: Date.now() - 1000,
  clientName: 'c', clientAddress: '', clientEmail: '', taxRate: 0,
  discountCents: 0, currencySymbol: '$', paymentLink: '', notes: '',
  status: 'sent', notificationId: null,
  payments: [], items: [],
};
eq('sent past due -> overdue', effectiveStatus(base), 'overdue');
eq('paid past due stays paid', effectiveStatus({ ...base, status: 'paid' }), 'paid');
eq('draft past due stays draft', effectiveStatus({ ...base, status: 'draft' }), 'draft');
eq('sent before due stays sent', effectiveStatus({ ...base, dueDateMs: Date.now() + 86400000 }), 'sent');


// ---- backup format round-trip ----
import { buildBackup, parseBackup, BACKUP_VERSION } from './src/backupFormat';

const settings = {
  bizName: 'Biz', bizAddress: '', bizEmail: '', bizPhone: '',
  invoicePrefix: 'INV', nextNumber: 7, defaultTaxRate: 0.125,
  defaultPaymentLink: '', currencySymbol: '$', template: 'bold',
  isPro: true, logoBase64: null, logoExt: null,
} as const;

const bk = buildBackup(
  { ...settings },
  [{ id: 3, name: 'C1', address: 'a', email: 'e' }],
  [{ id: 9, description: 'thing', unitPriceCents: 500 }],
  [{ ...base, id: 42, notificationId: 'stale', items: [{ id: 1, invoiceId: 42, description: 'x', quantity: 2, unitPriceCents: 100 }] }],
);
eq('backup strips invoice id', bk.invoices[0].id, undefined);
eq('backup strips notif id', bk.invoices[0].notificationId, null);
eq('backup strips line ids', bk.invoices[0].items[0].id, undefined);

const rt = parseBackup(JSON.stringify(bk));
eq('roundtrip ok', rt.ok, true);
if (rt.ok) eq('roundtrip invoice count', rt.backup.invoices.length, 1);

eq('rejects not-json', parseBackup('{oops').ok, false);
eq('rejects wrong version', parseBackup(JSON.stringify({ ...bk, version: BACKUP_VERSION + 1 })).ok, false);
eq('rejects missing sections', parseBackup(JSON.stringify({ version: 1, settings })).ok, false);
const bad = JSON.parse(JSON.stringify(bk)); bad.invoices[0].items[0].quantity = 'two';
eq('rejects malformed line', parseBackup(JSON.stringify(bad)).ok, false);

// ---- duplicate helper ----
import { duplicateInvoice } from './src/models';
const NOW = new Date(2026, 6, 9).getTime();
const orig: Invoice = {
  ...base,
  id: 7,
  number: 'INV-0007',
  issueDateMs: new Date(2026, 5, 1).getTime(),
  dueDateMs: new Date(2026, 5, 15).getTime(), // 14-day span
  status: 'paid',
  notificationId: 'n-old',
  items: [{ id: 5, invoiceId: 7, description: 'retainer', quantity: 1, unitPriceCents: 50000 }],
};
const dup = duplicateInvoice(orig, 'INV-0031', NOW);
eq('dup: new number', dup.number, 'INV-0031');
eq('dup: no id', dup.id, undefined);
eq('dup: status draft', dup.status, 'draft');
eq('dup: no notif', dup.notificationId, null);
eq('dup: issued now', dup.issueDateMs, NOW);
eq('dup: keeps 14-day span', (dup.dueDateMs - dup.issueDateMs) / 86400000, 14);
eq('dup: line copied w/o ids', dup.items[0].id, undefined);
eq('dup: line amount kept', dup.items[0].unitPriceCents, 50000);
eq('dup: original untouched', orig.items[0].id, 5);

// ---- estimates ----
import { estimateToInvoice } from './src/models';
const est: Invoice = {
  ...base,
  kind: 'estimate',
  number: 'EST-0003',
  issueDateMs: new Date(2026, 6, 1).getTime(),
  dueDateMs: new Date(2026, 6, 31).getTime(), // 30-day validity
  status: 'sent',
  items: [{ description: 'job', quantity: 1, unitPriceCents: 90000 }],
};
eq('estimate never overdue', effectiveStatus(est), 'sent');
const NOW2 = new Date(2026, 6, 9).getTime();
const conv = estimateToInvoice(est, 'INV-0100', NOW2);
eq('convert: kind invoice', conv.kind, 'invoice');
eq('convert: new number', conv.number, 'INV-0100');
eq('convert: draft', conv.status, 'draft');
eq('convert: keeps 30-day span', (conv.dueDateMs - conv.issueDateMs) / 86400000, 30);
eq('convert: keeps line total', conv.items[0].unitPriceCents, 90000);
eq('convert: overdue applies to converted', effectiveStatus({ ...conv, status: 'sent', dueDateMs: NOW2 - 1000, issueDateMs: NOW2 - 86400000 }), 'overdue');

// ---- payments ----
import { balanceCents, paidCents, statusAfterPayments } from './src/models';
const pinv: Invoice = {
  ...base,
  status: 'sent',
  dueDateMs: Date.now() + 86400000,
  items: [{ description: 'x', quantity: 1, unitPriceCents: 100000 }],
  payments: [
    { amountCents: 40000, paidAtMs: 1, note: '' },
    { amountCents: 10000, paidAtMs: 2, note: 'deposit' },
  ],
};
eq('paid sum', paidCents(pinv), 50000);
eq('balance', balanceCents(pinv), 50000);
eq('partial display', effectiveStatus(pinv), 'partial');
eq('overdue beats partial', effectiveStatus({ ...pinv, dueDateMs: Date.now() - 1000 }), 'overdue');
eq('no payments -> plain sent', effectiveStatus({ ...pinv, payments: [] }), 'sent');
eq('estimate ignores payments', effectiveStatus({ ...pinv, kind: 'estimate', payments: pinv.payments }), 'sent');
eq('full payment -> paid', statusAfterPayments(100000, 100000, 'sent'), 'paid');
eq('overpay -> paid', statusAfterPayments(100000, 120000, 'sent'), 'paid');
eq('partial keeps sent', statusAfterPayments(100000, 50000, 'sent'), 'sent');
eq('payment removed unpays', statusAfterPayments(100000, 50000, 'paid'), 'sent');
eq('zero-total never paid', statusAfterPayments(0, 0, 'draft'), 'draft');

// backup roundtrip with payments
const bk2 = buildBackup({ ...settings }, [], [], [pinv]);
eq('backup keeps payments', bk2.invoices[0].payments.length, 2);
const rt2 = parseBackup(JSON.stringify(bk2));
eq('payments roundtrip', rt2.ok, true);
const legacy = JSON.parse(JSON.stringify(bk2)); delete legacy.invoices[0].payments;
eq('old backup w/o payments still parses', parseBackup(JSON.stringify(legacy)).ok, true);
const badp = JSON.parse(JSON.stringify(bk2)); badp.invoices[0].payments[0].amountCents = 'x';
eq('malformed payment rejected', parseBackup(JSON.stringify(badp)).ok, false);

// ---- collected in year ----
import { collectedInYear } from './src/models';
const y = 2026;
const jan = new Date(2026, 0, 15).getTime();
const dec = new Date(2026, 11, 31).getTime();
const prevDec = new Date(2025, 11, 31).getTime();
const nextJan = new Date(2027, 0, 1).getTime();
const mk = (payments: { amountCents: number; paidAtMs: number }[], kind: 'invoice' | 'estimate' = 'invoice'): Invoice => ({
  ...base,
  kind,
  payments: payments.map((p) => ({ ...p, note: '' })),
});
eq('ytd sums in-year payments', collectedInYear([mk([{ amountCents: 100, paidAtMs: jan }, { amountCents: 50, paidAtMs: dec }])], y), 150);
eq('ytd across invoices', collectedInYear([mk([{ amountCents: 100, paidAtMs: jan }]), mk([{ amountCents: 25, paidAtMs: dec }])], y), 125);
eq('ytd excludes prior year', collectedInYear([mk([{ amountCents: 100, paidAtMs: prevDec }])], y), 0);
eq('ytd excludes next year boundary', collectedInYear([mk([{ amountCents: 100, paidAtMs: nextJan }])], y), 0);
eq('ytd ignores estimates', collectedInYear([mk([{ amountCents: 100, paidAtMs: jan }], 'estimate')], y), 0);
eq('ytd empty', collectedInYear([], y), 0);

// ---- template registry ----
import { invoiceHtml, TEMPLATES, FREE_TEMPLATE_ID } from './src/invoiceHtml';
eq('template count in range', TEMPLATES.length >= 10 && TEMPLATES.length <= 20, true);
eq('ids unique', new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
eq('free template exists', TEMPLATES.some((t) => t.id === FREE_TEMPLATE_ID), true);

const tplInv: Invoice = {
  ...base,
  number: 'INV-0042',
  clientName: 'Acme & Sons <Ltd>',
  items: [{ description: 'Design "work"', quantity: 2, unitPriceCents: 50000 }],
  payments: [{ amountCents: 30000, paidAtMs: 1, note: '' }],
  taxRate: 0.1,
  discountCents: 1000,
};
const tplBiz = { name: 'Test Co', address: '1 Road', email: 'a@b.c', phone: '' };
for (const t of TEMPLATES) {
  const html = invoiceHtml(tplInv, tplBiz, { template: t.id });
  const good =
    html.includes('INV-0042') &&
    html.includes('Balance Due') &&
    html.includes('Acme &amp; Sons &lt;Ltd&gt;') && // escaping works
    html.includes(t.theme.accent);
  eq(`template renders: ${t.id}`, good, true);
}
eq('unknown id falls back', invoiceHtml(tplInv, tplBiz, { template: 'nope' }).includes('INV-0042'), true);

process.exit(failures === 0 ? 0 : 1);
