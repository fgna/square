package com.community.app

import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.SslErrorHandler
import android.net.http.SslError
import android.view.Gravity
import android.view.View
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.FrameLayout
import android.graphics.Color
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.net.URI

/** HTTPS origin matching deliberately excludes username/password and alternative ports. */
internal object TrustedOrigin {
    fun validBase(raw: String?): Boolean = try {
        if (raw.isNullOrBlank()) false else {
            val uri = URI(raw)
            uri.scheme.equals("https", true) && !uri.host.isNullOrBlank() &&
                uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null &&
                (uri.rawPath.isNullOrEmpty() || uri.rawPath == "/") &&
                (uri.port == -1 || uri.port in 1..65535)
        }
    } catch (_: Exception) { false }

    fun matches(base: String?, target: String?): Boolean = try {
        if (!validBase(base) || target.isNullOrBlank()) false else {
            val a = URI(base)
            val b = URI(target)
            b.scheme.equals("https", true) &&
                a.host.equals(b.host, true) && b.rawUserInfo == null &&
                (if (a.port == -1) 443 else a.port) == (if (b.port == -1) 443 else b.port)
        }
    } catch (_: Exception) { false }
}

/**
 * What the app shows instead of a blank WebView when the instance cannot be
 * loaded. Kept free of Android types so the JVM unit tests can cover it.
 */
internal object LoadProblem {
    // android.net.http.SslError primary error codes.
    private const val SSL_NOTYETVALID = 0
    private const val SSL_EXPIRED = 1
    private const val SSL_IDMISMATCH = 2
    private const val SSL_UNTRUSTED = 3
    private const val SSL_DATE_INVALID = 4

    fun certificate(origin: String, primaryError: Int, debugBuild: Boolean): String {
        val reason = when (primaryError) {
            SSL_UNTRUSTED -> "is issued by a certificate authority this device does not trust"
            SSL_IDMISMATCH -> "does not belong to this address"
            SSL_EXPIRED -> "has expired"
            SSL_NOTYETVALID, SSL_DATE_INVALID -> "is not valid at the device's current date and time"
            else -> "was rejected"
        }
        val fix = when {
            primaryError == SSL_NOTYETVALID || primaryError == SSL_DATE_INVALID || primaryError == SSL_EXPIRED ->
                "Check the date and time on this device and on the server."
            primaryError != SSL_UNTRUSTED -> "Ask the operator of the server to fix its certificate."
            debugBuild -> "For a server with its own CA (for example Caddy's \"tls internal\"), install that " +
                "CA's root certificate on this device: Settings → Security → Encryption & credentials → " +
                "Install a certificate → CA certificate. Then tap Try again."
            else -> "This app only trusts publicly trusted certificates. Use a server with such a " +
                "certificate, or a debug build together with an installed CA certificate."
        }
        return "The certificate of $origin $reason. The connection was stopped for your safety.\n\n$fix"
    }

    fun network(origin: String, description: String?): String {
        val detail = description?.takeIf { it.isNotBlank() }?.let { " ($it)" } ?: ""
        return "$origin could not be reached$detail.\n\nCheck that the server is running, that the " +
            "address and port are right, that it speaks HTTPS, and that this device is in the same network."
    }
}

