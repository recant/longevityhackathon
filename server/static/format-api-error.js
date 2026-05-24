/**
 * Turn FastAPI / JSON error bodies into plain English for UI display.
 */
function formatApiError(raw) {
  if (raw == null) return "Something went wrong. Please try again.";
  const s = String(raw).trim();
  if (!s) return "Something went wrong. Please try again.";

  try {
    const j = JSON.parse(s);
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

function formatDetail(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        if (item.msg) return String(item.msg);
        if (item.message) return String(item.message);
      }
      return String(item);
    });
    return parts.filter(Boolean).join(". ");
  }
  if (detail && typeof detail === "object" && detail.msg) return String(detail.msg);
  return String(detail);
}

if (typeof window !== "undefined") {
  window.formatApiError = formatApiError;
}
