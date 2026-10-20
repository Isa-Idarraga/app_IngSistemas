"use client";

import { useEffect } from "react";

export default function Modal({
  titulo,
  onClose,
  children,
  ancho,
}: {
  titulo: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  ancho?: number;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        style={ancho ? { maxWidth: ancho } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{titulo}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
