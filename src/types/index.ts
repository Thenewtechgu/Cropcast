export type SoilType =
  | 'sand'
  | 'sandy_loam'
  | 'loam'
  | 'sandy_clay_loam'
  | 'clay_loam'
  | 'clay'
  | 'alluvial'
  | 'basalt'
  | 'ferralsol'
  | 'gray_degraded'
  | 'acid_sulfate'
  | 'saline'
  | 'peat_muck'
  | 'limestone'
  | 'gravelly'
  | 'unknown';

export type WaterSourceType =
  | 'river'
  | 'pond'
  | 'well'
  | 'tap'
  | 'rain'
  | 'other';

export type CropCategory =
  | 'rice'
  | 'vegetable'
  | 'maize'
  | 'fruit'
  | 'industrial'
  | 'legume'
  | 'tuber';

export type SeedFamilyId =
  | 'poaceae'
  | 'fabaceae'
  | 'brassicaceae'
  | 'solanaceae'
  | 'cucurbitaceae'
  | 'other_perennial';

export interface NasaGridCell {
  cellId: string;
  lat: number;
  lon: number;
  region: string;
  subRegion: string;
  climatology21Yr: {
    avgTemp: number;
    minTempAnnual: number;
    maxTempAnnual: number;
    annualRainfallMm: number;
    avgGwetroot: number;
    avgGwettop: number;
    avgRh2m: number;
    avgSolarDwn: number;
    riskMonthsCold: number[];
    riskMonthsDrought: number[];
    riskMonthsFlood: number[];
  };
}

export interface FieldProfile {
  id: string;
  ownerId?: string;
  ownerName?: string;
  sharedWithEmails?: string[];
  sharedWithUids?: string[];
  activeShareToken?: string;
  isSharedWithMe?: boolean;
  name: string;
  province: string;
  district: string;
  lat: number;
  lon: number;
  areaHa: number;
  // Soil
  soilType: SoilType;
  soilCharacteristics: {
    drainage: 'fast' | 'moderate' | 'slow';
    holdsWater: boolean;
    proneToFlooding: boolean;
    ph?: number;
    customNote?: string;
  };
  // Water
  waterSource: {
    type: WaterSourceType;
    isStable: boolean;
    observation: 'clear' | 'turbid' | 'odor' | 'normal';
    hasTestResult: boolean;
    salinityRisk: boolean;
    notes?: string;
  };
  // Crop
  crop: {
    seedFamily?: SeedFamilyId;
    name: string;
    category: CropCategory;
    variety: string;
    plantingDate: string;
    currentStage: string;
    stageIndex: number;
    farmingMethod: string;
    irrigationMethod: string;
    lastFertilizerDate?: string;
    healthStatus: 'healthy' | 'stressed' | 'pest_risk' | 'unknown';
  };
  // Goals
  primaryGoal: 'save_water' | 'minimize_risk' | 'stabilize_yield' | 'optimize_cost';
  inspectTime: 'morning' | 'afternoon' | 'anytime';
  notificationMethod: 'in_app' | 'email' | 'push';
  // Associated NASA Grid
  nasaGrid: {
    cellId: string;
    lat: number;
    lon: number;
    distanceKm: number;
  };
  // Learned farmer behavioral adjustments
  adaptiveMemory?: {
    soilAdjustment?: string;
    irrigationSensitivity?: 'higher' | 'normal' | 'lower';
    consecutiveDryAlerts?: number;
    lastFeedbackDate?: string;
  };
}

