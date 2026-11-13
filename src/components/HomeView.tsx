import React, { useEffect, useState } from 'react';
import {
  Sprout,
  Satellite,
  MapPin,
  Navigation,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  LogIn,
  Loader2,
  CheckCircle2,
  Sparkles,
  Info,
  MessageSquareWarning,
  Send,
  RotateCcw,
} from 'lucide-react';
import { SatelliteMap } from './SatelliteMap';
import { findNearestNasaGrid } from '../data/nasaVietnamGrid';
import { SEED_FAMILIES } from '../data/cropTaxonomy';
import {
  FarmerConstraints,
  FarmerPriorityId,
  FieldProfile,
  RotationStrategy,
  SeedFamilyId,
  WeatherObservation,
} from '../types';
import {
  FARMER_PRIORITIES,
  analyzeBareFieldAndStressTimeline,
  pickBestRotationStrategy,
} from '../services/rotationEngine';
import { GeminiService } from '../services/geminiService';

interface HomeViewProps {
  isAuthenticated: boolean;
  userName?: string;
  onOpenAuthModal: () => void;
  onOpenNewFieldWizard: () => void;
  onNavigateTab: (tab: string) => void;
  weather: WeatherObservation;
}

const REGION_PRESETS = [
  { name: 'Đồng bằng sông Hồng (Hà Nội)', lat: 21.03, lon: 105.85 },
  { name: 'Trung du miền núi (Sơn La)', lat: 21.32, lon: 103.91 },
  { name: 'Duyên hải miền Trung (Nghệ An)', lat: 18.67, lon: 105.68 },
  { name: 'Tây Nguyên (Đắk Lắk)', lat: 12.67, lon: 108.04 },
  { name: 'Đồng bằng sông Cửu Long (An Giang)', lat: 10.37, lon: 105.43 },
];

const QUICK_REJECT_REASONS = [
  'Khó bán / không có đầu ra tại vùng tôi',
  'Đất nhà tôi hay ngập úng, không trồng được',
  'Thiếu công lao động / cần cây ít chăm sóc',
  'Muốn cây làm thức ăn cho trâu bò',
];

