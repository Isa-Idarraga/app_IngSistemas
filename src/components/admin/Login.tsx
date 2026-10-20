"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setCargando(false);
    if (r.ok) router.refresh();
    else setError((await r.json().catch(() => ({}))).error ?? "No se pudo entrar.");
  }

  return (
    <div className="wrap narrow">
      <form className="panel login" onSubmit={entrar}>
        <p className="eyebrow">Administración</p>
        <h1>Entrar</h1>
        <label className="field">
          <span>Contraseña</span>
          <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={cargando}>
          {cargando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
