import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

// Load Firebase client config to verify admin ID tokens server-side
let firebaseApiKey = '';
let firebaseProjectId = '';
let firestoreDatabaseId = '(default)';
try {
  const fbConfigPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(fbConfigPath)) {
    const fbJson = JSON.parse(fs.readFileSync(fbConfigPath, 'utf-8'));
    firebaseApiKey = fbJson.apiKey || '';
    firebaseProjectId = fbJson.projectId || '';
    firestoreDatabaseId = fbJson.firestoreDatabaseId || '(default)';
  }
} catch {
  firebaseApiKey = '';
}
const ADMIN_EMAIL = 'fss01211cg@gmail.com';

async function requireAdminMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token || !firebaseApiKey) {
      return res.status(401).json({ error: 'Yêu cầu đăng nhập tài khoản Quản trị viên.' });
    }
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!verifyRes.ok) {
      return res.status(401).json({ error: 'Phiên đăng nhập quản trị không hợp lệ.' });
    }
    const verifyJson = (await verifyRes.json()) as {
      users?: Array<{ email?: string; emailVerified?: boolean; localId?: string }>;
    };
    const matchedUser = verifyJson.users?.[0];
    if (!matchedUser || !matchedUser.emailVerified) {
      return res.status(403).json({ error: 'Tài khoản quản trị cần được xác thực email.' });
    }

    const isBootstrapAdmin =
      matchedUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (isBootstrapAdmin) {
      return next();
    }

    // Check if user was promoted to Admin in Firestore /admins/{uid}
    if (firebaseProjectId && matchedUser.localId) {
      const adminDocUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firestoreDatabaseId}/documents/admins/${matchedUser.localId}`;
      const adminDocRes = await fetch(adminDocUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (adminDocRes.ok) {
        return next();
      }
    }

    return res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền truy cập chức năng này.' });
  } catch {
    return res.status(401).json({ error: 'Không thể xác thực quyền quản trị.' });
  }
}

// Initialize GoogleGenAI server-side dynamically with telemetry header
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isRateLimitError(err: any): boolean {
  const status = err?.status || err?.code;
  const msg = String(err?.message || '').toLowerCase();
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit')
  );
}

async function withGeminiFallback<T>(
  primaryFn: () => Promise<T>,
  liteFn: () => Promise<T>
): Promise<{ result: T; modelUsed: string }> {
  try {
    const result = await primaryFn();
    return { result, modelUsed: 'gemini-4-hydrogen' };
  } catch (err: any) {
    const status = err?.status || err?.code;
    const msg = String(err?.message || '').toLowerCase();
    const isAuthOrBadKey =
      status === 400 ||
      status === 401 ||
      status === 403 ||
      msg.includes('api_key_invalid') ||
      msg.includes('permission_denied');
    if (isAuthOrBadKey) {
      throw err;
    }
    // Fall back ONCE to lighter/faster model on 429 or transient error (never hammer same endpoint)
    const result = await liteFn();
    return { result, modelUsed: 'gemini-3.1-flash-lite' };
  }
}

const chatResponseCache = new Map<string, { reply: string; expiresAt: number }>();

function buildLocalAgronomyReply(
  userMessage: string,
  field: any,
  weather: any,
  earthMetrics?: any,
  language: 'vi' | 'en' = 'vi'
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

  if (q.includes('tưới') || q.includes('đất') || q.includes('ẩm') || q.includes('nước') || q.includes('irrigat') || q.includes('water') || q.includes('soil')) {
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
      ].filter(Boolean).join('\n');
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
    ].filter(Boolean).join('\n');
  }

  if (q.includes('nấm') || q.includes('bệnh') || q.includes('sâu') || q.includes('nhiệt độ') || q.includes('pest') || q.includes('fung') || q.includes('disease')) {
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

  if (q.includes('bón') || q.includes('phân') || q.includes('đạm') || q.includes('kali') || q.includes('fertiliz') || q.includes('carbon') || q.includes('phát thải') || q.includes('emission')) {
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
      ].filter(Boolean).join('\n');
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
    ].filter(Boolean).join('\n');
  }

  if (q.includes('21 năm') || q.includes('rét') || q.includes('hạn') || q.includes('lịch sử') || q.includes('khí hậu') || q.includes('climate') || q.includes('21-year') || q.includes('drought')) {
    const diff = (temp - histAvgTemp).toFixed(1);
    if (isEn) {
      return [
        `• **21-year NASA POWER baseline (2005–2025) for "${fieldName}":**`,
        `• Historical avg temp: **${histAvgTemp}°C**, current: **${temp}°C** (${Number(diff) >= 0 ? `+${diff}` : diff}°C anomaly); baseline rainfall **${histAvgRain} mm/month**.`,
        graceNoteEn,
      ].filter(Boolean).join('\n');
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
    ].filter(Boolean).join('\n');
  }

  if (isEn) {
    return [
      `• **Field summary for "${fieldName}" (${cropName} — ${stageName}):**`,
      `• Conditions: Temp **${temp}°C**, Rain **${rain} mm**, Humidity **${humidity}%**, Root moisture **${rootPct}%**.`,
      graceNoteEn,
      oco2 ? `• OCO-2 Carbon uptake: **${oco2.carbonUptakeTonHaYr} t CO₂/ha** (SIF ${oco2.sifWm2SrUm}).` : '',
      ghg ? `• GHGx/EDGAR Emissions: **${ghg.co2eqTonHa} t CO₂e/ha**.` : '',
    ].filter(Boolean).join('\n');
  }

  return [
    `• **Tư vấn nhanh cho "${fieldName}" (${cropName} — ${stageName}):**`,
    `• Thông số hiện tại: Nhiệt độ **${temp}°C**, mưa **${rain} mm**, ẩm không khí **${humidity}%**, ẩm vùng rễ **${rootPct}%**.`,
    graceNoteVi,
    oco2 ? `• OCO-2 hấp thụ Carbon: **${oco2.carbonUptakeTonHaYr} tấn CO₂/ha** (SIF ${oco2.sifWm2SrUm}).` : '',
    ghg ? `• GHGx/EDGAR phát thải: **${ghg.co2eqTonHa} tấn CO₂e/ha**.` : '',
    `• ${rootPct > 78 ? 'Đất đang khá ẩm, ưu tiên thoát nước đầu bờ và tạm hoãn tưới.' : rootPct < 42 ? 'Đất hơi khô, kiểm tra độ ẩm 0–5 cm để tưới bổ sung vào chiều mát.' : 'Độ ẩm đất tương đối cân bằng, duy trì chăm sóc và theo dõi mặt dưới lá.'}`,
  ].filter(Boolean).join('\n');
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

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    geminiConfigured: !!process.env.GEMINI_API_KEY?.trim(),
    timestamp: new Date().toISOString(),
    service: 'CropCast Full-Stack Server',
  });
});

// NASA POWER indicators metadata
app.get('/api/nasa/indicators', (_req: Request, res: Response) => {
  const indicators = [
    { code: 'T2M', name: 'Nhiệt độ trung bình 2m', unit: '°C', desc: 'Đánh giá điều kiện nhiệt độ chung' },
    { code: 'T2M_MIN', name: 'Nhiệt độ tối thiểu', unit: '°C', desc: 'Cảnh báo rét, sương giá, rét hại' },
    { code: 'T2M_MAX', name: 'Nhiệt độ tối đa', unit: '°C', desc: 'Cảnh báo sốc nhiệt, cháy lá, stress nhiệt' },
    { code: 'PRECTOTCORR', name: 'Lượng mưa hiệu chỉnh', unit: 'mm/ngày', desc: 'Đánh giá lượng nước mưa tự nhiên và nhu cầu tưới bổ sung' },
    { code: 'GWETTOP', name: 'Độ ẩm đất tầng mặt', unit: '0-1 (tỷ lệ)', desc: 'Phân tích điều kiện ẩm tầng 0-5cm hạt giống và rễ non' },
    { code: 'GWETROOT', name: 'Độ ẩm đất vùng rễ', unit: '0-1 (tỷ lệ)', desc: 'Trạng thái ẩm vùng rễ cây trồng sâu 0-100cm' },
    { code: 'RH2M', name: 'Độ ẩm tương đối không khí', unit: '%', desc: 'Đánh giá môi trường ẩm, điều kiện phát sinh nấm bệnh' },
    { code: 'ALLSKY_SFC_SW_DWN', name: 'Bức xạ mặt trời bề mặt', unit: 'MJ/m²/ngày', desc: 'Năng lượng quang hợp và bốc thoát hơi nước tiềm năng' },
  ];
  res.json({ indicators, period: '2005-2025 (21 năm)', resolution: '0.5° x 0.5°' });
});

// Gemini AI Advisor endpoint
app.post('/api/gemini/advisor', async (req: Request, res: Response) => {
  try {
    const { field, weather, ruleAnalysis, feedbackHistory, earthMetrics, language } = req.body;
    const isEn = language === 'en';
    const earth = earthMetrics || field?.adaptiveMemory?.earthMetrics;

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(200).json({
        success: false,
        fallback: true,
        message: isEn
          ? 'Gemini API key not configured. Using local agronomic engine.'
          : 'Khóa API Gemini chưa được cấu hình. Hệ thống sử dụng Bộ quy tắc nông học chuyên gia để phân tích cục bộ.',
        advice: null,
      });
    }

    const cropName = field?.crop?.name || field?.cropName || 'Crop';
    const variety = field?.crop?.variety || field?.variety || 'Standard';
    const stageName = field?.crop?.currentStage || field?.stageName || 'Growing';
    const waterSrc = typeof field?.waterSource === 'string' ? field.waterSource : field?.waterSource?.type || 'River/pond';
    const waterNotes = field?.waterSource?.notes || field?.waterNotes || 'Normal';

    const earthSection = earth
      ? `
