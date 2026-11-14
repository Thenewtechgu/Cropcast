import React, { useState, useEffect } from 'react';
import { X, Mail, KeyRound, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  initialEmail?: string;
  onClose: () => void;
  onSendPasswordReset: (email: string) => Promise<void>;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  initialEmail = '',
  onClose,
  onSendPasswordReset,
}) => {
  const { t } = useLanguage();
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail && initialEmail.includes('@') ? initialEmail : '');
      setError(null);
      setSentToEmail(null);
    }
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setError(
        t(
          'Vui lòng nhập địa chỉ Email hợp lệ (VD: nongdan@gmail.com).',
          'Please enter a valid Email address (e.g. farmer@gmail.com).'
        )
      );
      return;
    }

    setLoading(true);
    try {
      await onSendPasswordReset(cleanEmail);
      setSentToEmail(cleanEmail);
    } catch (err: any) {
      setError(
        err?.message ||
          t(
            'Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại.',
            'Unable to send password reset email. Please try again.'
          )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4 text-emerald-100" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {t('Đặt lại mật khẩu qua Email', 'Reset Password via Email')}
              </h2>
              <p className="text-[11px] text-emerald-200">
                {t(
                  'Khôi phục quyền truy cập tài khoản CropCast',
                  'Recover access to your CropCast account'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {sentToEmail ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2.5 text-xs text-emerald-950">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 leading-relaxed">
                    <div className="font-bold text-sm">
                      {t(
                        'Đã gửi liên kết đặt lại mật khẩu!',
                        'Password reset link sent!'
                      )}
                    </div>
                    <p>
                      {t(
                        `Nếu tài khoản với email ${sentToEmail} tồn tại trên hệ thống, Firebase đã gửi email hướng dẫn đặt lại mật khẩu.`,
                        `If an account exists for ${sentToEmail}, Firebase has sent a password reset email.`
                      )}
                    </p>
                    <div className="p-2.5 bg-white/80 rounded-lg border border-emerald-200 text-[11px] font-medium text-emerald-900">
                      {t(
                        'Vui lòng kiểm tra Hộp thư đến (Inbox) và cả thư mục Thư rác / Spam, sau đó bấm vào liên kết để tạo mật khẩu mới.',
                        'Please check your Inbox as well as your Spam / Junk folder, then click the link to set a new password.'
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('Quay lại đăng nhập', 'Back to Sign In')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
              <p className="text-xs text-stone-600 leading-relaxed">
                {t(
                  'Nhập địa chỉ Email đã đăng ký với tài khoản CropCast. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu miễn phí qua Email.',
                  'Enter the Email address registered with your CropCast account. We will send a password reset link directly to your inbox.'
                )}
              </p>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="font-bold text-stone-800 block mb-1 text-xs">
                  {t('Địa chỉ Email', 'Email Address')}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="nongdan@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 text-base sm:text-sm"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  {t('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('Gửi email đặt lại mật khẩu', 'Send Reset Email')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
