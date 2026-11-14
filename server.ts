import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

function getServerAi(): GoogleGenAI | null {
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

function extractGeminiText(response: unknown): string {
  const r = response as {
    text?: string;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (typeof r?.text === 'string' && r.text.trim()) {
    return r.text.trim();
  }
  const parts = r?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .join('')
      .trim();
    if (joined) return joined;
  }
  return '';
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/chat', async (req, res) => {
    try {
      const { promptText, systemPrompt, historyText } = (req.body || {}) as {
        promptText?: string;
        systemPrompt?: string;
        historyText?: string;
      };

      if (!promptText || typeof promptText !== 'string') {
        return res.status(400).json({ ok: false, error: 'Missing promptText' });
      }

      const ai = getServerAi();
      if (!ai) {
        return res.status(200).json({ ok: false, fallback: true });
      }

      const contents = historyText ? `${historyText}\nUser: ${promptText}` : promptText;
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: systemPrompt ? { systemInstruction: systemPrompt } : undefined,
      });

      const text = extractGeminiText(response);
      if (!text) {
        return res.status(200).json({ ok: false, fallback: true });
      }

      return res.json({ ok: true, reply: text });
    } catch (err) {
      console.error('[api/chat] Gemini call failed:', err instanceof Error ? err.message : err);
      return res.status(200).json({ ok: false, fallback: true });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*splat', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CropCast server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CropCast server:', err);
  process.exit(1);
});
