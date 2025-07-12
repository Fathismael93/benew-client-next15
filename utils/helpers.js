// Méthode pour convertir le niveau d'application en libellé
export const getApplicationLevelLabel = (level) => {
  switch (level) {
    case 1:
      return 'Boutique Simplifiée';
    case 2:
      return 'Boutique Standard';
    case 3:
      return 'Boutique Supérieure';
    case 4:
      return 'Boutique Sophistiquée';
    default:
      return `Niveau ${level}`;
  }
};

// Méthode pour formater les prix avec K si nécessaire
export const formatPrice = (price) => {
  // Convertir en nombre si c'est une string
  const numPrice = typeof price === 'string' ? parseInt(price) : price;

  // Vérifier si le nombre est divisible par 1000
  if (numPrice >= 1000 && numPrice % 1000 === 0) {
    return `${numPrice / 1000}K`;
  }
  // Vérifier si le nombre est supérieur à 1000 mais pas exactement divisible
  else if (numPrice >= 1000) {
    const kValue = numPrice / 1000;
    // Si c'est un nombre décimal, garder une décimale
    return kValue % 1 === 0 ? `${kValue}K` : `${kValue.toFixed(1)}K`;
  }
  // Retourner le nombre original si moins de 1000
  else {
    return numPrice.toString();
  }
};
