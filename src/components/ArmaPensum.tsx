"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AREAS, SECCIONES, type Curso, type Pensum, type Seccion } from "@/lib/types";
import {
  AVISO_PRACTICA,
  MAX_CREDITOS,
  MAX_CREDITOS_CON_PERMISO,
  MAX_SEMESTRES,
  SEMESTRES_INICIALES,
  creditosRequeridos,
  cursosBilinguismo,
  PREFIJO_BIL,
  pideBilinguismo,
  creditosSemestre,
  esObligatoria,
  esPractica,
  escogidos,
  evaluarEleccion,
  evaluarRequisitos,
  practicaConMaterias,
  progreso as calcularProgreso,
  restante,
  simularColocacion,
  tiposEleccion,
  umesSemestre,
  type Categoria,
  type Contexto,
  type Elecciones,
  type Plan,
  type Rellenos,
  type Simulacion,
} from "@/lib/plan";
import Modal from "./Modal";

interface Guardado {
  semestres: number;
  plan: Plan;
  rellenos?: Rellenos;
  elecciones?: Elecciones;
}

interface Mensaje {
  tipo: "error" | "aviso" | "ok";
  titulo: string;
  detalles: string[];
}

const CATEGORIAS: { k: Categoria; nombre: string }[] = [
  { k: "obligatorios", nombre: "Obligatorios" },
  { k: "nfi", nombre: "Formación institucional (NFI)" },
  { k: "complementarios", nombre: "Complementarios" },
  { k: "enfasis", nombre: "Línea de énfasis" },
];

// El plan vive solo en este navegador (localStorage): nunca se envía a un servidor.
function leerGuardado(pid: string): Guardado | null {
  try {
    const raw = localStorage.getItem(`plan:${pid}`);
    if (!raw) return null;
    const g = JSON.parse(raw) as Guardado;
    if (typeof g.semestres !== "number" || typeof g.plan !== "object") return null;
    return g;
  } catch {
    return null;
  }
}

function guardar(pid: string, g: Guardado) {
  try {
    localStorage.setItem(`plan:${pid}`, JSON.stringify(g));
  } catch {}
}

const nombreCorto = (n: string) => n.replace(/^Trayectoria (en )?/, "");

