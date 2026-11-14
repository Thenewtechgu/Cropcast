import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, MapPin, RotateCcw, Sprout } from 'lucide-react';
import { AdminFieldSummary } from '../types';
import { getLocalizedRegionName } from '../data/nasaVietnamGrid';
import { getPlantDisplayName } from '../data/cropTaxonomy';
import { getSoilLabel } from '../services/agronomyEngine';
import { useLanguage } from '../contexts/LanguageContext';

interface AdminVietnamFarmsMapProps {
  fields: AdminFieldSummary[];
  onInspectField: (field: AdminFieldSummary) => void;
}

const REGION_BOUNDS = {
  northMinLat: 20.0,
  centralMinLat: 11.4,
};

function getFieldRegionKey(lat: number): 'north' | 'central' | 'south' {
  if (lat >= REGION_BOUNDS.northMinLat) return 'north';
  if (lat >= REGION_BOUNDS.centralMinLat) return 'central';
  return 'south';
}

function getMarkerColor(cropName: string): string {
  const lower = cropName.toLowerCase();
  if (lower.includes('lúa') || lower.includes('rice')) return '#16a34a'; // emerald
  if (lower.includes('ngô') || lower.includes('bắp') || lower.includes('corn') || lower.includes('maize')) return '#d97706'; // amber
  if (lower.includes('cà phê') || lower.includes('tiêu') || lower.includes('sầu riêng') || lower.includes('điều')) return '#7c3aed'; // violet
  if (lower.includes('lạc') || lower.includes('đậu') || lower.includes('peanut') || lower.includes('soy')) return '#0284c7'; // sky
  if (lower.includes('dưa') || lower.includes('melon') || lower.includes('bí')) return '#e11d48'; // rose
  return '#059669'; // teal/green default
}

