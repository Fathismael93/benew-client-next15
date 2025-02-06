'use client';

import { React, useState } from 'react';
import { motion } from 'framer-motion';
import './presentation.scss';
import Parallax from '../../components/parallax';
import Details from '../../components/details';
import Reasons from '../../components/reasons';

function Presentation() {
  const [isDetails, setIsDetails] = useState(true);

  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Présentation" planets="/sun.png" />
      </section>
      <section className="others manifest">
        <motion.div
          className="manifest-text"
          initial={{ opacity: 0, scale: 0.5 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <p>
            <strong>Benew</strong> est une société technologique de location de
            boutiques en ligne. Mais avant tout, Benew, c’est un sentiment.
            C’est le sentiment de croire au meilleur. C’est celui de croire
            qu’il y’a une meilleure façon, un meilleur chemin. C’est celui qui
            t’oblige à chercher une meilleure solution, une meilleure vie ou un
            meilleur outil avec des meilleures performances.
          </p>
          <p>
            C’est celui de vouloir le meilleur pour soi, pour les siens et pour
            notre pays. Comment ? En pensant différemment. Dans un monde de plus
            en plus monotone où on t’oblige à te conformer au mode de la pensée
            unique, il est extrêmement crucial de faire vivre sa singularité en
            pensant différemment. Nous devons ressentir cette singularité comme
            une plus-value et non comme une gène.
          </p>
          <p>
            C’est en innovant et sortant des sentiers battus que l’on trouve les
            meilleures solutions, que l’on crée un meilleur cadre de vie ou que
            l’on réalise nos rêves. C’est en encourageant chacun d’entre nous
            dans son originalité et à se surpasser que l’on explorera des
            nouveaux horizons. C’est en pensant différemment que l’on trouvera
            des meilleures idées pour améliorer les choses.
          </p>
        </motion.div>
      </section>
      <section className="others manifest">
        <motion.div
          className="manifest-text"
          initial={{ opacity: 0, scale: 0.5 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <p>
            Chez <strong>Benew</strong>, nous nous érigeons comme défenseur de
            la différence, de l’innovation et du dépassement de soi. Nous
            croyons que chacun d’entre-nous est spécial et qu’il peut ajouter sa
            pierre à la construction d’une meilleure communauté, moralement,
            intellectuellement et économiquement développée.
          </p>
          <p>
            C’est pourquoi nous nous sommes surpassés pour vous offrir la
            meilleure des solutions pour faire du business, un nouvel outil qui
            vous permettra de révolutionner votre commerce, aussi petit soit-il
            et au meilleur prix. Un outil créé avec les meilleures technologies
            existantes sur la planète.
          </p>
          <p>
            Chez <strong>Benew</strong>, Nous nous engageons à soutenir toute
            vision qui aura pour but d’innover pour améliorer le cadre de vie
            djiboutien et nous serons toujours l’exemple pour favoriser cette
            perspective.
          </p>
        </motion.div>
      </section>
      <section className="others">
        <div className="container">
          <div className="title">
            <h1>Plus de Détails sur BENEW</h1>
          </div>
          <div className="details-choice">
            <ul>
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
              <li
                onClick={() => setIsDetails(true)}
                className={isDetails ? 'active' : ''}
              >
                Détails
              </li>
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
              <li
                onClick={() => setIsDetails(false)}
                className={isDetails ? '' : 'active'}
              >
                5 Raisons
              </li>
            </ul>
          </div>
          {isDetails ? <Details /> : <Reasons />}
        </div>
      </section>
    </div>
  );
}

export default Presentation;
