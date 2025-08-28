'use client';

import { useState, useEffect, useRef } from 'react';
import { MdClose, MdVolumeUp } from 'react-icons/md';
import './index.scss';

const AudioPlayer = ({ isOpen, onClose }) => {
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
  const modalRef = useRef(null);
  const volumeSliderRef = useRef(null);

  // Fonction pour mettre à jour le gradient du slider
  const updateVolumeSliderGradient = (volumeValue) => {
    if (volumeSliderRef.current) {
      const percentage = volumeValue * 100;
      // Utilisation des couleurs exactes du système
      const gradient = `linear-gradient(to right, #f6a037 0%, #f6a037 ${percentage}%, rgba(250, 230, 209, 0.3) ${percentage}%, rgba(250, 230, 209, 0.3) 100%)`;
      volumeSliderRef.current.style.background = gradient;
    }
  };

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

  // Fermer la modal avec Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Empêcher le scroll du body
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Focus management pour accessibilité
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

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

  // Initialisation de l'audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Événements audio
    const handleLoadedData = () => {
      setIsLoading(false);
      // Tenter l'autoplay initial seulement si la modal est ouverte
      if (isVisible && isOpen) {
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
      if (hasInteracted && isVisible && isOpen) {
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
  }, [volume, isVisible, hasInteracted, isOpen]);

  // Gérer les changements de volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    // Mettre à jour le gradient du slider quand le volume change
    updateVolumeSliderGradient(volume);
  }, [volume]);

  // Arrêter l'audio quand la modal se ferme
  useEffect(() => {
    if (!isOpen && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isOpen]);

  // Fonctions de contrôle
  const togglePlay = () => {
    if (!audioRef.current) return;

    // Première interaction automatique
    if (!hasInteracted) {
      handleFirstInteraction();
    }

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

    // Mettre à jour le gradient du slider
    updateVolumeSliderGradient(newVolume);
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

  // Ne pas rendre si erreur ou modal fermée
  if (error || !isOpen) {
    return null;
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

      {/* Overlay de la modal */}
      <div className="audio-modal-overlay" onClick={onClose}>
        {/* Contenu de la modal */}
        <div
          ref={modalRef}
          className="audio-modal-content"
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
          role="dialog"
          aria-labelledby="audio-modal-title"
          aria-describedby="audio-modal-description"
        >
          {/* Header de la modal */}
          <div className="audio-modal-header">
            <div className="audio-modal-title-section">
              <MdVolumeUp className="audio-modal-icon" />
              <h3 id="audio-modal-title" className="audio-modal-title">
                Lecteur Audio
              </h3>
            </div>
            <button
              className="audio-modal-close"
              onClick={onClose}
              aria-label="Fermer le lecteur audio"
            >
              <MdClose />
            </button>
          </div>

          {/* Body de la modal */}
          <div className="audio-modal-body">
            {/* Notification d'activation audio */}
            {showNotification && (
              <div className="audio-notification" onClick={dismissNotification}>
                <div className="audio-notification-content">
                  <div className="audio-notification-icon">🔊</div>
                  <div className="audio-notification-text">
                    <p className="audio-notification-title">Audio disponible</p>
                    <p className="audio-notification-subtitle">
                      Cliquez sur lecture pour activer
                    </p>
                  </div>
                  <button
                    onClick={dismissNotification}
                    className="audio-notification-dismiss"
                    aria-label="Fermer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Informations sur la piste */}
            <div className="audio-track-info">
              <div className="audio-track-title">Ce Soir</div>
              <div className="audio-track-artist">Piste Audio</div>
            </div>

            {/* Contrôles principaux */}
            <div className="audio-controls">
              {/* Bouton Play/Pause */}
              <button
                onClick={togglePlay}
                disabled={isLoading}
                className={`audio-play-button ${isLoading ? 'loading' : ''} ${
                  isPlaying ? 'playing' : 'paused'
                }`}
                aria-label={isPlaying ? 'Mettre en pause' : 'Lire'}
              >
                {isLoading ? (
                  <div className="audio-loading-spinner"></div>
                ) : isPlaying ? (
                  '⏸'
                ) : (
                  '▶'
                )}
              </button>

              {/* Contrôle de volume */}
              <div className="audio-volume-control">
                <span className="audio-volume-icon">🔊</span>
                <input
                  ref={volumeSliderRef}
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  disabled={!hasInteracted && !isLoading}
                  className="audio-volume-slider"
                  aria-label="Contrôle du volume"
                />
                <span className="audio-volume-value">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>

            {/* Indicateurs d'état */}
            <div className="audio-status">
              <div className="audio-status-text">
                {isLoading
                  ? 'Chargement...'
                  : !hasInteracted
                    ? 'Cliquez sur lecture pour commencer'
                    : isPlaying
                      ? 'Lecture en cours'
                      : 'En pause'}
              </div>

              {/* Indicateurs visuels */}
              <div className="audio-indicators">
                <div
                  className={`audio-indicator ${isVisible ? 'active' : 'inactive'}`}
                  title={isVisible ? 'Page visible' : 'Page masquée'}
                  aria-label={isVisible ? 'Page visible' : 'Page masquée'}
                ></div>
                <div
                  className={`audio-indicator ${hasInteracted ? 'active' : 'inactive'}`}
                  title={hasInteracted ? 'Audio activé' : 'Audio en attente'}
                  aria-label={
                    hasInteracted ? 'Audio activé' : 'Audio en attente'
                  }
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AudioPlayer;
