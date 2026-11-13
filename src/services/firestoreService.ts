import { parseJsonSafely } from './httpClient';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  AdminPlatformStats,
  AdminUserSummary,
  AppUser,
  FarmTask,
  FeedbackRecord,
  FieldProfile,
} from '../types';
import { findNearestNasaGrid } from '../data/nasaVietnamGrid';

const LOCAL_TOKEN_KEY = 'cropcast_local_auth_token';

function normalizeUsernameToInternalEmail(rawInput: string): {
  username: string;
  email: string;
  displayName: string;
} {
  const trimmed = rawInput.trim();
  const base = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
  const safeUser = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '');
  if (safeUser.length < 3) {
    throw new Error(
      'Tên đăng nhập cần tối thiểu 3 ký tự (chữ cái, số, dấu chấm hoặc gạch dưới).'
    );
  }
  return {
    username: safeUser.slice(0, 40),
    email: `${safeUser}@users.cropcast.app`,
    displayName: trimmed || safeUser,
  };
}

function mapAuthErrorMessage(err: any): string {
  const code = err?.code || '';
  if (code === 'auth/email-already-in-use') {
    return 'Tên đăng nhập này đã có người sử dụng. Vui lòng chọn tên khác hoặc chuyển sang Đăng nhập.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Tên đăng nhập hoặc mật khẩu chưa đúng.';
  }
  if (code === 'auth/weak-password') {
    return 'Mật khẩu quá yếu. Vui lòng dùng ít nhất 6 ký tự.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Bạn đã đóng cửa sổ đăng nhập Google.';
  }
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return `Tên miền "${host}" chưa được cấp phép trong Firebase Authentication (Authorized domains). Hãy hoàn tất bước thiết lập Firebase hoặc thêm tên miền này trong Firebase Console -> Authentication -> Settings -> Authorized domains.`;
  }
  return err?.message || 'Không thể đăng nhập lúc này. Vui lòng thử lại.';
}

