import { GoogleGenAI } from '@google/genai';
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
import { analyzeFieldAgronomy } from './agronomyEngine';
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

function getOptionalClientAi(): GoogleGenAI | null {
  const key = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  if (!key) return null;
  try {
    return new GoogleGenAI({ apiKey: key });
  } catch {
    return null;
  }
}

function extractGeminiText(response: any): string {
  if (typeof response?.text === 'string' && response.text.trim()) {
    return response.text.trim();
  }
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts
      .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .join('')
      .trim();
    if (joined) return joined;
  }
  return '';
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
  const soilLabel = String(field?.soilType || 'loam');
  const drainage = field?.soilCharacteristics?.drainage || 'moderate';
  const temp = Number(weather?.temp ?? 26);
  const humidity = Number(weather?.humidity ?? 80);
  const rain = Number(weather?.rain ?? 0);
  const rootPct = Math.round(Number(weather?.gwetroot ?? 0.6) * 100);
  const topPct = Math.round(Number(weather?.gwettop ?? 0.55) * 100);
  const histAvgTemp = Number(weather?.historicalBaseline?.avgTemp ?? 26);
  const histAvgRain = Number(weather?.historicalBaseline?.avgRain ?? 120);

  const grace = earthMetrics?.groundwaterAnomalyGrace;
  const oco2 = earthMetrics?.carbonFluxOco2;
  const ghg = earthMetrics?.greenhouseGasEdgar;

  const graceNoteVi = grace
    ? `• Nước ngầm (GRACE): **${grace.lweThicknessCm >= 0 ? '+' : ''}${grace.lweThicknessCm} cm LWE** (${grace.groundwaterStatus === 'depleting' ? 'đang suy giảm, cần tiết kiệm nước' : grace.groundwaterStatus === 'recharging' ? 'đang phục hồi tốt' : 'ổn định'}).`
    : '';
  const graceNoteEn = grace
    ? `• Groundwater (GRACE): **${grace.lweThicknessCm >= 0 ? '+' : ''}${grace.lweThicknessCm} cm LWE** (${grace.groundwaterStatus}).`
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
        `• **Irrigation assessment for "${fieldName}" (${cropName} — ${stageName}):**`,
        `• Root-zone moisture: **${rootPct}%** (surface **${topPct}%**), rainfall **${rain} mm**.`,
        graceNoteEn,
        tooWet
          ? `• **Recommendation: POSTPONE IRRIGATION** and clear drainage furrows because root zone is already saturated (${rootPct}%).`
          : shouldWater
          ? `• **Recommendation: APPLY LIGHT IRRIGATION** early morning or late afternoon (${soilLabel}, ${drainage} drainage).`
          : `• **Recommendation: HOLD IRRIGATION**, monitor top 0–5 cm soil tomorrow morning.`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    return [
      `• **Đánh giá tưới cho "${fieldName}" (${cropName} — ${stageName}):**`,
      `• Độ ẩm vùng rễ hiện khoảng **${rootPct}%** (tầng mặt **${topPct}%**), lượng mưa ghi nhận **${rain} mm**.`,
      graceNoteVi,
      tooWet
        ? `• **Khuyến nghị: TẠM HOÃN TƯỚI** và ưu tiên khơi thông rãnh thoát nước, vì vùng rễ đã đủ/dư ẩm (${rootPct}%), nhất là khi đất thoát nước ${drainage === 'slow' ? 'chậm (dễ bí rễ)' : 'vừa'}.`
        : shouldWater
        ? `• **Khuyến nghị: NÊN TƯỚI BỔ SUNG NHẸ** vào sáng sớm hoặc chiều mát (đất ${soilLabel} thoát ${drainage === 'fast' ? 'nhanh, chia 2 lần tưới ngắn' : 'vừa phải'}).`
        : `• **Khuyến nghị: CHƯA CẦN TƯỚI THÊM**, giữ ẩm hiện tại và kiểm tra lại đất tầng 0–5 cm vào sáng mai.`,
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
        `• **Pest & disease risk at "${fieldName}" (${cropName}):**`,
        `• Temperature **${temp}°C**, air humidity **${humidity}%**, rain **${rain} mm**.`,
        highFungalRisk
          ? `• **Alert: Moderate–High risk** — Humidity >83% favors leaf wetness and fungal pressure. Inspect lower leaves early morning and avoid excess nitrogen.`
          : `• **Risk level: Low–Moderate** — Air circulation is favorable (${humidity}%). Scout fields every 2–3 days.`,
      ].join('\n');
    }
    return [
      `• **Đánh giá nguy cơ sâu bệnh tại "${fieldName}" (${cropName}):**`,
      `• Hiện tại nhiệt độ **${temp}°C**, độ ẩm không khí **${humidity}%**, mưa **${rain} mm**.`,
      highFungalRisk
        ? `• **Cảnh báo mức Trung bình–Cao:** Độ ẩm không khí trên **83%** tạo màng sương ẩm trên lá, dễ phát sinh nấm hại (đạo ôn/khô vằn trên lúa, sương mai/thán thư trên rau màu). Nên kiểm tra mặt dưới lá vào sáng sớm và tỉa lá già cho thoáng gốc.`
        : `• **Mức độ hiện tại Thấp–Trung bình:** Không khí tương đối thông thoáng (${humidity}%). Duy trì thăm đồng 2–3 ngày/lần và tránh bón thừa đạm vào ngày âm u.`,
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
        `• **Nutrient & emissions guidance for "${fieldName}" (${cropName} — ${stageName}):**`,
        ghg
          ? `• **GHGx/EDGAR:** Estimated **${ghg.co2eqTonHa} t CO₂e/ha** (CH₄ ${ghg.ch4KgHa} kg/ha, N₂O ${ghg.n2oKgHa} kg/ha). Split nitrogen applications or rotate legumes to reduce N₂O leaching.`
          : '',
        oco2
          ? `• **OCO-2 SIF:** Photosynthesis index **${oco2.sifWm2SrUm}** (${oco2.carbonUptakeTonHaYr} t CO₂/ha uptake).`
          : '',
        badForFert
          ? `• **Postpone fertilizer today** due to rain (${rain} mm) or saturated surface soil (${topPct}%).`
          : `• **Safe window:** Apply split top-dressing early morning (06:00–08:30) or late afternoon while root moisture is **${rootPct}%**.`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    return [
      `• **Thời điểm bón phân & cân bằng phát thải cho "${fieldName}" (${cropName} — giai đoạn ${stageName}):**`,
      ghg
        ? `• **GHGx/EDGAR:** Phát thải ước tính **${ghg.co2eqTonHa} tấn CO₂e/ha** (CH₄ ${ghg.ch4KgHa} kg/ha, N₂O ${ghg.n2oKgHa} kg/ha). Tránh bón dư đạm vô cơ để giảm thất thoát N₂O.`
        : '',
      oco2
        ? `• **NASA OCO-2:** Chỉ số quang hợp SIF **${oco2.sifWm2SrUm}** (hấp thụ **${oco2.carbonUptakeTonHaYr} tấn CO₂/ha**).`
        : '',
      badForFert
        ? `• **Chưa nên bón ngay hôm nay** vì mưa (${rain} mm) hoặc đất tầng mặt quá bão hòa (${topPct}%) dễ rửa trôi phân bón và tăng phát thải N₂O.`
        : `• **Có thể bón thúc nhẹ vào sáng sớm (06:00–08:30) hoặc chiều mát (sau 16:00)** khi trời không mưa to, độ ẩm rễ đang ở mức **${rootPct}%**.`,
      `• Chia nhỏ lượng phân (đặc biệt với đất thoát nhanh), ưu tiên kết hợp phân hữu cơ hoai mục hoặc luân canh họ Đậu.`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (
    q.includes('21 năm') ||
    q.includes('rét') ||
    q.includes('hạn') ||
    q.includes('lịch sử') ||
    q.includes('khí hậu') ||
    q.includes('climate') ||
    q.includes('21-year') ||
    q.includes('drought')
  ) {
    const diff = (temp - histAvgTemp).toFixed(1);
    if (isEn) {
      return [
        `• **21-year NASA POWER baseline (2005–2025) for "${fieldName}":**`,
        `• Historical avg temp: **${histAvgTemp}°C**, current: **${temp}°C** (${Number(diff) >= 0 ? `+${diff}` : diff}°C anomaly); baseline rainfall **${histAvgRain} mm/month**.`,
        graceNoteEn,
      ]
        .filter(Boolean)
        .join('\n');
    }
    return [
      `• **Đối chiếu chuỗi khí hậu NASA 21 năm (2005–2025) tại khu vực "${fieldName}":**`,
      `• Nhiệt độ trung bình lịch sử cùng kỳ là **${histAvgTemp}°C**, hiện tại **${temp}°C** (${Number(diff) >= 0 ? `+${diff}` : diff}°C so với nền 21 năm); lượng mưa nền khoảng **${histAvgRain} mm/tháng**.`,
      graceNoteVi,
      temp < 19
        ? `• Vùng này có nguy cơ gặp **đợt rét đậm/lạnh ẩm**, cần giữ mực nước nông (với lúa) hoặc tủ gốc hữu cơ cho rau màu.`
        : rootPct < 45
        ? `• Giai đoạn này dễ hụt ẩm nhẹ nếu mưa xuống muộn; nên áp dụng che phủ rơm rạ/tưới tiết kiệm và cân nhắc luân canh cây họ Đậu sau vụ này.`
        : `• Nhiệt độ và độ ẩm đang nằm gần ngưỡng trung bình nhiều năm; tiếp tục theo dõi mưa/nắng theo từng tuần.`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (isEn) {
    return [
      `• **Field summary for "${fieldName}" (${cropName} — ${stageName}):**`,
      `• Conditions: Temp **${temp}°C**, Rain **${rain} mm**, Humidity **${humidity}%**, Root moisture **${rootPct}%**.`,
      graceNoteEn,
      oco2
        ? `• OCO-2 Carbon uptake: **${oco2.carbonUptakeTonHaYr} t CO₂/ha** (SIF ${oco2.sifWm2SrUm}).`
        : '',
      ghg ? `• GHGx/EDGAR Emissions: **${ghg.co2eqTonHa} t CO₂e/ha**.` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `• **Tư vấn nhanh cho "${fieldName}" (${cropName} — ${stageName}):**`,
    `• Thông số hiện tại: Nhiệt độ **${temp}°C**, mưa **${rain} mm**, ẩm không khí **${humidity}%**, ẩm vùng rễ **${rootPct}%**.`,
    graceNoteVi,
    oco2
      ? `• OCO-2 hấp thụ Carbon: **${oco2.carbonUptakeTonHaYr} tấn CO₂/ha** (SIF ${oco2.sifWm2SrUm}).`
      : '',
    ghg ? `• GHGx/EDGAR phát thải: **${ghg.co2eqTonHa} tấn CO₂e/ha**.` : '',
    `• ${rootPct > 78 ? 'Đất đang khá ẩm, ưu tiên thoát nước đầu bờ và tạm hoãn tưới.' : rootPct < 42 ? 'Đất hơi khô, kiểm tra độ ẩm 0–5 cm để tưới bổ sung vào chiều mát.' : 'Độ ẩm đất tương đối cân bằng, duy trì chăm sóc và theo dõi mặt dưới lá.'}`,
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
    conversationHistory: Array<{ role: 'user' | 'model'; parts: string }>,
    weather?: WeatherObservation,
    language: AppLanguage = 'vi'
  ): Promise<{ reply: string; isError?: boolean; fromFallback?: boolean }> {
    const earth = field.adaptiveMemory?.earthMetrics;
    const promptText =
      message.trim() ||
      (language === 'en'
        ? 'Hello, what should I check on my field today?'
        : 'Xin chào, ruộng của tôi hôm nay cần chú ý gì?');

    const ai = getOptionalClientAi();
    if (ai) {
      try {
        const isEn = language === 'en';
        const earthSummary = earth
          ? `\n- OCO-2 Carbon: ${earth.carbonFluxOco2?.carbonUptakeTonHaYr} t CO2/ha\n- GRACE Groundwater: ${earth.groundwaterAnomalyGrace?.lweThicknessCm} cm LWE\n- GHGx Emissions: ${earth.greenhouseGasEdgar?.co2eqTonHa} t CO2e/ha`
          : '';
        const systemPrompt = `You are CropCast, an expert agronomic assistant. Reply concisely in ${isEn ? 'English' : 'Vietnamese'} with bullet points.\nField: ${field.name} (${field.province}), Crop: ${field.crop.name} (${field.crop.currentStage}), Soil: ${field.soilType}.\nWeather: ${weather?.temp ?? '--'}°C, Rain ${weather?.rain ?? '--'} mm, Humidity ${weather?.humidity ?? '--'}%, Root moisture ${weather ? Math.round(weather.gwetroot * 100) : '--'}%.${earthSummary}`;
        const historyText = conversationHistory
          .slice(-4)
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.parts}`)
          .join('\n');
        const res = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: historyText ? `${historyText}\nUser: ${promptText}` : promptText,
          config: { systemInstruction: systemPrompt },
        });
        const text = extractGeminiText(res);
        if (text) {
          return { reply: text, isError: false, fromFallback: false };
        }
      } catch {
        // fall through cleanly to deterministic agronomy engine
      }
    }

    return {
      reply: buildLocalAgronomyReply(promptText, field, weather, earth, language),
      isError: false,
      fromFallback: true,
    };
  },
};
