import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bywayr.app',
  appName: 'Bywayr',
  webDir: 'out',
  android: {
    allowMixedContent: true,
  },
};

export default config;