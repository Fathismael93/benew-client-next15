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

// Clés pour le stockage en mémoire (pas localStorage dans artifacts)
const AUDIO_STATE_KEY = 'benew_audio_state';
const AUDIO_INSTANCE_KEY = 'benew_audio_instance';

// Stockage en mémoire global (simule sessionStorage)
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

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const AudioProvider = ({ children }) => {
  // États globaux de l'audio avec restauration depuis le stockage
  const [isPlaying, setIsPlaying] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = memoryStorage.getItem(AUDIO_STATE_KEY);
      return saved ? JSON.parse(saved).isPlaying : false;
    }
    return false;
  });

  const [volume, setVolume] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = memoryStorage.getItem(AUDIO_STATE_KEY);
      return saved ? JSON.parse(saved).volume : 0.3;
    }
    return 0.3;
  });

  const [hasInteracted, setHasInteracted] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = memoryStorage.getItem(AUDIO_STATE_KEY);
      return saved ? JSON.parse(saved).hasInteracted : false;
    }
    return false;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(true);
  const [autoStartEnabled, setAutoStartEnabled] = useState(true);

  // Référence globale à l'élément audio PERSISTANT
  const audioRef = useRef(null);
  const listenersAttached = useRef(false);
  const isInitialized = useRef(false);

  // NOUVEAU: Sauvegarder l'état à chaque changement
  const saveAudioState = useCallback(() => {
    if (typeof window !== 'undefined') {
      const state = {
        isPlaying,
        volume,
        hasInteracted,
        timestamp: Date.now(),
      };
      memoryStorage.setItem(AUDIO_STATE_KEY, JSON.stringify(state));
    }
  }, [isPlaying, volume, hasInteracted]);

  // NOUVEAU: Récupérer l'instance audio globale ou la créer
  const getOrCreateGlobalAudio = useCallback(() => {
    if (typeof window === 'undefined') return null;

    // Vérifier si une instance globale existe déjà
    let globalAudio = window[AUDIO_INSTANCE_KEY];

    if (!globalAudio) {
      // Créer une nouvelle instance globale
      globalAudio = new Audio('/ce-soir.mp3');
      globalAudio.loop = true;
      globalAudio.preload = 'auto';

      // Stocker globalement
      window[AUDIO_INSTANCE_KEY] = globalAudio;

      console.log('✅ Instance audio globale créée');
    } else {
      console.log('♻️ Instance audio globale récupérée');
    }

    return globalAudio;
  }, []);

  // Sauvegarder l'état à chaque changement
  useEffect(() => {
    saveAudioState();
  }, [saveAudioState]);

  // NOUVEAU: Gestion de la visibilité avec persistance
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);

      // La musique continue même si la page n'est pas visible
      // On ne fait rien ici contrairement à avant
      console.log('Page visibility changed:', visible ? 'visible' : 'hidden');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // NOUVEAU: Restauration de l'état audio au montage
  useEffect(() => {
    if (typeof window === 'undefined' || isInitialized.current) return;

    const globalAudio = getOrCreateGlobalAudio();
    if (!globalAudio) return;

    const savedState = memoryStorage.getItem(AUDIO_STATE_KEY);

    if (savedState) {
      const state = JSON.parse(savedState);
      console.log("🔄 Restoration de l'état audio:", state);

      // Restaurer le volume
      globalAudio.volume = state.volume;

      // Si la musique était en cours, la reprendre
      if (state.isPlaying && state.hasInteracted) {
        globalAudio
          .play()
          .then(() => {
            console.log('🎵 Musique reprise après navigation');
            setIsPlaying(true);
          })
          .catch((e) => {
            console.log('Erreur reprise audio:', e);
            setIsPlaying(false);
          });
      }
    }

    isInitialized.current = true;
  }, [getOrCreateGlobalAudio]);

  // NOUVEAU: Détection de première interaction globale (améliorée)
  useEffect(() => {
    if (!autoStartEnabled || hasInteracted || listenersAttached.current) return;

    const handleFirstInteraction = async (event) => {
      // Éviter le déclenchement sur les contrôles audio eux-mêmes
      if (event.target.closest('.audio-modal-content, .music-button')) {
        return;
      }

      console.log('🎯 Première interaction détectée:', event.type);

      const globalAudio = getOrCreateGlobalAudio();
      if (globalAudio && !hasInteracted) {
        try {
          setHasInteracted(true);

          // Auto-démarrage de la musique
          await globalAudio.play();
          setIsPlaying(true);
          setError(null);

          console.log('🚀 Audio démarré automatiquement');
        } catch (error) {
          console.log('Échec auto-start:', error);
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
      console.log("👂 Listeners d'interaction ajoutés");
    };

    // Attendre que l'audio soit prêt
    if (!isLoading) {
      addInteractionListeners();
    }

    return removeInteractionListeners;
  }, [autoStartEnabled, hasInteracted, isLoading, getOrCreateGlobalAudio]);

  // Fonctions de contrôle utilisant l'instance globale
  const play = async () => {
    const globalAudio = getOrCreateGlobalAudio();
    if (!globalAudio) return;

    try {
      await globalAudio.play();
      setIsPlaying(true);
      setError(null);

      if (!hasInteracted) {
        setHasInteracted(true);
      }

      console.log('▶️ Lecture démarrée');
    } catch (error) {
      console.log('Erreur lecture:', error);
      setIsPlaying(false);
    }
  };

  const pause = () => {
    const globalAudio = getOrCreateGlobalAudio();
    if (!globalAudio) return;

    globalAudio.pause();
    setIsPlaying(false);
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
    setVolume(newVolume);
    const globalAudio = getOrCreateGlobalAudio();
    if (globalAudio) {
      globalAudio.volume = newVolume;
    }
  };

  const toggleAutoStart = (enabled) => {
    setAutoStartEnabled(enabled);
  };

  // MODIFIÉ: Initialisation utilisant l'instance globale
  const initializeAudio = (audioElement) => {
    // On utilise l'instance globale au lieu de l'élément local
    const globalAudio = getOrCreateGlobalAudio();

    if (!globalAudio) {
      setError("Impossible d'initialiser l'audio");
      return;
    }

    // Connecter la référence à l'instance globale
    audioRef.current = globalAudio;

    const handleLoadedData = () => {
      setIsLoading(false);
      console.log('📻 Audio globale chargée');
    };

    const handleError = (e) => {
      setError("Impossible de charger l'audio");
      setIsLoading(false);
      console.error('Erreur audio globale:', e);
    };

    // Écouter les événements de l'instance globale
    globalAudio.addEventListener('loadeddata', handleLoadedData);
    globalAudio.addEventListener('error', handleError);
    globalAudio.volume = volume;

    // Si déjà chargé
    if (globalAudio.readyState >= 2) {
      handleLoadedData();
    }

    return () => {
      // NE PAS supprimer les listeners de l'instance globale
      // car elle persiste entre les pages
      console.log('🔄 Nettoyage local (instance globale préservée)');
    };
  };

  // NOUVEAU: Nettoyage au démontage de l'app (optionnel)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Sauvegarder une dernière fois avant fermeture du navigateur
      saveAudioState();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveAudioState]);

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
    toggleAutoStart,
    initializeAudio,
    audioRef,
  };

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
};
