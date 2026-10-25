package com.community.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.net.http.SslError
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

class MainActivity : Activity() {
    private val prefs by lazy { getSharedPreferences("community_prefs", MODE_PRIVATE) }
    private var allowedOrigin: String? = null
    private var browser: WebView? = null

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
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 64, 32, 32)
        }
        val title = TextView(this).apply { text = "Square server (HTTPS)" }
        val input = EditText(this).apply {
            hint = "https://community.example.com"
            setText(prefs.getString("server_url", ""))
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_URI
        }
        val message = TextView(this)
        val connect = Button(this).apply {
            text = "Open Square"
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
            }
            override fun onPageFinished(view: WebView, pageUrl: String) {
                if (TrustedOrigin.matches(allowedOrigin, pageUrl)) {
                    prefs.edit().putString("last_url", pageUrl).apply()
                }
            }
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

    @Deprecated("Deprecated in Android")
    override fun onBackPressed() {
        val view = browser
        if (view != null && view.canGoBack()) view.goBack()
        else if (view != null && BuildConfig.COMMUNITY_URL.isEmpty()) showSetup()
        else super.onBackPressed()
    }

    override fun onDestroy() {
        browser?.destroy()
        super.onDestroy()
    }
}
