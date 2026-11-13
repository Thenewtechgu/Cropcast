import {
  BareFieldMonthAnalysis,
  FarmerConstraints,
  FarmerPriorityId,
  FieldProfile,
  RotationStrategy,
  WeatherObservation,
} from '../types';
import { findNearestNasaGrid, getCellMonthlyProfile, getLocalizedRegionName } from '../data/nasaVietnamGrid';
import { getSeedFamilyById, inferSeedFamilyFromCrop, getPlantDisplayName, getFamilyDisplayName } from '../data/cropTaxonomy';
import { getSoilLabel, getDrainageLabel } from './agronomyEngine';
import type { AppLanguage } from '../contexts/LanguageContext';

export function getLocalizedEvapRisk(risk: 'Thấp' | 'Trung bình' | 'Cao' | string, lang: AppLanguage = 'vi'): string {
  if (lang !== 'en') return risk;
  if (risk === 'Cao') return 'High';
  if (risk === 'Trung bình') return 'Moderate';
  if (risk === 'Thấp') return 'Low';
  return risk;
}

export interface ScenarioAdjustments {
  rainDeltaPct: number;
  tempDeltaC: number;
}

export interface HarmonizedFieldIndicators {
  rootMoisturePct: number;
  surfaceMoisturePct: number;
  evapotranspirationMmDay: number;
  heatStressIndex: string;
  erosionRisk: string;
  frostRiskMonths: number[];
  droughtRiskMonths: number[];
  floodRiskMonths: number[];
  longTermWaterTrend: string;
  vegetationStressNote: string;
  dataFusionSummary: string;
}

export const FARMER_PRIORITIES: Array<{ id: FarmerPriorityId; label: string; desc: string }> = [
  { id: 'water_saving', label: 'Tiết kiệm nước tưới', desc: 'Giảm nhu cầu bơm tưới vào mùa khô hanh' },
  { id: 'nitrogen_fixing', label: 'Cố định đạm tự nhiên', desc: 'Giảm phân đạm hóa học cho vụ sau' },
  { id: 'erosion_control', label: 'Chống xói mòn & rửa trôi', desc: 'Che phủ đất vào mùa mưa lớn hoặc đất trống' },
  { id: 'pest_break', label: 'Ngắt chu kỳ sâu bệnh', desc: 'Đổi họ cây trồng để hạn chế mầm bệnh lưu tồn' },
  { id: 'organic_matter', label: 'Tăng mùn & độ tơi xốp đất', desc: 'Bổ sung sinh khối hữu cơ và rễ sâu cải tạo đất' },
  { id: 'supplemental_income', label: 'Tăng thu nhập phụ / Thức ăn gia súc', desc: 'Tận dụng vụ xen để bán nông sản hoặc nuôi trâu bò' },
];

export function getFarmerPriorities(lang: AppLanguage = 'vi') {
  if (lang === 'en') {
    return [
      { id: 'water_saving' as const, label: 'Save irrigation water', desc: 'Reduce dry-season pumping demand' },
      { id: 'nitrogen_fixing' as const, label: 'Natural nitrogen fixation', desc: 'Cut synthetic N fertilizer & N₂O emissions' },
      { id: 'erosion_control' as const, label: 'Erosion & runoff control', desc: 'Cover bare soil against heavy rainfall' },
      { id: 'pest_break' as const, label: 'Break pest & disease cycles', desc: 'Rotate crop families to disrupt pathogens' },
      { id: 'organic_matter' as const, label: 'Build soil organic matter', desc: 'Add deep roots and biomass carbon' },
      { id: 'supplemental_income' as const, label: 'Extra income / livestock forage', desc: 'Sell intercrops or feed farm livestock' },
    ];
  }
  return FARMER_PRIORITIES;
}

export const SCIENTIFIC_GLOSSARY: Array<{
  term: string;
  simpleName: string;
  explanation: string;
  fieldExample: string;
}> = [
  {
    term: 'Bốc thoát hơi nước',
    simpleName: 'Lượng nước mất đi từ đất và lá cây',
    explanation:
      'Là tổng lượng nước bay hơi trực tiếp từ mặt đất cộng với lượng nước cây hút lên rồi thoát qua lá khi trời nắng và gió.',
    fieldExample:
      'Khi nắng to và gió khô, đất cát trống mất ẩm rất nhanh; che phủ rơm rạ hoặc trồng cây họ Đậu giúp giảm mạnh lượng nước thất thoát này.',
  },
  {
    term: 'Quang hợp SIF (NASA OCO-2/3)',
    simpleName: 'Tốc độ quang hợp và hấp thụ CO₂ thực tế của tán lá',
    explanation:
      'Vệ tinh OCO-2 đo ánh sáng huỳnh quang phát ra từ diệp lục khi cây quang hợp, giúp ước tính lượng Carbon hấp thụ (tấn CO₂/ha).',
    fieldExample:
      'SIF giảm thấp báo hiệu tán lá đang thiếu nước, thiếu đạm hoặc bị che mây kéo dài.',
  },
  {
    term: 'Trữ lượng nước ngầm (GRACE)',
    simpleName: 'Biến động mực nước tầng ngậm sâu (cm LWE)',
    explanation:
      'Vệ tinh GRACE-FO đo thay đổi trọng lực của khối lượng nước ngầm dưới lòng đất so với trung bình nhiều năm.',
    fieldExample:
      'Chỉ số âm (suy giảm) cảnh báo nên chuyển sang tưới tiết kiệm và ưu tiên cây chịu hạn.',
  },
  {
    term: 'Phát thải CH₄ & N₂O (GHGx / EDGAR)',
    simpleName: 'Khí nhà kính từ ruộng ngập nước và phân đạm',
    explanation:
      'Ước tính lượng Mê-tan (ruộng lúa ngập liên tục) và Nitơ oxit (từ phân đạm dư thừa), quy đổi sang tấn CO₂e/ha.',
    fieldExample:
      'Rút nước ngập–khô xen kẽ (AWD) và luân canh 1 vụ Đậu giúp cắt giảm đáng kể phát thải.',
  },
];

