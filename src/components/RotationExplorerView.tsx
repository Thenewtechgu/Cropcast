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
} from 'lucide-react';
import {
  FarmerConstraints,
  FarmerPriorityId,
  FieldProfile,
  RotationStrategy,
  WeatherObservation,
} from '../types';
import {
  FARMER_PRIORITIES,
  SCIENTIFIC_GLOSSARY,
  analyzeBareFieldAndStressTimeline,
  computeHarmonizedIndicators,
  pickBestRotationStrategy,
} from '../services/rotationEngine';
import { GeminiService } from '../services/geminiService';
import { getSoilLabel, getDrainageLabel } from '../services/agronomyEngine';
import { getSeedFamilyById, inferSeedFamilyFromCrop } from '../data/cropTaxonomy';

interface RotationExplorerViewProps {
  field: FieldProfile;
  weather: WeatherObservation;
  onOpenMap: () => void;
}

const REJECTION_QUICK_REASONS = [
  'Không có đầu ra / khó bán ở địa phương',
  'Đất ruộng hay úng nước, không hợp cây này',
  'Thiếu vốn hoặc không đủ nhân công chăm sóc',
  'Cần cây làm thức ăn cho trâu bò / gia súc',
  'Hợp tác xã địa phương chưa có giống này',
];

export const RotationExplorerView: React.FC<RotationExplorerViewProps> = ({
  field,
  weather,
  onOpenMap,
}) => {
  const [priorities, setPriorities] = useState<FarmerPriorityId[]>([
    'water_saving',
    'nitrogen_fixing',
    'pest_break',
    'erosion_control',
  ]);
  const [constraints, setConstraints] = useState<FarmerConstraints>({
    waterAvailability: field.waterSource.isStable ? 'seasonal_limited' : 'scarce',
    equipmentAccess: 'basic_manual',
    marketPreference: 'mixed_family',
  });
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  // Single Best Strategy & AI Rethink State
  const [customBestStrategy, setCustomBestStrategy] = useState<RotationStrategy | null>(null);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [rejectedTitles, setRejectedTitles] = useState<string[]>([]);
  const [lastRejectionNote, setLastRejectionNote] = useState<string | null>(null);
  const [aiSourceLabel, setAiSourceLabel] = useState<string | null>(null);

  // Rejection Reason UI
  const [rejectPanelOpen, setRejectPanelOpen] = useState(false);
  const [rejectionInput, setRejectionInput] = useState('');
  const [rethinking, setRethinking] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Reset AI override when user switches fields, priorities, or constraints
  useEffect(() => {
    setCustomBestStrategy(null);
    setRejectedIds([]);
    setRejectedTitles([]);
    setLastRejectionNote(null);
    setAiSourceLabel(null);
    setRejectPanelOpen(false);
    setRejectionInput('');
  }, [field.id, priorities, constraints]);

  const togglePriority = (id: FarmerPriorityId) => {
    setPriorities((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const currentFamily = getSeedFamilyById(
    field.crop.seedFamily || inferSeedFamilyFromCrop(field.crop.name, field.crop.category)
  );
  const fixedScenario = { rainDeltaPct: 0, tempDeltaC: 0 };
  const indicators = computeHarmonizedIndicators(field, weather, fixedScenario);
  const timeline = analyzeBareFieldAndStressTimeline(field, fixedScenario);

  const bestStrategy =
    customBestStrategy ||
    pickBestRotationStrategy(field, weather, priorities, constraints, rejectedIds);

  const bareMonthsCount = timeline.filter((m) => m.fieldState === 'bare_fallow').length;
  const highStressMonthsCount = timeline.filter((m) => m.stressLevel === 'high').length;

  const handleSubmitRejection = async () => {
    const cleanReason = rejectionInput.trim();
    if (!cleanReason) {
      setRejectError('Vui lòng chọn hoặc nhập lý do vì sao phương án này chưa phù hợp với ruộng của bạn.');
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
      });

      setRejectedIds(nextExcluded);
      setRejectedTitles(nextTitles);
      setCustomBestStrategy(strategy);
      setLastRejectionNote(cleanReason);
      setAiSourceLabel(
        source === 'gemini'
          ? 'Gemini AI đã chọn lại theo phản hồi thực tế của bạn'
          : 'Hệ thống đã chuyển sang phương án thay thế phù hợp hơn'
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
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Hỗ trợ quyết định Luân canh &amp; Đất khỏe
            </span>
            <span className="text-stone-500">
              Ruộng: <strong className="text-stone-800">{field.name}</strong> ({field.province})
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
            Phân tích Đất trống, Khí hậu &amp; Chiến lược Luân canh Tối ưu
          </h1>
          <p className="text-xs sm:text-sm text-stone-600">
            Cây hiện tại: <strong>{field.crop.name}</strong> ({currentFamily.name}) • Đất:{' '}
            <strong>{getSoilLabel(field.soilType)}</strong> ({getDrainageLabel(field.soilCharacteristics.drainage)})
          </p>
        </div>

        <button
          onClick={onOpenMap}
          className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 self-start md:self-auto"
        >
          <Satellite className="w-4 h-4" /> Xem ảnh vệ tinh thửa ruộng
        </button>
      </div>

      {/* Farmer Priorities & Automated NASA Forecast Indicators (NO Sliders) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Farmer Priorities & Practical Constraints */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Sprout className="w-4 h-4 text-emerald-700" />
              1. Nhu cầu ưu tiên &amp; Điều kiện thực tế của gia đình
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Chọn những mục tiêu bạn quan tâm nhất để hệ thống chấm điểm và tìm ra chiến lược luân canh tối ưu nhất.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FARMER_PRIORITIES.map((p) => {
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
              <label className="font-bold text-stone-700 block mb-1">Nguồn nước tưới</label>
              <select
                value={constraints.waterAvailability}
                onChange={(e) =>
                  setConstraints((prev) => ({ ...prev, waterAvailability: e.target.value as any }))
                }
                className="w-full px-2.5 py-2 border border-stone-300 rounded-xl bg-white text-stone-900"
              >
                <option value="abundant">Chủ động quanh năm</option>
                <option value="seasonal_limited">Hạn chế vào mùa khô</option>
                <option value="scarce">Thiếu nước / Chỉ nhờ mưa</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-stone-700 block mb-1">Máy móc &amp; Công lao động</label>
              <select
                value={constraints.equipmentAccess}
                onChange={(e) =>
                  setConstraints((prev) => ({ ...prev, equipmentAccess: e.target.value as any }))
                }
                className="w-full px-2.5 py-2 border border-stone-300 rounded-xl bg-white text-stone-900"
              >
                <option value="basic_manual">Làm thủ công hộ gia đình</option>
                <option value="mechanized">Có máy cày, cơ giới hóa</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-stone-700 block mb-1">Đầu ra mong muốn</label>
              <select
                value={constraints.marketPreference}
                onChange={(e) =>
                  setConstraints((prev) => ({ ...prev, marketPreference: e.target.value as any }))
                }
                className="w-full px-2.5 py-2 border border-stone-300 rounded-xl bg-white text-stone-900"
              >
                <option value="mixed_family">Kết hợp bán &amp; tự dùng</option>
                <option value="cash_crop">Ưu tiên nông sản bán chợ</option>
                <option value="forage_livestock">Ưu tiên thức ăn chăn nuôi</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right: App-Computed NASA Climate & Soil Indicators (Read-only, No Sliders) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Satellite className="w-4 h-4 text-emerald-700" />
              2. Điều kiện Khí hậu &amp; Độ ẩm Mùa tới (Tự động từ NASA)
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Số liệu được hệ thống tự động tính toán từ dữ liệu quan trắc NASA 21 năm tại lưới{' '}
              <strong>{field.nasaGrid.cellId}</strong> và đặc điểm đất của thửa ruộng.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200">
              <span className="text-[11px] text-stone-500 block">Độ ẩm tầng rễ ước tính</span>
              <span className="text-xl font-black text-emerald-900 tabular-nums">
                {indicators.rootMoisturePct}%
              </span>
              <span className="text-[10px] text-stone-500 block">
                Tầng mặt: {indicators.surfaceMoisturePct}%
              </span>
            </div>
            <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200">
              <span className="text-[11px] text-stone-500 block">Bốc thoát hơi nước</span>
              <span className="text-xl font-black text-amber-900 tabular-nums">
                {indicators.evapotranspirationMmDay} mm/ngày
              </span>
              <span className="text-[10px] text-stone-500 block">
                Áp lực nắng nóng: {indicators.heatStressIndex}
              </span>
            </div>
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[11px] text-stone-500 block">Nguy cơ xói mòn mặt đất</span>
              <span className="font-bold text-stone-900 text-sm">{indicators.erosionRisk}</span>
            </div>
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[11px] text-stone-500 block">Tháng dễ thiếu ẩm</span>
              <span className="font-bold text-stone-900 text-sm">
                {indicators.droughtRiskMonths.length
                  ? `Tháng ${indicators.droughtRiskMonths.join(', ')}`
                  : 'Ít biến động'}
              </span>
            </div>
          </div>

          <div className="text-xs text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
            <div>
              <strong>Xu thế nước vùng:</strong> {indicators.longTermWaterTrend}
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
              3. Thời điểm đất trống &amp; Tháng cây trồng dễ bị tổn thương trong năm
            </h2>
            <p className="text-xs text-stone-500">
              Phát hiện <strong>{bareMonthsCount} tháng đất thường để trống</strong> và{' '}
              <strong>{highStressMonthsCount} tháng áp lực hạn/mưa lớn cao</strong> để chèn cây họ Đậu hoặc cây che phủ.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Đang có cây chính
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Chuyển vụ
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-rose-400 inline-block" /> Đất trống (dễ xói mòn/bốc hơi)
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
                ? 'Có cây trên ruộng'
                : m.fieldState === 'harvest_transition'
                ? 'Giai đoạn chuyển vụ'
                : 'Đất bỏ trống';

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
                      ? 'Rủi ro cao'
                      : m.stressLevel === 'moderate'
                      ? 'Cần chú ý'
                      : 'Ổn định'}
                  </span>
                </div>

                <div className="text-[11px] font-semibold text-stone-700">{stateLabel}</div>

                <div className="text-[11px] text-stone-600 leading-snug">{m.dominantRisk}</div>

                <div className="pt-1 border-t border-stone-200/70 flex items-center justify-between text-[10px] text-stone-500">
                  <span>Ẩm rễ: {m.soilMoisturePct}%</span>
                  <span>Bốc hơi: {m.evaporationRisk}</span>
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
              4. Chiến lược Luân canh Tối ưu nhất được Đề xuất
            </h2>
            <p className="text-xs text-stone-500">
              Hệ thống chọn ra <strong>1 chiến lược tốt nhất</strong> dựa trên đất, nguồn nước, thời tiết và mục tiêu của bạn. Nếu thấy chưa phù hợp thực tế, bạn có thể phản hồi ngay bên dưới để AI chọn phương án khác.
            </p>
          </div>
          {customBestStrategy && (
            <button
              type="button"
              onClick={handleResetToInitialBest}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-emerald-800 bg-white border border-stone-200 px-3 py-1.5 rounded-xl cursor-pointer shrink-0 self-start"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Quay lại gợi ý ban đầu
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
                  <strong>{aiSourceLabel}:</strong> Đã thay đổi vì lý do <em>"{lastRejectionNote}"</em>
                </span>
              </div>
            </div>
          )}

          {/* Title & Score */}
          <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
            <div className="space-y-1">
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {customBestStrategy ? 'Phương án AI chọn lại tốt hơn' : 'Chiến lược tối ưu nhất'}
              </span>
              <h3 className="text-lg font-bold text-stone-900">{bestStrategy.title}</h3>
              <div className="text-xs font-semibold text-emerald-800">
                Chuỗi vụ đề xuất: {bestStrategy.sequenceSummary}
              </div>
            </div>

            <div className="text-center bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 shrink-0">
              <div className="text-[10px] text-emerald-800 font-semibold">Độ phù hợp</div>
              <div className="text-2xl font-black text-emerald-700 tabular-nums">
                {bestStrategy.suitabilityScore}%
              </div>
            </div>
          </div>

          {/* Why suggested & Supporting Evidence */}
          <div className="space-y-3 text-xs sm:text-sm">
            <div>
              <span className="font-bold text-stone-900">Vì sao đề xuất phương án này: </span>
              <span className="text-stone-700 leading-relaxed">{bestStrategy.whySuggested}</span>
            </div>
            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-1.5 text-xs">
              <div className="font-bold text-stone-800 text-[11px] uppercase tracking-wider">
                Bằng chứng từ khí hậu &amp; hồ sơ ruộng:
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
              <span className="font-bold text-emerald-900 block mb-0.5">Dinh dưỡng &amp; Đạm đất</span>
              <span className="text-stone-700">{bestStrategy.benefits.nutrientCycling}</span>
            </div>
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
              <span className="font-bold text-blue-900 block mb-0.5">Nhu cầu nước tưới</span>
              <span className="text-stone-700">{bestStrategy.benefits.waterDemand}</span>
            </div>
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
              <span className="font-bold text-amber-900 block mb-0.5">Chống xói mòn &amp; Chất hữu cơ</span>
              <span className="text-stone-700">{bestStrategy.benefits.erosionAndOrganicMatter}</span>
            </div>
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
              <span className="font-bold text-purple-900 block mb-0.5">Ngắt chu kỳ sâu bệnh</span>
              <span className="text-stone-700">{bestStrategy.benefits.pestCycleDisruption}</span>
            </div>
            <div className="sm:col-span-2 p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="font-bold text-stone-900 block mb-0.5">Thức ăn chăn nuôi &amp; Thu nhập phụ</span>
              <span className="text-stone-700">{bestStrategy.benefits.forageAndIncome}</span>
            </div>
          </div>

          {/* Information Gaps & Local Review Risks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-100 text-xs">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
              <div className="font-bold text-stone-800 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-stone-500" /> Khoảng trống thông tin
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-stone-600">
                {bestStrategy.informationGaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200 space-y-1">
              <div className="font-bold text-rose-900 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Rủi ro cần địa phương rà soát
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-900">
                {bestStrategy.localReviewRisks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Button BELOW the strategy so farmers can say why it doesn't work and AI decides a better one */}
          <div className="pt-3 border-t border-stone-200">
            {!rejectPanelOpen ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                <div className="text-xs text-amber-950">
                  <div className="font-bold text-sm flex items-center gap-1.5">
                    <MessageSquareWarning className="w-4 h-4 text-amber-700" />
                    Phương án này không phù hợp với điều kiện ruộng hoặc đầu ra của gia đình?
                  </div>
                  <p className="text-stone-600 mt-0.5">
                    Hãy cho biết lý do (khó bán, đất hay úng, thiếu công làm...) để AI phân tích lại và chọn một chiến lược tốt hơn.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectPanelOpen(true)}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold rounded-xl text-xs transition cursor-pointer shrink-0 shadow-xs"
                >
                  Nêu lý do chưa phù hợp để AI chọn lại
                </button>
              </div>
            ) : (
              <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <MessageSquareWarning className="w-4 h-4 text-amber-700" />
                    Vì sao phương án "{bestStrategy.nextCropName}" chưa phù hợp với bạn?
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectPanelOpen(false);
                      setRejectError(null);
                    }}
                    className="text-xs text-stone-500 hover:text-stone-800 cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>

                {/* Quick reason chips */}
                <div className="flex flex-wrap gap-1.5">
                  {REJECTION_QUICK_REASONS.map((reason) => (
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
                  placeholder="Nhập cụ thể lý do của bạn (VD: Vùng tôi không có người mua đậu, hoặc ruộng trũng mùa mưa dễ ngập)..."
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-emerald-700"
                />

                {rejectError && (
                  <div className="text-xs font-semibold text-rose-700">{rejectError}</div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRejectPanelOpen(false)}
                    className="px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-white rounded-xl cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitRejection}
                    disabled={rethinking}
                    className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {rethinking ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI đang tính phương án tốt hơn...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Gửi lý do để AI chọn phương án tốt hơn
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
              5. Giải thích dễ hiểu các chỉ số khoa học &amp; Sự khác biệt giữa Vệ tinh và Thực địa
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
                  <Satellite className="w-4 h-4 text-emerald-700" /> Vệ tinh quan sát được gì và khác gì đo trực tiếp tại ruộng?
                </div>
                <p className="text-emerald-900 leading-relaxed">
                  Vệ tinh đo xu hướng nhiệt độ, lượng mưa và độ ẩm trên ô lưới rộng, rất hữu ích để nhìn bức tranh nhiều năm và phát hiện mùa khô/mùa mưa dịch chuyển. Tuy nhiên, vệ tinh <strong>không thể đo chính xác</strong> độ dốc cục bộ của từng bờ thửa, độ phèn mặn ở đầu kênh hay tình trạng sâu bệnh dưới tán lá — vì vậy kết hợp phản hồi trực tiếp của bà con giúp gợi ý chính xác hơn nhiều.
                </p>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" /> Đồng bộ nhiều nguồn dữ liệu &amp; Giới hạn mô hình
                </div>
                <p className="text-stone-700 leading-relaxed">
                  {indicators.dataFusionSummary} Khi thiếu số liệu xét nghiệm đất/nước tại chỗ, hệ thống giữ nguyên các giả định thận trọng và nêu rõ phần cần bà con cùng kỹ sư khuyến nông địa phương kiểm tra trước khi xuống giống đại trà.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SCIENTIFIC_GLOSSARY.map((item) => (
                <div
                  key={item.term}
                  className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1.5"
                >
                  <div className="font-bold text-stone-900">{item.term}</div>
                  <div className="text-[11px] font-semibold text-emerald-800">
                    Nói đơn giản: {item.simpleName}
                  </div>
                  <p className="text-stone-600 leading-relaxed">{item.explanation}</p>
                  <p className="text-[11px] text-stone-500 italic border-t border-stone-200 pt-1.5">
                    Ví dụ ngoài ruộng: {item.fieldExample}
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
