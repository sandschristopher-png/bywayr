'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Compass,
  MapPin,
  ArrowLeft,
  Share2,
  Check,
  ExternalLink,
  Loader2,
  Bookmark,
  Gem,
  Utensils,
  Coffee,
  Beer,
  Waves,
  Store,
  Trees,
  Mountain,
  Home as HomeIcon,
  Disc,
  Laptop,
  MoonStar,
  Sparkles,
} from 'lucide-react';

interface Spot {
  id: string;
  name: string;
  description: string;
  category: string;
  city: string;
  country?: string;
  latitude: number;
  longitude: number;
  image_url?: string;
  user_id: string;
  created_at?: string;
}

interface UserProfile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Hidden Gems': '#e05a47',
  'Alley Eats': '#ea580c',
  'Cafe & Chill': '#d97706',
  'Listening & Bars': '#db2777',
  'Secret Coasts': '#0284c7',
  'Street Markets': '#9333ea',
  'Nature & Trails': '#0d9488',
  'Viewpoints': '#059669',
  'Stays & Hideaways': '#4f46e5',
  'Vintage & Vinyl': '#b45309',
  'Work & Focus': '#2563eb',
  'Late Night': '#7c3aed',
};

const getCategoryColor = (cat: string) => CATEGORY_COLORS[cat] || '#e05a47';

