'use client';

// import './homePage.scss';
import PageTracker from 'components/analytics/PageTracker';
import AppExamples from 'components/layouts/home/appExamples';
import ContactHome from 'components/layouts/home/contact';
import Hero from 'components/layouts/home/hero';
import MarketingHome from 'components/layouts/home/marketing';
import QualitiesHome from 'components/layouts/home/qualities';

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
