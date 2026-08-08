// src/review.ts
// One polite App Store review ask, at the earned-value moment — an invoice
// marked PAID — and only from the second paid invoice onward (the first paid
// invoice might be a test run; the second means the app is really working).
// Asks at most once ever (AsyncStorage flag; Apple further rate-limits on
// their side). Fail-open: if the native module is missing or throws, nothing
// happens.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from './db';

const ASKED_KEY = 'review_asked';

function getStoreReview(): any | null {
  // Do NOT rely on try/catch around require() for fail-open here: when a
  // module's factory throws (native half missing from the binary), Metro's
  // guardedLoadModule reports it as a FATAL error itself — the exception
  // never reaches this catch, and a release build aborts. Check the native
  // registry BEFORE requiring so the factory can't throw.
  const native = (globalThis as any).expo?.modules?.ExpoStoreReview;
  if (!native) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load on purpose: a static import would run the module factory at startup, before the guard above
    const mod = require('expo-store-review');
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

/** Request a review if at least two invoices are paid and we have never
 *  asked before. Call AFTER the paid status persists; safe to call often. */
export async function maybeAskForReview(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(ASKED_KEY)) return;
    const db = await getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM invoices WHERE kind = 'invoice' AND status = 'paid'",
    );
    if ((row?.n ?? 0) < 2) return;
    const SR = getStoreReview();
    if (!SR) return;
    await AsyncStorage.setItem(ASKED_KEY, String(Date.now()));
    // isAvailableAsync + requestReview both resolve quietly; the OS decides
    // whether anything is actually shown.
    const ok = await SR.isAvailableAsync?.();
    if (ok) await SR.requestReview?.();
  } catch {
    /* fail open */
  }
}
