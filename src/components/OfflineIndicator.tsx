import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface OfflineIndicatorProps {
  lastSyncedAt?: string | null;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ lastSyncedAt }) => {
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [swUpdateWaiting, setSwUpdateWaiting] = useState(false);
  const { lang, t } = useLanguage();

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const onSwUpdate = () => setSwUpdateWaiting(true);
    window.addEventListener('cropcast-sw-update', onSwUpdate);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('cropcast-sw-update', onSwUpdate);
    };
  }, []);

  if (!isOffline && !swUpdateWaiting) return null;

  const formattedSync = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })
    : null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-3 right-3 sm:left-auto sm:right-4 z-40 max-w-md pointer-events-none flex flex-col gap-2">
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-900 text-amber-50 border border-amber-700 shadow-lg text-xs"
        >
          <WifiOff className="w-4 h-4 text-amber-300 shrink-0" />
          <div className="leading-snug">
            <div className="font-bold">
              {t('Đang ngoại tuyến — hiển thị dữ liệu ruộng đã lưu', 'Offline — showing last-synced field data')}
            </div>
            {formattedSync && (
              <div className="text-[11px] text-amber-200">
                {t('Đồng bộ gần nhất:', 'Last synced:')} {formattedSync}
              </div>
            )}
          </div>
        </div>
      )}

      {swUpdateWaiting && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-600 shadow-lg text-xs font-bold cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('Có phiên bản CropCast mới — Nhấn để cập nhật', 'New CropCast version ready — Tap to reload')}
        </button>
      )}
    </div>
  );
};
