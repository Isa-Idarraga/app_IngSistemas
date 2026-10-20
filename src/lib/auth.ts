import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE = "admin_session";
const DURACION_MS = 1000 * 60 * 60 * 12; // 12 horas

function secreto() {
  const s = process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("Falta ADMIN_PASSWORD en las variables de entorno.");
  return s;
}

function firmar(payload: string) {
  return crypto.createHmac("sha256", secreto()).update(payload).digest("hex");
}

export function passwordCorrecta(intento: string) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  const a = crypto.createHash("sha256").update(intento).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function crearSesion() {
  const expira = Date.now() + DURACION_MS;
  const valor = `${expira}.${firmar(String(expira))}`;
  const jar = await cookies();
  jar.set(COOKIE, valor, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_MS / 1000,
  });
}

export async function cerrarSesion() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function esAdmin() {
  if (!process.env.ADMIN_PASSWORD) return false;
  const jar = await cookies();
  const valor = jar.get(COOKIE)?.value;
  if (!valor) return false;
  const [expira, firma] = valor.split(".");
  if (!expira || !firma) return false;
  if (Number(expira) < Date.now()) return false;
  const esperada = firmar(expira);
  if (esperada.length !== firma.length) return false;
  return crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(firma));
}
