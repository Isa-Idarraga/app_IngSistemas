import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { esAdmin } from "@/lib/auth";
import { esPensumValido, getPensum, resetPensum, savePensum } from "@/lib/store";
import type { Pensum } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!esPensumValido(id)) return NextResponse.json({ error: "Pénsum no existe." }, { status: 404 });
  return NextResponse.json(await getPensum(id));
}

function validar(p: Pensum, id: string): string | null {
  if (!p || p.id !== id) return "Datos inválidos.";
  if (!Array.isArray(p.cursos) || !Array.isArray(p.grupos)) return "Datos inválidos.";
  const ids = new Set<string>();
  for (const c of p.cursos) {
    if (!c.id || !c.nombre?.trim()) return "Todas las materias necesitan nombre.";
    if (ids.has(c.id)) return `La materia ${c.id} está repetida.`;
    ids.add(c.id);
    if (!Array.isArray(c.requisitos) || !Array.isArray(c.grupos)) return `Materia ${c.id} inválida.`;
  }
  return null;
}

export async function PUT(req: Request, { params }: Ctx) {
  if (!(await esAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  if (!esPensumValido(id)) return NextResponse.json({ error: "Pénsum no existe." }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Pensum | null;
  const error = validar(body as Pensum, id);
  if (error) return NextResponse.json({ error }, { status: 400 });
  try {
    await savePensum(body as Pensum);
    revalidatePath("/pensum");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Restaura el pénsum a los datos originales extraídos del PDF
export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await esAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  if (!esPensumValido(id)) return NextResponse.json({ error: "Pénsum no existe." }, { status: 404 });
  try {
    const p = await resetPensum(id);
    revalidatePath("/pensum");
    return NextResponse.json(p);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
