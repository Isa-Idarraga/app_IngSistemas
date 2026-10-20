# Ingeniería de Sistemas · EAFIT

Página con calendario de eventos y pénsum interactivo (20251, 20222, 20081), con panel de admin en `/admin`.

## Correrlo en tu computador

```bash
npm install
cp .env.example .env.local   # y pon tu ADMIN_PASSWORD
npm run dev
```

Abre http://localhost:3000. Sin base de datos, lo que edites en admin se guarda en la carpeta `.data/` (solo local).

## Subirlo a Vercel

1. Sube esta carpeta a un repo de GitHub e impórtalo en Vercel (detecta Next.js solo).
2. En el proyecto de Vercel → **Storage** → crea una base **Upstash for Redis** y conéctala al proyecto
   (crea solas las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`).
3. En **Settings → Environment Variables** agrega `ADMIN_PASSWORD` (y si quieres `AUTH_SECRET`, cualquier texto largo).
4. Redeploy.

## Dónde está cada cosa

- `src/data/pensum-*.json`: datos iniciales sacados de los PDF. Lo que edites en admin se guarda en Redis
  y tiene prioridad; "Restaurar del PDF" vuelve a estos datos.
- `src/data/eventos.json`: eventos iniciales (vacío).
- `src/components/PensumView.tsx`: la malla interactiva. `src/components/Calendario.tsx`: el calendario.
- `src/components/admin/*`: panel de admin.
