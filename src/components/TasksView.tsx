import React, { useState } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  Filter,
  PauseCircle,
  Circle,
} from 'lucide-react';
import { FarmTask, FieldProfile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface TasksViewProps {
  tasks: FarmTask[];
  fields: FieldProfile[];
  activeField: FieldProfile;
  onUpdateTaskStatus: (taskId: string, status: FarmTask['status'], note?: string) => void;
  onNavigateTab: (tab: string) => void;
  onOpenFeedback: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  fields,
  onUpdateTaskStatus,
  onNavigateTab,
}) => {
  const { lang, t } = useLanguage();
  const [filterFieldId, setFilterFieldId] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [postponeTaskId, setPostponeTaskId] = useState<string | null>(null);
  const [postponeReason, setPostponeReason] = useState<string>('');

  const filteredTasks = tasks.filter((item) => {
    if (filterFieldId !== 'ALL' && item.fieldId !== filterFieldId) return false;
    if (filterStatus === 'PENDING' && item.status !== 'pending' && item.status !== 'skipped')
      return false;
    if (filterStatus === 'COMPLETED' && item.status !== 'completed') return false;
    if (filterStatus === 'POSTPONED' && item.status !== 'postponed') return false;
    return true;
  });

  const getFieldName = (fieldId: string) => {
    return fields.find((f) => f.id === fieldId)?.name || t('Thửa ruộng', 'Field');
  };

  const handlePostponeSubmit = (taskId: string) => {
    onUpdateTaskStatus(
      taskId,
      'postponed',
      postponeReason.trim()
        ? `${t('Tạm hoãn:', 'Postponed:')} ${postponeReason.trim()}`
        : t(
            'Nông dân chọn tạm hoãn để chờ điều kiện phù hợp',
            'Farmer postponed to wait for better field conditions'
          )
    );
    setPostponeTaskId(null);
    setPostponeReason('');
  };

  const quickPostponeReasons =
    lang === 'en'
      ? [
          'Soil is still moist enough',
          'Heavy rain prevents field entry',
          'Waiting for labor or equipment tomorrow',
          'Checking canal water level first',
        ]
      : [
          'Đất thực tế vẫn đủ ẩm',
          'Trời đang mưa to không ra đồng được',
          'Chờ nhân công / máy móc ngày mai',
          'Đợi kiểm tra lại mực nước kênh',
        ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            {t('Lịch công việc tự động thích ứng', 'Adaptive Field Task Planner')}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 mt-1">
            {t('Kế hoạch hành động theo điều kiện thực tế', 'Weather & Soil Action Checklist')}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            {t(
              'Hệ thống tự điều chỉnh công việc khi có mưa lớn, khô hạn hoặc khi bạn cập nhật tình trạng đất.',
              'Tasks adapt automatically when heavy rain, dry spells, or your field feedback arrive.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('feedback')}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            {t('Cập nhật tình trạng ruộng', 'Report Field Status')}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-stone-400 font-semibold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> {t('Lọc theo ruộng:', 'Field:')}
          </span>
          <select
            value={filterFieldId}
            onChange={(e) => setFilterFieldId(e.target.value)}
            className="px-2.5 py-1.5 border border-stone-300 rounded-lg bg-stone-50 text-stone-800 font-medium"
          >
            <option value="ALL">
              {t(`Tất cả thửa ruộng (${fields.length})`, `All fields (${fields.length})`)}
            </option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <span className="text-stone-400 font-semibold ml-2">{t('Trạng thái:', 'Status:')}</span>
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'ALL', label: t('Tất cả', 'All') },
              { id: 'PENDING', label: t('Chưa hoàn thành', 'Pending') },
              { id: 'COMPLETED', label: t('Đã hoàn thành', 'Completed') },
              { id: 'POSTPONED', label: t('Tạm hoãn', 'Postponed') },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setFilterStatus(st.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  filterStatus === st.id
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-stone-500 font-medium text-xs">
          {t('Tổng cộng:', 'Total:')} <strong>{filteredTasks.length}</strong>{' '}
          {t('nhiệm vụ', 'tasks')}
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 space-y-2">
            <CalendarCheck className="w-10 h-10 mx-auto text-emerald-600 opacity-60" />
            <div className="font-bold text-stone-800 text-base">
              {t('Hiện không có công việc nào theo bộ lọc', 'No tasks match your filter')}
            </div>
            <p className="text-xs text-stone-400">
              {t(
                'Các nhiệm vụ sẽ tự động kích hoạt khi có thay đổi về thời tiết hoặc độ ẩm đất vùng rễ.',
                'New tasks trigger automatically as weather or root-zone moisture changes.'
              )}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isPostponed = task.status === 'postponed';
            const isIncomplete = task.status === 'pending' || task.status === 'skipped';

            return (
              <div
                key={task.id}
                className={`p-4 sm:p-5 rounded-2xl border transition shadow-xs flex flex-col gap-3 ${
                  isCompleted
                    ? 'bg-emerald-50/30 border-emerald-200'
                    : isPostponed
                    ? 'bg-amber-50/50 border-amber-200'
                    : 'bg-white border-stone-200/90 hover:border-emerald-300'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Task Details */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                        {getFieldName(task.fieldId)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          task.priority === 'HIGH'
                            ? 'bg-rose-100 text-rose-800'
                            : task.priority === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {t('Ưu tiên:', 'Priority:')}{' '}
                        {task.priority === 'HIGH'
                          ? t('Cao', 'High')
                          : task.priority === 'MEDIUM'
                          ? t('Trung bình', 'Medium')
                          : t('Thường', 'Low')}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPostponed
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {isCompleted
                          ? t('Đã hoàn thành', 'Completed')
                          : isPostponed
                          ? t('Đang tạm hoãn', 'Postponed')
                          : t('Chưa hoàn thành', 'Pending')}
                      </span>
                      <span className="text-xs text-stone-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t('Dự kiến:', 'Schedule:')}{' '}
                        <strong>{task.scheduledTime}</strong>
                      </span>
                    </div>

                    <h3
                      className={`text-base font-bold text-stone-900 ${
                        isCompleted ? 'line-through text-stone-500' : ''
                      }`}
                    >
                      {task.title}
                    </h3>

                    <p className="text-xs text-stone-600 leading-relaxed font-normal">
                      {task.reason}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-400 font-mono pt-1">
                      <span>
                        {t('Dữ liệu kích hoạt:', 'Trigger:')} <strong>{task.triggerData}</strong>
                      </span>
                      {task.farmerNote && (
                        <span className="text-amber-800 font-sans font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {t('Ghi chú:', 'Note:')} {task.farmerNote}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100">
                    <button
                      type="button"
                      onClick={() => onUpdateTaskStatus(task.id, 'completed')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        isCompleted
                          ? 'bg-emerald-800 text-white ring-2 ring-emerald-500/30'
                          : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" /> {t('Đã hoàn thành', 'Done')}
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateTaskStatus(task.id, 'pending')}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                        isIncomplete
                          ? 'bg-stone-800 text-white border-stone-800'
                          : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300'
                      }`}
                    >
                      {isIncomplete ? (
                        <Circle className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      {t('Chưa hoàn thành', 'Pending')}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (isPostponed) {
                          onUpdateTaskStatus(task.id, 'pending');
                        } else {
                          setPostponeTaskId(postponeTaskId === task.id ? null : task.id);
                        }
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                        isPostponed
                          ? 'bg-amber-500 text-stone-950 border-amber-600'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      <PauseCircle className="w-3.5 h-3.5" />
                      {isPostponed ? t('Đang tạm hoãn', 'Postponed') : t('Tạm hoãn', 'Postpone')}
                    </button>
                  </div>
                </div>

                {/* Postpone Reason Dialog */}
                {postponeTaskId === task.id && (
                  <div className="w-full p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-2">
                    <div className="font-bold text-stone-800">
                      {t(
                        'Chọn hoặc nhập lý do tạm hoãn công việc này:',
                        'Select or enter a reason for postponing:'
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {quickPostponeReasons.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setPostponeReason(r)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                            postponeReason === r
                              ? 'bg-amber-600 text-white border-amber-700 font-bold'
                              : 'bg-white text-stone-700 border-stone-300'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder={t('Lý do tạm hoãn khác (tùy chọn)...', 'Other reason (optional)...')}
                        value={postponeReason}
                        onChange={(e) => setPostponeReason(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white text-stone-900"
                      />
                      <button
                        type="button"
                        onClick={() => handlePostponeSubmit(task.id)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold cursor-pointer"
                      >
                        {t('Xác nhận tạm hoãn', 'Confirm')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPostponeTaskId(null);
                          setPostponeReason('');
                        }}
                        className="px-2.5 py-1.5 text-stone-500 hover:underline cursor-pointer"
                      >
                        {t('Hủy', 'Cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
