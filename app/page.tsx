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
  MessageSquare,
  WifiOff,
  Mic2,
  Award,
  Globe,
  Clock,
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
  { label: 'Hidden Gems', desc: 'Secret viewpoints & quiet local treasures', color: '#e05a47', icon: Gem },
  { label: 'Street Food & Stalls', desc: 'Backstreet carts & unmapped night bites', color: '#ea580c', icon: Utensils },
  { label: 'Local Eats', desc: 'Hole-in-the-wall diners & neighborhood spots', color: '#d97706', icon: Store },
  { label: 'Cafes & Workspaces', desc: 'Nomad-friendly spots with reliable Wi-Fi', color: '#2563eb', icon: Laptop },
  { label: 'Bars & Nightlife', desc: 'Local watering holes & concept pubs', color: '#db2777', icon: Beer },
  { label: 'Host & KTV Lounges', desc: 'Private karaoke rooms & companion spaces', color: '#7c3aed', icon: Mic2 },
  { label: 'Entertainment & Play', desc: 'Retro arcades, game lofts & amusement', color: '#6366f1', icon: Gamepad2 },
  { label: 'Markets & Shops', desc: 'Produce alleys & independent thrift stalls', color: '#b45309', icon: Disc },
  { label: 'Nature & Trails', desc: 'Trailheads, hidden coves & green pockets', color: '#0d9488', icon: Trees },
  { label: 'Culture & Shrines', desc: 'Neighborhood temples & historical plaques', color: '#059669', icon: Landmark },
  { label: 'Stays & Hideaways', desc: 'Boutique guesthouses & quiet retreats', color: '#4f46e5', icon: HomeIcon },
  { label: 'Practical Staples', desc: 'Essential local services, ATMs & transit nooks', color: '#0284c7', icon: Compass },
];

