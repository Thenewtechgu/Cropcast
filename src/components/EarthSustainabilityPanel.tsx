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
          'Đã cập nhật chỉ số môi trường, độ ẩm và cân bằng nước mới nhất cho thửa ruộng.',
          'Refreshed latest environmental, soil moisture, and water balance metrics for your field.'
        ),
      });
    } catch (err: any) {
      setToast({
        type: 'err',
        text:
          err?.message ||
          t('Không thể cập nhật chỉ số môi trường lúc này.', 'Unable to refresh field metrics right now.'),
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
            {t('Chỉ số Môi trường & Sức khỏe Ruộng', 'Field Environment & Sustainability Metrics')}
          </h2>
          <p className="text-xs text-stone-500">
            {snapshot
              ? t(
                  `Cập nhật lúc: ${formatTimestamp(snapshot.syncedAt)} · Điểm bền vững: ${snapshot.sustainabilityScore}/100`,
                  `Updated: ${formatTimestamp(snapshot.syncedAt)} · Sustainability score: ${snapshot.sustainabilityScore}/100`
                )
              : t(
                  'Theo dõi hấp thụ carbon, trữ lượng nước ngầm, độ ẩm lớp mặt và phát thải đồng ruộng',
                  'Track carbon uptake, groundwater reserve, topsoil moisture, and field greenhouse gas balance'
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
            ? t('Đang cập nhật...', 'Refreshing...')
            : t('Cập nhật chỉ số môi trường', 'Refresh Field Metrics')}
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
            {/* Card 1: Carbon Uptake & Canopy Photosynthesis */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <Leaf className="w-4 h-4 text-emerald-700" />
                  {t('Hấp thụ Carbon & Quang hợp', 'Carbon Uptake & Photosynthesis')}
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
                  {t('Chỉ số quang hợp:', 'Photosynthesis index:')} {oco2?.sifWm2SrUm} · CO₂: {oco2?.xco2Ppm} ppm
                </div>
                <p className="text-[11px] text-stone-600 mt-2 leading-snug">
                  {oco2?.photosynthesisStatus === 'low'
                    ? t(
                        'Tán lá quang hợp yếu — kiểm tra thiếu nắng, thiếu đạm hoặc rễ bị úng.',
                        'Lower leaf activity — check for cloud stress, nitrogen gap, or root stress.'
                      )
                    : t(
                        'Tán cây hấp thụ CO₂ ổn định, giúp tích lũy chất hữu cơ và nuôi hạt/củ tốt.',
                        'Canopy is actively assimilating carbon into strong foliage and yield.'
                      )}
                </p>
                <div className="text-[11px] text-stone-400 mt-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>
                    {t('Cập nhật:', 'Updated:')}{' '}
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

            {/* Card 2: Groundwater Reserve */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-sky-700" />
                  {t('Trữ lượng Nước ngầm', 'Groundwater Reserve')}
                </span>
                <span className={`font-semibold ${graceTone}`}>{graceLabel}</span>
              </div>

              <div>
                <div className="text-2xl font-black text-stone-900 font-mono tabular-nums">
                  {(grace?.lweThicknessCm ?? 0) >= 0
                    ? `+${grace?.lweThicknessCm}`
                    : grace?.lweThicknessCm}{' '}
                  <span className="text-xs font-semibold text-stone-500">cm</span>
                </div>
                <div className="text-xs text-stone-500 mt-1 font-mono tabular-nums">
                  {t('Cân bằng ẩm rễ:', 'Root water balance:')} {grace?.soilWaterBalancePct}%
                </div>
                <p className="text-[11px] text-stone-600 mt-2 leading-snug">
                  {grace?.groundwaterStatus === 'depleting'
                    ? t(
                        'Mực nước ngầm đang hạ — hạn chế bơm giếng sâu và ưu tiên tưới tiết kiệm / phủ gốc.',
                        'Aquifer level is declining — reduce deep pumping and favor mulching or drip watering.'
                      )
                    : t(
                        'Nguồn nước tầng sâu ổn định, đủ dự phòng ẩm cho rễ qua các đợt khô ngắn.',
                        'Subsurface reserves are stable, buffering root moisture during short dry spells.'
                      )}
                </p>
                <div className="text-[11px] text-stone-400 mt-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>
                    {t('Cập nhật:', 'Updated:')}{' '}
                    {formatTimestamp(grace?.lastUpdated || snapshot.syncedAt)}
                  </span>
                </div>
              </div>

              <MiniTrendBars
                series={grace?.trendSeries || []}
                barColor={grace?.groundwaterStatus === 'depleting' ? 'bg-rose-500' : 'bg-sky-600'}
                unit="cm"
              />
            </div>

            {/* Card 3: Field Emissions */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-amber-700" />
                  {t('Phát thải Khí nhà kính', 'Field GHG Emissions')}
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
                <p className="text-[11px] text-stone-600 mt-2 leading-snug">
                  {ghg?.emissionLevel === 'high'
                    ? t(
                        'Mức CH₄/N₂O cao — rút nước xen kẽ giữa vụ và chia nhỏ phân đạm để tránh thất thoát phân.',
                        'Elevated CH₄/N₂O — apply periodic field drainage and split nitrogen doses to save fertilizer.'
                      )
                    : t(
                        'Phát thải thấp, cho thấy phân đạm và mực nước đang được giữ hiệu quả trong đất.',
                        'Low emissions show fertilizer and irrigation water are being used efficiently.'
                      )}
                </p>
                <div className="text-[11px] text-stone-400 mt-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>
                    {t('Cập nhật:', 'Updated:')}{' '}
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

          {smap && (
            <div className="bg-white rounded-2xl border border-stone-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200">
                <div className="text-stone-500 font-semibold">
                  {t('Độ ẩm lớp đất mặt (0–5 cm)', 'Topsoil Moisture (0–5 cm)')}
                </div>
                <div className="text-lg font-black text-sky-900 font-mono tabular-nums mt-0.5">
                  {smap.smapSoilMoisturePct}%
                </div>
                <div className="text-[11px] text-stone-600 mt-0.5">
                  {smap.smapSoilMoisturePct < 35
                    ? t('Tầng mặt khô nhanh, cây non dễ thiếu nước.', 'Topsoil drying fast; watch shallow roots.')
                    : t('Tầng mặt giữ ẩm ổn định cho hạt & rễ non.', 'Topsoil moisture supports shallow roots.')}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <div className="text-stone-500 font-semibold">
                  {t('Chỉ số độ xanh tán lá (NDVI)', 'Canopy Greenness (NDVI)')}
                </div>
                <div className="text-lg font-black text-emerald-900 font-mono tabular-nums mt-0.5">
                  {smap.modisNdvi}
                </div>
                <div className="text-[11px] text-stone-600 mt-0.5">
                  {smap.modisNdvi >= 0.55
                    ? t('Độ phủ tán xanh tốt, hạn chế cỏ dại & xói mòn.', 'Dense canopy shields soil from weeds & erosion.')
                    : t('Tán lá còn thưa, nên tủ gốc giữ ẩm mặt ruộng.', 'Sparse cover — mulch exposed rows to hold moisture.')}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-stone-500 font-semibold">
                  {t('Tổng lượng mưa 7 ngày gần nhất', '7-Day Accumulated Rainfall')}
                </div>
                <div className="text-lg font-black text-stone-900 font-mono tabular-nums mt-0.5">
                  {smap.gpmPrecipitation7dMm} mm
                </div>
                <div className="text-[11px] text-stone-600 mt-0.5">
                  {smap.gpmPrecipitation7dMm > 60
                    ? t('Mưa nhiều trong tuần — ưu tiên kiểm tra tiêu úng.', 'Heavy weekly rain — prioritize field drainage.')
                    : t('Lượng mưa tuần vừa phải, kết hợp tưới bổ sung nếu đất khô.', 'Moderate weekly rain — supplement irrigation only if dry.')}
                </div>
              </div>
            </div>
          )}
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
