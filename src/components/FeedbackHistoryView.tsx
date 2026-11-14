import React, { useState } from 'react';
import {
  History,
  Sparkles,
  CheckCircle2,
  Send,
  Brain,
  AlertTriangle,
  Wrench,
  Droplets,
  Sprout,
  Activity,
  Bot,
  CalendarCheck,
  ShieldAlert,
} from 'lucide-react';
import {
  DailyAgronomicBrief,
  FeedbackRecord,
  FieldProfile,
  ObservedCropHealthState,
  ObservedMoistureState,
  PredictionOutcome,
  WeatherObservation,
} from '../types';
import { FieldCheckInDiagnostic, FieldCheckInInput } from '../services/agronomyEngine';
import { getCommonStageLabel, getPlantDisplayName } from '../data/cropTaxonomy';
import { useLanguage } from '../contexts/LanguageContext';

interface FeedbackHistoryViewProps {
  activeField: FieldProfile;
  feedbackHistory: FeedbackRecord[];
  weather?: WeatherObservation;
  brief?: DailyAgronomicBrief | null;
  onAddFeedback: (feedback: Omit<FeedbackRecord, 'id' | 'timestamp'>) => void;
  onSubmitCheckIn?: (
    input: FieldCheckInInput,
    addFixesToTasks: boolean
  ) => Promise<FieldCheckInDiagnostic | null>;
  onNavigateTab?: (tab: string) => void;
}

