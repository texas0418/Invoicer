// Renders all three templates from the real invoiceHtml() for visual checks.
import { writeFileSync } from 'fs';
import { invoiceHtml, TemplateId } from './src/invoiceHtml';
import { BusinessProfile, Invoice } from './src/models';

const biz: BusinessProfile = {
  name: 'Rivera Design Studio',
  address: '14 Ariapita Ave\nPort of Spain, Trinidad',
  email: 'maya@riveradesign.co',
  phone: '+1 868 555 0142',
};

const inv: Invoice = {
  kind: 'invoice',
  number: 'INV-0042',
  issueDateMs: new Date(2026, 6, 7).getTime(),
  dueDateMs: new Date(2026, 6, 21).getTime(),
  clientName: 'Caribbean Coffee Traders Ltd.',
  clientAddress: '22 Independence Sq\nPort of Spain, Trinidad',
  clientEmail: 'accounts@cctraders.tt',
  taxRate: 0.125,
  discountCents: 20000,
  currencySymbol: '$',
  paymentLink: 'https://pay.stripe.com/rivera-inv-0042',
  notes: 'Payment due within 14 days. Thank you!',
  status: 'draft',
  notificationId: null,
  payments: [],
  items: [
    { description: 'Brand identity package — logo, palette, guidelines', quantity: 1, unitPriceCents: 180000 },
    { description: 'Website design (5 pages)', quantity: 1, unitPriceCents: 240000 },
    { description: 'Revision rounds beyond scope', quantity: 3, unitPriceCents: 12000 },
    { description: 'Stock photography licensing', quantity: 1, unitPriceCents: 25000 },
  ],
};

// 40x40 accent-blue square as a stand-in logo
const logo =
  'data:image/svg+xml;base64,' +
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="8" fill="#2563eb"/></svg>').toString('base64');

for (const t of ['classic', 'minimal', 'bold'] as TemplateId[]) {
  writeFileSync(`/tmp/invoice-${t}.html`, invoiceHtml(inv, biz, { template: t, logoDataUri: logo }));
}
console.log('written');
