'use client';

import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import './Slider.scss';

// Importation des styles Swiper
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import Parallax from '@/components/parallax';

const BenewPresentation = () => {
  const sliderData = [
    {
      title: "L'Enérgie",
      text:
        "Benew, c'est le résultat d'une envie. " +
        'Celle de vouloir apporter une contribution positive et significative à notre entourage et à la société qui nous entoure. ' +
        'Celle de trouver des solutions adaptées à nos problèmes. ' +
        "Celle de donner accès à des outils utiles aux quotidiens pour des prix qui ne rélèvent pas l'absurdité. " +
        "C'est cette envie, résultat d'un mélange entre la colière et l'espoir, qui représente le moteur de Benew et qui nous pousse à imaginer des solutions innovantes et adaptées à notre quotidien. Comment ?",
      backgroundImage: '/energie.jpg',
    },
    {
      title: 'Le Chemin',
      text:
        "Par la recherche, par l'analyse objective des problèmes et l'exploration de toutes les théories possibles. " +
        "C'est en poussant notre reflexion au délà de notre zone de confort et en remettant en cause l'environnement qui nous entoure et " +
        "les idées réçues que l'on découvre des nouvelles voies. Mais aussi grâce à la recherche de la perfection. " +
        "La perfectiond'arriver à une solution unique pour plusieurs problèmes combinées.",
      backgroundImage: '/mission.jpg',
    },
    {
      title: 'Le But',
      text:
        "C'est avec cet état d'esprit que nous nous sommes donnés comme objectif de vous trouver les meilleures solutions ou " +
        'les meilleurs outils, financièrement accessible et simplement utilisable, qui faciliteront votre quotidien de djiboutien.',
      backgroundImage: '/objectif.jpg',
    },
  ];

  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="BENEW" planets="/sun.png" />
      </section>
      <section className="others">
        <Swiper
          modules={[Navigation, Pagination]}
          spaceBetween={0}
          slidesPerView={1}
          navigation
          pagination={{ clickable: true }}
          className="swiper"
        >
          {sliderData.map((slide, index) => (
            <SwiperSlide key={index} className="slide">
              <div className="slideContent">
                <div
                  className="titleBlock"
                  style={{ backgroundImage: `url(${slide.backgroundImage})` }}
                >
                  <h2>{slide.title}</h2>
                </div>
                <div className="textBlock">
                  <p>{slide.text}</p>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </section>
    </div>
  );
};

export default BenewPresentation;
