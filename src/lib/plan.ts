import type { Curso, Grupo, Pensum, Requisito, Seccion } from "./types";

export const MAX_CREDITOS = 21;
export const MAX_CREDITOS_CON_PERMISO = 24;
export const SEMESTRES_INICIALES = 9;
export const MAX_SEMESTRES = 14;

export const AVISO_PRACTICA =
  "Para ver materias en el mismo semestre de la práctica necesitas hablar con Talento y con el jefe o encargado de la práctica.";

/** id de materia o de espacio por elegir -> número de semestre */
export type Plan = Record<string, number>;
/** id de materia -> id del espacio por elegir que llena */
export type Rellenos = Record<string, string>;
/** tipo de elección -> ids de los grupos escogidos */
export type Elecciones = Record<string, string[]>;

export interface Evaluacion {
  ok: boolean;
  faltan: string[];
  avisos: string[];
}

export interface Contexto {
  p: Pensum;
  porId: Map<string, Curso>;
  porCodigo: Map<string, Curso>;
  plan: Plan;
  rellenos: Rellenos;
}

export const esPractica = (c: Curso) => c.area === "practica" || c.codigo.startsWith("PT");
export const esObligatoria = (c: Curso) => Boolean(c.semestre) && !c.cupo;

/** Créditos que le faltan a un espacio por elegir */
export function restante(ctx: Contexto, slotId: string) {
  const slot = ctx.porId.get(slotId);
  if (!slot) return 0;
  let usados = 0;
  for (const [id, s] of Object.entries(ctx.rellenos)) {
    if (s === slotId && ctx.plan[id] !== undefined) usados += ctx.porId.get(id)?.creditos ?? 0;
  }
  return Math.max(0, slot.creditos - usados);
}

/** Créditos que pesa una entrada del plan (los espacios solo cuentan lo que les falta) */
function peso(ctx: Contexto, id: string) {
  const c = ctx.porId.get(id);
  if (!c) return 0;
  return c.cupo ? restante(ctx, id) : c.creditos;
}

export function creditosSemestre(ctx: Contexto, s: number) {
  let t = 0;
  for (const [id, sem] of Object.entries(ctx.plan)) if (sem === s) t += peso(ctx, id);
  return t;
}

export function creditosAntesDe(ctx: Contexto, s: number) {
  let t = 0;
  for (const [id, sem] of Object.entries(ctx.plan)) if (sem < s) t += peso(ctx, id);
  return t;
}

export function umesSemestre(ctx: Contexto, s: number) {
  let umes = 0;
  let porElegir = 0;
  for (const [id, sem] of Object.entries(ctx.plan)) {
    if (sem !== s) continue;
    const c = ctx.porId.get(id);
    if (!c) continue;
    if (c.cupo) {
      if (restante(ctx, id) > 0) porElegir++;
    } else umes += c.umes;
  }
  return { umes, porElegir };
}

/** ¿Hay práctica y además otras materias con créditos en ese semestre? */
export function practicaConMaterias(ctx: Contexto, s: number) {
  let practica = false;
  let otras = false;
  for (const [id, sem] of Object.entries(ctx.plan)) {
    if (sem !== s) continue;
    const c = ctx.porId.get(id);
    if (!c) continue;
    if (esPractica(c)) practica = true;
    else if (peso(ctx, id) > 0) otras = true;
  }
  return practica && otras;
}

function nombreReq(r: Requisito, porCodigo: Map<string, Curso>) {
  const c = r.codigo ? porCodigo.get(r.codigo) : undefined;
  return `${c?.nombre ?? r.nombre ?? r.codigo} (${r.codigo})`;
}

/* ---------------- Bilingüismo ---------------- */

// El plan de estudios pide dos requisitos de bilingüismo distintos. Se muestran como
// "Bilingüismo 1" y "Bilingüismo 2" (en el orden del nivel que cita el PDF), sin decir el nivel.
export const PREFIJO_BIL = "BIL-";

const nivelesBil = (p: Pensum) => {
  const vals = new Set<string>();
  for (const c of p.cursos) for (const alt of c.requisitos) for (const r of alt) if (r.tipo === "bilinguismo") vals.add(String(r.valor ?? ""));
  return [...vals].sort();
};

