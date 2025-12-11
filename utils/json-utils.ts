/**
 * Safe JSON parsing utilities to prevent JSON parse errors
 */

export function safeJsonParse<T>(jsonString: string | null, fallback: T): T {
  if (!jsonString) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(jsonString);
    return parsed as T;
  } catch (error) {
    console.warn('Failed to parse JSON, using fallback:', error);
    return fallback;
  }
}

export function safeJsonStringify(data: any, fallback: string = '{}'): string {
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.warn('Failed to stringify JSON, using fallback:', error);
    return fallback;
  }
}

export async function safeAsyncStorageGetItem<T>(
  key: string, 
  fallback: T,
  storage: { getItem: (key: string) => Promise<string | null> }
): Promise<T> {
  try {
    const stored = await storage.getItem(key);
    return safeJsonParse(stored, fallback);
  } catch (error) {
    console.warn(`Failed to get item from storage (${key}):`, error);
    return fallback;
  }
}

export async function safeAsyncStorageSetItem(
  key: string,
  data: any,
  storage: { setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> }
): Promise<boolean> {
  try {
    const jsonString = safeJsonStringify(data);
    await storage.setItem(key, jsonString);
    return true;
  } catch (error) {
    console.warn(`Failed to set item in storage (${key}):`, error);
    // Try to remove corrupted data
    try {
      await storage.removeItem(key);
    } catch (removeError) {
      console.warn(`Failed to remove corrupted item (${key}):`, removeError);
    }
    return false;
  }
}
