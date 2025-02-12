import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import './shopCard.scss';

const ShopCard = ({ product, onOrder }) => {
  return (
    <div className="card">
      <div className="imageContainer">
        <Image
          src={product.image}
          alt={product.title}
          fill
          style={{ objectFit: 'cover' }}
          priority
        />
      </div>

      <h2 className="title">{product.title}</h2>

      <ul className="details">
        <li>Type: {product.type}</li>
        <li>Prix: {product.price}</li>
        <li>Charges à payer/Mois: {product.charges}</li>
        <li>
          <Link href={product.link}>Voir sur le site</Link>
        </li>
      </ul>

      <div className="buttons">
        <button className="orderButton" onClick={onOrder}>
          Commander
        </button>
        <Link href={`/products/${product.id}`} className="detailsButton">
          Plus de détails
        </Link>
      </div>
    </div>
  );
};

export default ShopCard;
