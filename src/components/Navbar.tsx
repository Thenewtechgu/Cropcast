import React, { useState } from 'react';
import {
  Sprout,
  Satellite,
  Layers,
  CalendarCheck,
  BarChart3,
  CalendarDays,
  Bot,
  History,
  Menu,
  X,
  ChevronDown,
  Plus,
  CheckCircle2,
  Database,
  Home,
  RefreshCw,
  LogIn,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { AppUser, FieldProfile } from '../types';

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

  const navItems = authUser?.isAdmin
    ? [{ id: 'admin', label: 'Quản trị Tổng thể CropCast', icon: Database, matchTabs: ['admin'] }]
    : [
        { id: 'home', label: 'Trang chủ', icon: Home, matchTabs: ['home'] },
        {
          id: 'dashboard',
          label: 'Chăm sóc ruộng',
          icon: Layers,
          matchTabs: ['dashboard', 'tasks', 'feedback'],
        },
        {
          id: 'rotation',
          label: 'Luân canh & Khí hậu',
          icon: RefreshCw,
          matchTabs: ['rotation', 'calendar', 'analytics'],
        },
        { id: 'fields', label: 'Ruộng của tôi', icon: Sprout, matchTabs: ['fields'] },
        { id: 'assistant', label: 'Trợ lý AI', icon: Bot, matchTabs: ['assistant'] },
      ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-xs">
      {/* Top Status & Account Bar */}
      <div className="bg-emerald-950 text-emerald-100 text-xs py-1.5 px-4 hidden sm:flex justify-between items-center">
        <div className="flex items-center gap-2 truncate">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
            <Satellite className="w-3.5 h-3.5" /> Quan trắc khí hậu 21 năm (2005–2025):
          </span>
          <span className="truncate text-emerald-100/90">
            531 ô lưới phủ khắp Việt Nam · Hỗ trợ quyết định luân canh &amp; chăm sóc ruộng
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {authUser ? (
            <div className="flex items-center gap-2">
              {authUser.isAdmin && (
                <span className="inline-flex items-center gap-1 bg-amber-400 text-stone-950 font-bold px-2 py-0.5 rounded text-[11px]">
                  <ShieldCheck className="w-3 h-3" /> Quản trị viên
                </span>
              )}
              <span className="text-emerald-200 font-semibold truncate max-w-[160px]">
                {authUser.displayName}
              </span>
              <button
                onClick={onSignOut}
                className="inline-flex items-center gap-1 bg-stone-800 hover:bg-stone-700 text-stone-200 px-2.5 py-0.5 rounded text-xs cursor-pointer transition"
              >
                <LogOut className="w-3 h-3" /> Đăng xuất
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-emerald-200 font-medium">Chưa đăng nhập</span>
              <button
                onClick={onSignIn}
                className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-2.5 py-0.5 rounded text-xs transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" /> Đăng nhập / Đăng ký
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer shrink-0"
            onClick={() => setActiveTab(authUser?.isAdmin ? 'admin' : 'home')}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-700 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-700/20">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base sm:text-lg text-stone-900 tracking-tight">
                  CropCast
                </span>
              </div>
              <p className="text-[10px] text-stone-500 hidden xl:block">
                {authUser?.isAdmin
                  ? 'Cổng Quản trị Tổng thể & Dữ liệu NASA'
                  : 'Trợ lý luân canh & mùa vụ cá nhân hóa'}
              </p>
            </div>
          </div>

          {/* Field Selector Dropdown (Hidden for Admin since Admin sees all app fields in dashboard) */}
          {!authUser?.isAdmin ? (
          <div className="relative">
            <button
              onClick={() => setFieldDropdownOpen(!fieldDropdownOpen)}
              className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200/80 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-800 font-medium transition cursor-pointer max-w-[180px] sm:max-w-[220px] truncate"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <div className="text-left truncate">
                <div className="text-[9px] text-stone-400 uppercase tracking-wider font-semibold leading-none">
                  Thửa ruộng
                </div>
                <div className="truncate font-semibold text-stone-900">
                  {activeField?.name || (authUser ? 'Chưa có thửa ruộng' : 'Đăng nhập để xem ruộng')}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-stone-500 shrink-0 ml-0.5" />
            </button>

            {fieldDropdownOpen && (
              <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-stone-200 py-2 z-50">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                  Thửa ruộng của bạn ({fields.length})
                </div>
                {fields.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-stone-500">
                    {authUser
                      ? 'Chưa có thửa ruộng nào trong tài khoản.'
                      : 'Vui lòng đăng nhập để tạo hoặc xem thửa ruộng riêng.'}
                  </div>
                ) : (
                  fields.map(f => (
                    <button
                      key={f.id}
                      onClick={() => {
                        onSelectField(f.id);
                        setFieldDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-start justify-between hover:bg-stone-50 transition cursor-pointer ${
                        f.id === activeField?.id
                          ? 'bg-emerald-50/70 border-l-4 border-emerald-600'
                          : ''
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                          <span>{f.name}</span>
                          {f.isSharedWithMe && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                              Được chia sẻ
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {f.crop.name} • {f.province}
                        </div>
                      </div>
                      {f.id === activeField?.id && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))
                )}
                <div className="border-t border-stone-100 mt-1 pt-1 px-2">
                  {authUser ? (
                    <button
                      onClick={() => {
                        onOpenNewFieldModal();
                        setFieldDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm thửa ruộng mới
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setFieldDropdownOpen(false);
                        onSignIn();
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-lg transition cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" /> Đăng nhập để thêm ruộng
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-950">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              Chế độ Quản trị Toàn hệ thống (Chỉ xem tổng thể &amp; Quản lý dữ liệu NASA)
            </div>
          )}

          {/* Desktop Nav Items */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = item.matchTabs.includes(activeTab);
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            {!authUser && (
              <button
                onClick={onSignIn}
                className="sm:hidden bg-amber-500 text-stone-950 px-2.5 py-1 rounded-lg text-xs font-bold"
              >
                Đăng nhập
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-stone-200 bg-white px-4 pt-2 pb-4 space-y-1 shadow-lg">
          <div className="py-1.5 flex items-center justify-between border-b border-stone-100 mb-1">
            {authUser ? (
              <div className="flex items-center justify-between w-full text-xs">
                <span className="font-bold text-stone-800">{authUser.displayName}</span>
                <button
                  onClick={() => {
                    onSignOut();
                    setMobileMenuOpen(false);
                  }}
                  className="px-2.5 py-1 bg-stone-100 text-stone-700 rounded-lg font-semibold"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  onSignIn();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 text-stone-950 font-bold py-2 rounded-lg text-xs"
              >
                <LogIn className="w-4 h-4" /> Đăng nhập Tài khoản Nông dân
              </button>
            )}
          </div>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = item.matchTabs.includes(activeTab);
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive ? 'bg-emerald-800 text-white' : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
