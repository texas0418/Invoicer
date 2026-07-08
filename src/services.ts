// src/services.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { BusinessProfile, formatCents, Invoice, totalCents } from './models';
import { invoicesCreatedInMonth } from './db';

// ---------------- Settings ----------------

const K = {
  bizName: 'biz_name',
  bizAddress: 'biz_address',
  bizEmail: 'biz_email',
  bizPhone: 'biz_phone',
  prefix: 'invoice_prefix',
  nextNumber: 'next_number',
  defaultTax: 'default_tax',
  paymentLink: 'payment_link',
  currency: 'currency_symbol',
  pro: 'is_pro',
} as const;

export async function getBusinessProfile(): Promise<BusinessProfile> {
  const [name, address, email, phone] = await AsyncStorage.multiGet([
    K.bizName,
    K.bizAddress,
    K.bizEmail,
    K.bizPhone,
  ]);
  return {
    name: name[1] ?? 'Your Business',
    address: address[1] ?? '',
    email: email[1] ?? '',
    phone: phone[1] ?? '',
  };
}

export async function saveBusinessProfile(b: BusinessProfile): Promise<void> {
  await AsyncStorage.multiSet([
    [K.bizName, b.name || 'Your Business'],
    [K.bizAddress, b.address],
    [K.bizEmail, b.email],
    [K.bizPhone, b.phone],
  ]);
}

/** Returns e.g. "INV-0007" and increments the stored counter. */
export async function nextInvoiceNumber(): Promise<string> {
  const prefix = (await AsyncStorage.getItem(K.prefix)) ?? 'INV';
  const n = parseInt((await AsyncStorage.getItem(K.nextNumber)) ?? '1', 10);
  await AsyncStorage.setItem(K.nextNumber, String(n + 1));
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

export async function getDefaultTaxRate(): Promise<number> {
  return parseFloat((await AsyncStorage.getItem(K.defaultTax)) ?? '0');
}
export async function setDefaultTaxRate(v: number): Promise<void> {
  await AsyncStorage.setItem(K.defaultTax, String(v));
}

export async function getDefaultPaymentLink(): Promise<string> {
  return (await AsyncStorage.getItem(K.paymentLink)) ?? '';
}
export async function setDefaultPaymentLink(v: string): Promise<void> {
  await AsyncStorage.setItem(K.paymentLink, v);
}

export async function getCurrencySymbol(): Promise<string> {
  return (await AsyncStorage.getItem(K.currency)) ?? '$';
}
export async function setCurrencySymbol(v: string): Promise<void> {
  await AsyncStorage.setItem(K.currency, v || '$');
}

export async function isPro(): Promise<boolean> {
  return (await AsyncStorage.getItem(K.pro)) === '1';
}
export async function setPro(v: boolean): Promise<void> {
  await AsyncStorage.setItem(K.pro, v ? '1' : '0');
}

// ---------------- Paywall ----------------

export const FREE_INVOICES_PER_MONTH = 3;

/**
 * v1 gate. TODO before launch: replace setPro with RevenueCat
 * (react-native-purchases) entitlement check, matching the SceneReady/Mise
 * setup. The package needs a dev build (not Expo Go), so it's excluded here.
 */
export async function canCreateInvoice(): Promise<boolean> {
  if (await isPro()) return true;
  const used = await invoicesCreatedInMonth(new Date());
  return used < FREE_INVOICES_PER_MONTH;
}

// ---------------- Notifications ----------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Schedule a due-date reminder at 09:00 local. Returns the notification id
 *  (store it on the invoice so it can be cancelled), or null if in the past
 *  or permission denied. */
export async function scheduleDueReminder(inv: Invoice): Promise<string | null> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const due = new Date(inv.dueDateMs);
  const fireAt = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 9);
  if (fireAt.getTime() <= Date.now()) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Invoice ${inv.number} is due today`,
      body: `${inv.clientName} — ${formatCents(totalCents(inv), inv.currencySymbol)}`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });
}

export async function cancelReminder(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
