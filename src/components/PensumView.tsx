"use client";

import { useEffect, useMemo, useState } from "react";
import { AREAS, SECCIONES, type Curso, type Pensum, type Requisito, type Seccion } from "@/lib/types";

const ORDINAL = ["", "Primer", "Segundo", "Tercer", "Cuarto", "Quinto", "Sexto", "Séptimo", "Octavo", "Noveno", "Décimo", "Undécimo", "Duodécimo"];

function codigosPre(c: Curso, tipo?: "pre" | "co") {
  const s = new Set<string>();
  for (const alt of c.requisitos) for (const r of alt) if (r.codigo && (!tipo || r.tipo === tipo)) s.add(r.codigo);
  return s;
}

export default function PensumView({ pensums }: { pensums: Pensum[] }) {
  const [pid, setPid] = useState(pensums[0].id);
  const [selId, setSelId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    try {
      const g = localStorage.getItem("pensum");
      if (g && pensums.some((p) => p.id === g)) setPid(g);
    } catch {}
  }, [pensums]);

  function elegir(id: string) {
    setPid(id);
    setSelId(null);
    try {
      localStorage.setItem("pensum", id);
    } catch {}
  }

  const p = pensums.find((x) => x.id === pid)!;
  const porId = useMemo(() => new Map(p.cursos.map((c) => [c.id, c])), [p]);
  const porCodigo = useMemo(() => {
    const m = new Map<string, Curso>();
    for (const c of p.cursos) if (c.codigo) m.set(c.codigo, c);
    return m;
  }, [p]);

  const sel = selId ? porId.get(selId) ?? null : null;

  // Relaciones del curso seleccionado
  const rel = useMemo(() => {
    const pre = new Set<string>();
    const co = new Set<string>();
    const cadena = new Set<string>();
    const abre = new Set<string>();
    if (!sel) return { pre, co, cadena, abre };
    codigosPre(sel, "pre").forEach((x) => pre.add(x));
    codigosPre(sel, "co").forEach((x) => co.add(x));
    // prerrequisitos indirectos (toda la cadena hacia atrás)
    const pila = [...pre];
    while (pila.length) {
      const cod = pila.pop()!;
      const c = porCodigo.get(cod);
      if (!c) continue;
      codigosPre(c, "pre").forEach((x) => {
        if (!pre.has(x) && !cadena.has(x)) {
          cadena.add(x);
          pila.push(x);
        }
      });
    }
    if (sel.codigo)
      for (const c of p.cursos) if (codigosPre(c).has(sel.codigo)) abre.add(c.codigo || c.id);
    return { pre, co, cadena, abre };
  }, [sel, porCodigo, p]);

  const semestres = useMemo(() => {
    const max = Math.max(0, ...p.cursos.map((c) => c.semestre ?? 0));
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [p]);

  const q = busqueda.trim().toLowerCase();
  const coincide = (c: Curso) =>
    !q || c.nombre.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q) || (c.etiqueta ?? "").toLowerCase().includes(q);

  function estado(c: Curso) {
    const k = c.codigo || c.id;
    if (sel && c.id === sel.id) return "sel";
    if (rel.pre.has(k)) return "pre";
    if (rel.co.has(k)) return "co";
    if (rel.cadena.has(k)) return "cadena";
    if (rel.abre.has(k)) return "abre";
    if (sel) return "dim";
    if (q && !coincide(c)) return "dim";
    return "";
  }

  const areasUsadas = [...new Set(p.cursos.filter((c) => c.semestre && !c.secundario).map((c) => c.area))];

  const secciones = (Object.keys(SECCIONES) as Seccion[])
    .map((s) => ({ s, grupos: p.grupos.filter((g) => g.seccion === s) }))
    .filter((x) => x.grupos.length);

  return (
    <div className={`pensum ${sel ? "con-panel" : ""}`}>
      <div className="pensum-bar">
        <div className="seg seg-lg" role="tablist">
          {pensums.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === pid} className={x.id === pid ? "on" : ""} onClick={() => elegir(x.id)}>
              {x.nombre}
            </button>
          ))}
        </div>
        <input
          className="search"
          placeholder="Buscar materia o código…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="pensum-info">
        {p.info.map((i) => (
          <div key={i.etiqueta}>
            <b>{i.valor}</b>
            <small>{i.etiqueta}</small>
          </div>
        ))}
      </div>

      <div className="legend">
        {areasUsadas.map((a) => (
          <span key={a}>
            <i style={{ background: AREAS[a].color }} />
            {AREAS[a].nombre}
          </span>
        ))}
        {sel && (
          <>
            <span className="lg-rel lg-pre">Prerrequisito</span>
            <span className="lg-rel lg-co">Correquisito</span>
            <span className="lg-rel lg-cadena">Requisito indirecto</span>
            <span className="lg-rel lg-abre">Te abre</span>
          </>
        )}
      </div>

      <div className="malla-scroll">
        <div className="malla" style={{ gridTemplateColumns: `repeat(${semestres.length}, minmax(0, 1fr))`, minWidth: semestres.length * 142 }}>
          {semestres.map((s) => {
            const principales = p.cursos
              .filter((c) => c.semestre === s && !c.secundario)
              .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
            const extra = p.cursos.filter((c) => c.semestre === s && c.secundario);
            const total = principales.reduce((a, c) => a + c.creditos, 0);
            return (
              <div key={s} className="col">
                <div className="col-head" title={`${ORDINAL[s] ?? s} semestre`}>S{s}</div>
                <div className="col-body">
                  {principales.map((c) => (
                    <button
                      key={c.id}
                      className={`card ${estado(c)} ${c.cupo ? "cupo" : ""}`}
                      style={{
                        background: AREAS[c.area].color,
                        color: AREAS[c.area].texto,
                        flexGrow: c.creditos >= 12 ? Math.min(c.creditos / 3, 6) : undefined,
                      }}
                      onClick={() => setSelId(c.id === selId ? null : c.id)}
                    >
                      <span className="card-name">{c.etiqueta ?? c.nombre}</span>
                      <span className="card-meta">
                        {c.codigo || "Por elegir"} · {c.creditos} cr
                      </span>
                    </button>
                  ))}
                  {extra.length > 0 && (
                    <div className="extras">
                      {extra.map((c) => (
                        <button key={c.id} className={`extra ${estado(c)}`} onClick={() => setSelId(c.id === selId ? null : c.id)} title={c.nombre}>
                          {c.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-foot">{total}</div>
              </div>
            );
          })}
        </div>
      </div>

      {p.notas.map((n) => (
        <p key={n} className="nota">{n}</p>
      ))}

      <section className="catalogo">
        <h2>Electivas, trayectorias, NFI y énfasis</h2>
        {p.enfasisOfertados && (
          <div className="callout">
            <b>Líneas de énfasis ofrecidas en {p.enfasisOfertados.periodo} (código Epik)</b>
            <ul>
              {p.enfasisOfertados.lineas.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        )}
        {secciones.map(({ s, grupos }) => (
          <div key={s} className="cat-sec">
            <h3>{SECCIONES[s]}</h3>
            <div className="cat-grid">
              {grupos.map((g) => {
                const cursos = p.cursos.filter((c) => c.grupos.includes(g.id));
                if (!cursos.length) return null;
                const visibles = cursos.filter(coincide);
                if (q && !visibles.length) return null;
                return (
                  <details key={g.id} className="grupo" open={Boolean(q)}>
                    <summary>
                      <span>{g.nombre}</span>
                      <small>{cursos.length}</small>
                    </summary>
                    <ul>
                      {(q ? visibles : cursos).map((c) => (
                        <li key={c.id}>
                          <button onClick={() => setSelId(c.id)}>
                            <code>{c.codigo}</code> {c.nombre} <small>{c.creditos} cr</small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {sel && (
        <Detalle
          c={sel}
          p={p}
          porCodigo={porCodigo}
          abre={[...rel.abre].map((k) => porCodigo.get(k) ?? porId.get(k)).filter(Boolean) as Curso[]}
          onIr={(id) => setSelId(id)}
          onClose={() => setSelId(null)}
        />
      )}
    </div>
  );
}

function ReqItem({ r, porCodigo, onIr }: { r: Requisito; porCodigo: Map<string, Curso>; onIr: (id: string) => void }) {
  if (r.tipo === "creditos") return <li><span className="badge b-cred">Créditos</span> Tener {r.valor} créditos aprobados</li>;
  if (r.tipo === "bilinguismo") return <li><span className="badge b-bil">Bilingüismo</span> {r.valor}</li>;
  const c = r.codigo ? porCodigo.get(r.codigo) : undefined;
  return (
    <li>
      <span className={`badge ${r.tipo === "pre" ? "b-pre" : "b-co"}`}>{r.tipo === "pre" ? "Prerrequisito" : "Correquisito"}</span>
      {c ? (
        <button className="req-link" onClick={() => onIr(c.id)}>
          <code>{r.codigo}</code> {c.nombre}
        </button>
      ) : (
        <span>
          <code>{r.codigo}</code> {r.nombre}
        </span>
      )}
    </li>
  );
}

function Detalle({
  c,
  p,
  porCodigo,
  abre,
  onIr,
  onClose,
}: {
  c: Curso;
  p: Pensum;
  porCodigo: Map<string, Curso>;
  abre: Curso[];
  onIr: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const grupos = p.grupos.filter((g) => c.grupos.includes(g.id));
  const opciones = c.opciones ? p.grupos.filter((g) => c.opciones!.includes(g.id)) : [];

  return (
    <aside className="drawer" aria-label="Detalle de la materia">
      <div className="drawer-head" style={{ background: AREAS[c.area].color, color: AREAS[c.area].texto }}>
        <div>
          <small>{c.codigo || "Espacio por elegir"}</small>
          <h2>{c.etiqueta ?? c.nombre}</h2>
        </div>
        <button className="icon-btn on-color" onClick={onClose} aria-label="Cerrar">×</button>
      </div>
      <div className="drawer-body">
        <div className="stats">
          <div><b>{c.creditos}</b><small>créditos</small></div>
          {c.umes > 0 && <div><b>{c.umes}</b><small>UMES</small></div>}
          {c.semestre && <div><b>S{c.semestre}</b><small>semestre</small></div>}
        </div>
        {c.etiqueta && c.etiqueta !== c.nombre && <p className="muted">{c.nombre}</p>}
        {c.nota && <p className="nota">{c.nota}</p>}

        {!c.cupo && (
          <section>
            <h3>Requisitos</h3>
            {c.requisitos.length === 0 ? (
              <p className="muted">No tiene prerrequisitos ni correquisitos.</p>
            ) : (
              c.requisitos.map((alt, i) => (
                <div key={i}>
                  {i > 0 && <div className="o-sep">o bien</div>}
                  <ul className={`req-list ${c.requisitos.length > 1 ? "alt" : ""}`}>
                    {alt.map((r, j) => (
                      <ReqItem key={j} r={r} porCodigo={porCodigo} onIr={onIr} />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        )}

        {abre.length > 0 && (
          <section>
            <h3>Es requisito de</h3>
            <ul className="req-list">
              {abre.map((x) => (
                <li key={x.id}>
                  <button className="req-link" onClick={() => onIr(x.id)}>
                    <code>{x.codigo}</code> {x.nombre}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {opciones.length > 0 && (
          <section>
            <h3>Opciones para este espacio</h3>
            {opciones.map((g) => (
              <details key={g.id} className="grupo">
                <summary>
                  <span>{g.nombre}</span>
                  <small>{p.cursos.filter((x) => x.grupos.includes(g.id)).length}</small>
                </summary>
                <ul>
                  {p.cursos
                    .filter((x) => x.grupos.includes(g.id))
                    .map((x) => (
                      <li key={x.id}>
                        <button onClick={() => onIr(x.id)}>
                          <code>{x.codigo}</code> {x.nombre}
                        </button>
                      </li>
                    ))}
                </ul>
              </details>
            ))}
          </section>
        )}

        {grupos.length > 0 && (
          <section>
            <h3>Hace parte de</h3>
            <div className="chips">
              {grupos.map((g) => (
                <span key={g.id} className="chip static">{g.nombre}</span>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