class MainActivity : Activity() {
    private val prefs by lazy { getSharedPreferences("community_prefs", MODE_PRIVATE) }
    private var allowedOrigin: String? = null
    private var browser: WebView? = null
    private var loading: TextView? = null
    private var problem: View? = null
    private var pendingUpload: ValueCallback<Array<Uri>>? = null
    private var pendingSave: WebFiles.Blob? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Old native token storage is no longer compatible with Square's web session.
        prefs.edit().remove("access_token").remove("refresh_token")
            .remove("user_json").remove("user_role").apply()
        val fixedUrl = BuildConfig.COMMUNITY_URL
        if (fixedUrl.isNotEmpty()) {
            // A branded app is pinned to its build-time instance; ignore legacy
            // stored server choices and never expose the generic server picker.
            if (prefs.getString("server_url", null) != fixedUrl) {
                prefs.edit().putString("server_url", fixedUrl).remove("last_url").apply()
            }
            showBrowser(fixedUrl)
        } else {
            val previous = prefs.getString("server_url", null)
            if (TrustedOrigin.validBase(previous)) showBrowser(previous!!)
            else showSetup()
        }
    }

    private fun showSetup() {
        browser?.destroy()
        browser = null
        loading = null
        problem = null
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 64, 32, 32)
        }
        val title = TextView(this).apply { text = "${getString(R.string.app_name)} server (HTTPS)" }
        val input = EditText(this).apply {
            hint = "https://community.example.com"
            setText(prefs.getString("server_url", ""))
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_URI
        }
        val message = TextView(this)
        val connect = Button(this).apply {
            text = "Open ${getString(R.string.app_name)}"
            setOnClickListener {
                val url = input.text.toString().trim().trimEnd('/')
                if (!TrustedOrigin.validBase(url)) {
                    message.text = "Enter a valid HTTPS server URL."
                    return@setOnClickListener
                }
                val old = prefs.getString("server_url", null)
                if (old != url) {
                    CookieManager.getInstance().removeAllCookies {
                        CookieManager.getInstance().flush()
                        WebStorage.getInstance().deleteAllData()
                        runOnUiThread {
                            prefs.edit().putString("server_url", url).remove("last_url").apply()
                            showBrowser(url)
                        }
                    }
                } else showBrowser(url)
            }
        }
        layout.addView(title)
        layout.addView(input)
        layout.addView(connect)
        layout.addView(message)
        setContentView(layout)
    }

    private fun showBrowser(url: String) {
        allowedOrigin = url
        val view = WebView(this)
        browser = view
        problem = null
        // A dark page instead of a white flash while the first page loads.
        view.setBackgroundColor(Color.rgb(9, 13, 22))
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
        }
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (TrustedOrigin.matches(allowedOrigin, request.url.toString())) return false
                if (request.isForMainFrame && request.url.scheme.equals("https", true)) {
                    startActivity(Intent(Intent.ACTION_VIEW, request.url))
                }
                return true
            }
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                handler.cancel()
                showProblem(LoadProblem.certificate(url, error.primaryError, BuildConfig.DEBUG))
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showProblem(LoadProblem.network(url, error.description?.toString()))
            }
            override fun onPageCommitVisible(view: WebView, pageUrl: String) {
                loading?.visibility = View.GONE
            }
            override fun onPageFinished(view: WebView, pageUrl: String) {
                loading?.visibility = View.GONE
                if (TrustedOrigin.matches(allowedOrigin, pageUrl)) {
                    prefs.edit().putString("last_url", pageUrl).apply()
                }
            }
        }
        view.webChromeClient = pageDialogsAndFiles()
        // Files the page links to (course PDFs, audio) open in the browser or a
        // matching app: the links are signed, so no app session is needed.
        view.setDownloadListener { fileUrl, _, _, _, _ ->
            if (fileUrl.startsWith("https:", true)) openExternally(Uri.parse(fileUrl))
        }
        // Blob downloads (CSV reports, data export, calendar files) never reach
        // the download listener; a script in trusted frames hands them over.
        val origins = setOf(url.trimEnd('/'))
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) &&
            WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addWebMessageListener(view, "SquareFiles", origins) { _, message, source, isMainFrame, _ ->
                if (isMainFrame && TrustedOrigin.matches(allowedOrigin, source.toString())) {
                    WebFiles.parse(message.data)?.let { saveAs(it) }
                }
            }
            WebViewCompat.addDocumentStartJavaScript(view, WebFiles.PAGE_SCRIPT, origins)
        }
        // Android 15 enforces edge-to-edge. Reserve the physical system bar areas
        // outside WebView so Square navigation does not overlap status/nav controls.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val container = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(9, 13, 22))
            addView(view, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
            ))
        }
        loading = TextView(this).apply {
            text = "Connecting to $url …"
            setTextColor(Color.rgb(197, 168, 128))
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
        }.also {
            container.addView(it, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
            ))
        }
        ViewCompat.setOnApplyWindowInsetsListener(container) { root, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            root.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        setContentView(container)
        ViewCompat.requestApplyInsets(container)
        val last = prefs.getString("last_url", null)
        view.loadUrl(if (TrustedOrigin.matches(url, last)) last!! else url)
    }

    /** Replaces the blank WebView with the reason and a way out. The first problem of a load wins. */
    private fun showProblem(message: String) {
        val view = browser ?: return
        if (problem != null) return
        val container = view.parent as? FrameLayout ?: return
        loading?.visibility = View.GONE
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(48, 48, 48, 48)
            setBackgroundColor(Color.rgb(9, 13, 22))
            isClickable = true
        }
        panel.addView(TextView(this).apply {
            text = "${getString(R.string.app_name)} could not be opened"
            textSize = 20f
            setTextColor(Color.WHITE)
        })
        panel.addView(TextView(this).apply {
            text = message
            setTextColor(Color.rgb(220, 220, 220))
            setPadding(0, 24, 0, 24)
        })
        panel.addView(Button(this).apply {
            text = "Try again"
            setOnClickListener {
                container.removeView(panel)
                problem = null
                loading?.visibility = View.VISIBLE
                // WebView remembers a cancelled certificate for the session.
                view.clearSslPreferences()
                view.loadUrl(allowedOrigin ?: return@setOnClickListener)
            }
        })
        if (BuildConfig.COMMUNITY_URL.isEmpty()) {
            panel.addView(Button(this).apply {
                text = "Change server"
                setOnClickListener { showSetup() }
            })
        }
        container.addView(panel, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
        ))
        problem = panel
    }

    /**
     * Without a WebChromeClient a WebView shows no alert/confirm/prompt and no
     * file picker: delete confirmations did nothing and image uploads never opened.
     */
    private fun pageDialogsAndFiles() = object : WebChromeClient() {
        override fun onJsAlert(view: WebView, pageUrl: String, message: String, result: JsResult): Boolean {
            AlertDialog.Builder(this@MainActivity).setMessage(message)
                .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                .setOnCancelListener { result.confirm() }.show()
            return true
        }
        override fun onJsConfirm(view: WebView, pageUrl: String, message: String, result: JsResult): Boolean {
            AlertDialog.Builder(this@MainActivity).setMessage(message)
                .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                .setOnCancelListener { result.cancel() }.show()
            return true
        }
        override fun onJsPrompt(view: WebView, pageUrl: String, message: String, defaultValue: String?, result: JsPromptResult): Boolean {
            val input = EditText(this@MainActivity).apply { setText(defaultValue ?: "") }
            AlertDialog.Builder(this@MainActivity).setMessage(message).setView(input)
                .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm(input.text.toString()) }
                .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                .setOnCancelListener { result.cancel() }.show()
            return true
        }
        override fun onJsBeforeUnload(view: WebView, pageUrl: String, message: String?, result: JsResult): Boolean =
            onJsConfirm(view, pageUrl, "Leave this page? Changes you made may not be saved.", result)

        override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
            pendingUpload?.onReceiveValue(null)
            pendingUpload = callback
            return try {
                startActivityForResult(params.createIntent(), REQUEST_UPLOAD)
                true
            } catch (_: ActivityNotFoundException) {
                pendingUpload = null
                false
            }
        }
    }

    /** Lets the member choose where a blob download is stored. */
    private fun saveAs(blob: WebFiles.Blob) = runOnUiThread {
        pendingSave = blob
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType(blob.mimeType).putExtra(Intent.EXTRA_TITLE, blob.name)
        try { startActivityForResult(intent, REQUEST_SAVE) } catch (_: ActivityNotFoundException) { pendingSave = null }
    }

    private fun openExternally(uri: Uri) {
        try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: ActivityNotFoundException) { }
    }

    @Deprecated("Deprecated in Android")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        when (requestCode) {
            REQUEST_UPLOAD -> {
                pendingUpload?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
                pendingUpload = null
            }
            REQUEST_SAVE -> {
                val blob = pendingSave
                val target = data?.data
                pendingSave = null
                if (resultCode == RESULT_OK && blob != null && target != null) {
                    try { contentResolver.openOutputStream(target)?.use { it.write(blob.bytes) } } catch (_: Exception) { }
                }
            }
            else -> super.onActivityResult(requestCode, resultCode, data)
        }
    }

    // The session cookie must survive Android stopping the app in the background.
    override fun onPause() {
        CookieManager.getInstance().flush()
        super.onPause()
    }

    @Deprecated("Deprecated in Android")
    override fun onBackPressed() {
        val view = browser
        if (view != null && view.canGoBack()) view.goBack()
        else if (view != null && BuildConfig.COMMUNITY_URL.isEmpty()) showSetup()
        else super.onBackPressed()
    }

    private companion object {
        const val REQUEST_UPLOAD = 1
        const val REQUEST_SAVE = 2
    }

    override fun onDestroy() {
        browser?.destroy()
        super.onDestroy()
    }
}