Dữ liệu vệ tinh môi trường đa nguồn vừa đồng bộ (NASA OCO-2, GRACE-FO, GHGx/EDGAR, SMAP/MODIS):
- OCO-2/3 SIF quang hợp: ${earth.carbonFluxOco2?.sifWm2SrUm} W/m²/sr/μm, hấp thụ Carbon: ${earth.carbonFluxOco2?.carbonUptakeTonHaYr} tấn CO₂/ha, XCO₂: ${earth.carbonFluxOco2?.xco2Ppm} ppm (cập nhật: ${earth.carbonFluxOco2?.observationDate})
- GRACE/GRACE-FO Nước ngầm: ${earth.groundwaterAnomalyGrace?.lweThicknessCm} cm LWE (${earth.groundwaterAnomalyGrace?.groundwaterStatus}), cân bằng ẩm rễ: ${earth.groundwaterAnomalyGrace?.soilWaterBalancePct}% (cập nhật: ${earth.groundwaterAnomalyGrace?.observationDate})
- GHGx/EDGAR Phát thải nông nghiệp: ${earth.greenhouseGasEdgar?.co2eqTonHa} tấn CO₂e/ha (CH₄: ${earth.greenhouseGasEdgar?.ch4KgHa} kg/ha, N₂O: ${earth.greenhouseGasEdgar?.n2oKgHa} kg/ha, mức: ${earth.greenhouseGasEdgar?.emissionLevel})
${earth.smapModis ? `- SMAP/MODIS/GPM: Ẩm tầng mặt SMAP ${earth.smapModis.smapSoilMoisturePct}%, NDVI MODIS ${earth.smapModis.modisNdvi}, Mưa 7 ngày GPM ${earth.smapModis.gpmPrecipitation7dMm} mm` : ''}`
      : '';

    const prompt = `
