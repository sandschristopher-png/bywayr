'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '../lib/supabase';
import { decode, isValid, isFull, isShort, recoverNearest } from '@erikmichelson/open-location-code-ts';
import {
  MapPin,
  Loader2,
  X,
  Plus,
  Minus,
  Search,
  Compass,
  List,
  Camera,
  Coffee,
  Utensils,
  Mountain,
  Moon,
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
}

interface UserProfile {
  id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
}

const CATEGORIES = [
  { label: 'All', color: '#64748b', icon: Sparkles },
  { label: 'Hidden Gems', color: '#ef4444', icon: Gem },
  { label: 'Alley Eats', color: '#f97316', icon: Utensils },
  { label: 'Cafe & Chill', color: '#d97706', icon: Coffee },
  { label: 'Listening & Bars', color: '#ec4899', icon: Beer },
  { label: 'Markets & Bazaars', color: '#a855f7', icon: Store },
  { label: 'Nature & Trails', color: '#14b8a6', icon: Trees },
  { label: 'Stays & Hideaways', color: '#6366f1', icon: HomeIcon },
  { label: 'Viewpoints', color: '#10b981', icon: Mountain },
];

const getCategoryColor = (cat: string) => {
  const match = CATEGORIES.find((c) => c.label.toLowerCase() === cat.toLowerCase());
  return match ? match.color : '#ef4444';
};

const reverseGeocode = async (lat: number, lon: number): Promise<{ name?: string; city?: string }> => {
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
      return { name, city };
    }
  } catch (err) {
    console.error('Reverse geocode error:', err);
  }
  return {};
};

