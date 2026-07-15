// src/devSeed.ts
// TEMPORARY — sample data for App Store screenshots only.
// Safe to delete entirely: remove this file, the "Developer" block in
// SettingsScreen.tsx, and its import. Nothing else references it.
import * as db from './db';
import { Invoice, LineItem, Payment, totalCents } from './models';
import { saveBusinessProfile, setInvoiceNumbering } from './services';

const DAY = 86400000;

let seq = 0;
const line = (description: string, quantity: number, unitPriceCents: number): LineItem => ({
  description,
  quantity,
  unitPriceCents,
});

interface Spec {
  kind: 'invoice' | 'estimate';
  number: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  issueDaysAgo: number;
  termDays: number; // due/valid span from issue
  status: Invoice['status'];
  taxRate?: number;
  discountCents?: number;
  notes?: string;
  items: LineItem[];
  /** fraction of the total already paid (invoices only): 1 = paid, 0.4 = partial */
  paidFraction?: number;
}

function build(spec: Spec, now: number): Invoice {
  const issueDateMs = now - spec.issueDaysAgo * DAY;
  const dueDateMs = issueDateMs + spec.termDays * DAY;
  const base: Invoice = {
    kind: spec.kind,
    number: spec.number,
    issueDateMs,
    dueDateMs,
    clientName: spec.clientName,
    clientAddress: spec.clientAddress,
    clientEmail: spec.clientEmail,
    taxRate: spec.taxRate ?? 0,
    discountCents: spec.discountCents ?? 0,
    currencySymbol: '$',
    paymentLink: 'https://pay.northwindstudio.co',
    notes: spec.notes ?? '',
    status: spec.status,
    notificationId: null,
    items: spec.items,
    payments: [],
  };
  const payments: Payment[] = [];
  if (spec.paidFraction && spec.paidFraction > 0) {
    const amount = Math.round(totalCents(base) * spec.paidFraction);
    payments.push({
      amountCents: amount,
      // paid partway between issue and now, so year summaries populate
      paidAtMs: issueDateMs + Math.round(spec.termDays * 0.6) * DAY,
      note: spec.paidFraction >= 1 ? 'Paid in full' : 'Partial payment',
    });
  }
  return { ...base, payments };
}

