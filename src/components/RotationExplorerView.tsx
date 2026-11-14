import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Layers,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  ShieldAlert,
  Sprout,
  Satellite,
  Sparkles,
  ChevronDown,
  ChevronUp,
  MessageSquareWarning,
  Loader2,
  RotateCcw,
  Send,
  Clock,
} from 'lucide-react';
import {
  FarmerConstraints,
  FarmerPriorityId,
  FieldProfile,
  PlotPlanRecord,
  RotationStrategy,
  WeatherObservation,
  EarthEnvironmentSnapshot,
} from '../types';
import {
  getFarmerPriorities,
  getScientificGlossary,
  analyzeBareFieldAndStressTimeline,
  computeHarmonizedIndicators,
  pickBestRotationStrategy,
  getLocalizedEvapRisk,
} from '../services/rotationEngine';
import { GeminiService } from '../services/geminiService';
import { getSoilLabel, getDrainageLabel } from '../services/agronomyEngine';
import {
  resolveCropBotanicalProfile,
  getPlantDisplayName,
} from '../data/cropTaxonomy';
import { getLocalizedRegionName } from '../data/nasaVietnamGrid';
import { fetchFieldEarthMetrics } from '../services/earthSyncService';
import { useLanguage } from '../contexts/LanguageContext';

interface RotationExplorerViewProps {
  field: FieldProfile;
  weather: WeatherObservation;
  savedPlan?: PlotPlanRecord;
  onSavePlan?: (
    plotId: string,
    plan: Omit<PlotPlanRecord, 'id' | 'ownerId' | 'plotId' | 'updatedAt'>
  ) => Promise<void> | void;
  onOpenMap: () => void;
}

const DEFAULT_PRIORITIES: FarmerPriorityId[] = [
  'water_saving',
  'nitrogen_fixing',
  'pest_break',
  'erosion_control',
];

