export function copyText(value: string): Promise<boolean> {
  if (!value) return Promise.resolve(false);
  if (!navigator.clipboard?.writeText) return Promise.resolve(false);
  return navigator.clipboard.writeText(value).then(() => true, () => false);
}
