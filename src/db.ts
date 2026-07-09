// src/db.ts
import * as SQLite from 'expo-sqlite';
import { CatalogItem, Client, Invoice, InvoiceStatus, LineItem, Payment } from './models';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  const db = await SQLite.openDatabaseAsync('invoicer.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS clients(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS catalog_items(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      unit_price_cents INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invoices(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL DEFAULT 'invoice',
      number TEXT NOT NULL,
      issue_date_ms INTEGER NOT NULL,
      due_date_ms INTEGER NOT NULL,
      client_name TEXT NOT NULL,
      client_address TEXT NOT NULL DEFAULT '',
      client_email TEXT NOT NULL DEFAULT '',
      tax_rate REAL NOT NULL DEFAULT 0,
      discount_cents INTEGER NOT NULL DEFAULT 0,
      currency_symbol TEXT NOT NULL DEFAULT '$',
      payment_link TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      notification_id TEXT
    );
    CREATE TABLE IF NOT EXISTS payments(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      paid_at_ms INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS invoice_lines(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price_cents INTEGER NOT NULL
    );
  `);
  // Migration: v1 tables predate the kind column.
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const v = row?.user_version ?? 0;
  if (v < 2) {
    try {
      await db.execAsync("ALTER TABLE invoices ADD COLUMN kind TEXT NOT NULL DEFAULT 'invoice'");
    } catch {
      // column already exists (fresh install created it) — fine
    }
    await db.execAsync('PRAGMA user_version = 2');
  }
  if (v < 3) {
    await db.execAsync(`CREATE TABLE IF NOT EXISTS payments(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      paid_at_ms INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    )`);
    await db.execAsync('PRAGMA user_version = 3');
  }
  if (v < 4) {
    // Invoices marked paid before payment tracking existed get one synthetic
    // payment for the full total, dated at their due date (best available
    // approximation) so year summaries include them.
    await db.execAsync(`
      INSERT INTO payments (invoice_id, amount_cents, paid_at_ms, note)
      SELECT
        i.id,
        (SELECT COALESCE(SUM(CAST(ROUND(l.quantity * l.unit_price_cents) AS INTEGER)), 0)
           FROM invoice_lines l WHERE l.invoice_id = i.id)
          - i.discount_cents
          + CAST(ROUND((
              (SELECT COALESCE(SUM(CAST(ROUND(l2.quantity * l2.unit_price_cents) AS INTEGER)), 0)
                 FROM invoice_lines l2 WHERE l2.invoice_id = i.id)
              - i.discount_cents) * i.tax_rate) AS INTEGER),
        i.due_date_ms,
        'Recorded before payment tracking'
      FROM invoices i
      WHERE i.status = 'paid' AND i.kind = 'invoice'
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = i.id)
    `);
    await db.execAsync('PRAGMA user_version = 4');
  }
  _db = db;
  return db;
}

// ---- row mappers ----

interface ClientRow {
  id: number;
  name: string;
  address: string;
  email: string;
}
interface ItemRow {
  id: number;
  description: string;
  unit_price_cents: number;
}
interface LineRow {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price_cents: number;
}
interface InvoiceRow {
  id: number;
  kind: 'invoice' | 'estimate';
  number: string;
  issue_date_ms: number;
  due_date_ms: number;
  client_name: string;
  client_address: string;
  client_email: string;
  tax_rate: number;
  discount_cents: number;
  currency_symbol: string;
  payment_link: string;
  notes: string;
  status: InvoiceStatus;
  notification_id: string | null;
}

interface PaymentRow {
  id: number;
  invoice_id: number;
  amount_cents: number;
  paid_at_ms: number;
  note: string;
}

const toInvoice = (r: InvoiceRow, items: LineItem[], payments: Payment[]): Invoice => ({
  id: r.id,
  kind: r.kind ?? 'invoice',
  number: r.number,
  issueDateMs: r.issue_date_ms,
  dueDateMs: r.due_date_ms,
  clientName: r.client_name,
  clientAddress: r.client_address,
  clientEmail: r.client_email,
  taxRate: r.tax_rate,
  discountCents: r.discount_cents,
  currencySymbol: r.currency_symbol,
  paymentLink: r.payment_link,
  notes: r.notes,
  status: r.status,
  notificationId: r.notification_id,
  items,
  payments,
});

// ---- clients ----

export async function listClients(): Promise<Client[]> {
  const db = await getDb();
  return db.getAllAsync<ClientRow>(
    'SELECT * FROM clients ORDER BY name COLLATE NOCASE',
  );
}

export async function upsertClient(c: Client): Promise<number> {
  const db = await getDb();
  if (c.id == null) {
    const res = await db.runAsync(
      'INSERT INTO clients (name, address, email) VALUES (?, ?, ?)',
      c.name,
      c.address,
      c.email,
    );
    return res.lastInsertRowId;
  }
  await db.runAsync(
    'UPDATE clients SET name = ?, address = ?, email = ? WHERE id = ?',
    c.name,
    c.address,
    c.email,
    c.id,
  );
  return c.id;
}

export async function deleteClient(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM clients WHERE id = ?', id);
}

// ---- catalog items ----

export async function listItems(): Promise<CatalogItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ItemRow>(
    'SELECT * FROM catalog_items ORDER BY description COLLATE NOCASE',
  );
  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    unitPriceCents: r.unit_price_cents,
  }));
}

export async function upsertItem(i: CatalogItem): Promise<number> {
  const db = await getDb();
  if (i.id == null) {
    const res = await db.runAsync(
      'INSERT INTO catalog_items (description, unit_price_cents) VALUES (?, ?)',
      i.description,
      i.unitPriceCents,
    );
    return res.lastInsertRowId;
  }
  await db.runAsync(
    'UPDATE catalog_items SET description = ?, unit_price_cents = ? WHERE id = ?',
    i.description,
    i.unitPriceCents,
    i.id,
  );
  return i.id;
}

export async function deleteItem(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM catalog_items WHERE id = ?', id);
}

// ---- invoices ----

export async function insertInvoice(inv: Invoice): Promise<number> {
  const db = await getDb();
  let invoiceId = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `INSERT INTO invoices
        (kind, number, issue_date_ms, due_date_ms, client_name, client_address,
         client_email, tax_rate, discount_cents, currency_symbol,
         payment_link, notes, status, notification_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      inv.kind,
      inv.number,
      inv.issueDateMs,
      inv.dueDateMs,
      inv.clientName,
      inv.clientAddress,
      inv.clientEmail,
      inv.taxRate,
      inv.discountCents,
      inv.currencySymbol,
      inv.paymentLink,
      inv.notes,
      inv.status,
      inv.notificationId,
    );
    invoiceId = res.lastInsertRowId;
    for (const p of inv.payments) {
      await db.runAsync(
        `INSERT INTO payments (invoice_id, amount_cents, paid_at_ms, note)
         VALUES (?, ?, ?, ?)`,
        invoiceId,
        p.amountCents,
        p.paidAtMs,
        p.note,
      );
    }
    for (const l of inv.items) {
      await db.runAsync(
        `INSERT INTO invoice_lines
          (invoice_id, description, quantity, unit_price_cents)
         VALUES (?, ?, ?, ?)`,
        invoiceId,
        l.description,
        l.quantity,
        l.unitPriceCents,
      );
    }
  });
  return invoiceId;
}

