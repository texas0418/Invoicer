# Invoicer — Expo SDK 54 / React Native / TypeScript

Local-first invoicing for freelancers. Same stack as SceneReady/Mise:
Expo + EAS builds (no local Xcode), RevenueCat planned for IAP.

## Verified in this build (unlike the Flutter version, these actually ran)
- `tsc --noEmit` passes with zero errors against the real installed packages
- 14 logic tests pass (money math in integer cents, totals, status derivation) — see test-logic.ts
- The PDF template (src/invoiceHtml.ts) was rendered and visually verified;
  computed totals in the output match hand-checked values

## Not verified (needs your machine / a device)
- Runtime behavior in Expo Go / dev build (UI, navigation, SQLite, share sheet)
- expo-print output on a real device (verified renderer here was WeasyPrint,
  not WebKit — expect only minor spacing differences)
- Notifications (fires at 09:00 local on due date; test on a physical device)

## Run it
    npm install            # survives bad internet: resumable, retry on failure
    npx expo install --fix # aligns package minors to SDK 54 exactly
    npx expo start         # scan QR with Expo Go on your phone

## Before launch
1. RevenueCat: paywall is stubbed (search "TODO" — the Upgrade button just
   sets a local flag). Add react-native-purchases + a dev build, mirror the
   SceneReady/Mise setup.
2. expo-notifications in Expo Go is limited on Android; test reminders in a
   dev build. iOS local notifications work in Expo Go.
3. app.json: set real name/slug/bundleIdentifier before `eas build`.
4. Invoice numbers increment even if a save subsequently fails (harmless gap).
5. No invoice editing after creation (delete + recreate) — intentional v1 cut.
6. Editor list prices display "$" until settings load the symbol; the saved
   invoice and PDF always use the configured symbol.

## Structure
    src/models.ts       types + money utils (integer cents everywhere)
    src/db.ts           expo-sqlite (async API), schema + CRUD
    src/services.ts     settings (AsyncStorage), paywall gate, notifications
    src/invoiceHtml.ts  pure HTML template (testable in Node)
    src/pdf.ts          expo-print + expo-sharing wrapper
    src/screens/        Home, Editor, Manage, Settings
    App.tsx             root + minimal hand-rolled navigation
    test-logic.ts       run with: npx tsx test-logic.ts
    render-preview.ts   regenerates /tmp/invoice-preview.html from the template
