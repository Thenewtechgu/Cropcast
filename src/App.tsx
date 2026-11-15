import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { FirestoreService } from './services/firestoreService';
import { StorageService } from './services/storage';
import {
  analyzeFieldAgronomy,
  evaluateFieldCheckIn,
  FieldCheckInDiagnostic,
  FieldCheckInInput,
  generateTasksFromBrief,
} from './services/agronomyEngine';
import {
  buildClimaticBaselineWeather,
  fetchFieldLiveWeather,
} from './services/weatherService';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { DashboardView } from './components/DashboardView';
import { RotationExplorerView } from './components/RotationExplorerView';
import { MyFieldsView } from './components/MyFieldsView';
import { TasksView } from './components/TasksView';
import { NasaAnalyticsView } from './components/NasaAnalyticsView';
import { PlantingCalendarView } from './components/PlantingCalendarView';
import { AiAssistantView } from './components/AiAssistantView';
import { FeedbackHistoryView } from './components/FeedbackHistoryView';
import { CommunityForumView } from './components/CommunityForumView';
import { ExplanationDrawer } from './components/ExplanationDrawer';
import { InteractiveMapModal } from './components/InteractiveMapModal';
import { AdminDataManagementView } from './components/AdminDataManagementView';
import { NasaSourcesView } from './components/NasaSourcesView';
import { AdvisoryDisclaimer } from './components/AdvisoryDisclaimer';
import { AuthModal } from './components/AuthModal';
import { RecoveryEmailModal } from './components/RecoveryEmailModal';
import {
  AppUser,
  CommunityCategory,
  CommunityPost,
  FieldProfile,
  ImportedFarmReport,
  WeatherObservation,
  DailyAgronomicBrief,
  FarmTask,
  FeedbackRecord,
  FeedbackType,
  EarthEnvironmentSnapshot,
  PlotPlanRecord,
} from './types';
import {
  Sprout,
  ShieldCheck,
  Plus,
  MapPin,
  LogIn,
  CheckCircle2,
  Layers,
  CalendarCheck,
  History,
  RefreshCw,
  CalendarDays,
  BarChart3,
  Home,
  Globe,
  Bot,
  Users,
  RotateCcw,
} from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { OfflineCacheService } from './services/offlineCacheService';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  loadDemoWorkspace,
  saveDemoWorkspace,
  resetDemoWorkspace,
  loadDemoForumPosts,
  saveDemoForumPosts,
  ensureFieldEnglishLocalization,
} from './data/demoData';
import { getCommonStageLabel } from './data/cropTaxonomy';
import { findNearestNasaGrid } from './data/nasaVietnamGrid';
import { translateTexts } from './services/translationService';

const TAB_TO_PATH: Record<string, string> = {
  home: '/',
  dashboard: '/cham-soc',
  tasks: '/viec-can-lam',
  feedback: '/phan-hoi',
  rotation: '/luan-canh',
  calendar: '/lich-gieo-trong',
  analytics: '/phan-tich-ban-do',
  fields: '/ruong-cua-toi',
  community: '/cong-dong',
  sources: '/nguon-du-lieu-nasa',
  assistant: '/tro-ly-ai',
  admin: '/quan-tri',
};

const PATH_TO_TAB: Record<string, string> = {
  '/': 'home',
  '/cham-soc': 'dashboard',
  '/tong-quan': 'dashboard',
  '/viec-can-lam': 'tasks',
  '/phan-hoi': 'feedback',
  '/luan-canh': 'rotation',
  '/lich-gieo-trong': 'calendar',
  '/phan-tich-ban-do': 'analytics',
  '/ruong-cua-toi': 'fields',
  '/cong-dong': 'community',
  '/nguon-du-lieu-nasa': 'sources',
  '/tro-ly-ai': 'assistant',
  '/quan-tri': 'admin',
};

function resolveTabFromPathname(pathname: string): string {
  const clean = (pathname || '/').replace(/\/+$/, '') || '/';
  return PATH_TO_TAB[clean] || 'home';
}

const ACTIVE_FIELD_STORAGE_KEY = 'cropcast_active_field_id';

