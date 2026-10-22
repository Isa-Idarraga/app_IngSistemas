// Genera el PDF del plan directamente en el navegador. No se envía nada a ningún servidor.

export interface FilaPDF {
  codigo: string;
  nombre: string;
  creditos: number | string;
  umes: number | string;
  observaciones: string;
}

export interface SemestrePDF {
  numero: number;
  creditos: number;
  umes: number;
  porElegir: number;
  filas: FilaPDF[];
  notas: string[];
}

export interface TarjetaMalla {
  nombre: string;
  codigo: string;
  creditos: number;
  color: string;
  texto: string;
  estado: "ok" | "mal" | "aviso";
}

export interface ColumnaMalla {
  numero: number;
  creditos: number;
  umes: number;
  tarjetas: TarjetaMalla[];
  extras: { nombre: string; mal: boolean }[];
}

export interface DatosPDF {
  pensum: string;
  malla: ColumnaMalla[];
  elecciones: { nombre: string; valor: string }[];
  progreso: { nombre: string; valor: string }[];
  semestres: SemestrePDF[];
}

const NAVY: [number, number, number] = [11, 34, 101];

export async function descargarPlanPDF(d: DatosPDF) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  // Página 1 (horizontal): la malla dibujada, como se ve en la página
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  dibujarMalla(doc, d);
  doc.addPage("letter", "portrait");
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 40;
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...NAVY);
  doc.text("Mi plan de estudios", margen, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 100, 120);
  const fecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date());
  doc.text(`Ingeniería de Sistemas · Universidad EAFIT · ${d.pensum} · ${fecha}`, margen, y);
  y += 20;

  const resumen = [...d.elecciones, ...d.progreso];
  if (resumen.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: margen, right: margen },
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2, textColor: [40, 45, 60] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 170 } },
      body: resumen.map((r) => [r.nombre, r.valor]),
    });
    // @ts-expect-error lastAutoTable lo agrega el plugin
    y = doc.lastAutoTable.finalY + 14;
  }

  for (const s of d.semestres) {
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      y = 48;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(`Semestre ${s.numero}`, margen, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 100, 120);
    const umes = `${s.umes} UMES${s.porElegir ? ` + ${s.porElegir} por elegir` : ""}`;
    doc.text(`${s.creditos} créditos · ${umes}`, ancho - margen, y, { align: "right" });
    y += 6;

    autoTable(doc, {
      startY: y,
      margin: { left: margen, right: margen },
      head: [["Código", "Materia", "Créditos", "UMES", "Observaciones"]],
      body: s.filas.length
        ? s.filas.map((f) => [f.codigo, f.nombre, String(f.creditos), String(f.umes), f.observaciones])
        : [["", "Sin materias", "", "", ""]],
      styles: { fontSize: 8.5, cellPadding: 4, textColor: [30, 36, 64], lineColor: [227, 230, 239], lineWidth: 0.5 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 56 },
        2: { cellWidth: 48, halign: "center" },
        3: { cellWidth: 40, halign: "center" },
        4: { cellWidth: 170, fontSize: 7.5, textColor: [120, 70, 0] },
      },
    });
    // @ts-expect-error lastAutoTable lo agrega el plugin
    y = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(8.5);
    doc.setTextColor(150, 80, 0);
    for (const n of s.notas) {
      const lineas = doc.splitTextToSize(n, ancho - margen * 2);
      doc.text(lineas, margen, y + 8);
      y += lineas.length * 11;
    }
    y += 16;
  }

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    const ancho = doc.internal.pageSize.getWidth();
    const margen = i === 1 ? 28 : 40;
    doc.setFontSize(7.5);
    doc.setTextColor(140, 146, 160);
    doc.text(
      "Plan de apoyo, no oficial: la inscripción se hace en Epik y las reglas pueden cambiar; confírmalo con la coordinación del programa.",
      margen,
      doc.internal.pageSize.getHeight() - 24
    );
    doc.text(`${i} / ${paginas}`, ancho - margen, doc.internal.pageSize.getHeight() - 24, { align: "right" });
  }

  doc.save(`mi-plan-${d.pensum.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

type RGB = [number, number, number];
function rgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dibujarMalla(doc: any, d: DatosPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const m = 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(`Mi plan de estudios · ${d.pensum}`, m, m + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 100, 120);
  const ele = d.elecciones.filter((e) => e.valor !== "Sin escoger").map((e) => `${e.nombre}: ${e.valor}`).join("   ·   ");
  if (ele) doc.text(doc.splitTextToSize(ele, W - m * 2), m, m + 22);

  const n = Math.max(1, d.malla.length);
  const gap = n > 10 ? 4 : 6;
  const colW = (W - m * 2 - gap * (n - 1)) / n;
  const top = m + 44;
  const pie = 40;
  const disponible = H - top - pie - m;
  const fs = colW < 55 ? 5.6 : colW < 70 ? 6.4 : 7.2;

  // Alturas: tarjetas de 3 créditos = base; la práctica (>= 12 créditos) más alta, como en la página
  const base = 44;
  const altoExtra = 13;
  const altoTarjeta = (t: TarjetaMalla) => (t.creditos >= 12 ? base * Math.min(t.creditos / 3, 6) * 0.7 : base);
  let maxAlto = 0;
  for (const c of d.malla) {
    const alto = c.tarjetas.reduce((a, t) => a + altoTarjeta(t) + 4, 0) + c.extras.length * (altoExtra + 2);
    maxAlto = Math.max(maxAlto, alto);
  }
  const escala = maxAlto > disponible ? disponible / maxAlto : 1;

  d.malla.forEach((c, i) => {
    const x = m + i * (colW + gap);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(102, 112, 137);
    doc.text(`S${c.numero}`, x + colW / 2, top - 6, { align: "center" });
    let y = top;
    for (const t of c.tarjetas) {
      const h = altoTarjeta(t) * escala;
      doc.setFillColor(...rgb(t.color));
      if (t.estado === "mal") {
        doc.setDrawColor(229, 72, 77);
        doc.setLineWidth(2);
        doc.roundedRect(x, y, colW, h, 5, 5, "FD");
      } else {
        doc.roundedRect(x, y, colW, h, 5, 5, "F");
      }
      doc.setTextColor(...rgb(t.texto));
      doc.setFont("helvetica", "bold");
      doc.setFontSize(fs);
      const lineas: string[] = doc.splitTextToSize(t.nombre, colW - 6).slice(0, Math.max(1, Math.floor((h - 10) / (fs + 1.5))));
      const bloque = lineas.length * (fs + 1.2) + fs;
      let ty = y + (h - bloque) / 2 + fs;
      for (const l of lineas) {
        doc.text(l, x + colW / 2, ty, { align: "center" });
        ty += fs + 1.2;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fs - 1);
      doc.text(`${t.codigo} · ${t.creditos} cr`, x + colW / 2, ty + 1, { align: "center" });
      if (t.estado !== "ok") {
        doc.setFillColor(...(t.estado === "mal" ? ([229, 72, 77] as RGB) : ([245, 165, 36] as RGB)));
        doc.circle(x + 6, y + 6, 4, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        doc.text("!", x + 6, y + 8.2, { align: "center" });
      }
      y += h + 4 * escala;
    }
    for (const e of c.extras) {
      const h = altoExtra * Math.max(escala, 0.8);
      doc.setDrawColor(...(e.mal ? ([229, 72, 77] as RGB) : ([184, 192, 212] as RGB)));
      doc.setLineWidth(0.6);
      doc.setLineDashPattern([2, 1.5], 0);
      doc.roundedRect(x, y, colW, h, 3, 3, "S");
      doc.setLineDashPattern([], 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(Math.max(4.8, fs - 1.6));
      doc.setTextColor(...(e.mal ? ([163, 53, 44] as RGB) : ([102, 112, 137] as RGB)));
      doc.text(doc.splitTextToSize(e.nombre, colW - 4)[0], x + colW / 2, y + h / 2 + 2, { align: "center" });
      y += h + 2;
    }
    // Pie de columna: créditos y UMES, debajo de la columna más alta
    const yp = Math.min(H - m - pie + 14, top + maxAlto * escala + 26);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...(c.creditos > 21 ? ([224, 122, 31] as RGB) : NAVY));
    doc.text(String(c.creditos), x + colW / 2, yp, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(102, 112, 137);
    doc.text(`${c.umes} UMES`, x + colW / 2, yp + 10, { align: "center" });
  });

  doc.setFontSize(7);
  doc.setTextColor(140, 146, 160);
  doc.text(
    "Rojo: no cumple requisitos · Naranja: tiene avisos · Punteadas: requisitos de 0 créditos. El detalle de cada semestre está en las páginas siguientes.",
    m,
    H - 40
  );
}
