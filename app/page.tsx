'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '../lib/supabase';
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
  ChevronRight,
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

const CATEGORIES = [
  { label: 'All', color: '#64748b', icon: Sparkles },
  { label: 'Food', color: '#f97316', icon: Utensils },
  { label: 'Cafe', color: '#d97706', icon: Coffee },
  { label: 'Viewpoint', color: '#10b981', icon: Mountain },
  { label: 'Nightlife', color: '#8b5cf6', icon: Moon },
  { label: 'Chill Spot', color: '#0284c7', icon: Compass },
  { label: 'Photo Spot', color: '#ec4899', icon: Camera },
];

const getCategoryColor = (cat: string) => {
  const match = CATEGORIES.find((c) => c.label.toLowerCase() === cat.toLowerCase());
  return match ? match.color : '#ef4444';
};

const compressImage = async (file: File, maxDimension = 1200, quality = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      return resolve(file);
    }

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

  // User Auth State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Map Theme State
  const [mapTheme, setMapTheme] = useState<'light' | 'dark'>('light');

  // Filter My Spots Only
  const [onlyMySpots, setOnlyMySpots] = useState(false);

  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'fieldNotes' | 'mustTry'>('fieldNotes');
  const [copiedSpotId, setCopiedSpotId] = useState<string | null>(null);

  // Must-Try / Bookmarks State
  const [mustTrySpotIds, setMustTrySpotIds] = useState<string[]>([]);
  const [savingBookmark, setSavingBookmark] = useState(false);

  // Search & Autocomplete State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Spot Detail View State
  const [viewingSpot, setViewingSpot] = useState<Spot | null>(null);

  // Modal (Add / Edit) State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [newSpot, setNewSpot] = useState<Spot>({
    name: '',
    category: 'Food',
    city: 'Pasig',
    country: 'Philippines',
    description: '',
    latitude: 14.57,
    longitude: 121.06,
    image_url: '',
  });

  // Load Saved Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('bywayr_theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setMapTheme(savedTheme);
    }
  }, []);

  // Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      if (session?.user) {
        setIsAuthModalOpen(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
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

    if (error) {
      alert(`Error sending link: ${error.message}`);
    } else {
      setMagicLinkSent(true);
    }
    setIsSendingMagicLink(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMustTrySpotIds([]);
    setOnlyMySpots(false);
    setIsProfileModalOpen(false);
  };

  const fetchSpots = async () => {
    try {
      const { data, error } = await supabase
        .from('spots')
        .select('*')
        .order('id', { ascending: false });

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
      const { data, error } = await supabase
        .from('bookmarks')
        .select('spot_id')
        .eq('user_id', userId);

      if (!error && data) {
        setMustTrySpotIds(data.map((item: any) => item.spot_id));
      }
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
    }
  };

  useEffect(() => {
    fetchSpots();
  }, []);

  useEffect(() => {
    if (currentUser?.id) {
      fetchMustTryBookmarks(currentUser.id);
    } else {
      setMustTrySpotIds([]);
    }
  }, [currentUser]);

  const toggleMustTry = async (spotId?: string) => {
    if (!spotId) return;
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

    setSavingBookmark(true);
    const isBookmarked = mustTrySpotIds.includes(spotId);

    if (isBookmarked) {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('spot_id', spotId);

      if (!error) {
        setMustTrySpotIds((prev) => prev.filter((id) => id !== spotId));
      }
    } else {
      const { error } = await supabase
        .from('bookmarks')
        .insert([{ user_id: currentUser.id, spot_id: spotId }]);

      if (!error) {
        setMustTrySpotIds((prev) => [...prev, spotId]);
      }
    }
    setSavingBookmark(false);
  };

  // Toggle Map Theme
  const toggleMapTheme = () => {
    const nextTheme = mapTheme === 'light' ? 'dark' : 'light';
    setMapTheme(nextTheme);
    localStorage.setItem('bywayr_theme', nextTheme);

    if (!map.current) return;
    if (map.current.getLayer('osm-tiles-light-layer') && map.current.getLayer('osm-tiles-dark-layer')) {
      map.current.setLayoutProperty(
        'osm-tiles-light-layer',
        'visibility',
        nextTheme === 'light' ? 'visible' : 'none'
      );
      map.current.setLayoutProperty(
        'osm-tiles-dark-layer',
        'visibility',
        nextTheme === 'dark' ? 'visible' : 'none'
      );
    }
  };

  // Initialize Map
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
            layout: {
              visibility: savedTheme === 'light' ? 'visible' : 'none',
            },
          },
          {
            id: 'osm-tiles-dark-layer',
            type: 'raster',
            source: 'osm-tiles-dark',
            minzoom: 0,
            maxzoom: 19,
            layout: {
              visibility: savedTheme === 'dark' ? 'visible' : 'none',
            },
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
      dropPreviewAndOpenModal(lat, lng, '');
    });

    map.current = initializedMap;

    return () => {
      initializedMap.remove();
      map.current = null;
    };
  }, [currentUser]);

  // Deep Linking: Open spot from URL query param (?spot=ID)
  useEffect(() => {
    if (!loading && spots.length > 0 && map.current) {
      const urlParams = new URLSearchParams(window.location.search);
      const spotId = urlParams.get('spot');
      if (spotId) {
        const target = spots.find((s) => s.id === spotId);
        if (target && target.latitude && target.longitude) {
          flyToSpot(target);
        }
      }
    }
  }, [loading, spots]);

  // Live Autocomplete Search Handler
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const coordMatch = query.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[3]);
      setSearchResults([
        {
          lat: lat.toString(),
          lon: lon.toString(),
          display_name: `GPS Coordinates: ${lat}, ${lon}`,
        },
      ]);
      setShowDropdown(true);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
        );
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
      map.current.flyTo({
        center: [lon, lat],
        zoom: 16,
        essential: true,
      });
    }
  };

  // Filter spots by category & ownership
  const filteredSpots = spots.filter((spot) => {
    if (onlyMySpots && currentUser && spot.user_id !== currentUser.id) return false;
    if (selectedCategory === 'All') return true;
    return spot.category?.toLowerCase() === selectedCategory.toLowerCase();
  });

  // Render Direct HTML Markers for Each Spot
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    spotMarkersRef.current.forEach((marker) => marker.remove());
    spotMarkersRef.current = [];

    filteredSpots.forEach((spot) => {
      if (!spot.latitude || !spot.longitude) return;

      const isMustTry = spot.id ? mustTrySpotIds.includes(spot.id) : false;
      const color = getCategoryColor(spot.category);

      const el = document.createElement('div');
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = isMustTry ? '3px solid #f59e0b' : '3px solid #ffffff';
      el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
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

  // Locate User GPS
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
          el.style.width = '16px';
          el.style.height = '16px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = '#0284c7';
          el.style.border = '3px solid #ffffff';
          el.style.boxShadow = '0 0 10px rgba(2, 132, 199, 0.6)';

          userLocationMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat([longitude, latitude])
            .addTo(map.current);
        }

        map.current.flyTo({
          center: [longitude, latitude],
          zoom: 16,
          essential: true,
        });

        setIsLocating(false);
      },
      (err) => {
        console.error('Locate error:', err);
        alert('Could not retrieve your location. Please check browser permissions.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleShareSpot = async (spot: Spot) => {
    if (!spot.id) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?spot=${spot.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bywayr — ${spot.name}`,
          text: `Check out ${spot.name} in ${spot.city} on Bywayr!`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }

    await navigator.clipboard.writeText(shareUrl);
    setCopiedSpotId(spot.id);
    setTimeout(() => setCopiedSpotId(null), 2500);
  };

  const dropPreviewAndOpenModal = (lat: number, lon: number, defaultName: string = '') => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!map.current) return;

    setViewingSpot(null);
    setIsEditing(false);

    if (previewMarkerRef.current) {
      previewMarkerRef.current.remove();
    }

    const previewPin = new maplibregl.Marker({ color: '#2563eb' })
      .setLngLat([lon, lat])
      .addTo(map.current);

    previewMarkerRef.current = previewPin;

    map.current.flyTo({
      center: [lon, lat],
      zoom: 16,
      essential: true,
    });

    setNewSpot({
      name: defaultName,
      category: 'Food',
      city: 'Pasig',
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
    if (!spot.id) return;
    if (!confirm(`Are you sure you want to delete "${spot.name}"?`)) return;

    setDeleting(true);
    const { error } = await supabase.from('spots').delete().eq('id', spot.id);

    if (error) {
      alert(`Failed to delete spot: ${error.message}`);
    } else {
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
    if (!currentUser) {
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

      const { error: uploadError } = await supabase.storage
        .from('spot-images')
        .upload(filePath, fileToUpload, {
          contentType: fileToUpload.type,
          upsert: true,
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('spot-images')
          .getPublicUrl(filePath);
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

      if (error) {
        alert(`Supabase Error: ${error.message}`);
      } else if (data && data.length > 0) {
        setSpots((prev) => prev.map((s) => (s.id === newSpot.id ? (data[0] as Spot) : s)));
        setViewingSpot(data[0] as Spot);
        setIsModalOpen(false);
      }
    } else {
      const { data, error } = await supabase
        .from('spots')
        .insert([
          {
            name: newSpot.name,
            category: newSpot.category,
            city: newSpot.city,
            country: newSpot.country || 'Philippines',
            description: newSpot.description,
            latitude: newSpot.latitude,
            longitude: newSpot.longitude,
            image_url: uploadedUrl || null,
            user_id: currentUser.id,
          },
        ])
        .select();

      if (error) {
        alert(`Supabase Error: ${error.message}`);
      } else if (data && data.length > 0) {
        if (previewMarkerRef.current) {
          previewMarkerRef.current.remove();
          previewMarkerRef.current = null;
        }

        setSpots((prev) => [data[0] as Spot, ...prev]);
        setIsModalOpen(false);
        setSearchQuery('');

        if (map.current) {
          map.current.flyTo({
            center: [newSpot.longitude, newSpot.latitude],
            zoom: 16,
          });
        }
      }
    }

    setSaving(false);
  };

  const flyToSpot = (spot: Spot) => {
    if (!map.current || !spot.latitude || !spot.longitude) return;
    map.current.flyTo({
      center: [spot.longitude, spot.latitude],
      zoom: 16,
      essential: true,
    });
    setViewingSpot(spot);
    setIsDrawerOpen(false);

    if (spot.id && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `?spot=${spot.id}`);
    }
  };

  const displayedDrawerSpots =
    drawerTab === 'fieldNotes'
      ? filteredSpots
      : spots.filter((s) => s.id && mustTrySpotIds.includes(s.id));

  // User Stats
  const mySpotsCount = currentUser ? spots.filter((s) => s.user_id === currentUser.id).length : 0;
  const myCitiesCount = currentUser
    ? new Set(spots.filter((s) => s.user_id === currentUser.id).map((s) => s.city.trim())).size
    : 0;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
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
        }}
      />

      {/* 2. Top Header, Search, and Category Filter Bar */}
      <div
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          right: '16px',
          maxWidth: '420px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontFamily: 'sans-serif',
          pointerEvents: 'auto',
        }}
      >
        {/* Brand & Auth Bar */}
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '10px 14px',
            borderRadius: '16px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ backgroundColor: '#fef2f2', padding: '7px', borderRadius: '10px', display: 'flex' }}>
              <Compass style={{ color: '#ef4444', width: '18px', height: '18px' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                <h1 style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#0f172a', letterSpacing: '-0.02em' }}>
                  Bywayr
                </h1>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
                  Found Right Here
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                {loading
                  ? 'Connecting...'
                  : selectedCategory === 'All'
                  ? `${spots.length} saved spots`
                  : `Showing ${filteredSpots.length} of ${spots.length} spots (${selectedCategory})`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {currentUser ? (
              <button
                onClick={() => setIsProfileModalOpen(true)}
                style={{
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '7px 9px',
                  color: '#475569',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="View Profile & Stats"
              >
                <User style={{ width: '13px', height: '13px' }} /> Account
              </button>
            ) : (
              <button
                onClick={() => {
                  setMagicLinkSent(false);
                  setIsAuthModalOpen(true);
                }}
                style={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '7px 10px',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <LogIn style={{ width: '13px', height: '13px' }} /> Sign In
              </button>
            )}

            <button
              onClick={() => setIsDrawerOpen(true)}
              style={{
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '7px 9px',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="View Field Notes & Must-Try"
            >
              <List style={{ width: '15px', height: '15px' }} />
            </button>
            <button
              onClick={() => {
                if (!currentUser) {
                  setIsAuthModalOpen(true);
                  return;
                }
                setViewingSpot(null);
                setIsEditing(false);
                setIsModalOpen(true);
              }}
              style={{
                backgroundColor: '#ef4444',
                border: 'none',
                borderRadius: '10px',
                padding: '7px 11px',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Plus style={{ width: '14px', height: '14px' }} /> Add
            </button>
          </div>
        </div>

        {/* Search Bar with Live Autocomplete */}
        <div style={{ position: 'relative', width: '100%' }}>
          <form onSubmit={(e) => e.preventDefault()} style={{ position: 'relative', width: '100%' }}>
            <Search
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                width: '16px',
                height: '16px',
              }}
            />
            <input
              type="text"
              placeholder="Search place or paste GPS coords (e.g. 14.57, 121.06)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff',
                padding: '12px 40px 12px 38px',
                fontSize: '13px',
                borderRadius: showDropdown ? '14px 14px 0 0' : '14px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
                outline: 'none',
                color: '#0f172a',
              }}
            />
            {isSearching && (
              <Loader2
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#ef4444',
                  width: '16px',
                  height: '16px',
                  animation: 'spin 1s linear infinite',
                }}
              />
            )}
          </form>

          {/* Autocomplete Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: '#ffffff',
                borderRadius: '0 0 14px 14px',
                border: '1px solid #e2e8f0',
                borderTop: 'none',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                maxHeight: '220px',
                overflowY: 'auto',
                zIndex: 10000,
              }}
            >
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectSearchResult(item)}
                  style={{
                    padding: '10px 14px',
                    fontSize: '12px',
                    color: '#334155',
                    cursor: 'pointer',
                    borderBottom: idx < searchResults.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                >
                  {item.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Filter Pills */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'none',
          }}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.label.toLowerCase();
            return (
              <button
                key={cat.label}
                onClick={() => setSelectedCategory(cat.label)}
                style={{
                  backgroundColor: isSelected ? cat.color : '#ffffff',
                  color: isSelected ? '#ffffff' : '#475569',
                  border: isSelected ? `1px solid ${cat.color}` : '1px solid #e2e8f0',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: isSelected ? '#ffffff' : cat.color,
                  }}
                />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Floating Action Controls (Theme, Locate Me & Zoom) */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'auto',
        }}
      >
        <button
          onClick={toggleMapTheme}
          style={{
            width: '44px',
            height: '44px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: mapTheme === 'light' ? '#0f172a' : '#d97706',
          }}
          title={mapTheme === 'light' ? 'Switch to Night Mode' : 'Switch to Day Mode'}
        >
          {mapTheme === 'light' ? (
            <Moon style={{ width: '19px', height: '19px' }} />
          ) : (
            <Sun style={{ width: '19px', height: '19px' }} />
          )}
        </button>

        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          style={{
            width: '44px',
            height: '44px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#0284c7',
          }}
          title="Locate Me"
        >
          {isLocating ? (
            <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
          ) : (
            <Crosshair style={{ width: '20px', height: '20px' }} />
          )}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => map.current?.zoomIn()}
            style={{
              width: '44px',
              height: '44px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#0f172a',
            }}
            title="Zoom In"
          >
            <Plus style={{ width: '20px', height: '20px' }} />
          </button>
          <button
            onClick={() => map.current?.zoomOut()}
            style={{
              width: '44px',
              height: '44px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#0f172a',
            }}
            title="Zoom Out"
          >
            <Minus style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
      </div>

      {/* 4. Spot Details Bottom Sheet with Walking Directions, Must-Try & Share */}
      {viewingSpot && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '16px',
            right: '16px',
            maxWidth: '380px',
            zIndex: 99999,
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            border: '1px solid #e2e8f0',
            padding: '16px',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ flex: 1, paddingRight: '8px' }}>
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: `${getCategoryColor(viewingSpot.category)}20`,
                  color: getCategoryColor(viewingSpot.category),
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  marginBottom: '6px',
                }}
              >
                {viewingSpot.category}
              </span>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>{viewingSpot.name}</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>{viewingSpot.city}</p>
            </div>

            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button
                onClick={() => toggleMustTry(viewingSpot.id)}
                disabled={savingBookmark}
                style={{
                  border: 'none',
                  background: viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#fef3c7' : '#f1f5f9',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#d97706' : '#475569',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? 'Remove from Must-Try' : 'Save to Must-Try'}
              >
                {viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? (
                  <BookmarkCheck style={{ width: '15px', height: '15px' }} />
                ) : (
                  <Bookmark style={{ width: '15px', height: '15px' }} />
                )}
              </button>

              <button
                onClick={() => handleShareSpot(viewingSpot)}
                style={{
                  border: 'none',
                  background: copiedSpotId === viewingSpot.id ? '#f0fdf4' : '#f1f5f9',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: copiedSpotId === viewingSpot.id ? '#16a34a' : '#475569',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
                title="Share Spot"
              >
                {copiedSpotId === viewingSpot.id ? (
                  <>
                    <Check style={{ width: '15px', height: '15px' }} /> Copied
                  </>
                ) : (
                  <Share2 style={{ width: '15px', height: '15px' }} />
                )}
              </button>

              {currentUser && viewingSpot.user_id === currentUser.id && (
                <>
                  <button
                    onClick={() => handleOpenEditModal(viewingSpot)}
                    style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', cursor: 'pointer', color: '#475569', padding: '6px', display: 'flex' }}
                    title="Edit Spot"
                  >
                    <Pencil style={{ width: '15px', height: '15px' }} />
                  </button>
                  <button
                    onClick={() => handleDeleteSpot(viewingSpot)}
                    disabled={deleting}
                    style={{ border: 'none', background: '#fef2f2', borderRadius: '8px', cursor: 'pointer', color: '#ef4444', padding: '6px', display: 'flex' }}
                    title="Delete Spot"
                  >
                    {deleting ? <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} /> : <Trash2 style={{ width: '15px', height: '15px' }} />}
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setViewingSpot(null);
                  if (typeof window !== 'undefined') {
                    window.history.replaceState(null, '', window.location.pathname);
                  }
                }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '4px', marginLeft: '2px' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
          </div>

          {viewingSpot.image_url && (
            <img
              src={viewingSpot.image_url}
              alt={viewingSpot.name}
              style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '12px', margin: '8px 0' }}
            />
          )}

          {viewingSpot.description && (
            <p style={{ margin: '8px 0 12px 0', fontSize: '13px', color: '#334155', lineHeight: 1.4 }}>
              {viewingSpot.description}
            </p>
          )}

          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${viewingSpot.latitude},${viewingSpot.longitude}&travelmode=walking`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            <Navigation2 style={{ width: '14px', height: '14px' }} /> Start Walking Directions
          </a>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${viewingSpot.latitude},${viewingSpot.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '9px',
                borderRadius: '10px',
                fontSize: '11.5px',
                fontWeight: 600,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
              }}
            >
              <Navigation2 style={{ width: '13px', height: '13px' }} /> Google Maps
            </a>
            <a
              href={`https://maps.apple.com/?daddr=${viewingSpot.latitude},${viewingSpot.longitude}&dirflg=w`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                textDecoration: 'none',
                padding: '9px',
                borderRadius: '10px',
                fontSize: '11.5px',
                fontWeight: 600,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
              }}
            >
              <Navigation2 style={{ width: '13px', height: '13px' }} /> Apple Maps
            </a>
          </div>
        </div>
      )}

      {/* 5. Slide-Out List / Field Notes & Must-Try Drawer */}
      {isDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 100000,
            display: 'flex',
            justifyContent: 'flex-start',
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '360px',
              backgroundColor: '#ffffff',
              height: '100%',
              boxShadow: '10px 0 30px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  {drawerTab === 'fieldNotes' ? 'Field Notes' : 'Must-Try'}
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                  {drawerTab === 'fieldNotes' ? 'Latest spots logged on the map' : 'Your personal places to check out'}
                </p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {/* Two Tab Navigation */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                backgroundColor: '#f1f5f9',
                borderRadius: '10px',
                padding: '3px',
                marginBottom: '14px',
              }}
            >
              <button
                onClick={() => setDrawerTab('fieldNotes')}
                style={{
                  border: 'none',
                  padding: '7px 0',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: drawerTab === 'fieldNotes' ? '#ffffff' : 'transparent',
                  color: drawerTab === 'fieldNotes' ? '#0f172a' : '#64748b',
                  boxShadow: drawerTab === 'fieldNotes' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                Field Notes
              </button>
              <button
                onClick={() => {
                  if (!currentUser) {
                    setIsAuthModalOpen(true);
                    return;
                  }
                  setDrawerTab('mustTry');
                }}
                style={{
                  border: 'none',
                  padding: '7px 0',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: drawerTab === 'mustTry' ? '#ffffff' : 'transparent',
                  color: drawerTab === 'mustTry' ? '#0f172a' : '#64748b',
                  boxShadow: drawerTab === 'mustTry' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                Must-Try ({mustTrySpotIds.length})
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {displayedDrawerSpots.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: '40px', padding: '0 16px' }}>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                    {drawerTab === 'fieldNotes'
                      ? 'No spots logged yet. Click the map or search to add one!'
                      : 'No Must-Try spots saved yet. Tap the bookmark icon on any spot to save it here!'}
                  </p>
                </div>
              ) : (
                displayedDrawerSpots.map((spot) => (
                  <div
                    key={spot.id || spot.name}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {spot.image_url ? (
                      <img
                        src={spot.image_url}
                        alt={spot.name}
                        onClick={() => flyToSpot(spot)}
                        style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', cursor: 'pointer' }}
                      />
                    ) : (
                      <div
                        onClick={() => flyToSpot(spot)}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '8px',
                          backgroundColor: `${getCategoryColor(spot.category)}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <MapPin style={{ width: '22px', height: '22px', color: getCategoryColor(spot.category) }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        onClick={() => flyToSpot(spot)}
                        style={{
                          margin: '0 0 2px 0',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: '#2563eb',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title="Click to fly to spot"
                      >
                        {spot.name}
                      </h4>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                        {spot.city} · <span style={{ color: getCategoryColor(spot.category), fontWeight: 600 }}>{spot.category}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => flyToSpot(spot)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                      title="Fly to spot"
                    >
                      <ChevronRight style={{ width: '16px', height: '16px', color: '#94a3b8' }} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. User Profile & Personal Activity Modal */}
      {isProfileModalOpen && currentUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100001,
            padding: '16px',
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              width: '100%',
              maxWidth: '360px',
              padding: '24px',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setIsProfileModalOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '4px',
              }}
            >
              <X style={{ width: '20px', height: '20px' }} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0f172a',
                }}
              >
                <User style={{ width: '22px', height: '22px' }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Field Journal
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                  {currentUser.email}
                </p>
              </div>
            </div>

            {/* User Stats Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '12px',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{mySpotsCount}</div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Pins Placed</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#d97706' }}>{mustTrySpotIds.length}</div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Must-Try</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0284c7' }}>{myCitiesCount}</div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Cities</div>
              </div>
            </div>

            {/* Filter Map to My Spots */}
            <div
              onClick={() => setOnlyMySpots(!onlyMySpots)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: onlyMySpots ? '#eff6ff' : '#ffffff',
                border: onlyMySpots ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                borderRadius: '12px',
                cursor: 'pointer',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin style={{ width: '16px', height: '16px', color: onlyMySpots ? '#2563eb' : '#64748b' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: onlyMySpots ? '#1e40af' : '#334155' }}>
                  Filter map to my pins only
                </span>
              </div>
              {onlyMySpots ? (
                <CheckSquare style={{ width: '16px', height: '16px', color: '#2563eb' }} />
              ) : (
                <Square style={{ width: '16px', height: '16px', color: '#94a3b8' }} />
              )}
            </div>

            <button
              onClick={handleSignOut}
              style={{
                width: '100%',
                backgroundColor: '#fef2f2',
                color: '#ef4444',
                fontWeight: 600,
                fontSize: '12px',
                padding: '10px',
                borderRadius: '10px',
                border: '1px solid #fecaca',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <LogOut style={{ width: '14px', height: '14px' }} /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* 7. Sign In / Auth Modal */}
      {isAuthModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100001,
            padding: '16px',
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              width: '100%',
              maxWidth: '360px',
              padding: '24px',
              position: 'relative',
              textAlign: 'center',
            }}
          >
            <button
              onClick={() => setIsAuthModalOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '4px',
              }}
            >
              <X style={{ width: '20px', height: '20px' }} />
            </button>

            <div style={{ width: '44px', height: '44px', backgroundColor: '#fef2f2', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
              <Compass style={{ color: '#ef4444', width: '24px', height: '24px' }} />
            </div>

            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              Join Bywayr
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#64748b' }}>
              Sign in to curate, pin, and protect your favorite local spots.
            </p>

            <button
              onClick={handleGoogleSignIn}
              style={{
                width: '100%',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#1e293b',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                marginBottom: '16px',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '14px 0' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>OR EMAIL</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
            </div>

            {magicLinkSent ? (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                <CheckCircle2 style={{ color: '#16a34a', width: '24px', height: '24px', margin: '0 auto 6px auto' }} />
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#15803d' }}>Magic Link Sent!</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#166534' }}>
                  Check your inbox for <strong>{authEmail}</strong> to sign in.
                </p>
              </div>
            ) : (
              <form onSubmit={handleMagicLinkSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="email"
                  required
                  placeholder="Enter your email address"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '13px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={isSendingMagicLink}
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '12px',
                    padding: '10px',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  {isSendingMagicLink ? (
                    <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <>
                      <Mail style={{ width: '14px', height: '14px' }} /> Send Magic Link
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 8. Add / Edit Spot Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '16px',
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              width: '100%',
              maxWidth: '380px',
              padding: '22px',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <button
              onClick={handleCloseModal}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '4px',
              }}
            >
              <X style={{ width: '20px', height: '20px' }} />
            </button>

            <h2
              style={{
                margin: '0 0 14px 0',
                fontWeight: 700,
                fontSize: '17px',
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <MapPin style={{ width: '18px', height: '18px', color: '#ef4444' }} />
              {isEditing ? 'Edit Spot' : 'Add to Bywayr'}
            </h2>

            <form onSubmit={handleSaveSpot} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Photo (Optional)
                </label>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '90px',
                    border: '2px dashed #cbd5e1',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    backgroundColor: imagePreview ? 'transparent' : '#f8fafc',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#64748b' }}>
                      <Camera style={{ width: '20px', height: '20px', color: '#94a3b8' }} />
                      <span style={{ fontSize: '11px', fontWeight: 500 }}>Tap to attach photo</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
                </label>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Spot Name
                </label>
                <input
                  required
                  autoFocus
                  type="text"
                  placeholder="e.g. Hidden Rooftop Cafe"
                  value={newSpot.name}
                  onChange={(e) => setNewSpot({ ...newSpot, name: e.target.value })}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '13px',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Latitude
                    </label>
                    <input
                      required
                      type="number"
                      step="any"
                      value={newSpot.latitude}
                      onChange={(e) =>
                        setNewSpot({ ...newSpot, latitude: parseFloat(e.target.value) })
                      }
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        fontSize: '13px',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Longitude
                    </label>
                    <input
                      required
                      type="number"
                      step="any"
                      value={newSpot.longitude}
                      onChange={(e) =>
                        setNewSpot({ ...newSpot, longitude: parseFloat(e.target.value) })
                      }
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        fontSize: '13px',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                      }}
                    />
                  </div>
                </div>
                <p style={{ margin: '5px 0 0 0', fontSize: '10.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                  Tip: Right-click any location in Google Maps to copy & paste exact coordinates.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Category
                  </label>
                  <select
                    value={newSpot.category}
                    onChange={(e) => setNewSpot({ ...newSpot, category: e.target.value })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontSize: '13px',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#fff',
                    }}
                  >
                    <option>Food</option>
                    <option>Cafe</option>
                    <option>Viewpoint</option>
                    <option>Nightlife</option>
                    <option>Chill Spot</option>
                    <option>Photo Spot</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    City
                  </label>
                  <input
                    type="text"
                    value={newSpot.city}
                    onChange={(e) => setNewSpot({ ...newSpot, city: e.target.value })}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontSize: '13px',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Notes / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Atmosphere, tips, recommendations..."
                  value={newSpot.description}
                  onChange={(e) => setNewSpot({ ...newSpot, description: e.target.value })}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '13px',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    resize: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={saving || uploadingImage}
                style={{
                  marginTop: '6px',
                  width: '100%',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '13px',
                  padding: '11px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: saving || uploadingImage ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                }}
              >
                {saving || uploadingImage ? (
                  <Loader2 style={{ width: '16px', height: '16px' }} />
                ) : isEditing ? (
                  'Update Spot'
                ) : (
                  'Save Spot'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}