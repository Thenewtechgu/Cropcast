import React, { useState, useEffect } from 'react';
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
import { ExplanationDrawer } from './components/ExplanationDrawer';
import { InteractiveMapModal } from './components/InteractiveMapModal';
import { AdminDataManagementView } from './components/AdminDataManagementView';
import { AuthModal } from './components/AuthModal';
import {
  AppUser,
  FieldProfile,
  WeatherObservation,
  DailyAgronomicBrief,
  FarmTask,
  FeedbackRecord,
  FeedbackType,
  EarthEnvironmentSnapshot,
  PlotPlanRecord,
} from './types';
import { Sprout, ShieldCheck, Plus, MapPin, LogIn, CheckCircle2, Layers, CalendarCheck, History, RefreshCw, CalendarDays, BarChart3 } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';

const TAB_TO_PATH: Record<string, string> = {
  home: '/',
  dashboard: '/cham-soc',
  tasks: '/viec-can-lam',
  feedback: '/phan-hoi',
  rotation: '/luan-canh',
  calendar: '/lich-gieo-trong',
  analytics: '/phan-tich-ban-do',
  fields: '/ruong-cua-toi',
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
  const [datasetRefreshTick, setDatasetRefreshTick] = useState(0);

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
        setAuthUser({
          uid: fbUser.uid,
          displayName: fbUser.displayName || t('Nông dân CropCast', 'CropCast Farmer'),
          email: fbUser.email || '',
          photoURL: fbUser.photoURL || undefined,
          emailVerified: fbUser.emailVerified,
          isAdmin,
          authMode: 'firebase',
        });
      } else {
        setAuthUser(null);
      }
      setAuthReady(true);
    });
    return () => unsubAuth();
  }, []);

  const activeField = fields.find((f) => f.id === activeFieldId) || fields[0];
  const activeFieldCellId = activeField?.nasaGrid?.cellId;

  // Load Public Uploaded NASA Climate Overrides (Admin uploads, oldest -> newest, scoped to active field's NASA cell)
  useEffect(() => {
    let mounted = true;
    const baseWeather = StorageService.getWeather();
    FirestoreService.getPublicNasaDatasets()
      .then((datasets) => {
        if (!mounted) return;
        const completed = datasets
          .filter((d) => d.status === 'COMPLETED' && d.sampleOverrides?.length)
          .reverse();
        if (completed.length === 0) {
          setWeather(baseWeather);
          return;
        }
        const next = { ...baseWeather };
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
        setWeather(next);
      })
      .catch(() => {
        if (mounted) setWeather(baseWeather);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, datasetRefreshTick, activeFieldCellId]);

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

  // Subscribe strictly to authenticated farmer's own & shared fields; preserve sub-website route on reload!
  useEffect(() => {
    if (!authReady) return;

    if (!authUser) {
      setFields([]);
      setTasks([]);
      setFeedbackHistory([]);
      setPlansByPlotId({});
      if (activeTab === 'admin') {
        navigateToTab('home', true);
      }
      return;
    }

    if (authUser.isAdmin) {
      setFields([]);
      setTasks([]);
      setFeedbackHistory([]);
      setPlansByPlotId({});
      navigateToTab('admin', true);
      return;
    }

    const unsubFields = FirestoreService.subscribeUserFields(
      authUser.uid,
      authUser.email,
      (cloudFields) => {
        setFields(cloudFields);
        setActiveFieldId((prev) => {
          if (prev && cloudFields.some((f) => f.id === prev)) return prev;
          return cloudFields[0]?.id || '';
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
      unsubFields();
      unsubTasks();
      unsubFeedbacks();
      unsubPlans();
    };
  }, [authReady, authUser]);


  const ruleBrief: DailyAgronomicBrief | null = activeField
    ? analyzeFieldAgronomy(activeField, weather, feedbackHistory, lang)
    : null;

  const handleGoogleSignIn = async () => {
    setAuthMessage(null);
    const user = await FirestoreService.signInWithGoogle();
    setAuthUser(user);
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
    if (user.isAdmin) {
      navigateToTab('admin');
    } else if (activeTab === 'home') {
      navigateToTab('fields');
    }
  };

  const handleUsernameSignUp = async (username: string, password: string) => {
    setAuthMessage(null);
    const user = await FirestoreService.signUpWithUsername(username, password);
    setAuthUser(user);
    if (activeTab === 'home') {
      navigateToTab('fields');
    }
  };

  const handleSignOut = async () => {
    await FirestoreService.signOutUser();
    setAuthUser(null);
    setActiveFieldId('');
    navigateToTab('home');
  };

  const handleSelectField = (fieldId: string) => {
    setActiveFieldId(fieldId);
  };

  const handleAddNewField = async (newFieldData: Omit<FieldProfile, 'id' | 'nasaGrid'>) => {
    if (!authUser) {
      setAuthModalOpen(true);
      return;
    }
    const created = await FirestoreService.createField(authUser.uid, newFieldData);
    const brief = analyzeFieldAgronomy(created, weather, feedbackHistory, lang);
    const newTasks = generateTasksFromBrief(brief, created);
    try {
      await FirestoreService.createTasks(authUser.uid, newTasks);
    } catch {
      // Field was created successfully; avoid aborting navigation if task generation fails
    }
    setActiveFieldId(created.id);
    navigateToTab('fields');
  };

  const handleUpdateField = async (updatedField: FieldProfile) => {
    if (!authUser || updatedField.isSharedWithMe) return;
    await FirestoreService.updateField(authUser.uid, updatedField);
    setActiveFieldId(updatedField.id);
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!authUser) return;
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
    if (!authUser) return;
    await FirestoreService.updateTaskStatus(authUser.uid, taskId, status, note);
  };

  const handleAddFeedback = async (feedback: Omit<FeedbackRecord, 'id' | 'timestamp'>) => {
    if (!authUser || !activeField || activeField.isSharedWithMe) return;
    await FirestoreService.createFeedback(authUser.uid, feedback);
    if (
      feedback.feedbackType === 'soil_still_dry' ||
      feedback.feedbackType === 'soil_too_wet'
    ) {
      const adjustment =
        feedback.feedbackType === 'soil_still_dry'
          ? t(
              'Nông dân phản hồi đất khô nhanh hơn dự báo: Tăng độ nhạy nhắc tưới',
              'Field dried faster than forecast: Increased irrigation reminder sensitivity'
            )
          : t(
              'Nông dân phản hồi đất giữ ẩm lâu / thoát nước chậm: Ưu tiên khơi thông rãnh',
              'Field retained moisture / drained slowly: Prioritized drainage checks'
            );
      await FirestoreService.updateField(authUser.uid, {
        ...activeField,
        adaptiveMemory: {
          ...activeField.adaptiveMemory,
          soilAdjustment: adjustment,
          lastFeedbackDate: new Date().toISOString().slice(0, 10),
        },
      });
    }
  };

  const handleInstantFeedback = (type: FeedbackType, note?: string) => {
    if (!activeField || !authUser || activeField.isSharedWithMe) return;
    handleAddFeedback({
      fieldId: activeField.id,
      feedbackType: type,
      userComment: note,
      systemActionTaken:
        type === 'soil_still_dry'
          ? t(
              'Ghi nhận đất khô nhanh: Tăng độ nhạy nhắc tưới',
              'Recorded fast-drying soil: Increased irrigation alert sensitivity'
            )
          : type === 'soil_too_wet'
          ? t(
              'Ghi nhận đất thoát chậm: Ưu tiên thoát nước',
              'Recorded slow drainage: Prioritized field drainage'
            )
          : t(
              'Đã lưu phản hồi vào nhật ký ruộng',
              'Saved feedback to field log'
            ),
      appliedToProfile: true,
    });
  };

  const handleFieldCheckInUpdate = async (
    input: FieldCheckInInput,
    addFixesToTasks: boolean
  ): Promise<FieldCheckInDiagnostic | null> => {
    if (!activeField || !authUser || activeField.isSharedWithMe) return null;

    const currentBrief =
      ruleBrief || analyzeFieldAgronomy(activeField, weather, feedbackHistory, lang);
    const diagnostic = evaluateFieldCheckIn(activeField, weather, currentBrief, input, lang);

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

    await FirestoreService.createFeedback(authUser.uid, {
      fieldId: activeField.id,
      feedbackType,
      userComment: input.note,
      systemActionTaken: `${diagnostic.verdictTitle} — ${diagnostic.rootCauseExplanation}`,
      predictionOutcome: input.predictionOutcome,
      observedMoisture: input.observedMoisture,
      observedCropHealth: input.observedCropHealth,
      recommendedFixes: diagnostic.fixes,
      appliedToProfile: true,
    });

    await FirestoreService.updateField(authUser.uid, {
      ...activeField,
      crop: {
        ...activeField.crop,
        currentStage: input.updatedStage || activeField.crop.currentStage,
        healthStatus: diagnostic.recommendedHealthStatus,
      },
      adaptiveMemory: {
        ...activeField.adaptiveMemory,
        soilAdjustment: diagnostic.soilAdjustmentNote,
        irrigationSensitivity: diagnostic.irrigationSensitivity,
        lastFeedbackDate: new Date().toISOString().slice(0, 10),
        lastPredictionOutcome: input.predictionOutcome,
        lastCheckInSummary: diagnostic.rootCauseExplanation,
        planFixRecommendations: diagnostic.fixes,
      },
    });

    if (addFixesToTasks && diagnostic.suggestedTasks.length > 0) {
      await FirestoreService.createTasks(authUser.uid, diagnostic.suggestedTasks);
    }

    return diagnostic;
  };

  const handleMapCoordinateSelected = async (lat: number, lon: number) => {
    if (!activeField || !authUser || activeField.isSharedWithMe) return;
    const updated = {
      ...activeField,
      lat,
      lon,
    };
    await FirestoreService.updateField(authUser.uid, updated);
  };

  const handleSaveEarthMetrics = async (snapshot: EarthEnvironmentSnapshot) => {
    if (!activeField || !authUser || activeField.isSharedWithMe) return;
    const updated: FieldProfile = {
      ...activeField,
      adaptiveMemory: {
        ...activeField.adaptiveMemory,
        earthMetrics: snapshot,
      },
    };
    await Promise.all([
      FirestoreService.updateField(authUser.uid, updated),
      FirestoreService.saveEarthMetricsSnapshot(authUser.uid, activeField.id, snapshot),
    ]);
  };

  const handleSavePlotPlan = async (
    plotId: string,
    plan: Omit<PlotPlanRecord, 'id' | 'ownerId' | 'plotId' | 'updatedAt'>
  ) => {
    if (!authUser) return;
    await FirestoreService.savePlotPlan(authUser.uid, plotId, plan);
  };

  const handleSelectCalendarCropKey = async (plotId: string, cropKey: string) => {
    if (!authUser) return;
    const existing = plansByPlotId[plotId];
    await FirestoreService.savePlotPlan(authUser.uid, plotId, {
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
    });
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
        activeTab={authUser?.isAdmin ? 'admin' : activeTab}
        setActiveTab={(nextTab) => {
          if (authUser?.isAdmin) {
            navigateToTab('admin');
            return;
          }
          navigateToTab(nextTab);
        }}
        fields={fields}
        activeField={activeField}
        onSelectField={handleSelectField}
        onOpenNewFieldModal={() => {
          if (!authUser) {
            setAuthModalOpen(true);
            return;
          }
          setWizardOpen(true);
          navigateToTab('fields');
        }}
        authUser={authUser}
        onSignIn={async () => setAuthModalOpen(true)}
        onSignOut={handleSignOut}
      />

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

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
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
              if (!authUser) {
                setAuthModalOpen(true);
                return;
              }
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
              onOpenExplanation={() => setExplanationOpen(true)}
              onOpenMap={() => {
                setMapInitialCoords({ lat: activeField.lat, lon: activeField.lon });
                setMapPickerOpen(true);
              }}
              onNavigateTab={navigateToTab}
              onSendFeedback={handleInstantFeedback}
              onTaskCompleted={() => {}}
              onSaveEarthMetrics={handleSaveEarthMetrics}
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
              weather={weather}
              brief={ruleBrief}
              onAddFeedback={handleAddFeedback}
              onSubmitCheckIn={handleFieldCheckInUpdate}
              onNavigateTab={navigateToTab}
            />
          ) : (
            renderMissingFieldPrompt()
          ))}

        {authUser?.isAdmin && (
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
        onUsernameSignUp={handleUsernameSignUp}
      />

      {/* Minimal Footer */}
      <footer className="bg-white border-t border-stone-200 py-5 px-4 text-xs text-stone-500 mt-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-semibold text-stone-700">CropCast</span>
          <span>
            {t(
              'Hỗ trợ canh tác & luân canh bền vững dựa trên dữ liệu vệ tinh NASA',
              'Sustainable farming & crop rotation powered by NASA Earth data'
            )}
          </span>
        </div>
      </footer>
    </div>
  );
}
