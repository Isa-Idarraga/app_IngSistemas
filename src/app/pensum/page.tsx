import Link from "next/link";
import PensumView from "@/components/PensumView";
import { getPensum } from "@/lib/store";
import { PENSUM_IDS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pénsum · Ingeniería de Sistemas EAFIT" };

export default async function Page() {
  const pensums = await Promise.all(PENSUM_IDS.map((id) => getPensum(id)));
  return (
    <div className="wrap wrap-wide">
      <div className="page-head">
        <p className="eyebrow">Plan de estudios</p>
        <h1>Pénsum interactivo</h1>
        <p className="muted">
          Elige tu pénsum y toca una materia para ver qué necesitas para verla y qué te abre. ¿Quieres planear tus
          semestres? <Link href="/arma-tu-pensum" className="link">Arma tu pénsum →</Link>
        </p>
      </div>
      <PensumView pensums={pensums} />
    </div>
  );
}
