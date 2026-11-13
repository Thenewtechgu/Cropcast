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
  deleteUser,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isBootstrapAdminEmail,
  OperationType,
} from '../firebase';
import {
  AdminPlatformStats,
  AdminUserSummary,
  AppUser,
  EarthEnvironmentSnapshot,
  FarmTask,
  FeedbackRecord,
  FieldProfile,
  PlotPlanRecord,
} from '../types';
import { findNearestNasaGrid } from '../data/nasaVietnamGrid';

function normalizeLoginIdentifier(rawInput: string): {
  username: string;
  email: string;
  displayName: string;
} {
  const trimmed = rawInput.trim();
  if (trimmed.includes('@')) {
    const email = trimmed.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      throw new Error('Địa chỉ Email chưa hợp lệ. Vui lòng kiểm tra lại (VD: nongdan@gmail.com).');
    }
    const localPart = email.split('@')[0] || 'farmer';
    return {
      username: localPart.slice(0, 60),
      email,
      displayName: localPart.slice(0, 120) || 'Nông dân CropCast',
    };
  }

  const safeUser = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '');

  if (safeUser.length < 3) {
    throw new Error(
      'Email hoặc tên đăng nhập cần tối thiểu 3 ký tự hợp lệ.'
    );
  }

  return {
    username: safeUser.slice(0, 40),
    email: `${safeUser}@users.cropcast.app`,
    displayName: (trimmed || safeUser).slice(0, 120),
  };
}

