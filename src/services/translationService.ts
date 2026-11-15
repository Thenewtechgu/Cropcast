import type { AppLanguage } from '../contexts/LanguageContext';

const CALENDAR_MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const CALENDAR_MONTHS_SHORT_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const CALENDAR_MONTHS_VI = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

const CALENDAR_MONTHS_SHORT_VI = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

export function getCalendarMonthName(
  monthNum: number,
  lang: AppLanguage = 'vi',
  short: boolean = false
): string {
  const idx = ((Math.round(monthNum) - 1) % 12 + 12) % 12;
  if (lang === 'en') {
    return short ? CALENDAR_MONTHS_SHORT_EN[idx] : CALENDAR_MONTHS_EN[idx];
  }
  return short ? CALENDAR_MONTHS_SHORT_VI[idx] : CALENDAR_MONTHS_VI[idx];
}

export function getCalendarMonthList(lang: AppLanguage = 'vi', short: boolean = false): string[] {
  if (lang === 'en') {
    return short ? [...CALENDAR_MONTHS_SHORT_EN] : [...CALENDAR_MONTHS_EN];
  }
  return short ? [...CALENDAR_MONTHS_SHORT_VI] : [...CALENDAR_MONTHS_VI];
}

const VI_TO_EN_PHRASES: Array<[RegExp, string]> = [
  [/\bthửa ruộng mẫu\b/gi, 'Sample Plot'],
  [/\bruộng mẫu\b/gi, 'Demo Plot'],
  [/\bruộng nhà\b/gi, 'Home Field'],
  [/\bvườn nhà\b/gi, 'Home Orchard'],
  [/\bkhu vườn\b/gi, 'Garden Plot'],
  [/\bthửa đất\b/gi, 'Field Plot'],
  [/\bruộng lúa\b/gi, 'Paddy Field'],
  [/\bruộng rau\b/gi, 'Vegetable Plot'],
  [/\bđồng ruộng\b/gi, 'Farm Field'],
  [/\bgiống địa phương\b/gi, 'Local Variety'],
  [/\bcây con\s*\([^)]*\)/gi, 'Seedling'],
  [/\bcây con\s*\/\s*mạ non\b/gi, 'Seedling / Nursery'],
  [/\bcây con\b/gi, 'Seedling'],
  [/\bmạ non\b/gi, 'Nursery Seedling'],
  [/\bđẻ nhánh rộ\s*\(nhu cầu nước nông\)/gi, 'Peak tillering (shallow water demand)'],
  [/\bđẻ nhánh rộ\b/gi, 'Peak tillering'],
  [/\bđẻ nhánh\b/gi, 'Tillering'],
  [/\bđang sinh trưởng\s*\/\s*đẻ nhánh rộ\b/gi, 'Active growth / Peak tillering'],
  [/\bđang sinh trưởng\b/gi, 'Vegetative Growth'],
  [/\bsinh trưởng mạnh\s*\(vươn lóng\)/gi, 'Rapid Stem Elongation'],
  [/\bsinh trưởng mạnh\b/gi, 'Rapid Vegetative Growth'],
  [/\bvươn lóng mạnh\s*\([^)]*\)/gi, 'Rapid Stem Elongation'],
  [/\bvươn lóng mạnh\b/gi, 'Rapid Stem Elongation'],
  [/\blàm đòng\s*-?\s*trổ bông\b/gi, 'Panicle Initiation & Heading'],
  [/\bđòng\s*-\s*trổ\b/gi, 'Booting & Heading'],
  [/\btrổ bông\b/gi, 'Heading'],
  [/\bđang làm đòng\b/gi, 'Panicle Initiation'],
  [/\bra hoa\s*\/\s*đâm tia củ\b/gi, 'Flowering / Pod pegging'],
  [/\bđâm tia củ\b/gi, 'Pod pegging'],
  [/\bra hoa\s*\/\s*kết trái\b/gi, 'Flowering / Fruit set'],
  [/\bkết trái\b/gi, 'Fruit set'],
  [/\bra hoa đậu quả\b/gi, 'Flowering & Fruit Set'],
  [/\bnuôi quả\s*\/\s*tạo củ\b/gi, 'Fruit / Tuber Filling'],
  [/\bnuôi quả\b/gi, 'Fruit Filling'],
  [/\bnuôi củ\b/gi, 'Tuber Bulking'],
  [/\bchín sữa\b/gi, 'Milk Grain Stage'],
  [/\bchín sáp\b/gi, 'Dough Stage'],
  [/\bchín vàng\b/gi, 'Golden Ripening'],
  [/\bsắp thu hoạch\b/gi, 'Pre-Harvest Maturation'],
  [/\bcanh tác truyền thống\b/gi, 'Traditional Farming'],
  [/\bcanh tác hữu cơ\b/gi, 'Organic Farming'],
  [/\btưới ngập khô xen kẽ\b/gi, 'Alternate wetting & drying (AWD)'],
  [/\bvietgap\b/gi, 'VietGAP Standard'],
  [/\bnhỏ giọt\b/gi, 'Drip Irrigation'],
  [/\btưới nhỏ giọt theo gốc\b/gi, 'Root-zone drip irrigation'],
  [/\btưới nhỏ giọt\b/gi, 'Drip Irrigation'],
  [/\btưới phun mưa\b/gi, 'Sprinkler Irrigation'],
  [/\btưới rãnh\b/gi, 'Furrow Irrigation'],
  [/\btưới ngập\b/gi, 'Flood Irrigation'],
  [/\bnhờ nước trời\b/gi, 'Rainfed'],
  [/\blúa nước\b/gi, 'Paddy Rice'],
  [/\blúa\b/gi, 'Rice'],
  [/\bngô lai f1\b/gi, 'Hybrid Maize F1'],
  [/\bngô\s*\(bắp\)/gi, 'Maize (Corn)'],
  [/\bngô\b/gi, 'Maize'],
  [/\bđậu tương\b/gi, 'Soybean'],
  [/\bđậu nành\b/gi, 'Soybean'],
  [/\bđậu xanh\b/gi, 'Mungbean'],
  [/\bđậu đen\b/gi, 'Black Bean'],
  [/\bđậu đỏ\b/gi, 'Adzuki Bean'],
  [/\bđậu đũa\b/gi, 'Yardlong Bean'],
  [/\bđậu cô ve\b/gi, 'French Bean'],
  [/\bđậu bắp\b/gi, 'Okra'],
  [/\bđậu phộng\b/gi, 'Peanut'],
  [/\blạc\b/gi, 'Peanut'],
  [/\brau cải ngọt\b/gi, 'Choy Sum'],
  [/\brau cải xanh\b/gi, 'Mustard Greens'],
  [/\brau muống\b/gi, 'Water Spinach'],
  [/\bmồng tơi\b/gi, 'Malabar Spinach'],
  [/\brau dền\b/gi, 'Amaranth Greens'],
  [/\bxà lách\b/gi, 'Lettuce'],
  [/\bbắp cải\b/gi, 'Cabbage'],
  [/\bsúp lơ\b/gi, 'Cauliflower'],
  [/\bcủ cải trắng\b/gi, 'Daikon Radish'],
  [/\bsu hào\b/gi, 'Kohlrabi'],
  [/\bhành lá\b/gi, 'Scallion'],
  [/\bcà rốt\b/gi, 'Carrot'],
  [/\bcà chua\b/gi, 'Tomato'],
  [/\bkhoai tây\b/gi, 'Potato'],
  [/\bớt cay\b/gi, 'Chili Pepper'],
  [/\bcà tím\b/gi, 'Eggplant'],
  [/\bdưa hấu\b/gi, 'Watermelon'],
  [/\bdưa leo\b/gi, 'Cucumber'],
  [/\bdưa chuột\b/gi, 'Cucumber'],
  [/\bdưa lưới\b/gi, 'Cantaloupe Melon'],
  [/\bbí đỏ\b/gi, 'Pumpkin'],
  [/\bbí đao\b/gi, 'Wax Gourd'],
  [/\bmướp hương\b/gi, 'Scented Loofah'],
  [/\bkhổ qua\b/gi, 'Bitter Gourd'],
  [/\bmướp đắng\b/gi, 'Bitter Gourd'],
  [/\bkhoai lang\b/gi, 'Sweet Potato'],
  [/\bkhoai mì\b/gi, 'Cassava'],
  [/\bsắn\b/gi, 'Cassava'],
  [/\bkhoai môn\b/gi, 'Taro'],
  [/\bmía\b/gi, 'Sugarcane'],
  [/\bvừng\b/gi, 'Sesame'],
  [/\bcà phê\b/gi, 'Coffee'],
  [/\bhồ tiêu\b/gi, 'Black Pepper'],
  [/\bchè\b/gi, 'Tea'],
  [/\bđiều\b/gi, 'Cashew'],
  [/\bcao su\b/gi, 'Rubber'],
  [/\bdừa\b/gi, 'Coconut'],
  [/\bchuối\b/gi, 'Banana'],
  [/\bxoài\b/gi, 'Mango'],
  [/\bbưởi\b/gi, 'Pomelo'],
  [/\bcam\b/gi, 'Orange'],
  [/\bdứa\b/gi, 'Pineapple'],
  [/\bnhãn\b/gi, 'Longan'],
  [/\bvải thiều\b/gi, 'Lychee'],
  [/\bsầu riêng\b/gi, 'Durian'],
  [/\bthanh long\b/gi, 'Dragon Fruit'],
  [/\bgiữ ẩm tốt\b/gi, 'retains moisture well'],
  [/\bthoát nước nhanh\b/gi, 'drains quickly'],
  [/\bthoát nước chậm\b/gi, 'drains slowly'],
];

