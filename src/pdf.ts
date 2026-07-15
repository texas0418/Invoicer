// src/pdf.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { BusinessProfile, Invoice } from './models';
import { invoiceHtml, TemplateId, TemplateOptions } from './invoiceHtml';
import { getBusinessProfile, getLogoUri, getTemplate } from './services';

/** Read the saved logo (if any) as an embeddable data URI. */
async function loadLogoDataUri(): Promise<string | null> {
  const logoUri = await getLogoUri();
  if (!logoUri) return null;
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const b64 = await FileSystem.readAsStringAsync(logoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const ext = logoUri.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${b64}`;
  } catch {
    return null; // logo file missing — render without it
  }
}

async function templateOptions(): Promise<TemplateOptions> {
  const template = (await getTemplate()) as TemplateId;
  return { template, logoDataUri: await loadLogoDataUri() };
}

/** Representative document used to preview a template in the picker. Fixed
 *  content so previews are stable and show tax, discount, and multiple lines. */
const SAMPLE_INVOICE: Invoice = {
  kind: 'invoice',
  number: 'INV-0042',
  issueDateMs: new Date(2026, 0, 12).getTime(),
  dueDateMs: new Date(2026, 0, 26).getTime(),
  clientName: 'Harbor & Vine Co.',
  clientAddress: '128 Maple Avenue\nPortland, OR 97204',
  clientEmail: 'accounts@harborandvine.com',
  taxRate: 0.0875,
  discountCents: 15000,
  currencySymbol: '$',
  paymentLink: 'https://pay.example.com/inv-0042',
  notes: 'Thank you for your business! Payment due within 14 days.',
  status: 'sent',
  notificationId: null,
  payments: [],
  items: [
    { description: 'Brand identity design', quantity: 1, unitPriceCents: 180000 },
    { description: 'Website design (5 pages)', quantity: 1, unitPriceCents: 240000 },
    { description: 'Revision rounds', quantity: 3, unitPriceCents: 12000 },
  ],
};

/** Open the native print/preview sheet showing a sample invoice rendered with
 *  the given template and the user's own business details + logo. Lets the
 *  user see any template — including locked Pro ones — before choosing. */
export async function previewTemplate(template: TemplateId): Promise<void> {
  const biz = await getBusinessProfile();
  await Print.printAsync({
    html: invoiceHtml(SAMPLE_INVOICE, biz, {
      template,
      logoDataUri: await loadLogoDataUri(),
    }),
  });
}

/** Open the system print/preview sheet for the rendered document. On iOS this
 *  presents a full PDF preview (scroll, pinch-zoom, print, and share) without
 *  leaving the app. Uses the same HTML the shared/emailed PDF is generated
 *  from, so what the user sees is exactly what they send. */
export async function previewPdf(inv: Invoice, biz: BusinessProfile): Promise<void> {
  await Print.printAsync({ html: invoiceHtml(inv, biz, await templateOptions()) });
}

/** Render the invoice to a PDF file and open the system share sheet. */
export async function sharePdf(inv: Invoice, biz: BusinessProfile): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: invoiceHtml(inv, biz, await templateOptions()) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `${inv.kind === 'estimate' ? 'Estimate' : 'Invoice'} ${inv.number}`,
    });
  }
}

/** Render to PDF and open a pre-filled email to the client with it attached.
 *  Returns false when no mail account is configured (common in the
 *  simulator) so the caller can fall back to the share sheet. */
export async function emailPdf(inv: Invoice, biz: BusinessProfile): Promise<boolean> {
  const MailComposer = await import('expo-mail-composer');
  if (!(await MailComposer.isAvailableAsync())) return false;
  const { uri } = await Print.printToFileAsync({ html: invoiceHtml(inv, biz, await templateOptions()) });
  await MailComposer.composeAsync({
    recipients: inv.clientEmail ? [inv.clientEmail] : [],
    subject: `${inv.kind === 'estimate' ? 'Estimate' : 'Invoice'} ${inv.number} from ${biz.name}`,
    body:
      `Hi,\n\nPlease find ${inv.kind === 'estimate' ? 'estimate' : 'invoice'} ${inv.number} attached.` +
      (inv.paymentLink ? `\n\nYou can pay online here: ${inv.paymentLink}` : '') +
      `\n\nThank you,\n${biz.name}`,
    attachments: [uri],
  });
  return true;
}
