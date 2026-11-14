import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import appletConfig from '../firebase-applet-config.json';

const env = import.meta.env;

const envVal = (key: keyof ImportMetaEnv): string => String(env[key] || '').trim();

const explicitProjectId = envVal('VITE_FIREBASE_PROJECT_ID');
const isOverriddenProject = Boolean(
  explicitProjectId && explicitProjectId !== appletConfig.projectId
);
const rawDbId = envVal('VITE_FIREBASE_DATABASE_ID');
const resolvedDatabaseId = rawDbId
  ? rawDbId === '(default)'
    ? ''
    : rawDbId
  : isOverriddenProject
  ? ''
  : appletConfig.firestoreDatabaseId || '';

const resolvedMeasurementId =
  envVal('VITE_FIREBASE_MEASUREMENT_ID') ||
  (!isOverriddenProject ? appletConfig.measurementId || '' : '');

const firebaseConfig = {
  apiKey: envVal('VITE_FIREBASE_API_KEY') || appletConfig.apiKey,
  authDomain: envVal('VITE_FIREBASE_AUTH_DOMAIN') || appletConfig.authDomain,
  projectId: explicitProjectId || appletConfig.projectId,
  storageBucket: envVal('VITE_FIREBASE_STORAGE_BUCKET') || appletConfig.storageBucket,
  messagingSenderId: envVal('VITE_FIREBASE_MESSAGING_SENDER_ID') || appletConfig.messagingSenderId,
  appId: envVal('VITE_FIREBASE_APP_ID') || appletConfig.appId,
  ...(resolvedMeasurementId ? { measurementId: resolvedMeasurementId } : {}),
};

const app = initializeApp(firebaseConfig);
export const db = resolvedDatabaseId
  ? getFirestore(app, resolvedDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const BOOTSTRAP_ADMIN_EMAILS = [
  'vanha.uow@gmail.com',
  'fss01211cg@gmail.com',
  'lamphuongh88@gmail.com',
] as const;

export const BOOTSTRAP_ADMIN_EMAIL = BOOTSTRAP_ADMIN_EMAILS[0];

export function isBootstrapAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return BOOTSTRAP_ADMIN_EMAILS.some((e) => e.toLowerCase() === normalized);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();
