'use client';

import React, { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import styles from './Slider.module.scss';

// Importation des styles Swiper
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

const BenewPresentation = () => {
  const sliderData = [
    {
      title: "L'Enérgie",
      text: 'Nous repoussons constamment les limites de la technologie pour créer des solutions révolutionnaires qui transforment les industries et améliorent la vie quotidienne. Notre approche combine créativité, expertise technique et vision stratégique.',
      backgroundImage: '/energie.jpg',
    },
    {
      title: 'Le Moyen',
      text: 'Notre équipe de experts en transformation digitale accompagne les entreprises dans leur mutation numérique. Nous développons des stratégies sur mesure, des solutions innovantes et des écosystèmes digitaux performants qui génèrent de la valeur.',
      backgroundImage: '/mission.jpg',
    },
    {
      title: "L'Objectif",
      text: "Nous développons des approches stratégiques qui placent l'innovation au cœur de la croissance. En analysant les tendances émergentes, en anticipant les mutations du marché, nous aidons nos clients à construire des modèles économiques résilients et différenciants.",
      backgroundImage: '/objectif.jpg',
    },
  ];

  return (
    <div className={styles.sliderContainer}>
      <Swiper
        modules={[Navigation, Pagination]}
        spaceBetween={0}
        slidesPerView={1}
        navigation
        pagination={{ clickable: true }}
        className={styles.swiper}
      >
        {sliderData.map((slide, index) => (
          <SwiperSlide key={index} className={styles.slide}>
            <div
              className={`${styles.slideContent} ${styles[`slide-${index + 1}`]}`}
            >
              <div
                className={`${styles.titleBlock} ${index % 2 === 0 ? styles.leftTitle : styles.rightTitle}`}
                style={{ backgroundImage: `url(${slide.backgroundImage})` }}
              >
                <h2>{slide.title}</h2>
              </div>
              <div
                className={`${styles.textBlock} ${index % 2 === 0 ? styles.rightText : styles.leftText}`}
              >
                <p>{slide.text}</p>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default BenewPresentation;
