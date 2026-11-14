import { DailyForecastPoint, FieldProfile, WeatherObservation } from '../types';
import {
  computePrismMoistureMetrics,
  findNearestNasaGrid,
  getCellMonthlyProfile,
} from '../data/nasaVietnamGrid';
import { weatherCacheService } from './weatherCache';

/**
 * Builds a monthly 2001–2025 baseline WeatherObservation for any coordinate in Vietnam
 */
export function buildClimaticBaselineWeather(lat: number, lon: number): WeatherObservation {
  const { cell } = findNearestNasaGrid(lat, lon);
  const currentMonthIdx = new Date().getMonth(); // 0..11
  const profile = getCellMonthlyProfile(cell, 'vi');
  const m = profile[currentMonthIdx] || profile[0];

  const vpdMeanHpa = Number(((m.VPDMIN + m.VPDMAX) / 2).toFixed(1));
  const avgDailyRain = Number((m.PRECTOTCORR / 30).toFixed(1));
  const avgAnnualDailyRain = Number((cell.climatology21Yr.annualRainfallMm / 365).toFixed(1));

  // Estimate baseline reference evapotranspiration (mm/day)
  const et0Base = Number(
    Math.max(1.8, Math.min(7.5, 0.0023 * (m.T2M + 17.8) * Math.sqrt(Math.max(2, m.T2M_MAX - m.T2M_MIN)) * (m.ALLSKY_SFC_SW_DWN * 0.408))).toFixed(1)
  );

  return {
    temp: m.T2M,
    minTemp: m.T2M_MIN,
    maxTemp: m.T2M_MAX,
    rain: avgDailyRain,
    humidity: m.RH2M,
    gwettop: m.GWETTOP,
    gwetroot: m.GWETROOT,
    solarRadiation: m.ALLSKY_SFC_SW_DWN,
    windSpeed: 2.3,
    dewPointC: m.TDMEAN,
    vpdHpa: vpdMeanHpa,
    vpdMinHpa: m.VPDMIN,
    vpdMaxHpa: m.VPDMAX,
    et0MmDay: et0Base,
    observationDate: `Nền khí hậu tháng ${currentMonthIdx + 1} (2001–2026)`,
    isRealtimeAvailable: false,
    source: 'ESTIMATED_CLIMATE',
    historicalBaseline: {
      avgTemp: cell.climatology21Yr.avgTemp,
      avgRain: avgAnnualDailyRain,
      avgHumidity: cell.climatology21Yr.avgRh2m,
      avgGwettop: cell.climatology21Yr.avgGwettop,
      avgGwetroot: cell.climatology21Yr.avgGwetroot,
      avgSolar: cell.climatology21Yr.avgSolarDwn,
      avgDewPointC: cell.climatology21Yr.avgDewPointC,
      avgVpdHpa:
        cell.climatology21Yr.avgVpdMinHpa !== undefined &&
        cell.climatology21Yr.avgVpdMaxHpa !== undefined
          ? Number(
              ((cell.climatology21Yr.avgVpdMinHpa + cell.climatology21Yr.avgVpdMaxHpa) / 2).toFixed(1)
            )
          : vpdMeanHpa,
      sampleYears: 25,
    },
  };
}

/**
 * Fetches live & 7-day forecast weather for the field using free, no-key Open-Meteo endpoint,
 * automatically merged with 25-year (2001–2025) baseline climate variables (dew point, VPD, soil wetness).
 */
