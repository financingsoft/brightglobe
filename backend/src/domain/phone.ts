export function isE164PhoneNumber(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

export function phoneToSyntheticEmail(value: string): string {
  return value.replace(/\D/g, "") + "@phone.brightglobe.invalid";
}
