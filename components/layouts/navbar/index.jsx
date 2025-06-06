'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import './navbar.scss';
import Sidebar from '../sidebar';
import Image from 'next/image';

function Navbar() {
  return (
    <div className="navbar">
      {/* Sidebar */}
      <Sidebar />
      <div className="wrapper">
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
              className="h-10 w-auto"
            />
          </Link>
        </motion.div>
        <div className="social">
          <a href="#">
            <img src="/facebook.png" alt="Facebook logo" />
          </a>
          <a href="#">
            <img src="/instagram.png" alt="Instagram logo" />
          </a>
          <a href="#">
            <img src="/snapchat.png" alt="Snapchat logo" />
          </a>
          <a href="#">
            <img src="/twitter.png" alt="Twitter logo" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default Navbar;
