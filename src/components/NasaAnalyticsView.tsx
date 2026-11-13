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
} from 'lucide-react';
import { FieldProfile, WeatherObservation } from '../types';
import { getCellMonthlyProfile, findNearestNasaGrid } from '../data/nasaVietnamGrid';
import { SatelliteMap } from './SatelliteMap';
import { computeHarmonizedIndicators } from '../services/rotationEngine';

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
  const [selectedIndicator, setSelectedIndicator] = useState<
    'T2M' | 'PRECTOTCORR' | 'GWETROOT' | 'ALLSKY_SFC_SW_DWN' | 'RH2M'
  >('T2M');
  const [overlayTheme, setOverlayTheme] = useState<OverlayTheme>('moisture');

  const { cell } = findNearestNasaGrid(field.lat, field.lon);
  const monthlyData = getCellMonthlyProfile(cell);
  const harmonized = computeHarmonizedIndicators(field, weather, {
    rainDeltaPct: 0,
    tempDeltaC: 0,
  });

  const indicatorsMeta = [
    {
      code: 'T2M',
      shortLabel: 'Nhiệt độ',
      name: 'Nhiệt độ không khí (TB, Thấp, Cao)',
      unit: '°C',
      icon: Thermometer,
      color: 'text-red-600',
    },
    {
      code: 'PRECTOTCORR',
      shortLabel: 'Lượng mưa',
      name: 'Lượng mưa trung bình tháng',
      unit: 'mm/tháng',
      icon: Droplets,
      color: 'text-blue-600',
    },
    {
      code: 'GWETROOT',
      shortLabel: 'Ẩm vùng rễ',
      name: 'Độ ẩm đất vùng rễ (0–100 cm)',
      unit: '% độ ẩm',
      icon: Layers,
      color: 'text-emerald-600',
    },
    {
      code: 'RH2M',
      shortLabel: 'Ẩm không khí',
      name: 'Độ ẩm không khí',
      unit: '%',
      icon: Wind,
      color: 'text-purple-600',
    },
    {
      code: 'ALLSKY_SFC_SW_DWN',
      shortLabel: 'Nắng & Bức xạ',
      name: 'Nắng & Bức xạ mặt trời',
      unit: 'MJ/m²/ngày',
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
      title: 'Lớp Độ ẩm đất vùng rễ & Khả năng giữ nước',
      badge: `Ước tính vùng rễ: ${harmonized.rootMoisturePct}%`,
      detail: `Độ ẩm tầng mặt đạt ${harmonized.surfaceMoisturePct}%. Đất ${field.soilType === 'sand' ? 'cát rút nước rất nhanh' : field.soilType === 'clay' ? 'sét giữ ẩm lâu nhưng dễ úng' : 'cân bằng ẩm tương đối ổn định'}.`,
      riskNote:
        harmonized.droughtRiskMonths.length > 0
          ? `Các tháng dễ hụt ẩm: Tháng ${harmonized.droughtRiskMonths.join(', ')}.`
          : 'Độ ẩm duy trì khá đều quanh năm.',
    },
    heat: {
      title: 'Lớp Nắng nóng bề mặt & Tốc độ bốc thoát hơi nước',
      badge: `Áp lực nắng nóng: ${harmonized.heatStressIndex}`,
      detail: `Tốc độ bốc thoát hơi nước hiện khoảng ${harmonized.evapotranspirationMmDay} mm/ngày. Nhiệt độ cao làm mất ẩm mặt ruộng trống rất nhanh.`,
      riskNote:
        harmonized.frostRiskMonths.length > 0
          ? `Tháng cần đề phòng rét hại ban đêm: Tháng ${harmonized.frostRiskMonths.join(', ')}.`
          : 'Ít nguy cơ sương muối nhưng cần tủ gốc vào cao điểm nắng nóng.',
    },
    erosion: {
      title: 'Lớp Nguy cơ xói mòn & Ngập úng cục bộ',
      badge: `Nguy cơ xói mòn: ${harmonized.erosionRisk}`,
      detail: `Tổng mưa trung bình năm ~${Math.round(cell.climatology21Yr.annualRainfallMm)} mm. Ruộng bỏ trống vào tháng mưa lớn rất dễ bị rửa trôi lớp đất màu.`,
      riskNote:
        harmonized.floodRiskMonths.length > 0
          ? `Tháng mưa tập trung lớn: Tháng ${harmonized.floodRiskMonths.join(', ')}.`
          : 'Chưa ghi nhận mùa mưa cực đoan kéo dài.',
    },
    water_trend: {
      title: 'Lớp Xu hướng nguồn nước dài hạn',
      badge: 'Chu kỳ đối chiếu 21 năm',
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
      legendTitle: 'Thang màu Nhiệt độ không khí (°C):',
      swatches: [
        { colorClass: 'bg-amber-300', label: 'Mát / Lạnh (< 22°C)' },
        { colorClass: 'bg-orange-500', label: 'Ấm vừa (22 – 29°C)' },
        { colorClass: 'bg-red-600', label: 'Nắng nóng cao (> 30°C)' },
      ],
    },
    PRECTOTCORR: {
      barClass: 'bg-gradient-to-t from-sky-300 via-blue-500 to-blue-800',
      legendTitle: 'Thang màu Lượng mưa (mm/tháng):',
      swatches: [
        { colorClass: 'bg-sky-300', label: 'Mùa khô / Mưa ít (< 60 mm)' },
        { colorClass: 'bg-blue-500', label: 'Mưa vừa (60 – 200 mm)' },
        { colorClass: 'bg-blue-800', label: 'Mưa lớn / Mùa bão (> 200 mm)' },
      ],
    },
    GWETROOT: {
      barClass: 'bg-gradient-to-t from-lime-400 via-emerald-500 to-teal-700',
      legendTitle: 'Thang màu Độ ẩm đất vùng rễ (%):',
      swatches: [
        { colorClass: 'bg-lime-400', label: 'Đất khô (< 40%)' },
        { colorClass: 'bg-emerald-500', label: 'Đủ ẩm tối ưu (40 – 75%)' },
        { colorClass: 'bg-teal-700', label: 'Rất ẩm / Dễ bão hòa (> 75%)' },
      ],
    },
    RH2M: {
      barClass: 'bg-gradient-to-t from-fuchsia-300 via-purple-500 to-indigo-700',
      legendTitle: 'Thang màu Độ ẩm không khí (%):',
      swatches: [
        { colorClass: 'bg-fuchsia-300', label: 'Hanh khô (< 70%)' },
        { colorClass: 'bg-purple-500', label: 'Dễ chịu (70 – 84%)' },
        { colorClass: 'bg-indigo-700', label: 'Ẩm cao / Lưu ý nấm bệnh (≥ 85%)' },
      ],
    },
    ALLSKY_SFC_SW_DWN: {
      barClass: 'bg-gradient-to-t from-yellow-200 via-yellow-400 to-amber-600',
      legendTitle: 'Thang màu Nắng & Bức xạ mặt trời (MJ/m²/ngày):',
      swatches: [
        { colorClass: 'bg-yellow-200 border border-amber-300', label: 'Nhiều mây / Nắng dịu (< 14)' },
        { colorClass: 'bg-yellow-400', label: 'Nắng tốt quang hợp (14 – 19)' },
        { colorClass: 'bg-amber-600', label: 'Bức xạ gắt / Bốc hơi mạnh (> 19)' },
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
              Chuỗi khí hậu 21 năm (2005–2025)
            </span>
            <span className="text-xs text-stone-500">Vùng {cell.region}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 mt-1">
            Phân tích Khí hậu &amp; Bản đồ Không gian Thửa ruộng
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Điểm khí hậu gần nhất: <strong>{field.nasaGrid.cellId}</strong> ({cell.lat}°B, {cell.lon}°Đ · cách ruộng{' '}
            <strong>{field.nasaGrid.distanceKm} km</strong>)
          </p>
        </div>

        <button
          onClick={onOpenMap}
          className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 self-start md:self-auto"
        >
          <Compass className="w-4 h-4" /> Chỉnh vị trí ruộng trên bản đồ
        </button>
      </div>

      {/* Geospatial Satellite Map + Layer Overlays */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <Satellite className="w-4 h-4 text-emerald-700" /> Ảnh vệ tinh khu vực ruộng {field.name}
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
              Chọn lớp thông tin theo dõi theo thời gian
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'moisture', label: 'Độ ẩm đất vùng rễ' },
                { id: 'heat', label: 'Nắng nóng & Bốc hơi' },
                { id: 'erosion', label: 'Rủi ro xói mòn & Úng' },
                { id: 'water_trend', label: 'Xu hướng nước dài hạn' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOverlayTheme(t.id as OverlayTheme)}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                    overlayTheme === t.id
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {t.label}
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
            <strong>Tổng hợp đồng bộ dữ liệu:</strong> {harmonized.dataFusionSummary}
          </div>
        </div>
      </div>

      {/* 5 Clean Plain-Language Indicator Tabs with Distinct Color Coding */}
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
                Đơn vị: {meta.unit}
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
              Biến động 12 tháng: {currentMeta.name}
            </h2>
            <p className="text-xs text-stone-500">
              Số liệu khí hậu trung bình 21 năm (2005–2025) tại điểm lưới gần thửa ruộng nhất
            </p>
          </div>

          {/* Color Legend Explaining What Each Color Means */}
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

        {/* Cross-Indicator Color Guide */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 bg-stone-50/70 rounded-xl border border-stone-200/70 text-[11px] text-stone-600">
          <span className="font-bold text-stone-800">Phân biệt màu giữa các chỉ số:</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" /> Đỏ cam: Nhiệt độ
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Xanh dương: Lượng mưa
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Xanh lá: Ẩm đất vùng rễ
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" /> Tím: Ẩm không khí
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-amber-400 inline-block" /> Vàng nắng: Nắng &amp; Bức xạ
          </span>
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
                        Thấp nhất: {d.T2M_MIN.toFixed(1)}°C | Cao nhất: {d.T2M_MAX.toFixed(1)}°C
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
              Đặc trưng nhiệt độ
            </span>
            <div className="text-stone-900 font-bold text-sm">
              TB: {cell.climatology21Yr.avgTemp}°C (Biên độ: {cell.climatology21Yr.minTempAnnual}°C –{' '}
              {cell.climatology21Yr.maxTempAnnual}°C)
            </div>
            <p className="text-[11px] text-stone-500">
              Tháng có nguy cơ rét hại:{' '}
              {cell.climatology21Yr.riskMonthsCold.length
                ? `Tháng ${cell.climatology21Yr.riskMonthsCold.join(', ')}`
                : 'Không có'}
            </p>
          </div>

          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
            <span className="text-stone-400 text-[10px] uppercase font-bold block">
              Tổng lượng mưa năm
            </span>
            <div className="text-stone-900 font-bold text-sm">
              {cell.climatology21Yr.annualRainfallMm} mm / năm
            </div>
            <p className="text-[11px] text-stone-500">
              Tháng mưa bão lớn: Tháng {cell.climatology21Yr.riskMonthsFlood.join(', ')}
            </p>
          </div>

          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
            <span className="text-stone-400 text-[10px] uppercase font-bold block">
              Tháng khô hạn cao điểm
            </span>
            <div className="text-stone-900 font-bold text-sm">
              Tháng {cell.climatology21Yr.riskMonthsDrought.join(', ')}
            </div>
            <p className="text-[11px] text-stone-500">
              Độ ẩm vùng rễ trung bình mùa cạn hạ xuống dưới 35%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
