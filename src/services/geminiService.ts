import {
  FieldProfile,
  WeatherObservation,
  FeedbackRecord,
  RotationStrategy,
  FarmerPriorityId,
  FarmerConstraints,
  EarthEnvironmentSnapshot,
} from '../types';
import { pickBestRotationStrategy } from './rotationEngine';
import { analyzeFieldAgronomy, getSoilLabel, getDrainageLabel } from './agronomyEngine';
import { resolveCropBotanicalProfile } from '../data/cropTaxonomy';
import type { AppLanguage } from '../contexts/LanguageContext';

export interface AdvisorApiResponse {
  success: boolean;
  advice?: {
    headline: string;
    situationSummary: string;
    topActions: Array<{
      title: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      reason: string;
      dataBasis: string;
    }>;
    postponeActions: string[];
    agronomicExplanation: string;
    uncertainties: string;
    nextCheckTime: string;
  };
  fallback?: boolean;
  message?: string;
}

function buildLocalAgronomyReply(
  userMessage: string,
  field: FieldProfile,
  weather?: WeatherObservation,
  earthMetrics?: EarthEnvironmentSnapshot,
  language: AppLanguage = 'vi'
): string {
  const q = userMessage.toLowerCase();
  const isEn = language === 'en';
  const fieldName = field?.name || (isEn ? 'your field' : 'thửa ruộng của bạn');
  const cropName = field?.crop?.name || (isEn ? 'current crop' : 'cây trồng hiện tại');
  const stageName = field?.crop?.currentStage || (isEn ? 'growing stage' : 'đang sinh trưởng');
  const botanical = resolveCropBotanicalProfile(cropName, field?.crop?.seedFamily, field?.crop?.category);
  const familyLabel = isEn ? botanical.familyLabelEn : botanical.familyLabelVi;
  const soilLabel = getSoilLabel(String(field?.soilType || 'loam'), language);
  const drainage = field?.soilCharacteristics?.drainage || 'moderate';
  const drainageLabel = getDrainageLabel(drainage, language);
  const temp = Number(weather?.temp ?? 26);
  const humidity = Number(weather?.humidity ?? 80);
  const rain = Number(weather?.rain ?? 0);
  const rootPct = Math.round(Number(weather?.gwetroot ?? 0.6) * 100);
  const topPct = Math.round(Number(weather?.gwettop ?? 0.55) * 100);
  const vpd = weather?.vpdHpa !== undefined ? Number(weather.vpdHpa) : undefined;
  const histAvgTemp = Number(weather?.historicalBaseline?.avgTemp ?? 26);
  const histAvgRain = Number(weather?.historicalBaseline?.avgRain ?? 120);

  const grace = earthMetrics?.groundwaterAnomalyGrace;
  const oco2 = earthMetrics?.carbonFluxOco2;
  const ghg = earthMetrics?.greenhouseGasEdgar;

  const cropSpecificPestTipVi =
    botanical.botanicalFamily === 'Cucurbitaceae'
      ? 'Với **Họ Bầu bí (Cucurbitaceae)** như dưa hấu/dưa leo/bí, cần soi kỹ mặt dưới lá vào sáng sớm để phát hiện sớm **bệnh sương mai, thán thư và nứt thân chảy nhựa**; giữ gốc thoáng, tránh tưới ướt lá chiều muộn.'
      : botanical.botanicalFamily === 'Fabaceae'
      ? 'Với **Họ Đậu (Fabaceae)** như lạc/đậu tương/đậu xanh, chú ý **bệnh héo xanh, lở cổ rễ và gỉ sắt** khi ẩm cao; không bón dư đạm vô cơ làm ức chế nốt sần cố định đạm.'
      : botanical.botanicalFamily === 'Solanaceae'
      ? 'Với **Họ Cà (Solanaceae)** như cà chua/khoai tây/ớt, phòng **bệnh héo xanh vi khuẩn và mốc sương** bằng cách đánh rãnh thoát nước sâu và tỉa lá gốc thông thoáng.'
      : botanical.botanicalFamily === 'Brassicaceae'
      ? 'Với **Họ Cải (Brassicaceae)**, cảnh giác **sâu tơ, bọ nhảy và thối nhũn vi khuẩn** khi mưa nắng xen kẽ; ưu tiên bẫy dính vàng và chế phẩm sinh học Bt.'
      : 'Với **Họ Hòa thảo (Poaceae)** như lúa/ngô, kiểm tra **đạo ôn, khô vằn, rầy nâu hoặc sâu keo mùa thu** ở nõn lá vào sáng sớm.';

  const cropSpecificPestTipEn =
    botanical.botanicalFamily === 'Cucurbitaceae'
      ? 'For **Cucurbitaceae** (watermelon/cucumber/pumpkin), inspect lower leaf undersides at dawn for **downy mildew, anthracnose, and gummy stem blight**; avoid late-evening overhead watering.'
      : botanical.botanicalFamily === 'Fabaceae'
      ? 'For **Fabaceae** (peanut/soybean/mungbean), watch for **bacterial wilt, collar rot, and rust** in humid spells; avoid heavy urea which suppresses nitrogen-fixing nodules.'
      : botanical.botanicalFamily === 'Solanaceae'
      ? 'For **Solanaceae** (tomato/potato/chili), guard against **bacterial wilt and blight** with deep drainage furrows and lower-leaf pruning.'
      : botanical.botanicalFamily === 'Brassicaceae'
      ? 'For **Brassicaceae** (mustard greens/cabbage), monitor **flea beetles, diamondback moth, and soft rot** using yellow sticky traps and Bt bio-sprays.'
      : 'For **Poaceae** (rice/maize), scout early morning for **blast, sheath blight, planthoppers, or fall armyworm**.';

  const graceNoteVi = grace
    ? `- **Trữ lượng nước tầng sâu:** **${grace.lweThicknessCm >= 0 ? '+' : ''}${grace.lweThicknessCm} cm** (${grace.groundwaterStatus === 'depleting' ? 'đang suy giảm — ưu tiên tưới rãnh/nhỏ giọt tiết kiệm' : grace.groundwaterStatus === 'recharging' ? 'đang phục hồi tốt' : 'ổn định'}).`
    : '';
  const graceNoteEn = grace
    ? `- **Subsurface water balance:** **${grace.lweThicknessCm >= 0 ? '+' : ''}${grace.lweThicknessCm} cm** (${grace.groundwaterStatus}).`
    : '';

  if (
    q.includes('tưới') ||
    q.includes('đất') ||
    q.includes('ẩm') ||
    q.includes('nước') ||
    q.includes('irrigat') ||
    q.includes('water') ||
    q.includes('soil')
  ) {
    const shouldWater = rootPct < 45 && rain < 3;
    const tooWet = rootPct > 78 || rain >= 10;
    if (isEn) {
      return [
        `### Irrigation & Soil Care Plan for "${fieldName}" (${cropName} — ${familyLabel})`,
        `- **Current moisture snapshot:** Root-zone **${rootPct}%**, topsoil **${topPct}%**, rainfall **${rain} mm**${vpd !== undefined ? `, drying demand **${vpd} hPa**` : ''}.`,
        graceNoteEn,
        tooWet
          ? `- **Watering adjustment:** **POSTPONE IRRIGATION** and clear field drainage furrows immediately. On **${soilLabel}** (${drainageLabel}), saturated roots lose oxygen and invite root rot.`
          : shouldWater
          ? `- **Watering adjustment:** **APPLY LIGHT IRRIGATION** between **05:30–07:30 AM** or after **04:30 PM**. Because **${soilLabel}** has **${drainageLabel}**, split into 2 short passes rather than flooding at once.`
          : `- **Watering adjustment:** **HOLD IRRIGATION TODAY** — root moisture (**${rootPct}%**) is within the healthy window. Hand-check 5–10 cm depth tomorrow morning.`,
        `- **Fertilizer & soil care:** ${tooWet ? 'Delay Urea/NK top-dressing until standing water drains to prevent runoff.' : 'Pair light organic compost or straw mulching around beds to cut surface evaporation by 30–35%.'}`,
        `- **Disease prevention:** ${cropSpecificPestTipEn}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    return [
      `### Kế hoạch Tưới nước & Chăm sóc Đất cho "${fieldName}" (${cropName} — ${familyLabel})`,
      `- **Hiện trạng ẩm độ:** Ẩm vùng rễ **${rootPct}%**, tầng mặt **${topPct}%**, lượng mưa **${rain} mm**${vpd !== undefined ? `, sức hút bốc hơi **${vpd} hPa**` : ''}.`,
      graceNoteVi,
      tooWet
        ? `- **Điều chỉnh tưới & tiêu úng:** **TẠM HOÃN TƯỚI** và khơi thông ngay rãnh thoát nước quanh bờ. Trên **${soilLabel}** (${drainageLabel}), đất dư ẩm kéo dài gây bí rễ và kích hoạt nấm thối cổ rễ.`
        : shouldWater
        ? `- **Điều chỉnh tưới:** **NÊN TƯỚI BỔ SUNG NHẸ** vào khung **05:30–07:30 sáng** hoặc sau **16:30 chiều**. Do **${soilLabel}** có đặc tính **${drainageLabel}**, hãy chia làm 2 lần tưới ngắn để ngấm đều vùng rễ.`
        : `- **Điều chỉnh tưới:** **CHƯA CẦN TƯỚI THÊM HÔM NAY** vì độ ẩm rễ (**${rootPct}%**) đang cân bằng cho giai đoạn **${stageName}**. Bóp nắm đất sâu 5–10 cm vào sáng mai để quyết định.`,
      `- **Bón phân & giữ đất:** ${tooWet ? 'Hoãn bón thúc đạm/kali cho đến khi mặt luống ráo nước để tránh rửa trôi.' : 'Tủ gốc bằng rơm rạ hoặc phân hữu cơ hoai mục giúp giảm 30–35% bốc hơi nước và giữ tơi xốp đất mặt.'}`,
      `- **Phòng sâu bệnh kèm theo:** ${cropSpecificPestTipVi}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (
    q.includes('nấm') ||
    q.includes('bệnh') ||
    q.includes('sâu') ||
    q.includes('nhiệt độ') ||
    q.includes('pest') ||
    q.includes('fung') ||
    q.includes('disease')
  ) {
    const highFungalRisk = humidity >= 83 || (temp <= 22 && humidity >= 80);
    if (isEn) {
      return [
        `### Pest & Disease Prevention for "${fieldName}" (${cropName} — ${familyLabel})`,
        `- **Microclimate risk:** Temp **${temp}°C**, air humidity **${humidity}%**, rain **${rain} mm**.`,
        highFungalRisk
          ? `- **Alert (Moderate–High risk):** Humidity above **83%** keeps leaf surfaces wet, accelerating fungal spores. Prune old lower leaves for airflow and switch to morning-only root watering.`
          : `- **Alert (Low–Moderate risk):** Humidity **${humidity}%** is relatively balanced. Scout leaf undersides every **2–3 days**.`,
        `- **Crop-specific guidance:** ${cropSpecificPestTipEn}`,
        `- **Fertilizer & soil adjustment:** **Cut excess nitrogen (Urea)** during humid spells because soft, lush foliage attracts sap-sucking insects and fungal infection; supplement Potassium & Calcium instead to thicken cell walls.`,
      ].join('\n');
    }
    return [
      `### Phòng trừ Sâu bệnh & Điều chỉnh Canh tác tại "${fieldName}" (${cropName} — ${familyLabel})`,
      `- **Điều kiện vi khí hậu:** Nhiệt độ **${temp}°C**, độ ẩm không khí **${humidity}%**, mưa **${rain} mm**.`,
      highFungalRisk
        ? `- **Mức cảnh báo Trung bình–Cao:** Độ ẩm trên **83%** giữ sương ẩm lâu trên lá, tạo điều kiện cho nấm bệnh nảy mầm. Hãy tỉa bớt lá già sát gốc cho thoáng gió và **chỉ tưới vào gốc buổi sáng**, tuyệt đối không phun ướt lá buổi chiều tối.`
        : `- **Mức cảnh báo Thấp–Trung bình:** Không khí khá thông thoáng (**${humidity}%**). Duy trì thăm đồng **2–3 ngày/lần** và theo dõi bẫy dính/mặt dưới lá.`,
      `- **Trọng tâm theo họ cây:** ${cropSpecificPestTipVi}`,
      `- **Điều chỉnh phân bón & đất:** **Giảm đạm Urê** trong ngày âm u ẩm cao để tránh cây non vống mềm dễ nhiễm bệnh; tăng cường **Kali, Canxi-Bo hoặc nấm đối kháng Trichoderma** vùng rễ để tăng sức đề kháng.`,
    ].join('\n');
  }

  if (
    q.includes('bón') ||
    q.includes('phân') ||
    q.includes('đạm') ||
    q.includes('kali') ||
    q.includes('fertiliz') ||
    q.includes('carbon') ||
    q.includes('phát thải') ||
    q.includes('emission')
  ) {
    const badForFert = rain > 12 || topPct > 85 || temp >= 35;
    if (isEn) {
      return [
        `### Fertilizer Timing & Soil Nutrition for "${fieldName}" (${cropName} — ${stageName})`,
        ghg
          ? `- **Emissions balance:** Estimated **${ghg.co2eqTonHa} t CO₂e/ha**. Splitting nitrogen applications prevents N₂O loss and fertilizer waste.`
          : '',
        oco2
          ? `- **Canopy vigor:** Photosynthesis index **${oco2.sifWm2SrUm}** (**${oco2.carbonUptakeTonHaYr} t CO₂/ha**).`
          : '',
        badForFert
          ? `- **Timing decision: POSTPONE FERTILIZER TODAY** — heavy rain (**${rain} mm**), saturated topsoil (**${topPct}%**), or extreme heat (**${temp}°C**) causes severe leaching or leaf burn.`
          : `- **Timing decision: SAFE TO TOP-DRESS** between **06:00–08:30 AM** or **04:00–05:30 PM** while root moisture is **${rootPct}%**.`,
        `- **Practical dosage & care:** Split fertilizer into **2–3 smaller rounds** on **${soilLabel}** (${drainageLabel}), prioritize **decomposed organic compost + balanced NPK** matched to **${stageName}**, and lightly water after dry broadcasting so granules dissolve into the root zone.`,
        `- **Next-season rotation care:** After **${familyLabel}**, rotate to a completely different botanical family (e.g., ${botanical.botanicalFamily === 'Fabaceae' ? 'Poaceae such as Maize/Rice' : 'Fabaceae such as Mungbean/Soybean/Peanut'}) to restore soil nutrients naturally.`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    return [
      `### Thời điểm Bón phân & Dinh dưỡng Đất cho "${fieldName}" (${cropName} — ${stageName})`,
      ghg
        ? `- **Cân bằng dinh dưỡng & phát thải:** Phát thải ước tính **${ghg.co2eqTonHa} tấn CO₂e/ha**. Chia nhỏ lần bón đạm giúp giảm thất thoát khí N₂O và tiết kiệm 15–25% chi phí phân.`
        : '',
      oco2
        ? `- **Sức khỏe quang hợp tán lá:** Chỉ số **${oco2.sifWm2SrUm}** (hấp thụ **${oco2.carbonUptakeTonHaYr} tấn CO₂/ha**).`
        : '',
      badForFert
        ? `- **Quyết định thời điểm: TẠM HOÃN BÓN PHÂN HÔM NAY** vì mưa lớn (**${rain} mm**), đất tầng mặt quá bão hòa (**${topPct}%**) hoặc nắng nóng gắt (**${temp}°C**) dễ gây rửa trôi và cháy rễ/lá.`
        : `- **Quyết định thời điểm: CÓ THỂ BÓN THÚC NHẸ** vào **sáng sớm (06:00–08:30)** hoặc **chiều mát (16:00–17:30)** khi độ ẩm rễ đang đạt **${rootPct}%**.`,
      `- **Cách bón hiệu quả trên ${soilLabel}:** Chia nhỏ lượng phân thành **2–3 đợt** thay vì bón dồn 1 lần (${drainage === 'fast' ? 'đất thoát nhanh rất dễ trôi đạm' : 'tránh sốc phân vùng rễ'}); ưu tiên **hữu cơ hoai mục + NPK cân đối theo giai đoạn ${stageName}** và tưới xả nhẹ ngay sau khi rải hạt khô.`,
      `- **Luân canh giữ độ phì:** Sau vụ **${cropName} (${familyLabel})**, nên đổi sang họ khác (${botanical.botanicalFamily === 'Fabaceae' ? 'Họ Hòa thảo như Ngô/Lúa để tận dụng đạm dư' : 'Họ Đậu như Đậu xanh/Lạc/Đậu tương để bổ sung đạm sinh học'}).`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (
    q.includes('25 năm') ||
    q.includes('21 năm') ||
    q.includes('rét') ||
    q.includes('hạn') ||
    q.includes('lịch sử') ||
    q.includes('khí hậu') ||
    q.includes('climate') ||
    q.includes('25-year') ||
    q.includes('21-year') ||
    q.includes('drought')
  ) {
    const diff = (temp - histAvgTemp).toFixed(1);
    if (isEn) {
      return [
        `### 25-Year Climate Baseline (2001–2025) & Action Plan for "${fieldName}"`,
        `- **Climate comparison:** Historical mean **${histAvgTemp}°C** vs current **${temp}°C** (**${Number(diff) >= 0 ? `+${diff}` : diff}°C**); regional seasonal rain **${histAvgRain} mm/month**.`,
        graceNoteEn,
        `- **Water & soil protection:** ${temp < 19 ? 'Keep thin water buffer or mulch crop bases with dry straw to protect roots from cold snaps.' : rootPct < 45 ? 'Apply straw mulch and shift irrigation to early morning to buffer dry spells.' : 'Maintain raised drainage beds so sudden storms do not waterlog roots.'}`,
        `- **Pest & rotation strategy:** Rotate **${cropName} (${familyLabel})** with a non-host family next season to break soil-borne pathogens favored by multi-year climate swings.`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    return [
      `### Đối chiếu Khí hậu 25 năm (2001–2025) & Hành động cho "${fieldName}"`,
      `- **So sánh nền 25 năm:** Nhiệt độ trung bình lịch sử cùng kỳ **${histAvgTemp}°C**, hiện tại **${temp}°C** (**${Number(diff) >= 0 ? `+${diff}` : diff}°C**); lượng mưa nền khoảng **${histAvgRain} mm/tháng**.`,
      graceNoteVi,
      `- **Điều chỉnh tưới & giữ đất:** ${temp < 19 ? 'Giữ mực nước nông (với lúa) hoặc tủ gốc bằng rơm rạ/màng phủ (với rau màu, bầu bí) để giữ ấm bộ rễ.' : rootPct < 45 ? 'Giai đoạn này dễ hụt ẩm; nên tủ rơm giữ ẩm, tưới tiết kiệm sáng sớm và hạn chế xới đất sâu làm mất nước.' : 'Duy trì rãnh thoát nước đầu bờ đề phòng mưa giông cục bộ làm úng rễ.'}`,
      `- **Phòng bệnh & luân canh:** Kết thúc vụ **${cropName} (${familyLabel})**, chuyển sang họ thực vật khác để cắt chu kỳ sâu bệnh và ổn định năng suất bền vững.`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (isEn) {
    return [
      `### Comprehensive Field Advisory: "${fieldName}" (${cropName} — ${stageName})`,
      `- **Current conditions:** Temp **${temp}°C**, Rain **${rain} mm**, Air humidity **${humidity}%**, Root moisture **${rootPct}%**, Soil **${soilLabel}** (${drainageLabel}), Botanical family **${familyLabel}**.`,
      graceNoteEn,
      `- **Watering timing:** ${rootPct > 78 ? 'Hold irrigation and clear drainage ditches.' : rootPct < 42 ? 'Irrigate lightly in early morning (05:30–07:30) or late afternoon.' : 'Moisture is balanced; check 5–10 cm root soil before next watering.'}`,
      `- **Fertilizer & soil care:** Split N/K top-dressing into small doses on calm, dry mornings (06:00–08:30); mulch exposed topsoil with straw or compost.`,
      `- **Pest prevention:** ${cropSpecificPestTipEn}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `### Tư vấn Canh tác Toàn diện cho "${fieldName}" (${cropName} — ${stageName})`,
    `- **Thông số ruộng & thời tiết:** Nhiệt độ **${temp}°C**, mưa **${rain} mm**, ẩm không khí **${humidity}%**, ẩm vùng rễ **${rootPct}%**, **${soilLabel}** (${drainageLabel}), phân loại **${familyLabel}**.`,
    graceNoteVi,
    `- **Điều chỉnh tưới & thoát nước:** ${rootPct > 78 ? '**Tạm hoãn tưới**, khơi thông rãnh tiêu úng để rễ hô hấp tốt.' : rootPct < 42 ? '**Tưới bổ sung nhẹ** vào sáng sớm (05:30–07:30) hoặc chiều mát, tránh tưới giữa trưa nắng.' : 'Độ ẩm đất đang cân bằng — kiểm tra tầng 5–10 cm vào sáng mai trước khi quyết định tưới.'}`,
    `- **Thời điểm bón phân & chăm sóc đất:** Chỉ bón thúc khi trời ráo lúc **06:00–08:30 hoặc sau 16:00**, chia nhỏ liều lượng để tránh rửa trôi; kết hợp tủ rơm hoặc hữu cơ hoai mục giữ ẩm và nuôi vi sinh vật đất.`,
    `- **Phòng trừ sâu bệnh:** ${cropSpecificPestTipVi}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export const GeminiService = {
  async getFieldAdvice(
    field: FieldProfile,
    weather: WeatherObservation,
    _ruleAnalysis: any,
    feedbackHistory: FeedbackRecord[],
    language: AppLanguage = 'vi'
  ): Promise<AdvisorApiResponse> {
    const brief = analyzeFieldAgronomy(field, weather, feedbackHistory, language);
    return {
      success: true,
      fallback: false,
      advice: {
        headline: brief.headline,
        situationSummary: brief.situation,
        topActions: brief.topActions.map((a) => ({
          title: a.title,
          priority: a.priority,
          reason: a.reason,
          dataBasis: a.dataBasis,
        })),
        postponeActions: brief.postponeActions,
        agronomicExplanation: brief.explanation,
        uncertainties: brief.uncertainties,
        nextCheckTime: brief.nextCheckTime,
      },
    };
  },

  async rethinkRotationStrategy(params: {
    field: FieldProfile;
    weather: WeatherObservation;
    rejectedStrategy: RotationStrategy;
    rejectionReason: string;
    excludedIds: string[];
    previouslyRejectedTitles: string[];
    priorities: FarmerPriorityId[];
    constraints: FarmerConstraints;
    language?: AppLanguage;
  }): Promise<{ strategy: RotationStrategy; source: 'gemini' | 'rule_engine' }> {
    const lang = params.language || 'vi';
    const nextIds = [...params.excludedIds, params.rejectedStrategy.id];
    const fallbackStrategy = pickBestRotationStrategy(
      params.field,
      params.weather,
      params.priorities,
      params.constraints,
      nextIds,
      params.rejectionReason,
      lang
    );
    return { strategy: fallbackStrategy, source: 'rule_engine' };
  },

  async sendChatMessage(
    message: string,
    field: FieldProfile,
    _conversationHistory: Array<{ role: 'user' | 'model'; parts: string }>,
    weather?: WeatherObservation,
    language: AppLanguage = 'vi'
  ): Promise<{ reply: string; isError?: boolean; fromFallback?: boolean }> {
    const earth = field.adaptiveMemory?.earthMetrics;
    const promptText =
      message.trim() ||
      (language === 'en'
        ? 'Hello, what should I check on my field today?'
        : 'Xin chào, ruộng của tôi hôm nay cần chú ý gì?');

    return {
      reply: buildLocalAgronomyReply(promptText, field, weather, earth, language),
      isError: false,
      fromFallback: false,
    };
  },
};
