import {
  FieldProfile,
  WeatherObservation,
  FeedbackRecord,
  RotationStrategy,
  FarmerPriorityId,
  FarmerConstraints,
} from '../types';
import { pickBestRotationStrategy } from './rotationEngine';
import { safeJsonFetch } from './httpClient';
import type { AppLanguage } from '../contexts/LanguageContext';

export interface AdvisorApiResponse {
  success: boolean;
  advice?: {
    headline: string;
    situationSummary: string;
    topActions: Array<{
      title: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      reason: string;
      dataBasis: string;
    }>;
    postponeActions: string[];
    agronomicExplanation: string;
    uncertainties: string;
    nextCheckTime: string;
  };
  fallback?: boolean;
  message?: string;
}

export const GeminiService = {
  async getFieldAdvice(
    field: FieldProfile,
    weather: WeatherObservation,
    ruleAnalysis: any,
    feedbackHistory: FeedbackRecord[],
    language: AppLanguage = 'vi'
  ): Promise<AdvisorApiResponse> {
    try {
      const { res, data } = await safeJsonFetch<AdvisorApiResponse>('/api/gemini/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field,
          weather,
          ruleAnalysis,
          feedbackHistory,
          earthMetrics: field.adaptiveMemory?.earthMetrics,
          language,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      return data;
    } catch (err: any) {
      console.warn('Backend Gemini API not reachable or errored, using rule engine synthesis:', err.message);
      return {
        success: false,
        fallback: true,
        message:
          language === 'en'
            ? 'Using standard agronomic rule engine analysis.'
            : 'Đang dùng bộ phân tích nông học tiêu chuẩn (Quy tắc chuyên gia).',
      };
    }
  },

  async rethinkRotationStrategy(params: {
    field: FieldProfile;
    weather: WeatherObservation;
    rejectedStrategy: RotationStrategy;
    rejectionReason: string;
    excludedIds: string[];
    previouslyRejectedTitles: string[];
    priorities: FarmerPriorityId[];
    constraints: FarmerConstraints;
    language?: AppLanguage;
  }): Promise<{ strategy: RotationStrategy; source: 'gemini' | 'rule_engine' }> {
    const lang = params.language || 'vi';
    try {
      const { res, data } = await safeJsonFetch<any>('/api/gemini/rotation-rethink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field: params.field,
          weather: params.weather,
          earthMetrics: params.field.adaptiveMemory?.earthMetrics,
          rejectedStrategy: params.rejectedStrategy,
          rejectionReason: params.rejectionReason,
          previouslyRejectedTitles: params.previouslyRejectedTitles,
          priorities: params.priorities,
          constraints: params.constraints,
          language: lang,
        }),
      });
      if (res.ok && data?.success && data?.strategy) {
        return { strategy: data.strategy as RotationStrategy, source: 'gemini' };
      }
    } catch {
      // Fall back to deterministic agronomy selector
    }

    const nextIds = [...params.excludedIds, params.rejectedStrategy.id];
    const fallbackStrategy = pickBestRotationStrategy(
      params.field,
      params.weather,
      params.priorities,
      params.constraints,
      nextIds,
      params.rejectionReason,
      lang
    );
    return { strategy: fallbackStrategy, source: 'rule_engine' };
  },

  async sendChatMessage(
    message: string,
    field: FieldProfile,
    conversationHistory: Array<{ role: 'user' | 'model'; parts: string }>,
    weather?: WeatherObservation,
    language: AppLanguage = 'vi'
  ): Promise<{ reply: string; isError?: boolean; fromFallback?: boolean }> {
    try {
      const { res, data } = await safeJsonFetch<any>('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          field,
          weather,
          earthMetrics: field.adaptiveMemory?.earthMetrics,
          conversationHistory,
          language,
        }),
      });

      if (data?.reply) {
        return {
          reply: data.reply,
          isError: !data.success,
          fromFallback: !!data.fromFallback,
        };
      }

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      return {
        reply:
          language === 'en'
            ? 'No response received from AI.'
            : 'Không nhận được câu trả lời từ AI.',
        isError: true,
      };
    } catch {
      return {
        isError: true,
        reply:
          language === 'en'
            ? `Cannot reach AI server right now. Quick note for "${field.name}" (${field.crop.name}): check root moisture and field drainage before irrigating or fertilizing.`
            : `Không thể kết nối tới máy chủ AI lúc này. Gợi ý tạm thời cho "${field.name}" (${field.crop.name}): hãy kiểm tra độ ẩm vùng rễ thực tế ngoài ruộng và rãnh thoát nước trước khi tưới hoặc bón phân.`,
      };
    }
  },
};