/** id del hito que cumple el requisito de bilingüismo con ese texto */
export function idBilinguismo(p: Pensum, valor: string) {
  const i = nivelesBil(p).indexOf(valor);
  return i < 0 ? undefined : `${PREFIJO_BIL}${i + 1}`;
}

export const pideBilinguismo = (c: Curso, valor?: string) =>
  c.requisitos.some((alt) => alt.some((r) => r.tipo === "bilinguismo" && (valor === undefined || String(r.valor ?? "") === valor)));

/** Hitos de bilingüismo para poner en el plan como materias de 0 créditos */
export function cursosBilinguismo(p: Pensum): Curso[] {
  return nivelesBil(p).map((valor, i) => ({
    id: `${PREFIJO_BIL}${i + 1}`,
    codigo: `${PREFIJO_BIL}${i + 1}`,
    nombre: `Bilingüismo ${i + 1}`,
    creditos: 0,
    umes: 0,
    semestre: null,
    area: "institucional" as const,
    requisitos: [],
    grupos: [],
    nota: `Ponerlo en un semestre significa que cumples el requisito de bilingüismo ${i + 1} en ese semestre; las materias que lo piden van en semestres posteriores.`,
    // texto original del plan de estudios, para relacionarlo con las materias que lo piden
    _valor: valor,
  }));
}

/** Prerrequisitos, correquisitos, créditos aprobados y bilingüismo del curso c puesto en el semestre s */
export function evaluarRequisitos(c: Curso, s: number, ctx: Contexto): Evaluacion {
  if (!c.requisitos.length) return { ok: true, faltan: [], avisos: [] };
  const aprobados = creditosAntesDe(ctx, s);

  const resultados = c.requisitos.map((alt) => {
    const faltan: string[] = [];
    const avisos: string[] = [];
    for (const r of alt) {
      if (r.tipo === "pre" || r.tipo === "co") {
        const req = r.codigo ? ctx.porCodigo.get(r.codigo) : undefined;
        const nombre = nombreReq(r, ctx.porCodigo);
        if (!req) {
          if (r.codigo?.startsWith("PT")) faltan.push(`${nombre}, que es de otra carrera`);
          else avisos.push(`Pide ${nombre}, que no aparece en este pénsum: confirma con la coordinación cómo se cumple`);
          continue;
        }
        const sem = ctx.plan[req.id];
        if (r.tipo === "pre") {
          if (sem === undefined) faltan.push(`Ver antes ${nombre}: todavía no está en tu plan`);
          else if (sem >= s) faltan.push(`Ver antes ${nombre}: la tienes en el semestre ${sem}`);
        } else {
          if (sem === undefined) avisos.push(`Correquisito: ${nombre} se debe ver en este semestre o antes, y todavía no está en tu plan`);
          else if (sem > s) avisos.push(`Correquisito: ${nombre} está en el semestre ${sem}; debe ir en este semestre o antes`);
        }
      } else if (r.tipo === "creditos") {
        const v = Number(r.valor ?? 0);
        if (aprobados < v) faltan.push(`Tener ${v} créditos aprobados (hasta el semestre anterior llevarías ${aprobados})`);
      } else if (r.tipo === "bilinguismo") {
        const id = idBilinguismo(ctx.p, String(r.valor ?? ""));
        const nombre = id ? ctx.porId.get(id)?.nombre ?? "bilingüismo" : "bilingüismo";
        const cumplido = id ? ctx.plan[id] : undefined;
        if (cumplido === undefined) faltan.push(`Cumplir ${nombre} antes: ponlo en tu plan en el semestre en que lo cumples`);
        else if (cumplido >= s)
          faltan.push(`Cumplir ${nombre} antes: lo tienes en el semestre ${cumplido}, y estar en un semestre significa que lo cumples ahí`);
      }
    }
    return { faltan, avisos };
  });

  const cumplidas = resultados.filter((r) => r.faltan.length === 0);
  if (cumplidas.length) {
    cumplidas.sort((a, b) => a.avisos.length - b.avisos.length);
    return { ok: true, faltan: [], avisos: cumplidas[0].avisos };
  }
  if (resultados.length === 1) return { ok: false, faltan: resultados[0].faltan, avisos: [] };
  return { ok: false, faltan: resultados.map((r, i) => `Opción ${i + 1}: ${r.faltan.join("; ")}`), avisos: [] };
}

