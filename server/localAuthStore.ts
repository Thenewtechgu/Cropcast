import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { findNearestNasaGrid } from '../src/data/nasaVietnamGrid.ts';

const STORE_DIR = path.resolve(process.cwd(), '.data');
const STORE_FILE = path.join(STORE_DIR, 'local_auth_store.json');
const TOKEN_SECRET =
  process.env.LOCAL_AUTH_SECRET ||
  process.env.GEMINI_API_KEY ||
  'cropcast-local-session-secret-v1';

interface LocalUserRecord {
  uid: string;
  username: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

interface LocalShareRecord {
  token: string;
  fieldId: string;
  fieldName: string;
  ownerId: string;
  ownerName: string;
  shareType: 'link' | 'email';
  targetUsernameOrEmail?: string;
  isActive: boolean;
  createdAt: string;
}

interface LocalStoreState {
  users: LocalUserRecord[];
  fields: Record<string, any>[];
  tasks: Record<string, any>[];
  feedbacks: Record<string, any>[];
  shares: LocalShareRecord[];
}

let store: LocalStoreState = {
  users: [],
  fields: [],
  tasks: [],
  feedbacks: [],
  shares: [],
};

function loadStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) return;
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.users)) store.users = parsed.users;
    if (Array.isArray(parsed.fields)) store.fields = parsed.fields;
    if (Array.isArray(parsed.tasks)) store.tasks = parsed.tasks;
    if (Array.isArray(parsed.feedbacks)) store.feedbacks = parsed.feedbacks;
    if (Array.isArray(parsed.shares)) store.shares = parsed.shares;
  } catch (err) {
    console.warn('[LocalAuthStore] Could not load persisted store:', err);
  }
}

function saveStore() {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(store), 'utf-8');
  } catch (err) {
    console.warn('[LocalAuthStore] Could not save store:', err);
  }
}

loadStore();

export function normalizeUsernameInput(raw: string): { username: string; displayName: string } {
  const trimmed = raw.trim();
  const base = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
  const normalized = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '');

  if (normalized.length < 3) {
    throw new Error('Tên đăng nhập cần tối thiểu 3 ký tự (chữ cái, số, dấu chấm hoặc gạch dưới).');
  }
  return {
    username: normalized.slice(0, 40),
    displayName: trimmed.slice(0, 80) || normalized,
  };
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function signSessionToken(uid: string, username: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid, username, iat: Date.now() }),
    'utf-8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): { uid: string; username: string } | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!decoded?.uid || !decoded?.username) return null;
    const user = store.users.find((u) => u.uid === decoded.uid);
    if (!user) return null;
    return { uid: user.uid, username: user.username };
  } catch {
    return null;
  }
}

export function getUserByUid(uid: string) {
  const user = store.users.find((u) => u.uid === uid);
  if (!user) return null;
  return {
    uid: user.uid,
    username: user.username,
    displayName: user.displayName,
    email: '',
    emailVerified: false,
    isAdmin: false,
    authMode: 'local_server' as const,
  };
}

