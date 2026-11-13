import React, { useState } from 'react';
import {
  Sparkles,
  HelpCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Droplets,
  Thermometer,
  Sun,
  Wind,
  Layers,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Bot,
  Activity,
  Calendar,
  Satellite,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import {
  FieldProfile,
  WeatherObservation,
  DailyAgronomicBrief,
  FeedbackType,
} from '../types';
import { getSoilLabel, getDrainageLabel, getWaterLabel, getGoalLabel } from '../services/agronomyEngine';
import { getWaterObsLabel } from './MyFieldsView';

interface DashboardViewProps {
  field: FieldProfile;
  weather: WeatherObservation;
  brief: DailyAgronomicBrief;
  onOpenExplanation: () => void;
  onOpenMap: () => void;
  onNavigateTab: (tab: string) => void;
  onSendFeedback: (type: FeedbackType, note?: string) => void;
  onTaskCompleted: (taskTitle: string) => void;
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
}) => {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<string | null>(null);
  const [completedActions, setCompletedActions] = useState<Record<string, boolean>>({});

  const handleActionCheck = (actionId: string, title: string) => {
    setCompletedActions(prev => ({ ...prev, [actionId]: !prev[actionId] }));
    onTaskCompleted(title);
  };

  const handleFeedback = (type: FeedbackType, label: string) => {
    onSendFeedback(type);
    setFeedbackSubmitted(`Cảm ơn bạn! Đã ghi nhận phản hồi: "${label}". AI đang cập nhật mô hình cho thửa ruộng này.`);
    setTimeout(() => setFeedbackSubmitted(null), 5000);
  };

  // Plant health score estimate based on stress indicators
  const healthScore = brief.riskLevel === 'CRITICAL' ? 68 : brief.riskLevel === 'WARNING' ? 82 : 95;

  return (
    <div className="space-y-6">
      {/* Clean Farmer Climate & Supportive Notice Bar (No Admin or DB internals exposed) */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-stone-900 text-white rounded-2xl p-4 sm:p-5 border border-emerald-800/40 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] bg-emerald-400 text-stone-950 font-extrabold px-2.5 py-0.5 rounded-full">
              Tổng hợp dữ liệu khí hậu &amp; đồng ruộng
            </span>
            <span className="text-xs text-emerald-200 font-medium">
              Cập nhật quan trắc: <strong className="font-mono">{weather.observationDate}</strong>
            </span>
          </div>
          <p className="text-xs text-stone-200 leading-relaxed">
            Dữ liệu vệ tinh phản ánh xu thế thời tiết theo vùng; kết hợp thêm quan sát thực tế tại bờ thửa và kinh nghiệm của bạn để ra quyết định chính xác nhất.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigateTab('rotation')}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Khám phá luân canh
          </button>
          <button
            onClick={onOpenMap}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Satellite className="w-3.5 h-3.5" /> Xem ảnh vệ tinh
          </button>
        </div>
      </div>

      {/* Top Welcome & Active Field Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
              Thửa ruộng đang theo dõi
            </span>
            <span className="text-xs text-stone-500">
              {field.province}, {field.district} • {field.areaHa} ha
            </span>
            <button
              onClick={onOpenMap}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-medium inline-flex items-center gap-1 cursor-pointer underline"
            >
              <Satellite className="w-3.5 h-3.5" /> Ô NASA cách {field.nasaGrid.distanceKm} km
            </button>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            {field.name}
          </h1>
          <p className="text-xs sm:text-sm text-stone-600">
            Giống cây: <strong className="text-stone-900">{field.crop.name} ({field.crop.variety})</strong> • Giai đoạn:{' '}
            <strong className="text-emerald-700">{field.crop.currentStage}</strong> • Đất:{' '}
            <strong>{getSoilLabel(field.soilType)}</strong> ({getDrainageLabel(field.soilCharacteristics.drainage)})
          </p>
        </div>

        {/* Quick status pill & Next Check Reminder */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-right">
            <div className="text-[10px] text-emerald-800 font-semibold uppercase tracking-wider flex items-center justify-end gap-1">
              <Clock className="w-3 h-3" /> Lịch thăm ruộng
            </div>
            <div className="text-xs sm:text-sm font-bold text-emerald-950">
              {brief.nextCheckTime}
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('fields')}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Hồ sơ ruộng
          </button>
        </div>
      </div>

      {/* CORE HERO SECTION: "HÔM NAY RUỘNG CỦA BẠN CẦN CHÚ Ý ĐIỀU GÌ?" */}
      <div className="bg-gradient-to-br from-white via-emerald-50/20 to-stone-50 rounded-2xl border-2 border-emerald-600/30 p-5 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/80 pb-4">
          <div>
            <div className="text-xs font-extrabold text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Quyết định hôm nay cho ruộng của bạn
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-stone-900 mt-1">
              Hôm nay, ruộng của bạn cần chú ý điều gì?
            </h2>
          </div>

          <button
            onClick={onOpenExplanation}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <HelpCircle className="w-4 h-4 text-emerald-300" />
            Vì sao AI khuyên tôi làm việc này?
          </button>
        </div>

        {/* 5-Step Agronomic Chain: Tình trạng → Phân tích → Khuyến nghị → Giải thích → Nhắc kiểm tra */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Situation & Scientific Agronomic Diagnosis */}
          <div className="lg:col-span-7 space-y-4">
            {/* Risk Banner */}
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                brief.riskLevel === 'WARNING' || brief.riskLevel === 'CRITICAL'
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
              }`}
            >
              {brief.riskLevel === 'WARNING' || brief.riskLevel === 'CRITICAL' ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-extrabold text-sm sm:text-base">{brief.headline}</div>
                <p className="text-xs leading-relaxed opacity-90">{brief.situation}</p>
              </div>
            </div>

            {/* In-depth Analysis */}
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-2">
              <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                Phân tích tác động theo đặc tính thửa ruộng
              </div>
              <p className="text-xs sm:text-sm text-stone-700 leading-relaxed font-normal">
                {brief.analysis}
              </p>
              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                <span>Nguồn dữ liệu: <strong>NASA POWER 2005–2025</strong> + Quan sát nông hộ</span>
                <span className="font-semibold text-emerald-700">Độ tin cậy: Cao (92%)</span>
              </div>
            </div>

            {/* Scientific Explanation Summary */}
            <div className="p-4 rounded-xl bg-stone-100/80 border border-stone-200/80 space-y-1.5 text-xs">
              <div className="font-bold text-stone-800 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-emerald-700" />
                Cơ sở nông học:
              </div>
              <p className="text-stone-600 leading-relaxed line-clamp-3">
                {brief.explanation}
              </p>
              <button
                onClick={onOpenExplanation}
                className="text-emerald-700 hover:text-emerald-800 font-semibold text-[11px] underline cursor-pointer"
              >
                Xem chi tiết công thức và 5 nguồn đối chiếu →
              </button>
            </div>
          </div>

          {/* Right: 3 Key Actions & Postpone Warnings */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            {/* Top 3 Actions to Consider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-stone-900">
                <span className="uppercase tracking-wider">3 việc nên cân nhắc thực hiện:</span>
                <span className="text-[11px] text-stone-400">Đánh dấu khi làm</span>
              </div>

              <div className="space-y-2">
                {brief.topActions.map(act => {
                  const isDone = !!completedActions[act.id];
                  return (
                    <div
                      key={act.id}
                      onClick={() => handleActionCheck(act.id, act.title)}
                      className={`p-3 rounded-xl border text-xs transition cursor-pointer flex items-start gap-3 ${
                        isDone
                          ? 'bg-emerald-50 border-emerald-300 text-stone-500 line-through'
                          : 'bg-white border-stone-200 hover:border-emerald-400 shadow-2xs'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-emerald-600 mt-0.5 cursor-pointer accent-emerald-600"
                      />
                      <div className="space-y-1 flex-1">
                        <div className={`font-bold ${isDone ? 'text-stone-500' : 'text-stone-900'}`}>
                          {act.title}
                        </div>
                        <div className="text-[11px] text-stone-500 leading-snug">
                          {act.reason}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono">
                          Kích hoạt: {act.dataBasis}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Things to Postpone */}
            {brief.postponeActions.length > 0 && (
              <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl space-y-1.5 text-xs text-rose-900">
                <div className="font-bold flex items-center gap-1.5 text-rose-800 uppercase tracking-wide text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Những việc nên tạm hoãn
                </div>
                <ul className="list-disc pl-4 space-y-1 text-xs text-rose-800">
                  {brief.postponeActions.map((item, idx) => (
                    <li key={idx} className="leading-snug">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Farmer Instant Feedback Loop */}
        <div className="pt-4 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-stone-600 font-medium flex items-center gap-1.5">
            <span>Bạn thấy gợi ý hôm nay thế nào?</span>
            <span className="text-[11px] text-stone-400">(AI sẽ học và điều chỉnh ngay)</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => handleFeedback('helpful', 'Rất hữu ích')}
              className="px-2.5 py-1.5 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg text-stone-700 font-medium inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
            >
              <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" /> Hữu ích
            </button>
            <button
              onClick={() => handleFeedback('followed', 'Tôi đã làm theo')}
              className="px-2.5 py-1.5 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg text-stone-700 font-medium inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> Tôi đã làm theo
            </button>
            <button
              onClick={() => handleFeedback('soil_still_dry', 'Đất thực tế vẫn khô')}
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-amber-800 font-medium inline-flex items-center gap-1 cursor-pointer transition"
            >
              <Droplets className="w-3.5 h-3.5" /> Đất thực tế vẫn khô
            </button>
            <button
              onClick={() => handleFeedback('soil_too_wet', 'Đất đang quá ẩm/úng')}
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-blue-800 font-medium inline-flex items-center gap-1 cursor-pointer transition"
            >
              <Droplets className="w-3.5 h-3.5" /> Đất đang quá ẩm
            </button>
            <button
              onClick={() => onNavigateTab('feedback')}
              className="px-2.5 py-1.5 text-stone-500 hover:text-stone-800 underline cursor-pointer"
            >
              Thêm phản hồi khác...
            </button>
          </div>
        </div>

        {feedbackSubmitted && (
          <div className="p-3 bg-emerald-100/80 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold animate-in fade-in flex items-center justify-between">
            <span>{feedbackSubmitted}</span>
            <button
              onClick={() => setFeedbackSubmitted(null)}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* THREE INTERACTIVE CARDS: Weather & Indicators + Soil Hydrology + Health Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CARD 1: Weather & Microclimate (Inspired by Image 1 & 3) */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Khí hậu tại ruộng
            </span>
            <span className="text-[11px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
              {weather.source === 'NASA_POWER_UPDATED' ? 'NASA Cập nhật' : 'Quan sát ruộng'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-3xl font-black text-stone-900 tracking-tight">
                {weather.temp}°C
              </div>
              <div className="text-xs text-stone-500 mt-0.5">
                Thấp nhất: {weather.minTemp}°C • Cao nhất: {weather.maxTemp}°C
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shadow-xs">
              <Sun className="w-8 h-8 animate-pulse" />
            </div>
          </div>

          {/* Microclimate 4 indicators */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-stone-100">
            <div className="p-2 bg-stone-50 rounded-xl border border-stone-200/80">
              <div className="text-stone-500 text-[11px] flex items-center gap-1">
                <Droplets className="w-3 h-3 text-blue-500" /> Lượng mưa
              </div>
              <div className="font-bold text-stone-800 text-sm mt-0.5 tabular-nums">{weather.rain} mm</div>
            </div>
            <div className="p-2 bg-stone-50 rounded-xl border border-stone-200/80">
              <div className="text-stone-500 text-[11px] flex items-center gap-1">
                <Wind className="w-3 h-3 text-emerald-500" /> Độ ẩm không khí
              </div>
              <div className="font-bold text-stone-800 text-sm mt-0.5 tabular-nums">{weather.humidity}%</div>
            </div>
            <div className="p-2 bg-stone-50 rounded-xl border border-stone-200/80">
              <div className="text-stone-500 text-[11px] flex items-center gap-1">
                <Sun className="w-3 h-3 text-amber-500" /> Nắng &amp; Bức xạ
              </div>
              <div className="font-bold text-stone-800 text-sm mt-0.5 tabular-nums">{weather.solarRadiation} MJ/m²</div>
            </div>
            <div className="p-2 bg-stone-50 rounded-xl border border-stone-200/80">
              <div className="text-stone-500 text-[11px] flex items-center gap-1">
                <Wind className="w-3 h-3 text-cyan-500" /> Tốc độ gió
              </div>
              <div className="font-bold text-stone-800 text-sm mt-0.5 tabular-nums">{weather.windSpeed} m/s</div>
            </div>
          </div>

          <div className="text-[11px] text-stone-500 flex items-center justify-between">
            <span>Trung bình 21 năm cùng kỳ: <strong>{weather.historicalBaseline.avgTemp}°C</strong></span>
            <button
              onClick={() => onNavigateTab('analytics')}
              className="text-emerald-700 font-semibold hover:underline cursor-pointer"
            >
              Xem biểu đồ →
            </button>
          </div>
        </div>

        {/* CARD 2: Soil Moisture & Root Hydrology */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Độ ẩm đất &amp; Tầng rễ
            </span>
            <span className="text-[11px] text-stone-500">
              Loại: <strong>{getSoilLabel(field.soilType)}</strong>
            </span>
          </div>

          <div className="space-y-3">
            {/* Root moisture meter */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-stone-700">Độ ẩm vùng rễ (0–100 cm):</span>
                <span className="font-bold text-emerald-700 tabular-nums">{(weather.gwetroot * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-stone-200 rounded-full h-3 overflow-hidden p-0.5">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, weather.gwetroot * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                <span>Khô (&lt;30%)</span>
                <span>Tối ưu (50–70%)</span>
                <span>Quá ẩm (&gt;80%)</span>
              </div>
            </div>

            {/* Surface moisture meter */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-stone-700">Độ ẩm tầng mặt (0–5 cm):</span>
                <span className="font-bold text-sky-700 tabular-nums">{(weather.gwettop * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-stone-200 rounded-full h-3 overflow-hidden p-0.5">
                <div
                  className="bg-sky-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, weather.gwettop * 100))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
            <div className="font-semibold text-stone-800">
              Nguồn nước: {getWaterLabel(field.waterSource.type)}
            </div>
            <div className="text-[11px] text-stone-500">
              Trạng thái: {field.waterSource.isStable ? 'Ổn định quanh năm' : 'Biến động theo mùa'} • Cảm quan: {getWaterObsLabel(field.waterSource.observation)}
            </div>
          </div>

          <div className="text-[11px] text-stone-500 flex items-center justify-between">
            <span>Mục tiêu: <strong>{getGoalLabel(field.primaryGoal)}</strong></span>
            <button
              onClick={() => onNavigateTab('tasks')}
              className="text-emerald-700 font-semibold hover:underline cursor-pointer"
            >
              Lịch tưới ruộng →
            </button>
          </div>
        </div>

        {/* CARD 3: Crop Growth & Resilience */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Tình trạng sinh trưởng cây trồng
            </span>
            <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
              Giai đoạn {field.crop.stageIndex + 1}/5
            </span>
          </div>

          {/* Radial / Gauge */}
          <div className="flex items-center justify-center py-2">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#e2e8f0"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={healthScore > 85 ? '#0d9488' : healthScore >= 75 ? '#d97706' : '#dc2626'}
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * healthScore) / 100}
                  strokeLinecap="round"
                  fill="none"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black text-stone-900">{healthScore}%</span>
                <span className="text-[10px] text-stone-500 uppercase font-semibold">
                  {healthScore > 85 ? 'Tốt' : 'Cần chú ý'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-stone-600 space-y-1">
            <div className="font-semibold text-stone-800">{field.crop.name} ({field.crop.variety})</div>
            <div className="text-[11px] text-stone-400">
              Xuống giống ngày: {field.crop.plantingDate} • Phương pháp: {field.crop.farmingMethod}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('assistant')}
            className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Bot className="w-4 h-4" /> Hỏi Trợ lý AI về ruộng này
          </button>
        </div>
      </div>
    </div>
  );
};
