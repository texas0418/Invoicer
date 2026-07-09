// src/invoiceHtml.ts
// Pure HTML templates — no native imports, testable in Node.
// 5 structural layouts × color themes = the template registry below.
// All designs are original; layouts follow common invoice conventions.

import {
  balanceCents,
  BusinessProfile,
  formatCents,
  formatDate,
  Invoice,
  lineAmountCents,
  paidCents,
  subtotalCents,
  taxCents,
  totalCents,
} from './models';

export type TemplateId = string;

type LayoutId = 'classic' | 'minimal' | 'bold' | 'band' | 'ledger';

interface Theme {
  accent: string; // primary color
  ink: string; // body text
  muted: string; // secondary text
  faint: string; // panel fill
  rule: string; // hairlines
  band?: string; // header band bg (bold/band layouts)
  bandText?: string; // text on band
}

export interface TemplateDef {
  id: TemplateId;
  name: string;
  blurb: string;
  layout: LayoutId;
  theme: Theme;
  /** swatch colors for the settings picker */
  swatch: [string, string];
}

const INK = '#1a1a2e';
const MUTED = '#6b7280';
const FAINT = '#f3f4f6';
const RULE = '#e5e7eb';

const base = (accent: string): Theme => ({
  accent,
  ink: INK,
  muted: MUTED,
  faint: FAINT,
  rule: RULE,
});

export const TEMPLATES: TemplateDef[] = [
  // ---- Classic: soft panel, colored accents (free tier: Classic Blue)
  { id: 'classic', name: 'Classic Blue', blurb: 'Panelled, friendly', layout: 'classic', theme: base('#2563eb'), swatch: ['#2563eb', FAINT] },
  { id: 'classic-forest', name: 'Classic Forest', blurb: 'Calm green accents', layout: 'classic', theme: base('#166534'), swatch: ['#166534', FAINT] },
  { id: 'classic-plum', name: 'Classic Plum', blurb: 'Violet accents', layout: 'classic', theme: base('#7c3aed'), swatch: ['#7c3aed', FAINT] },
  { id: 'classic-crimson', name: 'Classic Crimson', blurb: 'Deep red accents', layout: 'classic', theme: base('#b91c1c'), swatch: ['#b91c1c', FAINT] },

  // ---- Minimal: hairline rules, typographic
  { id: 'minimal', name: 'Minimal', blurb: 'Quiet, monochrome', layout: 'minimal', theme: { ...base(INK), muted: '#8a8f98', rule: '#dcdfe4' }, swatch: [INK, '#ffffff'] },
  { id: 'minimal-navy', name: 'Minimal Navy', blurb: 'Ink-blue rules', layout: 'minimal', theme: { ...base('#1e3a8a'), muted: '#8a8f98', rule: '#d6dcea' }, swatch: ['#1e3a8a', '#ffffff'] },
  { id: 'minimal-sepia', name: 'Minimal Sepia', blurb: 'Warm, understated', layout: 'minimal', theme: { accent: '#78350f', ink: '#292018', muted: '#9a8c7d', faint: '#faf6f1', rule: '#e7ddd2' }, swatch: ['#78350f', '#faf6f1'] },

  // ---- Bold: dark header block
  { id: 'bold', name: 'Bold', blurb: 'Dark header band', layout: 'bold', theme: { ...base('#2563eb'), band: INK, bandText: '#ffffff' }, swatch: [INK, '#2563eb'] },
  { id: 'bold-noir', name: 'Noir', blurb: 'Black with gold', layout: 'bold', theme: { ...base('#ca8a04'), band: '#121212', bandText: '#ffffff' }, swatch: ['#121212', '#ca8a04'] },
  { id: 'bold-ocean', name: 'Ocean', blurb: 'Deep sea header', layout: 'bold', theme: { ...base('#0ea5e9'), band: '#0c4a6e', bandText: '#ffffff' }, swatch: ['#0c4a6e', '#0ea5e9'] },

  // ---- Band: full-color banner, zebra table
  { id: 'band-teal', name: 'Banner Teal', blurb: 'Color banner, zebra rows', layout: 'band', theme: { ...base('#0d9488'), band: '#0d9488', bandText: '#ffffff' }, swatch: ['#0d9488', '#ffffff'] },
  { id: 'band-royal', name: 'Banner Royal', blurb: 'Indigo banner', layout: 'band', theme: { ...base('#4f46e5'), band: '#4f46e5', bandText: '#ffffff' }, swatch: ['#4f46e5', '#ffffff'] },
  { id: 'band-ember', name: 'Banner Ember', blurb: 'Warm orange banner', layout: 'band', theme: { ...base('#ea580c'), band: '#ea580c', bandText: '#ffffff' }, swatch: ['#ea580c', '#ffffff'] },
  { id: 'band-rose', name: 'Banner Rose', blurb: 'Magenta banner', layout: 'band', theme: { ...base('#be185d'), band: '#be185d', bandText: '#ffffff' }, swatch: ['#be185d', '#ffffff'] },

  // ---- Ledger: ruled grid, businesslike
  { id: 'ledger-navy', name: 'Ledger Navy', blurb: 'Ruled grid, formal', layout: 'ledger', theme: base('#1e3a8a'), swatch: ['#1e3a8a', RULE] },
  { id: 'ledger-green', name: 'Ledger Green', blurb: 'Ruled grid, classic', layout: 'ledger', theme: base('#15803d'), swatch: ['#15803d', RULE] },
  { id: 'ledger-slate', name: 'Ledger Slate', blurb: 'Ruled grid, neutral', layout: 'ledger', theme: base('#334155'), swatch: ['#334155', RULE] },
];

