# Arquitectura React + API

La aplicación mantiene un único repositorio y queda separada en dos capas:

- `src/`: interfaz React, autenticación y suscripciones de Realtime.
- `api/data.js`: API HTTP que procesa las operaciones CRUD de negocio.
- `src/api/dataClient.js`: adaptador que lleva las consultas de React a la API.
- `supabase/`: esquema, RLS y funciones de base de datos.

## Flujo de una consulta

1. React obtiene el token de la sesión activa.
2. La consulta de una pantalla se envía a `POST /api/data`.
3. La API crea un cliente Supabase con el token del usuario.
4. Supabase aplica las políticas RLS existentes.
5. La respuesta vuelve a React sin exponer claves de servicio.

Autenticación y Realtime siguen usando el cliente oficial de Supabase. Son servicios de sesión y eventos; las operaciones de lectura y escritura de las tablas permitidas pasan por la API en producción.

## Variables de entorno

Configura las variables de `.env.example` en Vercel. No uses `SUPABASE_SERVICE_ROLE_KEY` para esta API: se mantiene el token del usuario para que RLS siga siendo la autorización final.

`VITE_DATA_TRANSPORT=api` activa la API. En caso de una contingencia temporal se puede definir `VITE_DATA_TRANSPORT=direct` para que el cliente vuelva a consultar Supabase directamente.

## Desarrollo local

`npm run dev` conserva el acceso directo a Supabase para desarrollo con Vite. Para probar el mismo enrutamiento de producción se puede usar `vercel dev` con las mismas variables de entorno.

## Tablas disponibles

La API acepta únicamente las tablas usadas por la aplicación. La lista está en `api/data.js`; agregar una tabla nueva requiere incluirla ahí y crear o revisar sus políticas RLS antes de consumirla desde React.
