// src/proAccess.ts
// Single place that answers "may this user use Pro features right now".
// FAIL-OPEN: if the purchase stack is broken or absent, the answer is yes.
// A broken coin slot must never punish the customer.

import { invoicesCreatedInMonth } from './db';
import { isOperational } from './purchases';
import { isPro } from './services';

export const FREE_INVOICES_PER_MONTH = 3;

export async function hasProAccess(): Promise<boolean> {
  if (await isPro()) return true;
  return !(await isOperational()); // store broken/absent -> unlocked
}

export async function canCreateInvoice(): Promise<boolean> {
  if (await hasProAccess()) return true;
  const used = await invoicesCreatedInMonth(new Date());
  return used < FREE_INVOICES_PER_MONTH;
}
