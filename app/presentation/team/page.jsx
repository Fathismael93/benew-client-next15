import React from 'react';
import './team.scss';
import Parallax from '@/components/parallax';

const TeamPresentation = () => {
  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="L'EQUIPE" planets="/sun.png" />
      </section>
      <section className="others">
        <div className="contentContainer">
          <div
            className="titleBlock"
            style={{ backgroundImage: 'url(/team.jpg)' }}
          >
            <h1 className="title">L'equipe Benew</h1>
          </div>
          <div className="textBlock">
            <p className="text">
              Benew est composée d'une équipe de 3 personnes. Le créateur du
              projet qui est, aussi, un développeur, l'administrateur et le
              commercial en même temps. Un développeur qui est exclusivement
              tourné vers vers le développement des nouvelles applications et la
              maintenance de celles déjà sur le marché. Et notre comptable qui
              est aussi notre community manager qui s'occupe de nos pages
              réseaux sociaux.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TeamPresentation;
