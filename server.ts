import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      geminiConfigured: Boolean((process.env.GEMINI_API_KEY || '').trim()),
    });
  });

  /**
   * POST /api/translate
   * Batch translates agronomy texts, community posts, field names, and crop inputs between Vietnamese and English.
   */
  app.post('/api/translate', async (req: Request, res: Response) => {
    const body = req.body || {};
    const texts: string[] = Array.isArray(body.texts)
      ? body.texts.map((t: unknown) => String(t ?? '').trim())
      : [];
    const targetLang: 'vi' | 'en' = body.targetLang === 'en' ? 'en' : 'vi';
    const contextHint = typeof body.context === 'string' ? body.context.slice(0, 300) : 'agriculture and farming in Vietnam';

    if (texts.length === 0) {
      res.json({ translations: [], provider: 'empty' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY_NOT_CONFIGURED',
        translations: [],
      });
      return;
    }

    try {
      const targetName = targetLang === 'en' ? 'English' : 'Vietnamese';
      const prompt = [
        `Translate the following array of ${texts.length} short agricultural / community texts into natural, accurate ${targetName}.`,
        `Context: ${contextHint}.`,
        `Rules:`,
        `- Keep proper nouns, crop variety codes (e.g., ST25, OM5451, L14, NK7328, Ri6), numbers, and units intact.`,
        `- Return ONLY a JSON array of exact length ${texts.length} matching the input order.`,
        `- If an item is empty, return "". If already in ${targetName}, polish gently or return unchanged.`,
        `Input array:`,
        JSON.stringify(texts),
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a precision bilingual agricultural translator specializing in Vietnamese and English agronomy, soil science, crop varieties, and farmer forum posts.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '[]').trim());
      if (Array.isArray(parsed) && parsed.length === texts.length) {
        res.json({
          translations: parsed.map((item) => String(item ?? '')),
          provider: 'gemini',
        });
        return;
      }

      res.status(502).json({
        error: 'TRANSLATION_SHAPE_MISMATCH',
        translations: [],
      });
    } catch (error) {
      console.error('Server /api/translate error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'TRANSLATION_FAILED',
        translations: [],
      });
    }
  });

  /**
   * POST /api/gemini/chat
   * Grounded agronomy assistant powered by Gemini on the server.
   */
  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    const body = req.body || {};
    const message = String(body.message || '').trim();
    const language: 'vi' | 'en' = body.language === 'en' ? 'en' : 'vi';
    const field = body.field || {};
    const weather = body.weather || {};
    const earth = field?.adaptiveMemory?.earthMetrics || {};
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

    if (!message) {
      res.status(400).json({ error: 'EMPTY_MESSAGE' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({ error: 'GEMINI_API_KEY_NOT_CONFIGURED' });
      return;
    }

    try {
      const langLabel = language === 'en' ? 'English' : 'Vietnamese';
      const contextSummary = [
        `Field: ${field.name || 'Field'} (${field.district || ''}, ${field.province || ''})`,
        `Area: ${field.areaHa || 0} ha | Coordinates: ${field.lat}, ${field.lon}`,
        `Soil: ${field.soilType || 'loam'} | Drainage: ${field.soilCharacteristics?.drainage || 'moderate'} | pH: ${field.soilCharacteristics?.ph ?? 'untested'}`,
        `Water source: ${field.waterSource?.type || 'river'} | Salinity risk: ${Boolean(field.waterSource?.salinityRisk)}`,
        `Crop: ${field.crop?.name || 'Rice'} (${field.crop?.variety || 'Standard'}) | Stage: ${field.crop?.currentStage || 'Vegetative'}`,
        `Live Weather: Temp ${weather.temp ?? 'N/A'}°C (Min ${weather.minTemp ?? 'N/A'} / Max ${weather.maxTemp ?? 'N/A'}), Rain ${weather.rain ?? 0} mm, Humidity ${weather.humidity ?? 'N/A'}%, Root moisture ${Math.round((weather.gwetroot ?? 0.6) * 100)}%, Topsoil ${Math.round((weather.gwettop ?? 0.55) * 100)}%, VPD ${weather.vpdHpa ?? 'N/A'} hPa`,
        `Historical 25-year baseline (NASA POWER): Avg Temp ${weather.historicalBaseline?.avgTemp ?? 'N/A'}°C, Avg Rain ${weather.historicalBaseline?.avgRain ?? 'N/A'} mm/mo`,
        earth?.groundwaterAnomalyGrace
          ? `GRACE-FO Groundwater: ${earth.groundwaterAnomalyGrace.lweThicknessCm} cm (${earth.groundwaterAnomalyGrace.groundwaterStatus})`
          : '',
        earth?.carbonFluxOco2
          ? `OCO-2 Photosynthesis SIF: ${earth.carbonFluxOco2.sifWm2SrUm}, Uptake: ${earth.carbonFluxOco2.carbonUptakeTonHaYr} t CO2/ha/yr`
          : '',
        earth?.greenhouseGasEdgar
          ? `GHGx/EDGAR Emissions: ${earth.greenhouseGasEdgar.co2eqTonHa} t CO2e/ha`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const historyText = history
        .map((h: { role?: string; parts?: string }) => `${h.role === 'model' ? 'Assistant' : 'Farmer'}: ${String(h.parts || '')}`)
        .join('\n');

      const prompt = [
        `### Grounded Field & NASA/Weather Context`,
        contextSummary,
        historyText ? `\n### Recent Conversation\n${historyText}` : '',
        `\n### Farmer Question (${langLabel} ONLY)\n${message}`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: [
            `You are CropCast's agricultural field advisor.`,
            `Respond STRICTLY in ${langLabel}. Never mix Vietnamese into English responses or vice versa (except standard botanical Latin names when helpful).`,
            `Ground every answer in the field profile, soil drainage, live weather, and NASA Earth metrics provided. Do not invent sensor values.`,
            `Use clean, concise Markdown headings and bullet points with concrete timings, dosages/safety cautions, and actionable next steps.`,
            `If the question is completely unrelated to agriculture, weather, soil, water, crops, or farm sustainability, politely decline and guide back to farming topics.`,
            `End concisely or keep advice practical; remember advisory notices are for reference only.`,
          ].join(' '),
        },
      });

      const reply = (response.text || '').trim();
      if (!reply) {
        res.status(502).json({ error: 'EMPTY_GEMINI_REPLY' });
        return;
      }

      res.json({ reply, provider: 'gemini' });
    } catch (error) {
      console.error('Server /api/gemini/chat error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'GEMINI_CHAT_FAILED',
      });
    }
  });

  /**
   * POST /api/gemini/rethink-rotation
   * Polishes rotation strategy explanation using Gemini while preserving structured RotationStrategy safety.
   */
  app.post('/api/gemini/rethink-rotation', async (req: Request, res: Response) => {
    const body = req.body || {};
    const language: 'vi' | 'en' = body.language === 'en' ? 'en' : 'vi';
    const baseStrategy = body.baseStrategy;
    const rejectionReason = String(body.rejectionReason || '').trim();
    const field = body.field || {};

    if (!baseStrategy) {
      res.status(400).json({ error: 'MISSING_BASE_STRATEGY' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({ error: 'GEMINI_API_KEY_NOT_CONFIGURED' });
      return;
    }

    try {
      const langLabel = language === 'en' ? 'English' : 'Vietnamese';
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          `Field: ${field.name || ''} (${field.province || ''}), soil: ${field.soilType || ''}, current crop: ${field.crop?.name || ''}.`,
          `Farmer rejected previous plan because: "${rejectionReason}".`,
          `Candidate next rotation strategy selected by agronomy rules: ${baseStrategy.title} (${baseStrategy.nextCropName}).`,
          `Original rationale: ${baseStrategy.whySuggested}`,
          `Write an improved, empathetic, 2-3 sentence "whySuggested" explanation in ${langLabel} explaining why "${baseStrategy.nextCropName}" addresses the farmer's concern ("${rejectionReason}") while staying faithful to soil & climate constraints.`,
        ].join('\n'),
        config: {
          systemInstruction: `Return ONLY valid JSON: { "whySuggested": string }. Write purely in ${langLabel}.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              whySuggested: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      if (parsed && typeof parsed.whySuggested === 'string' && parsed.whySuggested.trim()) {
        res.json({ whySuggested: parsed.whySuggested.trim(), provider: 'gemini' });
        return;
      }

      res.status(502).json({ error: 'INVALID_RETHINK_OUTPUT' });
    } catch (error) {
      console.error('Server /api/gemini/rethink-rotation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'GEMINI_RETHINK_FAILED',
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CropCast server running at http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start CropCast server:', err);
  process.exit(1);
});