export default function ArmaPensum({ pensums }: { pensums: Pensum[] }) {
  const [pid, setPid] = useState(pensums[0].id);
  const [semestres, setSemestres] = useState(SEMESTRES_INICIALES);
  const [planEstado, setPlan] = useState<Plan>({});
  const [rellenosEstado, setRellenos] = useState<Rellenos>({});
  const [elecciones, setElecciones] = useState<Elecciones>({});
  const [cargadoPid, setCargadoPid] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [slotAbierto, setSlotAbierto] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [msg, setMsg] = useState<Mensaje | null>(null);
  const [arrastrandoSobre, setArrastrandoSobre] = useState<number | null>(null);
  const [confirmarLimpiar, setConfirmarLimpiar] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planRef = useRef<HTMLElement | null>(null);

  const pBase = pensums.find((x) => x.id === pid)!;
  // Se agregan los hitos de bilingüismo (A1, A2…) como materias de 0 créditos que se ponen en el plan
  const p = useMemo<Pensum>(() => ({ ...pBase, cursos: [...pBase.cursos, ...cursosBilinguismo(pBase)] }), [pBase]);
  const porId = useMemo(() => new Map(p.cursos.map((c) => [c.id, c])), [p]);
  const porCodigo = useMemo(() => {
    const m = new Map<string, Curso>();
    for (const c of p.cursos) if (c.codigo) m.set(c.codigo, c);
    return m;
  }, [p]);
  const tipos = useMemo(() => tiposEleccion(p), [p]);
  const cursosPlaneables = useMemo(() => p.cursos.filter((c) => !c.cupo && c.codigo), [p]);

  // Mientras se carga el plan del pénsum recién elegido no se muestra el del anterior
  const listo = cargadoPid === pid;
  const plan = useMemo<Plan>(() => {
    if (!listo) return {};
    const out: Plan = {};
    for (const [id, s] of Object.entries(planEstado)) if (porId.has(id)) out[id] = s;
    return out;
  }, [planEstado, listo, porId]);
  const rellenos = useMemo<Rellenos>(() => {
    if (!listo) return {};
    const out: Rellenos = {};
    for (const [id, slot] of Object.entries(rellenosEstado)) if (plan[id] !== undefined && plan[slot] !== undefined) out[id] = slot;
    return out;
  }, [rellenosEstado, listo, plan]);
  const ctx: Contexto = useMemo(() => ({ p, porId, porCodigo, plan, rellenos }), [p, porId, porCodigo, plan, rellenos]);

  useEffect(() => {
    let elegido = pensums[0].id;
    try {
      const g = localStorage.getItem("pensum");
      if (g && pensums.some((x) => x.id === g)) elegido = g;
    } catch {}
    setPid(elegido);
  }, [pensums]);

  useEffect(() => {
    const g = leerGuardado(pid);
    const plan: Plan = {};
    if (g) for (const [id, s] of Object.entries(g.plan)) if (porId.has(id) && typeof s === "number") plan[id] = s;
    const validos = new Set(p.grupos.map((x) => x.id));
    const ele: Elecciones = {};
    for (const [k, v] of Object.entries(g?.elecciones ?? {})) if (Array.isArray(v)) ele[k] = v.filter((x) => validos.has(x));
    setPlan(plan);
    setRellenos(g?.rellenos ?? {});
    setElecciones(ele);
    setSemestres(Math.max(g?.semestres ?? SEMESTRES_INICIALES, ...Object.values(plan), 1));
    setSelId(null);
    setSlotAbierto(null);
    setCargadoPid(pid);
  }, [pid, porId, p]);

  useEffect(() => {
    if (listo) guardar(pid, { semestres, plan: planEstado, rellenos: rellenosEstado, elecciones });
  }, [pid, semestres, planEstado, rellenosEstado, elecciones, listo]);

  function avisar(m: Mensaje) {
    setMsg(m);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    if (m.tipo === "ok") msgTimer.current = setTimeout(() => setMsg(null), 6000);
  }

  function elegirPensum(id: string) {
    setPid(id);
    setMsg(null);
    try {
      localStorage.setItem("pensum", id);
    } catch {}
  }

  const nombreGrupo = (id: string) => nombreCorto(p.grupos.find((g) => g.id === id)?.nombre ?? id);
  const tipoNombre = (k: string) => tipos.find((t) => t.k === k)?.nombre.toLowerCase() ?? k;

  function aplicar(c: Curso, s: number, sim: Simulacion) {
    if (!sim.ev.ok) {
      avisar({ tipo: "error", titulo: `No puedes poner ${c.nombre} en el semestre ${s}`, detalles: sim.ev.faltan });
      return false;
    }
    setPlan(sim.plan);
    setRellenos(sim.rellenos);
    setElecciones(sim.elecciones);
    setSelId(null);
    const extra = sim.agregada ? [`Quedó escogida ${nombreGrupo(sim.agregada.grupo)} en ${tipoNombre(sim.agregada.k)}.`] : [];
    // Si llenó un espacio por elegir de otro semestre, contarle de dónde salió
    const slotId = sim.rellenos[c.id];
    if (slotId && slotId !== rellenos[c.id] && sim.plan[slotId] !== s) {
      extra.push(`Cuenta como "${porId.get(slotId)?.nombre}", así que ese espacio ya no aparece en el semestre ${sim.plan[slotId]}.`);
    }
    avisar(
      sim.ev.avisos.length
        ? { tipo: "aviso", titulo: `${c.nombre} quedó en el semestre ${s}, pero ten en cuenta:`, detalles: [...extra, ...sim.ev.avisos] }
        : { tipo: "ok", titulo: `${c.nombre} quedó en el semestre ${s}`, detalles: extra }
    );
    return true;
  }

  function colocar(id: string, s: number, slotForzado?: string) {
    const c = porId.get(id);
    if (!c || plan[id] === s) return false;
    return aplicar(c, s, simularColocacion(c, s, ctx, elecciones, tipos, slotForzado));
  }

  function quitar(id: string) {
    const c = porId.get(id);
    const n = { ...planEstado };
    delete n[id];
    const r: Rellenos = {};
    for (const [k, v] of Object.entries(rellenosEstado)) if (k !== id && v !== id) r[k] = v;
    setPlan(n);
    setRellenos(r);
    if (selId === id) setSelId(null);
    if (c) avisar({ tipo: "ok", titulo: `Quitaste ${c.nombre} de tu plan`, detalles: [] });
  }

  function usarMallaSugerida() {
    const n: Plan = {};
    let max = SEMESTRES_INICIALES;
    for (const c of p.cursos) {
      if (c.semestre && c.codigo && !c.cupo) {
        n[c.id] = c.semestre;
        max = Math.max(max, c.semestre);
      }
    }
    // Bilingüismo: cada hito justo antes de la primera materia de la malla que lo pide (se puede mover)
    const ubicados: string[] = [];
    for (const b of p.cursos.filter((c) => c.id.startsWith(PREFIJO_BIL))) {
      const valor = (b as Curso & { _valor?: string })._valor;
      const sems = p.cursos.filter((c) => c.semestre && !c.cupo && pideBilinguismo(c, valor)).map((c) => c.semestre!);
      if (sems.length) {
        n[b.id] = Math.max(1, Math.min(...sems) - 1);
        ubicados.push(`${b.nombre} en el semestre ${n[b.id]}`);
      }
    }
    setPlan(n);
    setRellenos({});
    setSemestres(max);
    setConfirmarLimpiar(false);
    avisar({
      tipo: "ok",
      titulo: "Cargamos la malla sugerida",
      detalles: [
        "Son las materias obligatorias. Agrega desde la lista las NFI, electivas, trayectorias, flexibles y la línea de énfasis.",
        ...(ubicados.length
          ? [`Pusimos ${ubicados.join(" y ")}, justo antes de las materias que lo piden. Muévelo al semestre en que de verdad lo cumplas.`]
          : []),
      ],
    });
  }

  function limpiar() {
    setPlan({});
    setRellenos({});
    setElecciones({});
    setSemestres(SEMESTRES_INICIALES);
    setConfirmarLimpiar(false);
    setSelId(null);
    avisar({ tipo: "ok", titulo: "Tu plan quedó vacío", detalles: [] });
  }

  function cambiarEleccion(k: string, i: number, grupo: string) {
    const actual = [...(elecciones[k] ?? [])];
    while (actual.length <= i) actual.push("");
    actual[i] = grupo;
    while (actual.length && !actual[actual.length - 1]) actual.pop();
    setElecciones({ ...elecciones, [k]: actual });
  }

  function quitarSemestre() {
    if (semestres <= 1) return;
    if (Object.values(plan).some((s) => s === semestres)) {
      avisar({ tipo: "error", titulo: `El semestre ${semestres} tiene materias`, detalles: ["Muévelas o quítalas antes de eliminar el semestre."] });
      return;
    }
    setSemestres(semestres - 1);
  }

  // Estado de cada materia ya puesta
  const estados = useMemo(() => {
    const m = new Map<string, { ok: boolean; faltan: string[]; avisos: string[] }>();
    for (const [id, s] of Object.entries(plan)) {
      const c = porId.get(id);
      if (!c || c.cupo) continue;
      const req = evaluarRequisitos(c, s, ctx);
      const faltan = [...req.faltan];
      const avisos = [...req.avisos];
      const ele = evaluarEleccion(c, elecciones, tipos);
      if (!ele.ok || ele.agregar) {
        const t = tipos.find((x) => x.grupos.some((g) => c.grupos.includes(g.id)));
        faltan.push(`No es de ${t?.articulo ?? "tus elecciones"}: cámbiala o ajusta "Tus elecciones"`);
      }
      if (!esPractica(c) && c.creditos > 0 && practicaConMaterias(ctx, s)) avisos.push(AVISO_PRACTICA);
      m.set(id, { ok: faltan.length === 0, faltan, avisos });
    }
    return m;
  }, [plan, porId, ctx, elecciones, tipos]);

  const sel = selId ? porId.get(selId) ?? null : null;
  const previsualizacion = useMemo(() => {
    if (!sel) return null;
    return Array.from({ length: semestres }, (_, i) => simularColocacion(sel, i + 1, ctx, elecciones, tipos).ev);
  }, [sel, semestres, ctx, elecciones, tipos]);

  const prog = useMemo(() => {
    const req = creditosRequeridos(p);
    const { llevas, porElegir } = calcularProgreso(ctx);
    const total = Object.values(llevas).reduce((a, b) => a + b, 0);
    const pendiente = Object.values(porElegir).reduce((a, b) => a + b, 0);
    const totalReq = Object.values(req).reduce((a, b) => a + (b ?? 0), 0);
    let umes = 0;
    for (let s = 1; s <= semestres; s++) umes += umesSemestre(ctx, s).umes;
    return { req, llevas, porElegir, total, pendiente, totalReq, umes };
  }, [ctx, p, semestres]);

  const obligatoriasFaltantes = cursosPlaneables.filter((c) => esObligatoria(c) && plan[c.id] === undefined);
  const conProblemas = [...estados.values()].filter((e) => !e.ok).length;

  // Lista de materias
  const q = busqueda.trim().toLowerCase();
  const coincide = (c: Curso) => !q || c.nombre.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q);
  const obligatorias = cursosPlaneables
    .filter((c) => esObligatoria(c))
    .sort((a, b) => (a.semestre ?? 0) - (b.semestre ?? 0) || (a.orden ?? 99) - (b.orden ?? 99));
  const bilinguismo = cursosPlaneables.filter((c) => c.id.startsWith(PREFIJO_BIL));
  const gruposPool = (Object.keys(SECCIONES) as Seccion[]).flatMap((s) =>
    p.grupos
      .filter((g) => g.seccion === s)
      .map((g) => ({ g, cursos: cursosPlaneables.filter((c) => c.grupos.includes(g.id)) }))
      .filter((x) => x.cursos.length)
  );
  const grupoBloqueado = (gid: string) => {
    const t = tipos.find((x) => x.grupos.some((g) => g.id === gid));
    if (!t) return false;
    const esc = escogidos(elecciones, t.k);
    return esc.length >= t.limite && !esc.includes(gid);
  };

  function elegirDelPool(c: Curso) {
    const nuevo = selId === c.id ? null : c.id;
    setSelId(nuevo);
    if (nuevo && window.innerWidth < 900) {
      requestAnimationFrame(() => planRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  function itemPool(c: Curso) {
    const en = plan[c.id];
    return (
      <li key={c.id}>
        <button
          className={`pool-item ${selId === c.id ? "on" : ""} ${en ? "puesta" : ""}`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", c.id);
            e.dataTransfer.effectAllowed = "move";
            setSelId(c.id);
          }}
          onClick={() => elegirDelPool(c)}
        >
          <i style={{ background: AREAS[c.area].color }} />
          <span className="pool-name">
            <b>{c.nombre}</b>
            <small>
              {c.codigo} · {c.creditos} cr · {c.umes} UMES{c.semestre ? ` · sugerida en S${c.semestre}` : ""}
            </small>
          </span>
          {en ? <span className="pool-tag">S{en}</span> : null}
        </button>
      </li>
    );
  }

  async function descargarPDF() {
    setGenerandoPDF(true);
    try {
      const { descargarPlanPDF } = await import("@/lib/pdfPlan");
      const semestresPDF = [];
      for (let s = 1; s <= semestres; s++) {
        const ids = Object.entries(plan)
          .filter(([, sem]) => sem === s)
          .map(([id]) => id);
        const filas = [];
        for (const id of ids) {
          const c = porId.get(id)!;
          if (c.cupo) {
            const r = restante(ctx, id);
            if (r > 0) filas.push({ codigo: "—", nombre: `${c.nombre} (por elegir)`, creditos: r, umes: "—", observaciones: "" });
          } else {
            const est = estados.get(id);
            const obs = est ? [...(est.ok ? [] : est.faltan.map((f) => `No cumple: ${f}`)), ...est.avisos.filter((a) => a !== AVISO_PRACTICA)] : [];
            const slot = rellenos[id] ? porId.get(rellenos[id]) : undefined;
            filas.push({
              codigo: c.codigo,
              nombre: slot ? `${c.nombre} (${slot.nombre})` : c.nombre,
              creditos: c.creditos,
              umes: c.umes,
              observaciones: obs.join(" · "),
            });
          }
        }
        const u = umesSemestre(ctx, s);
        semestresPDF.push({
          numero: s,
          creditos: creditosSemestre(ctx, s),
          umes: u.umes,
          porElegir: u.porElegir,
          filas,
          notas: [
            ...(creditosSemestre(ctx, s) > MAX_CREDITOS ? [`Más de ${MAX_CREDITOS} créditos: requiere permiso.`] : []),
            ...(practicaConMaterias(ctx, s) ? [AVISO_PRACTICA] : []),
          ],
        });
      }
      // Malla para el dibujo de la primera página (mismo orden que en pantalla)
      const malla = Array.from({ length: semestres }, (_, i) => i + 1).map((s) => {
        const ids = Object.entries(plan)
          .filter(([id, sem]) => sem === s && !(porId.get(id)?.cupo && restante(ctx, id) <= 0))
          .map(([id]) => id)
          .sort((a, b) => {
            const ca = porId.get(a)!;
            const cb = porId.get(b)!;
            return Number(Boolean(ca.cupo)) - Number(Boolean(cb.cupo)) || (ca.semestre ?? 99) - (cb.semestre ?? 99) || (ca.orden ?? 99) - (cb.orden ?? 99);
          });
        const tarjetas = ids
          .filter((id) => (porId.get(id)?.creditos ?? 0) > 0)
          .map((id) => {
            const c = porId.get(id)!;
            const est = estados.get(id);
            const avisos = est?.avisos.filter((a) => a !== AVISO_PRACTICA) ?? [];
            return {
              nombre: c.cupo ? `${c.nombre} (por elegir)` : c.etiqueta ?? c.nombre,
              codigo: c.cupo ? "—" : c.codigo,
              creditos: c.cupo ? restante(ctx, id) : c.creditos,
              color: c.cupo ? "#e9ecf4" : AREAS[c.area].color,
              texto: c.cupo ? "#5b6b7f" : AREAS[c.area].texto,
              estado: (est && !est.ok ? "mal" : avisos.length ? "aviso" : "ok") as "ok" | "mal" | "aviso",
            };
          });
        const extras = ids
          .filter((id) => (porId.get(id)?.creditos ?? 0) === 0)
          .map((id) => ({ nombre: porId.get(id)!.nombre, mal: Boolean(estados.get(id) && !estados.get(id)!.ok) }));
        return { numero: s, creditos: creditosSemestre(ctx, s), umes: umesSemestre(ctx, s).umes, tarjetas, extras };
      });
      await descargarPlanPDF({
        pensum: p.nombre,
        malla,
        elecciones: tipos.map((t) => ({
          nombre: t.nombre,
          valor: escogidos(elecciones, t.k).map(nombreGrupo).join(", ") || "Sin escoger",
        })),
        progreso: [
          { nombre: "Créditos escogidos", valor: `${prog.total} de ${prog.totalReq}${prog.pendiente ? ` (+ ${prog.pendiente} en espacios por elegir)` : ""}` },
          { nombre: "UMES de materias escogidas", valor: String(prog.umes) },
        ],
        semestres: semestresPDF,
      });
    } catch {
      avisar({ tipo: "error", titulo: "No se pudo generar el PDF", detalles: ["Intenta de nuevo."] });
    } finally {
      setGenerandoPDF(false);
    }
  }

  const slot = slotAbierto ? porId.get(slotAbierto) : undefined;

  return (
    <div className="arma">
      <div className="pensum-bar">
        <div className="seg seg-lg" role="tablist">
          {pensums.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === pid} className={x.id === pid ? "on" : ""} onClick={() => elegirPensum(x.id)}>
              {x.nombre}
            </button>
          ))}
        </div>
        <div className="btn-row">
          <button className="btn btn-sm" onClick={usarMallaSugerida}>Empezar con la malla sugerida</button>
          <button className="btn btn-sm btn-primary" onClick={descargarPDF} disabled={!Object.keys(plan).length || generandoPDF}>
            {generandoPDF ? "Generando…" : "Descargar PDF"}
          </button>
          {confirmarLimpiar ? (
            <>
              <button className="btn btn-sm btn-danger" onClick={limpiar}>Sí, vaciar</button>
              <button className="btn btn-sm" onClick={() => setConfirmarLimpiar(false)}>No</button>
            </>
          ) : (
            <button className="btn btn-sm btn-ghost-danger" onClick={() => setConfirmarLimpiar(true)} disabled={!Object.keys(plan).length}>
              Vaciar plan
            </button>
          )}
        </div>
      </div>

      <p className="privacidad">
        🔒 Tu plan se guarda solo en este navegador: no se envía a ningún servidor, así que nadie más puede verlo ni
        descargarlo. El PDF también se genera en tu dispositivo. Si usas un computador compartido, dale “Vaciar plan” al
        terminar.
      </p>

      <div className="progreso">
        <div className="prog-total">
          <b>{prog.total}</b>
          <small>
            de {prog.totalReq} créditos escogidos{prog.pendiente ? ` · ${prog.pendiente} en espacios por elegir` : ""}
          </small>
          <small>{prog.umes} UMES de materias escogidas</small>
        </div>
        {CATEGORIAS.filter((x) => prog.req[x.k]).map((x) => {
          const r = prog.req[x.k]!;
          const v = prog.llevas[x.k];
          const pe = prog.porElegir[x.k];
          return (
            <div key={x.k} className="prog-item">
              <div className="prog-lbl">
                <span>{x.nombre}</span>
                <b className={v + pe > r ? "exceso" : ""}>
                  {v}
                  {pe ? <em> +{pe}</em> : null}/{r}
                </b>
              </div>
              <div className="bar">
                <span style={{ width: `${Math.min(100, (v / r) * 100)}%` }} />
                <span className="pend" style={{ width: `${Math.min(100 - Math.min(100, (v / r) * 100), (pe / r) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {tipos.length > 0 && (
        <div className="elecciones">
          <h2>Tus elecciones</h2>
          <div className="elecciones-grid">
            {tipos.map((t) => (
              <div key={t.k} className="eleccion">
                <span>
                  {t.nombre} <small>(máximo {t.limite})</small>
                </span>
                {Array.from({ length: t.limite }, (_, i) => {
                  const actual = elecciones[t.k] ?? [];
                  return (
                    <select key={i} value={actual[i] ?? ""} onChange={(e) => cambiarEleccion(t.k, i, e.target.value)}>
                      <option value="">{t.limite > 1 ? `— Opción ${i + 1} sin escoger —` : "— Sin escoger —"}</option>
                      {t.grupos
                        .filter((g) => g.id === actual[i] || !actual.includes(g.id))
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {nombreCorto(g.nombre)}
                          </option>
                        ))}
                    </select>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="muted small">
            También se escogen solas cuando pones la primera materia de una trayectoria o énfasis. Solo puedes tener las
            que dice tu plan de estudios.
          </p>
        </div>
      )}

      {Object.keys(plan).length > 0 && (obligatoriasFaltantes.length > 0 || conProblemas > 0) && (
        <div className="pendientes">
          {conProblemas > 0 && (
            <p className="pend-error">
              {conProblemas === 1 ? "1 materia no cumple" : `${conProblemas} materias no cumplen`} sus requisitos (están en rojo).
            </p>
          )}
          {obligatoriasFaltantes.length > 0 && (
            <details>
              <summary>Te faltan {obligatoriasFaltantes.length} materias obligatorias de la malla</summary>
              <p className="muted small">{obligatoriasFaltantes.map((c) => c.nombre).join(" · ")}</p>
            </details>
          )}
        </div>
      )}

      <div className="arma-layout">
        <aside className="pool">
          <div className="pool-head">
            <h2>Materias</h2>
            <p className="muted small">Toca una materia y luego el semestre donde la quieres, o arrástrala.</p>
            <input className="search" placeholder="Buscar materia o código…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <div className="pool-list">
            <details open>
              <summary>
                Obligatorias de la malla <small>{obligatorias.length}</small>
              </summary>
              <ul>{obligatorias.filter(coincide).map((c) => itemPool(c))}</ul>
            </details>
            {bilinguismo.length > 0 && (!q || bilinguismo.some(coincide)) && (
              <details open={Boolean(q)}>
                <summary>
                  Bilingüismo <small>{bilinguismo.length}</small>
                </summary>
                <p className="muted small pool-ayuda">Ponlo en el semestre en que cumples el requisito: las materias que lo piden van después.</p>
                <ul>{bilinguismo.filter(coincide).map((c) => itemPool(c))}</ul>
              </details>
            )}
            {gruposPool.map(({ g, cursos }) => {
              const visibles = cursos.filter(coincide);
              if (q && !visibles.length) return null;
              const bloqueado = grupoBloqueado(g.id);
              return (
                <details key={g.id} open={Boolean(q)} className={bloqueado ? "bloqueado" : ""}>
                  <summary>
                    <span>
                      {g.nombre}
                      {bloqueado && <em className="no-escogida">No escogida</em>}
                    </span>
                    <small>{cursos.length}</small>
                  </summary>
                  <ul>{visibles.map((c) => itemPool(c))}</ul>
                </details>
              );
            })}
          </div>
        </aside>

        <section className="plan" ref={planRef}>
          <div className={`sel-bar ${sel ? "on" : ""}`} aria-live="polite">
            {sel ? (
              <>
                <div>
                  <b>{sel.nombre}</b>
                  <small>
                    {sel.codigo} · {sel.creditos} créditos · {sel.umes} UMES
                    {plan[sel.id] ? ` · está en el semestre ${plan[sel.id]}` : ""}
                  </small>
                  <small>
                    {sel.requisitos.length
                      ? `Requisitos: ${sel.requisitos
                          .map((alt) =>
                            alt
                              .map((r) =>
                                r.tipo === "creditos"
                                  ? `${r.valor} créditos aprobados`
                                  : r.tipo === "bilinguismo"
                                  ? String(r.valor)
                                  : `${r.tipo === "pre" ? "pre" : "co"}: ${porCodigo.get(r.codigo ?? "")?.nombre ?? r.nombre}`
                              )
                              .join(" + ")
                          )
                          .join(" — o — ")}`
                      : "Sin requisitos"}
                  </small>
                  {sel.creditos === 0 && (
                    <small>
                      {sel.nota ??
                        "Si está en un semestre significa que la apruebas en ese semestre; las materias que la piden van en semestres posteriores."}
                    </small>
                  )}
                  {plan[sel.id] !== undefined && estados.get(sel.id) && (() => {
                    const est = estados.get(sel.id)!;
                    return (
                      <>
                        {!est.ok && <small className="sel-mal">No cumple: {est.faltan.join("; ")}</small>}
                        {est.avisos.length > 0 && <small className="sel-aviso">{est.avisos.join("; ")}</small>}
                      </>
                    );
                  })()}
                </div>
                <div className="btn-row">
                  {plan[sel.id] ? (
                    <button className="btn btn-sm btn-ghost-danger" onClick={() => quitar(sel.id)}>
                      Quitar del plan
                    </button>
                  ) : null}
                  <button className="btn btn-sm" onClick={() => setSelId(null)}>Cancelar</button>
                </div>
              </>
            ) : (
              <span className="muted">Elige una materia de la lista para ver dónde la puedes poner.</span>
            )}
          </div>

          {msg && (
            <div className={`plan-msg ${msg.tipo}`} role="status">
              <div>
                <b>{msg.titulo}</b>
                {msg.detalles.length > 0 && (
                  <ul>
                    {msg.detalles.slice(0, 5).map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                    {msg.detalles.length > 5 && <li>…y {msg.detalles.length - 5} opciones más</li>}
                  </ul>
                )}
              </div>
              <button className="icon-btn" onClick={() => setMsg(null)} aria-label="Cerrar mensaje">×</button>
            </div>
          )}

          <div className="pmalla-scroll">
            <div className="pmalla" style={{ gridTemplateColumns: `repeat(${semestres}, minmax(112px, 1fr))`, minWidth: semestres * 120 }}>
              {Array.from({ length: semestres }, (_, i) => i + 1).map((s) => {
                const ids = Object.entries(plan)
                  .filter(([id, sem]) => sem === s && !(porId.get(id)?.cupo && restante(ctx, id) <= 0))
                  .map(([id]) => id)
                  .sort((a, b) => {
                    const ca = porId.get(a)!;
                    const cb = porId.get(b)!;
                    return (
                      Number(Boolean(ca.cupo)) - Number(Boolean(cb.cupo)) ||
                      (ca.semestre ?? 99) - (cb.semestre ?? 99) ||
                      (ca.orden ?? 99) - (cb.orden ?? 99)
                    );
                  });
                // Las de 0 créditos (inducción, pruebas, talento) van pequeñas abajo, como en la malla
                const principales = ids.filter((id) => (porId.get(id)?.creditos ?? 0) > 0);
                const extras = ids.filter((id) => (porId.get(id)?.creditos ?? 0) === 0);
                const cr = creditosSemestre(ctx, s);
                const u = umesSemestre(ctx, s);
                const pv = previsualizacion?.[s - 1];
                const yaAqui = sel && plan[sel.id] === s;
                const conPractica = practicaConMaterias(ctx, s);
                return (
                  <div
                    key={s}
                    className={`pcol ${arrastrandoSobre === s ? "drop" : ""} ${pv && !yaAqui ? (pv.ok ? "puede" : "nopuede") : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setArrastrandoSobre(s);
                    }}
                    onDragLeave={() => setArrastrandoSobre(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setArrastrandoSobre(null);
                      const id = e.dataTransfer.getData("text/plain");
                      if (id) colocar(id, s);
                    }}
                  >
                    <div className="col-head">S{s}</div>
                    <div className="pcol-body">
                      {principales.map((id) => {
                        const c = porId.get(id)!;
                        if (c.cupo) {
                          const r = restante(ctx, id);
                          return (
                            <div key={id} className="card pcard cupo" style={{ borderColor: AREAS[c.area].color, color: AREAS[c.area].color }}>
                              <button className="pcard-main" onClick={() => setSlotAbierto(id)}>
                                <span className="card-name">{c.nombre}</span>
                                <span className="card-meta">Por elegir · {r} cr</span>
                              </button>
                              <button className="pcard-x" aria-label={`Quitar ${c.nombre}`} onClick={() => quitar(id)}>×</button>
                            </div>
                          );
                        }
                        const est = estados.get(id);
                        const avisosVisibles = est?.avisos.filter((a) => a !== AVISO_PRACTICA) ?? [];
                        const mal = est && !est.ok;
                        return (
                          <div
                            key={id}
                            className={`card pcard ${selId === id ? "sel" : ""} ${mal ? "mal" : ""}`}
                            style={{
                              background: AREAS[c.area].color,
                              color: AREAS[c.area].texto,
                              flexGrow: c.creditos >= 12 ? Math.min(c.creditos / 3, 6) : undefined,
                            }}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", id);
                              setSelId(id);
                            }}
                            title={mal ? `No cumple: ${est!.faltan.join("; ")}` : avisosVisibles.join("; ") || undefined}
                          >
                            <button className="pcard-main" onClick={() => setSelId(selId === id ? null : id)}>
                              <span className="card-name">{c.etiqueta ?? c.nombre}</span>
                              <span className="card-meta">
                                {c.codigo} · {c.creditos} cr
                              </span>
                            </button>
                            {mal && <span className="pcard-flag">!</span>}
                            {!mal && avisosVisibles.length > 0 && <span className="pcard-flag aviso">!</span>}
                            <button className="pcard-x" aria-label={`Quitar ${c.nombre}`} onClick={() => quitar(id)}>×</button>
                          </div>
                        );
                      })}
                      {extras.length > 0 && (
                        <div className="extras">
                          {extras.map((id) => {
                            const c = porId.get(id)!;
                            const est = estados.get(id);
                            return (
                              <button
                                key={id}
                                className={`extra ${selId === id ? "sel" : ""} ${est && !est.ok ? "mal" : ""}`}
                                onClick={() => setSelId(selId === id ? null : id)}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("text/plain", id);
                                  setSelId(id);
                                }}
                                title={c.nombre}
                              >
                                {c.nombre}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {sel && !yaAqui && pv &&
                        (pv.ok ? (
                          <button className="sem-add" onClick={() => colocar(sel.id, s)}>
                            + {plan[sel.id] ? "Mover" : "Poner"}
                            {pv.avisos.length ? " ⚠" : ""}
                          </button>
                        ) : (
                          <button
                            className="sem-add no"
                            onClick={() => avisar({ tipo: "error", titulo: `No puedes poner ${sel.nombre} en el semestre ${s}`, detalles: pv.faltan })}
                            title={pv.faltan.join("\n")}
                          >
                            No se puede
                          </button>
                        ))}
                      {!sel && ids.length === 0 && <p className="sem-empty">Vacío</p>}
                    </div>
                    <div className="pcol-foot">
                      <b className={cr > MAX_CREDITOS ? "permiso" : ""}>{cr}</b>
                      <small>
                        {u.umes} UMES{u.porElegir ? ` + ${u.porElegir} por elegir` : ""}
                      </small>
                      {cr > MAX_CREDITOS && <small className="warn">Requiere permiso</small>}
                      {conPractica && (
                        <small className="warn" title={AVISO_PRACTICA}>
                          Con práctica: habla con Talento
                        </small>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="muted small leyenda-plan">
            Créditos por semestre: máximo {MAX_CREDITOS} ({MAX_CREDITOS_CON_PERMISO} con permiso). Las tarjetas con{" "}
            <span className="pcard-flag inline">!</span> no cumplen requisitos y las de{" "}
            <span className="pcard-flag aviso inline">!</span> tienen avisos: tócalas para ver el detalle.
          </p>

          <div className="btn-row sem-actions">
            <button className="btn" onClick={() => setSemestres(Math.min(MAX_SEMESTRES, semestres + 1))} disabled={semestres >= MAX_SEMESTRES}>
              + Agregar semestre
            </button>
            {semestres > 1 && (
              <button className="btn btn-ghost-danger" onClick={quitarSemestre}>
                Quitar semestre {semestres}
              </button>
            )}
          </div>
          <p className="nota">
            Es una herramienta de apoyo: la inscripción real se hace en Epik y las reglas oficiales pueden cambiar, así
            que confírmalo con la coordinación del programa. Las UMES te sirven para calcular el valor de la matrícula de
            cada semestre; las de los espacios por elegir dependen de la materia que escojas. Los correquisitos y el
            bilingüismo se muestran como avisos, pero no te bloquean.
          </p>
        </section>
      </div>

      {slot && plan[slot.id] !== undefined && (
        <SelectorEspacio
          slot={slot}
          semestre={plan[slot.id]}
          ctx={ctx}
          elecciones={elecciones}
          tipos={tipos}
          onElegir={(c) => {
            const ok = aplicar(c, plan[slot.id], simularColocacion(c, plan[slot.id], ctx, elecciones, tipos, slot.id));
            if (ok && c.creditos >= restante(ctx, slot.id)) setSlotAbierto(null);
          }}
          onClose={() => setSlotAbierto(null)}
        />
      )}
    </div>
  );
}

function SelectorEspacio({
  slot,
  semestre,
  ctx,
  elecciones,
  tipos,
  onElegir,
  onClose,
}: {
  slot: Curso;
  semestre: number;
  ctx: Contexto;
  elecciones: Elecciones;
  tipos: ReturnType<typeof tiposEleccion>;
  onElegir: (c: Curso) => void;
  onClose: () => void;
}) {
  const [verNoPosibles, setVerNoPosibles] = useState(false);
  const r = restante(ctx, slot.id);
  const prof = tipos.find((t) => t.k === "profesional");
  // "Trayectoria 1 · ..." usa la primera trayectoria escogida y "Trayectoria 2 · ..." la segunda
  const m = slot.nombre.match(/^Trayectoria (\d)/);
  const escogidaParaEsteEspacio = m && prof ? (elecciones.profesional ?? [])[Number(m[1]) - 1] : undefined;

  const grupos = ctx.p.grupos
    .filter((g) => slot.opciones?.includes(g.id))
    .filter((g) => {
      if (escogidaParaEsteEspacio) return g.id === escogidaParaEsteEspacio;
      // Espacio de "Trayectoria N" sin escoger: no ofrecer la trayectoria que ya es la otra
      if (m && prof) return !escogidos(elecciones, "profesional").includes(g.id);
      const t = tipos.find((x) => x.grupos.some((y) => y.id === g.id));
      if (!t) return true;
      const esc = escogidos(elecciones, t.k);
      return esc.length < t.limite || esc.includes(g.id);
    });
  const ocultos = (slot.opciones?.length ?? 0) - grupos.length;

  return (
    <Modal titulo={`${slot.nombre} · Semestre ${semestre}`} onClose={onClose} ancho={640}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Faltan {r} créditos por elegir en este espacio. Escoge una materia: se pone en el semestre {semestre}.
        {ocultos > 0 && " Solo se muestran tus elecciones; para ver otras opciones cámbialas en “Tus elecciones”."}
      </p>
      <label className="check small" style={{ marginBottom: 8 }}>
        <input type="checkbox" checked={verNoPosibles} onChange={(e) => setVerNoPosibles(e.target.checked)} /> Mostrar también las que
        no puedo ver en este semestre
      </label>
      <div className="selector">
        {grupos.map((g) => {
          const cursos = ctx.p.cursos.filter((c) => !c.cupo && c.codigo && c.grupos.includes(g.id) && ctx.plan[c.id] === undefined);
          const evaluados = cursos.map((c) => ({ c, sim: simularColocacion(c, semestre, ctx, elecciones, tipos, slot.id) }));
          const visibles = verNoPosibles ? evaluados : evaluados.filter((x) => x.sim.ev.ok);
          if (!verNoPosibles && visibles.length === 0) return null;
          return (
            <details key={g.id} open={grupos.length <= 2}>
              <summary>
                <span>{nombreCorto(g.nombre)}</span>
                <small>
                  {evaluados.filter((x) => x.sim.ev.ok).length} disponibles
                </small>
              </summary>
              {g.descripcion && <p className="grupo-desc">{g.descripcion}</p>}
              <ul>
                {visibles.map(({ c, sim }) => (
                  <li key={c.id}>
                    <button className={`opcion ${sim.ev.ok ? "" : "no"}`} disabled={!sim.ev.ok} onClick={() => onElegir(c)}>
                      <b>{c.nombre}</b>
                      <small>
                        {c.codigo} · {c.creditos} cr · {c.umes} UMES
                      </small>
                      {!sim.ev.ok && <span className="opcion-why">{sim.ev.faltan.slice(0, 2).join("; ")}</span>}
                      {sim.ev.ok && sim.ev.avisos.length > 0 && <span className="opcion-aviso">{sim.ev.avisos.join("; ")}</span>}
                    </button>
                  </li>
                ))}
                {visibles.length === 0 && <li className="muted small" style={{ padding: "6px 10px" }}>No hay materias disponibles aquí para este semestre.</li>}
              </ul>
            </details>
          );
        })}
      </div>
    </Modal>
  );
}
