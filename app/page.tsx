'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '../lib/supabase';
import { decode, isValid, isFull, isShort, recoverNearest } from '@erikmichelson/open-location-code-ts';
import { EmptyState } from './src/main/components/EmptyState';
import { PwaInstallBanner } from './src/main/components/PwaInstallBanner';
import {
  MapPin,
  Loader2,
  X,
  Plus,
  Minus,
  Search,
  List,
  Camera,
  Coffee,
  Utensils,
  Mountain,
  Sun,
  Sparkles,
  Navigation2,
  Crosshair,
  Pencil,
  Trash2,
  LogIn,
  LogOut,
  Mail,
  CheckCircle2,
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
  MessageCircle,
  Send,
  Copy,
  Compass,
  Waves,
  Disc,
  Laptop,
  MoonStar,
  Crown,
  Footprints,
  ExternalLink,
  ArrowRight,
  Ticket,
  Wifi,
  Plane,
  AlertTriangle,
  Gamepad2,
  Flower2,
  Palette,
  Landmark,
  Cake,
  Glasses,
  Zap,
  BookOpen,
  Cpu,
  Download,
  MessageSquare,
  WifiOff,
} from 'lucide-react';

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
}

interface SpotComment {
  id: string;
  spot_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

const CATEGORIES = [
  { label: 'All', desc: 'All curated field notes & unmapped spots', color: '#57534e', icon: Sparkles },
  { label: 'Hidden Gems', desc: 'Unmarked spots, secret corners & quiet local treasures', color: '#e05a47', icon: Gem },
  { label: 'Alley Eats', desc: 'Backstreet stalls, hidden bistros & local food legends', color: '#ea580c', icon: Utensils },
  { label: 'Cafe & Chill', desc: 'Quiet roasters, courtyard hideaways & relaxed spaces', color: '#d97706', icon: Coffee },
  { label: 'Bakeries & Sweets', desc: 'Neighborhood patisseries, gelato counters & pastry spots', color: '#f43f5e', icon: Cake },
  { label: 'Listening & Bars', desc: 'Vinyl bars, basement speakeasies & acoustic haunts', color: '#db2777', icon: Beer },
  { label: 'Street Markets', desc: 'Night bazaars, morning produce alleys & flea markets', color: '#9333ea', icon: Store },
  { label: 'Nature & Trails', desc: 'Scenic walks, waterfalls, urban greenery & trailheads', color: '#0d9488', icon: Trees },
  { label: 'Viewpoints', desc: 'Rooftops, hillside lookouts & panoramic sunset perches', color: '#059669', icon: Mountain },
  { label: 'Urban Oases', desc: 'Tucked-away green pockets, courtyards & quiet resting spots', color: '#10b981', icon: Flower2 },
  { label: 'Secret Coasts', desc: 'Uncrowded beaches, hidden coves & quiet shoreline walks', color: '#0284c7', icon: Waves },
  { label: 'Stays & Hideaways', desc: 'Boutique guesthouses, quiet homestays & remote retreats', color: '#4f46e5', icon: HomeIcon },
  { label: 'Vintage & Vinyl', desc: 'Retro oddity shops, thrifts & crate-digging stops', color: '#b45309', icon: Disc },
  { label: 'Work & Focus', desc: 'Nomad-friendly work spots, quiet libraries & fast Wi-Fi cafes', color: '#2563eb', icon: Laptop },
  { label: 'Late Night', desc: '2 AM food stalls, midnight street bites & after-hours spots', color: '#7c3aed', icon: MoonStar },
  { label: 'Arcades & Play', desc: 'Retro game centers, crane game lofts & entertainment hubs', color: '#6366f1', icon: Gamepad2 },
  { label: 'Street Art & Murals', desc: 'Alleyway graffiti, sticker walls & urban creative installations', color: '#ec4899', icon: Palette },
  { label: 'Tech & Gadgets', desc: 'Component shops, custom hardware dens & electronics alleys', color: '#2563eb', icon: Cpu },
  { label: 'Indie Bookshops', desc: 'Independent bookstores, zine nooks & reading spaces', color: '#b45309', icon: BookOpen },
  { label: 'Shrines & Relics', desc: 'Neighborhood shrines, historical plaques & spiritual nooks', color: '#d97706', icon: Landmark },
  { label: 'Curiosities & Oddities', desc: 'Quirky micro-museums, unusual landmarks & local artifacts', color: '#8b5cf6', icon: Glasses },
  { label: 'Neon & Nights', desc: 'Glowing neon strips, moody alleys & night photography perches', color: '#db2777', icon: Zap },
  { label: 'Secret Passages', desc: 'Hidden stairways, covered alley cut-throughs & shortcuts', color: '#0284c7', icon: Footprints },
];

const getCategoryColor = (cat: string) => {
  const match = CATEGORIES.find((c) => c.label.toLowerCase() === cat.toLowerCase());
  return match ? match.color : '#e05a47';
};

const triggerHaptic = (duration = 10) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration);
    } catch {}
  }
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

