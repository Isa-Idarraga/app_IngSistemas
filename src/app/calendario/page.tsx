import Calendario from "@/components/Calendario";
import { getEventos } from "@/lib/store";
import { hoyISO } from "@/lib/fechas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendario · Ingeniería de Sistemas EAFIT" };

export default async function Page() {
  const eventos = await getEventos();
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="eyebrow">Eventos del año</p>
        <h1>Calendario</h1>
      </div>
      <Calendario eventos={eventos} hoy={hoyISO()} />
    </div>
  );
}