export function registerUsernameUser(rawUsername: string, password: string) {
  if (!password || password.length < 6) {
    throw new Error('Mật khẩu cần ít nhất 6 ký tự.');
  }
  const { username, displayName } = normalizeUsernameInput(rawUsername);
  const existing = store.users.find((u) => u.username === username);
  if (existing) {
    throw new Error('Tên đăng nhập này đã có người sử dụng. Vui lòng chọn tên khác hoặc Đăng nhập.');
  }

  const uid = `usr_${crypto.randomBytes(8).toString('hex')}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);

  const record: LocalUserRecord = {
    uid,
    username,
    displayName,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };
  store.users.push(record);
  saveStore();

  const token = signSessionToken(uid, username);
  return {
    token,
    user: {
      uid,
      username,
      displayName,
      email: '',
      emailVerified: false,
      isAdmin: false,
      authMode: 'local_server' as const,
    },
  };
}

export function loginUsernameUser(rawUsername: string, password: string) {
  const { username } = normalizeUsernameInput(rawUsername);
  const user = store.users.find((u) => u.username === username);
  if (!user) {
    throw new Error('Tên đăng nhập chưa tồn tại hoặc mật khẩu chưa đúng.');
  }
  const attempt = hashPassword(password, user.salt);
  const a = Buffer.from(attempt, 'hex');
  const b = Buffer.from(user.passwordHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Tên đăng nhập hoặc mật khẩu chưa đúng.');
  }

  const token = signSessionToken(user.uid, user.username);
  return {
    token,
    user: {
      uid: user.uid,
      username: user.username,
      displayName: user.displayName,
      email: '',
      emailVerified: false,
      isAdmin: false,
      authMode: 'local_server' as const,
    },
  };
}

// Local Field/Task/Feedback CRUD for username-only accounts
export function listFieldsForUser(uid: string, username: string) {
  const lower = username.toLowerCase();
  return store.fields
    .filter(
      (f) =>
        f.ownerId === uid ||
        (Array.isArray(f.sharedWithUids) && f.sharedWithUids.includes(uid)) ||
        (Array.isArray(f.sharedWithEmails) && f.sharedWithEmails.includes(lower))
    )
    .map((f) => ({
      ...f,
      isSharedWithMe: f.ownerId !== uid,
    }));
}

export function createFieldForUser(uid: string, fieldData: Record<string, any>) {
  const owner = store.users.find((u) => u.uid === uid);
  const fieldId = `FIELD_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const { cell, distanceKm } = findNearestNasaGrid(Number(fieldData.lat), Number(fieldData.lon));
  const nasaGrid = {
    cellId: cell.cellId,
    lat: cell.lat,
    lon: cell.lon,
    distanceKm,
  };
  const newField = {
    ...fieldData,
    id: fieldId,
    ownerId: uid,
    ownerName: owner?.displayName || 'Nông dân CropCast',
    sharedWithEmails: [],
    sharedWithUids: [],
    activeShareToken: '',
    nasaGrid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.fields.push(newField);
  saveStore();
  return newField;
}

export function updateFieldForUser(uid: string, field: Record<string, any>) {
  const idx = store.fields.findIndex((f) => f.id === field.id && f.ownerId === uid);
  if (idx === -1) throw new Error('Không tìm thấy thửa ruộng hoặc bạn không có quyền sửa.');
  const { cell, distanceKm } = findNearestNasaGrid(Number(field.lat), Number(field.lon));
  const updated = {
    ...store.fields[idx],
    ...field,
    ownerId: store.fields[idx].ownerId,
    nasaGrid: {
      cellId: cell.cellId,
      lat: cell.lat,
      lon: cell.lon,
      distanceKm,
    },
    updatedAt: new Date().toISOString(),
  };
  store.fields[idx] = updated;
  saveStore();
  return updated;
}

export function deleteFieldForUser(uid: string, fieldId: string) {
  store.fields = store.fields.filter((f) => !(f.id === fieldId && f.ownerId === uid));
  store.tasks = store.tasks.filter((t) => !(t.fieldId === fieldId && t.ownerId === uid));
  store.feedbacks = store.feedbacks.filter((fb) => !(fb.fieldId === fieldId && fb.ownerId === uid));
  saveStore();
}

export function listTasksForUser(uid: string) {
  return store.tasks.filter((t) => t.ownerId === uid);
}

export function createTasksForUser(uid: string, tasks: Array<Record<string, any>>) {
  const created: Record<string, any>[] = [];
  for (const t of tasks) {
    const item = {
      ...t,
      id: `TASK_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ownerId: uid,
      status: t.status || 'pending',
      createdAt: new Date().toISOString(),
    };
    store.tasks.push(item);
    created.push(item);
  }
  saveStore();
  return created;
}

export function updateTaskForUser(uid: string, taskId: string, status: string, note?: string) {
  const task = store.tasks.find((t) => t.id === taskId && t.ownerId === uid);
  if (!task) throw new Error('Không tìm thấy công việc.');
  task.status = status;
  if (note) task.farmerNote = note;
  task.updatedAt = new Date().toISOString();
  saveStore();
  return task;
}

export function listFeedbacksForUser(uid: string) {
  return store.feedbacks.filter((fb) => fb.ownerId === uid);
}

export function createFeedbackForUser(uid: string, fb: Record<string, any>) {
  const item = {
    ...fb,
    id: `FB_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ownerId: uid,
    timestamp: new Date().toISOString(),
  };
  store.feedbacks.push(item);
  saveStore();
  return item;
}

export function createShareLinkForUser(uid: string, fieldId: string) {
  const field = store.fields.find((f) => f.id === fieldId && f.ownerId === uid);
  if (!field) throw new Error('Không tìm thấy thửa ruộng.');
  const owner = store.users.find((u) => u.uid === uid);
  const token = `SHR_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  field.activeShareToken = token;
  store.shares.push({
    token,
    fieldId,
    fieldName: field.name,
    ownerId: uid,
    ownerName: owner?.displayName || 'Nông dân CropCast',
    shareType: 'link',
    isActive: true,
    createdAt: new Date().toISOString(),
  });
  saveStore();
  return token;
}

export function revokeShareLinkForUser(uid: string, fieldId: string) {
  const field = store.fields.find((f) => f.id === fieldId && f.ownerId === uid);
  if (!field) return;
  if (field.activeShareToken) {
    const share = store.shares.find((s) => s.token === field.activeShareToken);
    if (share) share.isActive = false;
  }
  field.activeShareToken = '';
  saveStore();
}

export function shareFieldByTargetForUser(uid: string, fieldId: string, targetInput: string) {
  const field = store.fields.find((f) => f.id === fieldId && f.ownerId === uid);
  if (!field) throw new Error('Không tìm thấy thửa ruộng.');
  const target = targetInput.trim().toLowerCase();
  if (!target || target.length < 3) throw new Error('Tên đăng nhập hoặc email người nhận chưa hợp lệ.');
  if (!Array.isArray(field.sharedWithEmails)) field.sharedWithEmails = [];
  if (!field.sharedWithEmails.includes(target)) {
    field.sharedWithEmails.push(target);
  }
  saveStore();
  return target;
}

export function removeSharedTargetForUser(uid: string, fieldId: string, target: string) {
  const field = store.fields.find((f) => f.id === fieldId && f.ownerId === uid);
  if (!field || !Array.isArray(field.sharedWithEmails)) return;
  field.sharedWithEmails = field.sharedWithEmails.filter((e: string) => e !== target.toLowerCase());
  saveStore();
}

export function redeemShareLinkForUser(uid: string, token: string) {
  const share = store.shares.find((s) => s.token === token);
  if (!share || !share.isActive) {
    throw new Error('Liên kết chia sẻ không tồn tại hoặc đã bị thu hồi.');
  }
  const field = store.fields.find((f) => f.id === share.fieldId);
  if (!field) throw new Error('Thửa ruộng được chia sẻ không còn tồn tại.');
  if (field.ownerId !== uid) {
    if (!Array.isArray(field.sharedWithUids)) field.sharedWithUids = [];
    if (!field.sharedWithUids.includes(uid)) {
      field.sharedWithUids.push(uid);
    }
  }
  saveStore();
  return {
    fieldId: field.id,
    fieldName: share.fieldName,
    ownerName: share.ownerName,
  };
}