Bạn là Trợ lý AI Canh tác Nông nghiệp Chuyên gia CropCast. Hãy phân tích bằng ngôn ngữ: ${isEn ? 'ENGLISH' : 'TIẾNG VIỆT'}.
Thông tin thửa ruộng:
- Tên ruộng: ${field?.name || 'Active field'}
- Địa điểm: ${field?.province}, ${field?.district} (${field?.lat}°N, ${field?.lon}°E)
- Ô lưới NASA POWER: ${field?.nasaGrid?.lat}°N, ${field?.nasaGrid?.lon}°E (${field?.nasaGrid?.distanceKm} km)
- Cây trồng: ${cropName} (${variety}, Giai đoạn: ${stageName})
- Loại đất: ${field?.soilType} (${field?.soilCharacteristics?.drainage || 'moderate'})
- Nguồn nước: ${waterSrc} (${waterNotes})
- Mục tiêu: ${field?.primaryGoal}

Thời tiết & NASA POWER 21 năm:
- Nhiệt độ: ${weather?.temp}°C (Min ${weather?.minTemp}°C, Max ${weather?.maxTemp}°C), Nền 21 năm: ${weather?.historicalBaseline?.avgTemp}°C
- Mưa: ${weather?.rain} mm, Ẩm KK: ${weather?.humidity}%, Ẩm rễ: ${((weather?.gwetroot || 0.5) * 100).toFixed(0)}%, Tầng mặt: ${((weather?.gwettop || 0.5) * 100).toFixed(0)}%, Bức xạ: ${weather?.solarRadiation} MJ/m²/ngày
${earthSection}
Phân tích sơ bộ: ${ruleAnalysis?.riskLevel || 'LOW'} — ${ruleAnalysis?.primaryAlert || ''}
Phản hồi gần nhất: ${feedbackHistory?.length ? JSON.stringify(feedbackHistory.slice(-3)) : 'None'}

Trả về JSON chuẩn (toàn bộ nội dung viết bằng ${isEn ? 'English' : 'Tiếng Việt'}):
{
  "headline": "...",
  "situationSummary": "2 concise sentences",
  "topActions": [
    { "title": "...", "priority": "HIGH" | "MEDIUM" | "LOW", "reason": "...", "dataBasis": "..." },
    { "title": "...", "priority": "HIGH" | "MEDIUM" | "LOW", "reason": "...", "dataBasis": "..." },
    { "title": "...", "priority": "HIGH" | "MEDIUM" | "LOW", "reason": "...", "dataBasis": "..." }
  ],
  "postponeActions": ["...", "..."],
  "agronomicExplanation": "...",
  "uncertainties": "...",
  "nextCheckTime": "..."
}
`;

    const { result: response, modelUsed } = await withGeminiFallback(
      () =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction: `You are CropCast agronomic expert. Respond strictly in valid JSON written in ${isEn ? 'English' : 'Vietnamese'} without markdown fences.`,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
      () =>
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: {
            systemInstruction:
              'Bạn là chuyên gia nông học Việt Nam thuộc hệ thống CropCast. Trả lời thuần định dạng JSON chuẩn. Không dùng markdown code fences.',
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          },
        })
    );

    const text = extractGeminiText(response) || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    res.json({
      success: true,
      advice: parsedData,
      source: modelUsed,
    });
  } catch (error: any) {
    console.error('Gemini Advisor Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi gọi Gemini AI',
    });
  }
});

// Gemini Rotation Rethink endpoint: farmer rejects current best strategy with a reason -> AI decides a better one
app.post('/api/gemini/rotation-rethink', async (req: Request, res: Response) => {
  try {
    const {
      field,
      weather,
      earthMetrics,
      rejectedStrategy,
      rejectionReason,
      previouslyRejectedTitles,
      priorities,
      constraints,
      language,
    } = req.body;
    const isEn = language === 'en';
    const earth = earthMetrics || field?.adaptiveMemory?.earthMetrics;

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(200).json({
        success: false,
        fallback: true,
        strategy: null,
      });
    }

    const earthLine = earth
      ? `- OCO-2 Carbon uptake: ${earth.carbonFluxOco2?.carbonUptakeTonHaYr} t CO2/ha (SIF ${earth.carbonFluxOco2?.sifWm2SrUm}); GRACE Groundwater: ${earth.groundwaterAnomalyGrace?.lweThicknessCm} cm LWE (${earth.groundwaterAnomalyGrace?.groundwaterStatus}); GHGx/EDGAR Emissions: ${earth.greenhouseGasEdgar?.co2eqTonHa} t CO2e/ha (CH4 ${earth.greenhouseGasEdgar?.ch4KgHa}, N2O ${earth.greenhouseGasEdgar?.n2oKgHa})`
      : '';

    const prompt = `
