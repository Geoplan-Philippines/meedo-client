export interface ColumnOption {
  id: string;
  label: string;
  locked?: boolean;
}

export function loadColumns(storageKey: string, columns: readonly ColumnOption[]): string[] {
  const allowed = new Set(columns.map((column) => column.id));
  const locked = columns.filter((column) => column.locked).map((column) => column.id);
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return columns.map((column) => column.id);
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return columns.map((column) => column.id);
    const selected = parsed.filter((id): id is string => typeof id === 'string' && allowed.has(id));
    return unique([...locked, ...selected]);
  } catch {
    return columns.map((column) => column.id);
  }
}

export function saveColumns(storageKey: string, ids: readonly string[]): void {
  localStorage.setItem(storageKey, JSON.stringify([...ids]));
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
