# RevenueCat + EAS setup for Billowe

Code is done. These are the account-side steps only you can do.
Order matters — App Store Connect first, then RevenueCat, then paste the key.

## 1. App Store Connect (browser, bandwidth-light)
1. Create the app record: My Apps → + → New App
   - Bundle ID: whatever is in app.json (com.billowe.app unless you changed it
     to match your SceneReady/Mise convention — decide BEFORE the first build)
2. Create the in-app purchase: the app page → Monetization → In-App Purchases → +
   - Type: **Non-Consumable** (one-time Pro, no subscription)
   - Product ID: `billowe_pro_lifetime`
   - Reference name: Billowe Pro
   - Price: $19.99 (Apple price tier; pick the closest tier in your storefront)
   - Add the required localization (display name "Billowe Pro", description)
3. Sign the Paid Applications agreement if this Apple account hasn't already
   (Business → Agreements). IAPs silently fail without it.

## 2. RevenueCat dashboard (app.revenuecat.com)
1. New project "Billowe" → add an App Store app with the same bundle ID.
   Connect App Store Connect via the App Store Connect API key it asks for.
2. Entitlements → new entitlement with identifier exactly: `Pro`
   (must match PRO_ENTITLEMENT_ID in src/purchases.ts — case-sensitive)
3. Products → import/add `billowe_pro_lifetime` → attach it to the `pro`
   entitlement.
4. Offerings → the `default` offering → add a package containing
   `billowe_pro_lifetime` (the code buys the first package of the current
   offering, so one package is all it needs).
5. Project → API keys → copy the **Apple** public key (starts `appl_`).

## 3. Paste the key
In `src/purchases.ts`, replace `appl_PASTE_YOUR_KEY_HERE`.
The key is a public SDK key — safe to commit.

## 4. Build & test purchases
- Purchases DO NOT work in Expo Go. Continue day-to-day dev in Expo Go
  (Upgrade buttons auto-unlock there, dev builds only).
- Dev build for your physical iPhone:
    npx eas build --profile development --platform ios
  (first run: `npm install -g eas-cli`, `eas login`; builds happen in
  Expo's cloud — your upload is source code, not gigabytes)
- Test the purchase in TestFlight/sandbox: sandbox Apple accounts are under
  App Store Connect → Users and Access → Sandbox Testers.
- Verify: buy Pro → templates unlock; delete app → reinstall →
  Settings → Restore Purchases → Pro returns without paying.

## What the code now does
- App start: configures RevenueCat, mirrors the real entitlement into local
  settings (heals stale flags from backups/reinstalls).
- All three Upgrade buttons run the real purchase; cancel is silent;
  errors alert.
- Settings shows "Restore Purchases" for non-Pro users (App Store review
  requirement).
- Expo Go: everything no-ops safely; __DEV__ builds unlock Pro on Upgrade
  so development flows aren't blocked.
