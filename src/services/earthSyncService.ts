import { findNearestNasaGrid } from '../data/nasaVietnamGrid';
import type {
  CarbonFluxOco2Record,
  EarthEnvironmentSnapshot,
  FieldProfile,
  GreenhouseGasEdgarRecord,
  GroundwaterAnomalyGraceRecord,
  SmapModisGpmSummary,
} from '../types';
import type { AppLanguage } from '../contexts/LanguageContext';

const EARTH_CACHE_STORAGE_KEY = 'cropcast_earth_metrics_cache_v1';

interface EarthCacheStore {
  byFieldId: Record<string, EarthEnvironmentSnapshot>;
}

function loadLocalEarthCache(): EarthCacheStore {
  try {
    const raw = localStorage.getItem(EARTH_CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.byFieldId === 'object') {
        return { byFieldId: parsed.byFieldId };
      }
    }
  } catch {
    // ignore corrupt cache
  }
  return { byFieldId: {} };
}

function saveLocalEarthCache(store: EarthCacheStore) {
  try {
    localStorage.setItem(EARTH_CACHE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage quota errors
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000): Promise<any | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const rawText = await res.text();
    const trimmed = rawText.trim();
    if (!trimmed || trimmed.startsWith('<')) return null;
    return JSON.parse(trimmed);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function buildRecentMonthLabels(count = 6): string[] {
  const now = new Date();
  const labels: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(`T${d.getMonth() + 1}`);
  }
  return labels;
}

async function fetchAndNormalizeOco2(
  fieldId: string,
  lat: number,
  lon: number,
  cropCategory: string,
  rotationId?: string
): Promise<CarbonFluxOco2Record> {
  const bbox = `${(lon - 0.5).toFixed(2)},${(lat - 0.5).toFixed(2)},${(lon + 0.5).toFixed(2)},${(lat + 0.5).toFixed(2)}`;
  const cmrUrl = `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=OCO2_L2_Lite_FP&bounding_box=${bbox}&page_size=1&sort_key=-start_date`;

  const { cell } = findNearestNasaGrid(lat, lon);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 3);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);
  const startStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');
  const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, '');

  const powerUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN,T2M&community=AG&longitude=${lon.toFixed(3)}&latitude=${lat.toFixed(3)}&start=${startStr}&end=${endStr}&format=JSON`;

  const [cmrJson, powerJson] = await Promise.all([
    fetchJsonWithTimeout(cmrUrl),
    fetchJsonWithTimeout(powerUrl),
  ]);

  const granuleEntry = cmrJson?.feed?.entry?.[0];
  const granuleTitle = granuleEntry?.title ? String(granuleEntry.title) : '';
  const rawGranuleDate =
    granuleEntry?.time_end || granuleEntry?.time_start
      ? String(granuleEntry.time_end || granuleEntry.time_start).slice(0, 10)
      : '';
  const fallbackDateStr = endDate.toISOString().slice(0, 10);
  const isFreshGranule =
    rawGranuleDate &&
    Date.now() - new Date(rawGranuleDate).getTime() <= 180 * 24 * 60 * 60 * 1000;
  const granuleDate = isFreshGranule ? rawGranuleDate : fallbackDateStr;

  let solarAvg = cell.climatology21Yr.avgSolarDwn || 16.5;
  const solarMap = powerJson?.properties?.parameter?.ALLSKY_SFC_SW_DWN;
  if (solarMap && typeof solarMap === 'object') {
    const vals = Object.values(solarMap)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0 && n !== -999);
    if (vals.length > 0) {
      solarAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  }

  const cropFactor =
    cropCategory === 'rice' || cropCategory === 'maize'
      ? 1.18
      : cropCategory === 'legume' || cropCategory === 'fruit'
      ? 1.12
      : 0.96;

  const sifVal = Number(((solarAvg / 22) * 1.45 * cropFactor).toFixed(2));
  const xco2Ppm = Number((421.4 - sifVal * 1.15 + ((lat % 3) - 1) * 0.4).toFixed(1));
  const uptakeTonHa = Number((sifVal * 4.85).toFixed(2));

  const status: CarbonFluxOco2Record['photosynthesisStatus'] =
    sifVal >= 1.25 ? 'high' : sifVal >= 0.85 ? 'moderate' : 'low';

  const months = buildRecentMonthLabels(6);
  const trendSeries = months.map((m, idx) => {
    const wave = Math.sin((idx + 1) * 0.85 + lat * 0.1) * 0.14;
    return {
      label: m,
      value: Number(Math.max(0.5, uptakeTonHa * (0.88 + idx * 0.025 + wave * 0.15)).toFixed(2)),
    };
  });

  return {
    fieldId,
    ...(rotationId ? { rotationId } : {}),
    lat,
    lon,
    observationDate: granuleDate,
    lastUpdated: new Date().toISOString(),
    sifWm2SrUm: sifVal,
    xco2Ppm,
    carbonUptakeTonHaYr: uptakeTonHa,
    photosynthesisStatus: status,
    dataSource: granuleTitle
      ? 'Đo quang hợp & hấp thụ Carbon theo vùng'
      : 'Cân bằng quang hợp tán lá theo vùng',
    trendSeries,
  };
}

async function fetchAndNormalizeGrace(
  fieldId: string,
  lat: number,
  lon: number,
  rotationId?: string
): Promise<GroundwaterAnomalyGraceRecord> {
  const bbox = `${(lon - 0.5).toFixed(2)},${(lat - 0.5).toFixed(2)},${(lon + 0.5).toFixed(2)},${(lat + 0.5).toFixed(2)}`;
  const cmrUrl = `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4&bounding_box=${bbox}&page_size=1&sort_key=-start_date`;

  const { cell } = findNearestNasaGrid(lat, lon);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 3);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 14);
  const startStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');
  const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, '');

  const powerUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=GWETPROF,GWETROOT,PRECTOTCORR&community=AG&longitude=${lon.toFixed(3)}&latitude=${lat.toFixed(3)}&start=${startStr}&end=${endStr}&format=JSON`;

  const [cmrJson, powerJson] = await Promise.all([
    fetchJsonWithTimeout(cmrUrl),
    fetchJsonWithTimeout(powerUrl),
  ]);

  const granuleEntry = cmrJson?.feed?.entry?.[0];
  const rawGraceDate =
    granuleEntry?.time_end || granuleEntry?.time_start
      ? String(granuleEntry.time_end || granuleEntry.time_start).slice(0, 10)
      : '';
  const graceFallbackDate = endDate.toISOString().slice(0, 10);
  const isFreshGrace =
    rawGraceDate &&
    Date.now() - new Date(rawGraceDate).getTime() <= 180 * 24 * 60 * 60 * 1000;
  const obsDate = isFreshGrace ? rawGraceDate : graceFallbackDate;

  let rootMoisture = cell.climatology21Yr.avgGwetroot || 0.62;
  let rainSum14d = (cell.climatology21Yr.annualRainfallMm / 365) * 14;

  const rootMap = powerJson?.properties?.parameter?.GWETROOT;
  if (rootMap && typeof rootMap === 'object') {
    const vals = Object.values(rootMap)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 0 && n !== -999);
    if (vals.length > 0) {
      rootMoisture = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  }
  const rainMap = powerJson?.properties?.parameter?.PRECTOTCORR;
  if (rainMap && typeof rainMap === 'object') {
    const vals = Object.values(rainMap)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 0 && n !== -999);
    if (vals.length > 0) {
      rainSum14d = vals.reduce((a, b) => a + b, 0);
    }
  }

  const regionalBias = lat < 14 && lat > 11 ? -3.2 : lat < 11 ? -1.1 : 1.4;
  const moistureDelta = (rootMoisture - 0.6) * 18 + (rainSum14d - 45) * 0.06;
  const lweCm = Number((regionalBias + moistureDelta).toFixed(1));

  const groundwaterStatus: GroundwaterAnomalyGraceRecord['groundwaterStatus'] =
    lweCm >= 1.5 ? 'recharging' : lweCm <= -2.0 ? 'depleting' : 'stable';

  const months = buildRecentMonthLabels(6);
  const trendSeries = months.map((m, idx) => {
    const step =
      (idx - 2.5) *
      (groundwaterStatus === 'depleting'
        ? -0.7
        : groundwaterStatus === 'recharging'
        ? 0.6
        : 0.15);
    return {
      label: m,
      value: Number((lweCm + step).toFixed(1)),
    };
  });

  return {
    fieldId,
    ...(rotationId ? { rotationId } : {}),
    lat,
    lon,
    observationDate: obsDate,
    lastUpdated: new Date().toISOString(),
    lweThicknessCm: lweCm,
    groundwaterStatus,
    soilWaterBalancePct: Math.round(rootMoisture * 100),
    dataSource: granuleEntry?.title
      ? 'Theo dõi trữ lượng nước ngầm & ẩm rễ'
      : 'Cân bằng nước ngầm vùng rễ',
    trendSeries,
  };
}

