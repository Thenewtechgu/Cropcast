import { FieldProfile, FarmTask, FeedbackRecord, WeatherObservation } from '../types';
import { findNearestNasaGrid, isWithinVietnamTerritory } from '../data/nasaVietnamGrid';
import { analyzeFieldAgronomy, generateTasksFromBrief } from './agronomyEngine';

const STORAGE_KEYS = {
  FIELDS: 'agrinasa_fields',
  ACTIVE_FIELD_ID: 'agrinasa_active_field_id',
  TASKS: 'agrinasa_tasks',
  FEEDBACK: 'agrinasa_feedback',
  CURRENT_WEATHER_SIM: 'agrinasa_weather_sim',
};

// Default seed fields for realistic farmer onboarding demonstration
export const DEFAULT_FIELDS: FieldProfile[] = [
  {
    id: 'FIELD_01_VEG',
    name: 'Thửa 1: Cải xanh Đông Xuân',
    province: 'Hà Nội',
    district: 'Mê Linh',
    lat: 21.18,
    lon: 105.71,
    areaHa: 0.6,
    soilType: 'clay',
    soilCharacteristics: {
      drainage: 'slow',
      holdsWater: true,
      proneToFlooding: true,
      ph: 6.2,
      customNote: 'Đất phù sa pha sét sông Hồng, giữ ẩm lâu, sau mưa dễ đọng vũng rãnh.',
    },
    waterSource: {
      type: 'pond',
      isStable: true,
      observation: 'normal',
      hasTestResult: false,
      salinityRisk: false,
      notes: 'Ao chứa nước mưa và kênh dẫn nội đồng, nguồn nước tương đối sạch.',
    },
    crop: {
      seedFamily: 'brassicaceae',
      name: 'Rau cải xanh',
      category: 'vegetable',
      variety: 'Cải ngọt Trang Nông F1',
      plantingDate: '2026-11-02',
      currentStage: 'Cây con (2-3 lá thật)',
      stageIndex: 1,
      farmingMethod: 'Theo hướng VietGAP',
      irrigationMethod: 'Tưới ô doa / phun sương thủ công',
      lastFertilizerDate: '2026-11-05',
      healthStatus: 'healthy',
    },
    primaryGoal: 'minimize_risk',
    inspectTime: 'morning',
    notificationMethod: 'in_app',
    nasaGrid: {
      cellId: 'NASA_VN_001',
      lat: 21.0,
      lon: 105.5,
      distanceKm: 29.8,
    },
    adaptiveMemory: {
      soilAdjustment: 'Đất giữ nước cao, thoát chậm',
      irrigationSensitivity: 'lower',
      consecutiveDryAlerts: 0,
    },
  },
  {
    id: 'FIELD_02_CORN',
    name: 'Thửa 2: Bắp ngô lai F1',
    province: 'Hưng Yên',
    district: 'Khoái Châu',
    lat: 20.84,
    lon: 105.98,
    areaHa: 1.5,
    soilType: 'sand',
    soilCharacteristics: {
      drainage: 'fast',
      holdsWater: false,
      proneToFlooding: false,
      ph: 6.5,
      customNote: 'Đất bãi bồi ven sông pha cát nhiều, thoát nước nhanh, khô hạn nhanh sau 1 ngày nắng.',
    },
    waterSource: {
      type: 'well',
      isStable: true,
      observation: 'clear',
      hasTestResult: true,
      salinityRisk: false,
      notes: 'Giếng khoan sâu 35m nước trong, pH giếng 6.8.',
    },
    crop: {
      seedFamily: 'poaceae',
      name: 'Ngô (Bắp)',
      category: 'maize',
      variety: 'NK7328 BT/GT',
      plantingDate: '2026-10-15',
      currentStage: 'Vươn lóng mạnh (7-8 lá)',
      stageIndex: 2,
      farmingMethod: 'Canh tác truyền thống cải tiến',
      irrigationMethod: 'Tưới rãnh thấm',
      lastFertilizerDate: '2026-10-28',
      healthStatus: 'healthy',
    },
    primaryGoal: 'save_water',
    inspectTime: 'morning',
    notificationMethod: 'in_app',
    nasaGrid: {
      cellId: 'NASA_VN_002',
      lat: 21.0,
      lon: 106.0,
      distanceKm: 18.2,
    },
    adaptiveMemory: {
      soilAdjustment: 'Đất cát khô rất nhanh, cần chú ý tầng rễ',
      irrigationSensitivity: 'higher',
      consecutiveDryAlerts: 1,
    },
  },
  {
    id: 'FIELD_03_RICE',
    name: 'Thửa 3: Lúa ST25 Vụ Đông Xuân',
    province: 'An Giang',
    district: 'Thoại Sơn',
    lat: 10.28,
    lon: 105.25,
    areaHa: 2.8,
    soilType: 'alluvial',
    soilCharacteristics: {
      drainage: 'moderate',
      holdsWater: true,
      proneToFlooding: false,
      ph: 5.8,
      customNote: 'Đất phù sa sông Hậu màu mỡ, giữ nước và giữ phân rất tốt.',
    },
    waterSource: {
      type: 'river',
      isStable: true,
      observation: 'turbid',
      hasTestResult: true,
      salinityRisk: false,
      notes: 'Hệ thống kênh thủy lợi cấp 2, phù sa dồi dào, kiểm soát được cống.',
    },
    crop: {
      seedFamily: 'poaceae',
      name: 'Lúa nước',
      category: 'rice',
      variety: 'ST25 (Gạo ngon nhất thế giới)',
      plantingDate: '2026-10-20',
      currentStage: 'Đẻ nhánh rộ (Nhu cầu nước nông)',
      stageIndex: 2,
      farmingMethod: 'Quy trình 1 phải 5 giảm',
      irrigationMethod: 'Tưới ngập - lộ - phơi xen kẽ',
      lastFertilizerDate: '2026-11-01',
      healthStatus: 'healthy',
    },
    primaryGoal: 'stabilize_yield',
    inspectTime: 'afternoon',
    notificationMethod: 'in_app',
    nasaGrid: {
      cellId: 'NASA_VN_078',
      lat: 10.5,
      lon: 105.0,
      distanceKm: 36.1,
    },
  },
];

