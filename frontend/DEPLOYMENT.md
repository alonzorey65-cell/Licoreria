# Despliegue de la tienda

GitHub Pages publica solo el frontend. El backend debe estar publicado en HTTPS
y configurado con sus credenciales de Supabase en el proveedor de alojamiento.

En GitHub, configura estos secretos en **Settings > Secrets and variables >
Actions** antes de desplegar:

- `VITE_API_URL`: dirección pública del backend, por ejemplo
  `https://tu-servidor.onrender.com/api`. También se acepta la dirección sin
  `/api`; la aplicación lo agrega cuando se proporciona solo el dominio.
- `VITE_SUPABASE_URL`: URL del proyecto Supabase, no la URL del backend.
- `VITE_SUPABASE_ANON_KEY`: clave pública (anon o publishable) del mismo
  proyecto Supabase. Nunca uses una clave `service_role` en el frontend.

Los valores se incorporan al compilar: después de cambiar un secreto, ejecuta
de nuevo el flujo de GitHub Actions y espera a que termine el despliegue. Para
comprobar la conexión, visita `VITE_API_URL/licores` usando una URL terminada
en `/api`; debe devolver una respuesta JSON.