You are CropCast agricultural rotation specialist. Output language MUST be: ${isEn ? 'ENGLISH' : 'VIETNAMESE'}.
Farmer rejected the previous strategy for the reason below. Propose ONE better crop rotation strategy solving their constraint.

Field:
- Name: ${field?.name} (${field?.province}, ${field?.district}, ${field?.lat}, ${field?.lon})
- Soil: ${field?.soilType}, drainage: ${field?.soilCharacteristics?.drainage}
- Current crop: ${field?.crop?.name} (${field?.crop?.seedFamily || 'unknown'}, ${field?.crop?.variety})
- Water: ${field?.waterSource?.type} (${constraints?.waterAvailability || 'seasonal_limited'}), Equipment: ${constraints?.equipmentAccess || 'basic_manual'}, Market: ${constraints?.marketPreference || 'mixed_family'}
- Priorities: ${JSON.stringify(priorities || [])}
- Weather: ${weather?.temp}°C, Root moisture ${Math.round((weather?.gwetroot || 0.5) * 100)}%, Humidity ${weather?.humidity}%
${earthLine}

Rejected strategy: ${rejectedStrategy?.title} (${rejectedStrategy?.nextCropName})
Excluded titles: ${JSON.stringify(previouslyRejectedTitles || [])}
Farmer rejection reason: "${rejectionReason}"

Return EXACTLY ONE valid JSON Object written in ${isEn ? 'English' : 'Vietnamese'}:
{
  "title": "...",
  "sequenceSummary": "...",
  "nextCropFamily": "poaceae" | "fabaceae" | "brassicaceae" | "solanaceae" | "cucurbitaceae" | "other_perennial",
  "nextCropName": "...",
  "suitabilityScore": 78,
  "whySuggested": "...",
  "supportingEvidence": ["...", "...", "..."],
  "benefits": {
    "nutrientCycling": "...",
    "waterDemand": "...",
    "erosionAndOrganicMatter": "...",
    "pestCycleDisruption": "...",
    "forageAndIncome": "..."
  },
  "informationGaps": ["...", "..."],
  "localReviewRisks": ["...", "..."]
}
`;

    const { result: response, modelUsed } = await withGeminiFallback(
      () =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction: `You are CropCast agricultural rotation planner. Respond strictly in valid JSON written in ${isEn ? 'English' : 'Vietnamese'}, without markdown.`,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
      () =>
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: {
            systemInstruction: `You are CropCast agricultural rotation planner. Respond strictly in valid JSON written in ${isEn ? 'English' : 'Vietnamese'}, without markdown.`,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          },
        })
    );

    const text = extractGeminiText(response) || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    const validFamilies = ['poaceae', 'fabaceae', 'brassicaceae', 'solanaceae', 'cucurbitaceae', 'other_perennial'];
    const safeFamily = validFamilies.includes(parsed.nextCropFamily)
      ? parsed.nextCropFamily
      : 'other_perennial';

    res.json({
      success: true,
      source: modelUsed,
      strategy: {
        id: `rot-ai-${Date.now()}`,
        isCurrentBaseline: false,
        title: parsed.title || `Luân canh điều chỉnh: ${parsed.nextCropName || 'Cây ngắn ngày phù hợp'}`,
        sequenceSummary: parsed.sequenceSummary || `${field?.crop?.name} → ${parsed.nextCropName}`,
        nextCropFamily: safeFamily,
        nextCropName: parsed.nextCropName || 'Cây luân canh phù hợp',
        suitabilityScore: Math.min(98, Math.max(75, Number(parsed.suitabilityScore) || 88)),
        whySuggested: parsed.whySuggested || 'Đã điều chỉnh theo phản hồi thực tế của bạn.',
        supportingEvidence: Array.isArray(parsed.supportingEvidence) ? parsed.supportingEvidence : [],
        benefits: parsed.benefits || {
          nutrientCycling: 'Cân bằng dinh dưỡng đất giữa các vụ.',
          waterDemand: 'Phù hợp nguồn nước hiện có.',
          erosionAndOrganicMatter: 'Che phủ đất và bổ sung hữu cơ.',
          pestCycleDisruption: 'Ngắt chu kỳ sâu bệnh vụ cũ.',
          forageAndIncome: 'Phù hợp điều kiện tiêu thụ của hộ gia đình.',
        },
        informationGaps: Array.isArray(parsed.informationGaps) ? parsed.informationGaps : [],
        localReviewRisks: Array.isArray(parsed.localReviewRisks) ? parsed.localReviewRisks : [],
        alignedPriorities: Array.isArray(priorities) ? priorities : [],
      },
    });
  } catch (error: any) {
    console.error('Gemini Rotation Rethink Error:', error);
    res.status(200).json({
      success: false,
      fallback: true,
      strategy: null,
    });
  }
});

// Gemini Q&A Chat endpoint
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  const { message, field, weather, earthMetrics, conversationHistory, language } = req.body;
  const lang: 'vi' | 'en' = language === 'en' ? 'en' : 'vi';
  const isEn = lang === 'en';
  const earth = earthMetrics || field?.adaptiveMemory?.earthMetrics;
  const userMessage = typeof message === 'string' ? message.trim() : '';
  const promptText =
    userMessage ||
    (isEn
      ? 'Hello, what should I check on my field today?'
      : 'Xin chào, ruộng của tôi hôm nay cần chú ý gì?');

  try {
    const cacheKey = `${lang}::${field?.id || 'anon'}::${field?.soilType || ''}::${field?.crop?.name || ''}::${promptText.toLowerCase()}`;
    const isShortTurn = !Array.isArray(conversationHistory) || conversationHistory.length <= 2;
    if (isShortTurn) {
      const cached = chatResponseCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json({ success: true, reply: cached.reply, cached: true });
      }
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(200).json({
        success: true,
        fromFallback: true,
        reply: buildLocalAgronomyReply(promptText, field, weather, earth, lang),
      });
    }

    const cropName = field?.crop?.name || field?.cropName || 'Crop';
    const variety = field?.crop?.variety || field?.variety || 'Standard';
    const stageName = field?.crop?.currentStage || field?.stageName || 'Growing';
    const waterSrc =
      typeof field?.waterSource === 'string'
        ? field.waterSource
        : field?.waterSource?.type || 'River/pond';

    const weatherSummary = weather
      ? `Temp ${weather.temp}°C (min ${weather.minTemp}°C, max ${weather.maxTemp}°C), Rain ${weather.rain} mm, Humidity ${weather.humidity}%, Root moisture ${Math.round((weather.gwetroot || 0.5) * 100)}%, Solar ${weather.solarRadiation} MJ/m²/day.`
      : 'No live weather reading.';

    const earthSummary = earth
      ? `\n- OCO-2 Carbon/SIF: ${earth.carbonFluxOco2?.carbonUptakeTonHaYr} t CO₂/ha (SIF ${earth.carbonFluxOco2?.sifWm2SrUm})\n- GRACE Groundwater: ${earth.groundwaterAnomalyGrace?.lweThicknessCm} cm LWE (${earth.groundwaterAnomalyGrace?.groundwaterStatus})\n- GHGx/EDGAR Emissions: ${earth.greenhouseGasEdgar?.co2eqTonHa} t CO₂e/ha (CH₄ ${earth.greenhouseGasEdgar?.ch4KgHa}, N₂O ${earth.greenhouseGasEdgar?.n2oKgHa})`
      : '';

    const systemPrompt = `
