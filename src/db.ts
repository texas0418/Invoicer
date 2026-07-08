// src/db.ts
import * as SQLite from 'expo-sqlite';
import { CatalogItem, Client, Invoice, InvoiceStatus, LineItem } from './models';

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
    CREATE TABLE IF NOT EXISTS invoice_lines(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price_cents INTEGER NOT NULL
    );
  `);
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

const toInvoice = (r: InvoiceRow, items: LineItem[]): Invoice => ({
  id: r.id,
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
        (number, issue_date_ms, due_date_ms, client_name, client_address,
         client_email, tax_rate, discount_cents, currency_symbol,
         payment_link, notes, status, notification_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

export async function listInvoices(): Promise<Invoice[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<InvoiceRow>(
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
  return rows.map((r) => toInvoice(r, byInvoice.get(r.id) ?? []));
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
    'SELECT COUNT(*) AS n FROM invoices WHERE issue_date_ms >= ? AND issue_date_ms < ?',
    start,
    end,
  );
  return row?.n ?? 0;
}
