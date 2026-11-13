import React from 'react';
import { X, HelpCircle, Satellite, Database, BrainCircuit, AlertTriangle, RefreshCw } from 'lucide-react';
import { DailyAgronomicBrief, FieldProfile, WeatherObservation } from '../types';

interface ExplanationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  brief: DailyAgronomicBrief;
  field: FieldProfile;
  weather: WeatherObservation;
}

export const ExplanationDrawer: React.FC<ExplanationDrawerProps> = ({
  isOpen,
  onClose,
  brief,
  field,
  weather,
}) => {
  if (!isOpen) return null;

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'NASA_HISTORICAL':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'NASA_CURRENT':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'USER_OBSERVATION':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'AI_INFERENCE':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-stone-100 text-stone-800 border-stone-200';
    }
  };

  const getProvenanceLabel = (type: string) => {
    switch (type) {
      case 'NASA_HISTORICAL':
        return 'Khí hậu lịch sử 21 năm';
      case 'NASA_CURRENT':
        return 'Quan trắc thời tiết mới';
      case 'USER_OBSERVATION':
        return 'Thông tin nông hộ';
      case 'AI_INFERENCE':
        return 'Phân tích nông học';
      default:
        return 'Tham khảo';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-emerald-300" />
            <h3 className="text-base font-bold">Minh bạch Cơ chế Ra Quyết định</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-stone-700">
          {/* Question title */}
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
            <div className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Khuyến nghị hiện tại</div>
            <div className="text-stone-900 font-bold text-base mt-1">{brief.headline}</div>
            <p className="text-xs text-stone-600 mt-1">{brief.situation}</p>
          </div>

          {/* 1. Dữ liệu khí hậu đã sử dụng */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <Satellite className="w-4 h-4 text-emerald-600" />
              <span>1. Dữ liệu Khí hậu &amp; Độ ẩm đất đối chiếu</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg">
                <div className="text-stone-500">Điểm khí hậu gần nhất:</div>
                <div className="font-semibold text-stone-800">{field.nasaGrid.lat}°B, {field.nasaGrid.lon}°Đ</div>
                <div className="text-[11px] text-stone-400">Cách thửa ruộng: {field.nasaGrid.distanceKm} km</div>
              </div>
              <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg">
                <div className="text-stone-500">Chuỗi dữ liệu lịch sử:</div>
                <div className="font-semibold text-stone-800">2005 – 2025 (21 năm)</div>
                <div className="text-[11px] text-stone-400">Theo lưới khí hậu vùng</div>
              </div>
              <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg">
                <div className="text-stone-500">Độ ẩm đất tầng mặt:</div>
                <div className="font-semibold text-stone-800">{(weather.gwettop * 100).toFixed(0)}%</div>
                <div className="text-[11px] text-stone-400">Lớp đất 0–5 cm</div>
              </div>
              <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg">
                <div className="text-stone-500">Độ ẩm đất vùng rễ:</div>
                <div className="font-semibold text-stone-800">{(weather.gwetroot * 100).toFixed(0)}%</div>
                <div className="text-[11px] text-stone-400">Lớp rễ 0–100 cm</div>
              </div>
            </div>
          </section>

          {/* 2. Nhãn nguồn gốc dữ liệu */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <Database className="w-4 h-4 text-blue-600" />
              <span>2. Nguồn gốc thông tin tham chiếu</span>
            </div>
            <div className="space-y-2">
              {brief.provenances.map((prov, i) => (
                <div key={i} className="p-2.5 rounded-lg border bg-stone-50/70 border-stone-200 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-stone-900">{prov.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${getBadgeStyle(prov.type)}`}>
                      {getProvenanceLabel(prov.type)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600">{prov.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Cơ sở nông học áp dụng */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <BrainCircuit className="w-4 h-4 text-purple-600" />
              <span>3. Quy tắc & Cơ sở Nông học Áp dụng</span>
            </div>
            <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl space-y-2 text-xs leading-relaxed text-stone-700">
              <p>
                • <strong>Sinh vật học rễ:</strong> Trong điều kiện nhiệt độ dưới 20°C kết hợp đất ẩm cao, hoạt tính hút nước và khoáng của rễ cây con giảm 40-60%. Tưới thêm nước lúc này làm giảm lượng oxy hòa tan trong đất, dẫn đến ngạt rễ.
              </p>
              <p>
                • <strong>Vật lý đất {field.soilType}:</strong> Đất có kết cấu thoát nước {field.soilCharacteristics.drainage === 'slow' ? 'chậm' : 'nhanh'}, do đó các vệt nước mưa tích lũy không rút ngay mà đọng lại ở tầng mặt 0-10cm.
              </p>
              <p>
                • <strong>Nhu cầu dinh dưỡng:</strong> Đạm vô cơ (Urê) khi bón vào đất lạnh dễ bị bay hơi hoặc rửa trôi, đồng thời làm tế bào lá mỏng mềm, tạo cửa ngõ cho nấm bệnh xâm nhập khi độ ẩm không khí vượt 80%.
              </p>
            </div>
          </section>

          {/* 4. Yếu tố còn chưa chắc chắn */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>4. Những yếu tố còn chưa chắc chắn (Cần kiểm tra thực tế)</span>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
              {brief.uncertainties}
            </div>
          </section>

          {/* 5. Điều kiện thay đổi khuyến nghị */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              <span>5. Khi nào AI sẽ thay đổi khuyến nghị?</span>
            </div>
            <ul className="list-disc pl-5 text-xs space-y-1 text-stone-600">
              <li>Nếu bạn nhấn <strong>"Đất thực tế vẫn khô"</strong>, AI sẽ điều chỉnh giả định thoát nước và đề xuất chế độ tưới bù.</li>
              <li>Nếu nhiệt độ tăng trở lại trên 25°C và trời hửng nắng, hệ thống sẽ mở lại khuyến nghị bón thúc dinh dưỡng.</li>
              <li>Nếu bạn đổi sang giống cây khác hoặc cây bước sang giai đoạn sinh trưởng mới.</li>
            </ul>
          </section>
        </div>

        <div className="p-4 bg-stone-50 border-t border-stone-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-lg text-xs transition cursor-pointer"
          >
            Đã hiểu cơ sở phân tích
          </button>
        </div>
      </div>
    </div>
  );
};