export function getScientificGlossary(lang: AppLanguage = 'vi') {
  if (lang === 'en') {
    return [
      {
        term: 'Evapotranspiration (ET₀)',
        simpleName: 'Water lost from soil surface and plant leaves',
        explanation: 'Combined evaporation from bare soil and transpiration through crop foliage under sun and wind.',
        fieldExample: 'Straw mulching or cover legumes sharply cut moisture loss during hot, windy weeks.',
      },
      {
        term: 'Solar-Induced Fluorescence (OCO-2 SIF)',
        simpleName: 'Satellite measure of active canopy photosynthesis & CO₂ uptake',
        explanation: 'NASA OCO-2/3 measures chlorophyll fluorescence emitted during photosynthesis to estimate CO₂ uptake (t CO₂/ha).',
        fieldExample: 'Low SIF highlights nitrogen deficiency, drought stress, or dense cloud cover early.',
      },
      {
        term: 'Groundwater Anomaly (GRACE-FO)',
        simpleName: 'Subsurface aquifer storage change (cm LWE)',
        explanation: 'GRACE satellites track gravity shifts caused by groundwater recharge or depletion.',
        fieldExample: 'Negative values warn against deep borewell pumping and favor drought-resilient crops.',
      },
      {
        term: 'Agricultural CH₄ & N₂O (GHGx / EDGAR)',
        simpleName: 'Greenhouse gas intensity from flooded soils & nitrogen fertilizer',
        explanation: 'Combines methane from anaerobic rice soils and nitrous oxide from synthetic nitrogen converted to t CO₂e/ha.',
        fieldExample: 'Alternate Wetting & Drying (AWD) plus legume rotation reduce both gases and fertilizer cost.',
      },
    ];
  }
  return SCIENTIFIC_GLOSSARY;
}

export function computeHarmonizedIndicators(
  field: FieldProfile,
  weather: WeatherObservation,
  scenario: ScenarioAdjustments,
  lang: AppLanguage = 'vi'
): HarmonizedFieldIndicators {
  const isEn = lang === 'en';
  const { cell } = findNearestNasaGrid(field.lat, field.lon);
  const adjustedTemp = weather.temp + scenario.tempDeltaC;
  const rainFactor = 1 + scenario.rainDeltaPct / 100;
  const earth = field.adaptiveMemory?.earthMetrics;

  const drainageMultiplier =
    field.soilCharacteristics.drainage === 'fast'
      ? 0.88
      : field.soilCharacteristics.drainage === 'slow'
      ? 1.12
      : 1.0;

  const moistureShift = (scenario.rainDeltaPct / 100) * 0.22 - scenario.tempDeltaC * 0.03;
  const rootMoisturePct = Math.round(
    Math.min(98, Math.max(12, (weather.gwetroot + moistureShift) * drainageMultiplier * 100))
  );
  const surfaceMoisturePct = Math.round(
    Math.min(99, Math.max(8, (weather.gwettop + moistureShift * 1.2) * drainageMultiplier * 100))
  );

  const et0 = Math.max(
    1.5,
    Number((0.18 * adjustedTemp + 0.14 * weather.solarRadiation - 0.02 * weather.humidity).toFixed(1))
  );

  const heatStressIndex =
    adjustedTemp >= 33 || weather.maxTemp + scenario.tempDeltaC >= 36
      ? isEn
        ? 'High'
        : 'Cao'
      : adjustedTemp >= 28
      ? isEn
        ? 'Moderate'
        : 'Trung bình'
      : isEn
      ? 'Low'
      : 'Thấp';

  const projectedAnnualRain = cell.climatology21Yr.annualRainfallMm * rainFactor;
  const erosionRisk =
    projectedAnnualRain > 2000 || (field.soilCharacteristics.drainage === 'fast' && scenario.rainDeltaPct > 15)
      ? isEn
        ? 'High'
        : 'Cao'
      : projectedAnnualRain > 1500
      ? isEn
        ? 'Moderate'
        : 'Trung bình'
      : isEn
      ? 'Low'
      : 'Thấp';

  const grace = earth?.groundwaterAnomalyGrace;
  const longTermWaterTrend = grace
    ? isEn
      ? `GRACE-FO aquifer anomaly: ${grace.lweThicknessCm >= 0 ? '+' : ''}${grace.lweThicknessCm} cm LWE (${grace.groundwaterStatus}). Root water balance ${grace.soilWaterBalancePct}%.`
      : `Vệ tinh GRACE-FO ghi nhận biến động nước ngầm ${grace.lweThicknessCm >= 0 ? '+' : ''}${grace.lweThicknessCm} cm LWE (${grace.groundwaterStatus === 'depleting' ? 'đang suy giảm' : grace.groundwaterStatus === 'recharging' ? 'đang phục hồi' : 'ổn định'}), cân bằng ẩm rễ ${grace.soilWaterBalancePct}%.`
    : cell.lat < 11.5
    ? isEn
      ? 'Lower delta region shows heightened dry-season water table swings and local salinity risk.'
      : 'Vùng đồng bằng hạ lưu có xu hướng gia tăng dao động mực nước mùa khô và xâm nhập mặn cục bộ.'
    : isEn
    ? 'Distinct wet/dry seasonal water distribution; store root-zone moisture ahead of dry months.'
    : 'Lượng nước phân bố lệch rõ rệt theo mùa, cần tích ẩm tầng rễ trong thời kỳ nắng gắt.';

  const oco2 = earth?.carbonFluxOco2;
  const vegetationStressNote =
    oco2 && oco2.photosynthesisStatus === 'low'
      ? isEn
        ? `OCO-2 SIF (${oco2.sifWm2SrUm}) shows low photosynthetic activity (${oco2.carbonUptakeTonHaYr} t CO₂/ha); inspect leaf nitrogen and moisture.`
        : `Chỉ số OCO-2 SIF (${oco2.sifWm2SrUm}) cho thấy cường độ quang hợp thấp (${oco2.carbonUptakeTonHaYr} tấn CO₂/ha); cần kiểm tra đạm và độ ẩm tán.`
      : rootMoisturePct < 35
      ? isEn
        ? 'Low root moisture weakens photosynthesis and risks midday wilting.'
        : 'Độ ẩm vùng rễ xuống thấp, tán lá có nguy cơ giảm quang hợp và héo rũ trưa nắng.'
      : isEn
      ? 'Canopy cover and root moisture remain within a healthy range.'
      : 'Độ che phủ và cân bằng ẩm đang trong vùng an toàn cho cây phát triển.';

  return {
    rootMoisturePct,
    surfaceMoisturePct,
    evapotranspirationMmDay: et0,
    heatStressIndex,
    erosionRisk,
    frostRiskMonths: cell.climatology21Yr.riskMonthsCold,
    droughtRiskMonths: cell.climatology21Yr.riskMonthsDrought,
    floodRiskMonths: cell.climatology21Yr.riskMonthsFlood,
    longTermWaterTrend,
    vegetationStressNote,
    dataFusionSummary: isEn
      ? `Harmonizing 21-year NASA POWER (${getLocalizedRegionName(cell.region, 'en')}), ${getSoilLabel(field.soilType, 'en')}, and ${earth ? 'OCO-2 + GRACE + GHGx satellite observations' : 'field soil/water physics'}.`
      : `Đồng bộ dữ liệu NASA POWER 21 năm (${cell.region}), đất ${getSoilLabel(field.soilType, 'vi').toLowerCase()} (${getDrainageLabel(field.soilCharacteristics.drainage, 'vi').toLowerCase()})${earth ? ' cùng chỉ số OCO-2, GRACE và GHGx' : ''}.`,
  };
}

