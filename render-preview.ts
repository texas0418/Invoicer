// Renders the real invoiceHtml() output to a file for visual verification.
import { writeFileSync } from 'fs';
import { invoiceHtml } from './src/invoiceHtml';
import { Invoice } from './src/models';

const inv: Invoice = {
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
  notes: 'Payment due within 14 days. 1.5% monthly late fee applies thereafter. Thank you!',
  status: 'draft',
  notificationId: null,
  items: [
    { description: 'Brand identity package — logo, palette, guidelines', quantity: 1, unitPriceCents: 180000 },
    { description: 'Website design (5 pages)', quantity: 1, unitPriceCents: 240000 },
    { description: 'Revision rounds beyond scope', quantity: 3, unitPriceCents: 12000 },
    { description: 'Stock photography licensing', quantity: 1, unitPriceCents: 25000 },
  ],
};

writeFileSync('/tmp/invoice-preview.html', invoiceHtml(inv, {
  name: 'Rivera Design Studio',
  address: '14 Ariapita Ave\nPort of Spain, Trinidad',
  email: 'maya@riveradesign.co',
  phone: '+1 868 555 0142',
}));
console.log('written');
