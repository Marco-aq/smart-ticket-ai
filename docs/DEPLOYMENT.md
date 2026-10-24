# Despliegue manual: Render + Vercel + Neon

Esta guía prepara la publicación manual de la versión integrada en `main`. Usa `main` tanto en Render como en Vercel. La preparación del repositorio no crea servicios ni publica la aplicación.

## 0. Confirmar tu copia y proteger las variables

En tu PowerShell de Windows:

```powershell
cd "C:\Users\marco\Desktop\General\Proyectos\smart-ticket-ai"
git status
git fetch origin
git switch main
git pull --ff-only origin main
git log -1 --oneline
```

Si Git dice `Already up to date`, ya tienes esa versión; no se abre ninguna ventana ni se inicia el servidor con esos comandos. Si muestra cambios locales o ramas divergentes, conserva tu trabajo y resuelve el mensaje antes de continuar. No uses `reset --hard` para actualizar.

Activa tu entorno Python y usa `python -m pip install -r requirements.txt` desde `backend`. Si necesitas crearlo: `py -3.11 -m venv .venv`, seguido de `.\.venv\Scripts\Activate.ps1`.

Desde la raíz del repositorio, crea archivos de configuración solo si no existen:

```powershell
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
if (!(Test-Path frontend/.env.local)) { Copy-Item frontend/.env.example frontend/.env.local }
```

No sobrescribas tus valores reales al copiar una plantilla. `.gitignore` excluye entornos locales, claves, bases de datos y dumps, pero no quita un secreto que ya estuviera versionado. Si detectas uno, revócalo y trátalo también en el historial antes de publicar.

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

New → Web Service → selecciona `Marco-aq/smart-ticket-ai` y la rama `main`.

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

No pegues literalmente los ejemplos. Copia tu cadena de Neon completa. El contenedor usa `PORT` de Render, un usuario sin privilegios y un solo worker. Instala únicamente `requirements-runtime.txt`, con dependencias de inferencia, base de datos y autenticación. El entrenamiento y las pruebas quedan fuera de la imagen. Incluye los modelos entrenados; no necesita descargar el dataset ni entrenar al arrancar.

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
| Production Branch | `main` |

Variables del servidor (sin `NEXT_PUBLIC_`):

```dotenv
API_URL=https://TU-BACKEND.onrender.com
APP_ORIGIN=https://TU-FRONTEND.vercel.app
NEXT_TELEMETRY_DISABLED=1
```

`APP_ORIGIN` debe ser exactamente el origen que aparece en la barra del navegador, sin ruta ni barra final. Protege contra peticiones de escritura desde otros sitios. Si usas un dominio propio, cámbialo y vuelve a desplegar. Para un preview, configura un origen que coincida con esa URL o deja `APP_ORIGIN` sin definir para que use el origen de la petición de Next.js; en producción usa el valor explícito.

No añadas `DATABASE_URL` al frontend. Elimina el antiguo `NEXT_PUBLIC_API_URL` si existía: ya no se usa. La cookie se configura con `HttpOnly`, `SameSite=Strict`, `Secure` en producción, y ocho horas de duración.

El archivo `frontend/vercel.json` incluye `git.deploymentEnabled: false`, para desactivar los despliegues automáticos disparados por Git. La publicación inicial y las siguientes publicaciones deben iniciarse explícitamente desde Vercel. El archivo también declara Next.js, `npm ci` y `npm run build`. Configura Root Directory como `frontend` para que Vercel lo lea. Este repositorio no invoca herramientas de despliegue; comprueba también los ajustes del proyecto y cualquier automatización externa que ya tengas.

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

Después de arrancar la imagen puedes verificarla desde otra terminal:

```powershell
python scripts/smoke_api.py --url http://localhost:8000
```

Esta comprobación no crea tickets: verifica salud, predicción con un ejemplo ficticio y rechazo de acceso sin sesión. CI ejecuta la misma comprobación contra la imagen y revisa que estén los dos modelos y no se incluyan secretos, entrenamiento ni paquetes de pruebas. El smoke test no sustituye el login y la comprobación de PostgreSQL del paso 4.

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

## Resolución de problemas

| Síntoma | Revisión |
| --- | --- |
| Git no descarga archivos nuevos | Ejecuta `git log -1 --oneline` y `git status`; `Already up to date` confirma que no hay commits remotos pendientes en esa rama. No inicia la aplicación. |
| El frontend no cambia después de actualizar | Detén el servidor anterior, ejecuta `npm ci` en `frontend` y reinicia `npm run dev`. Para producción realiza un nuevo despliegue manual del commit de `main`. |
| `Invalid request origin` | Compara el origen real del navegador con `APP_ORIGIN`: protocolo, hostname y puerto deben coincidir. `localhost` y `127.0.0.1` son diferentes. |
| Login o tickets devuelven 500 | Comprueba `DATABASE_URL`, conectividad, TLS e inicialización de las tablas. `/health` no verifica la base de datos. |
| La API no arranca por modelos ausentes | Confirma los dos `.joblib` versionados y construye con contexto `backend`, sin ignorarlos. |
| Advertencia de versión de scikit-learn | Instala las dependencias fijadas; los artefactos requieren scikit-learn 1.9.1. |
| Respuesta 429 | Espera a que termine la ventana del límite. La demo puede compartir cuotas entre usuarios detrás de proxies. |
| El contenedor intenta crear SQLite | Usa una conexión PostgreSQL real; el sistema de archivos del contenedor no es la base de datos persistente. |

La aplicación está preparada para configurar y desplegar. Tus credenciales de Neon, la contraseña de tu cuenta y los dominios definitivos deben introducirse privadamente en tu entorno; no están preconfigurados ni se guardan en GitHub.
