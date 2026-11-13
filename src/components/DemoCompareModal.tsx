import React, { useState } from 'react';
import {
  X,
  Flame,
  ArrowRight,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Sparkles,
} from 'lucide-react';
import { FieldProfile, WeatherObservation, SoilType } from '../types';
import { analyzeFieldAgronomy, getSoilLabel, getDrainageLabel } from '../services/agronomyEngine';

interface DemoCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoCompareModal: React.FC<DemoCompareModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  // Shared weather event for both fields (e.g. cold rain spell)
  const [sharedWeather, setSharedWeather] = useState<WeatherObservation>({
    temp: 18.5,
    minTemp: 14.8,
    maxTemp: 21.0,
    rain: 26.0,
    humidity: 92,
    gwettop: 0.88,
    gwetroot: 0.81,
    solarRadiation: 9.5,
    windSpeed: 3.2,
    observationDate: 'Sự kiện: Đợt mưa rét mùa đông 26mm, 18.5°C',
    isRealtimeAvailable: true,
    source: 'NASA_POWER_UPDATED',
    historicalBaseline: {
      avgTemp: 22.0,
      avgRain: 8.0,
      avgHumidity: 76,
      avgGwettop: 0.55,
      avgGwetroot: 0.58,
      avgSolar: 14.0,
      sampleYears: 21,
    },
  });

  // Field A Config: Farmer A (Vegetable on Clay Soil, Seedling)
  const [fieldA, setFieldA] = useState<FieldProfile>({
    id: 'DEMO_FIELD_A',
    name: 'Nông dân A: Ruộng rau cải',
    province: 'Hà Nội',
    district: 'Mê Linh',
    lat: 21.18,
    lon: 105.71,
    areaHa: 0.5,
    soilType: 'clay',
    soilCharacteristics: {
      drainage: 'slow',
      holdsWater: true,
      proneToFlooding: true,
      ph: 6.0,
    },
    waterSource: {
      type: 'pond',
      isStable: true,
      observation: 'normal',
      hasTestResult: false,
      salinityRisk: false,
    },
    crop: {
      name: 'Rau cải ngọt',
      category: 'vegetable',
      variety: 'Cải thìa F1',
      plantingDate: '2026-11-05',
      currentStage: 'Cây con (mới gieo 7 ngày)',
      stageIndex: 1,
      farmingMethod: 'VietGAP',
      irrigationMethod: 'Tưới ô doa',
      healthStatus: 'healthy',
    },
    primaryGoal: 'minimize_risk',
    inspectTime: 'morning',
    notificationMethod: 'in_app',
    nasaGrid: { cellId: 'NASA_VN_001', lat: 21.0, lon: 105.5, distanceKm: 29.8 },
  });

  // Field B Config: Farmer B (Maize on Sandy Soil, Rapid Growth)
  const [fieldB, setFieldB] = useState<FieldProfile>({
    id: 'DEMO_FIELD_B',
    name: 'Nông dân B: Ruộng ngô lai',
    province: 'Hưng Yên',
    district: 'Khoái Châu',
    lat: 20.84,
    lon: 105.98,
    areaHa: 1.2,
    soilType: 'sand',
    soilCharacteristics: {
      drainage: 'fast',
      holdsWater: false,
      proneToFlooding: false,
      ph: 6.6,
    },
    waterSource: {
      type: 'well',
      isStable: true,
      observation: 'clear',
      hasTestResult: true,
      salinityRisk: false,
    },
    crop: {
      name: 'Ngô lai F1',
      category: 'maize',
      variety: 'NK7328',
      plantingDate: '2026-10-10',
      currentStage: 'Sinh trưởng mạnh (vươn lóng)',
      stageIndex: 2,
      farmingMethod: 'Hóa học kết hợp hữu cơ',
      irrigationMethod: 'Tưới rãnh',
      healthStatus: 'healthy',
    },
    primaryGoal: 'save_water',
    inspectTime: 'afternoon',
    notificationMethod: 'in_app',
    nasaGrid: { cellId: 'NASA_VN_002', lat: 21.0, lon: 106.0, distanceKm: 18.2 },
  });

  // Weather scenario presets for Space Apps demo
  const [weatherPreset, setWeatherPreset] = useState<'cold_rain' | 'heatwave' | 'mild'>('cold_rain');
  const [changeLog, setChangeLog] = useState<string>('Sẵn sàng thử nghiệm: Cùng chịu đợt mưa 26mm, nhưng đất và cây khác biệt hoàn toàn!');

  const applyWeatherPreset = (preset: 'cold_rain' | 'heatwave' | 'mild') => {
    setWeatherPreset(preset);
    if (preset === 'cold_rain') {
      setSharedWeather({
        ...sharedWeather,
        temp: 18.5,
        minTemp: 14.8,
        maxTemp: 21.0,
        rain: 26.0,
        humidity: 92,
        gwettop: 0.88,
        gwetroot: 0.81,
        solarRadiation: 9.5,
        observationDate: 'Đợt mưa lạnh 26mm, 18.5°C',
      });
      setChangeLog('Đã áp dụng đợt mưa lạnh 26mm, ẩm 92%, nhiệt độ 18.5°C');
    } else if (preset === 'heatwave') {
      setSharedWeather({
        ...sharedWeather,
        temp: 36.2,
        minTemp: 28.0,
        maxTemp: 38.5,
        rain: 0,
        humidity: 58,
        gwettop: 0.22,
        gwetroot: 0.38,
        solarRadiation: 24.5,
        observationDate: 'Đợt nắng nóng gay gắt 38.5°C, bức xạ 24.5 MJ/m²',
      });
      setChangeLog('Đã chuyển sang đợt sốc nhiệt: 38.5°C, bức xạ cực mạnh, không mưa');
    } else {
      setSharedWeather({
        ...sharedWeather,
        temp: 25.0,
        minTemp: 21.0,
        maxTemp: 28.5,
        rain: 3.5,
        humidity: 75,
        gwettop: 0.60,
        gwetroot: 0.65,
        solarRadiation: 17.0,
        observationDate: 'Thời tiết ấm áp ôn hòa 25°C',
      });
      setChangeLog('Đã chuyển sang thời tiết lý tưởng ấm áp 25°C');
    }
  };

  const briefA = analyzeFieldAgronomy(fieldA, sharedWeather);
  const briefB = analyzeFieldAgronomy(fieldB, sharedWeather);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-6xl bg-stone-50 rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-900 via-stone-900 to-emerald-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold shadow-md">
              <Flame className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">Chế độ Trình diễn NASA Space Apps Challenge</h2>
                <span className="text-[10px] bg-amber-400 text-stone-900 font-extrabold px-2 py-0.5 rounded-full uppercase">
                  DEMO Cá nhân hóa
                </span>
              </div>
              <p className="text-xs text-stone-300">
                Minh chứng: Cùng một dữ liệu thời tiết NASA, AI đưa ra khuyến nghị khác biệt hoàn toàn theo hồ sơ ruộng!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Shared Weather Controller */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wide">
                  1. Dữ liệu thời tiết chung tác động lên cả 2 ruộng
                </span>
                <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                  NASA POWER 0.5° Grid
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">Kịch bản thử nghiệm:</span>
                <button
                  onClick={() => applyWeatherPreset('cold_rain')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                    weatherPreset === 'cold_rain'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  🌧️ Mưa Lạnh (26mm, 18.5°C)
                </button>
                <button
                  onClick={() => applyWeatherPreset('heatwave')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                    weatherPreset === 'heatwave'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  🔥 Sốc Nhiệt (38.5°C, Nắng gắt)
                </button>
                <button
                  onClick={() => applyWeatherPreset('mild')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                    weatherPreset === 'mild'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  ⛅ Ôn Hòa (25°C, Nắng nhẹ)
                </button>
              </div>
            </div>

            {/* Current Shared Weather Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 text-center">
                <div className="text-stone-500 text-[10px]">Nhiệt độ</div>
                <div className="font-bold text-stone-800 text-sm">{sharedWeather.temp}°C</div>
                <div className="text-[10px] text-stone-500">Đêm: {sharedWeather.minTemp}°C</div>
              </div>
              <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 text-center">
                <div className="text-stone-500 text-[10px]">Lượng mưa</div>
                <div className="font-bold text-stone-800 text-sm">{sharedWeather.rain} mm</div>
                <div className="text-[10px] text-stone-500">Mưa tích lũy</div>
              </div>
              <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 text-center">
                <div className="text-stone-500 text-[10px]">Độ ẩm không khí</div>
                <div className="font-bold text-stone-800 text-sm">{sharedWeather.humidity}%</div>
                <div className="text-[10px] text-stone-500">Nguy cơ nấm</div>
              </div>
              <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 text-center">
                <div className="text-stone-500 text-[10px]">Ẩm tầng mặt</div>
                <div className="font-bold text-stone-800 text-sm">{(sharedWeather.gwettop * 100).toFixed(0)}%</div>
                <div className="text-[10px] text-stone-500">Lớp 0–5 cm</div>
              </div>
              <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 text-center">
                <div className="text-stone-500 text-[10px]">Ẩm vùng rễ</div>
                <div className="font-bold text-stone-800 text-sm">{(sharedWeather.gwetroot * 100).toFixed(0)}%</div>
                <div className="text-[10px] text-stone-500">Lớp 0–100 cm</div>
              </div>
              <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 text-center">
                <div className="text-stone-500 text-[10px]">Nắng &amp; Bức xạ</div>
                <div className="font-bold text-stone-800 text-sm">{sharedWeather.solarRadiation} MJ/m²</div>
                <div className="text-[10px] text-stone-500">Bốc hơi nước</div>
              </div>
            </div>

            <div className="text-xs text-stone-500 flex items-center gap-1.5 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100">
              <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>{changeLog}</span>
            </div>
          </div>

          {/* Side-by-Side Comparison: Field A vs Field B */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* COLUMN A: Farmer A */}
            <div className="bg-white rounded-2xl border-2 border-emerald-600/40 shadow-sm p-4 sm:p-5 flex flex-col justify-between space-y-4 relative">
              <div className="absolute -top-3 left-4 bg-emerald-800 text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-xs">
                THỬA RUỘNG A (Nông dân A)
              </div>

              {/* Field Profile A */}
              <div className="pt-2 space-y-2 border-b border-stone-100 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-stone-900 text-base">{fieldA.name}</h3>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                    {fieldA.crop.name}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-stone-50 p-2 rounded-lg border border-stone-200">
                    <span className="text-stone-400 block text-[10px]">Loại đất & Thoát nước:</span>
                    <span className="font-bold text-stone-800">{getSoilLabel(fieldA.soilType)}</span>
                    <span className="text-amber-700 text-[11px] block">({getDrainageLabel(fieldA.soilCharacteristics.drainage)})</span>
                  </div>
                  <div className="bg-stone-50 p-2 rounded-lg border border-stone-200">
                    <span className="text-stone-400 block text-[10px]">Giai đoạn sinh trưởng:</span>
                    <span className="font-bold text-stone-800">{fieldA.crop.currentStage}</span>
                    <span className="text-stone-500 text-[11px] block">Rễ non nông 3-5cm</span>
                  </div>
                </div>

                {/* Tweak controls for Field A */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-stone-500">Thử đổi đất:</span>
                  {(['clay', 'sand', 'loam'] as SoilType[]).map(st => (
                    <button
                      key={st}
                      onClick={() => {
                        const newDrainage = st === 'clay' ? 'slow' : st === 'sand' ? 'fast' : 'moderate';
                        setFieldA({
                          ...fieldA,
                          soilType: st,
                          soilCharacteristics: { ...fieldA.soilCharacteristics, drainage: newDrainage },
                        });
                        setChangeLog(`Đã đổi Ruộng A sang đất ${getSoilLabel(st)} (${getDrainageLabel(newDrainage)}). Nhấn Phân tích lại để xem kết quả!`);
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded border transition cursor-pointer ${
                        fieldA.soilType === st
                          ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                          : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
                      }`}
                    >
                      {getSoilLabel(st)}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Recommendations for Field A */}
              <div className="space-y-3 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Khuyến nghị của AI cho Ruộng A
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      briefA.riskLevel === 'WARNING' || briefA.riskLevel === 'CRITICAL'
                        ? 'bg-amber-100 text-amber-800'
                        : briefA.riskLevel === 'CAUTION'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    Mức độ: {briefA.riskLevel === 'WARNING' || briefA.riskLevel === 'CRITICAL' ? 'Cảnh báo' : briefA.riskLevel === 'CAUTION' ? 'Cần chú ý' : 'Ổn định'}
                  </span>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-xl text-xs">
                  <div className="font-bold text-stone-900 mb-1">{briefA.headline}</div>
                  <p className="text-stone-700 leading-relaxed">{briefA.analysis}</p>
                </div>

                {/* Top 3 Actions for A */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-stone-700">3 việc nên làm ngay:</div>
                  {briefA.topActions.map(act => (
                    <div
                      key={act.id}
                      className="p-2.5 rounded-lg border border-stone-200 bg-white shadow-2xs text-xs flex items-start gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-stone-900">{act.title}</div>
                        <div className="text-stone-500 text-[11px] mt-0.5">{act.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Postpone actions */}
                {briefA.postponeActions.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs">
                    <div className="font-bold text-rose-800 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Việc nên tạm hoãn:
                    </div>
                    <ul className="list-disc pl-4 text-[11px] text-rose-700 space-y-0.5 mt-1">
                      {briefA.postponeActions.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN B: Farmer B */}
            <div className="bg-white rounded-2xl border-2 border-blue-600/40 shadow-sm p-4 sm:p-5 flex flex-col justify-between space-y-4 relative">
              <div className="absolute -top-3 left-4 bg-blue-800 text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-xs">
                THỬA RUỘNG B (Nông dân B)
              </div>

              {/* Field Profile B */}
              <div className="pt-2 space-y-2 border-b border-stone-100 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-stone-900 text-base">{fieldB.name}</h3>
                  <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                    {fieldB.crop.name}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-stone-50 p-2 rounded-lg border border-stone-200">
                    <span className="text-stone-400 block text-[10px]">Loại đất & Thoát nước:</span>
                    <span className="font-bold text-stone-800">{getSoilLabel(fieldB.soilType)}</span>
                    <span className="text-blue-700 text-[11px] block">({getDrainageLabel(fieldB.soilCharacteristics.drainage)})</span>
                  </div>
                  <div className="bg-stone-50 p-2 rounded-lg border border-stone-200">
                    <span className="text-stone-400 block text-[10px]">Giai đoạn sinh trưởng:</span>
                    <span className="font-bold text-stone-800">{fieldB.crop.currentStage}</span>
                    <span className="text-stone-500 text-[11px] block">Rễ sâu 25-40cm</span>
                  </div>
                </div>

                {/* Tweak controls for Field B */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-stone-500">Thử đổi giống/cây:</span>
                  {[
                    { name: 'Ngô lai (Bắp)', cat: 'maize', stage: 'Vươn lóng mạnh' },
                    { name: 'Lúa ST25', cat: 'rice', stage: 'Làm đòng trổ bông' },
                  ].map(c => (
                    <button
                      key={c.name}
                      onClick={() => {
                        setFieldB({
                          ...fieldB,
                          crop: {
                            ...fieldB.crop,
                            name: c.name,
                            category: c.cat as any,
                            currentStage: c.stage,
                          },
                        });
                        setChangeLog(`Đã đổi Ruộng B sang ${c.name} (${c.stage}). Nhấn Phân tích lại để thấy sự khác biệt!`);
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded border transition cursor-pointer ${
                        fieldB.crop.name === c.name
                          ? 'bg-blue-700 text-white border-blue-700 font-bold'
                          : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Recommendations for Field B */}
              <div className="space-y-3 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Khuyến nghị của AI cho Ruộng B
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      briefB.riskLevel === 'WARNING' || briefB.riskLevel === 'CRITICAL'
                        ? 'bg-amber-100 text-amber-800'
                        : briefB.riskLevel === 'CAUTION'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    Mức độ: {briefB.riskLevel === 'WARNING' || briefB.riskLevel === 'CRITICAL' ? 'Cảnh báo' : briefB.riskLevel === 'CAUTION' ? 'Cần chú ý' : 'Ổn định'}
                  </span>
                </div>

                <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-xl text-xs">
                  <div className="font-bold text-stone-900 mb-1">{briefB.headline}</div>
                  <p className="text-stone-700 leading-relaxed">{briefB.analysis}</p>
                </div>

                {/* Top 3 Actions for B */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-stone-700">3 việc nên làm ngay:</div>
                  {briefB.topActions.map(act => (
                    <div
                      key={act.id}
                      className="p-2.5 rounded-lg border border-stone-200 bg-white shadow-2xs text-xs flex items-start gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-stone-900">{act.title}</div>
                        <div className="text-stone-500 text-[11px] mt-0.5">{act.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Postpone actions */}
                {briefB.postponeActions.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs">
                    <div className="font-bold text-rose-800 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Việc nên tạm hoãn:
                    </div>
                    <ul className="list-disc pl-4 text-[11px] text-rose-700 space-y-0.5 mt-1">
                      {briefB.postponeActions.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Differentiator Summary Box */}
          <div className="p-4 bg-gradient-to-r from-emerald-900 via-stone-900 to-blue-950 text-white rounded-xl space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-300 text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" /> Kết luận khoa học chứng minh giá trị cá nhân hóa
            </div>
            <p className="text-xs text-stone-200 leading-relaxed">
              Thời tiết đo từ NASA POWER là như nhau (độ phân giải 0.5°), nhưng:
              <br />
              • <strong>Ruộng A (Đất sét, rau con):</strong> AI ưu tiên khơi thông rãnh thoát nước, cảnh báo ngạt rễ và hoãn tưới vì đất giữ nước lâu.
              <br />
              • <strong>Ruộng B (Đất cát, ngô đang lớn):</strong> AI yêu cầu kiểm tra ẩm độ thực tầng rễ vì đất cát thoát nước rất nhanh, không được chủ quan coi trời mưa là đã đủ nước!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-stone-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-stone-500 italic">
            * Dữ liệu mô phỏng thử nghiệm Space Apps, có nhãn DEMO rõ ràng theo tiêu chuẩn.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Đóng bảng so sánh
          </button>
        </div>
      </div>
    </div>
  );
};
