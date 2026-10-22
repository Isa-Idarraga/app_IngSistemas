"use client";

import { useMemo, useRef, useState } from "react";
import {
  AREAS,
  SECCIONES,
  type Area,
  type Curso,
  type Grupo,
  type Pensum,
  type Requisito,
  type Seccion,
  type TipoRequisito,
} from "@/lib/types";

type Filtro = "malla" | "todas" | string;

function slug(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function PensumAdmin({ pensums }: { pensums: Pensum[] }) {
  const [todos, setTodos] = useState<Record<string, Pensum>>(() => Object.fromEntries(pensums.map((p) => [p.id, p])));
  const [pid, setPid] = useState(pensums[0].id);
  const [sucios, setSucios] = useState<Record<string, boolean>>({});
  const [selId, setSelId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("malla");
  const [buscar, setBuscar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ t: string; error?: boolean } | null>(null);
  const [vistaGrupos, setVistaGrupos] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);

  const p = todos[pid];
  const sel = p.cursos.find((c) => c.id === selId) ?? null;

  function actualizar(fn: (p: Pensum) => Pensum) {
    setTodos((t) => ({ ...t, [pid]: fn(structuredClone(t[pid])) }));
    setSucios((s) => ({ ...s, [pid]: true }));
  }

  function editarCurso(id: string, cambios: Partial<Curso>) {
    actualizar((p) => {
      p.cursos = p.cursos.map((c) => (c.id === id ? { ...c, ...cambios } : c));
      return p;
    });
  }

  function aviso(t: string, error = false) {
    setMsg({ t, error });
    if (!error) setTimeout(() => setMsg(null), 2500);
  }

  async function guardar() {
    setGuardando(true);
    const r = await fetch(`/api/pensums/${pid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    setGuardando(false);
    if (r.ok) {
      setSucios((s) => ({ ...s, [pid]: false }));
      aviso("Cambios guardados");
    } else aviso((await r.json().catch(() => ({}))).error ?? "No se pudo guardar", true);
  }

  async function restaurar() {
    const r = await fetch(`/api/pensums/${pid}`, { method: "DELETE" });
    setConfirmar(null);
    if (!r.ok) return aviso((await r.json().catch(() => ({}))).error ?? "No se pudo restaurar", true);
    const data = (await r.json()) as Pensum;
    setTodos((t) => ({ ...t, [pid]: data }));
    setSucios((s) => ({ ...s, [pid]: false }));
    setSelId(null);
    aviso("Pénsum restaurado a los datos del PDF");
  }

  function nuevoCurso(cupo: boolean) {
    const id = cupo ? `cupo-${Date.now().toString(36)}` : `nuevo-${Date.now().toString(36)}`;
    const curso: Curso = {
      id,
      codigo: "",
      nombre: cupo ? "Nuevo espacio" : "Nueva materia",
      creditos: 3,
      umes: 0,
      semestre: filtro === "malla" ? 1 : null,
      area: cupo ? "trayectoria" : "profesional",
      requisitos: [],
      grupos: filtro !== "malla" && filtro !== "todas" ? [filtro] : [],
      ...(cupo ? { cupo: true, opciones: [] } : {}),
    };
    actualizar((p) => {
      p.cursos.push(curso);
      return p;
    });
    setSelId(id);
  }

  function eliminarCurso(id: string) {
    actualizar((p) => {
      p.cursos = p.cursos.filter((c) => c.id !== id);
      return p;
    });
    setSelId(null);
    setConfirmar(null);
  }

  function renombrarCodigo(id: string, viejo: string, nuevo: string) {
    if (!viejo || viejo === nuevo) return;
    actualizar((p) => {
      for (const c of p.cursos) {
        if (c.id === id && c.id === viejo && nuevo) c.id = nuevo;
        for (const alt of c.requisitos) for (const r of alt) if (r.codigo === viejo) r.codigo = nuevo;
      }
      return p;
    });
    if (id === viejo && nuevo) setSelId(nuevo);
  }

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    let cs = p.cursos;
    if (filtro === "malla") cs = cs.filter((c) => c.semestre);
    else if (filtro !== "todas") cs = cs.filter((c) => c.grupos.includes(filtro) || c.opciones?.includes(filtro));
    if (q) cs = cs.filter((c) => c.nombre.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q));
    return [...cs].sort((a, b) => (a.semestre ?? 99) - (b.semestre ?? 99) || (a.orden ?? 99) - (b.orden ?? 99) || a.codigo.localeCompare(b.codigo));
  }, [p, filtro, buscar]);

  return (
    <div>
      <div className="admin-toolbar">
        <div className="seg">
          {pensums.map((x) => (
            <button
              key={x.id}
              className={x.id === pid ? "on" : ""}
              onClick={() => {
                setPid(x.id);
                setSelId(null);
                setFiltro("malla");
              }}
            >
              {x.nombre}
              {sucios[x.id] ? " •" : ""}
            </button>
          ))}
        </div>
        <button className="btn btn-sm" onClick={() => setVistaGrupos(!vistaGrupos)}>
          {vistaGrupos ? "← Volver a materias" : "Editar grupos"}
        </button>
        {confirmar === "reset" ? (
          <>
            <span className="muted small">¿Borrar todos los cambios de {p.nombre}?</span>
            <button className="btn btn-sm btn-danger" onClick={restaurar}>Sí, restaurar</button>
            <button className="btn btn-sm" onClick={() => setConfirmar(null)}>No</button>
          </>
        ) : (
          <button className="btn btn-sm btn-ghost-danger" onClick={() => setConfirmar("reset")}>Restaurar del PDF</button>
        )}
      </div>

      <div className={`savebar ${sucios[pid] ? "on" : ""}`}>
        <span>{sucios[pid] ? `Tienes cambios sin guardar en ${p.nombre}` : "Todo guardado"}</span>
        {msg && <span className={msg.error ? "error" : "toast"}>{msg.t}</span>}
        <button className="btn btn-primary" disabled={!sucios[pid] || guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      {vistaGrupos ? (
        <GruposEditor p={p} actualizar={actualizar} />
      ) : (
        <div className="editor">
          <div className="editor-list">
            <div className="editor-list-head">
              <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
                <option value="malla">Materias en la malla</option>
                <option value="todas">Todas las materias</option>
                {(Object.keys(SECCIONES) as Seccion[]).map((s) => (
                  <optgroup key={s} label={SECCIONES[s]}>
                    {p.grupos
                      .filter((g) => g.seccion === s)
                      .map((g) => (
                        <option key={g.id} value={g.id}>{g.nombre}</option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <input className="search" placeholder="Buscar…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              <div className="btn-row">
                <button className="btn btn-sm" onClick={() => nuevoCurso(false)}>+ Materia</button>
                <button className="btn btn-sm" onClick={() => nuevoCurso(true)} title="Un espacio como 'Electiva 1' o 'NFI 3' que se llena con opciones">
                  + Espacio por elegir
                </button>
              </div>
            </div>
            <ul>
              {lista.map((c) => (
                <li key={c.id}>
                  <button className={c.id === selId ? "on" : ""} onClick={() => setSelId(c.id)}>
                    <i style={{ background: AREAS[c.area].color }} />
                    <span>
                      <b>{c.etiqueta ?? c.nombre}</b>
                      <small>
                        {c.codigo || (c.cupo ? "Espacio por elegir" : "Sin código")}
                        {c.semestre ? ` · S${c.semestre}` : ""} · {c.creditos} cr
                      </small>
                    </span>
                  </button>
                </li>
              ))}
              {lista.length === 0 && <li className="muted small" style={{ padding: 12 }}>Nada por aquí.</li>}
            </ul>
          </div>
          <div className="editor-form">
            {sel ? (
              <CursoForm
                key={sel.id + pid}
                c={sel}
                p={p}
                onChange={(cambios) => editarCurso(sel.id, cambios)}
                onRenombrar={(viejo, nuevo) => renombrarCodigo(sel.id, viejo, nuevo)}
                onEliminar={() => eliminarCurso(sel.id)}
              />
            ) : (
              <div className="empty">
                <p>Elige una materia de la lista para editarla, o crea una nueva.</p>
                <p className="muted small">
                  Los cambios se aplican aquí al instante; dale “Guardar cambios” para publicarlos en la página.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CursoForm({
  c,
  p,
  onChange,
  onRenombrar,
  onEliminar,
}: {
  c: Curso;
  p: Pensum;
  onChange: (cambios: Partial<Curso>) => void;
  onRenombrar: (viejo: string, nuevo: string) => void;
  onEliminar: () => void;
}) {
  const codigoInicial = useRef(c.codigo);
  const [seguro, setSeguro] = useState(false);
  const maxSem = Math.max(10, ...p.cursos.map((x) => x.semestre ?? 0));
  const codigos = p.cursos.filter((x) => x.codigo && x.id !== c.id);

  function toggle(lista: string[] | undefined, id: string) {
    const s = new Set(lista ?? []);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    return [...s];
  }

  return (
    <div className="form">
      <div className="form-row">
        <label className="field">
          <span>Código</span>
          <input
            value={c.codigo}
            placeholder={c.cupo ? "(vacío para espacios por elegir)" : "Ej: SI2001"}
            onFocus={() => (codigoInicial.current = c.codigo)}
            onChange={(e) => onChange({ codigo: e.target.value.toUpperCase().trim() })}
            onBlur={() => onRenombrar(codigoInicial.current, c.codigo)}
          />
        </label>
        <label className="field grow2">
          <span>Nombre *</span>
          <input value={c.nombre} onChange={(e) => onChange({ nombre: e.target.value })} />
        </label>
      </div>
      <label className="field">
        <span>Nombre corto en la malla (opcional)</span>
        <input value={c.etiqueta ?? ""} onChange={(e) => onChange({ etiqueta: e.target.value || undefined })} />
      </label>
      <div className="form-row">
        <label className="field">
          <span>Créditos</span>
          <input type="number" min={0} value={c.creditos} onChange={(e) => onChange({ creditos: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>UMES</span>
          <input type="number" min={0} value={c.umes} onChange={(e) => onChange({ umes: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>Semestre en la malla</span>
          <select value={c.semestre ?? ""} onChange={(e) => onChange({ semestre: e.target.value ? Number(e.target.value) : null })}>
            <option value="">— No aparece en la malla —</option>
            {Array.from({ length: maxSem }, (_, i) => i + 1).map((s) => (
              <option key={s} value={s}>Semestre {s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Posición en la columna</span>
          <input type="number" min={1} value={c.orden ?? ""} onChange={(e) => onChange({ orden: e.target.value ? Number(e.target.value) : undefined })} />
        </label>
        <label className="field">
          <span>Color / área</span>
          <select value={c.area} onChange={(e) => onChange({ area: e.target.value as Area })}>
            {(Object.keys(AREAS) as Area[]).map((a) => (
              <option key={a} value={a}>{AREAS[a].nombre}</option>
            ))}
          </select>
        </label>
      </div>
      {c.semestre ? (
        <label className="check">
          <input type="checkbox" checked={Boolean(c.secundario)} onChange={(e) => onChange({ secundario: e.target.checked || undefined })} />
          Mostrar pequeño como “requisito adicional” (no suma créditos en la columna)
        </label>
      ) : null}
      <label className="check">
        <input
          type="checkbox"
          checked={Boolean(c.cupo)}
          onChange={(e) => onChange(e.target.checked ? { cupo: true, opciones: c.opciones ?? [] } : { cupo: undefined, opciones: undefined })}
        />
        Es un espacio por elegir (ej. Electiva, NFI, Flexible)
      </label>

      {c.cupo ? (
        <fieldset className="box">
          <legend>Opciones que se muestran para este espacio</legend>
          <GrupoChecks p={p} marcados={c.opciones ?? []} onToggle={(id) => onChange({ opciones: toggle(c.opciones, id) })} />
        </fieldset>
      ) : (
        <fieldset className="box">
          <legend>Requisitos</legend>
          <RequisitosEditor reqs={c.requisitos} codigos={codigos} onChange={(requisitos) => onChange({ requisitos })} />
        </fieldset>
      )}

      <fieldset className="box">
        <legend>Grupos a los que pertenece (catálogo)</legend>
        <GrupoChecks p={p} marcados={c.grupos} onToggle={(id) => onChange({ grupos: toggle(c.grupos, id) })} />
      </fieldset>

      <label className="field">
        <span>Descripción de contenidos (deja una línea en blanco entre párrafos)</span>
        <textarea
          rows={6}
          placeholder="De qué se trata la materia, qué temas se ven…"
          value={c.descripcion ?? ""}
          onChange={(e) => onChange({ descripcion: e.target.value || undefined })}
        />
      </label>

      <fieldset className="box">
        <legend>Enlaces (sitio del curso, material…)</legend>
        {(c.enlaces ?? []).map((en, i) => (
          <div key={i} className="req-row" style={{ marginBottom: 6 }}>
            <input
              style={{ flex: "none", width: 170 }}
              placeholder="Título"
              value={en.titulo}
              onChange={(e) => {
                const n = [...(c.enlaces ?? [])];
                n[i] = { ...n[i], titulo: e.target.value };
                onChange({ enlaces: n });
              }}
            />
            <input
              type="url"
              placeholder="https://…"
              value={en.url}
              onChange={(e) => {
                const n = [...(c.enlaces ?? [])];
                n[i] = { ...n[i], url: e.target.value.trim() };
                onChange({ enlaces: n });
              }}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label="Quitar enlace"
              onClick={() => {
                const n = (c.enlaces ?? []).filter((_, j) => j !== i);
                onChange({ enlaces: n.length ? n : undefined });
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="link"
          onClick={() => onChange({ enlaces: [...(c.enlaces ?? []), { titulo: "Sitio del curso", url: "" }] })}
        >
          + Agregar enlace
        </button>
      </fieldset>

      <label className="field">
        <span>Nota (se muestra al abrir la materia)</span>
        <textarea rows={2} value={c.nota ?? ""} onChange={(e) => onChange({ nota: e.target.value || undefined })} />
      </label>

      <div className="form-actions start">
        {seguro ? (
          <>
            <button className="btn btn-danger" onClick={onEliminar}>Sí, eliminar materia</button>
            <button className="btn" onClick={() => setSeguro(false)}>Cancelar</button>
          </>
        ) : (
          <button className="btn btn-ghost-danger" onClick={() => setSeguro(true)}>Eliminar materia</button>
        )}
      </div>
    </div>
  );
}

function GrupoChecks({ p, marcados, onToggle }: { p: Pensum; marcados: string[]; onToggle: (id: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const visibles = abierto ? p.grupos : p.grupos.filter((g) => marcados.includes(g.id));
  return (
    <div>
      <div className="checks">
        {visibles.map((g) => (
          <label key={g.id} className="check">
            <input type="checkbox" checked={marcados.includes(g.id)} onChange={() => onToggle(g.id)} />
            {g.nombre}
          </label>
        ))}
        {!abierto && visibles.length === 0 && <span className="muted small">Ninguno.</span>}
      </div>
      <button type="button" className="link" onClick={() => setAbierto(!abierto)}>
        {abierto ? "Mostrar solo los marcados" : "Cambiar grupos…"}
      </button>
    </div>
  );
}

const TIPOS: Record<TipoRequisito, string> = {
  pre: "Prerrequisito",
  co: "Correquisito",
  creditos: "Créditos aprobados",
  bilinguismo: "Bilingüismo",
};

function RequisitosEditor({
  reqs,
  codigos,
  onChange,
}: {
  reqs: Requisito[][];
  codigos: Curso[];
  onChange: (r: Requisito[][]) => void;
}) {
  const nombrePorCodigo = new Map(codigos.map((c) => [c.codigo, c.nombre]));
  const listId = useRef(`codigos-${Math.random().toString(36).slice(2)}`).current;

  function setItem(a: number, i: number, cambios: Partial<Requisito>) {
    const n = structuredClone(reqs);
    const item = { ...n[a][i], ...cambios };
    if (cambios.tipo) {
      if (cambios.tipo === "pre" || cambios.tipo === "co") delete item.valor;
      else {
        delete item.codigo;
        delete item.nombre;
        item.valor = cambios.tipo === "creditos" ? 0 : "Cumplimiento A1 Bilinguismo";
      }
    }
    if (cambios.codigo !== undefined) item.nombre = nombrePorCodigo.get(cambios.codigo) ?? item.nombre;
    n[a][i] = item;
    onChange(n);
  }

  return (
    <div className="reqs">
      <datalist id={listId}>
        {codigos.map((c) => (
          <option key={c.id} value={c.codigo}>{c.nombre}</option>
        ))}
      </datalist>
      {reqs.length === 0 && <p className="muted small">Sin requisitos.</p>}
      {reqs.map((alt, a) => (
        <div key={a} className="alt">
          {a > 0 && <div className="o-sep">o bien</div>}
          {reqs.length > 1 && (
            <div className="alt-head">
              <small>Opción {a + 1}</small>
              <button type="button" className="link danger" onClick={() => onChange(reqs.filter((_, i) => i !== a))}>
                Quitar opción
              </button>
            </div>
          )}
          {alt.map((r, i) => (
            <div key={i} className="req-row">
              <select value={r.tipo} onChange={(e) => setItem(a, i, { tipo: e.target.value as TipoRequisito })}>
                {(Object.keys(TIPOS) as TipoRequisito[]).map((t) => (
                  <option key={t} value={t}>{TIPOS[t]}</option>
                ))}
              </select>
              {r.tipo === "pre" || r.tipo === "co" ? (
                <>
                  <input
                    className="code-in"
                    list={listId}
                    placeholder="Código"
                    value={r.codigo ?? ""}
                    onChange={(e) => setItem(a, i, { codigo: e.target.value.toUpperCase().trim() })}
                  />
                  <input
                    placeholder="Nombre"
                    value={r.nombre ?? ""}
                    onChange={(e) => setItem(a, i, { nombre: e.target.value })}
                  />
                </>
              ) : r.tipo === "creditos" ? (
                <input type="number" min={0} value={Number(r.valor ?? 0)} onChange={(e) => setItem(a, i, { valor: Number(e.target.value) })} />
              ) : (
                <input value={String(r.valor ?? "")} onChange={(e) => setItem(a, i, { valor: e.target.value })} />
              )}
              <button
                type="button"
                className="icon-btn"
                aria-label="Quitar"
                onClick={() => {
                  const n = structuredClone(reqs);
                  n[a].splice(i, 1);
                  onChange(n.filter((x) => x.length));
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="link"
            onClick={() => {
              const n = structuredClone(reqs);
              n[a].push({ tipo: "pre", codigo: "", nombre: "" });
              onChange(n);
            }}
          >
            + Agregar requisito{reqs.length > 1 ? " a esta opción" : ""}
          </button>
        </div>
      ))}
      <div className="btn-row">
        {reqs.length === 0 ? (
          <button type="button" className="btn btn-sm" onClick={() => onChange([[{ tipo: "pre", codigo: "", nombre: "" }]])}>
            + Agregar requisito
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-sm"
            title="Para casos como: ver A, O BIEN ver B y C"
            onClick={() => onChange([...reqs, [{ tipo: "pre", codigo: "", nombre: "" }]])}
          >
            + Agregar alternativa (O)
          </button>
        )}
      </div>
    </div>
  );
}

function GruposEditor({ p, actualizar }: { p: Pensum; actualizar: (fn: (p: Pensum) => Pensum) => void }) {
  const [nombre, setNombre] = useState("");
  const [seccion, setSeccion] = useState<Seccion>("obligatorios");
  const [borrar, setBorrar] = useState<string | null>(null);

  function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    actualizar((p) => {
      let id = slug(nombre) || "grupo";
      while (p.grupos.some((g) => g.id === id)) id += "-2";
      p.grupos.push({ id, nombre: nombre.trim(), seccion });
      return p;
    });
    setNombre("");
  }

  function editar(id: string, cambios: Partial<Grupo>) {
    actualizar((p) => {
      p.grupos = p.grupos.map((g) => (g.id === id ? { ...g, ...cambios } : g));
      return p;
    });
  }

  function eliminar(id: string) {
    actualizar((p) => {
      p.grupos = p.grupos.filter((g) => g.id !== id);
      for (const c of p.cursos) {
        c.grupos = c.grupos.filter((x) => x !== id);
        if (c.opciones) c.opciones = c.opciones.filter((x) => x !== id);
      }
      return p;
    });
    setBorrar(null);
  }

  return (
    <div className="panel">
      <p className="muted small">
        Los grupos organizan el catálogo (electivas, trayectorias, NFI, énfasis). Para meter una materia en un grupo, ábrela en
        “Materias” y márcalo.
      </p>
      <form className="form-row" onSubmit={crear}>
        <label className="field grow2">
          <span>Nuevo grupo</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Trayectoria Ciberseguridad" />
        </label>
        <label className="field">
          <span>Sección</span>
          <select value={seccion} onChange={(e) => setSeccion(e.target.value as Seccion)}>
            {(Object.keys(SECCIONES) as Seccion[]).map((s) => (
              <option key={s} value={s}>{SECCIONES[s]}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" style={{ alignSelf: "end" }}>Crear</button>
      </form>
      <div className="table" style={{ marginTop: 16 }}>
        {p.grupos.map((g) => (
          <div key={g.id} className="row">
            <input className="row-input" value={g.nombre} onChange={(e) => editar(g.id, { nombre: e.target.value })} />
            <select value={g.seccion} onChange={(e) => editar(g.id, { seccion: e.target.value as Seccion })}>
              {(Object.keys(SECCIONES) as Seccion[]).map((s) => (
                <option key={s} value={s}>{SECCIONES[s]}</option>
              ))}
            </select>
            <small className="muted">{p.cursos.filter((c) => c.grupos.includes(g.id)).length} materias</small>
            {borrar === g.id ? (
              <>
                <button className="btn btn-sm btn-danger" onClick={() => eliminar(g.id)}>Sí, eliminar</button>
                <button className="btn btn-sm" onClick={() => setBorrar(null)}>No</button>
              </>
            ) : (
              <button className="btn btn-sm btn-ghost-danger" onClick={() => setBorrar(g.id)}>Eliminar</button>
            )}
            <textarea
              className="row-desc"
              rows={2}
              placeholder="Descripción del grupo (opcional, se muestra en el catálogo)"
              value={g.descripcion ?? ""}
              onChange={(e) => editar(g.id, { descripcion: e.target.value || undefined })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