export const AdminVietnamFarmsMap: React.FC<AdminVietnamFarmsMapProps> = ({
  fields,
  onInspectField,
}) => {
  const { lang, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const layersRef = useRef<{
    street: L.TileLayer;
    satellite: L.TileLayer;
    labels: L.TileLayer;
  } | null>(null);

  const [basemap, setBasemap] = useState<'street' | 'satellite'>('street');
  const [regionFilter, setRegionFilter] = useState<'all' | 'north' | 'central' | 'south'>('all');
  const [cropFilter, setCropFilter] = useState<string>('ALL');
  const [selectedPin, setSelectedPin] = useState<AdminFieldSummary | null>(null);
  const onInspectRef = useRef(onInspectField);
  onInspectRef.current = onInspectField;

  const uniqueCrops = useMemo(() => {
    const set = new Set<string>();
    fields.forEach((f) => {
      if (f.cropName) set.add(f.cropName);
    });
    return Array.from(set).sort((a, b) =>
      getPlantDisplayName(a, lang).localeCompare(getPlantDisplayName(b, lang), lang)
    );
  }, [fields, lang]);

  const visibleFields = useMemo(() => {
    return fields.filter((f) => {
      if (!Number.isFinite(f.lat) || !Number.isFinite(f.lon) || (f.lat === 0 && f.lon === 0)) {
        return false;
      }
      if (regionFilter !== 'all' && getFieldRegionKey(f.lat) !== regionFilter) return false;
      if (cropFilter !== 'ALL' && f.cropName !== cropFilter) return false;
      return true;
    });
  }, [fields, regionFilter, cropFilter]);

  const totalVisibleHa = useMemo(
    () => Number(visibleFields.reduce((s, f) => s + (Number(f.areaHa) || 0), 0).toFixed(2)),
    [visibleFields]
  );

  // Initialize Leaflet map centered on Vietnam
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [15.9, 106.8],
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      scrollWheelZoom: true,
    });

    const streetLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'World Street Map', maxZoom: 18 }
    );
    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'World Imagery', maxZoom: 18 }
    );
    const labelsLayer = L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 18, opacity: 0.9 }
    );

    streetLayer.addTo(map);
    const markerGroup = L.layerGroup().addTo(map);

    mapRef.current = map;
    layerGroupRef.current = markerGroup;
    layersRef.current = { street: streetLayer, satellite: satelliteLayer, labels: labelsLayer };

    const tmr = setTimeout(() => map.invalidateSize(), 180);

    return () => {
      clearTimeout(tmr);
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      layersRef.current = null;
    };
  }, []);

  // Switch basemap
  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    if (basemap === 'satellite') {
      if (map.hasLayer(layers.street)) map.removeLayer(layers.street);
      if (!map.hasLayer(layers.satellite)) layers.satellite.addTo(map);
      if (!map.hasLayer(layers.labels)) layers.labels.addTo(map);
    } else {
      if (map.hasLayer(layers.satellite)) map.removeLayer(layers.satellite);
      if (map.hasLayer(layers.labels)) map.removeLayer(layers.labels);
      if (!map.hasLayer(layers.street)) layers.street.addTo(map);
    }
    setTimeout(() => map.invalidateSize(), 50);
  }, [basemap]);

  // Render markers whenever visibleFields or lang changes
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // Subtle reference pins for Vietnam archipelagos (Hoàng Sa & Trường Sa)
    const islands: Array<{ name: string; lat: number; lon: number }> = [
      { name: lang === 'en' ? 'Hoàng Sa Archipelago' : 'Quần đảo Hoàng Sa', lat: 16.53, lon: 111.61 },
      { name: lang === 'en' ? 'Trường Sa Archipelago' : 'Quần đảo Trường Sa', lat: 10.72, lon: 114.85 },
    ];
    islands.forEach((isl) => {
      L.circleMarker([isl.lat, isl.lon], {
        radius: 4,
        color: '#0f766e',
        weight: 1.5,
        fillColor: '#14b8a6',
        fillOpacity: 0.35,
      })
        .bindTooltip(isl.name, { direction: 'top' })
        .addTo(group);
    });

    visibleFields.forEach((f) => {
      const color = getMarkerColor(f.cropName);
      const pinIcon = L.divIcon({
        className: 'admin-farm-pin',
        html: `<div style="width:18px;height:18px;border-radius:9999px;background:${color};border:2.5px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.45);cursor:pointer;"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = L.marker([f.lat, f.lon], { icon: pinIcon });
      const localizedProv = getLocalizedRegionName(f.province, lang);
      const cropLabel = getPlantDisplayName(f.cropName, lang);

      marker.bindTooltip(
        `<div style="font-size:11px;line-height:1.35;">
          <strong>${f.name.replace(/</g, '&lt;')}</strong><br/>
          ${cropLabel.replace(/</g, '&lt;')} · ${f.areaHa} ha<br/>
          ${localizedProv.replace(/</g, '&lt;')} · ${f.ownerName.replace(/</g, '&lt;')}
        </div>`,
        { direction: 'top', offset: [0, -6] }
      );

      marker.on('click', () => {
        setSelectedPin(f);
      });

      marker.addTo(group);
    });
  }, [visibleFields, lang]);

  const handleResetView = () => {
    const map = mapRef.current;
    if (!map) return;
    if (visibleFields.length > 0) {
      const bounds = L.latLngBounds(visibleFields.map((f) => [f.lat, f.lon] as [number, number]));
      map.fitBounds(bounds.pad(0.25), { maxZoom: 10, animate: true });
    } else {
      map.setView([15.9, 106.8], 5, { animate: true });
    }
  };

  const handleFullVietnamView = () => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([15.9, 106.8], 5, { animate: true });
  };

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-700" />
            {t('Bản đồ Phân bố Thửa ruộng Toàn Việt Nam', 'Vietnam Farm Distribution Map')}
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            {t(
              'Vị trí thực tế tất cả các ruộng nông dân đang hoạt động trên bản đồ Việt Nam (bao gồm Hoàng Sa & Trường Sa). Nhấn vào từng điểm ghim để xem nhanh hoặc mở chi tiết.',
              'Live geographic distribution of all registered farms across Vietnam (including Hoàng Sa & Trường Sa). Click any marker to preview or inspect.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value as any)}
            className="px-3 py-1.5 border border-stone-200 rounded-lg bg-stone-50 text-stone-800 font-medium"
          >
            <option value="all">{t('Toàn quốc', 'All Regions')}</option>
            <option value="north">{t('Miền Bắc', 'Northern Vietnam')}</option>
            <option value="central">{t('Miền Trung & Tây Nguyên', 'Central & Highlands')}</option>
            <option value="south">{t('Miền Nam & ĐBSCL', 'Southern & Mekong')}</option>
          </select>

          <select
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
            className="px-3 py-1.5 border border-stone-200 rounded-lg bg-stone-50 text-stone-800 font-medium"
          >
            <option value="ALL">{t('Mọi cây trồng', 'All Crops')}</option>
            {uniqueCrops.map((c) => (
              <option key={c} value={c}>
                {getPlantDisplayName(c, lang)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleResetView}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5" />
            {t('Thu gọn theo ruộng', 'Fit Farms')}
          </button>

          <button
            type="button"
            onClick={handleFullVietnamView}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('Toàn cảnh VN', 'Full Vietnam')}
          </button>
        </div>
      </div>

      {/* Summary Strip above Map */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600">
        <div className="flex flex-wrap items-center gap-3">
          <span>
            {t('Đang hiển thị:', 'Showing:')}{' '}
            <strong className="font-mono tabular-nums text-stone-900">
              {visibleFields.length}
            </strong>{' '}
            {t('thửa ruộng', 'farms')}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {t('Tổng diện tích:', 'Total area:')}{' '}
            <strong className="font-mono tabular-nums text-emerald-800">
              {totalVisibleHa} ha
            </strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" />
            {t('Lúa', 'Rice')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
            {t('Ngô / Bắp', 'Maize')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block" />
            {t('Họ Đậu', 'Legumes')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
            {t('Dưa / Bầu bí', 'Cucurbits')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-600 inline-block" />
            {t('Công nghiệp / Ăn quả', 'Industrial / Fruit')}
          </span>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="relative w-full h-[380px] sm:h-[440px] rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
        <div ref={containerRef} className="w-full h-full z-10" />

        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-xs p-1 rounded-lg border border-stone-200 shadow-sm text-[11px]">
          <button
            type="button"
            onClick={() => setBasemap('street')}
            className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
              basemap === 'street'
                ? 'bg-emerald-800 text-white'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            {t('Bản đồ hành chính', 'Street Map')}
          </button>
          <button
            type="button"
            onClick={() => setBasemap('satellite')}
            className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
              basemap === 'satellite'
                ? 'bg-emerald-800 text-white'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            {t('Ảnh vệ tinh', 'Satellite')}
          </button>
        </div>

        {visibleFields.length === 0 && (
          <div className="absolute inset-x-4 bottom-4 z-20 bg-white/95 border border-stone-200 rounded-xl p-3 text-xs text-stone-600 text-center">
            {t(
              'Chưa có thửa ruộng nào khớp bộ lọc vùng/cây trồng hiện tại trên bản đồ.',
              'No registered farms match the current region/crop filters on the map.'
            )}
          </div>
        )}
      </div>

      {/* Quick Preview Bar when a marker is clicked */}
      {selectedPin && (
        <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="font-bold text-stone-900 flex items-center gap-1.5">
              <Sprout className="w-4 h-4 text-emerald-700" />
              <span>{selectedPin.name}</span>
              <span className="text-stone-400">·</span>
              <span className="font-mono text-emerald-800 tabular-nums">{selectedPin.areaHa} ha</span>
            </div>
            <div className="text-stone-600">
              {selectedPin.district ? `${selectedPin.district}, ` : ''}
              {getLocalizedRegionName(selectedPin.province, lang)} ·{' '}
              {getPlantDisplayName(selectedPin.cropName, lang)} ·{' '}
              {getSoilLabel(selectedPin.soilType, lang)} · {t('Chủ:', 'Owner:')}{' '}
              <strong className="text-stone-900">{selectedPin.ownerName}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onInspectRef.current(selectedPin)}
              className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold cursor-pointer"
            >
              {t('Xem chi tiết thửa', 'Inspect Field')}
            </button>
            <button
              type="button"
              onClick={() => setSelectedPin(null)}
              className="px-2.5 py-1.5 bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 rounded-lg font-semibold cursor-pointer"
            >
              {t('Đóng', 'Close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
