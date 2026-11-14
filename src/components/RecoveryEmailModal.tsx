import React, { useState } from 'react';
import { X, Mail, Lock, Loader2, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface RecoveryEmailModalProps {
  isOpen: boolean;
  displayName: string;
  onClose: () => void;
  onLinkEmail: (
    newEmail: string,
    currentPassword?: string
  ) => Promise<{ status: 'linked' | 'verification_sent'; email: string }>;
}

export const RecoveryEmailModal: React.FC<RecoveryEmailModalProps> = ({
  isOpen,
  displayName,
  onClose,
  onLinkEmail,
}) => {
  const { t } = useLanguage();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [requirePasswordPrompt, setRequirePasswordPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    status: 'linked' | 'verification_sent';
    email: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail) || cleanEmail.endsWith('@users.cropcast.app')) {
      setError(
        t(
          'Vui lòng nhập một địa chỉ Email thật, hợp lệ (VD: nongdan@gmail.com).',
          'Please enter a real, valid Email address (e.g. farmer@gmail.com).'
        )
      );
      return;
    }

    setLoading(true);
    try {
      const res = await onLinkEmail(cleanEmail, currentPassword || undefined);
      setResult(res);
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        setRequirePasswordPrompt(true);
      }
      setError(
        err?.message ||
          t(
            'Không thể liên kết Email lúc này. Vui lòng thử lại.',
            'Unable to link Email right now. Please try again.'
          )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {t('Bổ sung Email khôi phục tài khoản', 'Add Recovery Email Address')}
              </h2>
              <p className="text-[11px] text-amber-100">
                {t('Bảo vệ tài khoản CropCast của bạn', 'Protect your CropCast account')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-amber-100 hover:text-white hover:bg-amber-700 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {result ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-950">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 leading-relaxed">
                    <div className="font-bold text-sm">
                      {result.status === 'linked'
                        ? t('Đã liên kết Email thành công!', 'Recovery Email linked!')
                        : t('Đã gửi Email xác nhận liên kết!', 'Verification email sent!')}
                    </div>
                    {result.status === 'linked' ? (
                      <p>
                        {t(
                          `Email ${result.email} đã được lưu vào tài khoản "${displayName}". Bạn có thể dùng Email này để đăng nhập hoặc khôi phục mật khẩu khi cần.`,
                          `Email ${result.email} is now linked to "${displayName}". You can use it to sign in or reset your password anytime.`
                        )}
                      </p>
                    ) : (
                      <p>
                        {t(
                          `Vui lòng mở hộp thư ${result.email} (kiểm tra cả Hộp thư đến và Thư rác / Spam) và bấm vào liên kết xác nhận để hoàn tất liên kết Email khôi phục.`,
                          `Please open ${result.email} (check both Inbox and Spam/Junk) and click the verification link to finish linking your recovery email.`
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-sm transition cursor-pointer"
              >
                {t('Tiếp tục sử dụng CropCast', 'Continue to CropCast')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs sm:text-sm">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 leading-relaxed">
                {t(
                  `Tài khoản "${displayName}" hiện chưa có địa chỉ Email thật trên hồ sơ. Vui lòng thêm và liên kết Email để dùng tính năng Quên mật khẩu và bảo vệ dữ liệu thửa ruộng của bạn.`,
                  `Your account "${displayName}" does not have a real Email address on file yet. Please add and link an Email address for password recovery and account security.`
                )}
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="font-bold text-stone-800 block mb-1 text-xs">
                  {t('Email khôi phục', 'Recovery Email')} *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="nongdan@gmail.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 text-base sm:text-sm"
                    required
                  />
                </div>
              </div>

              {requirePasswordPrompt && (
                <div>
                  <label className="font-bold text-stone-800 block mb-1 text-xs">
                    {t('Mật khẩu hiện tại (để xác nhận danh tính)', 'Current Password (to verify identity)')} *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder={t('Nhập mật khẩu hiện tại của bạn', 'Enter your current password')}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 text-base sm:text-sm"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  {t('Để sau', 'Later')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('Liên kết Email ngay', 'Link Email Now')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
