'use client';

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';

const AudioContext = createContext();

// Clé pour le stockage global
const AUDIO_INSTANCE_KEY = 'benew_audio_instance';

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const AudioProvider = ({ children }) => {
  // ⭐ RÉCUPÉRATION DE L'ÉTAT DEPUIS L'INSTANCE GLOBALE
  const getInitialState = () => {
    if (typeof window !== 'undefined' && window[AUDIO_INSTANCE_KEY]?._state) {
      console.log(
        '🔄 État audio récupéré depuis instance globale:',
        window[AUDIO_INSTANCE_KEY]._state,
      );
      return window[AUDIO_INSTANCE_KEY]._state;
    }

    // État par défaut si première fois
    return {
      isPlaying: false,
      volume: 0.3,
      hasInteracted: false,
      isVisible: true,
      initialized: false,
    };
  };

  const initialState = getInitialState();

  // États React initialisés avec les valeurs persistantes
  const [isPlaying, setIsPlayingLocal] = useState(initialState.isPlaying);
  const [volume, setVolumeLocal] = useState(initialState.volume);
  const [hasInteracted, setHasInteractedLocal] = useState(
    initialState.hasInteracted,
  );
  const [isVisible, setIsVisibleLocal] = useState(initialState.isVisible);
  const [isLoading, setIsLoading] = useState(!initialState.initialized);
  const [error, setError] = useState(null);
  const [autoStartEnabled, setAutoStartEnabled] = useState(true);

  const audioRef = useRef(null);
  const listenersAttached = useRef(false);

  // ⭐ FONCTION POUR SYNCHRONISER L'ÉTAT
  const syncState = useCallback((updates) => {
    const audio = window[AUDIO_INSTANCE_KEY];
    if (!audio) return;

    // Mettre à jour l'état sur l'instance audio
    if (!audio._state) {
      audio._state = {};
    }

    Object.assign(audio._state, updates);

    // Mettre à jour les états React locaux
    if (updates.isPlaying !== undefined) setIsPlayingLocal(updates.isPlaying);
    if (updates.volume !== undefined) setVolumeLocal(updates.volume);
    if (updates.hasInteracted !== undefined)
      setHasInteractedLocal(updates.hasInteracted);
    if (updates.isVisible !== undefined) setIsVisibleLocal(updates.isVisible);

    console.log('🔄 État synchronisé:', audio._state);
  }, []);

  // ⭐ RÉCUPÉRATION OU CRÉATION DE L'INSTANCE AUDIO GLOBALE
  const getOrCreateGlobalAudio = useCallback(() => {
    if (typeof window === 'undefined') return null;

    let globalAudio = window[AUDIO_INSTANCE_KEY];

    if (!globalAudio) {
      // Première création de l'instance
      globalAudio = new Audio('/ce-soir.mp3');
      globalAudio.loop = true;
      globalAudio.preload = 'auto';
      globalAudio.volume = 0.3;

      // Initialiser l'état sur l'instance
      globalAudio._state = {
        isPlaying: false,
        volume: 0.3,
        hasInteracted: false,
        isVisible: true,
        initialized: false,
      };

      // Stocker globalement
      window[AUDIO_INSTANCE_KEY] = globalAudio;

      console.log('🎵 Instance audio globale créée');
    } else {
      // Instance existante récupérée
      console.log('🔄 Instance audio globale récupérée - État:', {
        paused: globalAudio.paused,
        volume: globalAudio.volume,
        currentTime: globalAudio.currentTime,
        state: globalAudio._state,
      });

      // ⭐ CRITIQUE : Synchroniser l'état React avec l'état réel de l'audio
      if (globalAudio._state?.initialized) {
        // Si déjà initialisé, synchroniser avec l'état actuel de lecture
        const actuallyPlaying = !globalAudio.paused;
        if (actuallyPlaying !== globalAudio._state.isPlaying) {
          globalAudio._state.isPlaying = actuallyPlaying;
        }
      }
    }

    return globalAudio;
  }, []);

  // ⭐ INITIALISATION (Une seule fois ou restauration)
  const initializeAudio = useCallback(() => {
    const globalAudio = getOrCreateGlobalAudio();
    if (!globalAudio) {
      setError("Impossible d'initialiser l'audio");
      return () => {};
    }

    audioRef.current = globalAudio;

    // ⭐ Si déjà initialisé, juste synchroniser l'état
    if (globalAudio._state?.initialized) {
      console.log('✅ Audio déjà initialisée, synchronisation...');

      // Synchroniser tous les états React avec l'instance
      setIsPlayingLocal(!globalAudio.paused);
      setVolumeLocal(globalAudio.volume);
      setHasInteractedLocal(globalAudio._state.hasInteracted);
      setIsVisibleLocal(globalAudio._state.isVisible);
      setIsLoading(false);

      return () => {};
    }

    // ⭐ PREMIÈRE INITIALISATION
    console.log('🚀 Première initialisation audio');

    const handleLoadedData = () => {
      setIsLoading(false);
      globalAudio._state.initialized = true;
      console.log('📻 Audio globale prête');
    };

    const handleError = (e) => {
      setError("Impossible de charger l'audio");
      setIsLoading(false);
      console.error('Erreur audio:', e);
    };

    const handlePlay = () => {
      syncState({ isPlaying: true });
    };

    const handlePause = () => {
      syncState({ isPlaying: false });
    };

    // Attacher les événements une seule fois
    if (!globalAudio._eventsAttached) {
      globalAudio.addEventListener('loadeddata', handleLoadedData);
      globalAudio.addEventListener('error', handleError);
      globalAudio.addEventListener('play', handlePlay);
      globalAudio.addEventListener('pause', handlePause);
      globalAudio._eventsAttached = true;

      console.log('📎 Événements audio attachés');
    }

    if (globalAudio.readyState >= 2) {
      handleLoadedData();
    }

    return () => {
      console.log('🧹 Nettoyage contexte local (instance préservée)');
    };
  }, [getOrCreateGlobalAudio, syncState]);

  // Initialisation au montage
  useEffect(() => {
    return initializeAudio();
  }, [initializeAudio]);

  // Gestion de la visibilité
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      syncState({ isVisible: visible });
      console.log('👁️ Visibilité:', visible ? 'visible' : 'masquée');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [syncState]);

  // ⭐ DÉTECTION DE PREMIÈRE INTERACTION (seulement si pas déjà interagi)
  useEffect(() => {
    // Si déjà interagi (changement de page), ne pas réinstaller les listeners
    if (!autoStartEnabled || hasInteracted || listenersAttached.current) {
      console.log('🚫 Listeners non installés:', {
        autoStartEnabled,
        hasInteracted,
        listenersAttached: listenersAttached.current,
      });
      return;
    }

    const handleFirstInteraction = async (event) => {
      // Ignorer les clics sur le lecteur audio
      if (event.target.closest('.audio-modal-content, .music-button')) {
        return;
      }

      console.log('🎯 Première interaction détectée:', event.type);

      const globalAudio = getOrCreateGlobalAudio();
      if (globalAudio && !globalAudio._state?.hasInteracted) {
        try {
          await globalAudio.play();
          syncState({
            hasInteracted: true,
            isPlaying: true,
          });
          setError(null);
          console.log('🚀 Audio démarré automatiquement');
        } catch (error) {
          console.log('Échec auto-start:', error);
          syncState({ hasInteracted: true });
        }
      }

      removeInteractionListeners();
    };

    const removeInteractionListeners = () => {
      const events = ['click', 'touchstart', 'keydown'];
      events.forEach((eventType) => {
        document.removeEventListener(eventType, handleFirstInteraction, true);
      });
      listenersAttached.current = false;
    };

    const addInteractionListeners = () => {
      if (listenersAttached.current) return;

      const events = ['click', 'touchstart', 'keydown'];
      events.forEach((eventType) => {
        document.addEventListener(eventType, handleFirstInteraction, true);
      });
      listenersAttached.current = true;
      console.log("👂 Listeners d'interaction ajoutés");
    };

    if (!isLoading) {
      addInteractionListeners();
    }

    return removeInteractionListeners;
  }, [
    autoStartEnabled,
    hasInteracted,
    isLoading,
    getOrCreateGlobalAudio,
    syncState,
  ]);

  // ⭐ FONCTIONS DE CONTRÔLE
  const play = async () => {
    const globalAudio = getOrCreateGlobalAudio();
    if (!globalAudio) return;

    try {
      await globalAudio.play();
      syncState({
        isPlaying: true,
        hasInteracted: true,
      });
      setError(null);
      console.log('▶️ Lecture démarrée');
    } catch (error) {
      console.log('Erreur lecture:', error);
      syncState({ isPlaying: false });
    }
  };

  const pause = () => {
    const globalAudio = getOrCreateGlobalAudio();
    if (!globalAudio) return;

    globalAudio.pause();
    syncState({ isPlaying: false });
    console.log('⏸️ Lecture mise en pause');
  };

  const togglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const setAudioVolume = (newVolume) => {
    const globalAudio = getOrCreateGlobalAudio();
    if (globalAudio) {
      globalAudio.volume = newVolume;
    }
    syncState({ volume: newVolume });
  };

  const value = {
    // États
    isPlaying,
    volume,
    hasInteracted,
    isLoading,
    error,
    isVisible,
    autoStartEnabled,

    // Fonctions
    play,
    pause,
    togglePlay,
    setVolume: setAudioVolume,
    toggleAutoStart: setAutoStartEnabled,
    initializeAudio,
    audioRef,
  };

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
};