function mapAuthErrorMessage(err: any): string {
  const code = err?.code || '';
  if (code === 'auth/email-already-in-use') {
    return 'Email hoặc tài khoản này đã được đăng ký. Vui lòng chuyển sang Đăng nhập.';
  }
  if (code === 'auth/invalid-email') {
    return 'Địa chỉ Email không đúng định dạng.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Email / tên đăng nhập hoặc mật khẩu chưa đúng.';
  }
  if (code === 'auth/weak-password') {
    return 'Mật khẩu quá yếu. Vui lòng dùng ít nhất 6 ký tự.';
  }
  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
    return 'Phương thức Email/Mật khẩu chưa được bật trong Firebase Console (Authentication → Sign-in method → Email/Password). Bạn có thể bật trong Firebase Console hoặc đăng nhập nhanh bằng Google.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Bạn đã đóng cửa sổ đăng nhập Google.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Trình duyệt đang chặn cửa sổ bật lên Google Sign-In. Vui lòng cho phép popup cho trang này.';
  }
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return `Tên miền "${host}" chưa được cấp phép trong Firebase Authentication (Authorized domains). Hãy thêm tên miền này trong Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  return err?.message || 'Không thể đăng nhập lúc này. Vui lòng thử lại.';
}

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

function mapPlotDocToField(d: any, currentUid: string): FieldProfile {
  const data = d.data();
  return {
    id: d.id,
    ownerId: data.ownerId,
    ownerName: data.ownerName,
    sharedWithEmails: data.sharedWithEmails || [],
    sharedWithUids: data.sharedWithUids || [],
    activeShareToken: data.activeShareToken || '',
    isSharedWithMe: data.ownerId !== currentUid,
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
}

export const FirestoreService = {
  async ensureUserProfile(
    fbUser: FirebaseUser,
    fallbackDisplayName?: string,
    fallbackEmail?: string
  ): Promise<void> {
    const userRef = doc(db, 'users', fbUser.uid);
    const resolvedName = (
      fbUser.displayName ||
      fallbackDisplayName ||
      'Nông dân CropCast'
    ).slice(0, 120);
    const resolvedEmail = (fbUser.email || fallbackEmail || '').slice(0, 200);
    const resolvedPhoto = (fbUser.photoURL || '').slice(0, 500);

    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: fbUser.uid,
          displayName: resolvedName,
          email: resolvedEmail,
          photoURL: resolvedPhoto,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      if (isBootstrapAdminEmail(resolvedEmail)) {
        await setDoc(
          doc(db, 'admins', fbUser.uid),
          {
            uid: fbUser.uid,
            email: resolvedEmail,
            grantedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});
      }
    } catch (err) {
      console.warn('Non-blocking user profile sync warning:', err);
    }
  },

  async signUpWithUsername(identifier: string, password: string): Promise<AppUser> {
    const { username: cleanUser, email, displayName } = normalizeLoginIdentifier(identifier);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = result.user;
      await updateProfile(fbUser, { displayName }).catch(() => {});

      await this.ensureUserProfile(fbUser, displayName, email);

      const isAdmin = await this.checkIsAdmin(fbUser.uid, email, fbUser.emailVerified);

      return {
        uid: fbUser.uid,
        username: cleanUser,
        displayName,
        email,
        emailVerified: fbUser.emailVerified,
        isAdmin,
        authMode: 'firebase',
      };
    } catch (err: any) {
      throw new Error(mapAuthErrorMessage(err));
    }
  },

  async signInWithUsername(identifier: string, password: string): Promise<AppUser> {
    const { username: cleanUser, email, displayName } = normalizeLoginIdentifier(identifier);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const fbUser = result.user;
      const resolvedName = (fbUser.displayName || displayName || 'Nông dân CropCast').slice(0, 120);

      await this.ensureUserProfile(fbUser, resolvedName, email);
      const isAdmin = await this.checkIsAdmin(fbUser.uid, fbUser.email || email, fbUser.emailVerified);

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
      throw new Error(mapAuthErrorMessage(err));
    }
  },

  async signInWithGoogle(): Promise<AppUser> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const isAdmin = await this.checkIsAdmin(fbUser.uid, fbUser.email, fbUser.emailVerified);

      const userRef = doc(db, 'users', fbUser.uid);
      const resolvedName = (fbUser.displayName || 'Nông dân CropCast').slice(0, 120);
      const resolvedPhoto = (fbUser.photoURL || '').slice(0, 500);
      const resolvedEmail = fbUser.email || '';
      try {
        const existingSnap = await getDoc(userRef);
        if (!existingSnap.exists()) {
          await setDoc(userRef, {
            uid: fbUser.uid,
            displayName: resolvedName,
            email: resolvedEmail.slice(0, 200),
            photoURL: resolvedPhoto,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(userRef, {
            displayName: resolvedName,
            photoURL: resolvedPhoto,
            updatedAt: serverTimestamp(),
          });
        }
        if (isBootstrapAdminEmail(resolvedEmail)) {
          await setDoc(
            doc(db, 'admins', fbUser.uid),
            {
              uid: fbUser.uid,
              email: resolvedEmail,
              grantedAt: serverTimestamp(),
            },
            { merge: true }
          ).catch(() => {});
        }
      } catch (err) {
        console.warn('Non-blocking google profile sync warning:', err);
      }

      return {
        uid: fbUser.uid,
        displayName: resolvedName,
        email: resolvedEmail,
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
    try {
      await signOut(auth);
    } catch {
      // ignore sign-out error
    }
  },

  async checkIsAdmin(uid: string, email?: string | null, emailVerified?: boolean): Promise<boolean> {
    if (isBootstrapAdminEmail(email)) {
      return true;
    }
    if (!emailVerified) return false;
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
    const sharedRefMap = new Map<string, FieldProfile>();
    const sharedEmailMap = new Map<string, FieldProfile>();

    const emitMerged = () => {
      const merged = new Map<string, FieldProfile>();
      sharedEmailMap.forEach((v, k) => merged.set(k, v));
      sharedRefMap.forEach((v, k) => merged.set(k, v));
      ownedMap.forEach((v, k) => merged.set(k, v));
      onData(Array.from(merged.values()));
    };

    const plotsPath = `users/${uid}/plots`;
    const unsubOwned = onSnapshot(
      collection(db, 'users', uid, 'plots'),
      (snap) => {
        ownedMap.clear();
        snap.docs.forEach((d) => ownedMap.set(d.id, mapPlotDocToField(d, uid)));
        emitMerged();
      },
      (err) => {
        if (onError) onError(err);
        handleFirestoreError(err, OperationType.LIST, plotsPath);
      }
    );

    const sharedRefsPath = `users/${uid}/shared_refs`;
    const unsubSharedRefs = onSnapshot(
      collection(db, 'users', uid, 'shared_refs'),
      async (snap) => {
        const nextMap = new Map<string, FieldProfile>();
        await Promise.all(
          snap.docs.map(async (refDoc) => {
            const refData = refDoc.data();
            const ownerId = String(refData.ownerId || '');
            const plotId = String(refData.plotId || refDoc.id);
            if (!ownerId || !plotId || ownerId === uid) return;
            try {
              const plotSnap = await getDoc(doc(db, 'users', ownerId, 'plots', plotId));
              if (plotSnap.exists()) {
                nextMap.set(plotSnap.id, mapPlotDocToField(plotSnap, uid));
              }
            } catch {
              // Revoked or inaccessible shared plot — silently omit
            }
          })
        );
        sharedRefMap.clear();
        nextMap.forEach((v, k) => sharedRefMap.set(k, v));
        emitMerged();
      },
      (err) => {
        if (onError) onError(err);
        handleFirestoreError(err, OperationType.LIST, sharedRefsPath);
      }
    );

    let unsubSharedEmail = () => {};
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (normalizedEmail) {
      unsubSharedEmail = onSnapshot(
        query(collection(db, 'field_shares'), where('targetEmail', '==', normalizedEmail)),
        async (snap) => {
          const nextMap = new Map<string, FieldProfile>();
          await Promise.all(
            snap.docs.map(async (shareDoc) => {
              const shareData = shareDoc.data();
              if (shareData.isActive === false) return;
              const ownerId = String(shareData.ownerId || '');
              const plotId = String(shareData.fieldId || '');
              if (!ownerId || !plotId || ownerId === uid) return;
              try {
                const plotSnap = await getDoc(doc(db, 'users', ownerId, 'plots', plotId));
                if (plotSnap.exists()) {
                  nextMap.set(plotSnap.id, mapPlotDocToField(plotSnap, uid));
                }
              } catch {
                // Revoked or inaccessible email invite
              }
            })
          );
          sharedEmailMap.clear();
          nextMap.forEach((v, k) => sharedEmailMap.set(k, v));
          emitMerged();
        },
        () => {
          // Ignore secondary listener permission edge cases
        }
      );
    }

    return () => {
      unsubOwned();
      unsubSharedRefs();
      unsubSharedEmail();
    };
  },

  subscribeUserTasks(uid: string, onData: (tasks: FarmTask[]) => void) {
    const tasksPath = `users/${uid}/tasks`;
    return onSnapshot(
      collection(db, 'users', uid, 'tasks'),
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
      (err) => handleFirestoreError(err, OperationType.LIST, tasksPath)
    );
  },

  subscribeUserFeedbacks(uid: string, onData: (items: FeedbackRecord[]) => void) {
    const feedbacksPath = `users/${uid}/feedbacks`;
    return onSnapshot(
      collection(db, 'users', uid, 'feedbacks'),
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
      (err) => handleFirestoreError(err, OperationType.LIST, feedbacksPath)
    );
  },

  subscribeUserPlans(uid: string, onData: (plans: Record<string, PlotPlanRecord>) => void) {
    const plansPath = `users/${uid}/plans`;
    return onSnapshot(
      collection(db, 'users', uid, 'plans'),
      (snap) => {
        const record: Record<string, PlotPlanRecord> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          const plotId = String(data.plotId || d.id);
          record[plotId] = {
            id: d.id,
            ownerId: String(data.ownerId || uid),
            plotId,
            priorities: Array.isArray(data.priorities) ? data.priorities : [],
            constraints: data.constraints || {
              waterAvailability: 'seasonal_limited',
              equipmentAccess: 'basic_manual',
              marketPreference: 'mixed_family',
            },
            activeStrategy: data.activeStrategy || undefined,
            rejectedIds: Array.isArray(data.rejectedIds) ? data.rejectedIds : [],
            rejectedTitles: Array.isArray(data.rejectedTitles) ? data.rejectedTitles : [],
            lastRejectionNote: data.lastRejectionNote || undefined,
            calendarCropKey: data.calendarCropKey || undefined,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || undefined,
          };
        });
        onData(record);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, plansPath)
    );
  },

  async savePlotPlan(
    uid: string,
    plotId: string,
    planData: Omit<PlotPlanRecord, 'id' | 'ownerId' | 'plotId' | 'updatedAt'>
  ): Promise<void> {
    const planId = plotId;
    const planPath = `users/${uid}/plans/${planId}`;
    const ref = doc(db, 'users', uid, 'plans', planId);

    const payload: Record<string, any> = {
      ownerId: uid,
      plotId,
      priorities: (planData.priorities || []).slice(0, 10),
      constraints: planData.constraints,
      rejectedIds: (planData.rejectedIds || []).slice(0, 30),
      rejectedTitles: (planData.rejectedTitles || []).slice(0, 30),
      updatedAt: serverTimestamp(),
    };
    if (planData.activeStrategy) {
      payload.activeStrategy = planData.activeStrategy;
    }
    if (planData.lastRejectionNote) {
      payload.lastRejectionNote = planData.lastRejectionNote.slice(0, 500);
    }
    if (planData.calendarCropKey) {
      payload.calendarCropKey = planData.calendarCropKey.slice(0, 40);
    }

    try {
      const existingSnap = await getDoc(ref);
      if (existingSnap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, planPath);
    }
  },

  async saveEarthMetricsSnapshot(
    uid: string,
    plotId: string,
    snapshot: EarthEnvironmentSnapshot
  ): Promise<void> {
    const metricPath = `users/${uid}/earth_metrics/${plotId}`;
    const ref = doc(db, 'users', uid, 'earth_metrics', plotId);
    const payload: Record<string, any> = {
      ownerId: uid,
      fieldId: plotId,
      syncedAt: snapshot.syncedAt.slice(0, 40),
      sustainabilityScore: Number(snapshot.sustainabilityScore) || 0,
      rotationAdvice: (snapshot.rotationAdvice || '').slice(0, 600),
      rotationAdviceEn: (snapshot.rotationAdviceEn || '').slice(0, 600),
      nasaPowerLastUpdated: (snapshot.nasaPowerLastUpdated || '').slice(0, 40),
      smapModis: snapshot.smapModis || null,
      carbonFluxOco2: snapshot.carbonFluxOco2,
      groundwaterAnomalyGrace: snapshot.groundwaterAnomalyGrace,
      greenhouseGasEdgar: snapshot.greenhouseGasEdgar,
      updatedAt: serverTimestamp(),
    };

    try {
      const existingSnap = await getDoc(ref);
      if (existingSnap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, metricPath);
    }
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

    const plotPath = `users/${uid}/plots/${fieldId}`;
    try {
      await setDoc(doc(db, 'users', uid, 'plots', fieldId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, plotPath);
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

  async updateField(uid: string, field: FieldProfile): Promise<void> {
    const targetOwnerUid = field.ownerId || uid;
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
    const plotPath = `users/${targetOwnerUid}/plots/${field.id}`;
    try {
      await updateDoc(doc(db, 'users', targetOwnerUid, 'plots', field.id), updateData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, plotPath);
    }
  },

  async deleteField(uid: string, fieldId: string): Promise<void> {
    const plotPath = `users/${uid}/plots/${fieldId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'plots', fieldId));
      // Best-effort cleanup of child plan, earth metrics, tasks, feedbacks
      await Promise.all([
        deleteDoc(doc(db, 'users', uid, 'plans', fieldId)).catch(() => {}),
        deleteDoc(doc(db, 'users', uid, 'earth_metrics', fieldId)).catch(() => {}),
        getDocs(query(collection(db, 'users', uid, 'tasks'), where('fieldId', '==', fieldId)))
          .then((snap) => Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {}))))
          .catch(() => {}),
        getDocs(query(collection(db, 'users', uid, 'feedbacks'), where('fieldId', '==', fieldId)))
          .then((snap) => Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {}))))
          .catch(() => {}),
      ]);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, plotPath);
    }
  },

  async createTasks(uid: string, tasks: FarmTask[]): Promise<void> {
    for (const t of tasks) {
      const taskId = `TASK_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const taskPath = `users/${uid}/tasks/${taskId}`;
      try {
        await setDoc(doc(db, 'users', uid, 'tasks', taskId), {
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
        handleFirestoreError(err, OperationType.CREATE, taskPath);
      }
    }
  },

  async updateTaskStatus(
    uid: string,
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
    const taskPath = `users/${uid}/tasks/${taskId}`;
    try {
      await updateDoc(doc(db, 'users', uid, 'tasks', taskId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, taskPath);
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
    const fbPath = `users/${uid}/feedbacks/${fbId}`;
    try {
      await setDoc(doc(db, 'users', uid, 'feedbacks', fbId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, fbPath);
    }
  },

  // Admin-only NASA dataset persistence in Firestore
  async saveNasaDatasetUpload(
    uid: string,
    dataset: Omit<UploadedNasaDatasetDoc, 'id' | 'uploadedBy' | 'isPublic' | 'createdAt'>
  ): Promise<string> {
    const datasetId = `NASA_DS_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const dsPath = `nasa_datasets/${datasetId}`;
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
      handleFirestoreError(err, OperationType.CREATE, dsPath);
    }
    return datasetId;
  },

  async rollbackNasaDatasetVersion(targetVersion: string): Promise<string> {
    try {
      const snap = await getDocs(collection(db, 'nasa_datasets'));
      const docs = snap.docs
        .map((d) => ({ id: d.id, ref: d.ref, ...(d.data() as Omit<UploadedNasaDatasetDoc, 'id'>) }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

      const targetDoc = docs.find((d) => d.version === targetVersion);
      const targetMs = targetDoc?.createdAt?.toMillis?.() || 0;

      await Promise.all(
        docs.map(async (d) => {
          if (d.version === targetVersion) {
            await updateDoc(d.ref, {
              status: 'COMPLETED',
              isPublic: true,
              updatedAt: serverTimestamp(),
            });
          } else if (targetDoc && (d.createdAt?.toMillis?.() || 0) > targetMs) {
            await updateDoc(d.ref, {
              status: 'ROLLED_BACK',
              isPublic: false,
              updatedAt: serverTimestamp(),
            });
          }
        })
      );

      return targetVersion;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'nasa_datasets');
    }
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
    const logPath = `nasa_sync_logs/${logId}`;
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
      handleFirestoreError(err, OperationType.CREATE, logPath);
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
    const sharePath = `field_shares/${shareToken}`;
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
      await updateDoc(doc(db, 'users', ownerUid, 'plots', field.id), {
        activeShareToken: shareToken,
        ownerName: (ownerName || 'Nông dân CropCast').slice(0, 120),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, sharePath);
    }
    return shareToken;
  },

  async revokeFieldShareLink(
    ownerUid: string,
    fieldId: string,
    shareToken?: string
  ): Promise<void> {
    const plotPath = `users/${ownerUid}/plots/${fieldId}`;
    try {
      if (shareToken) {
        await updateDoc(doc(db, 'field_shares', shareToken), {
          isActive: false,
        }).catch(() => {});
      }
      await updateDoc(doc(db, 'users', ownerUid, 'plots', fieldId), {
        activeShareToken: '',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, plotPath);
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
    const plotPath = `users/${ownerUid}/plots/${field.id}`;
    try {
      await updateDoc(doc(db, 'users', ownerUid, 'plots', field.id), {
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
      handleFirestoreError(err, OperationType.UPDATE, plotPath);
    }
    return targetEmail;
  },

  async removeSharedEmail(ownerUid: string, fieldId: string, email: string): Promise<void> {
    const plotPath = `users/${ownerUid}/plots/${fieldId}`;
    const normalized = email.trim().toLowerCase();
    try {
      await updateDoc(doc(db, 'users', ownerUid, 'plots', fieldId), {
        sharedWithEmails: arrayRemove(normalized),
        updatedAt: serverTimestamp(),
      });
      // Deactivate matching email share invites owned by ownerUid
      const sharesSnap = await getDocs(
        query(collection(db, 'field_shares'), where('ownerId', '==', ownerUid))
      );
      await Promise.all(
        sharesSnap.docs
          .filter((d) => {
            const s = d.data();
            return (
              s.fieldId === fieldId &&
              s.shareType === 'email' &&
              String(s.targetEmail || '').toLowerCase() === normalized &&
              s.isActive === true
            );
          })
          .map((d) => updateDoc(d.ref, { isActive: false }).catch(() => {}))
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, plotPath);
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
    const ownerId = String(shareData.ownerId || '');
    if (!fieldId || !ownerId) {
      throw new Error('Liên kết chia sẻ không hợp lệ.');
    }

    if (ownerId !== uid) {
      const plotRef = doc(db, 'users', ownerId, 'plots', fieldId);
      const plotPath = `users/${ownerId}/plots/${fieldId}`;
      try {
        await updateDoc(plotRef, {
          sharedWithUids: arrayUnion(uid),
          presentedShareToken: shareToken,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, plotPath);
      }

      const refPath = `users/${uid}/shared_refs/${fieldId}`;
      try {
        await setDoc(doc(db, 'users', uid, 'shared_refs', fieldId), {
          recipientUid: uid,
          ownerId,
          plotId: fieldId,
          shareToken,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, refPath);
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
      const [usersSnap, adminsSnap, sharesSnap, datasetsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'admins')),
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

      const perUserSnaps = await Promise.all(
        usersSnap.docs.map(async (uDoc) => {
          const uid = uDoc.id;
          const [plotsSnap, tasksSnap, feedbacksSnap] = await Promise.all([
            getDocs(collection(db, 'users', uid, 'plots')),
            getDocs(collection(db, 'users', uid, 'tasks')),
            getDocs(collection(db, 'users', uid, 'feedbacks')),
          ]);
          return { uid, plotsSnap, tasksSnap, feedbacksSnap };
        })
      );

      const fieldStatsByOwner = new Map<string, { count: number; areaHa: number }>();
      const provinceMap = new Map<string, { count: number; areaHa: number }>();
      const cropMap = new Map<string, number>();
      const soilMap = new Map<string, number>();

      let totalFields = 0;
      let totalAreaHa = 0;
      let totalTasks = 0;
      let completedTasks = 0;
      let pendingTasks = 0;
      let totalFeedbacks = 0;
      const allFields: AdminPlatformStats['allFields'] = [];

      for (const { uid, plotsSnap, tasksSnap, feedbacksSnap } of perUserSnaps) {
        totalFields += plotsSnap.size;
        totalTasks += tasksSnap.size;
        totalFeedbacks += feedbacksSnap.size;

        tasksSnap.docs.forEach((d) => {
          const status = d.data().status;
          if (status === 'completed') completedTasks++;
          else if (status === 'pending' || status === 'skipped') pendingTasks++;
        });

        plotsSnap.docs.forEach((d) => {
          const data = d.data();
          const area = Number(data.areaHa) || 0;
          totalAreaHa += area;

          const oid = String(data.ownerId || uid);
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
      }

      allFields.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

      const users: AdminUserSummary[] = usersSnap.docs.map((d) => {
        const data = d.data();
        const email = String(data.email || '');
        const ownerStat = fieldStatsByOwner.get(d.id) || { count: 0, areaHa: 0 };
        const isBootstrap = isBootstrapAdminEmail(email);
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

      const totalActiveShares = sharesSnap.docs.filter((d) => d.data().isActive === true).length;

      return {
        totalUsers: users.length,
        totalFields,
        totalAreaHa: Number(totalAreaHa.toFixed(2)),
        totalTasks,
        completedTasks,
        pendingTasks,
        totalFeedbacks,
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
          email: targetEmail.slice(0, 200),
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

  async deleteUserAccount(uid: string): Promise<void> {
    const userPath = `users/${uid}`;
    try {
      const [plotsSnap, tasksSnap, feedbacksSnap, plansSnap, metricsSnap, sharesSnap] = await Promise.all([
        getDocs(collection(db, 'users', uid, 'plots')),
        getDocs(collection(db, 'users', uid, 'tasks')),
        getDocs(collection(db, 'users', uid, 'feedbacks')),
        getDocs(collection(db, 'users', uid, 'plans')),
        getDocs(collection(db, 'users', uid, 'earth_metrics')),
        getDocs(collection(db, 'users', uid, 'shared_refs')),
      ]);

      await Promise.all([
        ...plotsSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})),
        ...tasksSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})),
        ...feedbacksSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})),
        ...plansSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})),
        ...metricsSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})),
        ...sharesSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})),
        deleteDoc(doc(db, 'users', uid)).catch(() => {}),
        deleteDoc(doc(db, 'admins', uid)).catch(() => {}),
      ]);

      if (auth.currentUser && auth.currentUser.uid === uid) {
        try {
          await deleteUser(auth.currentUser);
        } catch {
          await signOut(auth);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, userPath);
    }
  },
};
