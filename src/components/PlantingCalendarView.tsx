import React, { useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Info,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { FieldProfile, PlantingRiskEvaluation } from '../types';
import { evaluatePlantingCalendar } from '../services/agronomyEngine';

interface PlantingCalendarViewProps {
  activeField: FieldProfile;
}

export const PlantingCalendarView: React.FC<PlantingCalendarViewProps> = ({ activeField }) => {
  const [selectedCrop, setSelectedCrop] = useState<string>(activeField.crop.name);
  const [selectedDetail, setSelectedDetail] = useState<PlantingRiskEvaluation | null>(null);

  const crops = Array.from(
    new Set([
      activeField.crop.name,
      'Lúa (ST25 / Đài Thơm)',
      'Rau cải xanh vụ đông',
      'Ngô lai F1 (Bắp)',
      'Đậu tương / Lạc (Họ Đậu)',
    ])
  );

  const evaluations = evaluatePlantingCalendar(selectedCrop, activeField.soilType, activeField.lat);

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
            Đánh giá xác suất rủi ro lịch sử 21 năm (2005–2025)
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 mt-1">
            Lịch Thời Vụ Gieo Trồng Theo Dữ Liệu Khí Hậu
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Dựa trên 21 năm quan trắc tại điểm khí hậu <strong>{activeField.nasaGrid.cellId}</strong> ({activeField.province}). Đánh giá số năm xuất hiện điều kiện bất lợi trong các giai đoạn sinh trưởng nhạy cảm.
          </p>
        </div>

        {/* Crop Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-stone-500 font-medium">Chọn cây trồng:</span>
          <select
            value={selectedCrop}
            onChange={e => {
              setSelectedCrop(e.target.value);
              setSelectedDetail(null);
            }}
            className="px-3 py-2 border border-stone-300 rounded-xl bg-white font-bold text-xs text-stone-900 shadow-2xs"
          >
            {crops.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend & Notation Guide */}
      <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-bold text-stone-700">Chú giải mức độ phù hợp:</span>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 font-black inline-flex items-center justify-center">
                ✓
              </span>
              <span className="text-stone-700">Thuận lợi (Rủi ro &lt; 15%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 font-black inline-flex items-center justify-center">
                !
              </span>
              <span className="text-stone-700">Cần chú ý (Rủi ro trung bình)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-md bg-rose-100 text-rose-800 font-black inline-flex items-center justify-center">
                ×
              </span>
              <span className="text-stone-700">Bất lợi cao (Nhiều đợt cực đoan)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-md bg-stone-200 text-stone-600 font-black inline-flex items-center justify-center">
                –
              </span>
              <span className="text-stone-700">Chưa đủ dữ liệu</span>
            </span>
          </div>
        </div>
        <p className="text-[11px] text-stone-600 border-t border-stone-200/80 pt-2">
          <strong>Ý nghĩa chỉ số "X/21 năm bất lợi":</strong> Hệ thống đếm trong chuỗi dữ liệu NASA <strong>21 năm (2005–2025)</strong> có bao nhiêu năm xuất hiện thời tiết cực đoan (rét đậm, nắng nóng hoặc úng/hạn) rơi đúng giai đoạn nhạy cảm nếu gieo vào tháng đó. Ví dụ <strong>1/21 năm bất lợi</strong> nghĩa là suốt 21 năm qua chỉ có đúng <strong>1 năm (~5%)</strong> gặp thời tiết xấu, còn 20 năm thời tiết thuận lợi.
        </p>
      </div>

      {/* 12-Month Matrix Grid */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-stone-800">
          <span>Khung thời vụ gieo cấy theo 12 tháng trong năm:</span>
          <span className="text-stone-400 font-normal">Nhấp vào từng tháng để xem chi tiết thống kê</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {evaluations.map(ev => {
            const isSelected = selectedDetail?.month === ev.month;
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
                  isSelected
                    ? 'ring-2 ring-emerald-700 shadow-md'
                    : 'shadow-2xs'
                }`}
              >
                <div className="text-xs font-bold text-stone-700">Tháng {ev.month}</div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center my-1 ${statusIconBg}`}>
                  {getStatusIcon(ev.status)}
                </div>
                <div className="text-[11px] font-bold text-stone-900">
                  {ev.status === 'optimal'
                    ? 'Thuận lợi'
                    : ev.status === 'caution'
                    ? 'Cần theo dõi'
                    : 'Rủi ro cao'}
                </div>
                <div className="text-[10px] text-stone-500">
                  {ev.adverseYearsCount}/21 năm bất lợi
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Explanation Panel for Selected Month */}
      {selectedDetail ? (
        <div className="bg-white rounded-2xl p-6 border-2 border-emerald-600/30 shadow-md space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-emerald-700" />
              <h3 className="font-bold text-base text-stone-900">
                Thống kê 21 năm NASA POWER: Xuống giống vào Tháng {selectedDetail.month}
              </h3>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusBadge(selectedDetail.status)}`}>
              Đánh giá: {selectedDetail.status === 'optimal' ? 'Thuận lợi' : selectedDetail.status === 'caution' ? 'Cần chú ý' : 'Rủi ro cao'}
            </span>
          </div>

          {/* Exact Numbers from 21 Years of Real NASA Data as Required */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs text-stone-800">
            <div className="font-bold text-emerald-950 text-sm">
              "Trong 21 năm (2005–2025), có {selectedDetail.adverseYearsCount} năm xuất hiện trung bình {selectedDetail.adverseDaysAvg} ngày có {selectedDetail.thresholdCondition}."
            </div>
            <p className="text-stone-700 leading-relaxed font-normal">
              {selectedDetail.summaryExplanation}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-stone-400 text-[10px] block">Mẫu dữ liệu khảo sát:</span>
              <span className="font-bold text-stone-800">21 năm liên tục (2005 - 2025)</span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-stone-400 text-[10px] block">Số năm gặp sự cố bất lợi:</span>
              <span className="font-bold text-amber-700">{selectedDetail.adverseYearsCount} / 21 năm ({((selectedDetail.adverseYearsCount / 21) * 100).toFixed(0)}%)</span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-stone-400 text-[10px] block">Tiêu chí ngưỡng nông học:</span>
              <span className="font-bold text-stone-800">{selectedDetail.thresholdCondition}</span>
            </div>
          </div>

          <div className="text-[11px] text-stone-400 italic">
            * Lưu ý pháp lý & khoa học: Lịch gieo trồng là kết quả đánh giá xác suất rủi ro khí hậu lịch sử 21 năm của NASA, không phải cam kết tuyệt đối về năng suất tương lai.
          </div>
        </div>
      ) : (
        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-500 text-center">
          Nhấp vào bất kỳ tháng nào trên bảng để xem chi tiết số năm gặp sự cố và phân tích ngưỡng nông học.
        </div>
      )}
    </div>
  );
};
