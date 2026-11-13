import {
  BareFieldMonthAnalysis,
  FarmerConstraints,
  FarmerPriorityId,
  FieldProfile,
  RotationStrategy,
  WeatherObservation,
} from '../types';
import { findNearestNasaGrid, getCellMonthlyProfile } from '../data/nasaVietnamGrid';
import { getSeedFamilyById, inferSeedFamilyFromCrop } from '../data/cropTaxonomy';
import { getSoilLabel, getDrainageLabel } from './agronomyEngine';

export interface ScenarioAdjustments {
  rainDeltaPct: number; // -40 to +40
  tempDeltaC: number;   // -3 to +4
}

export interface HarmonizedFieldIndicators {
  rootMoisturePct: number;
  surfaceMoisturePct: number;
  evapotranspirationMmDay: number;
  heatStressIndex: 'Thấp' | 'Trung bình' | 'Cao';
  erosionRisk: 'Thấp' | 'Trung bình' | 'Cao';
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
    term: 'Bất thường độ ẩm đất',
    simpleName: 'Đất đang khô hơn hay ẩm hơn mức bình thường nhiều năm',
    explanation:
      'So sánh độ ẩm đất hiện tại với mức trung bình cùng tháng trong 21 năm lịch sử để phát hiện sớm hạn cục bộ hoặc ngập úng tiềm ẩn.',
    fieldExample:
      'Nếu độ ẩm vùng rễ thấp hơn mức trung bình tháng 3 từ 15% trở lên, cây dễ bị héo tạm thời vào buổi trưa dù sáng sớm lá vẫn tươi.',
  },
  {
    term: 'Chỉ số độ xanh và che phủ thảm thực vật',
    simpleName: 'Mức độ xanh tốt và độ che phủ của tán lá nhìn từ vệ tinh',
    explanation:
      'Vệ tinh đo ánh sáng phản xạ từ lá xanh. Tán cây khỏe mạnh che phủ kín ruộng cho chỉ số cao; đất trống sau thu hoạch hoặc cây bị suy yếu cho chỉ số thấp.',
    fieldExample:
      'Khi độ che phủ giảm xuống thấp kéo dài nhiều tuần giữa hai vụ, mặt ruộng đang bị phơi nắng và dễ xói mòn khi gặp mưa đầu mùa.',
  },
  {
    term: 'Nguy cơ rét hại & sương muối',
    simpleName: 'Đợt nhiệt độ ban đêm xuống thấp làm tổn thương mô lá non',
    explanation:
      'Dựa trên chuỗi nhiệt độ tối thiểu ban đêm (đặc biệt ở miền Bắc và vùng núi cao) kết hợp với độ ẩm không khí.',
    fieldExample:
      'Nếu nhiệt độ đêm dưới 13°C vào tháng 1, cây mạ non hoặc rau họ Cà rất dễ thâm ngọn; cần che phủ hoặc chuyển sang cây chịu lạnh.',
  },
  {
    term: 'Cân bằng nước vùng rễ',
    simpleName: 'Chênh lệch giữa lượng nước nhận vào (mưa, tưới) và lượng nước mất đi',
    explanation:
      'Cho biết tầng đất nuôi rễ đang tích nước hay thâm hụt nước, giúp quyết định tưới vừa đủ hoặc ưu tiên tiêu thoát nước.',
    fieldExample:
      'Đất sét thoát chậm khi lượng mưa vượt xa mức bốc hơi sẽ nhanh chóng bão hòa, cần khơi rãnh trước khi xuất hiện ngập úng.',
  },
];

/**
 * Harmonizes multi-source satellite & field observations onto the field's grid cell
 */
