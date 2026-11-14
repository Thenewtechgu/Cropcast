import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../contexts/LanguageContext';

export const PWAInstallButton: React.FC = () => {
  const { canInstall, hasNativePrompt, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const { t } = useLanguage();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled || !canInstall) return null;

  const handleClick = async () => {
    if (hasNativePrompt) {
      await promptInstall();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 transition shadow-xs cursor-pointer shrink-0"
        title={t('Cài CropCast về màn hình chính để xem ngoại tuyến', 'Install CropCast to home screen for offline use')}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('Cài đặt App', 'Install App')}</span>
        <span className="sm:hidden">{t('Cài App', 'Install')}</span>
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white text-stone-900 rounded-2xl p-5 shadow-2xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-emerald-950">
                {t('Cài đặt CropCast trên iPhone / iPad', 'Install CropCast on iOS')}
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="text-xs text-stone-700 space-y-2 list-decimal pl-4 leading-relaxed">
              <li>
                {t(
                  'Nhấn biểu tượng Chia sẻ (Share) ở thanh công cụ dưới cùng của Safari.',
                  'Tap the Share icon at the bottom of Safari.'
                )}{' '}
                <Share className="inline w-3.5 h-3.5 text-emerald-700 align-text-bottom" />
              </li>
              <li>
                {t(
                  'Cuộn xuống và chọn "Thêm vào Màn hình chính" (Add to Home Screen).',
                  'Scroll down and choose "Add to Home Screen".'
                )}
              </li>
              <li>
                {t(
                  'Nhấn "Thêm" (Add) để dùng CropCast ngay cả khi mất sóng ngoài ruộng.',
                  'Tap "Add" to use CropCast even when offline in the field.'
                )}
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              {t('Đã hiểu', 'Got it')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
