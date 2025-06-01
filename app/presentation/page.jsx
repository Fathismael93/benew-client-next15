import React from 'react';
import './presentation.scss';
import Parallax from '@/components/layouts/parallax';
import PresentationSubjects from '@/components/presentationSubjects';

function Presentation() {
  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Présentation" planets="/sun.png" />
      </section>
      <PresentationSubjects />
    </div>
  );
}

export default Presentation;
