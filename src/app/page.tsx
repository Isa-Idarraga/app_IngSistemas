import Link from "next/link";
import { getEventos } from "@/lib/store";
import { CATEGORIAS } from "@/lib/types";
import { formatoRango, hoyISO } from "@/lib/fechas";

export const dynamic = "force-dynamic";

export default async function Home() {
  const eventos = await getEventos();
  const hoy = hoyISO();
  const proximos = eventos.filter((e) => e.inicio >= hoy).slice(0, 6);

  return (
    <div className="wrap">
      <section className="hero">
        <p className="eyebrow">Pregrado · Medellín</p>
        <h1>Todo lo de la carrera, en un solo lugar.</h1>
        <p className="lead">
          Revisa los eventos del año y explora el pénsum: toca cualquier materia para ver sus prerrequisitos y
          correquisitos.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/calendario">Ver calendario</Link>
          <Link className="btn" href="/pensum">Explorar pénsum</Link>
        </div>
      </section>

      <section className="home-grid">
        <div className="panel">
          <div className="panel-head">
            <h2>Próximos eventos</h2>
            <Link href="/calendario" className="link">Ver todos →</Link>
          </div>
          {proximos.length === 0 ? (
            <p className="muted">Todavía no hay eventos próximos publicados.</p>
          ) : (
            <ul className="event-list">
              {proximos.map((e) => (
                <li key={e.id}>
                  <span className="dot" style={{ background: CATEGORIAS[e.categoria].color }} />
                  <div>
                    <b>{e.titulo}</b>
                    <small>
                      {formatoRango(e.inicio, e.fin)}
                      {e.hora ? ` · ${e.hora}` : ""}
                      {e.lugar ? ` · ${e.lugar}` : ""}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link href="/pensum" className="panel panel-link">
          <h2>Pénsum interactivo</h2>
          <p className="muted">Planes 20251, 20222 y 20081. Elige el tuyo y mira qué necesitas para cada materia.</p>
          <div className="mini-malla" aria-hidden>
            {["#1aa6c6", "#1aa6c6", "#125f6e", "#d8392f", "#d8392f", "#f5a25d", "#d8392f", "#8d9a12", "#8d9a12", "#7b1d2b", "#8d9a12", "#1aa6c6"].map(
              (c, i) => (
                <span key={i} style={{ background: c }} />
              )
            )}
          </div>
        </Link>
      </section>
    </div>
  );
}
