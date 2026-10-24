# Despliegue manual: Render + Vercel + Neon

Esta guía deja la publicación en tus manos. El código está en la rama `feat/secure-ticket-dashboard`. Puedes desplegar esa rama para probar; integra el PR con `main` cuando hayas revisado el resultado. No selecciones la versión anterior de `main` por error.

## 1. Preparar PostgreSQL

1. Crea el proyecto en Neon y copia la conexión **pooled** desde Connect.
2. En `backend/.env`, guarda `DATABASE_URL`. Usa el prefijo `postgresql+psycopg://` y conserva las opciones de Neon (`sslmode=require`, y `channel_binding=require` si viene incluido). El prefijo `postgresql://` también se normaliza automáticamente.
3. Con el entorno Python activado, desde `backend`, ejecuta:

```powershell
python -m app.manage init-db
python -m app.manage create-user --username marco
```

Esto se conecta a Neon desde tu computadora. Introduce tu contraseña en el prompt, nunca en el código o el historial de comandos. No necesitas una consola de pago de Render para crear la cuenta.

El esquema nuevo usa `app_users`, `login_sessions` y `user_tickets`. Una tabla `tickets` anterior se conserva sin publicarla. No asignes datos antiguos a un usuario automáticamente.

## 2. Backend en Render

New → Web Service → selecciona el repositorio y la rama revisada.

| Configuración | Valor |
|---|---|
| Runtime | Docker |
| Root Directory | `backend` |
| Dockerfile Path | `Dockerfile` (relativo a `backend`) |
| Docker Build Context | `.` (relativo a `backend`, si aparece el campo) |
| Health Check Path | `/health` |
| Instancia | La que elijas; revisa los límites vigentes antes de confirmar |
| Auto Deploy | Desactivado si quieres controlar cada publicación manualmente |

Variables privadas:

```dotenv
ENVIRONMENT=production
DATABASE_URL=postgresql+psycopg://USUARIO:CLAVE@HOST/DB?sslmode=require
ALLOWED_ORIGINS=https://tu-frontend.vercel.app
```

No pegues literalmente los ejemplos. Copia tu cadena de Neon completa. El contenedor usa `PORT` de Render, un usuario sin privilegios y un solo worker. Incluye los modelos entrenados; no necesita descargar el dataset ni entrenar al arrancar.

Publica y abre `https://TU-BACKEND.onrender.com/health`. Debe devolver `{"status":"ok"}`. Este health check valida el proceso y la carga de modelos, no la conectividad de PostgreSQL. Comprueba también el login para verificar la base de datos.

Si aún no tienes el dominio del frontend, configura su origen exacto cuando Vercel lo asigne y vuelve a desplegar. El navegador usa el proxy de Next.js, por lo que no depende de CORS entre los dos proveedores.

## 3. Frontend en Vercel

Importa el repositorio, selecciona el framework Next.js y configura:

| Configuración | Valor |
|---|---|
| Root Directory | `frontend` |
| Node.js | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Production Branch | La rama revisada que quieras publicar |

Variables del servidor (sin `NEXT_PUBLIC_`):

```dotenv
API_URL=https://TU-BACKEND.onrender.com
APP_ORIGIN=https://TU-FRONTEND.vercel.app
NEXT_TELEMETRY_DISABLED=1
```

`APP_ORIGIN` debe ser exactamente el origen que aparece en la barra del navegador, sin ruta ni barra final. Protege contra peticiones de escritura desde otros sitios. Si usas un dominio propio, cámbialo y vuelve a desplegar. Para un preview, configura un origen que coincida con esa URL o deja `APP_ORIGIN` sin definir para que use el origen de la petición de Next.js; en producción usa el valor explícito.

No añadas `DATABASE_URL` al frontend. Elimina el antiguo `NEXT_PUBLIC_API_URL` si existía: ya no se usa. La cookie se configura con `HttpOnly`, `SameSite=Strict`, `Secure` en producción, y ocho horas de duración.

Vercel puede generar despliegues al conectar Git o subir commits. Si quieres que toda publicación sea manual, revisa y desactiva el disparo automático en los ajustes Git de tu proyecto antes de continuar. Este repositorio no invoca ninguna herramienta de despliegue.

## 4. Comprobación después de publicar

1. Desde `/`, carga el ejemplo ficticio y clasifícalo. No debe aparecer en el historial.
2. Abre `/tickets` sin sesión: debe pedir login.
3. Inicia sesión con la cuenta que creaste, registra un ticket ficticio y abre su detalle.
4. Cambia el estado, busca por asunto, filtra por prioridad/estado y verifica la paginación con más de diez tickets.
5. Comprueba `/analytics`: cuenta todos tus tickets, no solo la página visible.
6. Con otra cuenta, verifica que no puede consultar el ticket por su UUID.
7. Borra un ticket, cierra sesión e intenta consultar `/tickets` de nuevo.
8. Prueba varios errores de login: después del límite debe responder 429. Espera un minuto antes de repetir.

## 5. Docker local

Desde la raíz del repositorio:

```powershell
docker build -t smart-ticket-api ./backend
docker run --rm -p 8000:8000 --env-file backend/.env smart-ticket-api
```

Para este ejemplo usa Neon en `.env`. SQLite local de Windows no se comparte con el contenedor, y el directorio `/app` no es escribible por el usuario del contenedor. No uses SQLite para publicar.

## 6. Operación de esta demo

- Ejecuta `python -m app.manage purge-expired` contra la base correcta para limpiar sesiones vencidas y tickets mayores a 30 días. Si lo programas cada día, la retención efectiva puede llegar aproximadamente a 31 días. Sin esa ejecución, no hay borrado automático.
- No publiques una cuenta con contraseña compartida para toda Internet. Provisiona cuentas separadas para quienes revisen tu demo.
- Usa `reset-password` para cambiar credenciales y revocar todas las sesiones de una cuenta. `delete-user` elimina cuenta, sesiones y tickets de forma irreversible tras confirmación en consola.
- Los límites viven en memoria de **un proceso** y se reinician al reiniciar el servicio. Render/Vercel pueden agrupar usuarios bajo una IP de salida: los límites pueden compartirse. Es una limitación deliberada y conservadora de esta demo. Para escalar, añade almacenamiento compartido (p. ej. Redis) y configura proxies de confianza según tu infraestructura. No aceptes `X-Forwarded-For` libremente desde Internet.
- El plan elegido puede suspender el backend por inactividad. La interfaz informa errores de conexión y permite reintentar. El proxy espera hasta 60 segundos; un arranque más lento puede requerir reintentar.
- No se añadió un despliegue automático ni un servicio de pago. Verifica condiciones y cuotas actuales en cada proveedor.

## Referencias oficiales

- [Docker en Render](https://render.com/docs/docker)
- [Variables en Render](https://render.com/docs/configure-environment-variables)
- [Monorepos en Vercel](https://vercel.com/docs/monorepos)
- [Variables en Vercel](https://vercel.com/docs/environment-variables)
- [Conexión de Neon](https://neon.com/docs/connect/connect-from-any-app)
- [Autenticación en Next.js](https://nextjs.org/docs/app/guides/authentication)
- [Hashing de contraseñas con FastAPI](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/)
