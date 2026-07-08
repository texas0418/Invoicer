// src/invoiceHtml.ts
// Pure HTML template — no native imports, so it is testable in Node.
// The validated template design, ported to HTML/CSS. expo-print renders it
// through the platform WebView, so standard CSS applies.

import {
  BusinessProfile,
  formatCents,
  formatDate,
  Invoice,
  lineAmountCents,
  subtotalCents,
  taxCents,
  totalCents,
} from './models';

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const nl2br = (s: string): string => esc(s).replace(/\n/g, '<br/>');

export function invoiceHtml(inv: Invoice, biz: BusinessProfile): string {
  const m = (c: number) => formatCents(c, inv.currencySymbol);
  const rows = inv.items
    .map(
      (l) => `
      <tr>
        <td>${esc(l.description)}</td>
        <td class="r">${l.quantity % 1 === 0 ? l.quantity : l.quantity.toFixed(2)}</td>
        <td class="r">${m(l.unitPriceCents)}</td>
        <td class="r">${m(lineAmountCents(l))}</td>
      </tr>`,
    )
    .join('');

  const contact = [biz.email, biz.phone].filter(Boolean).join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  :root {
    --accent: #2563eb; --ink: #1a1a2e; --muted: #6b7280;
    --faint: #f3f4f6; --rule: #e5e7eb;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, Helvetica, Arial, sans-serif;
    color: var(--ink); padding: 44px 48px; font-size: 13px;
  }
  .header { display: flex; justify-content: space-between; }
  .biz-name { font-size: 26px; font-weight: 700; }
  .muted { color: var(--muted); font-size: 12px; line-height: 1.5; }
  .badge {
    font-size: 34px; font-weight: 700; color: var(--accent);
    letter-spacing: 3px; text-align: right;
  }
  .meta { font-size: 12px; text-align: right; margin-top: 8px; }
  .meta b { color: var(--ink); }
  .label {
    font-size: 10px; letter-spacing: 1.5px; color: var(--muted);
    font-weight: 700;
  }
  .panel {
    background: var(--faint); border-radius: 8px; padding: 20px;
    display: flex; justify-content: space-between; margin-top: 40px;
  }
  .client-name { font-weight: 700; font-size: 14px; margin: 8px 0 4px; }
  .due { font-size: 26px; font-weight: 700; color: var(--accent); margin-top: 6px; text-align: right; }
  table { width: 100%; border-collapse: collapse; margin-top: 36px; }
  th {
    text-align: left; font-size: 11px; padding: 8px 6px;
    border-bottom: 2px solid var(--accent);
  }
  td { padding: 10px 6px; border-bottom: 1px solid var(--rule); font-size: 13px; }
  .r { text-align: right; }
  .totals { width: 280px; margin-left: auto; margin-top: 20px; font-size: 12px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand {
    border-top: 1px solid var(--rule); margin-top: 6px; padding-top: 10px;
    font-weight: 700; font-size: 15px;
  }
  .totals .grand span:last-child { color: var(--accent); font-size: 17px; }
  .pay {
    border: 1px solid var(--accent); border-radius: 8px; padding: 14px 16px;
    margin-top: 36px; font-size: 13px;
  }
  .pay a { color: var(--accent); }
  .notes { margin-top: 24px; }
  .footer {
    position: fixed; bottom: 24px; left: 48px; right: 48px;
    display: flex; justify-content: space-between;
    font-size: 10px; color: var(--muted);
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="biz-name">${esc(biz.name)}</div>
      <div class="muted" style="margin-top:6px">
        ${nl2br(biz.address)}${biz.address ? '<br/>' : ''}${contact}
      </div>
    </div>
    <div>
      <div class="badge">INVOICE</div>
      <div class="meta muted">
        Invoice #&nbsp; <b>${esc(inv.number)}</b><br/>
        Issued&nbsp; <b>${formatDate(inv.issueDateMs)}</b><br/>
        Due&nbsp; <b>${formatDate(inv.dueDateMs)}</b>
      </div>
    </div>
  </div>

  <div class="panel">
    <div>
      <div class="label">BILL TO</div>
      <div class="client-name">${esc(inv.clientName)}</div>
      <div class="muted">
        ${nl2br(inv.clientAddress)}${inv.clientAddress ? '<br/>' : ''}${esc(inv.clientEmail)}
      </div>
    </div>
    <div>
      <div class="label" style="text-align:right">AMOUNT DUE</div>
      <div class="due">${m(totalCents(inv))}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span class="muted">Subtotal</span><span>${m(subtotalCents(inv))}</span></div>
    ${inv.discountCents > 0 ? `<div><span class="muted">Discount</span><span>-${m(inv.discountCents)}</span></div>` : ''}
    ${inv.taxRate > 0 ? `<div><span class="muted">Tax (${(inv.taxRate * 100).toFixed(1)}%)</span><span>${m(taxCents(inv))}</span></div>` : ''}
    <div class="grand"><span>Total Due</span><span>${m(totalCents(inv))}</span></div>
  </div>

  ${
    inv.paymentLink
      ? `<div class="pay"><b>Pay online:</b>&nbsp;
         <a href="${esc(inv.paymentLink)}">${esc(inv.paymentLink)}</a></div>`
      : ''
  }
  ${
    inv.notes
      ? `<div class="notes"><div class="label">NOTES</div>
         <div class="muted" style="margin-top:6px">${nl2br(inv.notes)}</div></div>`
      : ''
  }

  <div class="footer">
    <span>${esc(biz.name)} — Invoice ${esc(inv.number)}</span>
  </div>
</body>
</html>`;
}

