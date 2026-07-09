// src/backup.ts
// Native side of backup/restore. Pure format logic lives in backupFormat.ts.

import * as Sharing from 'expo-sharing';
import {
  Backup,
  BackupSettings,
  buildBackup,
  parseBackup,
} from './backupFormat';
import * as db from './db';
import {
  getBusinessProfile,
  getCurrencySymbol,
  getDefaultPaymentLink,
  getDefaultTaxRate,
  getInvoiceNumbering,
  getLogoUri,
  getTemplate,
  isPro,
  saveBusinessProfile,
  setCurrencySymbol,
  setDefaultPaymentLink,
  setDefaultTaxRate,
  setInvoiceNumbering,
  setLogoUri,
  setPro,
  setTemplate,
} from './services';

async function collectSettings(): Promise<BackupSettings> {
  const FileSystem = await import('expo-file-system/legacy');
  const biz = await getBusinessProfile();
  const numbering = await getInvoiceNumbering();
  const logoUri = await getLogoUri();
  let logoBase64: string | null = null;
  let logoExt: 'png' | 'jpg' | null = null;
  if (logoUri) {
    try {
      logoBase64 = await FileSystem.readAsStringAsync(logoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      logoExt = logoUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
    } catch {
      logoBase64 = null;
    }
  }
  return {
    bizName: biz.name,
    bizAddress: biz.address,
    bizEmail: biz.email,
    bizPhone: biz.phone,
    invoicePrefix: numbering.prefix,
    nextNumber: numbering.next,
    defaultTaxRate: await getDefaultTaxRate(),
    defaultPaymentLink: await getDefaultPaymentLink(),
    currencySymbol: await getCurrencySymbol(),
    template: await getTemplate(),
    isPro: await isPro(),
    logoBase64,
    logoExt,
  };
}

/** Serialize everything and open the share sheet with a .json backup file. */
export async function exportBackup(): Promise<void> {
  const FileSystem = await import('expo-file-system/legacy');
  const backup = buildBackup(
    await collectSettings(),
    await db.listClients(),
    await db.listItems(),
    await db.listInvoices(),
  );
  const stamp = new Date().toISOString().slice(0, 10);
  const path = `${FileSystem.cacheDirectory}invoicer-backup-${stamp}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(backup, null, 1));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/json',
      dialogTitle: 'Save your Invoicer backup',
    });
  }
}

export type RestoreResult =
  | { ok: true; counts: { clients: number; items: number; invoices: number } }
  | { ok: false; error: string }
  | { ok: false; cancelled: true };

/** Let the user pick a backup file and REPLACE all current data with it. */
export async function restoreBackup(): Promise<RestoreResult> {
  const DocumentPicker = await import('expo-document-picker');
  const FileSystem = await import('expo-file-system/legacy');

  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (picked.canceled || picked.assets.length === 0) {
    return { ok: false, cancelled: true };
  }

  const json = await FileSystem.readAsStringAsync(picked.assets[0].uri);
  const parsed = parseBackup(json);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const b: Backup = parsed.backup;

  // Wipe, then restore. Order matters for foreign keys.
  await db.wipeAll();
  for (const c of b.clients) {
    await db.upsertClient({ ...c, id: undefined });
  }
  for (const i of b.items) {
    await db.upsertItem({ ...i, id: undefined });
  }
  for (const inv of b.invoices) {
    await db.insertInvoice({
      ...inv,
      kind: inv.kind ?? 'invoice', // backups from before estimates existed
      payments: inv.payments ?? [],
      id: undefined,
      notificationId: null,
    });
  }

  // Settings
  const s = b.settings;
  await saveBusinessProfile({
    name: s.bizName,
    address: s.bizAddress,
    email: s.bizEmail,
    phone: s.bizPhone,
  });
  await setInvoiceNumbering(s.invoicePrefix, s.nextNumber);
  await setDefaultTaxRate(s.defaultTaxRate);
  await setDefaultPaymentLink(s.defaultPaymentLink);
  await setCurrencySymbol(s.currencySymbol);
  await setTemplate(s.template);
  await setPro(s.isPro);

  if (s.logoBase64 && s.logoExt) {
    const dest = `${FileSystem.documentDirectory}logo.${s.logoExt}`;
    await FileSystem.writeAsStringAsync(dest, s.logoBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await setLogoUri(dest);
  } else {
    await setLogoUri(null);
  }

  return {
    ok: true,
    counts: {
      clients: b.clients.length,
      items: b.items.length,
      invoices: b.invoices.length,
    },
  };
}
