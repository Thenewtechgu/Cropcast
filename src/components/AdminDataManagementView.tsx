import React, { useState, useEffect, useMemo, useRef } from 'react';
import { parseJsonSafely } from '../services/httpClient';
import {
  Database,
  CloudUpload,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  ShieldCheck,
  Server,
  Layers,
  Eye,
  Download,
  Info,
  Check,
  Copy,
  Lock,
  Users,
  MapPin,
  BarChart3,
  Share2,
  PlusCircle,
  Loader2,
  UserCheck,
  Sprout,
  FolderPlus,
  FolderOpen,
  Search,
  Trash2,
  X,
  Droplets,
  Navigation,
} from 'lucide-react';
import {
  AdminFieldSummary,
  AdminPlatformStats,
  CentralDataStatus,
  DataImportRecord,
  SyncLogRecord,
  CsvPreviewResult,
  WaterSourceType,
} from '../types';
import { auth, BOOTSTRAP_ADMIN_EMAIL } from '../firebase';
import { FirestoreService } from '../services/firestoreService';
import { CsvQueueStorage, StoredCsvSessionState } from '../services/csvQueueStorage';
import { ALL_NASA_CELLS, getLocalizedRegionName } from '../data/nasaVietnamGrid';
import {
  getPlantDisplayName,
  getCommonStageLabel,
  getCommonVarietyLabel,
} from '../data/cropTaxonomy';
import { getSoilLabel } from '../services/agronomyEngine';
import { useLanguage, AppLanguage } from '../contexts/LanguageContext';
import { SatelliteMap } from './SatelliteMap';

const ADMIN_TAB_STORAGE_KEY = 'cropcast_admin_tab';

interface CsvProgressState {
  active: boolean;
  phase: 'reading' | 'analyzing' | 'importing';
  totalFiles: number;
  processedFiles: number;
  totalBytes: number;
  processedBytes: number;
  processedRows?: number;
  currentFileName: string;
  percent: number;
  etaSeconds: number | null;
  startedAt: number;
}

function formatEta(seconds: number | null, lang: AppLanguage = 'vi'): string {
  if (seconds === null || !Number.isFinite(seconds)) {
    return lang === 'en' ? 'Calculating...' : 'Đang tính toán...';
  }
  if (seconds <= 1) return lang === 'en' ? '~1s left' : 'Còn ~1 giây';
  if (seconds < 60) {
    const s = Math.ceil(seconds);
    return lang === 'en' ? `~${s}s left` : `Còn ~${s} giây`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return lang === 'en' ? `~${mins}m ${secs}s left` : `Còn ~${mins} phút ${secs} giây`;
}

function formatBytesMb(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface AdminDataManagementViewProps {
  onDatasetUpdated?: () => void;
}

interface QueuedCsvFile {
  key: string;
  fileName: string;
  folderName: string;
  size: number;
  content: string;
}

interface BatchPreviewResponse {
  totalFiles: number;
  totalFolders: number;
  folderSummaries: Array<{
    folderName: string;
    fileCount: number;
    validRows: number;
    errors: string[];
  }>;
  preview: CsvPreviewResult;
  representativeOverrides: Array<{
    cell_id: string;
    date: string;
    indicator_code: string;
    value: number;
  }>;
}

function getNasaIndicators(lang: AppLanguage) {
  return [
    { code: 'T2M', label: lang === 'en' ? 'Mean Temp 2m (°C)' : 'Nhiệt độ TB 2m (°C)', defaultVal: '26.5' },
    { code: 'T2M_MIN', label: lang === 'en' ? 'Min Temp (°C)' : 'Nhiệt độ tối thiểu (°C)', defaultVal: '21.0' },
    { code: 'T2M_MAX', label: lang === 'en' ? 'Max Temp (°C)' : 'Nhiệt độ tối đa (°C)', defaultVal: '32.0' },
    { code: 'PRECTOTCORR', label: lang === 'en' ? 'Bias-Corrected Precip (mm/day)' : 'Lượng mưa hiệu chỉnh (mm/ngày)', defaultVal: '12.4' },
    { code: 'GWETROOT', label: lang === 'en' ? 'Root-Zone Soil Wetness (0–1)' : 'Độ ẩm đất vùng rễ (0–1)', defaultVal: '0.72' },
    { code: 'GWETTOP', label: lang === 'en' ? 'Surface Soil Wetness (0–1)' : 'Độ ẩm đất tầng mặt (0–1)', defaultVal: '0.68' },
    { code: 'RH2M', label: lang === 'en' ? 'Relative Humidity (%)' : 'Độ ẩm không khí (%)', defaultVal: '84' },
    { code: 'ALLSKY_SFC_SW_DWN', label: lang === 'en' ? 'Solar Irradiance (MJ/m²/day)' : 'Bức xạ mặt trời (MJ/m²/ngày)', defaultVal: '17.5' },
  ];
}

function getWaterLabels(lang: AppLanguage): Record<WaterSourceType, string> {
  if (lang === 'en') {
    return {
      river: 'River / Canal',
      pond: 'Pond / Reservoir',
      well: 'Borehole / Dug Well',
      tap: 'Piped / Municipal Water',
      rain: 'Rain-fed',
      other: 'Other water source',
    };
  }
  return {
    river: 'Nước sông / kênh',
    pond: 'Ao / hồ chứa',
    well: 'Giếng khoan / giếng đào',
    tap: 'Nước máy / thủy cục',
    rain: 'Phụ thuộc nước mưa',
    other: 'Nguồn nước khác',
  };
}

function getFolderDisplayName(folderName: string, lang: AppLanguage): string {
  if (lang !== 'en') return folderName;
  const map: Record<string, string> = {
    'Tệp tải lẻ': 'Loose files',
    'Thư mục CSV': 'CSV Folder',
    'Tệp CSV chọn trực tiếp': 'Directly selected CSV files',
    'Tệp kéo thả': 'Dropped files',
  };
  return map[folderName] || folderName;
}

function isCsvOrTextFile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.csv') || lower.endsWith('.txt');
}

function readFileAsText(file: File, lang: AppLanguage = 'vi'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () =>
      reject(new Error(lang === 'en' ? `Unable to read file ${file.name}` : `Không thể đọc tệp ${file.name}`));
    reader.readAsText(file);
  });
}

async function readAllDirectoryEntries(dirReader: any): Promise<any[]> {
  const allEntries: any[] = [];
  while (true) {
    const batch: any[] = await new Promise((resolve, reject) => {
      dirReader.readEntries(resolve, reject);
    });
    if (!batch || batch.length === 0) break;
    allEntries.push(...batch);
  }
  return allEntries;
}

async function collectFilesFromEntry(
  entry: any,
  inheritedFolderName: string
): Promise<Array<{ file: File; folderName: string }>> {
  if (!entry) return [];

  if (entry.isFile) {
    const file: File = await new Promise((resolve, reject) => {
      entry.file(resolve, reject);
    });
    if (!isCsvOrTextFile(file.name)) return [];
    return [{ file, folderName: inheritedFolderName || 'Tệp tải lẻ' }];
  }

  if (entry.isDirectory) {
    const nextFolderName = inheritedFolderName
      ? `${inheritedFolderName}/${entry.name}`
      : entry.name;
    const reader = entry.createReader();
    const entries = await readAllDirectoryEntries(reader);
    const nested = await Promise.all(
      entries.map((child) => collectFilesFromEntry(child, nextFolderName))
    );
    return nested.flat();
  }

  return [];
}

