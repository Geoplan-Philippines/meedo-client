export const AVATAR_CLASSES = [
  'avatar-blue',
  'avatar-teal',
  'avatar-indigo',
  'avatar-violet',
  'avatar-rose',
] as const;

export function getAvatarClass(seed: string | null | undefined): string {
  const safe = (seed ?? '').trim();
  if (!safe) return `avatar ${AVATAR_CLASSES[0]}`;

  let sum = 0;
  for (let i = 0; i < safe.length; i++) {
    sum += safe.charCodeAt(i);
  }
  return `avatar ${AVATAR_CLASSES[sum % AVATAR_CLASSES.length]}`;
}