export function computeHarmonizedIndicators(
  field: FieldProfile,
  weather: WeatherObservation,
  scenario: ScenarioAdjustments
): HarmonizedFieldIndicators {
  const { cell } = findNearestNasaGrid(field.lat, field.lon);
  const adjustedTemp = weather.temp + scenario.tempDeltaC;
  const rainFactor = 1 + scenario.rainDeltaPct / 100;

  // Estimate root and surface moisture response to scenario adjustments & soil drainage
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

  // Simplified Penman-style evapotranspiration estimate (mm/day)
  const et0 = Math.max(
    1.5,
    Number((0.18 * adjustedTemp + 0.14 * weather.solarRadiation - 0.02 * weather.humidity).toFixed(1))
  );

  const heatStressIndex: 'Thấp' | 'Trung bình' | 'Cao' =
    adjustedTemp >= 33 || weather.maxTemp + scenario.tempDeltaC >= 36
      ? 'Cao'
      : adjustedTemp >= 28
      ? 'Trung bình'
      : 'Thấp';

  const projectedAnnualRain = cell.climatology21Yr.annualRainfallMm * rainFactor;
  const erosionRisk: 'Thấp' | 'Trung bình' | 'Cao' =
    projectedAnnualRain > 2000 || (field.soilCharacteristics.drainage === 'fast' && scenario.rainDeltaPct > 15)
      ? 'Cao'
      : projectedAnnualRain > 1500
      ? 'Trung bình'
      : 'Thấp';

  const longTermWaterTrend =
    cell.lat < 11.5
      ? 'Vùng đồng bằng hạ lưu có xu hướng gia tăng dao động mực nước mùa khô và xâm nhập mặn cục bộ.'
      : cell.lat > 20
      ? 'Biên độ mưa giữa mùa khô và mùa lũ đang giãn rộng, dễ gặp hạn đầu vụ Xuân và mưa tập trung cuối hè.'
      : 'Lượng nước mặt phân bố lệch rõ rệt theo mùa, cần tích ẩm tầng rễ trong thời kỳ nắng gắt.';

  const vegetationStressNote =
    rootMoisturePct < 35
      ? 'Độ ẩm vùng rễ xuống thấp, tán lá có nguy cơ giảm quang hợp và héo rũ trưa nắng.'
      : rootMoisturePct > 82 && field.soilCharacteristics.drainage === 'slow'
      ? 'Độ ẩm bão hòa cao dễ làm rễ thiếu oxy và vàng lá sinh lý.'
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
    dataFusionSummary: `Hệ thống đồng bộ thông tin khí hậu 21 năm tại lưới vùng ${cell.region} (độ phân giải ~55 km) với đặc điểm đất ${getSoilLabel(field.soilType).toLowerCase()}, chế độ thoát nước (${getDrainageLabel(field.soilCharacteristics.drainage).toLowerCase()}) và giống cây tại thửa ruộng của bạn.`,
  };
}

/**
 * Generates 12-month bare-field & crop stress vulnerability timeline
 */
