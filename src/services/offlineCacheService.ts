import type {
  FarmTask,
  FeedbackRecord,
  FieldProfile,
  PlotPlanRecord,
  WeatherObservation,
} from '../types';

const DB_NAME = 'cropcast_offline_v1';
const DB_VERSION = 1;
const STORE_NAME = 'user_snapshots';
const LS_PREFIX = 'cropcast_offline_snapshot_v1_';

export interface OfflineUserSnapshot {
  uid: string;
  fields: FieldProfile[];
  tasks: FarmTask[];
  feedbacks: FeedbackRecord[];
  plans: Record<string, PlotPlanRecord>;
  weatherByFieldId?: Record<string, WeatherObservation>;
  lastSyncedAt: string;
}

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'uid' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function saveToLocalStorage(snapshot: OfflineUserSnapshot): void {
  try {
    localStorage.setItem(`${LS_PREFIX}${snapshot.uid}`, JSON.stringify(snapshot));
  } catch {
    // ignore quota errors
  }
}

function loadFromLocalStorage(uid: string): OfflineUserSnapshot | null {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.uid === uid) return parsed as OfflineUserSnapshot;
  } catch {
    // ignore corrupt localStorage
  }
  return null;
}

export const OfflineCacheService = {
  async loadSnapshot(uid: string): Promise<OfflineUserSnapshot | null> {
    if (!uid) return null;
    const db = await openOfflineDb();
    if (db) {
      try {
        const result = await new Promise<OfflineUserSnapshot | null>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const getReq = store.get(uid);
          getReq.onsuccess = () => resolve((getReq.result as OfflineUserSnapshot) || null);
          getReq.onerror = () => resolve(null);
        });
        if (result) return result;
      } catch {
        // fallback to localStorage
      }
    }
    return loadFromLocalStorage(uid);
  },

  async saveSnapshot(snapshot: OfflineUserSnapshot): Promise<void> {
    if (!snapshot?.uid) return;
    saveToLocalStorage(snapshot);
    const db = await openOfflineDb();
    if (!db) return;
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(snapshot);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // already mirrored to localStorage
    }
  },

  async saveWeatherForField(
    uid: string,
    fieldId: string,
    weather: WeatherObservation
  ): Promise<void> {
    if (!uid || !fieldId) return;
    const existing = (await this.loadSnapshot(uid)) || {
      uid,
      fields: [],
      tasks: [],
      feedbacks: [],
      plans: {},
      weatherByFieldId: {},
      lastSyncedAt: new Date().toISOString(),
    };
    const next: OfflineUserSnapshot = {
      ...existing,
      weatherByFieldId: {
        ...(existing.weatherByFieldId || {}),
        [fieldId]: weather,
      },
      lastSyncedAt: new Date().toISOString(),
    };
    await this.saveSnapshot(next);
  },

  async clearSnapshot(uid: string): Promise<void> {
    if (!uid) return;
    try {
      localStorage.removeItem(`${LS_PREFIX}${uid}`);
    } catch {
      // ignore
    }
    const db = await openOfflineDb();
    if (!db) return;
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(uid);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  },
};