export async function listInvoices(kind?: 'invoice' | 'estimate'): Promise<Invoice[]> {
  const db = await getDb();
  const rows = kind
    ? await db.getAllAsync<InvoiceRow>(
        'SELECT * FROM invoices WHERE kind = ? ORDER BY issue_date_ms DESC',
        kind,
      )
    : await db.getAllAsync<InvoiceRow>(
        'SELECT * FROM invoices ORDER BY issue_date_ms DESC',
      );
  const lines = await db.getAllAsync<LineRow>('SELECT * FROM invoice_lines');
  const byInvoice = new Map<number, LineItem[]>();
  for (const l of lines) {
    const arr = byInvoice.get(l.invoice_id) ?? [];
    arr.push({
      id: l.id,
      invoiceId: l.invoice_id,
      description: l.description,
      quantity: l.quantity,
      unitPriceCents: l.unit_price_cents,
    });
    byInvoice.set(l.invoice_id, arr);
  }
  const pays = await db.getAllAsync<PaymentRow>(
    'SELECT * FROM payments ORDER BY paid_at_ms',
  );
  const paysByInvoice = new Map<number, Payment[]>();
  for (const p of pays) {
    const arr = paysByInvoice.get(p.invoice_id) ?? [];
    arr.push({
      id: p.id,
      invoiceId: p.invoice_id,
      amountCents: p.amount_cents,
      paidAtMs: p.paid_at_ms,
      note: p.note,
    });
    paysByInvoice.set(p.invoice_id, arr);
  }
  return rows.map((r) =>
    toInvoice(r, byInvoice.get(r.id) ?? [], paysByInvoice.get(r.id) ?? []),
  );
}

