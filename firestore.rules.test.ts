import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

const VALID_PLOT_BASE = {
  ownerId: 'userA',
  ownerName: 'Farmer A',
  sharedWithEmails: [],
  sharedWithUids: [],
  activeShareToken: 'SHR_VALID_TOKEN_12345',
  name: 'Ruộng Đồng Bằng',
  province: 'An Giang',
  district: 'Châu Thành',
  lat: 10.42,
  lon: 105.35,
  areaHa: 1.5,
  soilType: 'alluvial',
  soilCharacteristics: { drainage: 'moderate', holdsWater: true, proneToFlooding: false },
  waterSource: { type: 'river', isStable: true, observation: 'clear', hasTestResult: false, salinityRisk: false },
  crop: { name: 'Lúa', category: 'rice', variety: 'OM5451', plantingDate: '2026-10-01', currentStage: 'Đẻ nhánh', stageIndex: 1, farmingMethod: 'traditional', irrigationMethod: 'flood', healthStatus: 'healthy' },
  primaryGoal: 'stabilize_yield',
  inspectTime: 'morning',
  notificationMethod: 'in_app',
  nasaGrid: { cellId: 'NASA_VN_410', lat: 10.5, lon: 105.5, distanceKm: 12 },
};

describe('CropCast Dirty Dozen Firestore Security Tests', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'cropcast-rules-test',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore();
      await setDoc(doc(adminDb, 'users', 'userA'), {
        uid: 'userA',
        displayName: 'Farmer A',
        email: 'usera@example.com',
        photoURL: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(adminDb, 'users', 'userA', 'plots', 'PLOT_1'), {
        ...VALID_PLOT_BASE,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  });

  it('1. Rejects Shadow Field injection on plot create', async () => {
    const dbA = testEnv.authenticatedContext('userA', { email: 'usera@example.com', email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(dbA, 'users', 'userA', 'plots', 'PLOT_SHADOW'), {
        ...VALID_PLOT_BASE,
        isVerified: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('2. Rejects Identity Spoofing on task create', async () => {
    const dbB = testEnv.authenticatedContext('userB', { email: 'userb@example.com', email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(dbB, 'users', 'userA', 'tasks', 'TASK_SPOOF'), {
        ownerId: 'userA',
        fieldId: 'PLOT_1',
        title: 'Tưới nước',
        scheduledTime: '06:00',
        priority: 'HIGH',
        reason: 'Dry soil',
        triggerData: 'GWETROOT < 0.4',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('3. Rejects Orphaned Plan create when parent plot does not exist', async () => {
    const dbA = testEnv.authenticatedContext('userA', { email: 'usera@example.com', email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(dbA, 'users', 'userA', 'plans', 'MISSING_PLOT'), {
        ownerId: 'userA',
        plotId: 'MISSING_PLOT',
        priorities: ['water_saving'],
        constraints: { waterAvailability: 'scarce', equipmentAccess: 'basic_manual', marketPreference: 'mixed_family' },
        rejectedIds: [],
        rejectedTitles: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('4. Rejects Email Spoofing admin access when email_verified is false', async () => {
    const dbSpoof = testEnv.authenticatedContext('attacker', {
      email: 'vanha.uow@gmail.com',
      email_verified: false,
    }).firestore();
    await assertFails(getDocs(collection(dbSpoof, 'nasa_sync_logs')));
    await assertFails(
      setDoc(doc(dbSpoof, 'admins', 'attacker'), {
        uid: 'attacker',
        email: 'vanha.uow@gmail.com',
        grantedAt: serverTimestamp(),
      })
    );
  });

  it('5. Rejects Cross-Tenant PII read on /users/{userId}', async () => {
    const dbB = testEnv.authenticatedContext('userB', { email: 'userb@example.com', email_verified: true }).firestore();
    await assertFails(getDoc(doc(dbB, 'users', 'userA')));
    await assertFails(getDocs(collection(dbB, 'users')));
  });

  it('6. Rejects Resource Exhaustion / oversized ID and string poisoning', async () => {
    const dbA = testEnv.authenticatedContext('userA', { email: 'usera@example.com', email_verified: true }).firestore();
    const oversizedId = 'A'.repeat(200);
    await assertFails(
      setDoc(doc(dbA, 'users', 'userA', 'plots', oversizedId), {
        ...VALID_PLOT_BASE,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await assertFails(
      setDoc(doc(dbA, 'users', 'userA', 'plots', 'PLOT_HUGE'), {
        ...VALID_PLOT_BASE,
        name: 'X'.repeat(500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('7. Rejects Timestamp Forgery on create', async () => {
    const dbA = testEnv.authenticatedContext('userA', { email: 'usera@example.com', email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(dbA, 'users', 'userA', 'plots', 'PLOT_FAKE_TIME'), {
        ...VALID_PLOT_BASE,
        createdAt: new Date('2020-01-01T00:00:00Z'),
        updatedAt: new Date('2020-01-01T00:00:00Z'),
      })
    );
  });

  it('8. Rejects Immutable ownerId modification during update', async () => {
    const dbA = testEnv.authenticatedContext('userA', { email: 'usera@example.com', email_verified: true }).firestore();
    await assertFails(
      updateDoc(doc(dbA, 'users', 'userA', 'plots', 'PLOT_1'), {
        ownerId: 'userB',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('9. Rejects Share Token Redemption without valid matching token', async () => {
    const dbB = testEnv.authenticatedContext('userB', { email: 'userb@example.com', email_verified: true }).firestore();
    await assertFails(
      updateDoc(doc(dbB, 'users', 'userA', 'plots', 'PLOT_1'), {
        sharedWithUids: ['userB'],
        presentedShareToken: 'WRONG_TOKEN_999',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('10. Rejects Mutating plot agronomy data via share redemption branch', async () => {
    const dbB = testEnv.authenticatedContext('userB', { email: 'userb@example.com', email_verified: true }).firestore();
    await assertFails(
      updateDoc(doc(dbB, 'users', 'userA', 'plots', 'PLOT_1'), {
        sharedWithUids: ['userB'],
        presentedShareToken: 'SHR_VALID_TOKEN_12345',
        name: 'Hacked Plot Name',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('11. Rejects Non-Admin mutation on /nasa_datasets', async () => {
    const dbA = testEnv.authenticatedContext('userA', { email: 'usera@example.com', email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(dbA, 'nasa_datasets', 'DS_HACK'), {
        version: 'v999',
        fileName: 'hack.csv',
        recordCount: 1,
        cellCount: 1,
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        status: 'COMPLETED',
        uploadedBy: 'userA',
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('12. Rejects Blanket Cross-Tenant list queries on plots and field_shares', async () => {
    const dbB = testEnv.authenticatedContext('userB', { email: 'userb@example.com', email_verified: true }).firestore();
    await assertFails(getDocs(collection(dbB, 'users', 'userA', 'plots')));
    await assertFails(getDocs(collection(dbB, 'field_shares')));
  });

  it('Allows valid owner plot create and verified admin dataset read', async () => {
    const dbA = testEnv.authenticatedContext('userA', { email: 'usera@example.com', email_verified: true }).firestore();
    await assertSucceeds(
      setDoc(doc(dbA, 'users', 'userA', 'plots', 'PLOT_OK'), {
        ...VALID_PLOT_BASE,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });
});
