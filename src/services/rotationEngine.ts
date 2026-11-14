import {
  BareFieldMonthAnalysis,
  FarmerConstraints,
  FarmerPriorityId,
  FieldProfile,
  RotationStrategy,
  WeatherObservation,
} from '../types';
import { findNearestNasaGrid, getCellMonthlyProfile, getLocalizedRegionName } from '../data/nasaVietnamGrid';
import {
  resolveCropBotanicalProfile,
  getPlantDisplayName,
} from '../data/cropTaxonomy';
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
    term: 'Bốc thoát hơi nước & Sức hút ẩm (VPD)',
    simpleName: 'Tốc độ mất nước từ mặt đất và lá cây',
    explanation:
      'Kết hợp lượng nước bay hơi từ đất trống và thoát hơi qua lá khi trời nắng gió; sức hút ẩm càng cao cây càng nhanh héo nếu rễ thiếu nước.',
    fieldExample:
      'Khi nắng to và VPD cao, đất cát trống mất ẩm rất nhanh; che phủ rơm rạ hoặc trồng cây họ Đậu giúp giảm rõ rệt số lần bơm tưới.',
  },
  {
    term: 'Hấp thụ Carbon & Quang hợp tán lá',
    simpleName: 'Sức khỏe tán lá và khả năng tích lũy chất khô',
    explanation:
      'Phản ánh tốc độ quang hợp của lá và lượng Carbon cây giữ lại trong sinh khối, đơn vị tính bằng tấn CO₂/ha/năm.',
    fieldExample:
      'Quang hợp giảm thấp cảnh báo ruộng đang thiếu nắng, thiếu đạm hoặc rễ bị úng không hút được dinh dưỡng.',
  },
  {
    term: 'Biến động trữ lượng nước ngầm',
    simpleName: 'Độ đầy hay hao hụt của mạch nước tầng sâu',
    explanation:
      'So sánh lượng nước tích trữ dưới tầng đất sâu so với mức trung bình nhiều năm (tính bằng cm mực nước tương đương).',
    fieldExample:
      'Chỉ số âm (đang hụt) nhắc nông dân tiết kiệm nước giếng khoan và ưu tiên luân canh cây ngắn ngày chịu hạn.',
  },
  {
    term: 'Phát thải khí nhà kính đồng ruộng',
    simpleName: 'Khí thải từ ruộng ngập nước và phân đạm dư thừa',
    explanation:
      'Ước tính lượng Mê-tan sinh ra khi ngập úng yếm khí và khí Nitơ oxit từ phân đạm thất thoát, quy đổi ra tấn CO₂e/ha.',
    fieldExample:
      'Rút nước ngập–khô xen kẽ (AWD) và xen 1 vụ Đậu giúp giảm đáng kể chi phí phân đạm lẫn phát thải.',
  },
];

