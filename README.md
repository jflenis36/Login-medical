# Login Medical

Front-end sin backend para consultar exámenes de laboratorio (glucosa, colesterol, triglicéridos y hemoglobina).
HTML + CSS + JavaScript (módulos ES), sin paso de build.

## Cómo ejecutarlo

El navegador no deja leer `data/db.json` desde `file://`, así que usa un servidor estático:

```bash
python3 -m http.server 8080
# abrir http://localhost:8080
```

## Usuarios de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@medical.test | Admin123! |
| Atención | staff@medical.test | Staff123! |
| Cliente | client@medical.test | Cliente123! |

Los otros 19 clientes usan `Cliente123!` (ver `data/db.json`).

## Roles

- **Administrador**: KPIs, listado paginado de usuarios, crear usuarios y cambiar rol / estado / contraseña desde un popup.
- **Atención**: lista de clientes con "qué necesita", detalle y PDF por cliente, registro de exámenes, reporte general por fechas en CSV y Excel.
- **Cliente** (rol por defecto al registrarse): sus exámenes, evolución y descarga en PDF. El envío por correo queda como botón "próximamente".

## Base de datos local

`data/db.json` es la semilla (23 usuarios, ~150 exámenes). Los cambios se guardan en `localStorage` porque un navegador no puede escribir archivos.
El administrador puede descargar/cargar un `db.json` o restablecer los datos de prueba. Para regenerar la semilla: `node tools/generate-seed.mjs`.

> Demo: las contraseñas están en claro en el JSON. Con un backend real deben ir con hash en el servidor.

## Librerías (en `vendor/`, sin CDN)

Chart.js 4 (KPIs/gráficas), jsPDF + autoTable (PDF), SheetJS (Excel).
