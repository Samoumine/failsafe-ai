const STORAGE_KEY = 'failsafe-ai-storage';

export interface StorageData {
  settings: Record<string, unknown>;
  history: unknown[];
}

export function saveToStorage(key: string, data: unknown): void {
  const storage = getStorage();
  (storage as unknown as Record<string, unknown>)[key] = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  const storage = getStorage();
  return (((storage as unknown as Record<string, unknown>)[key]) as T) ?? defaultValue;
}

function getStorage(): StorageData {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return { settings: {}, history: [] };
  }
}

export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}