const getCategorySvg = (category: string, color: string): string => {
  const cat = category?.toLowerCase() || '';
  if (cat.includes('cafe') || cat.includes('chill')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h12Z"/><path d="M6 2v2"/></svg>`;
  }
  if (cat.includes('eat') || cat.includes('alley')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M15 2v18"/><path d="M6 2v20"/><path d="M3 2v4a3 3 0 0 0 3 3v0a3 3 0 0 0 3-3V2"/></svg>`;
  }
  if (cat.includes('bar') || cat.includes('listen')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="4"/></svg>`;
  }
  if (cat.includes('coast') || cat.includes('beach')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`;
  }
  if (cat.includes('market')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>`;
  }
  if (cat.includes('nature') || cat.includes('trail')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v.2A3 3 0 0 1 8.9 16v0H5v0h0a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.9"/></svg>`;
  }
  if (cat.includes('view') || cat.includes('point')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>`;
  }
  if (cat.includes('stay') || cat.includes('hideaway')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
  }
  if (cat.includes('vintage') || cat.includes('vinyl')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="M12 12h.01"/></svg>`;
  }
  if (cat.includes('work') || cat.includes('focus')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></svg>`;
  }
  if (cat.includes('late') || cat.includes('night')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
  }
  if (cat.includes('arcades')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="18" y2="12"/><line x1="12" y1="6" x2="12" y2="18"/><circle cx="18" cy="15" r="1"/><circle cx="16" cy="9" r="1"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>`;
  }
  if (cat.includes('urban oases')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
  }
  if (cat.includes('street art')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.55-2.5 5.55-5.55C22 6.5 17.5 2 12 2z"/></svg>`;
  }
  if (cat.includes('shrines')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
  }
  if (cat.includes('bakeries')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 5v6"/><path d="M17 8v3"/></svg>`;
  }
  if (cat.includes('curiosities')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M2.5 13 5 7h14l2.5 6"/></svg>`;
  }
  if (cat.includes('neon')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
  }
  if (cat.includes('passages')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-0-5H20"/></svg>`;
  }
  if (cat.includes('bookshops')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>`;
  }
  if (cat.includes('tech')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></svg>`;
  }
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 18 3 22 9 12 22 2 9"/><polyline points="11 3 8 9 12 22 16 9 13 3"/><line x1="2" y1="9" x2="22" y2="9"/></svg>`;
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

const reverseGeocode = async (lat: number, lon: number): Promise<{ name?: string; city?: string; country?: string }> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
    );
    const data = await res.json();
    if (data && data.address) {
      const city =
        data.address.city ||
        data.address.town ||
        data.address.municipality ||
        data.address.suburb ||
        data.address.city_district ||
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
      const country = data.address.country || '';
      return { name, city, country };
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

export default function Home() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const previewMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const spotMarkersRef = useRef<maplibregl.Marker[]>([]);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const [isCategoryDragging, setIsCategoryDragging] = useState(false);
  const [categoryStartX, setCategoryStartX] = useState(0);
  const [categoryScrollLeft, setCategoryScrollLeft] = useState(0);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const currentUserRef = useRef<any>(null);

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isClaimUsernameModalOpen, setIsClaimUsernameModalOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const [viewingProfileSpots, setViewingProfileSpots] = useState<Spot[]>([]);
  const [profileCityFilter, setProfileCityFilter] = useState<string>('All');

  const [isWalkModalOpen, setIsWalkModalOpen] = useState(false);
  const [walkTargetSpot, setWalkTargetSpot] = useState<Spot | null>(null);
  const [walkSearchQuery, setWalkSearchQuery] = useState('');
  const [liveOsmResults, setLiveOsmResults] = useState<Spot[]>([]);
  const [isSearchingOsm, setIsSearchingOsm] = useState(false);

  const [activeSearchedSpot, setActiveSearchedSpot] = useState<{
    name: string;
    city: string;
    latitude: number;
    longitude: number;
  } | null>(null);

  const [viewingSpot, setViewingSpot] = useState<Spot | null>(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bywayr_dark_mode') === 'true';
    }
    return false;
  });

  // Offline detection state
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // PWA Status Bar & Theme Meta Polish
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bywayr_dark_mode', isDarkMode.toString());
      let metaTheme = document.querySelector('meta[name="theme-color"]');
      if (!metaTheme) {
        metaTheme = document.createElement('meta');
        metaTheme.setAttribute('name', 'theme-color');
        document.head.appendChild(metaTheme);
      }
      metaTheme.setAttribute('content', isDarkMode ? '#262421' : '#f5f5f4');

      let metaApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (!metaApple) {
        metaApple = document.createElement('meta');
        metaApple.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
        document.head.appendChild(metaApple);
      }
      metaApple.setAttribute('content', isDarkMode ? 'black-translucent' : 'default');
    }
  }, [isDarkMode]);

  // Google AdSense Script Injection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const script = document.createElement('script');
      script.async = true;
      script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX";
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
  }, []);

  const [authEmail, setAuthEmail] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authUsernameError, setAuthUsernameError] = useState('');
  const [claimUsername, setClaimUsername] = useState('');
  const [claimUsernameError, setClaimUsernameError] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const [onlyMySpots, setOnlyMySpots] = useState(false);
  const [maxRadiusKm, setMaxRadiusKm] = useState<number | null>(null);

  // Dynamic OpenGraph Social Sharing Meta Tags Updater
  useEffect(() => {
    if (viewingSpot) {
      document.title = `Bywayr — ${viewingSpot.name} in ${viewingSpot.city}`;
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) {
        ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitle);
      }
      ogTitle.setAttribute('content', `Bywayr — ${viewingSpot.name}`);

      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (!ogDesc) {
        ogDesc = document.createElement('meta');
        ogDesc.setAttribute('property', 'og:description');
        document.head.appendChild(ogDesc);
      }
      ogDesc.setAttribute('content', viewingSpot.description || `Check out ${viewingSpot.name} in ${viewingSpot.city} on Bywayr!`);

      if (viewingSpot.image_url) {
        let ogImg = document.querySelector('meta[property="og:image"]');
        if (!ogImg) {
          ogImg = document.createElement('meta');
          ogImg.setAttribute('property', 'og:image');
          document.head.appendChild(ogImg);
        }
        ogImg.setAttribute('content', viewingSpot.image_url);
      }
    } else {
      document.title = 'Bywayr — Pocket Field Guide';
    }
  }, [viewingSpot]);

  const [spots, setSpots] = useState<Spot[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('bywayr_cached_spots');
      if (cached) {
        try { return JSON.parse(cached); } catch {}
      }
    }
    return [];
  });
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'fieldNotes' | 'mustTry'>('fieldNotes');
  const [mustTrySpotIds, setMustTrySpotIds] = useState<string[]>([]);
  const [savingBookmark, setSavingBookmark] = useState(false);

  // Spot comments state
  const [spotComments, setSpotComments] = useState<SpotComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const [shareDialogSpot, setShareDialogSpot] = useState<Spot | null>(null);
  const [shareDialogCopied, setShareDialogCopied] = useState(false);
  const [coordsCopied, setCoordsCopied] = useState(false);

  const [vouchedSpotIds, setVouchedSpotIds] = useState<string[]>([]);
  const [vouchCounts, setVouchCounts] = useState<Record<string, number>>({});
  const [savingVouch, setSavingVouch] = useState(false);

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [showExitToast, setShowExitToast] = useState(false);
  const lastBackPressTime = useRef<number>(0);
  const isPopstateHandling = useRef(false);

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

  const isAnyOverlayActive = !!(
    isModalOpen ||
    isDrawerOpen ||
    viewingSpot ||
    viewingProfile ||
    isWalkModalOpen ||
    shareDialogSpot ||
    isProfileModalOpen ||
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

  const pushModalHistoryState = useCallback((sheetKey: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({ bywayr_sheet: sheetKey }, '');
    }
  }, []);

  const closeTopmostSheet = useCallback(() => {
    if (isDeleteAccountModalOpen) { setIsDeleteAccountModalOpen(false); return; }
    if (isClaimUsernameModalOpen) { setIsClaimUsernameModalOpen(false); return; }
    if (isProfileModalOpen) { setIsProfileModalOpen(false); return; }
    if (isAuthModalOpen) { setIsAuthModalOpen(false); return; }
    if (shareDialogSpot) { setShareDialogSpot(null); return; }
    if (isWalkModalOpen) { setIsWalkModalOpen(false); return; }
    if (viewingProfile) { setViewingProfile(null); return; }
    if (isModalOpen) { handleCloseModal(); return; }
    if (viewingSpot) {
      setViewingSpot(null);
      if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    if (activeSearchedSpot) {
      setActiveSearchedSpot(null);
      if (previewMarkerRef.current) previewMarkerRef.current.remove();
      return;
    }
    if (isDrawerOpen) { setIsDrawerOpen(false); return; }
    if (showWelcome) { handleDismissWelcome(); return; }
  }, [
    isDeleteAccountModalOpen,
    isClaimUsernameModalOpen,
    isProfileModalOpen,
    isAuthModalOpen,
    shareDialogSpot,
    isWalkModalOpen,
    viewingProfile,
    isModalOpen,
    viewingSpot,
    activeSearchedSpot,
    isDrawerOpen,
    showWelcome,
  ]);

  useEffect(() => {
    const handlePopState = () => {
      isPopstateHandling.current = true;
      if (activeOverlayRef.current) {
        closeTopmostSheet();
      } else {
        const now = Date.now();
        if (now - lastBackPressTime.current < 2000) {
          setShowExitToast(false);
          return;
        }
        lastBackPressTime.current = now;
        setShowExitToast(true);
        window.history.pushState(null, '', window.location.href);
        setTimeout(() => {
          setShowExitToast(false);
        }, 2000);
      }
      setTimeout(() => {
        isPopstateHandling.current = false;
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [closeTopmostSheet]);

  const dismissModalWithHistory = (closeFn: () => void) => {
    triggerHaptic(6);
    closeFn();
    if (!isPopstateHandling.current && typeof window !== 'undefined' && window.history.state?.bywayr_sheet) {
      window.history.back();
    }
  };

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('bywayr_seen_welcome');
    if (!hasSeenWelcome) {
      setShowWelcome(true);
      pushModalHistoryState('welcome');
    }
  }, [pushModalHistoryState]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service worker registration failed:', err);
      });
    }
  }, []);

  const handleDismissWelcome = () => {
    localStorage.setItem('bywayr_seen_welcome', 'true');
    setShowWelcome(false);
  };

  // Fetch comments when viewing a spot
  useEffect(() => {
    if (viewingSpot?.id) {
      fetchSpotComments(viewingSpot.id);
    } else {
      setSpotComments([]);
    }
  }, [viewingSpot?.id]);

  const fetchSpotComments = async (spotId: string) => {
    try {
      const { data, error } = await supabase
        .from('spot_comments')
        .select('*')
        .eq('spot_id', spotId)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setSpotComments(data);
      }
    } catch (err) {
      console.error('Failed to load spot comments:', err);
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
      }])
      .select();

    if (!error && data && data.length > 0) {
      setSpotComments((prev) => [...prev, data[0] as SpotComment]);
      setNewCommentText('');
    } else {
      // Fallback local append if table doesn't exist yet
      const fallbackComment: SpotComment = {
        id: Date.now().toString(),
        spot_id: viewingSpot.id,
        user_id: activeUser.id,
        content: newCommentText.trim(),
        created_at: new Date().toISOString(),
      };
      setSpotComments((prev) => [...prev, fallbackComment]);
      setNewCommentText('');
    }
    setSubmittingComment(false);
  };

  // Offline Export Handler (JSON / GPX)
  const handleExportData = (format: 'json' | 'gpx') => {
    triggerHaptic(12);
    const targetSpots = drawerTab === 'mustTry' ? spots.filter(s => mustTrySpotIds.includes(s.id!)) : spots;
    
    if (format === 'json') {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(targetSpots, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `bywayr_field_guide_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else {
      // Generate GPX XML
      let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Bywayr">\n`;
      targetSpots.forEach(s => {
        gpx += `  <wpt lat="${s.latitude}" lon="${s.longitude}">\n`;
        gpx += `    <name>${escapeXml(s.name)}</name>\n`;
        gpx += `    <desc>${escapeXml(s.description || s.category)}</desc>\n`;
        gpx += `  </wpt>\n`;
      });
      gpx += `</gpx>`;

      const dataStr = "data:text/gpx+xml;charset=utf-8," + encodeURIComponent(gpx);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `bywayr_field_guide_${Date.now()}.gpx`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
  };

  const escapeXml = (str: string) => {
    return str.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!error && data) {
        setUserProfile(data);
        localStorage.setItem('bywayr_user_profile', JSON.stringify(data));
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

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
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

  const fetchVouches = async (userId?: string) => {
    try {
      const { data: allVouches, error } = await supabase.from('vouches').select('spot_id, user_id');
      if (!error && allVouches) {
        const counts: Record<string, number> = {};
        const myVouches: string[] = [];
        allVouches.forEach((v: { spot_id: string; user_id: string }) => {
          counts[v.spot_id] = (counts[v.spot_id] || 0) + 1;
          if (userId && v.user_id === userId) {
            myVouches.push(v.spot_id);
          }
        });
        setVouchCounts(counts);
        setVouchedSpotIds(myVouches);
      }
    } catch (err) {
      console.error('Failed to load vouches:', err);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      currentUserRef.current = user;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      currentUserRef.current = user;
      if (user) {
        setIsAuthModalOpen(false);
      } else {
        setUserProfile(null);
        localStorage.removeItem('bywayr_user_profile');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchSpots();
    fetchProfiles();
    fetchVouches(currentUser?.id);
    if (currentUser?.id) {
      fetchMustTryBookmarks(currentUser.id);
      fetchUserProfile(currentUser.id);
    } else {
      setMustTrySpotIds([]);
      setVouchedSpotIds([]);
      setUserProfile(null);
    }
  }, [currentUser]);

  const handleGoogleSignIn = async () => {
    triggerHaptic(10);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
  };

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim()) return;

    const cleanUsername = authUsername.trim().toLowerCase();
    if (cleanUsername) {
      if (cleanUsername.length < 3 || cleanUsername.length > 20 || !/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
        setAuthUsernameError('Username must be 3-20 characters (letters, numbers, underscores).');
        return;
      }

      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existingUser) {
        setAuthUsernameError('This username is already taken. Please choose another.');
        return;
      }
    }

    setIsSendingMagicLink(true);
    setAuthUsernameError('');

    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        data: cleanUsername ? { username: cleanUsername } : undefined,
      },
    });

    if (error) alert(`Error sending link: ${error.message}`);
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
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setClaimUsernameError(error.message);
    } else {
      triggerHaptic(15);
      const updated = { ...userProfile, id: activeUser.id, username: clean };
      setUserProfile(updated);
      localStorage.setItem('bywayr_user_profile', JSON.stringify(updated));
      setIsClaimUsernameModalOpen(false);
      fetchProfiles();
    }
    setIsSavingUsername(false);
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
      alert(`Avatar upload failed: ${err.message || 'Error uploading file'}`);
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
    setVouchedSpotIds([]);
    setOnlyMySpots(false);
    setUserProfile(null);
    localStorage.removeItem('bywayr_user_profile');
    setIsProfileModalOpen(false);
    setIsClaimUsernameModalOpen(false);
  };

  const handleDeleteAccount = async () => {
    const activeUser = currentUserRef.current;
    if (!activeUser || deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;

    setIsDeletingAccount(true);
    try {
      await supabase.from('bookmarks').delete().eq('user_id', activeUser.id);
      await supabase.from('vouches').delete().eq('user_id', activeUser.id);
      await supabase.from('profiles').delete().eq('id', activeUser.id);
      await supabase.rpc('delete_user');
    } catch (err) {
      console.error('Account deletion cleanup error:', err);
    } finally {
      await supabase.auth.signOut();
      setCurrentUser(null);
      currentUserRef.current = null;
      setUserProfile(null);
      setMustTrySpotIds([]);
      setVouchedSpotIds([]);
      localStorage.removeItem('bywayr_user_profile');
      setIsDeleteAccountModalOpen(false);
      setIsProfileModalOpen(false);
      setIsDeletingAccount(false);
    }
  };

  const fetchSpots = async () => {
    try {
      const { data, error } = await supabase.from('spots').select('*').order('id', { ascending: false });
      if (!error && data) {
        setSpots(data as Spot[]);
        localStorage.setItem('bywayr_cached_spots', JSON.stringify(data));
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

  const toggleVouch = async (spotId?: string) => {
    if (!spotId) return;
    const activeUser = currentUserRef.current;
    if (!activeUser) {
      setIsAuthModalOpen(true);
      pushModalHistoryState('auth');
      return;
    }

    triggerHaptic(12);
    setSavingVouch(true);
    const isVouched = vouchedSpotIds.includes(spotId);

    if (isVouched) {
      const { error } = await supabase.from('vouches').delete().eq('user_id', activeUser.id).eq('spot_id', spotId);
      if (!error) {
        setVouchedSpotIds((prev) => prev.filter((id) => id !== spotId));
        setVouchCounts((prev) => ({
          ...prev,
          [spotId]: Math.max(0, (prev[spotId] || 1) - 1),
        }));
      }
    } else {
      const { error } = await supabase.from('vouches').insert([{ user_id: activeUser.id, spot_id: spotId }]);
      if (!error) {
        setVouchedSpotIds((prev) => [...prev, spotId]);
        setVouchCounts((prev) => ({
          ...prev,
          [spotId]: (prev[spotId] || 0) + 1,
        }));
      }
    }
    setSavingVouch(false);
  };

  const handleOpenPublicProfile = (userId: string) => {
    triggerHaptic(8);
    const profile = profilesMap[userId] || { id: userId, username: 'wanderer' };
    const userSpots = spots.filter((s) => s.user_id === userId);
    setViewingProfile(profile);
    setViewingProfileSpots(userSpots);
    setProfileCityFilter('All');
    setViewingSpot(null);
    pushModalHistoryState('publicProfile');
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

  // Basemap Initialization - Stadia Maps OSM Bright (Vibrant & Colorful)
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

    const apiKey = '2e0833d1-af3b-42e8-a166-c67424d3a130';
    const getStadiaStyle = (dark: boolean) => ({
      version: 8 as const,
      sources: {
        'stadia-tiles': {
          type: 'raster' as const,
          tiles: [
            dark
              ? `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png?api_key=${apiKey}`
              : `https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png?api_key=${apiKey}`,
            dark
              ? `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png?api_key=${apiKey}`
              : `https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png?api_key=${apiKey}`,
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors, © Stadia Maps',
        },
      },
      layers: [
        {
          id: 'stadia-layer',
          type: 'raster' as const,
          source: 'stadia-tiles',
          minzoom: 0,
          maxzoom: 20,
        },
      ],
    });

    const initializedMap = new maplibregl.Map({
      container: mapContainer.current,
      style: getStadiaStyle(isDarkMode),
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
    });

    initializedMap.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-left'
    );

    initializedMap.on('moveend', () => {
      const center = initializedMap.getCenter();
      const zoom = initializedMap.getZoom();
      localStorage.setItem('bywayr_map_center', JSON.stringify([center.lng, center.lat]));
      localStorage.setItem('bywayr_map_zoom', zoom.toString());
    });

    initializedMap.on('load', () => {
      const hasSavedPosition = localStorage.getItem('bywayr_map_center');
      if (navigator.geolocation && !window.location.search.includes('spot=') && !hasSavedPosition) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            setUserCoords({ lat: latitude, lng: longitude });
            initializedMap.jumpTo({ center: [longitude, latitude], zoom: 15 });

            if (userLocationMarkerRef.current) {
              userLocationMarkerRef.current.setLngLat([longitude, latitude]);
            } else {
              const el = document.createElement('div');
              el.style.width = '16px';
              el.style.height = '16px';
              el.style.borderRadius = '50%';
              el.style.backgroundColor = '#0284c7';
              el.style.border = '3px solid #ffffff';
              el.style.boxShadow = '0 0 0 0 rgba(2, 132, 199, 0.75)';
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
      const originalTarget = e.originalEvent.target as HTMLElement;
      if (originalTarget?.closest('.maplibregl-marker')) return;
      const lat = parseFloat(e.lngLat.lat.toFixed(6));
      const lng = parseFloat(e.lngLat.lng.toFixed(6));
      dropPreviewAndOpenModal(lat, lng);
    });

    initializedMap.on('dragstart', () => {
      setShowDropdown(false);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });

    map.current = initializedMap;

    return () => {
      initializedMap.remove();
      map.current = null;
    };
  }, []);

  // Dynamic Day/Night style toggle for Stadia Maps
  useEffect(() => {
    if (map.current) {
      const apiKey = '2e0833d1-af3b-42e8-a166-c67424d3a130';
      const getStadiaStyle = (dark: boolean) => ({
        version: 8 as const,
        sources: {
          'stadia-tiles': {
            type: 'raster' as const,
            tiles: [
              dark
                ? `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png?api_key=${apiKey}`
                : `https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png?api_key=${apiKey}`,
              dark
                ? `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png?api_key=${apiKey}`
                : `https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png?api_key=${apiKey}`,
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors, © Stadia Maps',
          },
        },
        layers: [
          {
            id: 'stadia-layer',
            type: 'raster' as const,
            source: 'stadia-tiles',
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      });
      map.current.setStyle(getStadiaStyle(isDarkMode));
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!loading && spots.length > 0 && map.current) {
      const urlParams = new URLSearchParams(window.location.search);
      const spotId = urlParams.get('spot');
      if (spotId) {
        const target = spots.find((s) => s.id === spotId);
        if (target && target.latitude && target.longitude) flyToSpot(target);
      }
    }
  }, [loading, spots]);

  // Main Live Search
  useEffect(() => {
    const rawQuery = searchQuery.trim();
    if (rawQuery.length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const codeMatch = rawQuery.match(/([2-9CFGHJMPQRVWX+]{4,8}\+[2-9CFGHJMPQRVWX+]{2,})/i);

    if (codeMatch) {
      const codePart = codeMatch[1].toUpperCase();
      const localityHint = rawQuery.replace(codeMatch[0], '').replace(/plus\s*code/gi, '').replace(/[()]/g, '').trim();

      if (isValid(codePart)) {
        if (isFull(codePart)) {
          try {
            const decoded = decode(codePart);
            const lat = decoded.latitudeCenter;
            const lon = decoded.longitudeCenter;
            setSearchResults([{
              lat: lat.toString(),
              lon: lon.toString(),
              display_name: localityHint ? `Plus Code (${codePart}) in ${localityHint}` : `Plus Code (${codePart})`
            }]);
            setShowDropdown(true);
            return;
          } catch (err) {
            console.error('Full code decode error:', err);
          }
        } else if (isShort(codePart)) {
          let isCancelled = false;
          setIsSearching(true);
          (async () => {
            try {
              let anchorLat = map.current ? map.current.getCenter().lat : 36.1699;
              let anchorLon = map.current ? map.current.getCenter().lng : -115.1398;

              if (localityHint) {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(localityHint)}&limit=1`);
                const geoData = await geoRes.json();
                if (!isCancelled && geoData && geoData.length > 0) {
                  anchorLat = parseFloat(geoData[0].lat);
                  anchorLon = parseFloat(geoData[0].lon);
                }
              }

              const fullCode = recoverNearest(codePart, anchorLat, anchorLon);
              if (!isCancelled && isFull(fullCode)) {
                const decoded = decode(fullCode);
                const lat = decoded.latitudeCenter;
                const lon = decoded.longitudeCenter;
                setSearchResults([{
                  lat: lat.toString(),
                  lon: lon.toString(),
                  display_name: localityHint ? `Plus Code (${codePart}) in ${localityHint}` : `Plus Code (${codePart})`
                }]);
                setShowDropdown(true);
              }
            } catch (err) {
              console.error('Short Plus Code resolution error:', err);
            } finally {
              if (!isCancelled) setIsSearching(false);
            }
          })();

          return () => {
            isCancelled = true;
          };
        }
      }
    }

    const coordMatch = rawQuery.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[3]);
      setSearchResults([{ lat: lat.toString(), lon: lon.toString(), display_name: `GPS Coordinates: ${lat}, ${lon}` }]);
      setShowDropdown(true);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const center = map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 };
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rawQuery)}&lat=${center.lat}&lon=${center.lng}&limit=6`);
        const data = await res.json();
        setSearchResults(data || []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSearchResult = (item: any) => {
    triggerHaptic(8);
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    setShowDropdown(false);
    setSearchQuery(item.display_name);

    const placeName = item.name || item.display_name.split(',')[0];
    const placeCity = item.address?.city || item.address?.town || item.address?.suburb || 'Local Map Area';

    setActiveSearchedSpot({
      name: placeName,
      city: placeCity,
      latitude: lat,
      longitude: lon,
    });
    setViewingSpot(null);
    pushModalHistoryState('activeSearchedSpot');

    if (map.current) {
      map.current.flyTo({ center: [lon, lat], zoom: 16, essential: true });

      if (previewMarkerRef.current) previewMarkerRef.current.remove();
      previewMarkerRef.current = new maplibregl.Marker({ color: '#e05a47' })
        .setLngLat([lon, lat])
        .addTo(map.current);
    }
  };

  const filteredSpots = spots
    .filter((spot) => {
      if (onlyMySpots && currentUser && spot.user_id !== currentUser.id) return false;
      if (maxRadiusKm !== null) {
        const anchorLat = userCoords ? userCoords.lat : mapCenter.lat;
        const anchorLng = userCoords ? userCoords.lng : mapCenter.lng;
        const dist = getDistanceFromLatLonInKm(anchorLat, anchorLng, spot.latitude, spot.longitude);
        if (dist > maxRadiusKm) return false;
      }
      if (selectedCategory === 'All') return true;
      return spot.category?.toLowerCase() === selectedCategory.toLowerCase();
    })
    .sort((a, b) => {
      const idA = a.id ? Number(a.id) : 0;
      const idB = b.id ? Number(b.id) : 0;
      if (!isNaN(idA) && !isNaN(idB) && idA !== idB) {
        return idB - idA;
      }
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });

  // Marker Rendering
  useEffect(() => {
    if (!map.current) return;
    spotMarkersRef.current.forEach((marker) => marker.remove());
    spotMarkersRef.current = [];

    filteredSpots.forEach((spot) => {
      if (!spot.latitude || !spot.longitude) return;
      const isMustTry = spot.id ? mustTrySpotIds.includes(spot.id) : false;
      const isWalkTarget = walkTargetSpot?.id === spot.id;
      const color = getCategoryColor(spot.category);

      const el = document.createElement('div');
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = isWalkTarget ? '#e05a47' : '#ffffff';
      el.style.border = isMustTry
        ? '3px solid #d97706'
        : isWalkTarget
        ? '3px solid #ffffff'
        : `2.5px solid ${color}`;
      el.style.boxShadow = '0 6px 16px rgba(28, 25, 23, 0.25)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.title = spot.name;

      if (isWalkTarget) {
        const iconDiv = document.createElement('div');
        iconDiv.style.display = 'flex';
        iconDiv.style.color = '#ffffff';
        iconDiv.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
        el.appendChild(iconDiv);
      } else {
        const svgIcon = document.createElement('div');
        svgIcon.style.display = 'flex';
        svgIcon.style.alignItems = 'center';
        svgIcon.style.justifyContent = 'center';
        svgIcon.style.color = color;
        svgIcon.innerHTML = getCategorySvg(spot.category, color);
        el.appendChild(svgIcon);
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerHaptic(8);
        setActiveSearchedSpot(null);
        flyToSpot(spot);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([spot.longitude, spot.latitude])
        .addTo(map.current!);

      spotMarkersRef.current.push(marker);
    });
  }, [filteredSpots, mustTrySpotIds, walkTargetSpot]);

  const handleLocateMe = () => {
    triggerHaptic(8);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
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
          el.style.width = '16px';
          el.style.height = '16px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = '#0284c7';
          el.style.border = '3px solid #ffffff';
          el.style.boxShadow = '0 0 0 0 rgba(2, 132, 199, 0.75)';
          el.className = 'user-location-pulse';

          userLocationMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat([longitude, latitude])
            .addTo(map.current);
        }

        map.current.flyTo({ center: [longitude, latitude], zoom: 16, essential: true });
        setIsLocating(false);
      },
      () => {
        alert('Could not retrieve your location.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleModalLocate = () => {
    triggerHaptic(8);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
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
          previewMarkerRef.current = new maplibregl.Marker({ color: '#e05a47' })
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
        alert('Could not retrieve current location.');
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
    setShareDialogCopied(false);
    pushModalHistoryState('share');
  };

  const handleCopyCoordinates = async (lat: number, lon: number) => {
    triggerHaptic(10);
    await navigator.clipboard.writeText(`${lat}, ${lon}`);
    setCoordsCopied(true);
    setTimeout(() => setCoordsCopied(false), 2000);
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
    setActiveSearchedSpot(null);
    setIsEditing(false);

    if (previewMarkerRef.current) previewMarkerRef.current.remove();

    const previewPin = new maplibregl.Marker({ color: '#e05a47' }).setLngLat([lon, lat]).addTo(map.current);
    previewMarkerRef.current = previewPin;

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

    setImageFile(null);
    setImagePreview(null);
    setIsModalOpen(true);
    pushModalHistoryState('addSpotModal');
  };

  const handleOpenEditModal = (spot: Spot) => {
    const activeUser = currentUserRef.current;
    if (!activeUser || spot.user_id !== activeUser.id) return;
    triggerHaptic(8);
    setIsEditing(true);
    setNewSpot(spot);
    setImagePreview(spot.image_url || null);
    setImageFile(null);
    setViewingSpot(null);
    setActiveSearchedSpot(null);
    setIsModalOpen(true);
    pushModalHistoryState('editSpotModal');
  };

  const handleCloseModal = () => {
    if (previewMarkerRef.current && !activeSearchedSpot) {
      previewMarkerRef.current.remove();
      previewMarkerRef.current = null;
    }
    setImageFile(null);
    setImagePreview(null);
    setIsEditing(false);
    setIsModalOpen(false);
  };

  const handleDeleteSpot = async (spot: Spot) => {
    const activeUser = currentUserRef.current;
    if (!spot.id || !activeUser || spot.user_id !== activeUser.id) return;
    if (!confirm(`Are you sure you want to delete "${spot.name}"?`)) return;

    triggerHaptic(15);
    setDeleting(true);
    const { error } = await supabase.from('spots').delete().eq('id', spot.id);
    if (!error) {
      setSpots((prev) => prev.filter((s) => s.id !== spot.id));
      setViewingSpot(null);
    }
    setDeleting(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
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

    if (imageFile) {
      setUploadingImage(true);
      const fileToUpload = await compressImageToWebP(imageFile);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`;
      const filePath = `spots/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('spot-images').upload(filePath, fileToUpload, { contentType: 'image/webp', upsert: true });
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from('spot-images').getPublicUrl(filePath);
        uploadedUrl = publicUrlData.publicUrl;
      }
      setUploadingImage(false);
    }

    if (isEditing && newSpot.id) {
      const { data, error } = await supabase
        .from('spots')
        .update({
          name: newSpot.name,
          category: newSpot.category,
          city: newSpot.city,
          country: newSpot.country || 'United States',
          description: newSpot.description,
          latitude: newSpot.latitude,
          longitude: newSpot.longitude,
          image_url: uploadedUrl || null,
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
          city: newSpot.city,
          country: newSpot.country || 'United States',
          description: newSpot.description,
          latitude: newSpot.latitude,
          longitude: newSpot.longitude,
          image_url: uploadedUrl || null,
          user_id: activeUser.id,
        }])
        .select();

      if (!error && data && data.length > 0) {
        if (previewMarkerRef.current) {
          previewMarkerRef.current.remove();
          previewMarkerRef.current = null;
        }
        setSpots((prev) => [data[0] as Spot, ...prev]);
        dismissModalWithHistory(() => setIsModalOpen(false));
        setSearchQuery('');
        setActiveSearchedSpot(null);
        if (map.current) map.current.flyTo({ center: [newSpot.longitude, newSpot.latitude], zoom: 16 });
      }
    }
    setSaving(false);
  };

  const displayedDrawerSpots = drawerTab === 'fieldNotes' ? filteredSpots : spots.filter((s) => s.id && mustTrySpotIds.includes(s.id));
  const mySpotsCount = currentUser ? spots.filter((s) => s.user_id === currentUser.id).length : 0;
  const myCitiesCount = currentUser ? new Set(spots.filter((s) => s.user_id === currentUser.id).map((s) => s.city.trim())).size : 0;
  
  const activeCategoryObject = CATEGORIES.find((c) => c.label.toLowerCase() === selectedCategory.toLowerCase());

  useEffect(() => {
    const query = walkSearchQuery.trim();
    if (query.length < 2) {
      setLiveOsmResults([]);
      setIsSearchingOsm(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingOsm(true);
      try {
        const center = map.current ? map.current.getCenter() : { lng: -115.1398, lat: 36.1699 };
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&lat=${center.lat}&lon=${center.lng}&limit=5`
        );
        const data = await res.json();

        if (data && data.length > 0) {
          const mapped: Spot[] = data.map((item: any) => {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            return {
              name: item.name || item.display_name.split(',')[0],
              city: item.address?.city || item.address?.town || item.address?.suburb || 'Nearby',
              country: item.address?.country || '',
              category: 'Map Location',
              description: item.display_name,
              latitude: lat,
              longitude: lon,
              isLiveOsm: true,
            };
          });

          setLiveOsmResults(mapped);
        } else {
          setLiveOsmResults([]);
        }
      } catch (err) {
        console.error('OSM search error:', err);
      } finally {
        setIsSearchingOsm(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [walkSearchQuery]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100dvh', minHeight: '100vh', overflow: 'hidden', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", backgroundColor: isDarkMode ? '#262421' : '#f5f5f4' }}>
      <style jsx global>{`
        html, body {
          overscroll-behavior-y: contain;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }
        input, textarea {
          user-select: text;
        }
        @keyframes slideUp {
          from { transform: translateY(24px) translateZ(0); opacity: 0; }
          to { transform: translateY(0) translateZ(0); opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%) translateZ(0); opacity: 0; }
          to { transform: translateX(0) translateZ(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateZ(0); }
          to { opacity: 1; transform: translateZ(0); }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95) translateZ(0); opacity: 0; }
          to { transform: scale(1) translateZ(0); opacity: 1; }
        }
        @keyframes gpsRadarPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(2, 132, 199, 0.75);
          }
          70% {
            box-shadow: 0 0 0 16px rgba(2, 132, 199, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(2, 132, 199, 0);
          }
        }
        @keyframes pulseSkeleton {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
        .skeleton-pulse {
          animation: pulseSkeleton 1.4s ease-in-out infinite;
          background-color: #e7e5e4;
          border-radius: 12px;
        }
        .user-location-pulse {
          animation: gpsRadarPulse 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-slide-up {
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity;
          backface-visibility: hidden;
        }
        .animate-slide-left {
          animation: slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity;
          backface-visibility: hidden;
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
          will-change: opacity;
        }
        .animate-scale-up {
          animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
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

      {/* 1. Map Canvas */}
      <div 
        ref={mapContainer} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          zIndex: 1,
          backgroundColor: isDarkMode ? '#262421' : '#f5f5f4',
          transition: 'background-color 0.3s ease',
        }} 
      />

      {/* 2. Top Header & Search Bar */}
      <div style={{ position: 'fixed', top: '16px', left: '16px', right: '16px', maxWidth: '440px', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' }}>
        {/* Offline Status Banner */}
        {!isOnline && (
          <div className="animate-fade-in" style={{ backgroundColor: '#d97706', color: '#ffffff', fontSize: '11.5px', fontWeight: 600, padding: '7px 12px', borderRadius: '14px', textAlign: 'center', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <WifiOff style={{ width: '13px', height: '13px' }} /> Offline Mode — Browsing cached field notes
          </div>
        )}

        <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '10px 14px', borderRadius: '20px', boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.08), 0 0 1px 1px rgba(28, 25, 23, 0.04)', border: '1px solid #e7e5e4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '22.5%', overflow: 'hidden', display: 'flex', flexShrink: 0, boxShadow: '0 2px 8px rgba(28, 25, 23, 0.12)', border: '1px solid rgba(0, 0, 0, 0.06)' }}>
              <img src="/icon-512.png" alt="Bywayr" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#1c1917', letterSpacing: '-0.03em', lineHeight: 1.2 }}>Bywayr</h1>
              <p style={{ margin: 0, fontSize: '11.5px', color: '#78716c', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {loading ? 'Connecting...' : selectedCategory === 'All' && !onlyMySpots && maxRadiusKm === null ? `${spots.length} saved spots` : `${filteredSpots.length} spots`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {currentUser ? (
              <button 
                onClick={() => {
                  triggerHaptic(8);
                  setIsProfileModalOpen(true);
                  pushModalHistoryState('profile');
                }} 
                style={{ 
                  backgroundColor: '#f5f5f4', 
                  border: '1px solid #d6d3d1', 
                  borderRadius: '12px', 
                  padding: '5px 9px', 
                  color: '#44403c', 
                  fontSize: '12px', 
                  fontWeight: 600, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  maxWidth: '120px', 
                  flexShrink: 1 
                }}
              >
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Avatar" style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <User style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userProfile?.username ? `@${userProfile.username}` : 'Account'}
                </span>
              </button>
            ) : (
              <button onClick={() => { triggerHaptic(8); setMagicLinkSent(false); setAuthUsername(''); setAuthUsernameError(''); setIsAuthModalOpen(true); pushModalHistoryState('auth'); }} style={{ backgroundColor: '#1c1917', border: 'none', borderRadius: '12px', padding: '7px 11px', color: '#fafaf9', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <LogIn style={{ width: '13px', height: '13px', flexShrink: 0 }} /> Sign In
              </button>
            )}

            <button
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
              style={{ backgroundColor: '#e05a47', border: 'none', borderRadius: '12px', padding: '7px 12px', color: '#ffffff', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 2px 8px rgba(224, 90, 71, 0.3)' }}
            >
              <Plus style={{ width: '14px', height: '14px' }} /> Add
            </button>

            <button onClick={() => { triggerHaptic(8); setIsDrawerOpen(true); pushModalHistoryState('drawer'); }} style={{ backgroundColor: '#f5f5f4', border: '1px solid #d6d3d1', borderRadius: '12px', padding: '7px 9px', color: '#44403c', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <List style={{ width: '15px', height: '15px' }} />
            </button>
          </div>
        </div>

        {/* Primary Search Input Bar */}
        <div style={{ position: 'relative', width: '100%' }}>
          <form onSubmit={(e) => e.preventDefault()} style={{ position: 'relative', width: '100%' }}>
            <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#a8a29e', width: '17px', height: '17px' }} />
            <input
              type="text"
              placeholder="Search, paste coordinates, or plus codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchQuery.trim().length >= 3) setShowDropdown(true); }}
              style={{ width: '100%', boxSizing: 'border-box', backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '12px 42px 12px 40px', fontSize: '13px', borderRadius: showDropdown ? '20px 20px 0 0' : '20px', border: '1px solid #e7e5e4', boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.08), 0 0 1px 1px rgba(28, 25, 23, 0.04)', outline: 'none', color: '#1c1917' }}
            />
            <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isSearching && <Loader2 style={{ color: '#e05a47', width: '17px', height: '17px', animation: 'spin 1s linear infinite' }} />}
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
          </form>

          {showDropdown && searchQuery.trim().length >= 3 && (
            <div className="animate-fade-in" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'rgba(255, 255, 255, 0.96)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '0 0 20px 20px', border: '1px solid #e7e5e4', boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.08)', maxHeight: '280px', overflowY: 'auto', zIndex: 10000 }}>
              {searchResults.length === 0 ? (
                <div style={{ padding: '14px 15px', textAlign: 'center', color: '#78716c', fontSize: '12.5px' }}>
                  No local places found.
                </div>
              ) : (
                searchResults.map((item, idx) => (
                  <div key={idx} onClick={() => handleSelectSearchResult(item)} style={{ padding: '11px 15px', fontSize: '12.5px', color: '#44403c', cursor: 'pointer', borderBottom: '1px solid #f5f5f4', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  padding: '11px 15px',
                  backgroundColor: '#fafaf9',
                  borderTop: '1px solid #e7e5e4',
                  color: '#44403c',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderBottomLeftRadius: '20px',
                  borderBottomRightRadius: '20px',
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

        {/* Categories Bar & Proximity Filter */}
        <div 
          ref={categoryScrollRef}
          onMouseDown={handleCategoryMouseDown}
          onMouseLeave={handleCategoryMouseLeaveOrUp}
          onMouseUp={handleCategoryMouseLeaveOrUp}
          onMouseMove={handleCategoryMouseMove}
          onWheel={handleCategoryWheel}
          style={{ 
            display: 'flex', 
            gap: '6px', 
            overflowX: 'auto', 
            paddingBottom: '2px', 
            scrollbarWidth: 'none', 
            cursor: isCategoryDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
        >
          {currentUser && (
            <button
              onClick={() => {
                triggerHaptic(6);
                setOnlyMySpots(!onlyMySpots);
              }}
              style={{
                backgroundColor: onlyMySpots ? '#fff1ee' : 'rgba(255, 255, 255, 0.88)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: onlyMySpots ? '#e05a47' : '#57534e',
                border: onlyMySpots ? '1px solid #fecdd3' : '1px solid #e7e5e4',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 10px 25px -5px rgba(28, 25, 23, 0.06), 0 0 1px 1px rgba(28, 25, 23, 0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                flexShrink: 0
              }}
            >
              <User style={{ width: '13px', height: '13px' }} />
              My Pins ({mySpotsCount})
            </button>
          )}

          <button
            onClick={() => {
              triggerHaptic(6);
              if (maxRadiusKm === null) setMaxRadiusKm(5);
              else if (maxRadiusKm === 5) setMaxRadiusKm(25);
              else setMaxRadiusKm(null);
            }}
            style={{
              backgroundColor: maxRadiusKm !== null ? '#e0f2fe' : 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: maxRadiusKm !== null ? '#0284c7' : '#57534e',
              border: maxRadiusKm !== null ? '1px solid #bae6fd' : '1px solid #e7e5e4',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 10px 25px -5px rgba(28, 25, 23, 0.06), 0 0 1px 1px rgba(28, 25, 23, 0.03)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              flexShrink: 0
            }}
          >
            <Compass style={{ width: '13px', height: '13px' }} />
            {maxRadiusKm === null ? 'Radius: Any' : `Within ${maxRadiusKm}km`}
          </button>

          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.label.toLowerCase();
            const Icon = cat.icon;
            return (
              <button
                key={cat.label}
                onClick={() => {
                  triggerHaptic(6);
                  setSelectedCategory(cat.label);
                }}
                style={{ 
                  backgroundColor: isSelected ? '#1c1917' : 'rgba(255, 255, 255, 0.88)', 
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: isSelected ? '#fafaf9' : '#57534e', 
                  border: isSelected ? '1px solid #1c1917' : '1px solid #e7e5e4', 
                  padding: '6px 12px', 
                  borderRadius: '20px', 
                  fontSize: '11.5px', 
                  fontWeight: 600, 
                  cursor: 'pointer', 
                  whiteSpace: 'nowrap', 
                  boxShadow: '0 10px 25px -5px rgba(28, 25, 23, 0.06), 0 0 1px 1px rgba(28, 25, 23, 0.03)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  flexShrink: 0 
                }}
              >
                <Icon style={{ width: '12px', height: '12px', color: isSelected ? '#fafaf9' : cat.color }} />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Category Description Banner */}
        {selectedCategory !== 'All' && activeCategoryObject && (
          <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: 'rgba(255, 255, 255, 0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '14px', border: '1px solid #e7e5e4', fontSize: '11px', color: '#57534e', fontWeight: 500, boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.08), 0 0 1px 1px rgba(28, 25, 23, 0.04)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: activeCategoryObject.color, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong>{activeCategoryObject.label}:</strong> {activeCategoryObject.desc}
            </span>
          </div>
        )}

        {/* Active Walk HUD Banner */}
        {walkTargetSpot && (
          <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', backgroundColor: '#1c1917', color: '#fafaf9', borderRadius: '16px', fontSize: '12.5px', fontWeight: 600, boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.25)', gap: '10px' }}>
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

      {/* Empty State Overlay */}
      {filteredSpots.length === 0 && !loading && (
        <div style={{ 
          position: 'fixed', 
          top: `${(selectedCategory !== 'All' ? 215 : 170) + (walkTargetSpot ? 50 : 0)}px`,
          left: '16px', 
          right: '16px', 
          maxWidth: '440px', 
          zIndex: 9998, 
          pointerEvents: 'auto' 
        }}>
          <EmptyState
            category={selectedCategory}
            onResetFilter={() => { setSelectedCategory('All'); setMaxRadiusKm(null); }}
            onAddSpot={() => {
              if (!currentUserRef.current) {
                setIsAuthModalOpen(true);
                pushModalHistoryState('auth');
                return;
              }
              const center = map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 };
              dropPreviewAndOpenModal(center.lat, center.lng);
            }}
          />
        </div>
      )}

      {/* 3. Floating Map Controls */}
      <div style={{ position: 'fixed', bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', right: '20px', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' }}>
        <button onClick={handleLocateMe} disabled={isLocating} style={{ width: '46px', height: '46px', backgroundColor: 'rgba(255, 255, 255, 0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid #e7e5e4', borderRadius: '16px', boxShadow: '0 12px 30px -6px rgba(28, 25, 23, 0.15), 0 0 1px 1px rgba(28, 25, 23, 0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#e05a47' }} title="Locate Me">
          {isLocating ? <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} /> : <Crosshair style={{ width: '20px', height: '20px' }} />}
        </button>

        <button
          onClick={() => {
            triggerHaptic(8);
            setIsWalkModalOpen(true);
            pushModalHistoryState('walkModal');
          }}
          style={{
            width: '46px',
            height: '46px',
            backgroundColor: walkTargetSpot ? '#e05a47' : 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: walkTargetSpot ? '#ffffff' : '#44403c',
            border: walkTargetSpot ? '1px solid #e05a47' : '1px solid #e7e5e4',
            borderRadius: '16px',
            boxShadow: '0 12px 30px -6px rgba(28, 25, 23, 0.15), 0 0 1px 1px rgba(28, 25, 23, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Choose a destination to walk to"
        >
          <Footprints style={{ width: '20px', height: '20px' }} />
        </button>

        {/* Vertical Capsule Day / Night Switch */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: isDarkMode ? '#1c1917' : 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: isDarkMode ? '1px solid #44403c' : '1px solid #e7e5e4',
            borderRadius: '24px',
            padding: '3px',
            boxShadow: '0 12px 30px -6px rgba(28, 25, 23, 0.15), 0 0 1px 1px rgba(28, 25, 23, 0.04)',
            gap: '2px',
          }}
        >
          <button
            onClick={() => {
              triggerHaptic(6);
              setIsDarkMode(false);
            }}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: !isDarkMode ? '#e05a47' : 'transparent',
              color: !isDarkMode ? '#ffffff' : '#a8a29e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: !isDarkMode ? '0 2px 8px rgba(224, 90, 71, 0.35)' : 'none',
            }}
            title="Day Mode"
          >
            <Sun style={{ width: '18px', height: '18px' }} />
          </button>
          <button
            onClick={() => {
              triggerHaptic(6);
              setIsDarkMode(true);
            }}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: isDarkMode ? '#e05a47' : 'transparent',
              color: isDarkMode ? '#ffffff' : '#78716c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isDarkMode ? '0 2px 8px rgba(224, 90, 71, 0.35)' : 'none',
            }}
            title="Dark Mode"
          >
            <MoonStar style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <button onClick={() => map.current?.zoomIn()} style={{ width: '46px', height: '46px', backgroundColor: 'rgba(255, 255, 255, 0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid #e7e5e4', borderRadius: '16px', boxShadow: '0 12px 30px -6px rgba(28, 25, 23, 0.15), 0 0 1px 1px rgba(28, 25, 23, 0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1c1917' }} title="Zoom In">
            <Plus style={{ width: '20px', height: '20px' }} />
          </button>
          <button onClick={() => map.current?.zoomOut()} style={{ width: '46px', height: '46px', backgroundColor: 'rgba(255, 255, 255, 0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid #e7e5e4', borderRadius: '16px', boxShadow: '0 12px 30px -6px rgba(28, 25, 23, 0.15), 0 0 1px 1px rgba(28, 25, 23, 0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1c1917' }} title="Zoom Out">
            <Minus style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
      </div>

      {/* Active Search Result Bottom Action Sheet */}
      {activeSearchedSpot && (
        <div className="animate-slide-up" style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', left: '16px', right: '16px', maxWidth: '410px', zIndex: 99999, backgroundColor: 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.25), 0 0 1px 1px rgba(28, 25, 23, 0.04)', border: '1px solid #e7e5e4', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div style={{ flex: 1, paddingRight: '10px' }}>
              <span style={{ display: 'inline-block', backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', marginBottom: '6px' }}>
                Map Location
              </span>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>{activeSearchedSpot.name}</h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#78716c' }}>{activeSearchedSpot.city}</p>
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
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', boxSizing: 'border-box', padding: '10px', backgroundColor: '#f5f5f4', color: '#1c1917', border: '1px solid #e7e5e4', borderRadius: '14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus style={{ width: '14px', height: '14px' }} /> Save as Curated Pin
            </button>
          </div>
        </div>
      )}

      {/* Proximity Walk Modal with Live Search */}
      {isWalkModalOpen && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100005, padding: '16px' }}>
          <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.3)', width: '100%', maxWidth: '390px', maxHeight: '82vh', display: 'flex', flexDirection: 'column', padding: '20px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', backgroundColor: '#fff1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05a47', flexShrink: 0 }}>
                  <Footprints style={{ width: '19px', height: '19px' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>Where to Walk?</h3>
                  <p style={{ margin: '1px 0 0 0', fontSize: '11.5px', color: '#78716c' }}>Choose a curated spot or search any destination</p>
                </div>
              </div>
              <button onClick={() => dismissModalWithHistory(() => { setIsWalkModalOpen(false); setWalkSearchQuery(''); })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '4px' }}>
                <X style={{ width: '19px', height: '19px' }} />
              </button>
            </div>

            {/* Live Search Input Inside Modal */}
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
                  backgroundColor: '#f5f5f4',
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

            {/* Scrollable Results Area */}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '48vh', paddingRight: '2px' }}>
              {(() => {
                const curatedMatches = proximitySortedSpots.filter((s) => {
                  if (!walkSearchQuery.trim()) return true;
                  const q = walkSearchQuery.toLowerCase();
                  return (
                    s.name.toLowerCase().includes(q) ||
                    s.city.toLowerCase().includes(q) ||
                    s.category.toLowerCase().includes(q)
                  );
                });

                const hasCloseSpots = curatedMatches.length > 0 && (curatedMatches[0] as any).distanceKm <= 50;

                return (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 4px' }}>
                      {hasCloseSpots ? `Field Notes Nearby (${curatedMatches.length})` : `Recent Field Notes (${curatedMatches.length})`}
                    </div>

                    {curatedMatches.length === 0 ? (
                      <p style={{ margin: '4px 0 8px 0', fontSize: '11.5px', color: '#a8a29e', padding: '0 4px' }}>
                        No curated spots match "{walkSearchQuery}".
                      </p>
                    ) : (
                      curatedMatches.map((spot) => (
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
                            backgroundColor: walkTargetSpot?.id === spot.id ? '#fff1ee' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ minWidth: 0, paddingRight: '8px' }}>
                            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {spot.name}
                            </h4>
                            <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: '#78716c' }}>
                              {spot.city} · <span style={{ color: getCategoryColor(spot.category), fontWeight: 600 }}>{spot.category}</span>
                            </p>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', color: '#e05a47', flexShrink: 0 }}>
                            <Navigation2 style={{ width: '14px', height: '14px' }} />
                          </div>
                        </div>
                      ))
                    )}
                  </>
                );
              })()}

              {/* Live Map Search Results */}
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
                        }}
                      >
                        <div style={{ minWidth: 0, paddingRight: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {spot.name}
                          </h4>
                          <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: '#0284c7', fontWeight: 500 }}>
                            {spot.city} · Map Location
                          </p>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', color: '#0284c7', flexShrink: 0 }}>
                          <Navigation2 style={{ width: '14px', height: '14px' }} />
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            {/* Clear Active Walk Button */}
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
                  backgroundColor: '#f5f5f4',
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

      {/* 4. Spot Details Bottom Sheet with Comments / Discussion */}
      {viewingSpot && (
        <div className="animate-slide-up" style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', left: '16px', right: '16px', maxWidth: '410px', maxHeight: '82vh', overflowY: 'auto', zIndex: 99999, backgroundColor: 'rgba(255, 255, 255, 0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.25), 0 0 1px 1px rgba(28, 25, 23, 0.04)', border: '1px solid #e7e5e4', padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div style={{ flex: 1, paddingRight: '10px' }}>
              <span style={{ display: 'inline-block', backgroundColor: `${getCategoryColor(viewingSpot.category)}18`, color: getCategoryColor(viewingSpot.category), fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', marginBottom: '6px' }}>
                {viewingSpot.category}
              </span>
              <h3 style={{ margin: 0, fontSize: '17.5px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>{viewingSpot.name}</h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#78716c' }}>
                {viewingSpot.city}{' '}
                {viewingSpot.user_id && profilesMap[viewingSpot.user_id]?.username ? (
                  <>
                    ·{' '}
                    <span
                      onClick={() => handleOpenPublicProfile(viewingSpot.user_id!)}
                      style={{ color: '#e05a47', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      @{profilesMap[viewingSpot.user_id].username}
                    </span>
                  </>
                ) : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              <button
                onClick={() => toggleVouch(viewingSpot.id)}
                disabled={savingVouch}
                style={{
                  border: 'none',
                  background: viewingSpot.id && vouchedSpotIds.includes(viewingSpot.id) ? '#ecfdf5' : '#f5f5f4',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  color: viewingSpot.id && vouchedSpotIds.includes(viewingSpot.id) ? '#059669' : '#57534e',
                  padding: '7px 9px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
                title="Vouch for this spot"
              >
                <ThumbsUp style={{ width: '15px', height: '15px' }} />
                <span>{viewingSpot.id ? vouchCounts[viewingSpot.id] || 0 : 0}</span>
              </button>

              <button onClick={() => toggleMustTry(viewingSpot.id)} disabled={savingBookmark} style={{ border: 'none', background: viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#fef3c7' : '#f5f5f4', borderRadius: '12px', cursor: 'pointer', color: viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#d97706' : '#57534e', padding: '7px', display: 'flex' }} title="Save to Must-Try">
                {viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? <BookmarkCheck style={{ width: '16px', height: '16px' }} /> : <Bookmark style={{ width: '16px', height: '16px' }} />}
              </button>

              <button onClick={() => handleShareSpot(viewingSpot)} style={{ border: 'none', background: '#f5f5f4', borderRadius: '12px', cursor: 'pointer', color: '#57534e', padding: '7px', display: 'flex', alignItems: 'center', gap: '4px' }} title="Share spot">
                <Share2 style={{ width: '16px', height: '16px' }} />
              </button>

              {currentUser && viewingSpot.user_id === currentUser.id && (
                <>
                  <button onClick={() => handleOpenEditModal(viewingSpot)} style={{ border: 'none', background: '#f5f5f4', borderRadius: '12px', cursor: 'pointer', color: '#57534e', padding: '7px', display: 'flex' }} title="Edit Spot">
                    <Pencil style={{ width: '15px', height: '15px' }} />
                  </button>
                  <button onClick={() => handleDeleteSpot(viewingSpot)} disabled={deleting} style={{ border: 'none', background: '#fff1ee', borderRadius: '12px', cursor: 'pointer', color: '#e05a47', padding: '7px', display: 'flex' }} title="Delete Spot">
                    {deleting ? <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} /> : <Trash2 style={{ width: '15px', height: '15px' }} />}
                  </button>
                </>
              )}
              <button onClick={() => dismissModalWithHistory(() => { setViewingSpot(null); if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname); })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '5px' }}>
                <X style={{ width: '19px', height: '19px' }} />
              </button>
            </div>
          </div>

          {viewingSpot.image_url && <img src={viewingSpot.image_url} alt={viewingSpot.name} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '16px', margin: '8px 0' }} />}
          {viewingSpot.description && <p style={{ margin: '8px 0 14px 0', fontSize: '13px', color: '#44403c', lineHeight: 1.45 }}>{viewingSpot.description}</p>}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            <button
              onClick={() => openNativeWalkNavigation(viewingSpot.latitude, viewingSpot.longitude, viewingSpot.name)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', boxSizing: 'border-box', padding: '11px', backgroundColor: '#1c1917', color: '#fafaf9', border: 'none', borderRadius: '14px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(28, 25, 23, 0.15)' }}
            >
              <Navigation2 style={{ width: '14px', height: '14px' }} /> Get Directions
            </button>

            <button
              onClick={() => handleCopyCoordinates(viewingSpot.latitude, viewingSpot.longitude)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', boxSizing: 'border-box', padding: '10px', backgroundColor: coordsCopied ? '#ecfdf5' : '#f5f5f4', color: coordsCopied ? '#059669' : '#1c1917', border: coordsCopied ? '1px solid #a7f3d0' : '1px solid #e7e5e4', borderRadius: '14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              {coordsCopied ? <Check style={{ width: '14px', height: '14px' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
              {coordsCopied ? 'Coordinates Copied!' : `Copy Coordinates (${viewingSpot.latitude.toFixed(4)}, ${viewingSpot.longitude.toFixed(4)})`}
            </button>
          </div>

          {/* Spot Comments / Field Discussion Section */}
          <div style={{ borderTop: '1px solid #e7e5e4', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: '#57534e', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
              <MessageSquare style={{ width: '13px', height: '13px', color: '#e05a47' }} /> Field Notes Discussion ({spotComments.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto', marginBottom: '10px' }}>
              {spotComments.length === 0 ? (
                <p style={{ margin: 0, fontSize: '11.5px', color: '#a8a29e', fontStyle: 'italic' }}>No tips or comments left yet. Be the first!</p>
              ) : (
                spotComments.map((c) => {
                  const authorProfile = profilesMap[c.user_id];
                  return (
                    <div key={c.id} style={{ backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '10px', padding: '8px 10px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 700, color: '#1c1917' }}>@{authorProfile?.username || 'wanderer'}</span>
                        <span style={{ fontSize: '10px', color: '#a8a29e' }}>{formatRelativeTime(c.created_at)}</span>
                      </div>
                      <p style={{ margin: 0, color: '#44403c', lineHeight: 1.35 }}>{c.content}</p>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Leave a quick tip or note..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                style={{ flex: 1, boxSizing: 'border-box', backgroundColor: '#f5f5f4', border: '1px solid #e7e5e4', borderRadius: '12px', padding: '8px 12px', fontSize: '12px', outline: 'none', color: '#1c1917' }}
              />
              <button
                type="submit"
                disabled={submittingComment || !newCommentText.trim()}
                style={{ backgroundColor: '#1c1917', color: '#fafaf9', border: 'none', borderRadius: '12px', padding: '0 12px', cursor: submittingComment || !newCommentText.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Send Comment"
              >
                {submittingComment ? <Loader2 style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: '13px', height: '13px' }} />}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Public Passport Profile Modal */}
      {viewingProfile && (() => {
        const uniqueCities = Array.from(new Set(viewingProfileSpots.map((s) => s.city.trim()).filter(Boolean)));
        const uniqueCountries = Array.from(new Set(viewingProfileSpots.map((s) => (s.country || '').trim()).filter(Boolean)));
        
        const resolvedCountry = viewingProfile.country || (viewingProfileSpots.length > 0 && viewingProfileSpots[0].country ? viewingProfileSpots[0].country : 'Philippines');

        const filteredProfileSpots = profileCityFilter === 'All' 
          ? viewingProfileSpots 
          : viewingProfileSpots.filter((s) => s.city.trim().toLowerCase() === profileCityFilter.toLowerCase());

        return (
          <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100005, padding: '16px' }}>
            <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '28px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.35)', width: '100%', maxWidth: '440px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px', position: 'relative', boxSizing: 'border-box' }}>
              <button onClick={() => dismissModalWithHistory(() => setViewingProfile(null))} style={{ position: 'absolute', top: '18px', right: '18px', border: 'none', background: '#f5f5f4', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>

              {/* Curator Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px', paddingRight: '30px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '20px', backgroundColor: '#fff1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05a47', overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 12px rgba(224, 90, 71, 0.15)' }}>
                  {viewingProfile.avatar_url ? (
                    <img src={viewingProfile.avatar_url} alt={viewingProfile.username || 'Curator'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Compass style={{ width: '28px', height: '28px' }} />
                  )}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>@{viewingProfile.username || 'wanderer'}</span>
                    <span style={{ 
                      fontSize: '10.5px', 
                      fontWeight: 600, 
                      color: '#78716c', 
                      backgroundColor: '#f5f5f4', 
                      padding: '3px 8px', 
                      borderRadius: '6px', 
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: '1px solid #e7e5e4'
                    }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#e05a47' }} />
                      {resolvedCountry}
                    </span>
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#78716c', fontWeight: 500 }}>
                    {viewingProfile.bio || 'Wanderer & local spot hunter'}
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '18px', padding: '14px 10px', marginBottom: '14px', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#1c1917' }}>{viewingProfileSpots.length}</div>
                  <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Total Pins</div>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#0284c7' }}>{uniqueCities.length}</div>
                  <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Cities</div>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#d97706' }}>{uniqueCountries.length || (viewingProfileSpots.length > 0 ? 1 : 0)}</div>
                  <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Countries</div>
                </div>
              </div>

              {/* City Filter Pills */}
              {uniqueCities.length > 1 && (
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px', scrollbarWidth: 'none' }}>
                  <button
                    onClick={() => {
                      triggerHaptic(6);
                      setProfileCityFilter('All');
                    }}
                    style={{
                      backgroundColor: profileCityFilter === 'All' ? '#1c1917' : '#f5f5f4',
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
                        backgroundColor: profileCityFilter.toLowerCase() === city.toLowerCase() ? '#1c1917' : '#f5f5f4',
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

              <div style={{ fontSize: '12px', fontWeight: 700, color: '#57534e', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Curated Field Notes
              </div>

              {/* Spot Cards */}
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
                        <div style={{ width: '56px', height: '56px', borderRadius: '12px', backgroundColor: '#f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a8a29e', flexShrink: 0 }}>
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
                        <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: '#78716c' }}>{s.city}</p>
                      </div>

                      <button
                        onClick={() => {
                          triggerHaptic(8);
                          dismissModalWithHistory(() => setViewingProfile(null));
                          flyToSpot(s);
                        }}
                        style={{
                          backgroundColor: '#f5f5f4',
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
            </div>
          </div>
        );
      })()}

      {/* Universal Share Modal */}
      {shareDialogSpot && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100004, padding: '16px' }}>
          <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.28)', width: '100%', maxWidth: '360px', padding: '24px', position: 'relative' }}>
            <button onClick={() => dismissModalWithHistory(() => setShareDialogSpot(null))} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '4px' }}>
              <X style={{ width: '20px', height: '20px' }} />
            </button>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>Share Spot</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: '#78716c' }}>Send <strong>{shareDialogSpot.name}</strong> to fellow explorers:</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Check out ${shareDialogSpot.name} in ${shareDialogSpot.city} on Bywayr: ${window.location.origin}${window.location.pathname}?spot=${shareDialogSpot.id}`)}`}
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
                href={`https://t.me/share/url?url=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?spot=${shareDialogSpot.id}`)}&text=${encodeURIComponent(`Check out ${shareDialogSpot.name} in ${shareDialogSpot.city} on Bywayr!`)}`}
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
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${shareDialogSpot.name} in ${shareDialogSpot.city} on Bywayr:`)}&url=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?spot=${shareDialogSpot.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textDecoration: 'none', color: '#1c1917', fontSize: '11px', fontWeight: 600 }}
              >
                <div style={{ width: '46px', height: '46px', borderRadius: '14px', backgroundColor: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800 }}>𝕏</span>
                </div>
                Post
              </a>

              <a
                href={`mailto:?subject=${encodeURIComponent(`Bywayr Spot: ${shareDialogSpot.name}`)}&body=${encodeURIComponent(`Check out this spot in ${shareDialogSpot.city}: ${window.location.origin}${window.location.pathname}?spot=${shareDialogSpot.id}`)}`}
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
                const url = `${window.location.origin}${window.location.pathname}?spot=${shareDialogSpot.id}`;
                await navigator.clipboard.writeText(url);
                setShareDialogCopied(true);
                setTimeout(() => setShareDialogCopied(false), 2500);
              }}
              style={{
                width: '100%',
                backgroundColor: shareDialogCopied ? '#ecfdf5' : '#f5f5f4',
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

      {/* Slide-Out Drawer with Live Distance Badges & Offline Export */}
      {isDrawerOpen && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(3px)', zIndex: 100000, display: 'flex', justifyContent: 'flex-start' }}>
          <div className="animate-slide-left" style={{ width: '100%', maxWidth: '370px', backgroundColor: '#ffffff', height: '100%', boxShadow: '10px 0 35px rgba(28, 25, 23, 0.18)', display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingTop: 'env(safe-area-inset-top, 0px)', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>{drawerTab === 'fieldNotes' ? 'Field Notes' : 'Must-Try'}</h2>
              <button onClick={() => dismissModalWithHistory(() => setIsDrawerOpen(false))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {/* Tabs & Offline Export Actions */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexShrink: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: '#f5f5f4', borderRadius: '14px', padding: '3px', flex: 1 }}>
                <button onClick={() => { triggerHaptic(6); setDrawerTab('fieldNotes'); }} style={{ border: 'none', padding: '7px 0', borderRadius: '11px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', backgroundColor: drawerTab === 'fieldNotes' ? '#ffffff' : 'transparent', color: drawerTab === 'fieldNotes' ? '#1c1917' : '#78716c', boxShadow: drawerTab === 'fieldNotes' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>Field Notes</button>
                <button onClick={() => { triggerHaptic(6); if (!currentUserRef.current) { setIsAuthModalOpen(true); pushModalHistoryState('auth'); return; } setDrawerTab('mustTry'); }} style={{ border: 'none', padding: '7px 0', borderRadius: '11px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', backgroundColor: drawerTab === 'mustTry' ? '#ffffff' : 'transparent', color: drawerTab === 'mustTry' ? '#1c1917' : '#78716c', boxShadow: drawerTab === 'mustTry' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>Must-Try ({mustTrySpotIds.length})</button>
              </div>
              <button
                onClick={() => handleExportData('json')}
                style={{ backgroundColor: '#f5f5f4', border: '1px solid #d6d3d1', borderRadius: '14px', padding: '0 10px', color: '#44403c', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                title="Export as JSON or GPX for offline maps"
              >
                <Download style={{ width: '13px', height: '13px' }} /> Export
              </button>
            </div>
            
            {/* Scrollable Spot List with Skeleton Loaders */}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', scrollbarWidth: 'thin', minHeight: 0 }}>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <div key={`skel-${idx}`} className="skeleton-pulse" style={{ height: '64px', width: '100%', flexShrink: 0 }} />
                ))
              ) : (
                displayedDrawerSpots.map((spot) => {
                  const color = getCategoryColor(spot.category);
                  const distanceVal = userCoords ? getDistanceFromLatLonInKm(userCoords.lat, userCoords.lng, spot.latitude, spot.longitude) : null;
                  const distanceText = distanceVal !== null ? (distanceVal < 1 ? `${Math.round(distanceVal * 1000)}m away` : `${distanceVal.toFixed(1)}km away`) : null;

                  return (
                    <div
                      key={spot.id || spot.name}
                      onClick={() => {
                        triggerHaptic(8);
                        dismissModalWithHistory(() => setIsDrawerOpen(false));
                        flyToSpot(spot);
                      }}
                      className="spot-card-hover"
                      style={{
                        padding: '12px 14px',
                        borderRadius: '14px',
                        border: '1px solid #e7e5e4',
                        borderLeft: `4px solid ${color}`,
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        flexShrink: 0,
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
                              fontSize: '13.5px',
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
                  );
                })
              )}
            </div>

            {/* Sticky Travel Essentials Footer */}
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e7e5e4', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', paddingLeft: '4px' }}>
                Travel Essentials
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* 1. Aviasales */}
                <a href="https://aviasales.tpk.lv/Y7mdLlKw" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '12px', color: '#1c1917', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e7e5e4', flexShrink: 0 }}>
                      <img src="/aviasales.svg" alt="Aviasales" style={{ width: '14px', height: '14px', objectFit: 'contain' }} onError={(e)=>{(e.target as HTMLElement).style.display='none'}} />
                    </div>
                    <span>Flight Search — Aviasales</span>
                  </div>
                  <ArrowRight style={{ width: '13px', height: '13px', color: '#a8a29e' }} />
                </a>

                {/* 2. Klook */}
                <a href="https://klook.tpk.lv/sZHsJIxR" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '12px', color: '#1c1917', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e7e5e4', flexShrink: 0 }}>
                      <img src="/klook.svg" alt="Klook" style={{ width: '14px', height: '14px', objectFit: 'contain' }} onError={(e)=>{(e.target as HTMLElement).style.display='none'}} />
                    </div>
                    <span>Tours, Hotels & Tickets — Klook</span>
                  </div>
                  <ArrowRight style={{ width: '13px', height: '13px', color: '#a8a29e' }} />
                </a>

                {/* 3. Yesim */}
                <a href="https://yesim.tpk.lv/o2T5nWaw" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '12px', color: '#1c1917', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e7e5e4', flexShrink: 0 }}>
                      <img src="/yesim.svg" alt="Yesim" style={{ width: '14px', height: '14px', objectFit: 'contain' }} onError={(e)=>{(e.target as HTMLElement).style.display='none'}} />
                    </div>
                    <span>eSIM Data — Yesim</span>
                  </div>
                  <ArrowRight style={{ width: '13px', height: '13px', color: '#a8a29e' }} />
                </a>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Profile Modal */}
      {isProfileModalOpen && currentUser && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100001, padding: '16px' }}>
          <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.28)', width: '100%', maxWidth: '380px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', position: 'relative' }}>
            <button onClick={() => dismissModalWithHistory(() => setIsProfileModalOpen(false))} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '4px' }}>
              <X style={{ width: '20px', height: '20px' }} />
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '18px' }}>
              <label style={{ width: '72px', height: '72px', borderRadius: '24px', backgroundColor: '#f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1917', position: 'relative', overflow: 'hidden', cursor: 'pointer', border: '1px solid #e7e5e4', marginBottom: '10px', boxShadow: '0 8px 20px rgba(28, 25, 23, 0.08)' }} title="Click to upload profile photo">
                {uploadingAvatar ? (
                  <Loader2 style={{ width: '22px', height: '22px', animation: 'spin 1s linear infinite', color: '#e05a47' }} />
                ) : userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User style={{ width: '30px', height: '30px', color: '#78716c' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', color: '#ffffff' }} onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')} onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}>
                  <Camera style={{ width: '20px', height: '20px' }} />
                </div>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
              </label>

              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1c1917', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '-0.02em' }}>
                {userProfile?.username ? `@${userProfile.username}` : 'Field Journal'}
                <button onClick={() => { setIsProfileModalOpen(false); setClaimUsername(userProfile?.username || ''); setIsClaimUsernameModalOpen(true); pushModalHistoryState('claimUsername'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', padding: '2px' }} title="Change Username">
                  <Pencil style={{ width: '13px', height: '13px' }} />
                </button>
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#78716c' }}>{currentUser.email}</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '16px', padding: '12px', marginBottom: '14px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#1c1917' }}>{mySpotsCount}</div>
                <div style={{ fontSize: '10.5px', color: '#78716c', fontWeight: 600 }}>Pins</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#d97706' }}>{mustTrySpotIds.length}</div>
                <div style={{ fontSize: '10.5px', color: '#78716c', fontWeight: 600 }}>Must-Try</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0284c7' }}>{myCitiesCount}</div>
                <div style={{ fontSize: '10.5px', color: '#78716c', fontWeight: 600 }}>Cities</div>
              </div>
            </div>

            {/* Offline Export Actions in Profile Modal */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              <button
                onClick={() => handleExportData('json')}
                style={{ backgroundColor: '#f5f5f4', border: '1px solid #d6d3d1', color: '#1c1917', fontWeight: 600, fontSize: '12px', padding: '10px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Download style={{ width: '14px', height: '14px' }} /> Export JSON
              </button>
              <button
                onClick={() => handleExportData('gpx')}
                style={{ backgroundColor: '#f5f5f4', border: '1px solid #d6d3d1', color: '#1c1917', fontWeight: 600, fontSize: '12px', padding: '10px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Download style={{ width: '14px', height: '14px' }} /> Export GPX
              </button>
            </div>

            {/* Bywayr Plus Coming Soon Section */}
            <div style={{ backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '16px', padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1c1917', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Crown style={{ width: '15px', height: '15px', color: '#d97706' }} /> Bywayr Plus
                </span>
                <span style={{ backgroundColor: '#fef3c7', color: '#d97706', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>Coming soon</span>
              </div>
              <p style={{ margin: 0, fontSize: '11.5px', color: '#78716c', lineHeight: 1.4 }}>
                Unlock custom categories, custom icons, and JSON backups via Google Play & App Store billing.
              </p>
            </div>

            <div onClick={() => { triggerHaptic(6); setOnlyMySpots(!onlyMySpots); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', backgroundColor: onlyMySpots ? '#fff1ee' : '#ffffff', border: onlyMySpots ? '1px solid #fecdd3' : '1px solid #e7e5e4', borderRadius: '14px', cursor: 'pointer', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin style={{ width: '16px', height: '16px', color: onlyMySpots ? '#e05a47' : '#78716c' }} />
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: onlyMySpots ? '#e05a47' : '#44403c' }}>Filter map to my pins only</span>
              </div>
              {onlyMySpots ? <CheckSquare style={{ width: '16px', height: '16px', color: '#e05a47' }} /> : <Square style={{ width: '16px', height: '16px', color: '#a8a29e' }} />}
            </div>

            <button onClick={handleSignOut} style={{ width: '100%', backgroundColor: '#fff1ee', color: '#e05a47', fontWeight: 600, fontSize: '12.5px', padding: '11px', borderRadius: '14px', border: '1px solid #fed7aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <LogOut style={{ width: '14px', height: '14px' }} /> Sign Out
            </button>

            <button
              onClick={() => {
                triggerHaptic(8);
                setDeleteConfirmText('');
                setIsDeleteAccountModalOpen(true);
                pushModalHistoryState('deleteAccount');
              }}
              style={{
                marginTop: '12px',
                background: 'none',
                border: 'none',
                color: '#a8a29e',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
                width: '100%',
                padding: '4px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#e05a47')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#a8a29e')}
            >
              Delete Account
            </button>
          </div>
        </div>
      )}

      {/* Delete Account Verification Dialog */}
      {isDeleteAccountModalOpen && currentUser && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100003, padding: '16px' }}>
          <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.35)', width: '100%', maxWidth: '360px', padding: '24px', position: 'relative', textAlign: 'center', boxSizing: 'border-box' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: '#fff1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: '#e05a47' }}>
              <AlertTriangle style={{ width: '24px', height: '24px' }} />
            </div>

            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>Delete Account</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#78716c', lineHeight: 1.45 }}>
              This will permanently delete your profile, handle, and bookmarks. Your public spots will remain anonymously as community field notes.
            </p>

            <div style={{ marginBottom: '14px', textAlign: 'left' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#57534e', display: 'block', marginBottom: '5px' }}>
                Type <span style={{ color: '#e05a47' }}>DELETE</span> to confirm:
              </label>
              <input
                type="text"
                autoFocus
                placeholder="DELETE"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '10px 12px', borderRadius: '12px', border: '1px solid #d6d3d1', outline: 'none', textAlign: 'center', letterSpacing: '0.05em', fontWeight: 700 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || isDeletingAccount}
                style={{
                  width: '100%',
                  backgroundColor: deleteConfirmText.trim().toUpperCase() === 'DELETE' ? '#e05a47' : '#f5f5f4',
                  color: deleteConfirmText.trim().toUpperCase() === 'DELETE' ? '#ffffff' : '#a8a29e',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  padding: '12px',
                  borderRadius: '14px',
                  border: 'none',
                  cursor: deleteConfirmText.trim().toUpperCase() === 'DELETE' && !isDeletingAccount ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: deleteConfirmText.trim().toUpperCase() === 'DELETE' ? '0 4px 12px rgba(224, 90, 71, 0.25)' : 'none',
                }}
              >
                {isDeletingAccount ? <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} /> : 'Permanently Delete Account'}
              </button>

              <button
                onClick={() => dismissModalWithHistory(() => setIsDeleteAccountModalOpen(false))}
                disabled={isDeletingAccount}
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  color: '#78716c',
                  fontWeight: 600,
                  fontSize: '12px',
                  padding: '8px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Claim Handle Modal */}
      {isClaimUsernameModalOpen && currentUser && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.5)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100002, padding: '16px' }}>
          <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.3)', width: '100%', maxWidth: '360px', padding: '24px', position: 'relative' }}>
            <div style={{ width: '46px', height: '46px', backgroundColor: '#fff1ee', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: '#e05a47' }}>
              <AtSign style={{ width: '24px', height: '24px' }} />
            </div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#1c1917', textAlign: 'center', letterSpacing: '-0.02em' }}>Choose Your Handle</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: '#78716c', textAlign: 'center' }}>Pick a unique handle for your pins and collections on Bywayr.</p>

            <form onSubmit={handleClaimUsername} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>Username</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', color: '#a8a29e', fontSize: '13.5px', fontWeight: 600 }}>@</span>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    placeholder="traveler"
                    value={claimUsername}
                    onChange={(e) => {
                      const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                      setClaimUsername(clean);
                      if (clean.length > 0 && clean.length < 3) {
                        setClaimUsernameError('Must be at least 3 characters');
                      } else {
                        setClaimUsernameError('');
                      }
                    }}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '13.5px', padding: '10px 12px 10px 28px', borderRadius: '14px', border: claimUsernameError ? '1px solid #e05a47' : '1px solid #d6d3d1', outline: 'none' }}
                  />
                </div>
                {claimUsernameError && <span style={{ color: '#e05a47', fontSize: '11px', marginTop: '4px', display: 'block' }}>{claimUsernameError}</span>}
              </div>

              <button type="submit" disabled={isSavingUsername || claimUsername.length < 3} style={{ width: '100%', backgroundColor: '#1c1917', color: '#fafaf9', fontWeight: 600, fontSize: '12.5px', padding: '12px', borderRadius: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                {isSavingUsername ? <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} /> : 'Set Username'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 10. Auth Modal */}
      {isAuthModalOpen && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100001, padding: '16px' }}>
          <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.3)', width: '100%', maxWidth: '360px', padding: '24px', position: 'relative', textAlign: 'center' }}>
            <button onClick={() => dismissModalWithHistory(() => setIsAuthModalOpen(false))} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '4px' }}>
              <X style={{ width: '20px', height: '20px' }} />
            </button>
            <div style={{ width: '52px', height: '52px', borderRadius: '22.5%', overflow: 'hidden', display: 'flex', margin: '0 auto 14px auto', boxShadow: '0 6px 16px rgba(28, 25, 23, 0.1)', border: '1px solid rgba(0, 0, 0, 0.06)' }}>
              <img src="/icon-512.png" alt="Bywayr" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>Join Bywayr</h3>
            <p style={{ margin: '0 0 18px 0', fontSize: '12.5px', color: '#78716c' }}>Sign in to curate, pin, and protect your favorite local spots.</p>
            
            <button onClick={handleGoogleSignIn} style={{ width: '100%', backgroundColor: '#ffffff', border: '1px solid #d6d3d1', borderRadius: '14px', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', fontSize: '13px', fontWeight: 600, color: '#1c1917', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', marginBottom: '14px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '14px 0' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e7e5e4' }} />
              <span style={{ fontSize: '11px', color: '#a8a29e', fontWeight: 600 }}>OR EMAIL</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e7e5e4' }} />
            </div>

            {magicLinkSent ? (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                <CheckCircle2 style={{ color: '#16a34a', width: '24px', height: '24px', margin: '0 auto 5px auto' }} />
                <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600, color: '#15803d' }}>Magic Link Sent!</p>
                <p style={{ margin: '3px 0 0 0', fontSize: '11.5px', color: '#166534' }}>Check your inbox for <strong>{authEmail}</strong> to sign in.</p>
              </div>
            ) : (
              <form onSubmit={handleMagicLinkSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ textAlign: 'left' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '3px' }}>Username (for new users)</label>
                  <input
                    type="text"
                    maxLength={20}
                    placeholder="e.g. explorer_ph"
                    value={authUsername}
                    onChange={(e) => {
                      const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                      setAuthUsername(clean);
                      if (clean.length > 0 && clean.length < 3) {
                        setAuthUsernameError('Must be at least 3 characters');
                      } else {
                        setAuthUsernameError('');
                      }
                    }}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '10px 12px', borderRadius: '14px', border: authUsernameError ? '1px solid #e05a47' : '1px solid #d6d3d1', outline: 'none' }}
                  />
                  {authUsernameError && <span style={{ color: '#e05a47', fontSize: '11px', marginTop: '3px', display: 'block' }}>{authUsernameError}</span>}
                </div>

                <div style={{ textAlign: 'left' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '3px' }}>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="Enter your email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '10px 12px', borderRadius: '14px', border: '1px solid #d6d3d1', outline: 'none' }}
                  />
                </div>

                <button type="submit" disabled={isSendingMagicLink} style={{ width: '100%', backgroundColor: '#1c1917', color: '#fafaf9', fontWeight: 600, fontSize: '12.5px', padding: '12px', borderRadius: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                  {isSendingMagicLink ? <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} /> : <><Mail style={{ width: '14px', height: '14px' }} /> Send Magic Link</>}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 11. Add / Edit Spot Modal */}
      {isModalOpen && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '16px' }}>
          <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.3)', width: '100%', maxWidth: '380px', padding: '24px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => dismissModalWithHistory(handleCloseModal)} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '4px' }}>
              <X style={{ width: '20px', height: '20px' }} />
            </button>
            <h2 style={{ margin: '0 0 14px 0', fontWeight: 700, fontSize: '17px', color: '#1c1917', display: 'flex', alignItems: 'center', gap: '7px', letterSpacing: '-0.02em' }}>
              <MapPin style={{ width: '19px', height: '19px' }} color="#e05a47" />
              {isEditing ? 'Edit Spot' : 'Add to Bywayr'}
            </h2>
            <form onSubmit={handleSaveSpot} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>Photo (Optional)</label>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '90px', border: '2px dashed #d6d3d1', borderRadius: '14px', cursor: 'pointer', backgroundColor: imagePreview ? 'transparent' : '#fafaf9', position: 'relative', overflow: 'hidden' }}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#78716c' }}>
                      <Camera style={{ width: '20px', height: '20px' }} />
                      <span style={{ fontSize: '11.5px', fontWeight: 500 }}>Tap to upload image</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
                </label>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  onClick={handleModalLocate}
                  disabled={isModalLocating}
                  style={{
                    backgroundColor: '#f5f5f4',
                    color: '#1c1917',
                    border: '1px solid #d6d3d1',
                    borderRadius: '14px',
                    padding: '9px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  {isModalLocating ? (
                    <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Crosshair style={{ width: '14px', height: '14px' }} />
                  )}
                  Pin My Current Location
                </button>
              )}

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>Spot Name</label>
                <input required autoFocus type="text" placeholder="e.g. Hidden Rooftop Cafe" value={newSpot.name} onChange={(e) => setNewSpot({ ...newSpot, name: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '10px 12px', borderRadius: '14px', border: '1px solid #d6d3d1' }} />
              </div>
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>Latitude</label>
                    <input required type="number" step="any" value={newSpot.latitude} onChange={(e) => setNewSpot({ ...newSpot, latitude: parseFloat(e.target.value) })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '10px 12px', borderRadius: '14px', border: '1px solid #d6d3d1' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>Longitude</label>
                    <input required type="number" step="any" value={newSpot.longitude} onChange={(e) => setNewSpot({ ...newSpot, longitude: parseFloat(e.target.value) })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '10px 12px', borderRadius: '14px', border: '1px solid #d6d3d1' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>Category</label>
                  <select value={newSpot.category} onChange={(e) => setNewSpot({ ...newSpot, category: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '10px 12px', borderRadius: '14px', border: '1px solid #d6d3d1', backgroundColor: '#fff' }}>
                    {CATEGORIES.filter(c => c.label !== 'All').map(cat => (
                      <option key={cat.label} value={cat.label}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>City</label>
                  <input type="text" value={newSpot.city} onChange={(e) => setNewSpot({ ...newSpot, city: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '10px 12px', borderRadius: '14px', border: '1px solid #d6d3d1' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>Notes / Description</label>
                <textarea rows={2} placeholder="Atmosphere, tips, menu favorites, best time to visit..." value={newSpot.description} onChange={(e) => setNewSpot({ ...newSpot, description: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '10px 12px', borderRadius: '14px', border: '1px solid #d6d3d1', resize: 'none' }} />
              </div>
              <button type="submit" disabled={saving || uploadingImage} style={{ marginTop: '4px', width: '100%', backgroundColor: '#e05a47', color: '#ffffff', fontWeight: 600, fontSize: '13px', padding: '12px', borderRadius: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(224, 90, 71, 0.25)' }}>
                {saving || uploadingImage ? <Loader2 style={{ width: '16px', height: '16px' }} /> : isEditing ? 'Update Spot' : 'Save Spot'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 12. Welcome Onboarding Modal */}
      {showWelcome && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100003, padding: '16px' }}>
          <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.35)', width: '100%', maxWidth: '370px', padding: '28px 22px', position: 'relative', textAlign: 'center', boxSizing: 'border-box' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '22.5%', overflow: 'hidden', display: 'flex', margin: '0 auto 16px auto', boxShadow: '0 10px 24px -4px rgba(224, 90, 71, 0.25)', border: '1px solid rgba(0, 0, 0, 0.06)' }}>
              <img src="/icon-512.png" alt="Bywayr" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 800, color: '#1c1917', letterSpacing: '-0.03em' }}>
              Your Pocket Field Guide
            </h2>
            <p style={{ margin: '0 0 18px 0', fontSize: '12.5px', color: '#78716c', lineHeight: 1.45 }}>
              A quiet map for expats, travelers, and wanderers to curate and share the unmapped local spots guidebooks overlook.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', marginBottom: '22px', backgroundColor: '#fafaf9', padding: '14px 15px', borderRadius: '16px', border: '1px solid #e7e5e4' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ backgroundColor: '#fff1ee', padding: '6px', borderRadius: '10px', color: '#e05a47', flexShrink: 0, display: 'flex', marginTop: '1px' }}>
                  <Gem style={{ width: '14px', height: '14px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1c1917' }}>Curate Unmapped Corners</div>
                  <div style={{ fontSize: '11px', color: '#78716c', lineHeight: 1.35 }}>Plot backstreet food stalls, hidden night views, and unlisted local gems.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ backgroundColor: '#ecfdf5', padding: '6px', borderRadius: '10px', color: '#059669', flexShrink: 0, display: 'flex', marginTop: '1px' }}>
                  <ThumbsUp style={{ width: '14px', height: '14px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1c1917' }}>Community Vouches</div>
                  <div style={{ fontSize: '11px', color: '#78716c', lineHeight: 1.35 }}>Tag genuine community finds and keep track of your favorite spots.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ backgroundColor: '#fef3c7', padding: '6px', borderRadius: '10px', color: '#d97706', flexShrink: 0, display: 'flex', marginTop: '1px' }}>
                  <BookmarkCheck style={{ width: '14px', height: '14px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1c1917' }}>Personal Passport</div>
                  <div style={{ fontSize: '11px', color: '#78716c', lineHeight: 1.35 }}>Build your personal Passport, categorize your finds, and collect secret local spots along the way.</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => dismissModalWithHistory(handleDismissWelcome)}
              style={{ width: '100%', backgroundColor: '#1c1917', color: '#fafaf9', fontWeight: 700, fontSize: '13.5px', padding: '12px', borderRadius: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 14px rgba(28, 25, 23, 0.22)' }}
            >
              Open the Field Guide
            </button>
          </div>
        </div>
      )}

      {/* Exit App Confirmation Toast */}
      {showExitToast && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(28, 25, 23, 0.92)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: '#fafaf9',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            zIndex: 100010,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            pointerEvents: 'none',
          }}
        >
          Press back again to exit Bywayr
        </div>
      )}

      {/* PWA Web Install Banner */}
      <PwaInstallBanner />
    </div>
  );
}