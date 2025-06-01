import React from 'react';
import Link from 'next/link';
import './presentation.scss';
import Parallax from '@/components/layouts/parallax';

function Presentation() {
  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Présentation" planets="/sun.png" />
      </section>
      <section className="others">
        <h1>PLAN DE TRAVAIL PREPARER POUR LA NOUVELLE PRESENTATION</h1>
      </section>
    </div>
  );
}

export default Presentation;
