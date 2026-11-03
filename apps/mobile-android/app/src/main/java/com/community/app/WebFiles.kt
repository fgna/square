package com.community.app

import org.json.JSONObject
import java.util.Base64

/**
 * Files the web app hands to the browser, which a bare WebView drops: blob
 * downloads (CSV reports, data export, calendar files) arrive through a
 * page script as a data URL; everything here is free of Android types so the
 * JVM unit tests can cover it.
 */
internal object WebFiles {
    /** Larger blobs are refused; the web app's own exports stay far below. */
    const val MAX_BYTES = 20 * 1024 * 1024

    class Blob(val name: String, val mimeType: String, val bytes: ByteArray)

    /**
     * Runs before the page's own scripts, in trusted frames only. Remembers each
     * Blob given to URL.createObjectURL, so a link clicked right before
     * revokeObjectURL (the usual pattern) can still be read and sent to the app.
     */
    const val PAGE_SCRIPT = """
(() => {
  if (window.__squareFiles || typeof SquareFiles === 'undefined') return;
  window.__squareFiles = true;
  const blobs = new Map();
  const create = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (obj) => { const url = create(obj); if (obj instanceof Blob) blobs.set(url, obj); return url; };
  URL.revokeObjectURL = (url) => { blobs.delete(url); revoke(url); };
  const send = (a) => {
    const blob = blobs.get(a.href);
    if (!blob) return false;
    const reader = new FileReader();
    reader.onload = () => SquareFiles.postMessage(JSON.stringify({
      name: a.download || 'download', type: blob.type || 'application/octet-stream', data: reader.result,
    }));
    reader.readAsDataURL(blob);
    return true;
  };
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.href.startsWith('blob:') && send(this)) return;
    click.call(this);
  };
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element ? e.target.closest('a[href^="blob:"]') : null;
    if (a && send(a)) e.preventDefault();
  }, true);
})();
"""

    /** Parses a message from [PAGE_SCRIPT]; null for anything malformed or too large. */
    fun parse(message: String?): Blob? = try {
        val json = JSONObject(message ?: "")
        val data = json.getString("data")
        val comma = data.indexOf(',')
        if (!data.startsWith("data:") || comma < 0 || !data.substring(0, comma).endsWith(";base64")) null
        else if ((data.length - comma - 1) / 4 * 3 > MAX_BYTES) null
        else {
            val bytes = Base64.getDecoder().decode(data.substring(comma + 1))
            Blob(safeName(json.optString("name")), safeType(json.optString("type")), bytes)
        }
    } catch (_: Exception) { null }

    /** A plain file name: no folders, no control characters, never empty. */
    fun safeName(raw: String?): String {
        val name = (raw ?: "").substringAfterLast('/').substringAfterLast('\\')
            .filter { it >= ' ' && it !in "<>:\"|?*" }.trim().trimStart('.')
        return name.take(120).ifEmpty { "download" }
    }

    /** The bare media type ("text/calendar;charset=utf-8" → "text/calendar"). */
    private fun safeType(raw: String?): String =
        raw?.substringBefore(';')?.trim()?.takeIf { Regex("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+").matches(it) }
            ?: "application/octet-stream"
}
