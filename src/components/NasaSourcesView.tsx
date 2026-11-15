import React from 'react';
import {
  Satellite,
  Database,
  Droplets,
  Sprout,
  Cloud,
  Thermometer,
  Wind,
  Bot,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Layers,
  Globe,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { AdvisoryDisclaimer } from './AdvisoryDisclaimer';

interface NasaSourcesViewProps {
  onNavigateTab: (tab: string) => void;
}

interface DatasetMapping {
  id: string;
  name: string;
  provider: string;
  cadence: string;
  parameters: string[];
  cropCastFeatureVi: string;
  cropCastFeatureEn: string;
  detailsVi: string;
  detailsEn: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCls: string;
}

export const NasaSourcesView: React.FC<NasaSourcesViewProps> = ({ onNavigateTab }) => {
  const { lang, t } = useLanguage();

  const datasets: DatasetMapping[] = [
    {
      id: 'nasa-power',
      name: 'NASA POWER (Prediction Of Worldwide Energy Resources)',
      provider: 'NASA Langley Research Center (LaRC)',
      cadence: t('Hằng ngày & Trung bình tháng (2001–2026)', 'Daily & Monthly Series (2001–2026)'),
      parameters: ['T2M', 'T2M_MIN', 'T2M_MAX', 'PRECTOTCORR', 'GWETROOT', 'GWETTOP', 'RH2M', 'ALLSKY_SFC_SW_DWN'],
      cropCastFeatureVi: 'Biểu đồ Xu hướng Khí hậu 26 năm · Lịch Thời vụ 12 tháng · Chuỗi dữ liệu ngày CSV (2001–2026)',
      cropCastFeatureEn: '26-Year Climate Trend Charts · 12-Month Planting Calendar · Daily 2001–2026 CSV Pipeline',
      detailsVi:
        'Cung cấp chuỗi nhiệt độ không khí, bức xạ mặt trời, độ ẩm tương đối và độ ẩm đất tầng mặt/tầng rễ liên tục từ 01/01/2001 tới hiện tại cho từng ô lưới 0.5°×0.625° tại Việt Nam, làm nền so sánh thời tiết hôm nay với lịch sử 26 năm.',
      detailsEn:
        'Supplies continuous daily and monthly temperature, solar radiation, relative humidity, and surface/root-zone soil wetness since 2001-01-01 per Vietnam grid cell to benchmark live conditions against a 26-year historical baseline.',
      url: 'https://power.larc.nasa.gov/',
      icon: Thermometer,
      badgeCls: 'bg-amber-100 text-amber-900 border-amber-200',
    },
    {
      id: 'nasa-smap',
      name: 'NASA SMAP (Soil Moisture Active Passive · SPL3SMP_E)',
      provider: 'NASA Jet Propulsion Laboratory (JPL) & GSFC',
      cadence: t('Hằng ngày · Độ phân giải 9 km', 'Daily Enhanced 9 km Grid'),
      parameters: ['Soil Moisture (0–5 cm)', 'Surface Saturation', 'Drainage Drop-off Index'],
      cropCastFeatureVi: 'Bộ ước tính Tốc độ Thoát nước Đất tự động · Thẻ Độ ẩm Tầng mặt & Tưới tiêu Tổng quan',
      cropCastFeatureEn: 'Automated Soil Drainage Estimator · Overview Topsoil Moisture & Calibrated Irrigation Gauge',
      detailsVi:
        'Kết hợp độ ẩm đất tầng mặt 0–5 cm từ SMAP với lượng mưa 7 ngày để đánh giá thửa ruộng thoát nước nhanh, trung bình hay giữ nước chậm/dễ úng, tự động điều chỉnh lịch tưới và cảnh báo ngập rễ.',
      detailsEn:
        'Pairs 0–5 cm topsoil moisture from SMAP with 7-day rainfall accumulation to classify plot drainage speed (fast, moderate, or slow/waterlogged) and adapt daily watering alerts.',
      url: 'https://smap.jpl.nasa.gov/',
      icon: Droplets,
      badgeCls: 'bg-sky-100 text-sky-900 border-sky-200',
    },
    {
      id: 'nasa-gpm',
      name: 'NASA GPM IMERG (Global Precipitation Measurement)',
      provider: 'NASA Goddard Space Flight Center (GSFC) & JAXA',
      cadence: t('Tích lũy 7 ngày & Chuỗi mưa ngày', '7-Day Rolling Accumulation & Daily Series'),
      parameters: ['GPM Precipitation (mm)', 'Heavy Storm Flag', 'Runoff Balance'],
      cropCastFeatureVi: 'Cảnh báo Mưa lớn & Ngập úng · Bộ tính Rủi ro Xói mòn Đất & Rửa trôi phân bón',
      cropCastFeatureEn: 'Heavy Rain & Flood Alerts · Surface Runoff & Fertilizer Leaching Risk Estimator',
      detailsVi:
        'Đo lượng mưa vệ tinh đa cảm biến giúp tính tổng lượng mưa 7 ngày gần nhất tại tọa độ thửa ruộng, hỗ trợ tạm hoãn bón phân trước mưa lớn và phát hiện tháng dễ xói mòn.',
      detailsEn:
        'Multi-satellite precipitation retrievals power 7-day rainfall totals at field coordinates, triggering rain-ahead fertilizer holds and identifying erosion-prone fallow windows.',
      url: 'https://gpm.nasa.gov/',
      icon: Cloud,
      badgeCls: 'bg-blue-100 text-blue-900 border-blue-200',
    },
    {
      id: 'nasa-modis',
      name: 'NASA MODIS Vegetation Indices (MOD13Q1 NDVI)',
      provider: 'NASA EOSDIS / Terra & Aqua Satellites',
      cadence: t('Chu kỳ 16 ngày · 250 m', '16-Day Composite · 250 m'),
      parameters: ['NDVI Canopy Greenness', 'Bare-Soil Cover Ratio', 'Cover Crop Signal'],
      cropCastFeatureVi: 'Thẻ Độ xanh Tán lá (NDVI) · Phát hiện Tháng Đất trống trong Trình khám phá Luân canh',
      cropCastFeatureEn: 'Canopy Greenness Card (NDVI) · Annual Bare-Soil Window Detector in Rotation Explorer',
      detailsVi:
        'Theo dõi mật độ che phủ xanh của tán cây trên ruộng: khi NDVI thấp kèm đất trống, hệ thống gợi ý xen canh cây họ Đậu hoặc phủ rơm rạ để giảm bốc hơi và chống rửa trôi đất mặt.',
      detailsEn:
        'Tracks vegetative canopy density: low NDVI or bare-soil windows prompt legume cover cropping and straw mulching to protect topsoil and conserve moisture.',
      url: 'https://modis.gsfc.nasa.gov/',
      icon: Sprout,
      badgeCls: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    },
    {
      id: 'nasa-oco2',
      name: 'NASA OCO-2 & OCO-3 (Orbiting Carbon Observatory · SIF & XCO₂)',
      provider: 'NASA JPL Carbon Cycle Science',
      cadence: t('Chuỗi xu hướng tháng & Chỉ số quang hợp', 'Monthly Trend & Canopy SIF Index'),
      parameters: ['SIF (W/m²/sr/µm)', 'XCO₂ (ppm)', 'Carbon Uptake (t CO₂/ha/yr)'],
      cropCastFeatureVi: 'Bảng Hấp thụ Carbon & Quang hợp (Dashboard & Rotation Explorer) · Nhắc kiểm tra diệp lục',
      cropCastFeatureEn: 'Carbon Uptake & Photosynthesis Panel · Chlorophyll & Nutrient Stress Alerts',
      detailsVi:
        'Huỳnh quang diệp lục cảm ứng mặt trời (SIF) phản ánh cường độ quang hợp thực của tán cây, kết hợp với tốc độ tích lũy carbon hữu cơ để phát hiện sớm stress nắng/thiếu dinh dưỡng.',
      detailsEn:
        'Solar-Induced Chlorophyll Fluorescence (SIF) indicates real-time photosynthetic activity and carbon uptake efficiency, surfacing early canopy stress or nutrient gaps.',
      url: 'https://ocov2.jpl.nasa.gov/',
      icon: Layers,
      badgeCls: 'bg-teal-100 text-teal-900 border-teal-200',
    },
    {
      id: 'nasa-grace',
      name: 'NASA / DLR GRACE-FO (Tellus JPL Mascon Groundwater Anomaly)',
      provider: 'NASA JPL & German Aerospace Center (GFZ/DLR)',
      cadence: t('Hằng tháng · Dị thường trữ lượng nước ngầm (cm LWE)', 'Monthly Liquid Water Equivalent (cm LWE)'),
      parameters: ['LWE Thickness Anomaly (cm)', 'Root Water Balance (%)', 'Recharge Status'],
      cropCastFeatureVi: 'Thẻ Trữ lượng Nước ngầm · Cảnh báo hạn chế bơm giếng sâu & Chuyển tưới tiết kiệm',
      cropCastFeatureEn: 'Groundwater Reserve Card · Deep-Pump Conservation & Precision Drip Triggers',
      detailsVi:
        'Đo biến thiên trữ lượng nước tầng ngầm khu vực theo đơn vị cm nước tương đương (LWE). Khi nước ngầm suy giảm, CropCast ưu tiên cây chịu hạn và phương án tưới nhỏ giọt/AWD.',
      detailsEn:
        'Monitors regional aquifer storage anomalies in cm LWE. Declining anomalies shift CropCast recommendations toward drought-resilient rotation crops and water-saving drip/AWD schedules.',
      url: 'https://gracefo.jpl.nasa.gov/',
      icon: Database,
      badgeCls: 'bg-indigo-100 text-indigo-900 border-indigo-200',
    },
    {
      id: 'prism-dryness',
      name: 'PRISM / Atmospheric Moisture & Evapotranspiration Model',
      provider: 'PRISM Climate Group Methodology + NASA POWER',
      cadence: t('Hằng ngày & Trung bình 26 năm', 'Daily & 26-Year Norm'),
      parameters: ['TDMEAN (°C)', 'VPDmin / VPDmax (hPa)', 'ET₀ FAO (mm/day)'],
      cropCastFeatureVi: 'Cảnh báo Sương đêm nấm lá (Điểm sương) · Sức hút bốc hơi (VPD) trên Bảng điều khiển',
      cropCastFeatureEn: 'Dew-Point Fungal Alert · Vapor Pressure Deficit (VPD) & ET₀ Water Loss Metrics',
      detailsVi:
        'Tính toán điểm sương và mức chênh áp suất hơi (VPD) giúp phân biệt ngày hanh khô mất nước nhanh với đêm ẩm đọng sương dễ phát sinh đạo ôn, sương mai.',
      detailsEn:
        'Computes dew point and vapor pressure deficit (VPD) to distinguish rapid daytime leaf dehydration from humid overnight dew favorable to fungal lesions.',
      url: 'https://prism.oregonstate.edu/',
      icon: Wind,
      badgeCls: 'bg-purple-100 text-purple-900 border-purple-200',
    },
    {
      id: 'us-ghg-center',
      name: 'U.S. Greenhouse Gas Center (STAC API) & EDGAR v8 Agriculture',
      provider: 'NASA / EPA / NOAA / NIST Multi-Agency GHG Center',
      cadence: t('Hằng năm & Chuỗi xu hướng ruộng', 'Annual Inventory & Field Flux Series'),
      parameters: ['CH₄ (kg/ha)', 'N₂O (kg/ha)', 'CO₂eq (t/ha)'],
      cropCastFeatureVi: 'Thẻ Phát thải Khí nhà kính Ruộng · Đề xuất Rút nước xen kẽ (AWD) & Chia nhỏ đạm',
      cropCastFeatureEn: 'Field GHG Emissions Card · Alternate Wetting & Drying (AWD) & Nitrogen Split Advice',
      detailsVi:
        'Ước tính cường độ phát thải CH₄ từ ruộng lúa ngập nước và N₂O từ phân đạm, tự động gợi ý quy trình rút nước giữa vụ AWD và luân canh họ Đậu giúp giảm phân hóa học.',
      detailsEn:
        'Estimates paddy methane (CH₄) and nitrogen-driven nitrous oxide (N₂O) intensity, guiding AWD mid-season drainage and legume rotation to lower fertilizer waste.',
      url: 'https://earth.gov/ghgcenter',
      icon: Globe,
      badgeCls: 'bg-stone-200 text-stone-900 border-stone-300',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <Satellite className="w-4 h-4 text-emerald-600" />
            {t('Minh bạch Khoa học & Dữ liệu Mở', 'Scientific Transparency & Open Earth Data')}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
            {t('Dữ liệu NASA & Nguồn tích hợp trong CropCast', 'NASA Data & Integrated Sources in CropCast')}
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 max-w-3xl leading-relaxed">
            {t(
              'Trang này giải thích rõ từng nguồn dữ liệu vệ tinh NASA, hệ thống khí tượng và trợ lý AI Gemini được dùng ở đâu trong CropCast để phục vụ quyết định tưới, thoát nước, lịch thời vụ và luân canh tại Việt Nam.',
              'This page maps each NASA satellite product, weather service, and Gemini AI component directly to the features it powers inside CropCast.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateTab('analytics')}
            className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition min-h-[44px]"
          >
            {t('Mở Biểu đồ Khí hậu 26 năm', 'Open 26-Year Climate Charts')}
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('dashboard')}
            className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold cursor-pointer transition min-h-[44px]"
          >
            {t('Về Tổng quan Ruộng', 'Field Overview')}
          </button>
        </div>
      </div>

      <AdvisoryDisclaimer />

      {/* Architecture Flow Summary */}
      <div className="bg-emerald-950 text-white rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
          {t('Luồng đồng bộ dữ liệu theo từng thửa ruộng', 'Per-Field Data Grounding Pipeline')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-emerald-900/70 border border-emerald-800 space-y-1.5">
            <div className="font-bold text-emerald-200">
              {t('1. Tọa độ & Lịch sử 2001–2026', '1. Coordinates & 2001–2026 Baseline')}
            </div>
            <p className="text-emerald-100/90 leading-relaxed">
              {t(
                'GPS / ghim bản đồ của thửa ruộng được ghép tự động với điểm lưới NASA POWER gần nhất, nạp chuỗi khí hậu 26 năm và lịch thời vụ 12 tháng.',
                'Your field GPS pin automatically links to the nearest NASA POWER cell, loading 26-year daily climate history and 12-month planting odds.'
              )}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-900/70 border border-emerald-800 space-y-1.5">
            <div className="font-bold text-emerald-200">
              {t('2. Thời tiết tức thời + Vệ tinh Đất-Nước', '2. Live Weather + Land-Water Sensors')}
            </div>
            <p className="text-emerald-100/90 leading-relaxed">
              {t(
                'Mỗi lần đăng nhập, CropCast tự động cập nhật thời tiết thực địa Open-Meteo (nhiệt độ, mưa, ẩm đất, VPD, ET₀) và kết hợp SMAP, GPM, MODIS, OCO-2, GRACE-FO & GHG STAC.',
                'Upon every login, CropCast refreshes live Open-Meteo weather and fuses SMAP, GPM, MODIS, OCO-2, GRACE-FO, and GHG STAC into soil drainage & field tasks.'
              )}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-900/70 border border-emerald-800 space-y-1.5">
            <div className="font-bold text-emerald-200">
              {t('3. Grounding Trợ lý AI Gemini', '3. Gemini AI Context Grounding')}
            </div>
            <p className="text-emerald-100/90 leading-relaxed">
              {t(
                'Mọi thông số NASA, thời tiết hiện tại và phản hồi thăm ruộng của bạn được gửi an toàn qua máy chủ CropCast tới Gemini API để tư vấn bám sát từng thửa ruộng và dịch đa ngữ.',
                'Field NASA metrics, live weather, and farmer feedback are securely passed server-side to the Gemini API to ground agronomic chat, rotation rethinking, and VI↔EN translation.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Explicit Dataset-to-Feature Mapping Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {datasets.map((ds) => {
          const Icon = ds.icon;
          return (
            <article
              key={ds.id}
              className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-stone-900 leading-snug">{ds.name}</h2>
                      <div className="text-[11px] text-stone-500">{ds.provider}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${ds.badgeCls}`}>
                    {ds.cadence}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-0.5">
                    {t('Tính năng sử dụng trong CropCast:', 'Used in CropCast Features:')}
                  </div>
                  <div className="font-semibold text-emerald-950">
                    {lang === 'en' ? ds.cropCastFeatureEn : ds.cropCastFeatureVi}
                  </div>
                </div>

                <p className="text-xs text-stone-700 leading-relaxed">
                  {lang === 'en' ? ds.detailsEn : ds.detailsVi}
                </p>
              </div>

              <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {ds.parameters.map((param) => (
                    <span
                      key={param}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200"
                    >
                      {param}
                    </span>
                  ))}
                </div>
                <a
                  href={ds.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-emerald-800 hover:underline inline-flex items-center gap-1 shrink-0"
                >
                  {t('Trang dữ liệu gốc', 'Official Source')} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </article>
          );
        })}
      </div>

      {/* Gemini AI & Live Weather Section */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        <div className="space-y-2">
          <div className="font-bold text-sm text-stone-900 flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-700" />
            {t('Trợ lý AI Gemini (Cấu hình bảo mật phía máy chủ)', 'Gemini AI Assistant (Secure Server-Side Integration)')}
          </div>
          <p className="text-stone-600 leading-relaxed">
            {t(
              'CropCast sử dụng Google Gemini thông qua API máy chủ bảo mật (biến môi trường GEMINI_API_KEY phía server, không lộ khóa ra trình duyệt) cho 3 tác vụ: (1) Tư vấn nông học theo ngữ cảnh ruộng & NASA; (2) Đề xuất lại phương án luân canh khi nông dân nêu lý do thực tế; (3) Dịch tự động tên cây trồng, thửa ruộng và bài đăng cộng đồng Anh ↔ Việt.',
              'CropCast uses Google Gemini via a secure server-side API route (protected by server-only GEMINI_API_KEY) for: (1) Field & NASA-grounded agronomy chat; (2) Dynamic rotation rethinking when a farmer explains local constraints; (3) Automatic VI ↔ EN translation for custom crop/field names and community discussions.'
            )}
          </p>
        </div>

        <div className="space-y-2">
          <div className="font-bold text-sm text-stone-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            {t('Cam kết Bản quyền & Nội dung Nguyên bản', 'Copyright Compliance & Original Content Statement')}
          </div>
          <p className="text-stone-600 leading-relaxed">
            {t(
              'Nhóm phát triển CropCast xác nhận không sử dụng bất kỳ tài liệu, âm nhạc, hình ảnh hay văn bản có bản quyền nào mà không có sự cho phép. Toàn bộ biểu trưng CropCast, giao diện, mã nguồn và nội dung hướng dẫn đều do nhóm tự thiết kế; dữ liệu khoa học sử dụng từ các kho dữ liệu mở công cộng (NASA Earthdata, U.S. GHG Center, Open-Meteo, OpenStreetMap/ArcGIS/CARTO basemaps).',
              'The CropCast team confirms that no copyrighted materials (music, images, or text) were used without permission. All CropCast logos, UI assets, source code, and advisory copy are original works by the team, integrated strictly with public open-science datasets (NASA Earthdata, U.S. GHG Center, Open-Meteo) and licensed open map tiles.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
