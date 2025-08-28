'use client';

import { useState, useEffect, useRef } from 'react';
import { MdClose, MdVolumeUp } from 'react-icons/md';
import { useAudio } from '../../../contexts/AudioContext';
import './index.scss';

const AudioPlayer = ({ isOpen, onClose }) => {
  // États locaux pour la modal uniquement
  const [showNotification, setShowNotification] = useState(false);

  // États globaux depuis le context
  const {
    isPlaying,
    volume,
    hasInteracted,
    isLoading,
    error,
    isVisible,
    togglePlay,
    setVolume,
    initializeAudio,
  } = useAudio();

  // Références locales
  const notificationTimeoutRef = useRef(null);
  const modalRef = useRef(null);
  const volumeSliderRef = useRef(null);
  const initOnceRef = useRef(false); // NOUVEAU: Éviter la double initialisation

  // Fonction pour mettre à jour le gradient du slider
  const updateVolumeSliderGradient = (volumeValue) => {
    if (volumeSliderRef.current) {
      const percentage = volumeValue * 100;
      const gradient = `linear-gradient(to right, #f6a037 0%, #f6a037 ${percentage}%, rgba(250, 230, 209, 0.3) ${percentage}%, rgba(250, 230, 209, 0.3) 100%)`;
      volumeSliderRef.current.style.background = gradient;
    }
  };

  // MODIFIÉ: Initialiser l'audio une seule fois par session
  useEffect(() => {
    if (!initOnceRef.current) {
      const cleanup = initializeAudio(null); // On passe null car on utilise l'instance globale
      initOnceRef.current = true;
      return cleanup;
    }
  }, [initializeAudio]);

  // Fermer la modal avec Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  // MODIFIÉ: Notification uniquement si l'utilisateur n'a jamais interagi
  useEffect(() => {
    if (!hasInteracted && isVisible && isOpen) {
      setShowNotification(true);

      notificationTimeoutRef.current = setTimeout(() => {
        setShowNotification(false);
      }, 5000);
    } else {
      setShowNotification(false);
    }

    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [hasInteracted, isVisible, isOpen]);

  // Mettre à jour le gradient du slider
  useEffect(() => {
    updateVolumeSliderGradient(volume);
  }, [volume]);

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    updateVolumeSliderGradient(newVolume);
  };

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
    return null;
  }

  // SUPPRIMÉ: Plus besoin de l'élément audio local
  // L'instance globale gère tout

  if (!isOpen) {
    return null; // Plus d'élément audio à retourner
  }

  return (
    <>
      {/* Modal UI uniquement */}
      <div className="audio-modal-overlay" onClick={onClose}>
        <div
          ref={modalRef}
          className="audio-modal-content"
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
          role="dialog"
          aria-labelledby="audio-modal-title"
        >
          {/* Header */}
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

          {/* Body */}
          <div className="audio-modal-body">
            {/* Notification */}
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

            {/* Track info */}
            <div className="audio-track-info">
              <div className="audio-track-title">Ce Soir</div>
              <div className="audio-track-artist">
                Piste Audio - Session Persistante
              </div>
            </div>

            {/* Controls */}
            <div className="audio-controls">
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

              {/* Volume control */}
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

            {/* Status */}
            <div className="audio-status">
              <div className="audio-status-text">
                {isLoading
                  ? 'Initialisation...'
                  : !hasInteracted
                    ? "Cliquez n'importe où pour démarrer la musique"
                    : isPlaying
                      ? 'Lecture en cours - Continue entre les pages'
                      : 'En pause - Reprendra sur les autres pages'}
              </div>

              <div className="audio-indicators">
                <div
                  className={`audio-indicator ${isVisible ? 'active' : 'inactive'}`}
                  title={isVisible ? 'Page visible' : 'Page masquée'}
                ></div>
                <div
                  className={`audio-indicator ${hasInteracted ? 'active' : 'inactive'}`}
                  title={hasInteracted ? 'Audio activé' : 'Audio en attente'}
                ></div>
                <div
                  className={`audio-indicator ${isPlaying ? 'active' : 'inactive'}`}
                  title={isPlaying ? 'En lecture' : 'En pause'}
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
