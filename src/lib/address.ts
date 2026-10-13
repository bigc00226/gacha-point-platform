/** Shipping address rules shared by the client form and the server validator. */
import type { ShippingAddress } from "@/lib/types";
import { PREFECTURES } from "@/lib/constants";

export type AddressErrors = Partial<Record<keyof ShippingAddress, string>>;

export const EMPTY_ADDRESS: ShippingAddress = {
  fullName: "",
  postalCode: "",
  prefecture: "",
  city: "",
  addressLine: "",
  building: "",
  phone: "",
};

export const ADDRESS_LABELS: Record<keyof ShippingAddress, string> = {
  fullName: "お名前",
  postalCode: "郵便番号",
  prefecture: "都道府県",
  city: "市区町村",
  addressLine: "番地",
  building: "建物名・部屋番号",
  phone: "電話番号",
};

/** "1500041" / "１５０－００４１" → "150-0041" (returns input unchanged when not 7 digits). */
export function formatPostalCode(raw: string): string {
  const digits = raw.normalize("NFKC").replace(/\D/g, "");
  return digits.length === 7 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : raw.normalize("NFKC").trim();
}

export function normalizeAddress(a: ShippingAddress): ShippingAddress {
  const t = (s: unknown) => (typeof s === "string" ? s.normalize("NFKC").trim() : "");
  return {
    fullName: t(a.fullName),
    postalCode: formatPostalCode(t(a.postalCode)),
    prefecture: t(a.prefecture),
    city: t(a.city),
    addressLine: t(a.addressLine),
    building: t(a.building),
    phone: t(a.phone).replace(/[^\d-]/g, ""),
  };
}

export function validateAddress(input: ShippingAddress): AddressErrors {
  const a = normalizeAddress(input);
  const errors: AddressErrors = {};
  if (!a.fullName) errors.fullName = "お名前を入力してください";
  else if (a.fullName.length > 40) errors.fullName = "お名前は40文字以内で入力してください";
  if (!/^\d{3}-\d{4}$/.test(a.postalCode)) errors.postalCode = "郵便番号は「123-4567」の形式で入力してください";
  if (!(PREFECTURES as readonly string[]).includes(a.prefecture)) errors.prefecture = "都道府県を選択してください";
  if (!a.city) errors.city = "市区町村を入力してください";
  else if (a.city.length > 60) errors.city = "市区町村は60文字以内で入力してください";
  if (!a.addressLine) errors.addressLine = "番地を入力してください";
  else if (a.addressLine.length > 60) errors.addressLine = "番地は60文字以内で入力してください";
  if (a.building.length > 60) errors.building = "建物名は60文字以内で入力してください";
  const digits = a.phone.replace(/-/g, "");
  if (!/^0\d{9,10}$/.test(digits)) errors.phone = "電話番号は0から始まる10〜11桁で入力してください";
  return errors;
}

/** One-line display, e.g. "〒150-0041 東京都渋谷区神南1-2-3 サンプルビル501". */
export function formatAddress(a: ShippingAddress): string {
  return `〒${a.postalCode} ${a.prefecture}${a.city}${a.addressLine}${a.building ? ` ${a.building}` : ""}`;
}
