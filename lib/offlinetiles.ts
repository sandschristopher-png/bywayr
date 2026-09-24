const DB_NAME = 'BywayrOfflineTiles';
const STORE_NAME = 'tiles';

export async function openTileCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function getCachedTile(url: string): Promise<string | null> {
  try {
    const db = await openTileCacheDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(url);
      req.onsuccess = () => {
        if (req.result) {
          const blob = new Blob([req.result]);
          resolve(URL.createObjectURL(blob));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function cacheTile(url: string, blob: Blob): Promise<void> {
  try {
    const db = await openTileCacheDB();
    const arrayBuffer = await blob.arrayBuffer();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(arrayBuffer, url);
  } catch (err) {
    console.warn('Failed to cache tile locally:', err);
  }
}

function lon2tile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat: number, zoom: number): number {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

export interface DownloadProgress {
  total: number;
  completed: number;
  percent: number;
}

export async function downloadAreaTiles(
  bounds: { west: number; south: number; east: number; north: number },
  minZoom = 13,
  maxZoom = 16,
  onProgress?: (progress: DownloadProgress) => void
): Promise<number> {
  const tileUrls: string[] = [];

  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lon2tile(bounds.west, z);
    const xMax = lon2tile(bounds.east, z);
    const yMin = lat2tile(bounds.north, z);
    const yMax = lat2tile(bounds.south, z);

    for (let x = Math.min(xMin, xMax); x <= Math.max(xMin, xMax); x++) {
      for (let y = Math.min(yMin, yMax); y <= Math.max(yMin, yMax); y++) {
        const url = `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png?key=cb1_3fj4_2_ed95527311486a2cc01fd417`;
        tileUrls.push(url);
      }
    }
  }

  const total = tileUrls.length;
  let completed = 0;
  const batchSize = 4;

  for (let i = 0; i < tileUrls.length; i += batchSize) {
    const batch = tileUrls.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (url) => {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const blob = await res.blob();
            await cacheTile(url, blob);
          }
        } catch {
          // Ignore network dropouts per tile
        } finally {
          completed++;
          if (onProgress) {
            onProgress({
              total,
              completed,
              percent: Math.round((completed / total) * 100),
            });
          }
        }
      })
    );
  }

  return completed;
}