/* ---------------- Elecciones: trayectorias y línea de énfasis ---------------- */

export interface TipoEleccion {
  k: string;
  nombre: string;
  /** "tu trayectoria profesionalizante", para armar mensajes */
  articulo: string;
  limite: number;
  grupos: Grupo[];
}

export function tiposEleccion(p: Pensum): TipoEleccion[] {
  const out: TipoEleccion[] = [];
  const prof = p.grupos.filter((g) => g.seccion === "obligatorios" && g.nombre.startsWith("Trayectoria"));
  if (prof.length > 1)
    out.push({ k: "profesional", nombre: "Trayectorias profesionalizantes", articulo: "tus trayectorias profesionalizantes", limite: 2, grupos: prof });
  const flex = p.grupos.filter((g) => g.seccion === "complementarios");
  if (flex.length > 1) {
    const sonTrayectorias = flex.every((g) => g.nombre.startsWith("Trayectoria"));
    out.push({
      k: "flexible",
      nombre: sonTrayectorias ? "Trayectoria flexible" : "Complementarias",
      articulo: sonTrayectorias ? "tu trayectoria flexible" : "tu grupo de complementarias",
      limite: 1,
      grupos: flex,
    });
  }
  const enf = p.grupos.filter((g) => g.seccion === "enfasis");
  if (enf.length > 1) {
    const info = p.info.find((i) => i.etiqueta.toLowerCase().includes("líneas de énfasis"));
    const limite = Number(info?.valor) || 1;
    out.push({ k: "enfasis", nombre: "Línea de énfasis", articulo: "tu línea de énfasis", limite, grupos: enf });
  }
  return out;
}

const nombreGrupo = (g: Grupo) => g.nombre.replace(/^Trayectoria (en )?/, "");

/** Grupos escogidos de un tipo (las elecciones son posicionales: "" = opción sin escoger) */
export const escogidos = (e: Elecciones, k: string) => (e[k] ?? []).filter(Boolean);

/** Pone el grupo en la posición pedida (o en la primera libre) */
export function conEleccion(e: Elecciones, k: string, grupo: string, posicion?: number): Elecciones {
  const arr = [...(e[k] ?? [])];
  let i = posicion ?? arr.findIndex((x) => !x);
  if (i < 0) i = arr.length;
  if (arr[i] && arr[i] !== grupo) {
    // la posición pedida ya está ocupada: usar la primera libre
    i = arr.findIndex((x) => !x);
    if (i < 0) i = arr.length;
  }
  while (arr.length < i) arr.push("");
  arr[i] = grupo;
  return { ...e, [k]: arr };
}

export interface EvalEleccion extends Evaluacion {
  /** Si la materia define una elección que todavía estaba libre */
  agregar?: { k: string; grupo: string };
}

