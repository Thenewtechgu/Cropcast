import React from 'react';
import { Info } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface AdvisoryDisclaimerProps {
  compact?: boolean;
  className?: string;
}

export const AdvisoryDisclaimer: React.FC<AdvisoryDisclaimerProps> = ({
  compact = false,
  className = '',
}) => {
  const { t } = useLanguage();

  return (
    <div
      role="note"
      className={`rounded-xl border border-amber-200/90 bg-amber-50/75 text-amber-950 flex items-start gap-2 ${
        compact ? 'px-3 py-2 text-[11px]' : 'px-4 py-2.5 text-xs'
      } ${className}`}
    >
      <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
      <p className="leading-relaxed font-medium">
        {t(
          '*Mọi khuyến nghị chỉ mang tính chất tham khảo và không mang tính tuyệt đối hoàn toàn. Hãy kiểm tra thực địa trước khi áp dụng trên diện rộng.',
          '*Recommendations are for reference purposes and should not be taken as absolute certainty. Always verify local field conditions before large-scale action.'
        )}
      </p>
    </div>
  );
};
