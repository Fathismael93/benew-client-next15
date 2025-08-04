'use client';

import { useState, useEffect, useRef } from 'react';

const AudioPlayer = () => {
  // États du composant
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3); // Volume par défaut à 30%
  const [isVisible, setIsVisible] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Références
  const audioRef = useRef(null);
  const notificationTimeoutRef = useRef(null);

  // Hook pour détecter la visibilité de la page
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);

      // Si la page devient visible et qu'on a déjà eu une interaction, reprendre l'audio
      if (visible && hasInteracted && audioRef.current) {
        tryPlayAudio();
      }
      // Si la page devient cachée, mettre en pause
      else if (!visible && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [hasInteracted]);

  // Fonction pour tenter de lancer l'audio
  const tryPlayAudio = async () => {
    if (!audioRef.current) return;

    try {
      await audioRef.current.play();
      setIsPlaying(true);
      setError(null);
    } catch (error) {
      console.log('Autoplay bloqué:', error.message);
      setIsPlaying(false);

      // Afficher une notification pour inviter l'utilisateur à cliquer
      if (!hasInteracted) {
        setShowNotification(true);

        // Masquer la notification après 5 secondes
        if (notificationTimeoutRef.current) {
          clearTimeout(notificationTimeoutRef.current);
        }
        notificationTimeoutRef.current = setTimeout(() => {
          setShowNotification(false);
        }, 5000);
      }
    }
  };

  // Gestionnaire pour la première interaction utilisateur
  const handleFirstInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      setShowNotification(false);
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }

      // Tenter de lancer l'audio après la première interaction
      if (isVisible) {
        tryPlayAudio();
      }
    }
  };

  // Ajouter l'écouteur de première interaction
  useEffect(() => {
    if (!hasInteracted) {
      const events = ['click', 'touchstart', 'keydown'];

      events.forEach((event) => {
        document.addEventListener(event, handleFirstInteraction, {
          once: true,
        });
      });

      return () => {
        events.forEach((event) => {
          document.removeEventListener(event, handleFirstInteraction);
        });
      };
    }
  }, [hasInteracted]);

  // Initialisation de l'audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Événements audio
    const handleLoadedData = () => {
      setIsLoading(false);
      // Tenter l'autoplay initial
      if (isVisible) {
        tryPlayAudio();
      }
    };

    const handleError = (e) => {
      setError("Impossible de charger l'audio");
      setIsLoading(false);
      console.error('Erreur audio:', e);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      // Recommencer l'audio (loop)
      if (hasInteracted && isVisible) {
        audio.currentTime = 0;
        tryPlayAudio();
      }
    };

    // Ajouter les écouteurs
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    // Configuration de l'audio
    audio.volume = volume;
    audio.preload = 'auto';

    return () => {
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [volume, isVisible, hasInteracted]);

  // Gérer les changements de volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Fonctions de contrôle
  const togglePlay = () => {
    if (!audioRef.current || !hasInteracted) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      tryPlayAudio();
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  // Masquer la notification
  const dismissNotification = () => {
    setShowNotification(false);
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
  };

  // Nettoyage
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  if (error) {
    return null; // Masquer le composant en cas d'erreur
  }

  return (
    <>
      {/* Élément audio caché */}
      <audio
        ref={audioRef}
        preload="auto"
        loop={false} // Géré manuellement pour plus de contrôle
      >
        <source src="/ce-soir.mp3" type="audio/mpeg" />
        Votre navigateur ne supporte pas l&apos;audio HTML5.
      </audio>

      {/* Notification d'activation audio */}
      {showNotification && (
        <div
          className="fixed top-4 right-4 bg-black bg-opacity-80 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm cursor-pointer transition-opacity duration-300"
          onClick={dismissNotification}
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">🔊</div>
            <div className="flex-1">
              <p className="text-sm font-medium">Audio disponible</p>
              <p className="text-xs opacity-75">
                Cliquez n&apos;importe où pour activer
              </p>
            </div>
            <button
              onClick={dismissNotification}
              className="flex-shrink-0 text-white hover:text-gray-300 ml-2"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Contrôles audio */}
      <div className="fixed bottom-4 right-4 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg shadow-lg p-3 z-40 min-w-[200px]">
        <div className="flex items-center gap-3">
          {/* Bouton Play/Pause */}
          <button
            onClick={togglePlay}
            disabled={isLoading || !hasInteracted}
            className={`
              flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200
              ${
                isLoading || !hasInteracted
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer shadow-md hover:shadow-lg'
              }
            `}
            aria-label={isPlaying ? 'Mettre en pause' : 'Lire'}
          >
            {isLoading ? (
              <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
            ) : isPlaying ? (
              '⏸'
            ) : (
              '▶'
            )}
          </button>

          {/* Contrôle de volume */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xs text-gray-600 flex-shrink-0">🔊</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              disabled={!hasInteracted}
              className={`
                flex-1 h-2 rounded-lg outline-none transition-all duration-200
                ${
                  !hasInteracted
                    ? 'bg-gray-200 cursor-not-allowed'
                    : 'bg-gray-200 cursor-pointer'
                }
              `}
              style={{
                background: hasInteracted
                  ? `linear-gradient(to right, #f97316 0%, #f97316 ${volume * 100}%, #e5e7eb ${volume * 100}%, #e5e7eb 100%)`
                  : '#e5e7eb',
              }}
            />
            <span className="text-xs text-gray-600 min-w-[30px] text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>

        {/* Indicateur d'état */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>
            {isLoading
              ? 'Chargement...'
              : !hasInteracted
                ? 'En attente...'
                : isPlaying
                  ? 'Lecture en cours'
                  : 'En pause'}
          </span>

          {/* Indicateur de visibilité */}
          <div
            className={`w-2 h-2 rounded-full ${isVisible ? 'bg-green-400' : 'bg-gray-400'}`}
            title={isVisible ? 'Page visible' : 'Page masquée'}
          ></div>
        </div>
      </div>
    </>
  );
};

export default AudioPlayer;
