export type TipoRequisito = "pre" | "co" | "creditos" | "bilinguismo";

export interface Requisito {
  tipo: TipoRequisito;
  codigo?: string;
  nombre?: string;
  valor?: string | number;
}

export type Area =
  | "basicas"
  | "escuela"
  | "profesional"
  | "nfi"
  | "trayectoria"
  | "practica"
  | "institucional"
  | "otra";

export interface Curso {
  id: string;
  codigo: string;
  nombre: string;
  etiqueta?: string;
  creditos: number;
  umes: number;
  semestre: number | null;
  /** Posición dentro de la columna del semestre */
  orden?: number;
  area: Area;
  /** Cada elemento es una alternativa (se cumple una U otra). Dentro de cada alternativa se deben cumplir todas. */
  requisitos: Requisito[][];
  grupos: string[];
  secundario?: boolean;
  cupo?: boolean;
  opciones?: string[];
  nota?: string;
}

export type Seccion = "obligatorios" | "complementarios" | "nfi" | "enfasis";

export interface Grupo {
  id: string;
  nombre: string;
  seccion: Seccion;
}

export interface Pensum {
  id: string;
  nombre: string;
  planEstudios?: string;
  info: { etiqueta: string; valor: string }[];
  notas: string[];
  enfasisOfertados?: { periodo: string; lineas: string[] };
  grupos: Grupo[];
  cursos: Curso[];
}

export type CategoriaEvento =
  | "academico"
  | "evento"
  | "convocatoria"
  | "plazo"
  | "otro";

export interface Evento {
  id: string;
  titulo: string;
  descripcion?: string;
  inicio: string; // YYYY-MM-DD
  fin?: string; // YYYY-MM-DD
  hora?: string;
  lugar?: string;
  categoria: CategoriaEvento;
  enlace?: string;
}

export const PENSUM_IDS = ["20251", "20222", "20081"] as const;

export const AREAS: Record<Area, { nombre: string; color: string; texto: string }> = {
  basicas: { nombre: "Ciencias básicas", color: "#1aa6c6", texto: "#ffffff" },
  escuela: { nombre: "Escuela", color: "#125f6e", texto: "#ffffff" },
  profesional: { nombre: "Profesional", color: "#d8392f", texto: "#ffffff" },
  nfi: { nombre: "Formación institucional", color: "#f5a25d", texto: "#3b2208" },
  trayectoria: { nombre: "Trayectorias y flexibles", color: "#8d9a12", texto: "#ffffff" },
  practica: { nombre: "Práctica", color: "#7b1d2b", texto: "#ffffff" },
  institucional: { nombre: "Requisito institucional", color: "#7a8aa6", texto: "#ffffff" },
  otra: { nombre: "Otra", color: "#5b6b7f", texto: "#ffffff" },
};

export const SECCIONES: Record<Seccion, string> = {
  obligatorios: "Electivas y trayectorias del programa",
  complementarios: "Cursos complementarios (flexibles)",
  nfi: "Formación humanística (NFI)",
  enfasis: "Líneas de énfasis",
};

export const CATEGORIAS: Record<CategoriaEvento, { nombre: string; color: string }> = {
  academico: { nombre: "Calendario académico", color: "#1f3c88" },
  evento: { nombre: "Evento", color: "#d8392f" },
  convocatoria: { nombre: "Convocatoria", color: "#8d9a12" },
  plazo: { nombre: "Fecha límite", color: "#e07a1f" },
  otro: { nombre: "Otro", color: "#5b6b7f" },
};
