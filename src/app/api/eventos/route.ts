import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { esAdmin } from "@/lib/auth";
import { getEventos, saveEventos } from "@/lib/store";
import { CATEGORIAS, type Evento } from "@/lib/types";

export const dynamic = "force-dynamic";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function limpiar(e: Partial<Evento>): Evento | string {
  const titulo = String(e.titulo ?? "").trim();
  if (!titulo) return "El título es obligatorio.";
  if (!e.inicio || !FECHA.test(e.inicio)) return "La fecha de inicio no es válida.";
  if (e.fin && !FECHA.test(e.fin)) return "La fecha de fin no es válida.";
  if (e.fin && e.fin < e.inicio) return "La fecha de fin es anterior al inicio.";
  const categoria = e.categoria && e.categoria in CATEGORIAS ? e.categoria : "otro";
  const t = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    id: t(e.id) ?? crypto.randomUUID(),
    titulo,
    descripcion: t(e.descripcion),
    inicio: e.inicio,
    fin: t(e.fin),
    hora: t(e.hora),
    lugar: t(e.lugar),
    categoria,
    enlace: t(e.enlace),
  };
}

function refrescar() {
  revalidatePath("/");
  revalidatePath("/calendario");
}

export async function GET() {
  return NextResponse.json(await getEventos());
}

export async function POST(req: Request) {
  if (!(await esAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const ev = limpiar(body ?? {});
  if (typeof ev === "string") return NextResponse.json({ error: ev }, { status: 400 });
  try {
    const lista = await getEventos();
    const i = lista.findIndex((x) => x.id === ev.id);
    if (i >= 0) lista[i] = ev;
    else lista.push(ev);
    await saveEventos(lista);
    refrescar();
    return NextResponse.json(ev);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await esAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  try {
    const lista = await getEventos();
    await saveEventos(lista.filter((x) => x.id !== id));
    refrescar();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
