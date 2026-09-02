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
  Gem,
  Beer,
  Home,
  Laptop,
  Store,
  Trees,
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
  { label: 'Hidden Gem', color: '#8b5cf6', icon: Gem },
  { label: 'Local Eats', color: '#f97316', icon: Utensils },
  { label: 'Nightlife', color: '#ec4899', icon: Beer },
  { label: 'Cafe & Chill', color: '#d97706', icon: Coffee },
  { label: 'Viewpoint', color: '#10b981', icon: Mountain },
  { label: 'Photo Spot', color: '#0284c7', icon: Camera },
  { label: 'Hidden Stay', color: '#6366f1', icon: Home },
  { label: 'Co-Working', color: '#0ea5e9', icon: Laptop },
  { label: 'Night Market', color: '#f43f5e', icon: Store },
  { label: 'Nature & Trail', color: '#14b8a6', icon: Trees },
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

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [mapTheme, setMapTheme] = useState<'light' | 'dark'>('light');
  const [onlyMySpots, setOnlyMySpots] = useState(false);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'fieldNotes' | 'mustTry'>('fieldNotes');
  const [copiedSpotId, setCopiedSpotId] = useState<string | null>(null);
  const [mustTrySpotIds, setMustTrySpotIds] = useState<string[]>([]);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
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
    category: 'Hidden Gem',
    city: 'Manila',
    country: 'Philippines',
    description: '',
    latitude: 14.5995,
    longitude: 120.9842,
    image_url: '',
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem('bywayr_theme') as 'light' | 'dark' | null;
    if (savedTheme) setMapTheme(savedTheme);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      if (session?.user) setIsAuthModalOpen(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
      const { error } = await supabase.from('bookmarks').delete().eq('user_id', currentUser.id).eq('spot_id', spotId);
      if (!error) setMustTrySpotIds((prev) => prev.filter((id) => id !== spotId));
    } else {
      const { error } = await supabase.from('bookmarks').insert([{ user_id: currentUser.id, spot_id: spotId }]);
      if (!error) setMustTrySpotIds((prev) => [...prev, spotId]);
    }
    setSavingBookmark(false);
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
      dropPreviewAndOpenModal(lat, lng, '');
    });

    map.current = initializedMap;

    return () => {
      initializedMap.remove();
      map.current = null;
    };
  }, [currentUser]);

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
      setSearchResults([{ lat: lat.toString(), lon: lon.toString(), display_name: `GPS Coordinates: ${lat}, ${lon}` }]);
      setShowDropdown(true);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
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

  const handleShareSpot = async (spot: Spot) => {
    if (!spot.id) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?spot=${spot.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Bywayr — ${spot.name}`, text: `Check out ${spot.name} in ${spot.city}!`, url: shareUrl });
        return;
      } catch (err) {}
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

    if (previewMarkerRef.current) previewMarkerRef.current.remove();

    const previewPin = new maplibregl.Marker({ color: '#2563eb' }).setLngLat([lon, lat]).addTo(map.current);
    previewMarkerRef.current = previewPin;

    map.current.flyTo({ center: [lon, lat], zoom: 16, essential: true });

    setNewSpot({
      name: defaultName,
      category: 'Hidden Gem',
      city: 'Manila',
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
          user_id: currentUser.id,
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
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} />

      <div style={{ position: 'fixed', top: '16px', left: '16px', right: '16px', maxWidth: '420px', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'sans-serif', pointerEvents: 'auto' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ backgroundColor: '#fef2f2', padding: '7px', borderRadius: '10px', display: 'flex' }}>
              <Compass style={{ color: '#ef4444', width: '18px', height: '18px' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                <h1 style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>Bywayr</h1>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>Found Right Here</span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                {loading ? 'Connecting...' : selectedCategory === 'All' ? `${spots.length} saved spots` : `Showing ${filteredSpots.length} spots (${selectedCategory})`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {currentUser ? (
              <button onClick={() => setIsProfileModalOpen(true)} style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '7px 9px', color: '#475569', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User style={{ width: '13px', height: '13px' }} /> Account
              </button>
            ) : (
              <button onClick={() => { setMagicLinkSent(false); setIsAuthModalOpen(true); }} style={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '10px', padding: '7px 10px', color: '#ffffff', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <LogIn style={{ width: '13px', height: '13px' }} /> Sign In
              </button>
            )}

            <button onClick={() => setIsDrawerOpen(true)} style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '7px 9px', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <List style={{ width: '15px', height: '15px' }} />
            </button>
            <button onClick={() => { if (!currentUser) { setIsAuthModalOpen(true); return; } setViewingSpot(null); setIsEditing(false); setIsModalOpen(true); }} style={{ backgroundColor: '#ef4444', border: 'none', borderRadius: '10px', padding: '7px 11px', color: '#ffffff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Plus style={{ width: '14px', height: '14px' }} /> Add
            </button>
          </div>
        </div>

        <div style={{ position: 'relative', width: '100%' }}>
          <form onSubmit={(e) => e.preventDefault()} style={{ position: 'relative', width: '100%' }}>
            <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', width: '16px', height: '16px' }} />
            <input
              type="text"
              placeholder="Search place or paste GPS coords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#ffffff', padding: '12px 40px 12px 38px', fontSize: '13px', borderRadius: showDropdown ? '14px 14px 0 0' : '14px', border: '1px solid #e2e8f0', boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)', outline: 'none', color: '#0f172a' }}
            />
            {isSearching && <Loader2 style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#ef4444', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />}
          </form>

          {showDropdown && searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#ffffff', borderRadius: '0 0 14px 14px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', maxHeight: '220px', overflowY: 'auto', zIndex: 10000 }}>
              {searchResults.map((item, idx) => (
                <div key={idx} onClick={() => handleSelectSearchResult(item)} style={{ padding: '10px 14px', fontSize: '12px', color: '#334155', cursor: 'pointer', borderBottom: idx < searchResults.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  {item.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.label.toLowerCase();
            return (
              <button
                key={cat.label}
                onClick={() => setSelectedCategory(cat.label)}
                style={{ backgroundColor: isSelected ? cat.color : '#ffffff', color: isSelected ? '#ffffff' : '#475569', border: isSelected ? `1px solid ${cat.color}` : '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isSelected ? '#ffffff' : cat.color }} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' }}>
        <button onClick={toggleMapTheme} style={{ width: '44px', height: '44px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: mapTheme === 'light' ? '#0f172a' : '#d97706' }}>
          {mapTheme === 'light' ? <Moon style={{ width: '19px', height: '19px' }} /> : <Sun style={{ width: '19px', height: '19px' }} />}
        </button>
        <button onClick={handleLocateMe} disabled={isLocating} style={{ width: '44px', height: '44px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0284c7' }}>
          {isLocating ? <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} /> : <Crosshair style={{ width: '20px', height: '20px' }} />}
        </button>
      </div>

      {viewingSpot && (
        <div style={{ position: 'fixed', bottom: '24px', left: '16px', right: '16px', maxWidth: '380px', zIndex: 99999, backgroundColor: '#ffffff', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)', border: '1px solid #e2e8f0', padding: '16px', fontFamily: 'sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ flex: 1, paddingRight: '8px' }}>
              <span style={{ display: 'inline-block', backgroundColor: `${getCategoryColor(viewingSpot.category)}20`, color: getCategoryColor(viewingSpot.category), fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', marginBottom: '6px' }}>
                {viewingSpot.category}
              </span>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>{viewingSpot.name}</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>{viewingSpot.city}</p>
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button onClick={() => toggleMustTry(viewingSpot.id)} disabled={savingBookmark} style={{ border: 'none', background: viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#fef3c7' : '#f1f5f9', borderRadius: '8px', cursor: 'pointer', color: viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? '#d97706' : '#475569', padding: '6px', display: 'flex' }}>
                {viewingSpot.id && mustTrySpotIds.includes(viewingSpot.id) ? <BookmarkCheck style={{ width: '15px', height: '15px' }} /> : <Bookmark style={{ width: '15px', height: '15px' }} />}
              </button>
              <button onClick={() => handleShareSpot(viewingSpot)} style={{ border: 'none', background: copiedSpotId === viewingSpot.id ? '#f0fdf4' : '#f1f5f9', borderRadius: '8px', cursor: 'pointer', color: copiedSpotId === viewingSpot.id ? '#16a34a' : '#475569', padding: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                {copiedSpotId === viewingSpot.id ? <><Check style={{ width: '15px', height: '15px' }} /> Copied</> : <Share2 style={{ width: '15px', height: '15px' }} />}
              </button>
              <button onClick={() => { setViewingSpot(null); if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
          </div>
          {viewingSpot.image_url && <img src={viewingSpot.image_url} alt={viewingSpot.name} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '12px', margin: '8px 0' }} />}
          {viewingSpot.description && <p style={{ margin: '8px 0 12px 0', fontSize: '13px', color: '#334155', lineHeight: 1.4 }}>{viewingSpot.description}</p>}
        </div>
      )}

      {isDrawerOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(3px)', zIndex: 100000, display: 'flex', justifyContent: 'flex-start', fontFamily: 'sans-serif' }}>
          <div style={{ width: '100%', maxWidth: '360px', backgroundColor: '#ffffff', height: '100%', boxShadow: '10px 0 30px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{drawerTab === 'fieldNotes' ? 'Field Notes' : 'Must-Try'}</h2>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '3px', marginBottom: '14px' }}>
              <button onClick={() => setDrawerTab('fieldNotes')} style={{ border: 'none', padding: '7px 0', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', backgroundColor: drawerTab === 'fieldNotes' ? '#ffffff' : 'transparent', color: drawerTab === 'fieldNotes' ? '#0f172a' : '#64748b' }}>Field Notes</button>
              <button onClick={() => { if (!currentUser) { setIsAuthModalOpen(true); return; } setDrawerTab('mustTry'); }} style={{ border: 'none', padding: '7px 0', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', backgroundColor: drawerTab === 'mustTry' ? '#ffffff' : 'transparent', color: drawerTab === 'mustTry' ? '#0f172a' : '#64748b' }}>Must-Try ({mustTrySpotIds.length})</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {displayedDrawerSpots.map((spot) => (
                <div key={spot.id || spot.name} style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#ffffff' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 onClick={() => flyToSpot(spot)} style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: 600, color: '#2563eb', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spot.name}</h4>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{spot.city} · <span style={{ color: getCategoryColor(spot.category), fontWeight: 600 }}>{spot.category}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '16px', fontFamily: 'sans-serif' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', width: '100%', maxWidth: '380px', padding: '22px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={handleCloseModal} style={{ position: 'absolute', top: '18px', right: '18px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
              <X style={{ width: '20px', height: '20px' }} />
            </button>
            <h2 style={{ margin: '0 0 14px 0', fontWeight: 700, fontSize: '17px', color: '#0f172a' }}>{isEditing ? 'Edit Spot' : 'Add to Bywayr'}</h2>
            <form onSubmit={handleSaveSpot} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Spot Name</label>
                <input required type="text" value={newSpot.name} onChange={(e) => setNewSpot({ ...newSpot, name: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }} />
              </div>
              <button type="submit" disabled={saving} style={{ marginTop: '6px', width: '100%', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 600, fontSize: '13px', padding: '11px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>
                {saving ? <Loader2 style={{ width: '16px', height: '16px' }} /> : 'Save Spot'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}