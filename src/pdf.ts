// src/pdf.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { BusinessProfile, Invoice } from './models';
import { invoiceHtml, TemplateId, TemplateOptions } from './invoiceHtml';
import { getLogoUri, getTemplate } from './services';

async function templateOptions(): Promise<TemplateOptions> {
  const template = (await getTemplate()) as TemplateId;
  const logoUri = await getLogoUri();
  let logoDataUri: string | null = null;
  if (logoUri) {
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const b64 = await FileSystem.readAsStringAsync(logoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const ext = logoUri.split('.').pop()?.toLowerCase();
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      logoDataUri = `data:${mime};base64,${b64}`;
    } catch {
      logoDataUri = null; // logo file missing — render without it
    }
  }
  return { template, logoDataUri };
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