const EN_TO_VI_PHRASES: Array<[RegExp, string]> = [
  [/\bSample Plot\b/gi, 'Thửa ruộng mẫu'],
  [/\bDemo Plot\b/gi, 'Ruộng mẫu'],
  [/\bHome Field\b/gi, 'Ruộng nhà'],
  [/\bHome Orchard\b/gi, 'Vườn nhà'],
  [/\bLocal Variety\b/gi, 'Giống địa phương'],
  [/\bSeedling\s*\/\s*Nursery\b/gi, 'Cây con / Mạ non'],
  [/\bVegetative Growth\b/gi, 'Đang sinh trưởng'],
  [/\bRapid Stem Elongation\b/gi, 'Vươn lóng mạnh'],
  [/\bPanicle Initiation\s*&\s*Heading\b/gi, 'Làm đòng trổ bông'],
  [/\bTraditional Farming\b/gi, 'Canh tác truyền thống'],
  [/\bOrganic Farming\b/gi, 'Canh tác hữu cơ'],
  [/\bDrip Irrigation\b/gi, 'Tưới nhỏ giọt'],
  [/\bSprinkler Irrigation\b/gi, 'Tưới phun mưa'],
  [/\bFurrow Irrigation\b/gi, 'Tưới rãnh'],
  [/\bFlood Irrigation\b/gi, 'Tưới ngập'],
  [/\bRainfed\b/gi, 'Nhờ nước trời'],
  [/\bPaddy Rice\b/gi, 'Lúa nước'],
  [/\bMaize\s*\(Corn\)\b/gi, 'Ngô (Bắp)'],
  [/\bSoybean\b/gi, 'Đậu tương'],
  [/\bMungbean\b/gi, 'Đậu xanh'],
  [/\bPeanut\b/gi, 'Lạc (Đậu phộng)'],
  [/\bWatermelon\b/gi, 'Dưa hấu'],
  [/\bCucumber\b/gi, 'Dưa leo'],
  [/\bTomato\b/gi, 'Cà chua'],
  [/\bPotato\b/gi, 'Khoai tây'],
  [/\bSweet Potato\b/gi, 'Khoai lang'],
  [/\bCassava\b/gi, 'Sắn (Khoai mì)'],
  [/\bSugarcane\b/gi, 'Mía'],
  [/\bWater Spinach\b/gi, 'Rau muống'],
  [/\bCoffee\b/gi, 'Cà phê'],
  [/\bDurian\b/gi, 'Sầu riêng'],
  [/\bDragon Fruit\b/gi, 'Thanh long'],
];

