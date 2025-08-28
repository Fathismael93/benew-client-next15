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

// Clés pour le stockage global
const AUDIO_INSTANCE_KEY = 'benew_audio_instance';
const AUDIO_STATE_KEY = 'benew_audio_state';

// Stockage en mémoire global
const memoryStorage = {
  data: {},
  setItem(key, value) {
    this.data[key] = value;
  },
  getItem(key) {
    return this.data[key];
  },
  removeItem(key) {
    delete this.data[key];
  },
};

// ⭐ NOUVELLE APPROCHE : États globaux persistants
const globalAudioState = {
  isPlaying: false,
  volume: 0.3,
  hasInteracted: false,
  isVisible: true,
  listeners: new Set(), // Pour notifier les composants
};

// Fonction pour notifier tous les listeners des changements d'état
const notifyStateChange = () => {
  globalAudioState.listeners.forEach((callback) => callback(globalAudioState));
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const AudioProvider = ({ children }) => {
  // ⭐ CRITIQUE : États synchronisés avec l'état global
  const [isPlaying, setIsPlayingLocal] = useState(globalAudioState.isPlaying);
  const [volume, setVolumeLocal] = useState(globalAudioState.volume);
  const [hasInteracted, setHasInteractedLocal] = useState(
    globalAudioState.hasInteracted,
  );
  const [isVisible, setIsVisibleLocal] = useState(globalAudioState.isVisible);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoStartEnabled, setAutoStartEnabled] = useState(true);

  const audioRef = useRef(null);
  const listenersAttached = useRef(false);
  const isInitialized = useRef(false);
  const stateListenerRef = useRef(null);

  // ⭐ SYNCHRONISATION AVEC L'ÉTAT GLOBAL
  useEffect(() => {
    // Créer un listener pour les changements d'état global
    const stateListener = (newState) => {
      setIsPlayingLocal(newState.isPlaying);
      setVolumeLocal(newState.volume);
      setHasInteractedLocal(newState.hasInteracted);
      setIsVisibleLocal(newState.isVisible);
    };

    // Ajouter le listener à la liste globale
    globalAudioState.listeners.add(stateListener);
    stateListenerRef.current = stateListener;

    // Synchroniser avec l'état actuel
    stateListener(globalAudioState);

    return () => {
      // Nettoyer le listener au démontage
      if (stateListenerRef.current) {
        globalAudioState.listeners.delete(stateListenerRef.current);
      }
    };
  }, []);

  // Fonctions pour mettre à jour l'état global
  const updateGlobalState = useCallback((updates) => {
    Object.assign(globalAudioState, updates);
    notifyStateChange();

    // Sauvegarder en mémoire
    memoryStorage.setItem(
      AUDIO_STATE_KEY,
      JSON.stringify({
        isPlaying: globalAudioState.isPlaying,
        volume: globalAudioState.volume,
        hasInteracted: globalAudioState.hasInteracted,
        timestamp: Date.now(),
      }),
    );
  }, []);

  // ⭐ RÉCUPÉRATION DE L'INSTANCE AUDIO GLOBALE
  const getOrCreateGlobalAudio = useCallback(() => {
    if (typeof window === 'undefined') return null;

    let globalAudio = window[AUDIO_INSTANCE_KEY];

    if (!globalAudio) {
      globalAudio = new Audio('/ce-soir.mp3');
      globalAudio.loop = true;
      globalAudio.preload = 'auto';
      globalAudio.volume = globalAudioState.volume;

      // Stocker globalement
      window[AUDIO_INSTANCE_KEY] = globalAudio;

      console.log('🎵 Instance audio globale créée');
    } else {
      console.log('🔄 Instance audio globale récupérée - État:', {
        paused: globalAudio.paused,
        volume: globalAudio.volume,
        currentTime: globalAudio.currentTime,
      });
    }

    return globalAudio;
  }, []);

  // ⭐ INITIALISATION ÉVITANT LA DOUBLE INITIALISATION
  const initializeAudio = useCallback(() => {
    if (isInitialized.current) {
      console.log("🚫 Audio déjà initialisé, récupération de l'état...");
      // Synchroniser avec l'instance existante
      const globalAudio = getOrCreateGlobalAudio();
      if (globalAudio) {
        audioRef.current = globalAudio;
        setIsLoading(false);

        // ⭐ CRITIQUE : Synchroniser les états React avec l'instance globale
        updateGlobalState({
          isPlaying: !globalAudio.paused,
          volume: globalAudio.volume,
        });
      }
      return () => {};
    }

    const globalAudio = getOrCreateGlobalAudio();
    if (!globalAudio) {
      setError("Impossible d'initialiser l'audio");
      return () => {};
    }

    audioRef.current = globalAudio;

    // Restaurer l'état sauvegardé
    const savedState = memoryStorage.getItem(AUDIO_STATE_KEY);
    if (savedState) {
      const state = JSON.parse(savedState);
      console.log('🔄 Restauration état audio:', state);

      globalAudio.volume = state.volume;
      updateGlobalState({
        volume: state.volume,
        hasInteracted: state.hasInteracted,
      });

      // ⭐ CRITIQUE : Reprendre la lecture si elle était active
      if (state.isPlaying && state.hasInteracted && globalAudio.paused) {
        globalAudio
          .play()
          .then(() => {
            console.log('🎵 Musique reprise automatiquement');
            updateGlobalState({ isPlaying: true });
          })
          .catch((e) => {
            console.log('Erreur reprise auto:', e);
            updateGlobalState({ isPlaying: false });
          });
      }
    }

    const handleLoadedData = () => {
      setIsLoading(false);
      console.log('📻 Audio globale prête');
    };

    const handleError = (e) => {
      setError("Impossible de charger l'audio");
      setIsLoading(false);
      console.error('Erreur audio:', e);
    };

    // ⭐ ÉVÉNEMENTS AUDIO GLOBAUX (Une seule fois)
    if (!globalAudio.hasEventListeners) {
      globalAudio.addEventListener('loadeddata', handleLoadedData);
      globalAudio.addEventListener('error', handleError);
      globalAudio.hasEventListeners = true; // Flag pour éviter la duplication
    }

    if (globalAudio.readyState >= 2) {
      handleLoadedData();
    }

    isInitialized.current = true;

    return () => {
      console.log('🧹 Nettoyage local (instance préservée)');
    };
  }, [getOrCreateGlobalAudio, updateGlobalState]);

  // Initialisation au montage
  useEffect(() => {
    return initializeAudio();
  }, [initializeAudio]);

  // Gestion de la visibilité
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      updateGlobalState({ isVisible: visible });
      console.log('👁️ Visibilité:', visible ? 'visible' : 'masquée');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [updateGlobalState]);

  // ⭐ DÉTECTION DE PREMIÈRE INTERACTION (Améliorée)
  useEffect(() => {
    if (!autoStartEnabled || hasInteracted || listenersAttached.current) return;

    const handleFirstInteraction = async (event) => {
      if (event.target.closest('.audio-modal-content, .music-button')) {
        return;
      }

      console.log('🎯 Première interaction détectée:', event.type);

      const globalAudio = getOrCreateGlobalAudio();
      if (globalAudio && !hasInteracted) {
        try {
          await globalAudio.play();
          updateGlobalState({
            hasInteracted: true,
            isPlaying: true,
          });
          setError(null);
          console.log('🚀 Audio démarré automatiquement');
        } catch (error) {
          console.log('Échec auto-start:', error);
          updateGlobalState({ hasInteracted: true }); // Marquer comme interagi quand même
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
    updateGlobalState,
  ]);

  // ⭐ FONCTIONS DE CONTRÔLE UTILISANT L'ÉTAT GLOBAL
  const play = async () => {
    const globalAudio = getOrCreateGlobalAudio();
    if (!globalAudio) return;

    try {
      await globalAudio.play();
      updateGlobalState({
        isPlaying: true,
        hasInteracted: true,
      });
      setError(null);
      console.log('▶️ Lecture démarrée');
    } catch (error) {
      console.log('Erreur lecture:', error);
      updateGlobalState({ isPlaying: false });
    }
  };

  const pause = () => {
    const globalAudio = getOrCreateGlobalAudio();
    if (!globalAudio) return;

    globalAudio.pause();
    updateGlobalState({ isPlaying: false });
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
    updateGlobalState({ volume: newVolume });
  };

  const value = {
    // États (maintenant synchronisés avec l'état global)
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