export async function setInvoiceStatus(
  id: number,
  status: InvoiceStatus,
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE invoices SET status = ? WHERE id = ?', status, id);
}

export async function setInvoiceNotificationId(
  id: number,
  notificationId: string | null,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE invoices SET notification_id = ? WHERE id = ?',
    notificationId,
    id,
  );
}

export async function deleteInvoice(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM invoices WHERE id = ?', id);
}

export async function invoicesCreatedInMonth(now: Date): Promise<number> {
  const db = await getDb();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM invoices WHERE kind = 'invoice' AND issue_date_ms >= ? AND issue_date_ms < ?",
    start,
    end,
  );
  return row?.n ?? 0;
}

export async function wipeAll(): Promise<void> {
  const db = await getDb();
  await db.execAsync(
    'DELETE FROM payments; DELETE FROM invoice_lines; DELETE FROM invoices; DELETE FROM clients; DELETE FROM catalog_items;',
  );
}

export async function updateInvoice(inv: Invoice): Promise<void> {
  if (inv.id == null) throw new Error('updateInvoice requires an id');
  const id = inv.id;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE invoices SET
        due_date_ms = ?, client_name = ?, client_address = ?, client_email = ?,
        tax_rate = ?, discount_cents = ?, currency_symbol = ?, payment_link = ?,
        notes = ?, notification_id = ?
       WHERE id = ?`,
      inv.dueDateMs,
      inv.clientName,
      inv.clientAddress,
      inv.clientEmail,
      inv.taxRate,
      inv.discountCents,
      inv.currencySymbol,
      inv.paymentLink,
      inv.notes,
      inv.notificationId,
      id,
    );
    await db.runAsync('DELETE FROM invoice_lines WHERE invoice_id = ?', id);
    for (const l of inv.items) {
      await db.runAsync(
        `INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price_cents)
         VALUES (?, ?, ?, ?)`,
        id,
        l.description,
        l.quantity,
        l.unitPriceCents,
      );
    }
  });
}

/** Record a payment; recompute and persist the invoice status.
 *  Returns the new storage status. */
export async function addPayment(
  invoiceId: number,
  amountCents: number,
  note: string,
  totalC: number,
  currentStatus: InvoiceStatus,
): Promise<InvoiceStatus> {
  const db = await getDb();
  let newStatus: InvoiceStatus = currentStatus;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO payments (invoice_id, amount_cents, paid_at_ms, note)
       VALUES (?, ?, ?, ?)`,
      invoiceId,
      amountCents,
      Date.now(),
      note,
    );
    const row = await db.getFirstAsync<{ s: number }>(
      'SELECT COALESCE(SUM(amount_cents), 0) AS s FROM payments WHERE invoice_id = ?',
      invoiceId,
    );
    const paid = row?.s ?? 0;
    newStatus = paid >= totalC && totalC > 0 ? 'paid' : currentStatus;
    await db.runAsync('UPDATE invoices SET status = ? WHERE id = ?', newStatus, invoiceId);
  });
  return newStatus;
}

/** Delete a payment; if the invoice was fully paid it drops back to 'sent'. */
export async function deletePayment(
  paymentId: number,
  invoiceId: number,
  totalC: number,
): Promise<InvoiceStatus> {
  const db = await getDb();
  let newStatus: InvoiceStatus = 'sent';
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM payments WHERE id = ?', paymentId);
    const row = await db.getFirstAsync<{ s: number }>(
      'SELECT COALESCE(SUM(amount_cents), 0) AS s FROM payments WHERE invoice_id = ?',
      invoiceId,
    );
    const paid = row?.s ?? 0;
    const cur = await db.getFirstAsync<{ status: InvoiceStatus }>(
      'SELECT status FROM invoices WHERE id = ?',
      invoiceId,
    );
    newStatus =
      paid >= totalC && totalC > 0
        ? 'paid'
        : cur?.status === 'paid'
          ? 'sent'
          : (cur?.status ?? 'sent');
    await db.runAsync('UPDATE invoices SET status = ? WHERE id = ?', newStatus, invoiceId);
  });
  return newStatus;
}
