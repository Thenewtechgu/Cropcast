import React, { useState } from 'react';
import { History, Sparkles, CheckCircle2, MessageSquare, Send, Brain } from 'lucide-react';
import { FeedbackRecord, FeedbackType, FieldProfile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface FeedbackHistoryViewProps {
  activeField: FieldProfile;
  feedbackHistory: FeedbackRecord[];
  onAddFeedback: (feedback: Omit<FeedbackRecord, 'id' | 'timestamp'>) => void;
}

export const FeedbackHistoryView: React.FC<FeedbackHistoryViewProps> = ({
  activeField,
  feedbackHistory,
  onAddFeedback,
}) => {
  const { lang, t } = useLanguage();
  const [selectedType, setSelectedType] = useState<FeedbackType>('soil_still_dry');
  const [customComment, setCustomComment] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const feedbackOptions: Array<{ type: FeedbackType; label: string; desc: string }> = [
    {
      type: 'soil_still_dry',
      label: t('Đất thực tế vẫn khô', 'Soil is still dry'),
      desc: t(
        'Đất khô nhanh hơn mô hình tính toán, rễ cần nước sớm',
        'Topsoil dried faster than model estimated; roots need water sooner'
      ),
    },
    {
      type: 'soil_too_wet',
      label: t('Đất đang quá ẩm / ứ đọng', 'Soil too wet / waterlogged'),
      desc: t(
        'Sau mưa/tưới nước thoát chậm, có dấu hiệu úng cục bộ',
        'Slow drainage after rain or irrigation; localized pooling observed'
      ),
    },
    {
      type: 'crop_healthy',
      label: t('Cây phát triển bình thường', 'Crop growing well'),
      desc: t(
        'Lá xanh tốt, rễ bén đều, không có dấu hiệu bất thường',
        'Healthy foliage and uniform stand with no stress signs'
      ),
    },
    {
      type: 'crop_abnormal',
      label: t('Cây có dấu hiệu lạ / vàng lá', 'Crop stress / yellowing'),
      desc: t(
        'Chóp lá thâm tái, xoăn đọt hoặc có vết chấm nấm',
        'Leaf yellowing, curling tips, or fungal spots noticed'
      ),
    },
    {
      type: 'helpful',
      label: t('Khuyến nghị AI rất hữu ích', 'Recommendation was helpful'),
      desc: t('Đã áp dụng và thấy phù hợp với ruộng', 'Applied on farm and matched field reality'),
    },
    {
      type: 'not_suitable',
      label: t('Khuyến nghị chưa sát thực tế', 'Not accurate for field'),
      desc: t('Lời khuyên chưa đúng với điều kiện ruộng hôm nay', 'Did not match today’s field conditions'),
    },
    {
      type: 'followed',
      label: t('Tôi đã làm theo hướng dẫn', 'Followed the plan'),
      desc: t('Đã hoàn thành các việc được đề xuất', 'Completed suggested actions'),
    },
    {
      type: 'not_followed',
      label: t('Tôi không thực hiện theo', 'Could not follow'),
      desc: t('Do bận việc hoặc thời tiết thực tế thay đổi', 'Weather changed or schedule constraint'),
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let systemAction = t(
      'Đã lưu phản hồi vào nhật ký huấn luyện thửa ruộng.',
      'Saved feedback to field adaptation log.'
    );
    if (selectedType === 'soil_still_dry') {
      systemAction = t(
        'AI đã ghi nhận đất thoát nước nhanh: Tăng độ nhạy tưới cho các ngày tiếp theo.',
        'Recorded fast-draining soil: Increased irrigation alert sensitivity.'
      );
    } else if (selectedType === 'soil_too_wet') {
      systemAction = t(
        'AI đã ghi nhận đất thoát chậm: Ưu tiên cảnh báo ngập úng và hoãn tưới nước.',
        'Recorded slow drainage: Prioritized drainage warnings and postponed irrigation.'
      );
    }

    onAddFeedback({
      fieldId: activeField.id,
      feedbackType: selectedType,
      userComment: customComment.trim() || undefined,
      systemActionTaken: systemAction,
      appliedToProfile: true,
    });

    setCustomComment('');
    setSuccessNotice(
      t(
        'Đã gửi phản hồi thành công! Trí tuệ AI của thửa ruộng đã tự động cập nhật giả định.',
        'Feedback saved! Field diagnostics have adapted automatically.'
      )
    );
    setTimeout(() => setSuccessNotice(null), 5000);
  };

  const fieldFeedbacks = feedbackHistory.filter((f) => f.fieldId === activeField.id);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-emerald-600" />
            {t('Vòng lặp tự động thích ứng từ nông dân', 'Farmer-in-the-Loop Field Adaptation')}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 mt-1">
            {t('Lịch sử Phản hồi & Trí nhớ Của Ruộng', 'Field Feedback & Adaptive Memory')}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            {t(
              'AI lắng nghe quan sát thực địa của bạn để tinh chỉnh độ ẩm, khả năng thoát nước và ngưỡng khuyến nghị riêng cho thửa ruộng này.',
              'Your ground observations calibrate soil moisture sensitivity, drainage assumptions, and advisory thresholds for this field.'
            )}
          </p>
        </div>

        {/* Current Field Learned State */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5 text-xs text-purple-900 max-w-sm space-y-1">
          <div className="font-bold flex items-center gap-1 text-purple-800">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />{' '}
            {t('Hồ sơ học tập của ruộng:', 'Learned Field Profile:')}
          </div>
          <p className="text-[11px] leading-snug">
            {activeField.adaptiveMemory?.soilAdjustment ||
              t(
                'Chất đất đang tuân theo mô hình mặc định. Hãy gửi phản hồi bên dưới khi đi thăm ruộng!',
                'Soil currently follows baseline parameters. Submit observations below after inspecting your field.'
              )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Send New Observation */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-700" />
              {t('Gửi Quan sát Thực tế Hôm Nay', 'Submit Today’s Field Observation')}
            </h2>
            <p className="text-xs text-stone-500">
              {t(
                `Bạn quan sát thấy điều gì tại ruộng "${activeField.name}"?`,
                `What did you observe at "${activeField.name}"?`
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-2">
              <label className="font-bold text-stone-800 block">
                {t('Chọn tình trạng quan sát:', 'Select observation:')}
              </label>
              <div className="space-y-1.5">
                {feedbackOptions.map((opt) => (
                  <label
                    key={opt.type}
                    className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                      selectedType === opt.type
                        ? 'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-600/30'
                        : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="fbType"
                      checked={selectedType === opt.type}
                      onChange={() => setSelectedType(opt.type)}
                      className="mt-0.5 text-emerald-600 accent-emerald-600"
                    />
                    <div>
                      <div className="font-bold text-stone-900">{opt.label}</div>
                      <div className="text-[11px] text-stone-500">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold text-stone-800 block mb-1">
                {t('Ghi chú thêm (tùy chọn):', 'Additional note (optional):')}
              </label>
              <textarea
                rows={3}
                placeholder={t(
                  'VD: Góc ruộng phía Đông còn đọng nước, đất pha cát nhiều hơn dự kiến...',
                  'E.g., East corner holds standing water, sandier soil than expected...'
                )}
                value={customComment}
                onChange={(e) => setCustomComment(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
            >
              <Send className="w-4 h-4" />{' '}
              {t('Gửi phản hồi để AI học ngay', 'Save Feedback')}
            </button>

            {successNotice && (
              <div className="p-3 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}
          </form>
        </div>

        {/* Right: History Log */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
          <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-700" />
                {t(
                  `Nhật ký Phản hồi & Tinh chỉnh (${fieldFeedbacks.length})`,
                  `Feedback & Adaptation Log (${fieldFeedbacks.length})`
                )}
              </h2>
              <p className="text-xs text-stone-500">
                {t(
                  'Lịch sử lưu giữ minh bạch mọi lần nông dân phản hồi và phản ứng của hệ thống',
                  'Transparent audit log of field feedback and system adjustments'
                )}
              </p>
            </div>
          </div>

          {fieldFeedbacks.length === 0 ? (
            <div className="p-10 text-center text-stone-400 space-y-2">
              <History className="w-8 h-8 mx-auto opacity-50" />
              <div className="text-xs font-semibold text-stone-700">
                {t('Chưa có phản hồi nào cho thửa ruộng này', 'No feedback logged for this field yet')}
              </div>
              <p className="text-[11px] text-stone-400">
                {t(
                  'Khi bạn gửi phản hồi ở cột bên trái hoặc trên bảng Tổng quan, các điều chỉnh sẽ xuất hiện tại đây.',
                  'Submit observations on the left or from the Dashboard to see adaptations here.'
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {fieldFeedbacks.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-stone-50/80 rounded-xl border border-stone-200 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {feedbackOptions.find((o) => o.type === item.feedbackType)?.label ||
                        item.feedbackType}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {new Date(item.timestamp).toLocaleDateString(
                        lang === 'en' ? 'en-US' : 'vi-VN'
                      )}{' '}
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {item.userComment && (
                    <p className="text-stone-700 italic bg-white p-2 rounded-lg border border-stone-100 text-[11px]">
                      "{item.userComment}"
                    </p>
                  )}

                  {item.systemActionTaken && (
                    <div className="p-2 bg-purple-50/80 rounded-lg border border-purple-200 text-purple-900 text-[11px] flex items-start gap-1.5 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                      <span>{item.systemActionTaken}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
