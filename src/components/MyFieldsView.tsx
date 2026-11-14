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
  Droplets,
} from 'lucide-react';
import {
  FieldProfile,
  SoilType,
  WaterSourceType,
  CropCategory,
  SeedFamilyId,
  SoilDrainageEstimate,
} from '../types';
import {
  SOIL_TYPE_CATALOG,
  getSoilLabel,
  getDrainageLabel,
  getWaterLabel,
  assessSoilDrainageFromEarthData,
} from '../services/agronomyEngine';
import { fetchFieldLiveWeather } from '../services/weatherService';
import {
  SEED_FAMILIES,
  getSeedFamilyById,
  resolveCropBotanicalProfile,
  getFamilyDisplayName,
  getFamilyShortTag,
  getFamilySoilImpactNote,
  getPlantDisplayName,
  getCommonStageLabel,
  getCommonVarietyLabel,
} from '../data/cropTaxonomy';
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

type FieldAreaUnit = 'ha' | 'm2' | 'sao_bac' | 'cong' | 'acre';

const AREA_UNIT_TO_HA: Record<FieldAreaUnit, number> = {
  ha: 1,
  m2: 0.0001,
  sao_bac: 0.036,
  cong: 0.1,
  acre: 0.404686,
};

function convertToHectares(rawInput: string, unit: FieldAreaUnit): number {
  const normalized = rawInput.replace(',', '.').trim();
  if (!normalized) return NaN;
  const num = Number(normalized);
  if (!Number.isFinite(num)) return NaN;
  return num * AREA_UNIT_TO_HA[unit];
}

function formatReadableArea(ha: number): string {
  if (!Number.isFinite(ha) || ha <= 0) return '—';
  const m2 = Math.round(ha * 10000);
  const haText = ha >= 1 ? ha.toFixed(2).replace(/\.?0+$/, '') : ha.toFixed(4).replace(/\.?0+$/, '');
  return `${haText} ha (${m2.toLocaleString()} m²)`;
}

