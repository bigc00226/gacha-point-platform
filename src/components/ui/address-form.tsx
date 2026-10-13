"use client";

import type { ShippingAddress } from "@/lib/types";
import { ADDRESS_LABELS, formatPostalCode, type AddressErrors } from "@/lib/address";
import { PREFECTURES } from "@/lib/constants";
import { Field, Input, Select } from "./field";

/**
 * Controlled shipping-address fields (お届け先). Validate with validateAddress()
 * from "@/lib/address" before submitting; the server re-validates with vAddress().
 */
export function AddressForm({
  value,
  onChange,
  errors = {},
  disabled = false,
  idPrefix = "addr",
}: {
  value: ShippingAddress;
  onChange: (next: ShippingAddress) => void;
  errors?: AddressErrors;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const set = (key: keyof ShippingAddress, v: string) => onChange({ ...value, [key]: v });
  const id = (key: keyof ShippingAddress) => `${idPrefix}-${key}`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={ADDRESS_LABELS.fullName} htmlFor={id("fullName")} required error={errors.fullName} className="sm:col-span-2">
        <Input id={id("fullName")} autoComplete="name" placeholder="山田 太郎" value={value.fullName} onChange={(e) => set("fullName", e.target.value)} invalid={!!errors.fullName} disabled={disabled} />
      </Field>
      <Field label={ADDRESS_LABELS.postalCode} htmlFor={id("postalCode")} required error={errors.postalCode}>
        <Input
          id={id("postalCode")}
          autoComplete="postal-code"
          inputMode="numeric"
          placeholder="123-4567"
          value={value.postalCode}
          onChange={(e) => set("postalCode", e.target.value)}
          onBlur={(e) => set("postalCode", formatPostalCode(e.target.value))}
          invalid={!!errors.postalCode}
          disabled={disabled}
        />
      </Field>
      <Field label={ADDRESS_LABELS.prefecture} htmlFor={id("prefecture")} required error={errors.prefecture}>
        <Select id={id("prefecture")} autoComplete="address-level1" value={value.prefecture} onChange={(e) => set("prefecture", e.target.value)} invalid={!!errors.prefecture} disabled={disabled}>
          <option value="">選択してください</option>
          {PREFECTURES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={ADDRESS_LABELS.city} htmlFor={id("city")} required error={errors.city}>
        <Input id={id("city")} autoComplete="address-level2" placeholder="渋谷区神南" value={value.city} onChange={(e) => set("city", e.target.value)} invalid={!!errors.city} disabled={disabled} />
      </Field>
      <Field label={ADDRESS_LABELS.addressLine} htmlFor={id("addressLine")} required error={errors.addressLine}>
        <Input id={id("addressLine")} autoComplete="address-line1" placeholder="1-2-3" value={value.addressLine} onChange={(e) => set("addressLine", e.target.value)} invalid={!!errors.addressLine} disabled={disabled} />
      </Field>
      <Field label={ADDRESS_LABELS.building} htmlFor={id("building")} error={errors.building} hint="任意">
        <Input id={id("building")} autoComplete="address-line2" placeholder="〇〇マンション 101" value={value.building} onChange={(e) => set("building", e.target.value)} invalid={!!errors.building} disabled={disabled} />
      </Field>
      <Field label={ADDRESS_LABELS.phone} htmlFor={id("phone")} required error={errors.phone}>
        <Input id={id("phone")} type="tel" autoComplete="tel" inputMode="tel" placeholder="090-1234-5678" value={value.phone} onChange={(e) => set("phone", e.target.value)} invalid={!!errors.phone} disabled={disabled} />
      </Field>
    </div>
  );
}
