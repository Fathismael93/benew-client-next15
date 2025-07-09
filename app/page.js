import Parallax from '../components/layouts/parallax';
import Hero from '../components/layouts/hero';

export default function Home() {
  return (
    <div className="relative">
      {/* 🚀 CORRECTION: Section Hero avec hauteur adaptative */}
      <section className="first">
        <Hero />
      </section>

      {/* 🚀 CORRECTION: Toutes les sections others utilisent maintenant le système adaptatif */}
      <section className="others">
        <Parallax
          bgColor="linear-gradient(180deg, #111132, #0c0c1d)"
          title="Nos Produits..."
          planets="/sun.png"
          data-type="services"
        />
      </section>

      <section className="others">
        <Parallax
          bgColor="linear-gradient(180deg, #111132, #505064)"
          title="What We Did?"
          planets="/planets.png"
          data-type="portfolio"
        />
        {/* <div className="flex items-center justify-center h-full">
          <div className="text-center p-8">
            <h2 className="text-4xl font-bold text-orange-500 mb-4">
              Services
            </h2>
            <p className="text-gray-300 text-lg">
              Découvrez nos services de développement web et mobile
            </p>
          </div>
        </div> */}
      </section>

      <section className="others">
        <Parallax
          bgColor="linear-gradient(180deg, #111132, #0c0c1d)"
          title="Nos Produits..."
          planets="/sun.png"
          data-type="services"
        />
      </section>

      <section className="others">
        <Parallax
          bgColor="linear-gradient(180deg, #111132, #505064)"
          title="What We Did?"
          planets="/planets.png"
          data-type="portfolio"
        />
        {/* <div className="flex items-center justify-center h-full">
          <div className="text-center p-8">
            <h2 className="text-4xl font-bold text-pink-500 mb-4">
              Portfolio 1
            </h2>
            <p className="text-gray-300 text-lg">
              Premier projet de notre portfolio
            </p>
          </div>
        </div> */}
      </section>

      <section className="others">
        <Parallax
          bgColor="linear-gradient(180deg, #111132, #0c0c1d)"
          title="Nos Produits..."
          planets="/sun.png"
          data-type="services"
        />
        {/* <div className="flex items-center justify-center h-full">
          <div className="text-center p-8">
            <h2 className="text-4xl font-bold text-purple-500 mb-4">
              Portfolio 2
            </h2>
            <p className="text-gray-300 text-lg">
              Deuxième projet de notre portfolio
            </p>
          </div>
        </div> */}
      </section>

      <section className="others">
        <Parallax
          bgColor="linear-gradient(180deg, #111132, #505064)"
          title="What We Did?"
          planets="/planets.png"
          data-type="portfolio"
        />
        {/* <div className="flex items-center justify-center h-full">
          <div className="text-center p-8">
            <h2 className="text-4xl font-bold text-cyan-500 mb-4">
              Portfolio 3
            </h2>
            <p className="text-gray-300 text-lg">
              Troisième projet de notre portfolio
            </p>
          </div>
        </div> */}
      </section>

      <section className="others">
        <Parallax
          bgColor="linear-gradient(180deg, #111132, #0c0c1d)"
          title="Nos Produits..."
          planets="/sun.png"
          data-type="services"
        />
        {/* <div className="flex items-center justify-center h-full">
          <div className="text-center p-8">
            <h2 className="text-4xl font-bold text-orange-500 mb-4">Contact</h2>
            <p className="text-gray-300 text-lg">
              Contactez-nous pour vos projets
            </p>
            <div className="mt-6">
              <a
                href="/contact"
                className="inline-block bg-gradient-to-r from-orange-500 to-pink-500 text-white px-8 py-3 rounded-full font-semibold hover:from-orange-600 hover:to-pink-600 transition-all duration-300 transform hover:scale-105"
              >
                Nous contacter
              </a>
            </div>
          </div>
        </div> */}
      </section>
    </div>
  );
}
