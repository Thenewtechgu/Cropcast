import React, { useEffect, useState } from 'react';
import { CalendarDays, Sparkles } from 'lucide-react';
import { FieldProfile, PlantingRiskEvaluation } from '../types';
import { evaluatePlantingCalendar } from '../services/agronomyEngine';
import { getPlantDisplayName } from '../data/cropTaxonomy';
import { getLocalizedRegionName } from '../data/nasaVietnamGrid';
import { useLanguage } from '../contexts/LanguageContext';

interface PlantingCalendarViewProps {
  activeField: FieldProfile;
  savedCropKey?: string;
  onSelectCropKey?: (plotId: string, cropKey: string) => void;
}

export const PlantingCalendarView: React.FC<PlantingCalendarViewProps> = ({
  activeField,
  savedCropKey,
  onSelectCropKey,
}) => {
  const { lang, t } = useLanguage();
  const quickCrops = [
    {
      id: 'active',
      label: getPlantDisplayName(activeField.crop.name, lang),
      queryValue: activeField.crop.name,
    },
    { id: 'rice_st25', label: t('Lúa ST25', 'ST25 Rice'), queryValue: 'Lúa ST25' },
    { id: 'peanut_l14', label: t('Lạc L14', 'Peanut L14'), queryValue: 'Lạc L14' },
    { id: 'veg', label: t('Rau cải xanh', 'Leafy Greens'), queryValue: 'Rau cải xanh' },
    { id: 'maize', label: t('Ngô lai F1', 'Hybrid Maize'), queryValue: 'Ngô lai F1' },
    { id: 'watermelon', label: t('Dưa hấu', 'Watermelon'), queryValue: 'Dưa hấu' },
    { id: 'tomato', label: t('Cà chua', 'Tomato'), queryValue: 'Cà chua' },
  ];

  const [customCropInput, setCustomCropInput] = useState<string>(() => {
    if (!savedCropKey || savedCropKey === 'active') return activeField.crop.name;
    const match = quickCrops.find((c) => c.id === savedCropKey);
    return match ? match.queryValue : savedCropKey;
  });
  const [selectedDetail, setSelectedDetail] = useState<PlantingRiskEvaluation | null>(null);

  useEffect(() => {
    if (!savedCropKey || savedCropKey === 'active') {
      setCustomCropInput(activeField.crop.name);
    } else {
      const found = quickCrops.find((c) => c.id === savedCropKey);
      setCustomCropInput(found ? found.queryValue : savedCropKey);
    }
    setSelectedDetail(null);
  }, [activeField.id, activeField.crop.name, savedCropKey]);

  const effectiveCropQuery = customCropInput.trim() || activeField.crop.name;

  const evaluations = evaluatePlantingCalendar(
    effectiveCropQuery,
    activeField.soilType,
    activeField.lat,
    lang
  );

  const activeDetail = selectedDetail
    ? evaluations.find((e) => e.month === selectedDetail.month) || selectedDetail
    : null;

  const getStatusIcon = (status: PlantingRiskEvaluation['status']) => {
    switch (status) {
      case 'optimal':
        return <span className="text-emerald-700 font-extrabold text-lg">✓</span>;
      case 'caution':
        return <span className="text-amber-600 font-extrabold text-lg">!</span>;
      case 'risk':
        return <span className="text-rose-600 font-extrabold text-lg">×</span>;
      case 'insufficient':
      default:
        return <span className="text-stone-400 font-extrabold text-lg">–</span>;
    }
  };

  const getStatusBadge = (status: PlantingRiskEvaluation['status']) => {
    switch (status) {
      case 'optimal':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'caution':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'risk':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-stone-100 text-stone-800 border-stone-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              {t(
                'Đánh giá rủi ro thời vụ theo dữ liệu lịch sử (2001–2026)',
                'Historical Seasonal Risk Assessment (2001–2026)'
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 mt-1">
              {t(
                'Lịch Thời Vụ Gieo Trồng Theo Dữ Liệu Khí Hậu',
                'Climate-Informed Planting Calendar'
              )}
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              {t(
                `Tổng hợp dữ liệu quan trắc từ 2001–2026 tại khu vực ${getLocalizedRegionName(activeField.province, 'vi')} để ước tính tỷ lệ thuận lợi hay gặp bất lợi trong các giai đoạn sinh trưởng nhạy cảm.`,
                `Based on 2001–2026 climate records in ${getLocalizedRegionName(activeField.province, 'en')}, evaluating favorable odds across sensitive crop growth windows.`
              )}
            </p>
          </div>

          {/* Free-text Crop & Variety Input */}
          <div className="w-full md:w-72 shrink-0 space-y-1">
            <label className="text-xs text-stone-700 font-bold block">
              {t('Nhập cây hoặc giống cần tra lịch:', 'Type any crop or variety:')}
            </label>
            <input
              type="text"
              value={customCropInput}
              onChange={(e) => {
                const nextVal = e.target.value;
                setCustomCropInput(nextVal);
                setSelectedDetail(null);
              }}
              onBlur={() => {
                const cleaned = customCropInput.trim();
                if (cleaned && onSelectCropKey && !activeField.isSharedWithMe) {
                  onSelectCropKey(activeField.id, cleaned.slice(0, 40));
                }
              }}
              placeholder={t('VD: Lúa ST25, Lạc L14, Dưa hấu...', 'e.g. ST25 Rice, Peanut L14, Tomato...')}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-bold text-base sm:text-xs text-stone-900 shadow-2xs focus:outline-emerald-600"
            />
          </div>
        </div>

        {/* Quick Preset Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-stone-100">
          <span className="text-[11px] font-semibold text-stone-500 mr-1">
            {t('Chọn nhanh:', 'Quick pick:')}
          </span>
          {quickCrops.map((c) => {
            const isSelected = effectiveCropQuery.toLowerCase() === c.queryValue.toLowerCase();
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCustomCropInput(c.queryValue);
                  setSelectedDetail(null);
                  if (onSelectCropKey && !activeField.isSharedWithMe) {
                    onSelectCropKey(activeField.id, c.queryValue.slice(0, 40));
                  }
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend & Notation Guide */}
      <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-bold text-stone-700">
            {t('Chú giải mức độ phù hợp:', 'Suitability Legend:')}
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 font-black inline-flex items-center justify-center">
                ✓
              </span>
              <span className="text-stone-700">
                {t('Thuận lợi (Rủi ro < 15%)', 'Favorable (Risk < 15%)')}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 font-black inline-flex items-center justify-center">
                !
              </span>
              <span className="text-stone-700">
                {t('Cần chú ý (Rủi ro trung bình)', 'Caution (Moderate risk)')}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-md bg-rose-100 text-rose-800 font-black inline-flex items-center justify-center">
                ×
              </span>
              <span className="text-stone-700">
                {t('Bất lợi cao (Nhiều đợt cực đoan)', 'High risk (Frequent extremes)')}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-md bg-stone-200 text-stone-600 font-black inline-flex items-center justify-center">
                –
              </span>
              <span className="text-stone-700">
                {t('Chưa đủ dữ liệu', 'Insufficient data')}
              </span>
            </span>
          </div>
        </div>
        <p className="text-[11px] text-stone-600 border-t border-stone-200/80 pt-2">
          <strong>{t('Cách đọc chỉ số thuận lợi:', 'How favorability % works:')}</strong>{' '}
          {t(
            'Tỷ lệ phần trăm phản ánh mức độ an toàn qua các mùa vụ lịch sử (2001–2026) dựa trên tần suất rét đậm, nắng nóng hoặc úng/hạn rơi đúng giai đoạn nhạy cảm.',
            'Percentage reflects historical seasonal safety (2001–2026) based on how rarely cold snaps, heatwaves, or flood/drought hit sensitive growth stages.'
          )}
        </p>
      </div>

      {/* 12-Month Matrix Grid */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-stone-800">
          <span>
            {t('Khung thời vụ gieo cấy theo 12 tháng trong năm:', '12-Month Planting Window Matrix:')}
          </span>
          <span className="text-stone-400 font-normal">
            {t('Nhấp vào từng tháng để xem chi tiết thống kê', 'Tap any month for detailed stats')}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {evaluations.map((ev) => {
            const isSelected = activeDetail?.month === ev.month;
            const statusCardCls =
              ev.status === 'optimal'
                ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-400'
                : ev.status === 'caution'
                ? 'bg-amber-50/70 border-amber-200 hover:border-amber-400'
                : ev.status === 'risk'
                ? 'bg-rose-50/70 border-rose-200 hover:border-rose-400'
                : 'bg-stone-50 border-stone-200';
            const statusIconBg =
              ev.status === 'optimal'
                ? 'bg-emerald-100'
                : ev.status === 'caution'
                ? 'bg-amber-100'
                : ev.status === 'risk'
                ? 'bg-rose-100'
                : 'bg-stone-100';
            return (
              <button
                key={ev.month}
                onClick={() => setSelectedDetail(ev)}
                className={`p-3.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-between h-32 ${statusCardCls} ${
                  isSelected ? 'ring-2 ring-emerald-700 shadow-md' : 'shadow-2xs'
                }`}
              >
                <div className="text-xs font-bold text-stone-700">
                  {t(`Tháng ${ev.month}`, `Month ${ev.month}`)}
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center my-1 ${statusIconBg}`}>
                  {getStatusIcon(ev.status)}
                </div>
                <div className="text-[11px] font-bold text-stone-900">
                  {ev.status === 'optimal'
                    ? t('Thuận lợi', 'Optimal')
                    : ev.status === 'caution'
                    ? t('Cần theo dõi', 'Caution')
                    : t('Rủi ro cao', 'High Risk')}
                </div>
                <div className="text-[10px] font-medium text-stone-600">
                  {Math.max(5, Math.min(99, Math.round(((25 - ev.adverseYearsCount) / 25) * 100)))}%{' '}
                  {t('thuận lợi', 'favorable')}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Explanation Panel */}
      {activeDetail ? (
        <div className="bg-white rounded-2xl p-6 border-2 border-emerald-600/30 shadow-md space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-emerald-700" />
              <h3 className="font-bold text-base text-stone-900">
                {t(
                  `Phân tích thời vụ (2001–2026): Xuống giống vào Tháng ${activeDetail.month}`,
                  `Seasonal Climate Stats (2001–2026): Planting in Month ${activeDetail.month}`
                )}
              </h3>
            </div>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusBadge(
                activeDetail.status
              )}`}
            >
              {t('Đánh giá:', 'Rating:')}{' '}
              {activeDetail.status === 'optimal'
                ? t('Thuận lợi', 'Optimal')
                : activeDetail.status === 'caution'
                ? t('Cần chú ý', 'Caution')
                : t('Rủi ro cao', 'High Risk')}
            </span>
          </div>

          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs text-stone-800">
            <div className="font-bold text-emerald-950 text-sm">
              {(() => {
                const riskPct = Math.round((activeDetail.adverseYearsCount / 25) * 100);
                const favorablePct = Math.max(5, Math.min(99, 100 - riskPct));
                return t(
                  `Mức độ thuận lợi ~${favorablePct}% (rủi ro thời tiết ~${riskPct}%, trung bình ${activeDetail.adverseDaysAvg} ngày/vụ cần lưu ý: ${activeDetail.thresholdCondition}).`,
                  `~${favorablePct}% seasonal favorability (~${riskPct}% weather risk, averaging ${activeDetail.adverseDaysAvg} sensitive days with ${activeDetail.thresholdCondition}).`
                );
              })()}
            </div>
            <p className="text-stone-700 leading-relaxed font-normal">
              {activeDetail.summaryExplanation}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-stone-400 text-[10px] block">
                {t('Chuỗi dữ liệu khảo sát:', 'Historical baseline:')}
              </span>
              <span className="font-bold text-stone-800">
                {t('Liên tục 2001 – 2026', 'Continuous 2001 – 2026')}
              </span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-stone-400 text-[10px] block">
                {t('Xác suất thuận lợi / rủi ro:', 'Favorable vs. Risk odds:')}
              </span>
              <span className="font-bold text-emerald-800">
                {Math.max(5, Math.min(99, 100 - Math.round((activeDetail.adverseYearsCount / 25) * 100)))}%{' '}
                {t('thuận lợi', 'favorable')} ·{' '}
                <span className="text-amber-700">
                  {Math.round((activeDetail.adverseYearsCount / 25) * 100)}% {t('rủi ro', 'risk')}
                </span>
              </span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-stone-400 text-[10px] block">
                {t('Tiêu chí ngưỡng nông học:', 'Agronomic threshold:')}
              </span>
              <span className="font-bold text-stone-800">{activeDetail.thresholdCondition}</span>
            </div>
          </div>

          <div className="text-[11px] text-stone-400 italic">
            {t(
              '* Lưu ý thực địa: Lịch gieo trồng phản ánh xác suất khí hậu lịch sử 2001–2026, cần kết hợp quan sát thực tế tại ruộng.',
              '* Agronomic note: Planting calendar reflects 2001–2026 climate probability and should be paired with local field checks.'
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-500 text-center">
          {t(
            'Nhấp vào bất kỳ tháng nào trên bảng để xem chi tiết số năm gặp sự cố và phân tích ngưỡng nông học.',
            'Click any month card above to view adverse year counts and threshold details.'
          )}
        </div>
      )}
    </div>
  );
};