export const RotationExplorerView: React.FC<RotationExplorerViewProps> = ({
  field,
  weather,
  savedPlan,
  onSavePlan,
  onOpenMap,
}) => {
  const { lang, t } = useLanguage();
  const [priorities, setPriorities] = useState<FarmerPriorityId[]>(
    savedPlan?.priorities?.length ? savedPlan.priorities : DEFAULT_PRIORITIES
  );
  const [constraints, setConstraints] = useState<FarmerConstraints>(
    savedPlan?.constraints || {
      waterAvailability: field.waterSource.isStable ? 'seasonal_limited' : 'scarce',
      equipmentAccess: 'basic_manual',
      marketPreference: 'mixed_family',
    }
  );
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  // Single Best Strategy & AI Rethink State
  const [customBestStrategy, setCustomBestStrategy] = useState<RotationStrategy | null>(
    savedPlan?.activeStrategy || null
  );
  const [rejectedIds, setRejectedIds] = useState<string[]>(savedPlan?.rejectedIds || []);
  const [rejectedTitles, setRejectedTitles] = useState<string[]>(savedPlan?.rejectedTitles || []);
  const [lastRejectionNote, setLastRejectionNote] = useState<string | null>(
    savedPlan?.lastRejectionNote || null
  );
  const [aiSourceLabel, setAiSourceLabel] = useState<string | null>(null);

  // Rejection Reason UI
  const [rejectPanelOpen, setRejectPanelOpen] = useState(false);
  const [rejectionInput, setRejectionInput] = useState('');
  const [rethinking, setRethinking] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [earthSnapshot, setEarthSnapshot] = useState<EarthEnvironmentSnapshot | null>(
    field.adaptiveMemory?.earthMetrics || null
  );

  const quickReasons =
    lang === 'en'
      ? [
          'No local buyer / hard to sell',
          'Field floods easily, crop cannot survive',
          'Insufficient labor or capital',
          'Need livestock forage crop instead',
          'Seed variety unavailable at local co-op',
        ]
      : [
          'Không có đầu ra / khó bán ở địa phương',
          'Đất ruộng hay úng nước, không hợp cây này',
          'Thiếu vốn hoặc không đủ nhân công chăm sóc',
          'Cần cây làm thức ăn cho trâu bò / gia súc',
          'Hợp tác xã địa phương chưa có giống này',
        ];

  useEffect(() => {
    let active = true;
    const saved = field.adaptiveMemory?.earthMetrics || null;
    setEarthSnapshot(saved);
    if (!saved) {
      fetchFieldEarthMetrics(field)
        .then((res) => {
          if (active) setEarthSnapshot(res);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [field.id, field.adaptiveMemory?.earthMetrics]);

  // Hydrate saved Firestore plan whenever switching fields
  useEffect(() => {
    setPriorities(
      savedPlan?.priorities?.length ? savedPlan.priorities : DEFAULT_PRIORITIES
    );
    setConstraints(
      savedPlan?.constraints || {
        waterAvailability: field.waterSource.isStable ? 'seasonal_limited' : 'scarce',
        equipmentAccess: 'basic_manual',
        marketPreference: 'mixed_family',
      }
    );
    setCustomBestStrategy(savedPlan?.activeStrategy || null);
    setRejectedIds(savedPlan?.rejectedIds || []);
    setRejectedTitles(savedPlan?.rejectedTitles || []);
    setLastRejectionNote(savedPlan?.lastRejectionNote || null);
    setAiSourceLabel(null);
    setRejectPanelOpen(false);
    setRejectionInput('');
  }, [field.id, savedPlan?.id, savedPlan?.updatedAt]);

  const persistPlanPatch = (
    nextPriorities: FarmerPriorityId[],
    nextConstraints: FarmerConstraints,
    nextStrategy: RotationStrategy | null,
    nextRejectedIds: string[],
    nextRejectedTitles: string[],
    nextNote: string | null
  ) => {
    if (!onSavePlan || field.isSharedWithMe) return;
    onSavePlan(field.id, {
      priorities: nextPriorities,
      constraints: nextConstraints,
      activeStrategy: nextStrategy || undefined,
      rejectedIds: nextRejectedIds,
      rejectedTitles: nextRejectedTitles,
      lastRejectionNote: nextNote || undefined,
      calendarCropKey: savedPlan?.calendarCropKey,
    });
  };

  const togglePriority = (id: FarmerPriorityId) => {
    setPriorities((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      setCustomBestStrategy(null);
      setRejectedIds([]);
      setRejectedTitles([]);
      setLastRejectionNote(null);
      persistPlanPatch(next, constraints, null, [], [], null);
      return next;
    });
  };

  const updateConstraints = (patch: Partial<FarmerConstraints>) => {
    setConstraints((prev) => {
      const next = { ...prev, ...patch };
      setCustomBestStrategy(null);
      setRejectedIds([]);
      setRejectedTitles([]);
      setLastRejectionNote(null);
      persistPlanPatch(priorities, next, null, [], [], null);
      return next;
    });
  };

  const resolvedBotanical = resolveCropBotanicalProfile(
    field.crop.name,
    field.crop.seedFamily,
    field.crop.category
  );
  const fixedScenario = { rainDeltaPct: 0, tempDeltaC: 0 };
  const indicators = computeHarmonizedIndicators(field, weather, fixedScenario, lang);
  const timeline = analyzeBareFieldAndStressTimeline(field, fixedScenario, lang);

  const bestStrategy =
    customBestStrategy ||
    pickBestRotationStrategy(field, weather, priorities, constraints, rejectedIds, undefined, lang);

  const bareMonthsCount = timeline.filter((m) => m.fieldState === 'bare_fallow').length;
  const highStressMonthsCount = timeline.filter((m) => m.stressLevel === 'high').length;
  const farmerPrioritiesList = getFarmerPriorities(lang);
  const glossaryList = getScientificGlossary(lang);

  const handleSubmitRejection = async () => {
    const cleanReason = rejectionInput.trim();
    if (!cleanReason) {
      setRejectError(
        t(
          'Vui lòng chọn hoặc nhập lý do vì sao phương án này chưa phù hợp với ruộng của bạn.',
          'Please pick or type why this strategy does not fit your field.'
        )
      );
      return;
    }

    setRejectError(null);
    setRethinking(true);
    try {
      const nextExcluded = [...rejectedIds, bestStrategy.id];
      const nextTitles = [...rejectedTitles, bestStrategy.title];

      const { strategy, source } = await GeminiService.rethinkRotationStrategy({
        field,
        weather,
        rejectedStrategy: bestStrategy,
        rejectionReason: cleanReason,
        excludedIds: rejectedIds,
        previouslyRejectedTitles: nextTitles,
        priorities,
        constraints,
        language: lang,
      });

      setRejectedIds(nextExcluded);
      setRejectedTitles(nextTitles);
      setCustomBestStrategy(strategy);
      setLastRejectionNote(cleanReason);
      persistPlanPatch(
        priorities,
        constraints,
        strategy,
        nextExcluded,
        nextTitles,
        cleanReason
      );
      setAiSourceLabel(
        source === 'gemini'
          ? t(
              'Gemini AI đã chọn lại theo phản hồi thực tế của bạn',
              'Gemini AI re-selected based on your field feedback'
            )
          : t(
              'Hệ thống đã chuyển sang phương án thay thế phù hợp hơn',
              'Switched to a better alternative strategy'
            )
      );
      setRejectionInput('');
      setRejectPanelOpen(false);
    } finally {
      setRethinking(false);
    }
  };

  const handleResetToInitialBest = () => {
    setCustomBestStrategy(null);
    setRejectedIds([]);
    setRejectedTitles([]);
    setLastRejectionNote(null);
    setAiSourceLabel(null);
    setRejectPanelOpen(false);
    setRejectionInput('');
    setRejectError(null);
    persistPlanPatch(priorities, constraints, null, [], [], null);
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const rotationAdviceText =
    lang === 'en'
      ? earthSnapshot?.rotationAdviceEn || earthSnapshot?.rotationAdvice
      : earthSnapshot?.rotationAdvice;

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" />{' '}
              {t('Hỗ trợ quyết định Luân canh & Đất khỏe', 'Crop Rotation & Soil Health')}
            </span>
            <span className="text-stone-500">
              {t('Ruộng:', 'Field:')} <strong className="text-stone-800">{field.name}</strong> (
              {getLocalizedRegionName(field.province, lang)})
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
            {t(
              'Phân tích Đất trống, Khí hậu & Chiến lược Luân canh Tối ưu',
              'Bare-Soil Timeline, Climate & Optimal Rotation Strategy'
            )}
          </h1>
          <p className="text-xs sm:text-sm text-stone-600">
            {t('Cây hiện tại:', 'Current crop:')}{' '}
            <strong>{getPlantDisplayName(field.crop.name, lang)}</strong> (
            {lang === 'en' ? resolvedBotanical.familyLabelEn : resolvedBotanical.familyLabelVi}) •{' '}
            {t('Đất:', 'Soil:')} <strong>{getSoilLabel(field.soilType, lang)}</strong> (
            {getDrainageLabel(field.soilCharacteristics.drainage, lang)})
          </p>
        </div>

        <button
          onClick={onOpenMap}
          className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 self-start md:self-auto"
        >
          <Satellite className="w-4 h-4" />{' '}
          {t('Xem ảnh vệ tinh thửa ruộng', 'View Field Satellite Map')}
        </button>
      </div>

      {/* Sustainability Context with Last Updated */}
      {earthSnapshot && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 font-mono tabular-nums">
            <div>
              <span className="text-stone-500 font-sans block">
                {t('Hấp thụ Carbon', 'Carbon Uptake')}
              </span>
              <span className="font-bold text-stone-900 text-sm">
                {earthSnapshot.carbonFluxOco2.carbonUptakeTonHaYr}{' '}
                {t('tấn/ha', 't/ha')}
              </span>
              <span className="text-[10px] text-stone-400 flex items-center gap-1 font-sans mt-0.5">
                <Clock className="w-2.5 h-2.5" />{' '}
                {formatTimestamp(earthSnapshot.carbonFluxOco2.lastUpdated)}
              </span>
            </div>
            <div>
              <span className="text-stone-500 font-sans block">
                {t('Trữ lượng Nước ngầm', 'Groundwater Reserve')}
              </span>
              <span className="font-bold text-stone-900 text-sm">
                {earthSnapshot.groundwaterAnomalyGrace.lweThicknessCm >= 0
                  ? `+${earthSnapshot.groundwaterAnomalyGrace.lweThicknessCm}`
                  : earthSnapshot.groundwaterAnomalyGrace.lweThicknessCm}{' '}
                cm
              </span>
              <span className="text-[10px] text-stone-400 flex items-center gap-1 font-sans mt-0.5">
                <Clock className="w-2.5 h-2.5" />{' '}
                {formatTimestamp(earthSnapshot.groundwaterAnomalyGrace.lastUpdated)}
              </span>
            </div>
            <div>
              <span className="text-stone-500 font-sans block">
                {t('Phát thải Ruộng', 'Field Emissions')}
              </span>
              <span className="font-bold text-stone-900 text-sm">
                {earthSnapshot.greenhouseGasEdgar.co2eqTonHa}{' '}
                {t('tấn CO₂e/ha', 't CO₂e/ha')}
              </span>
              <span className="text-[10px] text-stone-400 flex items-center gap-1 font-sans mt-0.5">
                <Clock className="w-2.5 h-2.5" />{' '}
                {formatTimestamp(earthSnapshot.greenhouseGasEdgar.lastUpdated)}
              </span>
            </div>
          </div>
          <p className="text-stone-700 lg:max-w-md leading-relaxed">
            <strong className="text-stone-900">
              {t('Định hướng luân canh:', 'Rotation guidance:')}
            </strong>{' '}
            {rotationAdviceText}
          </p>
        </div>
      )}

      {/* Farmer Priorities & Automated Climate Forecast Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Farmer Priorities & Practical Constraints */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Sprout className="w-4 h-4 text-emerald-700" />
              {t(
                '1. Nhu cầu ưu tiên & Điều kiện thực tế của gia đình',
                '1. Farm Priorities & Practical Constraints'
              )}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {t(
                'Chọn những mục tiêu bạn quan tâm nhất để hệ thống chấm điểm và tìm ra chiến lược luân canh tối ưu nhất.',
                'Select your top goals so the model scores and picks the strongest crop rotation plan.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {farmerPrioritiesList.map((p) => {
              const selected = priorities.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePriority(p.id)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    selected
                      ? 'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-600/30'
                      : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-stone-900">{p.label}</span>
                    {selected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">{p.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-stone-100 text-xs">
            <div>
              <label className="font-bold text-stone-700 block mb-1">
                {t('Nguồn nước tưới', 'Water Availability')}
              </label>
              <select
                value={constraints.waterAvailability}
                onChange={(e) =>
                  updateConstraints({ waterAvailability: e.target.value as any })
                }
                className="w-full px-2.5 py-2 border border-stone-300 rounded-xl bg-white text-stone-900"
              >
                <option value="abundant">{t('Chủ động quanh năm', 'Year-round abundant')}</option>
                <option value="seasonal_limited">
                  {t('Hạn chế vào mùa khô', 'Dry-season limited')}
                </option>
                <option value="scarce">{t('Thiếu nước / Chỉ nhờ mưa', 'Scarce / Rain-fed')}</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-stone-700 block mb-1">
                {t('Máy móc & Công lao động', 'Equipment & Labor')}
              </label>
              <select
                value={constraints.equipmentAccess}
                onChange={(e) =>
                  updateConstraints({ equipmentAccess: e.target.value as any })
                }
                className="w-full px-2.5 py-2 border border-stone-300 rounded-xl bg-white text-stone-900"
              >
                <option value="basic_manual">{t('Làm thủ công hộ gia đình', 'Manual / small scale')}</option>
                <option value="mechanized">{t('Có máy cày, cơ giới hóa', 'Mechanized')}</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-stone-700 block mb-1">
                {t('Đầu ra mong muốn', 'Market Preference')}
              </label>
              <select
                value={constraints.marketPreference}
                onChange={(e) =>
                  updateConstraints({ marketPreference: e.target.value as any })
                }
                className="w-full px-2.5 py-2 border border-stone-300 rounded-xl bg-white text-stone-900"
              >
                <option value="mixed_family">{t('Kết hợp bán & tự dùng', 'Mixed market & home')}</option>
                <option value="cash_crop">{t('Ưu tiên nông sản bán chợ', 'Cash crop market')}</option>
                <option value="forage_livestock">
                  {t('Ưu tiên thức ăn chăn nuôi', 'Livestock forage')}
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Right: App-Computed Climate & Soil Indicators */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Satellite className="w-4 h-4 text-emerald-700" />
              {t(
                '2. Điều kiện Khí hậu & Độ ẩm Mùa tới',
                '2. Upcoming Season Climate & Moisture'
              )}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {t(
                `Tính toán từ chuỗi khí hậu 25 năm (2001–2025), cân bằng nước và đặc điểm đất của thửa ruộng.`,
                `Computed from the 25-year climate baseline (2001–2025), water balance, and field soil profile.`
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200">
              <span className="text-[11px] text-stone-500 block">
                {t('Độ ẩm tầng rễ ước tính', 'Estimated root moisture')}
              </span>
              <span className="text-xl font-black text-emerald-900 tabular-nums">
                {indicators.rootMoisturePct}%
              </span>
              <span className="text-[10px] text-stone-500 block">
                {t('Tầng mặt:', 'Surface:')} {indicators.surfaceMoisturePct}%
              </span>
            </div>
            <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200">
              <span className="text-[11px] text-stone-500 block">
                {t('Bốc thoát hơi nước', 'Evapotranspiration')}
              </span>
              <span className="text-xl font-black text-amber-900 tabular-nums">
                {indicators.evapotranspirationMmDay} {t('mm/ngày', 'mm/day')}
              </span>
              <span className="text-[10px] text-stone-500 block">
                {t('Áp lực nắng nóng:', 'Heat stress:')} {indicators.heatStressIndex}
              </span>
            </div>
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[11px] text-stone-500 block">
                {t('Nguy cơ xói mòn mặt đất', 'Surface erosion risk')}
              </span>
              <span className="font-bold text-stone-900 text-sm">{indicators.erosionRisk}</span>
            </div>
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[11px] text-stone-500 block">
                {t('Tháng dễ thiếu ẩm', 'Dry stress months')}
              </span>
              <span className="font-bold text-stone-900 text-sm">
                {indicators.droughtRiskMonths.length
                  ? t(
                      `Tháng ${indicators.droughtRiskMonths.join(', ')}`,
                      `M${indicators.droughtRiskMonths.join(', M')}`
                    )
                  : t('Ít biến động', 'Low variance')}
              </span>
            </div>
          </div>

          <div className="text-xs text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
            <div>
              <strong>{t('Xu thế nước vùng:', 'Regional water trend:')}</strong>{' '}
              {indicators.longTermWaterTrend}
            </div>
            <div className="text-stone-600">{indicators.vegetationStressNote}</div>
          </div>
        </div>
      </div>

      {/* 12-Month Bare-Field & Crop Vulnerability Timeline */}
      <section className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-700" />
              {t(
                '3. Thời điểm đất trống & Tháng cây trồng dễ bị tổn thương trong năm',
                '3. Annual Bare-Soil Windows & Climate Stress Timeline'
              )}
            </h2>
            <p className="text-xs text-stone-500">
              {t(
                `Phát hiện ${bareMonthsCount} tháng đất thường để trống và ${highStressMonthsCount} tháng áp lực hạn/mưa lớn cao để chèn cây họ Đậu hoặc cây che phủ.`,
                `Detected ${bareMonthsCount} bare-soil months and ${highStressMonthsCount} high-stress months ideal for legume or cover crops.`
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />{' '}
              {t('Đang có cây chính', 'Main crop')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-400 inline-block" />{' '}
              {t('Chuyển vụ', 'Transition')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-rose-400 inline-block" />{' '}
              {t('Đất trống (dễ xói mòn/bốc hơi)', 'Bare fallow')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {timeline.map((m) => {
            const stateBg =
              m.fieldState === 'active_crop'
                ? 'border-emerald-200 bg-emerald-50/40'
                : m.fieldState === 'harvest_transition'
                ? 'border-amber-200 bg-amber-50/40'
                : 'border-rose-200 bg-rose-50/40';

            const stateLabel =
              m.fieldState === 'active_crop'
                ? t('Có cây trên ruộng', 'Active crop')
                : m.fieldState === 'harvest_transition'
                ? t('Giai đoạn chuyển vụ', 'Transition')
                : t('Đất bỏ trống', 'Bare fallow');

            return (
              <div
                key={m.month}
                className={`p-3 rounded-xl border ${stateBg} space-y-1.5 text-xs flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">{m.monthLabel}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      m.stressLevel === 'high'
                        ? 'bg-rose-100 text-rose-800'
                        : m.stressLevel === 'moderate'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {m.stressLevel === 'high'
                      ? t('Rủi ro cao', 'High risk')
                      : m.stressLevel === 'moderate'
                      ? t('Cần chú ý', 'Caution')
                      : t('Ổn định', 'Stable')}
                  </span>
                </div>

                <div className="text-[11px] font-semibold text-stone-700">{stateLabel}</div>

                <div className="text-[11px] text-stone-600 leading-snug">{m.dominantRisk}</div>

                <div className="pt-1 border-t border-stone-200/70 flex items-center justify-between text-[10px] text-stone-500">
                  <span>
                    {t('Ẩm rễ:', 'Root:')} {m.soilMoisturePct}%
                  </span>
                  <span>
                    {t('Bốc hơi:', 'ET:')} {getLocalizedEvapRisk(m.evaporationRisk, lang)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SINGLE BEST ROTATION STRATEGY + Farmer Rejection -> AI Re-decide */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-700" />
              {t(
                '4. Chiến lược Luân canh Tối ưu nhất được Đề xuất',
                '4. Recommended Optimal Rotation Strategy'
              )}
            </h2>
            <p className="text-xs text-stone-500">
              {t(
                'Hệ thống chọn ra 1 chiến lược tốt nhất dựa trên đất, nguồn nước, thời tiết và chỉ số môi trường ruộng. Nếu thấy chưa phù hợp thực tế, bạn có thể phản hồi để AI chọn phương án khác.',
                'Selects the top strategy using soil, water, climate baseline, and field sustainability metrics. Reject with a reason below to have AI choose another plan.'
              )}
            </p>
          </div>
          {customBestStrategy && (
            <button
              type="button"
              onClick={handleResetToInitialBest}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-emerald-800 bg-white border border-stone-200 px-3 py-1.5 rounded-xl cursor-pointer shrink-0 self-start"
            >
              <RotateCcw className="w-3.5 h-3.5" />{' '}
              {t('Quay lại gợi ý ban đầu', 'Reset to initial plan')}
            </button>
          )}
        </div>

        {/* Single Strategy Card */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border-2 border-emerald-600/40 space-y-5 shadow-sm">
          {aiSourceLabel && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  <strong>{aiSourceLabel}:</strong>{' '}
                  {t('Đã thay đổi vì lý do', 'Adjusted for reason')}{' '}
                  <em>"{lastRejectionNote}"</em>
                </span>
              </div>
            </div>
          )}

          {/* Title & Score */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 border-b border-stone-100 pb-4">
            <div className="space-y-1">
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {customBestStrategy
                  ? t('Phương án AI chọn lại tốt hơn', 'AI Adjusted Plan')
                  : t('Chiến lược tối ưu nhất', 'Top Optimal Strategy')}
              </span>
              <h3 className="text-lg font-bold text-stone-900">{bestStrategy.title}</h3>
              <div className="text-xs font-semibold text-emerald-800">
                {t('Chuỗi vụ đề xuất:', 'Rotation sequence:')} {bestStrategy.sequenceSummary}
              </div>
            </div>

            <div className="text-center bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 shrink-0">
              <div className="text-[10px] text-emerald-800 font-semibold">
                {t('Độ phù hợp', 'Suitability')}
              </div>
              <div className="text-2xl font-black text-emerald-700 tabular-nums">
                {bestStrategy.suitabilityScore}%
              </div>
            </div>
          </div>

          {/* Why suggested & Supporting Evidence */}
          <div className="space-y-3 text-xs sm:text-sm">
            <div>
              <span className="font-bold text-stone-900">
                {t('Vì sao đề xuất phương án này: ', 'Why this plan fits: ')}
              </span>
              <span className="text-stone-700 leading-relaxed">{bestStrategy.whySuggested}</span>
            </div>
            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-1.5 text-xs">
              <div className="font-bold text-stone-800 text-[11px] uppercase tracking-wider">
                {t('Bằng chứng từ khí hậu, vệ tinh & hồ sơ ruộng:', 'Climate, Satellite & Field Evidence:')}
              </div>
              <ul className="list-disc pl-4 space-y-1 text-stone-600">
                {bestStrategy.supportingEvidence.map((ev, i) => (
                  <li key={i}>{ev}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* 5 Benefit Dimensions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
              <span className="font-bold text-emerald-900 block mb-0.5">
                {t('Dinh dưỡng & Đạm đất', 'Nutrients & Soil N')}
              </span>
              <span className="text-stone-700">{bestStrategy.benefits.nutrientCycling}</span>
            </div>
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
              <span className="font-bold text-blue-900 block mb-0.5">
                {t('Nhu cầu nước tưới', 'Water Demand')}
              </span>
              <span className="text-stone-700">{bestStrategy.benefits.waterDemand}</span>
            </div>
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
              <span className="font-bold text-amber-900 block mb-0.5">
                {t('Chống xói mòn & Chất hữu cơ', 'Erosion & Organic Carbon')}
              </span>
              <span className="text-stone-700">{bestStrategy.benefits.erosionAndOrganicMatter}</span>
            </div>
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
              <span className="font-bold text-purple-900 block mb-0.5">
                {t('Ngắt chu kỳ sâu bệnh', 'Pest Cycle Break')}
              </span>
              <span className="text-stone-700">{bestStrategy.benefits.pestCycleDisruption}</span>
            </div>
            <div className="sm:col-span-2 p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="font-bold text-stone-900 block mb-0.5">
                {t('Thức ăn chăn nuôi & Thu nhập phụ', 'Forage & Extra Income')}
              </span>
              <span className="text-stone-700">{bestStrategy.benefits.forageAndIncome}</span>
            </div>
          </div>

          {/* Information Gaps & Local Review Risks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-100 text-xs">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
              <div className="font-bold text-stone-800 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-stone-500" />{' '}
                {t('Khoảng trống thông tin', 'Information Gaps')}
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-stone-600">
                {bestStrategy.informationGaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200 space-y-1">
              <div className="font-bold text-rose-900 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />{' '}
                {t('Rủi ro cần địa phương rà soát', 'Local Risks to Check')}
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-900">
                {bestStrategy.localReviewRisks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Farmer rejection -> AI re-decide */}
          <div className="pt-3 border-t border-stone-200">
            {!rejectPanelOpen ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                <div className="text-xs text-amber-950">
                  <div className="font-bold text-sm flex items-center gap-1.5">
                    <MessageSquareWarning className="w-4 h-4 text-amber-700" />
                    {t(
                      'Phương án này không phù hợp với điều kiện ruộng hoặc đầu ra của gia đình?',
                      'Does this plan conflict with your field conditions or local market?'
                    )}
                  </div>
                  <p className="text-stone-600 mt-0.5">
                    {t(
                      'Hãy cho biết lý do (khó bán, đất hay úng, thiếu công làm...) để AI phân tích lại và chọn một chiến lược tốt hơn.',
                      'Share why (no local buyer, flooding, labor shortage...) so AI selects a better alternative.'
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectPanelOpen(true)}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold rounded-xl text-xs transition cursor-pointer shrink-0 shadow-xs"
                >
                  {t('Nêu lý do chưa phù hợp để AI chọn lại', 'Reject & Ask AI for Another Plan')}
                </button>
              </div>
            ) : (
              <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <MessageSquareWarning className="w-4 h-4 text-amber-700" />
                    {t(
                      `Vì sao phương án "${bestStrategy.nextCropName}" chưa phù hợp với bạn?`,
                      `Why is "${bestStrategy.nextCropName}" unsuitable for your farm?`
                    )}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectPanelOpen(false);
                      setRejectError(null);
                    }}
                    className="text-xs text-stone-500 hover:text-stone-800 cursor-pointer"
                  >
                    {t('Đóng', 'Close')}
                  </button>
                </div>

                {/* Quick reason chips */}
                <div className="flex flex-wrap gap-1.5">
                  {quickReasons.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => {
                        setRejectionInput(reason);
                        setRejectError(null);
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                        rejectionInput === reason
                          ? 'bg-amber-500 text-stone-950 border-amber-600 font-bold'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={rejectionInput}
                  onChange={(e) => {
                    setRejectionInput(e.target.value);
                    setRejectError(null);
                  }}
                  placeholder={t(
                    'Nhập cụ thể lý do của bạn (VD: Vùng tôi không có người mua đậu, hoặc ruộng trũng mùa mưa dễ ngập)...',
                    'Enter your specific reason (e.g., no local bean buyers, or field floods in rainy season)...'
                  )}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-emerald-700"
                />

                {rejectError && (
                  <div className="text-xs font-semibold text-rose-700">{rejectError}</div>
                )}

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRejectPanelOpen(false)}
                    className="px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-white rounded-xl cursor-pointer"
                  >
                    {t('Hủy', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitRejection}
                    disabled={rethinking}
                    className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {rethinking ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />{' '}
                        {t('AI đang tính phương án tốt hơn...', 'Finding better plan...')}
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />{' '}
                        {t('Gửi lý do để AI chọn phương án tốt hơn', 'Submit & Pick Better Plan')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Satellite vs Ground Observation & Plain-Language Glossary */}
      <section className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
        <button
          type="button"
          onClick={() => setGlossaryOpen(!glossaryOpen)}
          className="w-full flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-stone-900">
              {t(
                '5. Giải thích dễ hiểu các chỉ số khoa học & Sự khác biệt giữa Vệ tinh và Thực địa',
                '5. Plain-Language Satellite Indicators & Ground Truth Guide'
              )}
            </h2>
          </div>
          {glossaryOpen ? (
            <ChevronUp className="w-5 h-5 text-stone-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-stone-500" />
          )}
        </button>

        {glossaryOpen && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <Satellite className="w-4 h-4 text-emerald-700" />{' '}
                  {t(
                    'Vệ tinh quan sát được gì và khác gì đo trực tiếp tại ruộng?',
                    'What satellites measure vs. on-farm checks'
                  )}
                </div>
                <p className="text-emerald-900 leading-relaxed">
                  {t(
                    'Hệ thống theo dõi xu hướng nhiệt độ, mưa, ẩm đất, quang hợp tán lá và trữ lượng nước ngầm theo vùng; tuy nhiên không thể thấy độ phèn mặn đầu kênh hay sâu bệnh cục bộ dưới tán lá — nên kết hợp phản hồi của bạn giúp gợi ý chính xác hơn.',
                    'Regional monitoring tracks temperature, rainfall, soil moisture, photosynthesis, and aquifers, but cannot see micro-slope salinity or under-leaf pests — pairing with your field feedback maximizes accuracy.'
                  )}
                </p>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />{' '}
                  {t('Đồng bộ nhiều nguồn dữ liệu & Giới hạn mô hình', 'Multi-Source Data Fusion')}
                </div>
                <p className="text-stone-700 leading-relaxed">
                  {indicators.dataFusionSummary}{' '}
                  {t(
                    'Khi thiếu số liệu xét nghiệm đất/nước tại chỗ, hệ thống giữ giả định thận trọng và nêu rõ phần cần kiểm tra thực tế.',
                    'When lab soil/water tests are unavailable, conservative thresholds are applied and flagged for local verification.'
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {glossaryList.map((item) => (
                <div
                  key={item.term}
                  className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1.5"
                >
                  <div className="font-bold text-stone-900">{item.term}</div>
                  <div className="text-[11px] font-semibold text-emerald-800">
                    {t('Nói đơn giản:', 'In plain terms:')} {item.simpleName}
                  </div>
                  <p className="text-stone-600 leading-relaxed">{item.explanation}</p>
                  <p className="text-[11px] text-stone-500 italic border-t border-stone-200 pt-1.5">
                    {t('Ví dụ ngoài ruộng:', 'Field example:')} {item.fieldExample}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
