// app/layout.js
import './styles/main.scss'; // ✅ Nouvelle référence
import Navbar from '../components/layouts/navbar';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
