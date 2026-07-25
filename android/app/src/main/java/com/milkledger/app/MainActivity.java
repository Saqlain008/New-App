package com.milkledger.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // All app logic (customers, entries, billing, invoices, reports,
        // printing, storage) lives in the existing web app under www/ and
        // runs unchanged inside Capacitor's WebView — no native code needed.
    }
}
