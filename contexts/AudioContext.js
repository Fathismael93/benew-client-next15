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
  const [autoStartEnabled, setAutoStartEnabled] = useState(true); // NOUVEAU

  // Référence globale à l'élément audio
  const audioRef = useRef(null);
  const listenersAttached = useRef(false); // NOUVEAU

  // NOUVEAU : Détection de première interaction globale
  useEffect(() => {
    if (!autoStartEnabled || hasInteracted || listenersAttached.current) return;

    const handleFirstInteraction = async (event) => {
      // Éviter le déclenchement sur les contrôles audio eux-mêmes
      if (event.target.closest('.audio-modal-content, .music-button')) {
        return;
      }

      console.log('Première interaction détectée:', event.type);

      if (audioRef.current && !hasInteracted) {
        try {
          setHasInteracted(true);

          // Auto-démarrage de la musique
          await audioRef.current.play();
          setIsPlaying(true);
          setError(null);

          console.log('Audio démarré automatiquement');
        } catch (error) {
          console.log('Auto-start failed:', error);
          // En cas d'échec, on laisse l'utilisateur contrôler manuellement
        }
      }

      // Retirer les listeners après la première interaction
      removeInteractionListeners();
    };

    const removeInteractionListeners = () => {
      const events = ['click', 'touchstart', 'keydown'];
      events.forEach((eventType) => {
        document.removeEventListener(eventType, handleFirstInteraction, true);
      });
      listenersAttached.current = false;
    };

    // Ajouter les listeners d'interaction
    const addInteractionListeners = () => {
      if (listenersAttached.current) return;

      const events = ['click', 'touchstart', 'keydown'];
      events.forEach((eventType) => {
        document.addEventListener(eventType, handleFirstInteraction, true);
      });
      listenersAttached.current = true;
    };

    // Attendre que l'audio soit prêt avant d'ajouter les listeners
    if (audioRef.current && !isLoading) {
      addInteractionListeners();
    }

    return removeInteractionListeners;
  }, [autoStartEnabled, hasInteracted, isLoading]);

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

  // NOUVEAU : Permettre de désactiver/activer l'auto-start
  const toggleAutoStart = (enabled) => {
    setAutoStartEnabled(enabled);
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
    autoStartEnabled, // NOUVEAU

    // Fonctions
    play,
    pause,
    togglePlay,
    setVolume: setAudioVolume,
    toggleAutoStart, // NOUVEAU
    initializeAudio,
    audioRef,
  };

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
};
