export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export const DIAS_CORTOS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

/** Fecha de hoy en Colombia como YYYY-MM-DD */
export function hoyISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

export function partes(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}

export function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function formatoFecha(s: string) {
  const { y, m, d } = partes(s);
  return `${d} de ${MESES[m]} de ${y}`;
}

export function formatoRango(inicio: string, fin?: string) {
  if (!fin || fin === inicio) return formatoFecha(inicio);
  const a = partes(inicio);
  const b = partes(fin);
  if (a.y === b.y && a.m === b.m) return `${a.d} al ${b.d} de ${MESES[a.m]} de ${a.y}`;
  if (a.y === b.y) return `${a.d} de ${MESES[a.m]} al ${b.d} de ${MESES[b.m]} de ${a.y}`;
  return `${formatoFecha(inicio)} al ${formatoFecha(fin)}`;
}
