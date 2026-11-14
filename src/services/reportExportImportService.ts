import { jsPDF } from 'jspdf';
import {
  DailyAgronomicBrief,
  FarmTask,
  FeedbackRecord,
  FieldProfile,
  ImportedFarmReport,
  SoilDrainageEstimate,
  WeatherObservation,
} from '../types';
import { AppLanguage } from '../contexts/LanguageContext';
import { assessSoilDrainageFromEarthData, getDrainageLabel, getSoilLabel } from './agronomyEngine';
import { getPlantDisplayName } from '../data/cropTaxonomy';

const EMBED_MARKER = 'CROPCAST_REPORT_V1:';

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = String(text || '').split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function createReportPageCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754; // A4 proportion @ ~150dpi
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

export function buildFarmReportPayload(params: {
  field: FieldProfile;
  weather?: WeatherObservation;
  brief?: DailyAgronomicBrief | null;
  tasks: FarmTask[];
  feedbacks: FeedbackRecord[];
  dailySampleSummary?: ImportedFarmReport['dailySampleSummary'];
  sourceLabel?: string;
}): ImportedFarmReport {
  const { field, weather, brief, tasks, feedbacks, dailySampleSummary, sourceLabel } = params;
  const drainageSummary = assessSoilDrainageFromEarthData(
    weather,
    field.soilType,
    field.adaptiveMemory?.earthMetrics || null,
    'vi'
  );
  return {
    schemaVersion: '1.0',
    exportedAt: new Date().toISOString(),
    sourceLabel: sourceLabel || 'CropCast Offline Farm Report',
    field,
    weather,
    briefHeadline: brief?.headline,
    drainageSummary,
    tasks: tasks.filter((tk) => tk.fieldId === field.id).slice(0, 40),
    feedbacks: feedbacks.filter((fb) => fb.fieldId === field.id).slice(0, 60),
    dailySampleSummary,
  };
}

