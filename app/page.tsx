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
  Download,
  Upload,
  Crown,
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
  bio?: string;
}

const CATEGORIES = [
  { 
    label: 'All', 
    desc: 'All curated field notes & unmapped spots', 
    color: '#57534e', 
    icon: Sparkles 
  },
  { 
    label: 'Hidden Gems', 
    desc: 'Unmarked spots, secret corners & quiet local treasures', 
    color: '#e05a47', 
    icon: Gem 
  },
  { 
    label: 'Alley Eats', 
    desc: 'Backstreet stalls, hidden bistros & local food legends', 
    color: '#ea580c', 
    icon: Utensils 
  },
  { 
    label: 'Cafe & Chill', 
    desc: 'Quiet roasters, courtyard hideaways & relaxed spaces', 
    color: '#d97706', 
    icon: Coffee 
  },
  { 
    label: 'Listening & Bars', 
    desc: 'Vinyl bars, basement speakeasies & acoustic haunts', 
    color: '#db2777', 
    icon: Beer 
  },
  { 
    label: 'Secret Coasts', 
    desc: 'Uncrowded beaches, hidden coves & quiet shoreline walks', 
    color: '#0284c7', 
    icon: Waves 
  },
  { 
    label: 'Street Markets', 
    desc: 'Night bazaars, morning produce alleys & flea markets', 
    color: '#9333ea', 
    icon: Store 
  },
  { 
    label: 'Nature & Trails', 
    desc: 'Scenic walks, waterfalls, urban greenery & trailheads', 
    color: '#0d9488', 
    icon: Trees 
  },
  { 
    label: 'Viewpoints', 
    desc: 'Rooftops, hillside lookouts & panoramic sunset perches', 
    color: '#059669', 
    icon: Mountain 
  },
  { 
    label: 'Stays & Hideaways', 
    desc: 'Boutique guesthouses, quiet homestays & remote retreats', 
    color: '#4f46e5', 
    icon: HomeIcon 
  },
  { 
    label: 'Vintage & Vinyl', 
    desc: 'Retro oddity shops, thrifts & crate-digging stops', 
    color: '#b45309', 
    icon: Disc 
  },
  { 
    label: 'Work & Focus', 
    desc: 'Nomad friendly work spots, quiet libraries & fast Wi-Fi cafes', 
    color: '#2563eb', 
    icon: Laptop 
  },
  { 
    label: 'Late Night', 
    desc: '2 AM food stalls, midnight street bites & after-hours spots', 
    color: '#7c3aed', 
    icon: MoonStar 
  },
];