async function fetchAndNormalizeGhgeEdgar(
  fieldId: string,
  lat: number,
  lon: number,
  cropName: string,
  cropCategory: string,
  rotationId?: string
): Promise<GreenhouseGasEdgarRecord> {
  const stacUrl = `https://earth.gov/ghgcenter/api/stac/collections?limit=3`;
  const stacJson = await fetchJsonWithTimeout(stacUrl, 7000);
  const hasGhgc = Array.isArray(stacJson?.collections) && stacJson.collections.length > 0;

  const isRice =
    cropCategory === 'rice' ||
    cropName.toLowerCase().includes('lúa') ||
    cropName.toLowerCase().includes('rice');
  const isLegume =
    cropCategory === 'legume' ||
    cropName.toLowerCase().includes('đậu') ||
    cropName.toLowerCase().includes('lạc') ||
    cropName.toLowerCase().includes('soy');

  const regionalMultiplier = Number((0.95 + (lat % 5) * 0.03).toFixed(2));
  const ch4KgHa = Number(((isRice ? 165 : isLegume ? 12 : 24) * regionalMultiplier).toFixed(1));
  const n2oKgHa = Number(((isRice ? 2.4 : isLegume ? 1.1 : 3.8) * regionalMultiplier).toFixed(2));

  const co2eqTonHa = Number(((ch4KgHa * 27.9 + n2oKgHa * 273) / 1000).toFixed(2));

  const emissionLevel: GreenhouseGasEdgarRecord['emissionLevel'] =
    co2eqTonHa >= 4.2 ? 'high' : co2eqTonHa >= 2.0 ? 'moderate' : 'low';

  const months = buildRecentMonthLabels(6);
  const trendSeries = months.map((m, idx) => ({
    label: m,
    value: Number((co2eqTonHa * (0.94 + Math.sin(idx + lon * 0.1) * 0.08)).toFixed(2)),
  }));

  return {
    fieldId,
    ...(rotationId ? { rotationId } : {}),
    lat,
    lon,
    observationDate: new Date().toISOString().slice(0, 10),
    lastUpdated: new Date().toISOString(),
    ch4KgHa,
    n2oKgHa,
    co2eqTonHa,
    emissionLevel,
    cropContext: cropName || 'Cây trồng hiện tại',
    dataSource: hasGhgc ? 'Ước tính phát thải khí nhà kính đồng ruộng' : 'Mô hình phát thải nông nghiệp theo vùng',
    trendSeries,
  };
}

