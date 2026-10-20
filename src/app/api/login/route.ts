import { NextResponse } from "next/server";
import { crearSesion, passwordCorrecta } from "@/lib/auth";

export async function POST(req: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Falta configurar ADMIN_PASSWORD." }, { status: 500 });
  }
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (typeof password !== "string" || !passwordCorrecta(password)) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }
  await crearSesion();
  return NextResponse.json({ ok: true });
}