export const FeedbackHistoryView: React.FC<FeedbackHistoryViewProps> = ({
  activeField,
  feedbackHistory,
  weather,
  brief,
  onAddFeedback,
  onSubmitCheckIn,
  onNavigateTab,
}) => {
  const { lang, t } = useLanguage();

  const [predictionOutcome, setPredictionOutcome] = useState<PredictionOutcome>('on_track');
  const [observedMoisture, setObservedMoisture] = useState<ObservedMoistureState>('balanced');
  const [observedCropHealth, setObservedCropHealth] = useState<ObservedCropHealthState>('healthy');
  const [updatedStage, setUpdatedStage] = useState<string>('');
  const [customComment, setCustomComment] = useState('');
  const [addFixesToTasks, setAddFixesToTasks] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [latestDiagnostic, setLatestDiagnostic] = useState<FieldCheckInDiagnostic | null>(null);

  const stageSuggestions = [
    { vi: 'Cây con / Mạ non', en: 'Seedling / Nursery' },
    { vi: 'Đang sinh trưởng', en: 'Vegetative Growth' },
    { vi: 'Vươn lóng mạnh', en: 'Rapid Vegetative Elongation' },
    { vi: 'Làm đòng trổ bông', en: 'Panicle Initiation & Heading' },
    { vi: 'Ra hoa / Kết trái', en: 'Flowering / Fruiting' },
    { vi: 'Chín / Chuẩn bị thu hoạch', en: 'Ripening / Harvest Ready' },
  ];

  const fieldFeedbacks = feedbackHistory.filter((f) => f.fieldId === activeField.id);
  const checkInEntries = fieldFeedbacks.filter((f) => !!f.predictionOutcome);
  const onTrackCount = checkInEntries.filter((f) => f.predictionOutcome === 'on_track').length;
  const accuracyRate =
    checkInEntries.length > 0 ? Math.round((onTrackCount / checkInEntries.length) * 100) : null;

  const outcomeLabels: Record<PredictionOutcome, { label: string; desc: string; tone: string }> = {
    on_track: {
      label: t('Đúng dự báo — Đi đúng kế hoạch', 'Prediction working — On track'),
      desc: t(
        'Độ ẩm đất và cây trồng khớp với nhận định của CropCast hôm nay',
        'Soil moisture and crop growth match today’s CropCast forecast'
      ),
      tone: 'emerald',
    },
    needs_adjustment: {
      label: t('Gần đúng — Cần tinh chỉnh nhẹ', 'Mostly on track — Needs minor tweak'),
      desc: t(
        'Xu hướng chung đúng nhưng độ ẩm hoặc nhịp sinh trưởng hơi lệch',
        'Overall trend fits, but moisture or growth pace is slightly off'
      ),
      tone: 'amber',
    },
    off_track: {
      label: t('Chưa khớp — Có vấn đề phát sinh', 'Off track — Issue emerging'),
      desc: t(
        'Thực tế khác rõ rệt so với dự báo (khô/úng bất thường hoặc sâu bệnh)',
        'Field reality differs clearly from forecast (unexpected dry/wet or stress)'
      ),
      tone: 'rose',
    },
  };

  const moistureOptions: Array<{ value: ObservedMoistureState; label: string; hint: string }> = [
    {
      value: 'dry',
      label: t('Khô hơn dự báo', 'Drier than expected'),
      hint: t('Mặt đất khô nhanh, lá hơi héo trưa', 'Topsoil dried out fast'),
    },
    {
      value: 'balanced',
      label: t('Ẩm vừa phải', 'Balanced moisture'),
      hint: t('Đất tơi ẩm, không đọng nước', 'Moist and well-aerated'),
    },
    {
      value: 'wet',
      label: t('Quá ướt / ứ đọng', 'Too wet / waterlogged'),
      hint: t('Nước rút chậm, có chỗ đọng vũng', 'Slow drainage or pooling'),
    },
  ];

  const cropHealthOptions: Array<{ value: ObservedCropHealthState; label: string; hint: string }> = [
    {
      value: 'healthy',
      label: t('Cây khỏe, đều', 'Healthy & uniform'),
      hint: t('Xanh lá, ra đọt/rễ bình thường', 'Strong canopy and steady growth'),
    },
    {
      value: 'stressed',
      label: t('Vàng lá / héo / sốc', 'Yellowing / stressed'),
      hint: t('Có dấu hiệu thiếu nước, úng hoặc thiếu dinh dưỡng', 'Stress signs observed'),
    },
    {
      value: 'pest_risk',
      label: t('Có sâu / nấm bệnh', 'Pests / fungal signs'),
      hint: t('Đốm lá, sâu ăn lá hoặc nấm gốc', 'Spots, insects, or lesions noticed'),
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeField.isSharedWithMe) return;

    setSubmitting(true);
    setSubmitError(null);
    setSuccessNotice(null);

    const input: FieldCheckInInput = {
      predictionOutcome,
      observedMoisture,
      observedCropHealth,
      updatedStage: updatedStage.trim() || undefined,
      note: customComment.trim() || undefined,
    };

    try {
      if (onSubmitCheckIn) {
        const diagnostic = await onSubmitCheckIn(input, addFixesToTasks);
        if (diagnostic) {
          setLatestDiagnostic(diagnostic);
        }
      } else {
        const legacyType =
          observedMoisture === 'dry'
            ? 'soil_still_dry'
            : observedMoisture === 'wet'
            ? 'soil_too_wet'
            : observedCropHealth !== 'healthy'
            ? 'crop_abnormal'
            : predictionOutcome === 'on_track'
            ? 'helpful'
            : 'not_suitable';

        onAddFeedback({
          fieldId: activeField.id,
          feedbackType: legacyType,
          userComment: customComment.trim() || undefined,
          predictionOutcome,
          observedMoisture,
          observedCropHealth,
          systemActionTaken: outcomeLabels[predictionOutcome].label,
          appliedToProfile: true,
        });
      }

      setCustomComment('');
      setUpdatedStage('');
      setSuccessNotice(
        t(
          'Đã lưu cập nhật thực địa! Hệ thống đã đối chiếu dự báo và tạo hướng dẫn khắc phục cho ruộng.',
          'Field update saved! Forecast check and corrective steps have been updated.'
        )
      );
    } catch (err: any) {
      setSubmitError(
        err?.message ||
          t(
            'Không thể lưu cập nhật ruộng. Vui lòng kiểm tra quyền Firestore hoặc thử lại.',
            'Failed to save field update. Please check Firestore permissions and try again.'
          )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const savedPlanFixes = activeField.adaptiveMemory?.planFixRecommendations || [];
  const savedLastOutcome = activeField.adaptiveMemory?.lastPredictionOutcome;
  const savedCheckInSummary = activeField.adaptiveMemory?.lastCheckInSummary;

  const activeFixesToDisplay = latestDiagnostic
    ? latestDiagnostic.fixes
    : savedPlanFixes;
  const activeDiagnosticSummary = latestDiagnostic
    ? latestDiagnostic.rootCauseExplanation
    : savedCheckInSummary;
  const activeVerdictTitle = latestDiagnostic
    ? latestDiagnostic.verdictTitle
    : savedLastOutcome === 'on_track'
    ? t('Dự báo đang khớp thực tế — Ruộng đi đúng kế hoạch', 'Prediction matches reality — On track')
    : savedLastOutcome === 'off_track'
    ? t('Cần điều chỉnh ngay theo lần kiểm tra gần nhất', 'Action needed based on latest field check')
    : savedLastOutcome === 'needs_adjustment'
    ? t('Đã tinh chỉnh nhẹ để giữ đúng kế hoạch', 'Minor adjustments recommended to stay on plan')
    : null;

  const isOnTrackDisplay = latestDiagnostic
    ? latestDiagnostic.isPredictionAccurate
    : savedLastOutcome === 'on_track';

  const getFeedbackBadgeLabel = (item: FeedbackRecord) => {
    if (item.predictionOutcome === 'on_track') {
      return t('Đúng dự báo · Đúng kế hoạch', 'On track');
    }
    if (item.predictionOutcome === 'needs_adjustment') {
      return t('Cần tinh chỉnh nhẹ', 'Needs adjustment');
    }
    if (item.predictionOutcome === 'off_track') {
      return t('Lệch dự báo · Cần khắc phục', 'Off track');
    }
    const legacyMap: Record<string, string> = {
      soil_still_dry: t('Đất thực tế vẫn khô', 'Soil is still dry'),
      soil_too_wet: t('Đất quá ẩm / ứ đọng', 'Soil too wet'),
      crop_healthy: t('Cây phát triển bình thường', 'Crop healthy'),
      crop_abnormal: t('Cây có dấu hiệu lạ', 'Crop stress'),
      helpful: t('Khuyến nghị hữu ích', 'Helpful'),
      not_suitable: t('Chưa sát thực tế', 'Not accurate'),
      followed: t('Đã làm theo kế hoạch', 'Followed plan'),
      not_followed: t('Chưa thực hiện theo', 'Could not follow'),
    };
    return legacyMap[item.feedbackType] || item.feedbackType;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner + Prediction Calibration Metrics */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-emerald-600" />
            {t('Kiểm chứng dự báo & Hiệu chỉnh thực địa', 'Field Updates & Prediction Check')}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
            {t(
              `Cập nhật Ruộng "${activeField.name}"`,
              `Field Check-in: "${activeField.name}"`
            )}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500">
            {t(
              'Ghi nhận tình trạng thực tế để kiểm tra dự báo CropCast có đang đi đúng hướng không và nhận danh sách việc cần sửa ngay nếu có sai lệch.',
              'Log ground observations to verify whether CropCast predictions are working as planned and get immediate fixes whenever conditions diverge.'
            )}
          </p>
        </div>

        {/* Prediction Match Scorecard & Learned Memory */}
        <div className="grid grid-cols-2 sm:flex items-stretch gap-3 shrink-0">
          <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-center min-w-[125px]">
            <div className="text-[11px] font-semibold text-stone-500">
              {t('Độ khớp dự báo', 'Prediction Match')}
            </div>
            <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-0.5">
              {accuracyRate !== null ? `${accuracyRate}%` : '—'}
            </div>
            <div className="text-[10px] text-stone-400">
              {checkInEntries.length > 0
                ? t(`${onTrackCount}/${checkInEntries.length} lần khớp`, `${onTrackCount}/${checkInEntries.length} on track`)
                : t('Chưa có check-in', 'No check-ins yet')}
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-900 max-w-xs space-y-1">
            <div className="font-bold flex items-center gap-1 text-purple-800">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />{' '}
              {t('Hiệu chỉnh hiện tại:', 'Active Calibration:')}
            </div>
            <p className="text-[11px] leading-snug">
              {activeField.adaptiveMemory?.soilAdjustment ||
                t(
                  'Đang dùng thông số nền NASA & loại đất mặc định. Hãy gửi cập nhật sau khi thăm ruộng!',
                  'Using baseline NASA & soil parameters. Submit an update after inspecting your field.'
                )}
            </p>
          </div>
        </div>
      </div>

      {/* Active Diagnostic & "What to Fix to Go as Planned" Card */}
      {(activeVerdictTitle || activeFixesToDisplay.length > 0) && (
        <div
          className={`rounded-2xl p-5 sm:p-6 border space-y-4 ${
            isOnTrackDisplay
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/90 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {isOnTrackDisplay ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                  {t('Kết quả đối chiếu thực địa & Kế hoạch', 'Prediction vs. Field Reality Diagnostic')}
                </div>
                <h2 className="text-base sm:text-lg font-bold">{activeVerdictTitle}</h2>
              </div>
            </div>

            {onNavigateTab && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab('tasks')}
                  className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CalendarCheck className="w-3.5 h-3.5 text-emerald-700" />
                  {t('Xem Việc cần làm', 'Open Tasks')}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('assistant')}
                  className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5" />
                  {t('Hỏi AI chi tiết hơn', 'Ask AI for Detail')}
                </button>
              </div>
            )}
          </div>

          {activeDiagnosticSummary && (
            <p className="text-xs sm:text-sm leading-relaxed bg-white/75 rounded-xl p-3.5 border border-black/5">
              {activeDiagnosticSummary}
            </p>
          )}

          {activeFixesToDisplay.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold flex items-center gap-1.5">
                <Wrench className="w-4 h-4" />
                {isOnTrackDisplay
                  ? t('Gợi ý duy trì đúng kế hoạch:', 'Keep on plan:')
                  : t('Những việc cần sửa ngay để ruộng đi đúng kế hoạch:', 'What to fix to get back on plan:')}
              </div>
              <ol className="space-y-2">
                {activeFixesToDisplay.map((fix, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 bg-white/90 rounded-xl p-3 border border-black/5 text-xs leading-relaxed"
                  >
                    <span className="w-5 h-5 rounded-full bg-stone-900 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{fix}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {activeField.isSharedWithMe && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center gap-2 font-medium">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          {t(
            'Thửa ruộng này đang được chia sẻ ở chế độ Chỉ xem — chỉ chủ ruộng mới có thể lưu cập nhật hiệu chỉnh.',
            'This field is shared with you in read-only mode — only the field owner can save updates.'
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Log New Field Update & Check Prediction */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-5">
          <div className="border-b border-stone-100 pb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-700" />
                {t('Gửi Cập nhật Thực tế & Kiểm tra Dự báo', 'Log Field Update & Check Plan')}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {getPlantDisplayName(activeField.crop.name, lang)} ·{' '}
                {getCommonStageLabel(activeField.crop.currentStage, lang)}
                {weather ? ` · ${weather.temp}°C · ${(weather.gwetroot * 100).toFixed(0)}% root` : ''}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Step 1: Is prediction working? */}
            <div className="space-y-2">
              <label className="font-bold text-stone-800 block">
                {t(
                  '1. Dự báo & kế hoạch hôm nay có đang khớp thực tế không?',
                  '1. Is CropCast’s prediction/plan working as expected?'
                )}
              </label>
              <div className="space-y-1.5">
                {(['on_track', 'needs_adjustment', 'off_track'] as PredictionOutcome[]).map(
                  (outcome) => {
                    const meta = outcomeLabels[outcome];
                    const selected = predictionOutcome === outcome;
                    return (
                      <label
                        key={outcome}
                        className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                          selected
                            ? outcome === 'on_track'
                              ? 'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-600/30'
                              : outcome === 'needs_adjustment'
                              ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500/30'
                              : 'bg-rose-50 border-rose-500 ring-1 ring-rose-500/30'
                            : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <input
                          type="radio"
                          name="predictionOutcome"
                          checked={selected}
                          onChange={() => setPredictionOutcome(outcome)}
                          disabled={!!activeField.isSharedWithMe}
                          className="mt-0.5 accent-emerald-700"
                        />
                        <div>
                          <div className="font-bold text-stone-900">{meta.label}</div>
                          <div className="text-[11px] text-stone-500">{meta.desc}</div>
                        </div>
                      </label>
                    );
                  }
                )}
              </div>
            </div>

            {/* Step 2: Observed Moisture */}
            <div className="space-y-2">
              <label className="font-bold text-stone-800 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-sky-600" />
                {t('2. Độ ẩm đất thực tế khi thăm ruộng:', '2. Actual soil moisture observed:')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {moistureOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!!activeField.isSharedWithMe}
                    onClick={() => setObservedMoisture(opt.value)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      observedMoisture === opt.value
                        ? 'bg-sky-50 border-sky-600 ring-1 ring-sky-600/30'
                        : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <div className="font-bold text-stone-900">{opt.label}</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">{opt.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Observed Crop Health */}
            <div className="space-y-2">
              <label className="font-bold text-stone-800 flex items-center gap-1.5">
                <Sprout className="w-3.5 h-3.5 text-emerald-700" />
                {t('3. Tình trạng cây trồng hiện tại:', '3. Observed crop health:')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {cropHealthOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!!activeField.isSharedWithMe}
                    onClick={() => setObservedCropHealth(opt.value)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      observedCropHealth === opt.value
                        ? 'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-600/30'
                        : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <div className="font-bold text-stone-900">{opt.label}</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">{opt.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional stage update */}
            <div>
              <label className="font-bold text-stone-800 block mb-1">
                {t(
                  '4. Cập nhật giai đoạn cây trồng nếu đã chuyển giai đoạn (tùy chọn):',
                  '4. Update current growth stage if changed (optional):'
                )}
              </label>
              <select
                value={updatedStage}
                disabled={!!activeField.isSharedWithMe}
                onChange={(e) => setUpdatedStage(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900 focus:outline-emerald-600 text-xs"
              >
                <option value="">
                  {t(
                    `Giữ nguyên (${getCommonStageLabel(activeField.crop.currentStage, lang)})`,
                    `Keep current (${getCommonStageLabel(activeField.crop.currentStage, lang)})`
                  )}
                </option>
                {stageSuggestions.map((st) => {
                  const val = lang === 'en' ? st.en : st.vi;
                  return (
                    <option key={st.vi} value={val}>
                      {val}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Free-text observation */}
            <div>
              <label className="font-bold text-stone-800 block mb-1">
                {t('5. Mô tả chi tiết những gì bạn thấy trên ruộng:', '5. What did you notice on the field? (optional)')}
              </label>
              <textarea
                rows={3}
                disabled={!!activeField.isSharedWithMe}
                placeholder={t(
                  'VD: Hôm nay đất mặt khô nứt nhẹ dù dự báo ẩm, một vài lá dưới hơi vàng mép...',
                  'E.g., Topsoil feels dry despite rain forecast, lower leaves showing mild yellowing...'
                )}
                value={customComment}
                onChange={(e) => setCustomComment(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 text-xs"
              />
            </div>

            {onSubmitCheckIn &&
              (predictionOutcome !== 'on_track' ||
                observedMoisture !== 'balanced' ||
                observedCropHealth !== 'healthy') && (
                <label className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addFixesToTasks}
                    onChange={(e) => setAddFixesToTasks(e.target.checked)}
                    className="accent-emerald-700"
                  />
                  <span className="text-[11px] font-semibold text-amber-950">
                    {t(
                      'Tự động thêm các bước khắc phục vào danh sách Việc cần làm (Tasks)',
                      'Automatically add corrective fixes to my Today’s Tasks list'
                    )}
                  </span>
                </label>
              )}

            {brief && (
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-stone-600">
                <strong>{t('Dự báo đang đối chiếu:', 'Forecast being checked:')}</strong>{' '}
                {brief.headline}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !!activeField.isSharedWithMe}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              {submitting
                ? t('Đang phân tích & lưu cập nhật...', 'Analyzing & saving check-in...')
                : t('Lưu cập nhật & Kiểm tra cách khắc phục', 'Save Update & Check Fixes')}
            </button>

            {submitError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-medium">
                {submitError}
              </div>
            )}

            {successNotice && (
              <div className="p-3 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}
          </form>
        </div>

        {/* Right: Field Update & Plan-Fix History */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-700" />
              {t(
                `Nhật ký Cập nhật & Hiệu chỉnh (${fieldFeedbacks.length})`,
                `Field Update & Calibration Log (${fieldFeedbacks.length})`
              )}
            </h2>
            <p className="text-xs text-stone-500">
              {t(
                'Theo dõi lịch sử đối chiếu dự báo thực tế và các bước đã đề xuất để giữ đúng kế hoạch',
                'Timeline of field reality checks, prediction matches, and recommended corrective actions'
              )}
            </p>
          </div>

          {fieldFeedbacks.length === 0 ? (
            <div className="p-10 text-center text-stone-400 space-y-2">
              <History className="w-8 h-8 mx-auto opacity-50" />
              <div className="text-xs font-semibold text-stone-700">
                {t('Chưa có cập nhật nào cho thửa ruộng này', 'No field updates logged yet')}
              </div>
              <p className="text-[11px] text-stone-400">
                {t(
                  'Hãy gửi báo cáo thăm ruộng đầu tiên ở cột bên trái để kiểm tra độ chính xác dự báo.',
                  'Submit your first field inspection on the left to verify forecast accuracy.'
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
              {fieldFeedbacks.map((item) => {
                const outcome = item.predictionOutcome;
                const badgeClass =
                  outcome === 'on_track'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : outcome === 'off_track'
                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                    : outcome === 'needs_adjustment'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-stone-100 text-stone-700 border-stone-200';

                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-stone-50/80 rounded-xl border border-stone-200 text-xs space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 ${badgeClass}`}
                      >
                        {outcome === 'off_track' ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {getFeedbackBadgeLabel(item)}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {new Date(item.timestamp).toLocaleDateString(
                          lang === 'en' ? 'en-US' : 'vi-VN'
                        )}{' '}
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {(item.observedMoisture || item.observedCropHealth) && (
                      <div className="flex flex-wrap gap-1.5 text-[10px] text-stone-600">
                        {item.observedMoisture && (
                          <span className="px-2 py-0.5 bg-white border border-stone-200 rounded-md">
                            {t('Đất:', 'Soil:')} {item.observedMoisture}
                          </span>
                        )}
                        {item.observedCropHealth && (
                          <span className="px-2 py-0.5 bg-white border border-stone-200 rounded-md">
                            {t('Cây:', 'Crop:')} {item.observedCropHealth}
                          </span>
                        )}
                      </div>
                    )}

                    {item.userComment && (
                      <p className="text-stone-700 italic bg-white p-2 rounded-lg border border-stone-100 text-[11px]">
                        "{item.userComment}"
                      </p>
                    )}

                    {item.systemActionTaken && (
                      <div className="p-2 bg-purple-50/80 rounded-lg border border-purple-200 text-purple-900 text-[11px] flex items-start gap-1.5 font-medium">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                        <span>{item.systemActionTaken}</span>
                      </div>
                    )}

                    {item.recommendedFixes && item.recommendedFixes.length > 0 && (
                      <div className="p-2.5 bg-white rounded-lg border border-stone-200 space-y-1">
                        <div className="text-[10px] font-bold text-stone-700 flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-amber-600" />
                          {t('Hướng dẫn khắc phục đã đề xuất:', 'Suggested Fixes:')}
                        </div>
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-stone-600">
                          {item.recommendedFixes.map((fx, i) => (
                            <li key={i}>{fx}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
