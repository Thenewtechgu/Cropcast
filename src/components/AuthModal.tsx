import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  Lock,
  LogIn,
  UserPlus,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Sprout,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleSignIn: () => Promise<void>;
  onUsernameSignIn: (username: string, password: string) => Promise<void>;
  onEmailSignUp: (params: {
    email: string;
    password: string;
    displayName?: string;
    phone?: string;
  }) => Promise<void>;
  onSendPasswordReset: (email: string) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onGoogleSignIn,
  onUsernameSignIn,
  onEmailSignUp,
  onSendPasswordReset,
}) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [identifier, setIdentifier] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  if (!isOpen) return null;

  const resetFields = () => {
    setIdentifier('');
    setDisplayName('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanInput = identifier.trim();
    if (mode === 'signup') {
      const normalizedEmail = cleanInput.toLowerCase();
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail) ||
        normalizedEmail.endsWith('@users.cropcast.app')
      ) {
        setError(
          t(
            'Vui lòng nhập địa chỉ Email hợp lệ để đăng ký (VD: nongdan@gmail.com).',
            'Please enter a valid Email address to sign up (e.g. farmer@gmail.com).'
          )
        );
        return;
      }
      if (password.length < 6) {
        setError(t('Mật khẩu cần có ít nhất 6 ký tự.', 'Password must be at least 6 characters.'));
        return;
      }
      if (password !== confirmPassword) {
        setError(t('Mật khẩu nhập lại chưa khớp.', 'Passwords do not match.'));
        return;
      }
    } else {
      if (cleanInput.length < 3) {
        setError(
          t(
            'Vui lòng nhập Email hợp lệ (hoặc tên đăng nhập cũ từ 3 ký tự).',
            'Please enter a valid Email (or legacy username of at least 3 characters).'
          )
        );
        return;
      }
      if (password.length < 6) {
        setError(t('Mật khẩu cần có ít nhất 6 ký tự.', 'Password must be at least 6 characters.'));
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await onEmailSignUp({
          email: cleanInput.toLowerCase(),
          password,
          displayName: displayName.trim() || undefined,
          phone: phone.trim() || undefined,
        });
      } else {
        await onUsernameSignIn(cleanInput, password);
      }
      resetFields();
      onClose();
    } catch (err: any) {
      setError(
        err?.message ||
          t('Không thể xác thực tài khoản. Vui lòng thử lại.', 'Authentication failed. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await onGoogleSignIn();
      onClose();
    } catch (err: any) {
      setError(
        err?.message ||
          t('Không thể đăng nhập bằng Google lúc này.', 'Unable to sign in with Google right now.')
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
        <div className="relative w-full max-w-md max-h-[92dvh] bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-emerald-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center shrink-0">
                <Sprout className="w-5 h-5 text-emerald-200" />
              </div>
              <div>
                <h2 className="text-base font-bold">
                  {mode === 'signin'
                    ? t('Đăng nhập CropCast', 'Sign in to CropCast')
                    : t('Tạo tài khoản CropCast', 'Create CropCast Account')}
                </h2>
                <p className="text-[11px] text-emerald-200">
                  {t(
                    'Mỗi tài khoản lưu trữ riêng tư các thửa ruộng của bạn',
                    'Each account privately stores your field profiles'
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

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
            {/* Mode Tabs */}
            <div className="grid grid-cols-2 gap-1.5 bg-stone-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className={`py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'signin'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" /> {t('Đăng nhập', 'Sign In')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className={`py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'signup'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" /> {t('Đăng ký mới', 'Sign Up')}
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Email + Password Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="font-bold text-stone-800 block mb-1 text-xs">
                  {mode === 'signup'
                    ? t('Địa chỉ Email *', 'Email Address *')
                    : t('Email (hoặc tên đăng nhập cũ)', 'Email (or legacy username)')}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={mode === 'signup' ? 'email' : 'text'}
                    autoComplete="email"
                    placeholder={
                      mode === 'signup'
                        ? t('VD: nongdan@gmail.com', 'e.g. farmer@gmail.com')
                        : t('VD: nongdan@gmail.com hoặc tên đăng nhập cũ', 'e.g. farmer@gmail.com or legacy username')
                    }
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 text-base sm:text-sm"
                    required
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <>
                  <div>
                    <label className="font-bold text-stone-800 block mb-1 text-xs">
                      {t('Họ và tên / Tên hiển thị', 'Display Name')}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        autoComplete="name"
                        maxLength={120}
                        placeholder={t('VD: Nguyễn Văn An (để trống nếu dùng tên email)', 'e.g. John Farmer (optional)')}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 text-base sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-stone-800 block mb-1 text-xs">
                      {t('Số điện thoại (tùy chọn)', 'Phone Number (optional)')}
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        autoComplete="tel"
                        maxLength={30}
                        placeholder={t('VD: 0912345678', 'e.g. +84 912 345 678')}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 text-base sm:text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-stone-800 text-xs">
                    {t('Mật khẩu', 'Password')}
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => setForgotModalOpen(true)}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                    >
                      {t('Quên mật khẩu?', 'Forgot password?')}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    placeholder={t('Tối thiểu 6 ký tự', 'Minimum 6 characters')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 text-base sm:text-sm"
                    required
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="font-bold text-stone-800 block mb-1 text-xs">
                    {t('Nhập lại mật khẩu', 'Confirm password')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder={t('Nhập lại mật khẩu', 'Re-enter password')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 text-base sm:text-sm"
                      required
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'signin'
                  ? t('Đăng nhập', 'Sign In')
                  : t('Đăng ký tài khoản với Email', 'Create Account with Email')}
              </button>
            </form>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-stone-200" />
              <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
                {t('hoặc', 'or')}
              </span>
              <div className="flex-grow border-t border-stone-200" />
            </div>

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={loading || googleLoading}
              className="w-full py-2.5 bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
              ) : (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                  G
                </span>
              )}
              {t('Tiếp tục với tài khoản Google', 'Continue with Google')}
            </button>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-[11px] text-stone-600 flex items-start gap-2 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <p>
                {t(
                  'Dữ liệu thửa ruộng của mỗi tài khoản được bảo vệ riêng tư — chỉ người tạo ruộng hoặc người được bạn chia sẻ mới xem được.',
                  'Each field profile is private — only the creator or users you explicitly share with can access it.'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={forgotModalOpen}
        initialEmail={identifier}
        onClose={() => setForgotModalOpen(false)}
        onSendPasswordReset={onSendPasswordReset}
      />
    </>
  );
};
