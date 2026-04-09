# Server — Local & Production

## Conceptos clave de Docker

### `docker compose up` vs `docker build`

Son dos cosas completamente distintas:

| Comando | Qué hace | Cuándo se usa |
|---|---|---|
| `docker compose up -d` | Lee `docker-compose.yml` y levanta los **servicios** que define (Postgres, Redis). No toca tu código. | En **local**, para tener la base de datos y Redis corriendo. |
| `docker build` | Lee un `Dockerfile` y **construye una imagen** con tu código adentro. No levanta nada todavía. | Para **empaquetar** tu server en un container que podés subir a producción. |
| `docker run` | **Ejecuta** una imagen que ya construiste. | Para probar la imagen localmente o en producción. |

### Flujo visual

```
LOCAL (desarrollo)
  docker compose up -d     → Postgres + Redis corriendo
  pnpm dev                 → Tu server corriendo con tsx (código fuente directo)

PRODUCCIÓN
  docker build ...         → Crea imagen con tu código + dependencias
  docker run / Railway     → Corre esa imagen como container
  Redis (servicio aparte)  → Railway/Upstash te da una REDIS_URL
  Postgres (servicio aparte) → Neon/Railway te da una DATABASE_URL
```

### Flags del `docker build`

```bash
docker build -f apps/server/Dockerfile -t saas-server .
#            ↑                          ↑              ↑
#            |                          |              └─ contexto: la carpeta raíz del monorepo
#            |                          └─ tag/nombre de la imagen resultante
#            └─ ruta al Dockerfile (porque no está en la raíz)
```

- **`-f`** (file): indica dónde está el Dockerfile. Por defecto Docker busca `./Dockerfile` en la raíz, pero el nuestro está en `apps/server/`.
- **`-t`** (tag): el nombre que le das a la imagen. Es como ponerle nombre a un `.zip`. Después lo usás con `docker run saas-server`.
- **`.`** (contexto): la carpeta que Docker puede "ver" durante el build. Como el server depende de `packages/shared`, el contexto tiene que ser la raíz del monorepo (no `apps/server/`).

## Desarrollo local

```bash
docker compose up -d        # Levanta Postgres + Redis
pnpm install                # Instala dependencias
pnpm run dev                # Arranca web (5173) + server (3001)
```

El `docker-compose.yml` de la raíz **solo levanta Postgres y Redis**. Tu código Node corre directamente en tu máquina con `tsx` (TypeScript en vivo, sin compilar).

## Build de producción

### 1. Construir la imagen

```bash
# Desde la raíz del monorepo:
docker build -f apps/server/Dockerfile -t saas-server .
```

### 2. Probar localmente

```bash
docker run --rm \
  -p 3001:3001 \
  -e DATABASE_URL="postgres://postgres:postgres@host.docker.internal:5432/saas_dev" \
  -e REDIS_URL="redis://host.docker.internal:6379" \
  -e CORS_ORIGIN_FRONTEND="http://localhost:5173" \
  -e BETTER_AUTH_SECRET="dev-secret-change-in-prod" \
  saas-server
```

> `host.docker.internal` es un DNS especial que apunta a tu máquina host — permite que el container acceda al Postgres y Redis de `docker compose up`.

### 3. Variables de entorno en producción

En producción no hay archivo `.env`. Las variables se configuran en el dashboard del provider (Railway, Fly.io, etc.):

| Variable | Ejemplo | Notas |
|---|---|---|
| `DATABASE_URL` | `postgres://user:pass@host:5432/db?sslmode=require` | La da Neon/Railway |
| `REDIS_URL` | `redis://default:pass@host:6379` | La da Railway/Upstash |
| `BETTER_AUTH_SECRET` | (string largo aleatorio) | `openssl rand -base64 32` |
| `CORS_ORIGIN_FRONTEND` | `https://tuapp.com` | URL del frontend desplegado |
| `SERVER_PORT` | `3001` | Algunos providers requieren `PORT` en vez de `SERVER_PORT` |
| `ASSET_PROVIDER` | `s3` | Para producción, usar S3/R2 (ver [storage-s3.md](storage-s3.md)) |
| `NODE_ENV` | `production` | Ya está seteado en el Dockerfile |

## Deploy en Railway

1. Crear proyecto en Railway, conectar el repo de GitHub.
2. Configurar el servicio del server:
   - **Root Directory**: `.` (raíz del monorepo)
   - **Dockerfile Path**: `apps/server/Dockerfile`
   - Railway detecta el Dockerfile y lo usa automáticamente.
3. Agregar un servicio **Redis** dentro del mismo proyecto (click en "New" → "Database" → "Redis"). Railway te genera una `REDIS_URL` interna.
4. Agregar las variables de entorno en el dashboard del servicio.
5. Para Postgres, usar **Neon** (free tier generoso) o agregar Postgres como servicio en Railway.

### Redis en Railway vs servicio externo

Redis va como **servicio separado dentro del mismo proyecto** en Railway. No va dentro del container del server. Railway los conecta por red interna (latencia ~0ms). Esto es importante porque BullMQ hace polling a Redis — si Redis está en otro provider (ej. Upstash), cada poll es una request que puede salir cara.

## Deploy en Fly.io

1. Instalar `flyctl` y hacer login.
2. Desde la raíz del monorepo:
   ```bash
   fly launch --dockerfile apps/server/Dockerfile
   ```
3. Configurar las variables de entorno:
   ```bash
   fly secrets set DATABASE_URL="..." REDIS_URL="..." BETTER_AUTH_SECRET="..."
   ```
4. Para Redis, usar **Upstash Redis** (addon de Fly) o levantar un Redis como app separada en Fly.

## Notas técnicas

- El Dockerfile usa `tsx` (TypeScript runner) en vez de compilar a JavaScript. Esto es porque `@repo/shared` exporta archivos `.ts` directamente. Si en el futuro shared tiene un paso de build, se puede cambiar a `node dist/index.js`.
- El `.dockerignore` excluye `apps/web`, `node_modules`, `.env*`, y archivos innecesarios para mantener la imagen liviana.
- La imagen base es `node:22-slim` (~200MB base). Con dependencias, la imagen final pesa ~420MB.