export async function exportFarmReportPdf(params: {
  field: FieldProfile;
  weather?: WeatherObservation;
  brief?: DailyAgronomicBrief | null;
  tasks: FarmTask[];
  feedbacks: FeedbackRecord[];
  dailySampleSummary?: ImportedFarmReport['dailySampleSummary'];
  lang: AppLanguage;
}): Promise<void> {
  const { field, weather, brief, tasks, feedbacks, lang } = params;
  const isEn = lang === 'en';
  const payload = buildFarmReportPayload(params);
  const embeddedToken = `${EMBED_MARKER}${utf8ToBase64(JSON.stringify(payload))}`;

  const pages: HTMLCanvasElement[] = [];
  let { canvas, ctx } = createReportPageCanvas();
  const marginX = 72;
  const contentW = canvas.width - marginX * 2;
  let y = 80;

  const ensureSpace = (needed: number) => {
    if (y + needed > 1650) {
      // Footer on current page
      ctx.fillStyle = '#78716c';
      ctx.font = '18px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(
        `CropCast · NASA POWER, SMAP, GPM, OCO-2, GRACE-FO · ${new Date().toLocaleDateString(
          isEn ? 'en-US' : 'vi-VN'
        )}`,
        marginX,
        1706
      );
      pages.push(canvas);
      const next = createReportPageCanvas();
      canvas = next.canvas;
      ctx = next.ctx;
      y = 80;
    }
  };

  // Header Banner
  ctx.fillStyle = '#065f46';
  ctx.fillRect(0, 0, canvas.width, 150);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(
    isEn ? 'CROPCAST — FARM MANAGEMENT & CLIMATE REPORT' : 'CROPCAST — BÁO CÁO QUẢN LÝ RUỘNG & KHÍ HẬU',
    marginX,
    66
  );
  ctx.fillStyle = '#d1fae5';
  ctx.font = '20px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(
    `${field.name} · ${field.province}${field.district ? `, ${field.district}` : ''} · ${new Date().toLocaleString(
      isEn ? 'en-US' : 'vi-VN'
    )}`,
    marginX,
    112
  );
  y = 195;

  // Section 1: Field Profile
  ctx.fillStyle = '#064e3b';
  ctx.font = 'bold 24px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(isEn ? '1. Field Profile & Location' : '1. Hồ sơ Thửa ruộng & Vị trí', marginX, y);
  y += 14;
  ctx.fillStyle = '#e7e5e4';
  ctx.fillRect(marginX, y, contentW, 2);
  y += 30;

  const profileLines = [
    `${isEn ? 'Crop / Variety' : 'Cây trồng / Giống'}: ${getPlantDisplayName(field.crop.name, lang)} (${field.crop.variety || '—'})`,
    `${isEn ? 'Growth Stage' : 'Giai đoạn'}: ${field.crop.currentStage} · ${isEn ? 'Planted' : 'Xuống giống'}: ${field.crop.plantingDate}`,
    `${isEn ? 'Area & Coordinates' : 'Diện tích & Tọa độ'}: ${field.areaHa} ha · ${field.lat.toFixed(4)}°N, ${field.lon.toFixed(4)}°E (NASA Grid ${field.nasaGrid.cellId})`,
    `${isEn ? 'Soil & Drainage' : 'Đất & Thoát nước'}: ${getSoilLabel(field.soilType, lang)} · ${getDrainageLabel(field.soilCharacteristics.drainage, lang)}`,
  ];

  ctx.fillStyle = '#1c1917';
  ctx.font = '20px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  for (const line of profileLines) {
    ensureSpace(34);
    for (const wrapped of wrapLines(ctx, line, contentW)) {
      ctx.fillText(wrapped, marginX, y);
      y += 30;
    }
  }
  y += 18;

  // Section 2: Weather & Automated Soil Drainage
  ensureSpace(220);
  ctx.fillStyle = '#064e3b';
  ctx.font = 'bold 24px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(
    isEn ? '2. Live Weather & SMAP/GPM Soil Drainage' : '2. Thời tiết Thực tế & Đánh giá Thoát nước SMAP/GPM',
    marginX,
    y
  );
  y += 14;
  ctx.fillStyle = '#e7e5e4';
  ctx.fillRect(marginX, y, contentW, 2);
  y += 30;

  const drainage: SoilDrainageEstimate | undefined = payload.drainageSummary;
  const weatherLines = [
    weather
      ? `${isEn ? 'Observed' : 'Quan trắc'}: ${weather.temp}°C (${weather.minTemp}–${weather.maxTemp}°C) · ${isEn ? 'Rain' : 'Mưa'}: ${weather.rain} mm · ${isEn ? 'Humidity' : 'Ẩm KK'}: ${weather.humidity}% · ${isEn ? 'Root Moisture' : 'Ẩm tầng rễ'}: ${Math.round(weather.gwetroot * 100)}%`
      : isEn
      ? 'No live weather observation attached.'
      : 'Chưa gắn số liệu thời tiết tức thời.',
    brief ? `${isEn ? 'Daily Outlook' : 'Nhận định hôm nay'}: ${brief.headline}` : '',
    drainage
      ? `${isEn ? 'SMAP Surface' : 'Ẩm mặt SMAP'}: ${drainage.smapSurfacePct}% · ${isEn ? '7-day GPM Rain' : 'Mưa GPM 7 ngày'}: ${drainage.gpmRain7dMm} mm · ${isEn ? 'Drop-off Ratio' : 'Hệ số rút ẩm'}: ${drainage.dropOffRatio}`
      : '',
    drainage ? (isEn ? drainage.explanationEn : drainage.explanationVi) : '',
  ].filter(Boolean);

  ctx.fillStyle = '#1c1917';
  ctx.font = '20px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  for (const line of weatherLines) {
    ensureSpace(36);
    for (const wrapped of wrapLines(ctx, line, contentW)) {
      ctx.fillText(wrapped, marginX, y);
      y += 30;
    }
  }
  y += 18;

  // Section 3: Field Tasks
  ensureSpace(140);
  ctx.fillStyle = '#064e3b';
  ctx.font = 'bold 24px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(
    isEn ? `3. Field Action Checklist (${payload.tasks.length})` : `3. Danh sách Công việc Đồng ruộng (${payload.tasks.length})`,
    marginX,
    y
  );
  y += 14;
  ctx.fillStyle = '#e7e5e4';
  ctx.fillRect(marginX, y, contentW, 2);
  y += 30;

  ctx.font = '19px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  if (payload.tasks.length === 0) {
    ctx.fillStyle = '#57534e';
    ctx.fillText(isEn ? 'No tasks logged for this field.' : 'Chưa có công việc nào được ghi nhận.', marginX, y);
    y += 34;
  } else {
    for (const tk of payload.tasks.slice(0, 15)) {
      ensureSpace(72);
      ctx.fillStyle = '#1c1917';
      const statusTxt = tk.status.toUpperCase();
      const titleTxt = isEn && tk.titleEn ? tk.titleEn : tk.title;
      for (const wrapped of wrapLines(ctx, `• [${statusTxt}] ${titleTxt}`, contentW)) {
        ctx.fillText(wrapped, marginX, y);
        y += 28;
      }
      ctx.fillStyle = '#57534e';
      const reasonTxt = isEn && tk.reasonEn ? tk.reasonEn : tk.reason;
      for (const wrapped of wrapLines(ctx, `  ${reasonTxt}`, contentW - 20)) {
        ctx.fillText(wrapped, marginX + 18, y);
        y += 26;
      }
      y += 6;
    }
  }
  y += 16;

  // Section 4: Historical Field Feedback Logs
  ensureSpace(140);
  ctx.fillStyle = '#064e3b';
  ctx.font = 'bold 24px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(
    isEn
      ? `4. Field Check-in & Feedback Log (${payload.feedbacks.length})`
      : `4. Nhật ký Thăm đồng & Hiệu chỉnh (${payload.feedbacks.length})`,
    marginX,
    y
  );
  y += 14;
  ctx.fillStyle = '#e7e5e4';
  ctx.fillRect(marginX, y, contentW, 2);
  y += 30;

  ctx.font = '19px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  if (payload.feedbacks.length === 0) {
    ctx.fillStyle = '#57534e';
    ctx.fillText(
      isEn ? 'No field feedback logs recorded yet.' : 'Chưa có nhật ký thăm đồng nào.',
      marginX,
      y
    );
    y += 34;
  } else {
    for (const fb of payload.feedbacks.slice(0, 20)) {
      ensureSpace(80);
      const dateStr = new Date(fb.timestamp).toLocaleDateString(isEn ? 'en-US' : 'vi-VN');
      ctx.fillStyle = '#1c1917';
      const lineHead = `[${dateStr}] ${fb.predictionOutcome || fb.feedbackType}${
        fb.observedMoisture ? ` · ${fb.observedMoisture}` : ''
      }${fb.observedCropHealth ? ` · ${fb.observedCropHealth}` : ''}`;
      ctx.fillText(lineHead, marginX, y);
      y += 28;
      if (fb.userComment) {
        ctx.fillStyle = '#44403c';
        for (const wrapped of wrapLines(ctx, `"${fb.userComment}"`, contentW - 18)) {
          ctx.fillText(wrapped, marginX + 14, y);
          y += 26;
        }
      }
      if (fb.systemActionTaken) {
        ctx.fillStyle = '#065f46';
        for (const wrapped of wrapLines(ctx, `→ ${fb.systemActionTaken}`, contentW - 18)) {
          ctx.fillText(wrapped, marginX + 14, y);
          y += 26;
        }
      }
      y += 8;
    }
  }

  // Attribution & AI Disclosure Box on final page
  ensureSpace(140);
  y += 16;
  ctx.fillStyle = '#f5f5f4';
  ctx.fillRect(marginX, y, contentW, 110);
  ctx.strokeStyle = '#d6d3d1';
  ctx.strokeRect(marginX, y, contentW, 110);
  ctx.fillStyle = '#292524';
  ctx.font = 'bold 17px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(
    isEn
      ? 'Satellite & AI Data Attribution (NASA Space Apps Open-Data Standards):'
      : 'Ghi nhận Nguồn Vệ tinh & AI (Chuẩn dữ liệu mở NASA Space Apps):',
    marginX + 20,
    y + 30
  );
  ctx.font = '16px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#57534e';
  const attrText = isEn
    ? 'Aggregated from NASA POWER, SMAP, GPM, OCO-2, GRACE-FO, GHG Center STAC, PRISM & Open-Meteo. Contains embedded machine-readable snapshot for CropCast offline PDF import.'
    : 'Tổng hợp từ NASA POWER, SMAP, GPM, OCO-2, GRACE-FO, GHG Center STAC, PRISM & Open-Meteo. Tệp PDF chứa dữ liệu nhúng cho phép tải lại vào CropCast để xem ngoại tuyến.';
  let attrY = y + 58;
  for (const wrapped of wrapLines(ctx, attrText, contentW - 40)) {
    ctx.fillText(wrapped, marginX + 20, attrY);
    attrY += 22;
  }

  ctx.fillStyle = '#78716c';
  ctx.font = '18px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(
    `CropCast · Page ${pages.length + 1} · ${field.name}`,
    marginX,
    1706
  );
  pages.push(canvas);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: false,
  });

  doc.setProperties({
    title: `CropCast Report - ${field.name}`,
    subject: 'CROPCAST_REPORT_V1',
    creator: 'CropCast Agricultural Intelligence',
    keywords: embeddedToken,
  });

  pages.forEach((pg, idx) => {
    if (idx > 0) doc.addPage();
    const imgData = pg.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, 210, 297);
  });

  const slug = (field.name || 'field')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  doc.save(`cropcast-report-${slug || 'field'}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportFarmReportJson(params: {
  field: FieldProfile;
  weather?: WeatherObservation;
  brief?: DailyAgronomicBrief | null;
  tasks: FarmTask[];
  feedbacks: FeedbackRecord[];
  dailySampleSummary?: ImportedFarmReport['dailySampleSummary'];
}): void {
  const payload = buildFarmReportPayload(params);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = (params.field.name || 'field')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  a.href = url;
  a.download = `cropcast-report-${slug || 'field'}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function validateImportedPayload(raw: any): ImportedFarmReport {
  if (!raw || typeof raw !== 'object' || !raw.field || typeof raw.field.name !== 'string') {
    throw new Error(
      'Tệp báo cáo không đúng định dạng CropCast (thiếu thông tin thửa ruộng).'
    );
  }
  return {
    schemaVersion: '1.0',
    exportedAt: String(raw.exportedAt || new Date().toISOString()),
    sourceLabel: String(raw.sourceLabel || 'Imported CropCast Report'),
    field: raw.field as FieldProfile,
    weather: raw.weather as WeatherObservation | undefined,
    briefHeadline: typeof raw.briefHeadline === 'string' ? raw.briefHeadline : undefined,
    drainageSummary: raw.drainageSummary as SoilDrainageEstimate | undefined,
    tasks: Array.isArray(raw.tasks) ? (raw.tasks as FarmTask[]) : [],
    feedbacks: Array.isArray(raw.feedbacks) ? (raw.feedbacks as FeedbackRecord[]) : [],
    dailySampleSummary: raw.dailySampleSummary,
  };
}

export async function importFarmReportFile(file: File): Promise<ImportedFarmReport> {
  const nameLower = file.name.toLowerCase();
  if (nameLower.endsWith('.json') || file.type === 'application/json') {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return validateImportedPayload(parsed);
  }

  if (nameLower.endsWith('.pdf') || file.type === 'application/pdf') {
    const buffer = await file.arrayBuffer();
    const rawLatin = new TextDecoder('latin1').decode(buffer);
    // Extract CROPCAST_REPORT_V1:<base64> from PDF metadata (handle possible PDF parenthesis escaping or line breaks)
    const cleanText = rawLatin.replace(/[\r\n]/g, '');
    const match = cleanText.match(/CROPCAST_REPORT_V1:([A-Za-z0-9+/=]+)/);
    if (!match || !match[1]) {
      throw new Error(
        'Tệp PDF này không chứa dữ liệu nhúng CropCast hợp lệ (chỉ hỗ trợ PDF được xuất trực tiếp từ CropCast hoặc tệp .json).'
      );
    }
    const jsonStr = base64ToUtf8(match[1]);
    const parsed = JSON.parse(jsonStr);
    return validateImportedPayload(parsed);
  }

  throw new Error('Vui lòng chọn tệp báo cáo định dạng .pdf hoặc .json được xuất từ CropCast.');
}
