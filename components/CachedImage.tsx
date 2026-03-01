import React, { useState, useEffect } from 'react';
import { localStorageService } from '../services/localStorageService';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
  onImageLoad?: (url: string) => void;
}

export const CachedImage: React.FC<CachedImageProps> = ({ src, fallbackSrc, onImageLoad, ...props }) => {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      if (!src) return;
      
      setLoading(true);
      setError(false);

      try {
        // Fetch the cached image URL (or download and cache it)
        const cachedUrl = await localStorageService.getCachedImageUrl(src);
        
        if (isMounted) {
          setImgSrc(cachedUrl);
          setLoading(false);
          if (onImageLoad) onImageLoad(cachedUrl);
        }
      } catch (err) {
        console.error('Error loading cached image:', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
          // Fallback to original URL or fallbackSrc
          setImgSrc(fallbackSrc || src);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      // Note: We don't revoke the Object URL here because it might be reused by other components.
      // The browser will clean it up when the document unloads.
    };
  }, [src, fallbackSrc]);

  if (loading) {
    return (
      <div className={`animate-pulse bg-white/10 flex items-center justify-center ${props.className}`}>
        <span className="material-symbols-outlined text-white/30 text-2xl animate-spin">sync</span>
      </div>
    );
  }

  if (error && !fallbackSrc) {
    return (
      <div className={`bg-red-900/20 flex flex-col items-center justify-center border border-red-500/30 ${props.className}`}>
        <span className="material-symbols-outlined text-red-400 mb-1">broken_image</span>
        <span className="text-[10px] text-red-400">Error al cargar</span>
      </div>
    );
  }

  return <img src={imgSrc} {...props} />;
};