/** ¿La materia es de las trayectorias/énfasis escogidos? (o se puede escoger automáticamente) */
export function evaluarEleccion(c: Curso, elecciones: Elecciones, tipos: TipoEleccion[]): EvalEleccion {
  if (esObligatoria(c)) return { ok: true, faltan: [], avisos: [] };
  const relevantes = tipos.filter((t) => t.grupos.some((g) => c.grupos.includes(g.id)));
  if (!relevantes.length) return { ok: true, faltan: [], avisos: [] };
  if (relevantes.some((t) => escogidos(elecciones, t.k).some((g) => c.grupos.includes(g))))
    return { ok: true, faltan: [], avisos: [] };

  const libres = relevantes.filter((t) => escogidos(elecciones, t.k).length < t.limite);
  if (libres.length === 1) {
    const gruposDeC = libres[0].grupos.filter((g) => c.grupos.includes(g.id));
    if (gruposDeC.length === 1) return { ok: true, faltan: [], avisos: [], agregar: { k: libres[0].k, grupo: gruposDeC[0].id } };
    return {
      ok: false,
      faltan: [
        `Esta materia está en varias opciones de ${libres[0].nombre.toLowerCase()} (${gruposDeC.map(nombreGrupo).join(", ")}). Escoge primero ${libres[0].articulo} en "Tus elecciones".`,
      ],
      avisos: [],
    };
  }
  if (libres.length > 1) {
    return {
      ok: false,
      faltan: [`Esta materia puede contar en varias partes del plan (${libres.map((t) => t.nombre.toLowerCase()).join(" o ")}). Escoge primero en "Tus elecciones" a cuál la quieres sumar.`],
      avisos: [],
    };
  }
  const t = relevantes[0];
  const escogidas = escogidos(elecciones, t.k).map((id) => t.grupos.find((g) => g.id === id)).filter(Boolean) as Grupo[];
  const deC = t.grupos.filter((g) => c.grupos.includes(g.id)).map(nombreGrupo);
  return {
    ok: false,
    faltan: [
      `Solo puedes escoger ${t.limite === 1 ? "una" : t.limite} en ${t.nombre.toLowerCase()} y ya escogiste: ${escogidas.map(nombreGrupo).join(" y ")}. Esta materia es de ${deC.join(", ")}; si la quieres, cambia ${t.articulo} en "Tus elecciones".`,
    ],
    avisos: [],
  };
}

/* ---------------- Colocación ---------------- */

/** Espacio por elegir que llenaría la materia: uno en el mismo semestre si hay, si no el primero */
export function espacioParaLlenar(c: Curso, s: number, ctx: Contexto, elecciones: Elecciones, tipos: TipoEleccion[]) {
  if (esObligatoria(c) || ctx.rellenos[c.id]) return ctx.rellenos[c.id];
  const candidatos = Object.entries(ctx.plan)
    .map(([id, sem]) => ({ slot: ctx.porId.get(id), sem }))
    .filter(({ slot }) => slot?.cupo && slot.opciones?.some((g) => c.grupos.includes(g)) && restante(ctx, slot.id) > 0);
  // Respetar trayectoria 1 / 2 cuando las dos están escogidas
  const prof = tipos.find((t) => t.k === "profesional");
  const ordenProf = prof ? (elecciones.profesional ?? []).findIndex((g) => c.grupos.includes(g)) : -1;
  const filtrados = candidatos.filter(({ slot }) => {
    if (ordenProf < 0 || !slot) return true;
    const m = slot.nombre.match(/^Trayectoria (\d)/);
    return !m || Number(m[1]) === ordenProf + 1;
  });
  const lista = (filtrados.length ? filtrados : candidatos).sort(
    (a, b) => Number(b.sem === s) - Number(a.sem === s) || a.sem - b.sem
  );
  return lista[0]?.slot?.id;
}

export interface Simulacion {
  plan: Plan;
  rellenos: Rellenos;
  elecciones: Elecciones;
  ev: Evaluacion;
  /** Elección que se agregó automáticamente */
  agregada?: { k: string; grupo: string };
}

