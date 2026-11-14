import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { AlertTriangle, X } from 'lucide-react';
import { findNearestNasaGrid, isWithinVietnamTerritory } from '../data/nasaVietnamGrid';
import { useLanguage } from '../contexts/LanguageContext';

interface SatelliteMapProps {
  lat: number;
  lon: number;
  zoom?: number;
  flyToTrigger?: number;
  heightClass?: string;
  interactive?: boolean;
  showNasaGrid?: boolean;
  validateVietnamBoundary?: boolean;
  onLocationChange?: (lat: number, lon: number) => void;
  onInvalidLocation?: (reason: string) => void;
  fieldLabel?: string;
}

export const SatelliteMap: React.FC<SatelliteMapProps> = ({
  lat,
  lon,
  zoom = 14,
  flyToTrigger = 0,
  heightClass = 'h-64',
  interactive = true,
  showNasaGrid = true,
  validateVietnamBoundary = true,
  onLocationChange,
  onInvalidLocation,
  fieldLabel,
}) => {
  const { lang, t } = useLanguage();
  const displayFieldLabel = fieldLabel || t('Vị trí thửa ruộng', 'Field Location');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    satellite: L.TileLayer;
    osm: L.TileLayer;
    labels: L.TileLayer;
  } | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const prevZoomRef = useRef<number>(zoom);
  const prevTriggerRef = useRef<number>(flyToTrigger);
  const onLocationChangeRef = useRef(onLocationChange);
  const onInvalidLocationRef = useRef(onInvalidLocation);
  const langRef = useRef(lang);

  onLocationChangeRef.current = onLocationChange;
  onInvalidLocationRef.current = onInvalidLocation;
  langRef.current = lang;

  const [basemap, setBasemap] = useState<'satellite' | 'street'>('satellite');
  const [boundaryAlert, setBoundaryAlert] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lon],
      zoom,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      attributionControl: true,
    });

    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'World Imagery',
        maxZoom: 18,
      }
    );

    const labelsLayer = L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 18,
        opacity: 0.85,
      }
    );

    const osmLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'World Street Map',
        maxZoom: 18,
      }
    );

    satelliteLayer.addTo(map);
    labelsLayer.addTo(map);

    const markerGroup = L.layerGroup().addTo(map);

    if (interactive) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const nextLat = Number(e.latlng.lat.toFixed(5));
        const nextLon = Number(e.latlng.lng.toFixed(5));

        if (validateVietnamBoundary) {
          const check = isWithinVietnamTerritory(nextLat, nextLon);
          if (!check.valid) {
            const msg =
              langRef.current === 'en'
                ? check.reasonEn ||
                  'Selected point is outside Vietnamese territory. Please choose a location inside Vietnam and try again.'
                : check.reasonVi ||
                  'Vị trí bạn chọn nằm ngoài lãnh thổ Việt Nam. Vui lòng chọn một vị trí trong Việt Nam và thử lại.';
            setBoundaryAlert(msg);
            onInvalidLocationRef.current?.(msg);
            return;
          }
        }

        setBoundaryAlert(null);
        onLocationChangeRef.current?.(nextLat, nextLon);
      });
    }

    mapRef.current = map;
    layersRef.current = { satellite: satelliteLayer, osm: osmLayer, labels: labelsLayer };
    markersRef.current = markerGroup;

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 180);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // Switch basemap layer cleanly
  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    if (basemap === 'satellite') {
      if (map.hasLayer(layers.osm)) map.removeLayer(layers.osm);
      if (!map.hasLayer(layers.satellite)) layers.satellite.addTo(map);
      if (!map.hasLayer(layers.labels)) layers.labels.addTo(map);
    } else {
      if (map.hasLayer(layers.satellite)) map.removeLayer(layers.satellite);
      if (map.hasLayer(layers.labels)) map.removeLayer(layers.labels);
      if (!map.hasLayer(layers.osm)) layers.osm.addTo(map);
    }
    setTimeout(() => map.invalidateSize(), 60);
  }, [basemap]);

  // Smoothly fly/pan map & redraw active markers when lat/lon/zoom/flyToTrigger updates
  useEffect(() => {
    const map = mapRef.current;
    const group = markersRef.current;
    if (!map || !group) return;

    const zoomChanged = prevZoomRef.current !== zoom;
    const triggerChanged = prevTriggerRef.current !== flyToTrigger;
    prevZoomRef.current = zoom;
    prevTriggerRef.current = flyToTrigger;

    group.clearLayers();
    const targetZoom = zoomChanged || triggerChanged ? zoom : map.getZoom() || zoom;
    map.flyTo([lat, lon], targetZoom, { duration: 0.75 });

    const { cell, distanceKm } = findNearestNasaGrid(lat, lon);

    if (showNasaGrid) {
      const gridBounds: L.LatLngBoundsExpression = [
        [cell.lat - 0.25, cell.lon - 0.25],
        [cell.lat + 0.25, cell.lon + 0.25],
      ];
      L.rectangle(gridBounds, {
        color: '#10b981',
        weight: 1.5,
        dashArray: '4 4',
        fillColor: '#10b981',
        fillOpacity: 0.08,
      }).addTo(group);

      L.polyline(
        [
          [lat, lon],
          [cell.lat, cell.lon],
        ],
        {
          color: '#f59e0b',
          weight: 2,
          dashArray: '5 5',
        }
      ).addTo(group);

      const gridIcon = L.divIcon({
        className: 'custom-climate-pin',
        html: `<div style="width:14px;height:14px;border-radius:9999px;background:#10b981;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.45);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([cell.lat, cell.lon], { icon: gridIcon })
        .bindTooltip(
          lang === 'en'
            ? `Nearest climate reference (${distanceKm} km away)`
            : `Điểm tham chiếu khí hậu gần nhất (cách ${distanceKm} km)`,
          {
            direction: 'top',
          }
        )
        .addTo(group);
    }

    const fieldIcon = L.divIcon({
      className: 'custom-field-pin',
      html: `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;background:#f59e0b;border:3px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.5);">
        <div style="width:6px;height:6px;border-radius:9999px;background:#1c1917;"></div>
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    const latSuffix = lang === 'en' ? 'N' : 'B';
    const lonSuffix = lang === 'en' ? 'E' : 'Đ';
    L.marker([lat, lon], { icon: fieldIcon })
      .bindTooltip(`${displayFieldLabel} (${lat.toFixed(4)}°${latSuffix}, ${lon.toFixed(4)}°${lonSuffix})`, {
        direction: 'top',
      })
      .addTo(group);
  }, [lat, lon, zoom, flyToTrigger, showNasaGrid, displayFieldLabel, lang]);

  return (
    <div className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-stone-300 bg-stone-900`}>
      <div ref={containerRef} className="w-full h-full z-10" />

      {boundaryAlert && (
        <div className="absolute top-12 left-2.5 right-2.5 z-30 bg-rose-50/95 border border-rose-300 text-rose-900 px-3 py-2 rounded-xl shadow-md text-xs flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-semibold leading-snug">{boundaryAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setBoundaryAlert(null)}
            className="p-0.5 rounded hover:bg-rose-100 text-rose-700 cursor-pointer shrink-0"
            aria-label={t('Đóng cảnh báo', 'Dismiss warning')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {interactive && (
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-xs p-1 rounded-lg border border-stone-200 shadow-sm text-[11px]">
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
          <button
            type="button"
            onClick={() => setBasemap('street')}
            className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
              basemap === 'street'
                ? 'bg-emerald-800 text-white'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            {t('Bản đồ đường', 'Street Map')}
          </button>
        </div>
      )}

      <div className="absolute bottom-2 left-2 z-20 bg-stone-950/80 text-white px-2.5 py-1 rounded-md text-[11px] font-mono tabular-nums pointer-events-none">
        {lat.toFixed(4)}°{lang === 'en' ? 'N' : 'B'}, {lon.toFixed(4)}°{lang === 'en' ? 'E' : 'Đ'}
      </div>
    </div>
  );
};
