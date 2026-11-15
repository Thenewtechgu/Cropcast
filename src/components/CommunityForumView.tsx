import React, { useMemo, useState } from 'react';
import {
  Users,
  MapPin,
  Globe,
  ThumbsUp,
  MessageSquare,
  Send,
  Plus,
  Search,
  Sprout,
  CloudRain,
  Bug,
  Droplets,
  Store,
  RefreshCw,
  Languages,
  Loader2,
  AlertTriangle,
  LogIn,
  Cloud,
} from 'lucide-react';
import { AppUser, CommunityCategory, CommunityPost, FieldProfile } from '../types';
import {
  VIETNAM_PROVINCES,
  findDistrictInProvince,
  findProvinceByName,
  getDistrictsForProvince,
} from '../data/vietnamLocations';
import { getLocalizedRegionName } from '../data/nasaVietnamGrid';
import { getPlantDisplayName } from '../data/cropTaxonomy';
import { translateTexts } from '../services/translationService';
import { useLanguage } from '../contexts/LanguageContext';
import { AdvisoryDisclaimer } from './AdvisoryDisclaimer';

interface CommunityForumViewProps {
  activeField?: FieldProfile;
  authUser: AppUser | null;
  isDemoMode: boolean;
  posts: CommunityPost[];
  syncError?: string | null;
  onOpenAuthModal?: () => void;
  onCreatePost: (input: {
    province: string;
    district?: string;
    cropName?: string;
    category: CommunityCategory;
    title: string;
    content: string;
  }) => Promise<void> | void;
  onAddReply: (postId: string, content: string) => Promise<void> | void;
  onToggleUpvote: (postId: string) => Promise<void> | void;
}

function formatCommunityError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === 'string') {
      return parsed.error;
    }
  } catch {
    // not JSON
  }
  return raw;
}

interface TranslatedPostOverlay {
  targetLang: 'vi' | 'en';
  title: string;
  cropName?: string;
  content: string;
  replies: Record<string, string>;
}