export default function CuratorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = typeof params?.username === 'string' ? params.username.toLowerCase() : '';

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!username) return;

    const fetchCuratorData = async () => {
      setLoading(true);
      try {
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .maybeSingle();

        if (profileErr || !profileData) {
          setProfile(null);
          setLoading(false);
          return;
        }

        setProfile(profileData);

        const { data: spotData, error: spotErr } = await supabase
          .from('spots')
          .select('*')
          .eq('user_id', profileData.id)
          .order('id', { ascending: false });

        if (!spotErr && spotData) {
          setSpots(spotData as Spot[]);
        }
      } catch (err) {
        console.error('Failed to load curator profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCuratorData();
  }, [username]);

  const handleCopyProfileLink = async () => {
    if (typeof window === 'undefined') return;
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const uniqueCities = Array.from(new Set(spots.map((s) => s.city?.trim()).filter(Boolean)));
  const filteredSpots = selectedCity === 'All' ? spots : spots.filter((s) => s.city?.trim().toLowerCase() === selectedCity.toLowerCase());

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f5f5f4', fontFamily: "'Inter', sans-serif" }}>
        <Loader2 style={{ width: '28px', height: '28px', animation: 'spin 1s linear infinite', color: '#e05a47' }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f5f5f4', fontFamily: "'Inter', sans-serif", padding: '20px', textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '18px', backgroundColor: '#fff1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05a47', marginBottom: '16px' }}>
          <Compass style={{ width: '28px', height: '28px' }} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1c1917', margin: '0 0 8px 0' }}>Curator Not Found</h2>
        <p style={{ fontSize: '13.5px', color: '#78716c', maxWidth: '320px', margin: '0 0 20px 0' }}>No field notes found for @{username}. The handle might be misspelled or unregistered.</p>
        <button
          onClick={() => router.push('/')}
          style={{ backgroundColor: '#1c1917', color: '#fafaf9', border: 'none', borderRadius: '12px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft style={{ width: '15px', height: '15px' }} /> Return to Map
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f4', fontFamily: "'Inter', sans-serif", color: '#1c1917', paddingBottom: '60px' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'rgba(255, 255, 255, 0.92)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #e7e5e4', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '720px', margin: '0 auto' }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#57534e', padding: '4px' }}
        >
          <ArrowLeft style={{ width: '16px', height: '16px' }} /> Explore Map
        </button>

        <button
          onClick={handleCopyProfileLink}
          style={{
            backgroundColor: copied ? '#ecfdf5' : '#1c1917',
            color: copied ? '#059669' : '#fafaf9',
            border: copied ? '1px solid #a7f3d0' : 'none',
            borderRadius: '10px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          {copied ? <Check style={{ width: '13px', height: '13px' }} /> : <Share2 style={{ width: '13px', height: '13px' }} />}
          {copied ? 'Link Copied!' : 'Share Profile'}
        </button>
      </header>

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid #e7e5e4', boxShadow: '0 10px 25px -5px rgba(28, 25, 23, 0.05)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '20px', backgroundColor: '#fff1ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e05a47', overflow: 'hidden', flexShrink: 0, border: '1px solid #fed7aa' }}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Compass style={{ width: '32px', height: '32px' }} />
              )}
            </div>
            <div>
              <h1 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 800, color: '#1c1917' }}>@{profile.username}</h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#78716c', fontWeight: 500 }}>Field Guide Curator</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '16px', padding: '14px', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#1c1917' }}>{spots.length}</div>
              <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Total Pins</div>
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#0284c7' }}>{uniqueCities.length}</div>
              <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Cities</div>
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669' }}>
                {new Set(spots.map((s) => s.country || 'Philippines')).size}
              </div>
              <div style={{ fontSize: '11px', color: '#78716c', fontWeight: 600 }}>Countries</div>
            </div>
          </div>
        </div>

        {uniqueCities.length > 1 && (
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '16px', scrollbarWidth: 'none' }}>
            <button
              onClick={() => setSelectedCity('All')}
              style={{
                backgroundColor: selectedCity === 'All' ? '#1c1917' : '#ffffff',
                color: selectedCity === 'All' ? '#fafaf9' : '#57534e',
                border: selectedCity === 'All' ? '1px solid #1c1917' : '1px solid #e7e5e4',
                padding: '6px 12px',
                borderRadius: '18px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              All Cities ({spots.length})
            </button>
            {uniqueCities.map((city) => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                style={{
                  backgroundColor: selectedCity.toLowerCase() === city.toLowerCase() ? '#1c1917' : '#ffffff',
                  color: selectedCity.toLowerCase() === city.toLowerCase() ? '#fafaf9' : '#57534e',
                  border: selectedCity.toLowerCase() === city.toLowerCase() ? '1px solid #1c1917' : '1px solid #e7e5e4',
                  padding: '6px 12px',
                  borderRadius: '18px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                📍 {city} ({spots.filter((s) => s.city?.trim().toLowerCase() === city.toLowerCase()).length})
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredSpots.length === 0 ? (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', padding: '30px', textAlign: 'center', border: '1px solid #e7e5e4' }}>
              <p style={{ margin: 0, color: '#a8a29e', fontSize: '13px' }}>No field notes found for this filter.</p>
            </div>
          ) : (
            filteredSpots.map((spot) => (
              <div
                key={spot.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '18px',
                  padding: '16px',
                  border: '1px solid #e7e5e4',
                  boxShadow: '0 4px 12px rgba(28, 25, 23, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        backgroundColor: `${getCategoryColor(spot.category)}18`,
                        color: getCategoryColor(spot.category),
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2.5px 7px',
                        borderRadius: '6px',
                        marginBottom: '4px',
                      }}
                    >
                      {spot.category}
                    </span>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: '16px', fontWeight: 700, color: '#1c1917' }}>{spot.name}</h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#78716c' }}>{spot.city}</p>
                  </div>

                  <button
                    onClick={() => router.push(`/?spot=${spot.id}`)}
                    style={{
                      backgroundColor: '#f5f5f4',
                      color: '#44403c',
                      border: '1px solid #d6d3d1',
                      borderRadius: '10px',
                      padding: '7px 11px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      flexShrink: 0,
                    }}
                  >
                    View on Map <ExternalLink style={{ width: '12px', height: '12px' }} />
                  </button>
                </div>

                {spot.image_url && (
                  <img
                    src={spot.image_url}
                    alt={spot.name}
                    style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '14px' }}
                  />
                )}

                {spot.description && (
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#44403c', lineHeight: 1.45 }}>{spot.description}</p>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}