export function analyzeBareFieldAndStressTimeline(
  field: FieldProfile,
  scenario: ScenarioAdjustments,
  lang: AppLanguage = 'vi'
): BareFieldMonthAnalysis[] {
  const isEn = lang === 'en';
  const { cell } = findNearestNasaGrid(field.lat, field.lon);
  const monthly = getCellMonthlyProfile(cell);
  const plantingMonth = field.crop.plantingDate
    ? new Date(field.crop.plantingDate).getMonth() + 1
    : 11;

  const activeMonths = new Set<number>();
  for (let offset = 0; offset < 4; offset++) {
    activeMonths.add(((plantingMonth - 1 + offset) % 12) + 1);
  }
  const transitionMonth = ((plantingMonth - 1 + 4) % 12) + 1;

  return monthly.map((m) => {
    const monthNum = m.monthNum;
    const adjTemp = m.T2M + scenario.tempDeltaC;
    const adjRain = m.PRECTOTCORR * (1 + scenario.rainDeltaPct / 100);
    const moistShift = (scenario.rainDeltaPct / 100) * 0.2 - scenario.tempDeltaC * 0.025;
    const soilMoisturePct = Math.round(
      Math.min(96, Math.max(12, (m.GWETROOT + moistShift) * 100))
    );

    const isCold = cell.climatology21Yr.riskMonthsCold.includes(monthNum) || adjTemp < 17;
    const isDrought = cell.climatology21Yr.riskMonthsDrought.includes(monthNum) || soilMoisturePct < 38;
    const isFlood = cell.climatology21Yr.riskMonthsFlood.includes(monthNum) || adjRain > 260;

    let fieldState: BareFieldMonthAnalysis['fieldState'] = 'bare_fallow';
    if (activeMonths.has(monthNum)) fieldState = 'active_crop';
    else if (monthNum === transitionMonth) fieldState = 'harvest_transition';

    let dominantRisk = isEn ? 'Relatively stable conditions' : 'Điều kiện tương đối ổn định';
    let stressLevel: 'low' | 'moderate' | 'high' = 'low';

    if (isFlood) {
      dominantRisk =
        fieldState === 'bare_fallow'
          ? isEn
            ? 'Bare soil + heavy rain — erosion & nutrient leaching risk'
            : 'Đất trống gặp mưa lớn — nguy cơ xói mòn & rửa trôi dinh dưỡng'
          : isEn
          ? 'Extreme rain — root waterlogging risk'
          : 'Mưa cực đoan — nguy cơ ngập úng vùng rễ';
      stressLevel = 'high';
    } else if (isDrought) {
      dominantRisk =
        fieldState === 'bare_fallow'
          ? isEn
            ? 'Exposed bare soil — rapid moisture loss & crusting'
            : 'Đất trống phơi nắng — bốc hơi ẩm mạnh & chai cứng mặt đất'
          : isEn
          ? 'Root moisture deficit & high evapotranspiration'
          : 'Thiếu ẩm vùng rễ & bốc thoát hơi nước cao';
      stressLevel = 'high';
    } else if (isCold) {
      dominantRisk = isEn
        ? 'Low night temp — cold stress risk for seedlings'
        : 'Nhiệt độ đêm thấp — nguy cơ rét hại cho mạ và cây non';
      stressLevel = 'moderate';
    } else if (adjTemp > 31) {
      dominantRisk = isEn
        ? 'High daytime heat — midday thermal stress'
        : 'Nắng nóng cao điểm — cây dễ sốc nhiệt buổi trưa';
      stressLevel = 'moderate';
    }

    const evaporationRisk: 'Thấp' | 'Trung bình' | 'Cao' =
      adjTemp >= 29 || m.ALLSKY_SFC_SW_DWN > 18.5
        ? 'Cao'
        : adjTemp >= 23
        ? 'Trung bình'
        : 'Thấp';

    let recommendationNote = isEn ? 'Maintain routine monitoring.' : 'Duy trì theo dõi định kỳ.';
    if (fieldState === 'bare_fallow') {
      recommendationNote = isFlood
        ? isEn
          ? 'Avoid bare soil: sow cover legumes (sesbania/black bean) to anchor topsoil.'
          : 'Tránh để đất trống: nên gieo cây che phủ họ Đậu (điền thanh, đậu đen) để giữ đất.'
        : isEn
        ? 'Fallow gap: plant short-season mungbean or mulch straw to preserve moisture.'
        : 'Khoảng trống giữa vụ: thích hợp trồng đậu xanh ngắn ngày hoặc tủ rơm giữ ẩm.';
    } else if (fieldState === 'harvest_transition') {
      recommendationNote = isEn
        ? 'Transition window: prepare seeds from a different plant family to break pests.'
        : 'Giai đoạn chuyển vụ: chuẩn bị hạt giống họ khác để ngắt chu kỳ sâu bệnh.';
    } else if (stressLevel === 'high') {
      recommendationNote = isEn
        ? 'High climate stress for current crop; choose drought/flood resilient rotation.'
        : 'Cây trồng hiện tại nhạy cảm cao trong tháng này; cân nhắc giống chịu hạn/úng tốt hơn.';
    }

    return {
      month: monthNum,
      monthLabel: isEn ? `Month ${monthNum}` : `Tháng ${monthNum}`,
      fieldState,
      stressLevel,
      dominantRisk,
      soilMoisturePct,
      evaporationRisk,
      frostOrColdRisk: isCold,
      extremeRainRisk: isFlood,
      recommendationNote,
    };
  });
}

