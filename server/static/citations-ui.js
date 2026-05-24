/**
 * Render structured citation objects from the API as inline source links.
 * @param {Array<{short?: string, full?: string, url?: string, doi?: string}>|null|undefined} citations
 * @param {{ className?: string, prefix?: string }} [opts]
 * @returns {string} HTML string (empty if no citations)
 */
function formatCitationsHtml(citations, opts) {
  const options = opts || {};
  const list = Array.isArray(citations) ? citations.filter((c) => c && (c.short || c.full)) : [];
  if (!list.length) return "";

  const cls = options.className || "cite-list";
  const prefix = options.prefix != null ? options.prefix : "Sources: ";
  const items = list
    .map((c) => {
      const label = escapeCitationText(c.short || c.full || "Source");
      const href = c.url || (c.doi ? "https://doi.org/" + c.doi : "");
      const title = escapeCitationText(c.full || c.short || "");
      if (href) {
        return (
          '<a class="cite-link" href="' +
          escapeCitationText(href) +
          '" target="_blank" rel="noopener noreferrer" title="' +
          title +
          '">' +
          label +
          "</a>"
        );
      }
      return '<span class="cite-text" title="' + title + '">' + label + "</span>";
    })
    .join('<span class="cite-sep"> · </span>');

  return '<p class="' + cls + '"><span class="cite-prefix">' + prefix + "</span>" + items + "</p>";
}

function escapeCitationText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

if (typeof window !== "undefined") {
  window.formatCitationsHtml = formatCitationsHtml;
}