async function localApiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(LOCAL_TOKEN_KEY) || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await parseJsonSafely<any>(res).catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Lỗi máy chủ (${res.status})`);
  }
  return data;
}

export const LocalServerStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(LOCAL_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  clearToken() {
    try {
      localStorage.removeItem(LOCAL_TOKEN_KEY);
    } catch {
      // ignore
    }
  },
  async restoreSession(): Promise<AppUser | null> {
    const token = this.getToken();
    if (!token) return null;
    try {
      const data = await localApiFetch('/api/auth/me');
      return data.user as AppUser;
    } catch {
      this.clearToken();
      return null;
    }
  },
  async fetchState(): Promise<{
    fields: FieldProfile[];
    tasks: FarmTask[];
    feedbacks: FeedbackRecord[];
  }> {
    return localApiFetch('/api/local/state');
  },
  async createField(fieldData: Omit<FieldProfile, 'id' | 'nasaGrid'>): Promise<FieldProfile> {
    const data = await localApiFetch('/api/local/fields', {
      method: 'POST',
      body: JSON.stringify(fieldData),
    });
    return data.field;
  },
  async updateField(field: FieldProfile): Promise<FieldProfile> {
    const data = await localApiFetch(`/api/local/fields/${encodeURIComponent(field.id)}`, {
      method: 'PUT',
      body: JSON.stringify(field),
    });
    return data.field;
  },
  async deleteField(fieldId: string): Promise<void> {
    await localApiFetch(`/api/local/fields/${encodeURIComponent(fieldId)}`, {
      method: 'DELETE',
    });
  },
  async createTasks(tasks: FarmTask[]): Promise<FarmTask[]> {
    const data = await localApiFetch('/api/local/tasks', {
      method: 'POST',
      body: JSON.stringify({ tasks }),
    });
    return data.tasks;
  },
  async updateTaskStatus(taskId: string, status: FarmTask['status'], note?: string): Promise<void> {
    await localApiFetch(`/api/local/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    });
  },
  async createFeedback(fb: Omit<FeedbackRecord, 'id' | 'timestamp'>): Promise<void> {
    await localApiFetch('/api/local/feedbacks', {
      method: 'POST',
      body: JSON.stringify(fb),
    });
  },
  async createShareLink(fieldId: string): Promise<string> {
    const data = await localApiFetch('/api/local/shares/link', {
      method: 'POST',
      body: JSON.stringify({ fieldId }),
    });
    return data.shareToken;
  },
  async revokeShareLink(fieldId: string): Promise<void> {
    await localApiFetch('/api/local/shares/revoke', {
      method: 'POST',
      body: JSON.stringify({ fieldId }),
    });
  },
  async shareByTarget(fieldId: string, target: string): Promise<string> {
    const data = await localApiFetch('/api/local/shares/target', {
      method: 'POST',
      body: JSON.stringify({ fieldId, target }),
    });
    return data.target;
  },
  async removeSharedTarget(fieldId: string, target: string): Promise<void> {
    await localApiFetch('/api/local/shares/remove-target', {
      method: 'POST',
      body: JSON.stringify({ fieldId, target }),
    });
  },
  async redeemShareLink(token: string): Promise<{ fieldId: string; fieldName: string; ownerName: string }> {
    return localApiFetch('/api/local/shares/redeem', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
};

export interface UploadedNasaDatasetDoc {
  id: string;
  version: string;
  fileName: string;
  recordCount: number;
  cellCount: number;
  startDate: string;
  endDate: string;
  status: 'COMPLETED' | 'ROLLED_BACK';
  uploadedBy: string;
  isPublic: boolean;
  sampleOverrides?: Array<{
    cell_id: string;
    date: string;
    indicator_code: string;
    value: number;
  }>;
  createdAt?: any;
}

export const FirestoreService = {
  async signUpWithUsername(username: string, password: string): Promise<AppUser> {
    const { username: cleanUser, email, displayName } = normalizeUsernameToInternalEmail(username);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = result.user;
      await updateProfile(fbUser, { displayName });

      const userRef = doc(db, 'users', fbUser.uid);
      await setDoc(userRef, {
        uid: fbUser.uid,
        displayName,
        email,
        photoURL: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        uid: fbUser.uid,
        username: cleanUser,
        displayName,
        email,
        emailVerified: fbUser.emailVerified,
        isAdmin: false,
        authMode: 'firebase',
      };
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        const data = await localApiFetch('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });
        localStorage.setItem(LOCAL_TOKEN_KEY, data.token);
        return data.user as AppUser;
      }
      throw new Error(mapAuthErrorMessage(err));
    }
  },

  async signInWithUsername(username: string, password: string): Promise<AppUser> {
    const { username: cleanUser, email, displayName } = normalizeUsernameToInternalEmail(username);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const fbUser = result.user;
      const isAdmin = await this.checkIsAdmin(fbUser.uid, fbUser.email, fbUser.emailVerified);
      const resolvedName = fbUser.displayName || displayName || 'Nông dân CropCast';

      const userRef = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: fbUser.uid,
          displayName: resolvedName,
          email: fbUser.email || email,
          photoURL: fbUser.photoURL || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      return {
        uid: fbUser.uid,
        username: cleanUser,
        displayName: resolvedName,
        email: fbUser.email || email,
        photoURL: fbUser.photoURL || undefined,
        emailVerified: fbUser.emailVerified,
        isAdmin,
        authMode: 'firebase',
      };
    } catch (err: any) {
      if (
        err?.code === 'auth/operation-not-allowed' ||
        err?.code === 'auth/user-not-found' ||
        err?.code === 'auth/invalid-credential'
      ) {
        try {
          const data = await localApiFetch('/api/auth/signin', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
          });
          localStorage.setItem(LOCAL_TOKEN_KEY, data.token);
          return data.user as AppUser;
        } catch (localErr: any) {
          if (err?.code === 'auth/operation-not-allowed') {
            throw localErr;
          }
        }
      }
      throw new Error(mapAuthErrorMessage(err));
    }
  },

  async signInWithGoogle(): Promise<AppUser> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const isAdmin = await this.checkIsAdmin(fbUser.uid, fbUser.email, fbUser.emailVerified);

      // Ensure user profile doc exists in /users/{uid}
      const userRef = doc(db, 'users', fbUser.uid);
      try {
        const existingSnap = await getDoc(userRef);
        if (!existingSnap.exists()) {
          await setDoc(userRef, {
            uid: fbUser.uid,
            displayName: fbUser.displayName || 'Nông dân CropCast',
            email: fbUser.email || '',
            photoURL: fbUser.photoURL || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(userRef, {
            displayName: fbUser.displayName || 'Nông dân CropCast',
            photoURL: fbUser.photoURL || '',
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${fbUser.uid}`);
      }

      return {
        uid: fbUser.uid,
        displayName: fbUser.displayName || 'Nông dân CropCast',
        email: fbUser.email || '',
        photoURL: fbUser.photoURL || undefined,
        emailVerified: fbUser.emailVerified,
        isAdmin,
        authMode: 'firebase',
      };
    } catch (err: any) {
      throw new Error(mapAuthErrorMessage(err));
    }
  },

  async signOutUser(): Promise<void> {
    LocalServerStorage.clearToken();
    try {
      await signOut(auth);
    } catch {
      // ignore if user was only signed in locally
    }
  },

  async checkIsAdmin(uid: string, email?: string | null, emailVerified?: boolean): Promise<boolean> {
    if (!emailVerified) return false;
    if (email && email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      return true;
    }
    try {
      const adminSnap = await getDoc(doc(db, 'admins', uid));
      return adminSnap.exists();
    } catch {
      return false;
    }
  },

  subscribeUserFields(
    uid: string,
    email: string | undefined,
    onData: (fields: FieldProfile[]) => void,
    onError?: (err: Error) => void
  ) {
    const ownedMap = new Map<string, FieldProfile>();
    const sharedUidMap = new Map<string, FieldProfile>();
    const sharedEmailMap = new Map<string, FieldProfile>();

    const mapDoc = (d: any): FieldProfile => {
      const data = d.data();
      return {
        id: d.id,
        ownerId: data.ownerId,
        ownerName: data.ownerName,
        sharedWithEmails: data.sharedWithEmails || [],
        sharedWithUids: data.sharedWithUids || [],
        activeShareToken: data.activeShareToken || '',
        isSharedWithMe: data.ownerId !== uid,
        name: data.name,
        province: data.province,
        district: data.district,
        lat: data.lat,
        lon: data.lon,
        areaHa: data.areaHa,
        soilType: data.soilType,
        soilCharacteristics: data.soilCharacteristics,
        waterSource: data.waterSource,
        crop: data.crop,
        primaryGoal: data.primaryGoal,
        inspectTime: data.inspectTime,
        notificationMethod: data.notificationMethod,
        nasaGrid: data.nasaGrid,
        adaptiveMemory: data.adaptiveMemory,
      } as FieldProfile;
    };

    const emitMerged = () => {
      const merged = new Map<string, FieldProfile>();
      sharedEmailMap.forEach((v, k) => merged.set(k, v));
      sharedUidMap.forEach((v, k) => merged.set(k, v));
      ownedMap.forEach((v, k) => merged.set(k, v));
      onData(Array.from(merged.values()));
    };

    const unsubOwned = onSnapshot(
      query(collection(db, 'fields'), where('ownerId', '==', uid)),
      (snap) => {
        ownedMap.clear();
        snap.docs.forEach((d) => ownedMap.set(d.id, mapDoc(d)));
        emitMerged();
      },
      (err) => {
        if (onError) onError(err);
        handleFirestoreError(err, OperationType.LIST, 'fields');
      }
    );

    const unsubSharedUid = onSnapshot(
      query(collection(db, 'fields'), where('sharedWithUids', 'array-contains', uid)),
      (snap) => {
        sharedUidMap.clear();
        snap.docs.forEach((d) => sharedUidMap.set(d.id, mapDoc(d)));
        emitMerged();
      },
      () => {
        // Ignore secondary listener permission edge cases
      }
    );

    let unsubSharedEmail = () => {};
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (normalizedEmail) {
      unsubSharedEmail = onSnapshot(
        query(collection(db, 'fields'), where('sharedWithEmails', 'array-contains', normalizedEmail)),
        (snap) => {
          sharedEmailMap.clear();
          snap.docs.forEach((d) => sharedEmailMap.set(d.id, mapDoc(d)));
          emitMerged();
        },
        () => {
          // Ignore secondary listener permission edge cases
        }
      );
    }

    return () => {
      unsubOwned();
      unsubSharedUid();
      unsubSharedEmail();
    };
  },

  subscribeUserTasks(uid: string, onData: (tasks: FarmTask[]) => void) {
    const q = query(collection(db, 'tasks'), where('ownerId', '==', uid));
    return onSnapshot(
      q,
      (snap) => {
        const list: FarmTask[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: data.ownerId,
            fieldId: data.fieldId,
            title: data.title,
            scheduledTime: data.scheduledTime,
            priority: data.priority,
            reason: data.reason,
            triggerData: data.triggerData,
            status: data.status,
            farmerNote: data.farmerNote,
            createdAt:
              data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          } as FarmTask;
        });
        onData(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'tasks')
    );
  },

  subscribeUserFeedbacks(uid: string, onData: (items: FeedbackRecord[]) => void) {
    const q = query(collection(db, 'feedbacks'), where('ownerId', '==', uid));
    return onSnapshot(
      q,
      (snap) => {
        const list: FeedbackRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: data.ownerId,
            fieldId: data.fieldId,
            feedbackType: data.feedbackType,
            userComment: data.userComment,
            systemActionTaken: data.systemActionTaken,
            appliedToProfile: data.appliedToProfile,
            timestamp:
              data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          } as FeedbackRecord;
        });
        onData(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'feedbacks')
    );
  },

  async createField(
    uid: string,
    fieldData: Omit<FieldProfile, 'id' | 'nasaGrid'>
  ): Promise<FieldProfile> {
    const fieldId = `FIELD_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { cell, distanceKm } = findNearestNasaGrid(fieldData.lat, fieldData.lon);
    const nasaGrid = {
      cellId: cell.cellId,
      lat: cell.lat,
      lon: cell.lon,
      distanceKm,
    };

    const ownerName = (auth.currentUser?.displayName || 'Nông dân CropCast').slice(0, 120);
    const payload: Record<string, any> = {
      ownerId: uid,
      ownerName,
      sharedWithEmails: [],
      sharedWithUids: [],
      activeShareToken: '',
      name: fieldData.name.slice(0, 150),
      province: fieldData.province.slice(0, 100),
      district: (fieldData.district || 'Khu vực canh tác').slice(0, 120),
      lat: Number(fieldData.lat),
      lon: Number(fieldData.lon),
      areaHa: Math.max(0.01, Number(fieldData.areaHa) || 0.5),
      soilType: fieldData.soilType,
      soilCharacteristics: fieldData.soilCharacteristics,
      waterSource: fieldData.waterSource,
      crop: fieldData.crop,
      primaryGoal: fieldData.primaryGoal,
      inspectTime: fieldData.inspectTime,
      notificationMethod: fieldData.notificationMethod || 'in_app',
      nasaGrid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (fieldData.adaptiveMemory) {
      payload.adaptiveMemory = fieldData.adaptiveMemory;
    }

    try {
      await setDoc(doc(db, 'fields', fieldId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `fields/${fieldId}`);
    }

    return {
      ...fieldData,
      id: fieldId,
      ownerId: uid,
      ownerName,
      sharedWithEmails: [],
      sharedWithUids: [],
      activeShareToken: '',
      nasaGrid,
    };
  },

  async updateField(field: FieldProfile): Promise<void> {
    const { cell, distanceKm } = findNearestNasaGrid(field.lat, field.lon);
    const updatedGrid = {
      cellId: cell.cellId,
      lat: cell.lat,
      lon: cell.lon,
      distanceKm,
    };
    const updateData: Record<string, any> = {
      name: field.name.slice(0, 150),
      province: field.province.slice(0, 100),
      district: (field.district || 'Khu vực canh tác').slice(0, 120),
      lat: Number(field.lat),
      lon: Number(field.lon),
      areaHa: Math.max(0.01, Number(field.areaHa) || 0.5),
      soilType: field.soilType,
      soilCharacteristics: field.soilCharacteristics,
      waterSource: field.waterSource,
      crop: field.crop,
      primaryGoal: field.primaryGoal,
      inspectTime: field.inspectTime,
      nasaGrid: updatedGrid,
      updatedAt: serverTimestamp(),
    };
    if (field.adaptiveMemory) {
      updateData.adaptiveMemory = field.adaptiveMemory;
    }
    try {
      await updateDoc(doc(db, 'fields', field.id), updateData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fields/${field.id}`);
    }
  },

  async deleteField(fieldId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'fields', fieldId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fields/${fieldId}`);
    }
  },

  async createTasks(uid: string, tasks: FarmTask[]): Promise<void> {
    for (const t of tasks) {
      const taskId = `TASK_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        await setDoc(doc(db, 'tasks', taskId), {
          ownerId: uid,
          fieldId: t.fieldId,
          title: t.title.slice(0, 200),
          scheduledTime: t.scheduledTime.slice(0, 100),
          priority: t.priority,
          reason: t.reason.slice(0, 600),
          triggerData: t.triggerData.slice(0, 300),
          status: t.status || 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `tasks/${taskId}`);
      }
    }
  },

  async updateTaskStatus(
    taskId: string,
    status: FarmTask['status'],
    note?: string
  ): Promise<void> {
    const payload: Record<string, any> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (note) {
      payload.farmerNote = note.slice(0, 500);
    }
    try {
      await updateDoc(doc(db, 'tasks', taskId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
    }
  },

  async createFeedback(
    uid: string,
    fb: Omit<FeedbackRecord, 'id' | 'timestamp'>
  ): Promise<void> {
    const fbId = `FB_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const payload: Record<string, any> = {
      ownerId: uid,
      fieldId: fb.fieldId,
      feedbackType: fb.feedbackType,
      appliedToProfile: fb.appliedToProfile,
      createdAt: serverTimestamp(),
    };
    if (fb.userComment) payload.userComment = fb.userComment.slice(0, 1000);
    if (fb.systemActionTaken) payload.systemActionTaken = fb.systemActionTaken.slice(0, 500);
    try {
      await setDoc(doc(db, 'feedbacks', fbId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `feedbacks/${fbId}`);
    }
  },

  // Admin-only NASA dataset persistence in Firestore
  async saveNasaDatasetUpload(
    uid: string,
    dataset: Omit<UploadedNasaDatasetDoc, 'id' | 'uploadedBy' | 'isPublic' | 'createdAt'>
  ): Promise<string> {
    const datasetId = `NASA_DS_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'nasa_datasets', datasetId), {
        version: dataset.version.slice(0, 80),
        fileName: dataset.fileName.slice(0, 200),
        recordCount: dataset.recordCount,
        cellCount: dataset.cellCount,
        startDate: dataset.startDate.slice(0, 20),
        endDate: dataset.endDate.slice(0, 20),
        status: dataset.status,
        uploadedBy: uid,
        isPublic: true,
        sampleOverrides: (dataset.sampleOverrides || []).slice(0, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `nasa_datasets/${datasetId}`);
    }
    return datasetId;
  },

  async saveNasaSyncLog(
    uid: string,
    log: {
      syncType: string;
      targetCellsCount: number;
      recordsSynced: number;
      status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
      latestNasaDate?: string;
    }
  ): Promise<void> {
    const logId = `SYNC_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'nasa_sync_logs', logId), {
        syncType: log.syncType.slice(0, 40),
        targetCellsCount: log.targetCellsCount,
        recordsSynced: log.recordsSynced,
        status: log.status,
        latestNasaDate: (log.latestNasaDate || '').slice(0, 20),
        actorUid: uid,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `nasa_sync_logs/${logId}`);
    }
  },

  async getPublicNasaDatasets(): Promise<UploadedNasaDatasetDoc[]> {
    try {
      const q = query(
        collection(db, 'nasa_datasets'),
        where('isPublic', '==', true)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<UploadedNasaDatasetDoc, 'id'>),
        }))
        .sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() || 0;
          const tB = b.createdAt?.toMillis?.() || 0;
          return tB - tA;
        });
    } catch {
      return [];
    }
  },

  async getAdminNasaDatasets(): Promise<UploadedNasaDatasetDoc[]> {
    try {
      const snap = await getDocs(collection(db, 'nasa_datasets'));
      return snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<UploadedNasaDatasetDoc, 'id'>),
        }))
        .sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() || 0;
          const tB = b.createdAt?.toMillis?.() || 0;
          return tB - tA;
        });
    } catch {
      return [];
    }
  },

  async getAdminSyncLogs(): Promise<
    Array<{
      id: string;
      syncType: string;
      targetCellsCount: number;
      recordsSynced: number;
      startTime: string;
      endTime?: string;
      status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
      latestNasaDate?: string;
    }>
  > {
    try {
      const snap = await getDocs(collection(db, 'nasa_sync_logs'));
      return snap.docs
        .map((d) => {
          const data = d.data();
          const iso = data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString();
          return {
            id: d.id,
            syncType: String(data.syncType || 'CSV_UPLOAD'),
            targetCellsCount: Number(data.targetCellsCount) || 0,
            recordsSynced: Number(data.recordsSynced) || 0,
            startTime: iso,
            endTime: iso,
            status: (data.status || 'SUCCESS') as 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL',
            latestNasaDate: data.latestNasaDate ? String(data.latestNasaDate) : undefined,
            _ms: data.createdAt?.toMillis?.() || 0,
          };
        })
        .sort((a, b) => b._ms - a._ms)
        .map(({ _ms, ...rest }) => rest);
    } catch {
      return [];
    }
  },

  // =========================================================================
  // Field Sharing (Link & Email)
  // =========================================================================

  async createFieldShareLink(
    field: FieldProfile,
    ownerUid: string,
    ownerName: string
  ): Promise<string> {
    const shareToken = `SHR_${Date.now()}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'field_shares', shareToken), {
        fieldId: field.id,
        fieldName: field.name.slice(0, 150),
        ownerId: ownerUid,
        ownerName: (ownerName || 'Nông dân CropCast').slice(0, 120),
        shareType: 'link',
        isActive: true,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'fields', field.id), {
        activeShareToken: shareToken,
        ownerName: (ownerName || 'Nông dân CropCast').slice(0, 120),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `field_shares/${shareToken}`);
    }
    return shareToken;
  },

  async revokeFieldShareLink(fieldId: string, shareToken?: string): Promise<void> {
    try {
      if (shareToken) {
        await updateDoc(doc(db, 'field_shares', shareToken), {
          isActive: false,
        }).catch(() => {});
      }
      await updateDoc(doc(db, 'fields', fieldId), {
        activeShareToken: '',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fields/${fieldId}`);
    }
  },

  async shareFieldByEmail(
    field: FieldProfile,
    ownerUid: string,
    ownerName: string,
    recipientInput: string
  ): Promise<string> {
    const trimmed = recipientInput.trim();
    const targetEmail = trimmed.includes('@')
      ? trimmed.toLowerCase()
      : `${trimmed.toLowerCase().replace(/[^a-z0-9._-]/g, '')}@users.cropcast.app`;

    if (!targetEmail || targetEmail.length < 5) {
      throw new Error('Email hoặc tên đăng nhập người nhận chưa hợp lệ.');
    }

    const shareId = `INV_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      await updateDoc(doc(db, 'fields', field.id), {
        sharedWithEmails: arrayUnion(targetEmail),
        ownerName: (ownerName || 'Nông dân CropCast').slice(0, 120),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'field_shares', shareId), {
        fieldId: field.id,
        fieldName: field.name.slice(0, 150),
        ownerId: ownerUid,
        ownerName: (ownerName || 'Nông dân CropCast').slice(0, 120),
        shareType: 'email',
        targetEmail,
        isActive: true,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fields/${field.id}`);
    }
    return targetEmail;
  },

  async removeSharedEmail(fieldId: string, email: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'fields', fieldId), {
        sharedWithEmails: arrayRemove(email.toLowerCase()),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fields/${fieldId}`);
    }
  },

  async redeemFieldShareLink(
    shareToken: string,
    uid: string
  ): Promise<{ fieldId: string; fieldName: string; ownerName: string }> {
    const shareRef = doc(db, 'field_shares', shareToken);
    let shareSnap;
    try {
      shareSnap = await getDoc(shareRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `field_shares/${shareToken}`);
    }
    if (!shareSnap.exists()) {
      throw new Error('Liên kết chia sẻ không tồn tại hoặc đã bị chủ ruộng thu hồi.');
    }
    const shareData = shareSnap.data();
    if (!shareData.isActive) {
      throw new Error('Liên kết chia sẻ này đã bị chủ ruộng tắt quyền truy cập.');
    }
    const fieldId = String(shareData.fieldId || '');
    if (!fieldId) {
      throw new Error('Liên kết chia sẻ không hợp lệ.');
    }

    if (shareData.ownerId !== uid) {
      try {
        await updateDoc(doc(db, 'fields', fieldId), {
          sharedWithUids: arrayUnion(uid),
          presentedShareToken: shareToken,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `fields/${fieldId}`);
      }
    }

    return {
      fieldId,
      fieldName: String(shareData.fieldName || 'Thửa ruộng được chia sẻ'),
      ownerName: String(shareData.ownerName || 'Nông dân CropCast'),
    };
  },

  // =========================================================================
  // Admin Dashboard Stats, User Directory & Manual NASA Data Publishing
  // =========================================================================

  async getAdminPlatformStats(): Promise<AdminPlatformStats> {
    try {
      const [usersSnap, adminsSnap, fieldsSnap, tasksSnap, feedbacksSnap, sharesSnap, datasetsSnap] =
        await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'admins')),
          getDocs(collection(db, 'fields')),
          getDocs(collection(db, 'tasks')),
          getDocs(collection(db, 'feedbacks')),
          getDocs(collection(db, 'field_shares')),
          getDocs(collection(db, 'nasa_datasets')),
        ]);

      const adminUids = new Set<string>(adminsSnap.docs.map((d) => d.id));

      const userDirectoryMap = new Map<string, { displayName: string; email: string }>();
      usersSnap.docs.forEach((d) => {
        const uData = d.data();
        userDirectoryMap.set(d.id, {
          displayName: String(uData.displayName || 'Nông dân CropCast'),
          email: String(uData.email || ''),
        });
      });

      const fieldStatsByOwner = new Map<string, { count: number; areaHa: number }>();
      const provinceMap = new Map<string, { count: number; areaHa: number }>();
      const cropMap = new Map<string, number>();
      const soilMap = new Map<string, number>();

      let totalAreaHa = 0;
      const allFields: AdminPlatformStats['allFields'] = [];

      fieldsSnap.docs.forEach((d) => {
        const data = d.data();
        const area = Number(data.areaHa) || 0;
        totalAreaHa += area;

        const oid = String(data.ownerId || '');
        const prevOwner = fieldStatsByOwner.get(oid) || { count: 0, areaHa: 0 };
        fieldStatsByOwner.set(oid, {
          count: prevOwner.count + 1,
          areaHa: prevOwner.areaHa + area,
        });

        const prov = String(data.province || 'Khác');
        const prevProv = provinceMap.get(prov) || { count: 0, areaHa: 0 };
        provinceMap.set(prov, {
          count: prevProv.count + 1,
          areaHa: prevProv.areaHa + area,
        });

        const cropName = String(data.crop?.name || 'Chưa rõ');
        cropMap.set(cropName, (cropMap.get(cropName) || 0) + 1);

        const soilType = String(data.soilType || 'unknown');
        soilMap.set(soilType, (soilMap.get(soilType) || 0) + 1);

        const ownerProfile = userDirectoryMap.get(oid);
        const sharedEmailsCount = Array.isArray(data.sharedWithEmails)
          ? data.sharedWithEmails.length
          : 0;
        const sharedUidsCount = Array.isArray(data.sharedWithUids)
          ? data.sharedWithUids.length
          : 0;
        const hasLink = data.activeShareToken ? 1 : 0;

        allFields.push({
          id: d.id,
          name: String(data.name || 'Thửa ruộng'),
          ownerId: oid,
          ownerName: String(data.ownerName || ownerProfile?.displayName || 'Nông dân CropCast'),
          ownerEmail: ownerProfile?.email || '',
          province: prov,
          district: String(data.district || ''),
          lat: Number(data.lat) || 0,
          lon: Number(data.lon) || 0,
          areaHa: Number(area.toFixed(2)),
          cropName,
          cropVariety: String(data.crop?.variety || '—'),
          currentStage: String(data.crop?.currentStage || '—'),
          soilType: (data.soilType || 'unknown') as any,
          waterSourceType: (data.waterSource?.type || 'other') as any,
          nasaCellId: String(data.nasaGrid?.cellId || '—'),
          nasaDistanceKm: Number(data.nasaGrid?.distanceKm) || 0,
          sharedCount: sharedEmailsCount + sharedUidsCount + hasLink,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        });
      });

      allFields.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

      const users: AdminUserSummary[] = usersSnap.docs.map((d) => {
        const data = d.data();
        const email = String(data.email || '');
        const ownerStat = fieldStatsByOwner.get(d.id) || { count: 0, areaHa: 0 };
        const isBootstrap = email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
        return {
          uid: d.id,
          displayName: String(data.displayName || 'Nông dân CropCast'),
          email,
          photoURL: data.photoURL || undefined,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          fieldCount: ownerStat.count,
          totalAreaHa: Number(ownerStat.areaHa.toFixed(2)),
          isAdmin: isBootstrap || adminUids.has(d.id),
        };
      });

      users.sort((a, b) => b.fieldCount - a.fieldCount);

      let completedTasks = 0;
      let pendingTasks = 0;
      tasksSnap.docs.forEach((d) => {
        const status = d.data().status;
        if (status === 'completed') completedTasks++;
        else if (status === 'pending' || status === 'skipped') pendingTasks++;
      });

      const totalActiveShares = sharesSnap.docs.filter((d) => d.data().isActive === true).length;

      return {
        totalUsers: users.length,
        totalFields: fieldsSnap.size,
        totalAreaHa: Number(totalAreaHa.toFixed(2)),
        totalTasks: tasksSnap.size,
        completedTasks,
        pendingTasks,
        totalFeedbacks: feedbacksSnap.size,
        totalActiveShares,
        totalNasaDatasets: datasetsSnap.size,
        users,
        allFields,
        fieldsByProvince: Array.from(provinceMap.entries())
          .map(([province, val]) => ({
            province,
            count: val.count,
            areaHa: Number(val.areaHa.toFixed(2)),
          }))
          .sort((a, b) => b.count - a.count),
        fieldsByCrop: Array.from(cropMap.entries())
          .map(([cropName, count]) => ({ cropName, count }))
          .sort((a, b) => b.count - a.count),
        fieldsBySoil: Array.from(soilMap.entries())
          .map(([soilType, count]) => ({ soilType, count }))
          .sort((a, b) => b.count - a.count),
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'admin_stats');
    }
  },

  async setAdminRole(targetUid: string, targetEmail: string, grant: boolean): Promise<void> {
    try {
      const ref = doc(db, 'admins', targetUid);
      if (grant) {
        await setDoc(ref, {
          uid: targetUid,
          email: targetEmail,
          grantedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(ref);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admins/${targetUid}`);
    }
  },

  async addManualNasaObservation(
    uid: string,
    input: {
      cellId: string;
      date: string;
      indicatorCode: string;
      value: number;
    }
  ): Promise<string> {
    const version = `manual.${input.date.replace(/-/g, '')}.${Math.random().toString(36).slice(2, 5)}`;
    return this.saveNasaDatasetUpload(uid, {
      version,
      fileName: `Nhập tay (${input.cellId} · ${input.indicatorCode})`,
      recordCount: 1,
      cellCount: 1,
      startDate: input.date,
      endDate: input.date,
      status: 'COMPLETED',
      sampleOverrides: [
        {
          cell_id: input.cellId,
          date: input.date,
          indicator_code: input.indicatorCode,
          value: input.value,
        },
      ],
    });
  },
};
