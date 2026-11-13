export interface StoredQueuedCsvFile {
  key: string;
  fileName: string;
  folderName: string;
  size: number;
  content: string;
}

export interface StoredCsvSessionState {
  id: 'active_session';
  queuedFiles: StoredQueuedCsvFile[];
  batchPreview: any | null;
  activeImportJobId: string | null;
  lastCompletedBatch: {
    version: string;
    totalFolders: number;
    totalFiles: number;
    validRows: number;
    uniqueCells: number;
    startDate: string;
    endDate: string;
    indicatorsDetected: string[];
    sampleRows: Array<Record<string, any>>;
    completedAt: string;
  } | null;
  readingProgress: {
    isReading: boolean;
    totalFiles: number;
    processedFiles: number;
    totalBytes: number;
    processedBytes: number;
    currentFileName: string;
    startedAt: number;
  } | null;
  updatedAt: number;
}

const DB_NAME = 'cropcast_admin_csv_db';
const DB_VERSION = 1;
const STORE_NAME = 'csv_state';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export const CsvQueueStorage = {
  async loadState(): Promise<StoredCsvSessionState | null> {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('active_session');
        req.onsuccess = () => resolve((req.result as StoredCsvSessionState) || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  },

  async savePatch(patch: Partial<Omit<StoredCsvSessionState, 'id' | 'updatedAt'>>): Promise<void> {
    try {
      const existing = (await this.loadState()) || {
        id: 'active_session' as const,
        queuedFiles: [],
        batchPreview: null,
        activeImportJobId: null,
        lastCompletedBatch: null,
        readingProgress: null,
        updatedAt: Date.now(),
      };
      const next: StoredCsvSessionState = {
        ...existing,
        ...patch,
        id: 'active_session',
        updatedAt: Date.now(),
      };
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(next);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Ignore storage quota / private mode restrictions
    }
  },
};
