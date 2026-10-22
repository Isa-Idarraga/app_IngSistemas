import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ingeniería de Sistemas · EAFIT",
  description: "Calendario de eventos y pénsum interactivo del pregrado en Ingeniería de Sistemas de la Universidad EAFIT.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="topbar">
          <div className="topbar-in">
            <Link href="/" className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-repres.png" alt="Logo de los representantes estudiantiles" className="brand-logo" width={26} height={34} />
              <span className="brand-text">
                <b>Ingeniería de Sistemas</b>
                <small>Universidad EAFIT</small>
              </span>
            </Link>
            <nav className="nav">
              <Link href="/calendario">Calendario</Link>
              <Link href="/pensum">Pénsum</Link>
              <Link href="/admin" className="nav-admin">Admin</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="footer">
          <p>
            Hecho por y para estudiantes de Ingeniería de Sistemas · EAFIT. La información del pénsum proviene de
            los planes de estudio oficiales; ante cualquier duda, verifica en Epik o con la coordinación del programa.
          </p>
        </footer>
      </body>
    </html>
  );
}
