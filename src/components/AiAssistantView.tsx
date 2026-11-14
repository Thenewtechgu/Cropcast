import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Loader2, RefreshCw } from 'lucide-react';
import { FieldProfile, WeatherObservation } from '../types';
import { GeminiService } from '../services/geminiService';
import { getSoilLabel } from '../services/agronomyEngine';
import {
  getPlantDisplayName,
  getCommonStageLabel,
  getCommonVarietyLabel,
} from '../data/cropTaxonomy';
import { getLocalizedRegionName } from '../data/nasaVietnamGrid';
import { useLanguage } from '../contexts/LanguageContext';

interface AiAssistantViewProps {
  activeField: FieldProfile;
  weather: WeatherObservation;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  fromFallback?: boolean;
}

function renderInlineMarkdown(text: string, isAi: boolean): React.ReactNode[] {
  // Parse **bold**, __bold__, `code`, and *italic* without raw syntax leakage
  const tokens: React.ReactNode[] = [];
  const pattern = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|`[^`\n]+?`|\*[^*\n]+?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong
          key={`b-${keyIdx++}`}
          className={isAi ? 'font-bold text-stone-950' : 'font-bold text-white'}
        >
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('__') && token.endsWith('__')) {
      tokens.push(
        <strong
          key={`u-${keyIdx++}`}
          className={isAi ? 'font-bold text-stone-950' : 'font-bold text-white'}
        >
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={`c-${keyIdx++}`}
          className={`px-1 py-0.5 rounded font-mono text-[0.9em] ${
            isAi ? 'bg-stone-200/80 text-emerald-900' : 'bg-emerald-700 text-emerald-50'
          }`}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={`i-${keyIdx++}`} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

const FormattedChatContent: React.FC<{ text: string; isAi: boolean }> = ({ text, isAi }) => {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let listItems: Array<{ ordered: boolean; num?: string; content: string }> = [];
  let keyCounter = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const isOrdered = listItems[0].ordered;
    if (isOrdered) {
      blocks.push(
        <ol key={`list-${keyCounter++}`} className="space-y-1.5 pl-4 list-decimal">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineMarkdown(item.content, isAi)}
            </li>
          ))}
        </ol>
      );
    } else {
      blocks.push(
        <ul key={`list-${keyCounter++}`} className="space-y-1.5 pl-4 list-disc">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineMarkdown(item.content, isAi)}
            </li>
          ))}
        </ul>
      );
    }
    listItems = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      blocks.push(
        <div
          key={`h-${keyCounter++}`}
          className={`font-bold ${
            isAi ? 'text-emerald-950' : 'text-white'
          } ${level <= 2 ? 'text-sm sm:text-base pt-1' : 'text-xs sm:text-sm pt-1'} ${
            blocks.length > 0 ? 'mt-1.5 border-t border-stone-200/70 pt-2' : ''
          }`}
        >
          {renderInlineMarkdown(headingText, isAi)}
        </div>
      );
      continue;
    }

    const bulletMatch = trimmed.match(/^(?:•|-|\*)\s+(.+)$/);
    if (bulletMatch) {
      if (listItems.length > 0 && listItems[0].ordered) flushList();
      listItems.push({ ordered: false, content: bulletMatch[1] });
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (orderedMatch) {
      if (listItems.length > 0 && !listItems[0].ordered) flushList();
      listItems.push({ ordered: true, num: orderedMatch[1], content: orderedMatch[2] });
      continue;
    }

    flushList();
    blocks.push(
      <p key={`p-${keyCounter++}`} className="leading-relaxed">
        {renderInlineMarkdown(trimmed, isAi)}
      </p>
    );
  }

  flushList();

  return <div className="space-y-1.5">{blocks}</div>;
};

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({ activeField, weather }) => {
  const { lang, t } = useLanguage();

  const buildGreeting = (field: FieldProfile): ChatMessage => ({
    id: `msg-0-${field.id}-${lang}`,
    sender: 'ai',
    text: t(
      `Xin chào bác nông dân! Tôi là Trợ lý AI Canh tác CropCast. Tôi đang theo dõi thửa ruộng "${field.name}" (${field.crop.name}, ${field.crop.variety}) tại ${field.province} với dữ liệu thời tiết thực tế và chuỗi khí hậu (2001–2026). Hôm nay nhiệt độ ${weather.temp}°C, ẩm độ rễ ${(weather.gwetroot * 100).toFixed(0)}%. Bác cần tư vấn gì cho ruộng hôm nay?`,
      `Hello! I am CropCast Agronomy AI. I am tracking "${field.name}" (${getPlantDisplayName(field.crop.name, 'en')}, ${getCommonVarietyLabel(field.crop.variety, 'en')}) in ${getLocalizedRegionName(field.province, 'en')} using live weather and 2001–2026 climate records. Today is ${weather.temp}°C with ${(weather.gwetroot * 100).toFixed(0)}% root-zone moisture. How can I help with your field today?`
    ),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  const [messages, setMessages] = useState<ChatMessage[]>([buildGreeting(activeField)]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([buildGreeting(activeField)]);
    setLastFailedPrompt(null);
  }, [activeField.id, lang]);

  const quickPrompts =
    lang === 'en'
      ? [
          `My soil is ${getSoilLabel(activeField.soilType, 'en')}; should I irrigate today?`,
          `Why are some leaves turning yellow or red, and how do I treat it?`,
          `Does NASA soil & rain data show fast or slow drainage on this field?`,
          `What crop should I rotate next season after ${getPlantDisplayName(activeField.crop.name, 'en')}?`,
        ]
      : [
          `Đất ruộng là ${getSoilLabel(activeField.soilType, 'vi')}, hôm nay có nên tưới thêm không?`,
          `Tại sao lá cây bị vàng/đỏ và cách xử lý dứt điểm như thế nào?`,
          `Dữ liệu đất & mưa NASA đánh giá ruộng tôi thoát nước nhanh hay chậm?`,
          `Sau vụ ${activeField.crop.name} nên luân canh cây gì để giảm sâu bệnh?`,
        ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputText).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentHistory = messages.map((m) => ({
      role: m.sender === 'user' ? ('user' as const) : ('model' as const),
      parts: m.text,
    }));

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputText('');
    setLastFailedPrompt(null);
    setIsLoading(true);

    try {
      const { reply, isError, fromFallback } = await GeminiService.sendChatMessage(
        textToSend,
        activeField,
        currentHistory,
        weather,
        lang
      );

      if (isError) {
        setLastFailedPrompt(textToSend);
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fromFallback,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      setLastFailedPrompt(textToSend);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-emerald-600" />
            {t(
              'Hội thoại Trực tiếp với Gemini AI Chuyên gia Nông học',
              'Direct Chat with CropCast Agronomy AI'
            )}
          </div>
          <h1 className="text-xl font-bold text-stone-900 mt-1">
            {t(
              `Trợ lý Canh tác Riêng cho Thửa ruộng: ${activeField.name}`,
              `Field Assistant: ${activeField.name}`
            )}
          </h1>
          <p className="text-xs text-stone-500">
            {t(
              'AI kết hợp hồ sơ đất, giống cây với thời tiết thực tế, chuỗi khí hậu 25 năm và chỉ số môi trường ruộng.',
              'Combines your soil & crop profile with live weather, 25-year climate baseline, and field sustainability metrics.'
            )}
          </p>
        </div>

        <div className="text-xs bg-emerald-50 text-emerald-900 font-semibold px-3 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-auto">
          {t('Cây:', 'Crop:')} {getPlantDisplayName(activeField.crop.name, lang)} • {getCommonStageLabel(activeField.crop.currentStage, lang)}
        </div>
      </div>

      {/* Chat Window */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col h-[65dvh] min-h-[380px] max-h-[560px] overflow-hidden">
        {/* Messages Scroll Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {messages.map((msg) => {
            const isAi = msg.sender === 'ai';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}
              >
                {isAi && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`p-3.5 sm:p-4 rounded-2xl max-w-[88%] sm:max-w-[75%] break-words space-y-1.5 leading-relaxed ${
                    isAi
                      ? 'bg-stone-100/90 text-stone-800 rounded-tl-xs border border-stone-200/80'
                      : 'bg-emerald-800 text-white rounded-tr-xs shadow-xs'
                  }`}
                >
                  <FormattedChatContent text={msg.text} isAi={isAi} />
                  <div
                    className={`text-[10px] text-right font-mono ${
                      isAi ? 'text-stone-400' : 'text-emerald-200'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {!isAi && (
                  <div className="w-8 h-8 rounded-xl bg-stone-800 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-stone-500 text-xs italic pl-11">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>
                {t(
                  'AI đang phân tích dữ liệu đất & thời tiết ruộng...',
                  'Analyzing soil & field weather metrics...'
                )}
              </span>
            </div>
          )}

          {!isLoading && lastFailedPrompt && (
            <div className="pl-11">
              <button
                type="button"
                onClick={() => handleSendMessage(lastFailedPrompt)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold cursor-pointer transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />{' '}
                {t('Thử gửi lại câu hỏi vừa rồi', 'Retry last question')}
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-100 space-y-1.5 text-[11px]">
          <div className="text-stone-500 font-semibold">
            {t('Câu hỏi gợi ý nhanh (nhấn để hỏi ngay):', 'Quick prompts (tap to ask):')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isLoading}
                onClick={() => handleSendMessage(p)}
                className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 disabled:opacity-50 border border-stone-200 hover:border-emerald-400 rounded-lg text-stone-700 hover:text-emerald-900 text-left transition cursor-pointer shadow-2xs"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Message Input Box */}
        <div className="p-3 bg-white border-t border-stone-200 flex items-center gap-2">
          <input
            type="text"
            placeholder={t(
              'Hỏi trợ lý AI về đất, nước, chỉ số môi trường, bón phân hay thời tiết...',
              'Ask AI about soil, irrigation, field metrics, fertilizer, or weather...'
            )}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 min-w-0 px-3.5 sm:px-4 py-2.5 border border-stone-300 rounded-xl text-stone-900 text-base sm:text-sm focus:outline-emerald-600"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
          >
            <Send className="w-4 h-4" /> {t('Gửi', 'Send')}
          </button>
        </div>
      </div>
    </div>
  );
};