export const FREE_TEMPLATE_ID: TemplateId = 'classic';

export interface TemplateOptions {
  template?: TemplateId;
  /** data:image/...;base64,... — embedded so the PDF is self-contained */
  logoDataUri?: string | null;
}

// ---------------------------------------------------------------- helpers

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const nl2br = (s: string): string => esc(s).replace(/\n/g, '<br/>');

const qty = (n: number): string => (n % 1 === 0 ? String(n) : n.toFixed(2));

interface Ctx {
  inv: Invoice;
  biz: BusinessProfile;
  t: Theme;
  headlineCents: number;
  docTitle: string;
  numberLabel: string;
  dueLabel: string;
  amountLabel: string;
  totalLabel: string;
  m: (c: number) => string;
  logo: string;
  contact: string;
  rowsHtml: (cellCss?: string) => string;
  totalsRows: string;
  payBlock: string;
  notesBlock: (labelClass: string) => string;
}

function makeCtx(inv: Invoice, biz: BusinessProfile, t: Theme, opts: TemplateOptions): Ctx {
  const est = inv.kind === 'estimate';
  const paid = paidCents(inv);
  const m = (c: number) => formatCents(c, inv.currencySymbol);
  const docTitle = est ? 'ESTIMATE' : 'INVOICE';
  const numberLabel = est ? 'Estimate #' : 'Invoice #';
  const dueLabel = est ? 'Valid until' : 'Due';
  const amountLabel = est ? 'ESTIMATED TOTAL' : paid > 0 ? 'BALANCE DUE' : 'AMOUNT DUE';
  const totalLabel = est ? 'Estimated Total' : 'Total Due';
  const headlineCents = paid > 0 ? balanceCents(inv) : totalCents(inv);
  const logo = opts.logoDataUri
    ? `<img class="logo" src="${opts.logoDataUri}" alt=""/>`
    : '';
  const contact = [biz.email, biz.phone].filter(Boolean).map(esc).join('&nbsp;&nbsp;·&nbsp;&nbsp;');
  const rowsHtml = (cellCss = '') =>
    inv.items
      .map(
        (l) => `
      <tr>
        <td style="${cellCss}">${esc(l.description)}</td>
        <td class="r" style="${cellCss}">${qty(l.quantity)}</td>
        <td class="r" style="${cellCss}">${m(l.unitPriceCents)}</td>
        <td class="r" style="${cellCss}">${m(lineAmountCents(l))}</td>
      </tr>`,
      )
      .join('');
  const totalsRows = `
    <div><span class="mut">Subtotal</span><span>${m(subtotalCents(inv))}</span></div>
    ${inv.discountCents > 0 ? `<div><span class="mut">Discount</span><span>-${m(inv.discountCents)}</span></div>` : ''}
    ${inv.taxRate > 0 ? `<div><span class="mut">Tax (${(inv.taxRate * 100).toFixed(1)}%)</span><span>${m(taxCents(inv))}</span></div>` : ''}
    ${
      paid > 0
        ? `<div><span class="mut">Total</span><span>${m(totalCents(inv))}</span></div>
           <div><span class="mut">Paid to date</span><span>-${m(paid)}</span></div>
           <div class="grand"><span>Balance Due</span><span>${m(balanceCents(inv))}</span></div>`
        : `<div class="grand"><span>${totalLabel}</span><span>${m(totalCents(inv))}</span></div>`
    }`;
  const payBlock = inv.paymentLink
    ? `<div class="pay"><b>Pay online:</b>&nbsp;<a href="${esc(inv.paymentLink)}">${esc(inv.paymentLink)}</a></div>`
    : '';
  const notesBlock = (labelClass: string) =>
    inv.notes
      ? `<div class="notes"><div class="${labelClass}">NOTES</div>
         <div class="mut" style="margin-top:6px">${nl2br(inv.notes)}</div></div>`
      : '';
  return {
    inv, biz, t, headlineCents, docTitle, numberLabel, dueLabel, amountLabel,
    totalLabel, m, logo, contact, rowsHtml, totalsRows, payBlock, notesBlock,
  };
}

