import React, { useState } from 'react';
import {
  X,
  User,
  Lock,
  LogIn,
  UserPlus,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Sprout,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleSignIn: () => Promise<void>;
  onUsernameSignIn: (username: string, password: string) => Promise<void>;
  onUsernameSignUp: (username: string, password: string) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onGoogleSignIn,
  onUsernameSignIn,
  onUsernameSignUp,
}) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim();
    if (cleanUser.length < 3) {
      setError(
        t(
          'Tên đăng nhập cần có ít nhất 3 ký tự (chữ cái, số, dấu chấm hoặc gạch dưới).',
          'Username must be at least 3 characters (letters, numbers, dot, or underscore).'
        )
      );
      return;
    }
    if (password.length < 6) {
      setError(t('Mật khẩu cần có ít nhất 6 ký tự.', 'Password must be at least 6 characters.'));
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError(t('Mật khẩu nhập lại chưa khớp.', 'Passwords do not match.'));
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await onUsernameSignUp(cleanUser, password);
      } else {
        await onUsernameSignIn(cleanUser, password);
      }
      setUsername('');
      setPassword('');
      setConfirmPassword('');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center">
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
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
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

          {/* Username + Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs sm:text-sm">
            <div>
              <label className="font-bold text-stone-800 block mb-1 text-xs">
                {t('Tên đăng nhập', 'Username')}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoComplete="username"
                  placeholder={t('VD: nongdan_hanoi', 'e.g. farmer_hanoi')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-stone-800 block mb-1 text-xs">
                {t('Mật khẩu', 'Password')}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={t('Tối thiểu 6 ký tự', 'Minimum 6 characters')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 text-sm"
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
                    className="w-full pl-9 pr-3 py-2.5 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 text-sm"
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
                ? t('Đăng nhập bằng Tên đăng nhập', 'Sign in with Username')
                : t('Đăng ký ngay', 'Register Now')}
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
  );
};
