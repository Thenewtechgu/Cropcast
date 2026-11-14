import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Thermometer,
  Droplets,
  Sun,
  Wind,
  Layers,
  Compass,
  Satellite,
  AlertTriangle,
  Clock,
  TrendingUp,
  CheckCircle2,
  RefreshCw,
  Download,
  Loader2,
  Database,
} from 'lucide-react';
import { FieldProfile, WeatherObservation } from '../types';
import {
  getCellMonthlyProfile,
  getCellAnnualSeries2001to2025,
  findNearestNasaGrid,
  getLocalizedRegionName,
} from '../data/nasaVietnamGrid';
import { getPlantDisplayName } from '../data/cropTaxonomy';
import { SatelliteMap } from './SatelliteMap';
import { computeHarmonizedIndicators } from '../services/rotationEngine';
import { assessSoilDrainageFromEarthData, getDrainageLabel } from '../services/agronomyEngine';
import {
  fetchNasaDailyRange2001ToPresent,
  NasaDailyExtractProgress,
  NasaDailyHistoricalRow,
} from '../services/nasaWarehouseService';
import { useLanguage } from '../contexts/LanguageContext';
import { useViewMode } from '../contexts/ViewModeContext';

interface NasaAnalyticsViewProps {
  field: FieldProfile;
  weather: WeatherObservation;
  onOpenMap: () => void;
}

type OverlayTheme = 'moisture' | 'heat' | 'erosion' | 'water_trend';