export const HomeView: React.FC<HomeViewProps> = ({
  isAuthenticated,
  userName,
  onOpenAuthModal,
  onOpenNewFieldWizard,
  onNavigateTab,
  weather,
}) => {
  const [sandboxLat, setSandboxLat] = useState(21.03);
  const [sandboxLon, setSandboxLon] = useState(105.85);
  const [sandboxFamily, setSandboxFamily] = useState<SeedFamilyId>('poaceae');
  const [sandboxPlantIdx, setSandboxPlantIdx] = useState(0);
  const [sandboxPriorities, setSandboxPriorities] = useState<FarmerPriorityId[]>([
    'water_saving',
    'nitrogen_fixing',
    'pest_break',
  ]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  // Single Best Strategy & Farmer Rejection -> AI Rethink state
  const [customStrategy, setCustomStrategy] = useState<RotationStrategy | null>(null);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [rejectedTitles, setRejectedTitles] = useState<string[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rethinking, setRethinking] = useState(false);
  const [lastFeedbackNote, setLastFeedbackNote] = useState<string | null>(null);

  const { cell, distanceKm } = findNearestNasaGrid(sandboxLat, sandboxLon);
  const selectedFamilyInfo =
    SEED_FAMILIES.find((f) => f.id === sandboxFamily) || SEED_FAMILIES[0];
  const sampleCrop =
    selectedFamilyInfo.plants[sandboxPlantIdx] || selectedFamilyInfo.plants[0];

  const sandboxField: FieldProfile = {
    id: 'HOME_SANDBOX',
    name: 'Ruộng thử nghiệm nhanh',
    province: cell.region,
    district: cell.subRegion,
    lat: sandboxLat,
    lon: sandboxLon,
    areaHa: 1.0,
    soilType: sandboxLat < 11.5 ? 'clay' : sandboxLat < 15 ? 'basalt' : 'loam',
    soilCharacteristics: {
      drainage: sandboxLat < 11.5 ? 'slow' : 'moderate',
      holdsWater: true,
      proneToFlooding: sandboxLat < 11.5,
    },
    waterSource: {
      type: 'river',
      isStable: true,
      observation: 'normal',
      hasTestResult: false,
      salinityRisk: sandboxLat < 10.8,
    },
    crop: {
      seedFamily: sandboxFamily,
      name: sampleCrop.name,
      category: sampleCrop.category,
      variety: sampleCrop.commonVarieties[0] || 'Phổ biến',
      plantingDate: '2026-02-15',
      currentStage: 'Đang sinh trưởng',
      stageIndex: 2,
      farmingMethod: 'Canh tác bền vững',
      irrigationMethod: 'Tưới tiết kiệm',
      healthStatus: 'healthy',
    },
    primaryGoal: 'minimize_risk',
    inspectTime: 'morning',
    notificationMethod: 'in_app',
    nasaGrid: {
      cellId: cell.cellId,
      lat: cell.lat,
      lon: cell.lon,
      distanceKm,
    },
  };

  const sandboxConstraints: FarmerConstraints = {
    waterAvailability: 'seasonal_limited',
    equipmentAccess: 'basic_manual',
    marketPreference: 'mixed_family',
  };

  useEffect(() => {
    setCustomStrategy(null);
    setRejectedIds([]);
    setRejectedTitles([]);
    setRejectOpen(false);
    setRejectReason('');
    setLastFeedbackNote(null);
  }, [sandboxLat, sandboxLon, sandboxFamily, sandboxPlantIdx, sandboxPriorities]);

  const bestStrategy =
    customStrategy ||
    pickBestRotationStrategy(
      sandboxField,
      weather,
      sandboxPriorities,
      sandboxConstraints,
      rejectedIds
    );

  const timeline = analyzeBareFieldAndStressTimeline(sandboxField, {
    rainDeltaPct: 0,
    tempDeltaC: 0,
  });
  const bareMonths = timeline.filter((t) => t.fieldState === 'bare_fallow');

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Trình duyệt hiện tại không hỗ trợ định vị GPS.');
      return;
    }
    setGpsLoading(true);
    setGpsStatus(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSandboxLat(Number(pos.coords.latitude.toFixed(5)));
        setSandboxLon(Number(pos.coords.longitude.toFixed(5)));
        setGpsLoading(false);
        setGpsStatus('Đã định vị theo GPS thiết bị và tự động ghép điểm khí hậu gần nhất.');
      },
      () => {
        setGpsLoading(false);
        setGpsStatus('Không lấy được GPS (hãy cấp quyền vị trí hoặc chạm trực tiếp lên bản đồ).');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const togglePriority = (id: FarmerPriorityId) => {
    setSandboxPriorities((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleRethinkStrategy = async () => {
    const clean = rejectReason.trim();
    if (!clean) return;
    setRethinking(true);
    try {
      const nextExcluded = [...rejectedIds, bestStrategy.id];
      const nextTitles = [...rejectedTitles, bestStrategy.title];
      const { strategy } = await GeminiService.rethinkRotationStrategy({
        field: sandboxField,
        weather,
        rejectedStrategy: bestStrategy,
        rejectionReason: clean,
        excludedIds: rejectedIds,
        previouslyRejectedTitles: nextTitles,
        priorities: sandboxPriorities,
        constraints: sandboxConstraints,
      });
      setRejectedIds(nextExcluded);
      setRejectedTitles(nextTitles);
      setCustomStrategy(strategy);
      setLastFeedbackNote(clean);
      setRejectReason('');
      setRejectOpen(false);
    } finally {
      setRethinking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Compact Top Bar with Account / Quick Actions */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-stone-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-emerald-800/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-emerald-800/70 border border-emerald-500/40 px-3 py-0.5 rounded-full text-[11px] font-semibold text-emerald-200">
            <Satellite className="w-3.5 h-3.5 text-emerald-300" />
            CropCast · Thử nghiệm trực tiếp với dữ liệu quan trắc NASA 21 năm
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Lập kế hoạch luân canh cho ruộng đất
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90">
            Chạm bản đồ hoặc bật GPS, chọn họ hạt giống và mục tiêu — CropCast hỗ trợ lập kế hoạch luân canh, theo dõi độ ẩm đất và tối ưu mùa vụ ngay tại đây.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isAuthenticated ? (
            <>
              <button
                onClick={() => onNavigateTab('fields')}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                Ruộng của {userName || 'tôi'} <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenNewFieldWizard}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer border border-emerald-500/40"
              >
                <MapPin className="w-4 h-4" /> Thêm ruộng mới
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onOpenAuthModal}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <LogIn className="w-4 h-4" /> Đăng nhập / Tạo tài khoản
              </button>
              <button
                onClick={() => onNavigateTab('rotation')}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer border border-white/20"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Mở phân tích 12 tháng
              </button>
            </>
          )}
        </div>
      </div>

      {/* Interactive Testing Workspace RIGHT UP FRONT */}
      <section className="bg-white rounded-3xl border border-stone-200 shadow-xs p-5 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <div className="text-xs font-extrabold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Bàn thử nghiệm nhanh CropCast
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 mt-0.5">
              Chọn vị trí ruộng &amp; họ hạt giống để xem ngay phương án luân canh tốt nhất
            </h2>
          </div>
          <button
            onClick={handleUseGps}
            disabled={gpsLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs transition cursor-pointer shrink-0 self-start sm:self-auto"
          >
            {gpsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4" />
            )}
            {gpsLoading ? 'Đang lấy GPS...' : 'Lấy GPS thiết bị'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Interactive Satellite / Street Map & Region Presets */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {REGION_PRESETS.map((r) => (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => {
                    setSandboxLat(r.lat);
                    setSandboxLon(r.lon);
                  }}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                    Math.abs(sandboxLat - r.lat) < 0.05 && Math.abs(sandboxLon - r.lon) < 0.05
                      ? 'bg-emerald-800 text-white border-emerald-800 font-bold'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>

            <SatelliteMap
              lat={sandboxLat}
              lon={sandboxLon}
              zoom={13}
              heightClass="h-72"
              interactive={true}
              showNasaGrid={true}
              onLocationChange={(lat, lon) => {
                setSandboxLat(lat);
                setSandboxLon(lon);
              }}
              fieldLabel="Vị trí thử nghiệm"
            />

            {gpsStatus && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                {gpsStatus}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-stone-400 text-[11px] block">Điểm khí hậu gần nhất</span>
                <span className="font-bold text-stone-900">{cell.region}</span>
                <span className="text-[11px] text-emerald-700 font-medium block">
                  Cách {distanceKm} km
                </span>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-stone-400 text-[11px] block">Mưa trung bình năm</span>
                <span className="font-bold text-stone-900 font-mono tabular-nums">
                  {cell.climatology21Yr.annualRainfallMm} mm
                </span>
                <span className="text-[11px] text-stone-500 block">
                  TB {cell.climatology21Yr.avgTemp}°C
                </span>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-stone-400 text-[11px] block">Tháng thường để trống</span>
                <span className="font-bold text-amber-700">{bareMonths.length} tháng/năm</span>
                <span className="text-[11px] text-stone-500 block">Cần cây che phủ</span>
              </div>
            </div>
          </div>

          {/* Right: Seed Family FIRST -> Plant -> Priorities -> SINGLE Best Strategy + Rejection Button */}
          <div className="lg:col-span-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-stone-800 block mb-2">
                1. Chọn Họ hạt giống bạn đang trồng trước:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SEED_FAMILIES.map((fam) => (
                  <button
                    key={fam.id}
                    type="button"
                    onClick={() => {
                      setSandboxFamily(fam.id);
                      setSandboxPlantIdx(0);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      sandboxFamily === fam.id
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                        : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <div className="text-xs font-bold leading-snug">{fam.name}</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        sandboxFamily === fam.id ? 'text-emerald-200' : 'text-stone-500'
                      }`}
                    >
                      {fam.shortTag}
                    </div>
                  </button>
                ))}
              </div>

              {/* Plant Selection after Seed Family */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-stone-600 mr-1">Cây cụ thể:</span>
                {selectedFamilyInfo.plants.map((pl, idx) => (
                  <button
                    key={pl.name}
                    type="button"
                    onClick={() => setSandboxPlantIdx(idx)}
                    className={`px-2.5 py-1 rounded-lg border text-xs transition cursor-pointer ${
                      sandboxPlantIdx === idx
                        ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {pl.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-800 block mb-2">
                2. Ưu tiên của gia đình bạn:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {FARMER_PRIORITIES.map((p) => {
                  const active = sandboxPriorities.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePriority(p.id)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                        active
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-bold'
                          : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ONLY ONE Best Rotation Strategy + Farmer Rejection Flow */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800">
                  3. Chiến lược Luân canh Tốt nhất cho {sampleCrop.name} tại {cell.region}:
                </span>
                <button
                  onClick={() => onNavigateTab('rotation')}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer"
                >
                  Xem bảng chi tiết →
                </button>
              </div>

              <div className="p-4 rounded-2xl border-2 border-emerald-600/35 bg-emerald-50/40 space-y-2.5 text-xs">
                {lastFeedbackNote && (
                  <div className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-emerald-200 text-[11px] text-emerald-900">
                    <span>
                      <strong>AI đã chọn lại</strong> theo lý do: <em>"{lastFeedbackNote}"</em>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomStrategy(null);
                        setRejectedIds([]);
                        setRejectedTitles([]);
                        setLastFeedbackNote(null);
                      }}
                      className="text-emerald-700 font-bold inline-flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <RotateCcw className="w-3 h-3" /> Đặt lại
                    </button>
                  </div>
                )}

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-stone-900">{bestStrategy.title}</div>
                    <div className="text-[11px] font-semibold text-emerald-800 mt-0.5">
                      {bestStrategy.sequenceSummary}
                    </div>
                  </div>
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800 shrink-0 tabular-nums">
                    Phù hợp {bestStrategy.suitabilityScore}%
                  </span>
                </div>

                <p className="text-stone-700 leading-relaxed">{bestStrategy.whySuggested}</p>

                {/* Button right below strategy for farmer to say why it doesn't work */}
                {!rejectOpen ? (
                  <button
                    type="button"
                    onClick={() => setRejectOpen(true)}
                    className="w-full py-2 px-3 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquareWarning className="w-3.5 h-3.5" />
                    Phương án này không hợp với ruộng tôi — Nêu lý do để AI chọn lại
                  </button>
                ) : (
                  <div className="bg-white border border-amber-300 rounded-xl p-3 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {QUICK_REJECT_REASONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRejectReason(r)}
                          className={`text-[11px] px-2 py-0.5 rounded border cursor-pointer ${
                            rejectReason === r
                              ? 'bg-amber-500 text-stone-950 border-amber-600 font-bold'
                              : 'bg-stone-50 text-stone-700 border-stone-200'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Nhập lý do phương án này chưa hợp với gia đình..."
                        className="flex-1 px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={handleRethinkStrategy}
                        disabled={!rejectReason.trim() || rethinking}
                        className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {rethinking ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Chọn lại
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-[11px] text-stone-700 flex items-start gap-2">
              <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                <strong>Đăng nhập bằng Tên đăng nhập &amp; Mật khẩu hoặc Google</strong> để lưu riêng các thửa ruộng của gia đình bạn — chỉ mình tài khoản của bạn mới xem và chỉnh sửa được ruộng đã tạo.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Trust / Context Summary */}
      <div className="bg-emerald-950 text-emerald-100 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border border-emerald-800">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
          <span>
            <strong>CropCast</strong> kết hợp dữ liệu vệ tinh &amp; khí hậu 21 năm với kinh nghiệm đồng ruộng địa phương để hỗ trợ quyết định — không thay thế phán đoán của người nông dân và cán bộ khuyến nông.
          </span>
        </div>
        {!isAuthenticated && (
          <button
            onClick={onOpenAuthModal}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs transition cursor-pointer shrink-0 self-start sm:self-auto"
          >
            Đăng ký tài khoản miễn phí
          </button>
        )}
      </div>
    </div>
  );
};