export function generateRotationStrategies(
  field: FieldProfile,
  weather: WeatherObservation,
  priorities: FarmerPriorityId[],
  constraints: FarmerConstraints,
  scenario: ScenarioAdjustments,
  lang: AppLanguage = 'vi'
): RotationStrategy[] {
  const isEn = lang === 'en';
  const familyId = field.crop.seedFamily || inferSeedFamilyFromCrop(field.crop.name, field.crop.category);
  const currentFamily = getSeedFamilyById(familyId);
  const indicators = computeHarmonizedIndicators(field, weather, scenario, lang);
  const earth = field.adaptiveMemory?.earthMetrics;

  const graceDepleting = earth?.groundwaterAnomalyGrace?.groundwaterStatus === 'depleting';
  const ghgHigh = earth?.greenhouseGasEdgar?.emissionLevel === 'high';
  const oco2Low = earth?.carbonFluxOco2?.photosynthesisStatus === 'low';

  const isWaterTight =
    constraints.waterAvailability !== 'abundant' ||
    priorities.includes('water_saving') ||
    indicators.rootMoisturePct < 45 ||
    graceDepleting;
  const isSlowDrainage =
    field.soilCharacteristics.drainage === 'slow' ||
    ['clay', 'clay_loam', 'acid_sulfate', 'peat_muck'].includes(field.soilType);
  const wantsForageOrIncome =
    priorities.includes('supplemental_income') || constraints.marketPreference !== 'cash_crop';

  const baseline: RotationStrategy = {
    id: 'rot-baseline',
    isCurrentBaseline: true,
    title: isEn
      ? `Current Baseline: Continue ${getPlantDisplayName(field.crop.name, 'en')} (${getFamilyDisplayName(currentFamily, 'en')})`
      : `Phương án hiện tại: Tiếp tục trồng ${field.crop.name} (${currentFamily.name})`,
    sequenceSummary: isEn
      ? `${getPlantDisplayName(field.crop.name, 'en')} → Bare fallow → ${getPlantDisplayName(field.crop.name, 'en')}`
      : `${field.crop.name} → Nghỉ đất trống → ${field.crop.name}`,
    nextCropFamily: familyId,
    nextCropName: getPlantDisplayName(field.crop.name, lang),
    suitabilityScore: isWaterTight || ghgHigh || priorities.includes('pest_break') ? 52 : 68,
    whySuggested: isEn
      ? 'Reference baseline reflecting your current monoculture setup to compare water, emissions, and pest risk.'
      : 'Là phương án đối chứng dựa trên tập quán canh tác hiện tại của thửa ruộng để bạn so sánh chi phí, nước ngầm, phát thải và rủi ro sâu bệnh.',
    supportingEvidence: [
      isEn
        ? `Estimated root moisture ${indicators.rootMoisturePct}% and ET₀ ${indicators.evapotranspirationMmDay} mm/day.`
        : `Đất ${getSoilLabel(field.soilType, 'vi').toLowerCase()} hiện có độ ẩm rễ ${indicators.rootMoisturePct}% và bốc thoát hơi nước ${indicators.evapotranspirationMmDay} mm/ngày.`,
      earth
        ? isEn
          ? `GHGx/EDGAR baseline: ${earth.greenhouseGasEdgar.co2eqTonHa} t CO₂e/ha; GRACE groundwater: ${earth.groundwaterAnomalyGrace.lweThicknessCm} cm LWE.`
          : `Phát thải hiện tại (GHGx): ${earth.greenhouseGasEdgar.co2eqTonHa} tấn CO₂e/ha; Nước ngầm GRACE: ${earth.groundwaterAnomalyGrace.lweThicknessCm} cm LWE.`
        : isEn
        ? 'Sync NASA Earth metrics to include groundwater & emission baseline.'
        : 'Đồng bộ dữ liệu NASA để bổ sung đối chiếu nước ngầm & phát thải.',
    ],
    benefits: {
      nutrientCycling: isEn ? 'No biological N fixation; relies on synthetic inputs.' : 'Không bổ sung đạm sinh học tự nhiên; phụ thuộc hoàn toàn vào phân bón.',
      waterDemand: isEn ? 'High seasonal irrigation dependence.' : 'Nhu cầu nước giữ nguyên như các vụ trước.',
      erosionAndOrganicMatter: isEn ? 'Bare fallow degrades topsoil carbon.' : 'Thời gian đất trống làm giảm mùn và tăng xói mòn.',
      pestCycleDisruption: isEn ? 'Same plant family does not interrupt pest cycles.' : 'Không cắt được chu kỳ sâu bệnh do trồng lặp cùng họ.',
      forageAndIncome: isEn ? 'Familiar local market channel.' : 'Đầu ra quen thuộc nhưng dễ rủi ro khi thời tiết cực đoan.',
    },
    informationGaps: [
      isEn ? 'Actual post-harvest NPK & soil pH lab test needed.' : 'Chưa có kết quả kiểm nghiệm NPK & pH đất thực tế sau vụ thu hoạch.',
    ],
    localReviewRisks: [
      isEn ? 'Higher pest buildup after 2–3 consecutive same-family cycles.' : 'Nguy cơ tích tụ sâu bệnh chuyên tính sau 2–3 vụ liên tiếp.',
    ],
    alignedPriorities: [],
  };

  const isLightOrDrySoil = ['sand', 'sandy_loam', 'gray_degraded', 'gravelly', 'ferralsol'].includes(field.soilType);
  const legumeCrop =
    isLightOrDrySoil || isWaterTight
      ? isEn
        ? 'Peanut or Short-season Mungbean'
        : 'Lạc (Đậu phộng) hoặc Đậu xanh ngắn ngày'
      : isEn
      ? 'Soybean or Mungbean'
      : 'Đậu tương (Đậu nành) hoặc Đậu xanh';

  const legumeScore =
    82 +
    (priorities.includes('nitrogen_fixing') ? 6 : 0) +
    (priorities.includes('pest_break') ? 5 : 0) +
    (priorities.includes('water_saving') ? 4 : 0) +
    (ghgHigh ? 7 : 0) +
    (graceDepleting ? 4 : 0) -
    (isSlowDrainage ? 6 : 0);

  const legumeStrategy: RotationStrategy = {
    id: 'rot-legume',
    isCurrentBaseline: false,
    title: isEn
      ? `Nitrogen-Fixing & Low-Emission Rotation: ${legumeCrop}`
      : `Luân canh Cố định đạm & Giảm phát thải: Xen vụ ${legumeCrop}`,
    sequenceSummary: isEn
      ? `${getPlantDisplayName(field.crop.name, 'en')} → ${legumeCrop} (Legume) → Main season`
      : `${field.crop.name} → ${legumeCrop} (Họ Đậu) → Vụ chính kế tiếp`,
    nextCropFamily: 'fabaceae',
    nextCropName: legumeCrop,
    suitabilityScore: Math.min(98, legumeScore),
    whySuggested: isEn
      ? `Rotating to Legumes fixes 40–70 kg N/ha naturally, cuts N₂O/CH₄ emissions tracked by GHGx, breaks pest cycles, and uses far less groundwater.`
      : `Chuyển sang Họ Đậu giúp cố định 40–70 kg đạm/ha tự nhiên, giảm mạnh phát thải CH₄/N₂O (GHGx), cắt sâu bệnh và tiết kiệm nước ngầm (GRACE).`,
    supportingEvidence: [
      earth
        ? isEn
          ? `GHGx/EDGAR (${earth.greenhouseGasEdgar.co2eqTonHa} t CO₂e/ha) drops sharply when replacing flooded monoculture with a legume break crop.`
          : `GHGx/EDGAR ghi nhận ${earth.greenhouseGasEdgar.co2eqTonHa} tấn CO₂e/ha; xen 1 vụ Đậu giúp cắt mạnh phát thải N₂O và CH₄.`
        : isEn
        ? 'Legumes enrich soil nitrogen and cut synthetic Urea costs.'
        : 'Họ Đậu bổ sung đạm sinh học, giảm 20–30% phân Urê cho vụ sau.',
      isEn
        ? `At ET₀ ${indicators.evapotranspirationMmDay} mm/day, short-season legumes consume 35–50% less water than flooded crops.`
        : `Trong điều kiện bốc thoát hơi ${indicators.evapotranspirationMmDay} mm/ngày, đậu xanh/lạc tiêu thụ ít nước hơn hẳn lúa nước hoặc rau dài ngày.`,
    ],
    benefits: {
      nutrientCycling: isEn ? 'Fixes 40–70 kg N/ha naturally for the next crop.' : 'Nốt sần rễ cố định 40–70 kg đạm tự nhiên/ha cho vụ sau.',
      waterDemand: isEn ? 'Deep taproot & short 65–95 day cycle saves groundwater.' : 'Rễ cọc hút ẩm sâu và chu kỳ ngắn 65–95 ngày tiết kiệm nước.',
      erosionAndOrganicMatter: isEn ? 'Biomass residues build topsoil carbon.' : 'Thân lá đậu cày vùi giúp tăng mùn và giữ ẩm tầng mặt.',
      pestCycleDisruption: isEn ? 'Non-host family breaks rice/cereal pest cycles.' : 'Khác họ thực vật giúp ngắt triệt để sâu đục thân và nấm bệnh cũ.',
      forageAndIncome: isEn ? 'High-value grain plus protein-rich haulms for livestock.' : 'Thu hạt thương phẩm giá tốt kèm phụ phẩm làm thức ăn gia súc.',
    },
    informationGaps: [
      isEn ? 'Verify topsoil pH (>5.2) before sowing legumes.' : 'Cần kiểm tra pH đất (đậu kém phát triển nếu đất quá chua pH < 5.2).',
    ],
    localReviewRisks: [
      isSlowDrainage
        ? isEn
          ? 'Slow-draining soil requires raised beds & drainage furrows.'
          : 'Đất thoát nước chậm bắt buộc lên luống cao và đánh rãnh sâu tránh thối rễ.'
        : isEn
        ? 'Scout for rust and leaf-eating caterpillars during vegetative stage.'
        : 'Theo dõi sâu ăn lá và bệnh gỉ sắt theo mùa.',
    ],
    alignedPriorities: ['nitrogen_fixing', 'pest_break', 'water_saving', 'organic_matter', 'supplemental_income'],
  };

  const resilientCrop =
    constraints.marketPreference === 'forage_livestock'
      ? isEn
        ? 'Drought-Tolerant Biomass Maize / Sorghum'
        : 'Ngô sinh khối / Cao lương chịu hạn'
      : ['sand', 'sandy_loam', 'loam', 'sandy_clay_loam', 'gray_degraded', 'basalt'].includes(field.soilType)
      ? isEn
        ? 'Sweet Potato (Ground-cover Tuber)'
        : 'Khoai lang mật / Khoai lang tím'
      : isEn
      ? 'Short-season Corn or Squash Cover'
      : 'Ngô nếp ngắn ngày hoặc Bí đỏ phủ đất';

  const resilientFamily =
    resilientCrop.includes('Khoai lang') || resilientCrop.includes('Potato')
      ? 'other_perennial'
      : resilientCrop.includes('Bí') || resilientCrop.includes('Squash')
      ? 'cucurbitaceae'
      : 'poaceae';

  const resilientScore =
    78 +
    (wantsForageOrIncome ? 7 : 0) +
    (priorities.includes('erosion_control') ? 5 : 0) +
    (priorities.includes('water_saving') ? 5 : 0) +
    (graceDepleting ? 6 : 0) -
    (familyId === resilientFamily ? 10 : 0);

  const resilientStrategy: RotationStrategy = {
    id: 'rot-resilient',
    isCurrentBaseline: false,
    title: isEn
      ? `Drought-Resilient & Income Rotation: ${resilientCrop}`
      : `Luân canh Chịu hạn & Tăng thu nhập: Trồng ${resilientCrop}`,
    sequenceSummary: isEn
      ? `${getPlantDisplayName(field.crop.name, 'en')} → ${resilientCrop} → Legume / Main crop`
      : `${field.crop.name} → ${resilientCrop} → Họ Đậu / Vụ chính`,
    nextCropFamily: resilientFamily,
    nextCropName: resilientCrop,
    suitabilityScore: Math.min(96, Math.max(60, resilientScore)),
    whySuggested: isEn
      ? `Adapted to groundwater deficits (GRACE) and erratic dry spells while diversifying farm income or livestock fodder.`
      : `Tối ưu khi mực nước ngầm suy giảm (GRACE) hoặc nắng hạn thất thường, vừa tăng thu nhập phụ vừa bảo vệ đất mặt.`,
    supportingEvidence: [
      earth?.groundwaterAnomalyGrace
        ? isEn
          ? `GRACE LWE anomaly (${earth.groundwaterAnomalyGrace.lweThicknessCm} cm) favors deep-rooted or low-irrigation crops.`
          : `GRACE ghi nhận mực nước ngầm ${earth.groundwaterAnomalyGrace.lweThicknessCm} cm LWE, phù hợp cây chịu hạn ít bơm tưới.`
        : isEn
        ? `Surface moisture ${indicators.surfaceMoisturePct}% favors broad canopy crops to shade soil.`
        : `Độ ẩm tầng mặt ${indicators.surfaceMoisturePct}% phù hợp cây có tán che phủ giữ ẩm.`,
    ],
    benefits: {
      nutrientCycling: isEn ? 'Deep roots recover leached subsoil nutrients.' : 'Rễ sâu thu hồi khoáng chất bị rửa trôi xuống tầng đất dưới.',
      waterDemand: isEn ? 'Tolerates dry intervals with residual soil moisture.' : 'Chịu khô hạn tốt, tận dụng ẩm dư sau vụ mưa.',
      erosionAndOrganicMatter: isEn ? 'Broad canopy shields topsoil from heavy raindrop impact.' : 'Tán lá rộng giảm xói mòn khi mưa lớn.',
      pestCycleDisruption:
        familyId === resilientFamily
          ? isEn
            ? 'Same grass family — follow with a legume season.'
            : 'Cùng họ Hòa thảo — nên xen thêm 1 vụ họ Đậu sau đó.'
          : isEn
          ? 'Different family disrupts specialist soil pests.'
          : 'Khác họ thực vật giúp hạn chế sâu bệnh lưu tồn.',
      forageAndIncome: isEn ? 'Dual-purpose cash crop and livestock silage/vines.' : 'Dễ bán củ/quả hoặc tận dụng thân lá nuôi gia súc.',
    },
    informationGaps: [
      isEn ? 'Confirm local wholesale demand before sowing.' : 'Kiểm tra nhu cầu thu mua tại thương lái/chợ địa phương.',
    ],
    localReviewRisks: [
      isEn ? 'Supplement balanced potassium & compost for tubers/maize.' : 'Cây lấy củ/ngô cần bổ sung thêm kali & hữu cơ để tránh bạc màu đất.',
    ],
    alignedPriorities: ['supplemental_income', 'erosion_control', 'water_saving', 'organic_matter'],
  };

  const coverScore =
    76 +
    (priorities.includes('erosion_control') ? 9 : 0) +
    (priorities.includes('organic_matter') ? 8 : 0) +
    (oco2Low ? 6 : 0) +
    (indicators.erosionRisk === 'Cao' || indicators.erosionRisk === 'High' ? 6 : 0);

  const coverStrategy: RotationStrategy = {
    id: 'rot-cover',
    isCurrentBaseline: false,
    title: isEn
      ? 'Carbon Cover Crop & Soil Recovery: Sesbania / Sunn Hemp / Black Bean'
      : 'Luân canh Cây che phủ & Phục hồi Carbon đất: Gieo Điền thanh / Muồng hoa vàng',
    sequenceSummary: isEn
      ? `${getPlantDisplayName(field.crop.name, 'en')} → Green Manure Cover (45–55d) → Main crop`
      : `${field.crop.name} → Cây che phủ họ Đậu (45–55 ngày) → Vụ chính`,
    nextCropFamily: 'fabaceae',
    nextCropName: isEn
      ? 'Sesbania / Sunn Hemp / Cover Black Bean'
      : 'Điền thanh / Muồng hoa vàng hoặc Đậu đen che phủ',
    suitabilityScore: Math.min(97, coverScore),
    whySuggested: isEn
      ? 'Protects bare soil during off-season gaps, boosts OCO-2 biomass carbon uptake, and prevents nutrient runoff.'
      : 'Lấp khoảng trống đất trống giữa 2 vụ để chống xói mòn, tăng hấp thụ Carbon (OCO-2) và cải tạo độ phì đất.',
    supportingEvidence: [
      earth?.carbonFluxOco2
        ? isEn
          ? `OCO-2 carbon uptake (${earth.carbonFluxOco2.carbonUptakeTonHaYr} t CO₂/ha) rises when off-season bare ground is covered with fast-growing green manure.`
          : `Hấp thụ Carbon (OCO-2: ${earth.carbonFluxOco2.carbonUptakeTonHaYr} tấn CO₂/ha) sẽ tăng rõ rệt khi phủ xanh ruộng thay vì để đất trống.`
        : isEn
        ? '45–55 day cover crop builds topsoil humus without delaying main planting.'
        : 'Cây che phủ 45–55 ngày không làm chậm lịch gieo vụ chính.',
    ],
    benefits: {
      nutrientCycling: isEn ? 'Fixes atmospheric N and traps residual nutrients.' : 'Cố định đạm sinh học và giữ lại dinh dưỡng tồn dư.',
      waterDemand: isEn ? 'Rainfed / residual moisture only; zero irrigation needed.' : 'Gần như chỉ dùng ẩm tồn dư, không cần bơm tưới.',
      erosionAndOrganicMatter: isEn ? 'Fastest organic carbon restoration across strategies.' : 'Tăng mùn hữu cơ nhanh nhất và chống rửa trôi hiệu quả.',
      pestCycleDisruption: isEn ? 'Suppresses weeds and supports beneficial insects.' : 'Ức chế cỏ dại tự nhiên và tăng thiên địch.',
      forageAndIncome: isEn ? 'Cuts synthetic fertilizer bills for the following main crop.' : 'Giảm mạnh chi phí phân bón & công làm cỏ cho vụ chính sau.',
    },
    informationGaps: [
      isEn ? 'Check green-manure seed availability at local cooperative.' : 'Kiểm tra nguồn giống điền thanh/đậu đen tại hợp tác xã.',
    ],
    localReviewRisks: [
      isEn ? 'Incorporate biomass at flowering before seed set to avoid weeds.' : 'Cày vùi trước khi cây kết hạt già (10–14 ngày trước vụ chính).',
    ],
    alignedPriorities: ['erosion_control', 'organic_matter', 'nitrogen_fixing', 'pest_break', 'water_saving'],
  };

  return [baseline, legumeStrategy, resilientStrategy, coverStrategy].sort((a, b) =>
    a.isCurrentBaseline === b.isCurrentBaseline ? b.suitabilityScore - a.suitabilityScore : a.isCurrentBaseline ? -1 : 1
  );
}

