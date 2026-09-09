package com.bywayr.app;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.statusbar.StatusBarPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Keep screen awake while using the map
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

    // Register the StatusBar plugin so we can configure the overlay from the web layer
    registerPlugin(StatusBarPlugin.class);
  }
}