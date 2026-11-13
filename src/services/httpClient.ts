/**
 * Safe JSON fetch parser preventing "JSON.parse: unexpected character at line 2 column 1"
 * when an API endpoint, proxy, or fallback unexpectedly returns HTML or empty text.
 */
export async function parseJsonSafely<T = any>(res: Response): Promise<T> {
  const rawText = await res.text();
  const trimmed = rawText.trim();

  if (!trimmed) {
    return {} as T;
  }

  if (trimmed.startsWith('<')) {
    if (res.status === 413) {
      throw new Error(
        `Gói dữ liệu vượt quá giới hạn dung lượng truyền tải của máy chủ (HTTP 413). Hệ thống đã tự động chia nhỏ dữ liệu — vui lòng thử lại.`
      );
    }
    throw new Error(
      `Máy chủ trả về HTML thay vì JSON (HTTP ${res.status}). Vui lòng kiểm tra kết nối API.`
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    if (res.status === 413) {
      throw new Error(
        `Gói dữ liệu vượt quá giới hạn dung lượng của máy chủ (HTTP 413). Vui lòng thử lại.`
      );
    }
    throw new Error(`Dữ liệu phản hồi không đúng định dạng JSON (HTTP ${res.status}).`);
  }
}

export async function safeJsonFetch<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ res: Response; data: T }> {
  const res = await fetch(input, init);
  const data = await parseJsonSafely<T>(res);
  return { res, data };
}
