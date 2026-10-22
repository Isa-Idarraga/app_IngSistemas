import ArmaPensum from "@/components/ArmaPensum";
import { getPensum } from "@/lib/store";
import { PENSUM_IDS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Arma tu pénsum · Ingeniería de Sistemas EAFIT" };

export default async function Page() {
  const pensums = await Promise.all(PENSUM_IDS.map((id) => getPensum(id)));
  return (
    <div className="wrap wrap-wide">
      <div className="page-head">
        <p className="eyebrow">Planea tu carrera</p>
        <h1>Arma tu pénsum</h1>
        <p className="muted">
          Organiza las materias que vas a ver en cada semestre. Te avisamos si te falta un prerrequisito o si te pasas
          de créditos.
        </p>
      </div>
      <ArmaPensum pensums={pensums} />
    </div>
  );
}
