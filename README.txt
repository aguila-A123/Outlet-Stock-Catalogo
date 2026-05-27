OUTLET STOCK - CATALOGO + LOGIN + PERFIL EDITABLE

Incluye:
- Catálogo Outlet Stock.
- Registro e inicio de sesión con Supabase Auth.
- Perfil registrado en Supabase.
- Botón de tuerca para editar perfil.
- Edición de nombre, domicilio, teléfono, código postal y contraseña.
- El correo se muestra, pero no se edita desde el perfil.
- Los cambios se actualizan en public.profiles y en user_metadata de Supabase Auth.

PASOS PARA CORRER LOCAL:
1) Abre la carpeta en VS Code.
2) Ejecuta:
   npm install
3) Ejecuta:
   npm run dev
4) Abre la URL local que aparece en la consola.

SUPABASE:
1) Ve a Supabase > SQL Editor.
2) Ejecuta el archivo:
   SUPABASE_PROFILES.sql
3) Si usas chat en tiempo real, revisa también:
   SUPABASE_RLS_OPCIONAL.sql

IMPORTANTE:
- La conexión Supabase ya está en src/App.jsx con tu URL y anon key.
- El anon key de Supabase es público para frontend, pero no compartas service_role keys.
