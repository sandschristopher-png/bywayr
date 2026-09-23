export interface LoopStop {
  id?: string;
  name: string;
  category: string;
  city: string;
  country?: string;
  latitude: number;
  longitude: number;
  description?: string;
  image_url?: string;
  distanceKm?: number;
  isFallback?: boolean;
}

export interface Coords {
  lat: number;
  lng: number;
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function generateBywayLoopStops(
  origin: Coords,
  availableSpots: any[],
  maxStops: number = 3,
  maxRadiusKm: number = 2.5
): LoopStop[] {
  const nearby = (availableSpots || [])
    .filter(
      (s) =>
        s &&
        typeof s.latitude === 'number' &&
        typeof s.longitude === 'number' &&
        !isNaN(s.latitude) &&
        !isNaN(s.longitude)
    )
    .map((s) => ({
      ...s,
      distanceKm: getDistanceKm(origin.lat, origin.lng, s.latitude, s.longitude),
      bearing: getBearing(origin.lat, origin.lng, s.latitude, s.longitude),
    }))
    .filter((s) => s.distanceKm <= maxRadiusKm && s.distanceKm > 0.02)
    .sort((a, b) => a.bearing - b.bearing);

  if (nearby.length < 2) return [];

  const stops: LoopStop[] = [];
  const step = Math.max(1, Math.floor(nearby.length / maxStops));

  for (let i = 0; i < nearby.length && stops.length < maxStops; i += step) {
    stops.push(nearby[i]);
  }

  return stops;
}

export async function fetchFallbackOsmStops(
  origin: Coords,
  radiusKm: number = 2.5
): Promise<LoopStop[]> {
  const radiusMeters = Math.min(Math.round(radiusKm * 1000), 4500);
  const query = `
    [out:json][timeout:8];
    (
      node["tourism"~"viewpoint|gallery|museum|artwork"](around:${radiusMeters},${origin.lat},${origin.lng});
      node["historic"~"monument|memorial|archaeological_site"](around:${radiusMeters},${origin.lat},${origin.lng});
      node["leisure"~"park|garden"](around:${radiusMeters},${origin.lat},${origin.lng});
      node["amenity"~"cafe"](around:${radiusMeters},${origin.lat},${origin.lng});
    );
    out body 8;
  `;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!res.ok) return [];

    const data = await res.json();
    if (!data || !Array.isArray(data.elements)) return [];

    return data.elements
      .filter((el: any) => el.tags && (el.tags.name || el.tags['name:en']))
      .map((el: any) => {
        const name = el.tags['name:en'] || el.tags.name;
        let category = 'Hidden Gems';
        if (el.tags.amenity === 'cafe') category = 'Cafes & Workspaces';
        else if (el.tags.leisure === 'park' || el.tags.leisure === 'garden') category = 'Nature & Trails';
        else if (el.tags.tourism === 'viewpoint') category = 'Viewpoints';
        else if (el.tags.historic || el.tags.tourism === 'museum') category = 'Culture & Shrines';

        return {
          id: `osm-${el.id}`,
          name,
          category,
          city: el.tags['addr:city'] || 'Local Area',
          latitude: el.lat,
          longitude: el.lon,
          description: `Point of interest discovered via OpenStreetMap`,
          isFallback: true,
        };
      });
  } catch (err) {
    console.warn('Overpass fallback query unreachable:', err);
    return [];
  }
}

export async function generateCuratedRouteWithFallback(
  origin: Coords,
  communitySpots: any[],
  targetStops: number = 3,
  radiusKm: number = 2.5
): Promise<LoopStop[]> {
  const communityRoute = generateBywayLoopStops(origin, communitySpots, targetStops, radiusKm);
  if (communityRoute.length >= targetStops) {
    return communityRoute;
  }

  const osmStops = await fetchFallbackOsmStops(origin, radiusKm);
  const combined = [...(communitySpots || []), ...osmStops];

  return generateBywayLoopStops(origin, combined, targetStops, radiusKm);
}

export function launchNativeWalkingLoop(origin: Coords, stops: LoopStop[]): void {
  if (!stops || stops.length === 0) return;

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const finalDest = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);

  if (isIOS) {
    const wpParam = waypoints.map((s) => `${s.latitude},${s.longitude}`).join('+');
    const url = `maps://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${finalDest.latitude},${finalDest.longitude}&dirflg=w${
      wpParam ? `&via=${wpParam}` : ''
    }`;
    window.location.href = url;
  } else {
    const wpParam = waypoints.map((s) => `${s.latitude},${s.longitude}`).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${
      finalDest.latitude
    },${finalDest.longitude}&travelmode=walking${
      wpParam ? `&waypoints=${encodeURIComponent(wpParam)}` : ''
    }`;
    window.open(url, '_blank');
  }
}