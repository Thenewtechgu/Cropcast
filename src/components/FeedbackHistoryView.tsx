import React, { useState } from 'react';
import {
  History,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Droplets,
  MessageSquare,
  Send,
  ThumbsUp,
  Brain,
} from 'lucide-react';
import { FeedbackRecord, FeedbackType, FieldProfile } from '../types';

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
  const [selectedType, setSelectedType] = useState<FeedbackType>('soil_still_dry');
  const [customComment, setCustomComment] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const feedbackOptions: Array<{ type: FeedbackType; label: string; desc: string }> = [
    { type: 'soil_still_dry', label: 'Đất thực tế vẫn khô', desc: 'Đất khô nhanh hơn mô hình tính toán, rễ cần nước sớm' },
    { type: 'soil_too_wet', label: 'Đất đang quá ẩm / ứ đọng', desc: 'Sau mưa/tưới nước thoát chậm, có dấu hiệu úng cục bộ' },
    { type: 'crop_healthy', label: 'Cây phát triển bình thường', desc: 'Lá xanh tốt, mạ bén rễ đều, không có dấu hiệu bất thường' },
    { type: 'crop_abnormal', label: 'Cây có dấu hiệu lạ / vàng lá', desc: 'Chóp lá thâm tái, xoăn đọt hoặc có vết chấm nấm' },
    { type: 'helpful', label: 'Khuyến nghị AI rất hữu ích', desc: 'Đã áp dụng và thấy phù hợp với ruộng' },
    { type: 'not_suitable', label: 'Khuyến nghị chưa sát thực tế', desc: 'Lời khuyên chưa đúng với điều kiện ruộng hôm nay' },
    { type: 'followed', label: 'Tôi đã làm theo hướng dẫn', desc: 'Đã hoàn thành các việc được AI đề xuất' },
    { type: 'not_followed', label: 'Tôi không thực hiện theo', desc: 'Do bận việc hoặc thời tiết thực tế thay đổi' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let systemAction = 'Đã lưu phản hồi vào nhật ký huấn luyện thửa ruộng.';
    if (selectedType === 'soil_still_dry') {
      systemAction = 'AI đã ghi nhận đất thoát nước nhanh: Tăng độ nhạy tưới cho các ngày tiếp theo.';
    } else if (selectedType === 'soil_too_wet') {
      systemAction = 'AI đã ghi nhận đất thoát chậm: Ưu tiên cảnh báo ngập úng và hoãn tưới nước.';
    }

    onAddFeedback({
      fieldId: activeField.id,
      feedbackType: selectedType,
      userComment: customComment.trim() || undefined,
      systemActionTaken: systemAction,
      appliedToProfile: true,
    });

    setCustomComment('');
    setSuccessNotice('Đã gửi phản hồi thành công! Trí tuệ AI của thửa ruộng đã tự động cập nhật giả định.');
    setTimeout(() => setSuccessNotice(null), 5000);
  };

  const fieldFeedbacks = feedbackHistory.filter(f => f.fieldId === activeField.id);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-emerald-600" />
            Vòng lặp học máy & Tự động thích ứng từ người nông dân
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 mt-1">
            Lịch sử Phản hồi & Trí nhớ AI Của Ruộng
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Khác biệt lớn nhất với app dự báo thời tiết thông thường: AI lắng nghe cảm nhận thực địa của bạn để điều chỉnh độ ẩm, khả năng thoát nước và ngưỡng khuyến nghị.
          </p>
        </div>

        {/* Current Field Learned State */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5 text-xs text-purple-900 max-w-sm space-y-1">
          <div className="font-bold flex items-center gap-1 text-purple-800">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Hồ sơ học tập của ruộng:
          </div>
          <p className="text-[11px] leading-snug">
            {activeField.adaptiveMemory?.soilAdjustment || 'Chất đất đang tuân theo mô hình mặc định. Hãy gửi phản hồi bên dưới khi đi thăm ruộng!'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Send New Observation / Feedback Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-700" />
              Gửi Quan sát Thực tế Hôm Nay
            </h2>
            <p className="text-xs text-stone-500">
              Bạn quan sát thấy điều gì tại ruộng "{activeField.name}"?
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-2">
              <label className="font-bold text-stone-800 block">Chọn tình trạng quan sát:</label>
              <div className="space-y-1.5">
                {feedbackOptions.map(opt => (
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
              <label className="font-bold text-stone-800 block mb-1">Ghi chú thêm (tùy chọn):</label>
              <textarea
                rows={3}
                placeholder="VD: Góc ruộng phía Đông còn đọng nước, đất pha cát nhiều hơn dự kiến..."
                value={customComment}
                onChange={e => setCustomComment(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-stone-900 focus:outline-emerald-600 text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
            >
              <Send className="w-4 h-4" /> Gửi phản hồi để AI học ngay
            </button>

            {successNotice && (
              <div className="p-3 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}
          </form>
        </div>

        {/* Right: History Log & AI Adaptation Audit Trail */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs space-y-4">
          <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-700" />
                Nhật ký Phản hồi & Tinh chỉnh của AI ({fieldFeedbacks.length})
              </h2>
              <p className="text-xs text-stone-500">
                Lịch sử lưu giữ minh bạch mọi lần nông dân phản hồi và phản ứng của hệ thống
              </p>
            </div>
          </div>

          {fieldFeedbacks.length === 0 ? (
            <div className="p-10 text-center text-stone-400 space-y-2">
              <History className="w-8 h-8 mx-auto opacity-50" />
              <div className="text-xs font-semibold text-stone-700">Chưa có phản hồi nào cho thửa ruộng này</div>
              <p className="text-[11px] text-stone-400">
                Khi bạn gửi phản hồi ở cột bên trái hoặc trên bảng Tổng quan, các điều chỉnh sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {fieldFeedbacks.map(item => (
                <div
                  key={item.id}
                  className="p-3.5 bg-stone-50/80 rounded-xl border border-stone-200 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {feedbackOptions.find(o => o.type === item.feedbackType)?.label || item.feedbackType}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {new Date(item.timestamp).toLocaleDateString('vi-VN')} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