export async function fetchFieldLiveWeather(
  lat: number,
  lon: number,
  _field?: FieldProfile,
  options?: { forceRefresh?: boolean }
): Promise<WeatherObservation> {
  const baseline = buildClimaticBaselineWeather(lat, lon);
  if (!options?.forceRefresh) {
    const cached = await weatherCacheService.getOpenMeteo(lat, lon);
    if (cached) {
      return cached;
    }
  }

  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), 7000);

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,dew_point_2m,vapour_pressure_deficit,soil_moisture_0_to_1cm,soil_moisture_9_to_27cm` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,shortwave_radiation_sum,et0_fao_evapotranspiration,vapour_pressure_deficit_max` +
      `&timezone=Asia%2FBangkok&forecast_days=7`;

    const resp = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!resp.ok) {
      return baseline;
    }

    const json = await resp.json();
    const cur = json?.current;
    const daily = json?.daily;
    if (!cur || typeof cur.temperature_2m !== 'number') {
      return baseline;
    }

    const temp = Number(cur.temperature_2m.toFixed(1));
    const humidity = Math.round(Number(cur.relative_humidity_2m ?? baseline.humidity));
    const minTemp =
      Array.isArray(daily?.temperature_2m_min) && typeof daily.temperature_2m_min[0] === 'number'
        ? Number(daily.temperature_2m_min[0].toFixed(1))
        : baseline.minTemp;
    const maxTemp =
      Array.isArray(daily?.temperature_2m_max) && typeof daily.temperature_2m_max[0] === 'number'
        ? Number(daily.temperature_2m_max[0].toFixed(1))
        : baseline.maxTemp;

    // Daily precipitation today (mm) + current hour precipitation
    const todayRainDaily =
      Array.isArray(daily?.precipitation_sum) && typeof daily.precipitation_sum[0] === 'number'
        ? daily.precipitation_sum[0]
        : 0;
    const rain = Number(Math.max(Number(cur.precipitation ?? 0), todayRainDaily).toFixed(1));

    // Convert wind km/h to m/s
    const windSpeed = Number(((Number(cur.wind_speed_10m ?? 8)) / 3.6).toFixed(1));

    // Convert Open-Meteo volumetric soil moisture (m³/m³, typically 0.12 - 0.48) to normalized 0.15 - 0.95 index
    const rawTop = typeof cur.soil_moisture_0_to_1cm === 'number' ? cur.soil_moisture_0_to_1cm : null;
    const rawRoot = typeof cur.soil_moisture_9_to_27cm === 'number' ? cur.soil_moisture_9_to_27cm : null;
    const gwettop =
      rawTop !== null
        ? Number(Math.min(0.95, Math.max(0.18, rawTop / 0.48)).toFixed(2))
        : baseline.gwettop;
    const gwetroot =
      rawRoot !== null
        ? Number(Math.min(0.95, Math.max(0.22, rawRoot / 0.48)).toFixed(2))
        : baseline.gwetroot;

    const solarRadiation =
      Array.isArray(daily?.shortwave_radiation_sum) && typeof daily.shortwave_radiation_sum[0] === 'number'
        ? Number(daily.shortwave_radiation_sum[0].toFixed(1))
        : baseline.solarRadiation;

    const et0MmDay =
      Array.isArray(daily?.et0_fao_evapotranspiration) &&
      typeof daily.et0_fao_evapotranspiration[0] === 'number'
        ? Number(daily.et0_fao_evapotranspiration[0].toFixed(1))
        : baseline.et0MmDay;

    // PRISM-equivalent atmospheric dryness variables
    const computedPrism = computePrismMoistureMetrics(temp, minTemp, maxTemp, humidity);
    const dewPointC =
      typeof cur.dew_point_2m === 'number'
        ? Number(cur.dew_point_2m.toFixed(1))
        : computedPrism.tdmeanC;
    // Open-Meteo returns VPD in kPa; convert kPa -> hPa (1 kPa = 10 hPa)
    const vpdHpa =
      typeof cur.vapour_pressure_deficit === 'number'
        ? Number((cur.vapour_pressure_deficit * 10).toFixed(1))
        : computedPrism.vpdMeanHpa;
    const vpdMaxHpa =
      Array.isArray(daily?.vapour_pressure_deficit_max) &&
      typeof daily.vapour_pressure_deficit_max[0] === 'number'
        ? Number((daily.vapour_pressure_deficit_max[0] * 10).toFixed(1))
        : computedPrism.vpdMaxHpa;

    const forecastDays: DailyForecastPoint[] = Array.isArray(daily?.time)
      ? daily.time.slice(0, 7).map((dateStr: string, idx: number) => ({
          date: dateStr,
          tempMin: Number((daily.temperature_2m_min?.[idx] ?? minTemp).toFixed(1)),
          tempMax: Number((daily.temperature_2m_max?.[idx] ?? maxTemp).toFixed(1)),
          rainMm: Number((daily.precipitation_sum?.[idx] ?? 0).toFixed(1)),
          solarMjM2: Number((daily.shortwave_radiation_sum?.[idx] ?? solarRadiation).toFixed(1)),
          et0Mm:
            typeof daily.et0_fao_evapotranspiration?.[idx] === 'number'
              ? Number(daily.et0_fao_evapotranspiration[idx].toFixed(1))
              : undefined,
          vpdMaxHpa:
            typeof daily.vapour_pressure_deficit_max?.[idx] === 'number'
              ? Number((daily.vapour_pressure_deficit_max[idx] * 10).toFixed(1))
              : undefined,
        }))
      : [];

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    const nowIso = new Date().toISOString();
    const result: WeatherObservation = {
      temp,
      minTemp,
      maxTemp,
      rain,
      humidity,
      gwettop,
      gwetroot,
      solarRadiation,
      windSpeed,
      dewPointC,
      vpdHpa,
      vpdMinHpa: computedPrism.vpdMinHpa,
      vpdMaxHpa,
      et0MmDay,
      forecastDays,
      observationDate: `Hôm nay (Cập nhật ${hh}:${mm})`,
      isRealtimeAvailable: true,
      source: 'LIVE_WEATHER',
      cachedAt: nowIso,
      fromCache: false,
      historicalBaseline: baseline.historicalBaseline,
    };

    await weatherCacheService.setOpenMeteo(lat, lon, result);
    return result;
  } catch {
    return baseline;
  } finally {
    globalThis.clearTimeout(timer);
  }
}
