import { Capacitor } from '@capacitor/core';

interface Coordinate {
  lat: number;
  lng: number;
}

export interface BaseSpotLocation {
  latitude: number;
  longitude: number;
  distanceKm?: number;
}

/**
 * Calculates straight-line distance in km (Haversine)
 */
export function getHaversineDistanceKm(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371;
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Selects 3-4 spots within walking range and sorts them angularly
 * around the user's position to form an organic circular loop.
 */
export function generateBywayLoopStops<T extends BaseSpotLocation>(
  origin: Coordinate,
  allSpots: T[],
  maxStops: number = 3,
  radiusKm: number = 2.5
): T[] {
  const candidates = allSpots
    .filter((s) => s.latitude && s.longitude && !isNaN(s.latitude) && !isNaN(s.longitude))
    .map((spot) => {
      const dist = getHaversineDistanceKm(origin, { lat: spot.latitude, lng: spot.longitude });
      const angle = Math.atan2(spot.longitude - origin.lng, spot.latitude - origin.lat);
      return { spot: { ...spot, distanceKm: dist }, dist, angle };
    })
    .filter((item) => item.dist >= 0.05 && item.dist <= radiusKm);

  if (candidates.length === 0) return [];

  // Sort angularly around origin to create a natural circle without zigzagging
  candidates.sort((a, b) => a.angle - b.angle);

  return candidates.slice(0, maxStops).map((item) => item.spot);
}

/**
 * Deep-links into native Apple Maps or Google Maps walking directions
 */
export function launchNativeWalkingLoop<T extends BaseSpotLocation>(origin: Coordinate, stops: T[]) {
  if (!stops || stops.length === 0) return;

  const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const originStr = `${origin.lat},${origin.lng}`;

  if (isIos) {
    const stopsQuery = stops.map((s) => `+to:${s.latitude},${s.longitude}`).join('');
    const returnHome = `+to:${originStr}`;
    const appleUrl = `http://maps.apple.com/?saddr=${originStr}&daddr=${originStr}${stopsQuery}${returnHome}&dirflg=w`;
    window.location.href = appleUrl;
  } else {
    const waypoints = stops.map((s) => `${s.latitude},${s.longitude}`).join('|');
    const googleUrl = new URL('https://www.google.com/maps/dir/?api=1');
    googleUrl.searchParams.set('origin', originStr);
    googleUrl.searchParams.set('destination', originStr);
    googleUrl.searchParams.set('travelmode', 'walking');
    googleUrl.searchParams.set('waypoints', waypoints);

    window.open(googleUrl.toString(), '_blank');
  }
}