const vars = (t: Theme) => `
  :root {
    --accent:${t.accent}; --ink:${t.ink}; --muted:${t.muted};
    --faint:${t.faint}; --rule:${t.rule};
    --band:${t.band ?? t.ink}; --bandText:${t.bandText ?? '#ffffff'};
  }`;

const SHARED_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .mut { color: var(--muted); }
  .r { text-align: right; }
  table { width: 100%; border-collapse: collapse; }
  .totals { width: 280px; margin-left: auto; margin-top: 20px; font-size: 12px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .logo { max-height: 56px; max-width: 180px; object-fit: contain; }
  .footer {
    position: fixed; bottom: 24px; left: 48px; right: 48px;
    display: flex; justify-content: space-between;
    font-size: 10px; color: var(--muted);
  }
`;

const footer = (c: Ctx) =>
  `<div class="footer"><span>${esc(c.biz.name)} — ${esc(c.inv.number)}</span></div>`;

const doc = (t: Theme, css: string, body: string) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${vars(t)}${SHARED_CSS}${css}</style></head><body>${body}</body></html>`;

// ---------------------------------------------------------------- classic

function classic(c: Ctx): string {
  const css = `
  body { font-family:-apple-system,Helvetica,Arial,sans-serif; color:var(--ink); padding:44px 48px; font-size:13px; }
  .header { display:flex; justify-content:space-between; }
  .biz-name { font-size:26px; font-weight:700; }
  .small { color:var(--muted); font-size:12px; line-height:1.5; }
  .badge { font-size:34px; font-weight:700; color:var(--accent); letter-spacing:3px; text-align:right; }
  .meta { font-size:12px; text-align:right; margin-top:8px; }
  .label { font-size:10px; letter-spacing:1.5px; color:var(--muted); font-weight:700; }
  .panel { background:var(--faint); border-radius:8px; padding:20px; display:flex; justify-content:space-between; margin-top:40px; }
  .client-name { font-weight:700; font-size:14px; margin:8px 0 4px; }
  .due { font-size:26px; font-weight:700; color:var(--accent); margin-top:6px; text-align:right; }
  table { margin-top:36px; }
  th { text-align:left; font-size:11px; padding:8px 6px; border-bottom:2px solid var(--accent); }
  td { padding:10px 6px; border-bottom:1px solid var(--rule); font-size:13px; }
  .grand { border-top:1px solid var(--rule); margin-top:6px; padding-top:10px; font-weight:700; font-size:15px; }
  .grand span:last-child { color:var(--accent); font-size:17px; }
  .pay { border:1px solid var(--accent); border-radius:8px; padding:14px 16px; margin-top:36px; font-size:13px; }
  .pay a { color:var(--accent); }
  .notes { margin-top:24px; }`;
  const body = `
  <div class="header">
    <div>
      ${c.logo}${c.logo ? '<div style="height:10px"></div>' : ''}
      <div class="biz-name">${esc(c.biz.name)}</div>
      <div class="small" style="margin-top:6px">${nl2br(c.biz.address)}${c.biz.address ? '<br/>' : ''}${c.contact}</div>
    </div>
    <div>
      <div class="badge">${c.docTitle}</div>
      <div class="meta mut">
        ${c.numberLabel}&nbsp; <b style="color:var(--ink)">${esc(c.inv.number)}</b><br/>
        Issued&nbsp; <b style="color:var(--ink)">${formatDate(c.inv.issueDateMs)}</b><br/>
        ${c.dueLabel}&nbsp; <b style="color:var(--ink)">${formatDate(c.inv.dueDateMs)}</b>
      </div>
    </div>
  </div>
  <div class="panel">
    <div>
      <div class="label">BILL TO</div>
      <div class="client-name">${esc(c.inv.clientName)}</div>
      <div class="small">${nl2br(c.inv.clientAddress)}${c.inv.clientAddress ? '<br/>' : ''}${esc(c.inv.clientEmail)}</div>
    </div>
    <div>
      <div class="label" style="text-align:right">${c.amountLabel}</div>
      <div class="due">${c.m(c.headlineCents)}</div>
    </div>
  </div>
  <table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
  <tbody>${c.rowsHtml()}</tbody></table>
  <div class="totals">${c.totalsRows}</div>
  ${c.payBlock}
  ${c.notesBlock('label')}
  ${footer(c)}`;
  return doc(c.t, css, body);
}

// ---------------------------------------------------------------- minimal

function minimal(c: Ctx): string {
  const css = `
  body { font-family:-apple-system,Helvetica,Arial,sans-serif; color:var(--ink); padding:52px 56px; font-size:12.5px; }
  .top { display:flex; justify-content:space-between; align-items:flex-start;
         border-bottom:1px solid var(--accent); padding-bottom:18px; }
  .biz-name { font-size:17px; font-weight:700; letter-spacing:0.3px; }
  .small { color:var(--muted); font-size:11px; line-height:1.6; }
  .title { font-size:13px; letter-spacing:5px; font-weight:400; text-align:right; color:var(--accent); }
  .meta { font-size:11px; text-align:right; margin-top:10px; color:var(--muted); line-height:1.8; }
  .meta b { color:var(--ink); font-weight:600; }
  .parties { display:flex; justify-content:space-between; margin-top:32px; }
  .lbl { font-size:9px; letter-spacing:2px; color:var(--muted); }
  .client-name { font-size:13px; font-weight:600; margin-top:6px; }
  .amount { font-size:22px; font-weight:600; margin-top:6px; text-align:right; color:var(--accent); }
  table { margin-top:36px; }
  th { text-align:left; font-size:9px; letter-spacing:1.5px; color:var(--muted);
       font-weight:600; padding:0 6px 8px; border-bottom:1px solid var(--accent); }
  td { padding:11px 6px; border-bottom:1px solid var(--rule); }
  .grand { border-top:1px solid var(--accent); margin-top:8px; padding-top:10px; font-weight:700; font-size:14px; }
  .pay { margin-top:36px; font-size:12px; border-top:1px solid var(--rule); padding-top:14px; }
  .pay a { color:var(--accent); }
  .notes { margin-top:20px; }`;
  const body = `
  <div class="top">
    <div>
      ${c.logo}${c.logo ? '<div style="height:8px"></div>' : ''}
      <div class="biz-name">${esc(c.biz.name)}</div>
      <div class="small" style="margin-top:4px">${nl2br(c.biz.address)}${c.biz.address ? '<br/>' : ''}${c.contact}</div>
    </div>
    <div>
      <div class="title">${c.docTitle.split('').join(' ')}</div>
      <div class="meta">
        № <b>${esc(c.inv.number)}</b><br/>
        Issued <b>${formatDate(c.inv.issueDateMs)}</b><br/>
        ${c.dueLabel} <b>${formatDate(c.inv.dueDateMs)}</b>
      </div>
    </div>
  </div>
  <div class="parties">
    <div>
      <div class="lbl">BILLED TO</div>
      <div class="client-name">${esc(c.inv.clientName)}</div>
      <div class="small">${nl2br(c.inv.clientAddress)}${c.inv.clientAddress ? '<br/>' : ''}${esc(c.inv.clientEmail)}</div>
    </div>
    <div>
      <div class="lbl" style="text-align:right">${c.amountLabel}</div>
      <div class="amount">${c.m(c.headlineCents)}</div>
    </div>
  </div>
  <table><thead><tr><th>DESCRIPTION</th><th class="r">QTY</th><th class="r">RATE</th><th class="r">AMOUNT</th></tr></thead>
  <tbody>${c.rowsHtml()}</tbody></table>
  <div class="totals">${c.totalsRows}</div>
  ${c.payBlock}
  ${c.notesBlock('lbl')}
  ${footer(c)}`;
  return doc(c.t, css, body);
}

// ------------------------------------------------------------------ bold

function bold(c: Ctx): string {
  const css = `
  body { font-family:-apple-system,Helvetica,Arial,sans-serif; color:var(--ink); font-size:13px; }
  .bandTop { background:var(--band); color:var(--bandText); padding:36px 48px 30px; display:flex; justify-content:space-between; align-items:flex-start; }
  .biz-name { font-size:22px; font-weight:700; }
  .bandTop .small { color:rgba(255,255,255,0.65); font-size:11px; line-height:1.6; }
  .badge { font-size:30px; font-weight:800; letter-spacing:3px; text-align:right; color:var(--accent); }
  .bandTop .meta { font-size:11px; text-align:right; margin-top:8px; color:rgba(255,255,255,0.65); line-height:1.8; }
  .bandTop .meta b { color:var(--bandText); }
  .inner { padding:30px 48px 44px; }
  .parties { display:flex; justify-content:space-between; align-items:flex-start; }
  .label { font-size:10px; letter-spacing:1.5px; color:var(--muted); font-weight:700; }
  .client-name { font-weight:700; font-size:14px; margin:8px 0 4px; }
  .small { color:var(--muted); font-size:12px; line-height:1.5; }
  .dueBox { background:var(--accent); color:#fff; border-radius:10px; padding:14px 20px; text-align:right; }
  .dueBox .label { color:rgba(255,255,255,0.75); }
  .due { font-size:24px; font-weight:800; margin-top:4px; }
  table { margin-top:32px; }
  th { text-align:left; font-size:11px; padding:10px 8px; background:var(--faint); }
  th:first-child { border-radius:6px 0 0 6px; }
  th:last-child { border-radius:0 6px 6px 0; }
  td { padding:11px 8px; border-bottom:1px solid var(--rule); }
  .grand { border-top:2px solid var(--ink); margin-top:6px; padding-top:10px; font-weight:800; font-size:15px; }
  .grand span:last-child { color:var(--accent); font-size:17px; }
  .pay { background:var(--faint); border-radius:10px; padding:14px 16px; margin-top:32px; font-size:13px; }
  .pay a { color:var(--accent); font-weight:600; }
  .notes { margin-top:22px; }
  .footer { left:48px; right:48px; }`;
  const body = `
  <div class="bandTop">
    <div>
      ${c.logo}${c.logo ? '<div style="height:10px"></div>' : ''}
      <div class="biz-name">${esc(c.biz.name)}</div>
      <div class="small" style="margin-top:5px">${nl2br(c.biz.address)}${c.biz.address ? '<br/>' : ''}${c.contact}</div>
    </div>
    <div>
      <div class="badge">${c.docTitle}</div>
      <div class="meta">
        ${c.numberLabel} <b>${esc(c.inv.number)}</b><br/>
        Issued <b>${formatDate(c.inv.issueDateMs)}</b> · ${c.dueLabel} <b>${formatDate(c.inv.dueDateMs)}</b>
      </div>
    </div>
  </div>
  <div class="inner">
    <div class="parties">
      <div>
        <div class="label">BILL TO</div>
        <div class="client-name">${esc(c.inv.clientName)}</div>
        <div class="small">${nl2br(c.inv.clientAddress)}${c.inv.clientAddress ? '<br/>' : ''}${esc(c.inv.clientEmail)}</div>
      </div>
      <div class="dueBox">
        <div class="label">${c.amountLabel}</div>
        <div class="due">${c.m(c.headlineCents)}</div>
      </div>
    </div>
    <table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
    <tbody>${c.rowsHtml()}</tbody></table>
    <div class="totals">${c.totalsRows}</div>
    ${c.payBlock}
    ${c.notesBlock('label')}
  </div>
  ${footer(c)}`;
  return doc(c.t, css, body);
}

// ------------------------------------------------------------------ band

function band(c: Ctx): string {
  const css = `
  body { font-family:-apple-system,Helvetica,Arial,sans-serif; color:var(--ink); font-size:13px; }
  .banner { background:var(--band); color:var(--bandText); padding:30px 48px; display:flex; justify-content:space-between; align-items:center; }
  .badge { font-size:34px; font-weight:800; letter-spacing:2px; }
  .banner .meta { font-size:11.5px; text-align:right; line-height:1.8; color:rgba(255,255,255,0.8); }
  .banner .meta b { color:var(--bandText); }
  .inner { padding:28px 48px 44px; }
  .who { display:flex; justify-content:space-between; }
  .label { font-size:10px; letter-spacing:1.5px; color:var(--muted); font-weight:700; }
  .biz-name { font-size:16px; font-weight:700; margin-top:6px; }
  .client-name { font-size:14px; font-weight:700; margin-top:6px; }
  .small { color:var(--muted); font-size:11.5px; line-height:1.6; }
  .amountStrip { margin-top:26px; background:var(--faint); border-left:4px solid var(--accent);
    padding:12px 16px; display:flex; justify-content:space-between; align-items:center; }
  .amountStrip .big { font-size:22px; font-weight:800; color:var(--accent); }
  table { margin-top:26px; }
  th { text-align:left; font-size:11px; padding:9px 8px; background:var(--band); color:var(--bandText); }
  td { padding:10px 8px; }
  tbody tr:nth-child(even) td { background:var(--faint); }
  .grand { border-top:2px solid var(--accent); margin-top:6px; padding-top:10px; font-weight:800; font-size:15px; }
  .grand span:last-child { color:var(--accent); font-size:17px; }
  .pay { margin-top:30px; font-size:13px; }
  .pay a { color:var(--accent); font-weight:600; }
  .notes { margin-top:20px; }
  .thanks { position:fixed; bottom:0; left:0; right:0; background:var(--band); color:var(--bandText);
    text-align:center; font-size:11px; padding:10px; }
  .footer { bottom:44px; }`;
  const body = `
  <div class="banner">
    <div>
      ${c.logo}${c.logo ? '<div style="height:8px"></div>' : ''}
      <div class="badge">${c.docTitle}</div>
    </div>
    <div class="meta">
      ${c.numberLabel} <b>${esc(c.inv.number)}</b><br/>
      Issued <b>${formatDate(c.inv.issueDateMs)}</b><br/>
      ${c.dueLabel} <b>${formatDate(c.inv.dueDateMs)}</b>
    </div>
  </div>
  <div class="inner">
    <div class="who">
      <div>
        <div class="label">FROM</div>
        <div class="biz-name">${esc(c.biz.name)}</div>
        <div class="small">${nl2br(c.biz.address)}${c.biz.address ? '<br/>' : ''}${c.contact}</div>
      </div>
      <div style="text-align:right">
        <div class="label">BILL TO</div>
        <div class="client-name">${esc(c.inv.clientName)}</div>
        <div class="small">${nl2br(c.inv.clientAddress)}${c.inv.clientAddress ? '<br/>' : ''}${esc(c.inv.clientEmail)}</div>
      </div>
    </div>
    <div class="amountStrip">
      <span class="label">${c.amountLabel}</span>
      <span class="big">${c.m(c.headlineCents)}</span>
    </div>
    <table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
    <tbody>${c.rowsHtml()}</tbody></table>
    <div class="totals">${c.totalsRows}</div>
    ${c.payBlock}
    ${c.notesBlock('label')}
  </div>
  ${footer(c)}
  <div class="thanks">Thank you for your business</div>`;
  return doc(c.t, css, body);
}

// ---------------------------------------------------------------- ledger

function ledger(c: Ctx): string {
  const cell = 'border:1px solid var(--rule);';
  const css = `
  body { font-family:-apple-system,Helvetica,Arial,sans-serif; color:var(--ink); padding:44px 48px; font-size:12.5px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start;
    border-bottom:3px solid var(--accent); padding-bottom:16px; }
  .biz-name { font-size:20px; font-weight:700; }
  .small { color:var(--muted); font-size:11px; line-height:1.6; }
  .badge { font-size:26px; font-weight:800; letter-spacing:2px; color:var(--accent); text-align:right; }
  .metaGrid { margin-top:18px; display:flex; gap:0; }
  .metaCell { border:1px solid var(--rule); padding:8px 12px; flex:1; }
  .metaCell + .metaCell { border-left:none; }
  .label { font-size:9px; letter-spacing:1.5px; color:var(--muted); font-weight:700; }
  .metaVal { font-size:12.5px; font-weight:700; margin-top:3px; }
  .who { display:flex; margin-top:18px; }
  .whoBox { border:1px solid var(--rule); padding:12px 14px; flex:1; }
  .whoBox + .whoBox { border-left:none; }
  .client-name { font-size:13px; font-weight:700; margin-top:5px; }
  table { margin-top:22px; }
  th { text-align:left; font-size:10.5px; letter-spacing:0.5px; padding:9px 8px;
    background:var(--accent); color:#fff; border:1px solid var(--accent); }
  td { padding:9px 8px; }
  .totals { border:1px solid var(--rule); padding:10px 14px; }
  .grand { border-top:2px solid var(--accent); margin-top:6px; padding-top:9px; font-weight:800; font-size:14px; }
  .grand span:last-child { color:var(--accent); font-size:16px; }
  .pay { margin-top:26px; font-size:12px; border:1px solid var(--rule); padding:12px 14px; }
  .pay a { color:var(--accent); font-weight:600; }
  .notes { margin-top:18px; }`;
  const body = `
  <div class="header">
    <div>
      ${c.logo}${c.logo ? '<div style="height:8px"></div>' : ''}
      <div class="biz-name">${esc(c.biz.name)}</div>
      <div class="small" style="margin-top:4px">${nl2br(c.biz.address)}${c.biz.address ? '<br/>' : ''}${c.contact}</div>
    </div>
    <div class="badge">${c.docTitle}</div>
  </div>
  <div class="metaGrid">
    <div class="metaCell"><div class="label">${c.numberLabel.replace(' #', ' NO.')}</div><div class="metaVal">${esc(c.inv.number)}</div></div>
    <div class="metaCell"><div class="label">ISSUED</div><div class="metaVal">${formatDate(c.inv.issueDateMs)}</div></div>
    <div class="metaCell"><div class="label">${c.dueLabel.toUpperCase()}</div><div class="metaVal">${formatDate(c.inv.dueDateMs)}</div></div>
    <div class="metaCell"><div class="label">${c.amountLabel}</div><div class="metaVal" style="color:var(--accent)">${c.m(c.headlineCents)}</div></div>
  </div>
  <div class="who">
    <div class="whoBox">
      <div class="label">BILL TO</div>
      <div class="client-name">${esc(c.inv.clientName)}</div>
      <div class="small">${nl2br(c.inv.clientAddress)}${c.inv.clientAddress ? '<br/>' : ''}${esc(c.inv.clientEmail)}</div>
    </div>
  </div>
  <table><thead><tr><th>DESCRIPTION</th><th class="r">QTY</th><th class="r">RATE</th><th class="r">AMOUNT</th></tr></thead>
  <tbody>${c.rowsHtml(cell)}</tbody></table>
  <div class="totals">${c.totalsRows}</div>
  ${c.payBlock}
  ${c.notesBlock('label')}
  ${footer(c)}`;
  return doc(c.t, css, body);
}

// ------------------------------------------------------------------ api

const LAYOUTS: Record<LayoutId, (c: Ctx) => string> = {
  classic,
  minimal,
  bold,
  band,
  ledger,
};

export function invoiceHtml(
  inv: Invoice,
  biz: BusinessProfile,
  opts: TemplateOptions = {},
): string {
  const def =
    TEMPLATES.find((d) => d.id === (opts.template ?? FREE_TEMPLATE_ID)) ??
    TEMPLATES[0];
  return LAYOUTS[def.layout](makeCtx(inv, biz, def.theme, opts));
}
