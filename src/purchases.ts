// src/purchases.ts
// RevenueCat integration. Design constraints:
// 1. Native module is ABSENT in Expo Go — everything degrades gracefully so
//    day-to-day development still works there (dev-only unlock behind __DEV__).
// 2. Local AsyncStorage `isPro` remains the source the UI reads synchronously;
//    RevenueCat is the source of *truth* and we mirror it on every
//    configure/purchase/restore.

import { Platform } from 'react-native';

import { setPro } from './services';

// PASTE YOUR KEY: RevenueCat dashboard → Project → API keys → Apple App Store.
// Starts with "appl_".
const REVENUECAT_IOS_API_KEY = 'appl_NtbPFeIlKuImVRgpYeQWFbkvrtu';
// Google Play public SDK key, RC project 96485d8e.
const REVENUECAT_ANDROID_API_KEY = 'goog_UFqiQCKAjlcAEpOnXPINgltMQkk';
const REVENUECAT_API_KEY =
  Platform.OS === 'android' ? REVENUECAT_ANDROID_API_KEY : REVENUECAT_IOS_API_KEY;

export const PRO_ENTITLEMENT_ID = 'Pro';

type PurchasesModule = typeof import('react-native-purchases').default;

let _purchases: PurchasesModule | null | undefined; // undefined = not tried yet

async function getPurchases(): Promise<PurchasesModule | null> {
  if (_purchases !== undefined) return _purchases;
  try {
    const mod = await import('react-native-purchases');
    _purchases = mod.default;
  } catch {
    _purchases = null; // Expo Go / native module missing
  }
  return _purchases;
}

/** Call once at app start. Safe to call in Expo Go (no-ops). */
export async function initPurchases(): Promise<void> {
  const Purchases = await getPurchases();
  if (!Purchases) return;
  try {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    // Heal the UI whenever RevenueCat reports an entitlement change — including
    // a purchase whose receipt only syncs seconds later on a slow network.
    Purchases.addCustomerInfoUpdateListener((info) => {
      const entitled = info.entitlements.active[PRO_ENTITLEMENT_ID] != null;
      void setPro(entitled);
      emitPro(entitled);
    });
    // Mirror the real entitlement into local settings on every launch, so a
    // reinstalled app (or one restored from backup with a stale flag) heals.
    const info = await Purchases.getCustomerInfo();
    await setPro(info.entitlements.active[PRO_ENTITLEMENT_ID] != null);
  } catch (e) {
    // Offline at launch: keep whatever the local flag says; RevenueCat's own
    // cache will reconcile on a later launch. But an *invalid API key* also
    // lands here and silently breaks every purchase — surface it in dev.
    if (__DEV__) console.warn('[purchases] configure/init failed:', e);
  }
}

export type PurchaseResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }
  | { ok: false; unavailable: true }
  // Payment succeeded but RevenueCat hasn't reported the entitlement yet
  // (slow/flaky network). The customer-info listener will flip Pro on shortly.
  | { ok: false; pending: true };

// ---- Pro-status subscription -------------------------------------------
// Screens subscribe so the UI flips to Pro the instant RevenueCat syncs the
// entitlement — even seconds after a purchase on a bad connection.
type ProListener = (entitled: boolean) => void;
const proListeners = new Set<ProListener>();

/** Subscribe to Pro-entitlement changes. Returns an unsubscribe function. */
export function subscribeProStatus(cb: ProListener): () => void {
  proListeners.add(cb);
  return () => {
    proListeners.delete(cb);
  };
}

function emitPro(entitled: boolean): void {
  for (const cb of proListeners) cb(entitled);
}

/** Buy the Pro one-time purchase (first package of the current offering). */
export async function purchasePro(): Promise<PurchaseResult> {
  const Purchases = await getPurchases();
  if (!Purchases) return { ok: false, unavailable: true };
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages[0];
    if (!pkg) {
      // No package to buy → the Apple sheet never opens ("nothing happens").
      // Causes: current offering not set in RevenueCat, no package attached,
      // products not yet fetchable from StoreKit (IAP not "Ready to Submit",
      // Paid Apps agreement unsigned, or still propagating), or a bad API key.
      if (__DEV__) {
        console.warn(
          '[purchases] no purchasable package. current offering:',
          offerings.current?.identifier ?? '(none)',
          '| all offerings:', Object.keys(offerings.all),
          '| current packages:', offerings.current?.availablePackages.length ?? 0,
        );
      }
      return {
        ok: false,
        error:
          'No purchase products are available yet. This usually means the App Store product or RevenueCat offering isn’t live yet.',
      };
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const entitled =
      customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] != null;
    if (entitled) {
      await setPro(true);
      return { ok: true };
    }
    // Payment went through but the entitlement hasn't landed yet (slow network).
    // Report pending — the customer-info listener flips Pro on when it syncs.
    return { ok: false, pending: true };
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err.userCancelled) return { ok: false, cancelled: true };
    if (__DEV__) console.warn('[purchases] purchase failed:', e);
    return { ok: false, error: err.message ?? 'Purchase failed. Please try again.' };
  }
}

/** App Store requirement: users must be able to restore prior purchases. */
export async function restorePurchases(): Promise<PurchaseResult> {
  const Purchases = await getPurchases();
  if (!Purchases) return { ok: false, unavailable: true };
  try {
    const info = await Purchases.restorePurchases();
    const entitled = info.entitlements.active[PRO_ENTITLEMENT_ID] != null;
    await setPro(entitled);
    return entitled
      ? { ok: true }
      : { ok: false, error: 'No previous purchase found for this Apple ID.' };
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, error: err.message ?? 'Restore failed. Please try again.' };
  }
}

/** True when the real purchase stack can work: native module present AND a
 *  real API key configured. When false, Pro gates FAIL OPEN — the app never
 *  locks features without a working way to pay. */
export async function isOperational(): Promise<boolean> {
  if (REVENUECAT_IOS_API_KEY.includes('PASTE_YOUR_KEY')) return false;
  return (await getPurchases()) != null;
}