const STAMP_PALETTE = ['#0d9488', '#e05a47', '#0284c7', '#059669', '#7c3aed', '#d97706', '#db2777', '#4f46e5'];
const COMMENT_TAGS = ['[Tip]', '[Menu / Price]', '[Work / Wi-Fi]', '[Vibe Check]', '[Status: Closed]'];

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
  if (cat.includes('cafe') || cat.includes('work')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></svg>`;
  }
  if (cat.includes('street food') || cat.includes('eats')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M15 2v18"/><path d="M6 2v20"/><path d="M3 2v4a3 3 0 0 0 3 3v0a3 3 0 0 0 3-3V2"/></svg>`;
  }
  if (cat.includes('bar') || cat.includes('nightlife')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="4"/></svg>`;
  }
  if (cat.includes('host') || cat.includes('ktv')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`;
  }
  if (cat.includes('nature') || cat.includes('trail')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v.2A3 3 0 0 1 8.9 16v0H5v0h0a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.9"/></svg>`;
  }
  if (cat.includes('entertainment') || cat.includes('play')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="18" y2="12"/><line x1="12" y1="6" x2="12" y2="18"/><circle cx="18" cy="15" r="1"/><circle cx="16" cy="9" r="1"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>`;
  }
  if (cat.includes('stay') || cat.includes('hideaway')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
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
  } else if (lowerCity.includes('vegas') || lowerCity.includes('los angeles') || lowerCity.includes('san francisco') || lowerCountry.includes('united states') || lowerCountry.includes('usa')) {
    cCountry = 'United States';
  }

  return { city: cCity, country: cCountry };
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

export default function Home() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const previewMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const spotMarkersRef = useRef<maplibregl.Marker[]>([]);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const profileStampScrollRef = useRef<HTMLDivElement>(null);
  const publicStampScrollRef = useRef<HTMLDivElement>(null);

  // Category Drag Scrolling
  const [isCategoryDragging, setIsCategoryDragging] = useState(false);
  const [categoryStartX, setCategoryStartX] = useState(0);
  const [categoryScrollLeft, setCategoryScrollLeft] = useState(0);

  // Stamp Drag Scrolling on PC
  const [isStampDragging, setIsStampDragging] = useState(false);
  const [stampStartX, setStampStartX] = useState(0);
  const [stampScrollLeft, setStampScrollLeft] = useState(0);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const currentUserRef = useRef<any>(null);

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileClosing, setIsProfileClosing] = useState(false);
  const [isClaimUsernameModalOpen, setIsClaimUsernameModalOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Edit Country state in Profile
  const [isEditingCountry, setIsEditingCountry] = useState(false);
  const [editCountryValue, setEditCountryValue] = useState('');
  const [savingCountry, setSavingCountry] = useState(false);

  // Country Filter active on map
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string | null>(null);

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
    country?: string;
    latitude: number;
    longitude: number;
  } | null>(null);

  const [viewingSpot, setViewingSpot] = useState<Spot | null>(null);
  const [isDiscussionModalOpen, setIsDiscussionModalOpen] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bywayr_dark_mode') === 'true';
    }
    return false;
  });
  const [isInteracting, setIsInteracting] = useState(false);

  const [isControlsHidden, setIsControlsHidden] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isInteracting) {
      setIsControlsHidden(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        setIsControlsHidden(false);
      }, 400);
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isInteracting]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bywayr_dark_mode', isDarkMode.toString());
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [authEmail, setAuthEmail] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authCountry, setAuthCountry] = useState('');
  const [authUsernameError, setAuthUsernameError] = useState('');
  const [claimUsername, setClaimUsername] = useState('');
  const [claimCountry, setClaimCountry] = useState('');
  const [claimUsernameError, setClaimUsernameError] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz.includes('Asia/Phnom_Penh')) { setAuthCountry('Cambodia'); setClaimCountry('Cambodia'); }
      else if (tz.includes('Asia/Hong_Kong')) { setAuthCountry('Hong Kong'); setClaimCountry('Hong Kong'); }
      else if (tz.includes('Asia/Manila')) { setAuthCountry('Philippines'); setClaimCountry('Philippines'); }
      else if (tz.includes('Asia/Tokyo')) { setAuthCountry('Japan'); setClaimCountry('Japan'); }
      else if (tz.includes('America/')) { setAuthCountry('United States'); setClaimCountry('United States'); }
      else { setAuthCountry('United States'); setClaimCountry('United States'); }
    } catch {}
  }, []);

  const [onlyMySpots, setOnlyMySpots] = useState(false);
  const [maxRadiusKm, setMaxRadiusKm] = useState<number | null>(null);

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
  const [isDrawerClosing, setIsDrawerClosing] = useState(false);

  const [drawerTab, setDrawerTab] = useState<'fieldNotes' | 'mustTry'>('fieldNotes');
  const [mustTrySpotIds, setMustTrySpotIds] = useState<string[]>([]);
  const [savingBookmark, setSavingBookmark] = useState(false);

  const [spotComments, setSpotComments] = useState<SpotComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentTag, setCommentTag] = useState<string>('[Tip]');
  const [upvotedCommentIds, setUpvotedCommentIds] = useState<string[]>([]);
  const [submittingComment, setSubmittingComment] = useState(false);

  const [shareDialogSpot, setShareDialogSpot] = useState<Spot | null>(null);
  const [shareDialogCustomText, setShareDialogCustomText] = useState<string>('');
  const [shareDialogCustomTitle, setShareDialogCustomTitle] = useState<string>('');
  const [shareDialogCustomUrl, setShareDialogCustomUrl] = useState<string>('');
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

  const myUserSpots = currentUser ? spots.filter((s: Spot) => s.user_id === currentUser.id) : [];
  const myPassportStamps = extractPassportStamps(myUserSpots);
  const recentUserSpots = [...myUserSpots].sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA;
  }).slice(0, 3);

  const filteredSpots = spots
    .filter((spot: Spot) => {
      if (onlyMySpots && currentUser && spot.user_id !== currentUser.id) return false;
      if (selectedCountryFilter && (spot.country || '').toLowerCase() !== selectedCountryFilter.toLowerCase()) return false;
      if (maxRadiusKm !== null) {
        const anchorLat = userCoords ? userCoords.lat : (map.current ? map.current.getCenter().lat : 36.1699);
        const anchorLng = userCoords ? userCoords.lng : (map.current ? map.current.getCenter().lng : -115.1398);
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

  const displayedDrawerSpots = drawerTab === 'fieldNotes' ? filteredSpots : spots.filter((s: Spot) => s.id && mustTrySpotIds.includes(s.id));
  const mySpotsCount = myUserSpots.length;
  const myCitiesCount = currentUser ? new Set(myUserSpots.map((s) => s.city.trim())).size : 0;
  const myCountriesCount = myPassportStamps.length;
  
  const activeCategoryObject = CATEGORIES.find((c) => c.label.toLowerCase() === selectedCategory.toLowerCase());

  const mapCenter = map.current ? map.current.getCenter() : { lat: 36.1699, lng: -115.1398 };
  const proximitySortedSpots: Spot[] = [...spots]
    .filter((s: Spot) => s.latitude && s.longitude)
    .map((spot) => ({
      ...spot,
      distanceKm: getDistanceFromLatLonInKm(mapCenter.lat, mapCenter.lng, spot.latitude, spot.longitude),
    }))
    .sort((a: any, b: any) => a.distanceKm - b.distanceKm);

  const isAnyOverlayActive = !!(
    isModalOpen ||
    isDrawerOpen ||
    isDrawerClosing ||
    isProfileModalOpen ||
    isProfileClosing ||
    viewingSpot ||
    isDiscussionModalOpen ||
    viewingProfile ||
    isWalkModalOpen ||
    shareDialogSpot ||
    shareDialogCustomUrl ||
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

  const handleCloseDrawer = () => {
    triggerHaptic(6);
    setIsDrawerClosing(true);
    setTimeout(() => {
      setIsDrawerOpen(false);
      setIsDrawerClosing(false);
    }, 320);
    if (!isPopstateHandling.current && typeof window !== 'undefined' && window.history.state?.bywayr_sheet) {
      window.history.back();
    }
  };

  const handleCloseProfileDrawer = () => {
    triggerHaptic(6);
    setIsProfileClosing(true);
    setIsEditingCountry(false);
    setTimeout(() => {
      setIsProfileModalOpen(false);
      setIsProfileClosing(false);
    }, 320);
    if (!isPopstateHandling.current && typeof window !== 'undefined' && window.history.state?.bywayr_sheet) {
      window.history.back();
    }
  };

  const closeTopmostSheet = useCallback(() => {
    if (isDeleteAccountModalOpen) { setIsDeleteAccountModalOpen(false); return; }
    if (isClaimUsernameModalOpen) { setIsClaimUsernameModalOpen(false); return; }
    if (isProfileModalOpen) { handleCloseProfileDrawer(); return; }
    if (isAuthModalOpen) { setIsAuthModalOpen(false); return; }
    if (shareDialogSpot || shareDialogCustomUrl) { setShareDialogSpot(null); setShareDialogCustomUrl(''); return; }
    if (isWalkModalOpen) { setIsWalkModalOpen(false); return; }
    if (viewingProfile) { setViewingProfile(null); return; }
    if (isDiscussionModalOpen) {
      setIsDiscussionModalOpen(false);
      return;
    }
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
    if (isDrawerOpen) { handleCloseDrawer(); return; }
    if (showWelcome) { handleDismissWelcome(); return; }
  }, [
    isDeleteAccountModalOpen,
    isClaimUsernameModalOpen,
    isProfileModalOpen,
    isAuthModalOpen,
    shareDialogSpot,
    shareDialogCustomUrl,
    isWalkModalOpen,
    viewingProfile,
    isDiscussionModalOpen,
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

  // Stamp Drag Scrolling on PC with Left Mouse Button Hold & Drag
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

  const handleSelectSearchResult = (item: any) => {
    triggerHaptic(8);
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    setShowDropdown(false);
    setSearchQuery(item.display_name);

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
      previewMarkerRef.current = new maplibregl.Marker({ color: '#e05a47' })
        .setLngLat([lon, lat])
        .addTo(map.current);
    }
  };

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
          el.style.width = '18px';
          el.style.height = '18px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = '#e05a47';
          el.style.border = '3.5px solid #ffffff';
          el.style.boxShadow = '0 0 0 0 rgba(224, 90, 71, 0.75)';
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
    setShareDialogCustomTitle(`Share Spot: ${spot.name}`);
    setShareDialogCustomText(shareText);
    setShareDialogCustomUrl(shareUrl);
    setShareDialogCopied(false);
    pushModalHistoryState('share');
  };

  const handleShareFieldJournal = async () => {
    if (!currentUser) return;
    triggerHaptic(8);
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

  const handleOpenEditModal = (spot: Spot, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const activeUser = currentUserRef.current;
    if (!activeUser || spot.user_id !== activeUser.id) return;
    triggerHaptic(8);
    setIsEditing(true);
    setNewSpot(spot);
    setImagePreview(spot.image_url || null);
    setImageFile(null);
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
    const { error } = await supabase.from('spots').delete().eq('id', spot.id);
    if (!error) {
      setSpots((prev) => prev.filter((s) => s.id !== spot.id));
      setViewingSpot(null);
      setIsDiscussionModalOpen(false);
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

  const flyToSpot = (spot: Spot) => {
    if (!map.current || !spot.latitude || !spot.longitude) return;
    map.current.flyTo({ center: [spot.longitude, spot.latitude], zoom: 16, essential: true });
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
        .eq('spot_id', spotId)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setSpotComments(data);
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
      setSpotComments((prev) => [...prev, data[0] as SpotComment]);
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
      if (user) {
        fetchUserUpvotes(user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      currentUserRef.current = user;
      if (user) {
        setIsAuthModalOpen(false);
        fetchUserUpvotes(user.id);
      } else {
        setUserProfile(null);
        setUpvotedCommentIds([]);
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
      fetchUserUpvotes(currentUser.id);
    } else {
      setMustTrySpotIds([]);
      setVouchedSpotIds([]);
      setUpvotedCommentIds([]);
      setUserProfile(null);
    }
  }, [currentUser]);

  useEffect(() => {
    if (viewingSpot?.id) {
      fetchSpotComments(viewingSpot.id);
    }
  }, [viewingSpot]);

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
        data: {
          username: cleanUsername || undefined,
          country: authCountry || undefined,
        },
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
      country: claimCountry.trim() || userProfile?.country || 'United States',
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setClaimUsernameError(error.message);
    } else {
      triggerHaptic(15);
      const updated = { ...userProfile, id: activeUser.id, username: clean, country: claimCountry.trim() || userProfile?.country || 'United States' };
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
    setUpvotedCommentIds([]);
    setOnlyMySpots(false);
    setSelectedCountryFilter(null);
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
      setUpvotedCommentIds([]);
      localStorage.removeItem('bywayr_user_profile');
      setIsDeleteAccountModalOpen(false);
      setIsProfileModalOpen(false);
      setIsDeletingAccount(false);
    }
  };

  // Basemap Initialization
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

    const initializedMap = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
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

    const containerEl = mapContainer.current;
    if (containerEl) {
      const preventDefaultTouch = (e: TouchEvent) => {
        const target = e.target as HTMLElement;
        if (target?.closest('button, input, textarea, a, select, [role="button"], .passport-stamp-card')) {
          return;
        }
        if (target?.closest('.maplibregl-canvas, .maplibregl-map')) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      };
      containerEl.addEventListener('touchstart', preventDefaultTouch, { passive: false });
      containerEl.addEventListener('touchmove', preventDefaultTouch, { passive: false });
    }

    initializedMap.on('moveend', () => {
      const center = initializedMap.getCenter();
      const zoom = initializedMap.getZoom();
      localStorage.setItem('bywayr_map_center', JSON.stringify([center.lng, center.lat]));
      localStorage.setItem('bywayr_map_zoom', zoom.toString());
    });

    initializedMap.on('load', () => {
      initializedMap.resize();
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
      setIsInteracting(true);
    });
    initializedMap.on('dragend', () => setIsInteracting(false));
    initializedMap.on('zoomstart', () => setIsInteracting(true));
    initializedMap.on('zoomend', () => setIsInteracting(false));
    initializedMap.on('movestart', () => setIsInteracting(true));
    initializedMap.on('moveend', () => setIsInteracting(false));

    map.current = initializedMap;

    const handleResize = () => initializedMap.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      initializedMap.remove();
      map.current = null;
    };
  }, []);

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
      el.style.width = '36px';
      el.style.height = '36px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = isWalkTarget ? '#e05a47' : '#ffffff';
      el.style.border = isMustTry
        ? '3.5px solid #d97706'
        : isWalkTarget
        ? '3.5px solid #ffffff'
        : `3px solid ${color}`;
      el.style.boxShadow = '0 8px 20px rgba(28, 25, 23, 0.28)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.title = spot.name;

      if (isWalkTarget) {
        const iconDiv = document.createElement('div');
        iconDiv.style.display = 'flex';
        iconDiv.style.color = '#ffffff';
        iconDiv.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
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

      const handleMarkerClick = (e: MouseEvent | TouchEvent) => {
        e.stopPropagation();
        triggerHaptic(8);
        setActiveSearchedSpot(null);
        flyToSpot(spot);
        if (spot.id) {
          fetchSpotComments(spot.id);
        }
      };

      el.addEventListener('click', handleMarkerClick);
      el.addEventListener('touchend', handleMarkerClick);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([spot.longitude, spot.latitude])
        .addTo(map.current!);

      spotMarkersRef.current.push(marker);
    });
  }, [filteredSpots, mustTrySpotIds, walkTargetSpot]);

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
            const rawCity = item.address?.city || item.address?.town || item.address?.suburb || 'Nearby';
            const rawCountry = item.address?.country || '';
            const sanitized = sanitizeCountryAndCity(rawCity, rawCountry);

            return {
              name: item.name || item.display_name.split(',')[0],
              city: sanitized.city,
              country: sanitized.country,
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
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", backgroundColor: isDarkMode ? '#262421' : '#f5f5f4' }}>
      <style jsx global>{`
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
          touch-action: pan-x pan-y !important;
          overscroll-behavior: none !important;
        }
        input, textarea {
          user-select: text;
          touch-action: manipulation;
        }
        @keyframes slideUp {
          from { transform: translateY(24px) translateZ(0); opacity: 0; }
          to { transform: translateY(0) translateZ(0); opacity: 1; }
        }
        @keyframes drawerInLeft {
          0% { transform: translateX(-100%) translateZ(0); opacity: 0.5; }
          60% { transform: translateX(12px) translateZ(0); opacity: 1; }
          100% { transform: translateX(0) translateZ(0); opacity: 1; }
        }
        @keyframes drawerOutLeft {
          0% { transform: translateX(0) translateZ(0); opacity: 1; }
          100% { transform: translateX(-100%) translateZ(0); opacity: 0; }
        }
        @keyframes drawerInRight {
          0% { transform: translateX(100%) translateZ(0); opacity: 0.5; }
          60% { transform: translateX(-12px) translateZ(0); opacity: 1; }
          100% { transform: translateX(0) translateZ(0); opacity: 1; }
        }
        @keyframes drawerOutRight {
          0% { transform: translateX(0) translateZ(0); opacity: 1; }
          100% { transform: translateX(100%) translateZ(0); opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateZ(0); }
          to { opacity: 1; transform: translateZ(0); }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes scaleUp {
          0% { transform: scale(0.8) translateZ(0); opacity: 0; }
          70% { transform: scale(1.03) translateZ(0); opacity: 1; }
          100% { transform: scale(1) translateZ(0); opacity: 1; }
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
        .passport-stamp-card {
          flex-shrink: 0;
          cursor: grab;
          user-select: none;
          transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease, filter 0.18s ease;
        }
        .passport-stamp-card:active {
          cursor: grabbing;
        }
        .passport-stamp-card:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 6px 16px rgba(28, 25, 23, 0.1);
        }
        .user-location-pulse {
          animation: gpsRadarPulse 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-slide-up {
          animation: slideUp 0.35s cubic-bezier(0.34, 1.3, 0.64, 1) forwards;
          will-change: transform, opacity;
          backface-visibility: hidden;
        }
        .animate-fade-in {
          animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: opacity;
        }
        .animate-scale-up {
          animation: scaleUp 0.3s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
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
          zIndex: 0,
          backgroundColor: isDarkMode ? '#262421' : '#f5f5f4',
          filter: isDarkMode && !isInteracting ? 'invert(90%) hue-rotate(200deg) saturate(28%) brightness(108%) contrast(98%)' : 'none',
          transition: 'background-color 0.3s ease',
          touchAction: 'pan-x pan-y',
        }} 
      />

      {/* Offline Notification Banner */}
      {isOffline && (
        <div className="animate-fade-in" style={{
          position: 'fixed',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1c1917',
          color: '#fafaf9',
          padding: '8px 16px',
          borderRadius: '22px',
          fontSize: '13px',
          fontWeight: 600,
          zIndex: 100015,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          <WifiOff style={{ width: '15px', height: '15px', color: '#e05a47' }} />
          <span>Offline mode active · Using cached field notes</span>
        </div>
      )}

      {/* 2. Unified Search & Actions Bar with Safe-Area Inset Support */}
      <div style={{ position: 'absolute', top: isOffline ? 'calc(56px + env(safe-area-inset-top, 0px))' : 'calc(16px + env(safe-area-inset-top, 0px))', left: '16px', right: '16px', maxWidth: '460px', margin: '0 auto', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' }}>
        <div style={{ position: 'relative', width: '100%', pointerEvents: 'auto' }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: '6px 8px 6px 10px',
            borderRadius: showDropdown ? '24px 24px 0 0' : '28px',
            boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.12), 0 0 1px 1px rgba(28, 25, 23, 0.04)',
            border: '1px solid #e7e5e4',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
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

            {/* Middle: Integrated Search Input with Requested Placeholder */}
            <div style={{ flex: 1, position: 'relative', minWidth: 0, display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search places, Plus Codes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchQuery.trim().length >= 3) setShowDropdown(true); }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '13.5px',
                  color: '#1c1917',
                  padding: '6px 20px 6px 4px',
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

            {/* Right Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, pointerEvents: 'auto' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic(8);
                  setIsDrawerOpen(true);
                  pushModalHistoryState('drawer');
                }}
                style={{
                  backgroundColor: '#f5f5f4',
                  border: '1px solid #e7e5e4',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  color: '#44403c',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  pointerEvents: 'auto',
                }}
                title="Open Field Notes"
              >
                <List style={{ width: '16px', height: '16px', pointerEvents: 'none' }} />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
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
                  backgroundColor: 'rgba(224, 90, 71, 0.12)',
                  border: '1px solid rgba(224, 90, 71, 0.25)',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  color: '#e05a47',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  pointerEvents: 'auto',
                }}
                title="Add Curated Spot"
              >
                <Plus style={{ width: '18px', height: '18px', strokeWidth: 2.5, pointerEvents: 'none' }} />
              </button>

              {currentUser ? (
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
                    <User style={{ width: '19px', height: '19px', color: '#e05a47', pointerEvents: 'none' }} />
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
                    backgroundColor: '#1c1917',
                    border: 'none',
                    borderRadius: '18px',
                    padding: '6px 11px',
                    color: '#fafaf9',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    pointerEvents: 'auto',
                  }}
                >
                  <LogIn style={{ width: '13px', height: '13px' }} /> Sign In
                </button>
              )}
            </div>
          </div>

          {showDropdown && searchQuery.trim().length >= 3 && (
            <div className="animate-fade-in" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'rgba(255, 255, 255, 0.96)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '0 0 24px 24px', border: '1px solid #e7e5e4', boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.08)', maxHeight: '280px', overflowY: 'auto', zIndex: 10000 }}>
              {searchResults.length === 0 ? (
                <div style={{ padding: '14px 16px', textAlign: 'center', color: '#78716c', fontSize: '13px' }}>
                  No local places found.
                </div>
              ) : (
                searchResults.map((item, idx) => (
                  <div key={idx} onClick={() => handleSelectSearchResult(item)} style={{ padding: '11px 16px', fontSize: '13px', color: '#44403c', cursor: 'pointer', borderBottom: '1px solid #f5f5f4', display: 'flex', alignItems: 'center', gap: '9px' }}>
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

        {/* Active Country Filter Badge if Stamp Clicked */}
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
          style={{ 
            display: 'flex', 
            gap: '6px', 
            overflowX: 'auto', 
            paddingBottom: '2px', 
            scrollbarWidth: 'none', 
            cursor: isCategoryDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            WebkitOverflowScrolling: 'touch',
            transform: 'translateZ(0)'
          }}
        >
          {currentUser && (
            <button
              onClick={() => {
                triggerHaptic(6);
                setOnlyMySpots(!onlyMySpots);
              }}
              style={{
                backgroundColor: onlyMySpots ? '#fff1ee' : 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: onlyMySpots ? '#e05a47' : '#57534e',
                border: onlyMySpots ? '1px solid #fecdd3' : '1px solid #e7e5e4',
                padding: '7px 12px',
                borderRadius: '20px',
                fontSize: '12px',
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
              backgroundColor: maxRadiusKm !== null ? '#e0f2fe' : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: maxRadiusKm !== null ? '#0284c7' : '#57534e',
              border: maxRadiusKm !== null ? '1px solid #bae6fd' : '1px solid #e7e5e4',
              padding: '7px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 10px 25px -5px rgba(28, 25, 23, 0.06), 0 0 1px 1px rgba(28, 25, 23, 0.03)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              flexShrink: 0,
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
                  backgroundColor: isSelected ? '#1c1917' : 'rgba(255, 255, 255, 0.9)', 
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: isSelected ? '#fafaf9' : '#57534e', 
                  border: isSelected ? '1px solid #1c1917' : '1px solid #e7e5e4', 
                  padding: '7px 12px', 
                  borderRadius: '20px', 
                  fontSize: '12px', 
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
          <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 12px', backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '14px', border: '1px solid #e7e5e4', fontSize: '11.5px', color: '#57534e', fontWeight: 500, boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.08), 0 0 1px 1px rgba(28, 25, 23, 0.04)' }}>
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
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: '20px',
              boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.12), 0 0 1px 1px rgba(28, 25, 23, 0.04)',
              border: '1px solid #e7e5e4',
              padding: '16px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginTop: '2px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>
                No unmapped spots here yet
              </h3>
              <button 
                onClick={() => { triggerHaptic(6); setSelectedCategory('All'); setSelectedCountryFilter(null); setMaxRadiusKm(null); }} 
                style={{ border: 'none', background: '#f5f5f4', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                title="Dismiss"
              >
                <X style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
            
            <p style={{ margin: 0, fontSize: '12.5px', color: '#78716c', lineHeight: 1.4 }}>
              No spots in "{selectedCategory}"{selectedCountryFilter ? ` in ${selectedCountryFilter}` : ''} nearby.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
              <button
                onClick={() => { triggerHaptic(6); setSelectedCategory('All'); setSelectedCountryFilter(null); setMaxRadiusKm(null); }}
                style={{ flex: 1, padding: '10px', backgroundColor: '#f5f5f4', color: '#1c1917', border: 'none', borderRadius: '12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Show All Spots
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
                style={{ flex: 1, padding: '10px', backgroundColor: '#e05a47', color: '#ffffff', border: 'none', borderRadius: '12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(224, 90, 71, 0.25)' }}
              >
                + Drop a Pin
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

      {/* 3. Floating Map Controls */}
      <div style={{ 
        position: 'fixed', 
        bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', 
        right: '20px', 
        zIndex: 99999, 
        display: 'flex', 
        flexDirection: 'column', 
        backgroundColor: isDarkMode ? 'rgba(28, 25, 23, 0.92)' : 'rgba(255, 255, 255, 0.92)', 
        backdropFilter: 'blur(12px)', 
        WebkitBackdropFilter: 'blur(12px)', 
        border: isDarkMode ? '1px solid #44403c' : '1px solid #e7e5e4', 
        borderRadius: '22px', 
        padding: '6px', 
        boxShadow: '0 12px 30px -6px rgba(28, 25, 23, 0.18), 0 0 1px 1px rgba(28, 25, 23, 0.04)', 
        gap: '6px', 
        pointerEvents: 'auto',
        opacity: isInteracting ? 0 : 1,
        transform: isInteracting ? 'translateX(90px) scale(0.92)' : 'translateX(0) scale(1)',
        visibility: isInteracting ? 'hidden' : 'visible',
        transition: isInteracting 
          ? 'opacity 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), visibility 0s linear 0.25s' 
          : 'opacity 0.3s ease 0.05s, transform 0.35s cubic-bezier(0.34, 1.25, 0.64, 1) 0.05s, visibility 0s linear 0s',
      }}>
        <button onClick={handleLocateMe} disabled={isLocating} style={{ width: '42px', height: '42px', backgroundColor: 'transparent', border: 'none', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#e05a47' }} title="Locate Me">
          {isLocating ? <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} /> : <Crosshair style={{ width: '18px', height: '18px' }} />}
        </button>

        <button
          onClick={() => {
            triggerHaptic(8);
            setIsWalkModalOpen(true);
            pushModalHistoryState('walkModal');
          }}
          style={{
            width: '42px',
            height: '42px',
            backgroundColor: walkTargetSpot ? '#e05a47' : 'transparent',
            color: walkTargetSpot ? '#ffffff' : (isDarkMode ? '#fafaf9' : '#44403c'),
            border: 'none',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Choose a destination to walk to"
        >
          <Footprints style={{ width: '18px', height: '18px' }} />
        </button>

        <div style={{ height: '1px', backgroundColor: isDarkMode ? '#44403c' : '#e7e5e4', margin: '2px 4px' }} />

        <button
          onClick={() => {
            triggerHaptic(6);
            setIsDarkMode(!isDarkMode);
          }}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '16px',
            border: 'none',
            backgroundColor: 'transparent',
            color: isDarkMode ? '#e05a47' : '#78716c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title={isDarkMode ? 'Switch to Day Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <MoonStar style={{ width: '18px', height: '18px' }} /> : <Sun style={{ width: '18px', height: '18px' }} />}
        </button>

        <div style={{ height: '1px', backgroundColor: isDarkMode ? '#44403c' : '#e7e5e4', margin: '2px 4px' }} />

        <button onClick={() => map.current?.zoomIn()} style={{ width: '42px', height: '42px', backgroundColor: 'transparent', border: 'none', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isDarkMode ? '#fafaf9' : '#1c1917' }} title="Zoom In">
          <Plus style={{ width: '18px', height: '18px' }} />
        </button>
        <button onClick={() => map.current?.zoomOut()} style={{ width: '42px', height: '42px', backgroundColor: 'transparent', border: 'none', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isDarkMode ? '#fafaf9' : '#1c1917' }} title="Zoom Out">
          <Minus style={{ width: '18px', height: '18px' }} />
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
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', boxSizing: 'border-box', padding: '10px', backgroundColor: '#f5f5f4', color: '#1c1917', border: '1px solid #e7e5e4', borderRadius: '14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus style={{ width: '14px', height: '14px' }} /> Save as Curated Pin
            </button>
          </div>
        </div>
      )}

      {/* Proximity Walk Modal */}
      {isWalkModalOpen && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100005, padding: '16px' }}>
          <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.3)', width: '100%', maxWidth: '390px', maxHeight: '82vh', display: 'flex', flexDirection: 'column', padding: '20px', position: 'relative', boxSizing: 'border-box' }}>
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

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '48vh', paddingRight: '2px' }}>
              {(() => {
                const curatedMatches = proximitySortedSpots.filter((s: Spot) => {
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
                      curatedMatches.map((spot: Spot) => (
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

      {/* 4. Spot Details Bottom Sheet with Background Blur */}
      {viewingSpot && (
        <div className="animate-fade-in" onClick={() => dismissModalWithHistory(() => { setViewingSpot(null); if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname); })} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '16px calc(16px + env(safe-area-inset-right, 0px)) calc(20px + env(safe-area-inset-bottom, 0px)) calc(16px + env(safe-area-inset-left, 0px))' }}>
          <div className="animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '410px', maxHeight: '78vh', overflowY: 'auto', backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.3)', border: '1px solid #e7e5e4', padding: '16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span style={{ display: 'inline-block', backgroundColor: `${getCategoryColor(viewingSpot.category)}18`, color: getCategoryColor(viewingSpot.category), fontSize: '10.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '8px' }}>
                {viewingSpot.category}
              </span>
              
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                <button
                  onClick={() => toggleVouch(viewingSpot.id)}
                  disabled={savingVouch}
                  style={{
                    border: 'none',
                    background: viewingSpot.id && vouchedSpotIds.includes(viewingSpot.id) ? '#ecfdf5' : '#f5f5f4',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    color: viewingSpot.id && vouchedSpotIds.includes(viewingSpot.id) ? '#059669' : '#57534e',
                    padding: '6px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                  title="Vouch for this spot"
                >
                  <ThumbsUp style={{ width: '14px', height: '14px' }} />
                  <span>{viewingSpot.id ? vouchCounts[viewingSpot.id] || 0 : 0}</span>
                </button>

                <button onClick={() => toggleMustTry(viewingSpot.id)} disabled={savingBookmark} style={{ border: 'none', background: viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#fef3c7' : '#f5f5f4', borderRadius: '10px', cursor: 'pointer', color: viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#d97706' : '#57534e', padding: '6px', display: 'flex', flexShrink: 0 }} title="Save to Must-Try">
                  {viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? <BookmarkCheck style={{ width: '15px', height: '15px' }} /> : <Bookmark style={{ width: '15px', height: '15px' }} />}
                </button>

                <button onClick={() => handleShareSpot(viewingSpot)} style={{ border: 'none', background: '#f5f5f4', borderRadius: '10px', cursor: 'pointer', color: '#57534e', padding: '6px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} title="Share spot">
                  <Share2 style={{ width: '15px', height: '15px' }} />
                </button>

                {currentUser && viewingSpot.user_id === currentUser.id && (
                  <>
                    <button onClick={(e) => handleOpenEditModal(viewingSpot, e)} style={{ border: 'none', background: '#f5f5f4', borderRadius: '10px', cursor: 'pointer', color: '#57534e', padding: '6px', display: 'flex', flexShrink: 0 }} title="Edit Spot">
                      <Pencil style={{ width: '14px', height: '14px' }} />
                    </button>
                    <button onClick={(e) => handleDeleteSpot(viewingSpot, e)} disabled={deleting} style={{ border: 'none', background: '#fff1ee', borderRadius: '10px', cursor: 'pointer', color: '#e05a47', padding: '6px', display: 'flex', flexShrink: 0 }} title="Delete Spot">
                      {deleting ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <Trash2 style={{ width: '14px', height: '14px' }} />}
                    </button>
                  </>
                )}
                <button onClick={() => dismissModalWithHistory(() => { setViewingSpot(null); if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname); })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '4px', flexShrink: 0 }}>
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em', lineHeight: 1.25, wordBreak: 'break-word', width: '100%' }}>
                {viewingSpot.name}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#78716c', fontWeight: 500, width: '100%', wordBreak: 'break-word' }}>
                {viewingSpot.city}{viewingSpot.country ? ` · ${viewingSpot.country}` : ''}
                {viewingSpot.user_id && profilesMap[viewingSpot.user_id]?.username ? (
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
                ) : ''}
              </p>
            </div>

            {viewingSpot.image_url && (
              <div style={{ width: '100%', height: '130px', borderRadius: '14px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#f5f5f4' }}>
                <img src={viewingSpot.image_url} alt={viewingSpot.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            {viewingSpot.description && (
              <p style={{ margin: 0, fontSize: '12.5px', color: '#44403c', lineHeight: 1.4, wordBreak: 'break-word' }}>{viewingSpot.description}</p>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                onClick={() => openNativeWalkNavigation(viewingSpot.latitude, viewingSpot.longitude, viewingSpot.name)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', boxSizing: 'border-box', padding: '10px', backgroundColor: '#1c1917', color: '#fafaf9', border: 'none', borderRadius: '12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(28, 25, 23, 0.15)' }}
              >
                <Navigation2 style={{ width: '14px', height: '14px' }} /> Get Directions
              </button>

              <button
                onClick={() => handleCopyCoordinates(viewingSpot.latitude, viewingSpot.longitude)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', boxSizing: 'border-box', padding: '9px', backgroundColor: coordsCopied ? '#ecfdf5' : '#f5f5f4', color: coordsCopied ? '#059669' : '#1c1917', border: coordsCopied ? '1px solid #a7f3d0' : '1px solid #e7e5e4', borderRadius: '12px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                {coordsCopied ? <Check style={{ width: '13px', height: '13px' }} /> : <Copy style={{ width: '13px', height: '13px' }} />}
                {coordsCopied ? 'Coordinates Copied!' : `Copy Coordinates (${viewingSpot.latitude.toFixed(4)}, ${viewingSpot.longitude.toFixed(4)})`}
              </button>
            </div>

            <div style={{ borderTop: '1px solid #e7e5e4', paddingTop: '10px' }}>
              <button
                onClick={() => {
                  triggerHaptic(8);
                  setIsDiscussionModalOpen(true);
                  pushModalHistoryState('discussionModal');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: '#fafaf9',
                  border: '1px solid #e7e5e4',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  color: '#1c1917',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare style={{ width: '14px', height: '14px', color: '#e05a47' }} />
                  <span>Field Notes Discussion ({spotComments.length})</span>
                </div>
                <ArrowRight style={{ width: '13px', height: '13px', color: '#a8a29e' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Separate Field Notes Discussion Window */}
      {isDiscussionModalOpen && viewingSpot && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100005, padding: '16px' }}>
          <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '28px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.35)', width: '100%', maxWidth: '420px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px', position: 'relative', boxSizing: 'border-box' }}>
            <button onClick={() => dismissModalWithHistory(() => setIsDiscussionModalOpen(false))} style={{ position: 'absolute', top: '18px', right: '18px', border: 'none', background: '#f5f5f4', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: '18px', height: '18px' }} />
            </button>

            <div style={{ marginBottom: '14px', paddingRight: '30px' }}>
              <span style={{ display: 'inline-block', backgroundColor: `${getCategoryColor(viewingSpot.category)}18`, color: getCategoryColor(viewingSpot.category), fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', marginBottom: '6px' }}>
                {viewingSpot.category}
              </span>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>
                Discussion: {viewingSpot.name}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#78716c' }}>{viewingSpot.city}</p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', maxHeight: '42vh', paddingRight: '2px' }}>
              {spotComments.length === 0 ? (
                <p style={{ margin: '20px 0', fontSize: '13px', color: '#a8a29e', textAlign: 'center', fontStyle: 'italic' }}>No tips or comments left yet. Be the first!</p>
              ) : (
                spotComments.map((c) => {
                  const authorProfile = profilesMap[c.user_id];
                  const isUpvoted = upvotedCommentIds.includes(c.id);
                  const tagColor = c.tag === '[Status: Closed]' ? '#e05a47' : c.tag === '[Menu / Price]' ? '#d97706' : c.tag === '[Work / Wi-Fi]' ? '#2563eb' : '#059669';

                  return (
                    <div key={c.id} style={{ backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '12px', padding: '10px 12px', fontSize: '12.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: '#1c1917' }}>@{authorProfile?.username || 'wanderer'}</span>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: tagColor, backgroundColor: `${tagColor}15`, padding: '1px 6px', borderRadius: '4px' }}>
                            {c.tag || '[Tip]'}
                          </span>
                        </div>
                        <span style={{ fontSize: '10.5px', color: '#a8a29e' }}>{formatRelativeTime(c.created_at)}</span>
                      </div>
                      <p style={{ margin: '0 0 8px 0', color: '#44403c', lineHeight: 1.4, wordBreak: 'break-word' }}>{c.content}</p>
                      
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleUpvoteComment(c.id)}
                          style={{
                            background: isUpvoted ? '#ecfdf5' : '#f5f5f4',
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
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', scrollbarWidth: 'none', marginBottom: '10px', flexShrink: 0 }}>
              {COMMENT_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { triggerHaptic(4); setCommentTag(t); }}
                  style={{
                    backgroundColor: commentTag === t ? '#1c1917' : '#f5f5f4',
                    color: commentTag === t ? '#fafaf9' : '#78716c',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '4px 9px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <input
                type="text"
                placeholder="Leave a quick tip or update..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                style={{ flex: 1, boxSizing: 'border-box', backgroundColor: '#f5f5f4', border: '1px solid #e7e5e4', borderRadius: '12px', padding: '10px 14px', fontSize: '12.5px', outline: 'none', color: '#1c1917' }}
              />
              <button
                type="submit"
                disabled={submittingComment || !newCommentText.trim()}
                style={{ backgroundColor: '#1c1917', color: '#fafaf9', border: 'none', borderRadius: '12px', padding: '0 14px', cursor: submittingComment || !newCommentText.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Send Comment"
              >
                {submittingComment ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: '14px', height: '14px' }} />}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Spot Modal */}
      {isModalOpen && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100005, padding: '16px' }}>
          <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.35)', width: '100%', maxWidth: '380px', maxHeight: '82vh', display: 'flex', flexDirection: 'column', padding: '20px', position: 'relative', boxSizing: 'border-box', overflowY: 'auto', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>
                {isEditing ? 'Edit Curated Spot' : 'Add Curated Spot'}
              </h3>
              <button onClick={() => dismissModalWithHistory(handleCloseModal)} style={{ border: 'none', background: '#f5f5f4', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            <form onSubmit={handleSaveSpot} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '3px' }}>Spot Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ÔDELICE"
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
                  {CATEGORIES.filter((c) => c.label !== 'All').map((cat) => (
                    <option key={cat.label} value={cat.label}>{cat.label}</option>
                  ))}
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
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '3px' }}>Description / Field Notes</label>
                <textarea
                  rows={2}
                  placeholder="Share a tip or description..."
                  value={newSpot.description}
                  onChange={(e) => setNewSpot({ ...newSpot, description: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: '12.5px', padding: '9px 11px', borderRadius: '12px', border: '1px solid #d6d3d1', outline: 'none', color: '#1c1917', resize: 'vertical' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#57534e' }}>Photo</label>
                  <button type="button" onClick={handleModalLocate} disabled={isModalLocating} style={{ background: 'none', border: 'none', color: '#e05a47', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {isModalLocating ? <Loader2 style={{ width: '11px', height: '11px', animation: 'spin 1s linear infinite' }} /> : <Crosshair style={{ width: '11px', height: '11px' }} />}
                    Use Current GPS
                  </button>
                </div>
                
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', backgroundColor: '#f5f5f4', border: '1px dashed #d6d3d1', borderRadius: '12px', cursor: 'pointer', fontSize: '11.5px', color: '#57534e', fontWeight: 600 }}>
                  <Camera style={{ width: '15px', height: '15px', color: '#e05a47' }} />
                  <span>{imageFile ? imageFile.name : imagePreview ? 'Change Photo' : 'Upload Photo'}</span>
                  <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
                </label>
                {imagePreview && (
                  <div style={{ marginTop: '6px', width: '100%', height: '90px', borderRadius: '10px', overflow: 'hidden' }}>
                    <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                {saving || uploadingImage ? <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} /> : (isEditing ? 'Save Changes' : 'Publish Curated Spot')}
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
              <button onClick={() => dismissModalWithHistory(() => setViewingProfile(null))} style={{ position: 'absolute', top: '18px', right: '18px', border: 'none', background: '#f5f5f4', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#78716c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                      <Globe style={{ width: '11px', height: '11px', color: '#e05a47' }} />
                      {resolvedCountry}
                    </span>
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#78716c', fontWeight: 500 }}>
                    {viewingProfile.bio || 'Wanderer & local spot hunter'}
                  </p>
                </div>
              </div>

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
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#d97706' }}>{publicPassportStamps.length}</div>
                  <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Countries</div>
                </div>
              </div>

              {/* Scrollable Tokyo-Style Circular Passport Stamps Section (Public Profile) */}
              <div style={{ backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '18px', padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1c1917', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Compass style={{ width: '15px', height: '15px', color: '#0284c7' }} /> Passport Stamps
                  </span>
                  <span style={{ backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>{publicPassportStamps.length} Countries</span>
                </div>

                {publicPassportStamps.length === 0 ? (
                  <p style={{ margin: '4px 0', fontSize: '11.5px', color: '#a8a29e', fontStyle: 'italic' }}>No country passport stamps collected yet.</p>
                ) : (
                  <div 
                    ref={publicStampScrollRef}
                    onMouseDown={(e) => handleStampMouseDown(e, publicStampScrollRef)}
                    onMouseLeave={handleStampMouseUpOrLeave}
                    onMouseUp={handleStampMouseUpOrLeave}
                    onMouseMove={(e) => handleStampMouseMove(e, publicStampScrollRef)}
                    onWheel={(e) => handleStampWheel(e, publicStampScrollRef)}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      overflowX: 'auto',
                      paddingBottom: '12px',
                      paddingTop: '6px',
                      scrollbarWidth: 'none',
                      cursor: isStampDragging ? 'grabbing' : 'grab',
                      WebkitOverflowScrolling: 'touch',
                      transform: 'translateZ(0)',
                    }}
                  >
                    {publicPassportStamps.map((st, idx) => (
                      <div
                        key={idx}
                        className="passport-stamp-card"
                        onClick={() => {
                          if (isStampDragging) return;
                          triggerHaptic(8);
                          setSelectedCountryFilter(st.country);
                          dismissModalWithHistory(() => setViewingProfile(null));
                        }}
                        style={{
                          backgroundColor: '#fbfbfa',
                          border: `2px dashed ${st.color}`,
                          borderRadius: '50%',
                          width: '98px',
                          height: '98px',
                          minWidth: '98px',
                          boxShadow: '0 4px 14px rgba(28, 25, 23, 0.05)',
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '8px',
                          boxSizing: 'border-box',
                          textAlign: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: st.color, marginBottom: '1px' }}>
                          <Plane style={{ width: '8px', height: '8px', transform: 'rotate(-45deg)' }} />
                          <span style={{ fontSize: '6.5px', fontWeight: 900, textTransform: 'uppercase', color: st.color, letterSpacing: '0.06em' }}>
                            VISA
                          </span>
                        </div>
                        <div style={{ fontSize: '9.5px', fontWeight: 900, color: st.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em', textTransform: 'uppercase', width: '100%', borderBottom: `1px solid ${st.color}40`, borderTop: `1px solid ${st.color}40`, padding: '1.5px 0', margin: '1px 0' }}>
                          {st.country}
                        </div>
                        <div style={{ fontSize: '7.5px', color: st.color, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', opacity: 0.85 }}>
                          {st.cities[0] ? st.cities[0].toUpperCase() : 'ENTRY'}
                        </div>
                        <div style={{ fontSize: '7px', color: st.color, fontWeight: 800, marginTop: '1px', opacity: 0.7 }}>
                          {new Date(st.firstVisit || Date.now()).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
                  <span style={{ fontSize: '18px', fontWeight: 800 }}>𝕏</span>
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

      {/* Slide-Out Drawer (Field Notes - Left) */}
      {(isDrawerOpen || isDrawerClosing) && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(28, 25, 23, 0.45)', 
            backdropFilter: 'blur(3px)', 
            WebkitBackdropFilter: 'blur(3px)',
            zIndex: 100000, 
            display: 'flex', 
            justifyContent: 'flex-start',
            animation: isDrawerClosing ? 'fadeOut 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          <div 
            style={{ 
              width: '100%', 
              maxWidth: '370px', 
              backgroundColor: '#ffffff', 
              height: '100%', 
              boxShadow: '10px 0 35px rgba(28, 25, 23, 0.18)', 
              display: 'flex', 
              flexDirection: 'column', 
              padding: '20px', 
              boxSizing: 'border-box',
              animation: isDrawerClosing ? 'drawerOutLeft 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'drawerInLeft 0.35s cubic-bezier(0.34, 1.25, 0.64, 1) forwards'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>{drawerTab === 'fieldNotes' ? 'Field Notes' : 'Must-Try'}</h2>
              <button onClick={handleCloseDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexShrink: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: '#f5f5f4', borderRadius: '14px', padding: '3px', flex: 1 }}>
                <button onClick={() => { triggerHaptic(6); setDrawerTab('fieldNotes'); }} style={{ border: 'none', padding: '7px 0', borderRadius: '11px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', backgroundColor: drawerTab === 'fieldNotes' ? '#ffffff' : 'transparent', color: drawerTab === 'fieldNotes' ? '#1c1917' : '#78716c', boxShadow: drawerTab === 'fieldNotes' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>Field Notes</button>
                <button onClick={() => { triggerHaptic(6); if (!currentUserRef.current) { setIsAuthModalOpen(true); pushModalHistoryState('auth'); return; } setDrawerTab('mustTry'); }} style={{ border: 'none', padding: '7px 0', borderRadius: '11px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', backgroundColor: drawerTab === 'mustTry' ? '#ffffff' : 'transparent', color: drawerTab === 'mustTry' ? '#1c1917' : '#78716c', boxShadow: drawerTab === 'mustTry' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>Must-Try ({mustTrySpotIds.length})</button>
              </div>
            </div>

            {/* Recents Section (Last 3 Pins) */}
            {currentUser && drawerTab === 'fieldNotes' && recentUserSpots.length > 0 && (
              <div style={{ marginBottom: '14px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '14px', padding: '10px 12px', flexShrink: 0 }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock style={{ width: '12px', height: '12px', color: '#e05a47' }} /> Recent Pins
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {recentUserSpots.map((spot) => {
                    const color = getCategoryColor(spot.category);
                    return (
                      <div
                        key={`recent-${spot.id || spot.name}`}
                        onClick={() => {
                          triggerHaptic(8);
                          setIsDrawerClosing(true);
                          setTimeout(() => {
                            setIsDrawerOpen(false);
                            setIsDrawerClosing(false);
                          }, 280);
                          flyToSpot(spot);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          backgroundColor: '#ffffff',
                          borderRadius: '10px',
                          border: '1px solid #e7e5e4',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spot.name}</span>
                        </div>
                        <span style={{ fontSize: '10px', color: '#a8a29e', flexShrink: 0 }}>{formatRelativeTime(spot.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', scrollbarWidth: 'thin', minHeight: 0 }}>
              {displayedDrawerSpots.map((spot: Spot) => {
                const color = getCategoryColor(spot.category);
                const distanceVal = userCoords ? getDistanceFromLatLonInKm(userCoords.lat, userCoords.lng, spot.latitude, spot.longitude) : null;
                const distanceText = distanceVal !== null ? (distanceVal < 1 ? `${Math.round(distanceVal * 1000)}m away` : `${distanceVal.toFixed(1)}km away`) : null;

                return (
                  <div
                    key={spot.id || spot.name}
                    onClick={() => {
                      triggerHaptic(8);
                      setIsDrawerClosing(true);
                      setTimeout(() => {
                        setIsDrawerOpen(false);
                        setIsDrawerClosing(false);
                      }, 280);
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
              })}
            </div>

            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e7e5e4', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', paddingLeft: '4px' }}>
                Travel Essentials
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <a href="https://aviasales.tpk.lv/Y7mdLlKw" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '12px', color: '#1c1917', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e7e5e4', flexShrink: 0 }}>
                      <img src="/aviasales.svg" alt="Aviasales" style={{ width: '15px', height: '15px', objectFit: 'contain' }} onError={(e)=>{(e.target as HTMLElement).style.display='none'}} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1c1917', lineHeight: 1.2 }}>Aviasales</span>
                      <span style={{ fontSize: '11px', color: '#78716c', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Flight Search</span>
                    </div>
                  </div>
                  <ArrowRight style={{ width: '13px', height: '13px', color: '#a8a29e', flexShrink: 0 }} />
                </a>

                <a href="https://saily.tpk.lv/W8d7Lkw" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '12px', color: '#1c1917', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e7e5e4', flexShrink: 0 }}>
                      <img src="/saily.svg" alt="Saily" style={{ width: '15px', height: '15px', objectFit: 'contain' }} onError={(e)=>{(e.target as HTMLElement).style.display='none'}} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1c1917', lineHeight: 1.2 }}>Saily</span>
                      <span style={{ fontSize: '11px', color: '#78716c', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Affordable eSIM Data</span>
                    </div>
                  </div>
                  <ArrowRight style={{ width: '13px', height: '13px', color: '#a8a29e', flexShrink: 0 }} />
                </a>

                <a href="https://yesim.tpk.lv/o2T5nWaw" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '12px', color: '#1c1917', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e7e5e4', flexShrink: 0 }}>
                      <img src="/yesim.svg" alt="Yesim" style={{ width: '15px', height: '15px', objectFit: 'contain' }} onError={(e)=>{(e.target as HTMLElement).style.display='none'}} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1c1917', lineHeight: 1.2 }}>Yesim</span>
                      <span style={{ fontSize: '11px', color: '#78716c', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>eSIM Data</span>
                    </div>
                  </div>
                  <ArrowRight style={{ width: '13px', height: '13px', color: '#a8a29e', flexShrink: 0 }} />
                </a>

                <a href="https://kiwi.tpk.lv/Y7mdLlKw" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '12px', color: '#1c1917', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e7e5e4', flexShrink: 0 }}>
                      <img src="/kiwi.svg" alt="Kiwi.com" style={{ width: '15px', height: '15px', objectFit: 'contain' }} onError={(e)=>{(e.target as HTMLElement).style.display='none'}} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1c1917', lineHeight: 1.2 }}>Kiwi.com</span>
                      <span style={{ fontSize: '11px', color: '#78716c', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Low Cost Travel</span>
                    </div>
                  </div>
                  <ArrowRight style={{ width: '13px', height: '13px', color: '#a8a29e', flexShrink: 0 }} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-Out Profile Drawer (Right) */}
      {(isProfileModalOpen || isProfileClosing) && currentUser && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(28, 25, 23, 0.45)', 
            backdropFilter: 'blur(3px)', 
            WebkitBackdropFilter: 'blur(3px)',
            zIndex: 100000, 
            display: 'flex', 
            justifyContent: 'flex-end',
            animation: isProfileClosing ? 'fadeOut 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          <div 
            style={{ 
              width: '100%', 
              maxWidth: '380px', 
              backgroundColor: '#ffffff', 
              height: '100%', 
              boxShadow: '-10px 0 35px rgba(28, 25, 23, 0.18)', 
              display: 'flex', 
              flexDirection: 'column', 
              padding: '24px', 
              boxSizing: 'border-box',
              overflowY: 'auto',
              animation: isProfileClosing ? 'drawerOutRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'drawerInRight 0.35s cubic-bezier(0.34, 1.25, 0.64, 1) forwards'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em' }}>Field Journal</h2>
              <button onClick={handleCloseProfileDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '18px' }}>
              <label style={{ width: '88px', height: '88px', borderRadius: '50%', backgroundColor: '#f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1917', position: 'relative', overflow: 'hidden', cursor: 'pointer', border: '2.5px solid #e7e5e4', marginBottom: '10px', boxShadow: '0 8px 24px rgba(28, 25, 23, 0.1)' }} title="Click to upload profile photo">
                {uploadingAvatar ? (
                  <Loader2 style={{ width: '26px', height: '26px', animation: 'spin 1s linear infinite', color: '#e05a47' }} />
                ) : userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User style={{ width: '38px', height: '38px', color: '#78716c' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', color: '#ffffff' }} onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')} onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}>
                  <Camera style={{ width: '22px', height: '22px' }} />
                </div>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
              </label>

              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1c1917', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '-0.02em' }}>
                {userProfile?.username ? `@${userProfile.username}` : 'Account'}
                <button onClick={() => { setIsProfileModalOpen(false); setClaimUsername(userProfile?.username || ''); setClaimCountry(userProfile?.country || 'United States'); setIsClaimUsernameModalOpen(true); pushModalHistoryState('claimUsername'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', padding: '2px' }} title="Change Username">
                  <Pencil style={{ width: '13px', height: '13px' }} />
                </button>
              </h3>
              
              <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {!isEditingCountry ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '12px', color: '#78716c', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f5f5f4', padding: '2px 8px', borderRadius: '8px', border: '1px solid #e7e5e4', fontWeight: 600 }}>
                      <Globe style={{ width: '11px', height: '11px', color: '#e05a47' }} />
                      {userProfile?.country || 'United States'}
                    </span>
                    <button
                      onClick={() => {
                        setIsEditingCountry(true);
                        setEditCountryValue(userProfile?.country || 'United States');
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', padding: '2px' }}
                      title="Edit Country of Origin"
                    >
                      <Pencil style={{ width: '11px', height: '11px' }} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="text"
                      value={editCountryValue}
                      onChange={(e) => setEditCountryValue(e.target.value)}
                      placeholder="Country of Origin"
                      style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '8px', border: '1px solid #d6d3d1', outline: 'none', width: '110px' }}
                    />
                    <button
                      onClick={() => handleUpdateCountry(editCountryValue)}
                      disabled={savingCountry}
                      style={{ backgroundColor: '#1c1917', color: '#fafaf9', border: 'none', borderRadius: '8px', padding: '4px 7px', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {savingCountry ? '...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setIsEditingCountry(false)}
                      style={{ background: 'none', border: 'none', color: '#78716c', fontSize: '11px', cursor: 'pointer', padding: '2px' }}
                    >
                      <X style={{ width: '13px', height: '13px' }} />
                    </button>
                  </div>
                )}
              </div>

              <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#a8a29e' }}>{currentUser.email}</p>
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

            {/* Scrollable Tokyo-Style Circular Passport Stamps Section (Field Journal) */}
            <div style={{ backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '18px', padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1c1917', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Compass style={{ width: '15px', height: '15px', color: '#0284c7' }} /> Passport Stamps
                </span>
                <span style={{ backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>{myCountriesCount} Countries</span>
              </div>

              {myPassportStamps.length === 0 ? (
                <p style={{ margin: '4px 0', fontSize: '11.5px', color: '#a8a29e', fontStyle: 'italic' }}>
                  Pin your first spot to earn your first country passport stamp!
                </p>
              ) : (
                <div 
                  ref={profileStampScrollRef}
                  onMouseDown={(e) => handleStampMouseDown(e, profileStampScrollRef)}
                  onMouseLeave={handleStampMouseUpOrLeave}
                  onMouseUp={handleStampMouseUpOrLeave}
                  onMouseMove={(e) => handleStampMouseMove(e, profileStampScrollRef)}
                  onWheel={(e) => handleStampWheel(e, profileStampScrollRef)}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    overflowX: 'auto',
                    paddingBottom: '12px',
                    paddingTop: '6px',
                    scrollbarWidth: 'none',
                    cursor: isStampDragging ? 'grabbing' : 'grab',
                    WebkitOverflowScrolling: 'touch',
                    transform: 'translateZ(0)',
                  }}
                >
                  {myPassportStamps.map((st, idx) => (
                    <div
                      key={idx}
                      className="passport-stamp-card"
                      onClick={() => {
                        if (isStampDragging) return;
                        triggerHaptic(8);
                        setSelectedCountryFilter(st.country);
                        handleCloseProfileDrawer();
                      }}
                      style={{
                        backgroundColor: '#fbfbfa',
                        border: `2px dashed ${st.color}`,
                        borderRadius: '50%',
                        width: '98px',
                        height: '98px',
                        minWidth: '98px',
                        boxShadow: '0 4px 14px rgba(28, 25, 23, 0.05)',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px',
                        boxSizing: 'border-box',
                        textAlign: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: st.color, marginBottom: '1px' }}>
                        <Plane style={{ width: '8px', height: '8px', transform: 'rotate(-45deg)' }} />
                        <span style={{ fontSize: '6.5px', fontWeight: 900, textTransform: 'uppercase', color: st.color, letterSpacing: '0.06em' }}>
                          VISA
                        </span>
                      </div>
                      <div style={{ fontSize: '9.5px', fontWeight: 900, color: st.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em', textTransform: 'uppercase', width: '100%', borderBottom: `1px solid ${st.color}40`, borderTop: `1px solid ${st.color}40`, padding: '1.5px 0', margin: '1px 0' }}>
                        {st.country}
                      </div>
                      <div style={{ fontSize: '7.5px', color: st.color, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', opacity: 0.85 }}>
                        {st.cities[0] ? st.cities[0].toUpperCase() : 'ENTRY'}
                      </div>
                      <div style={{ fontSize: '7px', color: st.color, fontWeight: 800, marginTop: '1px', opacity: 0.7 }}>
                        {new Date(st.firstVisit || Date.now()).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div onClick={() => { triggerHaptic(6); setOnlyMySpots(!onlyMySpots); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', backgroundColor: onlyMySpots ? '#fff1ee' : '#ffffff', border: onlyMySpots ? '1px solid #fecdd3' : '1px solid #e7e5e4', borderRadius: '14px', cursor: 'pointer', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin style={{ width: '16px', height: '16px' }} color={onlyMySpots ? '#e05a47' : '#78716c'} />
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: onlyMySpots ? '#e05a47' : '#44403c' }}>Filter map to my pins only</span>
              </div>
              {onlyMySpots ? <CheckSquare style={{ width: '16px', height: '16px', color: '#e05a47' }} /> : <Square style={{ width: '16px', height: '16px', color: '#a8a29e' }} />}
            </div>

            {/* Share Field Journal Action */}
            <button
              onClick={handleShareFieldJournal}
              style={{
                width: '100%',
                backgroundColor: '#f5f5f4',
                color: '#1c1917',
                border: '1px solid #e7e5e4',
                padding: '11px',
                borderRadius: '14px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginBottom: '10px',
              }}
            >
              <Share2 style={{ width: '14px', height: '14px' }} /> Share Field Journal
            </button>

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
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.6)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100003, padding: '16px' }}>
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

      {/* 9. Claim Handle & Country Modal */}
      {isClaimUsernameModalOpen && currentUser && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.5)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100002, padding: '16px' }}>
          <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.3)', width: '100%', maxWidth: '360px', padding: '24px', position: 'relative', boxSizing: 'border-box' }}>
            <div style={{ width: '46px', height: '46px', backgroundColor: '#fff1ee', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: '#e05a47' }}>
              <AtSign style={{ width: '24px', height: '24px' }} />
            </div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#1c1917', letterSpacing: '-0.02em', textAlign: 'center' }}>Set Up Profile</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: '#78716c', textAlign: 'center' }}>Pick a handle and confirm your country of origin for your field journal.</p>

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

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>Country of Origin</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. United States"
                  value={claimCountry}
                  onChange={(e) => setClaimCountry(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: '13.5px', padding: '10px 12px', borderRadius: '14px', border: '1px solid #d6d3d1', outline: 'none' }}
                />
              </div>

              <button type="submit" disabled={isSavingUsername || claimUsername.length < 3} style={{ width: '100%', backgroundColor: '#1c1917', color: '#fafaf9', fontWeight: 600, fontSize: '12.5px', padding: '12px', borderRadius: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                {isSavingUsername ? <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} /> : 'Complete Profile'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 10. Auth Modal */}
      {isAuthModalOpen && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100001, padding: '16px' }}>
          <div className="animate-scale-up" style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.3)', width: '100%', maxWidth: '360px', padding: '24px', position: 'relative', textAlign: 'center', boxSizing: 'border-box' }}>
            <button onClick={() => dismissModalWithHistory(() => setIsAuthModalOpen(false))} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '4px' }}>
              <X style={{ width: '20px', height: '20px' }} />
            </button>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden', display: 'flex', margin: '0 auto 14px auto', boxShadow: '0 6px 16px rgba(28, 25, 23, 0.1)', border: '1px solid rgba(0, 0, 0, 0.06)' }}>
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
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '3px' }}>Country of Origin</label>
                <input
                  type="text"
                  placeholder="e.g. United States"
                  value={authCountry}
                  onChange={(e) => authCountrySetter(e.target.value)} // Wait, keep authCountry setter
                  value={authCountry}
                  onChange={(e) => setAuthCountry(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '10px 12px', borderRadius: '14px', border: '1px solid #d6d3d1', outline: 'none' }}
                />
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
          </div>
        </div>
      )}

      {/* PWA Web Install Banner */}
      <PwaInstallBanner />
    </div>
  );
}