"use client";

import { useMemo, useState } from "react";
import { CATEGORIAS, type CategoriaEvento, type Evento } from "@/lib/types";
import { formatoRango, hoyISO } from "@/lib/fechas";
import Modal from "../Modal";

const VACIO: Evento = { id: "", titulo: "", inicio: "", categoria: "evento" };

export default function EventosAdmin({ inicial }: { inicial: Evento[] }) {
  const [eventos, setEventos] = useState(inicial);
  const [editando, setEditando] = useState<Evento | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [verPasados, setVerPasados] = useState(true);
  const [borrar, setBorrar] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");

  const hoy = hoyISO();
  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return eventos
      .filter((e) => verPasados || (e.fin ?? e.inicio) >= hoy)
      .filter((e) => !q || e.titulo.toLowerCase().includes(q) || (e.lugar ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
  }, [eventos, buscar, verPasados, hoy]);

  function flash(t: string) {
    setAviso(t);
    setTimeout(() => setAviso(""), 2500);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setGuardando(true);
    setError("");
    const r = await fetch("/api/eventos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editando),
    });
    setGuardando(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return setError(data.error ?? "No se pudo guardar.");
    setEventos((prev) => {
      const i = prev.findIndex((x) => x.id === data.id);
      if (i >= 0) {
        const n = [...prev];
        n[i] = data;
        return n;
      }
      return [...prev, data];
    });
    setEditando(null);
    flash("Evento guardado");
  }

  async function eliminar(id: string) {
    const r = await fetch(`/api/eventos?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) {
      flash((await r.json().catch(() => ({}))).error ?? "No se pudo eliminar");
      return;
    }
    setEventos((prev) => prev.filter((x) => x.id !== id));
    setBorrar(null);
    flash("Evento eliminado");
  }

  const set = (k: keyof Evento, v: string) => setEditando((e) => (e ? { ...e, [k]: v } : e));

  return (
    <div>
      <div className="admin-toolbar">
        <button className="btn btn-primary" onClick={() => { setError(""); setEditando({ ...VACIO, inicio: hoy }); }}>
          + Nuevo evento
        </button>
        <input className="search" placeholder="Buscar evento…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <label className="check">
          <input type="checkbox" checked={verPasados} onChange={(e) => setVerPasados(e.target.checked)} /> Mostrar pasados
        </label>
        {aviso && <span className="toast">{aviso}</span>}
      </div>

      {lista.length === 0 ? (
        <div className="panel"><p className="muted">No hay eventos. Crea el primero con “Nuevo evento”.</p></div>
      ) : (
        <div className="table">
          {lista.map((e) => (
            <div key={e.id} className="row">
              <span className="dot" style={{ background: CATEGORIAS[e.categoria].color }} />
              <div className="row-main">
                <b>{e.titulo}</b>
                <small>
                  {formatoRango(e.inicio, e.fin)}
                  {e.hora ? ` · ${e.hora}` : ""}
                  {e.lugar ? ` · ${e.lugar}` : ""} · {CATEGORIAS[e.categoria].nombre}
                </small>
              </div>
              <div className="row-actions">
                <button className="btn btn-sm" onClick={() => { setError(""); setEditando({ ...e }); }}>Editar</button>
                {borrar === e.id ? (
                  <>
                    <button className="btn btn-sm btn-danger" onClick={() => eliminar(e.id)}>Sí, eliminar</button>
                    <button className="btn btn-sm" onClick={() => setBorrar(null)}>No</button>
                  </>
                ) : (
                  <button className="btn btn-sm btn-ghost-danger" onClick={() => setBorrar(e.id)}>Eliminar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <Modal titulo={editando.id ? "Editar evento" : "Nuevo evento"} onClose={() => setEditando(null)} ancho={620}>
          <form className="form" onSubmit={guardar}>
            <label className="field">
              <span>Título *</span>
              <input value={editando.titulo} onChange={(e) => set("titulo", e.target.value)} required autoFocus />
            </label>
            <div className="form-row">
              <label className="field">
                <span>Fecha de inicio *</span>
                <input type="date" value={editando.inicio} onChange={(e) => set("inicio", e.target.value)} required />
              </label>
              <label className="field">
                <span>Fecha de fin (si dura varios días)</span>
                <input type="date" value={editando.fin ?? ""} min={editando.inicio} onChange={(e) => set("fin", e.target.value)} />
              </label>
            </div>
            <div className="form-row">
              <label className="field">
                <span>Hora</span>
                <input placeholder="Ej: 2:00 p.m. – 4:00 p.m." value={editando.hora ?? ""} onChange={(e) => set("hora", e.target.value)} />
              </label>
              <label className="field">
                <span>Categoría</span>
                <select value={editando.categoria} onChange={(e) => set("categoria", e.target.value as CategoriaEvento)}>
                  {(Object.keys(CATEGORIAS) as CategoriaEvento[]).map((k) => (
                    <option key={k} value={k}>{CATEGORIAS[k].nombre}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Lugar</span>
              <input placeholder="Ej: Bloque 38, auditorio" value={editando.lugar ?? ""} onChange={(e) => set("lugar", e.target.value)} />
            </label>
            <label className="field">
              <span>Descripción</span>
              <textarea rows={4} value={editando.descripcion ?? ""} onChange={(e) => set("descripcion", e.target.value)} />
            </label>
            <label className="field">
              <span>Enlace (inscripción, más info)</span>
              <input type="url" placeholder="https://…" value={editando.enlace ?? ""} onChange={(e) => set("enlace", e.target.value)} />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={guardando}>{guardando ? "Guardando…" : "Guardar evento"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
