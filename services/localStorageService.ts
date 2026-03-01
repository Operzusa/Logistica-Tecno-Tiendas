import localforage from 'localforage';

// Configure localforage to use IndexedDB primarily, falling back to WebSQL/localStorage
localforage.config({
  name: 'TecnoTiendasLogistics',
  storeName: 'media_cache', // Should be alphanumeric, with underscores.
  description: 'Cache for images and media to save Supabase Egress'
});

class LocalStorageService {
  /**
   * Saves an image blob/base64 to local storage
   * @param url The original Supabase URL (used as the key)
   * @param data The base64 data or Blob
   */
  async saveImage(url: string, data: Blob | string): Promise<void> {
    try {
      await localforage.setItem(url, data);
    } catch (err) {
      console.error('Error saving image to local storage:', err);
    }
  }

  /**
   * Retrieves an image from local storage
   * @param url The original Supabase URL
   * @returns The cached Blob/string, or null if not found
   */
  async getImage(url: string): Promise<Blob | string | null> {
    try {
      return await localforage.getItem<Blob | string>(url);
    } catch (err) {
      console.error('Error getting image from local storage:', err);
      return null;
    }
  }

  /**
   * Fetches an image from a URL, caches it locally, and returns a local Object URL.
   * If it's already cached, it returns the cached version immediately.
   * @param url The Supabase public URL
   * @returns A local blob URL (e.g., blob:http://...)
   */
  async getCachedImageUrl(url: string): Promise<string> {
    if (!url) return '';
    
    // Check if it's already a local blob or data URL
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }

    try {
      // 1. Check cache
      const cachedData = await this.getImage(url);
      
      if (cachedData) {
        // If it's a Blob, create an object URL
        if (cachedData instanceof Blob) {
          return URL.createObjectURL(cachedData);
        }
        // If it's a base64 string, return it directly
        return cachedData as string;
      }

      // 2. If not in cache, fetch it from Supabase
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      
      const blob = await response.blob();
      
      // 3. Save to cache for future use
      await this.saveImage(url, blob);
      
      // 4. Return local URL
      return URL.createObjectURL(blob);
      
    } catch (err) {
      console.error('Error caching image:', err);
      // Fallback to the original URL if anything fails
      return url;
    }
  }

  /**
   * Clears the entire media cache
   */
  async clearCache(): Promise<void> {
    try {
      await localforage.clear();
    } catch (err) {
      console.error('Error clearing cache:', err);
    }
  }
}

export const localStorageService = new LocalStorageService();