/** Simula poner (o mover) el curso c en el semestre s y dice si se puede */
export function simularColocacion(
  c: Curso,
  s: number,
  ctx: Contexto,
  elecciones: Elecciones,
  tipos: TipoEleccion[],
  slotForzado?: string
): Simulacion {
  const ele = evaluarEleccion(c, elecciones, tipos);
  let elecciones2: Elecciones = { ...elecciones };
  if (ele.agregar) {
    // Si se escoge desde "Trayectoria 2 · …", la trayectoria queda como la 2
    const slotNombre = slotForzado ? ctx.porId.get(slotForzado)?.nombre ?? "" : "";
    const m = slotNombre.match(/^Trayectoria (\d)/);
    const pos = ele.agregar.k === "profesional" && m ? Number(m[1]) - 1 : undefined;
    elecciones2 = conEleccion(elecciones, ele.agregar.k, ele.agregar.grupo, pos);
  }

  const plan2: Plan = { ...ctx.plan, [c.id]: s };
  const rellenos2: Rellenos = { ...ctx.rellenos };
  if (!c.cupo) {
    const slot = slotForzado ?? espacioParaLlenar(c, s, ctx, elecciones2, tipos);
    if (slot) rellenos2[c.id] = slot;
  }
  const ctx2: Contexto = { ...ctx, plan: plan2, rellenos: rellenos2 };

  const faltan: string[] = [...ele.faltan];
  const avisos: string[] = [];
  if (!c.cupo) {
    const req = evaluarRequisitos(c, s, ctx2);
    faltan.push(...req.faltan);
    avisos.push(...req.avisos);
  }
  const total = creditosSemestre(ctx2, s);
  if (total > MAX_CREDITOS_CON_PERMISO) {
    faltan.unshift(`El semestre ${s} quedaría con ${total} créditos y el máximo, aun con permiso, es ${MAX_CREDITOS_CON_PERMISO}`);
  } else if (total > MAX_CREDITOS) {
    avisos.unshift(`El semestre ${s} quedaría con ${total} créditos: pasar de ${MAX_CREDITOS} requiere permiso (máximo ${MAX_CREDITOS_CON_PERMISO})`);
  }
  if (practicaConMaterias(ctx2, s)) avisos.push(AVISO_PRACTICA);

  return {
    plan: plan2,
    rellenos: rellenos2,
    elecciones: elecciones2,
    ev: { ok: faltan.length === 0, faltan, avisos },
    agregada: ele.agregar,
  };
}

/* ---------------- Progreso por bolsa de créditos ---------------- */

export type Categoria = "obligatorios" | "nfi" | "complementarios" | "enfasis" | "otras";

function categoriaDeSecciones(secciones: Set<Seccion>, obligatoria: boolean): Categoria {
  if (secciones.has("nfi")) return "nfi";
  if (obligatoria || secciones.has("obligatorios")) return "obligatorios";
  if (secciones.has("complementarios")) return "complementarios";
  if (secciones.has("enfasis")) return "enfasis";
  return "otras";
}

export function categoriaCurso(c: Curso, p: Pensum): Categoria {
  const ids = c.cupo ? c.opciones ?? [] : c.grupos;
  const secciones = new Set(p.grupos.filter((g) => ids.includes(g.id)).map((g) => g.seccion));
  return categoriaDeSecciones(secciones, esObligatoria(c) && !c.cupo);
}

export function creditosRequeridos(p: Pensum): Partial<Record<Categoria, number>> {
  const out: Partial<Record<Categoria, number>> = {};
  for (const i of p.info) {
    const v = Number(i.valor);
    const e = i.etiqueta.toLowerCase();
    if (!Number.isFinite(v) || !e.includes("créditos")) continue;
    if (e.includes("obligatorios")) out.obligatorios = v;
    else if (e.includes("humanidades") || e.includes("institucional")) out.nfi = v;
    else if (e.includes("complementarios")) out.complementarios = v;
    else if (e.includes("énfasis")) out.enfasis = v;
  }
  return out;
}

/** Créditos por bolsa: lo ya escogido y lo que está en espacios por elegir */
export function progreso(ctx: Contexto) {
  const llevas: Record<Categoria, number> = { obligatorios: 0, nfi: 0, complementarios: 0, enfasis: 0, otras: 0 };
  const porElegir: Record<Categoria, number> = { obligatorios: 0, nfi: 0, complementarios: 0, enfasis: 0, otras: 0 };
  for (const id of Object.keys(ctx.plan)) {
    const c = ctx.porId.get(id);
    if (!c) continue;
    if (c.cupo) porElegir[categoriaCurso(c, ctx.p)] += restante(ctx, id);
    else {
      // Lo que llena un espacio cuenta en la bolsa de ese espacio
      const slot = ctx.rellenos[id] ? ctx.porId.get(ctx.rellenos[id]) : undefined;
      llevas[categoriaCurso(slot ?? c, ctx.p)] += c.creditos;
    }
  }
  return { llevas, porElegir };
}
