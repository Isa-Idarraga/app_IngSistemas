import AdminPanel from "@/components/admin/AdminPanel";
import Login from "@/components/admin/Login";
import { esAdmin } from "@/lib/auth";
import { almacenamientoConfigurado, getEventos, getPensum } from "@/lib/store";
import { PENSUM_IDS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Ingeniería de Sistemas EAFIT", robots: { index: false } };

export default async function Page() {
  if (!process.env.ADMIN_PASSWORD) {
    return (
      <div className="wrap narrow">
        <div className="panel">
          <h1>Falta configurar la contraseña</h1>
          <p>
            Agrega la variable de entorno <code>ADMIN_PASSWORD</code> (en Vercel: Settings → Environment Variables, o en
            un archivo <code>.env.local</code> para correrlo en tu computador) y vuelve a desplegar.
          </p>
        </div>
      </div>
    );
  }
  if (!(await esAdmin())) return <Login />;

  const [eventos, ...pensums] = await Promise.all([getEventos(), ...PENSUM_IDS.map((id) => getPensum(id))]);
  return <AdminPanel eventos={eventos} pensums={pensums} almacenamientoOk={almacenamientoConfigurado()} />;
}