function extractReadableSaveError(err: any, lang: AppLanguage): { message: string; isPermissionError: boolean } {
  const raw = String(err?.message || err || '');
  const lower = raw.toLowerCase();
  const isPerm = lower.includes('missing or insufficient permissions') || lower.includes('permission-denied');
  if (isPerm) {
    return {
      isPermissionError: true,
      message:
        lang === 'en'
          ? 'Unable to save field because Cloud Firestore Security Rules have not been published to your Firebase project yet (permission-denied). Open Firebase Console → Firestore Database → Rules and Publish the rules from firestore.rules.'
          : 'Không thể lưu thửa ruộng vì bộ Firestore Security Rules mới chưa được Publish lên dự án Firebase đang chạy (lỗi permission-denied). Hãy mở Firebase Console → Firestore Database → tab Rules, dán nội dung tệp firestore.rules và bấm Publish.',
    };
  }
  return {
    isPermissionError: false,
    message:
      raw ||
      (lang === 'en'
        ? 'Could not save the field profile. Please check your inputs and try again.'
        : 'Không thể lưu hồ sơ thửa ruộng. Vui lòng kiểm tra lại thông tin và thử lại.'),
  };
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
  const [permissionErrorHint, setPermissionErrorHint] = useState(false);

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
  const [district, setDistrict] = useState('Mê Linh');
  const [lat, setLat] = useState<number>(21.1815);
  const [lon, setLon] = useState<number>(105.7136);
  const [latText, setLatText] = useState('21.1815');
  const [lonText, setLonText] = useState('105.7136');
  const [mapZoom, setMapZoom] = useState<number>(13);
  const [flyToTrigger, setFlyToTrigger] = useState<number>(0);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const [areaValueInput, setAreaValueInput] = useState('1');
  const [areaUnit, setAreaUnit] = useState<FieldAreaUnit>('ha');
  const areaHa = (() => {
    const converted = convertToHectares(areaValueInput, areaUnit);
    return Number.isFinite(converted) && converted > 0 ? Number(converted.toFixed(4)) : 0;
  })();

  // Step 2: Soil
  const [soilType, setSoilType] = useState<SoilType>('loam');
  const [drainage, setDrainage] = useState<'fast' | 'moderate' | 'slow'>('moderate');
  const [holdsWater, setHoldsWater] = useState(true);
  const [proneToFlooding, setProneToFlooding] = useState(false);
  const [ph, setPh] = useState<number | undefined>(undefined);
  const [estimatingDrainage, setEstimatingDrainage] = useState(false);
  const [drainageEstimate, setDrainageEstimate] = useState<SoilDrainageEstimate | null>(null);

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

  const provinceOptions = VIETNAM_PROVINCES;
  const districtOptions = getDistrictsForProvince(province);
  const selectedProvinceObj = findProvinceByName(province);

  const applyValidCoordinates = (nextLat: number, nextLon: number, nextZoom?: number) => {
    setLat(nextLat);
    setLon(nextLon);
    setLatText(nextLat.toFixed(5));
    setLonText(nextLon.toFixed(5));
    if (nextZoom !== undefined) {
      setMapZoom(nextZoom);
    }
    setFlyToTrigger(v => v + 1);
    setLocationConfirmed(true);
    setStepError(null);
  };

  const handleProvinceDropdownChange = (nextProvName: string) => {
    setProvince(nextProvName);
    setStepError(null);
    const provObj = findProvinceByName(nextProvName);
    if (provObj) {
      const nextDistricts = provObj.districts;
      setDistrict('');
      applyValidCoordinates(provObj.lat, provObj.lon, 11);
      if (nextDistricts.length > 0) {
        setGpsNotice(
          t(
            `Bản đồ đã chuyển tới ${provObj.name}. Bạn có thể chọn thêm Quận/Huyện hoặc chạm trực tiếp vị trí ruộng trên bản đồ.`,
            `Map centered on ${provObj.nameEn}. Pick a District or tap directly on your field plot.`
          )
        );
      }
    }
  };

  const handleDistrictDropdownChange = (nextDistName: string) => {
    setDistrict(nextDistName);
    setStepError(null);
    const distObj = findDistrictInProvince(province, nextDistName);
    if (distObj) {
      applyValidCoordinates(distObj.lat, distObj.lon, 13);
      setGpsNotice(
        t(
          `Đã phóng to bản đồ tới ${distObj.name}, ${province}. Hãy chạm đúng bờ ruộng nếu muốn tinh chỉnh thêm.`,
          `Map zoomed to ${distObj.nameEn}, ${selectedProvinceObj?.nameEn || province}. Tap your exact plot if needed.`
        )
      );
    }
  };

  const handleManualCoordCommit = (rawLatStr: string, rawLonStr: string) => {
    const parsedLat = Number(rawLatStr.replace(',', '.').trim());
    const parsedLon = Number(rawLonStr.replace(',', '.').trim());
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
      return;
    }
    const check = isWithinVietnamTerritory(parsedLat, parsedLon);
    if (!check.valid) {
      setStepError(
        lang === 'en'
          ? check.reasonEn || 'Coordinates are outside Vietnamese territory. Please choose a location in Vietnam and try again.'
          : check.reasonVi || 'Vị trí bạn nhập nằm ngoài lãnh thổ Việt Nam. Vui lòng chọn lại vị trí trong Việt Nam và thử lại.'
      );
      return;
    }
    const fixedLat = Number(parsedLat.toFixed(5));
    const fixedLon = Number(parsedLon.toFixed(5));
    applyValidCoordinates(fixedLat, fixedLon, 13);
  };

  const handleUseDeviceGps = () => {
    if (!navigator.geolocation) {
      setGpsNotice(
        t(
          'Trình duyệt không hỗ trợ GPS. Hãy chọn Tỉnh/Huyện hoặc chạm trực tiếp lên bản đồ vệ tinh.',
          'Your browser does not support GPS. Select Province/District or tap directly on the satellite map.'
        )
      );
      return;
    }
    setGpsLoading(true);
    setGpsNotice(null);
    setStepError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = Number(pos.coords.latitude.toFixed(5));
        const nextLon = Number(pos.coords.longitude.toFixed(5));
        setGpsLoading(false);

        const territoryCheck = isWithinVietnamTerritory(nextLat, nextLon);
        if (!territoryCheck.valid) {
          setStepError(
            lang === 'en'
              ? territoryCheck.reasonEn || 'Device GPS location is outside Vietnamese territory. Please select a location inside Vietnam.'
              : territoryCheck.reasonVi || 'Vị trí GPS thiết bị nằm ngoài lãnh thổ Việt Nam. Vui lòng chọn lại vị trí bên trong Việt Nam và thử lại.'
          );
          return;
        }

        const adminMatch = findNearestAdminLocation(nextLat, nextLon);
        setProvince(adminMatch.province.name);
        setDistrict(adminMatch.district.name);
        applyValidCoordinates(nextLat, nextLon, 14);
        const gridMatch = findNearestNasaGrid(nextLat, nextLon);
        setGpsNotice(
          t(
            `Đã lấy vị trí GPS thiết bị (sai số ~${Math.round(pos.coords.accuracy)} m) tại ${adminMatch.district.name}, ${adminMatch.province.name} (cách trạm khí hậu ${gridMatch.distanceKm} km).`,
            `Located via device GPS (~${Math.round(pos.coords.accuracy)} m) near ${adminMatch.district.nameEn}, ${adminMatch.province.nameEn}.`
          )
        );
      },
      () => {
        setGpsLoading(false);
        setGpsNotice(
          t(
            'Không thể truy cập GPS (vui lòng cấp quyền vị trí hoặc chọn Tỉnh/Huyện rồi chạm trên bản đồ).',
            'Unable to access GPS (allow location access or choose Province/District and tap the map).'
          )
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleNextStep = () => {
    setStepError(null);
    setPermissionErrorHint(false);
    if (currentStep === 1) {
      if (!name.trim()) {
        setStepError(t('Vui lòng nhập tên thửa ruộng.', 'Please enter a field name.'));
        return;
      }
      if (!province.trim()) {
        setStepError(t('Vui lòng chọn Tỉnh / Thành phố của thửa ruộng.', 'Please select a Province / City.'));
        return;
      }
      const parsedLat = Number(latText.replace(',', '.').trim());
      const parsedLon = Number(lonText.replace(',', '.').trim());
      const effectiveLat = Number.isFinite(parsedLat) ? parsedLat : lat;
      const effectiveLon = Number.isFinite(parsedLon) ? parsedLon : lon;
      const territoryCheck = isWithinVietnamTerritory(effectiveLat, effectiveLon);
      if (!territoryCheck.valid) {
        setStepError(
          lang === 'en'
            ? territoryCheck.reasonEn || 'Field location must be inside Vietnamese territory. Please choose a valid Vietnam location.'
            : territoryCheck.reasonVi || 'Vị trí thửa ruộng nằm ngoài lãnh thổ Việt Nam. Vui lòng chọn lại vị trí trong Việt Nam và thử lại.'
        );
        return;
      }
      if (effectiveLat !== lat || effectiveLon !== lon) {
        applyValidCoordinates(Number(effectiveLat.toFixed(5)), Number(effectiveLon.toFixed(5)), 13);
      }
      const computedHa = convertToHectares(areaValueInput, areaUnit);
      if (!Number.isFinite(computedHa) || computedHa < 0.001 || computedHa > 50000) {
        setStepError(
          t(
            'Vui lòng nhập diện tích hợp lệ (tối thiểu 10 m² / 0.001 ha).',
            'Please enter a valid field size (minimum 10 m² / 0.001 ha).'
          )
        );
        return;
      }
      setLocationConfirmed(true);
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
    setPermissionErrorHint(false);
    setName('');
    setProvince('Hà Nội');
    setDistrict('Mê Linh');
    setLat(21.1815);
    setLon(105.7136);
    setLatText('21.18150');
    setLonText('105.71360');
    setMapZoom(13);
    setFlyToTrigger(v => v + 1);
    setLocationConfirmed(false);
    setGpsNotice(null);
    setAreaUnit('ha');
    setAreaValueInput('1');
    setSoilType('loam');
    setDrainage('moderate');
    setHoldsWater(true);
    setProneToFlooding(false);
    setPh(undefined);
    setDrainageEstimate(null);
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
    const matchedProv = findProvinceByName(field.province);
    setProvince(matchedProv?.name || field.province);
    const matchedDist = matchedProv ? findDistrictInProvince(matchedProv.name, field.district) : undefined;
    setDistrict(matchedDist?.name || field.district);
    setLat(field.lat);
    setLon(field.lon);
    setLatText(field.lat.toFixed(5));
    setLonText(field.lon.toFixed(5));
    setMapZoom(14);
    setFlyToTrigger(v => v + 1);
    setLocationConfirmed(true);
    setGpsNotice(null);
    setPermissionErrorHint(false);
    setAreaUnit('ha');
    setAreaValueInput(String(field.areaHa || 1));
    setSoilType(field.soilType);
    setDrainage(field.soilCharacteristics.drainage);
    setHoldsWater(field.soilCharacteristics.holdsWater);
    setProneToFlooding(field.soilCharacteristics.proneToFlooding);
    setPh(field.soilCharacteristics.ph);
    setDrainageEstimate(null);
    setWaterSourceType(field.waterSource.type);
    setWaterStable(field.waterSource.isStable);
    setWaterObs(field.waterSource.observation);
    setHasTest(field.waterSource.hasTestResult);
    setSalinityRisk(field.waterSource.salinityRisk);
    const resolvedBotanical = resolveCropBotanicalProfile(
      field.crop.name,
      field.crop.seedFamily,
      field.crop.category
    );
    setSeedFamily(resolvedBotanical.seedFamilyId);
    setCropName(field.crop.name);
    setCropCategory(resolvedBotanical.matchedPlant?.category || field.crop.category);
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

  const handleAutoEstimateDrainage = async () => {
    setEstimatingDrainage(true);
    try {
      const liveWeather = await fetchFieldLiveWeather(lat, lon);
      const estimate = assessSoilDrainageFromEarthData(
        liveWeather,
        soilType,
        editingField?.adaptiveMemory?.earthMetrics || null,
        lang
      );
      setDrainageEstimate(estimate);
      setDrainage(estimate.drainage);
      setHoldsWater(estimate.drainage !== 'fast');
      setProneToFlooding(estimate.drainage === 'slow');
    } finally {
      setEstimatingDrainage(false);
    }
  };

  const handleFinishWizard = async () => {
    setStepError(null);
    setPermissionErrorHint(false);
    if (!name.trim()) {
      setStepError(t('Vui lòng nhập tên thửa ruộng.', 'Please enter a field name.'));
      setCurrentStep(1);
      return;
    }
    const territoryCheck = isWithinVietnamTerritory(lat, lon);
    if (!territoryCheck.valid) {
      setStepError(
        lang === 'en'
          ? territoryCheck.reasonEn || 'Field location must be inside Vietnamese territory.'
          : territoryCheck.reasonVi || 'Vị trí thửa ruộng nằm ngoài lãnh thổ Việt Nam. Không thể lưu — vui lòng chọn lại vị trí trong Việt Nam.'
      );
      setCurrentStep(1);
      return;
    }
    const computedHa = convertToHectares(areaValueInput, areaUnit);
    if (!Number.isFinite(computedHa) || computedHa < 0.001 || computedHa > 50000) {
      setStepError(
        t(
          'Diện tích thửa ruộng chưa hợp lệ (tối thiểu 10 m² / 0.001 ha).',
          'Please enter a valid field size (minimum 10 m² / 0.001 ha).'
        )
      );
      setCurrentStep(1);
      return;
    }
    const finalAreaHa = Number(computedHa.toFixed(4));

    setSavingField(true);
    try {
      const payload = {
        name: name.trim(),
        province: province.trim() || 'Hà Nội',
        district: district.trim() || (lang === 'en' ? 'Cultivation area' : 'Khu vực canh tác'),
        lat,
        lon,
        areaHa: finalAreaHa,
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
          seedFamily: resolveCropBotanicalProfile(cropName.trim(), seedFamily, cropCategory).seedFamilyId,
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
    } catch (err: any) {
      const parsed = extractReadableSaveError(err, lang);
      setStepError(parsed.message);
      setPermissionErrorHint(parsed.isPermissionError);
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
            const resolvedCropFam = resolveCropBotanicalProfile(
              f.crop.name,
              f.crop.seedFamily,
              f.crop.category
            );
            const shortBotanicalLabel = (
              lang === 'en' ? resolvedCropFam.familyLabelEn : resolvedCropFam.familyLabelVi
            )
              .split('(')[0]
              .trim();

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
                        {shortBotanicalLabel} · {getPlantDisplayName(f.crop.name, lang)}
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
                      <span className="text-stone-400 text-[10px] block">{t('Điểm khí hậu:', 'Climate zone:')}</span>
                      <span className="font-semibold text-stone-800">{getLocalizedRegionName(f.province, lang)}</span>
                      <span className="text-[11px] text-emerald-700 font-medium block">
                        {t(`Tham chiếu cách ${f.nasaGrid.distanceKm} km`, `${f.nasaGrid.distanceKm} km reference`)}
                      </span>
                    </div>
                  </div>

                  {f.adaptiveMemory?.earthMetrics?.syncedAt && (
                    <div className="text-[11px] text-stone-500 font-mono">
                      {t('Cập nhật môi trường gần nhất:', 'Last environmental sync:')}{' '}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[92dvh] overflow-hidden">
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
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-semibold space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{stepError}</span>
                  </div>
                  {permissionErrorHint && (
                    <div className="text-[11px] font-normal text-rose-800 pl-6">
                      {t(
                        'Mẹo: Nếu bạn là chủ dự án Firebase, hãy dán tệp firestore.rules trong mã nguồn vào Firebase Console → Firestore Database → Rules → Publish.',
                        'Tip: If you own the Firebase project, publish your firestore.rules file in Firebase Console → Firestore Database → Rules.'
                      )}
                    </div>
                  )}
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
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 font-medium text-base sm:text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Tỉnh / Thành phố *', 'Province / City *')}
                      </label>
                      <select
                        value={selectedProvinceObj?.name || province}
                        onChange={e => handleProvinceDropdownChange(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900 focus:outline-emerald-600 font-medium"
                      >
                        {!selectedProvinceObj && province && (
                          <option value={province}>{province}</option>
                        )}
                        {provinceOptions.map(p => (
                          <option key={p.name} value={p.name}>
                            {lang === 'en' ? p.nameEn : p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Quận / Huyện / Thị xã', 'District / Town')}
                      </label>
                      <select
                        value={district}
                        onChange={e => handleDistrictDropdownChange(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900 focus:outline-emerald-600"
                      >
                        <option value="">
                          {t('— Chọn Quận / Huyện / Thị xã —', '— Select District / Town —')}
                        </option>
                        {district &&
                          !districtOptions.some(d => d.name === district) && (
                            <option value={district}>{district}</option>
                          )}
                        {districtOptions.map(d => (
                          <option key={d.name} value={d.name}>
                            {lang === 'en' ? d.nameEn : d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Required GPS / Satellite Location Box */}
                  <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-stone-800 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-emerald-700" />{' '}
                        {t('Vị trí thửa ruộng tại Việt Nam (Bắt buộc) *', 'Field Location in Vietnam (Required) *')}
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
                      zoom={mapZoom}
                      flyToTrigger={flyToTrigger}
                      heightClass="h-56"
                      interactive={true}
                      showNasaGrid={true}
                      onLocationChange={(nextLat, nextLon) => {
                        setLat(nextLat);
                        setLon(nextLon);
                        setLatText(nextLat.toFixed(5));
                        setLonText(nextLon.toFixed(5));
                        const matchedAdmin = findNearestAdminLocation(nextLat, nextLon);
                        setProvince(matchedAdmin.province.name);
                        setDistrict(matchedAdmin.district.name);
                        setLocationConfirmed(true);
                        setStepError(null);
                      }}
                      onInvalidLocation={(reason) => {
                        setStepError(reason);
                      }}
                      fieldLabel={name || t('Ruộng mới', 'New Field')}
                    />

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="text-stone-500 block mb-0.5">
                          {t('Vĩ độ (°Bắc):', 'Latitude (°N):')}
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={latText}
                          onChange={e => {
                            setLatText(e.target.value);
                            setStepError(null);
                          }}
                          onBlur={() => handleManualCoordCommit(latText, lonText)}
                          className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white font-mono text-xs tabular-nums"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="text-stone-500 block mb-0.5">
                          {t('Kinh độ (°Đông):', 'Longitude (°E):')}
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={lonText}
                          onChange={e => {
                            setLonText(e.target.value);
                            setStepError(null);
                          }}
                          onBlur={() => handleManualCoordCommit(latText, lonText)}
                          className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white font-mono text-xs tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-emerald-900 font-semibold">
                          {t('Vùng khí hậu tự động khớp:', 'Matched climate region:')}{' '}
                          <strong>{getLocalizedRegionName(nearestGrid.cell.region, lang)}</strong>
                        </span>
                        <span className="text-[11px] text-emerald-700 block">
                          {t(
                            `Nhiệt độ TB 25 năm ${nearestGrid.cell.climatology21Yr.avgTemp}°C • Mưa năm ${nearestGrid.cell.climatology21Yr.annualRainfallMm} mm`,
                            `25-yr avg temp ${nearestGrid.cell.climatology21Yr.avgTemp}°C • Rain ${nearestGrid.cell.climatology21Yr.annualRainfallMm} mm/yr`
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

                  <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="font-bold text-stone-800">
                        {t('Diện tích thửa ruộng của bạn *', 'Your custom field size *')}
                      </label>
                      <span className="text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                        {formatReadableArea(areaHa)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={areaValueInput}
                        onChange={e => {
                          setAreaValueInput(e.target.value);
                          setStepError(null);
                        }}
                        placeholder={areaUnit === 'm2' ? 'VD: 1500' : 'VD: 1.5'}
                        className="w-36 px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900 font-mono font-semibold focus:outline-emerald-600"
                      />
                      <select
                        value={areaUnit}
                        onChange={e => {
                          const nextUnit = e.target.value as FieldAreaUnit;
                          const curHa = convertToHectares(areaValueInput, areaUnit);
                          setAreaUnit(nextUnit);
                          if (Number.isFinite(curHa) && curHa > 0) {
                            const nextVal = curHa / AREA_UNIT_TO_HA[nextUnit];
                            setAreaValueInput(
                              nextUnit === 'm2'
                                ? String(Math.round(nextVal))
                                : Number(nextVal.toFixed(3)).toString()
                            );
                          }
                        }}
                        className="px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900 text-xs font-semibold"
                      >
                        <option value="ha">{t('Hecta (ha)', 'Hectares (ha)')}</option>
                        <option value="m2">{t('Mét vuông (m²)', 'Square meters (m²)')}</option>
                        <option value="sao_bac">{t('Sào Bắc Bộ (360 m²)', 'Northern Sào (360 m²)')}</option>
                        <option value="cong">{t('Công / Sào (1.000 m²)', 'Công / 1,000 m²')}</option>
                        <option value="acre">{t('Mẫu Anh (Acre)', 'Acres')}</option>
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-stone-500 mr-1">{t('Chọn nhanh:', 'Quick presets:')}</span>
                      {[
                        { label: '500 m²', val: '500', unit: 'm2' as FieldAreaUnit },
                        { label: '1.000 m²', val: '1000', unit: 'm2' as FieldAreaUnit },
                        { label: '0.5 ha', val: '0.5', unit: 'ha' as FieldAreaUnit },
                        { label: '1 ha', val: '1', unit: 'ha' as FieldAreaUnit },
                        { label: '2 ha', val: '2', unit: 'ha' as FieldAreaUnit },
                        { label: '5 ha', val: '5', unit: 'ha' as FieldAreaUnit },
                      ].map(preset => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setAreaUnit(preset.unit);
                            setAreaValueInput(preset.val);
                            setStepError(null);
                          }}
                          className="px-2 py-0.5 bg-white hover:bg-emerald-50 border border-stone-200 hover:border-emerald-300 rounded-lg text-stone-700 font-medium cursor-pointer transition"
                        >
                          {preset.label}
                        </button>
                      ))}
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

                  <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                          <Droplets className="w-4 h-4 text-sky-700" />
                          {t(
                            'Chưa rõ ruộng thoát nước nhanh hay chậm?',
                            'Unsure about field drainage speed?'
                          )}
                        </div>
                        <p className="text-[11px] text-sky-900/80">
                          {t(
                            'Hệ thống sẽ đối chiếu độ ẩm tầng mặt (SMAP), tầng rễ và lượng mưa 7 ngày (GPM) tại tọa độ ruộng để ước tính tự động.',
                            'Compare topsoil moisture (SMAP), root moisture, and 7-day rain (GPM) at your field coordinates to auto-estimate drainage.'
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAutoEstimateDrainage}
                        disabled={estimatingDrainage}
                        className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                      >
                        {estimatingDrainage ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        {estimatingDrainage
                          ? t('Đang phân tích NASA SMAP/GPM...', 'Analyzing SMAP/GPM...')
                          : t('Tự ước tính từ NASA SMAP/GPM', 'Auto-estimate via SMAP/GPM')}
                      </button>
                    </div>

                    {drainageEstimate && (
                      <div className="p-3 bg-white border border-sky-200 rounded-xl text-xs space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-emerald-900">
                            {t('Kết quả gợi ý:', 'Estimated drainage:')}{' '}
                            {getDrainageLabel(drainageEstimate.drainage, lang)}
                          </span>
                          <span className="text-[11px] font-mono text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                            SMAP {drainageEstimate.smapSurfacePct}% · {t('Rễ', 'Root')} {drainageEstimate.rootZonePct}% · GPM {drainageEstimate.gpmRain7dMm} mm
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-700 leading-relaxed">
                          {lang === 'en' ? drainageEstimate.explanationEn : drainageEstimate.explanationVi}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-stone-800 block mb-1">
                        {t('Khả năng thoát nước', 'Drainage Capacity')}
                      </label>
                      <select
                        value={drainage}
                        onChange={e => setDrainage(e.target.value as any)}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900 text-base sm:text-xs"
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
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900 text-base sm:text-xs"
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
                          onChange={e => {
                            const nextVal = e.target.value;
                            setCropName(nextVal);
                            if (nextVal.trim().length >= 2) {
                              const resolved = resolveCropBotanicalProfile(nextVal, seedFamily, cropCategory);
                              if (resolved.seedFamilyId !== seedFamily) {
                                setSeedFamily(resolved.seedFamilyId);
                              }
                              if (resolved.matchedPlant) {
                                setCropCategory(resolved.matchedPlant.category);
                              }
                            }
                          }}
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900 font-semibold text-base sm:text-xs"
                        />
                        {cropName.trim() && (
                          <div className="text-[11px] text-emerald-800 font-medium mt-1">
                            {t('Phân loại họ thực vật:', 'Botanical family:')}{' '}
                            <strong>
                              {lang === 'en'
                                ? resolveCropBotanicalProfile(cropName, seedFamily, cropCategory).familyLabelEn
                                : resolveCropBotanicalProfile(cropName, seedFamily, cropCategory).familyLabelVi}
                            </strong>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="font-semibold text-stone-700 text-xs block mb-1">
                          {t('Giống cây cụ thể', 'Specific variety / cultivar')}
                        </label>
                        <input
                          type="text"
                          value={variety}
                          onChange={e => setVariety(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900 text-base sm:text-xs"
                          placeholder={t('VD: ST25, Hắc Mỹ Nhân, ĐT84...', 'e.g. ST25, Hac My Nhan, DT84...')}
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
                        `Vị trí (${lat.toFixed(4)}°B, ${lon.toFixed(4)}°Đ) sẽ ghép với dữ liệu khí hậu vùng ${getLocalizedRegionName(nearestGrid.cell.region, 'vi')} (cách điểm tham chiếu ${nearestGrid.distanceKm} km) và xây dựng kế hoạch luân canh phù hợp cho ${getPlantDisplayName(cropName, 'vi')} (${getFamilyDisplayName(selectedFamilyObj, 'vi')}).`,
                        `Coordinates (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E) will link to regional climate data for ${getLocalizedRegionName(nearestGrid.cell.region, 'en')} (${nearestGrid.distanceKm} km from reference point) and tailor rotation advisories for ${getPlantDisplayName(cropName, 'en')} (${getFamilyDisplayName(selectedFamilyObj, 'en')}).`
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
