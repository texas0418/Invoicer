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
  number: 'T', issueDateMs: 0, dueDateMs: Date.now() - 1000,
  clientName: 'c', clientAddress: '', clientEmail: '', taxRate: 0,
  discountCents: 0, currencySymbol: '$', paymentLink: '', notes: '',
  status: 'sent', notificationId: null, items: [],
};
eq('sent past due -> overdue', effectiveStatus(base), 'overdue');
eq('paid past due stays paid', effectiveStatus({ ...base, status: 'paid' }), 'paid');
eq('draft past due stays draft', effectiveStatus({ ...base, status: 'draft' }), 'draft');
eq('sent before due stays sent', effectiveStatus({ ...base, dueDateMs: Date.now() + 86400000 }), 'sent');

process.exit(failures === 0 ? 0 : 1);