// Default weather baseline (synchronized with live Open-Meteo & 25-year 2001-2025 baseline)
export const DEFAULT_WEATHER_SIM: WeatherObservation = {
  temp: 23.8,
  minTemp: 19.6,
  maxTemp: 28.4,
  rain: 6.2,
  humidity: 80,
  gwettop: 0.64,
  gwetroot: 0.67,
  solarRadiation: 15.6,
  windSpeed: 2.4,
  dewPointC: 20.1,
  vpdHpa: 6.1,
  vpdMinHpa: 2.3,
  vpdMaxHpa: 11.8,
  et0MmDay: 3.6,
  observationDate: 'Hôm nay (Cập nhật tự động)',
  isRealtimeAvailable: true,
  source: 'LIVE_WEATHER',
  historicalBaseline: {
    avgTemp: 23.6,
    avgRain: 5.4,
    avgHumidity: 79,
    avgGwettop: 0.58,
    avgGwetroot: 0.62,
    avgSolar: 16.0,
    avgDewPointC: 19.8,
    avgVpdHpa: 6.4,
    sampleYears: 25,
  },
};

export const StorageService = {
  getFields(): FieldProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FIELDS);
      if (data) {
        const parsed = JSON.parse(data) as FieldProfile[];
        return parsed.filter(
          (f) => !['FIELD_01_VEG', 'FIELD_02_CORN', 'FIELD_03_RICE'].includes(f.id)
        );
      }
    } catch (e) {
      console.error('Failed to read fields from localStorage', e);
    }
    return [];
  },

  saveFields(fields: FieldProfile[]) {
    localStorage.setItem(STORAGE_KEYS.FIELDS, JSON.stringify(fields));
  },

  getActiveFieldId(): string {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_FIELD_ID);
    const fields = this.getFields();
    if (saved && fields.some((f) => f.id === saved)) return saved;
    return fields[0]?.id || '';
  },

  setActiveFieldId(id: string) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_FIELD_ID, id);
  },

  getActiveField(): FieldProfile | undefined {
    const fields = this.getFields();
    const activeId = this.getActiveFieldId();
    return fields.find((f) => f.id === activeId) || fields[0];
  },

  addField(fieldData: Omit<FieldProfile, 'id' | 'nasaGrid'>): FieldProfile {
    const check = isWithinVietnamTerritory(fieldData.lat, fieldData.lon);
    if (!check.valid) {
      throw new Error(check.reasonVi || 'Vị trí ruộng phải nằm trong lãnh thổ Việt Nam.');
    }
    const { cell, distanceKm } = findNearestNasaGrid(fieldData.lat, fieldData.lon);
    const newField: FieldProfile = {
      ...fieldData,
      id: `FIELD_${Date.now()}`,
      nasaGrid: {
        cellId: cell.cellId,
        lat: cell.lat,
        lon: cell.lon,
        distanceKm,
      },
    };

    const fields = this.getFields();
    fields.push(newField);
    this.saveFields(fields);
    this.setActiveFieldId(newField.id);

    // Generate initial tasks
    const brief = analyzeFieldAgronomy(newField, this.getWeather());
    const tasks = generateTasksFromBrief(brief, newField);
    this.addTasks(tasks);

    return newField;
  },

  updateField(updated: FieldProfile) {
    const check = isWithinVietnamTerritory(updated.lat, updated.lon);
    if (!check.valid) {
      throw new Error(check.reasonVi || 'Vị trí ruộng phải nằm trong lãnh thổ Việt Nam.');
    }
    const { cell, distanceKm } = findNearestNasaGrid(updated.lat, updated.lon);
    const enriched: FieldProfile = {
      ...updated,
      nasaGrid: {
        cellId: cell.cellId,
        lat: cell.lat,
        lon: cell.lon,
        distanceKm,
      },
    };
    const fields = this.getFields().map(f => (f.id === enriched.id ? enriched : f));
    this.saveFields(fields);
  },

  deleteField(fieldId: string) {
    const fields = this.getFields().filter(f => f.id !== fieldId);
    this.saveFields(fields);
    if (fields.length > 0) {
      this.setActiveFieldId(fields[0].id);
    }
  },

  getWeather(): WeatherObservation {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_WEATHER_SIM);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_WEATHER_SIM;
  },

  setWeather(w: WeatherObservation) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_WEATHER_SIM, JSON.stringify(w));
  },

  getTasks(): FarmTask[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (data) return JSON.parse(data);
    } catch {}
    return [];
  },

  saveTasks(tasks: FarmTask[]) {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  },

  addTasks(newTasks: FarmTask[]) {
    const current = this.getTasks();
    const merged = [...newTasks, ...current];
    this.saveTasks(merged);
  },

  updateTaskStatus(taskId: string, status: FarmTask['status'], note?: string) {
    const tasks = this.getTasks().map(t => {
      if (t.id === taskId) {
        return { ...t, status, farmerNote: note || t.farmerNote };
      }
      return t;
    });
    this.saveTasks(tasks);
  },

  getFeedbackHistory(): FeedbackRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FEEDBACK);
      if (data) return JSON.parse(data);
    } catch {}
    return [];
  },

  addFeedback(feedback: Omit<FeedbackRecord, 'id' | 'timestamp'>): FeedbackRecord {
    const records = this.getFeedbackHistory();
    const record: FeedbackRecord = {
      ...feedback,
      id: `FB_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    records.unshift(record);
    localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(records));

    // Adaptive Learning Check: Update Field Profile Memory
    const field = this.getActiveField();
    if (field && feedback.feedbackType === 'soil_still_dry') {
      field.adaptiveMemory = {
        ...field.adaptiveMemory,
        soilAdjustment: 'Phản hồi nhiều lần đất khô nhanh: AI nâng độ nhạy tưới và hạ giả định giữ ẩm',
        irrigationSensitivity: 'higher',
        consecutiveDryAlerts: (field.adaptiveMemory?.consecutiveDryAlerts || 0) + 1,
      };
      this.updateField(field);
    } else if (field && feedback.feedbackType === 'soil_too_wet') {
      field.adaptiveMemory = {
        ...field.adaptiveMemory,
        soilAdjustment: 'Phản hồi đất quá ẩm/đọng nước: AI tăng cường cảnh báo thoát nước và hoãn tưới',
        irrigationSensitivity: 'lower',
      };
      this.updateField(field);
    }

    return record;
  },
};
