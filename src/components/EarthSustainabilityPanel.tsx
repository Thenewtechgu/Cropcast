import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Leaf,
  Droplets,
  Cloud,
  Clock,
} from 'lucide-react';
import type { EarthEnvironmentSnapshot, FieldProfile, TrendPoint } from '../types';
import { fetchFieldEarthMetrics, syncFieldEarthMetrics } from '../services/earthSyncService';
import { useLanguage } from '../contexts/LanguageContext';

interface EarthSustainabilityPanelProps {
  field: FieldProfile;
  weatherObservationDate?: string;
  onSaveToField?: (snapshot: EarthEnvironmentSnapshot) => Promise<void> | void;
  onNavigateRotation?: () => void;
}

const MiniTrendBars: React.FC<{
  series: TrendPoint[];
  barColor: string;
  unit: string;
}> = ({ series, barColor, unit }) => {
  if (!series || series.length === 0) return null;
  const maxAbs = Math.max(...series.map((p) => Math.abs(p.value)), 0.1);
  return (
    <div className="pt-3 border-t border-stone-100">
      <div className="flex items-end justify-between gap-1.5 h-12">
        {series.map((pt) => {
          const pct = Math.max(18, Math.round((Math.abs(pt.value) / maxAbs) * 100));
          return (
            <div key={pt.label} className="flex-1 flex flex-col items-center gap-1">
              <div
                title={`${pt.label}: ${pt.value} ${unit}`}
                className={`w-full rounded-sm ${barColor}`}
                style={{ height: `${pct}%`, opacity: pt.value < 0 ? 0.6 : 0.9 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-stone-400 font-mono tabular-nums mt-1">
        {series.map((pt) => (
          <span key={pt.label} className="flex-1 text-center">
            {pt.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export const EarthSustainabilityPanel: React.FC<EarthSustainabilityPanelProps> = ({
  field,
  weatherObservationDate,
  onSaveToField,
  onNavigateRotation,
}) => {
  const { lang, t } = useLanguage();
  const [snapshot, setSnapshot] = useState<EarthEnvironmentSnapshot | null>(
    field.adaptiveMemory?.earthMetrics || null
  );
  const [loading, setLoading] = useState(!field.adaptiveMemory?.earthMetrics);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const formatTimestamp = (iso?: string) => {
    if (!iso) return t('Chưa đồng bộ', 'Not synced yet');
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return iso;
    return parsed.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    let active = true;
    const existing = field.adaptiveMemory?.earthMetrics || null;
    setSnapshot(existing);
    if (existing) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchFieldEarthMetrics(field)
      .then((data) => {
        if (active) setSnapshot(data);
      })
      .catch(() => {
        // Keep UI clean if backend fetch is unavailable
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [field.id, field.lat, field.lon]);

  const handleSync = async () => {
    setSyncing(true);
    setToast(null);
    try {
      const fresh = await syncFieldEarthMetrics(field);
      setSnapshot(fresh);
      if (onSaveToField && !field.isSharedWithMe) {
        await onSaveToField(fresh);
      }
      setToast({
        type: 'ok',
        text: t(
          'Đã đồng bộ dữ liệu mới nhất từ NASA POWER, SMAP/MODIS/GPM, OCO-2, GRACE và GHGx/EDGAR.',
          'Synced latest data from NASA POWER, SMAP/MODIS/GPM, OCO-2, GRACE-FO, and GHGx/EDGAR.'
        ),
      });
    } catch (err: any) {
      setToast({
        type: 'err',
        text:
          err?.message ||
          t('Không thể đồng bộ dữ liệu NASA lúc này.', 'Unable to sync NASA data right now.'),
      });
    } finally {
      setSyncing(false);
    }
  };

  const oco2 = snapshot?.carbonFluxOco2;
  const grace = snapshot?.groundwaterAnomalyGrace;
  const ghg = snapshot?.greenhouseGasEdgar;
  const smap = snapshot?.smapModis;

  const graceLabel =
    grace?.groundwaterStatus === 'recharging'
      ? t('Đang phục hồi', 'Recharging')
      : grace?.groundwaterStatus === 'depleting'
      ? t('Có dấu hiệu cạn kiệt', 'Depleting')
      : t('Ổn định', 'Stable');

  const graceTone =
    grace?.groundwaterStatus === 'recharging'
      ? 'text-emerald-700'
      : grace?.groundwaterStatus === 'depleting'
      ? 'text-rose-700'
      : 'text-stone-700';

  const ghgLabel =
    ghg?.emissionLevel === 'low'
      ? t('Phát thải thấp', 'Low emissions')
      : ghg?.emissionLevel === 'high'
      ? t('Phát thải cao', 'High emissions')
      : t('Phát thải trung bình', 'Moderate emissions');

  const ghgTone =
    ghg?.emissionLevel === 'low'
      ? 'text-emerald-700'
      : ghg?.emissionLevel === 'high'
      ? 'text-amber-700'
      : 'text-stone-700';

  const sifLabel =
    oco2?.photosynthesisStatus === 'high'
      ? t('Quang hợp mạnh', 'High photosynthesis')
      : oco2?.photosynthesisStatus === 'low'
      ? t('Quang hợp thấp', 'Low photosynthesis')
      : t('Quang hợp ổn định', 'Moderate photosynthesis');

  const adviceText =
    lang === 'en'
      ? snapshot?.rotationAdviceEn || snapshot?.rotationAdvice
      : snapshot?.rotationAdvice;

  return (
    <section className="space-y-4">
      {/* Clean Header + Single Sync CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-stone-900">
            {t(
              'Môi trường & Bền vững (OCO-2 · GRACE · GHGx · SMAP)',
              'Environment & Sustainability (OCO-2 · GRACE · GHGx · SMAP)'
            )}
          </h2>
          <p className="text-xs text-stone-500">
            {snapshot
              ? t(
                  `Lần cuối đồng bộ: ${formatTimestamp(snapshot.syncedAt)} · Điểm bền vững: ${snapshot.sustainabilityScore}/100`,
                  `Last synced: ${formatTimestamp(snapshot.syncedAt)} · Sustainability score: ${snapshot.sustainabilityScore}/100`
                )
              : t(
                  'Theo dõi hấp thụ carbon, nước ngầm, độ ẩm vệ tinh và phát thải khí nhà kính tại thửa ruộng',
                  'Track carbon uptake, groundwater anomaly, satellite soil moisture, and greenhouse gas emissions'
                )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing
            ? t('Đang đồng bộ...', 'Syncing...')
            : t('Đồng bộ dữ liệu NASA', 'Sync NASA Data')}
        </button>
      </div>

      {/* Sync Toast / Alert */}
      {toast && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span className="flex items-center gap-2">
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            {toast.text}
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-bold cursor-pointer px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3 Clean Metric Cards */}
      {loading && !snapshot ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 bg-white rounded-2xl border border-stone-200 p-5 animate-pulse"
            />
          ))}
        </div>
      ) : snapshot ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: NASA OCO-2 / OCO-3 */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <Leaf className="w-4 h-4 text-emerald-700" />
                  {t('Hấp thụ Carbon (OCO-2)', 'Carbon Uptake (OCO-2)')}
                </span>
                <span className="font-semibold text-emerald-700">{sifLabel}</span>
              </div>

              <div>
                <div className="text-2xl font-black text-stone-900 font-mono tabular-nums">
                  {oco2?.carbonUptakeTonHaYr}{' '}
                  <span className="text-xs font-semibold text-stone-500">
                    {t('tấn CO₂/ha', 't CO₂/ha')}
                  </span>
                </div>
                <div className="text-xs text-stone-500 mt-1 font-mono tabular-nums">
                  SIF: {oco2?.sifWm2SrUm} · CO₂: {oco2?.xco2Ppm} ppm
                </div>
                <div className="text-[11px] text-stone-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>
                    {t('Lần cuối cập nhật:', 'Last updated:')}{' '}
                    {formatTimestamp(oco2?.lastUpdated || snapshot.syncedAt)}
                  </span>
                </div>
              </div>

              <MiniTrendBars
                series={oco2?.trendSeries || []}
                barColor="bg-emerald-600"
                unit={t('tấn CO₂/ha', 't CO₂/ha')}
              />
            </div>

            {/* Card 2: NASA GRACE / GRACE-FO */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-sky-700" />
                  {t('Nước ngầm (GRACE)', 'Groundwater (GRACE)')}
                </span>
                <span className={`font-semibold ${graceTone}`}>{graceLabel}</span>
              </div>

              <div>
                <div className="text-2xl font-black text-stone-900 font-mono tabular-nums">
                  {(grace?.lweThicknessCm ?? 0) >= 0
                    ? `+${grace?.lweThicknessCm}`
                    : grace?.lweThicknessCm}{' '}
                  <span className="text-xs font-semibold text-stone-500">cm LWE</span>
                </div>
                <div className="text-xs text-stone-500 mt-1 font-mono tabular-nums">
                  {t('Cân bằng ẩm rễ:', 'Root water balance:')} {grace?.soilWaterBalancePct}%
                </div>
                <div className="text-[11px] text-stone-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>
                    {t('Lần cuối cập nhật:', 'Last updated:')}{' '}
                    {formatTimestamp(grace?.lastUpdated || snapshot.syncedAt)}
                  </span>
                </div>
              </div>

              <MiniTrendBars
                series={grace?.trendSeries || []}
                barColor={grace?.groundwaterStatus === 'depleting' ? 'bg-rose-500' : 'bg-sky-600'}
                unit="cm LWE"
              />
            </div>

            {/* Card 3: GHGx / EDGAR */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-amber-700" />
                  {t('Phát thải (GHGx / EDGAR)', 'Emissions (GHGx / EDGAR)')}
                </span>
                <span className={`font-semibold ${ghgTone}`}>{ghgLabel}</span>
              </div>

              <div>
                <div className="text-2xl font-black text-stone-900 font-mono tabular-nums">
                  {ghg?.co2eqTonHa}{' '}
                  <span className="text-xs font-semibold text-stone-500">
                    {t('tấn CO₂e/ha', 't CO₂e/ha')}
                  </span>
                </div>
                <div className="text-xs text-stone-500 mt-1 font-mono tabular-nums">
                  CH₄: {ghg?.ch4KgHa} kg/ha · N₂O: {ghg?.n2oKgHa} kg/ha
                </div>
                <div className="text-[11px] text-stone-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>
                    {t('Lần cuối cập nhật:', 'Last updated:')}{' '}
                    {formatTimestamp(ghg?.lastUpdated || snapshot.syncedAt)}
                  </span>
                </div>
              </div>

              <MiniTrendBars
                series={ghg?.trendSeries || []}
                barColor={ghg?.emissionLevel === 'high' ? 'bg-amber-500' : 'bg-stone-600'}
                unit={t('tấn CO₂e/ha', 't CO₂e/ha')}
              />
            </div>
          </div>

          {/* Dedicated "Lần cuối cập nhật / Last updated" Table for EVERY Data Source */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-stone-800">
                {t(
                  'Trạng thái nguồn dữ liệu NASA & Môi trường',
                  'NASA & Environmental Data Sources'
                )}
              </h3>
              <span className="text-[11px] text-stone-500">
                {t('Chuẩn Space Apps 2026', 'Space Apps 2026 Resources')}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-[11px] text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">
                      {t('Nguồn dữ liệu', 'Data Source')}
                    </th>
                    <th className="py-2.5 px-4 font-semibold">
                      {t('Chỉ số chính', 'Key Metric')}
                    </th>
                    <th className="py-2.5 px-4 font-semibold">
                      {t('Ngày quan trắc', 'Observation Date')}
                    </th>
                    <th className="py-2.5 px-4 font-semibold">
                      {t('Lần cuối cập nhật', 'Last updated')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  <tr>
                    <td className="py-2.5 px-4 font-semibold text-stone-800">
                      NASA POWER (Ag)
                    </td>
                    <td className="py-2.5 px-4 text-stone-600">
                      {t('Thời tiết, Bức xạ & Ẩm đất 21 năm', '21-yr Weather, Solar & Soil Moisture')}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-stone-600">
                      {weatherObservationDate || snapshot.syncedAt.slice(0, 10)}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-stone-700">
                      {formatTimestamp(snapshot.nasaPowerLastUpdated || snapshot.syncedAt)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-semibold text-stone-800">
                      NASA OCO-2 / OCO-3
                    </td>
                    <td className="py-2.5 px-4 font-mono text-stone-700">
                      SIF {oco2?.sifWm2SrUm} · {oco2?.carbonUptakeTonHaYr} {t('tấn CO₂/ha', 't CO₂/ha')}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-stone-600">
                      {oco2?.observationDate}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-stone-700">
                      {formatTimestamp(oco2?.lastUpdated || snapshot.syncedAt)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-semibold text-stone-800">
                      NASA GRACE / GRACE-FO
                    </td>
                    <td className="py-2.5 px-4 font-mono text-stone-700">
                      {(grace?.lweThicknessCm ?? 0) >= 0
                        ? `+${grace?.lweThicknessCm}`
                        : grace?.lweThicknessCm}{' '}
                      cm LWE ({grace?.soilWaterBalancePct}%)
                    </td>
                    <td className="py-2.5 px-4 font-mono text-stone-600">
                      {grace?.observationDate}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-stone-700">
                      {formatTimestamp(grace?.lastUpdated || snapshot.syncedAt)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-semibold text-stone-800">
                      GHGx / EDGAR
                    </td>
                    <td className="py-2.5 px-4 font-mono text-stone-700">
                      {ghg?.co2eqTonHa} {t('tấn CO₂e/ha', 't CO₂e/ha')} (CH₄ {ghg?.ch4KgHa} · N₂O {ghg?.n2oKgHa})
                    </td>
                    <td className="py-2.5 px-4 font-mono text-stone-600">
                      {ghg?.observationDate}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-stone-700">
                      {formatTimestamp(ghg?.lastUpdated || snapshot.syncedAt)}
                    </td>
                  </tr>
                  {smap && (
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-stone-800">
                        NASA SMAP · MODIS · GPM
                      </td>
                      <td className="py-2.5 px-4 font-mono text-stone-700">
                        {t('Ẩm mặt', 'SMAP')} {smap.smapSoilMoisturePct}% · NDVI {smap.modisNdvi} ·{' '}
                        {t('Mưa 7d', '7d Rain')} {smap.gpmPrecipitation7dMm}mm
                      </td>
                      <td className="py-2.5 px-4 font-mono text-stone-600">
                        {smap.observationDate}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-stone-700">
                        {formatTimestamp(smap.lastUpdated || snapshot.syncedAt)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {/* Concise Rotation Sustainability Link */}
      {adviceText && (
        <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <p className="text-stone-700 leading-relaxed">
            <strong className="text-stone-900">
              {t('Gợi ý luân canh bền vững:', 'Sustainable rotation guidance:')}
            </strong>{' '}
            {adviceText}
          </p>
          {onNavigateRotation && (
            <button
              type="button"
              onClick={onNavigateRotation}
              className="text-emerald-800 hover:text-emerald-950 font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              {t('Xem luân canh', 'View rotation')} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
};