const getCategoryColor = (cat: string) => {
  const match = CATEGORIES.find((c) => c.label.toLowerCase() === cat.toLowerCase());
  return match ? match.color : '#e05a47';
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

  // Mouse Drag to Scroll State for Categories
  const [isCategoryDragging, setIsCategoryDragging] = useState(false);
  const [categoryStartX, setCategoryStartX] = useState(0);
  const [categoryScrollLeft, setCategoryScrollLeft] = useState(0);

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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Public Curator Profile Modal State
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const [viewingProfileSpots, setViewingProfileSpots] = useState<Spot[]>([]);

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
  const [onlyMySpots, setOnlyMySpots] = useState(false);
  const [selectedCity, setSelectedCity] = useState('All');
  const [spots, setSpots] = useState<Spot[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'fieldNotes' | 'mustTry'>('fieldNotes');
  const [mustTrySpotIds, setMustTrySpotIds] = useState<string[]>([]);
  const [savingBookmark, setSavingBookmark] = useState(false);

  // Share Dialog State
  const [shareDialogSpot, setShareDialogSpot] = useState<Spot | null>(null);
  const [shareDialogCopied, setShareDialogCopied] = useState(false);

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
      if (!error && data) {
        setSpots(data as Spot[]);
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

  const handleOpenPublicProfile = (userId: string) => {
    const profile = profilesMap[userId] || { id: userId, username: 'wanderer' };
    const userSpots = spots.filter((s) => s.user_id === userId);
    setViewingProfile(profile);
    setViewingProfileSpots(userSpots);
  };

  // Mouse Drag-to-Scroll handlers for Category Bar
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

  // Bulletproof Keyless Styled Basemap: Custom OSM Filters with maxzoom 20 and Custom Icon-enhanced DOM Markers
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    let initialCenter: [number, number] = [121.055, 14.575];
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
          'osm-tiles-light': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles-light-layer',
            type: 'raster',
            source: 'osm-tiles-light',
            minzoom: 0,
            maxzoom: 20,
            paint: {
              'raster-hue-rotate': 25,
              'raster-saturation': -0.45,
              'raster-contrast': 0.15,
              'raster-brightness-max': 0.98,
            },
          },
        ],
      },
      center: initialCenter,
      zoom: initialZoom,
    });

    initializedMap.on('moveend', () => {
      const center = initializedMap.getCenter();
      const zoom = initializedMap.getZoom();
      localStorage.setItem('bywayr_map_center', JSON.stringify([center.lng, center.lat]));
      localStorage.setItem('bywayr_map_zoom', zoom.toString());
    });

    // Handle Mobile & Desktop Initial Geolocation (instant jump if no saved position exists)
    initializedMap.on('load', () => {
      const hasSavedPosition = localStorage.getItem('bywayr_map_center');
      if (navigator.geolocation && !window.location.search.includes('spot=') && !hasSavedPosition) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            initializedMap.jumpTo({ center: [longitude, latitude], zoom: 15 });

            if (userLocationMarkerRef.current) {
              userLocationMarkerRef.current.setLngLat([longitude, latitude]);
            } else {
              const el = document.createElement('div');
              el.style.width = '18px';
              el.style.height = '18px';
              el.style.borderRadius = '50%';
              el.style.backgroundColor = '#0284c7';
              el.style.border = '3px solid #ffffff';
              el.style.boxShadow = '0 0 14px rgba(2, 132, 199, 0.7)';

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
      const originalTarget = e.originalEvent.target as HTMLElement;
      if (originalTarget?.closest('.maplibregl-marker')) return;
      const lat = parseFloat(e.lngLat.lat.toFixed(6));
      const lng = parseFloat(e.lngLat.lng.toFixed(6));
      dropPreviewAndOpenModal(lat, lng);
    });

    initializedMap.on('dragstart', () => {
      setShowDropdown(false);
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
      previewMarkerRef.current = new maplibregl.Marker({ color: '#e05a47' })
        .setLngLat([lon, lat])
        .addTo(map.current);
    }
  };

  // Filter spots by 'My Pins', selected city, and selected category
  const filteredSpots = spots.filter((spot) => {
    if (onlyMySpots && currentUser && spot.user_id !== currentUser.id) return false;
    if (selectedCity !== 'All' && spot.city?.trim().toLowerCase() !== selectedCity.trim().toLowerCase()) return false;
    if (selectedCategory === 'All') return true;
    return spot.category?.toLowerCase() === selectedCategory.toLowerCase();
  });

  // Extract unique cities available in spots
  const availableCities = Array.from(new Set(spots.map((s) => s.city?.trim()).filter(Boolean)));

  useEffect(() => {
    if (!map.current) return;
    spotMarkersRef.current.forEach((marker) => marker.remove());
    spotMarkersRef.current = [];

    filteredSpots.forEach((spot) => {
      if (!spot.latitude || !spot.longitude) return;
      const isMustTry = spot.id ? mustTrySpotIds.includes(spot.id) : false;
      const color = getCategoryColor(spot.category);

      const el = document.createElement('div');
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#ffffff';
      el.style.border = isMustTry ? '3.5px solid #d97706' : `3.5px solid ${color}`;
      el.style.boxShadow = '0 6px 16px rgba(28, 25, 23, 0.28)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.title = spot.name;

      const innerDot = document.createElement('div');
      innerDot.style.width = '12px';
      innerDot.style.height = '12px';
      innerDot.style.borderRadius = '50%';
      innerDot.style.backgroundColor = color;
      el.appendChild(innerDot);

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
          el.style.boxShadow = '0 0 14px rgba(2, 132, 199, 0.7)';

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
    const shareText = `Check out ${spot.name} in ${spot.city} on Bywayr!`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Bywayr — ${spot.name}`, text: shareText, url: shareUrl });
        return;
      } catch {}
    }

    setShareDialogSpot(spot);
    setShareDialogCopied(false);
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

    const previewPin = new maplibregl.Marker({ color: '#e05a47' }).setLngLat([lon, lat]).addTo(map.current);
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
  const activeCategoryObject = CATEGORIES.find((c) => c.label.toLowerCase() === selectedCategory.toLowerCase());

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", backgroundColor: '#f5f5f4' }}>
      {/* 1. Map Canvas */}
      <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} />

      {/* 2. Top Header, Search, Drag-Scrollable Category Filter Bar & City Filter Sub-Bar */}
      <div style={{ position: 'fixed', top: '16px', left: '16px', right: '16px', maxWidth: '440px', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '18px', boxShadow: '0 10px 25px -4px rgba(28, 25, 23, 0.12), 0 4px 6px -2px rgba(28, 25, 23, 0.04)', border: '1px solid #e7e5e4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
            {/* 3D Clay Icon Badge */}
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexShrink: 0, boxShadow: '0 2px 6px rgba(28, 25, 23, 0.15)' }}>
              <img src="/icon.svg" alt="Bywayr" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#1c1917', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Bywayr</h1>
              <p style={{ margin: 0, fontSize: '11.5px', color: '#78716c', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {loading ? 'Connecting...' : selectedCategory === 'All' && selectedCity === 'All' && !onlyMySpots ? `${spots.length} saved spots` : `${filteredSpots.length} spots`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {currentUser ? (
              <button 
                onClick={() => setIsProfileModalOpen(true)} 
                style={{ 
                  backgroundColor: '#f5f5f4', 
                  border: '1px solid #d6d3d1', 
                  borderRadius: '10px', 
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
                  maxWidth: '140px', 
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
              <button onClick={() => { setMagicLinkSent(false); setAuthUsername(''); setAuthUsernameError(''); setIsAuthModalOpen(true); }} style={{ backgroundColor: '#1c1917', border: 'none', borderRadius: '10px', padding: '7px 11px', color: '#fafaf9', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <LogIn style={{ width: '13px', height: '13px', flexShrink: 0 }} /> Sign In
              </button>
            )}

            <button onClick={() => setIsDrawerOpen(true)} style={{ backgroundColor: '#f5f5f4', border: '1px solid #d6d3d1', borderRadius: '10px', padding: '7px 9px', color: '#44403c', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <List style={{ width: '15px', height: '15px' }} />
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
              style={{ backgroundColor: '#e05a47', border: 'none', borderRadius: '10px', padding: '7px 12px', color: '#ffffff', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 2px 8px rgba(224, 90, 71, 0.3)' }}
            >
              <Plus style={{ width: '14px', height: '14px' }} /> Add
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '100%' }}>
          <form onSubmit={(e) => e.preventDefault()} style={{ position: 'relative', width: '100%' }}>
            <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#a8a29e', width: '17px', height: '17px' }} />
            <input
              type="text"
              placeholder="Search, paste coordinates, or plus codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#ffffff', padding: '12px 42px 12px 40px', fontSize: '13px', borderRadius: showDropdown ? '16px 16px 0 0' : '16px', border: '1px solid #e7e5e4', boxShadow: '0 8px 20px -4px rgba(28, 25, 23, 0.08)', outline: 'none', color: '#1c1917' }}
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

          {showDropdown && searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#ffffff', borderRadius: '0 0 16px 16px', border: '1px solid #e7e5e4', boxShadow: '0 14px 28px rgba(28, 25, 23, 0.12)', maxHeight: '240px', overflowY: 'auto', zIndex: 10000 }}>
              {searchResults.map((item, idx) => (
                <div key={idx} onClick={() => handleSelectSearchResult(item)} style={{ padding: '11px 15px', fontSize: '12.5px', color: '#44403c', cursor: 'pointer', borderBottom: idx < searchResults.length - 1 ? '1px solid #f5f5f4' : 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin style={{ width: '14px', height: '14px', color: '#a8a29e', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.display_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Categories & City Filter Bar with Mouse Drag & Wheel Support */}
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
              onClick={() => setOnlyMySpots(!onlyMySpots)}
              style={{
                backgroundColor: onlyMySpots ? '#fff1ee' : '#ffffff',
                color: onlyMySpots ? '#e05a47' : '#57534e',
                border: onlyMySpots ? '1px solid #fecdd3' : '1px solid #e7e5e4',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(28, 25, 23, 0.05)',
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

          {/* City Filter Chips */}
          <button
            onClick={() => setSelectedCity('All')}
            style={{
              backgroundColor: selectedCity === 'All' ? '#1c1917' : '#ffffff',
              color: selectedCity === 'All' ? '#fafaf9' : '#57534e',
              border: selectedCity === 'All' ? '1px solid #1c1917' : '1px solid #e7e5e4',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(28, 25, 23, 0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              flexShrink: 0
            }}
          >
            <Compass style={{ width: '13px', height: '13px', color: selectedCity === 'All' ? '#fafaf9' : '#0284c7' }} />
            All Cities
          </button>

          {availableCities.map((city) => {
            const isCitySelected = selectedCity.toLowerCase() === city.toLowerCase();
            return (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                style={{
                  backgroundColor: isCitySelected ? '#1c1917' : '#ffffff',
                  color: isCitySelected ? '#fafaf9' : '#57534e',
                  border: isCitySelected ? '1px solid #1c1917' : '1px solid #e7e5e4',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(28, 25, 23, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  flexShrink: 0
                }}
              >
                📍 {city}
              </button>
            );
          })}

          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.label.toLowerCase();
            const Icon = cat.icon;
            return (
              <button
                key={cat.label}
                onClick={() => setSelectedCategory(cat.label)}
                style={{ 
                  backgroundColor: isSelected ? '#1c1917' : '#ffffff', 
                  color: isSelected ? '#fafaf9' : '#57534e', 
                  border: isSelected ? '1px solid #1c1917' : '1px solid #e7e5e4', 
                  padding: '6px 12px', 
                  borderRadius: '20px', 
                  fontSize: '11.5px', 
                  fontWeight: 600, 
                  cursor: 'pointer', 
                  whiteSpace: 'nowrap', 
                  boxShadow: '0 2px 6px rgba(28, 25, 23, 0.05)', 
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

        {/* Dynamic Category Descriptor Sub-Bar */}
        {selectedCategory !== 'All' && activeCategoryObject && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', backgroundColor: 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(8px)', borderRadius: '12px', border: '1px solid #e7e5e4', fontSize: '11px', color: '#57534e', fontWeight: 500, boxShadow: '0 2px 8px rgba(28, 25, 23, 0.04)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: activeCategoryObject.color, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong>{activeCategoryObject.label}:</strong> {activeCategoryObject.desc}
            </span>
          </div>
        )}
      </div>

      {/* 3. Floating Action Controls */}
      <div style={{ position: 'fixed', bottom: '24px', right: '20px', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' }}>
        <button onClick={handleLocateMe} disabled={isLocating} style={{ width: '44px', height: '44px', backgroundColor: '#ffffff', border: '1px solid #e7e5e4', borderRadius: '13px', boxShadow: '0 4px 14px rgba(28, 25, 23, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0284c7' }}>
          {isLocating ? <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} /> : <Crosshair style={{ width: '20px', height: '20px' }} />}
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <button onClick={() => map.current?.zoomIn()} style={{ width: '44px', height: '44px', backgroundColor: '#ffffff', border: '1px solid #e7e5e4', borderRadius: '13px', boxShadow: '0 4px 14px rgba(28, 25, 23, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1c1917' }}>
            <Plus style={{ width: '20px', height: '20px' }} />
          </button>
          <button onClick={() => map.current?.zoomOut()} style={{ width: '44px', height: '44px', backgroundColor: '#ffffff', border: '1px solid #e7e5e4', borderRadius: '13px', boxShadow: '0 4px 14px rgba(28, 25, 23, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1c1917' }}>
            <Minus style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
      </div>

      {/* 4. Spot Details Bottom Sheet with Agoda & Booking.com Stays Nearby Buttons */}
      {viewingSpot && (
        <div style={{ position: 'fixed', bottom: '20px', left: '16px', right: '16px', maxWidth: '410px', zIndex: 99999, backgroundColor: '#ffffff', borderRadius: '22px', boxShadow: '0 20px 40px -8px rgba(28, 25, 23, 0.22)', border: '1px solid #e7e5e4', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div style={{ flex: 1, paddingRight: '10px' }}>
              <span style={{ display: 'inline-block', backgroundColor: `${getCategoryColor(viewingSpot.category)}18`, color: getCategoryColor(viewingSpot.category), fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', marginBottom: '6px' }}>
                {viewingSpot.category}
              </span>
              <h3 style={{ margin: 0, fontSize: '17.5px', fontWeight: 700, color: '#1c1917' }}>{viewingSpot.name}</h3>
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
                  borderRadius: '10px',
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

              <button onClick={() => toggleMustTry(viewingSpot.id)} disabled={savingBookmark} style={{ border: 'none', background: viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#fef3c7' : '#f5f5f4', borderRadius: '10px', cursor: 'pointer', color: viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#d97706' : '#57534e', padding: '7px', display: 'flex' }} title="Save to Must-Try">
                {viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? <BookmarkCheck style={{ width: '16px', height: '16px' }} /> : <Bookmark style={{ width: '16px', height: '16px' }} />}
              </button>

              <button onClick={() => handleShareSpot(viewingSpot)} style={{ border: 'none', background: '#f5f5f4', borderRadius: '10px', cursor: 'pointer', color: '#57534e', padding: '7px', display: 'flex', alignItems: 'center', gap: '4px' }} title="Share spot">
                <Share2 style={{ width: '16px', height: '16px' }} />
              </button>

              {currentUser && viewingSpot.user_id === currentUser.id && (
                <>
                  <button onClick={() => handleOpenEditModal(viewingSpot)} style={{ border: 'none', background: '#f5f5f4', borderRadius: '10px', cursor: 'pointer', color: '#57534e', padding: '7px', display: 'flex' }} title="Edit Spot">
                    <Pencil style={{ width: '15px', height: '15px' }} />
                  </button>
                  <button onClick={() => handleDeleteSpot(viewingSpot)} disabled={deleting} style={{ border: 'none', background: '#fff1ee', borderRadius: '10px', cursor: 'pointer', color: '#e05a47', padding: '7px', display: 'flex' }} title="Delete Spot">
                    {deleting ? <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} /> : <Trash2 style={{ width: '15px', height: '15px' }} />}
                  </button>
                </>
              )}
              <button onClick={() => { setViewingSpot(null); if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '5px' }}>
                <X style={{ width: '19px', height: '19px' }} />
              </button>
            </div>
          </div>

          {viewingSpot.image_url && <img src={viewingSpot.image_url} alt={viewingSpot.name} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '14px', margin: '8px 0' }} />}
          {viewingSpot.description && <p style={{ margin: '8px 0 12px 0', fontSize: '13px', color: '#44403c', lineHeight: 1.45 }}>{viewingSpot.description}</p>}
          
          {/* Navigation & Neighborhood Accommodation Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <a
              href={`geo:${viewingSpot.latitude},${viewingSpot.longitude}?q=${viewingSpot.latitude},${viewingSpot.longitude}(${encodeURIComponent(viewingSpot.name)})`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', boxSizing: 'border-box', padding: '10px', backgroundColor: '#1c1917', color: '#fafaf9', textDecoration: 'none', borderRadius: '11px', fontSize: '12.5px', fontWeight: 600, boxShadow: '0 2px 6px rgba(28, 25, 23, 0.15)' }}
            >
              <Navigation2 style={{ width: '14px', height: '14px' }} /> Navigate to Spot
            </a>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <a
                href={`https://www.agoda.com/search?city=${encodeURIComponent(viewingSpot.city)}&cid=569683`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '9px 8px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', color: '#44403c', textDecoration: 'none', borderRadius: '11px', fontSize: '11px', fontWeight: 600 }}
              >
                🏨 Agoda Stays Nearby
              </a>
              <a
                href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(viewingSpot.city)}&aid=569683`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '9px 8px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', color: '#44403c', textDecoration: 'none', borderRadius: '11px', fontSize: '11px', fontWeight: 600 }}
              >
                🌐 Booking.com Stays
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 5. Public Curator Profile Modal */}
      {viewingProfile && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100005, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.3)', width: '100%', maxWidth: '380px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px', position: 'relative' }}>
            <button onClick={() => setViewingProfile(null)} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '4px' }}>
              <X style={{ width: '20px', height: '20px' }} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', backgroundColor: '#fff1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05a47', overflow: 'hidden', flexShrink: 0 }}>
                {viewingProfile.avatar_url ? (
                  <img src={viewingProfile.avatar_url} alt={viewingProfile.username || 'Curator'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Compass style={{ width: '26px', height: '26px' }} />
                )}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1c1917' }}>@{viewingProfile.username || 'wanderer'}</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#78716c' }}>Curator on Bywayr</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '14px', padding: '12px', marginBottom: '16px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#1c1917' }}>{viewingProfileSpots.length}</div>
                <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Curated Pins</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0284c7' }}>{new Set(viewingProfileSpots.map((s) => s.city)).size}</div>
                <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Cities</div>
              </div>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 700, color: '#57534e', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Curated Field Notes
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {viewingProfileSpots.length === 0 ? (
                <p style={{ margin: '12px 0', fontSize: '12.5px', color: '#a8a29e', textAlign: 'center' }}>No public pins shared yet.</p>
              ) : (
                viewingProfileSpots.map((s) => (
                  <div
                    key={s.id || s.name}
                    onClick={() => {
                      setViewingProfile(null);
                      flyToSpot(s);
                    }}
                    style={{ padding: '10px 12px', borderRadius: '12px', border: '1px solid #e7e5e4', backgroundColor: '#ffffff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: '#1c1917' }}>{s.name}</h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#78716c' }}>{s.city} · <span style={{ color: getCategoryColor(s.category), fontWeight: 600 }}>{s.category}</span></p>
                    </div>
                    <Navigation2 style={{ width: '14px', height: '14px', color: '#a8a29e' }} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Desktop Universal Share Modal */}
      {shareDialogSpot && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100004, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '22px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.28)', width: '100%', maxWidth: '360px', padding: '22px', position: 'relative' }}>
            <button onClick={() => setShareDialogSpot(null)} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '4px' }}>
              <X style={{ width: '20px', height: '20px' }} />
            </button>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: '#1c1917' }}>Share Spot</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: '#78716c' }}>Send <strong>{shareDialogSpot.name}</strong> to fellow explorers:</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Check out ${shareDialogSpot.name} in ${shareDialogSpot.city} on Bywayr: ${window.location.origin}${window.location.pathname}?spot=${shareDialogSpot.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textDecoration: 'none', color: '#1c1917', fontSize: '11px', fontWeight: 600 }}
              >
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
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
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#0088cc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
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
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800 }}>𝕏</span>
                </div>
                Post
              </a>

              <a
                href={`mailto:?subject=${encodeURIComponent(`Bywayr Spot: ${shareDialogSpot.name}`)}&body=${encodeURIComponent(`Check out this spot in ${shareDialogSpot.city}: ${window.location.origin}${window.location.pathname}?spot=${shareDialogSpot.id}`)}`}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textDecoration: 'none', color: '#1c1917', fontSize: '11px', fontWeight: 600 }}
              >
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#ea4335', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                  <Mail style={{ width: '20px', height: '20px' }} />
                </div>
                Email
              </a>
            </div>

            <button
              onClick={async () => {
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
                padding: '10px',
                borderRadius: '12px',
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

      {/* 7. Slide-Out Drawer */}
      {isDrawerOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(3px)', zIndex: 100000, display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ width: '100%', maxWidth: '370px', backgroundColor: '#ffffff', height: '100%', boxShadow: '10px 0 35px rgba(28, 25, 23, 0.18)', display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1c1917' }}>{drawerTab === 'fieldNotes' ? 'Field Notes' : 'Must-Try'}</h2>
              <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: '#f5f5f4', borderRadius: '12px', padding: '3px', marginBottom: '16px' }}>
              <button onClick={() => setDrawerTab('fieldNotes')} style={{ border: 'none', padding: '8px 0', borderRadius: '9px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', backgroundColor: drawerTab === 'fieldNotes' ? '#ffffff' : 'transparent', color: drawerTab === 'fieldNotes' ? '#1c1917' : '#78716c', boxShadow: drawerTab === 'fieldNotes' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>Field Notes</button>
              <button onClick={() => { if (!currentUserRef.current) { setIsAuthModalOpen(true); return; } setDrawerTab('mustTry'); }} style={{ border: 'none', padding: '8px 0', borderRadius: '9px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', backgroundColor: drawerTab === 'mustTry' ? '#ffffff' : 'transparent', color: drawerTab === 'mustTry' ? '#1c1917' : '#78716c', boxShadow: drawerTab === 'mustTry' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>Must-Try ({mustTrySpotIds.length})</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {displayedDrawerSpots.map((spot) => {
                const author = spot.user_id ? profilesMap[spot.user_id]?.username : null;
                return (
                  <div key={spot.id || spot.name} style={{ padding: '12px', borderRadius: '13px', border: '1px solid #e7e5e4', display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#ffffff' }}>
                    <div style={{ flex: 1, minWidth: '0' }}>
                      <h4 onClick={() => flyToSpot(spot)} style={{ margin: '0 0 3px 0', fontSize: '14px', fontWeight: 600, color: '#e05a47', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spot.name}</h4>
                      <p style={{ margin: 0, fontSize: '11.5px', color: '#78716c' }}>
                        {spot.city}
                        {author ? (
                          <>
                            {' · '}
                            <span onClick={() => { setIsDrawerOpen(false); handleOpenPublicProfile(spot.user_id!); }} style={{ color: '#e05a47', fontWeight: 600, cursor: 'pointer' }}>
                              @{author}
                            </span>
                          </>
                        ) : ''}
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

      {/* 8. Own Account Profile Modal with Bywayr Plus (Coming Soon) Section */}
      {isProfileModalOpen && currentUser && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100001, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '22px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.28)', width: '100%', maxWidth: '360px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setIsProfileModalOpen(false)} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '4px' }}>
              <X style={{ width: '20px', height: '20px' }} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <label style={{ width: '52px', height: '52px', borderRadius: '16px', backgroundColor: '#f5f5f4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1917', position: 'relative', overflow: 'hidden', cursor: 'pointer', border: '1px solid #e7e5e4', flexShrink: 0 }} title="Click to upload profile photo">
                {uploadingAvatar ? (
                  <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite', color: '#e05a47' }} />
                ) : userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User style={{ width: '24px', height: '24px', color: '#78716c' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', color: '#ffffff' }} onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')} onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}>
                  <Camera style={{ width: '18px', height: '18px' }} />
                </div>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
              </label>

              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1c1917', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {userProfile?.username ? `@${userProfile.username}` : 'Field Journal'}
                  <button onClick={() => { setIsProfileModalOpen(false); setClaimUsername(userProfile?.username || ''); setIsClaimUsernameModalOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', padding: '2px' }} title="Change Username">
                    <Pencil style={{ width: '12px', height: '12px' }} />
                  </button>
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#78716c' }}>{currentUser.email}</p>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '14px', padding: '12px', marginBottom: '14px', textAlign: 'center' }}>
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

            {/* Bywayr Plus (Coming Soon) Section */}
            <div style={{ backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '14px', padding: '12px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1c1917', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Crown style={{ width: '14px', height: '14px', color: '#d97706' }} /> Bywayr Plus
                </span>
                <span style={{ fontSize: '10px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 700, padding: '2px 6px', borderRadius: '6px' }}>
                  COMING SOON
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#78716c', lineHeight: 1.35 }}>
                JSON field note backups and bulk spot imports.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '2px' }}>
                <button
                  onClick={() => alert('Bywayr Plus data export is coming soon!')}
                  style={{ backgroundColor: '#ffffff', border: '1px solid #d6d3d1', borderRadius: '9px', padding: '7px', fontSize: '11.5px', fontWeight: 600, color: '#78716c', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                >
                  <Download style={{ width: '13px', height: '13px' }} /> Export JSON
                </button>
                <button
                  onClick={() => alert('Bywayr Plus data import is coming soon!')}
                  style={{ backgroundColor: '#ffffff', border: '1px solid #d6d3d1', borderRadius: '9px', padding: '7px', fontSize: '11.5px', fontWeight: 600, color: '#78716c', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                >
                  <Upload style={{ width: '13px', height: '13px' }} /> Import JSON
                </button>
              </div>
            </div>

            <div onClick={() => setOnlyMySpots(!onlyMySpots)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', backgroundColor: onlyMySpots ? '#fff1ee' : '#ffffff', border: onlyMySpots ? '1px solid #fecdd3' : '1px solid #e7e5e4', borderRadius: '12px', cursor: 'pointer', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin style={{ width: '16px', height: '16px', color: onlyMySpots ? '#e05a47' : '#78716c' }} />
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: onlyMySpots ? '#e05a47' : '#44403c' }}>Filter map to my pins only</span>
              </div>
              {onlyMySpots ? <CheckSquare style={{ width: '16px', height: '16px', color: '#e05a47' }} /> : <Square style={{ width: '16px', height: '16px', color: '#a8a29e' }} />}
            </div>

            <button onClick={handleSignOut} style={{ width: '100%', backgroundColor: '#fff1ee', color: '#e05a47', fontWeight: 600, fontSize: '12.5px', padding: '10px', borderRadius: '11px', border: '1px solid #fed7aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <LogOut style={{ width: '14px', height: '14px' }} /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* 9. Claim Username Modal */}
      {isClaimUsernameModalOpen && currentUser && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.5)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100002, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '22px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.3)', width: '100%', maxWidth: '360px', padding: '24px', position: 'relative' }}>
            <div style={{ width: '46px', height: '46px', backgroundColor: '#fff1ee', borderRadius: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: '#e05a47' }}>
              <AtSign style={{ width: '24px', height: '24px' }} />
            </div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#1c1917', textAlign: 'center' }}>Choose Your Handle</h3>
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
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '13.5px', padding: '10px 12px 10px 28px', borderRadius: '11px', border: claimUsernameError ? '1px solid #e05a47' : '1px solid #d6d3d1', outline: 'none' }}
                  />
                </div>
                {claimUsernameError && <span style={{ color: '#e05a47', fontSize: '11px', marginTop: '4px', display: 'block' }}>{claimUsernameError}</span>}
              </div>

              <button type="submit" disabled={isSavingUsername || claimUsername.length < 3} style={{ width: '100%', backgroundColor: '#1c1917', color: '#fafaf9', fontWeight: 600, fontSize: '12.5px', padding: '11px', borderRadius: '11px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                {isSavingUsername ? <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} /> : 'Set Username'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 10. Auth Modal */}
      {isAuthModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100001, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '22px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.3)', width: '100%', maxWidth: '360px', padding: '24px', position: 'relative', textAlign: 'center' }}>
            <button onClick={() => setIsAuthModalOpen(false)} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '4px' }}>
              <X style={{ width: '20px', height: '20px' }} />
            </button>
            <div style={{ width: '46px', height: '46px', backgroundColor: '#fff1ee', borderRadius: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
              <img src="/icon.svg" alt="Bywayr" style={{ width: '28px', height: '28px' }} />
            </div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#1c1917' }}>Join Bywayr</h3>
            <p style={{ margin: '0 0 18px 0', fontSize: '12.5px', color: '#78716c' }}>Sign in to curate, pin, and protect your favorite local spots.</p>
            
            <button onClick={handleGoogleSignIn} style={{ width: '100%', backgroundColor: '#ffffff', border: '1px solid #d6d3d1', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', fontSize: '13px', fontWeight: 600, color: '#1c1917', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', marginBottom: '14px' }}>
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
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '13px', padding: '14px', textAlign: 'center' }}>
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
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '10px 12px', borderRadius: '11px', border: authUsernameError ? '1px solid #e05a47' : '1px solid #d6d3d1', outline: 'none' }}
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
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '10px 12px', borderRadius: '11px', border: '1px solid #d6d3d1', outline: 'none' }}
                  />
                </div>

                <button type="submit" disabled={isSendingMagicLink} style={{ width: '100%', backgroundColor: '#1c1917', color: '#fafaf9', fontWeight: 600, fontSize: '12.5px', padding: '11px', borderRadius: '11px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                  {isSendingMagicLink ? <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} /> : <><Mail style={{ width: '14px', height: '14px' }} /> Send Magic Link</>}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 11. Add / Edit Spot Modal Form */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '22px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.3)', width: '100%', maxWidth: '380px', padding: '22px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={handleCloseModal} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#a8a29e', padding: '4px' }}>
              <X style={{ width: '20px', height: '20px' }} />
            </button>
            <h2 style={{ margin: '0 0 14px 0', fontWeight: 700, fontSize: '17px', color: '#1c1917', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <MapPin style={{ width: '19px', height: '19px', color: '#e05a47' }} />
              {isEditing ? 'Edit Spot' : 'Add to Bywayr'}
            </h2>
            <form onSubmit={handleSaveSpot} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>Photo (Optional)</label>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '90px', border: '2px dashed #d6d3d1', borderRadius: '12px', cursor: 'pointer', backgroundColor: imagePreview ? 'transparent' : '#fafaf9', position: 'relative', overflow: 'hidden' }}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#78716c' }}>
                      <Camera style={{ width: '20px', height: '20px', color: '#a8a29e' }} />
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
                    borderRadius: '11px',
                    padding: '8px 12px',
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
                <input required autoFocus type="text" placeholder="e.g. Hidden Rooftop Cafe" value={newSpot.name} onChange={(e) => setNewSpot({ ...newSpot, name: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '9px 12px', borderRadius: '11px', border: '1px solid #d6d3d1' }} />
              </div>
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>Latitude</label>
                    <input required type="number" step="any" value={newSpot.latitude} onChange={(e) => setNewSpot({ ...newSpot, latitude: parseFloat(e.target.value) })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '9px 12px', borderRadius: '11px', border: '1px solid #d6d3d1' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>Longitude</label>
                    <input required type="number" step="any" value={newSpot.longitude} onChange={(e) => setNewSpot({ ...newSpot, longitude: parseFloat(e.target.value) })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '9px 12px', borderRadius: '11px', border: '1px solid #d6d3d1' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>Category</label>
                  <select value={newSpot.category} onChange={(e) => setNewSpot({ ...newSpot, category: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '9px 12px', borderRadius: '11px', border: '1px solid #d6d3d1', backgroundColor: '#fff' }}>
                    {CATEGORIES.filter(c => c.label !== 'All').map(cat => (
                      <option key={cat.label} value={cat.label}>
                        {cat.label} — {cat.desc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>City</label>
                  <input type="text" value={newSpot.city} onChange={(e) => setNewSpot({ ...newSpot, city: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '9px 12px', borderRadius: '11px', border: '1px solid #d6d3d1' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#57534e', display: 'block', marginBottom: '4px' }}>Notes / Description</label>
                <textarea rows={2} placeholder="Atmosphere, tips, menu favorites, best time to visit..." value={newSpot.description} onChange={(e) => setNewSpot({ ...newSpot, description: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '9px 12px', borderRadius: '11px', border: '1px solid #d6d3d1', resize: 'none' }} />
              </div>
              <button type="submit" disabled={saving || uploadingImage} style={{ marginTop: '4px', width: '100%', backgroundColor: '#e05a47', color: '#ffffff', fontWeight: 600, fontSize: '13px', padding: '11px', borderRadius: '11px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(224, 90, 71, 0.25)' }}>
                {saving || uploadingImage ? <Loader2 style={{ width: '16px', height: '16px' }} /> : isEditing ? 'Update Spot' : 'Save Spot'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 12. Concept 1 Field Guide Welcome Modal with Elevated 3D Clay Icon */}
      {showWelcome && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28, 25, 23, 0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100003, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(28, 25, 23, 0.35)', width: '100%', maxWidth: '370px', padding: '28px 22px', position: 'relative', textAlign: 'center', boxSizing: 'border-box' }}>
            
            {/* Elevated 3D Clay Map Pin Badge */}
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', overflow: 'hidden', display: 'flex', margin: '0 auto 16px auto', boxShadow: '0 10px 20px -3px rgba(224, 90, 71, 0.28)' }}>
              <img src="/icon.svg" alt="Bywayr" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 800, color: '#1c1917', letterSpacing: '-0.02em' }}>
              Your Pocket Field Guide
            </h2>
            <p style={{ margin: '0 0 18px 0', fontSize: '12.5px', color: '#78716c', lineHeight: 1.45 }}>
              A quiet map for expats, travelers, and wanderers to curate and share the unmapped local spots guidebooks overlook.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', marginBottom: '22px', backgroundColor: '#fafaf9', padding: '14px 15px', borderRadius: '16px', border: '1px solid #e7e5e4' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ backgroundColor: '#fff1ee', padding: '6px', borderRadius: '8px', color: '#e05a47', flexShrink: 0, display: 'flex', marginTop: '1px' }}>
                  <Gem style={{ width: '14px', height: '14px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1c1917' }}>Curate Unmapped Corners</div>
                  <div style={{ fontSize: '11px', color: '#78716c', lineHeight: 1.35 }}>Plot backstreet food stalls, elevated viewpoints, and undiscovered neighborhood gems.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ backgroundColor: '#ecfdf5', padding: '6px', borderRadius: '8px', color: '#059669', flexShrink: 0, display: 'flex', marginTop: '1px' }}>
                  <ThumbsUp style={{ width: '14px', height: '14px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1c1917' }}>Community Vouches</div>
                  <div style={{ fontSize: '11px', color: '#78716c', lineHeight: 1.35 }}>Discover real places backed by fellow explorers with zero algorithms.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ backgroundColor: '#fef3c7', padding: '6px', borderRadius: '8px', color: '#d97706', flexShrink: 0, display: 'flex', marginTop: '1px' }}>
                  <BookmarkCheck style={{ width: '14px', height: '14px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1c1917' }}>Personal Field Journal</div>
                  <div style={{ fontSize: '11px', color: '#78716c', lineHeight: 1.35 }}>Build your passport across cities and save must-try wandering wishlists.</div>
                </div>
              </div>
            </div>

            <button
              onClick={handleDismissWelcome}
              style={{ width: '100%', backgroundColor: '#1c1917', color: '#fafaf9', fontWeight: 700, fontSize: '13.5px', padding: '12px', borderRadius: '13px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 14px rgba(28, 25, 23, 0.22)' }}
            >
              Open the Field Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}