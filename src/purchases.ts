// src/purchases.ts
// RevenueCat integration. Design constraints:
// 1. Native module is ABSENT in Expo Go — everything degrades gracefully so
//    day-to-day development still works there (dev-only unlock behind __DEV__).
// 2. Local AsyncStorage `isPro` remains the source the UI reads synchronously;
//    RevenueCat is the source of *truth* and we mirror it on every
//    configure/purchase/restore.

import { setPro } from './services';

// PASTE YOUR KEY: RevenueCat dashboard → Project → API keys → Apple App Store.
// Starts with "appl_". The Google key can be added later for Android.
const REVENUECAT_IOS_API_KEY = 'appl_NtbPFeIlKuImVRgpYeQWFbkvrtu';

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
    Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY });
    // Mirror the real entitlement into local settings on every launch, so a
    // reinstalled app (or one restored from backup with a stale flag) heals.
    const info = await Purchases.getCustomerInfo();
    await setPro(info.entitlements.active[PRO_ENTITLEMENT_ID] != null);
  } catch {
    // Offline at launch: keep whatever the local flag says; RevenueCat's own
    // cache will reconcile on a later launch.
  }
}

export type PurchaseResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }
  | { ok: false; unavailable: true };

/** Buy the Pro one-time purchase (first package of the current offering). */
export async function purchasePro(): Promise<PurchaseResult> {
  const Purchases = await getPurchases();
  if (!Purchases) return { ok: false, unavailable: true };
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages[0];
    if (!pkg) {
      return {
        ok: false,
        error:
          'Purchases are not available right now. Please try again later.',
      };
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const entitled =
      customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] != null;
    await setPro(entitled);
    return entitled
      ? { ok: true }
      : { ok: false, error: 'Purchase completed but Pro was not unlocked. Try Restore Purchases.' };
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err.userCancelled) return { ok: false, cancelled: true };
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