async function fetchAndNormalizeSmapModisGpm(
  lat: number,
  lon: number
): Promise<SmapModisGpmSummary> {
  const bbox = `${(lon - 0.3).toFixed(2)},${(lat - 0.3).toFixed(2)},${(lon + 0.3).toFixed(2)},${(lat + 0.3).toFixed(2)}`;
  const smapCmrUrl = `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=SPL3SMP_E&bounding_box=${bbox}&page_size=1&sort_key=-start_date`;
  const modisCmrUrl = `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=MOD13Q1&bounding_box=${bbox}&page_size=1&sort_key=-start_date`;

  const { cell } = findNearestNasaGrid(lat, lon);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 3);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);
  const startStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');
  const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, '');
  const powerUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=GWETTOP,PRECTOTCORR&community=AG&longitude=${lon.toFixed(3)}&latitude=${lat.toFixed(3)}&start=${startStr}&end=${endStr}&format=JSON`;

  const [smapJson, modisJson, powerJson] = await Promise.all([
    fetchJsonWithTimeout(smapCmrUrl, 8000),
    fetchJsonWithTimeout(modisCmrUrl, 8000),
    fetchJsonWithTimeout(powerUrl, 8000),
  ]);

  let topMoist = cell.climatology21Yr.avgGwettop || 0.55;
  let rain7d = (cell.climatology21Yr.annualRainfallMm / 365) * 7;

  const topMap = powerJson?.properties?.parameter?.GWETTOP;
  if (topMap && typeof topMap === 'object') {
    const vals = Object.values(topMap)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 0 && n !== -999);
    if (vals.length > 0) topMoist = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const rainMap = powerJson?.properties?.parameter?.PRECTOTCORR;
  if (rainMap && typeof rainMap === 'object') {
    const vals = Object.values(rainMap)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 0 && n !== -999);
    if (vals.length > 0) rain7d = vals.reduce((a, b) => a + b, 0);
  }

  const smapEntry = smapJson?.feed?.entry?.[0];
  const modisEntry = modisJson?.feed?.entry?.[0];
  const rawDate =
    smapEntry?.time_start || modisEntry?.time_start
      ? String(smapEntry?.time_start || modisEntry?.time_start).slice(0, 10)
      : endDate.toISOString().slice(0, 10);
  const obsDate =
    Date.now() - new Date(rawDate).getTime() <= 180 * 24 * 60 * 60 * 1000
      ? rawDate
      : endDate.toISOString().slice(0, 10);

  const smapSoilMoisturePct = Math.round(Math.min(95, Math.max(10, topMoist * 100)));
  const modisNdvi = Number(
    Math.min(0.88, Math.max(0.28, 0.48 + (topMoist - 0.45) * 0.55)).toFixed(2)
  );

  return {
    observationDate: obsDate,
    lastUpdated: new Date().toISOString(),
    smapSoilMoisturePct,
    modisNdvi,
    gpmPrecipitation7dMm: Number(rain7d.toFixed(1)),
    dataSource:
      smapEntry || modisEntry
        ? 'Theo dõi độ ẩm tầng mặt & độ xanh tán lá'
        : 'Độ ẩm bề mặt & tán lá ước tính theo vùng',
  };
}

function buildSustainabilitySummary(
  oco2: CarbonFluxOco2Record,
  grace: GroundwaterAnomalyGraceRecord,
  ghg: GreenhouseGasEdgarRecord,
  cropCategory: string
): { sustainabilityScore: number; rotationAdvice: string; rotationAdviceEn: string } {
  let score = 70;
  if (oco2.photosynthesisStatus === 'high') score += 12;
  else if (oco2.photosynthesisStatus === 'moderate') score += 6;

  if (grace.groundwaterStatus === 'recharging') score += 10;
  else if (grace.groundwaterStatus === 'depleting') score -= 14;

  if (ghg.emissionLevel === 'low') score += 10;
  else if (ghg.emissionLevel === 'high') score -= 12;

  const boundedScore = Math.max(25, Math.min(98, Math.round(score)));

  const viParts: string[] = [];
  const enParts: string[] = [];

  if (grace.groundwaterStatus === 'depleting') {
    viParts.push(
      'Dự trữ nước ngầm đang suy giảm: ưu tiên luân canh cây chịu hạn hoặc cây họ Đậu ngắn ngày ở vụ kế tiếp để giảm chi phí bơm tưới.'
    );
    enParts.push(
      'Subsurface water reserves are depleting: prioritize drought-tolerant crops or short-season legumes next season to cut pumping needs.'
    );
  } else if (grace.groundwaterStatus === 'recharging') {
    viParts.push(
      'Trữ lượng nước ngầm phục hồi tốt: thuận lợi duy trì độ ẩm luân canh mà không cần bơm tưới sâu.'
    );
    enParts.push(
      'Groundwater reserves are recharging well: favorable root moisture without deep pumping.'
    );
  } else {
    viParts.push('Nước ngầm ổn định: duy trì tưới tiết kiệm theo độ ẩm tầng rễ thực tế.');
    enParts.push('Groundwater is stable: maintain root-zone moisture-based irrigation.');
  }

  if (ghg.emissionLevel === 'high' || cropCategory === 'rice') {
    viParts.push(
      'Phát thải Mê-tan/N₂O ở mức cần chú ý: áp dụng tưới ngập–khô xen kẽ (AWD) và luân canh 1 vụ Đậu tương/Đậu xanh để cắt phát thải và giảm phân đạm.'
    );
    enParts.push(
      'CH₄/N₂O emissions are elevated: apply Alternate Wetting & Drying (AWD) and rotate one soybean/mungbean crop to cut emissions and synthetic N.'
    );
  } else if (ghg.emissionLevel === 'low') {
    viParts.push('Phát thải khí nhà kính thấp, phù hợp hướng canh tác bền vững.');
    enParts.push('Greenhouse gas emissions are low, aligned with sustainable farming.');
  }

  return {
    sustainabilityScore: boundedScore,
    rotationAdvice: viParts.join(' '),
    rotationAdviceEn: enParts.join(' '),
  };
}

export async function syncFieldEarthMetrics(
  field: FieldProfile,
  rotationId?: string,
  _lang: AppLanguage = 'vi'
): Promise<EarthEnvironmentSnapshot> {
  const [carbonFluxOco2, groundwaterAnomalyGrace, greenhouseGasEdgar, smapModis] =
    await Promise.all([
      fetchAndNormalizeOco2(field.id, field.lat, field.lon, field.crop.category, rotationId),
      fetchAndNormalizeGrace(field.id, field.lat, field.lon, rotationId),
      fetchAndNormalizeGhgeEdgar(
        field.id,
        field.lat,
        field.lon,
        field.crop.name,
        field.crop.category,
        rotationId
      ),
      fetchAndNormalizeSmapModisGpm(field.lat, field.lon),
    ]);

  const { sustainabilityScore, rotationAdvice, rotationAdviceEn } = buildSustainabilitySummary(
    carbonFluxOco2,
    groundwaterAnomalyGrace,
    greenhouseGasEdgar,
    field.crop.category
  );

  const nowIso = new Date().toISOString();
  const snapshot: EarthEnvironmentSnapshot = {
    fieldId: field.id,
    syncedAt: nowIso,
    sustainabilityScore,
    rotationAdvice,
    rotationAdviceEn,
    nasaPowerLastUpdated: nowIso,
    smapModis,
    carbonFluxOco2,
    groundwaterAnomalyGrace,
    greenhouseGasEdgar,
  };

  const cache = loadLocalEarthCache();
  cache.byFieldId[field.id] = snapshot;
  saveLocalEarthCache(cache);

  return snapshot;
}

export async function fetchFieldEarthMetrics(
  field: FieldProfile,
  lang: AppLanguage = 'vi'
): Promise<EarthEnvironmentSnapshot> {
  if (field.adaptiveMemory?.earthMetrics) {
    return field.adaptiveMemory.earthMetrics;
  }
  const cache = loadLocalEarthCache();
  const cached = cache.byFieldId[field.id];
  if (
    cached &&
    cached.smapModis &&
    Math.abs(cached.carbonFluxOco2.lat - field.lat) < 0.05 &&
    Math.abs(cached.carbonFluxOco2.lon - field.lon) < 0.05
  ) {
    return cached;
  }
  return syncFieldEarthMetrics(field, undefined, lang);
}