export const AdminDataManagementView: React.FC<AdminDataManagementViewProps> = ({
  onDatasetUpdated,
}) => {
  const { lang, t } = useLanguage();
  const locale = lang === 'en' ? 'en-US' : 'vi-VN';
  const nasaIndicators = useMemo(() => getNasaIndicators(lang), [lang]);
  const waterLabels = useMemo(() => getWaterLabels(lang), [lang]);

  const [adminTab, setAdminTabState] = useState<'overview' | 'fields' | 'users' | 'nasa'>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_TAB_STORAGE_KEY);
      if (saved === 'overview' || saved === 'fields' || saved === 'users' || saved === 'nasa') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'overview';
  });
  const setAdminTab = (next: 'overview' | 'fields' | 'users' | 'nasa') => {
    setAdminTabState(next);
    try {
      localStorage.setItem(ADMIN_TAB_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };
  const [platformStats, setPlatformStats] = useState<AdminPlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [togglingAdminUid, setTogglingAdminUid] = useState<string | null>(null);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminActionSuccess, setAdminActionSuccess] = useState<string | null>(null);

  // All-fields filter & inspector state
  const [fieldSearch, setFieldSearch] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('ALL');
  const [cropFilter, setCropFilter] = useState('ALL');
  const [inspectingField, setInspectingField] = useState<AdminFieldSummary | null>(null);

  const [status, setStatus] = useState<CentralDataStatus | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLogRecord[]>([]);
  const [imports, setImports] = useState<DataImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Manual single NASA observation state
  const [manualCellId, setManualCellId] = useState(ALL_NASA_CELLS[0]?.cellId || 'NASA_VN_001');
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualIndicator, setManualIndicator] = useState('T2M');
  const [manualValue, setManualValue] = useState('26.5');
  const [savingManual, setSavingManual] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);

  // Multi-folder / multi-file NASA POWER CSV batch queue state + reload persistence + ETA bar
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<number | null>(null);
  const stagedSessionRef = useRef<{ signature: string; sessionId: string } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [readingQueue, setReadingQueue] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<QueuedCsvFile[]>([]);
  const queuedFilesRef = useRef<QueuedCsvFile[]>([]);
  const [batchPreview, setBatchPreview] = useState<BatchPreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState<CsvProgressState | null>(null);
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);
  const [lastCompletedBatch, setLastCompletedBatch] =
    useState<StoredCsvSessionState['lastCompletedBatch']>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Rollback state
  const [rollbackSuccessMsg, setRollbackSuccessMsg] = useState<string | null>(null);
  const [confirmRollbackVer, setConfirmRollbackVer] = useState<string | null>(null);

  // SQL schema copy state
  const [copiedSql, setCopiedSql] = useState(false);

  const getAdminHeaders = async (includeJson = false): Promise<Record<string, string>> => {
    const token = await auth.currentUser?.getIdToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (includeJson) headers['Content-Type'] = 'application/json';
    return headers;
  };

  const fetchPlatformStats = async () => {
    try {
      setStatsLoading(true);
      setStatsError(null);
      const data = await FirestoreService.getAdminPlatformStats();
      setPlatformStats(data);
    } catch (err: any) {
      setStatsError(
        err?.message ||
          t('Không thể tải thống kê người dùng và thửa ruộng.', 'Unable to load user and field statistics.')
      );
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const headers = await getAdminHeaders();
      const [resStatus, resLogs, fsDatasets, fsSyncLogs] = await Promise.all([
        fetch('/api/admin/status', { headers }),
        fetch('/api/admin/sync-logs', { headers }),
        FirestoreService.getAdminNasaDatasets(),
        FirestoreService.getAdminSyncLogs(),
      ]);

      const serverStatus: CentralDataStatus | null = resStatus.ok ? await parseJsonSafely<CentralDataStatus>(resStatus) : null;
      const serverLogsJson = resLogs.ok ? await parseJsonSafely<any>(resLogs) : { logs: [], imports: [] };

      // Merge sync logs (server + persisted Firestore logs)
      const serverLogs: SyncLogRecord[] = serverLogsJson.logs || [];
      const mergedLogsMap = new Map<string, SyncLogRecord>();
      for (const l of serverLogs) mergedLogsMap.set(l.id, l);
      for (const fl of fsSyncLogs) {
        const dup = Array.from(mergedLogsMap.values()).some(
          (existing) =>
            existing.syncType === fl.syncType &&
            existing.recordsSynced === fl.recordsSynced &&
            Math.abs(new Date(existing.startTime).getTime() - new Date(fl.startTime).getTime()) < 15000
        );
        if (!dup) {
          mergedLogsMap.set(fl.id, {
            id: fl.id,
            syncType: fl.syncType as any,
            targetCellsCount: fl.targetCellsCount,
            recordsSynced: fl.recordsSynced,
            startTime: fl.startTime,
            endTime: fl.endTime,
            status: fl.status,
            latestNasaDate: fl.latestNasaDate,
          });
        }
      }
      const mergedLogs = Array.from(mergedLogsMap.values()).sort((a, b) =>
        b.startTime.localeCompare(a.startTime)
      );
      setSyncLogs(mergedLogs);

      // Merge data imports (server + persisted Firestore nasa_datasets)
      const serverImports: DataImportRecord[] = serverLogsJson.imports || [];
      const mergedImportsByVer = new Map<string, DataImportRecord>();
      for (const imp of serverImports) mergedImportsByVer.set(imp.version, imp);
      let fsExtraRecords = 0;
      for (const ds of fsDatasets) {
        if (!mergedImportsByVer.has(ds.version)) {
          fsExtraRecords += Number(ds.recordCount) || 0;
          const createdIso = ds.createdAt?.toDate?.()?.toISOString() || new Date().toISOString();
          mergedImportsByVer.set(ds.version, {
            id: ds.id,
            fileName: ds.fileName,
            fileSizeBytes: 0,
            storagePath: `firestore/nasa_datasets/${ds.id}`,
            recordCount: ds.recordCount,
            cellCount: ds.cellCount,
            startDate: ds.startDate,
            endDate: ds.endDate,
            status: ds.status,
            version: ds.version,
            importedBy: ds.uploadedBy || 'admin',
            createdAt: createdIso,
          });
        }
      }
      const mergedImports = Array.from(mergedImportsByVer.values()).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      setImports(mergedImports);

      if (serverStatus) {
        const latestCompletedFs = fsDatasets.find((d) => d.status === 'COMPLETED');
        setStatus({
          ...serverStatus,
          totalRecords: serverStatus.totalRecords + fsExtraRecords,
          activeVersion:
            serverStatus.activeVersion === 'v2026.11-daily' && latestCompletedFs
              ? latestCompletedFs.version
              : serverStatus.activeVersion,
        });
      }
    } catch (err) {
      console.error('Failed to fetch admin data', err);
    } finally {
      setLoading(false);
    }
  };

  const finalizeCompletedImportJob = async (job: any) => {
    const data = job.result;
    if (!data) return;

    if (auth.currentUser) {
      const safeOverrides = (data.batchSummary?.representativeOverrides || [])
        .slice(0, 300)
        .map((r: any) => ({
          cell_id: String(r.cell_id || ''),
          date: String(r.date || ''),
          indicator_code: String(r.indicator_code || ''),
          value: Number(r.value) || 0,
        }));

      await FirestoreService.saveNasaDatasetUpload(auth.currentUser.uid, {
        version: String(data.importRecord.version || `v${Date.now()}`).slice(0, 80),
        fileName: String(data.importRecord.fileName || 'NASA POWER Batch CSV').slice(0, 200),
        recordCount: Number(data.importRecord.recordCount) || 0,
        cellCount: Number(data.importRecord.cellCount) || 0,
        startDate: String(data.importRecord.startDate || '').slice(0, 20),
        endDate: String(data.importRecord.endDate || '').slice(0, 20),
        status: 'COMPLETED',
        sampleOverrides: safeOverrides,
      });
      await FirestoreService.saveNasaSyncLog(auth.currentUser.uid, {
        syncType: 'CSV_UPLOAD',
        targetCellsCount: Number(data.importRecord.cellCount) || 0,
        recordsSynced: Number(data.importRecord.recordCount) || 0,
        status: 'SUCCESS',
        latestNasaDate: String(data.importRecord.endDate || '').slice(0, 20),
      });
    }

    const completedSummary: StoredCsvSessionState['lastCompletedBatch'] = {
      version: data.importRecord.version,
      totalFolders: data.batchSummary?.totalFolders || 1,
      totalFiles: data.batchSummary?.totalFiles || 1,
      validRows: Number(data.importRecord.recordCount) || 0,
      uniqueCells: Number(data.importRecord.cellCount) || 0,
      startDate: data.importRecord.startDate || '',
      endDate: data.importRecord.endDate || '',
      indicatorsDetected: data.batchSummary?.preview?.indicatorsDetected || [],
      sampleRows: data.batchSummary?.preview?.sampleRows || [],
      completedAt: new Date().toISOString(),
    };

    setLastCompletedBatch(completedSummary);
    setImportSuccessMsg(
      t(
        `Đã nhập thành công ${completedSummary.totalFolders} thư mục (${completedSummary.totalFiles} tệp CSV) với ${completedSummary.validRows.toLocaleString('vi-VN')} bản ghi vào kho NASA! Phiên bản: ${completedSummary.version}`,
        `Successfully imported ${completedSummary.totalFolders} folders (${completedSummary.totalFiles} CSV files) with ${completedSummary.validRows.toLocaleString('en-US')} records into the NASA warehouse! Version: ${completedSummary.version}`
      )
    );
    queuedFilesRef.current = [];
    setQueuedFiles([]);
    setBatchPreview(null);
    setCsvProgress(null);
    setImporting(false);

    await CsvQueueStorage.savePatch({
      queuedFiles: [],
      batchPreview: null,
      activeImportJobId: null,
      readingProgress: null,
      lastCompletedBatch: completedSummary,
    });

    onDatasetUpdated?.();
    fetchPlatformStats();
    fetchStatus();
  };

  const pollImportJob = async (jobId: string) => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    try {
      const headers = await getAdminHeaders();
      const res = await fetch(`/api/admin/import-job/${encodeURIComponent(jobId)}`, { headers });
      if (!res.ok) {
        setImporting(false);
        setCsvProgress(null);
        await CsvQueueStorage.savePatch({ activeImportJobId: null });
        return;
      }
      const { job } = await parseJsonSafely<any>(res);
      if (!job) return;

      if (job.status === 'RUNNING') {
        setImporting(true);
        setCsvProgress({
          active: true,
          phase: 'importing',
          totalFiles: job.totalFiles,
          processedFiles: job.processedFiles,
          totalBytes: job.totalBytes,
          processedBytes: job.processedBytes,
          processedRows: job.processedRows,
          currentFileName: job.currentFileName || '',
          percent: job.percent || 0,
          etaSeconds: job.etaSeconds ?? null,
          startedAt: job.startedAt,
        });
        pollTimerRef.current = window.setTimeout(() => {
          pollImportJob(jobId);
        }, 350);
      } else if (job.status === 'COMPLETED') {
        await finalizeCompletedImportJob(job);
      } else if (job.status === 'FAILED') {
        setImporting(false);
        setCsvProgress(null);
        setActionErrorMsg(
          job.error || t('Quá trình nhập CSV trên máy chủ gặp lỗi.', 'The server CSV import job failed.')
        );
        await CsvQueueStorage.savePatch({ activeImportJobId: null });
      }
    } catch {
      pollTimerRef.current = window.setTimeout(() => {
        pollImportJob(jobId);
      }, 1000);
    }
  };

  useEffect(() => {
    fetchPlatformStats();
    fetchStatus();

    let mounted = true;
    (async () => {
      const saved = await CsvQueueStorage.loadState();
      if (!mounted) return;

      if (saved?.lastCompletedBatch) {
        setLastCompletedBatch(saved.lastCompletedBatch);
      }

      if (saved?.activeImportJobId) {
        setRestoredNotice(
          t(
            'Đã khôi phục thanh trạng thái ETA tiến trình nhập CSV sau khi tải lại trang.',
            'Restored the CSV import ETA progress bar after page reload.'
          )
        );
        pollImportJob(saved.activeImportJobId);
      } else if (saved?.queuedFiles && saved.queuedFiles.length > 0) {
        queuedFilesRef.current = saved.queuedFiles;
        setQueuedFiles(saved.queuedFiles);
        if (saved.batchPreview) {
          setBatchPreview(saved.batchPreview);
          setRestoredNotice(
            t(
              `Đã khôi phục ${saved.queuedFiles.length} tệp CSV và thông tin phân tích trước khi tải lại trang.`,
              `Restored ${saved.queuedFiles.length} CSV files and analysis results from before the page reload.`
            )
          );
        } else {
          setRestoredNotice(
            t(
              `Đã khôi phục ${saved.queuedFiles.length} tệp CSV đã đọc trước khi tải lại trang — đang phân tích lại...`,
              `Restored ${saved.queuedFiles.length} CSV files from before reload — re-analyzing...`
            )
          );
          await runBatchPreview(saved.queuedFiles);
        }
      }
    })();

    return () => {
      mounted = false;
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  // Derived filters for All Fields table
  const availableProvinces = useMemo(() => {
    const set = new Set<string>();
    (platformStats?.allFields || []).forEach((f) => {
      if (f.province) set.add(f.province);
    });
    return Array.from(set).sort((a, b) =>
      getLocalizedRegionName(a, lang).localeCompare(getLocalizedRegionName(b, lang), lang)
    );
  }, [platformStats, lang]);

  const availableCrops = useMemo(() => {
    const set = new Set<string>();
    (platformStats?.allFields || []).forEach((f) => {
      if (f.cropName) set.add(f.cropName);
    });
    return Array.from(set).sort((a, b) =>
      getPlantDisplayName(a, lang).localeCompare(getPlantDisplayName(b, lang), lang)
    );
  }, [platformStats, lang]);

  const filteredFields = useMemo(() => {
    const all = platformStats?.allFields || [];
    const q = fieldSearch.trim().toLowerCase();
    return all.filter((f) => {
      if (provinceFilter !== 'ALL' && f.province !== provinceFilter) return false;
      if (cropFilter !== 'ALL' && f.cropName !== cropFilter) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.ownerName.toLowerCase().includes(q) ||
        f.ownerEmail.toLowerCase().includes(q) ||
        f.province.toLowerCase().includes(q) ||
        getLocalizedRegionName(f.province, lang).toLowerCase().includes(q) ||
        f.district.toLowerCase().includes(q) ||
        f.cropName.toLowerCase().includes(q) ||
        getPlantDisplayName(f.cropName, lang).toLowerCase().includes(q) ||
        f.nasaCellId.toLowerCase().includes(q)
      );
    });
  }, [platformStats, fieldSearch, provinceFilter, cropFilter, lang]);

  // Folder grouping summary for queued CSV files
  const queuedFolders = useMemo(() => {
    const map = new Map<string, { folderName: string; fileCount: number; totalBytes: number }>();
    for (const f of queuedFiles) {
      const cur = map.get(f.folderName) || {
        folderName: f.folderName,
        fileCount: 0,
        totalBytes: 0,
      };
      cur.fileCount += 1;
      cur.totalBytes += f.size;
      map.set(f.folderName, cur);
    }
    return Array.from(map.values());
  }, [queuedFiles]);

  const handleToggleUserAdmin = async (uid: string, email: string, currentIsAdmin: boolean) => {
    setTogglingAdminUid(uid);
    setActionErrorMsg(null);
    setAdminActionSuccess(null);
    try {
      await FirestoreService.setAdminRole(uid, email, !currentIsAdmin);
      await fetchPlatformStats();
      setAdminActionSuccess(
        !currentIsAdmin
          ? t(
              `Đã cấp quyền Quản trị viên cho ${email || uid}.`,
              `Granted Admin privileges to ${email || uid}.`
            )
          : t(
              `Đã gỡ quyền Quản trị viên của ${email || uid}.`,
              `Revoked Admin privileges from ${email || uid}.`
            )
      );
    } catch (err: any) {
      setActionErrorMsg(
        err?.message || t('Không thể cập nhật quyền quản trị.', 'Unable to update admin privileges.')
      );
    } finally {
      setTogglingAdminUid(null);
    }
  };

  const handleAddAdminByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = adminEmailInput.trim().toLowerCase();
    setActionErrorMsg(null);
    setAdminActionSuccess(null);

    if (!targetEmail || !targetEmail.includes('@')) {
      setActionErrorMsg(
        t(
          'Vui lòng nhập địa chỉ Email Google hợp lệ của người cần cấp quyền Admin.',
          'Please enter a valid Google Email address for the new Admin.'
        )
      );
      return;
    }
    if (targetEmail === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      setAdminActionSuccess(
        t(
          `${BOOTSTRAP_ADMIN_EMAIL} đã là Admin gốc mặc định của hệ thống.`,
          `${BOOTSTRAP_ADMIN_EMAIL} is already the default root Admin.`
        )
      );
      setAdminEmailInput('');
      return;
    }

    const matchedUser = platformStats?.users.find(
      (u) => u.email.trim().toLowerCase() === targetEmail
    );
    if (!matchedUser) {
      setActionErrorMsg(
        t(
          `Chưa tìm thấy tài khoản "${targetEmail}" trong danh sách người dùng. Người này cần đăng nhập Google vào CropCast ít nhất 1 lần trước để hệ thống ghi nhận UID rồi bạn bấm Cấp quyền Admin.`,
          `Account "${targetEmail}" was not found in the user list. They must sign in to CropCast with Google at least once first before being granted Admin rights.`
        )
      );
      return;
    }
    if (matchedUser.isAdmin) {
      setAdminActionSuccess(
        t(
          `Tài khoản ${matchedUser.email} đã có quyền Quản trị viên rồi.`,
          `Account ${matchedUser.email} already has Admin privileges.`
        )
      );
      setAdminEmailInput('');
      return;
    }

    await handleToggleUserAdmin(matchedUser.uid, matchedUser.email, false);
    setAdminEmailInput('');
  };

  const handleManualNasaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    const numericVal = parseFloat(manualValue);
    if (!Number.isFinite(numericVal)) {
      setActionErrorMsg(t('Giá trị đo NASA phải là số hợp lệ.', 'NASA measurement value must be a valid number.'));
      return;
    }
    setSavingManual(true);
    setActionErrorMsg(null);
    setManualSuccessMsg(null);
    try {
      await FirestoreService.addManualNasaObservation(auth.currentUser.uid, {
        cellId: manualCellId,
        date: manualDate,
        indicatorCode: manualIndicator,
        value: numericVal,
      });
      await FirestoreService.saveNasaSyncLog(auth.currentUser.uid, {
        syncType: 'MANUAL_ENTRY',
        targetCellsCount: 1,
        recordsSynced: 1,
        status: 'SUCCESS',
        latestNasaDate: manualDate,
      });
      setManualSuccessMsg(
        t(
          `Đã lưu chỉ số ${manualIndicator} = ${numericVal} cho ô lưới ${manualCellId} ngày ${manualDate} lên hệ thống!`,
          `Saved indicator ${manualIndicator} = ${numericVal} for grid cell ${manualCellId} on ${manualDate}!`
        )
      );
      onDatasetUpdated?.();
      fetchPlatformStats();
    } catch (err: any) {
      setActionErrorMsg(
        err?.message || t('Không thể lưu bản ghi NASA thủ công.', 'Unable to save manual NASA observation.')
      );
    } finally {
      setSavingManual(false);
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    setActionErrorMsg(null);
    setSyncMessage(
      t(
        'Đang kết nối NASA POWER Daily API và đồng bộ dữ liệu cho các ô lưới Việt Nam...',
        'Connecting to NASA POWER Daily API and syncing Vietnam grid cells...'
      )
    );
    try {
      const headers = await getAdminHeaders(true);
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const data = await parseJsonSafely<any>(res);
      if (res.ok && data.status !== 'FAILED') {
        setSyncMessage(
          t(
            `Đồng bộ thành công! Đã xử lý ${data.recordsSynced} bản ghi. Dữ liệu mới nhất: ${data.latestNasaDate}`,
            `Sync completed! Processed ${data.recordsSynced} records. Latest data date: ${data.latestNasaDate}`
          )
        );
        if (auth.currentUser) {
          await FirestoreService.saveNasaSyncLog(auth.currentUser.uid, {
            syncType: 'NASA_POWER_API',
            targetCellsCount: 531,
            recordsSynced: Number(data.recordsSynced) || 0,
            status: 'SUCCESS',
            latestNasaDate: data.latestNasaDate,
          });
        }
      } else {
        setSyncMessage(
          t(
            `Lỗi đồng bộ: ${data.error || data.errorMessage || `NASA API không phản hồi (HTTP ${res.status})`}`,
            `Sync error: ${data.error || data.errorMessage || `NASA API did not respond (HTTP ${res.status})`}`
          )
        );
      }
      fetchStatus();
    } catch (err: any) {
      setSyncMessage(t(`Lỗi kết nối: ${err.message}`, `Connection error: ${err.message}`));
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 8000);
    }
  };

  const handleToggleAutoSync = async () => {
    if (!status) return;
    const newState = !status.autoSyncEnabled;
    try {
      const headers = await getAdminHeaders(true);
      const res = await fetch('/api/admin/toggle-auto-sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled: newState }),
      });
      if (res.ok) {
        setStatus({ ...status, autoSyncEnabled: newState });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const computeQueueSignature = (items: QueuedCsvFile[]): string =>
    items.map((f) => `${f.key}:${f.size}:${f.content.length}`).join('|');

  const splitContentOnLines = (content: string, maxChunkChars = 680_000): string[] => {
    if (content.length <= maxChunkChars) return [content];
    const parts: string[] = [];
    let cursor = 0;
    while (cursor < content.length) {
      if (content.length - cursor <= maxChunkChars) {
        parts.push(content.slice(cursor));
        break;
      }
      const sliceEnd = cursor + maxChunkChars;
      const lastNewline = content.lastIndexOf('\n', sliceEnd);
      const cutAt = lastNewline > cursor ? lastNewline + 1 : sliceEnd;
      parts.push(content.slice(cursor, cutAt));
      cursor = cutAt;
    }
    return parts;
  };

  const uploadQueuedFilesInChunks = async (
    items: QueuedCsvFile[],
    headers: Record<string, string>,
    phase: 'analyzing' | 'importing'
  ): Promise<string> => {
    const MAX_REQUEST_CHARS = 700_000;
    type ChunkItem = {
      fileName: string;
      folderName: string;
      partIndex: number;
      totalParts: number;
      content: string;
    };

    const allPieces: ChunkItem[] = [];
    for (const f of items) {
      const parts = splitContentOnLines(f.content, MAX_REQUEST_CHARS);
      parts.forEach((partContent, idx) => {
        allPieces.push({
          fileName: f.fileName,
          folderName: f.folderName,
          partIndex: idx,
          totalParts: parts.length,
          content: partContent,
        });
      });
    }

    const requestBatches: ChunkItem[][] = [];
    let currentBatch: ChunkItem[] = [];
    let currentBatchChars = 0;
    for (const piece of allPieces) {
      const pieceLen = piece.content.length;
      if (currentBatch.length > 0 && currentBatchChars + pieceLen > MAX_REQUEST_CHARS) {
        requestBatches.push(currentBatch);
        currentBatch = [];
        currentBatchChars = 0;
      }
      currentBatch.push(piece);
      currentBatchChars += pieceLen;
    }
    if (currentBatch.length > 0) {
      requestBatches.push(currentBatch);
    }

    const startRes = await fetch('/api/admin/upload-session/start', {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    const startData = await parseJsonSafely<any>(startRes);
    if (!startRes.ok || !startData?.sessionId) {
      throw new Error(
        startData?.error ||
          t('Không thể khởi tạo phiên tải tệp lên máy chủ.', 'Unable to initialize server upload session.')
      );
    }
    const sessionId = String(startData.sessionId);

    const totalBytes = items.reduce((sum, f) => sum + f.size, 0);
    const totalChars = Math.max(1, allPieces.reduce((sum, p) => sum + p.content.length, 0));
    let sentChars = 0;
    const startedAt = Date.now();

    for (let b = 0; b < requestBatches.length; b++) {
      const batch = requestBatches[b];
      const chunkRes = await fetch(`/api/admin/upload-session/${encodeURIComponent(sessionId)}/chunk`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ items: batch }),
      });
      const chunkData = await parseJsonSafely<any>(chunkRes);
      if (!chunkRes.ok) {
        throw new Error(
          chunkData?.error ||
            t(
              `Lỗi khi gửi gói dữ liệu CSV (${b + 1}/${requestBatches.length}).`,
              `Error sending CSV data packet (${b + 1}/${requestBatches.length}).`
            )
        );
      }

      sentChars += batch.reduce((sum, p) => sum + p.content.length, 0);
      const ratio = sentChars / totalChars;
      const elapsedSec = (Date.now() - startedAt) / 1000;
      const etaSeconds =
        ratio > 0.05 && elapsedSec > 0.1
          ? Math.max(1, Math.ceil((elapsedSec / ratio) * (1 - ratio)))
          : null;

      setCsvProgress({
        active: true,
        phase,
        totalFiles: items.length,
        processedFiles: Math.min(items.length, chunkData.receivedFilesCount || items.length),
        totalBytes,
        processedBytes: Math.round(totalBytes * ratio),
        currentFileName:
          batch[batch.length - 1]?.fileName || t('Đang truyền gói CSV...', 'Streaming CSV packet...'),
        percent: phase === 'analyzing' ? Math.min(92, 50 + Math.round(ratio * 42)) : Math.min(45, 5 + Math.round(ratio * 40)),
        etaSeconds,
        startedAt,
      });
    }

    stagedSessionRef.current = {
      signature: computeQueueSignature(items),
      sessionId,
    };
    return sessionId;
  };

  const runBatchPreview = async (items: QueuedCsvFile[]) => {
    if (items.length === 0) {
      stagedSessionRef.current = null;
      setBatchPreview(null);
      await CsvQueueStorage.savePatch({ batchPreview: null });
      return;
    }
    setPreviewing(true);
    setActionErrorMsg(null);
    const totalBytes = items.reduce((sum, f) => sum + f.size, 0);
    setCsvProgress({
      active: true,
      phase: 'analyzing',
      totalFiles: items.length,
      processedFiles: 0,
      totalBytes,
      processedBytes: 0,
      currentFileName: t('Đang chia nhỏ & gửi tệp CSV an toàn...', 'Chunking & uploading CSV files safely...'),
      percent: 50,
      etaSeconds: null,
      startedAt: Date.now(),
    });
    try {
      const headers = await getAdminHeaders(true);
      const sessionId = await uploadQueuedFilesInChunks(items, headers, 'analyzing');
      const res = await fetch(`/api/admin/upload-session/${encodeURIComponent(sessionId)}/preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const data = await parseJsonSafely<any>(res);
      if (res.ok) {
        setBatchPreview(data);
        await CsvQueueStorage.savePatch({ batchPreview: data, readingProgress: null });
      } else {
        setActionErrorMsg(data.error || t('Không thể kiểm tra cấu trúc các tệp CSV.', 'Unable to validate CSV file structure.'));
      }
    } catch (err: any) {
      setActionErrorMsg(err?.message || t('Lỗi khi kiểm tra hàng loạt tệp CSV.', 'Error validating batch CSV files.'));
    } finally {
      setPreviewing(false);
      setCsvProgress((prev) => (prev?.phase === 'importing' ? prev : null));
    }
  };

  const appendFilesToQueue = async (
    entries: Array<{ file: File; folderName: string }>
  ) => {
    const csvEntries = entries.filter((item) => isCsvOrTextFile(item.file.name));
    if (csvEntries.length === 0) {
      setActionErrorMsg(
        t(
          'Không tìm thấy tệp định dạng .csv trong thư mục hoặc danh sách vừa chọn.',
          'No .csv files were found in the selected folder or file list.'
        )
      );
      return;
    }

    setReadingQueue(true);
    setActionErrorMsg(null);
    setImportSuccessMsg(null);
    setRestoredNotice(null);

    const startedAt = Date.now();
    const totalFiles = csvEntries.length;
    const totalBytes = csvEntries.reduce((sum, e) => sum + (e.file.size || 0), 0);
    let processedFiles = 0;
    let processedBytes = 0;

    setCsvProgress({
      active: true,
      phase: 'reading',
      totalFiles,
      processedFiles: 0,
      totalBytes,
      processedBytes: 0,
      currentFileName: csvEntries[0].file.name,
      percent: 0,
      etaSeconds: null,
      startedAt,
    });

    try {
      const map = new Map<string, QueuedCsvFile>();
      for (const existing of queuedFilesRef.current) map.set(existing.key, existing);

      const CHUNK_SIZE = 12;
      const UI_FLUSH_EVERY = 24;
      const STORAGE_FLUSH_EVERY = 120;
      for (let i = 0; i < csvEntries.length; i += CHUNK_SIZE) {
        const chunk = csvEntries.slice(i, i + CHUNK_SIZE);
        const loadedChunk = await Promise.all(
          chunk.map(async ({ file, folderName }) => {
            const content = await readFileAsText(file, lang);
            const safeFolder = folderName || 'Tệp tải lẻ';
            return {
              key: `${safeFolder}::${file.name}`,
              fileName: file.name,
              folderName: safeFolder,
              size: file.size,
              content,
            } satisfies QueuedCsvFile;
          })
        );

        for (const item of loadedChunk) {
          map.set(item.key, item);
          processedFiles += 1;
          processedBytes += item.size || 0;
        }

        const isLastBatch = i + CHUNK_SIZE >= csvEntries.length;
        const shouldFlushUi =
          isLastBatch || processedFiles % UI_FLUSH_EVERY < CHUNK_SIZE || processedFiles === loadedChunk.length;

        if (shouldFlushUi) {
          const ratio =
            totalBytes > 0
              ? processedBytes / totalBytes
              : processedFiles / Math.max(1, totalFiles);
          const elapsedSec = (Date.now() - startedAt) / 1000;
          const etaSeconds =
            ratio > 0.03 && elapsedSec > 0.05
              ? Math.max(1, Math.ceil((elapsedSec / ratio) * (1 - ratio)))
              : null;
          const currentFileName = chunk[chunk.length - 1]?.file.name || '';

          setCsvProgress({
            active: true,
            phase: 'reading',
            totalFiles,
            processedFiles,
            totalBytes,
            processedBytes,
            currentFileName,
            percent: Math.min(88, Math.round(ratio * 88)),
            etaSeconds,
            startedAt,
          });
        }

        if (isLastBatch || processedFiles % STORAGE_FLUSH_EVERY < CHUNK_SIZE) {
          const mergedSoFar = Array.from(map.values());
          queuedFilesRef.current = mergedSoFar;
          setQueuedFiles(mergedSoFar);
          await CsvQueueStorage.savePatch({
            queuedFiles: mergedSoFar,
            readingProgress: isLastBatch
              ? null
              : {
                  isReading: true,
                  totalFiles,
                  processedFiles,
                  totalBytes,
                  processedBytes,
                  currentFileName: chunk[chunk.length - 1]?.file.name || '',
                  startedAt,
                },
          });
        }
      }

      const mergedQueue = Array.from(map.values());
      queuedFilesRef.current = mergedQueue;
      setQueuedFiles(mergedQueue);
      await runBatchPreview(mergedQueue);
    } catch (err: any) {
      setActionErrorMsg(err?.message || t('Lỗi khi đọc tệp CSV từ thư mục.', 'Error reading CSV files from folder.'));
      setCsvProgress(null);
    } finally {
      setReadingQueue(false);
    }
  };

  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileInputRefResetNeeded(e.target)) {
      e.target.value = '';
    }
    if (fileList.length === 0) return;

    const prepared = fileList.map((file) => {
      const relPath = (file as any).webkitRelativePath as string | undefined;
      let folderName = 'Thư mục CSV';
      if (relPath && relPath.includes('/')) {
        const parts = relPath.split('/').filter(Boolean);
        folderName = parts.length > 1 ? parts.slice(0, -1).join('/') : parts[0];
      }
      return { file, folderName };
    });

    await appendFilesToQueue(prepared);
  };

  const handleFilesInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileInputRefResetNeeded(e.target)) {
      e.target.value = '';
    }
    if (fileList.length === 0) return;

    const prepared = fileList.map((file) => ({
      file,
      folderName: 'Tệp CSV chọn trực tiếp',
    }));

    await appendFilesToQueue(prepared);
  };

  function fileInputRefResetNeeded(el: HTMLInputElement | null): el is HTMLInputElement {
    return !!el;
  }

  const handleDropFoldersOrFiles = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const items = Array.from(e.dataTransfer.items || []);
    const collected: Array<{ file: File; folderName: string }> = [];

    if (items.length > 0 && typeof (items[0] as any).webkitGetAsEntry === 'function') {
      setReadingQueue(true);
      try {
        for (const item of items) {
          const entry = (item as any).webkitGetAsEntry?.();
          if (entry) {
            const found = await collectFilesFromEntry(entry, '');
            collected.push(...found);
          }
        }
      } finally {
        setReadingQueue(false);
      }
    } else {
      const files = Array.from(e.dataTransfer.files || []);
      for (const file of files) {
        collected.push({ file, folderName: 'Tệp kéo thả' });
      }
    }

    if (collected.length > 0) {
      await appendFilesToQueue(collected);
    } else {
      setActionErrorMsg(
        t(
          'Không tìm thấy tệp .csv hợp lệ trong các thư mục vừa kéo thả.',
          'No valid .csv files were found in the dropped folders.'
        )
      );
    }
  };

  const handleRemoveFolderFromQueue = async (folderName: string) => {
    const remaining = queuedFilesRef.current.filter((f) => f.folderName !== folderName);
    queuedFilesRef.current = remaining;
    setQueuedFiles(remaining);
    await CsvQueueStorage.savePatch({ queuedFiles: remaining });
    if (remaining.length === 0) {
      setBatchPreview(null);
      await CsvQueueStorage.savePatch({ batchPreview: null });
    } else {
      await runBatchPreview(remaining);
    }
  };

  const handleClearQueue = async () => {
    stagedSessionRef.current = null;
    queuedFilesRef.current = [];
    setQueuedFiles([]);
    setBatchPreview(null);
    setActionErrorMsg(null);
    setRestoredNotice(null);
    await CsvQueueStorage.savePatch({
      queuedFiles: [],
      batchPreview: null,
      readingProgress: null,
    });
  };

  const handleCommitBatchImport = async () => {
    if (queuedFiles.length === 0 || !batchPreview || batchPreview.preview.validRows === 0) return;

    setImporting(true);
    setActionErrorMsg(null);
    const totalBytes = queuedFiles.reduce((sum, f) => sum + f.size, 0);
    setCsvProgress({
      active: true,
      phase: 'importing',
      totalFiles: queuedFiles.length,
      processedFiles: 0,
      totalBytes,
      processedBytes: 0,
      processedRows: 0,
      currentFileName: queuedFiles[0]?.fileName || '',
      percent: 2,
      etaSeconds: null,
      startedAt: Date.now(),
    });
    try {
      const headers = await getAdminHeaders(true);
      const sig = computeQueueSignature(queuedFiles);
      let sessionId =
        stagedSessionRef.current?.signature === sig ? stagedSessionRef.current.sessionId : '';

      if (!sessionId) {
        sessionId = await uploadQueuedFilesInChunks(queuedFiles, headers, 'importing');
      }

      let res = await fetch(`/api/admin/upload-session/${encodeURIComponent(sessionId)}/import-async`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });

      if (res.status === 404) {
        sessionId = await uploadQueuedFilesInChunks(queuedFiles, headers, 'importing');
        res = await fetch(`/api/admin/upload-session/${encodeURIComponent(sessionId)}/import-async`, {
          method: 'POST',
          headers,
          body: JSON.stringify({}),
        });
      }

      const data = await parseJsonSafely<any>(res);
      if (res.ok && data.job?.jobId) {
        stagedSessionRef.current = null;
        await CsvQueueStorage.savePatch({ activeImportJobId: data.job.jobId });
        pollImportJob(data.job.jobId);
      } else {
        setImporting(false);
        setCsvProgress(null);
        setActionErrorMsg(data.error || t('Không thể nhập hàng loạt dữ liệu CSV.', 'Unable to run batch CSV import.'));
      }
    } catch (err: any) {
      setImporting(false);
      setCsvProgress(null);
      setActionErrorMsg(t(`Lỗi khi nhập dữ liệu: ${err.message}`, `Data import error: ${err.message}`));
    }
  };

  const handleRollback = async (version: string) => {
    setActionErrorMsg(null);
    try {
      const headers = await getAdminHeaders(true);
      const res = await fetch('/api/admin/rollback', {
        method: 'POST',
        headers,
        body: JSON.stringify({ version }),
      });

      const data = await parseJsonSafely<any>(res);
      if (res.ok) {
        setRollbackSuccessMsg(data.message);
        setConfirmRollbackVer(null);
        fetchStatus();
        setTimeout(() => setRollbackSuccessMsg(null), 6000);
      } else {
        setActionErrorMsg(data.error || t('Không thể khôi phục phiên bản.', 'Unable to roll back version.'));
      }
    } catch (err: any) {
      setActionErrorMsg(err.message);
    }
  };

  const sampleCsvContent = `-BEGIN HEADER-
NASA/POWER CERES/MERRA2 Native Resolution Daily Data
Location: Latitude  21.0285   Longitude 105.8542
-END HEADER-
YEAR,MO,DY,T2M,T2M_MIN,T2M_MAX,PRECTOTCORR,GWETROOT,GWETTOP,RH2M,ALLSKY_SFC_SW_DWN
2026,11,08,24.6,20.1,29.3,6.4,0.74,0.79,85.2,13.5
2026,11,09,25.1,20.8,30.0,1.2,0.73,0.76,82.0,15.8`;

  const handleDownloadSampleCsv = () => {
    const blob = new Blob([sampleCsvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nasa_power_sample_vietnam.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Admin Header */}
      <div className="bg-gradient-to-r from-stone-900 via-emerald-950 to-stone-900 rounded-2xl p-6 text-white shadow-md border border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Lock className="w-3 h-3" /> {t('Cổng Quản Trị Tổng Thể Hệ Thống', 'System-Wide Admin Portal')}
            </span>
            <span className="text-xs text-stone-400">
              {t(
                'Toàn bộ nông dân · Tất cả thửa ruộng · Nhập dữ liệu NASA POWER nhiều thư mục CSV',
                'All farmers · All fields · Multi-folder NASA POWER CSV batch import'
              )}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
            {t('Quản trị Tổng thể CropCast & Kho Dữ liệu NASA POWER', 'CropCast Platform Admin & NASA POWER Warehouse')}
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 mt-0.5">
            {t(
              'Giám sát tổng quan toàn bộ ứng dụng, kiểm tra danh sách mọi thửa ruộng trên hệ thống và nhập dữ liệu NASA POWER bằng nhiều thư mục CSV cùng lúc.',
              'Monitor platform-wide analytics, inspect all registered fields, and import NASA POWER data from multiple CSV folders at once.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              fetchPlatformStats();
              fetchStatus();
            }}
            className="px-3.5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${statsLoading || loading ? 'animate-spin' : ''}`} />
            {t('Làm mới số liệu', 'Refresh metrics')}
          </button>
          <button
            type="button"
            onClick={handleTriggerSync}
            disabled={syncing}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? t('Đang đồng bộ...', 'Syncing...') : t('Đồng bộ NASA ngay', 'Sync NASA Now')}
          </button>
        </div>
      </div>

      {/* Admin Sub-navigation Tabs (4 Tabs) */}
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-stone-200 shadow-xs overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setAdminTab('overview')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            adminTab === 'overview'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <BarChart3 className="w-4 h-4 shrink-0" /> {t('Tổng quan Hệ thống', 'System Overview')}
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('fields')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            adminTab === 'fields'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <MapPin className="w-4 h-4 shrink-0" /> {t('Tất cả Thửa ruộng', 'All Fields')} ({platformStats?.allFields.length ?? '—'})
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('users')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            adminTab === 'users'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" /> {t('Người dùng', 'Users')} ({platformStats?.totalUsers ?? '—'})
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('nasa')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            adminTab === 'nasa'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Database className="w-4 h-4 shrink-0" /> {t('Dữ liệu NASA POWER (CSV nhiều thư mục)', 'NASA POWER Data (Multi-Folder CSV)')}
        </button>
      </div>

      {syncMessage && (
        <div className="p-3.5 bg-emerald-100 border border-emerald-300 text-emerald-950 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{syncMessage}</span>
          </div>
          <button type="button" onClick={() => setSyncMessage(null)} className="text-emerald-800 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {statsError && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span>{statsError}</span>
          <button type="button" onClick={() => setStatsError(null)} className="cursor-pointer font-bold">
            ✕
          </button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span>{actionErrorMsg}</span>
          <button type="button" onClick={() => setActionErrorMsg(null)} className="cursor-pointer font-bold">
            ✕
          </button>
        </div>
      )}

      {rollbackSuccessMsg && (
        <div className="p-3.5 bg-blue-100 border border-blue-300 text-blue-950 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
          <span>{rollbackSuccessMsg}</span>
        </div>
      )}

      {/* TAB 1: PLATFORM OVERVIEW & STATS */}
      {adminTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 Live Firestore Platform KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-stone-500">
                <span className="text-[11px] uppercase font-bold">{t('Tổng số người dùng', 'Total Users')}</span>
                <Users className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-2xl font-black text-stone-900 tabular-nums">
                {statsLoading ? '...' : platformStats?.totalUsers ?? 0}
              </div>
              <div className="text-[11px] text-stone-500">
                {t('Tài khoản nông dân & quản trị đã đăng ký', 'Registered farmer & admin accounts')}
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-stone-500">
                <span className="text-[11px] uppercase font-bold">{t('Tổng số thửa ruộng', 'Total Fields')}</span>
                <MapPin className="w-4 h-4 text-blue-700" />
              </div>
              <div className="text-2xl font-black text-stone-900 tabular-nums">
                {statsLoading ? '...' : platformStats?.totalFields ?? 0}
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold">
                {t('Tổng diện tích:', 'Total area:')} {statsLoading ? '...' : platformStats?.totalAreaHa ?? 0} ha
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-stone-500">
                <span className="text-[11px] uppercase font-bold">{t('Việc đồng ruộng & Phản hồi', 'Field Tasks & Feedback')}</span>
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-stone-900 tabular-nums">
                {statsLoading
                  ? '...'
                  : `${platformStats?.completedTasks ?? 0}/${platformStats?.totalTasks ?? 0}`}
              </div>
              <div className="text-[11px] text-stone-500">
                {t('Phản hồi thực địa đã ghi nhận:', 'Recorded field feedback:')} <strong>{platformStats?.totalFeedbacks ?? 0}</strong>
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-stone-500">
                <span className="text-[11px] uppercase font-bold">{t('Chia sẻ & Gói NASA', 'Shares & NASA Batches')}</span>
                <Share2 className="w-4 h-4 text-purple-700" />
              </div>
              <div className="text-2xl font-black text-stone-900 tabular-nums">
                {statsLoading ? '...' : platformStats?.totalActiveShares ?? 0}
              </div>
              <div className="text-[11px] text-stone-500">
                {t('Lượt chia sẻ ruộng ·', 'Active field shares ·')} <strong>{platformStats?.totalNasaDatasets ?? 0}</strong> {t('gói NASA đã nạp', 'NASA batches loaded')}
              </div>
            </div>
          </div>

          {/* Field Distribution Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 text-xs">
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-700" /> {t('Phân bố ruộng theo Tỉnh / Vùng', 'Fields by Province / Region')}
              </h3>
              {!platformStats || platformStats.fieldsByProvince.length === 0 ? (
                <p className="text-stone-400 italic py-4">{t('Chưa có thửa ruộng nào được tạo.', 'No fields have been created yet.')}</p>
              ) : (
                <div className="space-y-2">
                  {platformStats.fieldsByProvince.map((p) => (
                    <div
                      key={p.province}
                      className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200/80"
                    >
                      <span className="font-semibold text-stone-800">{getLocalizedRegionName(p.province, lang)}</span>
                      <span className="font-mono font-bold text-emerald-800">
                        {p.count} {t('thửa', 'fields')} ({p.areaHa} ha)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                <Sprout className="w-4 h-4 text-emerald-700" /> {t('Cơ cấu Cây trồng đang canh tác', 'Active Crop Mix')}
              </h3>
              {!platformStats || platformStats.fieldsByCrop.length === 0 ? (
                <p className="text-stone-400 italic py-4">{t('Chưa có dữ liệu cây trồng.', 'No crop data yet.')}</p>
              ) : (
                <div className="space-y-2">
                  {platformStats.fieldsByCrop.map((c) => (
                    <div
                      key={c.cropName}
                      className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200/80"
                    >
                      <span className="font-semibold text-stone-800">{getPlantDisplayName(c.cropName, lang)}</span>
                      <span className="font-mono font-bold text-stone-900">{c.count} {t('thửa', 'fields')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-700" /> {t('Phân loại Chất đất trên toàn hệ thống', 'Soil Type Distribution')}
              </h3>
              {!platformStats || platformStats.fieldsBySoil.length === 0 ? (
                <p className="text-stone-400 italic py-4">{t('Chưa có dữ liệu chất đất.', 'No soil type data yet.')}</p>
              ) : (
                <div className="space-y-2">
                  {platformStats.fieldsBySoil.map((s) => (
                    <div
                      key={s.soilType}
                      className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200/80"
                    >
                      <span className="font-semibold text-stone-800">
                        {getSoilLabel(s.soilType as any, lang)}
                      </span>
                      <span className="font-mono font-bold text-stone-900">{s.count} {t('thửa', 'fields')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Latest Fields Snapshot Across App */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  {t('Thửa ruộng mới nhất trên toàn hệ thống', 'Latest Fields Across Platform')}
                </h3>
                <p className="text-xs text-stone-500">
                  {t(
                    'Tổng quan các thửa ruộng gần đây của tất cả người dùng. Nhấn để xem bản đồ vệ tinh hoặc mở danh sách đầy đủ.',
                    'Recent fields across all users. Click any card to inspect on satellite map or open the full directory.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdminTab('fields')}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition cursor-pointer self-start sm:self-auto"
              >
                {t('Xem tất cả thửa ruộng →', 'View all fields →')}
              </button>
            </div>

            {!platformStats || platformStats.allFields.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-4">{t('Chưa có thửa ruộng nào trên hệ thống.', 'No fields registered on the platform yet.')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {platformStats.allFields.slice(0, 6).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setInspectingField(f)}
                    className="text-left p-4 rounded-xl border border-stone-200 bg-stone-50/70 hover:bg-emerald-50/60 hover:border-emerald-300 transition space-y-2 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-stone-900 line-clamp-1">{f.name}</div>
                        <div className="text-[11px] text-stone-500">
                          {f.district ? `${f.district}, ` : ''}{getLocalizedRegionName(f.province, lang)} · {f.areaHa} ha
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {getPlantDisplayName(f.cropName, lang)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-stone-600 pt-1 border-t border-stone-200/70">
                      <span className="truncate max-w-[170px]">{t('Chủ:', 'Owner:')} <strong>{f.ownerName}</strong></span>
                      <span className="font-mono text-emerald-700 font-semibold">{f.nasaCellId}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ALL FIELDS ACROSS ENTIRE APP */}
      {adminTab === 'fields' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-700" />
                {t('Tổng hợp Toàn bộ Thửa ruộng trên CropCast', 'All Fields Directory on CropCast')} ({filteredFields.length}/{platformStats?.allFields.length ?? 0})
              </h2>
              <p className="text-xs text-stone-500">
                {t(
                  'Quản trị viên xem toàn bộ thửa ruộng của tất cả tài khoản, chủ sở hữu, tọa độ vệ tinh và điểm dữ liệu NASA gần nhất.',
                  'Administrators can review every field across all accounts, owners, satellite coordinates, and nearest NASA grid cells.'
                )}
              </p>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder={t('Tìm tên ruộng, chủ sở hữu, email, cây...', 'Search field, owner, email, crop...')}
                  className="pl-8 pr-3 py-2 border border-stone-300 rounded-xl text-xs bg-white text-stone-900 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <select
                value={provinceFilter}
                onChange={(e) => setProvinceFilter(e.target.value)}
                className="px-3 py-2 border border-stone-300 rounded-xl text-xs bg-white text-stone-800"
              >
                <option value="ALL">{t('Tất cả Tỉnh/Thành', 'All Provinces / Regions')}</option>
                {availableProvinces.map((p) => (
                  <option key={p} value={p}>{getLocalizedRegionName(p, lang)}</option>
                ))}
              </select>

              <select
                value={cropFilter}
                onChange={(e) => setCropFilter(e.target.value)}
                className="px-3 py-2 border border-stone-300 rounded-xl text-xs bg-white text-stone-800"
              >
                <option value="ALL">{t('Tất cả Cây trồng', 'All Crops')}</option>
                {availableCrops.map((c) => (
                  <option key={c} value={c}>{getPlantDisplayName(c, lang)}</option>
                ))}
              </select>
            </div>
          </div>

          {statsLoading ? (
            <div className="p-8 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-700" /> {t('Đang tải toàn bộ thửa ruộng...', 'Loading all fields...')}
            </div>
          ) : filteredFields.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-400">
              {t('Không có thửa ruộng nào phù hợp bộ lọc hiện tại.', 'No fields match the current filters.')}
            </div>
          ) : (
            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 text-[11px] uppercase">
                  <tr>
                    <th className="p-3 font-bold">{t('Thửa ruộng & Địa điểm', 'Field & Location')}</th>
                    <th className="p-3 font-bold">{t('Chủ sở hữu', 'Owner')}</th>
                    <th className="p-3 font-bold">{t('Tọa độ & Ô lưới NASA', 'Coords & NASA Cell')}</th>
                    <th className="p-3 font-bold">{t('Cây trồng & Giai đoạn', 'Crop & Stage')}</th>
                    <th className="p-3 font-bold">{t('Đất & Nguồn nước', 'Soil & Water')}</th>
                    <th className="p-3 font-bold">{t('Diện tích', 'Area')}</th>
                    <th className="p-3 font-bold">{t('Chia sẻ', 'Sharing')}</th>
                    <th className="p-3 font-bold text-right">{t('Chi tiết', 'Details')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredFields.map((f) => (
                    <tr key={f.id} className="hover:bg-stone-50/80">
                      <td className="p-3">
                        <div className="font-bold text-stone-900">{f.name}</div>
                        <div className="text-[11px] text-stone-500">
                          {f.district ? `${f.district}, ` : ''}{getLocalizedRegionName(f.province, lang)}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-stone-800">{f.ownerName}</div>
                        <div className="text-[11px] font-mono text-stone-500">
                          {f.ownerEmail || f.ownerId.slice(0, 12)}
                        </div>
                      </td>
                      <td className="p-3 font-mono">
                        <div className="text-stone-800 text-[11px]">
                          {f.lat.toFixed(4)}°{lang === 'en' ? 'N' : 'B'}, {f.lon.toFixed(4)}°{lang === 'en' ? 'E' : 'Đ'}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-bold">
                          {f.nasaCellId} ({f.nasaDistanceKm} km)
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-emerald-900">{getPlantDisplayName(f.cropName, lang)}</div>
                        <div className="text-[11px] text-stone-500">
                          {t('Giống:', 'Variety:')} {getCommonVarietyLabel(f.cropVariety, lang)} · {getCommonStageLabel(f.currentStage, lang)}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-stone-800">
                          {getSoilLabel(f.soilType, lang)}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {waterLabels[f.waterSourceType] || waterLabels.other}
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-stone-900 tabular-nums">
                        {f.areaHa} ha
                      </td>
                      <td className="p-3">
                        {f.sharedCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[11px]">
                            <Share2 className="w-3 h-3" /> {f.sharedCount}
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-400">{t('Riêng tư', 'Private')}</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectingField(f)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> {t('Xem chi tiết', 'Inspect')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: USERS DIRECTORY & ADMIN ROLE ASSIGNMENT */}
      {adminTab === 'users' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-700" />
                {t('Danh sách Tài khoản Nông dân & Quản trị viên', 'Farmers & Administrators Directory')}
              </h2>
              <p className="text-xs text-stone-500">
                {t('Admin gốc mặc định:', 'Default root Admin:')} <strong className="font-mono text-stone-800">{BOOTSTRAP_ADMIN_EMAIL}</strong>. {t('Quản trị viên có thể cấp hoặc gỡ quyền Admin cho các tài khoản Google khác.', 'Administrators can grant or revoke Admin privileges for other Google accounts.')}
              </p>
            </div>
          </div>

          {/* Quick Add Admin by Email */}
          <form
            onSubmit={handleAddAdminByEmail}
            className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-end gap-3 text-xs"
          >
            <div className="flex-1 space-y-1">
              <label className="font-bold text-emerald-950 block">
                {t('Thêm Quản trị viên mới bằng Email Google', 'Grant Admin Privileges by Google Email')}
              </label>
              <input
                type="email"
                value={adminEmailInput}
                onChange={(e) => setAdminEmailInput(e.target.value)}
                placeholder={t(
                  'Nhập email Google đã từng đăng nhập CropCast (VD: dongnghiep@gmail.com)',
                  'Enter a Google email that has signed in to CropCast (e.g., colleague@gmail.com)'
                )}
                className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <button
              type="submit"
              disabled={statsLoading || togglingAdminUid !== null}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" /> {t('Thêm Admin', 'Add Admin')}
            </button>
          </form>

          {adminActionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                {adminActionSuccess}
              </span>
              <button
                type="button"
                onClick={() => setAdminActionSuccess(null)}
                className="text-emerald-700 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {statsLoading ? (
            <div className="p-8 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-700" /> {t('Đang tải danh sách tài khoản...', 'Loading user directory...')}
            </div>
          ) : !platformStats || platformStats.users.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-400">
              {t('Chưa có người dùng nào đăng ký tài khoản trên hệ thống.', 'No registered user accounts on the platform yet.')}
            </div>
          ) : (
            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 text-[11px] uppercase">
                  <tr>
                    <th className="p-3 font-bold">{t('Người dùng', 'User')}</th>
                    <th className="p-3 font-bold">{t('Email / Tài khoản', 'Email / Account')}</th>
                    <th className="p-3 font-bold">{t('Vai trò', 'Role')}</th>
                    <th className="p-3 font-bold">{t('Số ruộng', 'Fields')}</th>
                    <th className="p-3 font-bold">{t('Tổng diện tích', 'Total Area')}</th>
                    <th className="p-3 font-bold">{t('Ngày tham gia', 'Joined')}</th>
                    <th className="p-3 font-bold text-right">{t('Phân quyền', 'Permissions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {platformStats.users.map((u) => {
                    const isBootstrap =
                      u.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
                    return (
                      <tr key={u.uid} className="hover:bg-stone-50/70">
                        <td className="p-3 font-bold text-stone-900">{u.displayName}</td>
                        <td className="p-3 font-mono text-stone-600">{u.email || '—'}</td>
                        <td className="p-3">
                          {u.isAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 font-bold text-[11px]">
                              <ShieldCheck className="w-3 h-3 text-amber-700" /> {t('Quản trị viên', 'Administrator')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold text-[11px]">
                              <UserCheck className="w-3 h-3" /> {t('Nông dân', 'Farmer')}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-stone-900 tabular-nums">{u.fieldCount}</td>
                        <td className="p-3 font-mono text-stone-700 tabular-nums">{u.totalAreaHa} ha</td>
                        <td className="p-3 text-stone-500">
                          {new Date(u.createdAt).toLocaleDateString(locale)}
                        </td>
                        <td className="p-3 text-right">
                          {isBootstrap ? (
                            <span className="text-[11px] text-stone-400 font-semibold">
                              {t('Admin gốc', 'Root Admin')}
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={togglingAdminUid === u.uid}
                              onClick={() => handleToggleUserAdmin(u.uid, u.email, u.isAdmin)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer disabled:opacity-50 ${
                                u.isAdmin
                                  ? 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              {togglingAdminUid === u.uid
                                ? t('Đang lưu...', 'Saving...')
                                : u.isAdmin
                                ? t('Gỡ quyền Admin', 'Revoke Admin')
                                : t('Cấp quyền Admin', 'Grant Admin')}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: NASA DATA MANAGEMENT (MANUAL + MULTI-FOLDER CSV + API SYNC) */}
      {adminTab === 'nasa' && (
        <div className="space-y-6">
          {/* Warehouse Status KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-stone-400">
                <span className="text-[10px] uppercase font-bold">{t('Ngày NASA mới nhất', 'Latest NASA Date')}</span>
                <Clock className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-stone-900">{status?.latestNasaDate || '2026-11-08'}</div>
              <div className="text-[11px] text-stone-500">{t('Độ trễ xử lý vệ tinh ~48-72 giờ', 'Satellite processing lag ~48–72h')}</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-stone-400">
                <span className="text-[10px] uppercase font-bold">{t('Tổng số bản ghi kho', 'Warehouse Records')}</span>
                <Database className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xl font-black text-stone-900">
                {status?.totalRecords ? status.totalRecords.toLocaleString(locale) : (lang === 'en' ? '1,550,640' : '1.550.640')}
              </div>
              <div className="text-[11px] text-stone-500">{t('531 ô lưới × 8 chỉ số NASA', '531 grid cells × 8 NASA parameters')}</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-stone-400">
                <span className="text-[10px] uppercase font-bold">{t('Phiên bản dữ liệu', 'Dataset Version')}</span>
                <Layers className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-xl font-black text-stone-900">{status?.activeVersion || 'v2026.11'}</div>
              <div className="text-[11px] text-emerald-700 font-semibold">{t('Khóa độc nhất: ô lưới + ngày + mã', 'Unique key: cell + date + code')}</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-stone-400">
                <span className="text-[10px] uppercase font-bold">{t('Tự động đồng bộ API', 'Auto API Sync')}</span>
                <Server className="w-4 h-4 text-emerald-600" />
              </div>
              <button
                type="button"
                onClick={handleToggleAutoSync}
                className={`mt-1 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${
                  status?.autoSyncEnabled
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-stone-100 text-stone-600 border-stone-300'
                }`}
              >
                {t('Đồng bộ hàng ngày:', 'Daily sync:')} {status?.autoSyncEnabled ? t('ĐANG BẬT', 'ENABLED') : t('ĐANG TẮT', 'DISABLED')}
              </button>
            </div>
          </div>

          {/* SECTION 1: MANUAL SINGLE NASA OBSERVATION ENTRY */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-700" />
                {t('1. Nhập nhanh Dữ liệu Khí hậu NASA Thủ công', '1. Quick Manual NASA Observation Entry')}
              </h2>
              <p className="text-xs text-stone-500">
                {t(
                  'Cập nhật tức thì một chỉ số quan trắc (nhiệt độ, lượng mưa, độ ẩm đất rễ/mặt, bức xạ) cho bất kỳ ô lưới Việt Nam nào.',
                  'Instantly upsert a single observation (temperature, rainfall, root/surface soil wetness, solar radiation) for any Vietnam grid cell.'
                )}
              </p>
            </div>

            <form onSubmit={handleManualNasaSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs items-end">
              <div>
                <label className="font-bold text-stone-700 block mb-1">{t('Ô lưới NASA (531 ô)', 'NASA Grid Cell (531)')}</label>
                <select
                  value={manualCellId}
                  onChange={(e) => setManualCellId(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900 font-mono text-xs"
                >
                  {ALL_NASA_CELLS.slice(0, 120).map((c) => (
                    <option key={c.cellId} value={c.cellId}>
                      {c.cellId} · {getLocalizedRegionName(c.region, lang)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">{t('Ngày quan trắc', 'Observation Date')}</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">{t('Chỉ số NASA POWER', 'NASA POWER Indicator')}</label>
                <select
                  value={manualIndicator}
                  onChange={(e) => {
                    const code = e.target.value;
                    setManualIndicator(code);
                    const found = nasaIndicators.find((x) => x.code === code);
                    if (found) setManualValue(found.defaultVal);
                  }}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900"
                >
                  {nasaIndicators.map((ind) => (
                    <option key={ind.code} value={ind.code}>
                      {ind.code} — {ind.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">{t('Giá trị đo', 'Value')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900 font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={savingManual}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                {savingManual ? t('Đang lưu...', 'Saving...') : t('Thêm dữ liệu NASA', 'Add NASA Observation')}
              </button>
            </form>

            {manualSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{manualSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* SECTION 2: MULTI-FOLDER & MULTI-FILE NASA POWER CSV IMPORTER */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <CloudUpload className="w-5 h-5 text-emerald-700" />
                  {t('2. Nhập dữ liệu NASA POWER bằng CSV (Nhiều thư mục cùng lúc)', '2. NASA POWER CSV Batch Importer (Multi-Folder)')}
                </h2>
                <p className="text-xs text-stone-500">
                  {t(
                    'Hỗ trợ cả tệp dạng lưới tọa độ (LAT,LON,YEAR,DOY,GWETROOT/T2M_MAX/PRECTOTCORR...), tệp xuất NASA POWER (-END HEADER-, YEAR,MO,DY...) lẫn tệp 4 cột (cell_id, date, indicator_code, value). Tự bỏ qua ô biển trống và giá trị thiếu -999.',
                    'Supports gridded CSVs (LAT,LON,YEAR,DOY,GWETROOT/T2M_MAX/PRECTOTCORR...), standard NASA POWER exports (-END HEADER-, YEAR,MO,DY...), and 4-column CSVs (cell_id, date, indicator_code, value). Skips blank ocean cells and -999 missing values.'
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 cursor-pointer underline shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> {t('Tải tệp mẫu NASA POWER (.CSV)', 'Download Sample NASA POWER (.CSV)')}
              </button>
            </div>

            {/* Hidden Accumulative Inputs */}
            <input
              ref={folderInputRef}
              type="file"
              className="hidden"
              onChange={handleFolderInputChange}
              {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
            />
            <input
              ref={filesInputRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              multiple
              className="hidden"
              onChange={handleFilesInputChange}
            />

            {/* Drag-and-Drop Multi-Folder Zone + Action Buttons */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOver(false);
              }}
              onDrop={handleDropFoldersOrFiles}
              className={`p-4 sm:p-6 border-2 border-dashed rounded-2xl text-center transition flex flex-col items-center justify-center space-y-3 ${
                isDraggingOver
                  ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-300'
                  : 'border-stone-300 hover:border-emerald-500 bg-stone-50/60'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <FolderOpen className="w-6 h-6" />
              </div>

              <div className="space-y-1 max-w-xl">
                <p className="text-sm font-bold text-stone-900">
                  {t('Kéo thả đồng thời nhiều thư mục NASA POWER vào đây', 'Drag & drop multiple NASA POWER CSV folders here')}
                </p>
                <p className="text-xs text-stone-500">
                  {t(
                    'Trên máy tính hãy chọn thư mục hoặc kéo thả; trên điện thoại hãy dùng nút "+ Thêm nhiều tệp CSV" để chọn hàng loạt tệp .csv trong bộ nhớ máy.',
                    'On desktop, drop or select folders; on mobile, use "+ Add Multiple CSV Files" to multi-select .csv files from device storage.'
                  )}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2.5 pt-1 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="px-4 py-2.5 sm:py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FolderPlus className="w-4 h-4" /> {t('+ Thêm thư mục CSV', '+ Add CSV Folder')}
                </button>
                <button
                  type="button"
                  onClick={() => filesInputRef.current?.click()}
                  className="px-4 py-2.5 sm:py-2 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" /> {t('+ Thêm nhiều tệp CSV', '+ Add Multiple CSV Files')}
                </button>
                {queuedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearQueue}
                    className="px-3.5 py-2.5 sm:py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t('Xóa hàng đợi', 'Clear Queue')} ({queuedFiles.length} {t('tệp', 'files')})
                  </button>
                )}
              </div>

              {readingQueue && (
                <div className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5 pt-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('Đang quét các thư mục và đọc tệp CSV...', 'Scanning folders and reading CSV files...')}
                </div>
              )}
            </div>

            {restoredNotice && (
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-semibold flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>{restoredNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRestoredNotice(null)}
                  className="text-blue-800 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Real-time CSV Reading & Import Progress + ETA Bar */}
            {csvProgress && csvProgress.active && (
              <div className="p-4 bg-emerald-50/90 border border-emerald-300 rounded-2xl space-y-2.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-emerald-950">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                    <span>
                      {csvProgress.phase === 'reading'
                        ? t('Đang đọc tệp CSV từ máy (tự lưu nếu tải lại trang)...', 'Reading CSV files (persisted across page reloads)...')
                        : csvProgress.phase === 'analyzing'
                        ? t('Đang phân tích cấu trúc & lọc dữ liệu trùng...', 'Analyzing structure & deduplicating rows...')
                        : t('Đang nhập dữ liệu CSV vào Kho NASA...', 'Importing CSV data into NASA Warehouse...')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-white border border-emerald-300 text-emerald-900 font-bold font-mono text-[11px]">
                      ETA: {formatEta(csvProgress.etaSeconds, lang)}
                    </span>
                    <span className="font-black text-emerald-900 font-mono text-sm tabular-nums">
                      {csvProgress.percent}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-3 bg-emerald-200/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(4, csvProgress.percent)}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-900">
                  <span className="truncate max-w-md font-medium">
                    {t('Tệp hiện tại:', 'Current file:')} <strong className="font-mono">{csvProgress.currentFileName || '—'}</strong>
                  </span>
                  <span className="font-mono font-semibold tabular-nums">
                    {csvProgress.processedFiles}/{csvProgress.totalFiles} {t('tệp', 'files')} ·{' '}
                    {formatBytesMb(csvProgress.processedBytes)} / {formatBytesMb(csvProgress.totalBytes)}
                    {typeof csvProgress.processedRows === 'number' && csvProgress.processedRows > 0
                      ? ` · ${csvProgress.processedRows.toLocaleString(locale)} ${t('dòng', 'rows')}`
                      : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Folder Queue Summary Chips */}
            {queuedFolders.length > 0 && (
              <div className="space-y-2.5 p-4 bg-stone-50 rounded-xl border border-stone-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-800">
                    {t('Hàng đợi hiện tại:', 'Current queue:')} {queuedFolders.length} {t('thư mục', 'folders')} · {queuedFiles.length} {t('tệp CSV', 'CSV files')}
                  </span>
                  <button
                    type="button"
                    onClick={() => runBatchPreview(queuedFiles)}
                    disabled={previewing}
                    className="px-3 py-1.5 bg-white hover:bg-stone-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {previewing ? t('Đang kiểm tra...', 'Checking...') : t('Kiểm tra lại hàng loạt', 'Re-validate Batch')}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {queuedFolders.map((folder) => {
                    const displayFolder = getFolderDisplayName(folder.folderName, lang);
                    return (
                      <div
                        key={folder.folderName}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs shadow-2xs"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-bold text-stone-800 max-w-[220px] truncate" title={displayFolder}>
                          {displayFolder}
                        </span>
                        <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                          {folder.fileCount} {t('tệp', 'files')} ({(folder.totalBytes / 1024).toFixed(1)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFolderFromQueue(folder.folderName)}
                          className="text-stone-400 hover:text-rose-600 cursor-pointer"
                          title={t('Gỡ thư mục này khỏi hàng đợi', 'Remove this folder from queue')}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pre-validation Results Summary */}
            {previewing && (
              <div className="p-4 text-center text-xs text-stone-500 italic flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                {t(
                  'Đang phân tích cấu trúc các thư mục NASA POWER và lọc dữ liệu trùng lặp...',
                  'Analyzing NASA POWER folder schemas and deduplicating records...'
                )}
              </div>
            )}

            {batchPreview && !previewing && (
              <div className="space-y-4 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-emerald-600" /> {t('Kết quả kiểm tra hàng loạt trước khi nhập', 'Pre-Import Batch Validation Results')}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      batchPreview.preview.errors.length === 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {batchPreview.preview.errors.length === 0
                      ? t('Tất cả tệp hợp lệ', 'All files valid')
                      : t(`Có ${batchPreview.preview.errors.length} cảnh báo tệp`, `${batchPreview.preview.errors.length} file warnings`)}
                  </span>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="text-stone-400 text-[10px] block">{t('Số thư mục', 'Folders')}</span>
                    <span className="font-bold text-stone-900 text-sm">{batchPreview.totalFolders} {t('thư mục', 'folders')}</span>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="text-stone-400 text-[10px] block">{t('Số tệp CSV', 'CSV Files')}</span>
                    <span className="font-bold text-stone-900 text-sm">{batchPreview.totalFiles} {t('tệp', 'files')}</span>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="text-stone-400 text-[10px] block">{t('Bản ghi hợp lệ', 'Valid Rows')}</span>
                    <span className="font-bold text-emerald-700 text-sm">
                      {batchPreview.preview.validRows.toLocaleString(locale)}
                    </span>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="text-stone-400 text-[10px] block">{t('Ô lưới nhận diện', 'Grid Cells')}</span>
                    <span className="font-bold text-stone-800 text-sm">{batchPreview.preview.uniqueCells} {t('ô', 'cells')}</span>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="text-stone-400 text-[10px] block">{t('Khoảng ngày', 'Date Range')}</span>
                    <span className="font-bold text-stone-800 text-[11px] truncate block">
                      {batchPreview.preview.startDate || '—'} → {batchPreview.preview.endDate || '—'}
                    </span>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                    <span className="text-stone-400 text-[10px] block">{t('Chỉ số NASA', 'Indicators')}</span>
                    <span
                      className="font-bold text-emerald-800 text-[11px] truncate block"
                      title={batchPreview.preview.indicatorsDetected.join(', ')}
                    >
                      {batchPreview.preview.indicatorsDetected.join(', ') || t('Chưa rõ', 'Unknown')}
                    </span>
                  </div>
                </div>

                {/* Per-Folder Breakdown Table */}
                {batchPreview.folderSummaries.length > 0 && (
                  <div className="overflow-x-auto border border-stone-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 text-[11px]">
                        <tr>
                          <th className="p-2.5 font-bold">{t('Thư mục nguồn', 'Source Folder')}</th>
                          <th className="p-2.5 font-bold">{t('Số tệp CSV', 'CSV Files')}</th>
                          <th className="p-2.5 font-bold">{t('Dữ liệu hợp lệ', 'Valid Rows')}</th>
                          <th className="p-2.5 font-bold">{t('Trạng thái', 'Status')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {batchPreview.folderSummaries.map((fs) => (
                          <tr key={fs.folderName} className="hover:bg-stone-50/50">
                            <td className="p-2.5 font-semibold text-stone-900">{getFolderDisplayName(fs.folderName, lang)}</td>
                            <td className="p-2.5 font-mono text-stone-700">{fs.fileCount}</td>
                            <td className="p-2.5 font-mono font-bold text-emerald-700">
                              {fs.validRows.toLocaleString(locale)} {t('dòng', 'rows')}
                            </td>
                            <td className="p-2.5">
                              {fs.errors.length === 0 ? (
                                <span className="text-[11px] font-bold text-emerald-700">{t('Hợp lệ', 'Valid')}</span>
                              ) : (
                                <span className="text-[11px] font-bold text-rose-700">
                                  {fs.errors[0]}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Error notifications */}
                {batchPreview.preview.errors.length > 0 && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> {t('Các cảnh báo cấu trúc tệp:', 'File schema warnings:')}
                    </div>
                    <ul className="list-disc pl-5 max-h-32 overflow-y-auto">
                      {batchPreview.preview.errors.slice(0, 15).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sample Rows Table */}
                {batchPreview.preview.sampleRows.length > 0 && (
                  <div className="overflow-x-auto border border-stone-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[11px]">
                        <tr>
                          <th className="p-2 font-semibold">{t('Ô lưới gần nhất', 'Nearest Cell')}</th>
                          <th className="p-2 font-semibold">{t('Ngày quan trắc', 'Observation Date')}</th>
                          <th className="p-2 font-semibold">{t('Mã chỉ số NASA', 'NASA Indicator')}</th>
                          <th className="p-2 font-semibold">{t('Giá trị đo', 'Value')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {batchPreview.preview.sampleRows.map((r, i) => (
                          <tr key={i} className="hover:bg-stone-50/50">
                            <td className="p-2 font-mono text-stone-900 font-bold">{r.cell_id}</td>
                            <td className="p-2 font-mono text-stone-600">{r.date}</td>
                            <td className="p-2 font-bold text-emerald-800">{r.indicator_code}</td>
                            <td className="p-2 font-mono font-bold text-stone-800">{r.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Commit Import Button */}
                {batchPreview.preview.validRows > 0 && (
                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleClearQueue}
                      className="px-4 py-2.5 sm:py-2 border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                    >
                      {t('Hủy hàng đợi', 'Cancel Queue')}
                    </button>
                    <button
                      type="button"
                      onClick={handleCommitBatchImport}
                      disabled={importing}
                      className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {importing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {importing
                        ? t('Đang nhập hàng loạt vào Kho NASA...', 'Batch importing into NASA Warehouse...')
                        : t(
                            `Nhập toàn bộ ${batchPreview.totalFolders} thư mục (${batchPreview.preview.validRows.toLocaleString('vi-VN')} dòng) vào Kho NASA`,
                            `Import all ${batchPreview.totalFolders} folders (${batchPreview.preview.validRows.toLocaleString('en-US')} rows) into NASA Warehouse`
                          )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {importSuccessMsg && (
              <div className="p-3.5 bg-emerald-100 border border-emerald-300 text-emerald-950 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{importSuccessMsg}</span>
              </div>
            )}

            {/* Persisted Last Imported CSV Batch Summary (survives page reload) */}
            {lastCompletedBatch && queuedFiles.length === 0 && (
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>
                      {t('Thông tin gói CSV gần nhất đã đọc & lưu', 'Latest Imported CSV Batch Summary')} ({lastCompletedBatch.version})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-stone-500">
                    <span>
                      {t('Lúc', 'At')} {new Date(lastCompletedBatch.completedAt).toLocaleString(locale)}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        setLastCompletedBatch(null);
                        await CsvQueueStorage.savePatch({ lastCompletedBatch: null });
                      }}
                      className="text-stone-400 hover:text-stone-700 font-bold cursor-pointer"
                      title={t('Ẩn tóm tắt này', 'Dismiss summary')}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-stone-200">
                    <span className="text-[10px] text-stone-400 block">{t('Thư mục / Tệp', 'Folders / Files')}</span>
                    <span className="font-bold text-stone-900">
                      {lastCompletedBatch.totalFolders} {t('thư mục', 'folders')} · {lastCompletedBatch.totalFiles} {t('tệp', 'files')}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-stone-200">
                    <span className="text-[10px] text-stone-400 block">{t('Dòng dữ liệu hợp lệ', 'Valid Rows')}</span>
                    <span className="font-bold text-emerald-700">
                      {lastCompletedBatch.validRows.toLocaleString(locale)} {t('dòng', 'rows')}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-stone-200">
                    <span className="text-[10px] text-stone-400 block">{t('Ô lưới NASA', 'NASA Grid Cells')}</span>
                    <span className="font-bold text-stone-900">{lastCompletedBatch.uniqueCells} {t('ô', 'cells')}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-stone-200">
                    <span className="text-[10px] text-stone-400 block">{t('Khoảng ngày', 'Date Range')}</span>
                    <span className="font-bold text-stone-800 text-[11px]">
                      {lastCompletedBatch.startDate || '—'} → {lastCompletedBatch.endDate || '—'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-stone-200">
                    <span className="text-[10px] text-stone-400 block">{t('Chỉ số NASA', 'NASA Indicators')}</span>
                    <span className="font-bold text-emerald-800 text-[11px] truncate block">
                      {lastCompletedBatch.indicatorsDetected.join(', ') || '—'}
                    </span>
                  </div>
                </div>

                {lastCompletedBatch.sampleRows.length > 0 && (
                  <div className="overflow-x-auto border border-stone-200 rounded-xl bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[11px]">
                        <tr>
                          <th className="p-2 font-semibold">{t('Ô lưới', 'Cell')}</th>
                          <th className="p-2 font-semibold">{t('Ngày', 'Date')}</th>
                          <th className="p-2 font-semibold">{t('Chỉ số', 'Indicator')}</th>
                          <th className="p-2 font-semibold">{t('Giá trị', 'Value')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {lastCompletedBatch.sampleRows.slice(0, 5).map((r, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-mono font-bold text-stone-900">{r.cell_id}</td>
                            <td className="p-2 font-mono text-stone-600">{r.date}</td>
                            <td className="p-2 font-bold text-emerald-800">{r.indicator_code}</td>
                            <td className="p-2 font-mono font-bold text-stone-800">{r.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: SYNCHRONIZATION LOGS & ROLLBACK */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-700" />
                    {t('Lịch sử Đồng bộ & Nhập dữ liệu NASA POWER', 'NASA POWER Sync & Import History')}
                  </h2>
                  <p className="text-xs text-stone-500">
                    {t(
                      'Ghi nhận chi tiết mọi phiên đồng bộ API, nhập tay và tải lên hàng loạt thư mục CSV',
                      'Detailed audit log of every API sync, manual entry, and multi-folder CSV upload'
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchStatus}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition cursor-pointer"
                  title={t('Làm mới', 'Refresh')}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5">
                {syncLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-stone-400">{t('Chưa có nhật ký đồng bộ', 'No sync logs recorded yet')}</div>
                ) : (
                  syncLogs.map((log) => {
                    const isSuccess = log.status === 'SUCCESS';
                    const isFailed = log.status === 'FAILED';
                    return (
                      <div
                        key={log.id}
                        className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                isSuccess
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isFailed
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {log.status}
                            </span>
                            <span className="font-bold text-stone-900">{log.syncType}</span>
                          </div>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {new Date(log.startTime).toLocaleString(locale)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-stone-600">
                          <span>{t('Bản ghi đã đồng bộ:', 'Records synced:')} <strong>{log.recordsSynced.toLocaleString(locale)}</strong></span>
                          <span>{t('Mốc dữ liệu NASA:', 'NASA data date:')} <strong>{log.latestNasaDate || 'N/A'}</strong></span>
                        </div>

                        {log.details?.message && (
                          <p className="text-[11px] text-stone-500 italic">{log.details.message}</p>
                        )}

                        {log.errorMessage && (
                          <p className="text-[11px] text-rose-700 font-medium bg-rose-50 p-1.5 rounded">
                            {t('Lỗi:', 'Error:')} {log.errorMessage}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
              <div className="border-b border-stone-100 pb-3">
                <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-purple-700" />
                  {t('Khôi phục Phiên bản Dữ liệu', 'Dataset Version Rollback')}
                </h2>
                <p className="text-xs text-stone-500">
                  {t(
                    'Bảo vệ an toàn kho: Cho phép hoàn tác về trạng thái trước nếu gói nhập bị sai lệch',
                    'Warehouse safeguard: Revert to a previous snapshot if an imported batch contains errors'
                  )}
                </p>
              </div>

              <div className="space-y-2.5">
                {imports.map((imp) => {
                  const isCurrent = imp.version === status?.activeVersion;
                  return (
                    <div
                      key={imp.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 transition ${
                        isCurrent
                          ? 'bg-purple-50/70 border-purple-300 ring-1 ring-purple-300'
                          : 'bg-stone-50 border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-stone-900 truncate">{imp.fileName}</span>
                        <span className="text-[10px] font-mono bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded shrink-0">
                          {imp.version}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-stone-500">
                        <span>{imp.recordCount.toLocaleString(locale)} {t('bản ghi', 'records')}</span>
                        <span>{imp.startDate} → {imp.endDate}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-stone-200/60">
                        {isCurrent ? (
                          <span className="text-[11px] font-bold text-purple-800 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> {t('Phiên bản đang kích hoạt', 'Active version')}
                          </span>
                        ) : confirmRollbackVer === imp.version ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRollback(imp.version)}
                              className="text-[11px] bg-purple-700 text-white px-2 py-0.5 rounded font-bold cursor-pointer"
                            >
                              {t('Xác nhận khôi phục', 'Confirm Rollback')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRollbackVer(null)}
                              className="text-[11px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded cursor-pointer"
                            >
                              {t('Hủy', 'Cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRollbackVer(imp.version)}
                            className="text-[11px] text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> {t('Khôi phục phiên bản này', 'Restore this version')}
                          </button>
                        )}
                        <span className="text-[10px] text-stone-400">
                          {new Date(imp.createdAt).toLocaleDateString(locale)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 4: SUPABASE DDL SCHEMA REFERENCE */}
          <div className="bg-stone-900 rounded-2xl p-6 text-white border border-stone-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-stone-100">
                  {t('Kiến trúc Kho Dữ liệu Tập trung & Bảo mật Phân quyền', 'Central Data Warehouse Architecture & Access Control')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`-- See /src/db/supabase_schema.sql in repository source`);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 3000);
                }}
                className="text-xs bg-stone-800 hover:bg-stone-700 text-stone-300 px-3 py-1.5 rounded-lg border border-stone-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSql ? t('Đã sao chép', 'Copied') : t('Sao chép đường dẫn DDL', 'Copy DDL path')}
              </button>
            </div>

            <p className="text-xs text-stone-400 leading-relaxed">
              {t(
                'Dữ liệu NASA POWER nhập từ nhiều thư mục CSV được chuẩn hóa về 531 ô lưới Việt Nam với khóa duy nhất chống trùng lặp theo ô lưới, ngày và mã chỉ số. Chỉ tài khoản Quản trị viên mới có quyền đọc toàn hệ thống và ghi bổ sung kho dữ liệu NASA.',
                'NASA POWER CSV batches are normalized onto the 531 Vietnam 0.5° grid cells with a composite uniqueness key on cell, date, and indicator code. Only Administrator accounts can inspect platform-wide records and append data to the NASA warehouse.'
              )}
            </p>
          </div>
        </div>
      )}

      {/* READ-ONLY FIELD DETAIL & SATELLITE MAP MODAL */}
      {inspectingField && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-emerald-300 uppercase">
                  {t('Chi tiết Thửa ruộng (Chế độ Giám sát Quản trị)', 'Field Details (Admin Read-Only Inspector)')}
                </div>
                <h3 className="text-base sm:text-lg font-black">{inspectingField.name}</h3>
                <p className="text-xs text-stone-300">
                  {inspectingField.district ? `${inspectingField.district}, ` : ''}
                  {getLocalizedRegionName(inspectingField.province, lang)} · {t('Chủ sở hữu:', 'Owner:')} {inspectingField.ownerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingField(null)}
                className="p-2 rounded-lg hover:bg-stone-800 text-stone-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <SatelliteMap
                lat={inspectingField.lat}
                lon={inspectingField.lon}
                zoom={14}
                heightClass="h-60"
                interactive={false}
                showNasaGrid={true}
                fieldLabel={inspectingField.name}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-stone-400">{t('Chủ sở hữu & Chia sẻ', 'Owner & Sharing')}</div>
                  <div className="font-bold text-stone-900">{inspectingField.ownerName}</div>
                  <div className="font-mono text-stone-600 text-[11px]">{inspectingField.ownerEmail || inspectingField.ownerId}</div>
                  <div className="text-[11px] text-purple-800 font-semibold pt-1">
                    {inspectingField.sharedCount > 0
                      ? t(`Đang chia sẻ (${inspectingField.sharedCount} lượt / liên kết)`, `Shared (${inspectingField.sharedCount} recipients / links)`)
                      : t('Chế độ riêng tư', 'Private field')}
                  </div>
                </div>

                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-stone-400 flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-emerald-700" /> {t('Tọa độ & Ô lưới NASA', 'Coordinates & NASA Cell')}
                  </div>
                  <div className="font-mono font-bold text-stone-900">
                    {inspectingField.lat.toFixed(5)}°{lang === 'en' ? 'N' : 'B'}, {inspectingField.lon.toFixed(5)}°{lang === 'en' ? 'E' : 'Đ'}
                  </div>
                  <div className="text-[11px] text-emerald-800 font-semibold">
                    {t('Điểm khí hậu:', 'Climate grid:')} {inspectingField.nasaCellId} ({t('cách', 'dist.')} {inspectingField.nasaDistanceKm} km)
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {t('Diện tích canh tác:', 'Cultivated area:')} <strong>{inspectingField.areaHa} ha</strong>
                  </div>
                </div>

                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-stone-400 flex items-center gap-1">
                    <Sprout className="w-3 h-3 text-emerald-700" /> {t('Cây trồng hiện tại', 'Current Crop')}
                  </div>
                  <div className="font-bold text-stone-900">{getPlantDisplayName(inspectingField.cropName, lang)}</div>
                  <div className="text-[11px] text-stone-600">
                    {t('Giống:', 'Variety:')} {getCommonVarietyLabel(inspectingField.cropVariety, lang)} · {t('Giai đoạn:', 'Stage:')} {getCommonStageLabel(inspectingField.currentStage, lang)}
                  </div>
                </div>

                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-stone-400 flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-blue-700" /> {t('Chất đất & Nguồn nước', 'Soil & Water Source')}
                  </div>
                  <div className="font-bold text-stone-900">{getSoilLabel(inspectingField.soilType, lang)}</div>
                  <div className="text-[11px] text-stone-600">
                    {waterLabels[inspectingField.waterSourceType] || waterLabels.other}
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {t('Ngày tạo:', 'Created:')} {new Date(inspectingField.createdAt).toLocaleString(locale)}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingField(null)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {t('Đóng', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
