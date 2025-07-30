'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState } from 'react';
import './navbar.scss';
import Sidebar from '../sidebar';
import Image from 'next/image';
import { MdKeyboardArrowDown } from 'react-icons/md';

function Navbar() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  return (
    <div className="navbar">
      {/* Sidebar */}
      <Sidebar />

      <div className="wrapper">
        {/* Structure pour moyens et grands écrans */}
        <div className="desktop-structure">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Link href="/">
              <Image
                priority={true}
                src="/logo.png"
                height={48}
                width={60}
                alt="BuyItNow"
                className="logo"
              />
            </Link>
          </motion.div>

          <div className="social">
            <Link href="#">
              <Image
                src="/facebook.png"
                alt="Facebook logo"
                width={24}
                height={24}
                className="social-icon"
              />
            </Link>
            <Link href="#">
              <Image
                src="/instagram.png"
                alt="Instagram logo"
                width={24}
                height={24}
                className="social-icon"
              />
            </Link>
            <Link href="#">
              <Image
                src="/snapchat.png"
                alt="Snapchat logo"
                width={24}
                height={24}
                className="social-icon"
              />
            </Link>
            <Link href="#">
              <Image
                src="/twitter.png"
                alt="Twitter logo"
                width={24}
                height={24}
                className="social-icon"
              />
            </Link>
          </div>
        </div>

        {/* Structure pour petits écrans */}
        <div className="mobile-structure">
          <motion.div
            className="mobile-logo"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Link href="/">
              <Image
                priority={true}
                src="/logo.png"
                height={48}
                width={60}
                alt="BuyItNow"
                className="logo"
              />
            </Link>
          </motion.div>

          <div className="mobile-social-container">
            <button
              className="social-dropdown-trigger"
              onClick={toggleDropdown}
              aria-label="Ouvrir le menu des réseaux sociaux"
            >
              <Image
                src="/social_websites.png"
                alt="Réseaux sociaux"
                width={24}
                height={24}
                className="social-websites-icon"
              />
              {/* REMPLACER le SVG par cette icône React */}
              <MdKeyboardArrowDown
                className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}
              />
            </button>
            {isDropdownOpen && (
              <div className="social-dropdown">
                <div className="dropdown-backdrop" onClick={closeDropdown} />
                <div className="dropdown-content">
                  <Link
                    href="#"
                    className="dropdown-item"
                    onClick={closeDropdown}
                  >
                    <Image
                      src="/facebook.png"
                      alt="Facebook"
                      width={20}
                      height={20}
                      className="dropdown-icon"
                    />
                    <span>Facebook</span>
                  </Link>
                  <Link
                    href="#"
                    className="dropdown-item"
                    onClick={closeDropdown}
                  >
                    <Image
                      src="/instagram.png"
                      alt="Instagram"
                      width={20}
                      height={20}
                      className="dropdown-icon"
                    />
                    <span>Instagram</span>
                  </Link>
                  <Link
                    href="#"
                    className="dropdown-item"
                    onClick={closeDropdown}
                  >
                    <Image
                      src="/snapchat.png"
                      alt="Snapchat"
                      width={20}
                      height={20}
                      className="dropdown-icon"
                    />
                    <span>Snapchat</span>
                  </Link>
                  <Link
                    href="#"
                    className="dropdown-item"
                    onClick={closeDropdown}
                  >
                    <Image
                      src="/twitter.png"
                      alt="Twitter"
                      width={20}
                      height={20}
                      className="dropdown-icon"
                    />
                    <span>Twitter</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Navbar;
