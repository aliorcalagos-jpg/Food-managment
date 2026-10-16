package app.mealplanner;

import android.app.Activity;
import android.content.Intent;
import android.view.HapticFeedbackConstants;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;

/** Shows the bundled web app full screen. Everything is served from assets/, nothing leaves the phone. */
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://app.local";
    private static final int REQ_SAVE = 1, REQ_PICK = 2;
    private static final int MAX_IMPORT_BYTES = 8 * 1024 * 1024;
    private WebView web;
    private String pendingSave;

    /** What the page may ask of the phone: the system file dialogs (no storage permission needed) and a small vibration. */
    private class Bridge {
        @JavascriptInterface
        public void save(String name, String text) {
            pendingSave = text;
            final Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE, name);
            runOnUiThread(new Runnable() { public void run() { startActivityForResult(i, REQ_SAVE); } });
        }

        @JavascriptInterface
        public void pick() {
            final Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
            runOnUiThread(new Runnable() { public void run() { startActivityForResult(i, REQ_PICK); } });
        }

        @JavascriptInterface
        public void haptic(final String kind) {
            runOnUiThread(new Runnable() {
                public void run() {
                    web.performHapticFeedback("tick".equals(kind) ? HapticFeedbackConstants.KEYBOARD_TAP : HapticFeedbackConstants.LONG_PRESS);
                }
            });
        }
    }

    private void js(String code) {
        web.evaluateJavascript(code, null);
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        boolean ok = result == RESULT_OK && data != null && data.getData() != null;
        if (request == REQ_SAVE) {
            boolean saved = false;
            if (ok) {
                try {
                    OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt");
                    out.write(pendingSave.getBytes("UTF-8"));
                    out.close();
                    saved = true;
                } catch (Exception e) {
                    saved = false;
                }
            }
            pendingSave = null;
            js("window.__saved&&window.__saved(" + saved + ")");
        } else if (request == REQ_PICK) {
            String text = null;
            if (ok) {
                try {
                    InputStream in = getContentResolver().openInputStream(data.getData());
                    ByteArrayOutputStream buf = new ByteArrayOutputStream();
                    byte[] chunk = new byte[8192];
                    int n;
                    while ((n = in.read(chunk)) > 0 && buf.size() <= MAX_IMPORT_BYTES) buf.write(chunk, 0, n);
                    in.close();
                    if (buf.size() <= MAX_IMPORT_BYTES) text = buf.toString("UTF-8");
                } catch (Exception e) {
                    text = null;
                }
            }
            js("window.__picked&&window.__picked(" + (text == null ? "null" : JSONObject.quote(text)) + ")");
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        // The page sits between the system bars (no drawing under them), so nothing is covered on any phone.
        window.setStatusBarColor(Color.parseColor("#1A0F0A"));
        window.setNavigationBarColor(Color.parseColor("#1A0F0A"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#1A0F0A"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // localStorage: where the app keeps its data
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!ORIGIN.equals(uri.getScheme() + "://" + uri.getHost())) {
                    return new WebResourceResponse("text/plain", "utf-8", 403, "Blocked", null, null);
                }
                String path = uri.getPath() == null || uri.getPath().equals("/") ? "/index.html" : uri.getPath();
                try {
                    InputStream in = getAssets().open(path.substring(1));
                    return new WebResourceResponse(mime(path), "utf-8", in);
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", null, null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return true; // never navigate away from the app
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(web);
        web.loadUrl(ORIGIN + "/index.html");
    }

    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }

    /** Back closes what is open first (a sheet, a form); only when nothing is open does the app leave. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(function(){try{return window.__back?window.__back():false}catch(e){return false}})()",
            new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String value) {
                    if (!"true".equals(value)) MainActivity.super.onBackPressed();
                }
            });
    }
}
