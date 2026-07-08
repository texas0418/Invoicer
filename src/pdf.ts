// src/pdf.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { BusinessProfile, Invoice } from './models';
import { invoiceHtml } from './invoiceHtml';

/** Render the invoice to a PDF file and open the system share sheet. */
export async function sharePdf(inv: Invoice, biz: BusinessProfile): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: invoiceHtml(inv, biz) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Invoice ${inv.number}`,
    });
  }
}
