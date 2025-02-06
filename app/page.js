import Parallax from '../components/parallax';
import Hero from '../components/hero';

export default function Home() {
  return (
    <div>
      <section className="first">
        <Hero />
      </section>
      <section className="others">
        <Parallax
          bgColor="linear-gradient(180deg, #111132, #0c0c1d)"
          title="Nos Produits..."
          planets="/sun.png"
        />
      </section>
      <section className="others">Services</section>
      <section className="others">
        <Parallax
          bgColor="linear-gradient(180deg, #111132, #505064)"
          title="What We Did?"
          planets="/planets.png"
        />
      </section>
      <section className="others">Portfolio1</section>
      <section className="others">Portfolio2</section>
      <section className="others">Portfolio3</section>
      <section className="others">Contact</section>
    </div>
  );
}
