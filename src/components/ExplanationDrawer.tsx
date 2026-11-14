import React from 'react';
import {
  X,
  HelpCircle,
  Satellite,
  Database,
  BrainCircuit,
  AlertTriangle,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { DailyAgronomicBrief, FieldProfile, WeatherObservation } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { getSoilLabel, getDrainageLabel } from '../services/agronomyEngine';

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
  const { lang, t } = useLanguage();
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
        return t('Khí hậu lịch sử 25 năm', '25-yr Historical Climate');
      case 'NASA_CURRENT':
        return t('Thời tiết & Môi trường thực tế', 'Live Weather & Field Metrics');
      case 'USER_OBSERVATION':
        return t('Thông tin nông hộ', 'Farmer Observation');
      case 'AI_INFERENCE':
        return t('Phân tích nông học', 'Agronomy Inference');
      default:
        return t('Tham khảo', 'Reference');
    }
  };

  const formatLastUpdated = (val?: string) => {
    if (!val) return null;
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return val;
    return d.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-emerald-300" />
            <h3 className="text-base font-bold">
              {t('Minh bạch Cơ chế Ra Quyết định', 'Decision Evidence & Provenance')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-stone-700">
          {/* Recommendation title */}
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
            <div className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
              {t('Khuyến nghị hiện tại', 'Current Recommendation')}
            </div>
            <div className="text-stone-900 font-bold text-base mt-1">{brief.headline}</div>
            <p className="text-xs text-stone-600 mt-1">{brief.situation}</p>
          </div>

          {/* 1. Climate & Soil moisture baseline */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <Satellite className="w-4 h-4 text-emerald-600" />
              <span>
                {t(
                  '1. Dữ liệu Khí hậu & Độ ẩm đất đối chiếu',
                  '1. Reference Climate & Soil Moisture Data'
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg">
                <div className="text-stone-500">
                  {t('Điểm khí hậu gần nhất:', 'Nearest climate grid:')}
                </div>
                <div className="font-semibold text-stone-800">
                  {field.nasaGrid.lat}°N, {field.nasaGrid.lon}°E
                </div>
                <div className="text-[11px] text-stone-400">
                  {t(`Cách ruộng: ${field.nasaGrid.distanceKm} km`, `Distance: ${field.nasaGrid.distanceKm} km`)}
                </div>
              </div>
              <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg">
                <div className="text-stone-500">
                  {t('Chuỗi dữ liệu lịch sử:', 'Historical series:')}
                </div>
                <div className="font-semibold text-stone-800">
                  {t('2001 – 2025 (25 năm)', '2001 – 2025 (25 years)')}
                </div>
                <div className="text-[11px] text-stone-400">
                  {t('Chuỗi khí hậu & ẩm độ vùng', 'Regional climate & moisture series')}
                </div>
              </div>
              <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg">
                <div className="text-stone-500">
                  {t('Độ ẩm đất tầng mặt:', 'Surface soil moisture:')}
                </div>
                <div className="font-semibold text-stone-800">
                  {(weather.gwettop * 100).toFixed(0)}%
                </div>
                <div className="text-[11px] text-stone-400">
                  {t('Lớp đất 0–5 cm', '0–5 cm topsoil')}
                </div>
              </div>
              <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg">
                <div className="text-stone-500">
                  {t('Độ ẩm đất vùng rễ:', 'Root zone moisture:')}
                </div>
                <div className="font-semibold text-stone-800">
                  {(weather.gwetroot * 100).toFixed(0)}%
                </div>
                <div className="text-[11px] text-stone-400">
                  {t('Lớp rễ 0–100 cm', '0–100 cm root zone')}
                </div>
              </div>
            </div>
          </section>

          {/* 2. Data Provenance with Last Updated */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <Database className="w-4 h-4 text-blue-600" />
              <span>
                {t(
                  '2. Nguồn gốc thông tin & Lần cuối cập nhật',
                  '2. Data Sources & Last Updated'
                )}
              </span>
            </div>
            <div className="space-y-2">
              {brief.provenances.map((prov, i) => {
                const updatedStr = formatLastUpdated(prov.lastUpdated);
                return (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border bg-stone-50/70 border-stone-200 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-stone-900">{prov.label}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold border shrink-0 ${getBadgeStyle(
                          prov.type
                        )}`}
                      >
                        {getProvenanceLabel(prov.type)}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600">{prov.description}</p>
                    {updatedStr && (
                      <div className="text-[11px] text-stone-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>
                          {t('Lần cuối cập nhật:', 'Last updated:')} {updatedStr}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Agronomy rules */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <BrainCircuit className="w-4 h-4 text-purple-600" />
              <span>
                {t('3. Quy tắc & Cơ sở Nông học Áp dụng', '3. Applied Agronomic Rules')}
              </span>
            </div>
            <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl space-y-2 text-xs leading-relaxed text-stone-700">
              <p>
                • <strong>{t('Sinh vật học rễ:', 'Root physiology:')}</strong>{' '}
                {t(
                  'Dưới 20°C kết hợp đất ẩm cao, rễ hấp thu khoáng chậm 40–60%. Tưới thêm lúc này làm giảm oxy hòa tan và dễ gây ngạt rễ.',
                  'Below 20°C in wet soils, root nutrient uptake drops 40–60%. Extra irrigation reduces dissolved oxygen and risks root hypoxia.'
                )}
              </p>
              <p>
                • <strong>{t(`Vật lý đất (${getSoilLabel(field.soilType, lang)}):`, `Soil physics (${getSoilLabel(field.soilType, lang)}):`)}</strong>{' '}
                {t(
                  `Mức thoát nước ${getDrainageLabel(field.soilCharacteristics.drainage, lang)} quyết định tốc độ rút ẩm tầng mặt 0–10 cm sau mưa.`,
                  `Drainage (${getDrainageLabel(field.soilCharacteristics.drainage, lang)}) governs how fast surface water clears after rain.`
                )}
              </p>
              <p>
                • <strong>{t('Cân bằng Carbon, Nước ngầm & Khí nhà kính:', 'Carbon, Groundwater & Emissions Balance:')}</strong>{' '}
                {t(
                  'Khi cập nhật chỉ số môi trường, hệ thống kết hợp tốc độ quang hợp tán lá, trữ lượng nước ngầm và phát thải CH₄/N₂O để cân chỉnh tưới, đạm và luân canh.',
                  'When refreshed, canopy photosynthesis, groundwater reserve trends, and CH₄/N₂O fluxes refine irrigation, nitrogen timing, and rotation choices.'
                )}
              </p>
            </div>
          </section>

          {/* 4. Uncertainties */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>
                {t(
                  '4. Những yếu tố cần kiểm tra thực tế',
                  '4. Uncertainties & Field Verification'
                )}
              </span>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
              {brief.uncertainties}
            </div>
          </section>

          {/* 5. Update Triggers */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              <span>
                {t('5. Khi nào hệ thống sẽ cập nhật khuyến nghị?', '5. When Recommendations Update')}
              </span>
            </div>
            <ul className="list-disc pl-5 text-xs space-y-1 text-stone-600">
              <li>
                {t(
                  'Khi bạn nhấn "Đất vẫn khô" hoặc "Đất quá ẩm", mô hình điều chỉnh độ nhạy tưới ngay lập tức.',
                  'When you tap "Soil is dry" or "Soil too wet", irrigation sensitivity adjusts immediately.'
                )}
              </li>
              <li>
                {t(
                  'Khi bạn bấm "Cập nhật chỉ số môi trường", chỉ số quang hợp, nước ngầm và ẩm đất mới được đưa thẳng vào chẩn đoán.',
                  'Clicking "Refresh Field Metrics" feeds fresh photosynthesis, groundwater, and moisture data straight into diagnostics.'
                )}
              </li>
            </ul>
          </section>
        </div>

        <div className="p-4 bg-stone-50 border-t border-stone-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-lg text-xs transition cursor-pointer"
          >
            {t('Đã hiểu cơ sở phân tích', 'Got it')}
          </button>
        </div>
      </div>
    </div>
  );
};
