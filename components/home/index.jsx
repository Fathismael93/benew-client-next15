'use client';

import dynamic from 'next/dynamic';

import './styles/index.scss';

import HeroSkeleton from './HeroSkeleton';
import QualitiesSkeleton from './QualitiesSkeleton';
import MarketingSkeleton from './MarketingSkeleton';

import PageTracker from 'components/analytics/PageTracker';
import AppExamples from 'components/layouts/home/appExamples';
import ContactHome from 'components/layouts/home/contact';

// Import dynamique des composants
const Hero = dynamic(() => import('components/layouts/home/hero'), {
  loading: () => <HeroSkeleton />,
  ssr: true,
});

// Import dynamique des composants
const MarketingHome = dynamic(
  () => import('components/layouts/home/marketing'),
  {
    loading: () => <MarketingSkeleton />,
    ssr: true,
  },
);

// Import dynamique des composants
const QualitiesHome = dynamic(
  () => import('components/layouts/home/qualities'),
  {
    loading: () => <QualitiesSkeleton />,
    ssr: true,
  },
);

const HomeComponent = () => {
  return (
    <div className="home-container">
      {/* Tracking spécifique à la page d'accueil */}
      <PageTracker
        pageName="home"
        pageType="landing"
        sections={[
          'hero',
          'marketing-section',
          'services',
          'portfolio_showcase',
          'contact_teaser',
        ]}
      />
      <section className="first" data-section="hero">
        <Hero />
      </section>

      <section
        className="others marketing-section"
        data-section="marketing_section"
      >
        <MarketingHome />
      </section>

      <section className="others services-section" data-section="services">
        <QualitiesHome />
      </section>

      <section
        className="others portfolio-showcase-section"
        data-section="portfolio_showcase"
      >
        <AppExamples />
      </section>

      <section className="others contact-section" data-section="contact">
        <ContactHome />
      </section>
    </div>
  );
};

export default HomeComponent;
