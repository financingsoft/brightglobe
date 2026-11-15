export function isE164PhoneNumber(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

export function phoneToSyntheticEmail(value: string): string {
  return value.replace(/\D/g, "") + "@phone.brightglobe.invalid";
}


export function isSyntheticPhoneEmail(value: string): boolean {
  return value.toLowerCase().endsWith("@phone.brightglobe.invalid");
}
