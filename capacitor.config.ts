import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bywayr.app',
  appName: 'Bywayr',
  webDir: 'out',
  android: {
    allowMixedContent: true,
  },
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-9375478521280538~5041406785',
    },
  },
};

export default config;