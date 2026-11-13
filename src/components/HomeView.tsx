import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Navigation,
  LogIn,
  Loader2,
  CheckCircle2,
  MessageSquareWarning,
  Send,
  RotateCcw,
} from 'lucide-react';
import { SatelliteMap } from './SatelliteMap';
import { findNearestNasaGrid } from '../data/nasaVietnamGrid';
import { SEED_FAMILIES } from '../data/cropTaxonomy';
import {
  FarmerConstraints,
  FarmerPriorityId,
  FieldProfile,
  RotationStrategy,
  SeedFamilyId,
  WeatherObservation,
} from '../types';
import {
  getFarmerPriorities,
  analyzeBareFieldAndStressTimeline,
  pickBestRotationStrategy,
} from '../services/rotationEngine';
import { GeminiService } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';

interface HomeViewProps {
  isAuthenticated: boolean;
  userName?: string;
  onOpenAuthModal: () => void;
  onOpenNewFieldWizard: () => void;
  onNavigateTab: (tab: string) => void;
  weather: WeatherObservation;
}

export const HomeView: React.FC<HomeViewProps> = ({
  isAuthenticated,
  onOpenAuthModal,
  onOpenNewFieldWizard,
  onNavigateTab,
  weather,
}) => {
  const { lang, t } = useLanguage();
  const [sandboxLat, setSandboxLat] = useState(21.03);
  const [sandboxLon, setSandboxLon] = useState(105.85);
  const [sandboxFamily, setSandboxFamily] = useState<SeedFamilyId>('poaceae');
  const [sandboxPlantIdx, setSandboxPlantIdx] = useState(0);
  const [sandboxPriorities, setSandboxPriorities] = useState<FarmerPriorityId[]>([
    'water_saving',
    'nitrogen_fixing',
    'pest_break',
  ]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  // Single Best Strategy & Farmer Rejection -> AI Rethink state
  const [customStrategy, setCustomStrategy] = useState<RotationStrategy | null>(null);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [rejectedTitles, setRejectedTitles] = useState<string[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rethinking, setRethinking] = useState(false);
  const [lastFeedbackNote, setLastFeedbackNote] = useState<string | null>(null);

  const quickRejectReasons =
    lang === 'en'
      ? [
          'Hard to sell / no local market demand',
          'Field floods easily, unsuitable for this crop',
          'Limited labor / need low-maintenance crop',
          'Prefer crop for livestock forage',
        ]
      : [
          'Khó bán / không có đầu ra tại vùng tôi',
          'Đất nhà tôi hay ngập úng, không trồng được',
          'Thiếu công lao động / cần cây ít chăm sóc',
          'Muốn cây làm thức ăn cho trâu bò',
        ];

  const { cell, distanceKm } = findNearestNasaGrid(sandboxLat, sandboxLon);
  const selectedFamilyInfo =
    SEED_FAMILIES.find((f) => f.id === sandboxFamily) || SEED_FAMILIES[0];
  const sampleCrop =
    selectedFamilyInfo.plants[sandboxPlantIdx] || selectedFamilyInfo.plants[0];

  const sandboxField: FieldProfile = {
    id: 'HOME_SANDBOX',
    name: t('Ruộng thử nghiệm nhanh', 'Quick Trial Field'),
    province: cell.region,
    district: cell.subRegion,
    lat: sandboxLat,
    lon: sandboxLon,
    areaHa: 1.0,
    soilType: sandboxLat < 11.5 ? 'clay' : sandboxLat < 15 ? 'basalt' : 'loam',
    soilCharacteristics: {
      drainage: sandboxLat < 11.5 ? 'slow' : 'moderate',
      holdsWater: true,
      proneToFlooding: sandboxLat < 11.5,
    },
    waterSource: {
      type: 'river',
      isStable: true,
      observation: 'normal',
      hasTestResult: false,
      salinityRisk: sandboxLat < 10.8,
    },
    crop: {
      seedFamily: sandboxFamily,
      name: sampleCrop.name,
      category: sampleCrop.category,
      variety: sampleCrop.commonVarieties[0] || 'Common',
      plantingDate: '2026-02-15',
      currentStage: t('Đang sinh trưởng', 'Growing'),
      stageIndex: 2,
      farmingMethod: 'Canh tác bền vững',
      irrigationMethod: 'Tưới tiết kiệm',
      healthStatus: 'healthy',
    },
    primaryGoal: 'minimize_risk',
    inspectTime: 'morning',
    notificationMethod: 'in_app',
    nasaGrid: {
      cellId: cell.cellId,
      lat: cell.lat,
      lon: cell.lon,
      distanceKm,
    },
  };

  const sandboxConstraints: FarmerConstraints = {
    waterAvailability: 'seasonal_limited',
    equipmentAccess: 'basic_manual',
    marketPreference: 'mixed_family',
  };

  useEffect(() => {
    setCustomStrategy(null);
    setRejectedIds([]);
    setRejectedTitles([]);
    setRejectOpen(false);
    setRejectReason('');
    setLastFeedbackNote(null);
  }, [sandboxLat, sandboxLon, sandboxFamily, sandboxPlantIdx, sandboxPriorities, lang]);

  const prioritiesCatalog = getFarmerPriorities(lang);

  const bestStrategy =
    customStrategy ||
    pickBestRotationStrategy(
      sandboxField,
      weather,
      sandboxPriorities,
      sandboxConstraints,
      rejectedIds,
      lang
    );

  const timeline = analyzeBareFieldAndStressTimeline(
    sandboxField,
    { rainDeltaPct: 0, tempDeltaC: 0 },
    lang
  );
  const bareMonths = timeline.filter((item) => item.fieldState === 'bare_fallow');

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus(
        t(
          'Trình duyệt hiện tại không hỗ trợ định vị GPS.',
          'Your browser does not support GPS geolocation.'
        )
      );
      return;
    }
    setGpsLoading(true);
    setGpsStatus(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSandboxLat(Number(pos.coords.latitude.toFixed(5)));
        setSandboxLon(Number(pos.coords.longitude.toFixed(5)));
        setGpsLoading(false);
        setGpsStatus(
          t(
            'Đã định vị theo GPS thiết bị và tự động ghép điểm khí hậu gần nhất.',
            'Located via device GPS and matched nearest climate grid cell.'
          )
        );
      },
      () => {
        setGpsLoading(false);
        setGpsStatus(
          t(
            'Không lấy được GPS (hãy cấp quyền vị trí hoặc chạm trực tiếp lên bản đồ).',
            'Unable to get GPS (please allow location access or tap directly on the map).'
          )
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const togglePriority = (id: FarmerPriorityId) => {
    setSandboxPriorities((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleRethinkStrategy = async () => {
    const clean = rejectReason.trim();
    if (!clean) return;
    setRethinking(true);
    try {
      const nextExcluded = [...rejectedIds, bestStrategy.id];
      const nextTitles = [...rejectedTitles, bestStrategy.title];
      const { strategy } = await GeminiService.rethinkRotationStrategy({
        field: sandboxField,
        weather,
        rejectedStrategy: bestStrategy,
        rejectionReason: clean,
        excludedIds: rejectedIds,
        previouslyRejectedTitles: nextTitles,
        priorities: sandboxPriorities,
        constraints: sandboxConstraints,
        language: lang,
      });
      setRejectedIds(nextExcluded);
      setRejectedTitles(nextTitles);
      setCustomStrategy(strategy);
      setLastFeedbackNote(clean);
      setRejectReason('');
      setRejectOpen(false);
    } finally {
      setRethinking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Interactive Testing Workspace RIGHT UP FRONT */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
              {t(
                'Lập kế hoạch luân canh & theo dõi bền vững',
                'Crop Rotation & Sustainability Planner'
              )}
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              {t(
                'Chạm bản đồ hoặc lấy GPS, chọn họ hạt giống và mục tiêu để xem phương án luân canh tối ưu.',
                'Tap the map or use GPS, pick a seed family and farm goals to get the optimal rotation plan.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUseGps}
              disabled={gpsLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              {gpsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
              {gpsLoading
                ? t('Đang lấy GPS...', 'Getting GPS...')
                : t('Lấy GPS thiết bị', 'Use Device GPS')}
            </button>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onOpenNewFieldWizard}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" /> {t('Thêm ruộng mới', 'Add New Field')}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" /> {t('Đăng nhập / Đăng ký', 'Sign In / Sign Up')}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Interactive Satellite Map */}
          <div className="lg:col-span-6 space-y-3">
            <SatelliteMap
              lat={sandboxLat}
              lon={sandboxLon}
              zoom={13}
              heightClass="h-72"
              interactive={true}
              showNasaGrid={true}
              onLocationChange={(lat, lon) => {
                setSandboxLat(lat);
                setSandboxLon(lon);
              }}
              fieldLabel={t('Vị trí thử nghiệm', 'Trial Location')}
            />

            {gpsStatus && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                {gpsStatus}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-stone-400 text-[11px] block">
                  {t('Điểm khí hậu gần nhất', 'Nearest climate grid')}
                </span>
                <span className="font-bold text-stone-900">{cell.region}</span>
                <span className="text-[11px] text-emerald-700 font-medium block">
                  {t(`Cách ${distanceKm} km`, `${distanceKm} km away`)}
                </span>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-stone-400 text-[11px] block">
                  {t('Mưa trung bình năm', 'Annual rainfall')}
                </span>
                <span className="font-bold text-stone-900 font-mono tabular-nums">
                  {cell.climatology21Yr.annualRainfallMm} mm
                </span>
                <span className="text-[11px] text-stone-500 block">
                  {t('TB', 'Avg')} {cell.climatology21Yr.avgTemp}°C
                </span>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-stone-400 text-[11px] block">
                  {t('Tháng thường để trống', 'Bare soil months')}
                </span>
                <span className="font-bold text-amber-700">
                  {bareMonths.length} {t('tháng/năm', 'mo/yr')}
                </span>
                <span className="text-[11px] text-stone-500 block">
                  {t('Cần cây che phủ', 'Cover crop advised')}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Seed Family FIRST -> Plant -> Priorities -> SINGLE Best Strategy + Rejection Button */}
          <div className="lg:col-span-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-stone-800 block mb-2">
                {t(
                  '1. Chọn Họ hạt giống bạn đang trồng trước:',
                  '1. Select current Seed Family first:'
                )}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SEED_FAMILIES.map((fam) => (
                  <button
                    key={fam.id}
                    type="button"
                    onClick={() => {
                      setSandboxFamily(fam.id);
                      setSandboxPlantIdx(0);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      sandboxFamily === fam.id
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                        : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <div className="text-xs font-bold leading-snug">{fam.name}</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        sandboxFamily === fam.id ? 'text-emerald-200' : 'text-stone-500'
                      }`}
                    >
                      {fam.shortTag}
                    </div>
                  </button>
                ))}
              </div>

              {/* Plant Selection after Seed Family */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-stone-600 mr-1">
                  {t('Cây cụ thể:', 'Crop:')}
                </span>
                {selectedFamilyInfo.plants.map((pl, idx) => (
                  <button
                    key={pl.name}
                    type="button"
                    onClick={() => setSandboxPlantIdx(idx)}
                    className={`px-2.5 py-1 rounded-lg border text-xs transition cursor-pointer ${
                      sandboxPlantIdx === idx
                        ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {pl.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-800 block mb-2">
                {t('2. Ưu tiên của gia đình bạn:', '2. Farm priorities:')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {prioritiesCatalog.map((p) => {
                  const active = sandboxPriorities.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePriority(p.id)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                        active
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-bold'
                          : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ONLY ONE Best Rotation Strategy + Farmer Rejection Flow */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800">
                  {t(
                    `3. Chiến lược Luân canh Tốt nhất cho ${sampleCrop.name} tại ${cell.region}:`,
                    `3. Best Rotation Strategy for ${sampleCrop.name} in ${cell.region}:`
                  )}
                </span>
                <button
                  onClick={() => onNavigateTab('rotation')}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer"
                >
                  {t('Xem bảng chi tiết →', 'View full analysis →')}
                </button>
              </div>

              <div className="p-4 rounded-2xl border-2 border-emerald-600/35 bg-emerald-50/40 space-y-2.5 text-xs">
                {lastFeedbackNote && (
                  <div className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-emerald-200 text-[11px] text-emerald-900">
                    <span>
                      <strong>{t('AI đã chọn lại', 'AI adjusted')}</strong>{' '}
                      {t('theo lý do:', 'based on:')}{' '}
                      <em>"{lastFeedbackNote}"</em>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomStrategy(null);
                        setRejectedIds([]);
                        setRejectedTitles([]);
                        setLastFeedbackNote(null);
                      }}
                      className="text-emerald-700 font-bold inline-flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <RotateCcw className="w-3 h-3" /> {t('Đặt lại', 'Reset')}
                    </button>
                  </div>
                )}

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-stone-900">{bestStrategy.title}</div>
                    <div className="text-[11px] font-semibold text-emerald-800 mt-0.5">
                      {bestStrategy.sequenceSummary}
                    </div>
                  </div>
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800 shrink-0 tabular-nums">
                    {t('Phù hợp', 'Match')} {bestStrategy.suitabilityScore}%
                  </span>
                </div>

                <p className="text-stone-700 leading-relaxed">{bestStrategy.whySuggested}</p>

                {/* Button right below strategy for farmer to say why it doesn't work */}
                {!rejectOpen ? (
                  <button
                    type="button"
                    onClick={() => setRejectOpen(true)}
                    className="w-full py-2 px-3 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquareWarning className="w-3.5 h-3.5" />
                    {t(
                      'Phương án này không hợp với ruộng tôi — Nêu lý do để AI chọn lại',
                      'Not suitable for my field — Explain why to get another plan'
                    )}
                  </button>
                ) : (
                  <div className="bg-white border border-amber-300 rounded-xl p-3 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {quickRejectReasons.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRejectReason(r)}
                          className={`text-[11px] px-2 py-0.5 rounded border cursor-pointer ${
                            rejectReason === r
                              ? 'bg-amber-500 text-stone-950 border-amber-600 font-bold'
                              : 'bg-stone-50 text-stone-700 border-stone-200'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder={t(
                          'Nhập lý do phương án này chưa hợp với gia đình...',
                          'Describe why this plan does not fit your farm...'
                        )}
                        className="flex-1 px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={handleRethinkStrategy}
                        disabled={!rejectReason.trim() || rethinking}
                        className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {rethinking ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        {t('Chọn lại', 'Re-pick')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
