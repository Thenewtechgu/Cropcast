import { CropCategory, SeedFamilyId } from '../types';

export interface PlantOption {
  id: string;
  name: string;
  category: CropCategory;
  commonVarieties: string[];
  rootDepth: 'shallow' | 'medium' | 'deep';
  waterDemand: 'low' | 'medium' | 'high';
  nitrogenRole: 'fixer' | 'heavy_feeder' | 'moderate';
  droughtTolerance: 'Thấp' | 'Trung bình' | 'Cao';
  frostSensitivity: 'Nhạy cảm' | 'Trung bình' | 'Chịu lạnh tốt';
  forageValue: string;
  typicalGrowthDays: number;
  rotationBenefitNote: string;
}

export interface SeedFamilyInfo {
  id: SeedFamilyId;
  name: string;
  scientificName: string;
  shortTag: string;
  description: string;
  soilImpactNote: string;
  plants: PlantOption[];
}

export const SEED_FAMILIES: SeedFamilyInfo[] = [
  {
    id: 'poaceae',
    name: 'Họ Hòa thảo (Ngũ cốc)',
    scientificName: 'Poaceae',
    shortTag: 'Rễ chùm · Cần đạm cao',
    description: 'Nhóm cây lương thực chủ lực như lúa, ngô, cao lương và cỏ thức ăn gia súc.',
    soilImpactNote: 'Hấp thu đạm mạnh, nên luân canh sau cây họ Đậu để tận dụng đạm tự nhiên và cắt mạch sâu bệnh.',
    plants: [
      {
        id: 'rice',
        name: 'Lúa nước',
        category: 'rice',
        commonVarieties: ['ST25', 'Đài Thơm 8', 'OM5451', 'Bắc Thơm số 7', 'Nếp cái hoa vàng'],
        rootDepth: 'shallow',
        waterDemand: 'high',
        nitrogenRole: 'heavy_feeder',
        droughtTolerance: 'Thấp',
        frostSensitivity: 'Nhạy cảm',
        forageValue: 'Rơm rạ làm thức ăn trâu bò và nguyên liệu tủ gốc giữ ẩm',
        typicalGrowthDays: 105,
        rotationBenefitNote: 'Chuyển sang cây cạn họ Đậu vào vụ khô giúp đất tơi xốp và giảm mầm bệnh lúa.',
      },
      {
        id: 'maize',
        name: 'Ngô (Bắp)',
        category: 'maize',
        commonVarieties: ['NK7328', 'CP511', 'Ngô nếp HN88', 'Ngô sinh khối DK6919'],
        rootDepth: 'deep',
        waterDemand: 'medium',
        nitrogenRole: 'heavy_feeder',
        droughtTolerance: 'Trung bình',
        frostSensitivity: 'Trung bình',
        forageValue: 'Thân lá ngô sinh khối rất tốt cho chăn nuôi bò sữa, bò thịt',
        typicalGrowthDays: 95,
        rotationBenefitNote: 'Bộ rễ sâu giúp phá tầng đế cày nhẹ và cải thiện khả năng thấm nước.',
      },
      {
        id: 'sorghum',
        name: 'Cao lương chịu hạn',
        category: 'maize',
        commonVarieties: ['Cao lương ngọt', 'Cao lương sinh khối'],
        rootDepth: 'deep',
        waterDemand: 'low',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Cao',
        frostSensitivity: 'Trung bình',
        forageValue: 'Cung cấp nguồn thức ăn xanh chịu hạn xuất sắc cho gia súc',
        typicalGrowthDays: 90,
        rotationBenefitNote: 'Tiết kiệm nước tối đa vào mùa khô, thích hợp vùng thiếu nước tưới.',
      },
    ],
  },
  {
    id: 'fabaceae',
    name: 'Họ Đậu (Cố định đạm)',
    scientificName: 'Fabaceae',
    shortTag: 'Bổ sung đạm · Cải tạo đất',
    description: 'Nhóm cây có nốt sần cộng sinh giúp tổng hợp đạm từ không khí và che phủ đất.',
    soilImpactNote: 'Rất lý tưởng để trồng xen hoặc luân canh sau Lúa, Ngô, Rau cải nhằm phục hồi độ phì và cắt chu kỳ sâu bệnh.',
    plants: [
      {
        id: 'soybean',
        name: 'Đậu tương (Đậu nành)',
        category: 'legume',
        commonVarieties: ['ĐT84', 'ĐT26', 'Đậu tương ĐX11'],
        rootDepth: 'medium',
        waterDemand: 'low',
        nitrogenRole: 'fixer',
        droughtTolerance: 'Trung bình',
        frostSensitivity: 'Trung bình',
        forageValue: 'Thân lá giàu đạm có thể ủ chua làm thức ăn chăn nuôi hoặc phân xanh',
        typicalGrowthDays: 85,
        rotationBenefitNote: 'Bổ sung 40–70 kg đạm sinh học/ha cho vụ kế tiếp, giảm lượng phân hóa học.',
      },
      {
        id: 'mungbean',
        name: 'Đậu xanh',
        category: 'legume',
        commonVarieties: ['Đậu xanh ĐX208', 'Đậu xanh mỡ hạt to'],
        rootDepth: 'medium',
        waterDemand: 'low',
        nitrogenRole: 'fixer',
        droughtTolerance: 'Cao',
        frostSensitivity: 'Nhạy cảm',
        forageValue: 'Phụ phẩm thân lá làm thức ăn gia súc và che phủ chống xói mòn',
        typicalGrowthDays: 65,
        rotationBenefitNote: 'Thời gian sinh trưởng ngắn (60–70 ngày), phù hợp lấp khoảng đất trống giữa hai vụ chính.',
      },
      {
        id: 'peanut',
        name: 'Lạc (Đậu phộng)',
        category: 'legume',
        commonVarieties: ['Lạc L14', 'Lạc sen Nghệ An', 'Lạc đỏ MD7'],
        rootDepth: 'medium',
        waterDemand: 'low',
        nitrogenRole: 'fixer',
        droughtTolerance: 'Cao',
        frostSensitivity: 'Trung bình',
        forageValue: 'Thân lá lạc phơi khô là nguồn thức ăn thô giàu dinh dưỡng',
        typicalGrowthDays: 100,
        rotationBenefitNote: 'Rất hợp đất cát pha hoặc đất thịt nhẹ, vừa tăng thu nhập vừa cải tạo đất bạc màu.',
      },
      {
        id: 'sesbania',
        name: 'Điền thanh / Muồng che phủ đất',
        category: 'legume',
        commonVarieties: ['Điền thanh hạt tròn', 'Muồng hoa vàng'],
        rootDepth: 'deep',
        waterDemand: 'low',
        nitrogenRole: 'fixer',
        droughtTolerance: 'Cao',
        frostSensitivity: 'Chịu lạnh tốt',
        forageValue: 'Sinh khối phân xanh lớn, cày vùi giúp tăng nhanh hàm lượng chất hữu cơ',
        typicalGrowthDays: 55,
        rotationBenefitNote: 'Chống rửa trôi đất mặt vào mùa mưa bão và giữ ẩm khi đất trống.',
      },
    ],
  },
  {
    id: 'brassicaceae',
    name: 'Họ Cải (Thập tự)',
    scientificName: 'Brassicaceae',
    shortTag: 'Ưa mát · Rễ nông',
    description: 'Nhóm rau ăn lá và củ ngắn ngày ưa khí hậu mát mẻ như cải xanh, bắp cải, củ cải.',
    soilImpactNote: 'Không nên trồng họ Cải liên tiếp nhiều vụ trên cùng một luống vì dễ tích tụ bệnh sưng rễ và bọ nhảy.',
    plants: [
      {
        id: 'mustard_greens',
        name: 'Rau cải xanh / Cải ngọt',
        category: 'vegetable',
        commonVarieties: ['Cải ngọt Trang Nông F1', 'Cải xanh mỡ', 'Cải thìa'],
        rootDepth: 'shallow',
        waterDemand: 'medium',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Thấp',
        frostSensitivity: 'Chịu lạnh tốt',
        forageValue: 'Lá già loại bỏ có thể tận dụng cho gia cầm hoặc ủ phân hữu cơ',
        typicalGrowthDays: 35,
        rotationBenefitNote: 'Chu kỳ ngắn giúp quay vòng vốn nhanh nhưng cần luân canh sang họ Đậu hoặc họ Cà sau 2 lứa.',
      },
      {
        id: 'cabbage',
        name: 'Bắp cải / Súp lơ',
        category: 'vegetable',
        commonVarieties: ['Bắp cải KK Cross', 'Súp lơ xanh F1'],
        rootDepth: 'shallow',
        waterDemand: 'medium',
        nitrogenRole: 'heavy_feeder',
        droughtTolerance: 'Thấp',
        frostSensitivity: 'Chịu lạnh tốt',
        forageValue: 'Lá ngoài làm thức ăn cho cá, gia cầm',
        typicalGrowthDays: 75,
        rotationBenefitNote: 'Ưa thời tiết mát vụ Đông ở miền Bắc và vùng cao.',
      },
      {
        id: 'radish',
        name: 'Củ cải trắng',
        category: 'vegetable',
        commonVarieties: ['Củ cải trắng Hàn Quốc', 'Củ cải đỏ'],
        rootDepth: 'deep',
        waterDemand: 'medium',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Trung bình',
        frostSensitivity: 'Chịu lạnh tốt',
        forageValue: 'Ngọn củ cải làm thức ăn thô xanh',
        typicalGrowthDays: 55,
        rotationBenefitNote: 'Rễ củ cắm sâu tự nhiên giúp đất tơi xốp hơn cho vụ sau.',
      },
    ],
  },
  {
    id: 'solanaceae',
    name: 'Họ Cà',
    scientificName: 'Solanaceae',
    shortTag: 'Giá trị cao · Nhạy héo xanh',
    description: 'Cà chua, khoai tây, ớt, cà tím — các cây trồng cho giá trị hàng hóa cao.',
    soilImpactNote: 'Dễ bị bệnh héo xanh vi khuẩn và tuyến trùng nếu trồng lặp lại; nên luân canh với Lúa nước hoặc họ Đậu.',
    plants: [
      {
        id: 'tomato',
        name: 'Cà chua',
        category: 'vegetable',
        commonVarieties: ['Cà chua Savior', 'Cà chua bi', 'Cà chua ghép'],
        rootDepth: 'medium',
        waterDemand: 'medium',
        nitrogenRole: 'heavy_feeder',
        droughtTolerance: 'Trung bình',
        frostSensitivity: 'Nhạy cảm',
        forageValue: 'Chủ yếu thu hoạch quả thương phẩm',
        typicalGrowthDays: 95,
        rotationBenefitNote: 'Luân canh sau lúa nước giúp tiêu diệt nấm héo rũ tồn dư trong đất.',
      },
      {
        id: 'potato',
        name: 'Khoai tây',
        category: 'tuber',
        commonVarieties: ['Khoai tây Marabel', 'Khoai tây Atlantic', 'Khoai tây Solara'],
        rootDepth: 'medium',
        waterDemand: 'medium',
        nitrogenRole: 'heavy_feeder',
        droughtTolerance: 'Trung bình',
        frostSensitivity: 'Trung bình',
        forageValue: 'Củ nhỏ làm thức ăn chăn nuôi sau nấu chín',
        typicalGrowthDays: 90,
        rotationBenefitNote: 'Rất phù hợp trồng vụ Đông trên đất lúa 2 vụ ở Đồng bằng Sông Hồng.',
      },
      {
        id: 'chili',
        name: 'Ớt cay / Ớt sừng',
        category: 'vegetable',
        commonVarieties: ['Ớt chỉ thiên F1', 'Ớt sừng vàng'],
        rootDepth: 'medium',
        waterDemand: 'low',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Trung bình',
        frostSensitivity: 'Nhạy cảm',
        forageValue: 'Thu hoạch nhiều lứa giúp ổn định dòng tiền',
        typicalGrowthDays: 120,
        rotationBenefitNote: 'Cần đất thoát nước tốt, lên luống cao vào mùa mưa.',
      },
    ],
  },
  {
    id: 'cucurbitaceae',
    name: 'Họ Bầu bí',
    scientificName: 'Cucurbitaceae',
    shortTag: 'Phủ mặt đất · Chịu nắng khá',
    description: 'Dưa hấu, dưa leo, bí đỏ, mướp đắng — thân bò che phủ mặt đất tốt.',
    soilImpactNote: 'Tán lá rộng giúp hạn chế cỏ dại và giảm bốc hơi nước tầng mặt; cần luân canh để tránh bệnh nứt thân chảy nhựa.',
    plants: [
      {
        id: 'watermelon',
        name: 'Dưa hấu',
        category: 'fruit',
        commonVarieties: ['Dưa hấu An Tiêm', 'Dưa hấu không hạt F1'],
        rootDepth: 'deep',
        waterDemand: 'medium',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Trung bình',
        frostSensitivity: 'Nhạy cảm',
        forageValue: 'Bổ sung thu nhập thời vụ cao dịp lễ Tết và mùa nắng',
        typicalGrowthDays: 70,
        rotationBenefitNote: 'Thích hợp đất cát pha, đất phù sa thoát nước nhanh sau vụ lúa.',
      },
      {
        id: 'pumpkin',
        name: 'Bí đỏ (Bí ngô)',
        category: 'vegetable',
        commonVarieties: ['Bí đỏ hồ lô', 'Bí đỏ cô tiên'],
        rootDepth: 'deep',
        waterDemand: 'low',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Cao',
        frostSensitivity: 'Trung bình',
        forageValue: 'Quả và ngọn bí có giá trị dinh dưỡng cao, bảo quản được lâu',
        typicalGrowthDays: 85,
        rotationBenefitNote: 'Tán lá bò kín mặt luống giúp chống xói mòn và giữ ẩm đất rất hiệu quả.',
      },
      {
        id: 'cucumber',
        name: 'Dưa leo (Dưa chuột)',
        category: 'vegetable',
        commonVarieties: ['Dưa leo nếp', 'Dưa leo baby F1'],
        rootDepth: 'shallow',
        waterDemand: 'medium',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Thấp',
        frostSensitivity: 'Nhạy cảm',
        forageValue: 'Thu hoạch sớm sau 35–40 ngày',
        typicalGrowthDays: 60,
        rotationBenefitNote: 'Tránh trồng liền kề sau bí, bầu hoặc dưa hấu.',
      },
    ],
  },
  {
    id: 'other_perennial',
    name: 'Họ Rễ củ, Cây ăn trái & Công nghiệp',
    scientificName: 'Convolvulaceae / Rubiaceae / Khác',
    shortTag: 'Rễ sâu · Chịu hạn / Lâu năm',
    description: 'Khoai lang, sắn (khoai mì), cà phê, hồ tiêu, sầu riêng, thanh long.',
    soilImpactNote: 'Với cây ngắn ngày lấy củ (khoai lang), cần luân canh với cây họ Đậu để tránh thoái hóa đất.',
    plants: [
      {
        id: 'sweet_potato',
        name: 'Khoai lang',
        category: 'tuber',
        commonVarieties: ['Khoai lang tím Nhật', 'Khoai lang Hoàng Long', 'Khoai lang mật'],
        rootDepth: 'deep',
        waterDemand: 'low',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Cao',
        frostSensitivity: 'Trung bình',
        forageValue: 'Dây và lá khoai lang là thức ăn xanh tuyệt vời cho lợn, bò, gà',
        typicalGrowthDays: 100,
        rotationBenefitNote: 'Che phủ mặt ruộng nhanh, chống xói mòn và tận dụng ẩm độ còn lại sau vụ mưa.',
      },
      {
        id: 'coffee',
        name: 'Cà phê / Hồ tiêu',
        category: 'industrial',
        commonVarieties: ['Cà phê Robusta TR4', 'Cà phê Arabica Catimor', 'Tiêu Vĩnh Linh'],
        rootDepth: 'deep',
        waterDemand: 'medium',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Trung bình',
        frostSensitivity: 'Nhạy cảm',
        forageValue: 'Có thể trồng xen cây họ Đậu hoặc lạc dại dưới tán để giữ ẩm',
        typicalGrowthDays: 365,
        rotationBenefitNote: 'Cây lâu năm nên ưu tiên trồng cây che phủ họ Đậu giữa các hàng để giữ ẩm mùa khô.',
      },
      {
        id: 'durian_fruit',
        name: 'Sầu riêng / Thanh long / Cây ăn trái',
        category: 'fruit',
        commonVarieties: ['Sầu riêng Ri6', 'Sầu riêng Monthong', 'Thanh long ruột đỏ'],
        rootDepth: 'deep',
        waterDemand: 'medium',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Trung bình',
        frostSensitivity: 'Nhạy cảm',
        forageValue: 'Trồng thảm thực vật che phủ gốc giảm bốc hơi nước',
        typicalGrowthDays: 365,
        rotationBenefitNote: 'Cần theo dõi chặt ẩm độ đất vùng rễ và mặn nguồn nước mùa khô.',
      },
    ],
  },
];

export function getSeedFamilyById(familyId?: SeedFamilyId): SeedFamilyInfo {
  return SEED_FAMILIES.find(f => f.id === familyId) || SEED_FAMILIES[0];
}

export function inferSeedFamilyFromCrop(cropName: string, category?: CropCategory): SeedFamilyId {
  const lower = cropName.toLowerCase();
  if (lower.includes('đậu') || lower.includes('lạc') || lower.includes('điền thanh') || category === 'legume') {
    return 'fabaceae';
  }
  if (lower.includes('cải') || lower.includes('súp lơ') || category === 'vegetable' && lower.includes('cải')) {
    return 'brassicaceae';
  }
  if (lower.includes('cà chua') || lower.includes('khoai tây') || lower.includes('ớt') || lower.includes('cà tím')) {
    return 'solanaceae';
  }
  if (lower.includes('dưa') || lower.includes('bí') || lower.includes('bầu') || lower.includes('mướp')) {
    return 'cucurbitaceae';
  }
  if (lower.includes('khoai lang') || lower.includes('sắn') || lower.includes('cà phê') || lower.includes('sầu riêng') || lower.includes('thanh long') || category === 'industrial' || category === 'fruit') {
    return 'other_perennial';
  }
  return 'poaceae';
}
