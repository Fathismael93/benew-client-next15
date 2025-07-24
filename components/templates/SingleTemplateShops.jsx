'use client';

import { useEffect, useRef, useState } from 'react';
import { CldImage } from 'next-cloudinary';
import Link from 'next/link';
import { FaDollarSign } from 'react-icons/fa';
import { IoEye } from 'react-icons/io5';
import './styling/templateShops.scss';
import Parallax from '@/components/layouts/parallax';
import OrderModal from '../modal/OrderModal';
import { formatPrice, getApplicationLevelLabel } from '@utils/helpers';
// Ajouter ces imports
import {
  // trackApplicationView,
  trackOrderStart,
  trackPagePerformance,
  trackEvent,
} from '@/utils/analytics';

const SingleTemplateShops = ({
  templateID,
  applications,
  platforms,
  performanceMetrics,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  // Refs pour l'Intersection Observer
  const observerRef = useRef(null);
  const viewedApplicationsRef = useRef(new Set());

  // Tracker les performances de la page template avec contexte enrichi
  useEffect(() => {
    if (performanceMetrics?.loadTime && templateID) {
      trackPagePerformance(
        `template_${templateID}`,
        performanceMetrics.loadTime,
        performanceMetrics.fromCache,
      );
    }
  }, [performanceMetrics, templateID, applications]);

  // Tracker la vue initiale du template
  useEffect(() => {
    if (templateID && applications && applications.length > 0) {
      const templateName = applications[0]?.template_name;

      trackEvent('template_page_view', {
        event_category: 'template',
        event_label: templateName,
        template_id: templateID,
        template_name: templateName,
        applications_count: applications.length,
        applications_by_category: applications.reduce((acc, app) => {
          acc[app.application_category] =
            (acc[app.application_category] || 0) + 1;
          return acc;
        }, {}),
        applications_by_level: applications.reduce((acc, app) => {
          acc[`level_${app.application_level}`] =
            (acc[`level_${app.application_level}`] || 0) + 1;
          return acc;
        }, {}),
      });
    }
  }, [templateID, applications]);

  // Intersection Observer pour tracker les vues automatiques d'applications
  useEffect(() => {
    if (!applications || applications.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const appId = entry.target.dataset.appId;
            const appName = entry.target.dataset.appName;

            // Éviter de tracker plusieurs fois la même application
            if (appId && !viewedApplicationsRef.current.has(appId)) {
              viewedApplicationsRef.current.add(appId);

              trackEvent('application_card_view', {
                event_category: 'application',
                event_label: appName,
                application_id: appId,
                template_id: templateID,
                application_name: appName,
                view_type: 'automatic_scroll',
                position_in_list:
                  Array.from(entry.target.parentNode.children).indexOf(
                    entry.target,
                  ) + 1,
              });
            }
          }
        });
      },
      {
        threshold: 0.6, // Application visible à 60%
        rootMargin: '0px 0px -50px 0px', // Déclencher un peu avant
      },
    );

    // Observer toutes les cards d'applications après un court délai
    const timer = setTimeout(() => {
      const applicationCards = document.querySelectorAll('[data-app-id]');
      applicationCards.forEach((card) => {
        observerRef.current?.observe(card);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [applications, templateID]);

  // Stocker le temps d'ouverture de la modal
  useEffect(() => {
    if (isModalOpen) {
      window.modalOpenTime = Date.now();
    }
  }, [isModalOpen]);

  // Tracker les scrolls profonds sur la liste des applications
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !applications ||
      applications.length === 0
    )
      return;

    let scrollMilestones = {
      25: false,
      50: false,
      75: false,
      90: false,
    };

    const handleScroll = () => {
      const scrollPercent =
        (window.scrollY /
          (document.documentElement.scrollHeight - window.innerHeight)) *
        100;

      Object.keys(scrollMilestones).forEach((milestone) => {
        if (
          scrollPercent >= parseInt(milestone) &&
          !scrollMilestones[milestone]
        ) {
          scrollMilestones[milestone] = true;

          trackEvent('template_scroll_milestone', {
            event_category: 'engagement',
            event_label: `${milestone}_percent`,
            scroll_depth: parseInt(milestone),
            template_id: templateID,
            applications_count: applications.length,
            viewed_applications: viewedApplicationsRef.current.size,
          });
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [templateID, applications]);

  // Handler pour l'ouverture de la modal de commande avec tracking
  const handleOrderClick = (app) => {
    // Vérifier si platforms existe et n'est pas vide
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      // Tracker l'échec d'ouverture de modal
      trackEvent('order_modal_failed', {
        event_category: 'ecommerce',
        event_label: 'no_payment_methods',
        application_id: app.application_id,
        template_id: templateID,
        failure_reason: 'no_payment_methods_available',
        application_name: app.application_name,
      });

      alert('Aucune méthode de paiement disponible pour le moment');
      return;
    }

    // Tracker l'ouverture de la modal
    trackEvent('order_modal_open', {
      event_category: 'ecommerce',
      event_label: app.application_name,
      application_id: app.application_id,
      template_id: templateID,
      application_name: app.application_name,
      application_fee: app.application_fee,
      application_rent: app.application_rent,
      application_level: app.application_level,
      available_platforms: platforms.length,
      source_page: 'template_applications_list',
    });

    // Tracker le début de la commande
    trackOrderStart(app);

    setSelectedApp(app);
    setIsModalOpen(true);
  };

  // Handler pour les clics "Voir +" avec tracking enrichi
  const handleApplicationView = (app) => {
    trackEvent('application_detail_click', {
      event_category: 'navigation',
      event_label: app.application_name,
      application_id: app.application_id,
      template_id: templateID,
      application_name: app.application_name,
      application_level: app.application_level,
      application_category: app.application_category,
      application_fee: app.application_fee,
      click_type: 'detail_view',
      source_page: 'template_applications_list',
    });
  };

  // Handler pour la fermeture de modal avec tracking
  const handleModalClose = () => {
    // Tracker la fermeture de modal
    if (selectedApp) {
      trackEvent('order_modal_close', {
        event_category: 'ecommerce',
        event_label: 'modal_closed',
        application_id: selectedApp.application_id,
        template_id: templateID,
        close_action: 'manual_close',
        time_spent_in_modal: Date.now() - (window.modalOpenTime || Date.now()),
      });
    }

    setIsModalOpen(false);
    setSelectedApp(null);
  };

  return (
    <div>
      <section className="first">
        <Parallax
          bgColor="#0c0c1d"
          title={
            applications !== undefined
              ? applications[0]?.template_name
              : 'Modèle vide'
          }
          planets="/sun.png"
        />
      </section>

      {applications.length !== undefined &&
        applications.map((app) => (
          <section key={app.application_id} className="others projectSection">
            <div className="application-card">
              <div className="card-image">
                <CldImage
                  src={app.application_images[0]}
                  alt={app.application_name}
                  width={400}
                  height={200}
                  className="app-image"
                  priority
                />
              </div>

              <div className="card-content">
                <h3 className="app-title">{app.application_name}</h3>

                <p className="app-meta">
                  <span className="level">
                    {getApplicationLevelLabel(app.application_level).long}
                  </span>
                  <span className="separator">-</span>
                  <span className="category">{app.application_category}</span>
                </p>

                <div className="price-section">
                  <div className="price-item">
                    <span className="price-label">
                      Frais d&apos;acquisition
                    </span>
                    <span className="price">
                      {formatPrice(app.application_fee)} FDJ
                    </span>
                  </div>
                  <div className="price-item">
                    <span className="price-label">Frais de gestion</span>
                    <span className="rent-price">
                      {formatPrice(app.application_rent)} FDJ/mois
                    </span>
                  </div>
                </div>

                <div className="action-buttons">
                  <button
                    className="btn btn-cart"
                    onClick={() => handleOrderClick(app)}
                    disabled={!platforms || platforms.length === 0}
                  >
                    <FaDollarSign size={16} />
                  </button>
                  <Link
                    href={`/templates/${templateID}/applications/${app.application_id}`}
                    className="btn btn-preview"
                    // Ajouter le tracking de la vue d'application
                    onClick={() => handleApplicationView(app)}
                  >
                    <IoEye size={16} />
                    <span className="btn-text">Voir +</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ))}

      {selectedApp && (
        <OrderModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          platforms={platforms}
          applicationId={selectedApp.application_id}
          applicationFee={selectedApp.application_fee}
        />
      )}
    </div>
  );
};

export default SingleTemplateShops;