You are CropCast - an expert personalized agronomy assistant. Respond strictly in ${isEn ? 'ENGLISH' : 'VIETNAMESE'}.
Field context:
- Field: ${field?.name || 'Active field'} (${field?.province || ''}, ${field?.district || ''})
- Coordinates / NASA Grid: ${field?.nasaGrid?.lat ?? field?.lat}°N, ${field?.nasaGrid?.lon ?? field?.lon}°E
- Crop: ${cropName} (${variety}, Stage: ${stageName})
- Soil: ${field?.soilType || 'loam'} (Drainage: ${field?.soilCharacteristics?.drainage || 'moderate'})
- Water source: ${waterSrc}
- Current Weather: ${weatherSummary}${earthSummary}

Guidelines:
1. Respond in clear, practical ${isEn ? 'English' : 'Vietnamese'} suitable for farmers.
2. Reference specific field soil, crop stage, NASA POWER weather, OCO-2, GRACE groundwater, and GHGx emissions data.
3. Recommend inspecting field conditions before spraying or heavy fertilization.
4. Keep formatting concise with clear bullet points.
`;

    // Format valid alternating history starting from the first user turn
    const sanitizedHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    if (Array.isArray(conversationHistory)) {
      const recent = conversationHistory.slice(-6);
      for (const item of recent) {
        const text = typeof item?.parts === 'string' ? item.parts.trim() : '';
        if (!text) continue;
        const role = item.role === 'user' ? 'user' : 'model';
        if (sanitizedHistory.length === 0 && role !== 'user') continue;
        const lastRole = sanitizedHistory[sanitizedHistory.length - 1]?.role;
        if (lastRole === role) {
          sanitizedHistory[sanitizedHistory.length - 1].parts[0].text += `\n${text}`;
        } else {
          sanitizedHistory.push({ role, parts: [{ text }] });
        }
      }
      if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') {
        sanitizedHistory.pop();
      }
    }

    const callModel = async (model: string, thinkingLevel: ThinkingLevel) => {
      if (sanitizedHistory.length > 0) {
        const chat = ai.chats.create({
          model,
          history: sanitizedHistory,
          config: {
            systemInstruction: systemPrompt,
            thinkingConfig: { thinkingLevel },
          },
        });
        const response = await chat.sendMessage({ message: promptText });
        const extracted = extractGeminiText(response);
        if (extracted) return extracted;
      }

      const directRes = await ai.models.generateContent({
        model,
        contents: promptText,
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel },
        },
      });
      const directText = extractGeminiText(directRes);
      if (!directText) throw new Error('EMPTY_MODEL_RESPONSE');
      return directText;
    };

    const { result: replyText } = await withGeminiFallback(
      () => callModel('gemini-4-hydrogen', ThinkingLevel.LOW),
      () => callModel('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL)
    );

    if (isShortTurn) {
      chatResponseCache.set(cacheKey, {
        reply: replyText,
        expiresAt: Date.now() + 2 * 60 * 1000,
      });
    }

    res.json({
      success: true,
      reply: replyText,
    });
  } catch (error: any) {
    console.warn('Gemini Chat fallback triggered:', error?.status || error?.code, error?.message || error);
    const localReply = buildLocalAgronomyReply(promptText, field, weather, earth, lang);
    const note = isEn
      ? '\n\n*(Synthesized from CropCast agronomy rules & synced NASA data)*'
      : isRateLimitError(error)
      ? '\n\n*(Đang tổng hợp trực tiếp từ Bộ quy tắc nông học & dữ liệu NASA do Gemini AI tạm giới hạn lượt hỏi theo phút)*'
      : '\n\n*(Đang tổng hợp trực tiếp từ Bộ quy tắc nông học & dữ liệu thửa ruộng)*';

    res.status(200).json({
      success: true,
      fromFallback: true,
      reply: `${localReply}${note}`,
    });
  }
});

// ==============================================================================
// Centralized NASA Data Warehouse & Supabase Sync Endpoints
// ==============================================================================

import {
  getCentralDataStatus,
  executeNasaPowerSync,
  toggleAutoSync,
  previewUploadedCsv,
  previewBatchCsvFiles,
  commitImportedData,
  commitBatchCsvFiles,
  startAsyncBatchImportJob,
  getImportJobStatus,
  getLatestImportJob,
  rollbackDataVersion,
  getSyncLogs,
  getDataImports,
  createStagedUploadSession,
  appendStagedUploadChunk,
  previewStagedUploadSession,
  startAsyncStagedImportJob,
} from './server/nasaSyncManager.ts';
import {
  registerUsernameUser,
  loginUsernameUser,
  verifySessionToken,
  getUserByUid,
  listFieldsForUser,
  createFieldForUser,
  updateFieldForUser,
  deleteFieldForUser,
  listTasksForUser,
  createTasksForUser,
  updateTaskForUser,
  listFeedbacksForUser,
  createFeedbackForUser,
  createShareLinkForUser,
  revokeShareLinkForUser,
  shareFieldByTargetForUser,
  removeSharedTargetForUser,
  redeemShareLinkForUser,
} from './server/localAuthStore.ts';
import {
  syncFieldEarthEnvironment,
  getFieldEarthEnvironment,
} from './server/envEarthService.ts';

// ==============================================================================
// Environmental Sustainability Sync API (NASA OCO-2/3, GRACE/GRACE-FO, GHGx/EDGAR)
// ==============================================================================

app.get('/api/nasa/environment', async (req: Request, res: Response) => {
  try {
    const fieldId = String(req.query.fieldId || 'default');
    const lat = Number(req.query.lat ?? 21.03);
    const lon = Number(req.query.lon ?? 105.85);
    const cropName = String(req.query.cropName || 'Lúa');
    const cropCategory = String(req.query.cropCategory || 'rice');

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'Tọa độ lat/lon không hợp lệ.' });
    }
    const snapshot = await getFieldEarthEnvironment({
      fieldId,
      lat,
      lon,
      cropName,
      cropCategory,
    });
    return res.json(snapshot);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Không thể tải dữ liệu môi trường NASA.' });
  }
});

app.post('/api/nasa/sync-environment', async (req: Request, res: Response) => {
  try {
    const { fieldId, lat, lon, cropName, cropCategory, rotationId } = req.body || {};
    const numLat = Number(lat);
    const numLon = Number(lon);
    if (!fieldId || !Number.isFinite(numLat) || !Number.isFinite(numLon)) {
      return res.status(400).json({ error: 'Thiếu mã thửa ruộng hoặc tọa độ lat/lon hợp lệ.' });
    }
    const snapshot = await syncFieldEarthEnvironment({
      fieldId: String(fieldId),
      lat: numLat,
      lon: numLon,
      cropName: String(cropName || 'Cây trồng'),
      cropCategory: String(cropCategory || 'vegetable'),
      rotationId: rotationId ? String(rotationId) : undefined,
    });
    return res.json({ success: true, ...snapshot });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Đồng bộ dữ liệu NASA OCO-2 / GRACE / GHGx thất bại.',
    });
  }
});

// ==============================================================================
// Username-Only Auth & Farm Persistence (No Email Required)
// ==============================================================================

function extractLocalSession(req: Request): { uid: string; username: string } | null {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  return verifySessionToken(token);
}

function requireLocalAuth(req: Request, res: Response, next: NextFunction) {
  const session = extractLocalSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }
  (req as any).localUser = session;
  return next();
}

app.post('/api/auth/signup', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body || {};
    const result = registerUsernameUser(String(username || ''), String(password || ''));
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Không thể tạo tài khoản.' });
  }
});

app.post('/api/auth/signin', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body || {};
    const result = loginUsernameUser(String(username || ''), String(password || ''));
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(401).json({ error: err?.message || 'Tên đăng nhập hoặc mật khẩu chưa đúng.' });
  }
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const session = extractLocalSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }
  const user = getUserByUid(session.uid);
  if (!user) {
    return res.status(401).json({ error: 'Tài khoản không tồn tại' });
  }
  return res.json({ user });
});

app.get('/api/local/state', requireLocalAuth, (req: Request, res: Response) => {
  const { uid, username } = (req as any).localUser;
  res.json({
    fields: listFieldsForUser(uid, username),
    tasks: listTasksForUser(uid),
    feedbacks: listFeedbacksForUser(uid),
  });
});

app.post('/api/local/fields', requireLocalAuth, (req: Request, res: Response) => {
  try {
    const { uid } = (req as any).localUser;
    const field = createFieldForUser(uid, req.body || {});
    res.json({ field });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Không thể tạo thửa ruộng.' });
  }
});

app.put('/api/local/fields/:id', requireLocalAuth, (req: Request, res: Response) => {
  try {
    const { uid } = (req as any).localUser;
    const field = updateFieldForUser(uid, { ...(req.body || {}), id: req.params.id });
    res.json({ field });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Không thể cập nhật thửa ruộng.' });
  }
});

app.delete('/api/local/fields/:id', requireLocalAuth, (req: Request, res: Response) => {
  const { uid } = (req as any).localUser;
  deleteFieldForUser(uid, req.params.id);
  res.json({ success: true });
});

app.post('/api/local/tasks', requireLocalAuth, (req: Request, res: Response) => {
  const { uid } = (req as any).localUser;
  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
  const created = createTasksForUser(uid, tasks);
  res.json({ tasks: created });
});

app.patch('/api/local/tasks/:id', requireLocalAuth, (req: Request, res: Response) => {
  try {
    const { uid } = (req as any).localUser;
    const { status, note } = req.body || {};
    const task = updateTaskForUser(uid, req.params.id, status, note);
    res.json({ task });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Không thể cập nhật công việc.' });
  }
});

app.post('/api/local/feedbacks', requireLocalAuth, (req: Request, res: Response) => {
  const { uid } = (req as any).localUser;
  const feedback = createFeedbackForUser(uid, req.body || {});
  res.json({ feedback });
});

app.post('/api/local/shares/link', requireLocalAuth, (req: Request, res: Response) => {
  try {
    const { uid } = (req as any).localUser;
    const shareToken = createShareLinkForUser(uid, String(req.body?.fieldId || ''));
    res.json({ shareToken });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Không thể tạo liên kết chia sẻ.' });
  }
});

app.post('/api/local/shares/revoke', requireLocalAuth, (req: Request, res: Response) => {
  const { uid } = (req as any).localUser;
  revokeShareLinkForUser(uid, String(req.body?.fieldId || ''));
  res.json({ success: true });
});

app.post('/api/local/shares/target', requireLocalAuth, (req: Request, res: Response) => {
  try {
    const { uid } = (req as any).localUser;
    const target = shareFieldByTargetForUser(
      uid,
      String(req.body?.fieldId || ''),
      String(req.body?.target || '')
    );
    res.json({ target });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Không thể chia sẻ thửa ruộng.' });
  }
});

app.post('/api/local/shares/remove-target', requireLocalAuth, (req: Request, res: Response) => {
  const { uid } = (req as any).localUser;
  removeSharedTargetForUser(uid, String(req.body?.fieldId || ''), String(req.body?.target || ''));
  res.json({ success: true });
});

app.post('/api/local/shares/redeem', requireLocalAuth, (req: Request, res: Response) => {
  try {
    const { uid } = (req as any).localUser;
    const info = redeemShareLinkForUser(uid, String(req.body?.token || ''));
    res.json(info);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Không thể mở liên kết chia sẻ.' });
  }
});

// Public data status for dashboard
app.get('/api/data-status', async (_req: Request, res: Response) => {
  try {
    const status = await getCentralDataStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Protect all /api/admin/* endpoints strictly for verified admin account
app.use('/api/admin', requireAdminMiddleware);

// Admin status
app.get('/api/admin/status', async (_req: Request, res: Response) => {
  try {
    const status = await getCentralDataStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger NASA POWER Daily API sync
app.post('/api/admin/sync', async (req: Request, res: Response) => {
  try {
    const { cellIds } = req.body || {};
    const result = await executeNasaPowerSync(cellIds);
    if (result.status === 'FAILED') {
      return res.status(502).json({
        ...result,
        error: result.errorMessage || 'NASA POWER API không phản hồi.',
      });
    }
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Lỗi khi đồng bộ NASA POWER' });
  }
});

// Toggle auto daily sync
app.post('/api/admin/toggle-auto-sync', (req: Request, res: Response) => {
  const { enabled } = req.body;
  const newState = toggleAutoSync(!!enabled);
  res.json({ autoSyncEnabled: newState });
});

// Preview uploaded CSV/Excel
app.post('/api/admin/preview-file', (req: Request, res: Response) => {
  try {
    const { fileName, content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Nội dung tệp rỗng' });
    }
    const preview = previewUploadedCsv(fileName || 'upload.csv', content);
    res.json(preview);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi kiểm tra tệp' });
  }
});

// Commit imported data
app.post('/api/admin/import-data', async (req: Request, res: Response) => {
  try {
    const { preview, rawContent } = req.body;
    if (!preview || !rawContent) {
      return res.status(400).json({ error: 'Dữ liệu thiếu' });
    }
    const record = await commitImportedData(preview, rawContent);
    res.json({ success: true, importRecord: record });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi nhập dữ liệu' });
  }
});

// Preview multiple CSV files across multiple folders
app.post('/api/admin/preview-batch', (req: Request, res: Response) => {
  try {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Chưa có tệp CSV nào trong danh sách' });
    }
    const batchResult = previewBatchCsvFiles(files);
    res.json(batchResult);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi kiểm tra hàng loạt tệp CSV' });
  }
});

// Commit multiple CSV files across multiple folders (sync)
app.post('/api/admin/import-batch', async (req: Request, res: Response) => {
  try {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Chưa có tệp CSV nào để nhập' });
    }
    const result = await commitBatchCsvFiles(files);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi nhập dữ liệu hàng loạt' });
  }
});

// Start async batch CSV import job with ETA progress (survives admin page reloads)
app.post('/api/admin/import-batch-async', (req: Request, res: Response) => {
  try {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Chưa có tệp CSV nào để nhập' });
    }
    const job = startAsyncBatchImportJob(files);
    res.json({ success: true, job });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Không thể khởi chạy tiến trình nhập CSV' });
  }
});

// Chunked Staged Batch Upload Sessions (bypasses proxy HTTP 413 Payload Too Large limits)
app.post('/api/admin/upload-session/start', (_req: Request, res: Response) => {
  try {
    const session = createStagedUploadSession();
    res.json({ success: true, ...session });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Không thể khởi tạo phiên tải tệp.' });
  }
});

app.post('/api/admin/upload-session/:sessionId/chunk', (req: Request, res: Response) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'Dữ liệu gói tệp rỗng.' });
    }
    const result = appendStagedUploadChunk(req.params.sessionId, items);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    const msg = error?.message || 'Lỗi khi nhận gói dữ liệu CSV.';
    const status = msg.includes('hết hạn') || msg.includes('không tồn tại') ? 404 : 500;
    return res.status(status).json({ error: msg });
  }
});

app.post('/api/admin/upload-session/:sessionId/preview', (req: Request, res: Response) => {
  try {
    const batchResult = previewStagedUploadSession(req.params.sessionId);
    return res.json(batchResult);
  } catch (error: any) {
    const msg = error?.message || 'Lỗi khi phân tích gói CSV.';
    const status = msg.includes('hết hạn') || msg.includes('không tồn tại') ? 404 : 500;
    return res.status(status).json({ error: msg });
  }
});

app.post('/api/admin/upload-session/:sessionId/import-async', (req: Request, res: Response) => {
  try {
    const job = startAsyncStagedImportJob(req.params.sessionId);
    return res.json({ success: true, job });
  } catch (error: any) {
    const msg = error?.message || 'Không thể khởi chạy tiến trình nhập CSV.';
    const status = msg.includes('hết hạn') || msg.includes('không tồn tại') ? 404 : 500;
    return res.status(status).json({ error: msg });
  }
});

// Poll latest or specific CSV import job status + ETA
app.get('/api/admin/import-job', (_req: Request, res: Response) => {
  const job = getLatestImportJob();
  res.json({ job });
});

app.get('/api/admin/import-job/:jobId', (req: Request, res: Response) => {
  const job = getImportJobStatus(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Không tìm thấy tiến trình nhập CSV.' });
  }
  return res.json({ job });
});

// Get sync logs & data imports
app.get('/api/admin/sync-logs', (_req: Request, res: Response) => {
  res.json({
    logs: getSyncLogs(),
    imports: getDataImports(),
  });
});

// Rollback import version
app.post('/api/admin/rollback', (req: Request, res: Response) => {
  try {
    const { version } = req.body;
    if (!version) {
      return res.status(400).json({ error: 'Thiếu mã phiên bản cần rollback' });
    }
    const result = rollbackDataVersion(version);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi khôi phục phiên bản' });
  }
});

// Prevent any unmatched /api/* path from falling through to Vite HTML (avoids JSON.parse '<' errors)
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    return res.status(err?.status || 500).json({
      error: err?.message || 'Internal server error',
    });
  }
  return next(err);
});

// Serve frontend in dev via Vite middlewares, or static dist in production
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
        ws: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    if (hmrDisabled) {
      app.get('/@vite/client', async (_req: Request, res: Response, next: NextFunction) => {
        try {
          const transformed = await vite.transformRequest('/@vite/client');
          if (!transformed?.code) return next();
          const code = transformed.code.replace(
            'const createWebSocketModuleRunnerTransport = (options) => {',
            'const createWebSocketModuleRunnerTransport = (_options) => ({ connect: async () => {}, disconnect: async () => {}, send: () => {} }); const _disabledWsTransport = (options) => {'
          );
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          return res.send(code);
        } catch {
          return next();
        }
      });
    }
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CropCast Full-Stack Server running on port ${PORT}`);
  });
}

startServer();
