import { Platform } from 'react-native';
import { track } from '@vercel/analytics/react';

type AnalyticsValue = string | number | boolean | null | undefined;

export const trackEvent = (name: string, properties?: Record<string, AnalyticsValue>) => {
  if (Platform.OS !== 'web') return;
  track(name, properties);
};