const SPECS: Spec[] = [
  // ---- invoices ----
  {
    kind: 'invoice', number: 'INV-0001', status: 'paid', paidFraction: 1,
    clientName: 'Acme Corporation', clientAddress: '400 Market St\nSan Francisco, CA 94105',
    clientEmail: 'ap@acme.com', issueDaysAgo: 54, termDays: 14, taxRate: 0.0875,
    notes: 'Thank you for your business!',
    items: [
      line('Brand identity design', 1, 320000),
      line('Logo variations (3)', 3, 45000),
      line('Style guide PDF', 1, 60000),
    ],
  },
  {
    kind: 'invoice', number: 'INV-0002', status: 'sent',
    clientName: 'Riverside Café', clientAddress: '18 Canal Road\nAustin, TX 78701',
    clientEmail: 'hello@riversidecafe.com', issueDaysAgo: 6, termDays: 21, taxRate: 0.0825,
    items: [
      line('Menu redesign', 1, 140000),
      line('Photography — half day', 1, 90000),
    ],
  },
  {
    kind: 'invoice', number: 'INV-0003', status: 'sent', // overdue: due date already passed
    clientName: 'Blue Harbor LLC', clientAddress: '229 Wharf Ave\nSeattle, WA 98101',
    clientEmail: 'billing@blueharbor.io', issueDaysAgo: 38, termDays: 15,
    notes: 'Net 15. Late payments subject to 1.5% monthly fee.',
    items: [
      line('Website consulting', 12, 15000),
      line('Performance audit', 1, 75000),
    ],
  },
  {
    kind: 'invoice', number: 'INV-0004', status: 'sent', paidFraction: 0.4, // partial
    clientName: 'Maple & Co.', clientAddress: '77 Birch Lane\nPortland, OR 97204',
    clientEmail: 'accounts@mapleandco.com', issueDaysAgo: 20, termDays: 30, taxRate: 0.06,
    discountCents: 25000,
    items: [
      line('Product photography', 40, 3500),
      line('Retouching', 40, 1200),
    ],
  },
  {
    kind: 'invoice', number: 'INV-0005', status: 'draft',
    clientName: 'Summit Fitness', clientAddress: '5 Ridgeway\nDenver, CO 80202',
    clientEmail: 'ops@summitfitness.app', issueDaysAgo: 1, termDays: 30,
    items: [
      line('Mobile app UI design', 1, 480000),
      line('Interactive prototype', 1, 120000),
    ],
  },
  {
    kind: 'invoice', number: 'INV-0006', status: 'paid', paidFraction: 1,
    clientName: 'Green Leaf Landscaping', clientAddress: '812 Cedar Ct\nRaleigh, NC 27601',
    clientEmail: 'info@greenleaf.co', issueDaysAgo: 71, termDays: 14, taxRate: 0.0475,
    items: [
      line('Logo & print package', 1, 180000),
      line('Business cards (500)', 1, 22000),
      line('Vehicle decal design', 2, 30000),
    ],
  },
  // ---- estimates ----
  {
    kind: 'estimate', number: 'EST-0001', status: 'sent',
    clientName: 'Harborview Dental', clientAddress: '3 Seaside Blvd\nBoston, MA 02110',
    clientEmail: 'office@harborviewdental.com', issueDaysAgo: 4, termDays: 30, taxRate: 0.0625,
    notes: 'Estimate valid for 30 days.',
    items: [
      line('Practice rebrand', 1, 650000),
      line('Signage design', 1, 95000),
    ],
  },
  {
    kind: 'estimate', number: 'EST-0002', status: 'accepted',
    clientName: 'Acme Corporation', clientAddress: '400 Market St\nSan Francisco, CA 94105',
    clientEmail: 'ap@acme.com', issueDaysAgo: 60, termDays: 30, taxRate: 0.0875,
    items: [
      line('Brand identity design', 1, 320000),
      line('Logo variations (3)', 3, 45000),
      line('Style guide PDF', 1, 60000),
    ],
  },
  {
    kind: 'estimate', number: 'EST-0003', status: 'declined',
    clientName: 'Nomad Coffee Roasters', clientAddress: '140 Warehouse Row\nNashville, TN 37203',
    clientEmail: 'team@nomadcoffee.com', issueDaysAgo: 33, termDays: 21,
    items: [
      line('Packaging design (3 SKUs)', 3, 110000),
      line('Illustration set', 1, 85000),
    ],
  },
  {
    kind: 'estimate', number: 'EST-0004', status: 'draft',
    clientName: 'Bright Yoga Studio', clientAddress: '62 Lotus Way\nSanta Fe, NM 87501',
    clientEmail: 'hello@brightyoga.com', issueDaysAgo: 2, termDays: 30,
    items: [
      line('Website redesign', 1, 380000),
      line('Booking flow UX', 1, 140000),
    ],
  },
  {
    kind: 'estimate', number: 'EST-0005', status: 'sent',
    clientName: 'Coastal Realty Group', clientAddress: '901 Ocean Dr\nMiami, FL 33139',
    clientEmail: 'marketing@coastalrealty.com', issueDaysAgo: 9, termDays: 45, taxRate: 0.07,
    discountCents: 50000,
    items: [
      line('Marketing brochure suite', 1, 240000),
      line('Drone photography', 1, 160000),
      line('Social media templates', 10, 8000),
    ],
  },
];

const CLIENTS = [
  { name: 'Acme Corporation', address: '400 Market St\nSan Francisco, CA 94105', email: 'ap@acme.com' },
  { name: 'Riverside Café', address: '18 Canal Road\nAustin, TX 78701', email: 'hello@riversidecafe.com' },
  { name: 'Blue Harbor LLC', address: '229 Wharf Ave\nSeattle, WA 98101', email: 'billing@blueharbor.io' },
  { name: 'Maple & Co.', address: '77 Birch Lane\nPortland, OR 97204', email: 'accounts@mapleandco.com' },
  { name: 'Harborview Dental', address: '3 Seaside Blvd\nBoston, MA 02110', email: 'office@harborviewdental.com' },
];

const ITEMS = [
  { description: 'Brand identity design', unitPriceCents: 320000 },
  { description: 'Website consulting (hr)', unitPriceCents: 15000 },
  { description: 'Product photography', unitPriceCents: 3500 },
  { description: 'Logo & print package', unitPriceCents: 180000 },
  { description: 'Mobile app UI design', unitPriceCents: 480000 },
];

/** Wipe everything, then insert a realistic screenshot data set. */
export async function seedSampleData(): Promise<void> {
  await db.wipeAll();
  await saveBusinessProfile({
    name: 'Northwind Studio',
    address: '210 Foundry Street, Suite 4\nBrooklyn, NY 11201',
    email: 'studio@northwindstudio.co',
    phone: '(212) 555-0184',
  });
  // Next numbers continue after the seeded set.
  await setInvoiceNumbering('INV', 7);

  const now = Date.now();
  for (const spec of SPECS) {
    await db.insertInvoice(build(spec, now));
  }
  for (const c of CLIENTS) await db.upsertClient(c);
  for (const i of ITEMS) await db.upsertItem(i);
}

/** Remove all seeded (and any other) data. */
export async function clearSampleData(): Promise<void> {
  await db.wipeAll();
}