const CACHE_STORAGE_KEY = 'cropcast_translation_cache_v1';
const memoryCache = new Map<string, string>();

function loadLocalCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveToCache(key: string, value: string) {
  memoryCache.set(key, value);
  try {
    const current = loadLocalCache();
    current[key] = value;
    const keys = Object.keys(current);
    if (keys.length > 350) {
      delete current[keys[0]];
    }
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage quota
  }
}

function getFromCache(key: string): string | undefined {
  if (memoryCache.has(key)) return memoryCache.get(key);
  const stored = loadLocalCache()[key];
  if (stored) {
    memoryCache.set(key, stored);
    return stored;
  }
  return undefined;
}

export function fallbackDictionaryTranslate(text: string, targetLang: AppLanguage): string {
  const clean = (text || '').trim();
  if (!clean) return '';
  let out = clean;
  const rules = targetLang === 'en' ? VI_TO_EN_PHRASES : EN_TO_VI_PHRASES;
  for (const [pattern, replacement] of rules) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function looksVietnamese(text: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
    text || ''
  );
}

export async function translateTexts(
  texts: string[],
  targetLang: AppLanguage,
  context = 'Vietnamese agriculture, farm fields, crops, and farmer community discussion'
): Promise<{ translations: string[]; provider: 'gemini' | 'cache' | 'dictionary' }> {
  const cleaned = texts.map((t) => (t || '').trim());
  if (cleaned.every((t) => !t)) {
    return { translations: cleaned, provider: 'cache' };
  }

  const result = new Array<string>(cleaned.length).fill('');
  const missingIndices: number[] = [];
  const missingTexts: string[] = [];

  cleaned.forEach((item, idx) => {
    if (!item) {
      result[idx] = '';
      return;
    }
    const cacheKey = `${targetLang}::${item}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
      result[idx] = cached;
    } else {
      missingIndices.push(idx);
      missingTexts.push(item);
    }
  });

  if (missingIndices.length === 0) {
    return { translations: result, provider: 'cache' };
  }

  try {
    const resp = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: missingTexts,
        targetLang,
        context,
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data?.translations) && data.translations.length === missingTexts.length) {
        missingIndices.forEach((origIdx, i) => {
          const translated = String(data.translations[i] || '').trim() || fallbackDictionaryTranslate(cleaned[origIdx], targetLang);
          result[origIdx] = translated;
          saveToCache(`${targetLang}::${cleaned[origIdx]}`, translated);
        });
        return { translations: result, provider: 'gemini' };
      }
    }
  } catch {
    // Offline or server unavailable — fall back cleanly below
  }

  missingIndices.forEach((origIdx) => {
    const dictTranslated = fallbackDictionaryTranslate(cleaned[origIdx], targetLang);
    result[origIdx] = dictTranslated;
  });

  return { translations: result, provider: 'dictionary' };
}

export async function translateSingleText(
  text: string,
  targetLang: AppLanguage,
  context?: string
): Promise<string> {
  const clean = (text || '').trim();
  if (!clean) return '';
  const { translations } = await translateTexts([clean], targetLang, context);
  return translations[0] || clean;
}

/**
 * Generates bilingual VI + EN pairs for farmer-created field & crop inputs on save
 * so switching languages seamlessly renders localized names immediately.
 */
export async function buildBilingualFieldFields(input: {
  name: string;
  district: string;
  cropName: string;
  variety: string;
  currentStage: string;
  farmingMethod: string;
  irrigationMethod: string;
  sourceLang: AppLanguage;
}) {
  const targetLang: AppLanguage = input.sourceLang === 'en' ? 'vi' : 'en';
  const sourceList = [
    input.name,
    input.district,
    input.cropName,
    input.variety,
    input.currentStage,
    input.farmingMethod,
    input.irrigationMethod,
  ];
  const { translations } = await translateTexts(
    sourceList,
    targetLang,
    'Vietnam farm plot name, district, crop name, variety, growth stage, farming method, irrigation method'
  );

  if (input.sourceLang === 'en') {
    return {
      name: translations[0] || fallbackDictionaryTranslate(input.name, 'vi') || input.name,
      nameEn: input.name,
      district: translations[1] || input.district,
      districtEn: input.district,
      cropName: translations[2] || fallbackDictionaryTranslate(input.cropName, 'vi') || input.cropName,
      cropNameEn: input.cropName,
      variety: translations[3] || fallbackDictionaryTranslate(input.variety, 'vi') || input.variety,
      varietyEn: input.variety,
      currentStage: translations[4] || fallbackDictionaryTranslate(input.currentStage, 'vi') || input.currentStage,
      currentStageEn: input.currentStage,
      farmingMethod: translations[5] || fallbackDictionaryTranslate(input.farmingMethod, 'vi') || input.farmingMethod,
      farmingMethodEn: input.farmingMethod,
      irrigationMethod: translations[6] || fallbackDictionaryTranslate(input.irrigationMethod, 'vi') || input.irrigationMethod,
      irrigationMethodEn: input.irrigationMethod,
    };
  }

  return {
    name: input.name,
    nameEn: translations[0] || fallbackDictionaryTranslate(input.name, 'en') || input.name,
    district: input.district,
    districtEn: translations[1] || input.district,
    cropName: input.cropName,
    cropNameEn: translations[2] || fallbackDictionaryTranslate(input.cropName, 'en') || input.cropName,
    variety: input.variety,
    varietyEn: translations[3] || fallbackDictionaryTranslate(input.variety, 'en') || input.variety,
    currentStage: input.currentStage,
    currentStageEn: translations[4] || fallbackDictionaryTranslate(input.currentStage, 'en') || input.currentStage,
    farmingMethod: input.farmingMethod,
    farmingMethodEn: translations[5] || fallbackDictionaryTranslate(input.farmingMethod, 'en') || input.farmingMethod,
    irrigationMethod: input.irrigationMethod,
    irrigationMethodEn: translations[6] || fallbackDictionaryTranslate(input.irrigationMethod, 'en') || input.irrigationMethod,
  };
}