export interface FieldShareRecord {
  id: string;
  fieldId: string;
  fieldName: string;
  ownerId: string;
  ownerName: string;
  shareType: 'link' | 'email';
  targetEmail?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminUserSummary {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  createdAt: string;
  fieldCount: number;
  totalAreaHa: number;
  isAdmin: boolean;
}

export interface AdminFieldSummary {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  province: string;
  district: string;
  lat: number;
  lon: number;
  areaHa: number;
  cropName: string;
  cropVariety: string;
  currentStage: string;
  soilType: SoilType;
  waterSourceType: WaterSourceType;
  nasaCellId: string;
  nasaDistanceKm: number;
  sharedCount: number;
  createdAt: string;
}

export interface AdminPlatformStats {
  totalUsers: number;
  totalFields: number;
  totalAreaHa: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  totalFeedbacks: number;
  totalActiveShares: number;
  totalNasaDatasets: number;
  users: AdminUserSummary[];
  allFields: AdminFieldSummary[];
  fieldsByProvince: Array<{ province: string; count: number; areaHa: number }>;
  fieldsByCrop: Array<{ cropName: string; count: number }>;
  fieldsBySoil: Array<{ soilType: string; count: number }>;
}

export type DataProvenanceType =
  | 'NASA_HISTORICAL'
  | 'NASA_CURRENT'
  | 'EXTERNAL_FORECAST'
  | 'USER_OBSERVATION'
  | 'AI_INFERENCE'
  | 'UNVERIFIED';

export interface ProvenanceBadge {
  label: string;
  type: DataProvenanceType;
  description: string;
}

export interface WeatherObservation {
  temp: number;
  minTemp: number;
  maxTemp: number;
  rain: number;
  humidity: number;
  gwettop: number;
  gwetroot: number;
  solarRadiation: number;
  windSpeed: number;
  observationDate: string;
  isRealtimeAvailable: boolean;
  source: 'NASA_POWER_UPDATED' | 'USER_OBSERVATION' | 'WEATHER_STATION' | 'ESTIMATED_CLIMATE';
  historicalBaseline: {
    avgTemp: number;
    avgRain: number;
    avgHumidity: number;
    avgGwettop: number;
    avgGwetroot: number;
    avgSolar: number;
    sampleYears: number;
  };
}

export interface RecommendationAction {
  id: string;
  title: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  dataBasis: string;
}

export interface DailyAgronomicBrief {
  id: string;
  fieldId: string;
  timestamp: string;
  headline: string;
  riskLevel: 'LOW' | 'CAUTION' | 'WARNING' | 'CRITICAL';
  situation: string;
  analysis: string;
  topActions: RecommendationAction[];
  postponeActions: string[];
  explanation: string;
  uncertainties: string;
  nextCheckTime: string;
  provenances: ProvenanceBadge[];
}

export interface FarmTask {
  id: string;
  ownerId?: string;
  fieldId: string;
  title: string;
  scheduledTime: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  triggerData: string;
  status: 'pending' | 'completed' | 'postponed' | 'skipped';
  createdAt: string;
  farmerNote?: string;
}

export type FeedbackType =
  | 'helpful'
  | 'not_suitable'
  | 'followed'
  | 'not_followed'
  | 'soil_still_dry'
  | 'soil_too_wet'
  | 'crop_healthy'
  | 'crop_abnormal';

export interface FeedbackRecord {
  id: string;
  ownerId?: string;
  fieldId: string;
  timestamp: string;
  feedbackType: FeedbackType;
  userComment?: string;
  systemActionTaken?: string;
  appliedToProfile: boolean;
}

export interface PlantingRiskEvaluation {
  cropName: string;
  variety: string;
  month: number;
  status: 'optimal' | 'caution' | 'risk' | 'insufficient';
  score: number;
  yearsSurveyed: number;
  adverseYearsCount: number;
  adverseDaysAvg: number;
  thresholdCondition: string;
  summaryExplanation: string;
}

export interface DataImportRecord {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  storagePath?: string;
  recordCount: number;
  cellCount: number;
  startDate: string;
  endDate: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  version: string;
  importedBy: string;
  createdAt: string;
  errorSummary?: string;
}

export interface SyncLogRecord {
  id: string;
  syncType: 'NASA_POWER_API' | 'CSV_UPLOAD' | 'MANUAL_SYNC';
  targetCellsCount: number;
  recordsSynced: number;
  startTime: string;
  endTime?: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
  latestNasaDate?: string;
  errorMessage?: string;
  details?: Record<string, any>;
}

export interface CentralDataStatus {
  isConnectedToSupabase: boolean;
  supabaseUrl?: string;
  latestNasaDate: string;
  lastSyncTime: string;
  dataSource: string;
  status: 'LATEST' | 'SYNCING' | 'MISSING_DATA' | 'ERROR';
  activeVersion: string;
  totalRecords: number;
  autoSyncEnabled: boolean;
  storageBucketReady: boolean;
  affectedFarmsCount: number;
}

export interface CsvPreviewResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  uniqueCells: number;
  startDate: string;
  endDate: string;
  indicatorsDetected: string[];
  sampleRows: Array<Record<string, any>>;
  errors: string[];
  duplicateCount: number;
}

export type FarmerPriorityId =
  | 'water_saving'
  | 'nitrogen_fixing'
  | 'erosion_control'
  | 'pest_break'
  | 'supplemental_income'
  | 'organic_matter';

export interface FarmerConstraints {
  waterAvailability: 'abundant' | 'seasonal_limited' | 'scarce';
  equipmentAccess: 'mechanized' | 'basic_manual';
  marketPreference: 'cash_crop' | 'forage_livestock' | 'mixed_family';
}

export interface BareFieldMonthAnalysis {
  month: number;
  monthLabel: string;
  fieldState: 'active_crop' | 'harvest_transition' | 'bare_fallow';
  stressLevel: 'low' | 'moderate' | 'high';
  dominantRisk: string;
  soilMoisturePct: number;
  evaporationRisk: 'Thấp' | 'Trung bình' | 'Cao';
  frostOrColdRisk: boolean;
  extremeRainRisk: boolean;
  recommendationNote: string;
}

export interface RotationStrategy {
  id: string;
  isCurrentBaseline: boolean;
  title: string;
  sequenceSummary: string;
  nextCropFamily: SeedFamilyId;
  nextCropName: string;
  suitabilityScore: number;
  whySuggested: string;
  supportingEvidence: string[];
  benefits: {
    nutrientCycling: string;
    waterDemand: string;
    erosionAndOrganicMatter: string;
    pestCycleDisruption: string;
    forageAndIncome: string;
  };
  informationGaps: string[];
  localReviewRisks: string[];
  alignedPriorities: FarmerPriorityId[];
}

export interface AppUser {
  uid: string;
  displayName: string;
  username?: string;
  email: string;
  photoURL?: string;
  emailVerified: boolean;
  isAdmin: boolean;
  authMode?: 'firebase' | 'local_server';
}