export function analyzeBareFieldAndStressTimeline(
  field: FieldProfile,
  scenario: ScenarioAdjustments
): BareFieldMonthAnalysis[] {
  const { cell } = findNearestNasaGrid(field.lat, field.lon);
  const monthly = getCellMonthlyProfile(cell);
  const plantingMonth = field.crop.plantingDate
    ? new Date(field.crop.plantingDate).getMonth() + 1
    : 11;

  // Approximate 3-4 month active cycle from plantingMonth
  const activeMonths = new Set<number>();
  for (let offset = 0; offset < 4; offset++) {
    const m = ((plantingMonth - 1 + offset) % 12) + 1;
    activeMonths.add(m);
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

    let dominantRisk = 'Điều kiện tương đối ổn định';
    let stressLevel: 'low' | 'moderate' | 'high' = 'low';

    if (isFlood) {
      dominantRisk =
        fieldState === 'bare_fallow'
          ? 'Đất trống gặp mưa lớn — nguy cơ xói mòn & rửa trôi dinh dưỡng'
          : 'Mưa cực đoan — nguy cơ ngập úng vùng rễ';
      stressLevel = 'high';
    } else if (isDrought) {
      dominantRisk =
        fieldState === 'bare_fallow'
          ? 'Đất trống phơi nắng — bốc hơi ẩm mạnh & chai cứng mặt đất'
          : 'Thiếu ẩm vùng rễ & bốc thoát hơi nước cao';
      stressLevel = 'high';
    } else if (isCold) {
      dominantRisk = 'Nhiệt độ đêm thấp — nguy cơ rét hại cho mạ và cây non';
      stressLevel = 'moderate';
    } else if (adjTemp > 31) {
      dominantRisk = 'Nắng nóng cao điểm — cây dễ sốc nhiệt buổi trưa';
      stressLevel = 'moderate';
    }

    const evaporationRisk: 'Thấp' | 'Trung bình' | 'Cao' =
      adjTemp >= 29 || m.ALLSKY_SFC_SW_DWN > 18.5
        ? 'Cao'
        : adjTemp >= 23
        ? 'Trung bình'
        : 'Thấp';

    let recommendationNote = 'Duy trì theo dõi định kỳ.';
    if (fieldState === 'bare_fallow') {
      recommendationNote = isFlood
        ? 'Tránh để đất trống: nên gieo cây che phủ họ Đậu (điền thanh, đậu đen) để giữ đất.'
        : 'Khoảng trống giữa vụ: thích hợp trồng đậu xanh ngắn ngày hoặc tủ rơm giữ ẩm.';
    } else if (fieldState === 'harvest_transition') {
      recommendationNote = 'Giai đoạn chuyển vụ: chuẩn bị hạt giống họ khác để ngắt chu kỳ sâu bệnh.';
    } else if (stressLevel === 'high') {
      recommendationNote = 'Cây trồng hiện tại nhạy cảm cao trong tháng này; cân nhắc giống chịu hạn/úng tốt hơn.';
    }

    return {
      month: monthNum,
      monthLabel: `Tháng ${monthNum}`,
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

/**
 * Generates at least 3 comparable crop rotation strategies (including existing baseline)
 */
export function generateRotationStrategies(
  field: FieldProfile,
  weather: WeatherObservation,
  priorities: FarmerPriorityId[],
  constraints: FarmerConstraints,
  scenario: ScenarioAdjustments
): RotationStrategy[] {
  const familyId = field.crop.seedFamily || inferSeedFamilyFromCrop(field.crop.name, field.crop.category);
  const currentFamily = getSeedFamilyById(familyId);
  const indicators = computeHarmonizedIndicators(field, weather, scenario);
  const isWaterTight =
    constraints.waterAvailability !== 'abundant' ||
    priorities.includes('water_saving') ||
    indicators.rootMoisturePct < 45;
  const isSlowDrainage =
    field.soilCharacteristics.drainage === 'slow' ||
    ['clay', 'clay_loam', 'acid_sulfate', 'peat_muck'].includes(field.soilType);
  const wantsForageOrIncome =
    priorities.includes('supplemental_income') || constraints.marketPreference !== 'cash_crop';

  // Strategy 1: Existing Baseline (Monoculture / Continue current crop family)
  const baseline: RotationStrategy = {
    id: 'rot-baseline',
    isCurrentBaseline: true,
    title: `Phương án hiện tại: Tiếp tục trồng ${field.crop.name} (${currentFamily.name})`,
    sequenceSummary: `${field.crop.name} → Nghỉ đất trống → ${field.crop.name}`,
    nextCropFamily: familyId,
    nextCropName: field.crop.name,
    suitabilityScore: isWaterTight || priorities.includes('pest_break') ? 54 : 68,
    whySuggested:
      'Là phương án đối chứng dựa trên tập quán canh tác hiện tại của thửa ruộng để bạn so sánh chi phí, lượng nước và rủi ro sâu bệnh.',
    supportingEvidence: [
      `Nông hộ đã quen kỹ thuật canh tác và đầu ra cho ${field.crop.name}.`,
      `Đất ${getSoilLabel(field.soilType).toLowerCase()} hiện có độ ẩm vùng rễ ước tính ${indicators.rootMoisturePct}% và tốc độ bốc thoát hơi nước ${indicators.evapotranspirationMmDay} mm/ngày.`,
      `Nếu để đất trống giữa các vụ vào tháng mưa (${indicators.floodRiskMonths.map(m => 'T' + m).join(', ') || 'giữa năm'}), mặt ruộng dễ bị rửa trôi dinh dưỡng.`,
    ],
    benefits: {
      nutrientCycling: 'Không bổ sung đạm sinh học tự nhiên; phụ thuộc hoàn toàn vào phân bón từ bên ngoài.',
      waterDemand:
        field.crop.category === 'rice'
          ? 'Nhu cầu nước cao; khó duy trì nếu nguồn nước mùa khô bị thu hẹp.'
          : 'Nhu cầu nước giữ nguyên như các vụ trước.',
      erosionAndOrganicMatter: 'Thời gian đất trống giữa hai vụ làm giảm mùn và tăng xói mòn tầng mặt.',
      pestCycleDisruption: 'Không cắt được chu kỳ sâu bệnh do trồng lặp lại cùng họ thực vật.',
      forageAndIncome: 'Thu nhập ổn định theo thói quen nhưng dễ bị ảnh hưởng nếu giá nông sản giảm hoặc thời tiết cực đoan.',
    },
    informationGaps: [
      'Chưa có kết quả phân tích hàm lượng dinh dưỡng (đạm, lân, kali, vi lượng) thực tế trong đất sau nhiều vụ liên tiếp.',
      'Chưa đo mật độ bào tử nấm hoặc tuyến trùng lưu tồn trong rễ vụ vừa rồi.',
    ],
    localReviewRisks: [
      'Nguy cơ tích tụ sâu bệnh chuyên biệt trên cùng họ cây trồng tăng dần sau 2–3 vụ liên tiếp.',
      'Rủi ro thiếu nước hoặc sụt giảm năng suất nếu thời tiết mùa tới nóng hơn hoặc khô hơn trung bình nhiều năm.',
    ],
    alignedPriorities: [],
  };

  // Strategy 2: Legume Nitrogen-Fixing Rotation (Fabaceae)
  const isLightOrDrySoil = ['sand', 'sandy_loam', 'gray_degraded', 'gravelly', 'ferralsol'].includes(
    field.soilType
  );
  const legumeCrop =
    isLightOrDrySoil || isWaterTight
      ? 'Lạc (Đậu phộng) hoặc Đậu xanh ngắn ngày'
      : 'Đậu tương (Đậu nành) hoặc Đậu xanh';
  const legumeScore =
    82 +
    (priorities.includes('nitrogen_fixing') ? 6 : 0) +
    (priorities.includes('pest_break') ? 5 : 0) +
    (priorities.includes('water_saving') ? 4 : 0) -
    (isSlowDrainage ? 6 : 0);

  const legumeStrategy: RotationStrategy = {
    id: 'rot-legume',
    isCurrentBaseline: false,
    title: `Luân canh Cố định đạm & Ngắt sâu bệnh: Xen vụ ${legumeCrop}`,
    sequenceSummary: `${field.crop.name} → ${legumeCrop} (Họ Đậu) → Vụ chính kế tiếp`,
    nextCropFamily: 'fabaceae',
    nextCropName: legumeCrop,
    suitabilityScore: Math.min(97, legumeScore),
    whySuggested:
      familyId === 'fabaceae'
        ? 'Ruộng hiện đang trồng họ Đậu; có thể chuyển sang đậu ngắn ngày chịu hạn kết hợp rơm rạ phủ gốc hoặc luân phiên sang ngũ cốc rễ sâu ở vụ sau.'
        : `Chuyển đổi từ ${currentFamily.name} sang Họ Đậu giúp rễ cộng sinh cố định đạm từ không khí, cắt đứt chu kỳ sâu bệnh cũ và giảm lượng nước tưới.`,
    supportingEvidence: [
      `Đất ${getSoilLabel(field.soilType).toLowerCase()} (${getDrainageLabel(field.soilCharacteristics.drainage).toLowerCase()}) phù hợp với cây họ Đậu nếu lên luống thoát nước tốt.`,
      `Trong kịch bản bốc thoát hơi nước ${indicators.evapotranspirationMmDay} mm/ngày, đậu xanh và lạc tiêu thụ ít nước hơn hẳn so với lúa nước hoặc rau ăn lá dài ngày.`,
      'Cây họ Đậu che phủ mặt ruộng trong giai đoạn chuyển vụ, giúp giảm nhiệt độ bề mặt đất và hạn chế cỏ dại.',
    ],
    benefits: {
      nutrientCycling: 'Nốt sần rễ bổ sung khoảng 40–70 kg đạm tự nhiên/ha, giúp giảm 20–30% phân đạm hóa học cho vụ sau.',
      waterDemand: 'Tiết kiệm nước rõ rệt nhờ bộ rễ cọc hút ẩm sâu và chu kỳ sinh trưởng ngắn (65–95 ngày).',
      erosionAndOrganicMatter: 'Thân lá đậu sau thu hoạch có thể cày vùi hoặc tủ gốc, tăng chất hữu cơ và giữ ẩm cho tầng mặt.',
      pestCycleDisruption: 'Thay đổi hoàn toàn ký chủ thực vật, làm gián đoạn vòng đời sâu đục thân, rầy và nấm hại của vụ trước.',
      forageAndIncome: 'Cho thu hoạch hạt thương phẩm dễ bán và phụ phẩm thân lá giàu đạm cho gia súc.',
    },
    informationGaps: [
      'Cần kiểm tra độ pH đất thực tế tại ruộng (cây họ Đậu phát triển kém nếu đất quá chua pH < 5.2 mà chưa bón vôi).',
      'Chưa có thông tin về giá thu mua hạt đậu/lạc tại thương lái địa phương ở thời điểm thu hoạch.',
    ],
    localReviewRisks: [
      isSlowDrainage
        ? 'Đất thoát nước chậm có nguy cơ thối rễ nếu gặp mưa lớn bất thường — bắt buộc lên luống cao và đánh rãnh sâu.'
        : 'Cần phòng trừ sâu ăn lá và kiểm tra vi khuẩn nốt sần nếu ruộng lần đầu trồng cây họ Đậu.',
      'Tham khảo cán bộ khuyến nông xã về giống đậu kháng bệnh gỉ sắt phù hợp mùa vụ địa phương.',
    ],
    alignedPriorities: ['nitrogen_fixing', 'pest_break', 'water_saving', 'organic_matter', 'supplemental_income'],
  };

  // Strategy 3: Drought-Tolerant / Forage & Supplemental Income Rotation
  const resilientCrop =
    constraints.marketPreference === 'forage_livestock'
      ? 'Ngô sinh khối / Cao lương chịu hạn'
      : ['sand', 'sandy_loam', 'loam', 'sandy_clay_loam', 'gray_degraded', 'basalt'].includes(
          field.soilType
        )
      ? 'Khoai lang mật / Khoai lang tím'
      : 'Ngô nếp ngắn ngày hoặc Bí đỏ phủ đất';
  const resilientFamily =
    resilientCrop.includes('Khoai lang')
      ? 'other_perennial'
      : resilientCrop.includes('Bí')
      ? 'cucurbitaceae'
      : 'poaceae';

  const resilientScore =
    78 +
    (wantsForageOrIncome ? 7 : 0) +
    (priorities.includes('erosion_control') ? 5 : 0) +
    (priorities.includes('water_saving') ? 5 : 0) -
    (familyId === resilientFamily ? 10 : 0);

  const resilientStrategy: RotationStrategy = {
    id: 'rot-resilient',
    isCurrentBaseline: false,
    title: `Luân canh Chịu hạn & Tăng thu nhập: Trồng ${resilientCrop}`,
    sequenceSummary: `${field.crop.name} → ${resilientCrop} → Họ Đậu / Vụ chính`,
    nextCropFamily: resilientFamily,
    nextCropName: resilientCrop,
    suitabilityScore: Math.min(95, Math.max(60, resilientScore)),
    whySuggested:
      'Tối ưu cho nông hộ muốn đa dạng hóa nguồn thu hoặc có nhu cầu thức ăn chăn nuôi, đồng thời tận dụng rễ sâu và tán lá rộng để bảo vệ đất.',
    supportingEvidence: [
      `Khi độ ẩm tầng mặt biến động mạnh (hiện ước tính ${indicators.surfaceMoisturePct}%), cây rễ sâu hoặc thân bò che phủ mặt đất giúp giữ ẩm tốt hơn cây rễ nông.`,
      `Kịch bản nhiệt độ dịch chuyển ${scenario.tempDeltaC >= 0 ? '+' : ''}${scenario.tempDeltaC}°C đòi hỏi giống cây chịu nắng nóng khá và ít phụ thuộc tưới liên tục.`,
      `Phù hợp với điều kiện ${constraints.equipmentAccess === 'basic_manual' ? 'canh tác thủ công hộ gia đình, ít tốn công làm cỏ nhờ tán lá che kín luống' : 'cơ giới hóa làm đất và thu hoạch nhanh'}.`,
    ],
    benefits: {
      nutrientCycling: 'Rễ cắm sâu giúp khai thác khoáng chất bị rửa trôi xuống tầng đất dưới, hạn chế thoái hóa tầng mặt.',
      waterDemand: 'Chịu khô hạn tốt hơn rau ăn lá và lúa; có thể tận dụng ẩm dư sau vụ mưa.',
      erosionAndOrganicMatter: 'Tán lá rộng che chắn giọt mưa rơi trực tiếp, giảm rõ rệt xói mòn đất mặt.',
      pestCycleDisruption:
        familyId === resilientFamily
          ? 'Lưu ý: cùng họ Hòa thảo với lúa/ngô nên cần kết hợp thêm 1 vụ họ Đậu sau đó để ngắt sâu bệnh triệt để.'
          : 'Khác họ thực vật với cây hiện tại, giúp hạn chế sâu bệnh chuyên tính từ vụ trước.',
      forageAndIncome: 'Cung cấp nguồn thức ăn xanh giá trị cao cho chăn nuôi (thân ngô, dây khoai) hoặc củ/quả dễ bảo quản chờ giá.',
    },
    informationGaps: [
      'Chưa biết cụ thể số lượng vật nuôi hoặc hợp đồng bao tiêu sinh khối tại địa phương.',
      'Cần kiểm tra mực nước ngầm thực tế vào đỉnh điểm tháng khô nếu trồng khoai lấy củ.',
    ],
    localReviewRisks: [
      'Cây lấy củ và ngô lấy hạt tiêu thụ khá nhiều kali và lân — cần bón cân đối hữu cơ hoai mục để không làm bạc màu đất.',
      'Kiểm tra bọ hà (với khoai lang) hoặc sâu keo mùa thu (với ngô) theo cảnh báo bảo vệ thực vật địa phương.',
    ],
    alignedPriorities: ['supplemental_income', 'erosion_control', 'water_saving', 'organic_matter'],
  };

  // Strategy 4: Cover Crop / Bare-Field Protection Strategy
  const coverScore =
    76 +
    (priorities.includes('erosion_control') ? 9 : 0) +
    (priorities.includes('organic_matter') ? 8 : 0) +
    (indicators.erosionRisk === 'Cao' ? 6 : 0);

  const coverStrategy: RotationStrategy = {
    id: 'rot-cover',
    isCurrentBaseline: false,
    title: 'Luân canh Cây che phủ & Phục hồi đất: Gieo Điền thanh / Muồng hoa vàng xen vụ trống',
    sequenceSummary: `${field.crop.name} → Cây che phủ họ Đậu (45–55 ngày) → Vụ chính`,
    nextCropFamily: 'fabaceae',
    nextCropName: 'Điền thanh / Muồng hoa vàng hoặc Đậu đen che phủ',
    suitabilityScore: Math.min(96, coverScore),
    whySuggested:
      'Giải quyết trực tiếp giai đoạn đất bị bỏ trống giữa hai vụ — thời điểm ruộng mất nhiều mùn, mất ẩm và dễ xói mòn nhất.',
    supportingEvidence: [
      `Nguy cơ xói mòn & rửa trôi tại khu vực được đánh giá ở mức ${indicators.erosionRisk.toLowerCase()}, đặc biệt vào các tháng mưa lớn (${indicators.floodRiskMonths.map(m => 'T' + m).join(', ') || 'mùa mưa'}).`,
      `Tốc độ bốc hơi nước từ mặt đất trống tăng mạnh khi nhiệt độ cao và bức xạ lớn.`,
      'Cây che phủ ngắn ngày (45–55 ngày) không làm chậm lịch gieo vụ chính mà còn làm đất tơi xốp hơn.',
    ],
    benefits: {
      nutrientCycling: 'Cố định đạm sinh học và giữ lại lượng phân bón tồn dư tránh bị mưa rửa trôi.',
      waterDemand: 'Gần như chỉ dùng nước mưa hoặc ẩm tồn dư, không đòi hỏi tưới bổ sung.',
      erosionAndOrganicMatter: 'Tăng lượng chất hữu cơ (mùn) nhanh nhất trong 4 phương án, cải thiện khả năng giữ nước của đất cát và độ tơi của đất sét.',
      pestCycleDisruption: 'Ức chế cỏ dại tự nhiên và tăng mật độ thiên địch có ích trên đồng ruộng.',
      forageAndIncome: 'Không tạo thu nhập tiền mặt trực tiếp ngay trong 50 ngày nhưng giúp tiết kiệm chi phí phân bón và công làm cỏ cho vụ sau.',
    },
    informationGaps: [
      'Cần xác định nông hộ có sẵn giống cây phân xanh (điền thanh, muồng, đậu đen) tại hợp tác xã hay không.',
      'Cần ước lượng công cày vùi sinh khối trước khi gieo vụ chính khoảng 10–14 ngày.',
    ],
    localReviewRisks: [
      'Phải cắt và cày vùi đúng lúc cây bắt đầu ra hoa (trước khi kết hạt già) để tránh mọc lẫn thành cỏ dại ở vụ sau.',
      'Nếu đất quá ngập nước, cần ưu tiên điền thanh chịu úng thay vì muồng hoa vàng.',
    ],
    alignedPriorities: ['erosion_control', 'organic_matter', 'nitrogen_fixing', 'pest_break', 'water_saving'],
  };

  return [baseline, legumeStrategy, resilientStrategy, coverStrategy].sort((a, b) =>
    a.isCurrentBaseline === b.isCurrentBaseline ? b.suitabilityScore - a.suitabilityScore : a.isCurrentBaseline ? -1 : 1
  );
}

/**
 * Picks ONLY the single best rotation strategy (excluding baseline & any strategies rejected by the farmer).
 * If the farmer provides a rejection reason and all 3 core proposals have been skipped, synthesizes a
 * tailored alternative addressing their constraint.
 */
export function pickBestRotationStrategy(
  field: FieldProfile,
  weather: WeatherObservation,
  priorities: FarmerPriorityId[],
  constraints: FarmerConstraints,
  excludedIds: string[] = [],
  rejectionReason?: string
): RotationStrategy {
  const all = generateRotationStrategies(field, weather, priorities, constraints, {
    rainDeltaPct: 0,
    tempDeltaC: 0,
  });

  const nonBaselineCandidates = all
    .filter((s) => !s.isCurrentBaseline && !excludedIds.includes(s.id))
    .sort((a, b) => b.suitabilityScore - a.suitabilityScore);

  if (nonBaselineCandidates.length > 0) {
    const picked = nonBaselineCandidates[0];
    if (rejectionReason) {
      return {
        ...picked,
        whySuggested: `${picked.whySuggested} (Đã chọn ưu tiên thay thế vì lý do của bạn: "${rejectionReason}").`,
      };
    }
    return picked;
  }

  // Synthesize an adaptive fallback strategy if all core candidates were rejected
  const lowerReason = (rejectionReason || '').toLowerCase();
  const isMarketConcern =
    lowerReason.includes('bán') || lowerReason.includes('đầu ra') || lowerReason.includes('giá') || lowerReason.includes('tiền');
  const isFloodConcern =
    lowerReason.includes('úng') || lowerReason.includes('ngập') || lowerReason.includes('mưa') || lowerReason.includes('nước');

  const altCrop = isFloodConcern
    ? 'Khoai môn nước hoặc Rau muống / Mè (Vừng) lên luống cao'
    : isMarketConcern
    ? 'Dưa leo / Bí xanh hoặc Rau ăn lá ngắn ngày dễ bán chợ địa phương'
    : 'Vừng (Mè) đen chịu hạn hoặc Đậu bắp ngắn ngày ít công chăm';

  const altFamily = isMarketConcern ? 'cucurbitaceae' : 'other_perennial';
  const indicators = computeHarmonizedIndicators(field, weather, { rainDeltaPct: 0, tempDeltaC: 0 });

  return {
    id: `rot-adaptive-${Date.now()}`,
    isCurrentBaseline: false,
    title: `Phương án điều chỉnh riêng cho ruộng của bạn: Trồng ${altCrop}`,
    sequenceSummary: `${field.crop.name} → ${altCrop} → Phủ rơm giữ ẩm`,
    nextCropFamily: altFamily,
    nextCropName: altCrop,
    suitabilityScore: 89,
    whySuggested: rejectionReason
      ? `Được điều chỉnh trực tiếp theo phản hồi thực tế của bạn ("${rejectionReason}") để khắc phục trở ngại về đầu ra, công lao động hoặc điều kiện đất tại ruộng.`
      : 'Phương án thay thế linh hoạt khác họ với cây đang trồng, ngắn ngày và dễ tiêu thụ tại địa phương.',
    supportingEvidence: [
      `Độ ẩm vùng rễ hiện tại ${indicators.rootMoisturePct}% và đất ${getSoilLabel(field.soilType).toLowerCase()} vẫn đảm bảo cho cây ngắn ngày phát triển nhanh.`,
      'Khác họ thực vật với cây trồng hiện tại nên vẫn giữ được hiệu quả cắt đứt chu kỳ sâu bệnh.',
      'Thời gian thu hoạch nhanh (50–70 ngày), xoay vòng vốn sớm và phù hợp tiêu thụ tại chợ địa phương.',
    ],
    benefits: {
      nutrientCycling: 'Kết hợp bón phân hữu cơ hoai mục và vùi tàn dư thân lá sau thu hoạch giúp duy trì độ phì đất.',
      waterDemand: isFloodConcern
        ? 'Chịu ẩm tốt hơn khi được lên luống cao thoát nước.'
        : 'Nhu cầu nước vừa phải, dễ điều tiết theo tuần.',
      erosionAndOrganicMatter: 'Che phủ mặt ruộng trong giai đoạn chuyển vụ, giảm bốc hơi nước.',
      pestCycleDisruption: 'Thay đổi nhóm cây ký chủ hoàn toàn so với vụ trước.',
      forageAndIncome: 'Dễ tiêu thụ trực tiếp cho thương lái địa phương hoặc sử dụng trong hộ gia đình.',
    },
    informationGaps: [
      'Cần kiểm tra nhu cầu thu mua thực tế tại chợ xã/hợp tác xã trong 2 tuần trước khi xuống giống.',
    ],
    localReviewRisks: [
      'Theo dõi thoát nước mặt luống khi có mưa lớn đột ngột và hỏi cán bộ khuyến nông địa phương về giống kháng bệnh tại vùng.',
    ],
    alignedPriorities: priorities,
  };
}

