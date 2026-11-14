import { WeatherObservation } from '../types';

/**
 * Intelligent multi-tier persistent weather cache (IndexedDB + localStorage)
 * - Open-Meteo real-time & 7-day forecast: cached for 2.5 hours per rounded coordinate key
 * - NASA POWER / GPM / SMAP historical daily (2001–2026): cached permanently unless forceRefresh is passed
 */

const DB_NAME = 'cropcast_weather_cache_db';
const DB_VERSION = 1;
const STORE_OPEN_METEO = 'open_meteo_cache';
const STORE_NASA_DAILY = 'nasa_daily_cache';

const LS_METEO_PREFIX = 'cropcast_meteo_v1_';
const LS_NASA_INDEX_KEY = 'cropcast_nasa_daily_index_v1';

export const OPEN_METEO_TTL_MS = 2.5 * 60 * 60 * 1000; // 2.5 hours

export interface CachedOpenMeteoEntry {
  key: string;
  lat: number;
  lon: number;
  cachedAt: number;
  expiresAt: number;
  data: WeatherObservation;
}

export interface CachedNasaDailyEntry<T = any> {
  key: string;
  cellId: string;
  startDate: string;
  endDate: string;
  cachedAt: number;
  payload: T;
}

export function buildCoordCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export function buildNasaDailyCacheKey(
  cellId: string,
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): string {
  return `${cellId}_${lat.toFixed(2)}_${lon.toFixed(2)}_${startDate}_${endDate}`;
}

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_OPEN_METEO)) {
        db.createObjectStore(STORE_OPEN_METEO, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_NASA_DAILY)) {
        db.createObjectStore(STORE_NASA_DAILY, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open cache DB'));
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await openCacheDb();
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) || null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

async function idbPut<T>(storeName: string, entry: T): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(entry);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // fallback handled by caller
  }
}

async function idbClearAll(): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE_OPEN_METEO, STORE_NASA_DAILY], 'readwrite');
      tx.objectStore(STORE_OPEN_METEO).clear();
      tx.objectStore(STORE_NASA_DAILY).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // ignore
  }
}

export const weatherCacheService = {
  async getOpenMeteo(lat: number, lon: number): Promise<WeatherObservation | null> {
    const key = buildCoordCacheKey(lat, lon);
    const now = Date.now();

    // 1. Check fast localStorage mirror first
    try {
      const raw = localStorage.getItem(`${LS_METEO_PREFIX}${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedOpenMeteoEntry;
        if (parsed && typeof parsed.expiresAt === 'number' && parsed.expiresAt > now && parsed.data) {
          return {
            ...parsed.data,
            fromCache: true,
            cachedAt: new Date(parsed.cachedAt).toISOString(),
          };
        }
      }
    } catch {
      // continue to IDB
    }

    // 2. Fallback to IndexedDB
    const entry = await idbGet<CachedOpenMeteoEntry>(STORE_OPEN_METEO, key);
    if (entry && entry.expiresAt > now && entry.data) {
      try {
        localStorage.setItem(`${LS_METEO_PREFIX}${key}`, JSON.stringify(entry));
      } catch {
        // ignore quota errors
      }
      return {
        ...entry.data,
        fromCache: true,
        cachedAt: new Date(entry.cachedAt).toISOString(),
      };
    }

    return null;
  },

  async setOpenMeteo(lat: number, lon: number, data: WeatherObservation): Promise<void> {
    const key = buildCoordCacheKey(lat, lon);
    const now = Date.now();
    const entry: CachedOpenMeteoEntry = {
      key,
      lat,
      lon,
      cachedAt: now,
      expiresAt: now + OPEN_METEO_TTL_MS,
      data: {
        ...data,
        cachedAt: new Date(now).toISOString(),
        fromCache: false,
      },
    };

    try {
      localStorage.setItem(`${LS_METEO_PREFIX}${key}`, JSON.stringify(entry));
    } catch {
      // ignore localStorage full
    }
    await idbPut(STORE_OPEN_METEO, entry);
  },

  async getNasaDaily<T>(
    cellId: string,
    lat: number,
    lon: number,
    startDate: string,
    endDate: string
  ): Promise<CachedNasaDailyEntry<T> | null> {
    const key = buildNasaDailyCacheKey(cellId, lat, lon, startDate, endDate);
    const entry = await idbGet<CachedNasaDailyEntry<T>>(STORE_NASA_DAILY, key);
    if (entry && entry.payload) {
      return entry;
    }
    return null;
  },

  async setNasaDaily<T>(
    cellId: string,
    lat: number,
    lon: number,
    startDate: string,
    endDate: string,
    payload: T
  ): Promise<void> {
    const key = buildNasaDailyCacheKey(cellId, lat, lon, startDate, endDate);
    const entry: CachedNasaDailyEntry<T> = {
      key,
      cellId,
      startDate,
      endDate,
      cachedAt: Date.now(),
      payload,
    };
    await idbPut(STORE_NASA_DAILY, entry);
    try {
      const idxRaw = localStorage.getItem(LS_NASA_INDEX_KEY);
      const list: Array<{ key: string; cellId: string; cachedAt: number }> = idxRaw
        ? JSON.parse(idxRaw)
        : [];
      const next = [
        { key, cellId, cachedAt: entry.cachedAt },
        ...list.filter((item) => item.key !== key),
      ].slice(0, 24);
      localStorage.setItem(LS_NASA_INDEX_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  },

  async clearAll(): Promise<void> {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(LS_METEO_PREFIX) || k === LS_NASA_INDEX_KEY)) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
    await idbClearAll();
  },
};