export function getScientificGlossary(lang: AppLanguage = 'vi') {
  if (lang === 'en') {
    return [
      {
        term: 'Evapotranspiration & Drying Demand (VPD)',
        simpleName: 'Rate of water loss from soil and crop leaves',
        explanation: 'Combined evaporation from bare topsoil and transpiration through foliage under heat, wind, and dry air.',
        fieldExample: 'Straw mulching or cover legumes sharply cut irrigation frequency during high-VPD dry weeks.',
      },
      {
        term: 'Canopy Photosynthesis & Carbon Uptake',
        simpleName: 'Active leaf vigor and biomass carbon assimilation',
        explanation: 'Tracks canopy light capture and net carbon fixed by the crop (t CO₂/ha/yr).',
        fieldExample: 'Low values highlight nitrogen deficiency, root stress, or prolonged cloud cover early.',
      },
      {
        term: 'Subsurface Groundwater Balance',
        simpleName: 'Net recharge or depletion of deeper aquifer reserves',
        explanation: 'Compares root and aquifer water storage against multi-year regional norms (cm equivalent).',
        fieldExample: 'Negative values warn against deep borewell pumping and favor drought-resilient crops.',
      },
      {
        term: 'Field CH₄ & N₂O Footprint',
        simpleName: 'Greenhouse gas intensity from flooded soils & nitrogen loss',
        explanation: 'Combines methane from flooded rice soils and nitrous oxide from excess fertilizer (t CO₂e/ha).',
        fieldExample: 'Alternate Wetting & Drying (AWD) plus legume rotation reduce both nutrient waste and emissions.',
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
      ? `Subsurface water balance shifted ${grace.lweThicknessCm >= 0 ? '+' : ''}${grace.lweThicknessCm} cm (${grace.groundwaterStatus}); root-zone water reserve ${grace.soilWaterBalancePct}%.`
      : `Dự trữ nước tầng sâu biến động ${grace.lweThicknessCm >= 0 ? '+' : ''}${grace.lweThicknessCm} cm (${grace.groundwaterStatus === 'depleting' ? 'đang giảm, cần tiết kiệm bơm tưới' : grace.groundwaterStatus === 'recharging' ? 'đang phục hồi tốt' : 'ổn định'}), cân bằng ẩm rễ đạt ${grace.soilWaterBalancePct}%.`
    : cell.lat < 11.5
    ? isEn
      ? 'Lower delta region shows heightened dry-season water table swings and local salinity risk.'
      : 'Vùng đồng bằng hạ lưu có xu hướng dao động mực nước mùa khô và xâm nhập mặn cục bộ.'
    : isEn
    ? 'Distinct wet/dry seasonal water distribution; store root-zone moisture ahead of dry months.'
    : 'Lượng nước phân bố lệch rõ rệt theo mùa, cần tích ẩm tầng rễ trước thời kỳ nắng gắt.';

  const oco2 = earth?.carbonFluxOco2;
  const vegetationStressNote =
    oco2 && oco2.photosynthesisStatus === 'low'
      ? isEn
        ? `Canopy photosynthesis index is low (${oco2.sifWm2SrUm}, uptake ${oco2.carbonUptakeTonHaYr} t CO₂/ha); inspect leaf nitrogen and root moisture.`
        : `Sức khỏe quang hợp tán lá đang thấp (${oco2.sifWm2SrUm}, hấp thụ ${oco2.carbonUptakeTonHaYr} tấn CO₂/ha); nên kiểm tra đạm và độ thoát nước vùng rễ.`
      : rootMoisturePct < 35
      ? isEn
        ? 'Low root moisture weakens photosynthesis and risks midday wilting.'
        : 'Độ ẩm vùng rễ xuống thấp, tán lá dễ giảm quang hợp và héo rũ trưa nắng.'
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
      ? `Combining 25-year (2001–2025) climate records (${getLocalizedRegionName(cell.region, 'en')}), ${getSoilLabel(field.soilType, 'en')}, and live field weather & moisture.`
      : `Kết hợp chuỗi khí hậu 25 năm (2001–2025) vùng ${cell.region}, đất ${getSoilLabel(field.soilType, 'vi').toLowerCase()} (${getDrainageLabel(field.soilCharacteristics.drainage, 'vi').toLowerCase()}) và thời tiết hiện tại.`,
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
  const resolvedBotanical = resolveCropBotanicalProfile(
    field.crop.name,
    field.crop.seedFamily,
    field.crop.category
  );
  const familyId = resolvedBotanical.seedFamilyId;
  const currentBotanicalFamily = resolvedBotanical.botanicalFamily;
  const currentFamilyLabel = isEn
    ? resolvedBotanical.familyLabelEn
    : resolvedBotanical.familyLabelVi;
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

  const alreadyFabaceae = currentBotanicalFamily === 'Fabaceae';
  const alreadyCucurbit = currentBotanicalFamily === 'Cucurbitaceae';
  const alreadyPoaceae = currentBotanicalFamily === 'Poaceae';
  const alreadyConvolvulaceae = currentBotanicalFamily === 'Convolvulaceae';

  const baseline: RotationStrategy = {
    id: 'rot-baseline',
    isCurrentBaseline: true,
    title: isEn
      ? `Current Baseline: Continue ${getPlantDisplayName(field.crop.name, 'en')} (${currentFamilyLabel})`
      : `Phương án hiện tại: Tiếp tục trồng ${field.crop.name} (${currentFamilyLabel})`,
    sequenceSummary: isEn
      ? `${getPlantDisplayName(field.crop.name, 'en')} → Bare fallow → ${getPlantDisplayName(field.crop.name, 'en')}`
      : `${field.crop.name} → Nghỉ đất trống → ${field.crop.name}`,
    nextCropFamily: familyId,
    nextCropName: getPlantDisplayName(field.crop.name, lang),
    suitabilityScore: isWaterTight || ghgHigh || priorities.includes('pest_break') ? 48 : 64,
    whySuggested: isEn
      ? `Reference baseline reflecting monoculture of ${currentFamilyLabel} to compare water, emissions, and soil-borne pest risk.`
      : `Là phương án đối chứng trồng lặp cùng ${currentFamilyLabel} để bạn so sánh chi phí phân bón, nước ngầm, phát thải và nguy cơ tích tụ sâu bệnh.`,
    supportingEvidence: [
      isEn
        ? `Estimated root moisture ${indicators.rootMoisturePct}% and ET₀ ${indicators.evapotranspirationMmDay} mm/day.`
        : `Đất ${getSoilLabel(field.soilType, 'vi').toLowerCase()} hiện có độ ẩm rễ ${indicators.rootMoisturePct}% và bốc thoát hơi nước ${indicators.evapotranspirationMmDay} mm/ngày.`,
      earth
        ? isEn
          ? `Current footprint: ${earth.greenhouseGasEdgar.co2eqTonHa} t CO₂e/ha emissions; aquifer anomaly ${earth.groundwaterAnomalyGrace.lweThicknessCm} cm.`
          : `Phát thải ước tính: ${earth.greenhouseGasEdgar.co2eqTonHa} tấn CO₂e/ha; dự trữ nước tầng sâu ${earth.groundwaterAnomalyGrace.lweThicknessCm >= 0 ? '+' : ''}${earth.groundwaterAnomalyGrace.lweThicknessCm} cm.`
        : isEn
        ? 'Refresh environment metrics to include groundwater & emission baseline.'
        : 'Cập nhật chỉ số môi trường để bổ sung đối chiếu nước ngầm & phát thải.',
    ],
    benefits: {
      nutrientCycling: isEn
        ? 'No cross-family nutrient synergy; depletes the same root-zone depth.'
        : 'Không bổ sung đa dạng dinh dưỡng giữa các tầng đất khác nhau.',
      waterDemand: isEn ? 'High seasonal irrigation dependence.' : 'Nhu cầu nước giữ nguyên như các vụ trước.',
      erosionAndOrganicMatter: isEn ? 'Bare fallow degrades topsoil carbon.' : 'Thời gian đất trống làm giảm mùn và tăng xói mòn.',
      pestCycleDisruption: isEn
        ? `Same botanical family (${currentBotanicalFamily}) does NOT break specialist pests or soil pathogens.`
        : `Cùng ${currentFamilyLabel} — KHÔNG cắt được chu kỳ sâu bệnh chuyên tính lưu tồn trong đất.`,
      forageAndIncome: isEn ? 'Familiar local market channel.' : 'Đầu ra quen thuộc nhưng dễ rớt năng suất do đất mệt.',
    },
    informationGaps: [
      isEn ? 'Actual post-harvest NPK & soil pH lab test needed.' : 'Chưa có kết quả kiểm nghiệm NPK & pH đất thực tế sau vụ thu hoạch.',
    ],
    localReviewRisks: [
      isEn
        ? `Higher specialist pest/disease buildup after consecutive ${currentBotanicalFamily} cycles.`
        : `Nguy cơ tích tụ sâu bệnh chuyên tính của ${currentFamilyLabel} khi trồng lặp 2–3 vụ liên tiếp.`,
    ],
    alignedPriorities: [],
  };

  const isLightOrDrySoil = ['sand', 'sandy_loam', 'gray_degraded', 'gravelly', 'ferralsol'].includes(field.soilType);

  // STRATEGY 1: Nitrogen-Fixing Fabaceae Rotation (ONLY optimal when current crop is NOT Fabaceae;
  // when current crop IS Fabaceae such as Peanut/Lạc or Soybean, recommend Poaceae cereal to harvest fixed N!)
  const legumeCrop =
    isLightOrDrySoil || isWaterTight
      ? isEn
        ? 'Peanut (Groundnut) or Short-Season Mungbean'
        : 'Lạc (Đậu phộng) hoặc Đậu xanh ngắn ngày'
      : isEn
      ? 'Soybean or Mungbean'
      : 'Đậu tương (Đậu nành) hoặc Đậu xanh';

  const legumeRawScore =
    82 +
    (priorities.includes('nitrogen_fixing') ? 6 : 0) +
    (priorities.includes('pest_break') ? 5 : 0) +
    (priorities.includes('water_saving') ? 4 : 0) +
    (ghgHigh ? 7 : 0) +
    (graceDepleting ? 4 : 0) -
    (isSlowDrainage ? 6 : 0) -
    (alreadyFabaceae ? 42 : 0);

  const crossFamilyFromCucurbitNoteVi = alreadyCucurbit
    ? 'Sau vụ Dưa/Bầu bí (Cucurbitaceae), luân canh sang Họ Đậu (Fabaceae) giúp cắt triệt để nấm nứt thân chảy nhựa, héo vàng Fusarium và thán thư, đồng thời trả lại 40–70 kg đạm/ha cho đất.'
    : 'Chuyển sang Họ Đậu (Fabaceae) giúp cố định 40–70 kg đạm/ha tự nhiên, giảm mạnh phát thải CH₄/N₂O, cắt sâu bệnh và tiết kiệm nước ngầm.';
  const crossFamilyFromCucurbitNoteEn = alreadyCucurbit
    ? 'Rotating Cucurbits (Cucurbitaceae) to Legumes (Fabaceae) breaks gummy stem blight, Fusarium wilt, and anthracnose cycles while fixing 40–70 kg N/ha.'
    : 'Rotating to Legumes (Fabaceae) fixes 40–70 kg N/ha naturally, cuts N₂O/CH₄ emissions, breaks pest cycles, and saves groundwater.';

  const legumeOrBreakStrategy: RotationStrategy = alreadyFabaceae
    ? {
        id: 'rot-cereal-after-legume',
        isCurrentBaseline: false,
        title: isEn
          ? `Post-Legume Nitrogen-Harvest Rotation: ${
              isSlowDrainage || !isWaterTight ? 'Short-Season Paddy Rice / Maize (Poaceae)' : 'Drought-Tolerant Maize / Sorghum (Poaceae)'
            }`
          : `Luân canh Tận dụng Đạm sau Họ Đậu: Trồng ${
              isSlowDrainage || !isWaterTight ? 'Ngô nếp hoặc Lúa ngắn ngày (Họ Hòa thảo)' : 'Ngô lai / Cao lương chịu hạn (Họ Hòa thảo)'
            }`,
        sequenceSummary: isEn
          ? `${getPlantDisplayName(field.crop.name, 'en')} (Fabaceae) → ${
              isSlowDrainage || !isWaterTight ? 'Paddy Rice / Maize (Poaceae)' : 'Maize / Sorghum (Poaceae)'
            } → Cucurbit / Cover`
          : `${field.crop.name} (Họ Đậu — Fabaceae) → ${
              isSlowDrainage || !isWaterTight ? 'Ngô nếp / Lúa ngắn ngày (Họ Hòa thảo)' : 'Ngô / Cao lương (Họ Hòa thảo)'
            } → Vụ kế tiếp`,
        nextCropFamily: 'poaceae',
        nextCropName:
          isSlowDrainage || !isWaterTight
            ? isEn
              ? 'Paddy Rice / Sweet Corn (Poaceae)'
              : 'Lúa ngắn ngày hoặc Ngô nếp (Họ Hòa thảo)'
            : isEn
            ? 'Hybrid Maize / Sorghum (Poaceae)'
            : 'Ngô lai hoặc Cao lương chịu hạn (Họ Hòa thảo)',
        suitabilityScore: Math.min(
          97,
          84 +
            (priorities.includes('pest_break') ? 6 : 0) +
            (priorities.includes('nitrogen_fixing') ? 4 : 0) +
            (priorities.includes('supplemental_income') ? 4 : 0)
        ),
        whySuggested: isEn
          ? `Your current crop (${field.crop.name}) already belongs to Fabaceae and fixes nitrogen. Do NOT plant another legume next (risk of bacterial wilt & root-knot nematodes); rotate to Poaceae (Maize/Rice) to absorb the biological N left in soil and break legume diseases.`
          : `Cây hiện tại (${field.crop.name}) thuộc Họ Đậu (Fabaceae) đã cố định đạm sẵn trong đất. KHÔNG nên trồng tiếp cây họ Đậu khác để tránh héo xanh, thối cổ rễ và tuyến trùng; chuyển sang Họ Hòa thảo (Ngô/Lúa) sẽ tận dụng tối đa đạm tồn dư và cắt mầm bệnh họ Đậu.`,
        supportingEvidence: [
          isEn
            ? `Residual 40–70 kg biological N/ha from ${field.crop.name} cuts synthetic Urea needs by 25–35% for the following cereal crop.`
            : `Lượng đạm sinh học 40–70 kg N/ha do ${field.crop.name} để lại giúp giảm 25–35% phân Urê cho vụ Ngô/Lúa kế tiếp.`,
          isEn
            ? `Root moisture (${indicators.rootMoisturePct}%) and ET₀ (${indicators.evapotranspirationMmDay} mm/day) support vigorous Poaceae establishment.`
            : `Độ ẩm rễ ${indicators.rootMoisturePct}% và ET₀ ${indicators.evapotranspirationMmDay} mm/ngày phù hợp xuống giống cây họ Hòa thảo.`,
        ],
        benefits: {
          nutrientCycling: isEn
            ? 'Captures biological N fixed by Fabaceae root nodules before leaching.'
            : 'Hấp thu triệt để nguồn đạm tự nhiên từ nốt sần họ Đậu, tránh rửa trôi.',
          waterDemand: isWaterTight
            ? isEn
              ? 'Maize/Sorghum uses far less water than flooded paddy.'
              : 'Ngô/Cao lương tiết kiệm nước hơn nhiều so với lúa ngập nước.'
            : isEn
            ? 'Rice/Maize matches available seasonal irrigation.'
            : 'Phù hợp nguồn nước hiện tại và tận dụng ẩm đất.',
          erosionAndOrganicMatter: isEn
            ? 'Fibrous root network binds topsoil and improves crumb structure.'
            : 'Bộ rễ chùm dày đặc giữ chặt đất mặt và tăng độ tơi xốp.',
          pestCycleDisruption: isEn
            ? 'Switches from Fabaceae to Poaceae, breaking peanut/soybean wilt, rust, and leaf-miner cycles.'
            : 'Chuyển hẳn từ Họ Đậu (Fabaceae) sang Họ Hòa thảo (Poaceae), ngắt triệt để bệnh héo xanh, lở cổ rễ và tuyến trùng lạc/đậu.',
          forageAndIncome: isEn
            ? 'High grain demand plus maize/sorghum stover for cattle.'
            : 'Dễ tiêu thụ hạt thương phẩm kèm thân lá làm thức ăn trâu bò.',
        },
        informationGaps: [
          isEn
            ? 'Check soil pH and incorporate legume haulms into topsoil before sowing.'
            : 'Cày vùi thân lá lạc/đậu trước gieo 10–14 ngày để giải phóng đạm hữu cơ.',
        ],
        localReviewRisks: [
          isEn
            ? 'Scout early for fall armyworm on maize seedlings or stem borers.'
            : 'Theo dõi sâu keo mùa thu trên ngô non hoặc sâu đục thân giai đoạn đầu.',
        ],
        alignedPriorities: ['pest_break', 'nitrogen_fixing', 'organic_matter', 'supplemental_income'],
      }
    : {
        id: 'rot-legume',
        isCurrentBaseline: false,
        title: isEn
          ? `Nitrogen-Fixing & Low-Emission Rotation: ${legumeCrop} (Fabaceae)`
          : `Luân canh Cố định đạm & Giảm phát thải: Xen vụ ${legumeCrop} (Họ Đậu)`,
        sequenceSummary: isEn
          ? `${getPlantDisplayName(field.crop.name, 'en')} (${currentBotanicalFamily}) → ${legumeCrop} (Fabaceae) → Main season`
          : `${field.crop.name} (${currentBotanicalFamily}) → ${legumeCrop} (Họ Đậu — Fabaceae) → Vụ chính kế tiếp`,
        nextCropFamily: 'fabaceae',
        nextCropName: legumeCrop,
        suitabilityScore: Math.min(98, Math.max(40, legumeRawScore)),
        whySuggested: isEn ? crossFamilyFromCucurbitNoteEn : crossFamilyFromCucurbitNoteVi,
        supportingEvidence: [
          earth
            ? isEn
              ? `Field emissions (${earth.greenhouseGasEdgar.co2eqTonHa} t CO₂e/ha) drop sharply when rotating with a legume break crop.`
              : `Mức phát thải hiện tại ${earth.greenhouseGasEdgar.co2eqTonHa} tấn CO₂e/ha sẽ giảm rõ rệt khi xen 1 vụ Đậu, đồng thời giảm 20–30% phân Urê.`
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
          pestCycleDisruption: isEn
            ? `Switches from ${currentBotanicalFamily} to Fabaceae, breaking host-specific soil pathogens.`
            : `Khác họ thực vật (${currentBotanicalFamily} → Họ Đậu Fabaceae), giúp ngắt triệt để sâu bệnh chuyên tính cũ.`,
          forageAndIncome: isEn ? 'High-value grain plus protein-rich haulms for livestock.' : 'Thu hạt thương phẩm giá tốt kèm phụ phẩm làm thức ăn gia súc.',
        },
        informationGaps: [
          isEn ? 'Verify topsoil pH (>5.2) before sowing legumes.' : 'Cần kiểm tra pH đất (đậu/lạc kém phát triển nếu đất quá chua pH < 5.2).',
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

  // STRATEGY 2: Drought-Resilient & Income Diversification (Guaranteed DIFFERENT botanical family from current crop!)
  let resilientCrop: string;
  let resilientFamily: RotationStrategy['nextCropFamily'];
  let resilientBotanicalLabel: string;

  if (constraints.marketPreference === 'forage_livestock' && !alreadyPoaceae) {
    resilientCrop = isEn ? 'Drought-Tolerant Biomass Maize / Sorghum' : 'Ngô sinh khối / Cao lương chịu hạn';
    resilientFamily = 'poaceae';
    resilientBotanicalLabel = isEn ? 'Grasses (Poaceae)' : 'Họ Hòa thảo (Poaceae)';
  } else if (
    !alreadyConvolvulaceae &&
    ['sand', 'sandy_loam', 'loam', 'sandy_clay_loam', 'gray_degraded', 'basalt'].includes(field.soilType)
  ) {
    resilientCrop = isEn
      ? 'Sweet Potato (Ground-cover Tuber)'
      : 'Khoai lang mật / Khoai lang tím';
    resilientFamily = 'other_perennial';
    resilientBotanicalLabel = isEn ? 'Morning Glory (Convolvulaceae)' : 'Họ Bìm bìm / Khoai lang (Convolvulaceae)';
  } else if (!alreadyCucurbit && !isSlowDrainage) {
    resilientCrop = isEn ? 'Watermelon or Pumpkin Ground Cover' : 'Dưa hấu hoặc Bí đỏ phủ đất';
    resilientFamily = 'cucurbitaceae';
    resilientBotanicalLabel = isEn ? 'Cucurbits (Cucurbitaceae)' : 'Họ Bầu bí (Cucurbitaceae)';
  } else if (!alreadyPoaceae) {
    resilientCrop = isEn ? 'Short-season Sweet Corn or Paddy Rice' : 'Ngô nếp ngắn ngày hoặc Lúa ngắn ngày';
    resilientFamily = 'poaceae';
    resilientBotanicalLabel = isEn ? 'Grasses (Poaceae)' : 'Họ Hòa thảo (Poaceae)';
  } else {
    resilientCrop = isEn ? 'Pumpkin / Wax Gourd Cover' : 'Bí đỏ hoặc Bí xanh leo giàn';
    resilientFamily = 'cucurbitaceae';
    resilientBotanicalLabel = isEn ? 'Cucurbits (Cucurbitaceae)' : 'Họ Bầu bí (Cucurbitaceae)';
  }

  const sameBotanicalAsResilient =
    (alreadyCucurbit && resilientFamily === 'cucurbitaceae') ||
    (alreadyPoaceae && resilientFamily === 'poaceae') ||
    (alreadyConvolvulaceae && resilientBotanicalLabel.includes('Convolvulaceae'));

  const resilientScore =
    79 +
    (wantsForageOrIncome ? 7 : 0) +
    (priorities.includes('erosion_control') ? 5 : 0) +
    (priorities.includes('water_saving') ? 5 : 0) +
    (graceDepleting ? 6 : 0) +
    (alreadyFabaceae ? 5 : 0) -
    (sameBotanicalAsResilient ? 35 : 0);

  const resilientStrategy: RotationStrategy = {
    id: 'rot-resilient',
    isCurrentBaseline: false,
    title: isEn
      ? `Cross-Family Resilient & Income Rotation: ${resilientCrop} (${resilientBotanicalLabel})`
      : `Luân canh Khác họ Chịu hạn & Tăng thu nhập: ${resilientCrop} (${resilientBotanicalLabel})`,
    sequenceSummary: isEn
      ? `${getPlantDisplayName(field.crop.name, 'en')} (${currentBotanicalFamily}) → ${resilientCrop} (${resilientBotanicalLabel}) → Main crop`
      : `${field.crop.name} (${currentBotanicalFamily}) → ${resilientCrop} (${resilientBotanicalLabel}) → Vụ chính`,
    nextCropFamily: resilientFamily,
    nextCropName: resilientCrop,
    suitabilityScore: Math.min(96, Math.max(45, resilientScore)),
    whySuggested: isEn
      ? `Switches botanical family from ${currentBotanicalFamily} to ${resilientBotanicalLabel}, adapting to groundwater deficits while diversifying farm income or livestock fodder.`
      : `Chuyển đổi từ ${currentBotanicalFamily} sang ${resilientBotanicalLabel} giúp ngắt mầm bệnh lưu tồn, thích nghi khi mực nước ngầm giảm và tăng thu nhập.`,
    supportingEvidence: [
      earth?.groundwaterAnomalyGrace
        ? isEn
          ? `Aquifer balance (${earth.groundwaterAnomalyGrace.lweThicknessCm >= 0 ? '+' : ''}${earth.groundwaterAnomalyGrace.lweThicknessCm} cm) favors deep-rooted or low-irrigation crops.`
          : `Trữ lượng nước tầng sâu ở mức ${earth.groundwaterAnomalyGrace.lweThicknessCm >= 0 ? '+' : ''}${earth.groundwaterAnomalyGrace.lweThicknessCm} cm, phù hợp cây chịu hạn ít bơm tưới.`
        : isEn
        ? `Surface moisture ${indicators.surfaceMoisturePct}% favors broad canopy crops to shade soil.`
        : `Độ ẩm tầng mặt ${indicators.surfaceMoisturePct}% phù hợp cây có tán che phủ giữ ẩm.`,
    ],
    benefits: {
      nutrientCycling: isEn ? 'Different root architecture recovers subsoil nutrients.' : 'Cấu trúc rễ khác biệt khai thác dinh dưỡng cân bằng ở tầng đất khác.',
      waterDemand: isEn ? 'Tolerates dry intervals with residual soil moisture.' : 'Chịu khô hạn tốt, tận dụng ẩm dư sau vụ mưa.',
      erosionAndOrganicMatter: isEn ? 'Broad canopy shields topsoil from heavy raindrop impact.' : 'Tán lá che phủ giảm xói mòn khi mưa lớn.',
      pestCycleDisruption: isEn
        ? `True botanical shift (${currentBotanicalFamily} → ${resilientBotanicalLabel}) disrupts specialist soil pests.`
        : `Khác hẳn họ thực vật (${currentBotanicalFamily} → ${resilientBotanicalLabel}), cắt đứt sâu bệnh chuyên tính.`,
      forageAndIncome: isEn ? 'Dual-purpose cash crop and livestock silage/vines.' : 'Dễ bán củ/quả hoặc tận dụng thân lá nuôi gia súc.',
    },
    informationGaps: [
      isEn ? 'Confirm local wholesale demand before sowing.' : 'Kiểm tra nhu cầu thu mua tại thương lái/chợ địa phương.',
    ],
    localReviewRisks: [
      isEn ? 'Supplement balanced potassium & compost for tubers/cucurbits.' : 'Bổ sung thêm kali & hữu cơ hoai mục để củ/quả ngọt và tránh bạc màu đất.',
    ],
    alignedPriorities: ['supplemental_income', 'erosion_control', 'water_saving', 'organic_matter', 'pest_break'],
  };

  // STRATEGY 3: Off-Season Cover Crop / Soil Carbon Recovery
  // If current crop is ALREADY Fabaceae, use a Poaceae grass/sorghum cover crop so we NEVER chain Fabaceae -> Fabaceae!
  const coverScore =
    76 +
    (priorities.includes('erosion_control') ? 9 : 0) +
    (priorities.includes('organic_matter') ? 8 : 0) +
    (oco2Low ? 6 : 0) +
    (indicators.erosionRisk === 'Cao' || indicators.erosionRisk === 'High' ? 6 : 0);

  const coverStrategy: RotationStrategy = alreadyFabaceae
    ? {
        id: 'rot-cover',
        isCurrentBaseline: false,
        title: isEn
          ? 'Grass Cover Crop & Biomass Recovery: Sudangrass / Short Sorghum (Poaceae)'
          : 'Cây che phủ Khác họ & Tăng mùn: Gieo Cỏ Sudan / Cao lương ngắn ngày (Họ Hòa thảo)',
        sequenceSummary: isEn
          ? `${getPlantDisplayName(field.crop.name, 'en')} (Fabaceae) → Sudangrass / Sorghum Cover (45–55d, Poaceae) → Main crop`
          : `${field.crop.name} (Họ Đậu) → Cỏ Sudan / Cao lương phủ đất (45–55 ngày, Họ Hòa thảo) → Vụ chính`,
        nextCropFamily: 'poaceae',
        nextCropName: isEn
          ? 'Sudangrass / Forage Sorghum Cover (Poaceae)'
          : 'Cỏ Sudan / Cao lương che phủ đất (Họ Hòa thảo)',
        suitabilityScore: Math.min(97, coverScore),
        whySuggested: isEn
          ? 'Because your current crop is a legume (Fabaceae), a fast Poaceae grass cover traps leftover nitrogen, builds organic matter, and suppresses legume root-knot nematodes.'
          : 'Vì vụ trước là cây Họ Đậu (Fabaceae), gieo cây che phủ Họ Hòa thảo (Cỏ Sudan/Cao lương) giúp giữ lại đạm sinh học chống rửa trôi, tăng mùn nhanh và ức chế tuyến trùng hại rễ lạc/đậu.',
        supportingEvidence: [
          earth?.carbonFluxOco2
            ? isEn
              ? `Field carbon uptake (${earth.carbonFluxOco2.carbonUptakeTonHaYr} t CO₂/ha) rises sharply when covering bare fallow between seasons.`
              : `Hấp thụ Carbon của ruộng (${earth.carbonFluxOco2.carbonUptakeTonHaYr} tấn CO₂/ha/năm) tăng rõ rệt khi phủ xanh thay vì bỏ đất trống.`
            : isEn
            ? '45–55 day grass cover builds fibrous topsoil humus and cattle forage.'
            : 'Cây phủ đất 45–55 ngày tạo mùn xốp nhanh và có thêm cỏ xanh nuôi trâu bò.',
        ],
        benefits: {
          nutrientCycling: isEn ? 'Scavenges leftover legume nitrogen so it does not leach in rain.' : 'Giữ lại lượng đạm tồn dư từ họ Đậu, không để mưa rửa trôi.',
          waterDemand: isEn ? 'Drought-hardy; grows on residual soil moisture.' : 'Chịu hạn rất tốt, tận dụng ẩm tồn dư sau thu hoạch.',
          erosionAndOrganicMatter: isEn ? 'Dense fibrous roots anchor topsoil and build humus fast.' : 'Rễ chùm dày giữ đất chống xói mòn và tăng mùn nhanh.',
          pestCycleDisruption: isEn ? 'Poaceae non-host breaks Fabaceae wilt & nematode cycles.' : 'Họ Hòa thảo không phải ký chủ của bệnh héo xanh và tuyến trùng hại lạc/đậu.',
          forageAndIncome: isEn ? 'High-yield green forage cut before soil incorporation.' : 'Thu cắt thân lá làm thức ăn chăn nuôi hoặc cày vùi làm phân xanh.',
        },
        informationGaps: [
          isEn ? 'Check sudangrass/sorghum cover seed at local cooperative.' : 'Kiểm tra nguồn giống cỏ Sudan hoặc cao lương tại hợp tác xã.',
        ],
        localReviewRisks: [
          isEn ? 'Cut/incorporate biomass 10–14 days before planting the next main crop.' : 'Cắt vùi sinh khối trước khi gieo vụ chính 10–14 ngày để tránh cạnh tranh ẩm.',
        ],
        alignedPriorities: ['erosion_control', 'organic_matter', 'pest_break', 'water_saving', 'supplemental_income'],
      }
    : {
        id: 'rot-cover',
        isCurrentBaseline: false,
        title: isEn
          ? 'Carbon Cover Crop & Soil Recovery: Sesbania / Sunn Hemp / Black Bean (Fabaceae)'
          : 'Luân canh Cây che phủ & Phục hồi Carbon đất: Gieo Điền thanh / Muồng hoa vàng (Họ Đậu)',
        sequenceSummary: isEn
          ? `${getPlantDisplayName(field.crop.name, 'en')} (${currentBotanicalFamily}) → Green Manure Cover (45–55d, Fabaceae) → Main crop`
          : `${field.crop.name} (${currentBotanicalFamily}) → Cây che phủ họ Đậu (45–55 ngày) → Vụ chính`,
        nextCropFamily: 'fabaceae',
        nextCropName: isEn
          ? 'Sesbania / Sunn Hemp / Cover Black Bean (Fabaceae)'
          : 'Điền thanh / Muồng hoa vàng hoặc Đậu đen che phủ (Họ Đậu)',
        suitabilityScore: Math.min(97, coverScore),
        whySuggested: isEn
          ? 'Protects bare soil during off-season gaps, fixes atmospheric N, boosts soil carbon uptake, and prevents nutrient runoff.'
          : 'Lấp khoảng trống giữa 2 vụ để chống xói mòn, cố định đạm sinh học, tăng tích lũy Carbon hữu cơ và cắt mầm bệnh cây trồng cũ.',
        supportingEvidence: [
          earth?.carbonFluxOco2
            ? isEn
              ? `Field carbon uptake (${earth.carbonFluxOco2.carbonUptakeTonHaYr} t CO₂/ha) rises when bare ground is covered with fast-growing green manure.`
              : `Hấp thụ Carbon của ruộng (${earth.carbonFluxOco2.carbonUptakeTonHaYr} tấn CO₂/ha/năm) tăng rõ rệt khi phủ xanh thay vì bỏ đất trống.`
            : isEn
            ? '45–55 day cover crop builds topsoil humus without delaying main planting.'
            : 'Cây che phủ 45–55 ngày không làm chậm lịch gieo vụ chính.',
        ],
        benefits: {
          nutrientCycling: isEn ? 'Fixes atmospheric N and traps residual nutrients.' : 'Cố định đạm sinh học và giữ lại dinh dưỡng tồn dư.',
          waterDemand: isEn ? 'Rainfed / residual moisture only; zero irrigation needed.' : 'Gần như chỉ dùng ẩm tồn dư, không cần bơm tưới.',
          erosionAndOrganicMatter: isEn ? 'Fastest organic carbon restoration across strategies.' : 'Tăng mùn hữu cơ nhanh nhất và chống rửa trôi hiệu quả.',
          pestCycleDisruption: isEn ? 'Non-host legume suppresses weeds and soil pathogens.' : 'Khác họ thực vật giúp ức chế cỏ dại và nấm bệnh tồn dư.',
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

  return [baseline, legumeOrBreakStrategy, resilientStrategy, coverStrategy].sort((a, b) =>
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
  const resolvedBotanical = resolveCropBotanicalProfile(
    field.crop.name,
    field.crop.seedFamily,
    field.crop.category
  );
  const currentBotanicalFamily = resolvedBotanical.botanicalFamily;
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

  // Strict cross-family adaptive fallback (NEVER recommend the same botanical family)
  let altCrop: string;
  let altFamily: RotationStrategy['nextCropFamily'];
  let altBotanicalNote: string;

  if (isFloodConcern) {
    if (currentBotanicalFamily === 'Araceae') {
      altCrop = isEn ? 'Short-Season Paddy Rice (Poaceae)' : 'Lúa ngắn ngày chịu ngập (Họ Hòa thảo)';
      altFamily = 'poaceae';
      altBotanicalNote = 'Poaceae';
    } else {
      altCrop = isEn ? 'Wetland Taro (Araceae)' : 'Khoai môn nước lên luống (Họ Ráy)';
      altFamily = 'other_perennial';
      altBotanicalNote = 'Araceae';
    }
  } else if (isMarketConcern) {
    if (currentBotanicalFamily === 'Cucurbitaceae') {
      altCrop = isEn ? 'Choy Sum / Leafy Brassicas or Okra' : 'Rau cải ngọt (Họ Cải) hoặc Đậu bắp (Họ Bông)';
      altFamily = 'brassicaceae';
      altBotanicalNote = 'Brassicaceae / Malvaceae';
    } else {
      altCrop = isEn ? 'Cucumber / Wax Gourd (Cucurbitaceae)' : 'Dưa leo / Bí xanh dễ bán (Họ Bầu bí)';
      altFamily = 'cucurbitaceae';
      altBotanicalNote = 'Cucurbitaceae';
    }
  } else if (currentBotanicalFamily === 'Pedaliaceae' || currentBotanicalFamily === 'Malvaceae') {
    altCrop = isEn ? 'Short-Season Sweet Corn (Poaceae)' : 'Ngô nếp ngắn ngày (Họ Hòa thảo)';
    altFamily = 'poaceae';
    altBotanicalNote = 'Poaceae';
  } else {
    altCrop = isEn ? 'Drought-Tolerant Black Sesame (Pedaliaceae) or Okra (Malvaceae)' : 'Vừng (Mè) đen chịu hạn (Họ Vừng) hoặc Đậu bắp (Họ Bông)';
    altFamily = 'other_perennial';
    altBotanicalNote = 'Pedaliaceae / Malvaceae';
  }

  const indicators = computeHarmonizedIndicators(field, weather, { rainDeltaPct: 0, tempDeltaC: 0 }, lang);

  return {
    id: `rot-adaptive-${Date.now()}`,
    isCurrentBaseline: false,
    title: isEn
      ? `Tailored Rotation for Your Field: ${altCrop}`
      : `Phương án điều chỉnh riêng cho ruộng của bạn: Trồng ${altCrop}`,
    sequenceSummary: isEn
      ? `${getPlantDisplayName(field.crop.name, 'en')} (${currentBotanicalFamily}) → ${altCrop} (${altBotanicalNote}) → Straw Mulch`
      : `${field.crop.name} (${currentBotanicalFamily}) → ${altCrop} → Phủ rơm giữ ẩm`,
    nextCropFamily: altFamily,
    nextCropName: altCrop,
    suitabilityScore: 89,
    whySuggested: rejectionReason
      ? isEn
        ? `Tailored directly to your feedback ("${rejectionReason}") while switching botanical family (${currentBotanicalFamily} → ${altBotanicalNote}).`
        : `Được điều chỉnh trực tiếp theo phản hồi thực tế của bạn ("${rejectionReason}"), đảm bảo khác họ thực vật (${currentBotanicalFamily} → ${altBotanicalNote}).`
      : isEn
      ? `Flexible cross-family alternative (${currentBotanicalFamily} → ${altBotanicalNote}) with fast cash turnaround.`
      : `Phương án thay thế linh hoạt khác họ (${currentBotanicalFamily} → ${altBotanicalNote}), ngắn ngày và dễ tiêu thụ.`,
    supportingEvidence: [
      isEn
        ? `Root moisture ${indicators.rootMoisturePct}% and ${getSoilLabel(field.soilType, 'en')} support rapid 50–70 day maturity.`
        : `Độ ẩm rễ ${indicators.rootMoisturePct}% và đất ${getSoilLabel(field.soilType, 'vi').toLowerCase()} phù hợp cây ngắn ngày 50–70 ngày.`,
    ],
    benefits: {
      nutrientCycling: isEn ? 'Pair composted manure with crop residue incorporation.' : 'Kết hợp hữu cơ hoai mục và vùi tàn dư sau thu hoạch.',
      waterDemand: isFloodConcern
        ? isEn
          ? 'Tolerates wet periods well.'
          : 'Chịu ẩm tốt trong giai đoạn mưa nhiều.'
        : isEn
        ? 'Moderate water demand.'
        : 'Nhu cầu nước vừa phải, dễ điều tiết.',
      erosionAndOrganicMatter: isEn ? 'Covers soil during inter-season gap.' : 'Che phủ đất trong giai đoạn chuyển vụ.',
      pestCycleDisruption: isEn
        ? `Switches host family completely (${currentBotanicalFamily} → ${altBotanicalNote}).`
        : `Thay đổi họ thực vật hoàn toàn (${currentBotanicalFamily} → ${altBotanicalNote}).`,
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
