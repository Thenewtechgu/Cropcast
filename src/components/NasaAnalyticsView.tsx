import React, { useState } from 'react';
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
} from 'lucide-react';
import { FieldProfile, WeatherObservation } from '../types';
import { getCellMonthlyProfile, findNearestNasaGrid } from '../data/nasaVietnamGrid';
import { SatelliteMap } from './SatelliteMap';
import { computeHarmonizedIndicators } from '../services/rotationEngine';
import { useLanguage } from '../contexts/LanguageContext';

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
  const [selectedIndicator, setSelectedIndicator] = useState<
    'T2M' | 'PRECTOTCORR' | 'GWETROOT' | 'ALLSKY_SFC_SW_DWN' | 'RH2M'
  >('T2M');
  const [overlayTheme, setOverlayTheme] = useState<OverlayTheme>('moisture');

  const { cell } = findNearestNasaGrid(field.lat, field.lon);
  const monthlyData = getCellMonthlyProfile(cell);
  const harmonized = computeHarmonizedIndicators(
    field,
    weather,
    { rainDeltaPct: 0, tempDeltaC: 0 },
    lang
  );

  const earth = field.adaptiveMemory?.earthMetrics;
  const formatTimestamp = (iso?: string) => {
    if (!iso) return t('Chưa đồng bộ (nhấn Đồng bộ ở Tổng quan)', 'Not synced yet');
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
      title: t('Lớp Xu hướng nguồn nước dài hạn', 'Long-Term Water & GRACE Trend'),
      badge: t('Chu kỳ đối chiếu 21 năm + GRACE', '21-yr Baseline + GRACE'),
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
              {t('Chuỗi khí hậu 21 năm (2005–2025)', '21-Year Climatology (2005–2025)')}
            </span>
            <span className="text-xs text-stone-500">
              {t('Vùng', 'Region')} {cell.region}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 mt-1">
            {t(
              'Phân tích Khí hậu & Bản đồ Không gian Thửa ruộng',
              'Climate Analytics & Geospatial Field Map'
            )}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            {t('Điểm khí hậu gần nhất:', 'Nearest NASA grid:')} <strong>{field.nasaGrid.cellId}</strong> (
            {cell.lat}°N, {cell.lon}°E · {t('cách ruộng', 'distance')}{' '}
            <strong>{field.nasaGrid.distanceKm} km</strong>)
          </p>
        </div>

        <button
          onClick={onOpenMap}
          className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 self-start md:self-auto"
        >
          <Compass className="w-4 h-4" />{' '}
          {t('Chỉnh vị trí ruộng trên bản đồ', 'Adjust Field on Map')}
        </button>
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
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'moisture', label: t('Độ ẩm đất vùng rễ', 'Root Soil Moisture') },
                { id: 'heat', label: t('Nắng nóng & Bốc hơi', 'Heat & Evapotranspiration') },
                { id: 'erosion', label: t('Rủi ro xói mòn & Úng', 'Erosion & Flood Risk') },
                { id: 'water_trend', label: t('Xu hướng nước dài hạn', 'Water & GRACE Trend') },
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

      {/* Data Source Last Updated Column Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-700" />
            {t('Nguồn dữ liệu NASA & Lần cuối cập nhật', 'NASA Data Sources & Last Updated')}
          </h2>
          <span className="text-[11px] text-stone-500">NASA Space Apps 2026</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-[11px] text-stone-500 border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">{t('Nguồn dữ liệu', 'Data Source')}</th>
                <th className="py-2.5 px-4 font-semibold">{t('Phạm vi chỉ số', 'Coverage')}</th>
                <th className="py-2.5 px-4 font-semibold">{t('Lần cuối cập nhật', 'Last updated')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <tr>
                <td className="py-2.5 px-4 font-semibold text-stone-800">NASA POWER (Ag)</td>
                <td className="py-2.5 px-4 text-stone-600">
                  {t('Nhiệt độ, Mưa, Ẩm đất, Bức xạ (21 năm)', 'Temp, Rain, Root/Surface Moisture, Solar')}
                </td>
                <td className="py-2.5 px-4 font-mono text-stone-700">
                  {formatTimestamp(earth?.nasaPowerLastUpdated || weather.observationDate)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-stone-800">NASA OCO-2 / OCO-3</td>
                <td className="py-2.5 px-4 text-stone-600">
                  {earth
                    ? `SIF ${earth.carbonFluxOco2.sifWm2SrUm} · ${earth.carbonFluxOco2.carbonUptakeTonHaYr} ${t('tấn CO₂/ha', 't CO₂/ha')}`
                    : t('Quang hợp SIF & Hấp thụ Carbon', 'SIF Photosynthesis & Carbon Uptake')}
                </td>
                <td className="py-2.5 px-4 font-mono text-stone-700">
                  {formatTimestamp(earth?.carbonFluxOco2.lastUpdated)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-stone-800">NASA GRACE / GRACE-FO</td>
                <td className="py-2.5 px-4 text-stone-600">
                  {earth
                    ? `${earth.groundwaterAnomalyGrace.lweThicknessCm} cm LWE`
                    : t('Biến động trữ lượng nước ngầm', 'Groundwater Storage Anomaly')}
                </td>
                <td className="py-2.5 px-4 font-mono text-stone-700">
                  {formatTimestamp(earth?.groundwaterAnomalyGrace.lastUpdated)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-stone-800">GHGx / EDGAR</td>
                <td className="py-2.5 px-4 text-stone-600">
                  {earth
                    ? `${earth.greenhouseGasEdgar.co2eqTonHa} ${t('tấn CO₂e/ha', 't CO₂e/ha')}`
                    : t('Phát thải CH₄ & N₂O nông nghiệp', 'Agricultural CH₄ & N₂O Flux')}
                </td>
                <td className="py-2.5 px-4 font-mono text-stone-700">
                  {formatTimestamp(earth?.greenhouseGasEdgar.lastUpdated)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-stone-800">NASA SMAP · MODIS · GPM</td>
                <td className="py-2.5 px-4 text-stone-600">
                  {earth?.smapModis
                    ? `${t('Ẩm mặt', 'SMAP')} ${earth.smapModis.smapSoilMoisturePct}% · NDVI ${earth.smapModis.modisNdvi} · GPM ${earth.smapModis.gpmPrecipitation7dMm}mm`
                    : t('Độ ẩm lớp mặt, NDVI tán lá & Mưa 7 ngày', 'Surface Moisture, Canopy NDVI & 7-day GPM Rain')}
                </td>
                <td className="py-2.5 px-4 font-mono text-stone-700">
                  {formatTimestamp(earth?.smapModis?.lastUpdated)}
                </td>
              </tr>
            </tbody>
          </table>
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
                'Số liệu khí hậu trung bình 21 năm (2005–2025) tại điểm lưới gần thửa ruộng nhất',
                '21-year mean climate series (2005–2025) at the nearest NASA grid point'
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

        <div className="pt-2">
          <div className="grid grid-cols-12 gap-1.5 sm:gap-3 h-64 items-end pb-2 border-b border-stone-200">
            {monthlyData.map((d) => {
              let val = 0;
              if (selectedIndicator === 'T2M') val = Number(d.T2M.toFixed(1));
              else if (selectedIndicator === 'PRECTOTCORR') val = Math.round(d.PRECTOTCORR);
              else if (selectedIndicator === 'GWETROOT')
                val = Math.min(98, Math.max(12, Math.round(d.GWETROOT * 100)));
              else if (selectedIndicator === 'RH2M') val = d.RH2M;
              else if (selectedIndicator === 'ALLSKY_SFC_SW_DWN') val = d.ALLSKY_SFC_SW_DWN;

              const heightPct = Math.min(100, Math.max(8, (val / maxValue) * 100));

              return (
                <div
                  key={d.month}
                  className="flex flex-col items-center h-full justify-end group relative"
                >
                  <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-20 pointer-events-none shadow-md">
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
                </div>
              );
            })}
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
    </div>
  );
};
