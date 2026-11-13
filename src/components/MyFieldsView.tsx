import React, { useState } from 'react';
import {
  Sprout,
  Plus,
  MapPin,
  Trash2,
  CheckCircle2,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Navigation,
  Sparkles,
  Info,
  Loader2,
  Satellite,
  AlertCircle,
  Pencil,
  Share2,
  Link2,
  Mail,
  Copy,
  Check,
  X,
  LogIn,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  FieldProfile,
  SoilType,
  WaterSourceType,
  CropCategory,
  SeedFamilyId,
} from '../types';
import {
  SOIL_TYPE_CATALOG,
  getSoilLabel,
  getDrainageLabel,
  getWaterLabel,
} from '../services/agronomyEngine';
import {
  SEED_FAMILIES,
  getSeedFamilyById,
  inferSeedFamilyFromCrop,
  getFamilyDisplayName,
  getFamilyShortTag,
  getFamilySoilImpactNote,
  getPlantDisplayName,
  getCommonStageLabel,
  getCommonVarietyLabel,
} from '../data/cropTaxonomy';
import { findNearestNasaGrid, getLocalizedRegionName } from '../data/nasaVietnamGrid';
import { SatelliteMap } from './SatelliteMap';
import { AppLanguage, useLanguage } from '../contexts/LanguageContext';

interface MyFieldsViewProps {
  fields: FieldProfile[];
  activeField?: FieldProfile;
  isAuthenticated: boolean;
  onSelectField: (id: string) => void;
  onAddNewField: (field: Omit<FieldProfile, 'id' | 'nasaGrid'>) => Promise<void> | void;
  onUpdateField: (field: FieldProfile) => Promise<void> | void;
  onDeleteField: (id: string) => Promise<void> | void;
  onCreateShareLink?: (field: FieldProfile) => Promise<string>;
  onRevokeShareLink?: (field: FieldProfile) => Promise<void>;
  onShareByEmail?: (field: FieldProfile, email: string) => Promise<string>;
  onRemoveSharedEmail?: (fieldId: string, email: string) => Promise<void>;
  onOpenAuthModal?: () => void;
  onOpenMapPicker: (currentLat: number, currentLon: number) => void;
  wizardOpen: boolean;
  setWizardOpen: (open: boolean) => void;
}

export function getWaterObsLabel(obs: string, lang: AppLanguage = 'vi'): string {
  switch (obs) {
    case 'clear':
      return lang === 'en' ? 'Clear water' : 'Nước trong';
    case 'turbid':
      return lang === 'en' ? 'Silt-rich / turbid' : 'Nhiều phù sa / hơi đục';
    case 'odor':
      return lang === 'en' ? 'Unusual odor' : 'Có mùi lạ';
    case 'normal':
    default:
      return lang === 'en' ? 'Normal' : 'Bình thường';
  }
}

