import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.milkledger.app',
  appName: 'Milk Ledger',
  webDir: 'www',

  // Load the app directly from the bundled www/ folder inside the APK,
  // never from a remote URL — this is what makes the app work fully
  // offline once installed (no server, no internet required).
  server: {
    androidScheme: 'https'
  },

  android: {
    // Keep WebView content flush to the display (fullscreen look);
    // combined with styles.xml (below) for the true fullscreen launch.
    allowMixedContent: false,
    webContentsDebuggingEnabled: false
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#1B4332',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1B4332'
    }
  }
};

export default config;
