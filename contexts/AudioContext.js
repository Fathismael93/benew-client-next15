'use client';

import { createContext, useContext, useState, useRef, useEffect } from 'react';

const AudioContext = createContext();

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const AudioProvider = ({ children }) => {
  // États globaux de l'audio
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(true);

  // Référence globale à l'élément audio
  const audioRef = useRef(null);

  // Gestion de la visibilité de la page
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);

      if (audioRef.current) {
        if (visible && hasInteracted && isPlaying) {
          audioRef.current.play().catch((e) => console.log('Play error:', e));
        } else if (!visible && !audioRef.current.paused) {
          audioRef.current.pause();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [hasInteracted, isPlaying]);

  // Fonctions de contrôle
  const play = async () => {
    if (!audioRef.current) return;

    try {
      await audioRef.current.play();
      setIsPlaying(true);
      setError(null);

      // Première interaction
      if (!hasInteracted) {
        setHasInteracted(true);
      }
    } catch (error) {
      console.log('Play failed:', error);
      setIsPlaying(false);
    }
  };

  const pause = () => {
    if (!audioRef.current) return;

    audioRef.current.pause();
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const setAudioVolume = (newVolume) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Initialisation de l'audio
  const initializeAudio = (audioElement) => {
    audioRef.current = audioElement;

    const handleLoadedData = () => {
      setIsLoading(false);
    };

    const handleError = (e) => {
      setError("Impossible de charger l'audio");
      setIsLoading(false);
      console.error('Audio error:', e);
    };

    if (audioElement) {
      audioElement.addEventListener('loadeddata', handleLoadedData);
      audioElement.addEventListener('error', handleError);
      audioElement.volume = volume;

      return () => {
        audioElement.removeEventListener('loadeddata', handleLoadedData);
        audioElement.removeEventListener('error', handleError);
      };
    }
  };

  const value = {
    // États
    isPlaying,
    volume,
    hasInteracted,
    isLoading,
    error,
    isVisible,

    // Fonctions
    play,
    pause,
    togglePlay,
    setVolume: setAudioVolume,
    initializeAudio,
    audioRef,
  };

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
};