export const CommunityForumView: React.FC<CommunityForumViewProps> = ({
  activeField,
  authUser,
  isDemoMode,
  posts,
  syncError,
  onOpenAuthModal,
  onCreatePost,
  onAddReply,
  onToggleUpvote,
}) => {
  const { lang, t } = useLanguage();
  const [scopeTab, setScopeTab] = useState<'local' | 'nationwide'>('nationwide');
  const [selectedCity, setSelectedCity] = useState<string>(activeField?.province || 'Cần Thơ');
  const [selectedCategory, setSelectedCategory] = useState<CommunityCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postProvince, setPostProvince] = useState<string>(activeField?.province || 'Cần Thơ');
  const [postDistrict, setPostDistrict] = useState<string>(activeField?.district || '');
  const [postCrop, setPostCrop] = useState<string>(activeField?.crop?.name || '');
  const [postCategory, setPostCategory] = useState<CommunityCategory>('rotation_tips');
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reply state per post
  const [expandedPostIds, setExpandedPostIds] = useState<Record<string, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusyId, setReplyBusyId] = useState<string | null>(null);

  // Per-post on-the-fly translation state
  const [translatedOverlays, setTranslatedOverlays] = useState<
    Record<string, TranslatedPostOverlay | undefined>
  >({});
  const [translatingPostId, setTranslatingPostId] = useState<string | null>(null);

  const currentActorId = authUser?.uid || 'demo_farmer_local';

  const categories: Array<{
    id: CommunityCategory;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeCls: string;
  }> = [
    {
      id: 'weather_alert',
      label: t('Thời tiết & Mùa vụ', 'Weather & Alerts'),
      icon: CloudRain,
      badgeCls: 'bg-sky-100 text-sky-900 border-sky-200',
    },
    {
      id: 'rotation_tips',
      label: t('Kinh nghiệm Luân canh', 'Crop Rotation'),
      icon: RefreshCw,
      badgeCls: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    },
    {
      id: 'pest_disease',
      label: t('Sâu bệnh & IPM', 'Pests & IPM'),
      icon: Bug,
      badgeCls: 'bg-rose-100 text-rose-900 border-rose-200',
    },
    {
      id: 'soil_water',
      label: t('Đất & Nước tưới', 'Soil & Water'),
      icon: Droplets,
      badgeCls: 'bg-amber-100 text-amber-900 border-amber-200',
    },
    {
      id: 'market_harvest',
      label: t('Thu hoạch & Đầu ra', 'Harvest & Market'),
      icon: Store,
      badgeCls: 'bg-purple-100 text-purple-900 border-purple-200',
    },
  ];

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const selProv = findProvinceByName(selectedCity);
    return posts.filter((p) => {
      if (scopeTab === 'local') {
        const postProv = findProvinceByName(p.province);
        const normPostProv = p.province.toLowerCase();
        const normSelected = selectedCity.toLowerCase();
        const matchesProv =
          (postProv && selProv && postProv.name === selProv.name) ||
          normPostProv === normSelected ||
          normPostProv.includes(normSelected) ||
          normSelected.includes(normPostProv);
        if (!matchesProv) {
          return false;
        }
      }
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }
      if (q) {
        const hay = `${p.title} ${p.titleEn || ''} ${p.content} ${p.contentEn || ''} ${p.province} ${p.district || ''} ${p.cropName || ''} ${p.cropNameEn || ''} ${p.authorName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [posts, scopeTab, selectedCity, selectedCategory, searchQuery]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      setPostError(
        t(
          'Vui lòng đăng nhập tài khoản để bài viết được đồng bộ Cloud cho tất cả bà con cùng xem.',
          'Please sign in so your post syncs to the shared Cloud forum for all farmers and devices.'
        )
      );
      onOpenAuthModal?.();
      return;
    }
    if (!postTitle.trim() || !postContent.trim()) {
      setPostError(
        t('Vui lòng nhập tiêu đề và nội dung chia sẻ.', 'Please enter both a title and post content.')
      );
      return;
    }
    setSubmitting(true);
    setPostError(null);
    setActionError(null);
    try {
      await onCreatePost({
        province: postProvince,
        district: postDistrict.trim() || undefined,
        cropName: postCrop.trim() || undefined,
        category: postCategory,
        title: postTitle.trim(),
        content: postContent.trim(),
      });
      setPostTitle('');
      setPostContent('');
      setComposerOpen(false);
      setSelectedCity(postProvince);
    } catch (err: unknown) {
      setPostError(
        formatCommunityError(
          err,
          t('Không thể đăng bài lúc này. Vui lòng thử lại.', 'Failed to publish post. Please try again.')
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async (postId: string) => {
    if (!authUser) {
      setActionError(
        t(
          'Vui lòng đăng nhập để gửi bình luận đồng bộ cho mọi người cùng xem.',
          'Please sign in to post a Cloud-synced reply visible to everyone.'
        )
      );
      onOpenAuthModal?.();
      return;
    }
    const text = (replyDrafts[postId] || '').trim();
    if (!text) return;
    setReplyBusyId(postId);
    setActionError(null);
    try {
      await onAddReply(postId, text);
      setReplyDrafts((prev) => ({ ...prev, [postId]: '' }));
      setExpandedPostIds((prev) => ({ ...prev, [postId]: true }));
    } catch (err: unknown) {
      setActionError(
        formatCommunityError(
          err,
          t('Không thể gửi bình luận lúc này. Vui lòng thử lại.', 'Could not post reply. Please try again.')
        )
      );
    } finally {
      setReplyBusyId(null);
    }
  };

  const handleUpvoteClick = async (postId: string) => {
    if (!authUser) {
      setActionError(
        t(
          'Đăng nhập để đánh dấu hữu ích và đồng bộ với cộng đồng.',
          'Sign in to upvote and sync with the community.'
        )
      );
      onOpenAuthModal?.();
      return;
    }
    setActionError(null);
    try {
      await onToggleUpvote(postId);
    } catch (err: unknown) {
      setActionError(
        formatCommunityError(
          err,
          t('Không thể cập nhật lượt hữu ích lúc này.', 'Could not update vote right now.')
        )
      );
    }
  };

  const handleToggleTranslatePost = async (post: CommunityPost) => {
    const existingOverlay = translatedOverlays[post.id];
    if (existingOverlay) {
      setTranslatedOverlays((prev) => ({ ...prev, [post.id]: undefined }));
      return;
    }

    const currentlyShowingEn = lang === 'en' && Boolean(post.titleEn && post.contentEn);
    const targetLang: 'vi' | 'en' = currentlyShowingEn ? 'vi' : lang === 'en' ? 'en' : 'en';

    // If UI is Vietnamese and user wants to translate a post into Vietnamese (e.g. written in English) or English:
    const hasVietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
      `${post.title} ${post.content}`
    );
    const resolvedTarget: 'vi' | 'en' =
      lang === 'vi'
        ? hasVietnameseChars
          ? 'en'
          : 'vi'
        : currentlyShowingEn
        ? 'vi'
        : 'en';

    if (resolvedTarget === 'en' && post.titleEn && post.contentEn && (post.replies || []).every((r) => !!r.contentEn)) {
      const replyMap: Record<string, string> = {};
      (post.replies || []).forEach((r) => {
        if (r.contentEn) replyMap[r.id] = r.contentEn;
      });
      setTranslatedOverlays((prev) => ({
        ...prev,
        [post.id]: {
          targetLang: 'en',
          title: post.titleEn!,
          cropName: post.cropNameEn || (post.cropName ? getPlantDisplayName(post.cropName, 'en') : undefined),
          content: post.contentEn!,
          replies: replyMap,
        },
      }));
      return;
    }

    if (resolvedTarget === 'vi' && post.title && post.content && hasVietnameseChars) {
      const replyMap: Record<string, string> = {};
      (post.replies || []).forEach((r) => {
        replyMap[r.id] = r.content;
      });
      setTranslatedOverlays((prev) => ({
        ...prev,
        [post.id]: {
          targetLang: 'vi',
          title: post.title,
          cropName: post.cropName,
          content: post.content,
          replies: replyMap,
        },
      }));
      return;
    }

    setTranslatingPostId(post.id);
    try {
      const replyList = post.replies || [];
      const batch = [
        post.title,
        post.cropName || '',
        post.content,
        ...replyList.map((r) => r.content),
      ];
      const { translations } = await translateTexts(
        batch,
        resolvedTarget,
        'Vietnamese farmer community discussion post and comments'
      );
      const replyMap: Record<string, string> = {};
      replyList.forEach((r, idx) => {
        replyMap[r.id] = translations[3 + idx] || r.content;
      });
      setTranslatedOverlays((prev) => ({
        ...prev,
        [post.id]: {
          targetLang: resolvedTarget,
          title: translations[0] || post.title,
          cropName: post.cropName ? translations[1] || getPlantDisplayName(post.cropName, resolvedTarget) : undefined,
          content: translations[2] || post.content,
          replies: replyMap,
        },
      }));
    } finally {
      setTranslatingPostId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              {t('Diễn đàn Nông dân Việt Nam', 'Vietnam Farmer Community')}
            </span>
            {authUser ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 normal-case font-semibold text-[11px]">
                <Cloud className="w-3 h-3" />
                {t('Đồng bộ Cloud thời gian thực', 'Live Cloud Sync')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 normal-case font-semibold text-[11px]">
                {t('Chế độ xem · Cần đăng nhập để đăng bài', 'Read-only · Sign in to post globally')}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 mt-1">
            {t('Trao đổi Mùa vụ, Đất nước & Sâu bệnh', 'Regional & Nationwide Farming Exchange')}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            {isDemoMode
              ? t(
                  'Bạn có thể đọc bài từ cộng đồng cả nước ngay. Đăng nhập để viết bài & bình luận đồng bộ tới mọi nông hộ.',
                  'Browse posts from farmers nationwide. Sign in to publish posts and replies visible on every device.'
                )
              : t(
                  'Hỏi đáp trực tiếp theo Tỉnh/Thành phố của ruộng bạn hoặc chia sẻ kinh nghiệm luân canh trên cả nước — hiển thị tức thì cho mọi thiết bị.',
                  'Discuss local weather, irrigation, and rotation lessons by City/Province or nationwide — synced live across all users.'
                )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-auto">
          {!authUser && onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-4 py-2.5 min-h-[44px] bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <LogIn className="w-4 h-4" />
              {t('Đăng nhập để đăng bài', 'Sign In to Post')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setComposerOpen((v) => !v)}
            className="px-4 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            {composerOpen ? t('Đóng khung viết bài', 'Close Composer') : t('Đăng bài chia sẻ / Hỏi đáp', 'New Post / Question')}
          </button>
        </div>
      </div>

      {syncError && (
        <div className="p-3.5 rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold">
              {t('Đồng bộ đám mây đang gặp gián đoạn tạm thời', 'Cloud community sync notice')}
            </div>
            <p className="text-[11px] leading-relaxed">{syncError}</p>
          </div>
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 text-xs flex items-center justify-between gap-2">
          <span className="font-semibold">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="font-bold cursor-pointer px-1">
            ✕
          </button>
        </div>
      )}

      <AdvisoryDisclaimer compact />

      {/* Scope Tabs: Khu vực cùng thành phố vs Cả nước + City Filter */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="grid grid-cols-2 gap-1.5 bg-stone-100 p-1 rounded-xl border border-stone-200">
            <button
              type="button"
              onClick={() => setScopeTab('local')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                scopeTab === 'local'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-950'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              {t('Khu vực cùng thành phố', 'Same City / Province')}
            </button>
            <button
              type="button"
              onClick={() => setScopeTab('nationwide')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                scopeTab === 'nationwide'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-950'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              {t('Cả nước', 'Nationwide')} ({posts.length})
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {scopeTab === 'local' && (
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="px-3 py-2 border border-stone-300 rounded-xl bg-stone-50 text-stone-900 font-bold text-base sm:text-xs"
              >
                {VIETNAM_PROVINCES.map((p) => (
                  <option key={p.name} value={p.name}>
                    {lang === 'en' ? p.nameEn : p.name}
                  </option>
                ))}
              </select>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('Tìm giống cây, sâu bệnh, vùng...', 'Search crops, pests, city...')}
                className="w-full sm:w-56 pl-8 pr-3 py-2 border border-stone-300 rounded-xl text-base sm:text-xs text-stone-900 bg-white focus:outline-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Category Filter Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer border ${
              selectedCategory === 'all'
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            {t('Tất cả chủ đề', 'All Topics')}
          </button>
          {categories.map((cat) => {
            const Icon = cat.icon;
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer border inline-flex items-center gap-1 ${
                  active
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Composer */}
      {composerOpen && (
        <form
          onSubmit={handlePublish}
          className="bg-white rounded-2xl p-5 border-2 border-emerald-600/30 shadow-md space-y-4 text-xs"
        >
          <div className="font-bold text-sm text-stone-900 flex items-center gap-2">
            <Sprout className="w-4 h-4 text-emerald-700" />
            {t('Viết bài chia sẻ thực tế hoặc hỏi đáp kỹ thuật', 'Share a Field Observation or Ask the Community')}
          </div>

          {!authUser && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>
                {t(
                  'Đăng nhập để bài viết được lưu lên Cloud và hiển thị tức thì cho tất cả nông dân khác (tránh mất bài khi chỉ lưu trên 1 máy).',
                  'Sign in so your post saves to Cloud Firestore and is immediately visible to all other farmers and devices.'
                )}
              </span>
              {onOpenAuthModal && (
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer shrink-0 self-start sm:self-auto"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  {t('Đăng nhập ngay', 'Sign In')}
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-stone-700 block mb-1">
                {t('Tỉnh / Thành phố', 'Province / City')}
              </label>
              <select
                value={postProvince}
                onChange={(e) => {
                  setPostProvince(e.target.value);
                  setPostDistrict('');
                }}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900 text-base sm:text-xs"
              >
                {VIETNAM_PROVINCES.map((p) => (
                  <option key={p.name} value={p.name}>
                    {lang === 'en' ? p.nameEn : p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-stone-700 block mb-1">
                {t('Quận / Huyện (tùy chọn)', 'District (optional)')}
              </label>
              <select
                value={postDistrict}
                onChange={(e) => setPostDistrict(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900 text-base sm:text-xs"
              >
                <option value="">{t('-- Chọn Quận/Huyện --', '-- Select District --')}</option>
                {getDistrictsForProvince(postProvince).map((d) => (
                  <option key={d.name} value={d.name}>
                    {lang === 'en' ? d.nameEn : d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-stone-700 block mb-1">
                {t('Chủ đề', 'Category')}
              </label>
              <select
                value={postCategory}
                onChange={(e) => setPostCategory(e.target.value as CommunityCategory)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-stone-900 text-base sm:text-xs"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="font-bold text-stone-700 block mb-1">
                {t('Tiêu đề bài viết', 'Post Title')}
              </label>
              <input
                type="text"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder={t(
                  'VD: Kinh nghiệm rút nước AWD lúa ST25 tránh đổ ngã gió Đông Bắc',
                  'e.g. Draining ST25 paddy mid-season to prevent lodging'
                )}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-base sm:text-xs text-stone-900 focus:outline-emerald-600"
              />
            </div>
            <div>
              <label className="font-bold text-stone-700 block mb-1">
                {t('Cây / Giống liên quan', 'Crop / Variety')}
              </label>
              <input
                type="text"
                value={postCrop}
                onChange={(e) => setPostCrop(e.target.value)}
                placeholder={t('VD: Lúa ST25, Lạc L14...', 'e.g. ST25 Rice, L14 Peanut...')}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-base sm:text-xs text-stone-900 focus:outline-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-stone-700 block mb-1">
              {t('Nội dung chi tiết', 'Details')}
            </label>
            <textarea
              rows={3}
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder={t(
                'Mô tả tình trạng ẩm độ đất, giống đang trồng, hoặc câu hỏi cho bà con cùng khu vực...',
                'Describe your soil moisture, crop stage, or question for neighboring farmers...'
              )}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-base sm:text-xs text-stone-900 focus:outline-emerald-600"
            />
          </div>

          {postError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-semibold">
              {postError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="px-4 py-2 text-stone-600 hover:underline cursor-pointer"
            >
              {t('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? t('Đang đăng...', 'Publishing...') : t('Đăng bài', 'Publish Post')}
            </button>
          </div>
        </form>
      )}

      {/* Posts Feed */}
      {filteredPosts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center space-y-3">
          <Users className="w-10 h-10 text-stone-300 mx-auto" />
          <div className="font-bold text-stone-800 text-base">
            {scopeTab === 'local'
              ? t(
                  `Chưa có bài viết nào tại ${getLocalizedRegionName(selectedCity, 'vi')}`,
                  `No posts yet in ${getLocalizedRegionName(selectedCity, 'en')}`
                )
              : t('Không tìm thấy bài viết phù hợp', 'No matching community posts')}
          </div>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            {scopeTab === 'local'
              ? t(
                  'Bạn có thể chuyển sang tab "Cả nước" để xem kinh nghiệm từ các vùng khác hoặc đăng bài mở đầu cho khu vực của mình.',
                  'Switch to "Nationwide" to browse tips across Vietnam or publish the first post for this city.'
                )
              : t('Thử thay đổi từ khóa tìm kiếm hoặc đăng bài mới.', 'Try another filter or publish a new post.')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {scopeTab === 'local' && (
              <button
                type="button"
                onClick={() => setScopeTab('nationwide')}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs cursor-pointer"
              >
                {t('Xem diễn đàn Cả nước', 'View Nationwide Forum')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              {t('Đăng bài ngay', 'Create Post')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const catMeta = categories.find((c) => c.id === post.category) || categories[1];
            const CatIcon = catMeta.icon;
            const hasLiked = post.upvotedUids.includes(currentActorId);
            const isExpanded = !!expandedPostIds[post.id];
            const overlay = translatedOverlays[post.id];
            const isTranslating = translatingPostId === post.id;

            const displayDistrict = post.district
              ? lang === 'en'
                ? findDistrictInProvince(post.province, post.district)?.nameEn ||
                  post.districtEn ||
                  post.district
                : post.district
              : undefined;

            const displayCropName = overlay?.cropName
              ? overlay.cropName
              : post.cropName
              ? lang === 'en'
                ? post.cropNameEn || getPlantDisplayName(post.cropName, 'en')
                : post.cropName
              : undefined;

            const displayTitle = overlay
              ? overlay.title
              : lang === 'en'
              ? post.titleEn || post.title
              : post.title;

            const displayContent = overlay
              ? overlay.content
              : lang === 'en'
              ? post.contentEn || post.content
              : post.content;

            return (
              <article
                key={post.id}
                className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${catMeta.badgeCls}`}
                    >
                      <CatIcon className="w-3 h-3" />
                      {catMeta.label}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 text-stone-800 text-[11px] font-semibold">
                      <MapPin className="w-3 h-3 text-emerald-700" />
                      {getLocalizedRegionName(post.province, lang)}
                      {displayDistrict ? ` · ${displayDistrict}` : ''}
                    </span>
                    {displayCropName && (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-bold">
                        {displayCropName}
                      </span>
                    )}
                    {post.isDemoSeed ? (
                      <span className="px-2 py-0.5 rounded-lg bg-stone-100 text-stone-500 text-[10px] font-semibold">
                        {t('Bài mẫu tham khảo', 'Sample Guide')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100/80 text-emerald-900 text-[10px] font-semibold">
                        <Cloud className="w-3 h-3" />
                        {t('Cộng đồng Cloud', 'Live Community')}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-stone-400 font-mono">
                    {new Date(post.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'vi-VN')}
                  </span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-base font-bold text-stone-900 leading-snug">{displayTitle}</h2>
                  <div className="text-[11px] text-stone-500 font-medium flex flex-wrap items-center gap-2">
                    <span>
                      {t('Đăng bởi:', 'Posted by:')} <strong className="text-stone-700">{post.authorName}</strong>
                    </span>
                    {overlay && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-900 text-[10px] font-semibold">
                        {overlay.targetLang === 'en'
                          ? t('Đã dịch sang Tiếng Anh', 'Translated to English')
                          : t('Đã dịch sang Tiếng Việt', 'Translated to Vietnamese')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-stone-700 leading-relaxed pt-1 whitespace-pre-line">
                    {displayContent}
                  </p>
                </div>

                <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpvoteClick(post.id)}
                      className={`px-3 py-1.5 min-h-[40px] sm:min-h-0 rounded-xl border font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                        hasLiked
                          ? 'bg-emerald-800 text-white border-emerald-800'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{t('Hữu ích', 'Helpful')}</span>
                      <span className="font-mono tabular-nums">({post.likesCount})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPostIds((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                      }
                      className="px-3 py-1.5 min-h-[40px] sm:min-h-0 rounded-xl border bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200 font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{t('Thảo luận', 'Replies')}</span>
                      <span className="font-mono tabular-nums">({post.replies.length})</span>
                    </button>

                    <button
                      type="button"
                      disabled={isTranslating}
                      onClick={() => handleToggleTranslatePost(post)}
                      className={`px-3 py-1.5 min-h-[40px] sm:min-h-0 rounded-xl border font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                        overlay
                          ? 'bg-sky-700 text-white border-sky-700'
                          : 'bg-sky-50 hover:bg-sky-100 text-sky-900 border-sky-200'
                      }`}
                    >
                      {isTranslating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Languages className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isTranslating
                          ? t('Đang dịch...', 'Translating...')
                          : overlay
                          ? t('Xem bản gốc', 'Show Original')
                          : t('Dịch VI ↔ EN', 'Translate VI ↔ EN')}
                      </span>
                    </button>
                  </div>
                </div>

                {(isExpanded || post.replies.length > 0) && (
                  <div className="pt-2 space-y-2.5">
                    {post.replies.length > 0 && (
                      <div className="space-y-2 pl-3 border-l-2 border-emerald-200">
                        {(isExpanded ? post.replies : post.replies.slice(0, 1)).map((rep) => {
                          const displayReplyText =
                            overlay?.replies[rep.id] ||
                            (lang === 'en' ? rep.contentEn || rep.content : rep.content);
                          return (
                            <div
                              key={rep.id}
                              className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/80 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-bold text-stone-800">
                                  {rep.authorName}
                                  {rep.authorProvince && (
                                    <span className="text-stone-500 font-normal">
                                      {' '}
                                      · {getLocalizedRegionName(rep.authorProvince, lang)}
                                    </span>
                                  )}
                                </span>
                                <span className="text-stone-400 font-mono">
                                  {new Date(rep.createdAt).toLocaleDateString(
                                    lang === 'en' ? 'en-US' : 'vi-VN'
                                  )}
                                </span>
                              </div>
                              <p className="text-stone-700 leading-relaxed">{displayReplyText}</p>
                            </div>
                          );
                        })}
                        {!isExpanded && post.replies.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setExpandedPostIds((prev) => ({ ...prev, [post.id]: true }))}
                            className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                          >
                            {t(
                              `Xem thêm ${post.replies.length - 1} bình luận...`,
                              `Show ${post.replies.length - 1} more replies...`
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {isExpanded && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <input
                          type="text"
                          value={replyDrafts[post.id] || ''}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          placeholder={t('Viết câu trả lời hoặc kinh nghiệm của bạn...', 'Write a helpful reply...')}
                          className="flex-1 min-w-0 px-3 py-2 border border-stone-300 rounded-xl text-base sm:text-xs text-stone-900 bg-white focus:outline-emerald-600"
                        />
                        <button
                          type="button"
                          disabled={replyBusyId === post.id || !(replyDrafts[post.id] || '').trim()}
                          onClick={() => handleReplySubmit(post.id)}
                          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {t('Gửi', 'Reply')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