export const MyFieldsView: React.FC<MyFieldsViewProps> = ({
  fields,
  activeField,
  isAuthenticated,
  onSelectField,
  onAddNewField,
  onUpdateField,
  onDeleteField,
  onCreateShareLink,
  onRevokeShareLink,
  onShareByEmail,
  onRemoveSharedEmail,
  onOpenAuthModal,
  onOpenMapPicker,
  wizardOpen,
  setWizardOpen,
}) => {
  const { lang, t } = useLanguage();
  const [editingField, setEditingField] = useState<FieldProfile | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [savingField, setSavingField] = useState(false);

  // Share Modal state
  const [shareModalFieldId, setShareModalFieldId] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareEmailInput, setShareEmailInput] = useState('');
  const [shareFeedback, setShareFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const shareModalField = fields.find(f => f.id === shareModalFieldId) || null;

  // Step 1: Location (Required)
  const [name, setName] = useState('');
  const [province, setProvince] = useState('Hà Nội');
  const [district, setDistrict] = useState('');
  const [lat, setLat] = useState<number>(21.03);
  const [lon, setLon] = useState<number>(105.85);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const [areaHa, setAreaHa] = useState(1.0);

  // Step 2: Soil
  const [soilType, setSoilType] = useState<SoilType>('loam');
  const [drainage, setDrainage] = useState<'fast' | 'moderate' | 'slow'>('moderate');
  const [holdsWater, setHoldsWater] = useState(true);
  const [proneToFlooding, setProneToFlooding] = useState(false);
  const [ph, setPh] = useState<number | undefined>(undefined);

  // Step 3: Water
  const [waterSourceType, setWaterSourceType] = useState<WaterSourceType>('pond');
  const [waterStable, setWaterStable] = useState(true);
  const [waterObs, setWaterObs] = useState<'clear' | 'turbid' | 'odor' | 'normal'>('normal');
  const [hasTest, setHasTest] = useState(false);
  const [salinityRisk, setSalinityRisk] = useState(false);

  // Step 4: Seed Family FIRST -> Plant Type -> Variety
  const [seedFamily, setSeedFamily] = useState<SeedFamilyId>('poaceae');
  const [cropName, setCropName] = useState('Lúa nước');
  const [cropCategory, setCropCategory] = useState<CropCategory>('rice');
  const [variety, setVariety] = useState('ST25');
  const [plantingDate, setPlantingDate] = useState(new Date().toISOString().slice(0, 10));
  const [currentStage, setCurrentStage] = useState('Cây con / Mạ non');
  const [farmingMethod, setFarmingMethod] = useState('Tiêu chuẩn an toàn VietGAP');
  const [irrigationMethod, setIrrigationMethod] = useState('Tưới ngập khô xen kẽ');

  // Step 5: Goals
  const [primaryGoal, setPrimaryGoal] = useState<
    'save_water' | 'minimize_risk' | 'stabilize_yield' | 'optimize_cost'
  >('minimize_risk');
  const [inspectTime, setInspectTime] = useState<'morning' | 'afternoon' | 'anytime'>('morning');
  const [notificationMethod, setNotificationMethod] = useState<'in_app' | 'push'>('in_app');

  const selectedFamilyObj = getSeedFamilyById(seedFamily);
  const selectedPlantObj = selectedFamilyObj.plants.find(p => p.name === cropName);
  const nearestGrid = findNearestNasaGrid(lat, lon);

  const handleSelectSeedFamily = (familyId: SeedFamilyId) => {
    setSeedFamily(familyId);
    const fam = getSeedFamilyById(familyId);
    const firstPlant = fam.plants[0];
    if (firstPlant) {
      setCropName(firstPlant.name);
      setCropCategory(firstPlant.category);
      setVariety(firstPlant.commonVarieties[0] || '');
    }
  };

  const handleSelectPlant = (plantName: string) => {
    const found = selectedFamilyObj.plants.find(p => p.name === plantName);
    setCropName(plantName);
    if (found) {
      setCropCategory(found.category);
      setVariety(found.commonVarieties[0] || '');
    }
  };

  const handleUseDeviceGps = () => {
    if (!navigator.geolocation) {
      setGpsNotice(
        t(
          'Trình duyệt không hỗ trợ GPS. Hãy chạm trực tiếp lên bản đồ vệ tinh bên dưới.',
          'Your browser does not support GPS. Tap directly on the satellite map below.'
        )
      );
      return;
    }
    setGpsLoading(true);
    setGpsNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = Number(pos.coords.latitude.toFixed(5));
        const nextLon = Number(pos.coords.longitude.toFixed(5));
        setLat(nextLat);
        setLon(nextLon);
        setLocationConfirmed(true);
        setStepError(null);
        setGpsLoading(false);
        const gridMatch = findNearestNasaGrid(nextLat, nextLon);
        setProvince(gridMatch.cell.region);
        setGpsNotice(
          t(
            `Đã lấy vị trí GPS thiết bị (sai số ~${Math.round(pos.coords.accuracy)} m) và ghép điểm khí hậu ${gridMatch.cell.cellId} cách ${gridMatch.distanceKm} km.`,
            `Located via device GPS (accuracy ~${Math.round(pos.coords.accuracy)} m) and matched climate grid ${gridMatch.cell.cellId} (${gridMatch.distanceKm} km away).`
          )
        );
      },
      () => {
        setGpsLoading(false);
        setGpsNotice(
          t(
            'Không thể truy cập GPS (vui lòng cấp quyền vị trí hoặc chạm trực tiếp trên bản đồ vệ tinh để chọn vị trí ruộng).',
            'Unable to access GPS (please allow location access or tap directly on the satellite map).'
          )
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleNextStep = () => {
    setStepError(null);
    if (currentStep === 1) {
      if (!name.trim()) {
        setStepError(t('Vui lòng nhập tên thửa ruộng.', 'Please enter a field name.'));
        return;
      }
      if (!province.trim()) {
        setStepError(t('Vui lòng nhập Tỉnh / Thành phố của thửa ruộng.', 'Please enter the Province / City.'));
        return;
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 8 || lat > 24 || lon < 101 || lon > 111) {
        setStepError(
          t(
            'Tọa độ ruộng chưa hợp lệ (Vĩ độ 8–24°B, Kinh độ 101–111°Đ). Hãy dùng GPS hoặc chạm bản đồ.',
            'Invalid coordinates (Lat 8–24°N, Lon 101–111°E). Please use GPS or tap the map.'
          )
        );
        return;
      }
      if (!locationConfirmed) {
        setStepError(
          t(
            'Vui lòng xác nhận vị trí ruộng bằng cách bấm Lấy GPS thiết bị hoặc chạm trực tiếp lên bản đồ vệ tinh.',
            'Please confirm the field location using Device GPS or tapping the satellite map.'
          )
        );
        return;
      }
    }
    if (currentStep === 4 && !cropName.trim()) {
      setStepError(t('Vui lòng chọn hoặc nhập tên loại cây trồng.', 'Please select or enter a crop name.'));
      return;
    }
    setCurrentStep(prev => prev + 1);
  };

  const resetWizardToBlank = () => {
    setEditingField(null);
    setCurrentStep(1);
    setStepError(null);
    setName('');
    setProvince('Hà Nội');
    setDistrict('');
    setLat(21.03);
    setLon(105.85);
    setLocationConfirmed(false);
    setGpsNotice(null);
    setAreaHa(1.0);
    setSoilType('loam');
    setDrainage('moderate');
    setHoldsWater(true);
    setProneToFlooding(false);
    setPh(undefined);
    setWaterSourceType('pond');
    setWaterStable(true);
    setWaterObs('normal');
    setHasTest(false);
    setSalinityRisk(false);
    setSeedFamily('poaceae');
    setCropName('Lúa nước');
    setCropCategory('rice');
    setVariety('ST25');
    setPlantingDate(new Date().toISOString().slice(0, 10));
    setCurrentStage('Cây con / Mạ non');
    setFarmingMethod('Tiêu chuẩn an toàn VietGAP');
    setIrrigationMethod('Tưới ngập khô xen kẽ');
    setPrimaryGoal('minimize_risk');
    setInspectTime('morning');
    setNotificationMethod('in_app');
  };

  const openEditWizard = (field: FieldProfile) => {
    setEditingField(field);
    setCurrentStep(1);
    setStepError(null);
    setName(field.name);
    setProvince(field.province);
    setDistrict(field.district);
    setLat(field.lat);
    setLon(field.lon);
    setLocationConfirmed(true);
    setGpsNotice(null);
    setAreaHa(field.areaHa);
    setSoilType(field.soilType);
    setDrainage(field.soilCharacteristics.drainage);
    setHoldsWater(field.soilCharacteristics.holdsWater);
    setProneToFlooding(field.soilCharacteristics.proneToFlooding);
    setPh(field.soilCharacteristics.ph);
    setWaterSourceType(field.waterSource.type);
    setWaterStable(field.waterSource.isStable);
    setWaterObs(field.waterSource.observation);
    setHasTest(field.waterSource.hasTestResult);
    setSalinityRisk(field.waterSource.salinityRisk);
    setSeedFamily(
      field.crop.seedFamily || inferSeedFamilyFromCrop(field.crop.name, field.crop.category)
    );
    setCropName(field.crop.name);
    setCropCategory(field.crop.category);
    setVariety(field.crop.variety);
    setPlantingDate(field.crop.plantingDate);
    setCurrentStage(field.crop.currentStage);
    setFarmingMethod(field.crop.farmingMethod);
    setIrrigationMethod(field.crop.irrigationMethod);
    setPrimaryGoal(field.primaryGoal);
    setInspectTime(field.inspectTime);
    setNotificationMethod(field.notificationMethod === 'push' ? 'push' : 'in_app');
    setWizardOpen(true);
  };

  const handleFinishWizard = async () => {
    if (!name.trim()) {
      setStepError(t('Vui lòng nhập tên thửa ruộng.', 'Please enter a field name.'));
      setCurrentStep(1);
      return;
    }
    if (!locationConfirmed) {
      setStepError(t('Vui lòng xác nhận vị trí ruộng trên bản đồ.', 'Please confirm the field location on the map.'));
      setCurrentStep(1);
      return;
    }
    setSavingField(true);
    try {
      const payload = {
        name: name.trim(),
        province: province.trim() || 'Việt Nam',
        district: district.trim() || (lang === 'en' ? 'Cultivation area' : 'Khu vực canh tác'),
        lat,
        lon,
        areaHa,
        soilType,
        soilCharacteristics: {
          drainage,
          holdsWater,
          proneToFlooding,
          ...(ph !== undefined ? { ph } : {}),
        },
        waterSource: {
          type: waterSourceType,
          isStable: waterStable,
          observation: waterObs,
          hasTestResult: hasTest,
          salinityRisk,
        },
        crop: {
          seedFamily,
          name: cropName.trim(),
          category: cropCategory,
          variety: variety.trim() || 'Giống địa phương',
          plantingDate,
          currentStage,
          stageIndex: editingField?.crop.stageIndex || 1,
          farmingMethod,
          irrigationMethod,
          healthStatus: editingField?.crop.healthStatus || 'healthy',
        },
        primaryGoal,
        inspectTime,
        notificationMethod,
      };

      if (editingField) {
        await onUpdateField({
          ...editingField,
          ...payload,
        });
      } else {
        await onAddNewField(payload);
      }

      setWizardOpen(false);
      resetWizardToBlank();
    } finally {
      setSavingField(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
            {t('Bản đồ & Hồ sơ Thửa ruộng của bạn', 'Your Fields & Satellite Profiles')}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500">
            {isAuthenticated
              ? t(
                  'Mỗi thửa ruộng thuộc quyền riêng tư của tài khoản tạo ra. Bạn có thể chia sẻ quyền xem qua đường dẫn hoặc email cho nông dân khác.',
                  'Each field belongs privately to the account that created it. You can share view access via link or username/email.'
                )
              : t(
                  'Vui lòng đăng nhập tài khoản riêng của bạn để tạo, lưu trữ riêng tư và chia sẻ các thửa ruộng của mình.',
                  'Sign in to create, store privately, and share your field profiles.'
                )}
          </p>
        </div>
        {isAuthenticated ? (
          <button
            onClick={() => {
              resetWizardToBlank();
              setWizardOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> {t('Tạo hồ sơ thửa ruộng mới', 'Add New Field')}
          </button>
        ) : (
          <button
            onClick={() => onOpenAuthModal?.()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-xs self-start sm:self-auto"
          >
            <LogIn className="w-4 h-4" /> {t('Đăng nhập / Đăng ký', 'Sign In / Sign Up')}
          </button>
        )}
      </div>

      {/* Empty State when unauthenticated or user has no saved fields yet */}
      {fields.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            {isAuthenticated ? <MapPin className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />}
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-lg font-bold text-stone-900">
              {isAuthenticated
                ? t('Chưa có thửa ruộng nào trong tài khoản', 'No fields saved yet')
                : t('Hồ sơ ruộng được bảo mật theo từng nông dân', 'Field profiles are private to each farmer')}
            </h2>
            <p className="text-xs text-stone-500 leading-relaxed">
              {isAuthenticated
                ? t(
                    'Hãy thêm vị trí thửa ruộng thực tế của bạn bằng GPS hoặc chạm trên ảnh vệ tinh để xem điểm khí hậu gần nhất và gợi ý luân canh.',
                    'Add your field using GPS or by tapping the satellite map to link climate grids and rotation advice.'
                  )
                : t(
                    'CropCast không hiển thị công khai dữ liệu ruộng của người khác. Hãy đăng nhập hoặc tạo tài khoản để bắt đầu tạo thửa ruộng riêng của bạn.',
                    'CropCast does not show other farmers’ fields publicly. Sign in or sign up to create your own field.'
                  )}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={() => {
                  resetWizardToBlank();
                  setWizardOpen(true);
                }}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> {t('Thêm thửa ruộng đầu tiên', 'Add Your First Field')}
              </button>
            ) : (
              <button
                onClick={() => onOpenAuthModal?.()}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" /> {t('Đăng nhập / Tạo tài khoản ngay', 'Sign In / Sign Up')}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Field Cards Grid with Satellite Imagery */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {fields.map(f => {
            const isActive = activeField?.id === f.id;
            const fam = getSeedFamilyById(
              f.crop.seedFamily || inferSeedFamilyFromCrop(f.crop.name, f.crop.category)
            );

            return (
              <div
                key={f.id}
                className={`bg-white rounded-2xl border overflow-hidden transition flex flex-col justify-between ${
                  isActive
                    ? 'border-emerald-600 ring-2 ring-emerald-600/20 shadow-md'
                    : 'border-stone-200 hover:border-stone-300 shadow-2xs'
                }`}
              >
                {/* Compact Satellite Imagery Preview */}
                <div className="relative">
                  <SatelliteMap
                    lat={f.lat}
                    lon={f.lon}
                    zoom={15}
                    heightClass="h-40"
                    interactive={false}
                    showNasaGrid={false}
                    fieldLabel={f.name}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onSelectField(f.id);
                      onOpenMapPicker(f.lat, f.lon);
                    }}
                    className="absolute top-2.5 right-2.5 z-20 bg-white/95 hover:bg-white text-stone-800 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-sm border border-stone-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Satellite className="w-3.5 h-3.5 text-emerald-700" /> {t('Phóng to bản đồ', 'Expand Map')}
                  </button>
                </div>

                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 truncate">
                        {getFamilyDisplayName(fam, lang).split('(')[0].trim()} ·{' '}
                        {getPlantDisplayName(f.crop.name, lang)}
                      </span>
                      {isActive ? (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3" /> {t('Đang xem', 'Active')}
                        </span>
                      ) : (
                        <button
                          onClick={() => onSelectField(f.id)}
                          className="text-xs text-stone-500 hover:text-emerald-700 font-semibold cursor-pointer underline shrink-0"
                        >
                          {t('Chọn ruộng này', 'Select field')}
                        </button>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-stone-900">{f.name}</h3>
                    <p className="text-xs text-stone-500">
                      {getLocalizedRegionName(f.province, lang)}
                      {f.district ? `, ${f.district}` : ''} • {t('Diện tích:', 'Area:')} {f.areaHa} ha
                    </p>
                    {f.isSharedWithMe ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-[11px] font-bold text-blue-900">
                        <Users className="w-3.5 h-3.5 text-blue-700" />
                        {t(
                          `Được chia sẻ bởi ${f.ownerName || 'Nông dân khác'} (Chỉ xem)`,
                          `Shared by ${f.ownerName || 'Farmer'} (View only)`
                        )}
                      </div>
                    ) : (
                      (f.activeShareToken || (f.sharedWithEmails && f.sharedWithEmails.length > 0)) && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 text-[11px] font-semibold text-stone-700">
                          <Share2 className="w-3 h-3 text-emerald-700" />
                          {t('Đang chia sẻ', 'Shared')} ({(f.sharedWithEmails?.length || 0) + (f.activeShareToken ? 1 : 0)})
                        </div>
                      )
                    )}
                  </div>

                  {/* Detailed summary tags */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-stone-100">
                    <div className="bg-stone-50 p-2 rounded-lg border border-stone-200/80">
                      <span className="text-stone-400 text-[10px] block">{t('Chất đất:', 'Soil:')}</span>
                      <span className="font-semibold text-stone-800">{getSoilLabel(f.soilType, lang)}</span>
                      <span className="text-[11px] text-stone-500 block">
                        ({getDrainageLabel(f.soilCharacteristics.drainage, lang)})
                      </span>
                    </div>
                    <div className="bg-stone-50 p-2 rounded-lg border border-stone-200/80">
                      <span className="text-stone-400 text-[10px] block">{t('Giai đoạn:', 'Stage:')}</span>
                      <span className="font-semibold text-stone-800">
                        {getCommonStageLabel(f.crop.currentStage, lang)}
                      </span>
                      <span className="text-[11px] text-stone-500 block">
                        {t('Giống:', 'Variety:')} {getCommonVarietyLabel(f.crop.variety, lang)}
                      </span>
                    </div>
                    <div className="bg-stone-50 p-2 rounded-lg border border-stone-200/80">
                      <span className="text-stone-400 text-[10px] block">{t('Nguồn nước:', 'Water:')}</span>
                      <span className="font-semibold text-stone-800">{getWaterLabel(f.waterSource.type, lang)}</span>
                      <span className="text-[11px] text-stone-500 block">
                        {getWaterObsLabel(f.waterSource.observation, lang)}
                      </span>
                    </div>
                    <div className="bg-stone-50 p-2 rounded-lg border border-stone-200/80">
                      <span className="text-stone-400 text-[10px] block">{t('Điểm khí hậu:', 'NASA grid:')}</span>
                      <span className="font-semibold text-stone-800 font-mono">{f.nasaGrid.cellId}</span>
                      <span className="text-[11px] text-emerald-700 font-medium block">
                        {t(`Cách ${f.nasaGrid.distanceKm} km`, `${f.nasaGrid.distanceKm} km away`)}
                      </span>
                    </div>
                  </div>

                  {f.adaptiveMemory?.earthMetrics?.syncedAt && (
                    <div className="text-[11px] text-stone-500 font-mono">
                      {t('Lần cuối cập nhật NASA:', 'NASA last updated:')}{' '}
                      {new Date(f.adaptiveMemory.earthMetrics.syncedAt).toLocaleString(
                        lang === 'en' ? 'en-US' : 'vi-VN',
                        { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
                      )}
                    </div>
                  )}

                  {f.adaptiveMemory?.soilAdjustment && (
                    <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg text-[11px] text-purple-900 flex items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                      <span>{t('Đã ghi nhận thực địa:', 'Field note:')} {f.adaptiveMemory.soilAdjustment}</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => onSelectField(f.id)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                          isActive
                            ? 'bg-emerald-800 text-white'
                            : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        {isActive ? t('Đang chọn xem', 'Active') : t('Chuyển sang ruộng này', 'Switch to field')}
                      </button>

                      {!f.isSharedWithMe && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditWizard(f)}
                            className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition cursor-pointer flex items-center gap-1"
                          >
                            <Pencil className="w-3.5 h-3.5" /> {t('Chỉnh sửa', 'Edit')}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShareModalFieldId(f.id);
                              setShareFeedback(null);
                              setShareEmailInput('');
                              setCopiedLink(false);
                            }}
                            className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 transition cursor-pointer flex items-center gap-1"
                          >
                            <Share2 className="w-3.5 h-3.5" /> {t('Chia sẻ', 'Share')}
                          </button>
                        </>
                      )}
                    </div>

                    {!f.isSharedWithMe && confirmDeleteId !== f.id && (
                      <button
                        onClick={() => setConfirmDeleteId(f.id)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title={t('Xóa thửa ruộng', 'Delete field')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {!f.isSharedWithMe && confirmDeleteId === f.id && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <button
                          onClick={() => {
                            onDeleteField(f.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 bg-rose-600 text-white font-bold rounded cursor-pointer"
                        >
                          {t('Xác nhận xóa', 'Confirm')}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 bg-stone-200 text-stone-700 rounded cursor-pointer"
                        >
                          {t('Hủy', 'Cancel')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5-STEP FIELD PROFILE CREATION WIZARD MODAL */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-emerald-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center">
                  <Sprout className="w-5 h-5 text-emerald-200" />
                </div>
                <div>
                  <h2 className="text-base font-bold">
                    {editingField
                      ? `${t('Chỉnh sửa Hồ sơ:', 'Edit Field:')} ${editingField.name}`
                      : t('Tạo Hồ sơ Thửa ruộng Mới', 'Create New Field Profile')}
                  </h2>
                  <p className="text-xs text-emerald-200">
                    {t('Bước', 'Step')} {currentStep}/5:{' '}
                    {currentStep === 1
                      ? t('Vị trí ruộng (Bắt buộc)', 'Field Location (Required)')
                      : currentStep === 2
                      ? t('Đặc điểm đất', 'Soil Characteristics')
                      : currentStep === 3
                      ? t('Nguồn nước tưới', 'Water Source')
                      : currentStep === 4
                      ? t('Họ hạt giống & Cây trồng', 'Seed Family & Crop')
                      : t('Mục tiêu canh tác', 'Farming Goals')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setWizardOpen(false);
                  resetWizardToBlank();
                }}
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Stepper Progress */}
            <div className="px-4 sm:px-6 py-2 bg-stone-100 border-b border-stone-200 flex items-center justify-between gap-4 text-xs text-stone-600 overflow-x-auto no-scrollbar whitespace-nowrap">
              {[
                { s: 1, label: t('1. Vị trí*', '1. Location*') },
                { s: 2, label: t('2. Đất', '2. Soil') },
                { s: 3, label: t('3. Nước', '3. Water') },
                { s: 4, label: t('4. Hạt giống & Cây', '4. Crop') },
                { s: 5, label: t('5. Mục tiêu', '5. Goals') },
              ].map(st => (
                <button
                  key={st.s}
                  type="button"
                  onClick={() => editingField && setCurrentStep(st.s)}
                  className={`flex items-center gap-1 font-semibold shrink-0 ${
                    editingField ? 'cursor-pointer hover:text-emerald-700' : 'cursor-default'
                  } ${
                    currentStep === st.s
                      ? 'text-emerald-700 border-b-2 border-emerald-700 pb-0.5'
                      : currentStep > st.s
                      ? 'text-stone-900'
                      : 'text-stone-400'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Step Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
              {stepError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{stepError}</span>
                </div>
              )}

              {/* STEP 1: VỊ TRÍ ĐỊA LÝ BẮT BUỘC */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="font-bold text-stone-800 block mb-1">
                      {t('Tên thửa ruộng đặt theo ý bạn *', 'Your custom field name *')}
                    </label>
                    <input
                      type="text"
                      placeholder={t(
                        'VD: Ruộng rau bãi ngoài, Ruộng lúa đằng sau nhà...',
                        'e.g. Riverside Vegetable Plot, South Paddy...'
                      )}
                      value={name}
                      onChange={e => {
                        setName(e.target.value);
                        setStepError(null);
                      }}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Tỉnh / Thành phố *', 'Province / City *')}
                      </label>
                      <input
                        type="text"
                        value={province}
                        onChange={e => setProvince(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Huyện / Xã / Thôn', 'District / Commune')}
                      </label>
                      <input
                        type="text"
                        placeholder={t('VD: Xã Tiền Phong', 'e.g. Tien Phong Commune')}
                        value={district}
                        onChange={e => setDistrict(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900"
                      />
                    </div>
                  </div>

                  {/* Required GPS / Satellite Location Box */}
                  <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-stone-800 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-emerald-700" />{' '}
                        {t('Vị trí thửa ruộng (Bắt buộc) *', 'Field Location (Required) *')}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleUseDeviceGps}
                          disabled={gpsLoading}
                          className="text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-stone-950 font-bold px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          {gpsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                          {gpsLoading ? t('Đang định vị...', 'Locating...') : t('Lấy GPS thiết bị', 'Use Device GPS')}
                        </button>
                      </div>
                    </div>

                    <SatelliteMap
                      lat={lat}
                      lon={lon}
                      zoom={13}
                      heightClass="h-56"
                      interactive={true}
                      showNasaGrid={true}
                      onLocationChange={(nextLat, nextLon) => {
                        setLat(nextLat);
                        setLon(nextLon);
                        setLocationConfirmed(true);
                        setStepError(null);
                      }}
                      fieldLabel={name || t('Ruộng mới', 'New Field')}
                    />

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="text-stone-500 block mb-0.5">
                          {t('Vĩ độ (°Bắc):', 'Latitude (°N):')}
                        </span>
                        <input
                          type="number"
                          step="0.001"
                          value={lat}
                          onChange={e => {
                            setLat(parseFloat(e.target.value) || 0);
                            setLocationConfirmed(true);
                          }}
                          className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white font-mono text-xs tabular-nums"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="text-stone-500 block mb-0.5">
                          {t('Kinh độ (°Đông):', 'Longitude (°E):')}
                        </span>
                        <input
                          type="number"
                          step="0.001"
                          value={lon}
                          onChange={e => {
                            setLon(parseFloat(e.target.value) || 0);
                            setLocationConfirmed(true);
                          }}
                          className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white font-mono text-xs tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-emerald-900 font-semibold">
                          {t('Điểm khí hậu gần nhất tự động ghép:', 'Auto-matched climate grid:')}{' '}
                          <strong>{nearestGrid.cell.cellId}</strong> (
                          {getLocalizedRegionName(nearestGrid.cell.region, lang)})
                        </span>
                        <span className="text-[11px] text-emerald-700 block">
                          {t(
                            `Cách vị trí ruộng ${nearestGrid.distanceKm} km • Nhiệt độ TB ${nearestGrid.cell.climatology21Yr.avgTemp}°C`,
                            `${nearestGrid.distanceKm} km from field • Avg temp ${nearestGrid.cell.climatology21Yr.avgTemp}°C`
                          )}
                        </span>
                      </div>
                      <label className="flex items-center gap-1.5 font-bold text-emerald-900 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={locationConfirmed}
                          onChange={e => setLocationConfirmed(e.target.checked)}
                          className="w-4 h-4 accent-emerald-700"
                        />
                        <span>{t('Đã đúng vị trí ruộng', 'Location confirmed')}</span>
                      </label>
                    </div>

                    {gpsNotice && (
                      <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                        {gpsNotice}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="font-bold text-stone-800 block mb-1">
                      {t('Diện tích canh tác (hecta)', 'Cultivated area (hectares)')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0.05"
                        value={areaHa}
                        onChange={e => setAreaHa(parseFloat(e.target.value) || 0.1)}
                        className="w-32 px-3 py-2 border border-stone-300 rounded-xl text-stone-900"
                      />
                      <span className="text-stone-600 text-xs">{t('Hecta (ha)', 'Hectares (ha)')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: ĐẶC ĐIỂM ĐẤT */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="font-bold text-stone-800 block mb-1">
                      {t('Loại đất chính của thửa ruộng (16 nhóm đất)', 'Primary Field Soil Type (16 groups)')}
                    </label>
                    <p className="text-[11px] text-stone-500 mb-2">
                      {t(
                        'Chọn nhóm đất sát nhất với ruộng nhà bạn — hệ thống sẽ tự gợi ý mức thoát nước và giữ ẩm tương ứng.',
                        'Pick the closest soil group — drainage and retention defaults update automatically.'
                      )}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                      {SOIL_TYPE_CATALOG.map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => {
                            setSoilType(item.type);
                            setDrainage(item.defaultDrainage);
                            setHoldsWater(item.defaultHoldsWater);
                            setProneToFlooding(item.defaultFlooding);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            soilType === item.type
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100'
                          }`}
                        >
                          <div className="text-xs font-bold leading-snug">
                            {lang === 'en' ? item.labelEn : item.label}
                          </div>
                          <div
                            className={`text-[10px] mt-0.5 leading-tight ${
                              soilType === item.type ? 'text-emerald-100' : 'text-stone-500'
                            }`}
                          >
                            {lang === 'en' ? item.shortHintEn : item.shortHint}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {soilType === 'unknown' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
                      <div className="font-bold flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-amber-700" />
                        {t('Gợi ý nhận diện nhanh ngoài ruộng', 'Quick Field Squeeze Test')}
                      </div>
                      <p>
                        {t(
                          'Khi nắm một nắm đất ẩm trong lòng bàn tay và bóp chặt:',
                          'When squeezing a handful of moist soil in your palm:'
                        )}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="soilGuess"
                            onChange={() => {
                              setSoilType('sand');
                              setDrainage('fast');
                            }}
                          />
                          <span>
                            {t(
                              'Đất rời rạc, không vo thành viên được (Nghiêng về đất cát)',
                              'Crumbles loosely, cannot form a ball (Sandy soil)'
                            )}
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="soilGuess"
                            onChange={() => {
                              setSoilType('clay');
                              setDrainage('slow');
                            }}
                          />
                          <span>
                            {t(
                              'Đất dính chặt, nặn được dải dài bóng nhẵn (Nghiêng về đất sét)',
                              'Sticky, molds into a smooth ribbon (Clay soil)'
                            )}
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="soilGuess"
                            onChange={() => {
                              setSoilType('loam');
                              setDrainage('moderate');
                            }}
                          />
                          <span>
                            {t(
                              'Vo thành viên nhưng dễ vỡ khi ấn nhẹ (Nghiêng về đất thịt)',
                              'Forms a ball that breaks gently when pressed (Loamy soil)'
                            )}
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Khả năng thoát nước', 'Drainage Capacity')}
                      </label>
                      <select
                        value={drainage}
                        onChange={e => setDrainage(e.target.value as any)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900"
                      >
                        <option value="fast">
                          {t('Thoát nước nhanh (khô ráo sau 2–4 giờ)', 'Fast drainage (dry within 2–4h)')}
                        </option>
                        <option value="moderate">
                          {t('Thoát nước vừa phải (trung bình 1 ngày)', 'Moderate drainage (~1 day)')}
                        </option>
                        <option value="slow">
                          {t('Thoát nước chậm (dễ ứ đọng nhiều ngày)', 'Slow drainage (ponding risk)')}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Độ pH đất (nếu đã đo)', 'Soil pH (if tested)')}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder={t('VD: 6.2 (Bỏ trống nếu chưa đo)', 'e.g. 6.2 (Leave blank if unknown)')}
                        value={ph || ''}
                        onChange={e => setPh(parseFloat(e.target.value) || undefined)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs font-semibold text-stone-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={holdsWater}
                        onChange={e => setHoldsWater(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                      />
                      <span>{t('Đất giữ ẩm lâu sau mưa', 'Holds moisture long after rain')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={proneToFlooding}
                        onChange={e => setProneToFlooding(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                      />
                      <span>{t('Ruộng nằm ở vùng trũng hay bị ngập úng', 'Low-lying / prone to waterlogging')}</span>
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 3: NGUỒN NƯỚC */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="font-bold text-stone-800 block mb-2">
                      {t('Nguồn nước tưới chính', 'Primary Irrigation Source')}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { type: 'river', label: t('Nước sông / kênh mương', 'River / Canal') },
                        { type: 'pond', label: t('Nước ao / hồ chứa', 'Pond / Reservoir') },
                        { type: 'well', label: t('Nước giếng khoan / ngầm', 'Well / Groundwater') },
                        { type: 'tap', label: t('Nước máy sinh hoạt', 'Piped / Tap Water') },
                        { type: 'rain', label: t('Chỉ dựa vào nước mưa', 'Rain-fed Only') },
                        { type: 'other', label: t('Nguồn khác', 'Other Source') },
                      ].map(item => (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setWaterSourceType(item.type as WaterSourceType)}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition text-left cursor-pointer ${
                            waterSourceType === item.type
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Quan sát màu nước tưới', 'Water Appearance')}
                      </label>
                      <select
                        value={waterObs}
                        onChange={e => setWaterObs(e.target.value as any)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900"
                      >
                        <option value="normal">{t('Bình thường, không mùi', 'Normal, no odor')}</option>
                        <option value="clear">{t('Nước rất trong', 'Very clear water')}</option>
                        <option value="turbid">{t('Nhiều phù sa / đục bùn', 'Silt-rich / muddy')}</option>
                        <option value="odor">{t('Có mùi lạ / nghi ô nhiễm', 'Unusual odor / suspected pollution')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Tính ổn định của nguồn nước', 'Water Reliability')}
                      </label>
                      <select
                        value={waterStable ? 'true' : 'false'}
                        onChange={e => setWaterStable(e.target.value === 'true')}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900"
                      >
                        <option value="true">{t('Dồi dào quanh năm, ít lo cạn', 'Reliable year-round')}</option>
                        <option value="false">{t('Dễ bị cạn vào cao điểm mùa khô', 'Often runs dry in peak dry season')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs font-semibold text-stone-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={salinityRisk}
                        onChange={e => setSalinityRisk(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                      />
                      <span>{t('Khu vực có nguy cơ xâm nhập mặn mùa khô', 'Dry-season salinity intrusion risk')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasTest}
                        onChange={e => setHasTest(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                      />
                      <span>{t('Đã từng kiểm nghiệm độ phèn/mặn tại địa phương', 'Tested local salinity / acidity')}</span>
                    </label>
                  </div>

                  <div className="p-3 bg-stone-100 rounded-xl text-stone-600 text-[11px] leading-relaxed flex items-start gap-1.5">
                    <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                    <span>
                      {t(
                        'Hệ thống không tự kết luận độ an toàn hóa học của nguồn nước chỉ qua ảnh vệ tinh; bà con cần kiểm tra thực tế hoặc dùng bút đo độ mặn đầu kênh vào mùa khô.',
                        'Satellites cannot test chemical water safety alone; please check canal salinity or local water quality directly during dry months.'
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 4: HỌ HẠT GIỐNG TRƯỚC -> LOẠI CÂY TRỒNG -> GIỐNG CỤ THỂ */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  {/* 4A: Seed Family FIRST */}
                  <div>
                    <label className="font-bold text-stone-800 block mb-1">
                      {t('1. Chọn Họ hạt giống (Nhóm thực vật) trước *', '1. Select Seed Family first *')}
                    </label>
                    <p className="text-[11px] text-stone-500 mb-2">
                      {t(
                        'Xác định họ hạt giống giúp hệ thống đề xuất cây luân canh khác họ để cắt đứt chu kỳ sâu bệnh và phục hồi dinh dưỡng đất.',
                        'Identifying the botanical family helps recommend cross-family rotations that break pest cycles and restore soil nutrients.'
                      )}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {SEED_FAMILIES.map(fam => {
                        const isSelected = seedFamily === fam.id;
                        return (
                          <button
                            key={fam.id}
                            type="button"
                            onClick={() => handleSelectSeedFamily(fam.id)}
                            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                                : 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs">{getFamilyDisplayName(fam, lang)}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                  isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-stone-200 text-stone-600'
                                }`}
                              >
                                {fam.plants.length} {t('loại cây', 'crops')}
                              </span>
                            </div>
                            <div className={`text-[11px] mt-1 ${isSelected ? 'text-emerald-100' : 'text-stone-500'}`}>
                              {getFamilyShortTag(fam, lang)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Family Soil Note */}
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                    <strong>
                      {t('Đặc tính luân canh của', 'Rotation profile for')}{' '}
                      {getFamilyDisplayName(selectedFamilyObj, lang)}:
                    </strong>{' '}
                    {getFamilySoilImpactNote(selectedFamilyObj, lang)}
                  </div>

                  {/* 4B: Plant Type filtered by Seed Family */}
                  <div className="space-y-2">
                    <label className="font-bold text-stone-800 block">
                      {t('2. Chọn Loại cây trồng thuộc', '2. Select Crop in')}{' '}
                      {getFamilyDisplayName(selectedFamilyObj, lang)} *
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedFamilyObj.plants.map(plant => (
                        <button
                          key={plant.id}
                          type="button"
                          onClick={() => handleSelectPlant(plant.name)}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            cropName === plant.name
                              ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-2xs'
                              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                          }`}
                        >
                          {getPlantDisplayName(plant, lang)}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="font-semibold text-stone-700 text-xs block mb-1">
                          {t('Hoặc nhập tên cây cụ thể khác', 'Or enter another crop name')}
                        </label>
                        <input
                          type="text"
                          value={cropName}
                          onChange={e => setCropName(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900 font-semibold text-xs"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-stone-700 text-xs block mb-1">
                          {t('Giống cây cụ thể', 'Specific variety / cultivar')}
                        </label>
                        <input
                          type="text"
                          value={variety}
                          onChange={e => setVariety(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900 text-xs"
                          placeholder={t('VD: ST25, ĐT84, NK7328...', 'e.g. ST25, DT84, NK7328...')}
                        />
                        {selectedPlantObj && selectedPlantObj.commonVarieties.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {selectedPlantObj.commonVarieties.map(v => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setVariety(v)}
                                className="text-[10px] px-2 py-0.5 rounded bg-stone-100 hover:bg-emerald-100 text-stone-700 cursor-pointer"
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedPlantObj && (
                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <span className="text-stone-400 block">{t('Nhu cầu nước:', 'Water demand:')}</span>
                        <strong className="text-stone-800">
                          {selectedPlantObj.waterDemand === 'high'
                            ? t('Cao', 'High')
                            : selectedPlantObj.waterDemand === 'medium'
                            ? t('Trung bình', 'Moderate')
                            : t('Tiết kiệm nước', 'Low / Water-saving')}
                        </strong>
                      </div>
                      <div>
                        <span className="text-stone-400 block">{t('Chịu hạn:', 'Drought tolerance:')}</span>
                        <strong className="text-stone-800">
                          {lang === 'en' ? selectedPlantObj.droughtToleranceEn : selectedPlantObj.droughtTolerance}
                        </strong>
                      </div>
                      <div>
                        <span className="text-stone-400 block">{t('Chịu rét:', 'Cold sensitivity:')}</span>
                        <strong className="text-stone-800">
                          {lang === 'en' ? selectedPlantObj.frostSensitivityEn : selectedPlantObj.frostSensitivity}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Ngày gieo trồng / xuống giống', 'Planting / Sowing Date')}
                      </label>
                      <input
                        type="date"
                        value={plantingDate}
                        onChange={e => setPlantingDate(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Giai đoạn hiện tại', 'Current Growth Stage')}
                      </label>
                      <input
                        type="text"
                        value={currentStage}
                        onChange={e => setCurrentStage(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900 font-medium"
                        placeholder={t('VD: Cây con, Đẻ nhánh, Ra hoa...', 'e.g. Seedling, Tillering, Flowering...')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Phương pháp canh tác', 'Farming Method')}
                      </label>
                      <input
                        type="text"
                        value={farmingMethod}
                        onChange={e => setFarmingMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Phương pháp tưới', 'Irrigation Method')}
                      </label>
                      <input
                        type="text"
                        value={irrigationMethod}
                        onChange={e => setIrrigationMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: MỤC TIÊU */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <label className="font-bold text-stone-800 block mb-2">
                      {t('Mục tiêu canh tác ưu tiên hàng đầu của bạn', 'Your Top Farming Priority')}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        {
                          goal: 'minimize_risk',
                          title: t('Giảm thiểu rủi ro thời tiết', 'Minimize Weather Risk'),
                          desc: t('Ưu tiên phòng tránh rét đậm, úng ngập, sốc nhiệt', 'Guard against cold snaps, flooding, and heatwaves'),
                        },
                        {
                          goal: 'save_water',
                          title: t('Tiết kiệm nước tưới', 'Save Irrigation Water'),
                          desc: t('Tối ưu chu kỳ tưới, giảm chi phí bơm nước', 'Optimize irrigation intervals and pumping costs'),
                        },
                        {
                          goal: 'stabilize_yield',
                          title: t('Ổn định năng suất & đất khỏe', 'Stabilize Yield & Soil Health'),
                          desc: t('Duy trì cân bằng ẩm độ rễ và luân canh phục hồi đất', 'Balance root moisture and rotate to rebuild soil'),
                        },
                        {
                          goal: 'optimize_cost',
                          title: t('Tối ưu chi phí phân thuốc', 'Optimize Input Costs'),
                          desc: t('Tránh bón phân trước mưa lớn hoặc khi cây hấp thu kém', 'Avoid fertilizing before heavy rain or poor uptake'),
                        },
                      ].map(item => (
                        <button
                          key={item.goal}
                          type="button"
                          onClick={() => setPrimaryGoal(item.goal as any)}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                            primaryGoal === item.goal
                              ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-600/20'
                              : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          <div className="font-bold text-xs text-stone-900">{item.title}</div>
                          <div className="text-[11px] text-stone-500 mt-0.5">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Thời gian bạn thường thăm ruộng', 'Preferred Field Check Time')}
                      </label>
                      <select
                        value={inspectTime}
                        onChange={e => setInspectTime(e.target.value as any)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900"
                      >
                        <option value="morning">{t('Buổi sáng sớm (05:30 - 08:00)', 'Early morning (05:30 - 08:00)')}</option>
                        <option value="afternoon">{t('Buổi chiều mát (16:00 - 18:30)', 'Late afternoon (16:00 - 18:30)')}</option>
                        <option value="anytime">{t('Linh hoạt bất kỳ lúc nào', 'Flexible / Anytime')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Hình thức nhận nhắc nhở', 'Notification Preference')}
                      </label>
                      <select
                        value={notificationMethod}
                        onChange={e => setNotificationMethod(e.target.value as any)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900"
                      >
                        <option value="in_app">{t('Thông báo trực tiếp trên ứng dụng', 'In-app alerts')}</option>
                        <option value="push">{t('Thông báo trình duyệt', 'Browser push notifications')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-xs text-emerald-950">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                      <Sparkles className="w-4 h-4 text-emerald-600" />{' '}
                      {t('Hồ sơ thửa ruộng đã sẵn sàng!', 'Your field profile is ready!')}
                    </div>
                    <p>
                      {t(
                        `Vị trí (${lat.toFixed(4)}°B, ${lon.toFixed(4)}°Đ) sẽ ghép với điểm khí hậu ${nearestGrid.cell.cellId} (${getLocalizedRegionName(nearestGrid.cell.region, 'vi')}, cách ${nearestGrid.distanceKm} km) và xây dựng kế hoạch luân canh phù hợp cho ${getPlantDisplayName(cropName, 'vi')} (${getFamilyDisplayName(selectedFamilyObj, 'vi')}).`,
                        `Coordinates (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E) will link to NASA grid ${nearestGrid.cell.cellId} (${getLocalizedRegionName(nearestGrid.cell.region, 'en')}, ${nearestGrid.distanceKm} km away) and tailor rotation advisories for ${getPlantDisplayName(cropName, 'en')} (${getFamilyDisplayName(selectedFamilyObj, 'en')}).`
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Stepper Footer Controls */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setStepError(null);
                    setCurrentStep(prev => prev - 1);
                  }}
                  className="px-4 py-2 border border-stone-300 text-stone-700 font-semibold rounded-xl text-xs hover:bg-stone-100 transition cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> {t('Quay lại', 'Back')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setWizardOpen(false)}
                  className="px-4 py-2 text-stone-500 font-semibold text-xs hover:underline cursor-pointer"
                >
                  {t('Hủy bỏ', 'Cancel')}
                </button>
              )}

              {editingField && currentStep < 5 && (
                <button
                  type="button"
                  disabled={savingField}
                  onClick={handleFinishWizard}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-stone-950 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1"
                >
                  {savingField ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {t('Lưu thay đổi ngay', 'Save changes now')}
                </button>
              )}

              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  {t('Tiếp theo', 'Next')} <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={savingField}
                  onClick={handleFinishWizard}
                  className="px-6 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-extrabold rounded-xl text-xs transition cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-700/20"
                >
                  {savingField ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {savingField
                    ? t('Đang lưu hồ sơ...', 'Saving...')
                    : editingField
                    ? t('Lưu thông tin đã chỉnh sửa', 'Save Changes')
                    : t('Hoàn thành & Lưu thửa ruộng', 'Save Field Profile')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SHARE FIELD MODAL (BY LINK OR EMAIL) */}
      {shareModalField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg max-h-[92dvh] flex flex-col bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-emerald-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center shrink-0">
                  <Share2 className="w-4 h-4 text-emerald-100" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold">{t('Chia sẻ Thửa ruộng', 'Share Field')}</h2>
                  <p className="text-[11px] text-emerald-200 truncate max-w-[210px] sm:max-w-[300px]">
                    {shareModalField.name} · {getLocalizedRegionName(shareModalField.province, lang)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShareModalFieldId(null)}
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5 text-xs overflow-y-auto">
              {shareFeedback && (
                <div
                  className={`p-3 rounded-xl border font-medium flex items-center justify-between ${
                    shareFeedback.type === 'ok'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <span>{shareFeedback.msg}</span>
                  <button
                    type="button"
                    onClick={() => setShareFeedback(null)}
                    className="font-bold cursor-pointer ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* 1. Share by Link */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-stone-900">
                  <Link2 className="w-4 h-4 text-emerald-700" />
                  {t('1. Chia sẻ qua Đường dẫn', '1. Share via Link')}
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  {t(
                    'Bất kỳ nông dân nào có đường dẫn này khi đăng nhập CropCast đều có thể mở và xem thông tin thửa ruộng này.',
                    'Any farmer signed into CropCast with this link can open and view this field profile.'
                  )}
                </p>

                {shareModalField.activeShareToken ? (
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/?share=${shareModalField.activeShareToken}`}
                        className="flex-1 min-w-0 px-3 py-2 bg-white border border-stone-300 rounded-lg font-mono text-[11px] text-stone-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/?share=${shareModalField.activeShareToken}`;
                          navigator.clipboard.writeText(url);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 3000);
                        }}
                        className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedLink ? t('Đã chép', 'Copied') : t('Sao chép', 'Copy')}
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={shareBusy}
                      onClick={async () => {
                        if (!onRevokeShareLink) return;
                        setShareBusy(true);
                        try {
                          await onRevokeShareLink(shareModalField);
                          setShareFeedback({
                            type: 'ok',
                            msg: t('Đã tắt đường dẫn chia sẻ hiện tại.', 'Share link disabled.'),
                          });
                        } catch (err: any) {
                          setShareFeedback({
                            type: 'err',
                            msg: err?.message || t('Không thể thu hồi đường dẫn.', 'Unable to revoke link.'),
                          });
                        } finally {
                          setShareBusy(false);
                        }
                      }}
                      className="text-[11px] text-rose-700 hover:text-rose-900 font-bold underline cursor-pointer disabled:opacity-50"
                    >
                      {t('Thu hồi đường dẫn này', 'Revoke this link')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={shareBusy}
                    onClick={async () => {
                      if (!onCreateShareLink) return;
                      setShareBusy(true);
                      try {
                        await onCreateShareLink(shareModalField);
                        setShareFeedback({
                          type: 'ok',
                          msg: t('Đã tạo đường dẫn chia sẻ mới.', 'New share link created.'),
                        });
                      } catch (err: any) {
                        setShareFeedback({
                          type: 'err',
                          msg: err?.message || t('Không thể tạo đường dẫn.', 'Unable to create link.'),
                        });
                      } finally {
                        setShareBusy(false);
                      }
                    }}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    {shareBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                    {t('Tạo đường dẫn chia sẻ', 'Create Share Link')}
                  </button>
                )}
              </div>

              {/* 2. Share by Email / Username */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-stone-900">
                  <Mail className="w-4 h-4 text-blue-700" />
                  {t('2. Chia sẻ trực tiếp qua Email hoặc Tên đăng nhập', '2. Share Directly by Email or Username')}
                </div>
                <p className="text-[11px] text-stone-500">
                  {t(
                    'Nhập email Google hoặc tên đăng nhập CropCast của nông dân muốn chia sẻ — thửa ruộng sẽ tự hiện trong mục Ruộng của họ khi họ đăng nhập.',
                    'Enter the farmer’s Google email or CropCast username — the field will appear under My Fields when they sign in.'
                  )}
                </p>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!onShareByEmail || !shareEmailInput.trim()) return;
                    setShareBusy(true);
                    setShareFeedback(null);
                    try {
                      const added = await onShareByEmail(shareModalField, shareEmailInput.trim());
                      setShareEmailInput('');
                      setShareFeedback({
                        type: 'ok',
                        msg: t(
                          `Đã cấp quyền xem thửa ruộng cho ${added}.`,
                          `View access granted to ${added}.`
                        ),
                      });
                    } catch (err: any) {
                      setShareFeedback({
                        type: 'err',
                        msg: err?.message || t('Không thể chia sẻ theo email.', 'Unable to share by email.'),
                      });
                    } finally {
                      setShareBusy(false);
                    }
                  }}
                  className="flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="text"
                    value={shareEmailInput}
                    onChange={(e) => setShareEmailInput(e.target.value)}
                    placeholder={t(
                      'VD: nongdan2@gmail.com hoặc ten_dang_nhap',
                      'e.g. farmer2@gmail.com or username'
                    )}
                    className="flex-1 min-w-0 px-3 py-2 bg-white border border-stone-300 rounded-lg text-base sm:text-xs text-stone-900 focus:outline-emerald-600"
                  />
                  <button
                    type="submit"
                    disabled={shareBusy || !shareEmailInput.trim()}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer shrink-0"
                  >
                    {t('Chia sẻ', 'Share')}
                  </button>
                </form>

                {shareModalField.sharedWithEmails && shareModalField.sharedWithEmails.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-bold text-stone-600">
                      {t('Danh sách đang được chia sẻ', 'Shared with')} ({shareModalField.sharedWithEmails.length}):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {shareModalField.sharedWithEmails.map((em) => (
                        <span
                          key={em}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-stone-300 text-[11px] font-semibold text-stone-800"
                        >
                          <span>{em}</span>
                          <button
                            type="button"
                            disabled={shareBusy}
                            onClick={async () => {
                              if (!onRemoveSharedEmail) return;
                              setShareBusy(true);
                              try {
                                await onRemoveSharedEmail(shareModalField.id, em);
                              } finally {
                                setShareBusy(false);
                              }
                            }}
                            className="text-stone-400 hover:text-rose-600 cursor-pointer"
                            title={t('Gỡ quyền xem', 'Remove access')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-stone-500 flex items-start gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  {t(
                    'Người được chia sẻ chỉ có quyền xem thông tin ruộng, dữ liệu thời tiết và gợi ý luân canh — không thể chỉnh sửa hoặc xóa ruộng của bạn.',
                    'Shared users have view-only access to field info, weather, and rotation plans — they cannot edit or delete your field.'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