export function pickBestRotationStrategy(
  field: FieldProfile,
  weather: WeatherObservation,
  priorities: FarmerPriorityId[],
  constraints: FarmerConstraints,
  excludedIds: string[] = [],
  rejectionReason?: string,
  lang: AppLanguage = 'vi'
): RotationStrategy {
  const isEn = lang === 'en';
  const all = generateRotationStrategies(
    field,
    weather,
    priorities,
    constraints,
    { rainDeltaPct: 0, tempDeltaC: 0 },
    lang
  );

  const nonBaselineCandidates = all
    .filter((s) => !s.isCurrentBaseline && !excludedIds.includes(s.id))
    .sort((a, b) => b.suitabilityScore - a.suitabilityScore);

  if (nonBaselineCandidates.length > 0) {
    const picked = nonBaselineCandidates[0];
    if (rejectionReason) {
      return {
        ...picked,
        whySuggested: isEn
          ? `${picked.whySuggested} (Selected to address your constraint: "${rejectionReason}").`
          : `${picked.whySuggested} (Đã chọn ưu tiên thay thế vì lý do của bạn: "${rejectionReason}").`,
      };
    }
    return picked;
  }

  const lowerReason = (rejectionReason || '').toLowerCase();
  const isMarketConcern =
    lowerReason.includes('bán') || lowerReason.includes('đầu ra') || lowerReason.includes('market') || lowerReason.includes('sell');
  const isFloodConcern =
    lowerReason.includes('úng') || lowerReason.includes('ngập') || lowerReason.includes('flood') || lowerReason.includes('wet');

  const altCrop = isFloodConcern
    ? isEn
      ? 'Taro / Raised-bed Sesame'
      : 'Khoai môn nước hoặc Mè (Vừng) lên luống cao'
    : isMarketConcern
    ? isEn
      ? 'Cucumber / Wax Gourd / Leafy Greens'
      : 'Dưa leo / Bí xanh hoặc Rau ăn lá ngắn ngày dễ bán'
    : isEn
    ? 'Drought-Tolerant Black Sesame or Okra'
    : 'Vừng (Mè) đen chịu hạn hoặc Đậu bắp ngắn ngày ít công';

  const altFamily = isMarketConcern ? 'cucurbitaceae' : 'other_perennial';
  const indicators = computeHarmonizedIndicators(field, weather, { rainDeltaPct: 0, tempDeltaC: 0 }, lang);

  return {
    id: `rot-adaptive-${Date.now()}`,
    isCurrentBaseline: false,
    title: isEn
      ? `Tailored Rotation for Your Field: ${altCrop}`
      : `Phương án điều chỉnh riêng cho ruộng của bạn: Trồng ${altCrop}`,
    sequenceSummary: isEn
      ? `${getPlantDisplayName(field.crop.name, 'en')} → ${altCrop} → Straw Mulch`
      : `${field.crop.name} → ${altCrop} → Phủ rơm giữ ẩm`,
    nextCropFamily: altFamily,
    nextCropName: altCrop,
    suitabilityScore: 89,
    whySuggested: rejectionReason
      ? isEn
        ? `Tailored directly to your feedback ("${rejectionReason}") to resolve market, labor, or soil constraints.`
        : `Được điều chỉnh trực tiếp theo phản hồi thực tế của bạn ("${rejectionReason}") để khắc phục trở ngại về đầu ra, công lao động hoặc đất.`
      : isEn
      ? 'Flexible cross-family alternative with fast cash turnaround.'
      : 'Phương án thay thế linh hoạt khác họ, ngắn ngày và dễ tiêu thụ tại địa phương.',
    supportingEvidence: [
      isEn
        ? `Root moisture ${indicators.rootMoisturePct}% and ${getSoilLabel(field.soilType, 'en')} support rapid 50–70 day maturity.`
        : `Độ ẩm rễ ${indicators.rootMoisturePct}% và đất ${getSoilLabel(field.soilType, 'vi').toLowerCase()} phù hợp cây ngắn ngày 50–70 ngày.`,
    ],
    benefits: {
      nutrientCycling: isEn ? 'Pair composted manure with crop residue incorporation.' : 'Kết hợp hữu cơ hoai mục và vùi tàn dư sau thu hoạch.',
      waterDemand: isFloodConcern
        ? isEn
          ? 'Tolerates wet periods when planted on raised beds.'
          : 'Chịu ẩm tốt khi lên luống cao thoát nước.'
        : isEn
        ? 'Moderate water demand.'
        : 'Nhu cầu nước vừa phải, dễ điều tiết.',
      erosionAndOrganicMatter: isEn ? 'Covers soil during inter-season gap.' : 'Che phủ đất trong giai đoạn chuyển vụ.',
      pestCycleDisruption: isEn ? 'Switches host family completely.' : 'Thay đổi nhóm cây ký chủ hoàn toàn.',
      forageAndIncome: isEn ? 'Quick cash harvest for local markets.' : 'Dễ bán nhanh tại chợ địa phương.',
    },
    informationGaps: [
      isEn ? 'Confirm local market buyers 2 weeks before sowing.' : 'Kiểm tra nhu cầu thu mua tại chợ xã/hợp tác xã trước khi xuống giống.',
    ],
    localReviewRisks: [
      isEn ? 'Check bed drainage during heavy rainstorms.' : 'Theo dõi thoát nước mặt luống khi có mưa lớn đột ngột.',
    ],
    alignedPriorities: priorities,
  };
}
