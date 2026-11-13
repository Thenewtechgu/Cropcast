import React, { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  Satellite,
  Compass,
  Navigation,
  Info,
  Loader2,
} from 'lucide-react';
import { findNearestNasaGrid, getLocalizedRegionName } from '../data/nasaVietnamGrid';
import { SatelliteMap } from './SatelliteMap';
import { useLanguage } from '../contexts/LanguageContext';

interface InteractiveMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLat: number;
  selectedLon: number;
  onSelectCoordinates: (lat: number, lon: number) => void;
}

export const InteractiveMapModal: React.FC<InteractiveMapModalProps> = ({
  isOpen,
  onClose,
  selectedLat,
  selectedLon,
  onSelectCoordinates,
}) => {
  const { lang, t } = useLanguage();
  const [currentLat, setCurrentLat] = useState(selectedLat || 21.03);
  const [currentLon, setCurrentLon] = useState(selectedLon || 105.85);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentLat(selectedLat || 21.03);
      setCurrentLon(selectedLon || 105.85);
      setGpsMessage(null);
    }
  }, [isOpen, selectedLat, selectedLon]);

  if (!isOpen) return null;

  const { cell: nearestCell, distanceKm } = findNearestNasaGrid(currentLat, currentLon);

  const handleUseDeviceGps = () => {
    if (!navigator.geolocation) {
      setGpsMessage(
        t(
          'Thiết bị hoặc trình duyệt hiện tại không hỗ trợ định vị GPS.',
          'Your device or browser does not support GPS geolocation.'
        )
      );
      return;
    }
    setGpsLoading(true);
    setGpsMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = Number(pos.coords.latitude.toFixed(5));
        const nextLon = Number(pos.coords.longitude.toFixed(5));
        setCurrentLat(nextLat);
        setCurrentLon(nextLon);
        setGpsLoading(false);
        setGpsMessage(
          t(
            `Đã lấy vị trí GPS của thiết bị (độ chính xác ~${Math.round(pos.coords.accuracy)} m) và tự động khớp điểm khí hậu gần nhất.`,
            `Located via device GPS (accuracy ~${Math.round(pos.coords.accuracy)} m) and matched nearest climate grid cell.`
          )
        );
      },
      () => {
        setGpsLoading(false);
        setGpsMessage(
          t(
            'Không thể truy cập GPS (vui lòng cấp quyền vị trí trên trình duyệt hoặc chọn trực tiếp trên ảnh vệ tinh).',
            'Unable to access GPS (please allow location access or tap directly on the satellite map).'
          )
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleApplyCoordinates = () => {
    onSelectCoordinates(currentLat, currentLon);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[92dvh] overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-emerald-900 text-white flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center">
              <Satellite className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {t('Bản đồ Ảnh Vệ tinh & Định vị Thửa ruộng', 'Satellite Imagery & Field Location Picker')}
              </h2>
              <p className="text-xs text-emerald-200">
                {t(
                  'Chạm vào bản đồ vệ tinh hoặc dùng GPS thiết bị để xác định tọa độ và điểm dữ liệu khí hậu gần nhất',
                  'Tap on the satellite map or use device GPS to set coordinates and match the nearest NASA climate grid'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition cursor-pointer"
            aria-label={t('Đóng bản đồ', 'Close map')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Real Satellite Map */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-stone-700">
                <Compass className="w-4 h-4 text-emerald-700" />{' '}
                {t(
                  'Chạm vào bất kỳ vị trí nào trên ảnh vệ tinh để đặt ghim ruộng',
                  'Tap anywhere on the satellite imagery to place your field pin'
                )}
              </span>
              <button
                type="button"
                onClick={handleUseDeviceGps}
                disabled={gpsLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-stone-950 font-bold rounded-lg text-xs transition cursor-pointer"
              >
                {gpsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                {gpsLoading ? t('Đang định vị...', 'Locating...') : t('Lấy GPS thiết bị', 'Use Device GPS')}
              </button>
            </div>

            <SatelliteMap
              lat={currentLat}
              lon={currentLon}
              zoom={13}
              heightClass="h-[260px] sm:h-[440px]"
              interactive={true}
              showNasaGrid={true}
              onLocationChange={(lat, lon) => {
                setCurrentLat(lat);
                setCurrentLon(lon);
              }}
              fieldLabel={t('Vị trí ruộng đã chọn', 'Selected Field Location')}
            />

            <div className="flex flex-wrap items-center justify-between text-xs text-stone-500 px-1 gap-2">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500 border border-stone-800 inline-block" />{' '}
                {t('Vị trí thửa ruộng', 'Field location')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 border border-stone-800 inline-block" />{' '}
                {t('Điểm tham chiếu khí hậu gần nhất', 'Nearest climate grid')}
              </span>
              <span className="text-amber-700 font-semibold font-mono tabular-nums">
                {t('Khoảng cách:', 'Distance:')} {distanceKm} km
              </span>
            </div>

            {gpsMessage && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                {gpsMessage}
              </div>
            )}
          </div>

          {/* Right: Coordinates, Quick Presets & Nearest Climate Grid Info */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* Coordinates manual input */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                <div>
                  <label className="text-stone-600 font-medium block mb-1">
                    {t('Vĩ độ (°Bắc):', 'Latitude (°N):')}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={currentLat}
                    onChange={e => setCurrentLat(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white font-mono font-bold text-stone-900 tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-stone-600 font-medium block mb-1">
                    {t('Kinh độ (°Đông):', 'Longitude (°E):')}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={currentLon}
                    onChange={e => setCurrentLon(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white font-mono font-bold text-stone-900 tabular-nums"
                  />
                </div>
              </div>

              {/* Nearest NASA Grid Cell Match */}
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">
                    {t('Điểm Khí hậu Gần Nhất', 'Nearest Climate Grid')}
                  </span>
                  <span className="text-xs font-mono text-emerald-800 font-bold">
                    {nearestCell.cellId}
                  </span>
                </div>

                <div className="text-sm font-bold text-stone-900">
                  {getLocalizedRegionName(nearestCell.region, lang)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                    <div className="text-stone-500 text-[11px]">
                      {t('Tọa độ tâm lưới:', 'Grid center:')}
                    </div>
                    <div className="font-bold text-stone-800 font-mono tabular-nums">
                      {nearestCell.lat}°{lang === 'en' ? 'N' : 'B'}, {nearestCell.lon}°{lang === 'en' ? 'E' : 'Đ'}
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                    <div className="text-stone-500 text-[11px]">
                      {t('Cách thửa ruộng:', 'Distance to field:')}
                    </div>
                    <div className="font-bold text-amber-700 font-mono tabular-nums">{distanceKm} km</div>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                    <div className="text-stone-500 text-[11px]">
                      {t('Nhiệt độ TB nhiều năm:', '21-yr mean temp:')}
                    </div>
                    <div className="font-bold text-stone-800 font-mono tabular-nums">
                      {nearestCell.climatology21Yr.avgTemp}°C
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                    <div className="text-stone-500 text-[11px]">
                      {t('Lượng mưa năm TB:', 'Mean annual rain:')}
                    </div>
                    <div className="font-bold text-stone-800 font-mono tabular-nums">
                      {nearestCell.climatology21Yr.annualRainfallMm} mm
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-emerald-900 leading-relaxed flex items-start gap-1.5">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
                  <span>
                    {t(
                      'Ảnh vệ tinh giúp bạn nhận diện đúng bờ thửa, mương nước và khu vực trồng trọt. Hệ thống tự động ghép tọa độ ruộng với dữ liệu khí hậu 21 năm gần nhất để tư vấn mùa vụ.',
                      'Satellite imagery helps pinpoint field borders, canals, and plots. Coordinates automatically link to the nearest 21-year NASA climate grid for seasonal advisories.'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 transition cursor-pointer"
              >
                {t('Hủy bỏ', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleApplyCoordinates}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <MapPin className="w-4 h-4" /> {t('Xác nhận vị trí này', 'Confirm Location')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
