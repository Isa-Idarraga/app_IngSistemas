"use client";

import { useMemo, useState } from "react";
import { CATEGORIAS, type CategoriaEvento, type Evento } from "@/lib/types";
import { DIAS_CORTOS, MESES, formatoRango, iso, partes } from "@/lib/fechas";
import Modal from "./Modal";

function enDia(e: Evento, dia: string) {
  return e.inicio <= dia && (e.fin ?? e.inicio) >= dia;
}

function esLargo(e: Evento) {
  if (!e.fin) return false;
  return (Date.parse(e.fin) - Date.parse(e.inicio)) / 86400000 > 7;
}

export default function Calendario({ eventos, hoy }: { eventos: Evento[]; hoy: string }) {
  const h = partes(hoy);
  const [anio, setAnio] = useState(h.y);
  const [mes, setMes] = useState(h.m);
  const [vista, setVista] = useState<"mes" | "lista">("mes");
  const [filtro, setFiltro] = useState<CategoriaEvento | "todas">("todas");
  const [diaSel, setDiaSel] = useState<string | null>(hoy);
  const [abierto, setAbierto] = useState<Evento | null>(null);

  const visibles = useMemo(
    () => eventos.filter((e) => filtro === "todas" || e.categoria === filtro),
    [eventos, filtro]
  );

  const celdas = useMemo(() => {
    const primero = new Date(anio, mes, 1);
    const offset = (primero.getDay() + 6) % 7; // lunes = 0
    const diasMes = new Date(anio, mes + 1, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let d = 1; d <= diasMes; d++) out.push(iso(anio, mes, d));
    while (out.length % 7) out.push(null);
    return out;
  }, [anio, mes]);

  function mover(delta: number) {
    const n = new Date(anio, mes + delta, 1);
    setAnio(n.getFullYear());
    setMes(n.getMonth());
    setDiaSel(null);
  }

  const delDia = diaSel
    ? visibles.filter((e) => enDia(e, diaSel)).sort((a, b) => Number(esLargo(a)) - Number(esLargo(b)))
    : [];
  const delMes = visibles.filter((e) => {
    const ini = iso(anio, mes, 1);
    const fin = iso(anio, mes, new Date(anio, mes + 1, 0).getDate());
    return e.inicio <= fin && (e.fin ?? e.inicio) >= ini;
  });

  const porMes = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of visibles.filter((e) => partes(e.inicio).y === anio || partes(e.fin ?? e.inicio).y === anio)) {
      const k = e.inicio.slice(0, 7);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visibles, anio]);

  return (
    <div className="cal">
      <div className="cal-toolbar">
        <div className="seg">
          <button className={vista === "mes" ? "on" : ""} onClick={() => setVista("mes")}>Mes</button>
          <button className={vista === "lista" ? "on" : ""} onClick={() => setVista("lista")}>Lista del año</button>
        </div>
        <div className="chips">
          <button className={`chip ${filtro === "todas" ? "on" : ""}`} onClick={() => setFiltro("todas")}>Todas</button>
          {(Object.keys(CATEGORIAS) as CategoriaEvento[]).map((k) => (
            <button key={k} className={`chip ${filtro === k ? "on" : ""}`} onClick={() => setFiltro(k)}>
              <span className="dot" style={{ background: CATEGORIAS[k].color }} />
              {CATEGORIAS[k].nombre}
            </button>
          ))}
        </div>
      </div>

      {vista === "mes" ? (
        <div className="cal-layout">
          <div className="cal-month">
            <div className="cal-head">
              <button className="icon-btn" onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
              <h2>
                {MESES[mes]} <span>{anio}</span>
              </h2>
              <button className="icon-btn" onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
              <button
                className="btn btn-sm"
                onClick={() => {
                  setAnio(h.y);
                  setMes(h.m);
                  setDiaSel(hoy);
                }}
              >
                Hoy
              </button>
            </div>
            <div className="cal-grid">
              {DIAS_CORTOS.map((d) => (
                <div key={d} className="cal-dow">{d}</div>
              ))}
              {celdas.map((dia, i) => {
                if (!dia) return <div key={i} className="cal-cell vacia" />;
                // Los rangos largos (más de 7 días) solo se pintan el día que empiezan y el que terminan
                const evs = visibles
                  .filter((e) => enDia(e, dia))
                  .filter((e) => !esLargo(e) || e.inicio === dia || e.fin === dia)
                  .sort((a, b) => Number(esLargo(a)) - Number(esLargo(b)));
                return (
                  <button
                    key={i}
                    className={`cal-cell ${dia === hoy ? "hoy" : ""} ${dia === diaSel ? "sel" : ""}`}
                    onClick={() => setDiaSel(dia)}
                  >
                    <span className="num">{partes(dia).d}</span>
                    <span className="cal-evs">
                      {evs.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={`cal-ev ${esLargo(e) ? "largo" : ""}`}
                          style={{ background: CATEGORIAS[e.categoria].color }}
                          title={e.titulo}
                        >
                          {esLargo(e) ? (e.inicio === dia ? "Inicia: " : "Termina: ") : ""}
                          {e.titulo}
                        </span>
                      ))}
                      {evs.length > 3 && <span className="cal-more">+{evs.length - 3}</span>}
                    </span>
                    {evs.length > 0 && (
                      <span className="cal-dots">
                        {evs.slice(0, 4).map((e) => (
                          <i key={e.id} style={{ background: CATEGORIAS[e.categoria].color }} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <aside className="cal-side">
            <h3>{diaSel ? formatoRango(diaSel) : `Eventos de ${MESES[mes]}`}</h3>
            {(diaSel ? delDia : delMes).length === 0 ? (
              <p className="muted">{diaSel ? "No hay eventos este día." : "No hay eventos este mes."}</p>
            ) : (
              <ul className="event-list">
                {(diaSel ? delDia : delMes).map((e) => (
                  <li key={e.id}>
                    <button className="event-btn" onClick={() => setAbierto(e)}>
                      <span className="dot" style={{ background: CATEGORIAS[e.categoria].color }} />
                      <div>
                        <b>{e.titulo}</b>
                        <small>
                          {formatoRango(e.inicio, e.fin)}
                          {e.hora ? ` · ${e.hora}` : ""}
                        </small>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {diaSel && (
              <button className="link" onClick={() => setDiaSel(null)}>
                Ver todo {MESES[mes]} →
              </button>
            )}
          </aside>
        </div>
      ) : (
        <div className="cal-list">
          <div className="cal-head">
            <button className="icon-btn" onClick={() => setAnio(anio - 1)} aria-label="Año anterior">‹</button>
            <h2>{anio}</h2>
            <button className="icon-btn" onClick={() => setAnio(anio + 1)} aria-label="Año siguiente">›</button>
          </div>
          {porMes.length === 0 && <p className="muted">No hay eventos publicados para {anio}.</p>}
          {porMes.map(([k, evs]) => (
            <section key={k} className="list-month">
              <h3>{MESES[Number(k.slice(5, 7)) - 1]}</h3>
              <ul className="event-list">
                {evs.map((e) => (
                  <li key={e.id}>
                    <button className="event-btn" onClick={() => setAbierto(e)}>
                      <span className="date-badge">
                        <b>{partes(e.inicio).d}</b>
                        <small>{MESES[partes(e.inicio).m].slice(0, 3)}</small>
                      </span>
                      <div>
                        <b>{e.titulo}</b>
                        <small>
                          <span className="dot" style={{ background: CATEGORIAS[e.categoria].color }} />{" "}
                          {CATEGORIAS[e.categoria].nombre} · {formatoRango(e.inicio, e.fin)}
                          {e.lugar ? ` · ${e.lugar}` : ""}
                        </small>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {abierto && (
        <Modal onClose={() => setAbierto(null)} titulo={abierto.titulo}>
          <p className="tag" style={{ background: CATEGORIAS[abierto.categoria].color }}>
            {CATEGORIAS[abierto.categoria].nombre}
          </p>
          <dl className="kv">
            <dt>Fecha</dt>
            <dd>{formatoRango(abierto.inicio, abierto.fin)}</dd>
            {abierto.hora && (
              <>
                <dt>Hora</dt>
                <dd>{abierto.hora}</dd>
              </>
            )}
            {abierto.lugar && (
              <>
                <dt>Lugar</dt>
                <dd>{abierto.lugar}</dd>
              </>
            )}
          </dl>
          {abierto.descripcion && <p className="desc">{abierto.descripcion}</p>}
          {abierto.enlace && (
            <a className="btn btn-primary" href={abierto.enlace} target="_blank" rel="noreferrer">
              Más información
            </a>
          )}
        </Modal>
      )}
    </div>
  );
}
