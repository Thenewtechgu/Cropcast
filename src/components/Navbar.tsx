import React, { useState } from 'react';
import {
  Sprout,
  Menu,
  X,
  ChevronDown,
  Plus,
  CheckCircle2,
  LogIn,
  LogOut,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { AppUser, FieldProfile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useViewMode } from '../contexts/ViewModeContext';
import { getPlantDisplayName } from '../data/cropTaxonomy';
import { getLocalizedRegionName } from '../data/nasaVietnamGrid';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  fields: FieldProfile[];
  activeField?: FieldProfile;
  onSelectField: (fieldId: string) => void;
  onOpenNewFieldModal: () => void;
  authUser: AppUser | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  fields,
  activeField,
  onSelectField,
  onOpenNewFieldModal,
  authUser,
  onSignIn,
  onSignOut,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fieldDropdownOpen, setFieldDropdownOpen] = useState(false);
  const { lang, setLang, t } = useLanguage();
  const { viewMode, setViewMode } = useViewMode();

  const navItems = authUser?.isAdmin
    ? [{ id: 'admin', label: t('Quản trị', 'Admin'), matchTabs: ['admin'] }]
    : [
        { id: 'home', label: t('Trang chủ', 'Home'), matchTabs: ['home'] },
        { id: 'dashboard', label: t('Tổng quan', 'Overview'), matchTabs: ['dashboard', 'tasks', 'feedback'] },
        { id: 'rotation', label: t('Luân canh', 'Rotation'), matchTabs: ['rotation', 'calendar', 'analytics'] },
        { id: 'fields', label: t('Ruộng của tôi', 'My Fields'), matchTabs: ['fields'] },
        { id: 'assistant', label: t('Trợ lý AI', 'AI Assistant'), matchTabs: ['assistant'] },
      ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Zone 1: Brand + Compact Field Selector */}
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab(authUser?.isAdmin ? 'admin' : 'home')}
              className="flex items-center gap-2 cursor-pointer shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center text-white">
                <Sprout className="w-4 h-4" />
              </div>
              <span className="font-bold text-base text-stone-900 tracking-tight whitespace-nowrap">
                CropCast
              </span>
            </button>

            {!authUser?.isAdmin && (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setFieldDropdownOpen(!fieldDropdownOpen)}
                  className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200/80 px-3 py-1.5 rounded-lg text-xs text-stone-800 font-medium transition cursor-pointer max-w-[190px]"
                >
                  <span className="truncate font-semibold text-stone-900">
                    {activeField?.name || (authUser ? t('Chọn ruộng', 'Select field') : t('Chưa chọn ruộng', 'No field selected'))}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                </button>

                {fieldDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-stone-200 py-2 z-50">
                    <div className="px-3 py-1 text-[11px] font-semibold text-stone-400">
                      {t('Thửa ruộng', 'Fields')} ({fields.length})
                    </div>
                    {fields.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-stone-500">
                        {authUser
                          ? t('Chưa có thửa ruộng nào.', 'No fields saved yet.')
                          : t('Đăng nhập để tạo hoặc xem ruộng riêng.', 'Sign in to create or view your fields.')}
                      </div>
                    ) : (
                      fields.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            onSelectField(f.id);
                            setFieldDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left flex items-start justify-between hover:bg-stone-50 transition cursor-pointer ${
                            f.id === activeField?.id ? 'bg-emerald-50/70' : ''
                          }`}
                        >
                          <div>
                            <div className="text-xs font-semibold text-stone-900">{f.name}</div>
                            <div className="text-[11px] text-stone-500">
                              {getPlantDisplayName(f.crop.name, lang)} · {getLocalizedRegionName(f.province, lang)}
                            </div>
                          </div>
                          {f.id === activeField?.id && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                          )}
                        </button>
                      ))
                    )}
                    <div className="border-t border-stone-100 mt-1 pt-1 px-2">
                      {authUser ? (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenNewFieldModal();
                            setFieldDropdownOpen(false);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> {t('Thêm thửa ruộng', 'Add field')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setFieldDropdownOpen(false);
                            onSignIn();
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          <LogIn className="w-3.5 h-3.5" /> {t('Đăng nhập để thêm ruộng', 'Sign in to add field')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden lg:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = item.matchTabs.includes(activeTab);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`text-sm font-medium transition cursor-pointer whitespace-nowrap shrink-0 py-1 border-b-2 ${
                    isActive
                      ? 'border-emerald-800 text-emerald-900 font-semibold'
                      : 'border-transparent text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: View Mode Toggle + PWA Install + Language Switcher + Account Action */}
          <div className="flex items-center gap-2 shrink-0">
            {!authUser?.isAdmin && (
              <div
                role="group"
                aria-label={t('Chế độ hiển thị', 'Display mode')}
                className="hidden md:inline-flex items-center bg-stone-100 border border-stone-200 rounded-lg p-0.5 text-[11px] font-bold"
              >
                <button
                  type="button"
                  onClick={() => setViewMode('simple')}
                  className={`px-2 py-1 rounded-md transition cursor-pointer ${
                    viewMode === 'simple'
                      ? 'bg-emerald-800 text-white shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {t('Đơn giản', 'Simple')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('detailed')}
                  className={`px-2 py-1 rounded-md transition cursor-pointer ${
                    viewMode === 'detailed'
                      ? 'bg-emerald-800 text-white shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {t('Chi tiết', 'Detailed')}
                </button>
              </div>
            )}

            <PWAInstallButton />

            {/* Bilingual Language Toggle right on Navbar */}
            <div
              role="group"
              aria-label="Language"
              className="inline-flex items-center bg-stone-100 border border-stone-200 rounded-lg p-0.5 text-[11px] font-bold"
            >
              <Globe className="w-3.5 h-3.5 text-stone-500 ml-1.5 mr-1 hidden sm:block" />
              <button
                type="button"
                onClick={() => setLang('vi')}
                className={`px-2 py-1 rounded-md transition cursor-pointer ${
                  lang === 'vi'
                    ? 'bg-emerald-800 text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                VI
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded-md transition cursor-pointer ${
                  lang === 'en'
                    ? 'bg-emerald-800 text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                EN
              </button>
            </div>

            {authUser ? (
              <div className="hidden sm:flex items-center gap-2">
                {authUser.isAdmin && (
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className="text-xs font-semibold text-stone-700 truncate max-w-[120px]">
                  {authUser.displayName}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer transition inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" /> {t('Đăng xuất', 'Sign out')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" /> {t('Đăng nhập', 'Sign in')}
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 cursor-pointer lg:hidden"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-stone-200 bg-white px-4 py-3 space-y-2 shadow-md max-h-[82dvh] overflow-y-auto">
          {authUser ? (
            <div className="pb-2 border-b border-stone-100 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                {authUser.isAdmin && <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />}
                <span className="font-semibold text-stone-800 truncate">{authUser.displayName}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSignOut();
                  setMobileMenuOpen(false);
                }}
                className="px-2.5 py-1.5 bg-stone-100 text-stone-700 rounded-lg font-semibold shrink-0"
              >
                {t('Đăng xuất', 'Sign out')}
              </button>
            </div>
          ) : (
            <div className="pb-2 border-b border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onSignIn();
                }}
                className="w-full py-2 px-3 bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" /> {t('Đăng nhập / Tạo tài khoản', 'Sign in / Create account')}
              </button>
            </div>
          )}

          {!authUser?.isAdmin && (
            <div className="md:hidden pb-2 border-b border-stone-100 flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-stone-600">{t('Chế độ xem:', 'Display Mode:')}</span>
              <div className="inline-flex items-center bg-stone-100 border border-stone-200 rounded-lg p-0.5 font-bold">
                <button
                  type="button"
                  onClick={() => setViewMode('simple')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    viewMode === 'simple' ? 'bg-emerald-800 text-white' : 'text-stone-600'
                  }`}
                >
                  {t('Đơn giản', 'Simple')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('detailed')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    viewMode === 'detailed' ? 'bg-emerald-800 text-white' : 'text-stone-600'
                  }`}
                >
                  {t('Chi tiết', 'Detailed')}
                </button>
              </div>
            </div>
          )}

          {!authUser?.isAdmin && (
            <div className="sm:hidden pb-2 border-b border-stone-100 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 px-1">
                {t('Thửa ruộng đang theo dõi', 'Active Field')} ({fields.length})
              </div>
              {fields.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {fields.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        onSelectField(f.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between text-xs border ${
                        f.id === activeField?.id
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                          : 'bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="truncate">{f.name}</div>
                        <div className="text-[10px] text-stone-500 truncate">
                          {getPlantDisplayName(f.crop.name, lang)} · {getLocalizedRegionName(f.province, lang)}
                        </div>
                      </div>
                      {f.id === activeField?.id && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {authUser && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenNewFieldModal();
                  }}
                  className="w-full py-2 px-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> {t('Thêm thửa ruộng mới', 'Add New Field')}
                </button>
              )}
            </div>
          )}

          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = item.matchTabs.includes(activeTab);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive ? 'bg-emerald-800 text-white' : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
