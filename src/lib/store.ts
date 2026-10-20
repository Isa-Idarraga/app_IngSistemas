import "server-only";
import { Redis } from "@upstash/redis";
import { promises as fs } from "fs";
import path from "path";
import type { Evento, Pensum } from "./types";
import { PENSUM_IDS } from "./types";

import seed20251 from "@/data/pensum-20251.json";
import seed20222 from "@/data/pensum-20222.json";
import seed20081 from "@/data/pensum-20081.json";
import seedEventos from "@/data/eventos.json";

const SEEDS: Record<string, Pensum> = {
  "20251": seed20251 as Pensum,
  "20222": seed20222 as Pensum,
  "20081": seed20081 as Pensum,
};

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

// Sin Redis configurado (desarrollo local) se guarda en .data/ dentro del proyecto.
const LOCAL_DIR = path.join(process.cwd(), ".data");

export function almacenamientoConfigurado() {
  return Boolean(redis) || process.env.NODE_ENV !== "production";
}

async function leer<T>(key: string): Promise<T | null> {
  if (redis) return (await redis.get<T>(key)) ?? null;
  try {
    const raw = await fs.readFile(path.join(LOCAL_DIR, `${key.replace(":", "-")}.json`), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function escribir<T>(key: string, value: T) {
  if (redis) {
    await redis.set(key, value);
    return;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No hay base de datos configurada. Conecta Upstash Redis en Vercel (Storage) para poder guardar cambios."
    );
  }
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, `${key.replace(":", "-")}.json`), JSON.stringify(value, null, 1));
}

export function esPensumValido(id: string) {
  return (PENSUM_IDS as readonly string[]).includes(id);
}

export async function getPensum(id: string): Promise<Pensum> {
  const guardado = await leer<Pensum>(`pensum:${id}`);
  return guardado ?? structuredClone(SEEDS[id]);
}

export async function savePensum(p: Pensum) {
  await escribir(`pensum:${p.id}`, p);
}

export async function resetPensum(id: string) {
  const p = structuredClone(SEEDS[id]);
  await escribir(`pensum:${id}`, p);
  return p;
}

export async function getEventos(): Promise<Evento[]> {
  const guardados = await leer<Evento[]>("eventos");
  const lista = guardados ?? (seedEventos as Evento[]);
  return [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export async function saveEventos(eventos: Evento[]) {
  await escribir("eventos", eventos);
}
