import { CropCategory, SeedFamilyId } from '../types';
import type { AppLanguage } from '../contexts/LanguageContext';

export interface PlantOption {
  id: string;
  name: string;
  nameEn: string;
  category: CropCategory;
  commonVarieties: string[];
  rootDepth: 'shallow' | 'medium' | 'deep';
  waterDemand: 'low' | 'medium' | 'high';
  nitrogenRole: 'fixer' | 'heavy_feeder' | 'moderate';
  droughtTolerance: 'Thấp' | 'Trung bình' | 'Cao';
  droughtToleranceEn: 'Low' | 'Moderate' | 'High';
  frostSensitivity: 'Nhạy cảm' | 'Trung bình' | 'Chịu lạnh tốt';
  frostSensitivityEn: 'Sensitive' | 'Moderate' | 'Cold tolerant';
  forageValue: string;
  typicalGrowthDays: number;
  rotationBenefitNote: string;
}

export interface SeedFamilyInfo {
  id: SeedFamilyId;
  name: string;
  nameEn: string;
  scientificName: string;
  shortTag: string;
  shortTagEn: string;
  description: string;
  descriptionEn: string;
  soilImpactNote: string;
  soilImpactNoteEn: string;
  plants: PlantOption[];
}

export const SEED_FAMILIES: SeedFamilyInfo[] = [
  {
    id: 'poaceae',
    name: 'Họ Hòa thảo (Ngũ cốc)',
    nameEn: 'Grasses & Cereals',
    scientificName: 'Poaceae',
    shortTag: 'Rễ chùm · Cần đạm cao',
    shortTagEn: 'Fibrous roots · High N demand',
    description: 'Nhóm cây lương thực chủ lực như lúa, ngô, cao lương và cỏ thức ăn gia súc.',
    descriptionEn: 'Core cereal crops such as rice, maize, sorghum, and forage grasses.',
    soilImpactNote: 'Hấp thu đạm mạnh, nên luân canh sau cây họ Đậu để tận dụng đạm tự nhiên và cắt mạch sâu bệnh.',
    soilImpactNoteEn: 'Heavy nitrogen feeders; rotate after legumes to reuse biological nitrogen and break pest cycles.',
    plants: [
      {
        id: 'rice',
        name: 'Lúa nước',
        nameEn: 'Paddy Rice',
        category: 'rice',
        commonVarieties: ['ST25', 'Đài Thơm 8', 'OM5451', 'Bắc Thơm số 7', 'Nếp cái hoa vàng'],
        rootDepth: 'shallow',
        waterDemand: 'high',
        nitrogenRole: 'heavy_feeder',
        droughtTolerance: 'Thấp',
        droughtToleranceEn: 'Low',
        frostSensitivity: 'Nhạy cảm',
        frostSensitivityEn: 'Sensitive',
        forageValue: 'Rơm rạ làm thức ăn trâu bò và nguyên liệu tủ gốc giữ ẩm',
        typicalGrowthDays: 105,
        rotationBenefitNote: 'Chuyển sang cây cạn họ Đậu vào vụ khô giúp đất tơi xốp và giảm mầm bệnh lúa.',
      },
      {
        id: 'maize',
        name: 'Ngô (Bắp)',
        nameEn: 'Maize (Corn)',
        category: 'maize',
        commonVarieties: ['NK7328', 'CP511', 'Ngô nếp HN88', 'Ngô sinh khối DK6919'],
        rootDepth: 'deep',
        waterDemand: 'medium',
        nitrogenRole: 'heavy_feeder',
        droughtTolerance: 'Trung bình',
        droughtToleranceEn: 'Moderate',
        frostSensitivity: 'Trung bình',
        frostSensitivityEn: 'Moderate',
        forageValue: 'Thân lá ngô sinh khối rất tốt cho chăn nuôi bò sữa, bò thịt',
        typicalGrowthDays: 95,
        rotationBenefitNote: 'Bộ rễ sâu giúp phá tầng đế cày nhẹ và cải thiện khả năng thấm nước.',
      },
      {
        id: 'sorghum',
        name: 'Cao lương chịu hạn',
        nameEn: 'Drought-Tolerant Sorghum',
        category: 'maize',
        commonVarieties: ['Cao lương ngọt', 'Cao lương sinh khối'],
        rootDepth: 'deep',
        waterDemand: 'low',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Cao',
        droughtToleranceEn: 'High',
        frostSensitivity: 'Trung bình',
        frostSensitivityEn: 'Moderate',
        forageValue: 'Cung cấp nguồn thức ăn xanh chịu hạn xuất sắc cho gia súc',
        typicalGrowthDays: 90,
        rotationBenefitNote: 'Tiết kiệm nước tối đa vào mùa khô, thích hợp vùng thiếu nước tưới.',
      },
    ],
  },
  {
    id: 'fabaceae',
    name: 'Họ Đậu (Cố định đạm)',
    nameEn: 'Legumes (N-Fixing)',
    scientificName: 'Fabaceae',
    shortTag: 'Bổ sung đạm · Cải tạo đất',
    shortTagEn: 'Fixes nitrogen · Restores soil',
    description: 'Nhóm cây có nốt sần cộng sinh giúp tổng hợp đạm từ không khí và che phủ đất.',
    descriptionEn: 'Root-nodule crops that fix atmospheric nitrogen and protect topsoil.',
    soilImpactNote: 'Rất lý tưởng để trồng xen hoặc luân canh sau Lúa, Ngô, Rau cải nhằm phục hồi độ phì và cắt chu kỳ sâu bệnh.',
    soilImpactNoteEn: 'Ideal after rice, maize, or brassicas to restore soil fertility and suppress soil-borne pests.',
    plants: [
      {
        id: 'soybean',
        name: 'Đậu tương (Đậu nành)',
        nameEn: 'Soybean',
        category: 'legume',
        commonVarieties: ['ĐT84', 'ĐT26', 'Đậu tương ĐX11'],
        rootDepth: 'medium',
        waterDemand: 'low',
        nitrogenRole: 'fixer',
        droughtTolerance: 'Trung bình',
        droughtToleranceEn: 'Moderate',
        frostSensitivity: 'Trung bình',
        frostSensitivityEn: 'Moderate',
        forageValue: 'Thân lá giàu đạm có thể ủ chua làm thức ăn chăn nuôi hoặc phân xanh',
        typicalGrowthDays: 85,
        rotationBenefitNote: 'Bổ sung 40–70 kg đạm sinh học/ha cho vụ kế tiếp, giảm lượng phân hóa học.',
      },
      {
        id: 'mungbean',
        name: 'Đậu xanh',
        nameEn: 'Mungbean',
        category: 'legume',
        commonVarieties: ['Đậu xanh ĐX208', 'Đậu xanh mỡ hạt to'],
        rootDepth: 'medium',
        waterDemand: 'low',
        nitrogenRole: 'fixer',
        droughtTolerance: 'Cao',
        droughtToleranceEn: 'High',
        frostSensitivity: 'Nhạy cảm',
        frostSensitivityEn: 'Sensitive',
        forageValue: 'Phụ phẩm thân lá làm thức ăn gia súc và che phủ chống xói mòn',
        typicalGrowthDays: 65,
        rotationBenefitNote: 'Thời gian sinh trưởng ngắn (60–70 ngày), phù hợp lấp khoảng đất trống giữa hai vụ chính.',
      },
      {
        id: 'peanut',
        name: 'Lạc (Đậu phộng)',
        nameEn: 'Peanut (Groundnut)',
        category: 'legume',
        commonVarieties: ['Lạc L14', 'Lạc sen Nghệ An', 'Lạc đỏ MD7'],
        rootDepth: 'medium',
        waterDemand: 'low',
        nitrogenRole: 'fixer',
        droughtTolerance: 'Cao',
        droughtToleranceEn: 'High',
        frostSensitivity: 'Trung bình',
        frostSensitivityEn: 'Moderate',
        forageValue: 'Thân lá lạc phơi khô là nguồn thức ăn thô giàu dinh dưỡng',
        typicalGrowthDays: 100,
        rotationBenefitNote: 'Rất hợp đất cát pha hoặc đất thịt nhẹ, vừa tăng thu nhập vừa cải tạo đất bạc màu.',
      },
      {
        id: 'sesbania',
        name: 'Điền thanh / Muồng che phủ đất',
        nameEn: 'Sesbania / Sunn Hemp Cover',
        category: 'legume',
        commonVarieties: ['Điền thanh hạt tròn', 'Muồng hoa vàng'],
        rootDepth: 'deep',
        waterDemand: 'low',
        nitrogenRole: 'fixer',
        droughtTolerance: 'Cao',
        droughtToleranceEn: 'High',
        frostSensitivity: 'Chịu lạnh tốt',
        frostSensitivityEn: 'Cold tolerant',
        forageValue: 'Sinh khối phân xanh lớn, cày vùi giúp tăng nhanh hàm lượng chất hữu cơ',
        typicalGrowthDays: 55,
        rotationBenefitNote: 'Chống rửa trôi đất mặt vào mùa mưa bão và giữ ẩm khi đất trống.',
      },
    ],
  },
  {
    id: 'brassicaceae',
    name: 'Họ Cải (Thập tự)',
    nameEn: 'Brassicas (Crucifers)',
    scientificName: 'Brassicaceae',
    shortTag: 'Ưa mát · Rễ nông',
    shortTagEn: 'Cool-season · Shallow roots',
    description: 'Nhóm rau ăn lá và củ ngắn ngày ưa khí hậu mát mẻ như cải xanh, bắp cải, củ cải.',
    descriptionEn: 'Cool-climate leafy vegetables and root brassicas like mustard greens, cabbage, and radish.',
    soilImpactNote: 'Không nên trồng họ Cải liên tiếp nhiều vụ trên cùng một luống vì dễ tích tụ bệnh sưng rễ và bọ nhảy.',
    soilImpactNoteEn: 'Avoid planting consecutive brassicas on the same beds to prevent clubroot and flea beetles.',
    plants: [
      {
        id: 'mustard_greens',
        name: 'Rau cải xanh / Cải ngọt',
        nameEn: 'Mustard Greens / Choy Sum',
        category: 'vegetable',
        commonVarieties: ['Cải ngọt Trang Nông F1', 'Cải xanh mỡ', 'Cải thìa'],
        rootDepth: 'shallow',
        waterDemand: 'medium',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Thấp',
        droughtToleranceEn: 'Low',
        frostSensitivity: 'Chịu lạnh tốt',
        frostSensitivityEn: 'Cold tolerant',
        forageValue: 'Lá già loại bỏ có thể tận dụng cho gia cầm hoặc ủ phân hữu cơ',
        typicalGrowthDays: 35,
        rotationBenefitNote: 'Chu kỳ ngắn giúp quay vòng vốn nhanh nhưng cần luân canh sang họ Đậu hoặc họ Cà sau 2 lứa.',
      },
      {
        id: 'cabbage',
        name: 'Bắp cải / Súp lơ',
        nameEn: 'Cabbage / Cauliflower',
        category: 'vegetable',
        commonVarieties: ['Bắp cải KK Cross', 'Súp lơ xanh F1'],
        rootDepth: 'shallow',
        waterDemand: 'medium',
        nitrogenRole: 'heavy_feeder',
        droughtTolerance: 'Thấp',
        droughtToleranceEn: 'Low',
        frostSensitivity: 'Chịu lạnh tốt',
        frostSensitivityEn: 'Cold tolerant',
        forageValue: 'Lá ngoài làm thức ăn cho cá, gia cầm',
        typicalGrowthDays: 75,
        rotationBenefitNote: 'Ưa thời tiết mát vụ Đông ở miền Bắc và vùng cao.',
      },
      {
        id: 'radish',
        name: 'Củ cải trắng',
        nameEn: 'Daikon Radish',
        category: 'vegetable',
        commonVarieties: ['Củ cải trắng Hàn Quốc', 'Củ cải đỏ'],
        rootDepth: 'deep',
        waterDemand: 'medium',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Trung bình',
        droughtToleranceEn: 'Moderate',
        frostSensitivity: 'Chịu lạnh tốt',
        frostSensitivityEn: 'Cold tolerant',
        forageValue: 'Ngọn củ cải làm thức ăn thô xanh',
        typicalGrowthDays: 55,
        rotationBenefitNote: 'Rễ củ cắm sâu tự nhiên giúp đất tơi xốp hơn cho vụ sau.',
      },
    ],
  },
  {
    id: 'solanaceae',
    name: 'Họ Cà',
    nameEn: 'Nightshades',
    scientificName: 'Solanaceae',
    shortTag: 'Giá trị cao · Nhạy héo xanh',
    shortTagEn: 'High value · Wilt-sensitive',
    description: 'Cà chua, khoai tây, ớt, cà tím — các cây trồng cho giá trị hàng hóa cao.',
    descriptionEn: 'Tomatoes, potatoes, chili peppers, and eggplant with high commercial return.',
    soilImpactNote: 'Dễ bị bệnh héo xanh vi khuẩn và tuyến trùng nếu trồng lặp lại; nên luân canh với Lúa nước hoặc họ Đậu.',
    soilImpactNoteEn: 'Susceptible to bacterial wilt and nematodes if repeated; rotate with paddy rice or legumes.',
    plants: [
      {
        id: 'tomato',
        name: 'Cà chua',
        nameEn: 'Tomato',
        category: 'vegetable',
        commonVarieties: ['Cà chua Savior', 'Cà chua bi', 'Cà chua ghép'],
        rootDepth: 'medium',
        waterDemand: 'medium',
        nitrogenRole: 'heavy_feeder',
        droughtTolerance: 'Trung bình',
        droughtToleranceEn: 'Moderate',
        frostSensitivity: 'Nhạy cảm',
        frostSensitivityEn: 'Sensitive',
        forageValue: 'Chủ yếu thu hoạch quả thương phẩm',
        typicalGrowthDays: 95,
        rotationBenefitNote: 'Luân canh sau lúa nước giúp tiêu diệt nấm héo rũ tồn dư trong đất.',
      },
      {
        id: 'potato',
        name: 'Khoai tây',
        nameEn: 'Potato',
        category: 'tuber',
        commonVarieties: ['Khoai tây Marabel', 'Khoai tây Atlantic', 'Khoai tây Solara'],
        rootDepth: 'medium',
        waterDemand: 'medium',
        nitrogenRole: 'heavy_feeder',
        droughtTolerance: 'Trung bình',
        droughtToleranceEn: 'Moderate',
        frostSensitivity: 'Trung bình',
        frostSensitivityEn: 'Moderate',
        forageValue: 'Củ nhỏ làm thức ăn chăn nuôi sau nấu chín',
        typicalGrowthDays: 90,
        rotationBenefitNote: 'Rất phù hợp trồng vụ Đông trên đất lúa 2 vụ ở Đồng bằng Sông Hồng.',
      },
      {
        id: 'chili',
        name: 'Ớt cay / Ớt sừng',
        nameEn: 'Chili Pepper',
        category: 'vegetable',
        commonVarieties: ['Ớt chỉ thiên F1', 'Ớt sừng vàng'],
        rootDepth: 'medium',
        waterDemand: 'low',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Trung bình',
        droughtToleranceEn: 'Moderate',
        frostSensitivity: 'Nhạy cảm',
        frostSensitivityEn: 'Sensitive',
        forageValue: 'Thu hoạch nhiều lứa giúp ổn định dòng tiền',
        typicalGrowthDays: 120,
        rotationBenefitNote: 'Cần đất thoát nước tốt, lên luống cao vào mùa mưa.',
      },
    ],
  },
  {
    id: 'cucurbitaceae',
    name: 'Họ Bầu bí',
    nameEn: 'Cucurbits (Gourds & Melons)',
    scientificName: 'Cucurbitaceae',
    shortTag: 'Phủ mặt đất · Chịu nắng khá',
    shortTagEn: 'Ground cover · Sun-tolerant',
    description: 'Dưa hấu, dưa leo, bí đỏ, mướp đắng — thân bò che phủ mặt đất tốt.',
    descriptionEn: 'Watermelon, cucumber, pumpkin, and gourds with broad ground-covering vines.',
    soilImpactNote: 'Tán lá rộng giúp hạn chế cỏ dại và giảm bốc hơi nước tầng mặt; cần luân canh để tránh bệnh nứt thân chảy nhựa.',
    soilImpactNoteEn: 'Broad vines suppress weeds and cut surface evaporation; rotate to prevent gummy stem blight.',
    plants: [
      {
        id: 'watermelon',
        name: 'Dưa hấu',
        nameEn: 'Watermelon',
        category: 'fruit',
        commonVarieties: ['Dưa hấu An Tiêm', 'Dưa hấu không hạt F1'],
        rootDepth: 'deep',
        waterDemand: 'medium',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Trung bình',
        droughtToleranceEn: 'Moderate',
        frostSensitivity: 'Nhạy cảm',
        frostSensitivityEn: 'Sensitive',
        forageValue: 'Bổ sung thu nhập thời vụ cao dịp lễ Tết và mùa nắng',
        typicalGrowthDays: 70,
        rotationBenefitNote: 'Thích hợp đất cát pha, đất phù sa thoát nước nhanh sau vụ lúa.',
      },
      {
        id: 'pumpkin',
        name: 'Bí đỏ (Bí ngô)',
        nameEn: 'Pumpkin (Squash)',
        category: 'vegetable',
        commonVarieties: ['Bí đỏ hồ lô', 'Bí đỏ cô tiên'],
        rootDepth: 'deep',
        waterDemand: 'low',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Cao',
        droughtToleranceEn: 'High',
        frostSensitivity: 'Trung bình',
        frostSensitivityEn: 'Moderate',
        forageValue: 'Quả và ngọn bí có giá trị dinh dưỡng cao, bảo quản được lâu',
        typicalGrowthDays: 85,
        rotationBenefitNote: 'Tán lá bò kín mặt luống giúp chống xói mòn và giữ ẩm đất rất hiệu quả.',
      },
      {
        id: 'cucumber',
        name: 'Dưa leo (Dưa chuột)',
        nameEn: 'Cucumber',
        category: 'vegetable',
        commonVarieties: ['Dưa leo nếp', 'Dưa leo baby F1'],
        rootDepth: 'shallow',
        waterDemand: 'medium',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Thấp',
        droughtToleranceEn: 'Low',
        frostSensitivity: 'Nhạy cảm',
        frostSensitivityEn: 'Sensitive',
        forageValue: 'Thu hoạch sớm sau 35–40 ngày',
        typicalGrowthDays: 60,
        rotationBenefitNote: 'Tránh trồng liền kề sau bí, bầu hoặc dưa hấu.',
      },
    ],
  },
  {
    id: 'other_perennial',
    name: 'Họ Rễ củ, Cây ăn trái & Công nghiệp',
    nameEn: 'Tubers, Orchards & Industrial',
    scientificName: 'Convolvulaceae / Rubiaceae / Other',
    shortTag: 'Rễ sâu · Chịu hạn / Lâu năm',
    shortTagEn: 'Deep roots · Drought / Perennial',
    description: 'Khoai lang, sắn (khoai mì), cà phê, hồ tiêu, sầu riêng, thanh long.',
    descriptionEn: 'Sweet potato, cassava, coffee, black pepper, durian, and dragon fruit.',
    soilImpactNote: 'Với cây ngắn ngày lấy củ (khoai lang), cần luân canh với cây họ Đậu để tránh thoái hóa đất.',
    soilImpactNoteEn: 'Rotate annual root tubers (like sweet potato) with legumes to prevent nutrient depletion.',
    plants: [
      {
        id: 'sweet_potato',
        name: 'Khoai lang',
        nameEn: 'Sweet Potato',
        category: 'tuber',
        commonVarieties: ['Khoai lang tím Nhật', 'Khoai lang Hoàng Long', 'Khoai lang mật'],
        rootDepth: 'deep',
        waterDemand: 'low',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Cao',
        droughtToleranceEn: 'High',
        frostSensitivity: 'Trung bình',
        frostSensitivityEn: 'Moderate',
        forageValue: 'Dây và lá khoai lang là thức ăn xanh tuyệt vời cho lợn, bò, gà',
        typicalGrowthDays: 100,
        rotationBenefitNote: 'Che phủ mặt ruộng nhanh, chống xói mòn và tận dụng ẩm độ còn lại sau vụ mưa.',
      },
      {
        id: 'coffee',
        name: 'Cà phê / Hồ tiêu',
        nameEn: 'Coffee / Black Pepper',
        category: 'industrial',
        commonVarieties: ['Cà phê Robusta TR4', 'Cà phê Arabica Catimor', 'Tiêu Vĩnh Linh'],
        rootDepth: 'deep',
        waterDemand: 'medium',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Trung bình',
        droughtToleranceEn: 'Moderate',
        frostSensitivity: 'Nhạy cảm',
        frostSensitivityEn: 'Sensitive',
        forageValue: 'Có thể trồng xen cây họ Đậu hoặc lạc dại dưới tán để giữ ẩm',
        typicalGrowthDays: 365,
        rotationBenefitNote: 'Cây lâu năm nên ưu tiên trồng cây che phủ họ Đậu giữa các hàng để giữ ẩm mùa khô.',
      },
      {
        id: 'durian_fruit',
        name: 'Sầu riêng / Thanh long / Cây ăn trái',
        nameEn: 'Durian / Dragon Fruit / Orchard',
        category: 'fruit',
        commonVarieties: ['Sầu riêng Ri6', 'Sầu riêng Monthong', 'Thanh long ruột đỏ'],
        rootDepth: 'deep',
        waterDemand: 'medium',
        nitrogenRole: 'moderate',
        droughtTolerance: 'Trung bình',
        droughtToleranceEn: 'Moderate',
        frostSensitivity: 'Nhạy cảm',
        frostSensitivityEn: 'Sensitive',
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

export function getFamilyDisplayName(fam: SeedFamilyInfo, lang: AppLanguage = 'vi'): string {
  return lang === 'en' ? fam.nameEn : fam.name;
}

export function getFamilyShortTag(fam: SeedFamilyInfo, lang: AppLanguage = 'vi'): string {
  return lang === 'en' ? fam.shortTagEn : fam.shortTag;
}

export function getFamilySoilImpactNote(fam: SeedFamilyInfo, lang: AppLanguage = 'vi'): string {
  return lang === 'en' ? fam.soilImpactNoteEn : fam.soilImpactNote;
}

export function getPlantDisplayName(plantOrCropName: string | PlantOption, lang: AppLanguage = 'vi'): string {
  if (typeof plantOrCropName !== 'string') {
    return lang === 'en' ? plantOrCropName.nameEn : plantOrCropName.name;
  }
  const clean = plantOrCropName.trim();
  if (lang !== 'en') return clean;

  for (const fam of SEED_FAMILIES) {
    const match = fam.plants.find(
      p => p.name.toLowerCase() === clean.toLowerCase() || p.nameEn.toLowerCase() === clean.toLowerCase()
    );
    if (match) return match.nameEn;
  }

  const extraMap: Record<string, string> = {
    'rau cải ngọt': 'Choy Sum / Leafy Greens',
    'ngô lai f1': 'Hybrid Maize (F1)',
    'ngô lai (bắp)': 'Hybrid Maize (Corn)',
    'lúa st25': 'ST25 Rice',
    'lúa (st25 / đài thơm)': 'Rice (ST25 / Dai Thom)',
    'rau cải xanh vụ đông': 'Winter Leafy Greens',
    'ngô lai f1 (bắp)': 'Maize / Hybrid Corn',
    'đậu tương / lạc (họ đậu)': 'Soybean / Peanut (Legume)',
  };
  return extraMap[clean.toLowerCase()] || clean;
}

export function getCommonStageLabel(stage: string, lang: AppLanguage = 'vi'): string {
  if (lang !== 'en') return stage;
  const map: Record<string, string> = {
    'cây con / mạ non': 'Seedling / Nursery',
    'đang sinh trưởng': 'Vegetative Growth',
    'cây con (mới gieo 7 ngày)': 'Seedling (7 days after sowing)',
    'sinh trưởng mạnh (vươn lóng)': 'Rapid Stem Elongation',
    'vươn lóng mạnh': 'Rapid Vegetative Elongation',
    'làm đòng trổ bông': 'Panicle Initiation & Heading',
  };
  return map[stage.trim().toLowerCase()] || stage;
}

export function getCommonVarietyLabel(variety: string, lang: AppLanguage = 'vi'): string {
  if (lang !== 'en') return variety;
  const map: Record<string, string> = {
    'giống địa phương': 'Local variety',
    'cải thìa f1': 'Pak Choi F1',
  };
  return map[variety.trim().toLowerCase()] || variety;
}

export function inferSeedFamilyFromCrop(cropName: string, category?: CropCategory): SeedFamilyId {
  const lower = cropName.toLowerCase();
  if (
    lower.includes('đậu') ||
    lower.includes('lạc') ||
    lower.includes('điền thanh') ||
    lower.includes('bean') ||
    lower.includes('soybean') ||
    lower.includes('peanut') ||
    lower.includes('groundnut') ||
    lower.includes('sesbania') ||
    lower.includes('legume') ||
    category === 'legume'
  ) {
    return 'fabaceae';
  }
  if (
    lower.includes('cải') ||
    lower.includes('súp lơ') ||
    lower.includes('mustard') ||
    lower.includes('cabbage') ||
    lower.includes('cauliflower') ||
    lower.includes('radish') ||
    (category === 'vegetable' && lower.includes('greens'))
  ) {
    return 'brassicaceae';
  }
  if (
    lower.includes('cà chua') ||
    lower.includes('khoai tây') ||
    lower.includes('ớt') ||
    lower.includes('cà tím') ||
    lower.includes('tomato') ||
    lower.includes('potato') ||
    lower.includes('chili')
  ) {
    return 'solanaceae';
  }
  if (
    lower.includes('dưa') ||
    lower.includes('bí') ||
    lower.includes('bầu') ||
    lower.includes('mướp') ||
    lower.includes('melon') ||
    lower.includes('pumpkin') ||
    lower.includes('squash') ||
    lower.includes('cucumber')
  ) {
    return 'cucurbitaceae';
  }
  if (
    lower.includes('khoai lang') ||
    lower.includes('sắn') ||
    lower.includes('cà phê') ||
    lower.includes('sầu riêng') ||
    lower.includes('thanh long') ||
    lower.includes('sweet potato') ||
    lower.includes('coffee') ||
    lower.includes('pepper') ||
    lower.includes('durian') ||
    lower.includes('dragon fruit') ||
    category === 'industrial' ||
    category === 'fruit'
  ) {
    return 'other_perennial';
  }
  return 'poaceae';
}
