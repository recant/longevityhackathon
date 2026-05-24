/** Turn FastAPI / JSON error bodies into plain English for UI display. */
export function formatApiError(raw: unknown): string {
  if (raw == null) return "Something went wrong. Please try again.";
  const s = String(raw).trim();
  if (!s) return "Something went wrong. Please try again.";

  try {
    const j = JSON.parse(s) as Record<string, unknown>;
    if (j && typeof j === "object") {
      if (typeof j.detail !== "undefined") return formatDetail(j.detail);
      if (typeof j.message === "string") return j.message;
      if (Array.isArray(j.message)) return j.message.map(String).join(". ");
    }
  } catch {
    /* not JSON */
  }

  return s.replace(/^\{.*\}$/s, "").trim() || s;
}

function formatDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if (o.msg) return String(o.msg);
        if (o.message) return String(o.message);
      }
      return String(item);
    });
    return parts.filter(Boolean).join(". ");
  }
  if (detail && typeof detail === "object") {
    const o = detail as Record<string, unknown>;
    if (o.msg) return String(o.msg);
  }
  return String(detail);
}