export const NasaAnalyticsView: React.FC<NasaAnalyticsViewProps> = ({
  field,
  weather,
  onOpenMap,
}) => {
  const { lang, t } = useLanguage();
  const { isSimpleMode, setViewMode } = useViewMode();
  const [selectedIndicator, setSelectedIndicator] = useState<
    'T2M' | 'PRECTOTCORR' | 'GWETROOT' | 'ALLSKY_SFC_SW_DWN' | 'RH2M'
  >('T2M');
  const [overlayTheme, setOverlayTheme] = useState<OverlayTheme>('moisture');
  const [selectedChartMonth, setSelectedChartMonth] = useState<string | null>(null);

  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyProgress, setDailyProgress] = useState<NasaDailyExtractProgress | null>(null);
  const [dailyResult, setDailyResult] = useState<{
    cellId: string;
    actualStartDate: string;
    actualEndDate: string;
    rows: NasaDailyHistoricalRow[];
    liveApiChunks: number;
    fallbackChunks: number;
    fromCache?: boolean;
    cachedAt?: string;
    elapsedMs: number;
  } | null>(null);

  const runDailyFetch = async (forceRefresh = false) => {
    setDailyLoading(true);
    try {
      const res = await fetchNasaDailyRange2001ToPresent(field.lat, field.lon, {
        forceRefresh,
        onProgress: (p) => setDailyProgress(p),
      });
      setDailyResult({
        cellId: res.cellId,
        actualStartDate: res.actualStartDate,
        actualEndDate: res.actualEndDate,
        rows: res.rows,
        liveApiChunks: res.liveApiChunks,
        fallbackChunks: res.fallbackChunks,
        fromCache: res.fromCache,
        cachedAt: res.cachedAt,
        elapsedMs: res.elapsedMs,
      });
    } finally {
      setDailyLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setDailyLoading(true);
    fetchNasaDailyRange2001ToPresent(field.lat, field.lon, {
      onProgress: (p) => {
        if (active) setDailyProgress(p);
      },
    })
      .then((res) => {
        if (!active) return;
        setDailyResult({
          cellId: res.cellId,
          actualStartDate: res.actualStartDate,
          actualEndDate: res.actualEndDate,
          rows: res.rows,
          liveApiChunks: res.liveApiChunks,
          fallbackChunks: res.fallbackChunks,
          fromCache: res.fromCache,
          cachedAt: res.cachedAt,
          elapsedMs: res.elapsedMs,
        });
      })
      .finally(() => {
        if (active) setDailyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [field.id, field.lat, field.lon]);

  const handleExportDailyCsv = () => {
    if (!dailyResult || dailyResult.rows.length === 0) return;
    const header =
      'date,cell_id,t2m_c,t2m_min_c,t2m_max_c,gpm_precip_mm,smap_topsoil_pct,root_moisture_pct,rh2m_pct,solar_mj_m2,prism_dew_c,prism_vpd_max_hpa,source';
    const lines = dailyResult.rows.map((r) =>
      [
        r.date,
        r.cellId,
        r.t2m,
        r.t2mMin,
        r.t2mMax,
        r.gpmPrecipMm,
        r.gwettopPct,
        r.gwetrootPct,
        r.rh2m,
        r.solarMjM2,
        r.prismDewPointC,
        r.prismVpdMaxHpa,
        r.source,
      ].join(',')
    );
    const csv = `\uFEFF${header}\n${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cropcast-nasa-daily-${dailyResult.cellId}-2001-to-present.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const { cell } = findNearestNasaGrid(field.lat, field.lon);
  const monthlyData = getCellMonthlyProfile(cell, lang);
  const annualSeries = getCellAnnualSeries2001to2025(cell);
  const earlyDecade = annualSeries.slice(0, 10);
  const recentDecade = annualSeries.slice(-10);
  const earlyAvgTemp =
    earlyDecade.reduce((sum, pt) => sum + pt.tmeanC, 0) / Math.max(1, earlyDecade.length);
  const recentAvgTemp =
    recentDecade.reduce((sum, pt) => sum + pt.tmeanC, 0) / Math.max(1, recentDecade.length);
  const warmingDeltaC = Number((recentAvgTemp - earlyAvgTemp).toFixed(2));
  const earlyAvgRain =
    earlyDecade.reduce((sum, pt) => sum + pt.pptMm, 0) / Math.max(1, earlyDecade.length);
  const recentAvgRain =
    recentDecade.reduce((sum, pt) => sum + pt.pptMm, 0) / Math.max(1, recentDecade.length);
  const rainShiftPct = Math.round(((recentAvgRain - earlyAvgRain) / Math.max(1, earlyAvgRain)) * 100);

  const harmonized = computeHarmonizedIndicators(
    field,
    weather,
    { rainDeltaPct: 0, tempDeltaC: 0 },
    lang
  );
  const drainageEstimate = assessSoilDrainageFromEarthData(
    weather,
    field.soilType,
    field.adaptiveMemory?.earthMetrics,
    lang
  );
  const dailySummaryStats = dailyResult && dailyResult.rows.length > 0
    ? {
        count: dailyResult.rows.length,
        avgTemp: (
          dailyResult.rows.reduce((s, r) => s + r.t2m, 0) / dailyResult.rows.length
        ).toFixed(1),
        avgRainYr: Math.round(
          (dailyResult.rows.reduce((s, r) => s + r.gpmPrecipMm, 0) / dailyResult.rows.length) * 365.25
        ),
        avgSmapTop: Math.round(
          dailyResult.rows.reduce((s, r) => s + r.gwettopPct, 0) / dailyResult.rows.length
        ),
      }
    : null;

  const indicatorsMeta = [
    {
      code: 'T2M',
      shortLabel: t('Nhiệt độ', 'Temp'),
      name: t('Nhiệt độ không khí (TB, Thấp, Cao)', 'Air Temperature (Avg, Min, Max)'),
      unit: '°C',
      icon: Thermometer,
      color: 'text-red-600',
    },
    {
      code: 'PRECTOTCORR',
      shortLabel: t('Lượng mưa', 'Rainfall'),
      name: t('Lượng mưa trung bình tháng', 'Monthly Average Rainfall'),
      unit: t('mm/tháng', 'mm/mo'),
      icon: Droplets,
      color: 'text-blue-600',
    },
    {
      code: 'GWETROOT',
      shortLabel: t('Ẩm vùng rễ', 'Root Moisture'),
      name: t('Độ ẩm đất vùng rễ (0–100 cm)', 'Root Zone Soil Moisture (0–100 cm)'),
      unit: t('% độ ẩm', '% moisture'),
      icon: Layers,
      color: 'text-emerald-600',
    },
    {
      code: 'RH2M',
      shortLabel: t('Ẩm không khí', 'Humidity'),
      name: t('Độ ẩm không khí', 'Relative Humidity'),
      unit: '%',
      icon: Wind,
      color: 'text-purple-600',
    },
    {
      code: 'ALLSKY_SFC_SW_DWN',
      shortLabel: t('Nắng & Bức xạ', 'Solar'),
      name: t('Nắng & Bức xạ mặt trời', 'Solar Radiation'),
      unit: t('MJ/m²/ngày', 'MJ/m²/day'),
      icon: Sun,
      color: 'text-amber-500',
    },
  ];

  const currentMeta =
    indicatorsMeta.find((i) => i.code === selectedIndicator) || indicatorsMeta[0];

  let maxValue = 1;
  if (selectedIndicator === 'T2M') maxValue = 42;
  else if (selectedIndicator === 'PRECTOTCORR')
    maxValue = Math.max(...monthlyData.map((d) => d.PRECTOTCORR), 350);
  else if (selectedIndicator === 'GWETROOT') maxValue = 100;
  else if (selectedIndicator === 'RH2M') maxValue = 100;
  else if (selectedIndicator === 'ALLSKY_SFC_SW_DWN') maxValue = 25;

  const overlaySummaries: Record<
    OverlayTheme,
    { title: string; badge: string; detail: string; riskNote: string }
  > = {
    moisture: {
      title: t('Lớp Độ ẩm đất vùng rễ & Khả năng giữ nước', 'Root Zone Moisture & Retention'),
      badge: `${t('Ước tính vùng rễ:', 'Root moisture:')} ${harmonized.rootMoisturePct}%`,
      detail: t(
        `Độ ẩm tầng mặt đạt ${harmonized.surfaceMoisturePct}%. Đất ${
          field.soilType === 'sand'
            ? 'cát rút nước rất nhanh'
            : field.soilType === 'clay'
            ? 'sét giữ ẩm lâu nhưng dễ úng'
            : 'cân bằng ẩm tương đối ổn định'
        }.`,
        `Surface moisture is ${harmonized.surfaceMoisturePct}%. ${
          field.soilType === 'sand'
            ? 'Sandy soil drains very quickly.'
            : field.soilType === 'clay'
            ? 'Clay holds moisture well but risks waterlogging.'
            : 'Balanced loam moisture retention.'
        }`
      ),
      riskNote:
        harmonized.droughtRiskMonths.length > 0
          ? t(
              `Các tháng dễ hụt ẩm: Tháng ${harmonized.droughtRiskMonths.join(', ')}.`,
              `Dry deficit months: Month ${harmonized.droughtRiskMonths.join(', ')}.`
            )
          : t('Độ ẩm duy trì khá đều quanh năm.', 'Moisture remains fairly steady year-round.'),
    },
    heat: {
      title: t('Lớp Nắng nóng bề mặt & Tốc độ bốc thoát hơi nước', 'Surface Heat & Evapotranspiration'),
      badge: `${t('Áp lực nắng nóng:', 'Heat stress:')} ${harmonized.heatStressIndex}`,
      detail: t(
        `Tốc độ bốc thoát hơi nước hiện khoảng ${harmonized.evapotranspirationMmDay} mm/ngày. Nhiệt độ cao làm mất ẩm mặt ruộng trống rất nhanh.`,
        `Current ET₀ is ~${harmonized.evapotranspirationMmDay} mm/day. High heat rapidly dries exposed topsoil.`
      ),
      riskNote:
        harmonized.frostRiskMonths.length > 0
          ? t(
              `Tháng cần đề phòng rét hại ban đêm: Tháng ${harmonized.frostRiskMonths.join(', ')}.`,
              `Cold night risk months: Month ${harmonized.frostRiskMonths.join(', ')}.`
            )
          : t(
              'Ít nguy cơ sương muối nhưng cần tủ gốc vào cao điểm nắng nóng.',
              'Low frost risk; mulch recommended during peak heat.'
            ),
    },
    erosion: {
      title: t('Lớp Nguy cơ xói mòn & Ngập úng cục bộ', 'Erosion & Local Flooding Risk'),
      badge: `${t('Nguy cơ xói mòn:', 'Erosion risk:')} ${harmonized.erosionRisk}`,
      detail: t(
        `Tổng mưa trung bình năm ~${Math.round(cell.climatology21Yr.annualRainfallMm)} mm. Ruộng bỏ trống vào tháng mưa lớn rất dễ bị rửa trôi lớp đất màu.`,
        `Mean annual rain ~${Math.round(cell.climatology21Yr.annualRainfallMm)} mm. Bare soil during heavy rain months risks topsoil runoff.`
      ),
      riskNote:
        harmonized.floodRiskMonths.length > 0
          ? t(
              `Tháng mưa tập trung lớn: Tháng ${harmonized.floodRiskMonths.join(', ')}.`,
              `Peak flood months: Month ${harmonized.floodRiskMonths.join(', ')}.`
            )
          : t('Chưa ghi nhận mùa mưa cực đoan kéo dài.', 'No prolonged extreme rainfall months flagged.'),
    },
    water_trend: {
      title: t('Lớp Xu hướng nguồn nước dài hạn', 'Long-Term Water & Reserve Trend'),
      badge: t('Chu kỳ đối chiếu 25 năm (2001–2025)', '25-yr Baseline (2001–2025)'),
      detail: harmonized.longTermWaterTrend,
      riskNote: harmonized.vegetationStressNote,
    },
  };

  const indicatorColorConfig: Record<
    'T2M' | 'PRECTOTCORR' | 'GWETROOT' | 'RH2M' | 'ALLSKY_SFC_SW_DWN',
    {
      barClass: string;
      legendTitle: string;
      swatches: Array<{ colorClass: string; label: string }>;
    }
  > = {
    T2M: {
      barClass: 'bg-gradient-to-t from-amber-300 via-orange-500 to-red-600',
      legendTitle: t('Thang màu Nhiệt độ không khí (°C):', 'Air Temperature Legend (°C):'),
      swatches: [
        { colorClass: 'bg-amber-300', label: t('Mát / Lạnh (< 22°C)', 'Cool (< 22°C)') },
        { colorClass: 'bg-orange-500', label: t('Ấm vừa (22 – 29°C)', 'Warm (22 – 29°C)') },
        { colorClass: 'bg-red-600', label: t('Nắng nóng cao (> 30°C)', 'Hot (> 30°C)') },
      ],
    },
    PRECTOTCORR: {
      barClass: 'bg-gradient-to-t from-sky-300 via-blue-500 to-blue-800',
      legendTitle: t('Thang màu Lượng mưa (mm/tháng):', 'Rainfall Legend (mm/month):'),
      swatches: [
        { colorClass: 'bg-sky-300', label: t('Mùa khô / Mưa ít (< 60 mm)', 'Dry (< 60 mm)') },
        { colorClass: 'bg-blue-500', label: t('Mưa vừa (60 – 200 mm)', 'Moderate (60 – 200 mm)') },
        { colorClass: 'bg-blue-800', label: t('Mưa lớn / Mùa bão (> 200 mm)', 'Heavy (> 200 mm)') },
      ],
    },
    GWETROOT: {
      barClass: 'bg-gradient-to-t from-lime-400 via-emerald-500 to-teal-700',
      legendTitle: t('Thang màu Độ ẩm đất vùng rễ (%):', 'Root Zone Moisture Legend (%):'),
      swatches: [
        { colorClass: 'bg-lime-400', label: t('Đất khô (< 40%)', 'Dry (< 40%)') },
        { colorClass: 'bg-emerald-500', label: t('Đủ ẩm tối ưu (40 – 75%)', 'Optimal (40 – 75%)') },
        { colorClass: 'bg-teal-700', label: t('Rất ẩm / Dễ bão hòa (> 75%)', 'Wet / Saturated (> 75%)') },
      ],
    },
    RH2M: {
      barClass: 'bg-gradient-to-t from-fuchsia-300 via-purple-500 to-indigo-700',
      legendTitle: t('Thang màu Độ ẩm không khí (%):', 'Relative Humidity Legend (%):'),
      swatches: [
        { colorClass: 'bg-fuchsia-300', label: t('Hanh khô (< 70%)', 'Dry (< 70%)') },
        { colorClass: 'bg-purple-500', label: t('Dễ chịu (70 – 84%)', 'Moderate (70 – 84%)') },
        { colorClass: 'bg-indigo-700', label: t('Ẩm cao / Lưu ý nấm bệnh (≥ 85%)', 'Humid / Fungal risk (≥ 85%)') },
      ],
    },
    ALLSKY_SFC_SW_DWN: {
      barClass: 'bg-gradient-to-t from-yellow-200 via-yellow-400 to-amber-600',
      legendTitle: t('Thang màu Nắng & Bức xạ (MJ/m²/ngày):', 'Solar Radiation Legend (MJ/m²/day):'),
      swatches: [
        { colorClass: 'bg-yellow-200 border border-amber-300', label: t('Nhiều mây (< 14)', 'Cloudy (< 14)') },
        { colorClass: 'bg-yellow-400', label: t('Nắng tốt quang hợp (14 – 19)', 'Optimal (14 – 19)') },
        { colorClass: 'bg-amber-600', label: t('Bức xạ gắt (> 19)', 'Intense (> 19)') },
      ],
    },
  };

  const activeOverlay = overlaySummaries[overlayTheme];
  const activeColorTheme = indicatorColorConfig[selectedIndicator];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full">
              {t('Chuỗi khí hậu 2001–2026', '2001–2026 Climatology')}
            </span>
            <span className="text-xs text-stone-500">
              {t('Vùng', 'Region')} {getLocalizedRegionName(cell.region, lang)}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 mt-1">
            {t(
              'Phân tích Khí hậu & Bản đồ Không gian Thửa ruộng',
              'Climate Analytics & Geospatial Field Map'
            )}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            {t('Điểm khí hậu tham chiếu gần nhất:', 'Nearest climate point:')}{' '}
            <strong>
              {cell.lat}°N, {cell.lon}°E
            </strong>{' '}
            · {t('cách ruộng', 'distance')} <strong>{field.nasaGrid.distanceKm} km</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode(isSimpleMode ? 'detailed' : 'simple')}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            {isSimpleMode
              ? t('Mở Biểu đồ Chi tiết NASA', 'Open Detailed NASA Charts')
              : t('Thu gọn (Đơn giản)', 'Simple View')}
          </button>
          <button
            onClick={onOpenMap}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Compass className="w-4 h-4" />{' '}
            {t('Chỉnh vị trí ruộng trên bản đồ', 'Adjust Field on Map')}
          </button>
        </div>
      </div>

      {/* Climate Change Multi-Year Anomaly & NASA Insights Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              {t('Xu hướng Biến đổi Khí hậu Tại Ruộng (2001–2026)', 'Local Climate Change Trend (2001–2026)')}
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900">
              {warmingDeltaC >= 0 ? `+${warmingDeltaC}°C` : `${warmingDeltaC}°C`}
            </span>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            {t(
              `So sánh thập niên gần đây với giai đoạn 2001–2010 tại ${getLocalizedRegionName(cell.region, 'vi')}: nhiệt độ trung bình tăng khoảng ${warmingDeltaC >= 0 ? `+${warmingDeltaC}` : warmingDeltaC}°C và tổng lượng mưa biến động ${rainShiftPct >= 0 ? `+${rainShiftPct}` : rainShiftPct}%. Cần ưu tiên giống chịu nhiệt, tủ gốc giữ ẩm và luân canh cắt sâu bệnh.`,
              `Comparing recent years against 2001–2010 in ${getLocalizedRegionName(cell.region, 'en')}: mean temperature shifted by ${warmingDeltaC >= 0 ? `+${warmingDeltaC}` : warmingDeltaC}°C and annual precipitation shifted by ${rainShiftPct >= 0 ? `+${rainShiftPct}` : rainShiftPct}%. Heat-tolerant varieties and mulching help buffer extremes.`
            )}
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[11px] text-stone-500 block">
                {t('Nhiệt độ TB 2001–2010 → Gần đây', 'Mean Temp 2001–2010 → Recent')}
              </span>
              <span className="font-black text-stone-900 font-mono tabular-nums">
                {earlyAvgTemp.toFixed(1)}°C → {recentAvgTemp.toFixed(1)}°C
              </span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[11px] text-stone-500 block">
                {t('Biến động mưa theo thập niên', 'Decadal Rainfall Shift')}
              </span>
              <span className="font-black text-sky-800 font-mono tabular-nums">
                {Math.round(earlyAvgRain)} → {Math.round(recentAvgRain)} mm/yr ({rainShiftPct >= 0 ? `+${rainShiftPct}%` : `${rainShiftPct}%`})
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
              <Satellite className="w-4 h-4 text-emerald-700" />
              {t('Nguồn Dữ liệu Vệ tinh & Khí hậu Tích hợp', 'Integrated NASA & Earth Telemetry Feed')}
            </h2>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              2001–2026
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {[
              {
                name: 'NASA POWER Daily',
                role: t('Nhiệt độ, bức xạ, gió hằng ngày (2001–2026)', 'Daily meteorology & radiation (2001–2026)'),
              },
              {
                name: 'NASA GPM & SMAP',
                role: t('Mưa vệ tinh & ẩm tầng mặt ước tính thoát nước', 'Satellite rainfall & topsoil drainage check'),
              },
              {
                name: 'PRISM Climate',
                role: t('Điểm sương & sức hút bốc hơi (VPD)', 'Dew point & vapor pressure deficit (VPD)'),
              },
              {
                name: 'OCO-2, GRACE-FO & GHG STAC',
                role: t('Quang hợp, nước ngầm & phát thải khí nhà kính', 'Canopy photosynthesis, groundwater & GHG flux'),
              },
            ].map((src) => (
              <div key={src.name} className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-stone-900">{src.name}</div>
                  <div className="text-[11px] text-stone-500">{src.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Automated Soil Drainage Assessment + Daily 2001–2026 NASA Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Drainage Card */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
              <Droplets className="w-4 h-4 text-sky-600" />
              {t('Đánh giá Thoát nước Đất Tự động (SMAP/GPM)', 'Automated Soil Drainage Check (SMAP/GPM)')}
            </h2>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                drainageEstimate.drainage === 'fast'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : drainageEstimate.drainage === 'slow'
                  ? 'bg-rose-50 text-rose-900 border-rose-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}
            >
              {getDrainageLabel(drainageEstimate.drainage, lang)}
            </span>
          </div>

          <p className="text-xs text-stone-700 leading-relaxed">
            {lang === 'en' ? drainageEstimate.explanationEn : drainageEstimate.explanationVi}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[10px] text-stone-500 block">{t('SMAP tầng mặt', 'SMAP Topsoil')}</span>
              <strong className="font-mono text-stone-900">{drainageEstimate.smapSurfacePct}%</strong>
            </div>
            <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[10px] text-stone-500 block">{t('Ẩm tầng rễ', 'Root Zone')}</span>
              <strong className="font-mono text-stone-900">{drainageEstimate.rootZonePct}%</strong>
            </div>
            <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[10px] text-stone-500 block">{t('Mưa GPM 7 ngày', '7d GPM Rain')}</span>
              <strong className="font-mono text-sky-800">{drainageEstimate.gpmRain7dMm} mm</strong>
            </div>
            <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[10px] text-stone-500 block">{t('Hệ số rút ẩm', 'Drop-off Index')}</span>
              <strong className="font-mono text-emerald-800">{drainageEstimate.dropOffRatio}</strong>
            </div>
          </div>
        </div>

        {/* Continuous Daily NASA Pipeline Card (2001–2026) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-700" />
                {t('Chuỗi Dữ liệu Ngày NASA Liên tục (2001–2026)', 'Continuous NASA Daily Pipeline (2001–2026)')}
              </h2>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {dailyResult?.fromCache
                  ? t(
                      `Đang dùng bộ nhớ đệm cục bộ (IndexedDB) — 0 lượt gọi API mới.`,
                      `Loaded from persistent IndexedDB cache — zero redundant API calls.`
                    )
                  : t(
                      `Trích xuất trực tiếp theo từng ngày từ 01/01/2001 tới hiện tại và lưu vĩnh viễn ngoại tuyến.`,
                      `Daily measurements from 2001-01-01 to present, cached permanently offline.`
                    )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={dailyLoading}
                onClick={() => runDailyFetch(true)}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {dailyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {t('Làm mới NASA', 'Refresh NASA Daily')}
              </button>
              <button
                type="button"
                disabled={!dailyResult || dailyResult.rows.length === 0}
                onClick={handleExportDailyCsv}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {t('Tải CSV 2001–2026', 'Export Daily CSV')}
              </button>
            </div>
          </div>

          {dailyLoading && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1.5">
              <div className="flex items-center justify-between font-semibold">
                <span>{dailyProgress?.statusLabel || t('Đang tải dữ liệu ngày NASA 2001–2026...', 'Fetching NASA daily 2001–2026...')}</span>
                <span className="font-mono">{dailyProgress?.percent ?? 0}%</span>
              </div>
              <div className="w-full h-1.5 bg-emerald-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-700 transition-all"
                  style={{ width: `${dailyProgress?.percent ?? 15}%` }}
                />
              </div>
            </div>
          )}

          {dailySummaryStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 block">{t('Tổng số ngày đã nạp', 'Daily Records')}</span>
                <strong className="font-mono text-stone-900">{dailySummaryStats.count.toLocaleString()}</strong>
              </div>
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 block">{t('Nhiệt độ TB ngày', 'Mean Daily Temp')}</span>
                <strong className="font-mono text-stone-900">{dailySummaryStats.avgTemp}°C</strong>
              </div>
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 block">{t('Mưa GPM TB năm', 'GPM Annual Mean')}</span>
                <strong className="font-mono text-sky-800">{dailySummaryStats.avgRainYr} mm/yr</strong>
              </div>
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 block">{t('SMAP tầng mặt TB', 'Mean SMAP Topsoil')}</span>
                <strong className="font-mono text-emerald-800">{dailySummaryStats.avgSmapTop}%</strong>
              </div>
            </div>
          )}

          {!isSimpleMode && dailyResult && dailyResult.rows.length > 0 && (
            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                  <tr>
                    <th className="px-2.5 py-1.5">{t('Ngày', 'Date')}</th>
                    <th className="px-2.5 py-1.5">T2M (°C)</th>
                    <th className="px-2.5 py-1.5">GPM (mm)</th>
                    <th className="px-2.5 py-1.5">SMAP (%)</th>
                    <th className="px-2.5 py-1.5">VPD Max (hPa)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono">
                  {dailyResult.rows.slice(-6).reverse().map((row) => (
                    <tr key={row.date} className="hover:bg-stone-50">
                      <td className="px-2.5 py-1.5 text-stone-800 font-semibold">{row.date}</td>
                      <td className="px-2.5 py-1.5">{row.t2m.toFixed(1)}</td>
                      <td className="px-2.5 py-1.5 text-sky-800">{row.gpmPrecipMm.toFixed(1)}</td>
                      <td className="px-2.5 py-1.5 text-emerald-800">{row.gwettopPct.toFixed(1)}%</td>
                      <td className="px-2.5 py-1.5 text-amber-800">{row.prismVpdMaxHpa.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Geospatial Satellite Map + Layer Overlays */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <Satellite className="w-4 h-4 text-emerald-700" />{' '}
              {t(`Ảnh vệ tinh khu vực ruộng ${field.name}`, `Satellite view: ${field.name}`)}
            </span>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
              {activeOverlay.badge}
            </span>
          </div>
          <SatelliteMap
            lat={field.lat}
            lon={field.lon}
            zoom={13}
            heightClass="h-72"
            interactive={true}
            showNasaGrid={true}
            fieldLabel={field.name}
          />
        </div>

        <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="text-xs font-bold text-stone-800 uppercase tracking-wider">
              {t('Chọn lớp thông tin theo dõi theo thời gian', 'Select Thematic Layer')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: 'moisture', label: t('Độ ẩm đất vùng rễ', 'Root Soil Moisture') },
                { id: 'heat', label: t('Nắng nóng & Bốc hơi', 'Heat & Evapotranspiration') },
                { id: 'erosion', label: t('Rủi ro xói mòn & Úng', 'Erosion & Flood Risk') },
                { id: 'water_trend', label: t('Xu hướng nước dài hạn', 'Long-Term Water Trend') },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOverlayTheme(item.id as OverlayTheme)}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                    overlayTheme === item.id
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 text-xs">
              <div className="font-bold text-emerald-950">{activeOverlay.title}</div>
              <p className="text-stone-700 leading-relaxed">{activeOverlay.detail}</p>
              <p className="text-amber-800 font-medium flex items-center gap-1 pt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {activeOverlay.riskNote}
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 leading-relaxed">
            <strong>{t('Tổng hợp đồng bộ dữ liệu:', 'Data fusion summary:')}</strong>{' '}
            {harmonized.dataFusionSummary}
          </div>
        </div>
      </div>

      {/* Historical Climate & Crop Yield Summary (Detailed Mode) */}
      {!isSimpleMode && (
      <>
      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700" />
              {t(
                'Chuỗi khí hậu & Năng suất cây trồng (2001–2026)',
                'Historical Climate & Crop Yield Record (2001–2026)'
              )}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {t(
                `Chỉ số khí hậu thực tế và năng suất tham chiếu cho ruộng ${field.name} (${getPlantDisplayName(field.crop.name, 'vi')}).`,
                `Historical metrics and yield baseline tailored for ${field.name} (${getPlantDisplayName(field.crop.name, 'en')}).`
              )}
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 self-start sm:self-auto">
            2001–2026 ({annualSeries.length} {t('năm', 'yrs')})
          </span>
        </div>

        {/* Key 26-year numerical indicators + practical field impact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
            <span className="text-[11px] font-semibold text-stone-500 block">
              {t('Điểm sương TB (26 năm)', 'Mean Dew Point (26-yr)')}
            </span>
            <div className="text-lg font-black text-stone-900 font-mono tabular-nums">
              {cell.climatology21Yr.avgDewPointC ?? 20.5}°C
            </div>
            <p className="text-[11px] text-stone-600 leading-snug">
              {t(
                'Điểm sương cao (>21°C) báo hiệu sương đêm dày, dễ phát sinh nấm lá trên ruộng.',
                'High dew point (>21°C) means heavy night dew and higher leaf disease pressure.'
              )}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1">
            <span className="text-[11px] font-semibold text-amber-900 block">
              {t('Sức hút bốc hơi (VPD)', 'Vapor Pressure Deficit')}
            </span>
            <div className="text-lg font-black text-amber-950 font-mono tabular-nums">
              {cell.climatology21Yr.avgVpdMinHpa ?? 3.8} – {cell.climatology21Yr.avgVpdMaxHpa ?? 16.4} hPa
            </div>
            <p className="text-[11px] text-stone-600 leading-snug">
              {t(
                'VPD >15 hPa khiến lá thoát hơi nhanh; cần phủ rơm hoặc tưới sáng sớm để giữ sức cây.',
                'VPD >15 hPa accelerates crop water loss; irrigate early morning or mulch beds.'
              )}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
            <span className="text-[11px] font-semibold text-emerald-900 block">
              {t('Năng suất TB 26 năm', '26-Year Baseline Yield')}
            </span>
            <div className="text-lg font-black text-emerald-950 font-mono tabular-nums">
              {cell.climatology21Yr.avgRiceYieldTonHa ?? 5.6} {t('tấn/ha', 't/ha')}
            </div>
            <p className="text-[11px] text-stone-600 leading-snug">
              {t(
                'Mốc năng suất tham chiếu giúp đánh giá ảnh hưởng của hạn hoặc mưa cực đoan theo từng năm.',
                'Regional yield benchmark reflecting annual temperature and rainfall swings.'
              )}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200 space-y-1">
            <span className="text-[11px] font-semibold text-sky-900 block">
              {t('Hiện tại vs Nền 26 năm', 'Today vs. 26-Yr Avg')}
            </span>
            <div className="text-lg font-black text-sky-950 font-mono tabular-nums">
              {weather.temp}°C / {cell.climatology21Yr.avgTemp}°C
            </div>
            <p className="text-[11px] text-stone-600 leading-snug">
              {weather.temp - cell.climatology21Yr.avgTemp >= 2
                ? t(
                    'Đang ấm hơn trung bình nhiều năm — chú ý bổ sung ẩm độ vùng rễ.',
                    'Warmer than 26-yr norm — monitor root-zone moisture closely.'
                  )
                : t(
                    'Nhiệt độ sát mức trung bình 26 năm, thuận lợi cho sinh trưởng ổn định.',
                    'Near the 26-yr norm, supporting steady crop development.'
                  )}
            </p>
          </div>
        </div>

        {/* Compact 2001-2026 Annual Trend Strip */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-[11px] text-stone-500 mb-2">
            <span className="font-semibold text-stone-700">
              {t('Biến động nhiệt độ TB & Năng suất từng năm (2001–2026)', 'Annual Mean Temp & Yield Index (2001–2026)')}
            </span>
            <span>{t('Rê chuột vào từng năm để xem số liệu', 'Hover each year for exact metrics')}</span>
          </div>
          <div className="overflow-x-auto pb-1">
            <div
              className="min-w-[620px] grid gap-1 h-24 items-end border-b border-stone-200 pb-1"
              style={{ gridTemplateColumns: `repeat(${Math.max(1, annualSeries.length)}, minmax(0, 1fr))` }}
            >
              {annualSeries.map((pt) => {
                const hPct = Math.min(100, Math.max(20, Math.round((pt.yieldIndexPct / 120) * 100)));
                return (
                  <div key={pt.year} className="flex flex-col items-center h-full justify-end group relative">
                    <div className="hidden group-hover:block absolute bottom-full mb-1 z-20 bg-stone-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-md pointer-events-none">
                      <strong>{pt.year}</strong>: {pt.tmeanC}°C · {pt.pptMm}mm · VPD {pt.vpdMaxHpa} hPa · {pt.riceYieldTonHa} {t('tấn/ha', 't/ha')}
                    </div>
                    <div
                      className={`w-full rounded-t-xs transition-all ${
                        pt.yieldIndexPct >= 100 ? 'bg-emerald-600' : pt.yieldIndexPct >= 92 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ height: `${hPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="min-w-[620px] flex justify-between text-[10px] text-stone-400 font-mono mt-1">
              <span>2001</span>
              <span>2007</span>
              <span>2013</span>
              <span>2019</span>
              <span>{annualSeries[annualSeries.length - 1]?.year ?? 2026}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Indicator Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {indicatorsMeta.map((meta) => {
          const Icon = meta.icon;
          const isSelected = selectedIndicator === meta.code;
          const tabColorMap: Record<string, string> = {
            T2M: 'bg-red-700 border-red-700',
            PRECTOTCORR: 'bg-blue-700 border-blue-700',
            GWETROOT: 'bg-emerald-800 border-emerald-800',
            RH2M: 'bg-purple-700 border-purple-700',
            ALLSKY_SFC_SW_DWN: 'bg-amber-600 border-amber-600',
          };
          return (
            <button
              key={meta.code}
              onClick={() => setSelectedIndicator(meta.code as any)}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? `${tabColorMap[meta.code]} text-white shadow-md`
                  : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[11px] font-bold opacity-90">{meta.shortLabel}</span>
                <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : meta.color}`} />
              </div>
              <div className="font-bold text-xs truncate">{meta.name}</div>
              <div
                className={`text-[10px] mt-0.5 ${
                  isSelected ? 'text-white/85' : 'text-stone-400'
                }`}
              >
                {t('Đơn vị:', 'Unit:')} {meta.unit}
              </div>
            </button>
          );
        })}
      </div>

      {/* Monthly Climatology Chart */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-700" />
              {t('Biến động 12 tháng:', '12-Month Climatology:')} {currentMeta.name}
            </h2>
            <p className="text-xs text-stone-500">
              {t(
                'Số liệu khí hậu trung bình 26 năm (2001–2026) tại điểm lưới gần thửa ruộng nhất',
                '26-year mean climate series (2001–2026) at the nearest climate grid point'
              )}
            </p>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs space-y-1.5">
            <div className="font-bold text-stone-800">{activeColorTheme.legendTitle}</div>
            <div className="flex flex-wrap items-center gap-3">
              {activeColorTheme.swatches.map((sw) => (
                <span key={sw.label} className="inline-flex items-center gap-1.5 text-[11px] text-stone-700 font-medium">
                  <span className={`w-3 h-3 rounded-xs inline-block shrink-0 ${sw.colorClass}`} />
                  {sw.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2 space-y-3">
          {selectedChartMonth && (() => {
            const activeItem = monthlyData.find((item) => item.month === selectedChartMonth);
            if (!activeItem) return null;
            let activeVal = 0;
            if (selectedIndicator === 'T2M') activeVal = Number(activeItem.T2M.toFixed(1));
            else if (selectedIndicator === 'PRECTOTCORR') activeVal = Math.round(activeItem.PRECTOTCORR);
            else if (selectedIndicator === 'GWETROOT')
              activeVal = Math.min(98, Math.max(12, Math.round(activeItem.GWETROOT * 100)));
            else if (selectedIndicator === 'RH2M') activeVal = activeItem.RH2M;
            else if (selectedIndicator === 'ALLSKY_SFC_SW_DWN') activeVal = activeItem.ALLSKY_SFC_SW_DWN;
            return (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950">
                <div>
                  <strong>{activeItem.month}:</strong>{' '}
                  <span className="font-mono font-bold">
                    {activeVal} {currentMeta.unit}
                  </span>
                  {selectedIndicator === 'T2M' && (
                    <span className="text-stone-600 ml-2">
                      ({t('Thấp nhất:', 'Min:')} {activeItem.T2M_MIN.toFixed(1)}°C |{' '}
                      {t('Cao nhất:', 'Max:')} {activeItem.T2M_MAX.toFixed(1)}°C)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedChartMonth(null)}
                  className="text-[11px] font-bold text-emerald-800 hover:underline cursor-pointer"
                >
                  {t('Đóng', 'Clear')}
                </button>
              </div>
            );
          })()}

          <div className="overflow-x-auto pb-2">
            <div className="min-w-[520px] grid grid-cols-12 gap-2 sm:gap-3 h-64 items-end pb-2 border-b border-stone-200 pt-10">
              {monthlyData.map((d) => {
                let val = 0;
                if (selectedIndicator === 'T2M') val = Number(d.T2M.toFixed(1));
                else if (selectedIndicator === 'PRECTOTCORR') val = Math.round(d.PRECTOTCORR);
                else if (selectedIndicator === 'GWETROOT')
                  val = Math.min(98, Math.max(12, Math.round(d.GWETROOT * 100)));
                else if (selectedIndicator === 'RH2M') val = d.RH2M;
                else if (selectedIndicator === 'ALLSKY_SFC_SW_DWN') val = d.ALLSKY_SFC_SW_DWN;

                const heightPct = Math.min(100, Math.max(8, (val / maxValue) * 100));
                const isBarSelected = selectedChartMonth === d.month;

                return (
                  <button
                    key={d.month}
                    type="button"
                    onClick={() =>
                      setSelectedChartMonth((prev) => (prev === d.month ? null : d.month))
                    }
                    className={`flex flex-col items-center h-full justify-end group relative cursor-pointer focus:outline-none ${
                      isBarSelected ? 'ring-2 ring-emerald-600/40 rounded-lg' : ''
                    }`}
                  >
                    <div
                      className={`absolute -top-10 transition-opacity bg-stone-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-20 pointer-events-none shadow-md ${
                        isBarSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {d.month}: <strong>{val}</strong> {currentMeta.unit}
                      {selectedIndicator === 'T2M' && (
                        <div className="text-[9px] text-stone-300">
                          {t('Thấp nhất:', 'Min:')} {d.T2M_MIN.toFixed(1)}°C | {t('Cao nhất:', 'Max:')}{' '}
                          {d.T2M_MAX.toFixed(1)}°C
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] font-bold text-stone-700 mb-1 opacity-80 group-hover:opacity-100 tabular-nums">
                      {val}
                    </span>

                    <div className="w-full max-w-[36px] bg-stone-100 rounded-t-lg relative flex items-end justify-center overflow-hidden h-full">
                      <div
                        className={`w-full ${activeColorTheme.barClass} rounded-t-lg transition-all duration-500`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>

                    <span className="text-[11px] font-bold text-stone-700 mt-2">{d.month}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 21-Year Climate Statistical Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
            <span className="text-stone-400 text-[10px] uppercase font-bold block">
              {t('Đặc trưng nhiệt độ', 'Temperature Profile')}
            </span>
            <div className="text-stone-900 font-bold text-sm">
              {t('TB:', 'Avg:')} {cell.climatology21Yr.avgTemp}°C ({cell.climatology21Yr.minTempAnnual}°C –{' '}
              {cell.climatology21Yr.maxTempAnnual}°C)
            </div>
            <p className="text-[11px] text-stone-500">
              {t('Tháng có nguy cơ rét hại:', 'Cold risk months:')}{' '}
              {cell.climatology21Yr.riskMonthsCold.length
                ? `${t('Tháng', 'M')} ${cell.climatology21Yr.riskMonthsCold.join(', ')}`
                : t('Không có', 'None')}
            </p>
          </div>

          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
            <span className="text-stone-400 text-[10px] uppercase font-bold block">
              {t('Tổng lượng mưa năm', 'Annual Precipitation')}
            </span>
            <div className="text-stone-900 font-bold text-sm">
              {cell.climatology21Yr.annualRainfallMm} {t('mm / năm', 'mm / yr')}
            </div>
            <p className="text-[11px] text-stone-500">
              {t('Tháng mưa bão lớn:', 'Peak rain months:')}{' '}
              {t('Tháng', 'M')} {cell.climatology21Yr.riskMonthsFlood.join(', ')}
            </p>
          </div>

          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
            <span className="text-stone-400 text-[10px] uppercase font-bold block">
              {t('Tháng khô hạn cao điểm', 'Peak Dry Months')}
            </span>
            <div className="text-stone-900 font-bold text-sm">
              {t('Tháng', 'Month')} {cell.climatology21Yr.riskMonthsDrought.join(', ')}
            </div>
            <p className="text-[11px] text-stone-500">
              {t(
                'Độ ẩm vùng rễ trung bình mùa cạn hạ xuống dưới 35%',
                'Dry-season root zone moisture drops below 35%'
              )}
            </p>
          </div>
        </div>
      </div>
      </>
      )}

      {/* NASA Space Apps Challenge & AI Transparency Attribution */}
      <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 text-[11px] text-stone-600 leading-relaxed space-y-1">
        <div className="font-bold text-stone-800">
          {t('Ghi nhận Nguồn dữ liệu Vệ tinh & Trợ lý AI (NASA Space Apps Challenge)', 'Satellite Data & AI Transparency Disclosure (NASA Space Apps Challenge)')}
        </div>
        <p>
          {t(
            'Các chỉ số khí hậu ngày (2001–2026) và đánh giá đất-nước được tổng hợp từ NASA POWER, NASA SMAP, NASA GPM, PRISM Climate, OCO-2/3, GRACE-FO và GHG Center STAC kết hợp dự báo thời tiết Open-Meteo. Các phân tích tổng hợp và gợi ý luân canh có sự hỗ trợ của AI nhằm phục vụ tham khảo nông học tại thực địa.',
            'Daily 2001–2026 climate records and field water diagnostics integrate NASA POWER, NASA SMAP, NASA GPM, PRISM Climate, OCO-2/3, GRACE-FO, and GHG Center STAC alongside Open-Meteo forecasts. Rotation recommendations and agronomic summaries are AI-assisted for practical farm decision support.'
          )}
        </p>
      </div>
    </div>
  );
};