const compressImage = async (file: File, maxDimension = 1200, quality = 0.8): Promise<File> => {
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
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
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

  const [currentUser, setCurrentUser] = useState<any>(null);
  const currentUserRef = useRef<any>(null);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bywayr_user_profile');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return null;
  });

  const [showWelcome, setShowWelcome] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isClaimUsernameModalOpen, setIsClaimUsernameModalOpen] = useState(false);

  // Auth & Username States
  const [authEmail, setAuthEmail] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authUsernameError, setAuthUsernameError] = useState('');
  const [claimUsername, setClaimUsername] = useState('');
  const [claimUsernameError, setClaimUsernameError] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // App & Map States
  const [mapTheme, setMapTheme] = useState<'light' | 'dark'>('light');
  const [onlyMySpots, setOnlyMySpots] = useState(false);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'fieldNotes' | 'mustTry'>('fieldNotes');
  const [copiedSpotId, setCopiedSpotId] = useState<string | null>(null);
  const [mustTrySpotIds, setMustTrySpotIds] = useState<string[]>([]);
  const [savingBookmark, setSavingBookmark] = useState(false);

  // Vouches State
  const [vouchedSpotIds, setVouchedSpotIds] = useState<string[]>([]);
  const [vouchCounts, setVouchCounts] = useState<Record<string, number>>({});
  const [savingVouch, setSavingVouch] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isModalLocating, setIsModalLocating] = useState(false);
  const [viewingSpot, setViewingSpot] = useState<Spot | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [newSpot, setNewSpot] = useState<Spot>({
    name: '',
    category: 'Hidden Gems',
    city: 'Manila',
    country: 'Philippines',
    description: '',
    latitude: 14.5995,
    longitude: 120.9842,
    image_url: '',
  });

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('bywayr_theme') as 'light' | 'dark' | null;
    if (savedTheme) setMapTheme(savedTheme);

    const hasSeenWelcome = localStorage.getItem('bywayr_seen_welcome');
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    }
  }, []);

  const handleDismissWelcome = () => {
    localStorage.setItem('bywayr_seen_welcome', 'true');
    setShowWelcome(false);
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!error && data) {
        setUserProfile(data);
        localStorage.setItem('bywayr_user_profile', JSON.stringify(data));
        if (!data.username) {
          setIsClaimUsernameModalOpen(true);
        }
      } else if (!data) {
        setIsClaimUsernameModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  const fetchUsernamesMap = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id, username');
      if (!error && data) {
        const map: Record<string, string> = {};
        data.forEach((p: any) => {
          if (p.id && p.username) map[p.id] = p.username;
        });
        setUsernames(map);
      }
    } catch (err) {
      console.error('Failed to load usernames map:', err);
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

  const handleGoogleSignIn = async () => {
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
    else setMagicLinkSent(true);
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
      const updated = { ...userProfile, id: activeUser.id, username: clean };
      setUserProfile(updated);
      localStorage.setItem('bywayr_user_profile', JSON.stringify(updated));
      setIsClaimUsernameModalOpen(false);
      fetchUsernamesMap();
    }
    setIsSavingUsername(false);
  };

  const handleSignOut = async () => {
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

  const fetchSpots = async () => {
    try {
      const { data, error } = await supabase.from('spots').select('*').order('id', { ascending: false });
      if (!error && data) setSpots(data as Spot[]);
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

  useEffect(() => {
    fetchSpots();
    fetchUsernamesMap();
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

  const toggleMustTry = async (spotId?: string) => {
    if (!spotId) return;
    const activeUser = currentUserRef.current;
    if (!activeUser) {
      setIsAuthModalOpen(true);
      return;
    }

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
      return;
    }

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

  const toggleMapTheme = () => {
    const nextTheme = mapTheme === 'light' ? 'dark' : 'light';
    setMapTheme(nextTheme);
    localStorage.setItem('bywayr_theme', nextTheme);

    if (!map.current) return;
    if (map.current.getLayer('osm-tiles-light-layer') && map.current.getLayer('osm-tiles-dark-layer')) {
      map.current.setLayoutProperty('osm-tiles-light-layer', 'visibility', nextTheme === 'light' ? 'visible' : 'none');
      map.current.setLayoutProperty('osm-tiles-dark-layer', 'visibility', nextTheme === 'dark' ? 'visible' : 'none');
    }
  };

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const savedTheme = (localStorage.getItem('bywayr_theme') as 'light' | 'dark') || 'light';

    const initializedMap = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles-light': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap Contributors',
          },
          'osm-tiles-dark': {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© CartoDB, OpenStreetMap Contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles-light-layer',
            type: 'raster',
            source: 'osm-tiles-light',
            minzoom: 0,
            maxzoom: 19,
            layout: { visibility: savedTheme === 'light' ? 'visible' : 'none' },
          },
          {
            id: 'osm-tiles-dark-layer',
            type: 'raster',
            source: 'osm-tiles-dark',
            minzoom: 0,
            maxzoom: 19,
            layout: { visibility: savedTheme === 'dark' ? 'visible' : 'none' },
          },
        ],
      },
      center: [121.06, 14.57],
      zoom: 14,
    });

    initializedMap.on('click', (e) => {
      const originalTarget = e.originalEvent.target as HTMLElement;
      if (originalTarget?.closest('.maplibregl-marker')) return;
      const lat = parseFloat(e.lngLat.lat.toFixed(6));
      const lng = parseFloat(e.lngLat.lng.toFixed(6));
      dropPreviewAndOpenModal(lat, lng);
    });

    map.current = initializedMap;

    return () => {
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

    // Match a Plus Code pattern anywhere in the query string
    const codeMatch = rawQuery.match(/([2-9CFGHJMPQRVWX+]{4,8}\+[2-9CFGHJMPQRVWX+]{2,})/i);

    if (codeMatch) {
      const codePart = codeMatch[1].toUpperCase();
      const localityHint = rawQuery.replace(codeMatch[0], '').trim();

      if (isValid(codePart)) {
        if (isFull(codePart)) {
          try {
            const decoded = decode(codePart);
            const lat = decoded.latitudeCenter;
            const lon = decoded.longitudeCenter;
            setSearchResults([{
              lat: lat.toString(),
              lon: lon.toString(),
              display_name: `Plus Code (${codePart})${localityHint ? ` in ${localityHint}` : ''}: ${lat.toFixed(6)}, ${lon.toFixed(6)}`
            }]);
            setShowDropdown(true);
            return;
          } catch (err) {
            console.error('Full code decode error:', err);
          }
        } else if (isShort(codePart)) {
          // Short code needs a reference anchor derived from the locality hint
          const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
              let anchorLat = map.current ? map.current.getCenter().lat : 36.1699;
              let anchorLon = map.current ? map.current.getCenter().lng : -115.1398;

              if (localityHint) {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(localityHint)}&limit=1`);
                const geoData = await geoRes.json();
                if (geoData && geoData.length > 0) {
                  anchorLat = parseFloat(geoData[0].lat);
                  anchorLon = parseFloat(geoData[0].lon);
                }
              }

              const fullCode = recoverNearest(codePart, anchorLat, anchorLon);
              if (isFull(fullCode)) {
                const decoded = decode(fullCode);
                const lat = decoded.latitudeCenter;
                const lon = decoded.longitudeCenter;
                setSearchResults([{
                  lat: lat.toString(),
                  lon: lon.toString(),
                  display_name: `Plus Code (${codePart}) in ${localityHint || 'Current Area'}: ${lat.toFixed(6)}, ${lon.toFixed(6)}`
                }]);
                setShowDropdown(true);
              }
            } catch (err) {
              console.error('Short Plus Code resolution error:', err);
            } finally {
              setIsSearching(false);
            }
          }, 400);

          return () => clearTimeout(timer);
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
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rawQuery)}`);
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
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    setShowDropdown(false);
    setSearchQuery(item.display_name);

    if (map.current) {
      map.current.flyTo({ center: [lon, lat], zoom: 16, essential: true });

      if (previewMarkerRef.current) previewMarkerRef.current.remove();
      previewMarkerRef.current = new maplibregl.Marker({ color: '#2563eb' })
        .setLngLat([lon, lat])
        .addTo(map.current);
    }
  };

  const filteredSpots = spots.filter((spot) => {
    if (onlyMySpots && currentUser && spot.user_id !== currentUser.id) return false;
    if (selectedCategory === 'All') return true;
    return spot.category?.toLowerCase() === selectedCategory.toLowerCase();
  });

  useEffect(() => {
    if (!map.current) return;
    spotMarkersRef.current.forEach((marker) => marker.remove());
    spotMarkersRef.current = [];

    filteredSpots.forEach((spot) => {
      if (!spot.latitude || !spot.longitude) return;
      const isMustTry = spot.id ? mustTrySpotIds.includes(spot.id) : false;
      const color = getCategoryColor(spot.category);

      const el = document.createElement('div');
      el.style.width = '28px';
      el.style.height = '28px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = isMustTry ? '3.5px solid #f59e0b' : '3.5px solid #ffffff';
      el.style.boxShadow = '0 4px 14px rgba(0,0,0,0.35)';
      el.style.cursor = 'pointer';
      el.title = spot.name;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        flyToSpot(spot);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([spot.longitude, spot.latitude])
        .addTo(map.current!);

      spotMarkersRef.current.push(marker);
    });
  }, [filteredSpots, mustTrySpotIds]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!map.current) return;

        if (userLocationMarkerRef.current) {
          userLocationMarkerRef.current.setLngLat([longitude, latitude]);
        } else {
          const el = document.createElement('div');
          el.style.width = '18px';
          el.style.height = '18px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = '#0284c7';
          el.style.border = '3px solid #ffffff';
          el.style.boxShadow = '0 0 12px rgba(2, 132, 199, 0.7)';

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
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsModalLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const lat = parseFloat(latitude.toFixed(6));
        const lon = parseFloat(longitude.toFixed(6));

        if (map.current) {
          if (previewMarkerRef.current) previewMarkerRef.current.remove();
          previewMarkerRef.current = new maplibregl.Marker({ color: '#2563eb' })
            .setLngLat([lon, lat])
            .addTo(map.current);
          map.current.flyTo({ center: [lon, lat], zoom: 16, essential: true });
        }

        const geo = await reverseGeocode(lat, lon);
        setNewSpot((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lon,
          city: geo.city || prev.city || 'Manila',
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
    const shareUrl = `${window.location.origin}${window.location.pathname}?spot=${spot.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Bywayr — ${spot.name}`, text: `Check out ${spot.name} in ${spot.city}!`, url: shareUrl });
        return;
      } catch {}
    }

    await navigator.clipboard.writeText(shareUrl);
    setCopiedSpotId(spot.id);
    setTimeout(() => setCopiedSpotId(null), 2500);
  };

  const dropPreviewAndOpenModal = async (lat: number, lon: number, defaultName: string = '') => {
    const activeUser = currentUserRef.current;
    if (!activeUser) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!map.current) return;
    setViewingSpot(null);
    setIsEditing(false);

    if (previewMarkerRef.current) previewMarkerRef.current.remove();

    const previewPin = new maplibregl.Marker({ color: '#2563eb' }).setLngLat([lon, lat]).addTo(map.current);
    previewMarkerRef.current = previewPin;

    map.current.flyTo({ center: [lon, lat], zoom: 16, essential: true });

    const geo = await reverseGeocode(lat, lon);

    setNewSpot({
      name: defaultName || geo.name || '',
      category: 'Hidden Gems',
      city: geo.city || 'Manila',
      country: 'Philippines',
      description: '',
      latitude: parseFloat(lat.toFixed(6)),
      longitude: parseFloat(lon.toFixed(6)),
      image_url: '',
    });

    setImageFile(null);
    setImagePreview(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (spot: Spot) => {
    const activeUser = currentUserRef.current;
    if (!activeUser || spot.user_id !== activeUser.id) return;
    setIsEditing(true);
    setNewSpot(spot);
    setImagePreview(spot.image_url || null);
    setImageFile(null);
    setViewingSpot(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (previewMarkerRef.current) {
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
      return;
    }
    if (!newSpot.name || isNaN(newSpot.latitude) || isNaN(newSpot.longitude)) return;

    setSaving(true);
    let uploadedUrl = newSpot.image_url || '';

    if (imageFile) {
      setUploadingImage(true);
      const fileToUpload = await compressImage(imageFile);
      const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `spots/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('spot-images').upload(filePath, fileToUpload, { contentType: fileToUpload.type, upsert: true });
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
          country: newSpot.country || 'Philippines',
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
        setIsModalOpen(false);
      }
    } else {
      const { data, error } = await supabase
        .from('spots')
        .insert([{
          name: newSpot.name,
          category: newSpot.category,
          city: newSpot.city,
          country: newSpot.country || 'Philippines',
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
        setIsModalOpen(false);
        setSearchQuery('');
        if (map.current) map.current.flyTo({ center: [newSpot.longitude, newSpot.latitude], zoom: 16 });
      }
    }
    setSaving(false);
  };

  const flyToSpot = (spot: Spot) => {
    if (!map.current || !spot.latitude || !spot.longitude) return;
    map.current.flyTo({ center: [spot.longitude, spot.latitude], zoom: 16, essential: true });
    setViewingSpot(spot);
    setIsDrawerOpen(false);
    if (spot.id && typeof window !== 'undefined') window.history.replaceState(null, '', `?spot=${spot.id}`);
  };

  const displayedDrawerSpots = drawerTab === 'fieldNotes' ? filteredSpots : spots.filter((s) => s.id && mustTrySpotIds.includes(s.id));
  const mySpotsCount = currentUser ? spots.filter((s) => s.user_id === currentUser.id).length : 0;
  const myCitiesCount = currentUser ? new Set(spots.filter((s) => s.user_id === currentUser.id).map((s) => s.city.trim())).size : 0;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* 1. Map Canvas */}
      <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} />

      {/* 2. Top Header, Search, and Category Filter Bar */}
      <div style={{ position: 'fixed', top: '16px', left: '16px', right: '16px', maxWidth: '440px', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '9px', pointerEvents: 'auto' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '18px', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.22)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{ backgroundColor: '#fef2f2', padding: '8px', borderRadius: '12px', display: 'flex', flexShrink: 0 }}>
              <Compass style={{ color: '#ef4444', width: '20px', height: '20px' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Bywayr</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {loading ? 'Connecting...' : selectedCategory === 'All' ? `${spots.length} saved spots` : `${filteredSpots.length} in ${selectedCategory}`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {currentUser ? (
              <button onClick={() => setIsProfileModalOpen(true)} style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '8px 10px', color: '#475569', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <User style={{ width: '14px', height: '14px', flexShrink: 0 }} /> {userProfile?.username ? `@${userProfile.username}` : 'Account'}
              </button>
            ) : (
              <button onClick={() => { setMagicLinkSent(false); setAuthUsername(''); setAuthUsernameError(''); setIsAuthModalOpen(true); }} style={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '10px', padding: '8px 12px', color: '#ffffff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <LogIn style={{ width: '14px', height: '14px', flexShrink: 0 }} /> Sign In
              </button>
            )}

            <button onClick={() => setIsDrawerOpen(true)} style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '8px 10px', color: '#334155', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <List style={{ width: '16px', height: '16px' }} />
            </button>
            <button
              onClick={() => {
                if (!currentUserRef.current) {
                  setIsAuthModalOpen(true);
                  return;
                }
                const center = map.current ? map.current.getCenter() : { lat: 14.5995, lng: 120.9842 };
                dropPreviewAndOpenModal(center.lat, center.lng);
              }}
              style={{ backgroundColor: '#ef4444', border: 'none', borderRadius: '10px', padding: '8px 13px', color: '#ffffff', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              <Plus style={{ width: '15px', height: '15px' }} /> Add
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '100%' }}>
          <form onSubmit={(e) => e.preventDefault()} style={{ position: 'relative', width: '100%' }}>
            <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', width: '18px', height: '18px' }} />
            <input
              type="text"
              placeholder="Search, paste coordinates, or plus codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#ffffff', padding: '13px 44px 13px 42px', fontSize: '13.5px', borderRadius: showDropdown ? '16px 16px 0 0' : '16px', border: '1px solid #e2e8f0', boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)', outline: 'none', color: '#0f172a' }}
            />
            {isSearching && <Loader2 style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#ef4444', width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />}
          </form>

          {showDropdown && searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#ffffff', borderRadius: '0 0 16px 16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', maxHeight: '240px', overflowY: 'auto', zIndex: 10000 }}>
              {searchResults.map((item, idx) => (
                <div key={idx} onClick={() => handleSelectSearchResult(item)} style={{ padding: '12px 16px', fontSize: '13px', color: '#334155', cursor: 'pointer', borderBottom: idx < searchResults.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  {item.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Categories */}
        <div style={{ display: 'flex', gap: '7px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.label.toLowerCase();
            return (
              <button
                key={cat.label}
                onClick={() => setSelectedCategory(cat.label)}
                style={{ backgroundColor: isSelected ? cat.color : '#ffffff', color: isSelected ? '#ffffff' : '#334155', border: isSelected ? `1px solid ${cat.color}` : '1px solid #e2e8f0', padding: '7px 13px', borderRadius: '22px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isSelected ? '#ffffff' : cat.color }} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Floating Action Controls */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '9px', pointerEvents: 'auto' }}>
        <button onClick={toggleMapTheme} style={{ width: '48px', height: '48px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 4px 18px rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: mapTheme === 'light' ? '#0f172a' : '#d97706' }}>
          {mapTheme === 'light' ? <Moon style={{ width: '21px', height: '21px' }} /> : <Sun style={{ width: '21px', height: '21px' }} />}
        </button>
        <button onClick={handleLocateMe} disabled={isLocating} style={{ width: '48px', height: '48px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 4px 18px rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0284c7' }}>
          {isLocating ? <Loader2 style={{ width: '22px', height: '22px', animation: 'spin 1s linear infinite' }} /> : <Crosshair style={{ width: '22px', height: '22px' }} />}
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button onClick={() => map.current?.zoomIn()} style={{ width: '48px', height: '48px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 4px 18px rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a' }}>
            <Plus style={{ width: '22px', height: '22px' }} />
          </button>
          <button onClick={() => map.current?.zoomOut()} style={{ width: '48px', height: '48px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 4px 18px rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a' }}>
            <Minus style={{ width: '22px', height: '22px' }} />
          </button>
        </div>
      </div>

      {/* 4. Spot Details Bottom Sheet with Single Clean Native Navigate Button & ThumbsUp Vouch */}
      {viewingSpot && (
        <div style={{ position: 'fixed', bottom: '24px', left: '16px', right: '16px', maxWidth: '400px', zIndex: 99999, backgroundColor: '#ffffff', borderRadius: '22px', boxShadow: '0 20px 45px rgba(0, 0, 0, 0.3)', border: '1px solid #e2e8f0', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div style={{ flex: 1, paddingRight: '10px' }}>
              <span style={{ display: 'inline-block', backgroundColor: `${getCategoryColor(viewingSpot.category)}20`, color: getCategoryColor(viewingSpot.category), fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '7px', marginBottom: '6px' }}>
                {viewingSpot.category}
              </span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{viewingSpot.name}</h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                {viewingSpot.city} {viewingSpot.user_id && usernames[viewingSpot.user_id] ? `· @${usernames[viewingSpot.user_id]}` : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              {/* ThumbsUp Vouch Button */}
              <button
                onClick={() => toggleVouch(viewingSpot.id)}
                disabled={savingVouch}
                style={{
                  border: 'none',
                  background: viewingSpot.id && vouchedSpotIds.includes(viewingSpot.id) ? '#ecfdf5' : '#f1f5f9',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: viewingSpot.id && vouchedSpotIds.includes(viewingSpot.id) ? '#059669' : '#475569',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
                title="Vouch for this spot"
              >
                <ThumbsUp style={{ width: '16px', height: '16px' }} />
                <span>{viewingSpot.id ? vouchCounts[viewingSpot.id] || 0 : 0}</span>
              </button>

              {/* Bookmark Button */}
              <button onClick={() => toggleMustTry(viewingSpot.id)} disabled={savingBookmark} style={{ border: 'none', background: viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#fef3c7' : '#f1f5f9', borderRadius: '10px', cursor: 'pointer', color: viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#d97706' : '#475569', padding: '7px', display: 'flex' }} title="Save to Must-Try">
                {viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? <BookmarkCheck style={{ width: '17px', height: '17px' }} /> : <Bookmark style={{ width: '17px', height: '17px' }} />}
              </button>

              {/* Share Button */}
              <button onClick={() => handleShareSpot(viewingSpot)} style={{ border: 'none', background: copiedSpotId === viewingSpot.id ? '#f0fdf4' : '#f1f5f9', borderRadius: '10px', cursor: 'pointer', color: copiedSpotId === viewingSpot.id ? '#16a34a' : '#475569', padding: '7px', display: 'flex', alignItems: 'center', gap: '4px' }} title="Share spot">
                {copiedSpotId === viewingSpot.id ? <Check style={{ width: '17px', height: '17px' }} /> : <Share2 style={{ width: '17px', height: '17px' }} />}
              </button>

              {currentUser && viewingSpot.user_id === currentUser.id && (
                <>
                  <button onClick={() => handleOpenEditModal(viewingSpot)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '10px', cursor: 'pointer', color: '#475569', padding: '7px', display: 'flex' }} title="Edit Spot">
                    <Pencil style={{ width: '16px', height: '16px' }} />
                  </button>
                  <button onClick={() => handleDeleteSpot(viewingSpot)} disabled={deleting} style={{ border: 'none', background: '#fef2f2', borderRadius: '10px', cursor: 'pointer', color: '#ef4444', padding: '7px', display: 'flex' }} title="Delete Spot">
                    {deleting ? <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> : <Trash2 style={{ width: '16px', height: '16px' }} />}
                  </button>
                </>
              )}
              <button onClick={() => { setViewingSpot(null); if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '5px' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>
          </div>

          {viewingSpot.image_url && <img src={viewingSpot.image_url} alt={viewingSpot.name} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '14px', margin: '8px 0' }} />}
          {viewingSpot.description && <p style={{ margin: '8px 0 14px 0', fontSize: '13.5px', color: '#334155', lineHeight: 1.45 }}>{viewingSpot.description}</p>}
          
          {/* Single Clean Native Geo Navigation Button */}
          <a
            href={`geo:${viewingSpot.latitude},${viewingSpot.longitude}?q=${viewingSpot.latitude},${viewingSpot.longitude}(${encodeURIComponent(viewingSpot.name)})`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', boxSizing: 'border-box', padding: '12px', backgroundColor: '#0f172a', color: '#ffffff', textDecoration: 'none', borderRadius: '12px', fontSize: '13.5px', fontWeight: 600 }}
          >
            <Navigation2 style={{ width: '16px', height: '16px' }} /> Navigate
          </a>
        </div>
      )}

      {/* 5. Slide-Out Drawer with Author Handles */}
      {isDrawerOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(3px)', zIndex: 100000, display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ width: '100%', maxWidth: '370px', backgroundColor: '#ffffff', height: '100%', boxShadow: '10px 0 30px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', padding: '22px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 700, color: '#0f172a' }}>{drawerTab === 'fieldNotes' ? 'Field Notes' : 'Must-Try'}</h2>
              <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X style={{ width: '22px', height: '22px' }} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: '#f1f5f9', borderRadius: '12px', padding: '4px', marginBottom: '16px' }}>
              <button onClick={() => setDrawerTab('fieldNotes')} style={{ border: 'none', padding: '9px 0', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', backgroundColor: drawerTab === 'fieldNotes' ? '#ffffff' : 'transparent', color: drawerTab === 'fieldNotes' ? '#0f172a' : '#64748b' }}>Field Notes</button>
              <button onClick={() => { if (!currentUserRef.current) { setIsAuthModalOpen(true); return; } setDrawerTab('mustTry'); }} style={{ border: 'none', padding: '9px 0', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', backgroundColor: drawerTab === 'mustTry' ? '#ffffff' : 'transparent', color: drawerTab === 'mustTry' ? '#0f172a' : '#64748b' }}>Must-Try ({mustTrySpotIds.length})</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '11px' }}>
              {displayedDrawerSpots.map((spot) => {
                const authorHandle = spot.user_id && usernames[spot.user_id] ? `@${usernames[spot.user_id]}` : null;
                return (
                  <div key={spot.id || spot.name} style={{ padding: '13px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#ffffff' }}>
                    <div style={{ flex: 1, minWidth: '0' }}>
                      <h4 onClick={() => flyToSpot(spot)} style={{ margin: '0 0 3px 0', fontSize: '14.5px', fontWeight: 600, color: '#2563eb', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spot.name}</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                        {spot.city}
                        {authorHandle ? ` · ${authorHandle}` : ''}
                        {' · '}
                        <span style={{ color: getCategoryColor(spot.category), fontWeight: 600 }}>{spot.category}</span>
                        {spot.id && vouchCounts[spot.id] ? ` · ✓ ${vouchCounts[spot.id]}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 6. Profile Modal */}
      {isProfileModalOpen && currentUser && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100001, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '22px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', width: '100%', maxWidth: '370px', padding: '26px', position: 'relative' }}>
            <button onClick={() => setIsProfileModalOpen(false)} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
              <X style={{ width: '22px', height: '22px' }} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}>
                <User style={{ width: '24px', height: '24px' }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {userProfile?.username ? `@${userProfile.username}` : 'Field Journal'}
                  <button onClick={() => { setIsProfileModalOpen(false); setClaimUsername(userProfile?.username || ''); setIsClaimUsernameModalOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }} title="Change Username">
                    <Pencil style={{ width: '13px', height: '13px' }} />
                  </button>
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>{currentUser.email}</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '9px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px', marginBottom: '18px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '19px', fontWeight: 700, color: '#0f172a' }}>{mySpotsCount}</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Pins</div>
              </div>
              <div>
                <div style={{ fontSize: '19px', fontWeight: 700, color: '#d97706' }}>{mustTrySpotIds.length}</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Must-Try</div>
              </div>
              <div>
                <div style={{ fontSize: '19px', fontWeight: 700, color: '#0284c7' }}>{myCitiesCount}</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Cities</div>
              </div>
            </div>
            <div onClick={() => setOnlyMySpots(!onlyMySpots)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: onlyMySpots ? '#eff6ff' : '#ffffff', border: onlyMySpots ? '1px solid #bfdbfe' : '1px solid #e2e8f0', borderRadius: '14px', cursor: 'pointer', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <MapPin style={{ width: '17px', height: '17px', color: onlyMySpots ? '#2563eb' : '#64748b' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: onlyMySpots ? '#1e40af' : '#334155' }}>Filter map to my pins only</span>
              </div>
              {onlyMySpots ? <CheckSquare style={{ width: '17px', height: '17px', color: '#2563eb' }} /> : <Square style={{ width: '17px', height: '17px', color: '#94a3b8' }} />}
            </div>
            <button onClick={handleSignOut} style={{ width: '100%', backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: 600, fontSize: '13px', padding: '11px', borderRadius: '12px', border: '1px solid #fecaca', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <LogOut style={{ width: '15px', height: '15px' }} /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* 7. Claim / Set Username Modal */}
      {isClaimUsernameModalOpen && currentUser && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100002, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '22px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', width: '100%', maxWidth: '370px', padding: '26px', position: 'relative' }}>
            <div style={{ width: '48px', height: '48px', backgroundColor: '#eff6ff', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto', color: '#2563eb' }}>
              <AtSign style={{ width: '26px', height: '26px' }} />
            </div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '19px', fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>Choose Your Handle</h3>
            <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>Pick a unique handle for your pins and collections on Bywayr.</p>

            <form onSubmit={handleClaimUsername} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '5px' }}>Username</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>@</span>
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
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '14px', padding: '11px 12px 11px 30px', borderRadius: '11px', border: claimUsernameError ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                  />
                </div>
                {claimUsernameError && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{claimUsernameError}</span>}
              </div>

              <button type="submit" disabled={isSavingUsername || claimUsername.length < 3} style={{ width: '100%', backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '13px', padding: '11px', borderRadius: '12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                {isSavingUsername ? <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> : 'Set Username'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 8. Auth Modal */}
      {isAuthModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100001, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '22px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', width: '100%', maxWidth: '370px', padding: '26px', position: 'relative', textAlign: 'center' }}>
            <button onClick={() => setIsAuthModalOpen(false)} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
              <X style={{ width: '22px', height: '22px' }} />
            </button>
            <div style={{ width: '48px', height: '48px', backgroundColor: '#fef2f2', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
              <Compass style={{ color: '#ef4444', width: '26px', height: '26px' }} />
            </div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '19px', fontWeight: 700, color: '#0f172a' }}>Join Bywayr</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>Sign in to curate, pin, and protect your favorite local spots.</p>
            
            <button onClick={handleGoogleSignIn} style={{ width: '100%', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '13px', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '13.5px', fontWeight: 600, color: '#1e293b', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '16px' }}>
              <svg width="19" height="19" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '14px 0' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
              <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>OR EMAIL</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
            </div>

            {magicLinkSent ? (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '16px', textAlign: 'center' }}>
                <CheckCircle2 style={{ color: '#16a34a', width: '26px', height: '26px', margin: '0 auto 6px auto' }} />
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#15803d' }}>Magic Link Sent!</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#166534' }}>Check your inbox for <strong>{authEmail}</strong> to sign in.</p>
              </div>
            ) : (
              <form onSubmit={handleMagicLinkSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ textAlign: 'left' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Username (for new users)</label>
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
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '13.5px', padding: '11px 13px', borderRadius: '11px', border: authUsernameError ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none' }}
                  />
                  {authUsernameError && <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px', display: 'block' }}>{authUsernameError}</span>}
                </div>

                <div style={{ textAlign: 'left' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="Enter your email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '13.5px', padding: '11px 13px', borderRadius: '11px', border: '1px solid #cbd5e1', outline: 'none' }}
                  />
                </div>

                <button type="submit" disabled={isSendingMagicLink} style={{ width: '100%', backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 600, fontSize: '13px', padding: '11px', borderRadius: '11px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                  {isSendingMagicLink ? <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> : <><Mail style={{ width: '15px', height: '15px' }} /> Send Magic Link</>}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 9. Add / Edit Spot Modal Form */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '22px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', width: '100%', maxWidth: '390px', padding: '24px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={handleCloseModal} style={{ position: 'absolute', top: '18px', right: '18px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
              <X style={{ width: '22px', height: '22px' }} />
            </button>
            <h2 style={{ margin: '0 0 16px 0', fontWeight: 700, fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin style={{ width: '20px', height: '20px', color: '#ef4444' }} />
              {isEditing ? 'Edit Spot' : 'Add to Bywayr'}
            </h2>
            <form onSubmit={handleSaveSpot} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Photo (Optional)</label>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '96px', border: '2px dashed #cbd5e1', borderRadius: '12px', cursor: 'pointer', backgroundColor: imagePreview ? 'transparent' : '#f8fafc', position: 'relative', overflow: 'hidden' }}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', color: '#64748b' }}>
                      <Camera style={{ width: '22px', height: '22px', color: '#94a3b8' }} />
                      <span style={{ fontSize: '12px', fontWeight: 500 }}>Tap to upload or choose image</span>
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
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    borderRadius: '11px',
                    padding: '9px 13px',
                    fontSize: '12.5px',
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
                    <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Crosshair style={{ width: '15px', height: '15px' }} />
                  )}
                  Pin My Current Location
                </button>
              )}

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Spot Name</label>
                <input required autoFocus type="text" placeholder="e.g. Hidden Rooftop Cafe" value={newSpot.name} onChange={(e) => setNewSpot({ ...newSpot, name: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13.5px', padding: '10px 13px', borderRadius: '11px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Latitude</label>
                    <input required type="number" step="any" value={newSpot.latitude} onChange={(e) => setNewSpot({ ...newSpot, latitude: parseFloat(e.target.value) })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13.5px', padding: '10px 13px', borderRadius: '11px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Longitude</label>
                    <input required type="number" step="any" value={newSpot.longitude} onChange={(e) => setNewSpot({ ...newSpot, longitude: parseFloat(e.target.value) })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13.5px', padding: '10px 13px', borderRadius: '11px', border: '1px solid #cbd5e1' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Category</label>
                  <select value={newSpot.category} onChange={(e) => setNewSpot({ ...newSpot, category: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13.5px', padding: '10px 13px', borderRadius: '11px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
                    {CATEGORIES.filter(c => c.label !== 'All').map(cat => (
                      <option key={cat.label} value={cat.label}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>City</label>
                  <input type="text" value={newSpot.city} onChange={(e) => setNewSpot({ ...newSpot, city: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13.5px', padding: '10px 13px', borderRadius: '11px', border: '1px solid #cbd5e1' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Notes / Description</label>
                <textarea rows={2} placeholder="Atmosphere, tips, recommendations..." value={newSpot.description} onChange={(e) => setNewSpot({ ...newSpot, description: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13.5px', padding: '10px 13px', borderRadius: '11px', border: '1px solid #cbd5e1', resize: 'none' }} />
              </div>
              <button type="submit" disabled={saving || uploadingImage} style={{ marginTop: '6px', width: '100%', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 600, fontSize: '13.5px', padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)' }}>
                {saving || uploadingImage ? <Loader2 style={{ width: '17px', height: '17px' }} /> : isEditing ? 'Update Spot' : 'Save Spot'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 10. Clean & Punchy Welcome Screen */}
      {showWelcome && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100003, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', width: '100%', maxWidth: '370px', padding: '28px 22px', position: 'relative', textAlign: 'center', boxSizing: 'border-box' }}>
            <div style={{ width: '52px', height: '52px', backgroundColor: '#fef2f2', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <Compass style={{ color: '#ef4444', width: '28px', height: '28px' }} />
            </div>

            <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Welcome to Bywayr
            </h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
              A map-based field guide built for travelers, expats, and city wanderers to discover and curate hidden local spots.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', marginBottom: '22px', backgroundColor: '#f8fafc', padding: '14px 16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ backgroundColor: '#eff6ff', padding: '6px', borderRadius: '8px', color: '#2563eb', flexShrink: 0, display: 'flex' }}>
                  <Gem style={{ width: '16px', height: '16px' }} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Discover curated hidden gems</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ backgroundColor: '#fef2f2', padding: '6px', borderRadius: '8px', color: '#ef4444', flexShrink: 0, display: 'flex' }}>
                  <MapPin style={{ width: '16px', height: '16px' }} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Pin spots & photos as you explore</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ backgroundColor: '#fef3c7', padding: '6px', borderRadius: '8px', color: '#d97706', flexShrink: 0, display: 'flex' }}>
                  <BookmarkCheck style={{ width: '16px', height: '16px' }} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Save your must-try wandering wishlist</span>
              </div>
            </div>

            <button
              onClick={handleDismissWelcome}
              style={{ width: '100%', backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 700, fontSize: '13.5px', padding: '12px', borderRadius: '13px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)' }}
            >
              Start Exploring
            </button>
          </div>
        </div>
      )}
    </div>
  );
}