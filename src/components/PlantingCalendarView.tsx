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
  const [selectedCropKey, setSelectedCropKey] = useState<string>(savedCropKey || 'active');
  const [selectedDetail, setSelectedDetail] = useState<PlantingRiskEvaluation | null>(null);

  useEffect(() => {
    setSelectedCropKey(savedCropKey || 'active');
    setSelectedDetail(null);
  }, [activeField.id, savedCropKey]);

  const cropOptions = [
    {
      id: 'active',
      label: getPlantDisplayName(activeField.crop.name, lang),
      queryValue: activeField.crop.name,
    },
    {
      id: 'rice',
      label: t('Lúa (ST25 / Đài Thơm)', 'Rice (ST25 / Dai Thom)'),
      queryValue: t('Lúa (ST25 / Đài Thơm)', 'Rice (ST25 / Dai Thom)'),
    },
    {
      id: 'veg',
      label: t('Rau cải xanh vụ đông', 'Winter Leafy Greens'),
      queryValue: t('Rau cải xanh vụ đông', 'Winter Leafy Greens'),
    },
    {
      id: 'maize',
      label: t('Ngô lai F1 (Bắp)', 'Maize / Corn'),
      queryValue: t('Ngô lai F1 (Bắp)', 'Maize / Corn'),
    },
    {
      id: 'legume',
      label: t('Đậu tương / Lạc (Họ Đậu)', 'Soybean / Peanut (Legume)'),
      queryValue: t('Đậu tương / Lạc (Họ Đậu)', 'Soybean / Peanut (Legume)'),
    },
  ].filter(
    (opt, idx, arr) =>
      idx === 0 ||
      opt.label.toLowerCase() !== arr[0].label.toLowerCase()
  );

  const selectedOption =
    cropOptions.find((o) => o.id === selectedCropKey) || cropOptions[0];

  const evaluations = evaluatePlantingCalendar(
    selectedOption.queryValue,
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
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            {t(
              'Đánh giá xác suất rủi ro lịch sử 25 năm (2001–2025)',
              '25-Year Historical Risk Assessment (2001–2025)'
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
              `Dựa trên 25 năm quan trắc (2001–2025) tại khu vực ${getLocalizedRegionName(activeField.province, 'vi')}. Đánh giá số năm xuất hiện điều kiện bất lợi trong các giai đoạn sinh trưởng nhạy cảm.`,
              `Based on 25 years of historical climate observations (2001–2025) in ${getLocalizedRegionName(activeField.province, 'en')}, counting adverse years in sensitive crop growth windows.`
            )}
          </p>
        </div>

        {/* Crop Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-stone-500 font-medium">
            {t('Chọn cây trồng:', 'Select crop:')}
          </span>
          <select
            value={selectedOption.id}
            onChange={(e) => {
              const nextKey = e.target.value;
              setSelectedCropKey(nextKey);
              setSelectedDetail(null);
              if (onSelectCropKey && !activeField.isSharedWithMe) {
                onSelectCropKey(activeField.id, nextKey);
              }
            }}
            className="px-3 py-2 border border-stone-300 rounded-xl bg-white font-bold text-xs text-stone-900 shadow-2xs"
          >
            {cropOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
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
          <strong>{t('Ý nghĩa chỉ số "X/25 năm bất lợi":', 'Meaning of "X/25 adverse yrs":')}</strong>{' '}
          {t(
            'Đếm số năm trong chuỗi 25 năm (2001–2025) xuất hiện rét đậm, nắng nóng hoặc úng/hạn rơi đúng giai đoạn nhạy cảm nếu gieo vào tháng đó.',
            'Counts how many years out of 2001–2025 experienced cold snaps, heatwaves, or floods/drought during sensitive growth stages when planted in that month.'
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
                <div className="text-[10px] text-stone-500">
                  {ev.adverseYearsCount}/25 {t('năm bất lợi', 'adverse yrs')}
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
                  `Thống kê 25 năm (2001–2025): Xuống giống vào Tháng ${activeDetail.month}`,
                  `25-Year Climate Stats (2001–2025): Planting in Month ${activeDetail.month}`
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
              {t(
                `"Trong 25 năm (2001–2025), có ${activeDetail.adverseYearsCount} năm xuất hiện trung bình ${activeDetail.adverseDaysAvg} ngày có ${activeDetail.thresholdCondition}."`,
                `"Across 25 years (2001–2025), ${activeDetail.adverseYearsCount} years averaged ${activeDetail.adverseDaysAvg} days with ${activeDetail.thresholdCondition}."`
              )}
            </div>
            <p className="text-stone-700 leading-relaxed font-normal">
              {activeDetail.summaryExplanation}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-stone-400 text-[10px] block">
                {t('Mẫu dữ liệu khảo sát:', 'Sample window:')}
              </span>
              <span className="font-bold text-stone-800">
                {t('25 năm liên tục (2001 – 2025)', '25 continuous years (2001–2025)')}
              </span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-stone-400 text-[10px] block">
                {t('Số năm gặp sự cố bất lợi:', 'Adverse years:')}
              </span>
              <span className="font-bold text-amber-700">
                {activeDetail.adverseYearsCount} / 25 {t('năm', 'yrs')} (
                {((activeDetail.adverseYearsCount / 25) * 100).toFixed(0)}%)
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
              '* Lưu ý thực địa: Lịch gieo trồng phản ánh xác suất rủi ro khí hậu lịch sử 25 năm, cần kết hợp quan sát thực tế tại ruộng.',
              '* Agronomic note: Planting calendar reflects 25-year historical climate probability and should be paired with local field checks.'
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
