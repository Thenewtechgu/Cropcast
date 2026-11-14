import React, { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  Satellite,
  Compass,
  Navigation,
  Info,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  findNearestNasaGrid,
  getLocalizedRegionName,
  isWithinVietnamTerritory,
} from '../data/nasaVietnamGrid';
import {
  VIETNAM_PROVINCES,
  findDistrictInProvince,
  findNearestAdminLocation,
  findProvinceByName,
  getDistrictsForProvince,
} from '../data/vietnamLocations';
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
  const [selectedProvince, setSelectedProvince] = useState('Hà Nội');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [mapZoom, setMapZoom] = useState(13);
  const [flyToTrigger, setFlyToTrigger] = useState(0);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const nextLat = selectedLat || 21.03;
      const nextLon = selectedLon || 105.85;
      setCurrentLat(nextLat);
      setCurrentLon(nextLon);
      const nearestAdmin = findNearestAdminLocation(nextLat, nextLon);
      setSelectedProvince(nearestAdmin.province.name);
      setSelectedDistrict(nearestAdmin.district?.name || '');
      setMapZoom(13);
      setFlyToTrigger((v) => v + 1);
      setGpsMessage(null);
      setLocationError(null);
    }
  }, [isOpen, selectedLat, selectedLon]);

  if (!isOpen) return null;

  const districtOptions = getDistrictsForProvince(selectedProvince);
  const handleProvinceChange = (provName: string) => {
    setSelectedProvince(provName);
    setSelectedDistrict('');
    setLocationError(null);
    const prov = findProvinceByName(provName);
    if (prov) {
      setCurrentLat(prov.lat);
      setCurrentLon(prov.lon);
      setMapZoom(11);
      setFlyToTrigger((v) => v + 1);
    }
  };
  const handleDistrictChange = (distName: string) => {
    setSelectedDistrict(distName);
    setLocationError(null);
    const dist = findDistrictInProvince(selectedProvince, distName);
    if (dist) {
      setCurrentLat(dist.lat);
      setCurrentLon(dist.lon);
      setMapZoom(13);
      setFlyToTrigger((v) => v + 1);
    }
  };

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
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = Number(pos.coords.latitude.toFixed(5));
        const nextLon = Number(pos.coords.longitude.toFixed(5));
        setGpsLoading(false);

        const check = isWithinVietnamTerritory(nextLat, nextLon);
        if (!check.valid) {
          setLocationError(
            lang === 'en'
              ? check.reasonEn || 'GPS location is outside Vietnamese territory. Please pick a location inside Vietnam.'
              : check.reasonVi || 'Vị trí GPS nằm ngoài lãnh thổ Việt Nam. Vui lòng chọn lại vị trí trong Việt Nam và thử lại.'
          );
          return;
        }

        setCurrentLat(nextLat);
        setCurrentLon(nextLon);
        const nearestAdmin = findNearestAdminLocation(nextLat, nextLon);
        setSelectedProvince(nearestAdmin.province.name);
        setSelectedDistrict(nearestAdmin.district?.name || '');
        setMapZoom(14);
        setFlyToTrigger((v) => v + 1);
        setGpsMessage(
          t(
            `Đã lấy vị trí GPS của thiết bị (độ chính xác ~${Math.round(pos.coords.accuracy)} m) và tự động khớp vùng khí hậu gần nhất.`,
            `Located via device GPS (accuracy ~${Math.round(pos.coords.accuracy)} m) and matched nearest climate zone.`
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
    const check = isWithinVietnamTerritory(currentLat, currentLon);
    if (!check.valid) {
      setLocationError(
        lang === 'en'
          ? check.reasonEn || 'Selected coordinates are outside Vietnamese territory. Please select a location inside Vietnam.'
          : check.reasonVi || 'Vị trí bạn chọn nằm ngoài lãnh thổ Việt Nam. Vui lòng chọn một vị trí trong Việt Nam và thử lại.'
      );
      return;
    }
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
                  'Chạm vào bản đồ vệ tinh trong lãnh thổ Việt Nam hoặc dùng GPS để xác định tọa độ ruộng',
                  'Tap inside Vietnamese territory on the map or use GPS to set your field coordinates'
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
                  'Chạm vào vị trí ruộng tại Việt Nam để đặt ghim',
                  'Tap a location inside Vietnam to place your field pin'
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
              zoom={mapZoom}
              flyToTrigger={flyToTrigger}
              heightClass="h-[260px] sm:h-[440px]"
              interactive={true}
              showNasaGrid={true}
              onLocationChange={(lat, lon) => {
                setCurrentLat(lat);
                setCurrentLon(lon);
                const nearestAdmin = findNearestAdminLocation(lat, lon);
                setSelectedProvince(nearestAdmin.province.name);
                setSelectedDistrict(nearestAdmin.district?.name || '');
                setLocationError(null);
              }}
              onInvalidLocation={(reason) => {
                setLocationError(reason);
                setGpsMessage(null);
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
                {t('Điểm tham chiếu khí hậu gần nhất', 'Nearest climate reference')}
              </span>
              <span className="text-amber-700 font-semibold font-mono tabular-nums">
                {t('Khoảng cách:', 'Distance:')} {distanceKm} km
              </span>
            </div>

            {locationError && (
              <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{locationError}</span>
              </div>
            )}

            {gpsMessage && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                {gpsMessage}
              </div>
            )}
          </div>

          {/* Right: Coordinates & Nearest Climate Info */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* Cascading Province & District selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                <div>
                  <label className="text-stone-700 font-bold block mb-1">
                    {t('Tỉnh / Thành phố:', 'Province / City:')}
                  </label>
                  <select
                    value={selectedProvince}
                    onChange={(e) => handleProvinceChange(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-stone-300 bg-white text-stone-900 font-semibold text-base sm:text-xs"
                  >
                    {VIETNAM_PROVINCES.map((p) => (
                      <option key={p.name} value={p.name}>
                        {lang === 'en' ? p.nameEn : p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-stone-700 font-bold block mb-1">
                    {t('Quận / Huyện / Thị xã:', 'District / Town:')}
                  </label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-stone-300 bg-white text-stone-900 font-semibold text-base sm:text-xs"
                  >
                    <option value="">{t('-- Chọn Quận/Huyện --', '-- Select District --')}</option>
                    {districtOptions.map((d) => (
                      <option key={d.name} value={d.name}>
                        {lang === 'en' ? d.nameEn : d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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
                    onChange={e => {
                      setCurrentLat(parseFloat(e.target.value) || 0);
                      setLocationError(null);
                    }}
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
                    onChange={e => {
                      setCurrentLon(parseFloat(e.target.value) || 0);
                      setLocationError(null);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white font-mono font-bold text-stone-900 tabular-nums"
                  />
                </div>
              </div>

              {/* Nearest Climate Reference Match */}
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">
                    {t('Hồ sơ Khí hậu Vùng (2001–2026)', 'Regional Climate Profile (2001–2026)')}
                  </span>
                  <span className="text-xs font-mono text-emerald-800 font-bold">
                    {distanceKm} km
                  </span>
                </div>

                <div className="text-sm font-bold text-stone-900">
                  {getLocalizedRegionName(nearestCell.region, lang)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                    <div className="text-stone-500 text-[11px]">
                      {t('Nhiệt độ TB 26 năm:', '26-yr mean temp:')}
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
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                    <div className="text-stone-500 text-[11px]">
                      {t('Độ ẩm không khí TB:', 'Mean humidity:')}
                    </div>
                    <div className="font-bold text-stone-800 font-mono tabular-nums">
                      {nearestCell.climatology21Yr.avgRh2m}%
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                    <div className="text-stone-500 text-[11px]">
                      {t('Ẩm đất tầng rễ TB:', 'Mean root moisture:')}
                    </div>
                    <div className="font-bold text-amber-700 font-mono tabular-nums">
                      {Math.round(nearestCell.climatology21Yr.avgGwetroot * 100)}%
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-emerald-900 leading-relaxed flex items-start gap-1.5">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
                  <span>
                    {t(
                      'Ảnh vệ tinh giúp bạn nhận diện đúng bờ thửa, mương nước tại Việt Nam. Tọa độ ruộng tự động liên kết dữ liệu thời tiết hiện tại và chuỗi khí hậu 26 năm (2001–2026) để tư vấn tưới và lịch gieo trồng.',
                      'Satellite imagery helps pinpoint field borders and canals in Vietnam. Coordinates automatically pair live weather with 26-year (2001–2026) climate trends for irrigation and planting guidance.'
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