export default function App() {
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTabState] = useState<string>(() => {
    try {
      return resolveTabFromPathname(window.location.pathname);
    } catch {
      return 'home';
    }
  });
  const [authUser, setAuthUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [fields, setFields] = useState<FieldProfile[]>([]);
  const [activeFieldId, setActiveFieldIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_FIELD_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [weather, setWeather] = useState<WeatherObservation>(StorageService.getWeather());
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackRecord[]>([]);
  const [plansByPlotId, setPlansByPlotId] = useState<Record<string, PlotPlanRecord>>({});
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(() => loadDemoForumPosts());
  const [communitySyncError, setCommunitySyncError] = useState<string | null>(null);
  const [demoHydrated, setDemoHydrated] = useState(false);
  const [weatherRefreshing, setWeatherRefreshing] = useState(false);
  const [datasetRefreshTick, setDatasetRefreshTick] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const prevLoginUidRef = useRef<string | null>(null);
  const isDemoMode = authReady && !authUser;

  const setActiveFieldId = (nextIdOrUpdater: string | ((prev: string) => string)) => {
    setActiveFieldIdState((prev) => {
      const next =
        typeof nextIdOrUpdater === 'function' ? nextIdOrUpdater(prev) : nextIdOrUpdater;
      try {
        if (next) localStorage.setItem(ACTIVE_FIELD_STORAGE_KEY, next);
        else localStorage.removeItem(ACTIVE_FIELD_STORAGE_KEY);
      } catch {
        // ignore storage restrictions
      }
      return next;
    });
  };

  const navigateToTab = (nextTab: string, replace = false) => {
    setActiveTabState(nextTab);
    try {
      const targetPath = TAB_TO_PATH[nextTab] || '/';
      const currentPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
      if (currentPath !== targetPath) {
        if (replace) {
          window.history.replaceState({ tab: nextTab }, '', targetPath);
        } else {
          window.history.pushState({ tab: nextTab }, '', targetPath);
        }
      }
    } catch {
      // ignore history errors
    }
  };

  useEffect(() => {
    const onPopState = () => {
      setActiveTabState(resolveTabFromPathname(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Share link redemption state
  const [pendingShareToken, setPendingShareToken] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('share');
    } catch {
      return null;
    }
  });
  const [shareBanner, setShareBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Modals state
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapInitialCoords, setMapInitialCoords] = useState<{ lat: number; lon: number }>({
    lat: 21.03,
    lon: 105.85,
  });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [recoveryEmailModalOpen, setRecoveryEmailModalOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  // Sync Firebase Auth State strictly with Firebase Authentication
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const isAdmin = await FirestoreService.checkIsAdmin(
          fbUser.uid,
          fbUser.email,
          fbUser.emailVerified
        );
        await FirestoreService.ensureUserProfile(fbUser).catch(() => {});
        const needsRecoveryEmail = await FirestoreService.checkUserNeedsRecoveryEmail(fbUser);
        setAuthUser({
          uid: fbUser.uid,
          displayName: fbUser.displayName || t('Nông dân CropCast', 'CropCast Farmer'),
          email: fbUser.email || '',
          photoURL: fbUser.photoURL || undefined,
          emailVerified: fbUser.emailVerified,
          isAdmin,
          needsRecoveryEmail,
          authMode: 'firebase',
        });
        if (needsRecoveryEmail) {
          setRecoveryEmailModalOpen(true);
        }
      } else {
        setAuthUser(null);
        setRecoveryEmailModalOpen(false);
      }
      setAuthReady(true);
    });
    return () => unsubAuth();
  }, []);

  const activeField = fields.find((f) => f.id === activeFieldId) || fields[0];
  const activeFieldCellId = activeField?.nasaGrid?.cellId;

  const activeFieldLat = activeField?.lat;
  const activeFieldLon = activeField?.lon;

  // Fetch live field weather + 26-yr (2001-2026) baseline and merge any public admin dataset overrides, with offline cache fallback
  useEffect(() => {
    let mounted = true;
    const loadWeather = async () => {
      if (
        typeof navigator !== 'undefined' &&
        !navigator.onLine &&
        authUser &&
        !authUser.isAdmin &&
        activeField?.id
      ) {
        const cached = await OfflineCacheService.loadSnapshot(authUser.uid);
        const cachedWeather = cached?.weatherByFieldId?.[activeField.id];
        if (mounted && cachedWeather) {
          setWeather(cachedWeather);
          if (cached?.lastSyncedAt) setLastSyncedAt(cached.lastSyncedAt);
          return;
        }
      }

      const liveOrBaseline =
        activeFieldLat !== undefined && activeFieldLon !== undefined
          ? await fetchFieldLiveWeather(activeFieldLat, activeFieldLon, activeField)
          : buildClimaticBaselineWeather(21.03, 105.85);

      if (!mounted) return;

      let resolvedWeather = liveOrBaseline;
      try {
        const datasets = await FirestoreService.getPublicNasaDatasets();
        if (!mounted) return;
        const completed = datasets
          .filter((d) => d.status === 'COMPLETED' && d.sampleOverrides?.length)
          .reverse();
        if (completed.length > 0) {
          const next = { ...liveOrBaseline };
          for (const ds of completed) {
            const matchingRows = (ds.sampleOverrides || [])
              .filter((row) => !activeFieldCellId || row.cell_id === activeFieldCellId)
              .sort((a, b) => a.date.localeCompare(b.date));
            for (const row of matchingRows) {
              if (row.indicator_code === 'T2M') next.temp = row.value;
              if (row.indicator_code === 'T2M_MIN') next.minTemp = row.value;
              if (row.indicator_code === 'T2M_MAX') next.maxTemp = row.value;
              if (row.indicator_code === 'PRECTOTCORR') next.rain = row.value;
              if (row.indicator_code === 'GWETROOT') next.gwetroot = row.value;
              if (row.indicator_code === 'GWETTOP') next.gwettop = row.value;
              if (row.indicator_code === 'RH2M') next.humidity = row.value;
              if (row.indicator_code === 'ALLSKY_SFC_SW_DWN') next.solarRadiation = row.value;
            }
            if (matchingRows.length > 0 && ds.endDate) {
              next.observationDate = ds.endDate;
            }
          }
          resolvedWeather = next;
        }
      } catch {
        // fallback to liveOrBaseline
      }

      if (!mounted) return;
      setWeather(resolvedWeather);

      if (authUser && !authUser.isAdmin && activeField?.id) {
        OfflineCacheService.saveWeatherForField(authUser.uid, activeField.id, resolvedWeather)
          .then(() => {
            if (mounted) setLastSyncedAt(new Date().toISOString());
          })
          .catch(() => {});
      }
    };

    loadWeather();
    return () => {
      mounted = false;
    };
  }, [activeTab, datasetRefreshTick, activeFieldCellId, activeFieldLat, activeFieldLon, authUser?.uid, authUser?.isAdmin, activeField?.id]);

  // Redeem pending share link (?share=...) once user is signed in, or prompt login
  useEffect(() => {
    if (!authReady || !pendingShareToken) return;

    if (!authUser) {
      setAuthMessage(
        t(
          'Bạn vừa mở một đường dẫn chia sẻ thửa ruộng. Vui lòng đăng nhập hoặc tạo tài khoản để xem thửa ruộng này.',
          'You opened a shared field link. Please sign in or create an account to view this field.'
        )
      );
      setAuthModalOpen(true);
      return;
    }

    const tokenToRedeem = pendingShareToken;
    setPendingShareToken(null);

    try {
      const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
      window.history.replaceState({}, '', cleanUrl);
    } catch {
      // ignore history error
    }

    FirestoreService.redeemFieldShareLink(tokenToRedeem, authUser.uid)
      .then((res) => {
        setAuthMessage(null);
        setActiveFieldId(res.fieldId);
        navigateToTab('fields');
        setShareBanner({
          type: 'ok',
          text: t(
            `Đã mở quyền xem thửa ruộng "${res.fieldName}" được chia sẻ bởi ${res.ownerName}.`,
            `View access granted for "${res.fieldName}" shared by ${res.ownerName}.`
          ),
        });
      })
      .catch((err: any) => {
        setShareBanner({
          type: 'err',
          text:
            err?.message ||
            t(
              'Không thể mở đường dẫn chia sẻ thửa ruộng này.',
              'Unable to open this shared field link.'
            ),
        });
      });
  }, [authReady, authUser, pendingShareToken]);

  // Real-time community forum listener — always active across Demo Mode, Farmer & Admin sessions
  useEffect(() => {
    if (!authReady) return;
    const unsubCommunity = FirestoreService.subscribeCommunityPosts(
      (cloudPosts) => {
        setCommunitySyncError(null);
        const seedOnlyPosts = loadDemoForumPosts().filter(
          (dp) =>
            dp.isDemoSeed &&
            !dp.id.startsWith('DEMO_POST_') &&
            !cloudPosts.some((cp) => cp.id === dp.id || cp.title === dp.title)
        );
        setCommunityPosts([...cloudPosts, ...seedOnlyPosts]);
      },
      (err) => {
        setCommunitySyncError(
          err?.message ||
            t(
              'Không thể đồng bộ diễn đàn cộng đồng theo thời gian thực. Đang hiển thị bản lưu cục bộ.',
              'Could not sync real-time community posts. Showing locally cached posts.'
            )
        );
      }
    );
    return () => unsubCommunity();
  }, [authReady]);

  // Migrate any legacy locally-authored DEMO_POST_* drafts up to Firestore Cloud when user signs in
  useEffect(() => {
    if (!authReady || !authUser) return;
    const localPosts = loadDemoForumPosts();
    const pendingLocalPosts = localPosts.filter((p) => p.id.startsWith('DEMO_POST_'));
    if (pendingLocalPosts.length === 0) return;

    let cancelled = false;
    (async () => {
      const migratedIds = new Set<string>();
      for (const lp of pendingLocalPosts) {
        if (cancelled) break;
        try {
          await FirestoreService.createCommunityPost(authUser.uid, authUser.displayName, {
            province: lp.province,
            district: lp.district,
            cropName: lp.cropName,
            cropNameEn: lp.cropNameEn,
            category: lp.category,
            title: lp.title,
            titleEn: lp.titleEn,
            content: lp.content,
            contentEn: lp.contentEn,
          });
          migratedIds.add(lp.id);
        } catch {
          // leave unmigrated if offline or rejected
        }
      }
      if (migratedIds.size > 0) {
        saveDemoForumPosts(localPosts.filter((p) => !migratedIds.has(p.id)));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, authUser?.uid]);

  // Subscribe to farmer's cloud records OR hydrate default Demo Workspace when unauthenticated
  useEffect(() => {
    if (!authReady) return;

    if (!authUser) {
      prevLoginUidRef.current = null;
      const demo = loadDemoWorkspace();
      setFields(demo.fields);
      setTasks(demo.tasks);
      setFeedbackHistory(demo.feedbacks);
      setPlansByPlotId(demo.plans);
      setActiveFieldId((prev) =>
        prev && demo.fields.some((f) => f.id === prev) ? prev : demo.fields[0]?.id || ''
      );
      setLastSyncedAt(demo.updatedAt || new Date().toISOString());
      setDemoHydrated(true);
      if (activeTab === 'admin') {
        navigateToTab('home', true);
      }
      return;
    }

    setDemoHydrated(false);

    if (authUser.isAdmin) {
      prevLoginUidRef.current = authUser.uid;
      setFields([]);
      setTasks([]);
      setFeedbackHistory([]);
      setPlansByPlotId({});
      setLastSyncedAt(null);
      if (activeTab !== 'community') {
        navigateToTab('admin', true);
      }
      return;
    }

    let isMounted = true;
    OfflineCacheService.loadSnapshot(authUser.uid)
      .then((cached) => {
        if (!isMounted || !cached) return;
        const localizedCachedFields = (cached.fields || []).map((f) =>
          ensureFieldEnglishLocalization(f)
        );
        setFields((prev) =>
          prev.length === 0 && localizedCachedFields.length > 0 ? localizedCachedFields : prev
        );
        setTasks((prev) => (prev.length === 0 && cached.tasks.length > 0 ? cached.tasks : prev));
        setFeedbackHistory((prev) =>
          prev.length === 0 && cached.feedbacks.length > 0 ? cached.feedbacks : prev
        );
        setPlansByPlotId((prev) =>
          Object.keys(prev).length === 0 && Object.keys(cached.plans || {}).length > 0
            ? cached.plans
            : prev
        );
        if (cached.lastSyncedAt) setLastSyncedAt(cached.lastSyncedAt);
        setActiveFieldId((prev) => {
          if (prev) return prev;
          return localizedCachedFields[0]?.id || '';
        });
      })
      .catch(() => {});

    const unsubFields = FirestoreService.subscribeUserFields(
      authUser.uid,
      authUser.email,
      (cloudFields) => {
        const localizedCloudFields = cloudFields.map((f) => ensureFieldEnglishLocalization(f));
        setFields(localizedCloudFields);
        setActiveFieldId((prev) => {
          if (prev && localizedCloudFields.some((f) => f.id === prev)) return prev;
          return localizedCloudFields[0]?.id || '';
        });
      }
    );

    const unsubTasks = FirestoreService.subscribeUserTasks(authUser.uid, (cloudTasks) => {
      setTasks(cloudTasks);
    });

    const unsubFeedbacks = FirestoreService.subscribeUserFeedbacks(authUser.uid, (cloudFbs) => {
      setFeedbackHistory(cloudFbs);
    });

    const unsubPlans = FirestoreService.subscribeUserPlans(authUser.uid, (cloudPlans) => {
      setPlansByPlotId(cloudPlans);
    });

    if (activeTab === 'admin') {
      navigateToTab('dashboard', true);
    }

    return () => {
      isMounted = false;
      unsubFields();
      unsubTasks();
      unsubFeedbacks();
      unsubPlans();
    };
  }, [authReady, authUser]);

  // Requirement #7: Instant live weather check immediately on login across active user fields
  useEffect(() => {
    if (!authReady || !authUser || authUser.isAdmin) return;
    if (prevLoginUidRef.current === authUser.uid) return;
    if (fields.length === 0) return;

    prevLoginUidRef.current = authUser.uid;
    let cancelled = false;

    const refreshOnLogin = async () => {
      const targetField = fields.find((f) => f.id === activeFieldId) || fields[0];
      if (!targetField) return;
      setWeatherRefreshing(true);
      try {
        const freshPrimary = await fetchFieldLiveWeather(
          targetField.lat,
          targetField.lon,
          targetField,
          { forceRefresh: true }
        );
        if (!cancelled) {
          setWeather(freshPrimary);
          setLastSyncedAt(new Date().toISOString());
          OfflineCacheService.saveWeatherForField(authUser.uid, targetField.id, freshPrimary).catch(() => {});
        }
        // Background refresh remaining active fields (up to 5) so switching fields has fresh weather
        const remaining = fields.filter((f) => f.id !== targetField.id).slice(0, 4);
        await Promise.all(
          remaining.map(async (f) => {
            try {
              const w = await fetchFieldLiveWeather(f.lat, f.lon, f, { forceRefresh: true });
              if (!cancelled) {
                await OfflineCacheService.saveWeatherForField(authUser.uid, f.id, w);
              }
            } catch {
              // ignore secondary field error
            }
          })
        );
      } catch {
        // fallback already handled by weatherService
      } finally {
        if (!cancelled) setWeatherRefreshing(false);
      }
    };

    refreshOnLogin();
    return () => {
      cancelled = true;
    };
  }, [authReady, authUser?.uid, authUser?.isAdmin, fields, activeFieldId]);

  // Persist Demo Mode workspace edits in localStorage so reloads keep farmer changes
  useEffect(() => {
    if (!isDemoMode || !demoHydrated) return;
    saveDemoWorkspace({
      fields,
      tasks,
      feedbacks: feedbackHistory,
      plans: plansByPlotId,
      updatedAt: new Date().toISOString(),
    });
  }, [isDemoMode, demoHydrated, fields, tasks, feedbackHistory, plansByPlotId]);

  // Persist synchronized farmer records into IndexedDB + localStorage snapshot while online
  useEffect(() => {
    if (!authUser || authUser.isAdmin) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (
      fields.length === 0 &&
      tasks.length === 0 &&
      feedbackHistory.length === 0 &&
      Object.keys(plansByPlotId).length === 0
    ) {
      return;
    }

    let cancelled = false;
    const syncCache = async () => {
      const existing = await OfflineCacheService.loadSnapshot(authUser.uid);
      if (cancelled) return;
      const nowIso = new Date().toISOString();
      await OfflineCacheService.saveSnapshot({
        uid: authUser.uid,
        fields,
        tasks,
        feedbacks: feedbackHistory,
        plans: plansByPlotId,
        weatherByFieldId: existing?.weatherByFieldId || {},
        lastSyncedAt: nowIso,
      });
      if (!cancelled) setLastSyncedAt(nowIso);
    };

    syncCache().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authUser?.uid, authUser?.isAdmin, fields, tasks, feedbackHistory, plansByPlotId]);


  const ruleBrief: DailyAgronomicBrief | null = activeField
    ? analyzeFieldAgronomy(activeField, weather, feedbackHistory, lang)
    : null;

  const handleGoogleSignIn = async () => {
    setAuthMessage(null);
    const user = await FirestoreService.signInWithGoogle();
    setAuthUser(user);
    if (user.needsRecoveryEmail) {
      setRecoveryEmailModalOpen(true);
    }
    if (user.isAdmin) {
      navigateToTab('admin');
    } else if (activeTab === 'home') {
      navigateToTab('fields');
    }
  };

  const handleUsernameSignIn = async (username: string, password: string) => {
    setAuthMessage(null);
    const user = await FirestoreService.signInWithUsername(username, password);
    setAuthUser(user);
    if (user.needsRecoveryEmail) {
      setRecoveryEmailModalOpen(true);
    }
    if (user.isAdmin) {
      navigateToTab('admin');
    } else if (activeTab === 'home') {
      navigateToTab('fields');
    }
  };

  const handleEmailSignUp = async (params: {
    email: string;
    password: string;
    displayName?: string;
    phone?: string;
  }) => {
    setAuthMessage(null);
    const user = await FirestoreService.signUpWithEmail(params);
    setAuthUser(user);
    if (activeTab === 'home') {
      navigateToTab('fields');
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    await FirestoreService.sendPasswordReset(email);
  };

  const handleLinkAccountEmail = async (newEmail: string, currentPassword?: string) => {
    const res = await FirestoreService.linkAccountEmail(newEmail, currentPassword);
    if (res.status === 'linked') {
      setAuthUser((prev) =>
        prev
          ? {
              ...prev,
              email: res.email,
              needsRecoveryEmail: false,
            }
          : prev
      );
    }
    return res;
  };

  const handleSignOut = async () => {
    await FirestoreService.signOutUser();
    setAuthUser(null);
    setRecoveryEmailModalOpen(false);
    setActiveFieldId('');
    navigateToTab('home');
  };

  const handleSelectField = (fieldId: string) => {
    setActiveFieldId(fieldId);
  };

  const handleRefreshWeather = async () => {
    if (activeFieldLat === undefined || activeFieldLon === undefined) return;
    setWeatherRefreshing(true);
    try {
      const fresh = await fetchFieldLiveWeather(activeFieldLat, activeFieldLon, activeField, {
        forceRefresh: true,
      });
      setWeather(fresh);
      const nowIso = new Date().toISOString();
      setLastSyncedAt(nowIso);
      if (authUser && !authUser.isAdmin && activeField?.id) {
        OfflineCacheService.saveWeatherForField(authUser.uid, activeField.id, fresh).catch(() => {});
      }
    } finally {
      setWeatherRefreshing(false);
    }
  };

  const handleResetDemo = () => {
    const fresh = resetDemoWorkspace();
    setFields(fresh.fields);
    setTasks(fresh.tasks);
    setFeedbackHistory(fresh.feedbacks);
    setPlansByPlotId(fresh.plans);
    setActiveFieldId(fresh.fields[0]?.id || '');
    setLastSyncedAt(fresh.updatedAt);
    setShareBanner({
      type: 'ok',
      text: t(
        'Đã khôi phục dữ liệu mẫu Demo ban đầu.',
        'Demo sample workspace restored to defaults.'
      ),
    });
  };

  const handleAddNewField = async (newFieldData: Omit<FieldProfile, 'id' | 'nasaGrid'>) => {
    if (!authUser) {
      const { cell, distanceKm } = findNearestNasaGrid(newFieldData.lat, newFieldData.lon);
      const created: FieldProfile = {
        ...newFieldData,
        id: `DEMO_FIELD_${Date.now()}`,
        ownerId: 'DEMO_FARMER',
        ownerName: t('Nông hộ Demo', 'Demo Farmer'),
        nasaGrid: {
          cellId: cell.cellId,
          lat: cell.lat,
          lon: cell.lon,
          distanceKm,
        },
      };
      const brief = analyzeFieldAgronomy(created, weather, feedbackHistory, lang);
      const newTasks = generateTasksFromBrief(brief, created, weather, feedbackHistory);
      setFields((prev) => [created, ...prev]);
      if (newTasks.length > 0) {
        setTasks((prev) => [...newTasks, ...prev]);
      }
      setActiveFieldId(created.id);
      navigateToTab('fields');
      return;
    }
    const created = await FirestoreService.createField(authUser.uid, newFieldData);
    const brief = analyzeFieldAgronomy(created, weather, feedbackHistory, lang);
    const newTasks = generateTasksFromBrief(brief, created, weather, feedbackHistory);
    try {
      await FirestoreService.createTasks(authUser.uid, newTasks);
    } catch {
      // Field was created successfully; avoid aborting navigation if task generation fails
    }
    setActiveFieldId(created.id);
    navigateToTab('fields');
  };

  const handleUpdateField = async (updatedField: FieldProfile) => {
    if (updatedField.isSharedWithMe) return;
    if (!authUser) {
      const { cell, distanceKm } = findNearestNasaGrid(updatedField.lat, updatedField.lon);
      const nextField: FieldProfile = {
        ...updatedField,
        nasaGrid: {
          cellId: cell.cellId,
          lat: cell.lat,
          lon: cell.lon,
          distanceKm,
        },
      };
      setFields((prev) => prev.map((f) => (f.id === nextField.id ? nextField : f)));
      setActiveFieldId(nextField.id);
      return;
    }
    await FirestoreService.updateField(authUser.uid, updatedField);
    setActiveFieldId(updatedField.id);
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!authUser) {
      setFields((prev) => {
        const remaining = prev.filter((f) => f.id !== fieldId);
        if (activeFieldId === fieldId) {
          setActiveFieldId(remaining[0]?.id || '');
        }
        return remaining;
      });
      setTasks((prev) => prev.filter((tk) => tk.fieldId !== fieldId));
      setFeedbackHistory((prev) => prev.filter((fb) => fb.fieldId !== fieldId));
      setPlansByPlotId((prev) => {
        const copy = { ...prev };
        delete copy[fieldId];
        return copy;
      });
      return;
    }
    await FirestoreService.deleteField(authUser.uid, fieldId);
  };

  const handleCreateShareLink = async (field: FieldProfile): Promise<string> => {
    if (!authUser) throw new Error(t('Vui lòng đăng nhập để chia sẻ.', 'Please sign in to share.'));
    return FirestoreService.createFieldShareLink(field, authUser.uid, authUser.displayName);
  };

  const handleRevokeShareLink = async (field: FieldProfile): Promise<void> => {
    if (!authUser) return;
    await FirestoreService.revokeFieldShareLink(authUser.uid, field.id, field.activeShareToken);
  };

  const handleShareByEmail = async (field: FieldProfile, email: string): Promise<string> => {
    if (!authUser) throw new Error(t('Vui lòng đăng nhập để chia sẻ.', 'Please sign in to share.'));
    return FirestoreService.shareFieldByEmail(field, authUser.uid, authUser.displayName, email);
  };

  const handleRemoveSharedEmail = async (fieldId: string, email: string): Promise<void> => {
    if (!authUser) return;
    await FirestoreService.removeSharedEmail(authUser.uid, fieldId, email);
  };

  const handleUpdateTaskStatus = async (
    taskId: string,
    status: FarmTask['status'],
    note?: string
  ) => {
    let viNote = note;
    let enNote = note;
    if (note && note.trim()) {
      try {
        const targetLang = lang === 'en' ? 'vi' : 'en';
        const { translations } = await translateTexts(
          [note.trim()],
          targetLang,
          'Farmer note on field agronomic task status'
        );
        if (lang === 'en') {
          enNote = note.trim();
          viNote = translations[0] || note.trim();
        } else {
          viNote = note.trim();
          enNote = translations[0] || note.trim();
        }
      } catch {
        // fallback cleanly
      }
    }

    if (!authUser) {
      setTasks((prev) =>
        prev.map((tk) =>
          tk.id === taskId
            ? { ...tk, status, ...(viNote ? { farmerNote: viNote, farmerNoteEn: enNote } : {}) }
            : tk
        )
      );
      return;
    }
    await FirestoreService.updateTaskStatus(authUser.uid, taskId, status, viNote, enNote);
  };

  const handleAddFeedback = async (feedback: Omit<FeedbackRecord, 'id' | 'timestamp'>) => {
    if (!activeField || activeField.isSharedWithMe) return;
    let userCommentEn = feedback.userCommentEn;
    let userComment = feedback.userComment;
    if (feedback.userComment && feedback.userComment.trim() && !feedback.userCommentEn) {
      try {
        const targetLang = lang === 'en' ? 'vi' : 'en';
        const { translations } = await translateTexts(
          [feedback.userComment.trim()],
          targetLang,
          'Farmer field observation feedback note'
        );
        if (lang === 'en') {
          userCommentEn = feedback.userComment.trim();
          userComment = translations[0] || feedback.userComment.trim();
        } else {
          userComment = feedback.userComment.trim();
          userCommentEn = translations[0] || feedback.userComment.trim();
        }
      } catch {
        // fallback cleanly
      }
    }

    const enrichedFeedback = {
      ...feedback,
      ...(userComment ? { userComment } : {}),
      ...(userCommentEn ? { userCommentEn } : {}),
    };

    const adjustmentVi =
      feedback.feedbackType === 'soil_still_dry'
        ? 'Nông dân phản hồi đất khô nhanh hơn dự báo: Tăng độ nhạy nhắc tưới'
        : feedback.feedbackType === 'soil_too_wet'
        ? 'Nông dân phản hồi đất giữ ẩm lâu / thoát nước chậm: Ưu tiên khơi thông rãnh'
        : undefined;
    const adjustmentEn =
      feedback.feedbackType === 'soil_still_dry'
        ? 'Field dried faster than forecast: Increased irrigation reminder sensitivity'
        : feedback.feedbackType === 'soil_too_wet'
        ? 'Field retained moisture / drained slowly: Prioritized drainage checks'
        : undefined;

    if (!authUser) {
      const localFb: FeedbackRecord = {
        ...enrichedFeedback,
        id: `DEMO_FB_${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
      setFeedbackHistory((prev) => [localFb, ...prev]);
      if (adjustmentVi) {
        setFields((prev) =>
          prev.map((f) =>
            f.id === activeField.id
              ? {
                  ...f,
                  adaptiveMemory: {
                    ...f.adaptiveMemory,
                    soilAdjustment: adjustmentVi,
                    soilAdjustmentEn: adjustmentEn,
                    lastFeedbackDate: new Date().toISOString().slice(0, 10),
                  },
                }
              : f
          )
        );
      }
      return;
    }
    await FirestoreService.createFeedback(authUser.uid, enrichedFeedback);
    if (adjustmentVi) {
      await FirestoreService.updateField(authUser.uid, {
        ...activeField,
        adaptiveMemory: {
          ...activeField.adaptiveMemory,
          soilAdjustment: adjustmentVi,
          soilAdjustmentEn: adjustmentEn,
          lastFeedbackDate: new Date().toISOString().slice(0, 10),
        },
      });
    }
  };

  const handleInstantFeedback = (type: FeedbackType, note?: string) => {
    if (!activeField || activeField.isSharedWithMe) return;
    handleAddFeedback({
      fieldId: activeField.id,
      feedbackType: type,
      userComment: note,
      systemActionTaken:
        type === 'soil_still_dry'
          ? 'Ghi nhận đất khô nhanh: Tăng độ nhạy nhắc tưới'
          : type === 'soil_too_wet'
          ? 'Ghi nhận đất thoát chậm: Ưu tiên thoát nước'
          : 'Đã lưu phản hồi vào nhật ký ruộng',
      systemActionTakenEn:
        type === 'soil_still_dry'
          ? 'Recorded fast-drying soil: Increased irrigation alert sensitivity'
          : type === 'soil_too_wet'
          ? 'Recorded slow drainage: Prioritized field drainage'
          : 'Saved feedback to field log',
      appliedToProfile: true,
    });
  };

  const handleFieldCheckInUpdate = async (
    input: FieldCheckInInput,
    addFixesToTasks: boolean
  ): Promise<FieldCheckInDiagnostic | null> => {
    if (!activeField || activeField.isSharedWithMe) return null;

    const briefVi =
      lang === 'vi' && ruleBrief
        ? ruleBrief
        : analyzeFieldAgronomy(activeField, weather, feedbackHistory, 'vi');
    const briefEn =
      lang === 'en' && ruleBrief
        ? ruleBrief
        : analyzeFieldAgronomy(activeField, weather, feedbackHistory, 'en');
    const diagnosticVi = evaluateFieldCheckIn(activeField, weather, briefVi, input, 'vi');
    const diagnosticEn = evaluateFieldCheckIn(activeField, weather, briefEn, input, 'en');
    const diagnostic = lang === 'en' ? diagnosticEn : diagnosticVi;

    let noteVi = input.note;
    let noteEn = input.note;
    if (input.note && input.note.trim()) {
      try {
        const targetLang = lang === 'en' ? 'vi' : 'en';
        const { translations } = await translateTexts(
          [input.note.trim()],
          targetLang,
          'Farmer check-in observation note'
        );
        if (lang === 'en') {
          noteEn = input.note.trim();
          noteVi = translations[0] || input.note.trim();
        } else {
          noteVi = input.note.trim();
          noteEn = translations[0] || input.note.trim();
        }
      } catch {
        // fallback cleanly
      }
    }

    const feedbackType: FeedbackType =
      input.observedMoisture === 'dry'
        ? 'soil_still_dry'
        : input.observedMoisture === 'wet'
        ? 'soil_too_wet'
        : input.observedCropHealth !== 'healthy'
        ? 'crop_abnormal'
        : input.predictionOutcome === 'on_track'
        ? 'helpful'
        : 'not_suitable';

    if (!authUser) {
      const localFb: FeedbackRecord = {
        id: `DEMO_FB_${Date.now()}`,
        fieldId: activeField.id,
        timestamp: new Date().toISOString(),
        feedbackType,
        userComment: noteVi,
        userCommentEn: noteEn,
        systemActionTaken: `${diagnosticVi.verdictTitle} — ${diagnosticVi.rootCauseExplanation}`,
        systemActionTakenEn: `${diagnosticEn.verdictTitle} — ${diagnosticEn.rootCauseExplanation}`,
        predictionOutcome: input.predictionOutcome,
        observedMoisture: input.observedMoisture,
        observedCropHealth: input.observedCropHealth,
        recommendedFixes: diagnosticVi.fixes,
        recommendedFixesEn: diagnosticEn.fixes,
        appliedToProfile: true,
      };
      setFeedbackHistory((prev) => [localFb, ...prev]);
      setFields((prev) =>
        prev.map((f) =>
          f.id === activeField.id
            ? {
                ...f,
                crop: {
                  ...f.crop,
                  currentStage: input.updatedStage || f.crop.currentStage,
                  currentStageEn: input.updatedStage
                    ? getCommonStageLabel(input.updatedStage, 'en')
                    : f.crop.currentStageEn,
                  healthStatus: diagnostic.recommendedHealthStatus,
                },
                adaptiveMemory: {
                  ...f.adaptiveMemory,
                  soilAdjustment: diagnosticVi.soilAdjustmentNote,
                  soilAdjustmentEn: diagnosticEn.soilAdjustmentNote,
                  irrigationSensitivity: diagnostic.irrigationSensitivity,
                  lastFeedbackDate: new Date().toISOString().slice(0, 10),
                  lastPredictionOutcome: input.predictionOutcome,
                  lastCheckInSummary: diagnosticVi.rootCauseExplanation,
                  lastCheckInSummaryEn: diagnosticEn.rootCauseExplanation,
                  planFixRecommendations: diagnosticVi.fixes,
                  planFixRecommendationsEn: diagnosticEn.fixes,
                },
              }
            : f
        )
      );
      if (addFixesToTasks && diagnostic.suggestedTasks.length > 0) {
        setTasks((prev) => [...diagnostic.suggestedTasks, ...prev]);
      }
      return diagnostic;
    }

    await FirestoreService.createFeedback(authUser.uid, {
      fieldId: activeField.id,
      feedbackType,
      userComment: noteVi,
      userCommentEn: noteEn,
      systemActionTaken: `${diagnosticVi.verdictTitle} — ${diagnosticVi.rootCauseExplanation}`,
      systemActionTakenEn: `${diagnosticEn.verdictTitle} — ${diagnosticEn.rootCauseExplanation}`,
      predictionOutcome: input.predictionOutcome,
      observedMoisture: input.observedMoisture,
      observedCropHealth: input.observedCropHealth,
      recommendedFixes: diagnosticVi.fixes,
      recommendedFixesEn: diagnosticEn.fixes,
      appliedToProfile: true,
    });

    await FirestoreService.updateField(authUser.uid, {
      ...activeField,
      crop: {
        ...activeField.crop,
        currentStage: input.updatedStage || activeField.crop.currentStage,
        currentStageEn: input.updatedStage
          ? getCommonStageLabel(input.updatedStage, 'en')
          : activeField.crop.currentStageEn,
        healthStatus: diagnostic.recommendedHealthStatus,
      },
      adaptiveMemory: {
        ...activeField.adaptiveMemory,
        soilAdjustment: diagnosticVi.soilAdjustmentNote,
        soilAdjustmentEn: diagnosticEn.soilAdjustmentNote,
        irrigationSensitivity: diagnostic.irrigationSensitivity,
        lastFeedbackDate: new Date().toISOString().slice(0, 10),
        lastPredictionOutcome: input.predictionOutcome,
        lastCheckInSummary: diagnosticVi.rootCauseExplanation,
        lastCheckInSummaryEn: diagnosticEn.rootCauseExplanation,
        planFixRecommendations: diagnosticVi.fixes,
        planFixRecommendationsEn: diagnosticEn.fixes,
      },
    });

    if (addFixesToTasks && diagnostic.suggestedTasks.length > 0) {
      await FirestoreService.createTasks(authUser.uid, diagnostic.suggestedTasks);
    }

    return diagnostic;
  };

  const handleMapCoordinateSelected = async (lat: number, lon: number) => {
    if (!activeField || activeField.isSharedWithMe) return;
    if (!authUser) {
      const { cell, distanceKm } = findNearestNasaGrid(lat, lon);
      setFields((prev) =>
        prev.map((f) =>
          f.id === activeField.id
            ? {
                ...f,
                lat,
                lon,
                nasaGrid: {
                  cellId: cell.cellId,
                  lat: cell.lat,
                  lon: cell.lon,
                  distanceKm,
                },
              }
            : f
        )
      );
      return;
    }
    const updated = {
      ...activeField,
      lat,
      lon,
    };
    await FirestoreService.updateField(authUser.uid, updated);
  };

  const handleSaveEarthMetrics = async (snapshot: EarthEnvironmentSnapshot) => {
    if (!activeField || activeField.isSharedWithMe) return;
    const updated: FieldProfile = {
      ...activeField,
      adaptiveMemory: {
        ...activeField.adaptiveMemory,
        earthMetrics: snapshot,
      },
    };
    if (!authUser) {
      setFields((prev) => prev.map((f) => (f.id === activeField.id ? updated : f)));
      return;
    }
    await Promise.all([
      FirestoreService.updateField(authUser.uid, updated),
      FirestoreService.saveEarthMetricsSnapshot(authUser.uid, activeField.id, snapshot),
    ]);
  };

  const handleSavePlotPlan = async (
    plotId: string,
    plan: Omit<PlotPlanRecord, 'id' | 'ownerId' | 'plotId' | 'updatedAt'>
  ) => {
    if (!authUser) {
      setPlansByPlotId((prev) => ({
        ...prev,
        [plotId]: {
          id: plotId,
          ownerId: 'DEMO_FARMER',
          plotId,
          ...plan,
          updatedAt: new Date().toISOString(),
        },
      }));
      return;
    }
    await FirestoreService.savePlotPlan(authUser.uid, plotId, plan);
  };

  const handleSelectCalendarCropKey = async (plotId: string, cropKey: string) => {
    const existing = plansByPlotId[plotId];
    const nextPlanPayload: Omit<PlotPlanRecord, 'id' | 'ownerId' | 'plotId' | 'updatedAt'> = {
      priorities: existing?.priorities?.length
        ? existing.priorities
        : ['water_saving', 'nitrogen_fixing', 'pest_break', 'erosion_control'],
      constraints: existing?.constraints || {
        waterAvailability: activeField?.waterSource?.isStable ? 'seasonal_limited' : 'scarce',
        equipmentAccess: 'basic_manual',
        marketPreference: 'mixed_family',
      },
      activeStrategy: existing?.activeStrategy,
      rejectedIds: existing?.rejectedIds || [],
      rejectedTitles: existing?.rejectedTitles || [],
      lastRejectionNote: existing?.lastRejectionNote,
      calendarCropKey: cropKey,
    };
    if (!authUser) {
      setPlansByPlotId((prev) => ({
        ...prev,
        [plotId]: {
          id: plotId,
          ownerId: 'DEMO_FARMER',
          plotId,
          ...nextPlanPayload,
          updatedAt: new Date().toISOString(),
        },
      }));
      return;
    }
    await FirestoreService.savePlotPlan(authUser.uid, plotId, nextPlanPayload);
  };

  const handleImportReport = async (report: ImportedFarmReport) => {
    const { cell, distanceKm } = findNearestNasaGrid(report.field.lat, report.field.lon);
    const normalizedField: FieldProfile = {
      ...report.field,
      ownerId: authUser?.uid || report.field.ownerId || 'DEMO_FARMER',
      isSharedWithMe: false,
      nasaGrid: report.field.nasaGrid || {
        cellId: cell.cellId,
        lat: cell.lat,
        lon: cell.lon,
        distanceKm,
      },
    };

    if (!authUser) {
      setFields((prev) => {
        const exists = prev.some((f) => f.id === normalizedField.id);
        return exists
          ? prev.map((f) => (f.id === normalizedField.id ? normalizedField : f))
          : [normalizedField, ...prev];
      });
      if (report.feedbacks?.length) {
        setFeedbackHistory((prev) => {
          const existingIds = new Set(prev.map((x) => x.id));
          const incoming = report.feedbacks
            .filter((x) => !existingIds.has(x.id))
            .map((x) => ({ ...x, fieldId: normalizedField.id }));
          return [...incoming, ...prev];
        });
      }
      if (report.tasks?.length) {
        setTasks((prev) => {
          const existingIds = new Set(prev.map((x) => x.id));
          const incoming = report.tasks
            .filter((x) => !existingIds.has(x.id))
            .map((x) => ({ ...x, fieldId: normalizedField.id }));
          return [...incoming, ...prev];
        });
      }
      if (report.weather) {
        setWeather(report.weather);
      }
      setActiveFieldId(normalizedField.id);
      setShareBanner({
        type: 'ok',
        text: t(
          `Đã nhập hồ sơ ruộng "${normalizedField.name}" để xem ngoại tuyến.`,
          `Imported field report "${normalizedField.name}" for offline review.`
        ),
      });
      return;
    }

    const { id: _ignoredId, nasaGrid: _ignoredGrid, isSharedWithMe: _s, ...creatable } =
      normalizedField;
    const created = await FirestoreService.createField(authUser.uid, creatable);
    if (report.feedbacks?.length) {
      for (const fb of report.feedbacks.slice(0, 20)) {
        const { id: _id, timestamp: _ts, fieldId: _fid, ...fbData } = fb;
        await FirestoreService.createFeedback(authUser.uid, {
          ...fbData,
          fieldId: created.id,
        }).catch(() => {});
      }
    }
    if (report.tasks?.length) {
      const remappedTasks = report.tasks.slice(0, 20).map((tk) => ({
        ...tk,
        fieldId: created.id,
      }));
      await FirestoreService.createTasks(authUser.uid, remappedTasks).catch(() => {});
    }
    setActiveFieldId(created.id);
    setShareBanner({
      type: 'ok',
      text: t(
        `Đã khôi phục hồ sơ ruộng "${created.name}" vào tài khoản Cloud của bạn.`,
        `Restored "${created.name}" into your Cloud account.`
      ),
    });
  };

  const handleCreateCommunityPost = async (input: {
    province: string;
    district?: string;
    cropName?: string;
    category: CommunityCategory;
    title: string;
    content: string;
  }) => {
    if (!authUser) {
      setAuthModalOpen(true);
      throw new Error(
        t(
          'Vui lòng đăng nhập để đăng bài lên Cloud cho toàn bộ cộng đồng cùng xem.',
          'Please sign in to publish your post to Cloud Firestore so all farmers can see it.'
        )
      );
    }

    const otherLang = lang === 'en' ? 'vi' : 'en';
    const { translations } = await translateTexts(
      [input.title, input.content, input.cropName || ''],
      otherLang,
      'Vietnamese farmer community discussion post'
    );
    const title = lang === 'en' ? translations[0] || input.title : input.title;
    const titleEn = lang === 'en' ? input.title : translations[0] || input.title;
    const content = lang === 'en' ? translations[1] || input.content : input.content;
    const contentEn = lang === 'en' ? input.content : translations[1] || input.content;
    const cropName = input.cropName
      ? lang === 'en'
        ? translations[2] || input.cropName
        : input.cropName
      : undefined;
    const cropNameEn = input.cropName
      ? lang === 'en'
        ? input.cropName
        : translations[2] || input.cropName
      : undefined;

    await FirestoreService.createCommunityPost(authUser.uid, authUser.displayName, {
      ...input,
      cropName,
      cropNameEn,
      title,
      titleEn,
      content,
      contentEn,
    });
  };

  const handleAddCommunityReply = async (postId: string, content: string) => {
    if (!authUser) {
      setAuthModalOpen(true);
      throw new Error(
        t(
          'Vui lòng đăng nhập để bình luận đồng bộ lên Cloud.',
          'Please sign in to post a Cloud-synced reply.'
        )
      );
    }
    const target = communityPosts.find((p) => p.id === postId);
    const otherLang = lang === 'en' ? 'vi' : 'en';
    const { translations } = await translateTexts(
      [content],
      otherLang,
      'Farmer reply in agricultural community forum'
    );
    const contentVi = lang === 'en' ? translations[0] || content : content;
    const contentEn = lang === 'en' ? content : translations[0] || content;

    if (target?.isDemoSeed) {
      // Promote sample discussion + user reply into a shared Firestore Cloud post
      const created = await FirestoreService.createCommunityPost(authUser.uid, authUser.displayName, {
        province: target.province,
        district: target.district,
        cropName: target.cropName,
        cropNameEn: target.cropNameEn,
        category: target.category,
        title: target.title,
        titleEn: target.titleEn,
        content: target.content,
        contentEn: target.contentEn,
      });
      await FirestoreService.addCommunityReply(
        created.id,
        authUser.uid,
        authUser.displayName,
        activeField?.province,
        contentVi,
        contentEn
      );
      return;
    }

    await FirestoreService.addCommunityReply(
      postId,
      authUser.uid,
      authUser.displayName,
      activeField?.province,
      contentVi,
      contentEn
    );
  };

  const handleToggleCommunityUpvote = async (postId: string) => {
    if (!authUser) {
      setAuthModalOpen(true);
      return;
    }
    const target = communityPosts.find((p) => p.id === postId);
    if (target?.isDemoSeed) {
      setCommunityPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const upvoted = (p.upvotedUids || []).includes(authUser.uid);
          const nextUids = upvoted
            ? (p.upvotedUids || []).filter((id) => id !== authUser.uid)
            : [...(p.upvotedUids || []), authUser.uid];
          const delta = upvoted ? -1 : 1;
          return {
            ...p,
            upvotedUids: nextUids,
            likesCount: Math.max(0, (p.likesCount || 0) + delta),
          };
        })
      );
      return;
    }
    await FirestoreService.toggleCommunityUpvote(postId, authUser.uid);
  };

  const renderMissingFieldPrompt = () => (
    <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-4 shadow-xs max-w-2xl mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
        {authUser ? <MapPin className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
      </div>
      <h2 className="text-lg font-bold text-stone-900">
        {authUser
          ? t('Bạn chưa lưu thửa ruộng nào trong tài khoản', 'No fields saved in your account yet')
          : t('Đăng nhập để xem & tạo thửa ruộng riêng của bạn', 'Sign in to view & create your private fields')}
      </h2>
      <p className="text-xs sm:text-sm text-stone-500">
        {authUser
          ? t(
              'Hãy tạo hồ sơ thửa ruộng đầu tiên kèm vị trí GPS / bản đồ vệ tinh và họ hạt giống để xem phân tích thời tiết, lịch gieo trồng và phương án luân canh.',
              'Create your first field profile with GPS / satellite location and seed family to unlock weather diagnostics, planting calendar, and rotation plans.'
            )
          : t(
              'Mỗi thửa ruộng thuộc quyền riêng tư của người tạo — CropCast không hiển thị thửa ruộng công khai hay dữ liệu mẫu khi chưa đăng nhập.',
              'Each field is private to its creator — CropCast does not expose public or sample farms before login.'
            )}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {authUser ? (
          <button
            onClick={() => {
              setWizardOpen(true);
              navigateToTab('fields');
            }}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> {t('Tạo thửa ruộng mới ngay', 'Create new field now')}
          </button>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <LogIn className="w-4 h-4" /> {t('Đăng nhập / Tạo tài khoản ngay', 'Sign In / Sign Up')}
          </button>
        )}
      </div>
    </div>
  );

  if (!authReady) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <Sprout className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
          <div className="font-bold text-stone-800">{t('Đang khởi tạo CropCast...', 'Initializing CropCast...')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col font-sans antialiased">
      <Navbar
        activeTab={authUser?.isAdmin ? (activeTab === 'community' ? 'community' : 'admin') : activeTab}
        setActiveTab={(nextTab) => {
          if (authUser?.isAdmin) {
            navigateToTab(nextTab === 'community' ? 'community' : 'admin');
            return;
          }
          navigateToTab(nextTab);
        }}
        fields={fields}
        activeField={activeField}
        onSelectField={handleSelectField}
        onOpenNewFieldModal={() => {
          setWizardOpen(true);
          navigateToTab('fields');
        }}
        authUser={authUser}
        onSignIn={async () => setAuthModalOpen(true)}
        onSignOut={handleSignOut}
      />

      {isDemoMode && (
        <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-3">
          <div className="p-2.5 sm:p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-start sm:items-center gap-2 text-emerald-950">
              <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white font-bold text-[10px] shrink-0 mt-0.5 sm:mt-0">
                {t('Chế độ Demo', 'Demo Mode')}
              </span>
              <span className="leading-relaxed">
                {t(
                  'Trải nghiệm đầy đủ bản đồ, dữ liệu NASA 25 năm, Trợ lý AI & Cộng đồng không cần đăng nhập (lưu tạm trên máy).',
                  'Full access to map, 25-yr NASA data, AI Advisor & Community without sign-in (saved locally).'
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetDemo}
                className="px-2.5 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <RotateCcw className="w-3 h-3" />
                {t('Đặt lại mẫu', 'Reset Demo')}
              </button>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <LogIn className="w-3 h-3" />
                {t('Đăng nhập lưu Cloud', 'Sign In to Cloud')}
              </button>
            </div>
          </div>
        </div>
      )}

      {authMessage && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold flex items-center justify-between">
            <span>{authMessage}</span>
            <button onClick={() => setAuthMessage(null)} className="cursor-pointer font-bold">
              ✕
            </button>
          </div>
        </div>
      )}

      {authUser?.needsRecoveryEmail && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="p-3 bg-amber-50 border border-amber-300 text-amber-950 rounded-xl text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>
              {t(
                'Tài khoản của bạn chưa liên kết địa chỉ Email khôi phục. Vui lòng thêm Email để dùng tính năng Quên mật khẩu và bảo vệ tài khoản.',
                'Your account is missing a recovery Email address. Please link an Email to enable password recovery and protect your account.'
              )}
            </span>
            <button
              type="button"
              onClick={() => setRecoveryEmailModalOpen(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs cursor-pointer shrink-0 self-start sm:self-auto"
            >
              {t('Bổ sung Email ngay', 'Link Email Now')}
            </button>
          </div>
        </div>
      )}

      {shareBanner && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
              shareBanner.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {shareBanner.text}
            </span>
            <button onClick={() => setShareBanner(null)} className="cursor-pointer font-bold">
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 lg:pb-6 space-y-5">
        {/* Clean Sub-Website Navigation Strip for Care Hub */}
        {!authUser?.isAdmin && ['dashboard', 'tasks', 'feedback'].includes(activeTab) && (
          <div className="bg-white rounded-2xl p-1.5 border border-stone-200 shadow-2xs flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'dashboard', label: t('Hôm nay & Quyết định', 'Today & Decisions'), icon: Layers },
              {
                id: 'tasks',
                label: t(
                  `Việc cần làm (${tasks.filter(tk => tk.status === 'pending' || tk.status === 'skipped').length})`,
                  `Tasks (${tasks.filter(tk => tk.status === 'pending' || tk.status === 'skipped').length})`
                ),
                icon: CalendarCheck,
              },
              { id: 'feedback', label: t('Phản hồi thực địa', 'Field Feedback'), icon: History },
            ].map((sub) => {
              const Icon = sub.icon;
              const isSubActive = activeTab === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => navigateToTab(sub.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                    isSubActive
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Clean Sub-Website Navigation Strip for Rotation & Climate Planning Hub */}
        {!authUser?.isAdmin && ['rotation', 'calendar', 'analytics'].includes(activeTab) && (
          <div className="bg-white rounded-2xl p-1.5 border border-stone-200 shadow-2xs flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'rotation', label: t('Luân canh tối ưu', 'Optimal Rotation'), icon: RefreshCw },
              { id: 'calendar', label: t('Lịch gieo trồng 12 tháng', '12-Month Calendar'), icon: CalendarDays },
              { id: 'analytics', label: t('Bản đồ & Biểu đồ khí hậu', 'Climate Map & Charts'), icon: BarChart3 },
            ].map((sub) => {
              const Icon = sub.icon;
              const isSubActive = activeTab === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => navigateToTab(sub.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                    isSubActive
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {!authUser?.isAdmin && activeTab === 'home' && (
          <HomeView
            isAuthenticated={!!authUser}
            userName={authUser?.displayName}
            onOpenAuthModal={() => setAuthModalOpen(true)}
            onOpenNewFieldWizard={() => {
              setWizardOpen(true);
              navigateToTab('fields');
            }}
            onNavigateTab={navigateToTab}
            weather={weather}
          />
        )}

        {!authUser?.isAdmin && activeTab === 'dashboard' &&
          (activeField && ruleBrief ? (
            <DashboardView
              field={activeField}
              weather={weather}
              brief={ruleBrief}
              feedbackHistory={feedbackHistory}
              onOpenExplanation={() => setExplanationOpen(true)}
              onOpenMap={() => {
                setMapInitialCoords({ lat: activeField.lat, lon: activeField.lon });
                setMapPickerOpen(true);
              }}
              onNavigateTab={navigateToTab}
              onSendFeedback={handleInstantFeedback}
              onTaskCompleted={() => {}}
              onSaveEarthMetrics={handleSaveEarthMetrics}
              onRefreshWeather={handleRefreshWeather}
              weatherRefreshing={weatherRefreshing}
            />
          ) : (
            renderMissingFieldPrompt()
          ))}

        {!authUser?.isAdmin && activeTab === 'rotation' &&
          (activeField ? (
            <RotationExplorerView
              field={activeField}
              weather={weather}
              savedPlan={plansByPlotId[activeField.id]}
              onSavePlan={handleSavePlotPlan}
              onOpenMap={() => {
                setMapInitialCoords({ lat: activeField.lat, lon: activeField.lon });
                setMapPickerOpen(true);
              }}
            />
          ) : (
            renderMissingFieldPrompt()
          ))}

        {!authUser?.isAdmin && activeTab === 'fields' && (
          <MyFieldsView
            fields={fields}
            activeField={activeField}
            isAuthenticated={!!authUser}
            onSelectField={handleSelectField}
            onAddNewField={handleAddNewField}
            onUpdateField={handleUpdateField}
            onDeleteField={handleDeleteField}
            onCreateShareLink={handleCreateShareLink}
            onRevokeShareLink={handleRevokeShareLink}
            onShareByEmail={handleShareByEmail}
            onRemoveSharedEmail={handleRemoveSharedEmail}
            onOpenAuthModal={() => setAuthModalOpen(true)}
            onOpenMapPicker={(curLat, curLon) => {
              setMapInitialCoords({ lat: curLat, lon: curLon });
              setMapPickerOpen(true);
            }}
            wizardOpen={wizardOpen}
            setWizardOpen={setWizardOpen}
          />
        )}

        {!authUser?.isAdmin && activeTab === 'tasks' &&
          (activeField ? (
            <TasksView
              tasks={tasks}
              fields={fields}
              activeField={activeField}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onNavigateTab={navigateToTab}
              onOpenFeedback={() => navigateToTab('feedback')}
            />
          ) : (
            renderMissingFieldPrompt()
          ))}

        {!authUser?.isAdmin && activeTab === 'analytics' &&
          (activeField ? (
            <NasaAnalyticsView
              field={activeField}
              weather={weather}
              onOpenMap={() => {
                setMapInitialCoords({ lat: activeField.lat, lon: activeField.lon });
                setMapPickerOpen(true);
              }}
            />
          ) : (
            renderMissingFieldPrompt()
          ))}

        {!authUser?.isAdmin && activeTab === 'calendar' &&
          (activeField ? (
            <PlantingCalendarView
              activeField={activeField}
              savedCropKey={plansByPlotId[activeField.id]?.calendarCropKey}
              onSelectCropKey={handleSelectCalendarCropKey}
            />
          ) : (
            renderMissingFieldPrompt()
          ))}

        {!authUser?.isAdmin && activeTab === 'assistant' &&
          (activeField ? (
            <AiAssistantView activeField={activeField} weather={weather} />
          ) : (
            renderMissingFieldPrompt()
          ))}

        {!authUser?.isAdmin && activeTab === 'feedback' &&
          (activeField ? (
            <FeedbackHistoryView
              activeField={activeField}
              feedbackHistory={feedbackHistory}
              tasks={tasks}
              weather={weather}
              brief={ruleBrief}
              onAddFeedback={handleAddFeedback}
              onSubmitCheckIn={handleFieldCheckInUpdate}
              onNavigateTab={navigateToTab}
              onImportReport={handleImportReport}
            />
          ) : (
            renderMissingFieldPrompt()
          ))}

        {activeTab === 'community' && (
          <CommunityForumView
            activeField={activeField}
            authUser={authUser}
            isDemoMode={isDemoMode}
            posts={communityPosts}
            syncError={communitySyncError}
            onOpenAuthModal={() => setAuthModalOpen(true)}
            onCreatePost={handleCreateCommunityPost}
            onAddReply={handleAddCommunityReply}
            onToggleUpvote={handleToggleCommunityUpvote}
          />
        )}

        {!authUser?.isAdmin && activeTab === 'sources' && (
          <NasaSourcesView onNavigateTab={navigateToTab} />
        )}

        {authUser?.isAdmin && activeTab !== 'community' && (
          <AdminDataManagementView
            onDatasetUpdated={() => setDatasetRefreshTick((t) => t + 1)}
          />
        )}
      </main>

      {/* Modals & Drawers */}
      {activeField && ruleBrief && (
        <ExplanationDrawer
          isOpen={explanationOpen}
          onClose={() => setExplanationOpen(false)}
          brief={ruleBrief}
          field={activeField}
          weather={weather}
        />
      )}

      <InteractiveMapModal
        isOpen={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        selectedLat={mapInitialCoords.lat}
        selectedLon={mapInitialCoords.lon}
        onSelectCoordinates={handleMapCoordinateSelected}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onGoogleSignIn={handleGoogleSignIn}
        onUsernameSignIn={handleUsernameSignIn}
        onEmailSignUp={handleEmailSignUp}
        onSendPasswordReset={handleSendPasswordReset}
      />

      {authUser && (
        <RecoveryEmailModal
          isOpen={recoveryEmailModalOpen}
          displayName={authUser.displayName}
          onClose={() => setRecoveryEmailModalOpen(false)}
          onLinkEmail={handleLinkAccountEmail}
        />
      )}

      <OfflineIndicator lastSyncedAt={lastSyncedAt} />

      {/* Mobile Bottom Navigation Bar (5 primary farmer tabs) */}
      {!authUser?.isAdmin && (
        <nav
          aria-label={t('Điều hướng nhanh trên điện thoại', 'Mobile quick navigation')}
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
            {[
              {
                id: 'home',
                label: t('Trang chủ', 'Home'),
                icon: Home,
                matchTabs: ['home'],
              },
              {
                id: 'fields',
                label: t('Ruộng', 'Fields'),
                icon: Sprout,
                matchTabs: ['fields', 'dashboard', 'tasks', 'feedback'],
              },
              {
                id: 'calendar',
                label: t('Mùa vụ', 'Season'),
                icon: CalendarDays,
                matchTabs: ['calendar', 'rotation'],
              },
              {
                id: 'analytics',
                label: t('Khí hậu', 'Climate'),
                icon: Globe,
                matchTabs: ['analytics', 'sources'],
              },
              {
                id: 'assistant',
                label: 'AI',
                icon: Bot,
                matchTabs: ['assistant'],
              },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = item.matchTabs.includes(activeTab);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateToTab(item.id)}
                  className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition cursor-pointer ${
                    isActive
                      ? 'text-emerald-800 bg-emerald-50/70'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-700' : 'text-stone-500'}`} />
                  <span className="truncate max-w-full px-1">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Attribution, Copyright Compliance & Advisory Disclaimer Footer */}
      <footer className="bg-white border-t border-stone-200 py-6 pb-28 lg:pb-6 px-4 text-xs text-stone-500 mt-10">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <img
              src="/assets/aistudio/cropcast-logo_7ee55ee8.png"
              alt="CropCast — Learn from the past. Grow the future."
              className="h-9 w-auto object-contain self-start"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigateToTab('sources')}
                className="px-3 py-1.5 min-h-[36px] rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-bold text-xs cursor-pointer transition"
              >
                {t('Xem Trang Nguồn dữ liệu NASA & Bản quyền', 'View NASA Data & Sources Page')}
              </button>
            </div>
          </div>

          <AdvisoryDisclaimer compact />

          <div className="pt-2 border-t border-stone-100 text-[11px] text-stone-500 flex flex-col md:flex-row md:items-center justify-between gap-2 leading-relaxed">
            <span>
              {t(
                'Nguồn dữ liệu vệ tinh & khí tượng: NASA POWER (2001–2026), SMAP, GPM, MODIS NDVI, OCO-2/3, GRACE-FO, US GHG Center STAC & Open-Meteo.',
                'Earth Observation & Weather Sources: NASA POWER (2001–2026), SMAP, GPM, MODIS NDVI, OCO-2/3, GRACE-FO, US GHG Center STAC & Open-Meteo.'
              )}
            </span>
            <span>
              {t(
                'Tuyên bố bản quyền: Đội ngũ không sử dụng nhạc, hình ảnh hay văn bản có bản quyền trái phép; sử dụng Trợ lý AI Gemini (Google AI) qua cấu hình API phía máy chủ.',
                'Copyright Compliance: No copyrighted music, images, or third-party text used without permission; powered by Google Gemini AI via secure server-side API configuration.'
              )}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
