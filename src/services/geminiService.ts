import {
  FieldProfile,
  WeatherObservation,
  FeedbackRecord,
  RotationStrategy,
  FarmerPriorityId,
  FarmerConstraints,
} from '../types';
import { pickBestRotationStrategy } from './rotationEngine';

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
    feedbackHistory: FeedbackRecord[]
  ): Promise<AdvisorApiResponse> {
    try {
      const response = await fetch('/api/gemini/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field,
          weather,
          ruleAnalysis,
          feedbackHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      console.warn('Backend Gemini API not reachable or errored, using rule engine synthesis:', err.message);
      return {
        success: false,
        fallback: true,
        message: 'Đang dùng bộ phân tích nông học tiêu chuẩn (Quy tắc chuyên gia).',
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
  }): Promise<{ strategy: RotationStrategy; source: 'gemini' | 'rule_engine' }> {
    try {
      const response = await fetch('/api/gemini/rotation-rethink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field: params.field,
          weather: params.weather,
          rejectedStrategy: params.rejectedStrategy,
          rejectionReason: params.rejectionReason,
          previouslyRejectedTitles: params.previouslyRejectedTitles,
          priorities: params.priorities,
          constraints: params.constraints,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.strategy) {
          return { strategy: data.strategy as RotationStrategy, source: 'gemini' };
        }
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
      params.rejectionReason
    );
    return { strategy: fallbackStrategy, source: 'rule_engine' };
  },

  async sendChatMessage(
    message: string,
    field: FieldProfile,
    conversationHistory: Array<{ role: 'user' | 'model'; parts: string }>,
    weather?: WeatherObservation
  ): Promise<{ reply: string; isError?: boolean; fromFallback?: boolean }> {
    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          field,
          weather,
          conversationHistory,
        }),
      });

      const data = await response.json().catch(() => null);
      if (data?.reply) {
        return {
          reply: data.reply,
          isError: !data.success,
          fromFallback: !!data.fromFallback,
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      return { reply: 'Không nhận được câu trả lời từ AI.', isError: true };
    } catch {
      return {
        isError: true,
        reply: `Không thể kết nối tới máy chủ AI lúc này. Gợi ý tạm thời cho "${field.name}" (${field.crop.name}): hãy kiểm tra độ ẩm vùng rễ thực tế ngoài ruộng và rãnh thoát nước trước khi tưới hoặc bón phân.`,
      };
    }
  },
};
