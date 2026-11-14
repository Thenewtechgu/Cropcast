import React, { useState } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Droplets,
  Sun,
  Wind,
  ThumbsUp,
  ThumbsDown,
  Bot,
  Satellite,
  RefreshCw,
} from 'lucide-react';
import {
  FieldProfile,
  WeatherObservation,
  DailyAgronomicBrief,
  FeedbackType,
  EarthEnvironmentSnapshot,
} from '../types';
import { getSoilLabel, getDrainageLabel, getWaterLabel } from '../services/agronomyEngine';
import {
  getPlantDisplayName,
  getCommonStageLabel,
  getCommonVarietyLabel,
} from '../data/cropTaxonomy';
import { getLocalizedRegionName } from '../data/nasaVietnamGrid';
import { EarthSustainabilityPanel } from './EarthSustainabilityPanel';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardViewProps {
  field: FieldProfile;
  weather: WeatherObservation;
  brief: DailyAgronomicBrief;
  onOpenExplanation: () => void;
  onOpenMap: () => void;
  onNavigateTab: (tab: string) => void;
  onSendFeedback: (type: FeedbackType, note?: string) => void;
  onTaskCompleted: (taskTitle: string) => void;
  onSaveEarthMetrics?: (snapshot: EarthEnvironmentSnapshot) => Promise<void> | void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  field,
  weather,
  brief,
  onOpenExplanation,
  onOpenMap,
  onNavigateTab,
  onSendFeedback,
  onTaskCompleted,
  onSaveEarthMetrics,
}) => {
  const { lang, t } = useLanguage();
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<string | null>(null);
  const [completedActions, setCompletedActions] = useState<Record<string, boolean>>({});

  const handleActionCheck = (actionId: string, title: string) => {
    setCompletedActions((prev) => ({ ...prev, [actionId]: !prev[actionId] }));
    onTaskCompleted(title);
  };

  const handleFeedback = (type: FeedbackType, label: string) => {
    onSendFeedback(type);
    setFeedbackSubmitted(
      t(
        `Đã ghi nhận: "${label}". Hệ thống đã cập nhật cho thửa ruộng này.`,
        `Recorded: "${label}". Field diagnostics have been updated.`
      )
    );
    setTimeout(() => setFeedbackSubmitted(null), 4500);
  };

  const healthScore =
    brief.riskLevel === 'CRITICAL' ? 68 : brief.riskLevel === 'WARNING' ? 82 : 95;

  const earth = field.adaptiveMemory?.earthMetrics;
  const smap = earth?.smapModis;
  const localizedObsDate =
    weather.observationDate === 'Hôm nay (Cập nhật 07:00)'
      ? t('Hôm nay (Cập nhật 07:00)', 'Today (Updated 07:00)')
      : weather.observationDate;
  const powerUpdatedLabel = earth?.nasaPowerLastUpdated
    ? new Date(earth.nasaPowerLastUpdated).toLocaleDateString(lang === 'en' ? 'en-US' : 'vi-VN')
    : localizedObsDate;

  return (
    <div className="space-y-6">
      {/* Single Clean Field Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span className="font-semibold text-emerald-800">
              {getPlantDisplayName(field.crop.name, lang)}
            </span>
            <span>·</span>
            <span>{getCommonStageLabel(field.crop.currentStage, lang)}</span>
            <span>·</span>
            <span>
              {getLocalizedRegionName(field.province, lang)}
              {field.district ? `, ${field.district}` : ''}
            </span>
            <span>·</span>
            <span className="font-mono tabular-nums">{field.areaHa} ha</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            {field.name}
          </h1>
          <p className="text-xs text-stone-600">
            {t('Đất', 'Soil')} {getSoilLabel(field.soilType, lang)} (
            {getDrainageLabel(field.soilCharacteristics.drainage, lang)}) ·{' '}
            {t('Thăm ruộng tiếp theo:', 'Next field check:')}{' '}
            <strong className="text-stone-900">{brief.nextCheckTime}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateTab('rotation')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t('Luân canh tối ưu', 'Optimal Rotation')}
          </button>
          <button
            type="button"
            onClick={onOpenMap}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Satellite className="w-3.5 h-3.5" /> {t('Bản đồ vệ tinh', 'Satellite Map')}
          </button>
        </div>
      </div>

      {/* Environmental Sustainability Panel: NASA OCO-2, GRACE, GHGx/EDGAR, SMAP + Sync Button */}
      <EarthSustainabilityPanel
        field={field}
        weatherObservationDate={weather.observationDate}
        onSaveToField={onSaveEarthMetrics}
        onNavigateRotation={() => onNavigateTab('rotation')}
      />

      {/* Core Daily Action Section */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              {t('Hôm nay ruộng cần làm gì?', 'Today’s Field Priorities')}
            </h2>
            <p className="text-xs text-stone-500">
              {t('Quan trắc ngày', 'Observed on')}{' '}
              <span className="font-mono">{localizedObsDate}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenExplanation}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition cursor-pointer self-start sm:self-auto whitespace-nowrap"
          >
            <HelpCircle className="w-4 h-4 text-emerald-700" />
            {t('Xem cơ sở gợi ý', 'See Evidence')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Diagnosis */}
          <div className="lg:col-span-7 space-y-4">
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                brief.riskLevel === 'WARNING' || brief.riskLevel === 'CRITICAL'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-950'
              }`}
            >
              {brief.riskLevel === 'WARNING' || brief.riskLevel === 'CRITICAL' ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold text-sm">{brief.headline}</div>
                <p className="text-xs leading-relaxed opacity-90">{brief.situation}</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
              {brief.analysis}
            </p>
          </div>

          {/* Right: 3 Checklist Actions + Postpone */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-bold text-stone-800">
              {t('Việc nên làm hôm nay', 'Recommended Actions')}
            </div>
            <div className="space-y-2">
              {brief.topActions.map((act) => {
                const isDone = !!completedActions[act.id];
                return (
                  <label
                    key={act.id}
                    className={`p-3 rounded-xl border text-xs transition cursor-pointer flex items-start gap-2.5 ${
                      isDone
                        ? 'bg-emerald-50 border-emerald-200 text-stone-500 line-through'
                        : 'bg-stone-50/70 border-stone-200 hover:border-emerald-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => handleActionCheck(act.id, act.title)}
                      className="w-4 h-4 rounded text-emerald-600 mt-0.5 cursor-pointer accent-emerald-600"
                    />
                    <div className="space-y-0.5 flex-1">
                      <div
                        className={`font-semibold ${isDone ? 'text-stone-500' : 'text-stone-900'}`}
                      >
                        {act.title}
                      </div>
                      <div className="text-[11px] text-stone-500 leading-snug">{act.reason}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            {brief.postponeActions.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-900">
                <div className="font-bold text-rose-800">{t('Nên tạm hoãn', 'Postpone')}</div>
                <ul className="list-disc pl-4 space-y-0.5 text-rose-800">
                  {brief.postponeActions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Field Reality Check & Quick Feedback Strip */}
        <div className="pt-4 border-t border-stone-100 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-stone-600 font-medium">
              {t('Phản hồi thực tế & Kiểm chứng dự báo:', 'Field reality & forecast check:')}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleFeedback('helpful', t('Hữu ích', 'Helpful'))}
                className="px-3 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg text-stone-700 font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" /> {t('Hữu ích', 'Helpful')}
              </button>
              <button
                type="button"
                onClick={() => handleFeedback('soil_still_dry', t('Đất vẫn khô', 'Soil is dry'))}
                className="px-3 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg text-stone-700 font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <Droplets className="w-3.5 h-3.5 text-amber-600" />{' '}
                {t('Đất vẫn khô', 'Soil is dry')}
              </button>
              <button
                type="button"
                onClick={() => handleFeedback('soil_too_wet', t('Đất quá ẩm', 'Soil too wet'))}
                className="px-3 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg text-stone-700 font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <ThumbsDown className="w-3.5 h-3.5 text-sky-600" />{' '}
                {t('Đất quá ẩm', 'Soil too wet')}
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('feedback')}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                {t('Cập nhật ruộng & Kiểm tra cách sửa →', 'Update field & check fixes →')}
              </button>
            </div>
          </div>

          {field.adaptiveMemory?.lastCheckInSummary && (
            <div
              className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                field.adaptiveMemory.lastPredictionOutcome === 'on_track'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="space-y-0.5">
                <div className="font-bold">
                  {field.adaptiveMemory.lastPredictionOutcome === 'on_track'
                    ? t('Lần thăm ruộng gần nhất: Dự báo khớp kế hoạch', 'Latest check-in: Prediction is on track')
                    : t('Lần thăm ruộng gần nhất: Đã phát hiện sai lệch & có hướng sửa', 'Latest check-in: Fixes ready to restore plan')}
                </div>
                <div className="text-[11px] opacity-90">
                  {field.adaptiveMemory.planFixRecommendations?.[0] ||
                    field.adaptiveMemory.lastCheckInSummary}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('feedback')}
                className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg font-bold text-stone-800 hover:bg-stone-50 shrink-0 cursor-pointer"
              >
                {t('Xem chi tiết', 'View fixes')}
              </button>
            </div>
          )}
        </div>

        {feedbackSubmitted && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium flex items-center justify-between">
            <span>{feedbackSubmitted}</span>
            <button
              type="button"
              onClick={() => setFeedbackSubmitted(null)}
              className="text-emerald-700 cursor-pointer font-bold"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 3 Compact Core Field Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Weather */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span className="font-semibold text-stone-800">
              {t('Thời tiết hôm nay', "Today's Weather")}
            </span>
            <Sun className="w-4 h-4 text-amber-500" />
          </div>

          <div>
            <div className="text-3xl font-black text-stone-900 font-mono tabular-nums">
              {weather.temp}°C
            </div>
            <div className="text-xs text-stone-500 mt-1 font-mono tabular-nums">
              {weather.minTemp}°C – {weather.maxTemp}°C · {t('Nền 21 năm:', '21-yr avg:')}{' '}
              {weather.historicalBaseline.avgTemp}°C
            </div>
            <div className="text-[11px] text-stone-400 mt-1">
              NASA POWER · {t('Cập nhật:', 'Last updated:')} {powerUpdatedLabel}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-stone-100 text-xs">
            <div>
              <span className="text-stone-400 block">{t('Mưa', 'Rain')}</span>
              <span className="font-bold text-stone-800 font-mono tabular-nums">
                {weather.rain} mm
              </span>
            </div>
            <div>
              <span className="text-stone-400 block">{t('Ẩm không khí', 'Humidity')}</span>
              <span className="font-bold text-stone-800 font-mono tabular-nums">
                {weather.humidity}%
              </span>
            </div>
            <div>
              <span className="text-stone-400 block">{t('Bức xạ', 'Solar')}</span>
              <span className="font-bold text-stone-800 font-mono tabular-nums">
                {weather.solarRadiation} MJ/m²
              </span>
            </div>
            <div>
              <span className="text-stone-400 block flex items-center gap-1">
                <Wind className="w-3 h-3" /> {t('Gió', 'Wind')}
              </span>
              <span className="font-bold text-stone-800 font-mono tabular-nums">
                {weather.windSpeed} m/s
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Soil Moisture */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span className="font-semibold text-stone-800">
              {t('Độ ẩm đất', 'Soil Moisture')}
            </span>
            <span>{getWaterLabel(field.waterSource.type, lang)}</span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-stone-600">{t('Vùng rễ (0–100 cm)', 'Root zone (0–100 cm)')}</span>
                <span className="font-bold text-emerald-700 font-mono tabular-nums">
                  {(weather.gwetroot * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.max(5, weather.gwetroot * 100))}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-stone-600">
                  {t('Tầng mặt (0–5 cm)', 'Surface (0–5 cm)')}
                </span>
                <span className="font-bold text-sky-700 font-mono tabular-nums">
                  {smap ? `${smap.smapSoilMoisturePct}%` : `${(weather.gwettop * 100).toFixed(0)}%`}
                </span>
              </div>
              <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(5, smap ? smap.smapSoilMoisturePct : weather.gwettop * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>

            {smap && (
              <div className="text-[11px] text-stone-500 font-mono">
                MODIS NDVI: {smap.modisNdvi} · GPM 7d: {smap.gpmPrecipitation7dMm} mm
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('tasks')}
            className="text-xs text-emerald-800 font-semibold hover:underline text-left cursor-pointer"
          >
            {t('Xem việc cần làm →', 'View field tasks →')}
          </button>
        </div>

        {/* Card 3: Crop Growth & AI */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span className="font-semibold text-stone-800">
              {t('Sinh trưởng cây trồng', 'Crop Growth')}
            </span>
            <span className="font-mono tabular-nums">
              {t('Giai đoạn', 'Stage')} {field.crop.stageIndex + 1}/5
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-3xl font-black text-stone-900 font-mono tabular-nums">
              {healthScore}%
            </div>
            <div className="text-xs text-stone-600">
              <div className="font-semibold text-stone-900">
                {getPlantDisplayName(field.crop.name, lang)} (
                {getCommonVarietyLabel(field.crop.variety, lang)})
              </div>
              <div className="text-stone-500">
                {t('Xuống giống:', 'Planted:')} {field.crop.plantingDate}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('assistant')}
            className="w-full py-2 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Bot className="w-4 h-4" /> {t('Hỏi Trợ lý AI', 'Ask AI Assistant')}
          </button>
        </div>
      </div>
    </div>
  );
};
