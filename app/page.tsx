  'use client';

// Helper to open legal pages in system browser, keeping the app intact
const openLegalPage = (path: string) => {
  if (typeof window !== 'undefined') {
    window.open('https://bywayr.com' + path, '_blank');
  }
};
// Retry wrapper for resilient network requests (VPN-resilient, 10s timeout, exponential backoff)
async function fetchWithRetry(resource: RequestInfo | URL, options: RequestInit = {}, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(resource, {
        ...options,
        signal: options.signal ?? controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        if (response.status >= 500 && i < retries - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      clearTimeout(timer);
      if (i === retries - 1) throw error;
      console.warn(`Fetch attempt ${i + 1} failed, retrying...`, error);
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("fetchWithRetry exhausted all retries");
}




  import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

  import * as maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { supabase } from '../lib/supabase';
  import { App as CapApp } from '@capacitor/app';
  import { Capacitor } from '@capacitor/core';
  import CreateCategoryModal from '@/components/CreateCategoryModal';
  import SpotTagModal from '@/components/SpotTagModal';
  import ManageCategoriesModal from '@/components/ManageCategoriesModal';
  import { getUserCustomCategories, deleteCustomCategory, CustomCategory } from '@/lib/categories';

  import {
    Tag,
    MapPin,
    Loader2,
    X,
    Plus,
    Minus,
    Search,
    List,
    Camera,
    Utensils,
    Sun,
    Sparkles,
    Navigation2,
    Crosshair,
    Pencil,
    Trash2,
    LogIn,
    LogOut,
    Mail,
    Share2,
    Check,
    Bookmark,
    BookmarkCheck,
    User,
    CheckSquare,
    Square,
    Gem,
    Beer,
    Store,
    AtSign,
    Trees,
    Home as HomeIcon,
    ThumbsUp,
    ThumbsDown,
    MessageCircle,
    Send,
    Copy,
    Compass,
    Disc,
    Laptop,
    MoonStar,
    Crown,
    Footprints,
    ExternalLink,
    ArrowRight,
    Plane,
    AlertTriangle,
    Gamepad2,
    Landmark,
    MessageSquare,
    WifiOff,
    Mic2,
    Globe,
    SlidersHorizontal,
    CloudUpload,
    CloudDownload,
    ShieldCheck,
    HardDrive,
    Download,
    Sparkle,
    Lock,
  Book,
  AlertCircle,
  ChevronLeft, ChevronRight, Mountain,
  ShoppingBag,
  Link as LinkIcon,
  Repeat,
} from 'lucide-react';
import { generateBywayLoopStops, launchNativeWalkingLoop } from '../lib/bywayLoop';
  import { AdMob } from '@capacitor-community/admob';

  const ADMOB_NATIVE_AD_UNIT_ID = 'ca-app-pub-9375478521280538/5358655888';

  interface Spot {
    id?: string;
    name: string;
    description: string;
    category: string;
    city: string;
    country?: string;
    latitude: number;
    longitude: number;
    image_url?: string;
    image_urls?: string[];
    user_id?: string;
    created_at?: string;
    isLiveOsm?: boolean;
    distanceKm?: number;
  }

  interface UserProfile {
    id: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
    bio?: string;
    country?: string;
    is_private?: boolean;
    plus_enabled?: boolean;
    plus_expires_at?: string;
    youtube_url?: string;
    instagram_url?: string;
    facebook_url?: string;
    website_url?: string;
  }

  interface SpotComment {
    id: string;
    spot_id: string;
    user_id: string;
    content: string;
    tag?: string;
    upvotes?: number;
    created_at: string;
  }

  interface PassportStampData {
    country: string;
    cities: string[];
    spotCount: number;
    firstVisit?: string;
    color: string;
  }

  const CATEGORIES = [
    { label: 'All', desc: 'All unindexed local spots & expat field notes', color: '#57534e', icon: Sparkles },
    { label: 'Hidden Gems', desc: 'Little-known local treasures & secrets', color: '#e05a47', icon: Gem },
    { label: 'Viewpoints', desc: 'Scenic overlooks & panorama lookouts', color: '#ca8a04', icon: Mountain },
    { label: 'Street Food & Stalls', desc: 'Backstreet carts & unmapped night bites', color: '#ea580c', icon: Utensils },
    { label: 'Local Eats', desc: 'Hole-in-the-wall kitchens & family-run joints', color: '#d97706', icon: Store },
    { label: 'Cafes & Workspaces', desc: 'Nomad-friendly spots with reliable Wi-Fi', color: '#2563eb', icon: Laptop },
    { label: 'Bars & Nightlife', desc: 'Local watering holes & concept pubs', color: '#db2777', icon: Beer },
    { label: 'Host & KTV Lounges', desc: 'Private karaoke rooms & companion spaces', color: '#7c3aed', icon: Mic2 },
    { label: 'Entertainment & Play', desc: 'Retro arcades, game lofts & amusement', color: '#6366f1', icon: Gamepad2 },
    { label: 'Markets & Shops', desc: 'Produce alleys & independent thrift stalls', color: '#b45309', icon: ShoppingBag },
    { label: 'Nature & Trails', desc: 'Trailheads, hidden coves & green pockets', color: '#0d9488', icon: Trees },
    { label: 'Culture & Shrines', desc: 'Neighborhood temples & historical plaques', color: '#059669', icon: Landmark },
    { label: 'Stays & Hideaways', desc: 'Boutique guesthouses & quiet retreats', color: '#4f46e5', icon: HomeIcon },
    { label: 'Practical Staples', desc: 'ATMs, money changers, SIM shops, laundry & clinics', color: '#0284c7', icon: Compass },
  ];

  const STAMP_PALETTE = ['#0d9488', '#e05a47', '#0284c7', '#059669', '#7c3aed', '#d97706', '#db2777', '#4f46e5'];
  const COMMENT_TAGS = ['Tip', 'Vibe Check', 'Menu & Price', 'Work & Wi-Fi', 'Closed'];
  const getStampTier = (spotCount: number): 'entry' | 'silver' | 'gold' => {
    if (spotCount >= 30) return 'gold';
    if (spotCount >= 15) return 'silver';
    return 'entry';
  };
  const getCategoryColor = (cat: string) => {
    const match = CATEGORIES.find((c) => c.label.toLowerCase() === cat.toLowerCase());
    return match ? match.color : '#57534e';
  };

  // Generate a contextual discovery hint based on time, weather, and map view
  const getDiscoveryHint = (spots: Spot[], mapCenter: { lat: number; lng: number }, weather: any | null) => {
    const hour = new Date().getHours();
    
    // Filter spots within 5km
    const nearbySpots = spots
      .filter(s => s.latitude && s.longitude)
      .map(s => ({
        ...s,
        distance: getDistanceFromLatLonInKm(mapCenter.lat, mapCenter.lng, s.latitude, s.longitude),
      }))
      .filter(s => s.distance <= 5)
      .sort((a, b) => a.distance - b.distance);

    if (nearbySpots.length === 0) return null;

    // Time-based category preference
    let preferredCategory = 'Hidden Gems';
    if (hour >= 6 && hour < 10) preferredCategory = 'Cafes & Workspaces';
    else if (hour >= 11 && hour < 14) preferredCategory = 'Street Food & Stalls';
    else if (hour >= 17 && hour < 19) preferredCategory = 'Hidden Gems'; // Sunset
    else if (hour >= 20) preferredCategory = 'Bars & Nightlife';

    // Weather adjustment (rain -> indoor)
    if (weather && weather.weatherCode >= 51) {
      preferredCategory = 'Cafes & Workspaces';
    }

    // Find best match
    const bestMatch = nearbySpots.find(s => 
      s.category?.toLowerCase() === preferredCategory.toLowerCase()
    ) || nearbySpots[0];

    // Build hint text
    const distStr = bestMatch.distance < 1 
      ? `${Math.round(bestMatch.distance * 1000)}m` 
      : `${bestMatch.distance.toFixed(1)}km`;
    
    let hint = `${bestMatch.name} · ${distStr} away`;
    
    if (hour >= 17 && hour < 19 && weather?.temp && weather.temp > 15) {
      hint += ` · Great sunset spot!`;
    } else if (weather && weather.weatherCode >= 51) {
      hint += ` · Perfect rainy-day hideout`;
    } else if (hour >= 6 && hour < 10) {
      hint += ` · Morning coffee vibe`;
    }

    return { spot: bestMatch, hint };
  };

  const triggerHaptic = (duration = 10) => {
    // Suppress casual menu, tab, zoom, and navigation taps
    if (duration < 12) return;

    if (typeof window !== 'undefined') {
      // Prioritize crisp native haptics if running in Capacitor
      const CapHaptics = (window as any).Capacitor?.Plugins?.Haptics;
      if (CapHaptics) {
        try {
          if (duration >= 25) {
            CapHaptics.notification({ type: 'SUCCESS' });
          } else {
            CapHaptics.impact({ style: 'MEDIUM' });
          }
          return;
        } catch {}
      }

      // Fallback to standard web vibration for critical events only
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(Math.min(duration, 20));
        } catch {}
      }
    }
  };

  const formatVoteCount = (n: number): string => {
    if (n < 1000) return String(n);
    if (n < 1000000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}K`;
    return `${(n / 1000000).toFixed(1)}M`;
  };

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Recently';
    const now = new Date().getTime();
    const past = new Date(dateStr).getTime();
    const diffHours = Math.floor((now - past) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const openNativeWalkNavigation = (lat: number, lng: number, name?: string) => {
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      window.location.href = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=w&q=${encodeURIComponent(name || 'Spot')}`;
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`, '_blank');
    }
  };

  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  // Fetch local weather via Open-Meteo (no API key required)
  const fetchLocalWeather = async (lat: number, lon: number) => {
    try {
      const res = await fetchWithRetry(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
      );
      const data = await res.json();
      return {
        temp: data.current_weather?.temperature,
        windSpeed: data.current_weather?.windspeed,
        weatherCode: data.current_weather?.weathercode, // 0=clear, >50=rain
      };
    } catch (err) {
      console.error('Weather fetch failed:', err);
      return null;
    }
  };

  const formatWalkDistanceAndTime = (distKm: number) => {
    const walkMinutes = Math.max(1, Math.round((distKm / 4.8) * 60));
    const distStr =
      distKm < 1
        ? `${Math.round(distKm * 1000)}m`
        : distKm < 100
        ? `${distKm.toFixed(1)}km`
        : `${Math.round(distKm)}km`;

    if (distKm > 25) return distStr;
    return `${walkMinutes}m walk · ${distStr}`;
  };

  const sanitizeCountryAndCity = (city: string, country: string): { city: string; country: string } => {
    let cCity = (city || '').trim();
    let cCountry = (country || '').trim();
    const lowerCity = cCity.toLowerCase();
    const lowerCountry = cCountry.toLowerCase();

    if (lowerCity.includes('chroy changvar') || lowerCity.includes('phnom penh') || lowerCity.includes('siem reap') || lowerCountry.includes('cambodia')) {
      cCountry = 'Cambodia';
    } else if (lowerCity.includes('hong kong') || lowerCity.includes('kowloon') || lowerCountry.includes('hong kong')) {
      cCountry = 'Hong Kong';
    } else if (lowerCity.includes('tokyo') || lowerCity.includes('shinjuku') || lowerCity.includes('shibuya') || lowerCity.includes('osaka') || lowerCountry.includes('japan')) {
      cCountry = 'Japan';
    } else if (lowerCity.includes('cebu') || lowerCity.includes('manila') || lowerCity.includes('lapu-lapu') || lowerCity.includes('makati') || lowerCountry.includes('philippines')) {
      cCountry = 'Philippines';
    } else if (lowerCity.includes('vegas') || lowerCity.includes('los angeles') || lowerCity.includes('san francisco') || lowerCountry.includes('usa')) {
      cCountry = 'United States';
    }

    return { city: cCity, country: cCountry };
  };

  const reverseGeocode = async (lat: number, lon: number): Promise<{ name?: string; city?: string; country?: string }> => {
    try {
      const res = await fetchWithRetry(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'BywayrApp/1.0 (contact@bywayr.com)',
            'Accept-Language': 'en',
          },
        }
      );
      const data = await res.json();
      if (data && data.address) {
        const city =
          data.address.city ||
          data.address.town ||
          data.address.municipality ||
          data.address.suburb ||
          data.address.city_district ||
          data.address.district ||
          data.address.village ||
          data.address.county ||
          '';
        const name =
          data.name ||
          data.address.amenity ||
          data.address.building ||
          data.address.shop ||
          data.address.tourism ||
          data.address.road ||
          '';
        const rawCountry = data.address.country || '';
        const sanitized = sanitizeCountryAndCity(city, rawCountry);

        return { name, city: sanitized.city, country: sanitized.country };
      }
    } catch (err) {
      console.error('Reverse geocode error:', err);
    }
    return {};
  };

  const compressImageToWebP = async (file: File, maxDimension = 1200, quality = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) return resolve(file);

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(file);

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(file);
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/webp',
            quality
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  const extractPassportStamps = (userSpots: Spot[]): PassportStampData[] => {
    const groups: Record<string, { cities: Set<string>; spotCount: number; dates: string[] }> = {};

    userSpots.forEach((spot) => {
      const rawCountry = (spot.country || '').trim();
      const sanitized = sanitizeCountryAndCity(spot.city, rawCountry);
      const country = sanitized.country || (sanitized.city ? sanitized.city : 'Curated Territory');

      if (!groups[country]) {
        groups[country] = { cities: new Set<string>(), spotCount: 0, dates: [] };
      }
      if (sanitized.city) groups[country].cities.add(sanitized.city.trim());
      groups[country].spotCount += 1;
      if (spot.created_at) groups[country].dates.push(spot.created_at);
    });

    return Object.keys(groups).map((country, index) => ({
      country,
      cities: Array.from(groups[country].cities),
      spotCount: groups[country].spotCount,
      firstVisit: groups[country].dates.sort()[0] || new Date().toISOString(),
      color: STAMP_PALETTE[index % STAMP_PALETTE.length],
    }));
  };

  const focusMapOnCountry = (mapInstance: maplibregl.Map | null, countrySpots: Spot[]) => {
    if (!mapInstance || countrySpots.length === 0) return;

    if (countrySpots.length === 1) {
      mapInstance.flyTo({
        center: [countrySpots[0].longitude, countrySpots[0].latitude],
        zoom: 14,
        essential: true,
      });
      return;
    }

    const bounds = countrySpots.reduce(
      (b, s) => b.extend([s.longitude, s.latitude]),
      new maplibregl.LngLatBounds(
        [countrySpots[0].longitude, countrySpots[0].latitude],
        [countrySpots[0].longitude, countrySpots[0].latitude]
      )
    );

    mapInstance.fitBounds(bounds, {
      padding: { top: 120, bottom: 120, left: 60, right: 60 },
      maxZoom: 14,
      duration: 1200,
      essential: true,
    });
  };
  const IconYoutube = ({ size = 14, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const IconInstagram = ({ size = 14, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

const IconFacebook = ({ size = 14, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

// --- ONBOARDING TACTILE ARTIFACTS ---
const ArtifactDiscovery = () => (
  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
    <div style={{ position: 'absolute', width: '160px', height: '160px', borderRadius: '50%', backgroundColor: 'rgba(224, 90, 71, 0.12)', filter: 'blur(28px)' }} />
    <div style={{
      width: '180px',
      backgroundColor: '#fffdfa',
      borderRadius: '16px',
      padding: '10px 10px 18px 10px',
      boxShadow: '0 20px 40px -10px rgba(40, 32, 24, 0.22), 0 2px 6px rgba(0,0,0,0.06)',
      border: '1px solid rgba(214, 204, 187, 0.6)',
      transform: 'rotate(-3deg)',
      position: 'relative'
    }}>
      <div style={{ position: 'absolute', top: '-10px', left: '20px', width: '12px', height: '28px', borderRadius: '6px', border: '2px solid #a8a29e', borderBottom: 'none', zIndex: 3 }} />
      <div style={{
        width: '100%',
        height: '118px',
        borderRadius: '10px',
        backgroundColor: '#f5ebe1',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <svg viewBox="0 0 160 110" width="100%" height="100%">
          <rect width="160" height="110" fill="#fcf6ed" />
          <path d="M10 110 L10 65 L28 65 L28 110 M32 110 L32 50 L50 50 L50 110 M55 110 L55 75 L75 75 L75 110 M110 110 L110 60 L135 60 L135 110 M140 110 L140 70 L155 70 L155 110" fill="#eddcd0" />
          <path d="M60 45 Q 85 30 110 45 L115 55 L55 55 Z" fill="#e05a47" opacity="0.9" />
          <circle cx="85" cy="65" r="7" fill="#f59e0b" />
          <circle cx="85" cy="65" r="14" fill="#f59e0b" opacity="0.25" />
          <line x1="85" y1="55" x2="85" y2="72" stroke="#78350f" strokeWidth="1.5" />
          <rect x="70" y="80" width="30" height="30" fill="#8c7a6b" rx="2" />
        </svg>
        <span style={{ position: 'absolute', bottom: '6px', right: '8px', fontSize: '9px', fontWeight: 800, color: '#e05a47', backgroundColor: '#fff1ee', padding: '2px 6px', borderRadius: '6px', letterSpacing: '0.04em' }}>
          LOCAL SECRET
        </span>
      </div>
      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#1c1917', letterSpacing: '-0.01em' }}>Nakano Alleyway</span>
        <span style={{ fontSize: '9px', fontWeight: 600, color: '#a8a29e', fontFamily: 'monospace' }}>35.70° N</span>
      </div>
    </div>
  </div>
);

const ArtifactPinMap = () => (
  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
    <div style={{
      width: '184px',
      height: '184px',
      borderRadius: '50%',
      backgroundColor: '#fbf8f2',
      border: '1.5px solid rgba(220, 210, 195, 0.8)',
      boxShadow: '0 24px 44px -12px rgba(40, 32, 24, 0.18)',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }}>
      <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.55 }}>
        <circle cx="100" cy="100" r="82" fill="none" stroke="#d5c8b5" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M 20 100 Q 60 40, 100 80 T 180 70" fill="none" stroke="#cfc1ad" strokeWidth="1.2" />
        <path d="M 10 130 Q 70 90, 110 120 T 190 120" fill="none" stroke="#cfc1ad" strokeWidth="1.2" />
        <path d="M 30 160 Q 80 140, 120 155 T 180 170" fill="none" stroke="#cfc1ad" strokeWidth="1.2" />
        <circle cx="100" cy="100" r="42" fill="rgba(224, 90, 71, 0.08)" stroke="#e05a47" strokeWidth="1" strokeDasharray="2 3" />
      </svg>
      <div style={{
        position: 'absolute',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        backgroundColor: 'rgba(224, 90, 71, 0.2)',
        animation: 'gpsRadarPulse 2s infinite'
      }} />
      <div style={{
        position: 'relative',
        zIndex: 2,
        transform: 'translateY(-14px)',
        filter: 'drop-shadow(0 14px 18px rgba(224, 90, 71, 0.38))',
      }}>
        <svg width="48" height="60" viewBox="0 0 32 42" fill="none">
          <path d="M16 0C7.163 0 0 7.163 0 16C0 26.5 16 42 16 42C16 42 32 26.5 32 16C32 7.163 24.837 0 16 0Z" fill="#e05a47"/>
          <circle cx="16" cy="15" r="7.5" fill="#ffffff"/>
          <circle cx="16" cy="15" r="3.8" fill="#e05a47"/>
        </svg>
      </div>
    </div>
  </div>
);

const ArtifactPassportStamps = () => (
  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
    <div style={{
      position: 'absolute',
      transform: 'translateX(-32px) translateY(8px) rotate(-8deg)',
      width: '124px',
      height: '124px',
      opacity: 0.85,
    }}>
      <svg viewBox="0 0 140 140" width="100%" height="100%">
        <circle cx="70" cy="70" r="62" fill="#fffdfa" stroke="#0d9488" strokeWidth="2.8" />
        <circle cx="70" cy="70" r="55" fill="none" stroke="#0d9488" strokeWidth="1.2" strokeDasharray="3 2" />
        <text x="70" y="48" textAnchor="middle" fill="#0d9488" fontSize="9" fontWeight="900" letterSpacing="0.14em">✦ PHILIPPINES ✦</text>
        <rect x="22" y="56" width="96" height="26" rx="4" fill="#fffdfa" stroke="#0d9488" strokeWidth="1.4" />
        <text x="70" y="73" textAnchor="middle" fill="#0d9488" fontSize="11" fontWeight="900" fontFamily="monospace">14 AUG 2026</text>
        <text x="70" y="98" textAnchor="middle" fill="#0d9488" fontSize="8" fontWeight="800" letterSpacing="0.12em">• IMMIGRATION •</text>
      </svg>
    </div>
    <div style={{
      position: 'relative',
      zIndex: 2,
      transform: 'translateX(26px) translateY(-6px) rotate(5deg)',
      width: '136px',
      height: '136px',
      filter: 'drop-shadow(0 14px 24px rgba(40, 32, 24, 0.14))',
    }}>
      <svg viewBox="0 0 140 140" width="100%" height="100%">
        <circle cx="70" cy="70" r="64" fill="#fffdfa" stroke="#e05a47" strokeWidth="3.2" />
        <circle cx="70" cy="70" r="57" fill="none" stroke="#e05a47" strokeWidth="1.4" strokeDasharray="4 2" />
        <text x="70" y="48" textAnchor="middle" fill="#e05a47" fontSize="10.5" fontWeight="900" letterSpacing="0.16em">✦ JAPAN ✦</text>
        <rect x="18" y="55" width="104" height="28" rx="5" fill="#fffdfa" stroke="#e05a47" strokeWidth="1.6" />
        <text x="70" y="74" textAnchor="middle" fill="#e05a47" fontSize="12" fontWeight="900" fontFamily="monospace">22 SEP 2026</text>
        <text x="70" y="98" textAnchor="middle" fill="#e05a47" fontSize="8.5" fontWeight="800" letterSpacing="0.14em">• ENTRY · PERMIT •</text>
      </svg>
    </div>
  </div>
);

export default function Home() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const previewMarkerRef = useRef<maplibregl.Marker | null>(null);
    const userLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
    const spotMarkersRef = useRef<maplibregl.Marker[]>([]);
    const categoryScrollRef = useRef<HTMLDivElement>(null);
    const profileStampScrollRef = useRef<HTMLDivElement>(null);
    const publicStampScrollRef = useRef<HTMLDivElement>(null);

    const [isCategoryDragging, setIsCategoryDragging] = useState(false);
    const [categoryStartX, setCategoryStartX] = useState(0);
    const [categoryScrollLeft, setCategoryScrollLeft] = useState(0);

    const [isStampDragging, setIsStampDragging] = useState(false);
    const [stampStartX, setStampStartX] = useState(0);
    const [stampScrollLeft, setStampScrollLeft] = useState(0);

    const [catBounce, setCatBounce] = useState<'left' | 'right' | null>(null);
    const lastBounceTimeRef = useRef<number>(0);
    const lastZoomTimeRef = useRef<number>(0);
    const handleCategoryScroll = () => {
      const el = categoryScrollRef.current;
      if (!el) return;
      const now = Date.now();
      if (now - lastBounceTimeRef.current < 600) return;
      if (el.scrollLeft <= 2) {
        lastBounceTimeRef.current = now;
        setCatBounce('left');
        setTimeout(() => setCatBounce(null), 380);
      } else if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 2) {
        lastBounceTimeRef.current = now;
        setCatBounce('right');
        setTimeout(() => setCatBounce(null), 380);
      }
    };

    const zoomHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const zoomRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopZoomHold = useCallback(() => {
      if (zoomHoldRef.current) {
        clearTimeout(zoomHoldRef.current);
        zoomHoldRef.current = null;
      }
      if (zoomRepeatRef.current) {
        clearInterval(zoomRepeatRef.current);
        zoomRepeatRef.current = null;
      }
    }, []);

    const startZoomHold = useCallback((direction: 1 | -1, e?: React.PointerEvent | React.TouchEvent) => {
      if (e && 'preventDefault' in e && e.cancelable) {
        e.preventDefault();
      }
      stopZoomHold();
      triggerHaptic(8);

      if (map.current) {
        const currentZoom = map.current.getZoom();
        map.current.easeTo({ zoom: currentZoom + direction * 0.75, duration: 180 });
      }

      zoomHoldRef.current = setTimeout(() => {
        zoomRepeatRef.current = setInterval(() => {
          if (map.current) {
            triggerHaptic(4);
            const z = map.current.getZoom();
            map.current.easeTo({ zoom: z + direction * 0.5, duration: 110 });
          }
        }, 120);
      }, 300);
    }, [stopZoomHold]);

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const currentUserRef = useRef<any>(null);

    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      if (params.get('upgrade') === 'success') {
        setIsPlusSubscriber(true);
        localStorage.setItem('bywayr_is_plus', 'true');
        showToast('Welcome to Bywayr Plus! Your 3-day free trial is active. 👑');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }, []);
    const [nativeAd, setNativeAd] = useState<any>(null);
    const [nativeAdLoaded, setNativeAdLoaded] = useState(false);
    const [nativeAdError, setNativeAdError] = useState<string | null>(null);
    const [isOffline, setIsOffline] = useState(false);

    const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('bywayr_user_profile');
        if (saved) {
          try { return JSON.parse(saved); } catch {}
        }
      }
      return null;
    });

    const [showWelcome, setShowWelcome] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
    const notifiedSpotIdsRef = useRef<Set<string>>(new Set());
    const lastNearbyCheckRef = useRef<number>(0);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'back'>('forward');
    const [isOnboardingExiting, setIsOnboardingExiting] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isProfileClosing, setIsProfileClosing] = useState(false);
    const [isClaimUsernameModalOpen, setIsClaimUsernameModalOpen] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const [isEditingCountry, setIsEditingCountry] = useState(false);
    const [editCountryValue, setEditCountryValue] = useState('');
    const [savingCountry, setSavingCountry] = useState(false);
    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
    const [editUsernameValue, setEditUsernameValue] = useState('');
    const [editBioValue, setEditBioValue] = useState('');
    const [editYoutubeUrl, setEditYoutubeUrl] = useState('');
    const [editInstagramUrl, setEditInstagramUrl] = useState('');
    const [editFacebookUrl, setEditFacebookUrl] = useState('');
    const [editWebsiteUrl, setEditWebsiteUrl] = useState('');
    const [editProfileError, setEditProfileError] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    const [selectedCountryFilter, setSelectedCountryFilter] = useState<string | null>(null);

    const [isPlusModalOpen, setIsPlusModalOpen] = useState(false);
const [journalTab, setJournalTab] = useState<'overview' | 'spots' | 'musttry'>('overview');
const [isJournalSettingsOpen, setIsJournalSettingsOpen] = useState(false);
    const [isPassportBookOpen, setIsPassportBookOpen] = useState(false);
    const passportBookTouchStartRef = useRef<number | null>(null);
    const passportDesktopDragStartRef = useRef<number | null>(null);
    const [isBookClosing, setIsBookClosing] = useState(false);
    const [passportBookPage, setPassportBookPage] = useState(0);
    const [isDesktopViewport, setIsDesktopViewport] = useState(false);
    const [isPlusClosing, setIsPlusClosing] = useState(false);

    useEffect(() => {
      if (typeof window === 'undefined') return;
      const updateViewport = () => setIsDesktopViewport(window.innerWidth >= 768);
      updateViewport();
      window.addEventListener('resize', updateViewport);
      return () => window.removeEventListener('resize', updateViewport);
    }, []);

    const [isPlusSubscriber, setIsPlusSubscriber] = useState<boolean>(() => {
      if (typeof window !== 'undefined') {
        // Cache only honored as optimistic default; fetchUserProfile() re-validates from Supabase shortly after mount
        return localStorage.getItem('bywayr_is_plus') === 'true';
      }
      return false;
    });
    const plusValidatedRef = useRef<boolean>(false);

    const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
    const [viewingProfileSpots, setViewingProfileSpots] = useState<Spot[]>([]);
    const [viewingProfileComments, setViewingProfileComments] = useState<SpotComment[]>([]);
    const [profileTab, setProfileTab] = useState<'pins' | 'comments'>('pins');
    const [profileCityFilter, setProfileCityFilter] = useState<string>('All');
    const [savingPrivacy, setSavingPrivacy] = useState(false);
    const [viewingPassportProfile, setViewingPassportProfile] = useState<UserProfile | null>(null);
    const [viewingPassportSpots, setViewingPassportSpots] = useState<Spot[]>([]);

    const [isWalkModalOpen, setIsWalkModalOpen] = useState(false);
    const [walkTargetSpot, setWalkTargetSpot] = useState<Spot | null>(null);
    const [walkSearchQuery, setWalkSearchQuery] = useState('');
    const [walkRadiusFilter, setWalkRadiusFilter] = useState<'all' | '10min' | '20min'>('all');
    const [liveOsmResults, setLiveOsmResults] = useState<Spot[]>([]);
    const [isSearchingOsm, setIsSearchingOsm] = useState(false);

    // Byway Loop state
    const [isLoopModalOpen, setIsLoopModalOpen] = useState(false);
    const [loopStops, setLoopStops] = useState<Spot[]>([]);
    const [loopDuration, setLoopDuration] = useState<30 | 45 | 60>(45);

    useEffect(() => {
      if (typeof window === 'undefined') return;
      const q = walkSearchQuery.trim();
      if (!q || q.length < 2) {
        setLiveOsmResults([]);
        setIsSearchingOsm(false);
        return;
      }

      const handler = setTimeout(async () => {
        setIsSearchingOsm(true);
        try {
          const center = userCoords || (map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 });
          const refLat = 'lat' in center ? center.lat : 36.1699;
          const refLng = 'lng' in center ? center.lng : -115.1398;
          const res = await fetchWithRetry(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=6&accept-language=en`,
            {
              headers: {
                'User-Agent': 'BywayrApp/1.0 (contact@bywayr.com)',
                'Accept-Language': 'en',
              },
            }
          );
          const data = await res.json();
          if (Array.isArray(data)) {
            const formatted: Spot[] = data.map((item: any) => {
              const placeCity = item.address?.city || item.address?.town || item.address?.suburb || item.address?.municipality || 'Local Area';
              const rawCountry = item.address?.country || '';
              const sanitized = sanitizeCountryAndCity(placeCity, rawCountry);
              return {
                name: item.name || item.display_name.split(',')[0],
                city: sanitized.city,
                country: sanitized.country,
                category: 'Practical Staples',
                description: item.display_name,
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                isLiveOsm: true,
                distanceKm: getDistanceFromLatLonInKm(refLat, refLng, parseFloat(item.lat), parseFloat(item.lon)),
              };
            });
            setLiveOsmResults(formatted);
          }
        } catch (err) {
          console.error('Walk modal OSM search error:', err);
        } finally {
          setIsSearchingOsm(false);
        }
      }, 280);

      return () => clearTimeout(handler);
    }, [walkSearchQuery, userCoords]);

    const [drawerSortMode, setDrawerSortMode] = useState<'nearest' | 'recent'>('nearest');

    const [recentSearches, setRecentSearches] = useState<string[]>(() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('bywayr_recent_searches');
        if (saved) {
          try { return JSON.parse(saved); } catch {}
        }
      }
      return [];
    });

    const addRecentSearch = (query: string) => {
      const clean = query.trim();
      if (!clean) return;
      setRecentSearches((prev) => {
        const updated = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
        if (typeof window !== 'undefined') {
          localStorage.setItem('bywayr_recent_searches', JSON.stringify(updated));
        }
        return updated;
      });
    };

    const [activeSearchedSpot, setActiveSearchedSpot] = useState<{
      name: string;
      city: string;
      country?: string;
      latitude: number;
      longitude: number;
    } | null>(null);

    const [viewingSpot, setViewingSpot] = useState<Spot | null>(null);
    const [isDiscussionModalOpen, setIsDiscussionModalOpen] = useState(false);
    const [isSheetExpanded, setIsSheetExpanded] = useState(false);
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
    const [isMobileLayout, setIsMobileLayout] = useState(false);
    const sheetDragStartY = useRef<number | null>(null);

    // Responsive mobile breakpoint check
    useEffect(() => {
      const checkLayout = () => setIsMobileLayout(Capacitor.isNativePlatform() || window.innerWidth <= 640);
      checkLayout();
      window.addEventListener('resize', checkLayout);
      return () => window.removeEventListener('resize', checkLayout);
    }, []);

    const [mapReady, setMapReady] = useState(false);
    const [showSplash, setShowSplash] = useState(() => {
      if (typeof window !== 'undefined') {
        const isCapacitor = Boolean((window as any)?.Capacitor?.isNativePlatform?.());
        const isMobile = window.innerWidth < 768 || isCapacitor;
        return isMobile;
      }
      return false;
    });
    const [splashFading, setSplashFading] = useState(false);

    useEffect(() => {
      if (mapReady && showSplash) {
        setSplashFading(true);
        const timer = setTimeout(() => {
          setShowSplash(false);
          setSplashFading(false);
        }, 320);
        return () => clearTimeout(timer);
      }
    }, [mapReady, showSplash]);
    const [isDarkMode, setIsDarkMode] = useState(() => {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('bywayr_dark_mode') === 'true';
      }
      return false;
    });
    const [isInteracting, setIsInteracting] = useState(false);

    const [onlyMySpots, setOnlyMySpots] = useState(false);
    const [maxRadiusKm, setMaxRadiusKm] = useState<number | null>(null);

    const [spots, setSpots] = useState<Spot[]>([]);

    // Hydrate cached spots on the client only (after mount) to avoid SSR mismatches
    useEffect(() => {
      const cached = localStorage.getItem('bywayr_cached_spots');
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Spot[];
          if (Array.isArray(parsed) && parsed.length > 0) setSpots(parsed);
        } catch {}
      }
    }, []);
    const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
    const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);

    const resolveCategoryColor = useCallback((catName?: string) => {
      if (!catName) return '#57534e';
      const customMatch = customCategories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
      if (customMatch?.color) return customMatch.color;
      const stdMatch = CATEGORIES.find((c) => c.label.toLowerCase() === catName.toLowerCase());
      return stdMatch ? stdMatch.color : '#57534e';
    }, [customCategories]);

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isDrawerClosing, setIsDrawerClosing] = useState(false);

    const [drawerTab, setDrawerTab] = useState<'fieldNotes' | 'mustTry' | 'essentials'>('fieldNotes');
    const [mustTrySpotIds, setMustTrySpotIds] = useState<string[]>([]);
    const [savingBookmark, setSavingBookmark] = useState(false);

    const [spotComments, setSpotComments] = useState<SpotComment[]>([]);
    const [newCommentText, setNewCommentText] = useState('');
    const [commentTag, setCommentTag] = useState<string>('Tip');
    const commentTagsScrollRef = useRef<HTMLDivElement>(null);
    const [isTagDragging, setIsTagDragging] = useState(false);
    const [tagStartX, setTagStartX] = useState(0);
    const [tagScrollLeft, setTagScrollLeft] = useState(0);

    const handleTagMouseDown = (e: React.MouseEvent) => {
      if (!commentTagsScrollRef.current) return;
      setIsTagDragging(true);
      setTagStartX(e.pageX - commentTagsScrollRef.current.offsetLeft);
      setTagScrollLeft(commentTagsScrollRef.current.scrollLeft);
    };

    const handleTagMouseMove = (e: React.MouseEvent) => {
      if (!isTagDragging || !commentTagsScrollRef.current) return;
      e.preventDefault();
      const x = e.pageX - commentTagsScrollRef.current.offsetLeft;
      const walk = (x - tagStartX) * 1.5;
      commentTagsScrollRef.current.scrollLeft = tagScrollLeft - walk;
    };

    const handleTagMouseUpOrLeave = () => {
      setIsTagDragging(false);
    };

    const handleTagWheel = (e: React.WheelEvent) => {
      if (!commentTagsScrollRef.current) return;
      if (e.deltaY !== 0) {
        commentTagsScrollRef.current.scrollLeft += e.deltaY;
      }
    };
    const [upvotedCommentIds, setUpvotedCommentIds] = useState<string[]>([]);
    const [submittingComment, setSubmittingComment] = useState(false);

    const [shareDialogSpot, setShareDialogSpot] = useState<Spot | null>(null);
    const [shareDialogCustomText, setShareDialogCustomText] = useState<string>('');
    const [shareDialogCustomTitle, setShareDialogCustomTitle] = useState<string>('');
    const [shareDialogCustomUrl, setShareDialogCustomUrl] = useState<string>('');
    const [shareDialogCopied, setShareDialogCopied] = useState(false);
    const [coordsCopied, setCoordsCopied] = useState(false);

    const [myVotes, setMyVotes] = useState<Record<string, 'up' | 'down'>>({});
    const [voteCounts, setVoteCounts] = useState<Record<string, { up: number; down: number }>>({});
    const [savingVote, setSavingVote] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [isModalLocating, setIsModalLocating] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);

    const [showExitToast, setShowExitToast] = useState(false);
    const [exitToastExiting, setExitToastExiting] = useState(false);
    const [uiToast, setUiToast] = useState<string | null>(null);
    const [uiToastExiting, setUiToastExiting] = useState(false);
    const [uiToastType, setUiToastType] = useState<'success' | 'error'>('success');

    const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
      setUiToast(msg);
      setUiToastType(type);
      setUiToastExiting(false);
      setTimeout(() => {
        setUiToastExiting(true);
        setTimeout(() => {
          setUiToast(null);
          setUiToastExiting(false);
        }, 280);
      }, 2600);
    }, []);

    const triggerExitToast = useCallback(() => {
      setShowExitToast(true);
      setExitToastExiting(false);
      setTimeout(() => {
        setExitToastExiting(true);
        setTimeout(() => {
          setShowExitToast(false);
          setExitToastExiting(false);
        }, 280);
      }, 1900);
    }, []);
    const lastBackPressTime = useRef<number>(0);
    const isPopstateHandling = useRef(false);
    const lastHistoryPushTime = useRef<number>(0);
    const expectingDismissPop = useRef(false);

    const [authEmail, setAuthEmail] = useState('');
    const [authUsername, setAuthUsername] = useState('');
    const [authCountry, setAuthCountry] = useState('');
    const [authUsernameError, setAuthUsernameError] = useState('');
    const [claimUsername, setClaimUsername] = useState('');
    const [claimCountry, setClaimCountry] = useState('');
    const [claimUsernameError, setClaimUsernameError] = useState('');
    const [isSavingUsername, setIsSavingUsername] = useState(false);
    const [profileSavedAt, setProfileSavedAt] = useState<number | null>(null);
    const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
    const [magicLinkSent, setMagicLinkSent] = useState(false);
    const [activeProximityAlert, setActiveProximityAlert] = useState<Spot | null>(null);
    const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);

    const [bannerHeight, setBannerHeight] = useState(0);
    const [adReady, setAdReady] = useState(false);
    
    // Discovery Hint State
    const [discoveryHint, setDiscoveryHint] = useState<{ spot: Spot; hint: string } | null>(null);
    const [weatherData, setWeatherData] = useState<any>(null);
    const hintDismissedRef = useRef<boolean>(false);

    const [isRestoringDrive, setIsRestoringDrive] = useState(false);
    const [driveStatusMessage, setDriveStatusMessage] = useState<string | null>(null);

    const [newSpot, setNewSpot] = useState<Spot>({
      name: '',
      category: 'Hidden Gems',
      city: 'Las Vegas',
      country: 'United States',
      description: '',
      latitude: 36.1699,
      longitude: -115.1398,
      image_url: '',
    });

    useEffect(() => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.error('Service worker registration failed:', err);
        });
      }
    }, []);
      // Startup self-heal: verify Bywayr Plus entitlement from Google Play on native
    useEffect(() => {
      if (typeof window === 'undefined' || !(window as any).Capacitor?.isNativePlatform()) return;

      (async () => {
        try {
          const { NativePurchases } = await import('@capgo/native-purchases');
          const restored: any = await NativePurchases.restorePurchases();
          const entitlements = restored?.customerInfo?.entitlements || {};
          const hasPlus =
            Object.keys(entitlements).length > 0 ||
            restored?.transactions?.some(
              (tx: any) => tx.productId === 'bywayr_plus_lifetime' || tx.productIdentifier === 'bywayr_plus_lifetime'
            );  

          if (hasPlus) {
            localStorage.setItem('bywayr_is_plus', 'true');
            setIsPlusSubscriber(true);
          } else if (localStorage.getItem('bywayr_is_plus') === 'true') {
            localStorage.removeItem('bywayr_is_plus');
            setIsPlusSubscriber(false);
          }
        } catch (err) {
          console.warn('Plus entitlement check failed:', err);
        }
      })();
    }, []);

    useEffect(() => {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
        import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
          StatusBar.setOverlaysWebView({ overlay: true });
          StatusBar.setStyle({ style: isDarkMode ? Style.Dark : Style.Light });
        });
      }
    }, [isDarkMode]);

    // AdMob initialization (No persistent bottom banner on live map)
    useEffect(() => {
      if (typeof window === 'undefined') return;
      if (!(window as any).Capacitor?.isNativePlatform()) return;
      if (isPlusSubscriber) return;

      (async () => {
        try {
          const { AdMob } = await import('@capacitor-community/admob');
          await AdMob.initialize();
          setAdReady(true);
        } catch (err) {
          console.error('AdMob init failed:', err);
        }
      })();
    }, [isPlusSubscriber]);

    // Load native ad on Android for free-tier users (runs after AdMob init completes)
    useEffect(() => {
      if (typeof window === 'undefined') return;
      if (!adReady) return;

      if (isPlusSubscriber) {
        setNativeAd(null);
        setNativeAdLoaded(false);
        return;
      }

      // Native ads are not yet supported in @capacitor-community/admob v8.1.0.
      // Re-enable the load call below when the plugin ships native ad support.
      console.log('Native ads unsupported in current AdMob plugin version');
      setNativeAd(null);
      setNativeAdLoaded(false);

      return () => {};
    }, [adReady, isPlusSubscriber]);

    const myUserSpots = currentUser ? spots.filter((s: Spot) => s.user_id === currentUser.id) : [];
    const myPassportStamps = extractPassportStamps(myUserSpots);

    const filteredSpots = useMemo(() => {
      // Use stable userCoords or fixed defaults — NEVER read dynamic map.current.getCenter() during pans
      const refLat = userCoords ? userCoords.lat : 36.1699;
      const refLng = userCoords ? userCoords.lng : -115.1398;

      return spots
        .filter((spot: Spot) => {
          if (onlyMySpots && currentUser && spot.user_id !== currentUser.id) return false;
          if (selectedCountryFilter && (spot.country || '').toLowerCase() !== selectedCountryFilter.toLowerCase()) return false;
          if (maxRadiusKm !== null) {
            const dist = getDistanceFromLatLonInKm(refLat, refLng, spot.latitude, spot.longitude);
            if (dist > maxRadiusKm) return false;
          }
          if (selectedCategory === 'All') return true;
          return spot.category?.toLowerCase() === selectedCategory.toLowerCase();
        })
        .sort((a, b) => {
          if (drawerSortMode === 'nearest') {
            const distA = getDistanceFromLatLonInKm(refLat, refLng, a.latitude, a.longitude);
            const distB = getDistanceFromLatLonInKm(refLat, refLng, b.latitude, b.longitude);
            return distA - distB;
          }
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          if (timeA !== timeB) return timeB - timeA;
          const idA = a.id ? Number(a.id) : 0;
          const idB = b.id ? Number(b.id) : 0;
          return idB - idA;
        });
    }, [spots, onlyMySpots, currentUser?.id, selectedCountryFilter, maxRadiusKm, selectedCategory, drawerSortMode, userCoords]);

    const mustTryList = spots
      .filter((s: Spot) => s.id && mustTrySpotIds.includes(s.id))
      .sort((a, b) => {
        if (drawerSortMode === 'nearest') {
          const center = userCoords || (map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 });
          const refLat = 'lat' in center ? center.lat : 36.1699;
          const refLng = 'lng' in center ? center.lng : -115.1398;
          return getDistanceFromLatLonInKm(refLat, refLng, a.latitude, a.longitude) - getDistanceFromLatLonInKm(refLat, refLng, b.latitude, b.longitude);
        }
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });

    // Live reference point — read at render time so sort and distance badges always agree
    const drawerRefPoint = () => {
      const center = userCoords || (map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 });
      const refLat = 'lat' in center ? center.lat : 36.1699;
      const refLng = 'lng' in center ? center.lng : -115.1398;
      return { refLat, refLng };
    };

    const myNotesSpots = currentUser
      ? spots.filter((s: Spot) => s.user_id === currentUser.id)
      : [];

    // Single source of truth for the drawer list — always sorted
    const displayedDrawerSpots = (() => {
      const source = drawerTab === 'fieldNotes' ? myNotesSpots : mustTryList;

      if (drawerSortMode !== 'nearest') {
        return [...source].sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          if (timeA !== timeB) return timeB - timeA;
          const idA = a.id ? Number(a.id) : 0;
          const idB = b.id ? Number(b.id) : 0;
          return idB - idA;
        });
      }

      const { refLat, refLng } = drawerRefPoint();
      return [...source].sort(
        (a, b) =>
          getDistanceFromLatLonInKm(refLat, refLng, a.latitude, a.longitude) -
          getDistanceFromLatLonInKm(refLat, refLng, b.latitude, b.longitude)
      );
    })();

    // Index where the far group starts (nearest sort only) — drives the headers
    const firstFarIndex = (() => {
      if (drawerTab !== 'fieldNotes' || drawerSortMode !== 'nearest') return -1;
      const { refLat, refLng } = drawerRefPoint();
      return displayedDrawerSpots.findIndex(
        (s) => getDistanceFromLatLonInKm(refLat, refLng, s.latitude, s.longitude) > 50
      );
    })();
    const mySpotsCount = myUserSpots.length;
    const myCitiesCount = currentUser ? new Set(myUserSpots.map((s) => s.city.trim())).size : 0;
    const myCountriesCount = myPassportStamps.length;

    const activeCategoryObject = CATEGORIES.find((c) => c.label.toLowerCase() === selectedCategory.toLowerCase());

    const uiGlass = isDarkMode ? 'rgba(20, 18, 16, 0.65)' : 'rgba(255, 255, 255, 0.58)';
    const uiSolid = isDarkMode ? '#121110' : '#ecebe7';
    const uiBorder = isDarkMode ? '#2a2826' : '#e7e5e4';
    const uiText = isDarkMode ? '#fafaf9' : '#1c1917';
    const uiSubtext = isDarkMode ? '#78716c' : '#78716c'; 

    const mapCenter = map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 };
    const proximitySortedSpots: Spot[] = [...spots]
      .filter((s: Spot) => s.latitude && s.longitude)
      .map((spot) => ({
        ...spot,
        distanceKm: getDistanceFromLatLonInKm(mapCenter.lat, mapCenter.lng, spot.latitude, spot.longitude),
      }))
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm);

    useEffect(() => {
      if (typeof window === 'undefined') return;
      const handler = setTimeout(async () => {
        const q = searchQuery.trim();
        if (!q || q.length < 2) {
          setSearchResults([]);
          setShowDropdown(false);
          return;
        }

        setIsSearching(true);
        try {
          const localMatches = spots
            .filter(
              (spot) =>
                spot.name.toLowerCase().includes(q.toLowerCase()) ||
                spot.city.toLowerCase().includes(q.toLowerCase()) ||
                spot.category.toLowerCase().includes(q.toLowerCase())
            )
            .map((spot) => ({
              display_name: `${spot.name} (${spot.city} — ${spot.category})`,
              name: spot.name,
              lat: spot.latitude,
              lon: spot.longitude,
              address: { city: spot.city, country: spot.country },
              isLocal: true,
              spotObj: spot,
            }))
            .slice(0, 4);

          const center = map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 };
          const spanDeg = Math.max(0.5, 20 / Math.pow(2, map.current ? map.current.getZoom() : 13.5));
          let west = center.lng - spanDeg, east = center.lng + spanDeg;
          let south = center.lat - spanDeg, north = center.lat + spanDeg;
          const viewbox = `${west},${north},${east},${south}`;
          const res = await fetchWithRetry(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=8&viewbox=${viewbox}&bounded=0&accept-language=en`,
            {
              headers: {
                'User-Agent': 'BywayrApp/1.0 (contact@bywayr.com)',
                'Accept-Language': 'en',
              },
            }
          );        const osmData = await res.json();

          const combined = [...localMatches, ...(osmData || [])];
          setSearchResults(combined);
          setShowDropdown(true);
        } catch (err) {
          console.error('Autocomplete search error:', err);
        } finally {
          setIsSearching(false);
        }
      }, 250);

      return () => clearTimeout(handler);
    }, [searchQuery, spots]);

    const isAnyOverlayActive = !!(
      isPlusModalOpen ||
      isPassportBookOpen ||
      isModalOpen ||
      isDrawerOpen ||
      isDrawerClosing ||
      isProfileModalOpen ||
      isProfileClosing ||
      viewingSpot ||
      isDiscussionModalOpen ||
      viewingProfile ||
      isWalkModalOpen ||
      isLoopModalOpen ||
      shareDialogSpot ||
      Boolean(shareDialogCustomUrl) ||
      isAuthModalOpen ||
      isClaimUsernameModalOpen ||
      isDeleteAccountModalOpen ||
      activeSearchedSpot ||
      showWelcome
    );

    const activeOverlayRef = useRef<boolean>(false);
    useEffect(() => {
      activeOverlayRef.current = isAnyOverlayActive;
    }, [isAnyOverlayActive]);

    // Banner pause/resume hook removed live map is completely ad-free

    const pushModalHistoryState = useCallback((sheetKey: string) => {
      if (typeof window !== 'undefined') {
        lastHistoryPushTime.current = Date.now();
        window.history.pushState({ bywayr_sheet: sheetKey }, '');
      }
    }, []);

    // Long-press to drop a pin (mobile only, zero-interference with drag, pinch, or edge back-swipes)
    useEffect(() => {
      if (!mapReady || !map.current) return;
      const m = map.current;
      let lpTimer: ReturnType<typeof setTimeout> | null = null;
      let isMapMoving = false;
      const EDGE_THRESHOLD = 80; // Comprehensive gesture bezel exclusion

      const abortTimer = () => {
        if (lpTimer) {
          clearTimeout(lpTimer);
          lpTimer = null;
        }
      };

      // When the map pans, zooms, or moves in ANY way, kill timer immediately
      const onMapMotionStart = () => {
        isMapMoving = true;
        abortTimer();
      };
      const onMapMotionEnd = () => {
        isMapMoving = false;
        abortTimer();
      };

      m.on('movestart', onMapMotionStart);
      m.on('move', abortTimer);
      m.on('moveend', onMapMotionEnd);
      m.on('dragstart', onMapMotionStart);
      m.on('drag', abortTimer);
      m.on('dragend', onMapMotionEnd);
      m.on('zoomstart', onMapMotionStart);
      m.on('zoom', abortTimer);
      m.on('zoomend', onMapMotionEnd);

      // Native DOM touch handler directly on the map container
      const container = mapContainer.current;
      if (!container) return;

      let startTouchX = 0;
      let startTouchY = 0;

      const handleTouchStart = (e: TouchEvent) => {
        // Multi-touch (pinch) or map actively moving -> never drop a pin
        if (e.touches.length !== 1 || isMapMoving) {
          abortTimer();
          return;
        }

        const touch = e.touches[0];
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;

        // Ignore touches starting near ANY screen bezel (back gesture, notification shade, nav bar)
        if (
          touch.clientX <= EDGE_THRESHOLD ||
          touch.clientX >= screenW - EDGE_THRESHOLD ||
          touch.clientY <= 60 ||
          touch.clientY >= screenH - 70
        ) {
          abortTimer();
          return;
        }

        startTouchX = touch.clientX;
        startTouchY = touch.clientY;

        const rect = container.getBoundingClientRect();
        const pointX = touch.clientX - rect.left;
        const pointY = touch.clientY - rect.top;

        abortTimer();
        // True intentional stationary hold (700ms)
        lpTimer = setTimeout(() => {
          lpTimer = null;
          if (isMapMoving) return;
          const ll = m.unproject([pointX, pointY]);
          dropDraggablePreviewPin(ll.lat, ll.lng);
        }, 700);
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!lpTimer) return;
        if (e.touches.length !== 1) {
          abortTimer();
          return;
        }
        const touch = e.touches[0];
        const dx = touch.clientX - startTouchX;
        const dy = touch.clientY - startTouchY;
        // Any drag greater than 6 pixels is an intentional pan, cancel hold immediately
        if (dx * dx + dy * dy > 36) {
          abortTimer();
        }
      };

      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchmove', handleTouchMove, { passive: true });
      container.addEventListener('touchend', abortTimer, { passive: true });
      container.addEventListener('touchcancel', abortTimer, { passive: true });
      window.addEventListener('touchcancel', abortTimer, { passive: true });

      return () => {
        abortTimer();
        m.off('movestart', onMapMotionStart);
        m.off('move', abortTimer);
        m.off('moveend', onMapMotionEnd);
        m.off('dragstart', onMapMotionStart);
        m.off('drag', abortTimer);
        m.off('dragend', onMapMotionEnd);
        m.off('zoomstart', onMapMotionStart);
        m.off('zoom', abortTimer);
        m.off('zoomend', onMapMotionEnd);

        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', abortTimer);
        container.removeEventListener('touchcancel', abortTimer);
        window.removeEventListener('touchcancel', abortTimer);
      };
    }, [mapReady]);

    const handleCloseModal = () => {
      if (previewMarkerRef.current && !activeSearchedSpot) {
        previewMarkerRef.current.remove();
        previewMarkerRef.current = null;
      }
      setImageFiles([]);
      setImagePreviews([]);
      setIsEditing(false);
      setIsModalOpen(false);
    };

    const handleCloseDrawer = () => {
      setIsDrawerClosing(true);
      setTimeout(() => {
        setIsDrawerOpen(false);
        setIsDrawerClosing(false);
      }, 240);
      if (!isPopstateHandling.current && typeof window !== 'undefined' && (window.history.state as any)?.bywayr_sheet) {
        window.history.back();
      }
    };

    const handleClosePassportBook = () => {
      triggerHaptic(8);
      setIsBookClosing(true);
      setTimeout(() => {
        setIsPassportBookOpen(false);
        setIsBookClosing(false);
        setViewingPassportProfile(null);
        setViewingPassportSpots([]);
        setPassportBookPage(0);
        // Ensure the underlying Field Journal profile modal stays open
        if (currentUserRef.current && !isProfileModalOpen) {
          setIsProfileModalOpen(true);
        }
      }, 240);
      if (!isPopstateHandling.current && typeof window !== 'undefined' && (window.history.state as any)?.bywayr_sheet) {
        window.history.back();
      }
    };

    const handleCloseProfileDrawer = () => {
      setIsProfileClosing(true);
      setIsEditingCountry(false);
      setTimeout(() => {
        setIsProfileModalOpen(false);
        setIsProfileClosing(false);
      }, 240);
      if (!isPopstateHandling.current && typeof window !== 'undefined' && (window.history.state as any)?.bywayr_sheet) {
        window.history.back();
      }
    };


    const closeTopmostSheet = useCallback(() => {
      if (isEditProfileOpen) { setIsEditProfileOpen(false); return; }
      if (isCreateCategoryOpen) { setIsCreateCategoryOpen(false); return; }
      if (isTagModalOpen) { setIsTagModalOpen(false); return; }
      if (isManageCategoriesOpen) { setIsManageCategoriesOpen(false); return; }
      if (isPassportBookOpen) { handleClosePassportBook(); return; }
      if (isPlusModalOpen) { setIsPlusModalOpen(false); return; }
      if (isDeleteAccountModalOpen) { setIsDeleteAccountModalOpen(false); return; }
      if (isClaimUsernameModalOpen) { setIsClaimUsernameModalOpen(false); return; }
      if (isProfileModalOpen) { handleCloseProfileDrawer(); return; }
      if (isAuthModalOpen) { setIsAuthModalOpen(false); return; }
      if (shareDialogSpot || shareDialogCustomUrl) { setShareDialogSpot(null); setShareDialogCustomUrl(''); return; }
      if (isLoopModalOpen) { setIsLoopModalOpen(false); return; }
      if (isWalkModalOpen) { setIsWalkModalOpen(false); return; }
      if (viewingProfile) { setViewingProfile(null); return; }
      if (isDiscussionModalOpen) {
        setIsDiscussionModalOpen(false);
        return;
      }
      if (isModalOpen) { handleCloseModal(); return; }
      if (viewingSpot) {
        if (isSheetExpanded) {
          setIsSheetExpanded(false);
          return;
        }
        setViewingSpot(null);
        setIsSheetExpanded(false);
        if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
        return;
      }
      if (activeSearchedSpot) {
        setActiveSearchedSpot(null);
        if (previewMarkerRef.current) previewMarkerRef.current.remove();
        return;
      }
      if (isDrawerOpen) { handleCloseDrawer(); return; }
      if (showWelcome) {
        if (onboardingStep > 0) {
          setSlideDirection('back');
          setOnboardingStep((prev) => prev - 1);
        } else {
          handleDismissWelcome();
        }
        return;
      }
    }, [
      isEditProfileOpen,
      isCreateCategoryOpen,
      isTagModalOpen,
      isManageCategoriesOpen,
      isPassportBookOpen,
      isPlusModalOpen,
      isDeleteAccountModalOpen,
      isClaimUsernameModalOpen,
      isProfileModalOpen,
      isAuthModalOpen,
      shareDialogSpot,
      shareDialogCustomUrl,
     isWalkModalOpen,
      isLoopModalOpen,
      viewingProfile,
      isDiscussionModalOpen,
      isModalOpen,
      viewingSpot,
      isSheetExpanded,
      activeSearchedSpot,
      isDrawerOpen,
      showWelcome,
      onboardingStep,
      slideDirection,
    ]);

    useEffect(() => {
      const handlePopState = () => {
        isPopstateHandling.current = true;
        if (expectingDismissPop.current) {
          // This popstate is just our own modal-dismiss history.back() echoing back — ignore it
          expectingDismissPop.current = false;
          return;
        }
        if (activeOverlayRef.current) {
          closeTopmostSheet();
        } else if (Date.now() - lastHistoryPushTime.current < 600) {
          // Spurious popstate racing a programmatic modal push — re-anchor and bail
          window.history.pushState(null, '', window.location.href);
          return;
        } else {
          const now = Date.now();
          if (now - lastBackPressTime.current < 2000) {
            setShowExitToast(false);
            return;
          }
          lastBackPressTime.current = now;
          triggerExitToast();
          window.history.pushState(null, '', window.location.href);
        }
        setTimeout(() => {
          isPopstateHandling.current = false;
        }, 50);
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }, [closeTopmostSheet]);

    const dismissModalWithHistory = (closeFn: () => void) => {
      closeFn();
      if (!isPopstateHandling.current && typeof window !== 'undefined' && (window.history.state as any)?.bywayr_sheet) {
        expectingDismissPop.current = true;
        window.history.back();
      }
    };

    useEffect(() => {
      currentUserRef.current = currentUser;
    }, [currentUser]);

    useEffect(() => {
      if (typeof document !== 'undefined') {
        let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = '/icon-192.png';
        link.type = 'image/png';
      }
    }, []);

    useEffect(() => {
      const hasSeenWelcome = localStorage.getItem('bywayr_seen_welcome');
      if (!hasSeenWelcome) {
        setShowWelcome(true);
        pushModalHistoryState('welcome');
      }
    }, [pushModalHistoryState]);

    const handleDismissWelcome = () => {
      localStorage.setItem('bywayr_seen_welcome', 'true');
      setShowWelcome(false);
    };

    const fetchSpots = async () => {
      try {
        const { data, error } = await supabase.from('spots').select('*').order('id', { ascending: false });
        if (!error && data) {
          const cleaned = (data as Spot[]).map((s) => {
            const sanitized = sanitizeCountryAndCity(s.city, s.country || '');
            return {
              ...s,
              city: sanitized.city,
              country: sanitized.country,
            };
          });
          setSpots(cleaned);
          localStorage.setItem('bywayr_cached_spots', JSON.stringify(cleaned));
        }
      } catch (err) {
        console.error('Failed to load spots:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchMustTryBookmarks = async (userId: string) => {
      try {
        const { data, error } = await supabase.from('bookmarks').select('spot_id').eq('user_id', userId);
        if (!error && data) setMustTrySpotIds(data.map((item: any) => item.spot_id));
      } catch (err) {
        console.error('Failed to load bookmarks:', err);
      }
    };

    const toggleMustTry = async (spotId?: string) => {
      if (!spotId) return;
      const activeUser = currentUserRef.current;
      if (!activeUser) {
        setIsAuthModalOpen(true);
        pushModalHistoryState('auth');
        return;
      }

      triggerHaptic(12);
      setSavingBookmark(true);
      const isBookmarked = mustTrySpotIds.includes(spotId);

      if (isBookmarked) {
        const { error } = await supabase.from('bookmarks').delete().eq('user_id', activeUser.id).eq('spot_id', spotId);
        if (!error) setMustTrySpotIds((prev) => prev.filter((id) => id !== spotId));
      } else {
        const { error } = await supabase.from('bookmarks').insert([{ user_id: activeUser.id, spot_id: spotId }]);
        if (!error) setMustTrySpotIds((prev) => [...prev, spotId]);
      }
      setSavingBookmark(false);
    };

    const toggleVote = async (spotId: string | undefined, voteType: 'up' | 'down') => {
      if (!spotId) return;
      const activeUser = currentUserRef.current;
      if (!activeUser) {
        setIsAuthModalOpen(true);
        pushModalHistoryState('auth');
        return;
      }

      triggerHaptic(12);
      setSavingVote(true);
      const current = myVotes[spotId];

      try {
        if (current === voteType) {
          // Same vote tapped — remove it
          const { error } = await supabase.from('spot_votes').delete().eq('user_id', activeUser.id).eq('spot_id', spotId);
          if (!error) {
            setMyVotes((prev) => {
              const next = { ...prev };
              delete next[spotId];
              return next;
            });
            setVoteCounts((prev) => {
              const old = prev[spotId] || { up: 0, down: 0 };
              return {
                ...prev,
                [spotId]: {
                  up: Math.max(0, (old.up ?? 0) - (voteType === 'up' ? 1 : 0)),
                  down: Math.max(0, (old.down ?? 0) - (voteType === 'down' ? 1 : 0)),
                },
              };
            });
          }
        } else {
          // Insert or flip the vote (upsert handles switching up <-> down)
          const { error } = await supabase
            .from('spot_votes')
            .upsert(
              [{ user_id: activeUser.id, spot_id: spotId, vote_type: voteType }],
              { onConflict: 'user_id,spot_id' }
            );
          if (!error) {
            setMyVotes((prev) => ({ ...prev, [spotId]: voteType }));
            setVoteCounts((prev) => {
              const old = prev[spotId] || { up: 0, down: 0 };
              const next = { up: old.up ?? 0, down: old.down ?? 0 };
              if (current === 'up') next.up = Math.max(0, next.up - 1);
              if (current === 'down') next.down = Math.max(0, next.down - 1);
              if (voteType === 'up') next.up += 1;
              if (voteType === 'down') next.down += 1;
              return { ...prev, [spotId]: next };
            });
          }
        }
      } catch (err) {
        console.error('Vote toggle failed:', err);
      }
      setSavingVote(false);
    };

    const handleOpenPublicProfile = async (userId: string) => {
      triggerHaptic(8);

      // Always pull fresh profile + comments straight from Supabase (works on cold-load shares too)
      const { data: profileData } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, updated_at, created_at, country, bio, is_private, plus_enabled, plus_expires_at, youtube_url, instagram_url, facebook_url, website_url')
    .eq('id', userId)
    .maybeSingle();
      const profile: UserProfile = profileData || profilesMap[userId] || { id: userId, username: 'wanderer' };

      setViewingProfile(profile);
      setViewingProfileSpots(spots.filter((s) => s.user_id === userId));
      setViewingProfileComments([]);
      setProfileTab('pins');
      setProfileCityFilter('All');
      setViewingSpot(null);
      pushModalHistoryState('publicProfile');

      if (!profile.is_private) {
        const { data: commentData } = await supabase
          .from('spot_comments')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (commentData) setViewingProfileComments(commentData as SpotComment[]);
      }
    };

    const handleTogglePrivacy = async () => {
      const activeUser = currentUserRef.current;
      if (!activeUser) return;

      triggerHaptic(8);
      setSavingPrivacy(true);
      const next = !userProfile?.is_private;

      const { error } = await supabase.from('profiles').upsert({
        id: activeUser.id,
        is_private: next,
        updated_at: new Date().toISOString(),
      });

      if (!error) {
        const updated = { ...userProfile, id: activeUser.id, is_private: next };
        setUserProfile(updated);
        localStorage.setItem('bywayr_user_profile', JSON.stringify(updated));
        fetchProfiles();
        showToast(next ? 'Your journal is now private' : 'Your journal is now public');
      } else {
        console.error('Privacy toggle failed:', error);
        showToast('Could not update privacy — please try again', 'error');
      }
      setSavingPrivacy(false);
    };

    const handleCategoryMouseDown = (e: React.MouseEvent) => {
      if (!categoryScrollRef.current) return;
      setIsCategoryDragging(true);
      setCategoryStartX(e.pageX - categoryScrollRef.current.offsetLeft);
      setCategoryScrollLeft(categoryScrollRef.current.scrollLeft);
    };

    const handleCategoryMouseLeaveOrUp = () => {
      setIsCategoryDragging(false);
    };

    const handleCategoryMouseMove = (e: React.MouseEvent) => {
      if (!isCategoryDragging || !categoryScrollRef.current) return;
      e.preventDefault();
      const x = e.pageX - categoryScrollRef.current.offsetLeft;
      const walk = (x - categoryStartX) * 1.5;
      categoryScrollRef.current.scrollLeft = categoryScrollLeft - walk;
    };

    const handleCategoryWheel = (e: React.WheelEvent) => {
      if (!categoryScrollRef.current) return;
      if (e.deltaY !== 0) {
        categoryScrollRef.current.scrollLeft += e.deltaY;
      }
    };

    const handleStampMouseDown = (e: React.MouseEvent, ref: React.RefObject<HTMLDivElement | null>) => {
      if (e.button !== 0 || !ref.current) return;
      setIsStampDragging(true);
      setStampStartX(e.pageX - ref.current.offsetLeft);
      setStampScrollLeft(ref.current.scrollLeft);
    };

    const handleStampMouseMove = (e: React.MouseEvent, ref: React.RefObject<HTMLDivElement | null>) => {
      if (!isStampDragging || !ref.current) return;
      e.preventDefault();
      const x = e.pageX - ref.current.offsetLeft;
      const walk = (x - stampStartX) * 1.6;
      ref.current.scrollLeft = stampScrollLeft - walk;
    };

    const handleStampMouseUpOrLeave = () => {
      setIsStampDragging(false);
    };

    const handleStampWheel = (e: React.WheelEvent, ref: React.RefObject<HTMLDivElement | null>) => {
      if (!ref.current) return;
      if (e.deltaY !== 0) {
        ref.current.scrollLeft += e.deltaY;
      }
    };

    const handleOpenBywayLoop = () => {
      triggerHaptic(10);
      const center = userCoords || (map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 });
      const origin = { lat: 'lat' in center ? center.lat : 36.1699, lng: 'lng' in center ? center.lng : -115.1398 };

      const radius = loopDuration === 30 ? 1.5 : loopDuration === 45 ? 2.5 : 3.5;
      const stops = generateBywayLoopStops(origin, spots, 3, radius);

      setLoopStops(stops);
      setIsLoopModalOpen(true);
      pushModalHistoryState('bywayLoop');
    };

    const handleSelectSearchResult = (item: any) => {
      triggerHaptic(8);
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      setShowDropdown(false);
      setSearchQuery(item.display_name);
      addRecentSearch(String(item.display_name || ''));

      const placeName = item.name || item.display_name.split(',')[0];
      const placeCity = item.address?.city || item.address?.town || item.address?.suburb || 'Local Map Area';
      const rawCountry = item.address?.country || '';
      const sanitized = sanitizeCountryAndCity(placeCity, rawCountry);

      setActiveSearchedSpot({
        name: placeName,
        city: sanitized.city,
        country: sanitized.country,
        latitude: lat,
        longitude: lon,
      });
      setViewingSpot(null);
      pushModalHistoryState('activeSearchedSpot');

      if (map.current) {
        map.current.flyTo({ center: [lon, lat], zoom: 16, essential: true });

        if (previewMarkerRef.current) previewMarkerRef.current.remove();

        const pinColor = '#e05a47';
        const pinEl = document.createElement('div');
        pinEl.innerHTML = `
          <div class="bywayr-pin-drop" style="width: 28px; height: 38px; position: relative; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35)); cursor: pointer;">
            <svg width="28" height="38" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 0C7.163 0 0 7.163 0 16C0 26.5 16 42 16 42C16 42 32 26.5 32 16C32 7.163 24.837 0 16 0Z" fill="${pinColor}"/>
              <circle cx="16" cy="15" r="7" fill="white"/>
              <circle cx="16" cy="15" r="3.5" fill="${pinColor}"/>
            </svg>
          </div>
        `;

        previewMarkerRef.current = new maplibregl.Marker({ element: pinEl, anchor: 'bottom' })
          .setLngLat([lon, lat])
          .addTo(map.current);
      }
    };

    const handleLocateMe = () => {
      triggerHaptic(8);
      if (!navigator.geolocation) {
        showToast('Location not supported on this device');
        return;
      }

      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserCoords({ lat: latitude, lng: longitude });
          if (!map.current) return;

          if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.setLngLat([longitude, latitude]);
          } else {
            const el = document.createElement('div');
            el.style.position = 'relative';
            el.style.width = '72px';
            el.style.height = '72px';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';

            const halo = document.createElement('div');
            halo.style.position = 'absolute';
            halo.style.inset = '0';
            halo.style.borderRadius = '50%';
            halo.style.backgroundColor = 'rgba(224, 90, 71, 0.18)';
            halo.style.border = '1px solid rgba(224, 90, 71, 0.25)';

            const dot = document.createElement('div');
            dot.style.width = '18px';
            dot.style.height = '18px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = '#e05a47';
            dot.style.border = '3.5px solid #ffffff';
            dot.style.boxShadow = '0 1px 6px rgba(0, 0, 0, 0.35)';
            dot.className = 'user-location-pulse';

            el.appendChild(halo);
            el.appendChild(dot);

            userLocationMarkerRef.current = new maplibregl.Marker({ element: el })
              .setLngLat([longitude, latitude])
              .addTo(map.current);
          }

          map.current.flyTo({ center: [longitude, latitude], zoom: 16, essential: true });
          setIsLocating(false);
        },
        () => {
          showToast("Couldn't get your location — check permissions");
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    const handleModalLocate = () => {
      triggerHaptic(8);
      if (!navigator.geolocation) {
        showToast('Location not supported on this device');
        return;
      }

      setIsModalLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserCoords({ lat: latitude, lng: longitude });
          const lat = parseFloat(latitude.toFixed(6));
          const lon = parseFloat(longitude.toFixed(6));

          if (map.current) {
            if (previewMarkerRef.current) previewMarkerRef.current.remove();

            const pinColor = '#e05a47';
            const pinEl = document.createElement('div');
            pinEl.className = 'bywayr-map-pin';
            pinEl.innerHTML = `
              <div class="bywayr-pin-drop" style="width: 28px; height: 38px; position: relative; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35)); cursor: pointer;">
                <svg width="28" height="38" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 0C7.163 0 0 7.163 0 16C0 26.5 16 42 16 42C16 42 32 26.5 32 16C32 7.163 24.837 0 16 0Z" fill="${pinColor}"/>
                  <circle cx="16" cy="15" r="7" fill="white"/>
                  <circle cx="16" cy="15" r="3.5" fill="${pinColor}"/>
                </svg>
              </div>
            `;

            previewMarkerRef.current = new maplibregl.Marker({ element: pinEl, anchor: 'bottom' })
              .setLngLat([lon, lat])
              .addTo(map.current);
            map.current.flyTo({ center: [lon, lat], zoom: 16, essential: true });
          }

          const geo = await reverseGeocode(lat, lon);
          setNewSpot((prev) => ({
            ...prev,
            latitude: lat,
            longitude: lon,
            city: geo.city || prev.city || 'Las Vegas',
            country: geo.country || prev.country || 'United States',
            name: prev.name || geo.name || '',
          }));

          setIsModalLocating(false);
        },
        () => {
          showToast("Couldn't get your location — check permissions");
          setIsModalLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    const handleShareSpot = async (spot: Spot) => {
      if (!spot.id) return;
      triggerHaptic(8);
      const shareUrl = `${window.location.origin}${window.location.pathname}?spot=${spot.id}`;
      const shareText = `Check out ${spot.name} in ${spot.city} on Bywayr!`;

      if (navigator.share) {
        try {
          await navigator.share({ title: `Bywayr — ${spot.name}`, text: shareText, url: shareUrl });
          return;
        } catch {}
      }

      setShareDialogSpot(spot);
      setShareDialogCustomTitle(`Share Spot: ${spot.name}`);
      setShareDialogCustomText(shareText);
      setShareDialogCustomUrl(shareUrl);
      setShareDialogCopied(false);
      pushModalHistoryState('share');
    };

    const handleShareFieldJournal = async () => {
      if (!currentUser) return;
      triggerHaptic(8);
      if (userProfile?.is_private) {
        showToast('Note: Your journal is currently set to Private in Settings.', 'error');
      }
      const handle = userProfile?.username ? `@${userProfile.username}` : 'explorer';
      const shareUrl = `${window.location.origin}${window.location.pathname}?curator=${currentUser.id}`;
      const shareText = `Check out ${handle}'s Field Journal on Bywayr featuring ${mySpotsCount} pinned spots across ${myCountriesCount} countries!`;

      if (navigator.share) {
        try {
          await navigator.share({ title: `${handle}'s Field Journal — Bywayr`, text: shareText, url: shareUrl });
          return;
        } catch {}
      }

      setShareDialogSpot(null);
      setShareDialogCustomTitle(`Share Field Journal`);
      setShareDialogCustomText(shareText);
      setShareDialogCustomUrl(shareUrl);
      setShareDialogCopied(false);
      pushModalHistoryState('share');
    };

    const handleCopyCoordinates = async (lat: number, lon: number) => {
      triggerHaptic(10);
      await navigator.clipboard.writeText(`${lat}, ${lon}`);
      setCoordsCopied(true);
      setTimeout(() => setCoordsCopied(false), 2000);
    };
    const dropDraggablePreviewPin = async (lat?: number, lon?: number) => {
      const activeUser = currentUserRef.current;
      if (!activeUser) {
        setIsAuthModalOpen(true);
        pushModalHistoryState('auth');
        return;
      }
      if (!map.current) return;
      triggerHaptic(12);
      setViewingSpot(null);
      setIsDiscussionModalOpen(false);
      setActiveSearchedSpot(null);
      setIsEditing(false);

      if (previewMarkerRef.current) previewMarkerRef.current.remove();

      const center = map.current.getCenter();
      const targetLat = lat ?? center.lat;
      const targetLng = lon ?? center.lng;

      const pinColor = '#e05a47';
      const pinEl = document.createElement('div');
      pinEl.className = 'bywayr-map-pin';
      pinEl.innerHTML = `
        <div class="bywayr-pin-drop" style="width: 28px; height: 38px; position: relative; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35)); cursor: pointer;">
          <svg width="28" height="38" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16C0 26.5 16 42 16 42C16 42 32 26.5 32 16C32 7.163 24.837 0 16 0Z" fill="${pinColor}"/>
            <circle cx="16" cy="15" r="7" fill="white"/>
            <circle cx="16" cy="15" r="3.5" fill="${pinColor}"/>
          </svg>
        </div>
      `;

      previewMarkerRef.current = new maplibregl.Marker({ element: pinEl, anchor: 'bottom' })
        .setLngLat([targetLng, targetLat])
        .addTo(map.current);

      const geo = await reverseGeocode(targetLat, targetLng);
      setNewSpot({
        name: geo.name || '',
        category: 'Hidden Gems',
        city: geo.city || 'Las Vegas',
        country: geo.country || 'United States',
        description: '',
        latitude: parseFloat(targetLat.toFixed(6)),
        longitude: parseFloat(targetLng.toFixed(6)),
        image_url: '',
      });

      setImageFiles([]);
      setImagePreviews([]);
      setIsModalOpen(true);
      pushModalHistoryState('addSpotModal');
    };
    const dropPreviewAndOpenModal = async (lat: number, lon: number, defaultName: string = '') => {
      const activeUser = currentUserRef.current;
      if (!activeUser) {
        setIsAuthModalOpen(true);
        pushModalHistoryState('auth');
        return;
      }

      if (!map.current) return;
      triggerHaptic(8);
      setViewingSpot(null);
      setIsDiscussionModalOpen(false);
      setActiveSearchedSpot(null);
      setIsEditing(false);

      if (previewMarkerRef.current) previewMarkerRef.current.remove();

      const pinColor = '#e05a47';
      const pinEl = document.createElement('div');
      pinEl.className = 'bywayr-map-pin';
      pinEl.innerHTML = `
        <div class="bywayr-pin-drop" style="width: 28px; height: 38px; position: relative; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35)); cursor: pointer;">
          <svg width="28" height="38" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16C0 26.5 16 42 16 42C16 42 32 26.5 32 16C32 7.163 24.837 0 16 0Z" fill="${pinColor}"/>
            <circle cx="16" cy="15" r="7" fill="white"/>
            <circle cx="16" cy="15" r="3.5" fill="${pinColor}"/>
          </svg>
        </div>
      `;

      previewMarkerRef.current = new maplibregl.Marker({ element: pinEl, anchor: 'bottom' })
        .setLngLat([lon, lat])
        .addTo(map.current);

      map.current.flyTo({ center: [lon, lat], zoom: 16, essential: true });

      const geo = await reverseGeocode(lat, lon);

      setNewSpot({
        name: defaultName || geo.name || '',
        category: 'Hidden Gems',
        city: geo.city || 'Las Vegas',
        country: geo.country || 'United States',
        description: '',
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lon.toFixed(6)),
        image_url: '',
      });

      setImageFiles([]);
      setImagePreviews([]);
      setIsModalOpen(true);
      pushModalHistoryState('addSpotModal');
    };

    const handleOpenEditModal = (spot: Spot, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const activeUser = currentUserRef.current;
      if (!activeUser || spot.user_id !== activeUser.id) return;
      triggerHaptic(8);
      setIsEditing(true);
      setNewSpot(spot);
      const existingImages = spot.image_urls && spot.image_urls.length > 0 ? spot.image_urls : (spot.image_url ? [spot.image_url] : []);
      setImagePreviews(existingImages);
      setImageFiles([]);
      setViewingSpot(null);
      setIsDiscussionModalOpen(false);
      setActiveSearchedSpot(null);
      setIsModalOpen(true);
      pushModalHistoryState('editSpotModal');
    };

    const handleDeleteSpot = async (spot: Spot, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const activeUser = currentUserRef.current;
      if (!spot.id || !activeUser || spot.user_id !== activeUser.id) return;
      if (!confirm(`Are you sure you want to delete "${spot.name}"?`)) return;

      triggerHaptic(15);
      setDeleting(true);

      // Clean up orphaned image files from Supabase storage bucket
      const allSpotPhotos = spot.image_urls && spot.image_urls.length > 0 ? spot.image_urls : (spot.image_url ? [spot.image_url] : []);
      for (const photoUrl of allSpotPhotos) {
        try {
          const parts = photoUrl.split('/spot-images/');
          if (parts[1]) {
            await supabase.storage.from('spot-images').remove([parts[1]]);
          }
        } catch (storageErr) {
          console.warn('Storage cleanup failed on spot delete:', storageErr);
        }
      }

      const { error } = await supabase.from('spots').delete().eq('id', spot.id);
      if (!error) {
        setSpots((prev) => prev.filter((s) => s.id !== spot.id));
        setViewingSpot(null);
        setIsDiscussionModalOpen(false);
      }
      setDeleting(false);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const selected = Array.from(e.target.files).slice(0, 4);
        setImageFiles(selected);
        setImagePreviews(selected.map((f) => URL.createObjectURL(f)));
      }
    };

    const handleSaveSpot = async (e: React.FormEvent) => {
      e.preventDefault();
      const activeUser = currentUserRef.current;
      if (!activeUser) {
        setIsAuthModalOpen(true);
        pushModalHistoryState('auth');
        return;
      }
      if (!newSpot.name || isNaN(newSpot.latitude) || isNaN(newSpot.longitude)) return;

      triggerHaptic(12);
      setSaving(true);
      let uploadedUrl = newSpot.image_url || '';

      let uploadedUrls: string[] = [];
      if (imageFiles.length > 0) {
        setUploadingImage(true);
        try {
          uploadedUrls = await Promise.all(
            imageFiles.map(async (file) => {
              const fileToUpload = await compressImageToWebP(file);
              const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`;
              const filePath = `spots/${fileName}`;
              const { error: uploadError } = await supabase.storage
                .from('spot-images')
                .upload(filePath, fileToUpload, { contentType: 'image/webp', upsert: true });
              if (uploadError) throw uploadError;
              const { data: publicUrlData } = supabase.storage.from('spot-images').getPublicUrl(filePath);
              return publicUrlData.publicUrl;
            })
          );
          if (uploadedUrls.length > 0) uploadedUrl = uploadedUrls[0];
        } catch (err) {
          console.error('Image uploads failed:', err);
        }
        setUploadingImage(false);
      }

      const sanitized = sanitizeCountryAndCity(newSpot.city, newSpot.country || 'United States');

      if (isEditing && newSpot.id) {
        const { data, error } = await supabase
          .from('spots')
          .update({
            name: newSpot.name,
            category: newSpot.category,
            city: sanitized.city,
            country: sanitized.country,
            description: newSpot.description,
            latitude: newSpot.latitude,
            longitude: newSpot.longitude,
            image_url: uploadedUrl || null,
            image_urls: uploadedUrls.length > 0 ? uploadedUrls : (newSpot as any).image_urls || (uploadedUrl ? [uploadedUrl] : []),
          })
          .eq('id', newSpot.id)
          .select();

        if (!error && data && data.length > 0) {
          setSpots((prev) => prev.map((s) => (s.id === newSpot.id ? (data[0] as Spot) : s)));
          setViewingSpot(data[0] as Spot);
          setActiveSearchedSpot(null);
          dismissModalWithHistory(() => setIsModalOpen(false));
        }
      } else {
        const { data, error } = await supabase
          .from('spots')
          .insert([{
            name: newSpot.name,
            category: newSpot.category,
            city: sanitized.city,
            country: sanitized.country,
            description: newSpot.description,
            latitude: newSpot.latitude,
            longitude: newSpot.longitude,
            image_url: uploadedUrl || null,
            image_urls: uploadedUrls.length > 0 ? uploadedUrls : (uploadedUrl ? [uploadedUrl] : []),
            user_id: activeUser.id,
          }])
          .select();

        if (!error && data && data.length > 0) {
          if (previewMarkerRef.current) {
            previewMarkerRef.current.remove();
            previewMarkerRef.current = null;
          }
          
          const addedSpot = data[0] as Spot;
          const previousCountries = new Set(myUserSpots.map((s) => (s.country || '').toLowerCase().trim()));
          const newCountry = (addedSpot.country || sanitized.country || '').toLowerCase().trim();
          const isNewCountryUnlocked = newCountry && !previousCountries.has(newCountry);

          setSpots((prev) => [addedSpot, ...prev]);
          dismissModalWithHistory(() => setIsModalOpen(false));
          setSearchQuery('');
          setActiveSearchedSpot(null);
          if (map.current) map.current.flyTo({ center: [newSpot.longitude, newSpot.latitude], zoom: 16 });

          if (isNewCountryUnlocked) {
            setTimeout(() => {
              triggerHaptic(30);
              showToast(`🎉 New Passport Stamp Unlocked: ${sanitized.country || 'Curated Territory'}!`);
            }, 600);
          }
        }
      }
      setSaving(false);
    };

    const flyToSpot = (spot: Spot) => {
      if (!map.current || spot.latitude === undefined || spot.longitude === undefined) return;
      const lat = Number(spot.latitude);
      const lng = Number(spot.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      // Reset filters so the selected pin is guaranteed visible in the map layer
      setSelectedCategory('All');
      setSelectedCountryFilter(null);
      setMaxRadiusKm(null);

      // Drop an interactive pin marker directly on the selected spot
      if (previewMarkerRef.current) {
        previewMarkerRef.current.remove();
        previewMarkerRef.current = null;
      }

      const pinColor = resolveCategoryColor(spot.category || 'Hidden Gems');
      const pinEl = document.createElement('div');
      pinEl.className = 'bywayr-map-pin';
      pinEl.innerHTML = `
        <div class="bywayr-pin-drop" style="width: 28px; height: 38px; position: relative; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35)); cursor: pointer;">
          <svg width="28" height="38" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16C0 26.5 16 42 16 42C16 42 32 26.5 32 16C32 7.163 24.837 0 16 0Z" fill="${pinColor}"/>
            <circle cx="16" cy="15" r="7" fill="white"/>
            <circle cx="16" cy="15" r="3.5" fill="${pinColor}"/>
          </svg>
        </div>
      `;
      pinEl.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerHaptic(8);
        setViewingSpot(spot);
        pushModalHistoryState('viewingSpot');
      });

      previewMarkerRef.current = new maplibregl.Marker({ element: pinEl, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map.current);

      map.current.flyTo({ center: [lng, lat], zoom: 16, essential: true });
      setViewingSpot(spot);
      setIsDiscussionModalOpen(false);
      setActiveSearchedSpot(null);
      setIsDrawerOpen(false);
      setIsDrawerClosing(false);
      pushModalHistoryState('viewingSpot');
      if (spot.id && typeof window !== 'undefined') window.history.replaceState(null, '', `?spot=${spot.id}`);
    };

    const fetchSpotComments = async (spotId: string) => {
      try {
        const { data, error } = await supabase
          .from('spot_comments')
          .select('*')
          .eq('spot_id', spotId);
        if (!error && data) {
          const sorted = (data as SpotComment[]).sort((a, b) => {
            const diff = (b.upvotes || 0) - (a.upvotes || 0);
            if (diff !== 0) return diff;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          setSpotComments(sorted);
        }
      } catch (err) {
        console.error('Failed to load spot comments:', err);
      }
    };

    const fetchUserUpvotes = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('comment_upvotes')
          .select('comment_id')
          .eq('user_id', userId);
        if (!error && data) {
          setUpvotedCommentIds(data.map((u: any) => u.comment_id));
        }
      } catch (err) {
        console.error('Failed to load upvotes:', err);
      }
    };

    const handleAddComment = async (e: React.FormEvent) => {
      e.preventDefault();
      const activeUser = currentUserRef.current;
      if (!activeUser || !viewingSpot?.id || !newCommentText.trim()) return;

      triggerHaptic(10);
      setSubmittingComment(true);

      const { data, error } = await supabase
        .from('spot_comments')
        .insert([{
          spot_id: viewingSpot.id,
          user_id: activeUser.id,
          content: newCommentText.trim(),
          tag: commentTag,
          upvotes: 0,
        }])
        .select();

      if (!error && data && data.length > 0) {
        setSpotComments((prev) => {
          const next = [...prev, data[0] as SpotComment];
          return next.sort((a, b) => {
            const diff = (b.upvotes || 0) - (a.upvotes || 0);
            if (diff !== 0) return diff;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        });
        setNewCommentText('');
      } else {
        const fallbackComment: SpotComment = {
          id: Date.now().toString(),
          spot_id: viewingSpot.id,
          user_id: activeUser.id,
          content: newCommentText.trim(),
          tag: commentTag,
          upvotes: 0,
          created_at: new Date().toISOString(),
        };
        setSpotComments((prev) => [...prev, fallbackComment]);
        setNewCommentText('');
      }
      setSubmittingComment(false);
    };

    const handleDeleteComment = async (commentId: string) => {
      const prevComments = spotComments;
      triggerHaptic(8);
      setDeletingCommentId(commentId);
      setSpotComments((prev) => prev.filter((c) => c.id !== commentId));

      const { error } = await supabase.from('spot_comments').delete().eq('id', commentId);
      if (error) {
        setSpotComments(prevComments);
        showToast('Could not delete that note. Try again.', 'error');
      }
      setDeletingCommentId(null);
    };

    const handleUpvoteComment = async (commentId: string) => {
      const activeUser = currentUserRef.current;
      if (!activeUser) {
        setIsAuthModalOpen(true);
        pushModalHistoryState('auth');
        return;
      }

      triggerHaptic(6);
      const isUpvoted = upvotedCommentIds.includes(commentId);

      if (isUpvoted) {
        const { error } = await supabase.from('comment_upvotes').delete().eq('user_id', activeUser.id).eq('comment_id', commentId);
        if (!error) {
          setUpvotedCommentIds((prev) => prev.filter((id) => id !== commentId));
          setSpotComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, upvotes: Math.max(0, (c.upvotes || 1) - 1) } : c)));
          const target = spotComments.find(c => c.id === commentId);
          if (target) {
            await supabase.from('spot_comments').update({ upvotes: Math.max(0, (target.upvotes || 1) - 1) }).eq('id', commentId);
          }
        }
      } else {
        const { error } = await supabase.from('comment_upvotes').insert([{ user_id: activeUser.id, comment_id: commentId }]);
        if (!error) {
          setUpvotedCommentIds((prev) => [...prev, commentId]);
          setSpotComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, upvotes: (c.upvotes || 0) + 1 } : c)));
          const target = spotComments.find(c => c.id === commentId);
          if (target) {
            await supabase.from('spot_comments').update({ upvotes: (target.upvotes || 0) + 1 }).eq('id', commentId);
          }
        }
      }
    };

    const fetchUserProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, updated_at, created_at, country, bio, is_private, plus_enabled, plus_expires_at, youtube_url, instagram_url, facebook_url, website_url')
    .eq('id', userId)
    .maybeSingle();
        if (!error && data) {
          setUserProfile(data);
          localStorage.setItem('bywayr_user_profile', JSON.stringify(data));

          // Single source of truth: DB decides Plus. Expiry honored if set.
          const notExpired = !data.plus_expires_at || new Date(data.plus_expires_at).getTime() > Date.now();
          const hasPlus = Boolean(data.plus_enabled) && notExpired;

          if (!hasPlus && localStorage.getItem('bywayr_is_plus') === 'true') {
            // Server says no Plus but localStorage claims it â€” probable tampering, correct it
            console.warn('Plus entitlement mismatch: local flag cleared');
          }

          setIsPlusSubscriber(hasPlus);
          if (hasPlus) {
            localStorage.setItem('bywayr_is_plus', 'true');
            plusValidatedRef.current = true;
          } else {
            localStorage.removeItem('bywayr_is_plus');
          }
          if (!data.username) {
            setIsClaimUsernameModalOpen(true);
            pushModalHistoryState('claimUsername');
          }
        } else if (!data) {
          setIsClaimUsernameModalOpen(true);
          pushModalHistoryState('claimUsername');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };

    const handleUpdateCountry = async (newCountry: string) => {
      const activeUser = currentUserRef.current;
      if (!activeUser || !newCountry.trim()) return;

      setSavingCountry(true);
      triggerHaptic(10);
      const cleaned = newCountry.trim();

      const { error } = await supabase.from('profiles').upsert({
        id: activeUser.id,
        country: cleaned,
        updated_at: new Date().toISOString(),
      });

      if (!error) {
        const updated = { ...userProfile, id: activeUser.id, country: cleaned };
        setUserProfile(updated);
        localStorage.setItem('bywayr_user_profile', JSON.stringify(updated));
        setIsEditingCountry(false);
        fetchProfiles();
      }
      setSavingCountry(false);
    };

    const handleSaveProfileEdits = async (e: React.FormEvent) => {
      e.preventDefault();
      const activeUser = currentUserRef.current;
      if (!activeUser) return;

      const cleanUsername = editUsernameValue.trim().toLowerCase();
      if (cleanUsername !== (userProfile?.username || '').toLowerCase()) {
        if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
          setEditProfileError('Username must be 3-20 characters (letters, numbers, underscores).');
          return;
        }
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', cleanUsername)
          .maybeSingle();
        if (existing && existing.id !== activeUser.id) {
          setEditProfileError('That username is already taken.');
          return;
        }
      }

      const cleanBio = editBioValue.trim().slice(0, 140);
      setEditProfileError('');
      setSavingProfile(true);
      triggerHaptic(10);

      const cleanCountry = editCountryValue.trim() || userProfile?.country || 'United States';
      const cleanYoutube = editYoutubeUrl.trim() || null;
      const cleanInstagram = editInstagramUrl.trim() || null;
      const cleanFacebook = editFacebookUrl.trim() || null;
      const cleanWebsite = editWebsiteUrl.trim() || null;
      const { error } = await supabase.from('profiles').upsert({
        id: activeUser.id,
        username: cleanUsername,
        bio: cleanBio || null,
        country: cleanCountry,
        youtube_url: cleanYoutube,
        instagram_url: cleanInstagram,
        facebook_url: cleanFacebook,
        website_url: cleanWebsite,
        updated_at: new Date().toISOString(),
      });

      if (!error) {
                const updated: UserProfile = {
          ...userProfile,
          id: activeUser.id,
          username: cleanUsername,
          bio: cleanBio,
          country: cleanCountry,
          youtube_url: cleanYoutube || undefined,
          instagram_url: cleanInstagram || undefined,
          facebook_url: cleanFacebook || undefined,
          website_url: cleanWebsite || undefined,
        };
        setUserProfile(updated);
        localStorage.setItem('bywayr_user_profile', JSON.stringify(updated));
        setIsEditProfileOpen(false);
        fetchProfiles();
        showToast('Profile updated');
      } else {
        setEditProfileError(error.message);
      }
      setSavingProfile(false);
    };

    const fetchProfiles = async () => {
      try {
        const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, updated_at, created_at, country, bio, is_private, plus_enabled, plus_expires_at, youtube_url, instagram_url, facebook_url, website_url');
        if (!error && data) {
          const map: Record<string, UserProfile> = {};
          data.forEach((p: UserProfile) => {
            if (p.id) map[p.id] = p;
          });
          setProfilesMap(map);
        }
      } catch (err) {
        console.error('Failed to load profiles map:', err);
      }
    };

    const fetchVotes = async (userId?: string) => {
      try {
        const { data: allVotes, error } = await supabase.from('spot_votes').select('spot_id, user_id, vote_type');
        if (!error && allVotes) {
          const counts: Record<string, { up: number; down: number }> = {};
          const mine: Record<string, 'up' | 'down'> = {};
          allVotes.forEach((v: { spot_id: string; user_id: string; vote_type: 'up' | 'down' }) => {
            if (!counts[v.spot_id]) counts[v.spot_id] = { up: 0, down: 0 };
            if (v.vote_type === 'down') counts[v.spot_id].down += 1;
            else counts[v.spot_id].up += 1;
            if (userId && v.user_id === userId) {
              mine[v.spot_id] = v.vote_type;
            }
          });
          setVoteCounts(counts);
          setMyVotes(mine);
        }
      } catch (err) {
        console.error('Failed to load votes:', err);
      }
    };

    useEffect(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const user = session?.user ?? null;
        setCurrentUser(user);
        currentUserRef.current = user;
        if (user) {
          fetchUserUpvotes(user.id);
        }
        setAuthLoading(false);
      }).catch(() => {
        setAuthLoading(false);
      });

      if (Capacitor.isNativePlatform()) {
        CapApp.addListener('appUrlOpen', async ({ url }) => {
          if (url && url.includes('auth-callback')) {
            try {
              await supabase.auth.exchangeCodeForSession(url);
            } catch (err) {
              console.error('Deep link auth error:', err);
            }
          }
        });

        // Native Android Hardware & Gesture Back Button Handler
        CapApp.addListener('backButton', ({ canGoBack }) => {
          if (activeOverlayRef.current) {
            closeTopmostSheet();
          } else {
            const now = Date.now();
            if (now - lastBackPressTime.current < 2000) {
              setShowExitToast(false);
              CapApp.exitApp();
            } else {
              lastBackPressTime.current = now;
              triggerHaptic(8);
              triggerExitToast();
            }
          }
        });
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        const user = session?.user ?? null;
        setAuthLoading(false);
        if (event === 'SIGNED_IN' && user) {
          setIsAuthModalOpen(false);
          setCurrentUser(user);
          currentUserRef.current = user;
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          currentUserRef.current = null;
          setUserProfile(null);
          localStorage.removeItem('bywayr_user_profile');
          localStorage.removeItem('bywayr_is_plus');
          setIsPlusSubscriber(false);
          setIsProfileModalOpen(false);
          setViewingSpot(null);
          setMyVotes({});
          setUpvotedCommentIds([]);
        }
      });

      return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
      fetchSpots();
      fetchProfiles();
      fetchVotes(currentUser?.id);
      if (currentUser?.id) {
        fetchMustTryBookmarks(currentUser.id);
        fetchUserProfile(currentUser.id);
        fetchUserUpvotes(currentUser.id);
        getUserCustomCategories()
          .then((cats) => setCustomCategories(cats))
          .catch((err) => console.error('Failed to fetch custom categories:', err));
      } else {
        setMustTrySpotIds([]);
        setMyVotes({});
        setUpvotedCommentIds([]);
        setUserProfile(null);
        setCustomCategories([]);
      }
    }, [currentUser]);

    const renderStampCard = (st: PassportStampData, idx: number, page: number) => {
      const d = new Date(st.firstVisit || Date.now());
      const day = d.toLocaleDateString('en-US', { day: '2-digit' });
      const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const year = d.getFullYear();
      const tier = getStampTier(st.spotCount);
      const tilts = [-4.5, 3.8, 4.0, -3.5];
      const tiltAngle = tilts[idx % 4];

      return (
        <div
          key={`${page}-stamp-${idx}`}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', maxWidth: '100%' }}
        >
          <div
            className={`passport-stamp-cachet ${tier === 'gold' ? 'stamp-tier-gold' : tier === 'silver' ? 'stamp-tier-silver' : ''}`}
            onClick={() => {
              if (typeof isStampDragging !== 'undefined' && isStampDragging) return;
              triggerHaptic(12);
              setSelectedCountryFilter(st.country);
              const matchingSpots = spots.filter(
                (s) => (s.country || '').toLowerCase() === st.country.toLowerCase()
              );
              dismissModalWithHistory(handleClosePassportBook);
              setTimeout(() => focusMapOnCountry(map.current, matchingSpots), 300);
            }}
            style={{
              width: isDesktopViewport ? '104px' : '122px',
              height: isDesktopViewport ? '104px' : '122px',
              cursor: 'pointer',
              transform: `rotate(${tiltAngle}deg)`,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.05))',
              mixBlendMode: 'multiply',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
            }}
          >
            <svg viewBox="0 0 140 140" width="100%" height="100%" style={{ overflow: 'visible' }}>
              <defs>
                <path id={`arc-top-${page}-${idx}`} d="M 22 70 A 48 48 0 0 1 118 70" fill="none" />
                <path id={`arc-bot-${page}-${idx}`} d="M 118 70 A 48 48 0 0 1 22 70" fill="none" />
              </defs>
              <circle cx="70" cy="70" r="64" fill="#fffdfa" stroke={st.color} strokeWidth="3.2" />
              <circle cx="70" cy="70" r="57" fill="none" stroke={st.color} strokeWidth="1.3" strokeDasharray="3 2" />
              <text fill={st.color} fontSize={st.country.length > 12 ? '9.5' : '11'} fontWeight="900" letterSpacing="0.12em">
                <textPath href={`#arc-top-${page}-${idx}`} startOffset="50%" textAnchor="middle">
                  ✦ {st.country.toUpperCase()} ✦
                </textPath>
              </text>
              <text fill={st.color} fontSize="8" fontWeight="800" letterSpacing="0.15em" opacity="0.85">
                <textPath href={`#arc-bot-${page}-${idx}`} startOffset="50%" textAnchor="middle">
                  • ENTRY · IMMIGRATION •
                </textPath>
              </text>
              <g transform="translate(70, 70) rotate(45) scale(3.5) translate(-9, -11)" opacity="0.12">
                <path
                  d="M2 10 L10 2 L13 3 L9 9 L15 10 L17 8 L18 9 L16 12 L18 15 L17 16 L15 14 L9 15 L13 21 L10 22 L2 14 L0 12 Z"
                  fill={st.color}
                />
              </g>
              <rect x="20" y="55" width="100" height="30" rx="5" fill="#fffdfa" stroke={st.color} strokeWidth="1.6" />
              <text x="70" y="74.5" textAnchor="middle" fill={st.color} fontSize="12" fontWeight="900" fontFamily="monospace" letterSpacing="0.08em">
                {day} {month} {year}
              </text>
            </svg>
          </div>

          <span
            style={{
              fontSize: '8.5px',
              fontWeight: 700,
              color: tier === 'gold' ? '#b45309' : tier === 'silver' ? '#475569' : '#8c8273',
              letterSpacing: '0.04em',
              fontFamily: 'monospace',
              opacity: 0.9,
            }}
          >
            {st.spotCount} {st.spotCount === 1 ? 'pin' : 'pins'}{tier === 'gold' ? ' · gold' : tier === 'silver' ? ' · silver' : ''}
          </span>
        </div>
      );
    };

    const renderUnclaimedSlot = (idx: number, page: number) => (
      <div
        key={`unclaimed-${page}-${idx}`}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', maxWidth: '100%' }}
      >
        <div
          style={{
            width: isDesktopViewport ? '104px' : '122px',
            height: isDesktopViewport ? '104px' : '122px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.35,
          }}
        >
          <svg viewBox="0 0 140 140" width="100%" height="100%">
            <circle cx="70" cy="70" r="62" fill="none" stroke="#8c8273" strokeWidth="1.6" strokeDasharray="4 3" />
            <text x="70" y="65" textAnchor="middle" fill="#57534e" fontSize="8.5" fontWeight="800" letterSpacing="0.2em">
              UNCLAIMED
            </text>
            <text x="70" y="86" textAnchor="middle" fill="#8c8273" fontSize="18">
              ✈
            </text>
          </svg>
        </div>
        <span style={{ fontSize: '8.5px', fontWeight: 600, color: 'transparent', fontFamily: 'monospace', userSelect: 'none' }}>
          empty
        </span>
      </div>
    );

    const renderSponsoredPassportStamp = (idx: number) => (
      <a
        key={`sponsored-stamp-${idx}`}
        href="https://aviasales.tpk.lv/Y7mdLlKw"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          maxWidth: '100%',
          textDecoration: 'none',
        }}
      >
        <div
          className="passport-stamp-cachet"
          style={{
            width: isDesktopViewport ? '104px' : '122px',
            height: isDesktopViewport ? '104px' : '122px',
            cursor: 'pointer',
            transform: 'rotate(-2.5deg)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.05))',
            mixBlendMode: 'multiply',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 140 140" width="100%" height="100%">
            <circle cx="70" cy="70" r="64" fill="#fffdfa" stroke="#0284c7" strokeWidth="3" />
            <circle cx="70" cy="70" r="57" fill="none" stroke="#0284c7" strokeWidth="1.2" strokeDasharray="3 2" />
            <text x="70" y="48" textAnchor="middle" fill="#0284c7" fontSize="9" fontWeight="900" letterSpacing="0.12em">
              ✦ SPONSORED ✦
            </text>
            <text x="70" y="74" textAnchor="middle" fill="#0284c7" fontSize="11" fontWeight="900" fontFamily="sans-serif">
              FLIGHT DEALS
            </text>
            <text x="70" y="98" textAnchor="middle" fill="#0284c7" fontSize="7.5" fontWeight="800" letterSpacing="0.1em">
              VIA AVIASALES ↗
            </text>
          </svg>
        </div>
        <span
          style={{
            fontSize: '8.5px',
            fontWeight: 700,
            color: '#0284c7',
            letterSpacing: '0.04em',
            fontFamily: 'monospace',
            opacity: 0.9,
          }}
        >
          partner stamp
        </span>
      </a>
    );

    useEffect(() => {
      if (!isPassportBookOpen) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') {
          triggerHaptic(6);
          setPassportBookPage((p) => Math.max(0, p - 1));
        } else if (e.key === 'ArrowRight') {
          const stampsPerPage = 4;
          const totalPages = Math.max(1, Math.ceil(myPassportStamps.length / stampsPerPage));
          triggerHaptic(6);
          setPassportBookPage((p) => Math.min(totalPages - 1, p + 1));
        } else if (e.key === 'Escape') {
          handleClosePassportBook();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPassportBookOpen, isDesktopViewport, myPassportStamps.length]);

    // Deep Link Auto-Focus: open ?spot=ID shared links automatically
    useEffect(() => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const spotId = params.get('spot');
      if (!spotId) return;
      let cancelled = false;

      const openSharedSpot = (spot: Spot) => {
        if (!map.current || !spot.latitude || !spot.longitude) return;
        map.current.flyTo({ center: [spot.longitude, spot.latitude], zoom: 16, essential: true });
        setViewingSpot(spot);
        setActiveSearchedSpot(null);
        setIsDiscussionModalOpen(false);
        if (previewMarkerRef.current) {
          previewMarkerRef.current.remove();
          previewMarkerRef.current = null;
        }
      };

      const loadAndOpen = async () => {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 400);
        });
        if (cancelled) return;

        const existing = spots.find((s: Spot) => String(s.id) === String(spotId));
        if (existing) {
          if (map.current) {
            openSharedSpot(existing);
          } else {
            const interval = setInterval(() => {
              if (cancelled) {
                clearInterval(interval);
                return;
              }
              if (map.current) {
                clearInterval(interval);
                openSharedSpot(existing);
              }
            }, 100);
          }
          return;
        }

        const { data } = await supabase.from('spots').select('*').eq('id', spotId).maybeSingle();
        if (cancelled || !data) return;
        const sanitized = sanitizeCountryAndCity(data.city, data.country || '');
        const spotObj = {
          ...(data as Spot),
          city: sanitized.city,
          country: sanitized.country,
        };

        const waitForMap = setInterval(() => {
          if (cancelled) {
            clearInterval(waitForMap);
            return;
          }
          if (map.current) {
            clearInterval(waitForMap);
            openSharedSpot(spotObj);
          }
        }, 100);
      };

      loadAndOpen();
      window.history.replaceState(null, '', window.location.pathname);

      return () => {
        cancelled = true;
      };
    }, [spots]);

    // Deep Link Auto-Focus: open ?curator=ID shared Field Journal links automatically
    useEffect(() => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const curatorId = params.get('curator');
      if (!curatorId) return;
      let cancelled = false;

      const openCurator = async () => {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 500);
        });
        if (cancelled) return;

        const { data: profileData } = await supabase
          .from('profiles')
                  .select('id, username, full_name, avatar_url, updated_at, created_at, country, bio, is_private, plus_enabled, plus_expires_at, youtube_url, instagram_url, facebook_url, website_url')
          .eq('id', curatorId)
          .maybeSingle();
        if (cancelled || !profileData) return;

        const { data: spotData } = await supabase
          .from('spots')
          .select('*')
          .eq('user_id', curatorId)
          .order('id', { ascending: false });

        const sanitized = (spotData || []).map((s: Spot) => {
          const clean = sanitizeCountryAndCity(s.city, s.country || '');
          return { ...s, city: clean.city, country: clean.country };
        });

        setViewingProfile(profileData as UserProfile);
        setViewingProfileSpots(sanitized);
        setProfileCityFilter('All');
        setActiveSearchedSpot(null);
        setViewingSpot(null);
        pushModalHistoryState('publicProfile');

        // Also center the map roughly on their territory so the backdrop isn't empty
        if (sanitized.length > 0 && map.current) {
          const bounds = sanitized.reduce(
            (b, s) => b.extend([s.longitude, s.latitude]),
            new maplibregl.LngLatBounds(
              [sanitized[0].longitude, sanitized[0].latitude],
              [sanitized[0].longitude, sanitized[0].latitude]
            )
          );
          map.current.fitBounds(bounds, { padding: 80, maxZoom: 12, duration: 0 });
        }
      };

      openCurator();
      window.history.replaceState(null, '', window.location.pathname);

      return () => {
        cancelled = true;
      };
    }, []);

    // Render All Pinned Locations as DOM Markers without animation jump
    useEffect(() => {
      if (!map.current || !mapReady) return;

      spotMarkersRef.current.forEach((m) => m.remove());
      spotMarkersRef.current = [];

      const validSpots: Spot[] = filteredSpots.filter((s: Spot) => {
        const lat = Number(s.latitude);
        const lng = Number(s.longitude);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });

      validSpots.forEach((spot: Spot) => {
        const pinColor = resolveCategoryColor(spot.category || 'Hidden Gems');
        const pinEl = document.createElement('div');
        pinEl.className = 'bywayr-map-pin';
        pinEl.style.cursor = 'pointer';
        pinEl.style.zIndex = '10';
        pinEl.style.display = 'flex';
        pinEl.style.flexDirection = 'column';
        pinEl.style.alignItems = 'center';
        pinEl.innerHTML = `
          <div style="width: 28px; height: 38px; position: relative; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35)); cursor: pointer;">
            <svg width="28" height="38" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 0C7.163 0 0 7.163 0 16C0 26.5 16 42 16 42C16 42 32 26.5 32 16C32 7.163 24.837 0 16 0Z" fill="${pinColor}"/>
              <circle cx="16" cy="15" r="7" fill="white"/>
              <circle cx="16" cy="15" r="3.5" fill="${pinColor}"/>
            </svg>
          </div>
        `;
        pinEl.addEventListener('click', (e) => {
          e.stopPropagation();
          triggerHaptic(8);
          setViewingSpot(spot);
          pushModalHistoryState('viewingSpot');
        });

        const marker = new maplibregl.Marker({ element: pinEl, anchor: 'bottom' })
          .setLngLat([Number(spot.longitude), Number(spot.latitude)])
          .addTo(map.current!);

        spotMarkersRef.current.push(marker);
      });
    }, [filteredSpots, mapReady, resolveCategoryColor]);
    // Apply map tile filter to canvas only, so markers keep true brand colors

    // Consolidated Single Geolocation Watcher (Battery & Thread Efficient)
    useEffect(() => {
      if (!navigator.geolocation) return;
      if (showWelcome || isOnboardingExiting) return;

      const NEARBY_RADIUS_M = 500;
      const THROTTLE_MS = 30000;

      const toRad = (d: number) => (d * Math.PI) / 180;
      const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * 6371000 * Math.asin(Math.sqrt(a));
      };

      const checkNearbyNotifications = async (lat: number, lng: number) => {
        if (typeof window === 'undefined' || !(window as any).Capacitor?.isNativePlatform()) return;
        if (Date.now() - lastNearbyCheckRef.current < THROTTLE_MS) return;
        lastNearbyCheckRef.current = Date.now();

        const nearby = spots.filter(
          (s) =>
            typeof s.id === 'string' &&
            !notifiedSpotIdsRef.current.has(s.id) &&
            haversineM(lat, lng, s.latitude, s.longitude) <= NEARBY_RADIUS_M
        );

        if (nearby.length === 0) return;

        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          const perm = await LocalNotifications.requestPermissions();
          if (perm.display !== 'granted') return;

          const closest = nearby.sort(
            (a, b) => haversineM(lat, lng, a.latitude, a.longitude) - haversineM(lat, lng, b.latitude, b.longitude)
          )[0];

          const extras = nearby.length > 1 ? ` (+${nearby.length - 1} more nearby)` : '';

          await LocalNotifications.schedule({
            notifications: [
              {
                id: Math.abs((closest.id ?? '').split('').reduce((acc: number, ch: string) => (acc * 31 + ch.charCodeAt(0)) % 2147483647, 7)),
                title: 'Hidden gem nearby',
                body: `${closest.name}${extras}`,
                schedule: { at: new Date(Date.now() + 100) },
                actionTypeId: '',
                extra: { spotId: closest.id ?? '' },
              },
            ],
          });

          nearby.forEach((s) => { if (typeof s.id === 'string') notifiedSpotIdsRef.current.add(s.id); });
        } catch (err) {
          console.error('Nearby notification failed:', err);
        }
      };

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;

          // 1. Proximity Alert (Within 100m of a saved Must-Try)
          if (mustTrySpotIds.length > 0) {
            const nearbyMustTry = spots.find((spot) => {
              if (!spot.id || !mustTrySpotIds.includes(spot.id)) return false;
              if (dismissedAlertIds.includes(spot.id)) return false;
              if (activeProximityAlert?.id === spot.id) return false;
              return getDistanceFromLatLonInKm(latitude, longitude, spot.latitude, spot.longitude) <= 0.1;
            });

            if (nearbyMustTry) {
              triggerHaptic(25);
              setActiveProximityAlert(nearbyMustTry);
            }
          }

          // 2. Throttled Native Foreground Push Notifications
          checkNearbyNotifications(latitude, longitude);
        },
        (err) => console.error('Geolocation watch error:', err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }, [spots, mustTrySpotIds, dismissedAlertIds, activeProximityAlert, showWelcome, isOnboardingExiting]);

    useEffect(() => {
      if (viewingSpot?.id) {
        fetchSpotComments(viewingSpot.id);
      }
    }, [viewingSpot]);

    // Native deep-link listener: parse tokens when Google redirects back via bywayr://auth-callback
    useEffect(() => {
      if (!Capacitor.isNativePlatform()) return;

      const listenerPromise = CapApp.addListener('appUrlOpen', async ({ url }: { url: string }) => {
        try {
          if (!url.startsWith('bywayr://auth-callback')) return;
          const hashPart = url.split('#')[1];
          if (!hashPart) return;
          const params = new URLSearchParams(hashPart);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            showToast('Signed in successfully!');
          } else if (params.get('error')) {
            showToast(`Sign-in failed: ${params.get('error_description') || params.get('error')}`);
          }
        } catch (err) {
          console.error('Deep link auth parse failed:', err);
        }
      });

      return () => {
        listenerPromise.then((listener) => listener?.remove()).catch(() => {});
      };
    }, []);

    const handleGoogleSignIn = async () => {
      triggerHaptic(10);
      const isNative = Capacitor.isNativePlatform();
      const redirectTo = isNative
        ? 'bywayr://auth-callback'
        : typeof window !== 'undefined'
          ? window.location.origin
          : undefined;

      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: false,
        },
      });
    };

    const handleMagicLinkSignIn = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!authEmail.trim()) return;

      setIsSendingMagicLink(true);

      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail.trim(),
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });

      if (error) showToast(`Error sending link: ${error.message}`);
      else {
        triggerHaptic(15);
        setMagicLinkSent(true);
      }
      setIsSendingMagicLink(false);
    };

    const handleClaimUsername = async (e: React.FormEvent) => {
      e.preventDefault();
      const activeUser = currentUserRef.current;
      if (!activeUser) return;

      const clean = claimUsername.trim().toLowerCase();
      if (clean.length < 3 || clean.length > 20 || !/^[a-z0-9_]{3,20}$/.test(clean)) {
        setClaimUsernameError('Username must be 3-20 characters (letters, numbers, underscores).');
        return;
      }

      setIsSavingUsername(true);
      setClaimUsernameError('');

      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', clean)
        .maybeSingle();

      if (existing && existing.id !== activeUser.id) {
        setClaimUsernameError('That username is already taken.');
        setIsSavingUsername(false);
        return;
      }

      const { error } = await supabase.from('profiles').upsert({
        id: activeUser.id,
        username: clean,
        country: claimCountry.trim() || userProfile?.country || 'United States',
        updated_at: new Date().toISOString(),
      });

      if (error) {
        setClaimUsernameError(error.message);
        setIsSavingUsername(false);
      } else {
        triggerHaptic(15);
        const updated = { ...userProfile, id: activeUser.id, username: clean, country: claimCountry.trim() || userProfile?.country || 'United States' };
        setUserProfile(updated);
        localStorage.setItem('bywayr_user_profile', JSON.stringify(updated));
        fetchProfiles();
        setProfileSavedAt(Date.now());
        setTimeout(() => {
          setProfileSavedAt(null);
          setIsClaimUsernameModalOpen(false);
        }, 1400);
      }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const activeUser = currentUserRef.current;
      if (!activeUser || !e.target.files || !e.target.files[0]) return;

      const file = e.target.files[0];
      setUploadingAvatar(true);

      try {
        const compressed = await compressImageToWebP(file, 400, 0.85);
        const filePath = `${activeUser.id}-${Date.now()}.webp`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, compressed, { contentType: 'image/webp', upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        const publicUrl = publicUrlData.publicUrl;

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: activeUser.id,
            avatar_url: publicUrl,
            updated_at: new Date().toISOString(),
          });

        if (profileError) throw profileError;

        triggerHaptic(15);
        const updated = { ...userProfile, id: activeUser.id, avatar_url: publicUrl };
        setUserProfile(updated);
        localStorage.setItem('bywayr_user_profile', JSON.stringify(updated));
        fetchProfiles();
      } catch (err: any) {
        showToast(`Avatar upload failed: ${err.message || 'Error uploading file'}`);
      } finally {
        setUploadingAvatar(false);
      }
    };

    const handleSignOut = async () => {
      triggerHaptic(10);
      await supabase.auth.signOut();
      setCurrentUser(null);
      currentUserRef.current = null;
      setMustTrySpotIds([]);
      setMyVotes({});
      setUpvotedCommentIds([]);
      setOnlyMySpots(false);
      setSelectedCountryFilter(null);
      setUserProfile(null);
      localStorage.removeItem('bywayr_user_profile');
      setIsProfileModalOpen(false);
      setIsClaimUsernameModalOpen(false);
    };

    const handleStripeCheckout = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '';
        const res = await fetchWithRetry(`${apiBase}/api/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser?.id,
            email: currentUser?.email,
            returnUrl: window.location.origin,
          }),
        });
        const data = await res.json();
        if (data?.url) {
          window.location.href = data.url;
        } else {
          showToast(data?.error || 'Could not initialize web checkout.');
        }
      } catch (err) {
        console.error('Checkout error:', err);
        showToast('Failed to start checkout. Please try again.');
      }
    };

    const handleGooglePlayCheckout = async () => {
      if (!currentUser) {
        setIsAuthModalOpen(true);
        pushModalHistoryState('auth');
        return;
      }

      try {
        triggerHaptic(12);

        if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
          const { NativePurchases: Purchases, PURCHASE_TYPE } = (await import('@capgo/native-purchases')) as any;
          const purchaseResult = await Purchases.purchaseProduct({
            productIdentifier: 'bywayr_plus_lifetime',
            productType: PURCHASE_TYPE.INAPP,
          });

          const tx = purchaseResult?.transaction;
          const purchaseToken = tx?.purchaseToken || tx?.token || null;

          let serverVerified = false;
          if (purchaseToken) {
            try {
              const verifyRes = await fetchWithRetry('https://bywayr-api.vercel.app/api/play-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  purchaseToken,
                  userId: currentUser.id,
                  productId: 'bywayr_plus_lifetime' 
                }),
              });
              const verifyJson = await verifyRes.json();
              serverVerified = verifyJson?.verified === true;
            } catch (verifyErr) {
              console.warn('Server verification unreachable:', verifyErr);
            }
          }

          if ((purchaseResult && purchaseResult.product?.identifier === 'bywayr_plus_lifetime') || tx) {
            if (serverVerified) {
              setIsPlusSubscriber(true);
              localStorage.setItem('bywayr_is_plus', 'true');
              setIsPlusModalOpen(false);
              showToast('Thank you for upgrading to Bywayr Plus! 👑');
            } else {
              showToast('Verifying subscription… please check Restore in a moment');
            }
          }
        } else {
          handleStripeCheckout();
        }
      } catch (err: any) {
        console.error('Subscription purchase failed:', err);
        if (err.message && !err.message.includes('Canceled') && !err.message.includes('cancel')) {
          showToast(`Purchase error: ${err.message}`);
        }
      }
    };

    const handleRestorePurchases = async () => {
      try {
        triggerHaptic(8);

        if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
          const { NativePurchases: Purchases } = (await import('@capgo/native-purchases')) as any;
          const restored = await Purchases.restorePurchases();
          const entitlements = restored?.customerInfo?.entitlements || {};
          const hasPlus =
            'bywayr_plus_lifetime' in entitlements ||
            Object.keys(entitlements).length > 0 ||
            restored?.transactions?.some(
              (tx: any) => tx.productId === 'bywayr_plus_lifetime' || tx.productIdentifier === 'bywayr_plus_lifetime'
            );

          if (hasPlus) {
            setIsPlusSubscriber(true);
            localStorage.setItem('bywayr_is_plus', 'true');
            showToast('Purchases restored successfully!');
            setIsPlusModalOpen(false);
          } else {
            showToast('No previous Bywayr Plus purchases found');
          }
        } else {
          showToast('Available in the Android app');
        }
      } catch (err: any) {
        showToast(`Restore failed: ${err.message}`);
      }
    };

    const handleExportJournal = () => {
      const activeUser = currentUserRef.current;
      if (!activeUser) return;

      triggerHaptic(12);
      const exportPayload = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        user_id: activeUser.id,
        spots: myUserSpots,
        mustTryIds: mustTrySpotIds,
        profile: userProfile,
      };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bywayr_backup_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Journal exported to your device 📥');
    };

    const handleImportJournal = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      triggerHaptic(12);
      setDriveStatusMessage('Restoring backup from file...');

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);

          if (!parsed.spots || !Array.isArray(parsed.spots)) {
            throw new Error('Invalid backup file structure.');
          }

          const activeUser = currentUserRef.current;
          if (!activeUser) throw new Error('You must be signed in to restore spots.');

          const keyFor = (spot: any) =>
            `${String(spot.name).toLowerCase().trim()}|${Number(spot.latitude).toFixed(5)},${Number(spot.longitude).toFixed(5)}`;
          const existingKeys = new Set(
            spots
              .filter((s: Spot) => s.user_id === activeUser.id)
              .map((s) => keyFor(s))
          );
          const toInsert = parsed.spots.filter((spot: any) => !existingKeys.has(keyFor(spot)));

          let restoredCount = 0;
          if (toInsert.length > 0) {
            const { error } = await supabase.from('spots').insert(
              toInsert.map((spot: any) => ({
                name: spot.name,
                category: spot.category,
                city: spot.city,
                country: spot.country || 'United States',
                description: spot.description,
                latitude: spot.latitude,
                longitude: spot.longitude,
                image_url: spot.image_url || null,
                user_id: activeUser.id,
              }))
            );
            if (error) throw error;
            restoredCount = toInsert.length;
          }

          if (Array.isArray(parsed.mustTryIds) && parsed.mustTryIds.length > 0) {
            setMustTrySpotIds((prev) => Array.from(new Set([...prev, ...parsed.mustTryIds])));
          }

          await fetchSpots();
          setDriveStatusMessage(`Restored ${restoredCount} spots (${parsed.spots.length - restoredCount} already existed)`);
          setTimeout(() => setDriveStatusMessage(null), 4000);
        } catch (err: any) {
          setDriveStatusMessage(`Restore failed: ${err.message || 'Corrupted backup file'}`);
          setTimeout(() => setDriveStatusMessage(null), 6000);
        } finally {
          e.target.value = '';
        }
      };
      reader.onerror = () => {
        setDriveStatusMessage(null);
      };
      reader.readAsText(file);
    };

    const handleExportGpx = () => {
      const activeUser = currentUserRef.current;
      if (!activeUser || myUserSpots.length === 0) {
        showToast('No pins to export yet');
        return;
      }

      triggerHaptic(12);
      const escapeXml = (str: string = '') =>
        str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');

      const wptXml = myUserSpots.map((s) => {
        const cdata = (v?: string) => `<![CDATA[${(v || '').replace(/]]>/g, ']]&gt;')}]]>`;
        return `  <wpt lat="${s.latitude}" lon="${s.longitude}">
      <name>${escapeXml(s.name)}</name>
      <desc>${cdata(`${s.category} · ${s.city}${s.description ? ' — ' + s.description : ''}`)}</desc>
    </wpt>`;
      }).join('\n');

      const gpx = `<?xml version="1.0" encoding="UTF-8"?>
  <gpx version="1.1" creator="Bywayr" xmlns="http://www.topografix.com/GPX/1/1">
    <metadata>
      <name>Bywayr Field Journal</name>
      <desc>Exported from Bywayr — your data, your device.</desc>
    </metadata>
  ${wptXml}
  </gpx>`;

      const blob = new Blob([gpx], { type: 'application/gpx+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bywayr_pins_${Date.now()}.gpx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Pins exported as GPX 🗺️');
    };

    const handleDeleteAccount = async () => {
      const activeUser = currentUserRef.current;
      if (!activeUser || deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;

      setIsDeletingAccount(true);
      try {
        await supabase.from('bookmarks').delete().eq('user_id', activeUser.id);
        await supabase.from('spot_votes').delete().eq('user_id', activeUser.id);
        await supabase.rpc('delete_user');
      } catch (err) {
        console.error('Account deletion cleanup error:', err);
      } finally {
        await supabase.auth.signOut();
        setCurrentUser(null);
        currentUserRef.current = null;
        setUserProfile(null);
        setMustTrySpotIds([]);
        setMyVotes({});
        setUpvotedCommentIds([]);
        localStorage.removeItem('bywayr_user_profile');
        setIsDeleteAccountModalOpen(false);
        setIsProfileModalOpen(false);
        setIsDeletingAccount(false);
      }
    };

    useEffect(() => {
      if (map.current || !mapContainer.current) return;

      let initialCenter: [number, number] = [-115.1398, 36.1699];
      let initialZoom = 13.5;

      try {
        const savedCenterStr = localStorage.getItem('bywayr_map_center');
        const savedZoomStr = localStorage.getItem('bywayr_map_zoom');
        if (savedCenterStr) initialCenter = JSON.parse(savedCenterStr);
        if (savedZoomStr) initialZoom = parseFloat(savedZoomStr);
      } catch {}

      const primaryCartoTiles = [
        'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_3fj4_2_ed95527311486a2cc01fd417',
      ];
      const fallbackOsmTiles = [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      ];

      const initializedMap = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: primaryCartoTiles,
              tileSize: 256,
              attribution: '© OpenStreetMap contributors © CARTO',
            },
          },
          layers: [
            {
              id: 'osm-layer',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: initialCenter,
        zoom: initialZoom,
      });

      // Active probe: Test CARTO reachability; switch to OSM fallback if unreachable
      fetch('https://basemaps.cartocdn.com/rastertiles/voyager/0/0/0.png?key=cb1_3fj4_2_ed95527311486a2cc01fd417', { method: 'HEAD' })
        .then((res) => {
          if (!res.ok) {
            const src = initializedMap.getSource('osm-tiles') as any;
            if (src && typeof src.setTiles === 'function') {
              src.setTiles(fallbackOsmTiles);
            }
          }
        })
        .catch(() => {
          const src = initializedMap.getSource('osm-tiles') as any;
          if (src && typeof src.setTiles === 'function') {
            src.setTiles(fallbackOsmTiles);
          }
        });

      // Non-passive touch listeners removed for Android WebView
      let moveEndTimeout: any = null;
      initializedMap.on('moveend', () => {
        if (moveEndTimeout) clearTimeout(moveEndTimeout);
        moveEndTimeout = setTimeout(() => {
          const center = initializedMap.getCenter();
          const zoom = initializedMap.getZoom();
          try {
            localStorage.setItem('bywayr_map_center', JSON.stringify([center.lng, center.lat]));
            localStorage.setItem('bywayr_map_zoom', zoom.toString());
          } catch {}
        }, 350);
      });

      initializedMap.on('load', () => {
        initializedMap.resize();
        setMapReady(true);
        const hasSavedPosition = localStorage.getItem('bywayr_map_center');
        const hasSeenWelcome = localStorage.getItem('bywayr_seen_welcome');
        if (navigator.geolocation && !window.location.search.includes('spot=') && !hasSavedPosition && hasSeenWelcome) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              setUserCoords({ lat: latitude, lng: longitude });
              initializedMap.jumpTo({ center: [longitude, latitude], zoom: 15 });

              if (userLocationMarkerRef.current) {
                userLocationMarkerRef.current.setLngLat([longitude, latitude]);
              } else {
                const el = document.createElement('div');
                el.style.width = '18px';
                el.style.height = '18px';
                el.style.borderRadius = '50%';
                el.style.backgroundColor = '#e05a47';
                el.style.border = '3.5px solid #ffffff';
                el.style.boxShadow = '0 0 0 0 rgba(224, 90, 71, 0.75)';
                el.className = 'user-location-pulse';

                userLocationMarkerRef.current = new maplibregl.Marker({ element: el })
                  .setLngLat([longitude, latitude])
                  .addTo(initializedMap);
              }
            },
            () => {},
            { enableHighAccuracy: true, timeout: 8000 }
          );
        }
      });

      initializedMap.on('click', (e) => {
        setShowDropdown(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      });

      initializedMap.on('zoomstart', () => {
        lastZoomTimeRef.current = Date.now();
      });
      initializedMap.on('zoomend', () => {
        lastZoomTimeRef.current = Date.now();
      });

      // Desktop-only right click (button === 2). Never triggers on touch or mobile
      initializedMap.on('contextmenu', (e) => {
        e.preventDefault();
        if (Capacitor.isNativePlatform() || (typeof window !== 'undefined' && 'ontouchstart' in window)) {
          return;
        }
        const orig: any = e.originalEvent;
        if (orig && orig.button !== 2) {
          return;
        }
        const { lng, lat } = e.lngLat;
        dropDraggablePreviewPin(lat, lng);
      });

      initializedMap.on('dragstart', () => {
        setShowDropdown(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setIsInteracting(true);
      });
      initializedMap.on('dragend', () => {
        setIsInteracting(false);
      });

      map.current = initializedMap;

      const handleResize = () => initializedMap.resize();
      window.addEventListener('resize', handleResize);

      return () => {
        spotMarkersRef.current.forEach((m) => m.remove());
        spotMarkersRef.current = [];
        if (previewMarkerRef.current) {
          previewMarkerRef.current.remove();
          previewMarkerRef.current = null;
        }
        if (userLocationMarkerRef.current) {
          userLocationMarkerRef.current.remove();
          userLocationMarkerRef.current = null;
        }
        window.removeEventListener('resize', handleResize);
        initializedMap.remove();
        map.current = null;
      };
    }, []);
    // Discovery Hint: Fetch weather & generate contextual suggestion
    useEffect(() => {
      if (!map.current || !userCoords) return;
      if (hintDismissedRef.current) return; // Don't show if dismissed

      let hintTimer: ReturnType<typeof setTimeout> | null = null;

      const fetchAndGenerate = async () => {
        // Use map center (fresh on pan/zoom) instead of stale userCoords
        const center = map.current ? map.current.getCenter() : userCoords;

        // Fetch weather
        const weather = await fetchLocalWeather(center.lat, center.lng);
        setWeatherData(weather);

        // Generate hint
        const hint = getDiscoveryHint(spots, { lat: center.lat, lng: center.lng }, weather);
        if (hint) {
          setDiscoveryHint(hint);

          // Auto-dismiss after 10s (with cancellable timer)
          if (hintTimer) clearTimeout(hintTimer);
          hintTimer = setTimeout(() => {
            setDiscoveryHint(null);
          }, 10000);
        }
      };

      fetchAndGenerate();

      // Refresh hint when the user pans or zooms the map
      const mapInstance = map.current;
      let debounceMoveTimer: ReturnType<typeof setTimeout> | null = null;
      const onMoveEnd = () => {
        if (debounceMoveTimer) clearTimeout(debounceMoveTimer);
        debounceMoveTimer = setTimeout(() => {
          fetchAndGenerate();
        }, 500);
      };
      mapInstance.on('moveend', onMoveEnd);

      return () => {
        if (hintTimer) clearTimeout(hintTimer);
        if (debounceMoveTimer) clearTimeout(debounceMoveTimer);
        mapInstance.off('moveend', onMoveEnd);
      };
    }, [spots, userCoords]); // map ref is stable; spots/coords drive re-runs
  
    return (
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", backgroundColor: isDarkMode ? '#0a0a0a' : '#ecebe7', transition: 'background-color 1.2s cubic-bezier(0.33, 1, 0.68, 1)' }}>
        <style jsx global>{`
  .bywayr-preview-pin .bywayr-pin-drop,
  .bywayr-map-pin .bywayr-pin-drop,
  .bywayr-pin-drop {
    /* No bounce or vertical transform animations on map pins — keeps them strictly locked to ground coordinates */
    animation: none !important;
    transform: none !important;
  }
  .bywayr-map-pin {
    pointer-events: auto;
  }
  .category-desc-fade {
    transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }
          html, body {
            position: fixed;
            inset: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            overscroll-behavior: none;
            touch-action: pan-x pan-y;
            -webkit-tap-highlight-color: transparent;
            user-select: none;
          }
          #__next {
            position: fixed;
            inset: 0;
            overflow: hidden;
            touch-action: pan-x pan-y;
            overscroll-behavior: none;
          }
          .maplibregl-map {
            touch-action: none !important;
            overscroll-behavior: none !important;
          }
          .map-dark-tiles .maplibregl-canvas {
  filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.92) saturate(0.65);
  transition: filter 1.2s cubic-bezier(0.33, 1, 0.68, 1);
}
          .map-light-tiles .maplibregl-canvas {
            filter: sepia(0.06) saturate(0.88) brightness(1.01) hue-rotate(2deg);
            transition: filter 1.2s cubic-bezier(0.33, 1, 0.68, 1);
          }
          input, textarea {
            user-select: text;
            touch-action: manipulation;
          }
          h2, h3, h4 {
            font-family: var(--font-inter), 'Inter', sans-serif;
            font-weight: 700;
            letter-spacing: -0.01em;
          }
          h3 {
            letter-spacing: -0.02em;
          }

          /* Smooth momentum scrolling with rubberband bounce */
          .smooth-bounce-scroll {
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            overscroll-behavior-y: contain !important;
            scroll-behavior: smooth;
          }

          @keyframes stampPress {
            0% { transform: scale(1.6) rotate(-8deg); opacity: 0; filter: blur(4px); }
            60% { transform: scale(0.92) rotate(2deg); opacity: 1; filter: blur(0px); }
            80% { transform: scale(1.05) rotate(-1deg); }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }

          @keyframes springBadge {
            0% { transform: scale(0.7) translateY(12px); opacity: 0; }
            70% { transform: scale(1.08) translateY(-2px); opacity: 1; }
            100% { transform: scale(1) translateY(0); opacity: 1; }
          }

          .animate-stamp-press {
            animation: stampPress 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          }

          .animate-spring-badge {
            animation: springBadge 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          }
          .onboarding-shell {
            width: 100%;
            max-width: 100%;
            background-color: #ffffff;
            display: flex;
            flex-direction: column;
            height: 100dvh;
            box-sizing: border-box;
            border-radius: 0;
            box-shadow: none;
          }
          @media (min-width: 520px) {
            .onboarding-shell {
              max-width: 460px;
              height: min(84vh, 760px);
              border-radius: 28px;
              box-shadow: 0 30px 70px -20px rgba(28, 25, 23, 0.45);
              overflow: hidden;
            }
          }
          /* iOS-grade springy toast & HUD physics */
          @keyframes toastSlideUp {
            0% { transform: translate3d(0, 28px, 0) scale(0.92); opacity: 0; }
            65% { transform: translate3d(0, -3px, 0) scale(1.02); opacity: 1; }
            100% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
          }
          @keyframes toastFadeOut {
            0% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; filter: blur(0px); }
            100% { transform: translate3d(0, 16px, 0) scale(0.95); opacity: 0; filter: blur(4px); }
          }
          @keyframes slideUp {
            from { transform: translate3d(0, 24px, 0); opacity: 0; }
            to { transform: translate3d(0, 0, 0); opacity: 1; }
          }
          @keyframes slideDownOut {
            from { transform: translate3d(0, 0, 0); opacity: 1; }
            to { transform: translate3d(0, 24px, 0); opacity: 0; }
          }
          .animate-toast-in {
            animation: toastSlideUp 0.36s cubic-bezier(0.34, 1.56, 0.64, 1) both;
            will-change: transform, opacity;
          }
          .animate-toast-out {
            animation: toastFadeOut 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            will-change: transform, opacity;
          }
          @keyframes drawerInLeft {
            from { transform: translate3d(-100%, 0, 0); }
            to { transform: translate3d(0, 0, 0); }
          }
          @keyframes drawerOutLeft {
            from { transform: translate3d(0, 0, 0); }
            to { transform: translate3d(-100%, 0, 0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
          @keyframes scaleUp {
            0% { transform: scale3d(0.96, 0.96, 1); opacity: 0; }
            100% { transform: scale3d(1, 1, 1); opacity: 1; }
          }

          .drawer-left-enter {
            animation: drawerInLeft 0.26s cubic-bezier(0.2, 0.9, 0.3, 1) both;
            will-change: transform;
            transform: translate3d(0,0,0);
            backface-visibility: hidden;
          }
          .drawer-left-exit {
            animation: drawerOutLeft 0.18s cubic-bezier(0.4, 0, 1, 1) forwards;
            will-change: transform;
            transform: translate3d(0,0,0);
            backface-visibility: hidden;
          }
          .backdrop-enter {
            animation: fadeIn 0.22s ease-out both;
            will-change: opacity;
            transform: translateZ(0);
          }
          .backdrop-exit {
            animation: fadeOut 0.18s ease-in forwards;
            will-change: opacity;
            transform: translateZ(0);
          }
          .animate-slide-up {
            animation: slideUp 0.25s cubic-bezier(0.2, 0.9, 0.3, 1) both;
            will-change: transform, opacity;
            transform: translate3d(0,0,0);
            backface-visibility: hidden;
          }
          .animate-scale-up {
            animation: scaleUp 0.24s cubic-bezier(0.2, 0.9, 0.3, 1) both;
            will-change: transform, opacity;
            transform: translate3d(0,0,0);
            backface-visibility: hidden;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes gpsRadarPulse {
            0% {
              box-shadow: 0 0 0 0 rgba(224, 90, 71, 0.75);
            }
            70% {
              box-shadow: 0 0 0 16px rgba(224, 90, 71, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(224, 90, 71, 0);
            }
          }
          @keyframes bounceRight {  0% { transform: translateZ(0); }  35% { transform: translateX(-12px) translateZ(0); }  100% { transform: translateZ(0); }}
          @keyframes bounceLeft {  0% { transform: translateZ(0); }  35% { transform: translateX(12px) translateZ(0); }  100% { transform: translateZ(0); }}
          .passport-stamp-cachet {
            cursor: pointer;
            user-select: none;
            transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease;
            position: relative;
          }
          .passport-stamp-cachet:hover {
            transform: translateY(-2px) scale(1.03) !important;
            box-shadow: 0 8px 18px rgba(28, 25, 23, 0.12);
          }
          .passport-stamp-cachet:active {
            transform: scale(0.97) !important;
          }
          .stamp-tier-gold {
            background: radial-gradient(circle at 40% 30%, #fffdf0, #fff8db) !important;
            box-shadow: 0 6px 18px rgba(217, 119, 6, 0.22) !important;
          }
          .stamp-tier-silver {
            background: radial-gradient(circle at 40% 30%, #ffffff, #f1f5f9) !important;
            box-shadow: 0 6px 18px rgba(100, 116, 139, 0.18) !important;
          }
          @keyframes bookPageTurn {
            from { opacity: 0; transform: rotateY(-10deg) translateY(6px) translateZ(0); }
            to { opacity: 1; transform: rotateY(0deg) translateY(0) translateZ(0); }
          }
          .book-page-turn {
            animation: bookPageTurn 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          @keyframes fadeScaleDown {
            from { opacity: 1; transform: scale(1) translateZ(0); }
            to { opacity: 0; transform: scale(0.95) translateY(8px) translateZ(0); }
          }
          .paper-exit {
            animation: fadeScaleDown 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .user-location-pulse {
            animation: gpsRadarPulse 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
            @keyframes onboardingSlideInForward {
    from { transform: translateX(48px) translateZ(0); opacity: 0; }
    to { transform: translateX(0) translateZ(0); opacity: 1; }
  }
  @keyframes onboardingSlideInBack {
    from { transform: translateX(-48px) translateZ(0); opacity: 0; }
    to { transform: translateX(0) translateZ(0); opacity: 1; }
  }
  @keyframes onboardingHintPulse {
    0%, 100% { transform: translateX(0); opacity: 0.85; }
    50% { transform: translateX(5px); opacity: 1; }
  }
  @keyframes onboardingFadeScaleOut {
    from { opacity: 1; transform: scale(1) translateZ(0); }
    to { opacity: 0; transform: scale(1.06) translateZ(0); }
  }
  @keyframes onboardingImgFloat {
    0%, 100% { transform: translateY(0) translateZ(0); }
    50% { transform: translateY(-8px) translateZ(0); }
  }
  .animate-slide-up {
            animation: slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
            will-change: transform, opacity;
            backface-visibility: hidden;
          }
          .animate-fade-in {
            animation: fadeIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
            will-change: opacity;
          }
          .animate-fade-out {
            animation: fadeOut 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            will-change: opacity;
          }
          .animate-scale-up {
            animation: scaleUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
            will-change: transform, opacity;
            backface-visibility: hidden;
          }
          .spot-card-hover {
            transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.15s ease;
          }
          .spot-card-hover:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(28, 25, 23, 0.08);
          }
          button, a {
            touch-action: manipulation;
            transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 0.15s ease, box-shadow 0.15s ease;
          }
          button:active, a:active {
            transform: scale(0.96);
          }
        `}</style>

        {/* Mobile-Only Splash Screen */}
        {showSplash && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100050,
              backgroundColor: isDarkMode ? '#121110' : '#fbf8f2',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: splashFading ? 0 : 1,
              transition: 'opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: splashFading ? 'none' : 'auto',
            }}
          >
            <div style={{ width: '92px', height: '92px', animation: 'scaleUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
              <svg width="100%" height="100%" viewBox="0 0 512 512" fill="none">
                <defs>
                  <linearGradient id="pinBase" x1="256" y1="64" x2="256" y2="448" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#ea5e4b" />
                    <stop offset="100%" stopColor="#c94432" />
                  </linearGradient>
                  <linearGradient id="softGloss" x1="210" y1="70" x2="256" y2="240" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
                    <stop offset="60%" stopColor="#ffffff" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                  <radialGradient id="dropShadow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(28, 25, 23, 0.22)" />
                    <stop offset="100%" stopColor="rgba(28, 25, 23, 0)" />
                  </radialGradient>
                </defs>
                <ellipse cx="256" cy="460" rx="44" ry="10" fill="url(#dropShadow)" />
                <path d="M256 64C170.95 64 102 132.95 102 218C102 316.5 256 448 256 448C256 448 410 316.5 410 218C410 132.95 341.05 64 256 64Z" fill="url(#pinBase)" />
                <path d="M256 68C174.5 68 108 134.5 108 216C108 265 142 322 188 370C158 310 148 245 158 185C168 125 208 80 256 68Z" fill="url(#softGloss)" />
                <circle cx="256" cy="208" r="62" fill="#ffffff" />
                <circle cx="256" cy="208" r="20" fill="#e05a47" />
              </svg>
            </div>
          </div>
        )}

        {/* 1. Map Canvas */}
        <div 
          ref={mapContainer} 
          className={isDarkMode ? 'map-dark-tiles' : 'map-light-tiles'}
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            zIndex: 0, 
            backgroundColor: isDarkMode ? '#17161a' : '#ecebe7',
            transition: 'background-color 1.2s cubic-bezier(0.33, 1, 0.68, 1)',
            touchAction: 'pan-x pan-y', 
          }} 
        />

        {/* Proximity Alert Toast */}
        {activeProximityAlert && (
          <div className="animate-slide-up" style={{
            position: 'fixed',
            top: 'calc(70px + env(safe-area-inset-top, 0px))',
            left: '16px',
            right: '16px',
            maxWidth: '420px',
            margin: '0 auto',
            backgroundColor: '#1c1917',
            color: '#fafaf9',
            padding: '12px 16px',
            borderRadius: '20px',
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)',
            zIndex: 100020,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            border: '1px solid #44403c',
            boxSizing: 'border-box',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(224, 90, 71, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05a47', flexShrink: 0 }}>
                <Compass style={{ width: '16px', height: '16px' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#e05a47', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Must-Try Nearby!
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeProximityAlert.name}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <button
                onClick={() => {
                  triggerHaptic(8);
                  const spot = activeProximityAlert;
                  setActiveProximityAlert(null);
                  flyToSpot(spot);
                }}
                style={{
                  backgroundColor: '#e05a47',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '6px 10px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                View
              </button>
              <button
                onClick={() => {
                  triggerHaptic(6);
                  if (activeProximityAlert.id) {
                    setDismissedAlertIds((prev) => [...prev, activeProximityAlert.id!]);
                  }
                  setActiveProximityAlert(null);
                }}
                style={{ background: 'none', border: 'none', color: '#a8a29e', cursor: 'pointer', padding: '4px', display: 'flex' }}
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </div>
        )}
  {/* Smooth Animated UI Toast */}
  {uiToast && (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100060,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      padding: '20px',
      boxSizing: 'border-box',
    }}>
      <div
        className={uiToastExiting ? 'animate-toast-out' : 'animate-toast-in'}
        style={{
          backgroundColor: uiToastType === 'success' ? 'rgba(255, 253, 249, 0.96)' : 'rgba(255, 248, 245, 0.96)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          color: uiToastType === 'success' ? '#1c1917' : '#c2410c',
          padding: '16px 24px',
          borderRadius: '24px',
          boxShadow: '0 24px 48px -10px rgba(28, 25, 23, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          border: `1px solid ${uiToastType === 'success' ? '#e7e0d3' : '#fed7aa'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          textAlign: 'left',
          maxWidth: 'min(380px, calc(100vw - 36px))',
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: uiToastType === 'success' ? '#e05a47' : '#ea580c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(224, 90, 71, 0.35)',
          flexShrink: 0,
        }}>
          {uiToastType === 'success' ? (
            <Sparkle style={{ width: '18px', height: '18px' }} />
          ) : (
            <AlertCircle style={{ width: '18px', height: '18px' }} />
          )}
        </div>
        <span style={{ fontSize: '13.5px', fontWeight: 700, lineHeight: 1.35, color: '#1c1917' }}>
          {uiToast}
        </span>
      </div>
    </div>
  )}

  {/* Premium Floating Back-Press Exit Capsule */}
  {showExitToast && (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100060,
        pointerEvents: 'none',
      }}
    >
      <div
        className={exitToastExiting ? 'animate-toast-out' : 'animate-toast-in'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          backgroundColor: isDarkMode ? 'rgba(38, 36, 33, 0.92)' : 'rgba(28, 25, 23, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          color: '#fafaf9',
          padding: '10px 18px',
          borderRadius: '24px',
          fontSize: '12.5px',
          fontWeight: 700,
          boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#e05a47' }} />
        <span>Press back again to exit Bywayr</span>
      </div>
    </div>
  )}
        {/* Offline Notification Banner */}
        {isOffline && (
          <div className="animate-fade-in" style={{
            position: 'fixed',
            top: 'calc(10px + env(safe-area-inset-top, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1c1917',
            color: '#fafaf9',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            zIndex: 100015,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            <WifiOff style={{ width: '14px', height: '14px', color: '#e05a47' }} />
            <span>Offline mode active · Using cached field notes</span>
          </div>
        )}

        {/* 2. Unified Search & Actions Bar */}
        <div style={{ 
          position: 'absolute', 
          top: isOffline ? 'calc(max(env(safe-area-inset-top, 16px), 16px) + 38px)' : 'calc(max(env(safe-area-inset-top, 16px), 16px) + 8px)', 
          left: '16px', 
          right: '16px', 
          maxWidth: '460px', 
          margin: '0 auto', 
          zIndex: 99999, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '6px', 
        }}> 
          <div style={{ position: 'relative', width: '100%', pointerEvents: 'auto' }}>
            <div style={{
              backgroundColor: uiGlass,
              backdropFilter: 'blur(24px) saturate(190%) contrast(105%)',
              WebkitBackdropFilter: 'blur(24px) saturate(190%) contrast(105%)',
              transform: 'translate3d(0, 0, 0)',
              WebkitTransform: 'translate3d(0, 0, 0)',
              isolation: 'isolate',
              padding: '0 10px 0 14px',
              borderRadius: showDropdown ? '28px 28px 0 0' : '28px',
              height: '56px',
              boxShadow: isDarkMode 
                ? '0 12px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)' 
                : '0 12px 32px rgba(28, 25, 23, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
              border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(255, 255, 255, 0.85)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              boxSizing: 'border-box',
              pointerEvents: 'auto',
            }}>
              {/* Far Left: Circular Bywayr Logo */}
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                overflow: 'hidden',
                display: 'flex',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(28, 25, 23, 0.12)',
                border: '1px solid rgba(0, 0, 0, 0.06)'
              }}>
                <img src="/icon-512.png" alt="Bywayr" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>

              {/* Middle: Integrated Search Input */}
              <div style={{ flex: 1, position: 'relative', minWidth: 0, display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search hidden gems or places..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { if (searchQuery.trim().length >= 3) setShowDropdown(true); }}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '15px',
                    color: uiText,
                    padding: '8px 24px 8px 4px',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                />
                <div style={{ position: 'absolute', right: '4px', display: 'flex', alignItems: 'center' }}>
                  {isSearching && <Loader2 style={{ color: '#e05a47', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />}
                  {searchQuery && !isSearching && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                        setShowDropdown(false);
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', display: 'flex', padding: '2px' }}
                      title="Clear search"
                    >
                      <X style={{ width: '16px', height: '16px' }} />
                    </button>
                  )}
                </div>
              </div>

              {/* Right Group: Account / Profile Avatar with Hydration Lock */}
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, pointerEvents: 'auto', height: '38px', justifyContent: 'flex-end' }}>
                {authLoading ? (
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: isDarkMode ? '#2c2826' : '#e7e5e4', opacity: 0.6 }} />
                ) : currentUser ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic(8);
                      setIsProfileModalOpen(true);
                      pushModalHistoryState('profile');
                    }}
                    style={{
                      backgroundColor: '#fff1ee',
                      border: '2px solid #e05a47',
                      borderRadius: '50%',
                      width: '38px',
                      height: '38px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      padding: 0,
                      flexShrink: 0,
                      pointerEvents: 'auto',
                      boxShadow: '0 2px 8px rgba(224, 90, 71, 0.2)',
                    }}
                    title="View Account Profile"
                  >
                    {userProfile?.avatar_url ? (
                      <img src={userProfile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                    ) : (
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#e05a47', userSelect: 'none', pointerEvents: 'none' }}>
                        {((userProfile?.username || userProfile?.full_name || currentUser?.email || 'U')[0]).toUpperCase()}
                      </span>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(8);
                      setMagicLinkSent(false);
                      setAuthUsername('');
                      setAuthUsernameError('');
                      setIsAuthModalOpen(true);
                      pushModalHistoryState('auth');
                    }}
                    style={{
                      backgroundColor: '#fff1ee',
                      border: '2px solid #e05a47',
                      borderRadius: '19px',
                      height: '38px',
                      padding: '0 14px',
                      color: '#e05a47',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      lineHeight: 1,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      pointerEvents: 'auto',
                      boxShadow: '0 2px 8px rgba(224, 90, 71, 0.2)',
                    }}
                  >
                    <LogIn style={{ width: '13px', height: '13px', display: 'block' }} /> <span>Sign In</span>
                  </button>
                )}
              </div>
            </div>

            {showDropdown && searchQuery.trim().length >= 3 && (
              <div className="animate-fade-in" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: isDarkMode ? 'rgba(38, 36, 33, 0.97)' : 'rgba(255, 255, 255, 0.96)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '0 0 24px 24px', border: `1px solid ${uiBorder}`, boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.08)', maxHeight: '280px', overflowY: 'auto', zIndex: 10000 }}>
                {searchResults.length === 0 ? (
                  <div style={{ padding: '14px 16px', textAlign: 'center', color: uiSubtext, fontSize: '13px' }}>
                    No local places found.
                  </div>
                ) : (
                  searchResults.map((item, idx) => (
                    <div key={idx} onClick={() => handleSelectSearchResult(item)} style={{ padding: '11px 16px', fontSize: '13px', color: isDarkMode ? '#d6d3d1' : '#44403c', cursor: 'pointer', borderBottom: `1px solid ${uiBorder}`, display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <MapPin style={{ width: '14px', height: '14px', color: '#a8a29e', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.display_name}</span>
                    </div>
                  ))
                )}

                <a
                  href="https://aviasales.tpk.lv/Y7mdLlKw"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: '#fafaf9',
                    borderTop: '1px solid #e7e5e4',
                    color: '#44403c',
                    textDecoration: 'none',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    borderBottomLeftRadius: '24px',
                    borderBottomRightRadius: '24px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Plane style={{ width: '14px', height: '14px', color: '#e05a47' }} />
                    <span>Planning a trip? Search flights via Aviasales</span>
                  </div>
                  <ArrowRight style={{ width: '13px', height: '13px', color: '#a8a29e' }} />
                </a>
              </div>
            )}
          </div>

          {/* Active Country Filter Badge */}
          {selectedCountryFilter && (
            <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', backgroundColor: '#1c1917', color: '#ffffff', borderRadius: '16px', fontSize: '12px', fontWeight: 600, boxShadow: '0 4px 12px rgba(28, 25, 23, 0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe style={{ width: '13px', height: '13px', color: '#e05a47' }} />
                <span>Filtered to <strong>{selectedCountryFilter}</strong> ({filteredSpots.length} pins)</span>
              </div>
              <button onClick={() => { triggerHaptic(6); setSelectedCountryFilter(null); }} style={{ background: 'none', border: 'none', color: '#a8a29e', cursor: 'pointer', padding: '2px', display: 'flex' }}>
                <X style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
          )}

          {/* Categories Bar & Proximity Filter */}
          <div 
            ref={categoryScrollRef}
            onMouseDown={handleCategoryMouseDown}
            onMouseLeave={handleCategoryMouseLeaveOrUp}
            onMouseUp={handleCategoryMouseLeaveOrUp}
            onMouseMove={handleCategoryMouseMove}
            onWheel={handleCategoryWheel}
            onScroll={handleCategoryScroll}
            style={{ 
              display: 'flex', 
              gap: '6px', 
              overflowX: 'auto', 
              paddingBottom: '4px',
              paddingTop: '4px', 
              scrollbarWidth: 'none', 
              cursor: isCategoryDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              WebkitOverflowScrolling: 'touch',
              width: '100%',
              boxSizing: 'border-box',
              pointerEvents: 'auto',
              animation: catBounce === 'left' ? 'bounceLeft 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : catBounce === 'right' ? 'bounceRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
            }}
          >
            {currentUser && (
              <button
                onClick={() => setOnlyMySpots(!onlyMySpots)}
                style={{
                  backgroundColor: onlyMySpots ? '#fff1ee' : (isDarkMode ? 'rgba(34, 30, 27, 0.65)' : 'rgba(255, 255, 255, 0.58)'),
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  transform: 'translate3d(0, 0, 0)',
                  WebkitTransform: 'translate3d(0, 0, 0)',
                  color: onlyMySpots ? '#e05a47' : (isDarkMode ? '#d6d3d1' : '#57534e'),
                  border: onlyMySpots ? '1px solid #fecdd3' : (isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.8)'),
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: '18px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: onlyMySpots ? '0 4px 12px rgba(224, 90, 71, 0.2)' : '0 4px 14px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  flexShrink: 0,
                  boxSizing: 'border-box'
                }}
              >
                <User style={{ width: '13px', height: '13px' }} />
                My Pins ({mySpotsCount})
              </button>
            )}

            <button
              onClick={() => {
                if (maxRadiusKm === null) setMaxRadiusKm(5);
                else if (maxRadiusKm === 5) setMaxRadiusKm(25);
                else setMaxRadiusKm(null);
              }}
              style={{
                backgroundColor: maxRadiusKm !== null ? '#e0f2fe' : (isDarkMode ? 'rgba(34, 30, 27, 0.65)' : 'rgba(255, 255, 255, 0.58)'),
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                transform: 'translate3d(0, 0, 0)',
                WebkitTransform: 'translate3d(0, 0, 0)',
                color: maxRadiusKm !== null ? '#0284c7' : (isDarkMode ? '#d6d3d1' : '#57534e'),
                border: maxRadiusKm !== null ? '1px solid #bae6fd' : (isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.8)'),
                height: '34px',
                padding: '0 12px',
                borderRadius: '18px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: maxRadiusKm !== null ? '0 4px 12px rgba(2, 132, 199, 0.2)' : '0 4px 14px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                flexShrink: 0,
                boxSizing: 'border-box'
              }}
            >
              <Compass style={{ width: '13px', height: '13px' }} />
              {maxRadiusKm === null ? 'Radius: Any' : `Within ${maxRadiusKm}km`}
            </button>

            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.label.toLowerCase();
              const Icon = cat.icon;

              const categoryCount = spots.filter((spot: Spot) => {
                if (onlyMySpots && currentUser && spot.user_id !== currentUser.id) return false;
                if (selectedCountryFilter && (spot.country || '').toLowerCase() !== selectedCountryFilter.toLowerCase()) return false;
                if (maxRadiusKm !== null) {
                  const anchorLat = userCoords ? userCoords.lat : (map.current ? map.current.getCenter().lat : 36.1699);
                  const anchorLng = userCoords ? userCoords.lng : (map.current ? map.current.getCenter().lng : -115.1398);
                  const dist = getDistanceFromLatLonInKm(anchorLat, anchorLng, spot.latitude, spot.longitude);
                  if (dist > maxRadiusKm) return false;
                }
                if (cat.label === 'All') return true;
                return spot.category?.toLowerCase() === cat.label.toLowerCase();
              }).length;

              return (
                <button
                  key={cat.label}
                  onClick={() => setSelectedCategory(cat.label)}
                  style={{ 
                    backgroundColor: isSelected ? '#e05a47' : (isDarkMode ? 'rgba(34, 30, 27, 0.65)' : 'rgba(255, 255, 255, 0.58)'),
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    transform: 'translate3d(0, 0, 0)',
                    WebkitTransform: 'translate3d(0, 0, 0)',
                    color: isSelected ? '#ffffff' : (isDarkMode ? '#d6d3d1' : '#57534e'),
                    border: isSelected ? '1px solid #e05a47' : (isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.8)'),
                    boxShadow: isSelected ? '0 6px 16px rgba(224, 90, 71, 0.35)' : '0 4px 14px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
                    height: '34px', 
                    padding: '0 12px', 
                    borderRadius: '18px', 
                    fontSize: '12px', 
                    fontWeight: 600, 
                    cursor: 'pointer', 
                    whiteSpace: 'nowrap', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    flexShrink: 0,
                    boxSizing: 'border-box'
                  }}
                >
                  <Icon style={{ width: '12px', height: '12px', color: isSelected ? '#fafaf9' : cat.color }} />
                  <span>{cat.label}</span>
                  <span style={{ 
                    fontSize: '10.5px', 
                    fontWeight: 700, 
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.22)' : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)'), 
                    padding: '1px 6px', 
                    borderRadius: '10px',
                    color: isSelected ? '#fafaf9' : (isDarkMode ? '#a8a29e' : '#78716c')
                  }}>
                    {categoryCount}
                  </span>
                </button>
              );
            })}

            {/* User's Custom Categories */}
            {customCategories.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
              const categoryCount = spots.filter((spot: Spot) => spot.category?.toLowerCase() === cat.name.toLowerCase()).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(isSelected ? 'All' : cat.name)}
                  style={{
                    backgroundColor: isSelected ? (cat.color || '#2563eb') : (isDarkMode ? 'rgba(34, 30, 27, 0.65)' : 'rgba(255, 255, 255, 0.58)'),
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    transform: 'translate3d(0, 0, 0)',
                    WebkitTransform: 'translate3d(0, 0, 0)',
                    color: isSelected ? '#ffffff' : (isDarkMode ? '#d6d3d1' : '#57534e'),
                    border: isSelected ? `1px solid ${cat.color || '#2563eb'}` : (isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.8)'),
                    boxShadow: isSelected ? `0 6px 16px ${cat.color}40` : '0 4px 14px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
                    height: '34px',
                    padding: '0 12px',
                    borderRadius: '18px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0,
                    boxSizing: 'border-box'
                  }}
                >
                  <span>{cat.icon || '🏷️'}</span>
                  <span>{cat.name}</span>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.22)' : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)'),
                    padding: '1px 6px',
                    borderRadius: '10px',
                    color: isSelected ? '#fafaf9' : (isDarkMode ? '#a8a29e' : '#78716c')
                  }}>
                    {categoryCount}
                  </span>
                </button>
              );
            })}

            {/* Plus Custom Category Button */}
            <button
              onClick={() => {
                console.log('+ Category clicked', { currentUser, isPlusSubscriber });
                triggerHaptic(8);
                if (!currentUser) {
                  console.log('No user - opening auth');
                  setIsAuthModalOpen(true);
                  pushModalHistoryState('auth');
                  return;
                }
                if (!isPlusSubscriber) {
                  console.log('Not Plus - opening modal');
                  setIsPlusModalOpen(true);
                  pushModalHistoryState('plusModal');
                  return;
                }
                console.log('Opening create category modal');
                setIsCreateCategoryOpen(true);
              }}
              style={{
                backgroundColor: isDarkMode ? 'rgba(43, 41, 38, 0.6)' : 'rgba(255, 255, 255, 0.6)',
                border: '1px dashed #e05a47',
                color: '#e05a47',
                height: '34px',
                padding: '0 12px',
                borderRadius: '18px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
                boxSizing: 'border-box'
              }}
            >
              <Plus style={{ width: '13px', height: '13px' }} />
              <span>Category</span>
            </button>
          </div>

          {/* Category Description Banner with Smooth Transition */}
          {selectedCategory !== 'All' && activeCategoryObject && (
            <div key={activeCategoryObject.label} className="animate-fade-in category-desc-fade" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 12px', backgroundColor: isDarkMode ? 'rgba(38, 36, 33, 0.92)' : 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '14px', border: `1px solid ${uiBorder}`, fontSize: '11.5px', color: isDarkMode ? '#d6d3d1' : '#57534e', fontWeight: 500, boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.08), 0 0 1px 1px rgba(28, 25, 23, 0.04)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: activeCategoryObject.color, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <strong>{activeCategoryObject.label}:</strong> {activeCategoryObject.desc}
              </span>
            </div>
          )}

          {/* Empty State Popup */}
          {filteredSpots.length === 0 && !loading && (
            <div 
              className="animate-fade-in" 
              style={{
                position: 'relative',
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.96)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '22px',
                boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.14), 0 0 1px 1px rgba(28, 25, 23, 0.04)',
                border: '1px solid #e7e5e4',
                padding: '16px 18px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginTop: '2px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#fff1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05a47', flexShrink: 0 }}>
                    <Compass style={{ width: '15px', height: '15px' }} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>
                    No spots found in this view
                  </h3>
                </div>
                <button 
                  onClick={() => {
                    triggerHaptic(6);
                    setSelectedCategory('All');
                    setSelectedCountryFilter(null);
                    setMaxRadiusKm(null);
                    setOnlyMySpots(false);
                  }} 
                  style={{ border: 'none', background: '#ecebe7', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  title="Reset all filters"
                >
                  <X style={{ width: '14px', height: '14px' }} />
                </button>
              </div>
              
              <p style={{ margin: 0, fontSize: '12px', color: '#78716c', lineHeight: 1.45 }}>
                {onlyMySpots
                  ? "You haven't pinned any spots matching the active filters."
                  : `No pinned field notes matching "${selectedCategory}"${selectedCountryFilter ? ` in ${selectedCountryFilter}` : ''}${maxRadiusKm !== null ? ` within ${maxRadiusKm}km` : ''}.`}
              </p>

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={() => {
                    triggerHaptic(6);
                    setSelectedCategory('All');
                    setSelectedCountryFilter(null);
                    setMaxRadiusKm(null);
                    setOnlyMySpots(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#ecebe7',
                    color: '#1c1917',
                    border: '1px solid #e7e5e4',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Reset Filters
                </button>
                <button
                  onClick={() => {
                    if (!currentUserRef.current) {
                      setIsAuthModalOpen(true);
                      pushModalHistoryState('auth');
                      return;
                    }
                    const center = map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 };
                    dropPreviewAndOpenModal(center.lat, center.lng);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#e05a47',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(224, 90, 71, 0.25)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  + Pin Spot Here
                </button>
              </div>
            </div>
          )}

          {/* Active Walk HUD Banner */}
          {walkTargetSpot && (
            <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#1c1917', color: '#fafaf9', borderRadius: '16px', fontSize: '13px', fontWeight: 600, boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.25)', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <Footprints style={{ width: '16px', height: '16px', color: '#e05a47', flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {walkTargetSpot.name}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button 
                  onClick={() => openNativeWalkNavigation(walkTargetSpot.latitude, walkTargetSpot.longitude, walkTargetSpot.name)}
                  style={{ 
                    backgroundColor: '#e05a47', 
                    color: '#ffffff', 
                    border: 'none', 
                    borderRadius: '10px', 
                    padding: '5px 10px', 
                    fontSize: '11.5px', 
                    fontWeight: 600, 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px' 
                  }}
                  title="Get Directions"
                >
                  Directions <Navigation2 style={{ width: '11px', height: '11px' }} />
                </button>
                <button 
                  onClick={() => setWalkTargetSpot(null)} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', display: 'flex', padding: '2px' }}
                  title="Dismiss"
                >
                  <X style={{ width: '16px', height: '16px' }} />
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Today's Discovery Hint Banner */}
        {discoveryHint && (
          <div className="animate-slide-up" style={{
            position: 'fixed',
            bottom: 'calc(90px + env(safe-area-inset-bottom, 0px))',
            left: '16px',
            right: '16px',
            paddingRight: '64px',
            maxWidth: '420px',
            margin: '0 auto',
            backgroundColor: isDarkMode ? 'rgba(38, 36, 33, 0.94)' : 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '20px',
            padding: '10px 14px',
            boxShadow: '0 12px 28px -6px rgba(28, 25, 23, 0.22)',
            border: `1px solid ${uiBorder}`,
            zIndex: 99996,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            cursor: 'pointer',
            transition: 'opacity 0.2s ease',
          }}
          onClick={() => {
            triggerHaptic(8);
            flyToSpot(discoveryHint.spot);
            setDiscoveryHint(null);
            hintDismissedRef.current = true;
          }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '8px', backgroundColor: '#fff1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05a47', flexShrink: 0 }}>
                <Sparkles style={{ width: '14px', height: '14px' }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: uiText }}>
                {discoveryHint.hint}
              </span>
            </div>
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                setDiscoveryHint(null); 
                hintDismissedRef.current = true;
              }}
              style={{ background: 'none', border: 'none', color: '#a8a29e', cursor: 'pointer', padding: '2px' }}
            >
              <X style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
        )}

        {/* 3. Floating Bottom Navigation Dock */}
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            left: '50%',
            transform: isInteracting ? 'translateX(-50%) translateY(24px)' : 'translateX(-50%) translateY(0)',
            opacity: isInteracting ? 0 : 1,
            transition: 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: 99998,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: isDarkMode ? 'rgba(38, 36, 33, 0.94)' : 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${uiBorder}`,
            borderRadius: '32px',
            padding: '6px 8px',
            boxShadow: '0 20px 40px -10px rgba(28, 25, 23, 0.22), 0 0 1px 1px rgba(28, 25, 23, 0.05)',
            pointerEvents: 'auto',
          }}
        >
          {/* Field Notes */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setIsDrawerOpen(true);
              pushModalHistoryState('drawer');
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '20px',
              color: isDrawerOpen ? '#e05a47' : (isDarkMode ? '#d6d3d1' : '#57534e'),
            }}
          >
            <List style={{ width: '18px', height: '18px' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>Notes</span>
          </button>

          {/* Field Journal */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              if (!currentUserRef.current) {
                setIsAuthModalOpen(true);
                pushModalHistoryState('auth');
                return;
              }
              setIsProfileModalOpen(true);
              pushModalHistoryState('profile');
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '20px',
              color: isProfileModalOpen ? '#e05a47' : (isDarkMode ? '#d6d3d1' : '#57534e'),
            }}
          >
            <Book style={{ width: '18px', height: '18px' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>Journal</span>
          </button>

          {/* Center Primary Action: Add Spot (Fades out when modals open) */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              if (!currentUserRef.current) {
                setIsAuthModalOpen(true);
                pushModalHistoryState('auth');
                return;
              }
              const center = map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 };
              dropPreviewAndOpenModal(center.lat, center.lng);
            }}
            style={{
              backgroundColor: '#e05a47',
              color: '#ffffff',
              border: 'none',
              borderRadius: '50%',
              width: '42px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(224, 90, 71, 0.4)',
              margin: '0 4px',
              flexShrink: 0,
              opacity: isAnyOverlayActive ? 0.35 : 1,
              pointerEvents: isAnyOverlayActive ? 'none' : 'auto',
              transition: 'opacity 0.2s ease',
            }}
            title="Pin Curated Spot"
          >
            <Plus style={{ width: '22px', height: '22px', strokeWidth: 2.5 }} />
          </button>

          {/* Walk Trigger */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setIsWalkModalOpen(true);
              pushModalHistoryState('walkModal');
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '20px',
              color: walkTargetSpot ? '#e05a47' : (isDarkMode ? '#d6d3d1' : '#57534e'),
            }}
          >
            <Footprints style={{ width: '18px', height: '18px' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em' }}>Walk</span>
          </button>

          {/* Curated Route Trigger */}
          <button
            type="button"
            onClick={handleOpenBywayLoop}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '20px',
              color: isLoopModalOpen ? '#e05a47' : (isDarkMode ? '#d6d3d1' : '#57534e'),
            }}
          >
            <Compass style={{ width: '18px', height: '18px' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em' }}>Route</span>
          </button>
        </div>

        {/* 4. Streamlined Map Utility Controls (Right Side) */}
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(82px + env(safe-area-inset-bottom, 0px))',
            right: '16px',
            zIndex: 99997,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: isDarkMode ? 'rgba(28, 25, 23, 0.92)' : 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: isDarkMode ? '1px solid #44403c' : '1px solid #e7e5e4',
            borderRadius: '20px',
            padding: '4px',
            boxShadow: '0 10px 25px -5px rgba(28, 25, 23, 0.18)',
            gap: '4px',
            pointerEvents: 'auto',
            opacity: isInteracting ? 0 : 1,
            transform: isInteracting ? 'translateY(16px)' : 'translateY(0)',
            transition: 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Zoom In Button */}
          <button
            onPointerDown={(e) => startZoomHold(1, e)}
            onPointerUp={stopZoomHold}
            onPointerLeave={stopZoomHold}
            style={{ width: '36px', height: '36px', backgroundColor: 'transparent', border: 'none', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isDarkMode ? '#e05a47' : '#57534e' }}
            title="Hold to Zoom In"
          >
            <Plus style={{ width: '16px', height: '16px' }} />
          </button>

          {/* Separator */}
          <div style={{ height: '1px', backgroundColor: isDarkMode ? '#44403c' : '#e7e5e4', margin: '1px 3px' }} />

          {/* Zoom Out Button */}
          <button
            onPointerDown={(e) => startZoomHold(-1, e)}
            onPointerUp={stopZoomHold}
            onPointerLeave={stopZoomHold}
            style={{ width: '36px', height: '36px', backgroundColor: 'transparent', border: 'none', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isDarkMode ? '#e05a47' : '#57534e' }}
            title="Hold to Zoom Out"
          >
            <Minus style={{ width: '16px', height: '16px' }} />
          </button>

          {/* Separator */}
          <div style={{ height: '1px', backgroundColor: isDarkMode ? '#44403c' : '#e7e5e4', margin: '1px 3px' }} />

          {/* Locate Me Button */}
          <button
            onClick={handleLocateMe}
            style={{ width: '36px', height: '36px', backgroundColor: 'transparent', border: 'none', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isDarkMode ? '#e05a47' : '#57534e' }}
            title="Center on My Location"
          >
            {isLocating ? (
              <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Crosshair style={{ width: '16px', height: '16px' }} />
            )}
          </button>

          {/* Separator */}
          <div style={{ height: '1px', backgroundColor: isDarkMode ? '#44403c' : '#e7e5e4', margin: '1px 3px' }} />

          {/* Dark Mode Toggle */}
          <button
            onClick={() => {
              triggerHaptic(6);
              const next = !isDarkMode;
              setIsDarkMode(next);
              if (typeof window !== 'undefined') {
                localStorage.setItem('bywayr_dark_mode', String(next));
              }
            }}
            style={{ width: '36px', height: '36px', backgroundColor: 'transparent', border: 'none', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isDarkMode ? '#e05a47' : '#78716c' }}
            title={isDarkMode ? 'Switch to Day Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <MoonStar style={{ width: '16px', height: '16px' }} /> : <Sun style={{ width: '16px', height: '16px' }} />}
          </button>
        </div>

        {/* Active Search Result Bottom Action Sheet */}
        {activeSearchedSpot && (
          <div className="animate-slide-up" style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', left: '16px', right: '16px', maxWidth: '410px', margin: '0 auto', zIndex: 99999, backgroundColor: 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.25), 0 0 1px 1px rgba(28, 25, 23, 0.04)', border: '1px solid #e7e5e4', padding: '20px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ flex: 1, paddingRight: '10px' }}>
                <span style={{ display: 'inline-block', backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', marginBottom: '6px' }}>
                  Map Location
                </span>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>{activeSearchedSpot.name}</h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#78716c' }}>
                  {activeSearchedSpot.city}{activeSearchedSpot.country ? ` · ${activeSearchedSpot.country}` : ''}
                </p>
              </div>
              <button onClick={() => dismissModalWithHistory(() => { setActiveSearchedSpot(null); if (previewMarkerRef.current) previewMarkerRef.current.remove(); })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '5px' }}>
                <X style={{ width: '19px', height: '19px' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={() => openNativeWalkNavigation(activeSearchedSpot.latitude, activeSearchedSpot.longitude, activeSearchedSpot.name)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', boxSizing: 'border-box', padding: '12px', backgroundColor: '#e05a47', color: '#ffffff', border: 'none', borderRadius: '14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(224, 90, 71, 0.25)' }}
              >
                <Navigation2 style={{ width: '15px', height: '15px' }} /> Get Directions
              </button>

              <button
                onClick={() => {
                  if (!currentUserRef.current) {
                    setIsAuthModalOpen(true);
                    pushModalHistoryState('auth');
                    return;
                  }
                  dropPreviewAndOpenModal(activeSearchedSpot.latitude, activeSearchedSpot.longitude, activeSearchedSpot.name);
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', boxSizing: 'border-box', padding: '10px', backgroundColor: '#ecebe7', color: '#1c1917', border: '1px solid #e7e5e4', borderRadius: '14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                <Plus style={{ width: '14px', height: '14px' }} /> Save as Curated Pin
              </button>
            </div>
          </div>
        )}

        {/* Proximity Walk Modal — Universal Bottom Sheet */}
        {isWalkModalOpen && (
          <div
            className="animate-fade-in"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dismissModalWithHistory(() => { setIsWalkModalOpen(false); setWalkSearchQuery(''); });
            }}
            onTouchStart={(e) => e.stopPropagation()}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: isMobileLayout ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 100005, padding: isMobileLayout ? 0 : '16px', touchAction: 'none' }}
          >
            <div
              className="animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: isDarkMode ? 'rgba(24, 22, 20, 0.74)' : 'rgba(255, 255, 255, 0.72)',
                backdropFilter: 'blur(28px) saturate(190%)',
                WebkitBackdropFilter: 'blur(28px) saturate(190%)',
                transform: 'translate3d(0, 0, 0)',
                WebkitTransform: 'translate3d(0, 0, 0)',
                border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.85)',
                borderRadius: isMobileLayout ? '28px 28px 0 0' : '28px',
                boxShadow: '0 24px 50px rgba(0, 0, 0, 0.25)',
                width: '100%',
                maxWidth: isMobileLayout ? '480px' : '410px',
                maxHeight: isMobileLayout ? '82dvh' : '82vh',
                display: 'flex',
                flexDirection: 'column',
                padding: '14px 20px 20px 20px',
                position: 'relative',
                boxSizing: 'border-box',
                pointerEvents: 'auto',
              }}
            >
              {isMobileLayout && (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                  <div style={{ width: '38px', height: '4px', borderRadius: '2px', backgroundColor: '#d6d3d1' }} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: '#fff1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05a47', flexShrink: 0 }}>
                    <Footprints style={{ width: '18px', height: '18px' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>Where to Walk?</h3>
                    <p style={{ margin: '1px 0 0 0', fontSize: '11.5px', color: '#78716c' }}>Choose a curated spot or search any destination</p>
                  </div>
                </div>
                <button onClick={() => dismissModalWithHistory(() => { setIsWalkModalOpen(false); setWalkSearchQuery(''); })} style={{ border: 'none', background: '#ecebe7', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>

              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <Search style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#a8a29e', width: '14px', height: '14px' }} />
                <input
                  type="text"
                  placeholder="Filter field notes or search any place..."
                  value={walkSearchQuery}
                  onChange={(e) => setWalkSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    backgroundColor: '#ecebe7',
                    border: '1px solid #e7e5e4',
                    borderRadius: '12px',
                    padding: '8px 30px 8px 32px',
                    fontSize: '12px',
                    outline: 'none',
                    color: '#1c1917',
                  }}
                />
                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                  {isSearchingOsm && <Loader2 style={{ width: '13px', height: '13px', color: '#e05a47', animation: 'spin 1s linear infinite' }} />}
                  {walkSearchQuery && !isSearchingOsm && (
                    <button
                      onClick={() => setWalkSearchQuery('')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', padding: 0 }}
                    >
                      <X style={{ width: '13px', height: '13px' }} />
                    </button>
                  )}
                </div>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '48vh', paddingRight: '2px' }}>
                {(() => {
                  const center = userCoords || (map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 });
                  const refLat = 'lat' in center ? center.lat : 36.1699;
                  const refLng = 'lng' in center ? center.lng : -115.1398;

                  const sortedCurated = [...spots]
                    .map((spot) => ({
                      ...spot,
                      distanceKm: getDistanceFromLatLonInKm(refLat, refLng, spot.latitude, spot.longitude),
                    }))
                    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
                    .filter((s) => {
                      if (!walkSearchQuery.trim()) return true;
                      const q = walkSearchQuery.toLowerCase();
                      return (
                        s.name.toLowerCase().includes(q) ||
                        s.city.toLowerCase().includes(q) ||
                        s.category.toLowerCase().includes(q)
                      );
                    });

                  const nearbySpots = sortedCurated.filter((s) => (s.distanceKm || 0) <= 50);
                  const furtherSpots = sortedCurated.filter((s) => (s.distanceKm || 0) > 50);

                  const renderWalkItem = (spot: Spot & { distanceKm?: number }) => {
                    const dist = spot.distanceKm ?? 0;
                    const distStr =
                      dist < 1
                        ? `${Math.round(dist * 1000)}m away`
                        : dist < 100
                        ? `${dist.toFixed(1)}km away`
                        : dist < 1000
                        ? `${Math.round(dist)}km away`
                        : `${Math.round(dist / 1000)}k km`;

                    return (
                      <div
                        key={spot.id || spot.name}
                        onClick={() => {
                          triggerHaptic(8);
                          setWalkTargetSpot(spot);
                          dismissModalWithHistory(() => {
                            setIsWalkModalOpen(false);
                            setWalkSearchQuery('');
                          });
                          flyToSpot(spot);
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '14px',
                          border: walkTargetSpot?.id === spot.id ? '1.5px solid #e05a47' : '1px solid #e7e5e4',
                          backgroundColor: walkTargetSpot?.id === spot.id ? 'rgba(255, 241, 238, 0.85)' : 'rgba(255, 255, 255, 0.65)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {spot.name}
                          </h4>
                          <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#78716c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {spot.city} · <span style={{ color: getCategoryColor(spot.category), fontWeight: 600 }}>{spot.category}</span>
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '2px 6px', borderRadius: '6px' }}>
                            {distStr}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic(8);
                              openNativeWalkNavigation(spot.latitude, spot.longitude, spot.name);
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#e05a47',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title="Open in Google Maps"
                          >
                            <Navigation2 style={{ width: '14px', height: '14px' }} />
                          </button>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <>
                      {nearbySpots.length > 0 && (
                        <>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 4px' }}>
                            Field Notes Nearby ({nearbySpots.length})
                          </div>
                          {nearbySpots.map(renderWalkItem)}
                        </>
                      )}

                      {furtherSpots.length > 0 && (
                        <>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em', padding: nearbySpots.length > 0 ? '8px 4px 2px 4px' : '2px 4px' }}>
                            {nearbySpots.length > 0 ? `Further Afield (${furtherSpots.length})` : `All Field Notes (${furtherSpots.length})`}
                          </div>
                          {furtherSpots.map(renderWalkItem)}
                        </>
                      )}

                      {sortedCurated.length === 0 && (
                        <p style={{ margin: '8px 0', fontSize: '12px', color: '#a8a29e', textAlign: 'center' }}>
                          No field notes matching "{walkSearchQuery}".
                        </p>
                      )}
                    </>
                  );
                })()}

                {walkSearchQuery.trim().length >= 2 && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 4px 2px 4px', borderTop: '1px dashed #e7e5e4', marginTop: '4px' }}>
                      Live Map Places ({liveOsmResults.length})
                    </div>

                    {liveOsmResults.length === 0 && !isSearchingOsm ? (
                      <p style={{ margin: '4px 0', fontSize: '11.5px', color: '#a8a29e', padding: '0 4px' }}>
                        No live map results found.
                      </p>
                    ) : (
                      liveOsmResults.map((spot, idx) => (
                        <div
                          key={`osm-${idx}`}
                          onClick={() => {
                            triggerHaptic(8);
                            setWalkTargetSpot(spot);
                            dismissModalWithHistory(() => {
                              setIsWalkModalOpen(false);
                              setWalkSearchQuery('');
                            });
                            if (spot.latitude && spot.longitude && map.current) {
                              map.current.flyTo({ center: [spot.longitude, spot.latitude], zoom: 16, essential: true });
                            }
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '14px',
                            border: walkTargetSpot?.name === spot.name ? '1.5px solid #0284c7' : '1px solid #e7e5e4',
                            backgroundColor: walkTargetSpot?.name === spot.name ? '#f0f9ff' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {spot.name}
                            </h4>
                            <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: '#0284c7', fontWeight: 500 }}>
                              {spot.city} · Map Location
                            </p>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic(8);
                                openNativeWalkNavigation(spot.latitude, spot.longitude, spot.name);
                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#0284c7',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="Open in Google Maps"
                            >
                              <Navigation2 style={{ width: '14px', height: '14px' }} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>

              {walkTargetSpot && (
                <button
                  onClick={() => {
                    triggerHaptic(8);
                    setWalkTargetSpot(null);
                    dismissModalWithHistory(() => {
                      setIsWalkModalOpen(false);
                      setWalkSearchQuery('');
                    });
                  }}
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    backgroundColor: '#ecebe7',
                    color: '#e05a47',
                    border: '1px solid #fed7aa',
                    padding: '9px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Clear Active Walk
                </button>
              )}
            </div>
          </div>
        )}

        {/* Byway Loop Modal */}
        {isLoopModalOpen && (
          <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100005, padding: '16px', pointerEvents: 'none' }}>
            <div className="animate-scale-up" style={{ backgroundColor: isDarkMode ? 'rgba(24, 22, 20, 0.74)' : 'rgba(255, 255, 255, 0.72)', backdropFilter: 'blur(28px) saturate(190%)', WebkitBackdropFilter: 'blur(28px) saturate(190%)', transform: 'translate3d(0, 0, 0)', WebkitTransform: 'translate3d(0, 0, 0)', border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.85)', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', width: '100%', maxWidth: '390px', maxHeight: '84vh', display: 'flex', flexDirection: 'column', padding: '20px', position: 'relative', boxSizing: 'border-box', pointerEvents: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '12px', backgroundColor: '#fff1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05a47', flexShrink: 0 }}>
                    <Compass style={{ width: '19px', height: '19px' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>Curated Route</h3>
                    <p style={{ margin: '1px 0 0 0', fontSize: '11.5px', color: '#78716c' }}>Walking tour connecting multiple neighborhood finds</p>
                  </div>
                </div>
                <button onClick={() => dismissModalWithHistory(() => setIsLoopModalOpen(false))} style={{ border: 'none', background: '#ecebe7', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>

              {/* Duration Selectors */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                {([30, 45, 60] as const).map((mins) => {
                  const isSelected = loopDuration === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        triggerHaptic(6);
                        setLoopDuration(mins);
                        const center = userCoords || (map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 });
                        const origin = { lat: 'lat' in center ? center.lat : 36.1699, lng: 'lng' in center ? center.lng : -115.1398 };
                        const radius = mins === 30 ? 1.5 : mins === 45 ? 2.5 : 3.5;
                        setLoopStops(generateBywayLoopStops(origin, spots, 3, radius));
                      }}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        borderRadius: '12px',
                        border: isSelected ? '1.5px solid #e05a47' : '1px solid #e7e5e4',
                        backgroundColor: isSelected ? '#fff1ee' : '#fafaf9',
                        color: isSelected ? '#e05a47' : '#57534e',
                        fontSize: '12px',
                        fontWeight: isSelected ? 700 : 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      ~{mins} min walk
                    </button>
                  );
                })}
              </div>

              {/* Stops Preview */}
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '42vh', paddingRight: '2px' }}>
                {loopStops.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 10px', color: '#78716c', fontSize: '12.5px' }}>
                    <Compass style={{ width: '28px', height: '28px', color: '#a8a29e', margin: '0 auto 8px auto', display: 'block' }} />
                    Not enough nearby pinned spots to form a loop in this range. Try increasing the duration or panning the map!
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '2px' }}>
                      Loop Waypoints ({loopStops.length} Gems)
                    </div>
                    {loopStops.map((stop, index) => (
                      <div
                        key={stop.id || index}
                        onClick={() => {
                          triggerHaptic(6);
                          flyToSpot(stop);
                          dismissModalWithHistory(() => setIsLoopModalOpen(false));
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '14px',
                          border: '1px solid #e7e5e4',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#e05a47', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                          {index + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {stop.name}
                          </h4>
                          <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: '#78716c' }}>
                            {stop.category} · {stop.city}
                          </p>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '2px 6px', borderRadius: '6px' }}>
                          {stop.distanceKm ? `${stop.distanceKm.toFixed(1)}km` : ''}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Action Button */}
              {loopStops.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(12);
                    const center = userCoords || (map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 });
                    const origin = { lat: 'lat' in center ? center.lat : 36.1699, lng: 'lng' in center ? center.lng : -115.1398 };
                    launchNativeWalkingLoop(origin, loopStops);
                  }}
                  style={{
                    marginTop: '14px',
                    width: '100%',
                    backgroundColor: '#e05a47',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '13px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(224, 90, 71, 0.28)',
                  }}
                >
                  <Navigation2 style={{ width: '15px', height: '15px' }} /> Follow Route in Maps
                </button>
              )}
            </div>
          </div>
        )}

        {/* 4. Unified Spot Details Sheet (mobile: bottom sheet / desktop: centered) */}
        {viewingSpot && (
          <div
            className="animate-fade-in"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(28, 25, 23, 0.6)',
              display: 'flex',
              alignItems: isMobileLayout ? 'flex-end' : 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: isMobileLayout ? '0' : '16px',
              pointerEvents: 'none',
            }}
          >
            <div
              className="animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              style={{
                pointerEvents: 'auto',
                backgroundColor: isDarkMode ? 'rgba(24, 22, 20, 0.88)' : 'rgba(255, 253, 249, 0.88)',
                backdropFilter: 'blur(28px) saturate(180%)',
                WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                transform: 'translate3d(0, 0, 0)',
                WebkitTransform: 'translate3d(0, 0, 0)',
                boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.28)',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                overflow: 'hidden',
                transition: 'height 0.24s cubic-bezier(0.2, 0.9, 0.3, 1)',
                willChange: 'height, transform',
                width: '100%',
                ...(isMobileLayout
                  ? {
                      maxWidth: '480px',
                      height: isSheetExpanded ? '94dvh' : '68dvh',
                      borderRadius: '28px 28px 0 0',
                      borderTop: isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.85)',
                    }
                  : {
                      maxWidth: '430px',
                      height: isSheetExpanded ? '90vh' : '82vh',
                      borderRadius: '28px',
                      border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.85)',
                    }),
              }}
            >
              {/* Drag Handle (mobile pull bar & click to toggle expand) */}
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  paddingTop: '10px',
                  paddingBottom: '6px',
                  cursor: 'pointer',
                  touchAction: 'none',
                  WebkitTouchCallout: 'none',
                }}
                onClick={() => {
                  triggerHaptic(4);
                  setIsSheetExpanded((v) => !v);
                }}
                onTouchStart={(e) => {
                  sheetDragStartY.current = e.touches[0].clientY;
                }}
                onTouchMove={(e) => {
                  if (sheetDragStartY.current === null) return;
                  const dy = e.touches[0].clientY - sheetDragStartY.current;
                  if (Math.abs(dy) > 75) {
                    if (dy < 0 && !isSheetExpanded) {
                      setIsSheetExpanded(true);
                      triggerHaptic(4);
                    }
                    if (dy > 0) {
                      if (isSheetExpanded) {
                        setIsSheetExpanded(false);
                        triggerHaptic(4);
                      } else {
                        dismissModalWithHistory(() => {
                          setViewingSpot(null);
                          setIsSheetExpanded(false);
                          if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
                        });
                      }
                    }
                    sheetDragStartY.current = null;
                  }
                }}
                onTouchEnd={() => {
                  sheetDragStartY.current = null;
                }}
              >
                <div style={{ width: '38px', height: '4px', borderRadius: '2px', backgroundColor: '#d6d3d1' }} />
              </div>

              {/* Scrollable Sheet Content */}
              <div
                style={{
                  flex: '1 1 0%',
                  minHeight: 0,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '4px 18px 14px',
                  boxSizing: 'border-box',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {/* Header Row: Category Badge | Tools + Close */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: '#f5f5f4',
                      color: '#44403c',
                      border: '1px solid #e7e5e4',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: '8px',
                      letterSpacing: '0.01em',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: getCategoryColor(viewingSpot.category),
                      }}
                    />
                    {viewingSpot.category}
                  </span>

                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
                    {currentUser && viewingSpot.user_id === currentUser.id && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(viewingSpot, e);
                          }}
                          style={{
                            border: '1px solid #e7e5e4',
                            background: '#fafaf9',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            color: '#57534e',
                            padding: '5px 7px',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0,
                          }}
                          title="Edit Spot"
                        >
                          <Pencil style={{ width: '13px', height: '13px' }} />
                    </button>

                        <button
                          onClick={(e) => handleDeleteSpot(viewingSpot, e)}
                          disabled={deleting}
                          style={{
                            border: '1px solid #fecdd3',
                            background: '#fff1ee',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            color: '#e05a47',
                            padding: '5px 7px',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0,
                          }}
                          title="Delete Spot"
                        >
                          {deleting ? (
                            <Loader2 style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Trash2 style={{ width: '13px', height: '13px' }} />
                          )}
                        </button>
                      </>
                    )}

                    <button
                      onClick={() =>
                        dismissModalWithHistory(() => {
                          setViewingSpot(null);
                          setIsSheetExpanded(false);
                          if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
                        })
                      }
                      style={{
                        border: 'none',
                        background: '#ecebe7',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        cursor: 'pointer',
                        color: '#78716c',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginLeft: '2px',
                      }}
                    >
                      <X style={{ width: '18px', height: '18px' }} />
                    </button>
                  </div>
                </div>

                {/* Spot Title, Creator & Votes */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '17px',
                      fontWeight: 700,
                      color: '#1c1917',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.25,
                      wordBreak: 'break-word',
                      width: '100%',
                    }}
                  >
                    {viewingSpot.name}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12px',
                      color: '#78716c',
                      fontWeight: 500,
                      width: '100%',
                      wordBreak: 'break-word',
                    }}
                  >
                    {viewingSpot.city}
                    {viewingSpot.country ? ` · ${viewingSpot.country}` : ''}
                    {viewingSpot.user_id &&
                    profilesMap[viewingSpot.user_id]?.username &&
                    !profilesMap[viewingSpot.user_id]?.is_private ? (
                      <>
                        {' · '}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPublicProfile(viewingSpot.user_id!);
                          }}
                          style={{ color: '#e05a47', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          @{profilesMap[viewingSpot.user_id].username}
                        </span>
                      </>
                    ) : (
                      ''
                    )}
                  </p>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      marginTop: '6px',
                      border: '1px solid #e7e5e4',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      background: '#fafaf9',
                      alignSelf: 'flex-start',
                    }}
                  >
                    <button
                      onClick={() => toggleVote(viewingSpot.id, 'up')}
                      disabled={savingVote}
                      style={{
                        border: 'none',
                        borderRight: '1px solid #e7e5e4',
                        background: viewingSpot.id && myVotes[viewingSpot.id] === 'up' ? '#ecfdf5' : 'transparent',
                        cursor: 'pointer',
                        color: viewingSpot.id && myVotes[viewingSpot.id] === 'up' ? '#059669' : '#57534e',
                        padding: '6px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                      title="Upvote"
                    >
                      <ThumbsUp style={{ width: '13px', height: '13px' }} />
                      <span>{viewingSpot.id ? formatVoteCount(voteCounts[viewingSpot.id]?.up || 0) : '0'}</span>
                    </button>
                    <button
                      onClick={() => toggleVote(viewingSpot.id, 'down')}
                      disabled={savingVote}
                      style={{
                        border: 'none',
                        background: viewingSpot.id && myVotes[viewingSpot.id] === 'down' ? '#fff1ee' : 'transparent',
                        cursor: 'pointer',
                        color: viewingSpot.id && myVotes[viewingSpot.id] === 'down' ? '#e05a47' : '#57534e',
                        padding: '6px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                      title="Downvote"
                    >
                      <ThumbsDown style={{ width: '13px', height: '13px' }} />
                      <span>{viewingSpot.id ? formatVoteCount(voteCounts[viewingSpot.id]?.down || 0) : '0'}</span>
                    </button>
                  </div>
                </div>

                {(() => {
                  const spotPhotos: string[] = (viewingSpot as any).image_urls && (viewingSpot as any).image_urls.length > 0
                    ? (viewingSpot as any).image_urls
                    : viewingSpot.image_url
                    ? [viewingSpot.image_url]
                    : [];

                  if (spotPhotos.length === 0) return null;

                  return (
                    <div
                      style={{
                        width: '100%',
                        height: '155px',
                        display: 'flex',
                        gap: '8px',
                        overflowX: 'auto',
                        scrollSnapType: 'x mandatory',
                        scrollbarWidth: 'none',
                        borderRadius: '14px',
                        flexShrink: 0,
                      }}
                    >
                      {spotPhotos.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`${viewingSpot.name} ${i + 1}`}
                          style={{
                            height: '100%',
                            flex: spotPhotos.length > 1 ? '0 0 88%' : '0 0 100%',
                            scrollSnapAlign: 'start',
                            objectFit: 'cover',
                            borderRadius: '14px',
                            display: 'block',
                          }}
                        />
                      ))}
                    </div>
                  );
                })()}

                {viewingSpot.description && (
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#44403c', lineHeight: 1.45, wordBreak: 'break-word' }}>
                    {viewingSpot.description}
                  </p>
                )}

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button
                    onClick={() => toggleMustTry(viewingSpot.id)}
                    disabled={savingBookmark}
                    style={{
                      flex: 1,
                      border:
                        '1px solid ' +
                        (viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#fde68a' : '#e7e5e4'),
                      background:
                        viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#fef3c7' : '#fafaf9',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      color:
                        viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#d97706' : '#57534e',
                      padding: '9px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                    }}
                    title="Save to Must-Try"
                  >
                    {viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? (
                      <BookmarkCheck style={{ width: '15px', height: '15px' }} />
                    ) : (
                      <Bookmark style={{ width: '15px', height: '15px' }} />
                    )}
                    <span>{viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? 'Saved' : 'Must-Try'}</span>
                  </button>
                  <button
                    onClick={() => handleShareSpot(viewingSpot)}
                    style={{
                      flex: 1,
                      border: '1px solid #e7e5e4',
                      background: '#fafaf9',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      color: '#57534e',
                      padding: '9px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                    }}
                    title="Share spot"
                  >
                    <Share2 style={{ width: '15px', height: '15px' }} />
                    <span>Share</span>
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic(8);
                      if (!currentUserRef.current) {
                        setIsAuthModalOpen(true);
                        pushModalHistoryState('auth');
                        return;
                      }
                      if (!isPlusSubscriber) {
                        setIsPlusModalOpen(true);
                        pushModalHistoryState('plusModal');
                        return;
                      }
                      setIsTagModalOpen(true);
                    }}
                    style={{
                      flex: 1,
                      border: '1px solid #e7e5e4',
                      background: '#fafaf9',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      color: '#57534e',
                      padding: '9px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                    }}
                    title="Organize with custom category tags"
                  >
                    <Tag style={{ width: '15px', height: '15px' }} />
                    <span>Tag</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => openNativeWalkNavigation(viewingSpot.latitude, viewingSpot.longitude, viewingSpot.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px',
                      backgroundColor: '#e05a47',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '14px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(224, 90, 71, 0.28)',
                    }}
                  >
                    <ExternalLink style={{ width: '15px', height: '15px' }} /> Open in Maps
                  </button>

                  <button
                    onClick={() => handleCopyCoordinates(viewingSpot.latitude, viewingSpot.longitude)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px',
                      backgroundColor: coordsCopied ? '#ecfdf5' : '#f5f5f4',
                      color: coordsCopied ? '#059669' : '#57534e',
                      border: coordsCopied ? '1px solid #a7f3d0' : '1px solid #e7e5e4',
                      borderRadius: '14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {coordsCopied ? <Check style={{ width: '14px', height: '14px' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
                    {coordsCopied ? 'Coordinates Copied!' : 'Copy Coordinates'}
                  </button>
                </div>

                {/* Inline Field Notes List */}
                <div style={{ borderTop: '1px solid #e7e5e4', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare style={{ width: '14px', height: '14px', color: '#e05a47' }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1c1917' }}>
                      Field Notes ({spotComments.length})
                    </span>
                  </div>

                  {spotComments.length === 0 ? (
                    <p style={{ margin: '4px 0', fontSize: '12.5px', color: '#a8a29e', textAlign: 'center', fontStyle: 'italic' }}>
                      No tips or comments yet. Be the first!
                    </p>
                  ) : (
                    spotComments.map((c) => {
                      const authorProfile = profilesMap[c.user_id];
                      const isUpvoted = upvotedCommentIds.includes(c.id);
                      const isSpotCreator = viewingSpot.user_id && viewingSpot.user_id === c.user_id;
                      const isOwnComment = currentUser && c.user_id === currentUser.id;
                      const authorSpots = spots.filter((s) => s.user_id === c.user_id);
                      const authorTier = getStampTier(authorSpots.length);
                      const tagClean = (c.tag || 'Tip').replace(/^\[|\]$/g, '').replace('Status: ', '');
                      const tagColor =
                        tagClean.includes('Closed')
                          ? '#e05a47'
                          : tagClean.includes('Price') || tagClean.includes('Menu')
                          ? '#d97706'
                          : tagClean.includes('Wi-Fi') || tagClean.includes('Work')
                          ? '#2563eb'
                          : tagClean.includes('Vibe')
                          ? '#7c3aed'
                          : '#059669';

                      return (
                        <div
                          key={c.id}
                          style={{
                            backgroundColor: isSpotCreator ? '#fffbfb' : '#fafaf9',
                            border: isSpotCreator ? '1px solid #fecdd3' : '1px solid #e7e5e4',
                            borderRadius: '12px',
                            padding: '10px 12px',
                            fontSize: '12.5px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              {authorProfile?.is_private ? (
                                <span style={{ fontWeight: 700, color: '#a8a29e' }}>[hidden curator]</span>
                              ) : (
                                <span
                                  onClick={() => handleOpenPublicProfile(c.user_id)}
                                  style={{ fontWeight: 700, color: '#1c1917', cursor: 'pointer' }}
                                >
                                  @{authorProfile?.username || 'wanderer'}
                                </span>
                              )}
                              {isSpotCreator && (
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 800,
                                    color: '#e05a47',
                                    backgroundColor: '#fff1ee',
                                    border: '1px solid #fecdd3',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    letterSpacing: '0.04em',
                                  }}
                                >
                                  CREATOR
                                </span>
                              )}
                              {authorSpots.length > 0 && (
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 700,
                                    color: authorTier === 'gold' ? '#b45309' : authorTier === 'silver' ? '#475569' : '#78716c',
                                    backgroundColor: authorTier === 'gold' ? '#fef3c7' : '#ecebe7',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {authorTier === 'gold' ? '👑 Gold' : authorTier === 'silver' ? '🥈 Silver' : `${authorSpots.length} pins`}
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  color: tagColor,
                                  backgroundColor: `${tagColor}14`,
                                  border: `1px solid ${tagColor}30`,
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  letterSpacing: '0.01em',
                                }}
                              >
                                {tagClean}
                              </span>
                            </div>
                            <span style={{ fontSize: '10.5px', color: '#a8a29e', flexShrink: 0 }}>
                              {formatRelativeTime(c.created_at)}
                            </span>
                          </div>
                          <p style={{ margin: '0 0 8px 0', color: '#44403c', lineHeight: 1.4, wordBreak: 'break-word' }}>
                            {c.content}
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button
                              onClick={() => handleUpvoteComment(c.id)}
                              style={{
                                background: isUpvoted ? '#ecfdf5' : '#ecebe7',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '4px 8px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                color: isUpvoted ? '#059669' : '#78716c',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <ThumbsUp style={{ width: '12px', height: '12px' }} />
                              <span>{c.upvotes || 0}</span>
                            </button>
                            {isOwnComment && (
                              <button
                                onClick={() => {
                                  if (confirm('Delete this note?')) handleDeleteComment(c.id);
                                }}
                                disabled={deletingCommentId === c.id}
                                style={{
                                  background: '#fff1ee',
                                  border: '1px solid #fecdd3',
                                  borderRadius: '8px',
                                  padding: '4px 8px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  color: '#e05a47',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Delete my comment"
                              >
                                {deletingCommentId === c.id ? (
                                  <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                                ) : (
                                  <Trash2 style={{ width: '12px', height: '12px' }} />
                                )}
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Sticky Comment Composer */}
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '10px 18px calc(12px + env(safe-area-inset-bottom, 0px))',
                  borderTop: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(231, 229, 228, 0.8)',
                  backgroundColor: isDarkMode ? 'rgba(24, 22, 20, 0.92)' : 'rgba(255, 253, 249, 0.92)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  ref={commentTagsScrollRef}
                  onMouseDown={handleTagMouseDown}
                  onMouseMove={handleTagMouseMove}
                  onMouseUp={handleTagMouseUpOrLeave}
                  onMouseLeave={handleTagMouseUpOrLeave}
                  onWheel={handleTagWheel}
                  style={{
                    display: 'flex',
                    gap: '6px',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    cursor: isTagDragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    WebkitOverflowScrolling: 'touch',
                    paddingBottom: '2px',
                  }}
                >
                  {COMMENT_TAGS.map((t) => {
                    const isSelected = commentTag === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          if (isTagDragging) return;
                          triggerHaptic(4);
                          setCommentTag(t);
                        }}
                        style={{
                          backgroundColor: isSelected ? '#1c1917' : '#fafaf9',
                          color: isSelected ? '#ffffff' : '#57534e',
                          border: isSelected ? '1px solid #1c1917' : '1px solid #e7e5e4',
                          borderRadius: '9999px',
                          padding: '5px 12px',
                          fontSize: '11.5px',
                          fontWeight: isSelected ? 700 : 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          boxShadow: isSelected ? '0 2px 6px rgba(28, 25, 23, 0.16)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Leave a quick tip or update..."
                    value={newCommentText}
                    onChange={(e) => {
                      setNewCommentText(e.target.value);
                      if (!isSheetExpanded) setIsSheetExpanded(true);
                    }}
                    onFocus={() => {
                      if (!isSheetExpanded) setIsSheetExpanded(true);
                    }}
                    style={{
                      flex: 1,
                      boxSizing: 'border-box',
                      backgroundColor: '#ecebe7',
                      border: '1px solid #e7e5e4',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      fontSize: '12.5px',
                      outline: 'none',
                      color: '#1c1917',
                      minWidth: 0,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={submittingComment || !newCommentText.trim()}
                    style={{
                      backgroundColor: '#1c1917',
                      color: '#fafaf9',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '0 14px',
                      cursor: submittingComment || !newCommentText.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    title="Send Comment"
                  >
                    {submittingComment ? (
                      <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Send style={{ width: '14px', height: '14px' }} />
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Add / Edit Spot Modal — Universal Bottom Sheet Shell */}
        {isModalOpen && (
          <div
            className="animate-fade-in"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dismissModalWithHistory(handleCloseModal);
            }}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(28, 25, 23, 0.55)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: isMobileLayout ? 'flex-end' : 'center',
              justifyContent: 'center',
              zIndex: 100005,
              padding: isMobileLayout ? 0 : '16px',
              touchAction: 'none',
            }}
          >
            <div
              className="animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: isDarkMode ? 'rgba(24, 22, 20, 0.88)' : 'rgba(255, 253, 249, 0.88)',
                backdropFilter: 'blur(28px) saturate(180%)',
                WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                transform: 'translate3d(0, 0, 0)',
                WebkitTransform: 'translate3d(0, 0, 0)',
                border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.85)',
                borderRadius: isMobileLayout ? '28px 28px 0 0' : '28px',
                boxShadow: isMobileLayout ? '0 -10px 40px rgba(0, 0, 0, 0.3)' : '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                width: '100%',
                maxWidth: isMobileLayout ? '480px' : '410px',
                maxHeight: isMobileLayout ? '88dvh' : '86vh',
                display: 'flex',
                flexDirection: 'column',
                padding: '14px 22px calc(18px + env(safe-area-inset-bottom, 0px)) 22px',
                position: 'relative',
                boxSizing: 'border-box',
                overflowY: 'auto',
                gap: '10px',
                pointerEvents: 'auto',
              }}
            >
              {isMobileLayout && (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                  <div style={{ width: '38px', height: '4px', borderRadius: '2px', backgroundColor: '#d6d3d1' }} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>
                  {isEditing ? 'Edit Curated Spot' : 'Pin Spot'}
                </h3>
                <button onClick={() => dismissModalWithHistory(handleCloseModal)} style={{ border: 'none', background: '#ecebe7', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>

              <form onSubmit={handleSaveSpot} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '3px' }}>Place Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ôdelice Bakery"
                    value={newSpot.name}
                    onChange={(e) => setNewSpot({ ...newSpot, name: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '12.5px', padding: '9px 11px', borderRadius: '12px', border: '1px solid #d6d3d1', outline: 'none', color: '#1c1917' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '3px' }}>Category</label>
                  <select
                    value={newSpot.category}
                    onChange={(e) => setNewSpot({ ...newSpot, category: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '12.5px', padding: '9px 11px', borderRadius: '12px', border: '1px solid #d6d3d1', outline: 'none', backgroundColor: '#ffffff', color: '#1c1917' }}
                  >
                    <optgroup label="Standard Categories">
                      {CATEGORIES.filter((c) => c.label !== 'All').map((cat) => (
                        <option key={cat.label} value={cat.label}>{cat.label}</option>
                      ))}
                    </optgroup>
                    {customCategories.length > 0 && (
                      <optgroup label="My Custom Categories">
                        {customCategories.map((cat) => (
                          <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '3px' }}>City</label>
                    <input
                      type="text"
                      required
                      placeholder="City"
                      value={newSpot.city}
                      onChange={(e) => setNewSpot({ ...newSpot, city: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', fontSize: '12.5px', padding: '9px 11px', borderRadius: '12px', border: '1px solid #d6d3d1', outline: 'none', color: '#1c1917' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '3px' }}>Country</label>
                    <input
                      type="text"
                      placeholder="Country"
                      value={newSpot.country || ''}
                      onChange={(e) => setNewSpot({ ...newSpot, country: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', fontSize: '12.5px', padding: '9px 11px', borderRadius: '12px', border: '1px solid #d6d3d1', outline: 'none', color: '#1c1917' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '3px' }}>Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Tips, recommendations, or how to visit..."
                    value={newSpot.description}
                    onChange={(e) => setNewSpot({ ...newSpot, description: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '12.5px', padding: '9px 11px', borderRadius: '12px', border: '1px solid #d6d3d1', outline: 'none', color: '#1c1917', resize: 'vertical' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#57534e' }}>Photos (up to 4)</label>
                    <button type="button" onClick={handleModalLocate} disabled={isModalLocating} style={{ background: 'none', border: 'none', color: '#e05a47', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      {isModalLocating ? <Loader2 style={{ width: '11px', height: '11px', animation: 'spin 1s linear infinite' }} /> : <Crosshair style={{ width: '11px', height: '11px' }} />}
                      Use Current GPS
                    </button>
                  </div>
                  
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', backgroundColor: '#ecebe7', border: '1px dashed #d6d3d1', borderRadius: '12px', cursor: 'pointer', fontSize: '11.5px', color: '#57534e', fontWeight: 600 }}>
                    <Camera style={{ width: '15px', height: '15px', color: '#e05a47' }} />
                    <span>{imageFiles.length > 0 ? `${imageFiles.length} photo(s) selected` : 'Select Photos'}</span>
                    <input type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: 'none' }} />
                  </label>
                  {imagePreviews.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginTop: '6px', paddingBottom: '2px' }}>
                      {imagePreviews.map((src, i) => (
                        <div key={i} style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid #d6d3d1' }}>
                          <img src={src} alt={`Preview ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  style={{
                    marginTop: '4px',
                    width: '100%',
                    backgroundColor: '#e05a47',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '11px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: saving || uploadingImage ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(224, 90, 71, 0.25)'
                  }}
                >
                  {saving || uploadingImage ? <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} /> : (isEditing ? 'Save Changes' : 'Save to Guide')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 5. Public Passport Profile Modal */}
        {viewingProfile && (() => {
          const uniqueCities = Array.from(new Set(viewingProfileSpots.map((s) => s.city.trim()).filter(Boolean)));
          const publicPassportStamps = extractPassportStamps(viewingProfileSpots);
          const resolvedCountry = viewingProfile.country || (publicPassportStamps.length > 0 ? publicPassportStamps[0].country : 'United States');

          const filteredProfileSpots = profileCityFilter === 'All' 
            ? viewingProfileSpots 
            : viewingProfileSpots.filter((s) => s.city.trim().toLowerCase() === profileCityFilter.toLowerCase());

          return (
            <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100005, padding: '16px' }}>
              <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '28px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.35)', width: '100%', maxWidth: '440px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px', position: 'relative', boxSizing: 'border-box' }}>
                <button onClick={() => dismissModalWithHistory(() => setViewingProfile(null))} style={{ position: 'absolute', top: '18px', right: '18px', border: 'none', background: '#ecebe7', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X style={{ width: '18px', height: '18px' }} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px', paddingRight: '30px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#fff1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05a47', overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 12px rgba(224, 90, 71, 0.15)', border: '2px solid #e7e5e4' }}>
                    {viewingProfile.avatar_url ? (
                      <img src={viewingProfile.avatar_url} alt={viewingProfile.username || 'Curator'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User style={{ width: '28px', height: '28px' }} />
                    )}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>@{viewingProfile.username || 'wanderer'}</span>
                      <span style={{ 
                        fontSize: '10.5px', 
                        fontWeight: 600, 
                        color: '#78716c', 
                        backgroundColor: '#ecebe7', 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        letterSpacing: '0.04em', 
                        textTransform: 'uppercase', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        border: '1px solid #e7e5e4' 
                      }}>
                        <Globe style={{ width: '11px', height: '11px', color: '#e05a47' }} />
                        {resolvedCountry}
                      </span>
                    </h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#78716c', fontWeight: 500 }}>
                      {viewingProfile.bio || 'Wanderer & local spot hunter'}
                    </p>
                    {(viewingProfile.youtube_url || viewingProfile.instagram_url || viewingProfile.facebook_url || viewingProfile.website_url) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                        {viewingProfile.youtube_url && (
                          <a href={viewingProfile.youtube_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', padding: '4px 9px', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                            <IconYoutube size={13} /> YouTube
                          </a>
                        )}
                        {viewingProfile.instagram_url && (
                          <a href={viewingProfile.instagram_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fce7f3', color: '#db2777', border: '1px solid #f9a8d4', borderRadius: '8px', padding: '4px 9px', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                            <IconInstagram size={13} /> Instagram
                          </a>
                        )}
                        {viewingProfile.facebook_url && (
                          <a href={viewingProfile.facebook_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '4px 9px', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                            <IconFacebook size={13} /> Facebook
                          </a>
                        )}
                        
                                                {viewingProfile.website_url && (
                          <a href={viewingProfile.website_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fff1ee', color: '#e05a47', border: '1px solid #fecdd3', borderRadius: '8px', padding: '4px 9px', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                            <LinkIcon size={13} /> Website
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '4px 10px 14px 10px', marginBottom: '14px', textAlign: 'center', borderBottom: '1px solid #e7e5e4' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#1c1917' }}>{viewingProfileSpots.length}</div>
                    <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Total Pins</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0284c7' }}>{uniqueCities.length}</div>
                    <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Cities</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#d97706' }}>{publicPassportStamps.length}</div>
                    <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Countries</div>
                  </div>
                </div>

                {/* Passport Entry Card */}
                <div style={{ backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '18px', padding: '14px', marginBottom: '14px' }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      triggerHaptic(8);
                      setViewingPassportSpots(viewingProfileSpots);
                      setViewingPassportProfile(viewingProfile);
                      setPassportBookPage(0);
                      dismissModalWithHistory(() => setViewingProfile(null));
                      setTimeout(() => {
                        setIsPassportBookOpen(true);
                        pushModalHistoryState('passportBook');
                      }, 260);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        triggerHaptic(8);
                        setViewingPassportSpots(viewingProfileSpots);
                        setViewingPassportProfile(viewingProfile);
                        setPassportBookPage(0);
                        dismissModalWithHistory(() => setViewingProfile(null));
                        setTimeout(() => {
                          setIsPassportBookOpen(true);
                          pushModalHistoryState('passportBook');
                        }, 260);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      borderRadius: '14px',
                      padding: '8px',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f4')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ width: '52px', height: '52px', borderRadius: '14px', backgroundColor: '#fff1ee', border: '1px solid #fecdd3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Compass style={{ width: '24px', height: '24px', color: '#e05a47' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1c1917' }}>Passport</div>
                      <div style={{ fontSize: '11.5px', color: '#78716c', fontWeight: 500 }}>
                        {publicPassportStamps.length} {publicPassportStamps.length === 1 ? 'country' : 'countries'} collected
                      </div>
                      {publicPassportStamps.length > 0 && (
                        <div style={{ marginTop: '6px', display: 'flex', gap: '5px', alignItems: 'center' }}>
                          {publicPassportStamps.slice(0, 8).map((st, idx) => (
                            <div key={idx} style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: st.color, border: '1.5px solid #ffffff', boxShadow: '0 0 0 1px #e7e5e4', flexShrink: 0 }} />
                          ))}
                          {publicPassportStamps.length > 8 && (
                            <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#a8a29e' }}>+{publicPassportStamps.length - 8}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <ArrowRight style={{ width: '15px', height: '15px', color: '#a8a29e', flexShrink: 0 }} />
                  </div>
                </div>

                {uniqueCities.length > 1 && (
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px', scrollbarWidth: 'none' }}>
                    <button
                      onClick={() => {
                        triggerHaptic(6);
                        setProfileCityFilter('All');
                      }}
                      style={{
                        backgroundColor: profileCityFilter === 'All' ? '#1c1917' : '#ecebe7',
                        color: profileCityFilter === 'All' ? '#fafaf9' : '#57534e',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      All Cities ({viewingProfileSpots.length})
                    </button>
                    {uniqueCities.map((city) => (
                      <button
                        key={city}
                        onClick={() => {
                          triggerHaptic(6);
                          setProfileCityFilter(city);
                        }}
                        style={{
                          backgroundColor: profileCityFilter.toLowerCase() === city.toLowerCase() ? '#1c1917' : '#ecebe7',
                          color: profileCityFilter.toLowerCase() === city.toLowerCase() ? '#fafaf9' : '#57534e',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '5px 10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        📍 {city}
                      </button>
                    ))}
                  </div>
                )}

                {viewingProfile.is_private ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '28px 16px', textAlign: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#ecebe7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#78716c' }}>
                      <Lock style={{ width: '22px', height: '22px' }} />
                    </div>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#78716c', lineHeight: 1.45 }}>
                      This curator keeps their journal private.
                    </p>
                  </div>
                ) : (
                  <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: '#ecebe7', borderRadius: '12px', padding: '3px', border: '1px solid #e7e5e4', marginBottom: '10px' }}>
                  <button onClick={() => { triggerHaptic(4); setProfileTab('pins'); }} style={{ border: 'none', padding: '7px 4px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', backgroundColor: profileTab === 'pins' ? '#ffffff' : 'transparent', color: profileTab === 'pins' ? '#e05a47' : '#78716c', boxShadow: profileTab === 'pins' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>Pins ({viewingProfileSpots.length})</button>
                  <button onClick={() => { triggerHaptic(4); setProfileTab('comments'); }} style={{ border: 'none', padding: '7px 4px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', backgroundColor: profileTab === 'comments' ? '#ffffff' : 'transparent', color: profileTab === 'comments' ? '#e05a47' : '#78716c', boxShadow: profileTab === 'comments' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>Comments ({viewingProfileComments.length})</button>
                </div>

                {profileTab === 'comments' ? (
                  <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '2px' }}>
                    {viewingProfileComments.length === 0 ? (
                      <p style={{ margin: '20px 0', fontSize: '13px', color: '#a8a29e', textAlign: 'center' }}>No comments yet.</p>
                    ) : (
                      viewingProfileComments.map((c) => {
                        const parentSpot = spots.find((s) => s.id === c.spot_id);
                        return (
                          <div
                            key={c.id}
                            className="spot-card-hover"
                            onClick={() => { if (parentSpot) { triggerHaptic(8); dismissModalWithHistory(() => setViewingProfile(null)); flyToSpot(parentSpot); } }}
                            style={{ padding: '12px 14px', borderRadius: '16px', border: '1px solid #e7e5e4', backgroundColor: '#ffffff', cursor: parentSpot ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: '6px' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ display: 'inline-block', backgroundColor: '#ecebe7', color: '#57534e', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px' }}>
                                {parentSpot ? parentSpot.name : 'Removed spot'}
                              </span>
                              <span style={{ fontSize: '10.5px', color: '#a8a29e', fontWeight: 500 }}>{formatRelativeTime(c.created_at)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#059669', backgroundColor: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>{c.tag || '[Tip]'}</span>
                              <span style={{ fontSize: '10px', fontWeight: 600, color: '#a8a29e' }}>▲ {c.upvotes || 0}</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '12.5px', color: '#44403c', lineHeight: 1.4, wordBreak: 'break-word' }}>{c.content}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '2px' }}>
                  {filteredProfileSpots.length === 0 ? (
                    <p style={{ margin: '20px 0', fontSize: '13px', color: '#a8a29e', textAlign: 'center' }}>No public pins found.</p>
                  ) : (
                    filteredProfileSpots.map((s) => (
                      <div
                        key={s.id || s.name}
                        className="spot-card-hover"
                        style={{ padding: '12px 14px', borderRadius: '16px', border: '1px solid #e7e5e4', backgroundColor: '#ffffff', display: 'flex', gap: '12px', alignItems: 'center', boxShadow: '0 2px 8px rgba(28, 25, 23, 0.03)' }}
                      >
                        {s.image_url ? (
                          <img src={s.image_url} alt={s.name} style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: '56px', height: '56px', borderRadius: '12px', backgroundColor: '#ecebe7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a8a29e', flexShrink: 0 }}>
                            <MapPin style={{ width: '22px', height: '22px' }} />
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{ display: 'inline-block', backgroundColor: `${getCategoryColor(s.category)}18`, color: getCategoryColor(s.category), fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px' }}>
                              {s.category}
                            </span>
                            <span style={{ fontSize: '10.5px', color: '#a8a29e', fontWeight: 500 }}>
                              {formatRelativeTime(s.created_at)}
                            </span>
                          </div>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</h4>
                          <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: '#78716c' }}>
                            {s.city}{s.country ? ` · ${s.country}` : ''}
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            triggerHaptic(8);
                            dismissModalWithHistory(() => setViewingProfile(null));
                            flyToSpot(s);
                          }}
                          style={{
                            backgroundColor: '#ecebe7',
                            color: '#1c1917',
                            border: '1px solid #d6d3d1',
                            borderRadius: '10px',
                            padding: '7px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            flexShrink: 0,
                          }}
                          title="View on Map"
                        >
                          Map <ExternalLink style={{ width: '10px', height: '10px' }} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                )}
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* Universal Share Modal */}
        {(shareDialogSpot || shareDialogCustomUrl) && (
          <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100004, padding: '16px' }}>
            <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.28)', width: '100%', maxWidth: '360px', padding: '24px', position: 'relative', boxSizing: 'border-box' }}>
              <button onClick={() => dismissModalWithHistory(() => { setShareDialogSpot(null); setShareDialogCustomUrl(''); })} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '4px' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>
                {shareDialogCustomTitle || (shareDialogSpot ? `Share Spot: ${shareDialogSpot.name}` : 'Share Bywayr')}
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: '#78716c' }}>
                Send to friends or across social messaging apps:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${shareDialogCustomText || (shareDialogSpot ? `Check out ${shareDialogSpot.name} in ${shareDialogSpot.city} on Bywayr!` : 'Check out Bywayr!')} ${shareDialogCustomUrl || (shareDialogSpot ? `${window.location.origin}${window.location.pathname}?spot=${shareDialogSpot.id}` : window.location.origin)}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textDecoration: 'none', color: '#1c1917', fontSize: '11px', fontWeight: 600 }}
                >
                  <div style={{ width: '46px', height: '46px', borderRadius: '14px', backgroundColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                    <MessageCircle style={{ width: '22px', height: '22px' }} />
                  </div>
                  WhatsApp
                </a>

                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(shareDialogCustomUrl || (shareDialogSpot ? `${window.location.origin}${window.location.pathname}?spot=${shareDialogSpot.id}` : window.location.origin))}&text=${encodeURIComponent(shareDialogCustomText || (shareDialogSpot ? `Check out ${shareDialogSpot.name} in ${shareDialogSpot.city} on Bywayr!` : 'Check out Bywayr!'))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textDecoration: 'none', color: '#1c1917', fontSize: '11px', fontWeight: 600 }}
                >
                  <div style={{ width: '46px', height: '46px', borderRadius: '14px', backgroundColor: '#0088cc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                    <Send style={{ width: '20px', height: '20px' }} />
                  </div>
                  Telegram
                </a>

                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareDialogCustomText || (shareDialogSpot ? `Check out ${shareDialogSpot.name} in ${shareDialogSpot.city} on Bywayr!` : 'Check out Bywayr!'))}&url=${encodeURIComponent(shareDialogCustomUrl || (shareDialogSpot ? `${window.location.origin}${window.location.pathname}?spot=${shareDialogSpot.id}` : window.location.origin))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textDecoration: 'none', color: '#1c1917', fontSize: '11px', fontWeight: 600 }}
                >
                  <div style={{ width: '46px', height: '46px', borderRadius: '14px', backgroundColor: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  Post
                </a>

                <a
                  href={`mailto:?subject=${encodeURIComponent(shareDialogCustomTitle || (shareDialogSpot ? `Bywayr Spot: ${shareDialogSpot.name}` : 'Bywayr Field Journal'))}&body=${encodeURIComponent(`${shareDialogCustomText || 'Check this out on Bywayr'}: ${shareDialogCustomUrl || (shareDialogSpot ? `${window.location.origin}${window.location.pathname}?spot=${shareDialogSpot.id}` : window.location.origin)}`)}`}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textDecoration: 'none', color: '#1c1917', fontSize: '11px', fontWeight: 600 }}
                >
                  <div style={{ width: '46px', height: '46px', borderRadius: '14px', backgroundColor: '#ea4335', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                    <Mail style={{ width: '20px', height: '20px' }} />
                  </div>
                  Email
                </a>
              </div>

              <button
                onClick={async () => {
                  triggerHaptic(10);
                  const url = shareDialogCustomUrl || (shareDialogSpot ? `${window.location.origin}${window.location.pathname}?spot=${shareDialogSpot.id}` : window.location.origin);
                  await navigator.clipboard.writeText(url);
                  setShareDialogCopied(true);
                  setTimeout(() => setShareDialogCopied(false), 2500);
                }}
                style={{
                  width: '100%',
                  backgroundColor: shareDialogCopied ? '#ecfdf5' : '#ecebe7',
                  color: shareDialogCopied ? '#059669' : '#1c1917',
                  border: shareDialogCopied ? '1px solid #a7f3d0' : '1px solid #e7e5e4',
                  padding: '11px',
                  borderRadius: '14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {shareDialogCopied ? <Check style={{ width: '15px', height: '15px' }} /> : <Copy style={{ width: '15px', height: '15px' }} />}
                {shareDialogCopied ? 'Link Copied to Clipboard!' : 'Copy Direct Link'}
              </button>
            </div>
          </div>
        )}

        {/* Slide-Out Drawer (Notes, Must-Try & Essentials) */}
        {(isDrawerOpen || isDrawerClosing) && (
          <div 
            className={isDrawerClosing ? 'backdrop-exit' : 'backdrop-enter'}
            style={{ 
              position: 'fixed', 
              inset: 0, 
              backgroundColor: 'rgba(28, 25, 23, 0.45)', 
              backdropFilter: 'blur(6px)', 
              WebkitBackdropFilter: 'blur(6px)', 
              transform: 'translateZ(0)',
              zIndex: 100000, 
              display: 'flex', 
              justifyContent: 'flex-start', 
              pointerEvents: 'none',
            }}
          >
            <div 
              className={isDrawerClosing ? 'drawer-left-exit' : 'drawer-left-enter'}
              style={{ 
                width: '100%', 
                maxWidth: '370px', 
                pointerEvents: 'auto', 
                backgroundColor: isDarkMode ? 'rgba(22, 20, 18, 0.74)' : 'rgba(255, 255, 255, 0.72)', 
                backdropFilter: 'blur(28px) saturate(190%)',
                WebkitBackdropFilter: 'blur(28px) saturate(190%)',
                transform: 'translate3d(0, 0, 0)',
                WebkitTransform: 'translate3d(0, 0, 0)',
                borderRight: isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.85)',
                height: '100%', 
                maxHeight: '100dvh',
                boxShadow: '10px 0 40px rgba(0, 0, 0, 0.22)', 
                display: 'flex', 
                flexDirection: 'column', 
                padding: 'clamp(14px, 4vw, 20px)', 
                boxSizing: 'border-box', 
                overflow: 'hidden', 
              }}
            >
              <div className="animate-slide-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0, animationDelay: '0.04s' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>
                  {drawerTab === 'fieldNotes' 
                    ? 'Field Notes' 
                    : drawerTab === 'mustTry' ? 'Must-Try' : 'Travel Essentials'}
                </h2>
                <button onClick={handleCloseDrawer} style={{ border: 'none', background: '#ecebe7', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>

              <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px', flexShrink: 0, animationDelay: '0.08s' }}>
                {/* Primary Category Switcher */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', backgroundColor: '#f5f5f4', borderRadius: '14px', padding: '3px', width: '100%', border: '1px solid #e7e5e4' }}>
                  <button onClick={() => setDrawerTab('fieldNotes')} style={{ border: 'none', padding: '7px 4px', borderRadius: '11px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', backgroundColor: drawerTab === 'fieldNotes' ? '#ffffff' : 'transparent', color: drawerTab === 'fieldNotes' ? '#1c1917' : '#78716c', boxShadow: drawerTab === 'fieldNotes' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none', whiteSpace: 'nowrap' }}>Notes</button>
                  <button onClick={() => { if (!currentUserRef.current) { setIsAuthModalOpen(true); pushModalHistoryState('auth'); return; } setDrawerTab('mustTry'); }} style={{ border: 'none', padding: '7px 4px', borderRadius: '11px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', backgroundColor: drawerTab === 'mustTry' ? '#ffffff' : 'transparent', color: drawerTab === 'mustTry' ? '#1c1917' : '#78716c', boxShadow: drawerTab === 'mustTry' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none', whiteSpace: 'nowrap' }}>Must-Try</button>
                  <button onClick={() => setDrawerTab('essentials')} style={{ border: 'none', padding: '7px 4px', borderRadius: '11px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', backgroundColor: drawerTab === 'essentials' ? '#ffffff' : 'transparent', color: drawerTab === 'essentials' ? '#1c1917' : '#78716c', boxShadow: drawerTab === 'essentials' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none', whiteSpace: 'nowrap' }}>Essentials</button>
                </div>

                {/* Sub-Filter & Sort Controls Combined */}
                {drawerTab === 'fieldNotes' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    {/* Compact Sort Toggle */}
                    <button
                      onClick={() => {
                        triggerHaptic(4);
                        const nextMode = drawerSortMode === 'nearest' ? 'recent' : 'nearest';
                        setDrawerSortMode(nextMode);
                        if (nextMode === 'nearest' && !userCoords && typeof navigator !== 'undefined' && navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                            () => {},
                            { enableHighAccuracy: true, timeout: 5000 }
                          );
                        }
                      }}
                      style={{
                        border: '1px solid #e7e5e4',
                        backgroundColor: '#f5f5f4',
                        borderRadius: '10px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#57534e',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <SlidersHorizontal style={{ width: '12px', height: '12px', color: '#e05a47' }} />
                      <span>{drawerSortMode === 'nearest' ? 'Nearest' : 'Newest'}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="animate-slide-up" style={{ overflowY: 'auto', flex: '1 1 0%', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '8px', scrollbarWidth: 'thin', paddingRight: '2px', paddingBottom: '16px', animationDelay: '0.16s' }}>
                {drawerTab === 'essentials' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
                    {!Capacitor.isNativePlatform() && (
                      <a
                        href="https://play.google.com/store/apps/details?id=com.bywayr.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          backgroundColor: '#1c1917',
                          borderRadius: '14px',
                          color: '#ffffff',
                          textDecoration: 'none',
                          boxShadow: '0 4px 12px rgba(28, 25, 23, 0.15)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#292524', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                              <path d="M3.609 1.814L13.792 12 3.61 22.186a2.016 2.016 0 0 1-.61-.955V2.77c0-.36.143-.706.609-.956z" fill="#00D7FF"/>
                              <path d="M17.18 8.614l-3.388 3.386 3.388 3.386 3.844-2.183c1.096-.623 1.096-1.966 0-2.589L17.18 8.614z" fill="#FFD400"/>
                              <path d="M3.609 1.814l10.183 10.186 3.388-3.386L7.145.487C6.05-.136 4.704-.136 3.609 1.814z" fill="#00F076"/>
                              <path d="M13.792 12L3.609 22.186c1.095 1.95 2.441 1.95 3.536 1.327l10.035-7.9L13.792 12z" fill="#FF3A44"/>
                            </svg>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#a8a29e', fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1.1 }}>GET IT ON</span>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: '#fafaf9', lineHeight: 1.2 }}>Google Play</span>
                          </div>
                        </div>
                        <ArrowRight style={{ width: '15px', height: '15px', color: '#a8a29e', flexShrink: 0 }} />
                      </a>
                    )}

                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px' }}>
                      Curated Booking Tools
                    </div>

                    <a href="https://aviasales.tpk.lv/Y7mdLlKw" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '14px', color: '#1c1917', textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e7e5e4', flexShrink: 0 }}>
                          <Plane style={{ width: '18px', height: '18px', color: '#e05a47' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1c1917', lineHeight: 1.2 }}>Aviasales</span>
                          <span style={{ fontSize: '11.5px', color: '#78716c', fontWeight: 500 }}>Compare & search global flight deals</span>
                        </div>
                      </div>
                      <ArrowRight style={{ width: '14px', height: '14px', color: '#a8a29e', flexShrink: 0 }} />
                    </a>

                    <a href="https://saily.tpk.lv/DWenwZYZ" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '14px', color: '#1c1917', textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e7e5e4', flexShrink: 0 }}>
                          <img src="/saily.svg" alt="Saily" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1c1917', lineHeight: 1.2 }}>Saily eSIM</span>
                          <span style={{ fontSize: '11.5px', color: '#78716c', fontWeight: 500 }}>Affordable instant mobile data worldwide</span>
                        </div>
                      </div>
                      <ArrowRight style={{ width: '14px', height: '14px', color: '#a8a29e', flexShrink: 0 }} />
                    </a>

                    <a href="https://klook.tpk.lv/sZHsJIxR" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '14px', color: '#1c1917', textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e7e5e4', flexShrink: 0 }}>
                          <img src="/klook.svg" alt="Klook" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1c1917', lineHeight: 1.2 }}>Klook Experiences</span>
                          <span style={{ fontSize: '11.5px', color: '#78716c', fontWeight: 500 }}>Attraction passes, transit tickets & tours</span>
                        </div>
                      </div>
                      <ArrowRight style={{ width: '14px', height: '14px', color: '#a8a29e', flexShrink: 0 }} />
                    </a>
                  </div>
                ) : (
                  displayedDrawerSpots.flatMap((spot: Spot, idx: number) => {
                    const color = getCategoryColor(spot.category);
                    const refPoint = userCoords || (map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 });
                    const refLat = 'lat' in refPoint ? refPoint.lat : 36.1699;
                    const refLng = 'lng' in refPoint ? refPoint.lng : -115.1398;
                    const distanceVal = getDistanceFromLatLonInKm(refLat, refLng, spot.latitude, spot.longitude);
                    const distanceText =
                      distanceVal < 1
                        ? `${Math.round(distanceVal * 1000)}m away`
                        : distanceVal < 100
                        ? `${distanceVal.toFixed(1)}km away`
                        : distanceVal < 1000
                        ? `${Math.round(distanceVal)}km away`
                        : `${Math.round(distanceVal / 1000)}k km`;

                    const showHeaders = drawerTab === 'fieldNotes' && drawerSortMode === 'nearest';
                    let header = null;
                    if (showHeaders && idx === 0) {
                      header = (
                        <div key={`header-nearby`} style={{ fontSize: '11px', fontWeight: 700, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px' }}>
                          Field Notes Nearby
                        </div>
                      );
                    } else if (showHeaders && idx === firstFarIndex) {
                      header = (
                        <div key={`header-far`} style={{ fontSize: '11px', fontWeight: 700, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px' }}>
                          Further Afield
                        </div>
                      );
                    }

                    // Native ads disabled: @capacitor-community/admob v8.1.0 does not support prepareNativeAd
                    // Re-enable this block when the plugin ships native ad support
                    const showNativeAd = false && !isPlusSubscriber && idx === 3 && nativeAdLoaded;
                    const adCard = showNativeAd ? (
                      <div
                        key="native-ad-slot"
                        className="spot-card-hover"
                        style={{
                          padding: '12px 13px',
                          borderRadius: '14px',
                          border: '1px solid #e7e5e4',
                          backgroundColor: '#fafaf9',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          cursor: 'pointer',
                          flexShrink: 0,
                          position: 'relative',
                        }}
                        onClick={() => {
                          try {
                            const adAny = nativeAd as any;
                            if (adAny && typeof adAny.clicked === 'function') adAny.clicked();
                          } catch (err) {
                            console.warn('Native ad click failed:', err);
                          }
                        }}
                      >
                        {/* Ad Label */}
                        <div style={{ 
                          position: 'absolute', 
                          top: '4px', 
                          right: '4px', 
                          fontSize: '9px', 
                          fontWeight: 700, 
                          color: '#a8a29e', 
                          textTransform: 'uppercase' 
                        }}>
                          Ad
                        </div>

                        {/* Media Image */}
                        {nativeAd?.icon?.url && (
                          <img
                            src={nativeAd.icon.url}
                            alt="Ad"
                            style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                          />
                        )}

                        {/* Text Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {nativeAd?.headline || 'Discover Local Deals'}
                            </h4>
                            <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '6px' }}>
                              Sponsored
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '11px', color: '#78716c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {nativeAd?.body || 'Sponsored travel offers nearby'}
                          </p>
                        </div>

                        {/* Call to Action */}
                        {nativeAd?.callToAction && (
                          <button style={{ 
                            backgroundColor: '#e05a47', 
                            color: '#fff', 
                            border: 'none', 
                            borderRadius: '8px', 
                            padding: '6px 10px', 
                            fontSize: '11px', 
                            fontWeight: 600,
                            flexShrink: 0
                          }}>
                            {nativeAd.callToAction}
                          </button>
                        )}
                      </div>
                    ) : null;

                    return [
                      ...(header ? [header] : []),
                      ...(adCard ? [adCard] : []),
                      (
                      <div
                        key={spot.id || spot.name}
                        onClick={() => {
                          triggerHaptic(8);
                          setIsDrawerClosing(true);
                          setTimeout(() => {
                            setIsDrawerOpen(false);
                            setIsDrawerClosing(false);
                          }, 240);
                          flyToSpot(spot);
                        }}
                        className="spot-card-hover"
                        style={{
                          padding: '12px 13px',
                          borderRadius: '14px',
                          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.9)',
                          backgroundColor: isDarkMode ? 'rgba(34, 30, 27, 0.60)' : 'rgba(255, 255, 255, 0.65)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          cursor: 'pointer',
                          flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(28, 25, 23, 0.04)',
                        }}
                      >
                        {spot.image_url && (
                          <img
                            src={spot.image_url}
                            alt={spot.name}
                            style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                          />
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <h4
                              style={{
                                margin: 0,
                                fontSize: '13px',
                                fontWeight: 700,
                                color: '#1c1917',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {spot.name}
                            </h4>
                            {distanceText && (
                              <span style={{ fontSize: '10px', fontWeight: 600, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '2px 6px', borderRadius: '6px', flexShrink: 0 }}>
                                {distanceText}
                              </span>
                            )}
                          </div>
                          <p
                            style={{
                              margin: 0,
                              fontSize: '11px',
                              color: '#78716c',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {spot.city} · <span style={{ color, fontWeight: 600 }}>{spot.category}</span> · <span style={{ color: '#a8a29e' }}>{formatRelativeTime(spot.created_at)}</span>
                          </p>
                        </div>
                      </div>
                      ),
                    ];
                  })
                )}
              </div>
            </div>
          </div>
        )}
        {/* 6. Field Journal Slide-Up Sheet (Mobile: Slide-Up / Desktop: Elevated Card) */}
        {(isProfileModalOpen || isProfileClosing) && (
          <div
            className="animate-fade-in"
            onClick={handleCloseProfileDrawer}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(28, 25, 23, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: isMobileLayout ? 'flex-end' : 'center',
              justifyContent: 'center',
              zIndex: 100005,
              padding: isMobileLayout ? 0 : '16px',
              boxSizing: 'border-box',
              pointerEvents: 'auto',
            }}
          >
            <div
              className="animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: isDarkMode ? 'rgba(30, 28, 26, 0.95)' : 'rgba(255, 255, 255, 0.94)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: `1px solid ${uiBorder}`,
                width: '100%',
                maxWidth: isMobileLayout ? '480px' : '440px',
                height: isMobileLayout ? '86dvh' : 'auto',
                maxHeight: isMobileLayout ? '88dvh' : '90vh',
                borderRadius: isMobileLayout ? '28px 28px 0 0' : '28px',
                boxShadow: isMobileLayout ? '0 -10px 40px rgba(28, 25, 23, 0.28)' : '0 25px 50px -12px rgba(28, 25, 23, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxSizing: 'border-box',
                overflow: 'hidden',
                animation: isProfileClosing ? (isMobileLayout ? 'slideDownOut 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'fadeScaleDown 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards') : undefined,
              }}
            >
              {/* Drag pill for mobile sheet */}
              {isMobileLayout && (
                <div
                  onClick={handleCloseProfileDrawer}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    paddingTop: '10px',
                    paddingBottom: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: '38px', height: '4px', borderRadius: '2px', backgroundColor: '#d6d3d1' }} />
                </div>
              )}

              {/* Distinct Top Title Header Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: isMobileLayout ? '8px 20px 10px 20px' : '16px 22px 10px 22px',
                  borderBottom: '1px solid #f0ede8',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: '#fff1ee',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#e05a47',
                      flexShrink: 0,
                    }}
                  >
                    <Book style={{ width: '15px', height: '15px' }} />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#1c1917', letterSpacing: '-0.02em' }}>
                    Field Journal
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleCloseProfileDrawer}
                  style={{
                    border: 'none',
                    background: '#ecebe7',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    color: '#78716c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  title="Close Journal"
                >
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>

              {/* Profile Bio & Stats Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 22px 0 22px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#fff1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05a47', overflow: 'hidden', flexShrink: 0, border: '2px solid #e7e5e4' }}>
                  {userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '24px', fontWeight: 700 }}>{((userProfile?.username || 'E')[0]).toUpperCase()}</span>
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    @{userProfile?.username || 'wanderer'}
                    {isPlusSubscriber && <Crown style={{ width: '15px', height: '15px', color: '#d97706' }} />}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#78716c', fontWeight: 500 }}>
                    {userProfile?.country || 'Wanderer'} · Member
                  </p>
                </div>
                <button
                  onClick={() => {
                    triggerHaptic(8);
                    setEditUsernameValue(userProfile?.username || '');
                    setEditCountryValue(userProfile?.country || 'United States');
                    setEditBioValue(userProfile?.bio || '');
                    setEditYoutubeUrl(userProfile?.youtube_url || '');
                    setEditInstagramUrl(userProfile?.instagram_url || '');
                    setEditFacebookUrl(userProfile?.facebook_url || '');
                    setEditWebsiteUrl(userProfile?.website_url || '');
                    setEditProfileError('');
                    setIsEditProfileOpen(true);
                  }}
                  style={{ border: '1px solid #d6d3d1', background: '#ffffff', borderRadius: '16px', padding: '7px 13px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#1c1917', flexShrink: 0 }}
                >
                  Edit Profile
                </button>
              </div>

              {/* Stats — neutral like Reddit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '14px 22px', textAlign: 'center', borderBottom: '1px solid #e7e5e4' }}>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#1c1917' }}>{mySpotsCount}</div>
                  <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Pins</div>
                </div>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#1c1917' }}>{myCitiesCount}</div>
                  <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Cities</div>
                </div>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#1c1917' }}>{myCountriesCount}</div>
                  <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Countries</div>
                </div>
              </div>

              {/* Tab Bar (Balanced 3 Tabs) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', backgroundColor: '#ecebe7', borderRadius: '12px', padding: '3px', margin: '12px 22px 0 22px', border: '1px solid #e7e5e4' }}>
                {(['overview', 'spots', 'musttry'] as const).map((t) => (
                  <button key={t} onClick={() => { triggerHaptic(4); setJournalTab(t); }} style={{ border: 'none', padding: '7px 4px', borderRadius: '9px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', backgroundColor: journalTab === t ? '#ffffff' : 'transparent', color: journalTab === t ? '#e05a47' : '#78716c', boxShadow: journalTab === t ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>
                    {t === 'overview' ? 'Overview' : t === 'spots' ? `My Pins (${mySpotsCount})` : `Must-Try (${mustTrySpotIds.length})`}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 22px 8px 22px' }}>
                {journalTab === 'overview' && (
                  <>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>About</div>
                      <p style={{ margin: 0, fontSize: '12.5px', color: '#44403c', lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {userProfile?.bio || 'Wanderer & local spot hunter. Add a bio from Edit Profile to tell fellow wanderers what you hunt for.'}
                      </p>
                    </div>
                    {(userProfile?.youtube_url || userProfile?.instagram_url || userProfile?.facebook_url || userProfile?.website_url) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                        {userProfile.youtube_url && (
                          <a href={userProfile.youtube_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', padding: '4px 9px', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                            <IconYoutube size={13} /> YouTube
                        </a>
                      )}
                      {userProfile.instagram_url && (
                        <a href={userProfile.instagram_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fce7f3', color: '#db2777', border: '1px solid #f9a8d4', borderRadius: '8px', padding: '4px 9px', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                          <IconInstagram size={13} /> Instagram
                      </a>
                      )}
                      {userProfile.facebook_url && (
                        <a href={userProfile.facebook_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '4px 9px', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                          <IconFacebook size={13} /> Facebook
                      </a>
                      )}
                      {userProfile.website_url && (
                        <a href={userProfile.website_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fff1ee', color: '#e05a47', border: '1px solid #fecdd3', borderRadius: '8px', padding: '4px 9px', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                          <LinkIcon size={13} /> Website
                      </a>
                      )}
                    </div>
                  )}
                    <button
                      onClick={() => {
                        triggerHaptic(8);
                        setIsProfileModalOpen(false);
                        setViewingPassportSpots(myUserSpots);
                        setViewingPassportProfile(null);
                        setPassportBookPage(0);
                        setIsPassportBookOpen(true);
                        pushModalHistoryState('passportBook');
                      }}
                      style={{
                        border: '1px solid #fecdd3',
                        background: '#fff1ee',
                        borderRadius: '12px',
                        padding: '11px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        color: '#e05a47',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Compass style={{ width: '15px', height: '15px' }} />
                        <span>Open Passport Booklet ({myCountriesCount} Stamps)</span>
                      </div>
                      <ChevronRight style={{ width: '15px', height: '15px' }} />
                    </button>

                    <button onClick={handleShareFieldJournal} style={{ border: '1px solid #e7e5e4', background: '#fafaf9', borderRadius: '12px', padding: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#57534e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Share2 style={{ width: '14px', height: '14px' }} /> Share My Field Journal
                    </button>
                  </>
                )}

                {journalTab === 'spots' && (
                  myNotesSpots.length === 0 ? (
                    <p style={{ margin: '20px 0', fontSize: '12.5px', color: '#a8a29e', textAlign: 'center' }}>No pins yet. Tap + on the map to drop your first spot.</p>
                  ) : myNotesSpots.map((s) => (
                    <div key={s.id || s.name} className="spot-card-hover" onClick={() => { triggerHaptic(8); handleCloseProfileDrawer(); flyToSpot(s); }} style={{ padding: '11px 13px', borderRadius: '14px', border: '1px solid #e7e5e4', backgroundColor: '#ffffff', display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer' }}>
                      <span style={{ display: 'inline-block', backgroundColor: `${getCategoryColor(s.category)}18`, color: getCategoryColor(s.category), fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', flexShrink: 0 }}>{s.category}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</h4>
                        <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: '#78716c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.city}{s.country ? ` · ${s.country}` : ''}</p>
                      </div>
                      <ExternalLink style={{ width: '13px', height: '13px', color: '#a8a29e', flexShrink: 0 }} />
                    </div>
                  ))
                )}

                {journalTab === 'musttry' && (
                  mustTryList.length === 0 ? (
                    <p style={{ margin: '20px 0', fontSize: '12.5px', color: '#a8a29e', textAlign: 'center' }}>Nothing saved yet. Bookmark spots as Must-Try from their detail sheet.</p>
                  ) : mustTryList.map((s) => (
                    <div key={s.id || s.name} className="spot-card-hover" onClick={() => { triggerHaptic(8); handleCloseProfileDrawer(); flyToSpot(s); }} style={{ padding: '11px 13px', borderRadius: '14px', border: '1px solid #e7e5e4', backgroundColor: '#ffffff', display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer' }}>
                      <span style={{ display: 'inline-block', backgroundColor: `${getCategoryColor(s.category)}18`, color: getCategoryColor(s.category), fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', flexShrink: 0 }}>{s.category}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</h4>
                        <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: '#78716c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.city}{s.country ? ` · ${s.country}` : ''}</p>
                      </div>
                      <ExternalLink style={{ width: '13px', height: '13px', color: '#a8a29e', flexShrink: 0 }} />
                    </div>
                  ))
                )}
              </div>

              {/* Footer: Settings Gear + Plus banner */}
              <div style={{ padding: '10px 22px calc(14px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid #e7e5e4', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={() => { triggerHaptic(6); setIsJournalSettingsOpen(!isJournalSettingsOpen); }} style={{ width: '36px', height: '36px', border: '1px solid #e7e5e4', background: '#fafaf9', borderRadius: '50%', cursor: 'pointer', color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} title="Settings">
                  <SlidersHorizontal style={{ width: '16px', height: '16px' }} />
                </button>
                {isPlusSubscriber ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '8px 12px', fontSize: '11.5px', fontWeight: 700, color: '#059669' }}>
                    <Crown style={{ width: '14px', height: '14px' }} /> Bywayr Plus Active
                  </div>
                ) : (
                  <button onClick={() => { triggerHaptic(8); setIsPlusModalOpen(true); pushModalHistoryState('plusModal'); }} style={{ flex: 1, backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '8px 12px', fontSize: '11.5px', fontWeight: 600, color: '#92400e', cursor: 'pointer', textAlign: 'left' }}>
                    Bywayr Plus — custom categories, export, ad-free · <strong>Upgrade</strong>
                  </button>
                )}
              </div>

              {/* Settings Sheet */}
              {isJournalSettingsOpen && (
                <div className="animate-slide-up" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fafaf9', borderTop: '2px solid #e7e5e4', borderRadius: '24px 24px 0 0', padding: '16px 22px calc(18px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -10px 30px rgba(28, 25, 23, 0.12)', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1c1917' }}>Settings</span>
                    <button onClick={() => setIsJournalSettingsOpen(false)} style={{ border: 'none', background: '#ecebe7', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X style={{ width: '15px', height: '15px' }} />
                    </button>
                  </div>

                  {isPlusSubscriber ? (
                    <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '5px' }}><Crown style={{ width: '13px', height: '13px' }} /> Bywayr Plus Active</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleExportJournal} style={{ flex: 1, border: '1px solid #e7e5e4', background: '#ffffff', borderRadius: '10px', padding: '8px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', color: '#44403c' }}>Export JSON</button>
                        <button onClick={handleExportGpx} style={{ flex: 1, border: '1px solid #e7e5e4', background: '#ffffff', borderRadius: '10px', padding: '8px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', color: '#44403c' }}>Export GPX</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { triggerHaptic(8); setIsJournalSettingsOpen(false); setIsPlusModalOpen(true); pushModalHistoryState('plusModal'); }} style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px', fontSize: '12px', fontWeight: 600, color: '#92400e', cursor: 'pointer', textAlign: 'left' }}>
                      <strong>Upgrade to Bywayr Plus</strong> — custom categories, journal export, ad-free exploring
                    </button>
                  )}

                  <button onClick={handleTogglePrivacy} disabled={savingPrivacy} style={{ border: '1px solid #e7e5e4', background: '#ffffff', borderRadius: '12px', padding: '11px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#44403c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Lock style={{ width: '13px', height: '13px' }} /> Private journal &amp; comments</span>
                    <span style={{ width: '34px', height: '20px', borderRadius: '10px', backgroundColor: userProfile?.is_private ? '#e05a47' : '#d6d3d1', position: 'relative' }}>
                      <span style={{ position: 'absolute', top: '2px', left: userProfile?.is_private ? '16px' : '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ffffff', transition: 'left 0.2s ease' }} />
                    </span>
                  </button>

                  <button onClick={handleSignOut} style={{ border: '1px solid #e7e5e4', background: '#ffffff', borderRadius: '12px', padding: '11px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#44403c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <LogOut style={{ width: '13px', height: '13px' }} /> Sign Out
                  </button>
                  <button onClick={() => { triggerHaptic(8); setIsDeleteAccountModalOpen(true); }} style={{ border: '1px solid #fecdd3', background: '#fff1ee', borderRadius: '12px', padding: '11px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#e05a47', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Trash2 style={{ width: '13px', height: '13px' }} /> Delete Account
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      {/* Bywayr Plus Upgrade Modal */}
        {isPlusModalOpen && (
          <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.65)', backdropFilter: 'blur(8px)', animation: isPlusClosing ? 'fadeOut 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards' : undefined, WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100035, padding: '16px', pointerEvents: 'none' }}>
            <div className="animate-scale-up" style={{ backgroundColor: '#faf8f5', borderRadius: '32px', boxShadow: '0 30px 60px -15px rgba(28, 25, 23, 0.45)', width: '100%', maxWidth: '380px', padding: '24px 22px 20px 22px', position: 'relative', boxSizing: 'border-box', border: '1px solid #f0ece1', maxHeight: '90vh', overflowY: 'auto', pointerEvents: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1c1917', letterSpacing: '-0.02em' }}>
                  Bywayr Plus
                </h3>
                <button
                  onClick={() => {
                    setIsPlusClosing(true);
                    setTimeout(() => {
                      dismissModalWithHistory(() => { setIsPlusModalOpen(false); setIsPlusClosing(false); });
                    }, 240);
                  }}
                  style={{ border: 'none', background: '#ecebe7', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '18px 0 14px 0' }}>
                <div style={{ width: '84px', height: '84px', borderRadius: '28px', overflow: 'hidden', backgroundColor: '#fff1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 28px -6px rgba(224, 90, 71, 0.28)', marginBottom: '8px', border: '2px solid rgba(224, 90, 71, 0.2)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/bywayr-plus.png" alt="Bywayr Plus" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#a8a29e', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.5 }}>
                  Annual Curator Pass includes custom categories,<br />journal export, and ad-free exploring
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '10px 0 20px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#e7e5e4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#44403c', flexShrink: 0, marginTop: '2px' }}>
                    <Tag style={{ width: '15px', height: '15px' }} />
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#44403c', lineHeight: 1.4, fontWeight: 500 }}>
                    <strong style={{ color: '#1c1917' }}>Custom Categories & Tagging</strong> — Create custom lists, accent colors, and tag any saved gem.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#e7e5e4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#44403c', flexShrink: 0, marginTop: '2px' }}>
                    <Download style={{ width: '15px', height: '15px' }} />
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#44403c', lineHeight: 1.4, fontWeight: 500 }}>
                    <strong style={{ color: '#1c1917' }}>Journal Export</strong> — Download a portable copy of your entire field journal, any time.
        </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#e7e5e4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#44403c', flexShrink: 0, marginTop: '2px' }}>
                    <ShieldCheck style={{ width: '15px', height: '15px' }} />
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#44403c', lineHeight: 1.4, fontWeight: 500 }}>
                    <strong style={{ color: '#1c1917' }}>Ad-Free Exploring</strong> — Browse the entire map with zero ads.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#e7e5e4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#44403c', flexShrink: 0, marginTop: '2px' }}>
                    <Sparkle style={{ width: '15px', height: '15px' }} />
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#44403c', lineHeight: 1.4, fontWeight: 500 }}>
                    <strong style={{ color: '#1c1917' }}>3-Day Free Trial</strong> — Cancel anytime with zero charge before trial ends.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={handleGooglePlayCheckout}
                  style={{
                    width: '100%',
                    backgroundColor: '#e05a47',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '14px',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 8px 20px -4px rgba(224, 90, 71, 0.35)',
                    letterSpacing: '0.01em',
                  }}
                >
                  Curator Pass — $19.99 Lifetime
                </button>

                {typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform() && (
                  <button
                    onClick={handleRestorePurchases}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#78716c',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '6px',
                    }}
                  >
                    Restore Purchase
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Scrollable Passport Booklet — Clean Organic Spread */}
        {(isPassportBookOpen || isBookClosing) && (() => {
          // Book can render YOUR passport or a viewed public profile's (read-only)
          const isViewingOther = !!viewingPassportProfile;
          const bookStamps = isViewingOther ? extractPassportStamps(viewingPassportSpots) : myPassportStamps;
          const bookProfile = viewingPassportProfile || userProfile;
          const bookUsername = bookProfile?.username || 'wanderer';
          const bookCountry = bookProfile?.country || 'Wanderer';
          const bookUserId = isViewingOther ? viewingPassportProfile!.id : currentUser?.id;
          const bookStats = isViewingOther
            ? { countries: bookStamps.length, pins: viewingPassportSpots.length, cities: new Set(viewingPassportSpots.map((s) => s.city.trim())).size }
            : { countries: myCountriesCount, pins: mySpotsCount, cities: myCitiesCount };
          const activeStampItems = [
            ...bookStamps.map((st, idx) => renderStampCard(st, idx, 0)),
            ...(!isPlusSubscriber && !isViewingOther ? [renderSponsoredPassportStamp(99)] : []),
          ];

          const leftPageStamps = isDesktopViewport ? activeStampItems.filter((_, i) => i % 2 === 0) : activeStampItems;
          const rightPageStamps = isDesktopViewport ? activeStampItems.filter((_, i) => i % 2 !== 0) : [];

          return (
            <div
              className="animate-fade-in"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100030,
                backgroundColor: 'rgba(28, 25, 23, 0.65)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                animation: isBookClosing ? 'fadeOut 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards' : undefined,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                boxSizing: 'border-box',
                fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                pointerEvents: 'none',
              }}
            >
              {/* Passport Book Container */}
              <div
                className={`animate-scale-up ${isBookClosing ? 'paper-exit' : ''}`}
                style={{
                  pointerEvents: 'auto',
                  width: '100%',
                  maxWidth: isDesktopViewport ? '780px' : '390px',
                  height: isDesktopViewport ? 'min(86vh, 560px)' : 'min(84vh, 600px)',
                  maxHeight: '680px',
                  backgroundColor: '#fdfbf7',
                  borderRadius: '24px',
                  boxShadow: '0 30px 70px -15px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(180, 165, 140, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                {/* Header Top Bar */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 18px',
                    borderBottom: '1px solid rgba(220, 210, 195, 0.6)',
                    backgroundColor: 'rgba(253, 251, 247, 0.95)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 10,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#fff1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05a47' }}>
                      <Compass style={{ width: '15px', height: '15px' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#1c1917', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        Passport
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#e05a47', fontFamily: 'monospace' }}>
                        {bookStamps.length} {bookStamps.length === 1 ? 'COUNTRY' : 'COUNTRIES'} LOGGED
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleClosePassportBook}
                    type="button"
                    aria-label="Close Passport"
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e7e5e4',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      cursor: 'pointer',
                      color: '#1c1917',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                    }}
                  >
                    <X style={{ width: '15px', height: '15px' }} />
                  </button>
                </div>

                {/* Full-Bleed Authentic Security Banknote Page Canvas */}
                <div
                  className="smooth-bounce-scroll"
                  style={{
                    flex: 1,
                    backgroundColor: '#fbf8f2',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    position: 'relative',
                    scrollbarWidth: 'thin',
                  }}
                >
                  {/* Full-Bleed Organic Guilloché Mesh — Terracotta page / Teal page */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      zIndex: 0,
                      overflow: 'hidden',
                      opacity: 0.85,
                    }}
                  >
                    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                      <defs>
                        <pattern id="guilloche-mesh-warm" width="58" height="62" patternUnits="userSpaceOnUse">
                          <path d="M 0 31 Q 14 2, 29 31 T 58 31" fill="none" stroke="#dda397" strokeWidth="0.55" strokeOpacity="0.4" />
                          <path d="M 0 31 Q 14 60, 29 31 T 58 31" fill="none" stroke="#dda397" strokeWidth="0.55" strokeOpacity="0.4" />
                          <circle cx="29" cy="31" r="13" fill="none" stroke="#e8c4b4" strokeWidth="0.5" strokeDasharray="2 3" strokeOpacity="0.5" />
                          <circle cx="58" cy="0" r="5" fill="none" stroke="#dda397" strokeWidth="0.4" strokeOpacity="0.28" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#guilloche-mesh-warm)" />
                    </svg>

                    {/* Rosettes organic terracotta left, teal right, intentionally imperfect */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: isDesktopViewport ? 'space-around' : 'center', alignItems: 'center' }}>
                      {/* Left Page Rosette (Terracotta) */}
                      <svg viewBox="0 0 500 500" style={{ width: isDesktopViewport ? '430px' : '340px', height: isDesktopViewport ? '430px' : '340px', flexShrink: 0 }}>
                        <g transform="translate(250, 250)" fill="none">
                          {Array.from({ length: 28 }).map((_, i) => (
                            <ellipse
                              key={`rosette-l-${i}`}
                              cx="0" cy="0"
                              rx={186 + (i % 3) * 7}
                              ry={58 + (i % 4) * 4}
                              transform={`rotate(${i * 5.625 + (i % 5) * 0.7})`}
                              stroke="#e05a47" strokeWidth="0.7"
                              strokeOpacity={0.22 + (i % 4) * 0.05}
                            />
                          ))}
                          {Array.from({ length: 14 }).map((_, i) => (
                            <circle
                              key={`circle-l-${i}`}
                              cx="0" cy="0" r={28 + i * 13}
                              stroke="#c2503f" strokeWidth="0.6"
                              strokeDasharray={i % 3 === 0 ? '4 3' : i % 3 === 1 ? '1 4' : 'none'}
                              strokeOpacity={Math.max(0.08, 0.3 - i * 0.012)}
                            />
                          ))}
                          <circle cx="0" cy="0" r="26" fill="#e05a47" fillOpacity="0.05" stroke="#e05a47" strokeWidth="0.9" strokeOpacity="0.6" />
                        </g>
                      </svg>

                      {/* Right Page Rosette (Teal, desktop only) */}
                      {isDesktopViewport && (
                        <svg viewBox="0 0 500 500" style={{ width: '430px', height: '430px', flexShrink: 0 }}>
                          <g transform="translate(250, 250)" fill="none">
                            {Array.from({ length: 26 }).map((_, i) => (
                              <ellipse
                                key={`rosette-r-${i}`}
                                cx="0" cy="0"
                                rx={188 + (i % 4) * 6}
                                ry={56 + (i % 3) * 5}
                                transform={`rotate(${i * 6.2 + (i % 3) * 1.1})`}
                                stroke="#0d9488" strokeWidth="0.7"
                                strokeOpacity={0.2 + (i % 4) * 0.045}
                              />
                            ))}
                            {Array.from({ length: 13 }).map((_, i) => (
                              <circle
                                key={`circle-r-${i}`}
                                cx="0" cy="0" r={30 + i * 12}
                                stroke="#0f766e" strokeWidth="0.6"
                                strokeDasharray={i % 3 === 0 ? '3 4' : i % 3 === 1 ? '5 2' : 'none'}
                                strokeOpacity={Math.max(0.07, 0.28 - i * 0.013)}
                              />
                            ))}
                            <circle cx="0" cy="0" r="24" fill="#0d9488" fillOpacity="0.05" stroke="#0d9488" strokeWidth="0.9" strokeOpacity="0.55" />
                          </g>
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Laser-Perforated Document Serial Numbers at Top */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: 0,
                      right: 0,
                      display: 'flex',
                      justifyContent: isDesktopViewport ? 'space-around' : 'center',
                      pointerEvents: 'none',
                      zIndex: 2,
                      padding: '0 24px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 900, color: '#0369a1', opacity: 0.42, letterSpacing: '0.35em', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                      BW · {bookUserId ? bookUserId.substring(0, 8).toUpperCase() : '84920194'}
                    </span>
                    {isDesktopViewport && (
                      <span style={{ fontSize: '11px', fontWeight: 900, color: '#0369a1', opacity: 0.42, letterSpacing: '0.35em', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                        P &lt; {(userProfile?.country || 'WANDERER').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 15) || 'WANDERER'} &lt; BYWAYR &lt;&lt; {myPassportStamps.length}
                      </span>
                    )}
                  </div>

                                {/* Bottom Official Page Number Badges ï¿½ desktop spreads only */}
                  {isDesktopViewport && activeStampItems.length > 0 && (() => {
                    const STAMPS_PER_SPREAD = 4;
                    const totalSpreads = Math.max(1, Math.ceil(activeStampItems.length / STAMPS_PER_SPREAD));
                    const page = Math.min(passportBookPage, totalSpreads - 1);
                    // Passport-style numbering: identity page is odd, stamp pages pair after it
                    const leftNum = isDesktopViewport ? page * 2 + 3 : page * 2 + 4;
                    const rightNum = leftNum + 1;

                    return (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '12px',
                          left: '24px',
                          right: '24px',
                          display: 'flex',
                          justifyContent: isDesktopViewport ? 'space-between' : 'flex-end',
                          alignItems: 'center',
                          pointerEvents: 'none',
                          zIndex: 2,
                        }}
                      >
                        {/* Left Page Number Seal (desktop identity page) */}
                        {isDesktopViewport && (
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1.5px solid rgba(2, 132, 199, 0.35)', backgroundColor: 'rgba(255, 255, 255, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0369a1', fontSize: '11px', fontWeight: 800, fontFamily: 'monospace', boxShadow: '0 1px 4px rgba(2, 132, 199, 0.08)' }}>
                            {leftNum}
                          </div>
                        )}

                        {/* Right Page Number Seal */}
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1.5px solid rgba(2, 132, 199, 0.35)', backgroundColor: 'rgba(255, 255, 255, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0369a1', fontSize: '11px', fontWeight: 800, fontFamily: 'monospace', boxShadow: '0 1px 4px rgba(2, 132, 199, 0.08)' }}>
                          {rightNum}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Book Center Binding Spine Crease on Desktop */}
                  {isDesktopViewport && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: '50%',
                        width: '32px',
                        transform: 'translateX(-50%)',
                        background: 'linear-gradient(to right, rgba(2,132,199,0) 0%, rgba(14,116,144,0.12) 50%, rgba(2,132,199,0) 100%)',
                        borderLeft: '1px dashed rgba(2, 132, 199, 0.3)',
                        pointerEvents: 'none',
                        zIndex: 3,
                      }}
                    />
                  )}

                  {activeStampItems.length === 0 ? (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '40px 20px',
                        textAlign: 'center',
                        gap: '8px',
                      }}
                    >
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px dashed #d6cebf', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a89f91' }}>
                        <Compass style={{ width: '22px', height: '22px' }} />
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#57534e' }}>
                        No Passport Stamps Yet
                      </div>
                      <div style={{ fontSize: '12px', color: '#8c8273', maxWidth: '240px', lineHeight: 1.4 }}>
                        Pin spots in new cities and countries to collect official entry stamps.
                      </div>
                    </div>
                  ) : isDesktopViewport ? (
                    /* Desktop True Dual-Page Spread: Identity Left / Paginated Stamps Right */
                    (() => {
                      const STAMPS_PER_SPREAD = 4;
                      const totalSpreads = Math.max(1, Math.ceil(activeStampItems.length / STAMPS_PER_SPREAD));
                      const page = Math.min(passportBookPage, totalSpreads - 1);
                      const spreadStamps = activeStampItems.slice(page * STAMPS_PER_SPREAD, page * STAMPS_PER_SPREAD + STAMPS_PER_SPREAD);
                      const unclaimedSlots = Array.from(
                        { length: Math.max(0, STAMPS_PER_SPREAD - spreadStamps.length) },
                        (_, i) => renderUnclaimedSlot(i, page)
                      );

                      const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
                      const mrzCountry = ((bookCountry === 'Wanderer' ? 'WANDERER' : bookCountry).replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 15) || 'WANDERER').padEnd(15, '<');
                      const mrzHandle = ((bookUsername || 'WANDERER').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 12)).padEnd(12, '<');

                      return (
                        <div
                          style={{
                            flex: 1,
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            padding: '26px 30px',
                            boxSizing: 'border-box',
                            alignItems: 'stretch',
                            position: 'relative',
                            zIndex: 1,
                          }}
                        >
                          {/* LEFT PAGE ï¿½ Identity */}
                          <div
                            className="book-page-turn"
                            key={`identity-page-${page}`}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              gap: '14px',
                              paddingRight: '44px',
                              minWidth: 0,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: '#fff1ee', border: '1.5px solid #fecdd3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05a47', flexShrink: 0 }}>
                                <Compass style={{ width: '23px', height: '23px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '22px', fontWeight: 900, color: '#1c1917', letterSpacing: '0.06em', lineHeight: 1.1 }}>
                                  PASSPORT
                                </div>
                                <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#e05a47', letterSpacing: '0.28em', marginTop: '3px' }}>
                                  FIELD JOURNAL DIVISION
                                </div>
                              </div>
                            </div>

                            <div style={{ height: '1px', backgroundColor: 'rgba(180, 165, 140, 0.35)' }} />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                              <div>
                                <div style={{ fontSize: '8.5px', fontWeight: 800, color: '#8c8273', letterSpacing: '0.2em' }}>BEARER</div>
                                <div style={{ fontSize: '15px', fontWeight: 800, color: '#1c1917', letterSpacing: '0.02em' }}>
                                  @{bookUsername}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '26px' }}>
                                <div>
                                  <div style={{ fontSize: '8.5px', fontWeight: 800, color: '#8c8273', letterSpacing: '0.2em' }}>NATIONALITY</div>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1c1917' }}>
                                    {bookCountry}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '8.5px', fontWeight: 800, color: '#8c8273', letterSpacing: '0.2em' }}>ISSUED</div>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1c1917', fontFamily: 'monospace' }}>
                                    {issueDate}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', backgroundColor: 'rgba(255, 253, 250, 0.8)', border: '1px solid rgba(220, 208, 185, 0.5)', borderRadius: '14px', padding: '10px 8px', textAlign: 'center' }}>
                              <div>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1c1917' }}>{bookStats.countries}</div>
                                <div style={{ fontSize: '8.5px', color: '#8c8273', fontWeight: 700, letterSpacing: '0.08em' }}>COUNTRIES</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1c1917' }}>{bookStats.pins}</div>
                                <div style={{ fontSize: '8.5px', color: '#8c8273', fontWeight: 700, letterSpacing: '0.08em' }}>PINS</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1c1917' }}>{bookStats.cities}</div>
                                <div style={{ fontSize: '8.5px', color: '#8c8273', fontWeight: 700, letterSpacing: '0.08em' }}>CITIES</div>
                              </div>
                            </div>

                            <div
                              style={{
                                marginTop: '4px',
                                padding: '9px 10px',
                                backgroundColor: 'rgba(255, 253, 250, 0.85)',
                                border: '1px solid rgba(180, 165, 140, 0.4)',
                                borderRadius: '8px',
                                fontFamily: 'monospace',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                letterSpacing: '0.12em',
                                color: '#57534e',
                                lineHeight: 1.7,
                                whiteSpace: 'pre',
                                overflow: 'hidden',
                              }}
                            >
                              <div>P&lt;BWRBYWAYR&lt;&lt;{mrzCountry}</div>
                              <div>BWR{mrzHandle}&lt;&lt;{String(bookStamps.length).padStart(4, '0')}&lt;&lt;&lt;&lt;&lt;</div>
                            </div>
                          </div>

                          {/* RIGHT PAGE ï¿½ Paginated Stamp Spread */}
                          <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '36px', minWidth: 0 }}>
                            <div
                              className="book-page-turn"
                              key={`stamp-spread-${page}`}
                              style={{
                                flex: 1,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '22px 16px',
                                alignItems: 'center',
                                alignContent: 'center',
                                justifyItems: 'center',
                              }}
                            >
                              {spreadStamps}
                              {unclaimedSlots}
                            </div>

                            {/* Spread Navigation */}
                            {totalSpreads > 1 && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '8px 0 2px 0' }}>
                                <button
                                  type="button"
                                  disabled={page === 0}
                                  onClick={() => { triggerHaptic(6); setPassportBookPage((p) => Math.max(0, p - 1)); }}
                                  style={{
                                    width: '30px', height: '30px', borderRadius: '50%',
                                    border: '1px solid rgba(180, 165, 140, 0.5)',
                                    backgroundColor: page === 0 ? 'transparent' : '#ffffff',
                                    color: page === 0 ? '#d6cebf' : '#1c1917',
                                    cursor: page === 0 ? 'default' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                  }}
                                  aria-label="Previous spread"
                                >
                                  <ChevronLeft style={{ width: '15px', height: '15px' }} />
                                </button>
                                <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#8c8273', letterSpacing: '0.25em', fontFamily: 'monospace' }}>
                                  SPREAD {page + 1} / {totalSpreads}
                                </span>
                                <button
                                  type="button"
                                  disabled={page >= totalSpreads - 1}
                                  onClick={() => { triggerHaptic(6); setPassportBookPage((p) => Math.min(totalSpreads - 1, p + 1)); }}
                                  style={{
                                    width: '30px', height: '30px', borderRadius: '50%',
                                    border: '1px solid rgba(180, 165, 140, 0.5)',
                                    backgroundColor: page >= totalSpreads - 1 ? 'transparent' : '#ffffff',
                                    color: page >= totalSpreads - 1 ? '#d6cebf' : '#1c1917',
                                    cursor: page >= totalSpreads - 1 ? 'default' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                  }}
                                  aria-label="Next spread"
                                >
                                  <ChevronRight style={{ width: '15px', height: '15px' }} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    /* Mobile Organic Grid */
                    <div
                      style={{
                        flex: 1,
                        padding: '24px 18px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '20px 14px',
                        alignItems: 'center',
                        justifyItems: 'center',
                        boxSizing: 'border-box',
                      }}
                    >
                      {activeStampItems}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}  
        
        {/* Sign In / Auth Modal */}
        {isAuthModalOpen && (
          <div
            className="animate-fade-in"
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(28, 25, 23, 0.55)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100040,
              padding: "16px",
              boxSizing: "border-box",
              pointerEvents: "auto",
            }}
            onClick={() => {
              triggerHaptic(6);
              dismissModalWithHistory(() => setIsAuthModalOpen(false));
            }}
          >
            <div
              className="animate-scale-up"
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: isDarkMode ? 'rgba(24, 22, 20, 0.88)' : 'rgba(255, 253, 249, 0.88)',
                backdropFilter: 'blur(28px) saturate(180%)',
                WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                transform: 'translate3d(0, 0, 0)',
                WebkitTransform: 'translate3d(0, 0, 0)',
                border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.85)',
                borderRadius: "28px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
                width: "100%",
                maxWidth: "380px",
                padding: "24px 22px 20px 22px",
                position: "relative",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#1c1917", letterSpacing: "-0.02em" }}>
                    Sign In to Bywayr
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#78716c", fontWeight: 500 }}>
                    Pin secret spots & collect passport stamps
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    dismissModalWithHistory(() => setIsAuthModalOpen(false));
                  }}
                  style={{
                    border: "none",
                    background: "#ecebe7",
                    borderRadius: "50%",
                    width: "32px",
                    height: "32px",
                    cursor: "pointer",
                    color: "#78716c",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                  title="Close"
                >
                  <X style={{ width: "16px", height: "16px" }} />
                </button>
              </div>

              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  backgroundColor: "#ffffff",
                  border: "1.5px solid #e7e5e4",
                  borderRadius: "16px",
                  padding: "12px",
                  fontSize: "13.5px",
                  fontWeight: 700,
                  color: "#1c1917",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                  boxSizing: "border-box",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "2px 0" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#e7e5e4" }} />
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  or email link
                </span>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#e7e5e4" }} />
              </div>

              {magicLinkSent ? (
                <div
                  className="animate-slide-up"
                  style={{
                    backgroundColor: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: "14px",
                    padding: "14px",
                    textAlign: "center",
                    color: "#059669",
                  }}
                >
                  <Mail style={{ width: "24px", height: "24px", margin: "0 auto 6px auto", display: "block" }} />
                  <div style={{ fontSize: "13px", fontWeight: 700 }}>Check your inbox!</div>
                  <div style={{ fontSize: "11.5px", marginTop: "2px", color: "#047857" }}>
                    We sent a magic sign-in link to <strong>{authEmail}</strong>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleMagicLinkSignIn} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <input
                      type="email"
                      required
                      placeholder="Enter your email address"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        fontSize: "13px",
                        padding: "11px 12px",
                        borderRadius: "14px",
                        border: "1px solid #d6d3d1",
                        outline: "none",
                        color: "#1c1917",
                        backgroundColor: "#ffffff",
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingMagicLink || !authEmail.trim()}
                    style={{
                      width: "100%",
                      backgroundColor: "#1c1917",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "14px",
                      padding: "11px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: isSendingMagicLink || !authEmail.trim() ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      opacity: isSendingMagicLink ? 0.7 : 1,
                    }}
                  >
                    {isSendingMagicLink ? (
                      <Loader2 style={{ width: "15px", height: "15px", animation: "spin 1s linear infinite" }} />
                    ) : (
                      "Send Magic Link"
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Create Custom Category Modal */}
        <CreateCategoryModal
          isOpen={isCreateCategoryOpen}
          onClose={() => setIsCreateCategoryOpen(false)}
          onCategoryCreated={(newCat) => {
            setCustomCategories((prev) => [...prev, newCat]);
            setSelectedCategory(newCat.name);
            showToast(`Created category "${newCat.name}"!`);
          }}
        />

        {/* Spot Tagging Modal */}
        <SpotTagModal
          isOpen={isTagModalOpen}
          spotId={viewingSpot?.id}
          spotName={viewingSpot?.name || 'Spot'}
          categories={customCategories}
          onClose={() => setIsTagModalOpen(false)}
          onTagsUpdated={() => {
            showToast('Tags updated successfully!');
          }}
        />

        {/* Manage Custom Categories Modal */}
        <ManageCategoriesModal
          isOpen={isManageCategoriesOpen}
          categories={customCategories}
          onClose={() => setIsManageCategoriesOpen(false)}
          onCategoryDeleted={(deletedId) => {
            const deleted = customCategories.find((c) => c.id === deletedId);
            setCustomCategories((prev) => prev.filter((c) => c.id !== deletedId));
            if (deleted && selectedCategory === deleted.name) {
              setSelectedCategory('All');
            }
            showToast('Category deleted');
          }}
        />

        {/* Claim Username Modal */}
        {isClaimUsernameModalOpen && (
          <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100045, padding: '16px' }}>
            <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.35)', width: '100%', maxWidth: '380px', padding: '24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1c1917' }}>Choose Your Handle</h3>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#78716c' }}>Claim a username for your Field Journal & stamps.</p>
              <form onSubmit={handleClaimUsername} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', color: '#a8a29e', fontWeight: 700 }}>@</span>
                  <input
                    type="text"
                    required
                    value={claimUsername}
                    onChange={(e) => setClaimUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="username"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 28px', borderRadius: '12px', border: '1px solid #d6d3d1', fontSize: '13px', outline: 'none' }}
                  />
                </div>
                <input
                  type="text"
                  value={claimCountry}
                  onChange={(e) => setClaimCountry(e.target.value)}
                  placeholder="Home base / Country (optional)"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '12px', border: '1px solid #d6d3d1', fontSize: '13px', outline: 'none' }}
                />
                {claimUsernameError && <span style={{ color: '#e05a47', fontSize: '11.5px', fontWeight: 600 }}>{claimUsernameError}</span>}
                <button
                  type="submit"
                  disabled={isSavingUsername || !claimUsername.trim()}
                  style={{ width: '100%', backgroundColor: '#e05a47', color: '#ffffff', border: 'none', borderRadius: '14px', padding: '12px', fontSize: '13px', fontWeight: 700, cursor: isSavingUsername ? 'not-allowed' : 'pointer' }}
                >
                  {isSavingUsername ? 'Saving...' : profileSavedAt ? 'Handle Claimed!' : 'Confirm Handle'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Delete Account Modal */}
        {isDeleteAccountModalOpen && (
          <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100055, padding: '16px' }}>
            <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.35)', width: '100%', maxWidth: '380px', padding: '24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#dc2626' }}>Delete Account</h3>
                <button onClick={() => setIsDeleteAccountModalOpen(false)} style={{ border: 'none', background: '#ecebe7', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X style={{ width: '15px', height: '15px' }} />
                </button>
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#78716c', lineHeight: 1.45 }}>
                This will permanently remove your profile, bookmarks, and comments. Type <strong>DELETE</strong> to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '12px', border: '1px solid #fca5a5', fontSize: '13px', outline: 'none' }}
              />
              <button
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                style={{
                  width: '100%',
                  backgroundColor: deleteConfirmText.trim().toUpperCase() === 'DELETE' ? '#dc2626' : '#fecdd3',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: deleteConfirmText.trim().toUpperCase() === 'DELETE' ? 'pointer' : 'not-allowed',
                }}
              >
                {isDeletingAccount ? 'Deleting...' : 'Permanently Delete Account'}
              </button>
            </div>
          </div>
        )}

        {/* Edit Profile Modal */}
        {isEditProfileOpen && (
          <div
            className="animate-fade-in"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100050,
              backgroundColor: 'rgba(28, 25, 23, 0.55)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              boxSizing: 'border-box',
            }}
            onClick={() => {
              triggerHaptic(6);
              setIsEditProfileOpen(false);
            }}
          >
            <div
              className="animate-scale-up"
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '28px',
                boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.35)',
                width: '100%',
                maxWidth: '430px',
                maxHeight: '88vh',
                display: 'flex',
                flexDirection: 'column',
                padding: '22px 24px',
                position: 'relative',
                boxSizing: 'border-box',
                overflowY: 'auto',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>
                    Edit Profile
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#78716c', fontWeight: 500 }}>
                    Update your curator presence & links
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    setIsEditProfileOpen(false);
                  }}
                  style={{
                    border: 'none',
                    background: '#ecebe7',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    color: '#78716c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  title="Close"
                >
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>

              <form onSubmit={handleSaveProfileEdits} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="avatar-upload-input" style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}>
                    <div
                      style={{
                        width: '84px',
                        height: '84px',
                        borderRadius: '50%',
                        backgroundColor: '#fff1ee',
                        border: '2px solid #e7e5e4',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 14px rgba(224, 90, 71, 0.16)',
                      }}
                    >
                      {userProfile?.avatar_url ? (
                        <img src={userProfile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '28px', fontWeight: 700, color: '#e05a47' }}>
                          {((editUsernameValue || userProfile?.username || 'E')[0]).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '2px',
                        right: '2px',
                        backgroundColor: '#e05a47',
                        color: '#ffffff',
                        borderRadius: '50%',
                        width: '26px',
                        height: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid #ffffff',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                      }}
                    >
                      {uploadingAvatar ? (
                        <Loader2 style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Camera style={{ width: '13px', height: '13px' }} />
                      )}
                    </div>
                  </label>
                  <input
                    id="avatar-upload-input"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontSize: '11px', color: '#78716c', fontWeight: 500 }}>
                    {uploadingAvatar ? 'Optimizing & uploading avatar…' : 'Tap photo to change avatar'}
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>
                    Username
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '12px', color: '#a8a29e', fontSize: '13px', fontWeight: 700 }}>
                      @
                    </span>
                    <input
                      type="text"
                      value={editUsernameValue}
                      onChange={(e) => setEditUsernameValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="username"
                      maxLength={20}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        fontSize: '13px',
                        padding: '10px 12px 10px 28px',
                        borderRadius: '12px',
                        border: '1px solid #d6d3d1',
                        outline: 'none',
                        color: '#1c1917',
                        backgroundColor: '#ffffff',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>
                    Base / Country
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Globe style={{ position: 'absolute', left: '11px', color: '#a8a29e', width: '15px', height: '15px' }} />
                    <input
                      type="text"
                      value={editCountryValue}
                      onChange={(e) => setEditCountryValue(e.target.value)}
                      placeholder="United States"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        fontSize: '13px',
                        padding: '10px 12px 10px 34px',
                        borderRadius: '12px',
                        border: '1px solid #d6d3d1',
                        outline: 'none',
                        color: '#1c1917',
                        backgroundColor: '#ffffff',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#57534e' }}>
                      Field Bio
                    </label>
                    <span style={{ fontSize: '10px', color: editBioValue.length >= 140 ? '#e05a47' : '#a8a29e', fontWeight: 600 }}>
                      {editBioValue.length}/140
                    </span>
                  </div>
                  <textarea
                    value={editBioValue}
                    onChange={(e) => setEditBioValue(e.target.value)}
                    placeholder="Tell fellow wanderers what you search for..."
                    rows={3}
                    maxLength={140}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontSize: '13px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: '1px solid #d6d3d1',
                      outline: 'none',
                      color: '#1c1917',
                      backgroundColor: '#ffffff',
                      resize: 'none',
                      lineHeight: 1.45,
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '6px' }}>
                    Connected Channels & Links
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: '11px', display: 'flex', color: '#dc2626' }}>
                        <IconYoutube size={15} />
                      </span>
                      <input
                        type="url"
                        value={editYoutubeUrl}
                        onChange={(e) => setEditYoutubeUrl(e.target.value)}
                        placeholder="https://youtube.com/@handle"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          fontSize: '12.5px',
                          padding: '9px 12px 9px 34px',
                          borderRadius: '11px',
                          border: '1px solid #d6d3d1',
                          outline: 'none',
                          color: '#1c1917',
                        }}
                      />
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: '11px', display: 'flex', color: '#db2777' }}>
                        <IconInstagram size={15} />
                      </span>
                      <input
                        type="url"
                        value={editInstagramUrl}
                        onChange={(e) => setEditInstagramUrl(e.target.value)}
                        placeholder="https://instagram.com/username"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          fontSize: '12.5px',
                          padding: '9px 12px 9px 34px',
                          borderRadius: '11px',
                          border: '1px solid #d6d3d1',
                          outline: 'none',
                          color: '#1c1917',
                        }}
                      />
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: '11px', display: 'flex', color: '#2563eb' }}>
                        <IconFacebook size={15} />
                      </span>
                      <input
                        type="url"
                        value={editFacebookUrl}
                        onChange={(e) => setEditFacebookUrl(e.target.value)}
                        placeholder="https://facebook.com/page"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          fontSize: '12.5px',
                          padding: '9px 12px 9px 34px',
                          borderRadius: '11px',
                          border: '1px solid #d6d3d1',
                          outline: 'none',
                          color: '#1c1917',
                        }}
                      />
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <LinkIcon style={{ position: 'absolute', left: '11px', color: '#78716c', width: '14px', height: '14px' }} />
                      <input
                        type="url"
                        value={editWebsiteUrl}
                        onChange={(e) => setEditWebsiteUrl(e.target.value)}
                        placeholder="https://yourwebsite.com"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          fontSize: '12.5px',
                          padding: '9px 12px 9px 34px',
                          borderRadius: '11px',
                          border: '1px solid #d6d3d1',
                          outline: 'none',
                          color: '#1c1917',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {editProfileError && (
                  <div
                    className="animate-slide-up"
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#fff1ee',
                      color: '#e05a47',
                      border: '1px solid #fecdd3',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <AlertCircle style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                    <span>{editProfileError}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(6);
                      setIsEditProfileOpen(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '14px',
                      border: '1px solid #e7e5e4',
                      backgroundColor: '#ecebe7',
                      color: '#44403c',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingProfile}
                    style={{
                      flex: 1.4,
                      padding: '12px',
                      borderRadius: '14px',
                      border: 'none',
                      backgroundColor: '#e05a47',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: savingProfile ? 'not-allowed' : 'pointer',
                      opacity: savingProfile ? 0.75 : 1,
                      boxShadow: '0 4px 14px rgba(224, 90, 71, 0.28)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {savingProfile ? (
                      <>
                        <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} />
                        <span>Saving…</span>
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}        
        {/* Welcome / Onboarding Carousel — Editorial Explorer Edition */}
        {showWelcome && (() => {
          const ONBOARDING_STEPS = [
            {
              artifact: <ArtifactDiscovery />,
              title: 'Uncover what the algorithms miss.',
              body: "Discover back-alley ramen bars, quiet rooftops, and neighborhood staples that never buy sponsored ads.",
            },
            {
              artifact: <ArtifactPinMap />,
              title: 'Pin what you uncover.',
              body: 'Map personal field notes as you wander, organize by custom collections, and keep coordinates saved offline.',
            },
            {
              artifact: <ArtifactPassportStamps />,
              title: 'Collect real passport cachets.',
              body: 'Every territory and country you pin earns an archival immigration stamp in your personal Field Passport.',
            },
          ];

          const isLastStep = onboardingStep === ONBOARDING_STEPS.length - 1;
          const step = ONBOARDING_STEPS[onboardingStep];

          const finishOnboarding = () => {
            triggerHaptic(12);
            setIsOnboardingExiting(true);
            setTimeout(() => {
              dismissModalWithHistory(handleDismissWelcome);
              setTimeout(() => setIsOnboardingExiting(false), 400);
            }, 400);
          };

          const goToNext = () => {
            if (isLastStep) { finishOnboarding(); return; }
            triggerHaptic(6);
            setSlideDirection('forward');
            setOnboardingStep((prev) => prev + 1);
          };

          const goToPrev = () => {
            if (onboardingStep > 0) {
              triggerHaptic(6);
              setSlideDirection('back');
              setOnboardingStep((prev) => prev - 1);
            }
          };

          const touchStartXRef = { current: 0 } as { current: number };

          return (
            <div
              className="animate-fade-in"
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button, a')) {
                  touchStartXRef.current = 0;
                  return;
                }
                touchStartXRef.current = e.clientX;
              }}
              onPointerUp={(e) => {
                if (touchStartXRef.current === 0) return;
                const dx = e.clientX - touchStartXRef.current;
                touchStartXRef.current = 0;
                if (Math.abs(dx) > 50) { if (dx < 0) goToNext(); else goToPrev(); }
              }}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100030,
                padding: '0',
                boxSizing: 'border-box',
                backgroundColor: 'rgba(24, 22, 20, 0.65)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isOnboardingExiting ? 0 : 1,
                transform: isOnboardingExiting ? 'scale(1.03)' : 'scale(1)',
                transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div
                className="onboarding-shell"
                style={{
                  backgroundColor: '#fbf8f2',
                  boxShadow: '0 32px 72px -16px rgba(18, 14, 11, 0.45)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Subtle bank-note security watermark background */}
                <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.28 }}>
                  <defs>
                    <pattern id="onboarding-mesh" width="48" height="48" patternUnits="userSpaceOnUse">
                      <circle cx="24" cy="24" r="23" fill="none" stroke="#d5c7b3" strokeWidth="0.5" strokeDasharray="2 3" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#onboarding-mesh)" />
                </svg>

                {/* Top Header: Brand Name + Quick Skip */}
                <div style={{
                  padding: 'calc(max(env(safe-area-inset-top, 0px), 16px) + 6px) 24px 0 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'relative',
                  zIndex: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#e05a47' }} />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#1c1917', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      Bywayr Field Guide
                    </span>
                  </div>
                  {!isLastStep && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); finishOnboarding(); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#a8a29e',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Skip
                    </button>
                  )}
                </div>

                {/* Center Hero: Tactile Artifact */}
                <div
                  key={`art-${onboardingStep}`}
                  style={{
                    flex: '1 1 0%',
                    minHeight: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    zIndex: 5,
                    animation: `${slideDirection === 'forward' ? 'onboardingSlideInForward' : 'onboardingSlideInBack'} 0.35s cubic-bezier(0.16, 1, 0.3, 1) both`,
                  }}
                >
                  <div style={{ width: '220px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {step.artifact}
                  </div>
                </div>

                {/* Editorial Copy Block */}
                <div
                  key={`text-${onboardingStep}`}
                  style={{
                    padding: '0 32px',
                    textAlign: 'center',
                    flexShrink: 0,
                    minHeight: '100px',
                    position: 'relative',
                    zIndex: 5,
                    animation: `${slideDirection === 'forward' ? 'onboardingSlideInForward' : 'onboardingSlideInBack'} 0.32s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both`,
                  }}
                >
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '22px', fontWeight: 800, color: '#1c1917', letterSpacing: '-0.025em', lineHeight: 1.25 }}>
                    {step.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13.5px', color: '#665e57', lineHeight: 1.55, maxWidth: '340px', marginInline: 'auto' }}>
                    {step.body}
                  </p>
                </div>

                {/* Progress Indicators (Spring Pill) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px 0 14px 0', position: 'relative', zIndex: 5 }}>
                  {ONBOARDING_STEPS.map((_, idx) => (
                    <div
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (idx === onboardingStep) return;
                        triggerHaptic(6);
                        setSlideDirection(idx > onboardingStep ? 'forward' : 'back');
                        setOnboardingStep(idx);
                      }}
                      style={{
                        width: idx === onboardingStep ? '28px' : '7px',
                        height: '7px',
                        borderRadius: '4px',
                        backgroundColor: idx === onboardingStep ? '#e05a47' : 'rgba(214, 204, 187, 0.7)',
                        cursor: 'pointer',
                        transition: 'width 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.25s ease',
                      }}
                    />
                  ))}
                </div>

                {/* Bottom Actions */}
                <div style={{
                  padding: '0 24px calc(max(env(safe-area-inset-bottom, 0px), 20px) + 8px) 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  position: 'relative',
                  zIndex: 5,
                }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goToNext(); }}
                    style={{
                      width: '100%',
                      backgroundColor: '#1c1917',
                      color: '#fafaf9',
                      border: 'none',
                      borderRadius: '18px',
                      padding: '14px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '7px',
                      boxShadow: '0 8px 20px -4px rgba(28, 25, 23, 0.3)',
                    }}
                  >
                    {isLastStep ? 'Open Your Field Guide' : 'Continue'}
                    {!isLastStep && <ArrowRight style={{ width: '15px', height: '15px' }} />}
                  </button>

                  {isLastStep ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic(6);
                        localStorage.setItem('bywayr_seen_welcome', 'true');
                        setShowWelcome(false);
                        setTimeout(() => {
                          setMagicLinkSent(false);
                          setIsAuthModalOpen(true);
                          pushModalHistoryState('auth');
                        }, 400);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#8c827a',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '6px',
                        minHeight: '32px',
                      }}
                    >
                      Already exploring with us? <strong style={{ color: '#e05a47' }}>Sign in</strong>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#a8a29e',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: onboardingStep === 0 ? 'default' : 'pointer',
                        opacity: onboardingStep === 0 ? 0 : 1,
                        padding: '6px',
                        minHeight: '32px',
                        pointerEvents: onboardingStep === 0 ? 'none' : 'auto',
                      }}
                    >
                      Back
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }



