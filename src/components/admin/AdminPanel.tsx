"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Evento, Pensum } from "@/lib/types";
import EventosAdmin from "./EventosAdmin";
import PensumAdmin from "./PensumAdmin";

export default function AdminPanel({
  eventos,
  pensums,
  almacenamientoOk,
}: {
  eventos: Evento[];
  pensums: Pensum[];
  almacenamientoOk: boolean;
}) {
  const [tab, setTab] = useState<"eventos" | "pensum">("eventos");
  const router = useRouter();

  async function salir() {
    await fetch("/api/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="wrap wrap-wide">
      <div className="page-head admin-head">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Panel de admin</h1>
        </div>
        <button className="btn btn-sm" onClick={salir}>Cerrar sesión</button>
      </div>
      {!almacenamientoOk && (
        <div className="callout warn">
          <b>No hay base de datos conectada.</b> Puedes ver todo, pero los cambios no se van a guardar. En Vercel ve a
          Storage → crea una base Upstash Redis y conéctala a este proyecto, luego vuelve a desplegar.
        </div>
      )}
      <div className="seg seg-lg" role="tablist">
        <button className={tab === "eventos" ? "on" : ""} onClick={() => setTab("eventos")}>Eventos</button>
        <button className={tab === "pensum" ? "on" : ""} onClick={() => setTab("pensum")}>Pénsum</button>
      </div>
      <div style={{ marginTop: 20 }}>
        {tab === "eventos" ? <EventosAdmin inicial={eventos} /> : <PensumAdmin pensums={pensums} />}
      </div>
    </div>
  );
}
