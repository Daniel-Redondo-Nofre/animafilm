-- ═══════════════════════════════════════════════════════════════════════
-- AnimaFilm — 04. Gestión de cuenta
--
-- El cliente NO puede borrar de `auth.users`: es un esquema protegido y
-- la anon key no tiene permiso. La solución correcta es una función
-- SECURITY DEFINER que se ejecuta con privilegios elevados pero solo
-- borra la cuenta de QUIEN LA LLAMA (auth.uid()), nunca otra.
--
-- Ejecutar en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. BORRAR LA PROPIA CUENTA
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'No hay sesión iniciada';
  end if;

  -- El resto de tablas cuelgan de profiles/auth.users con ON DELETE
  -- CASCADE, así que esta única sentencia se lleva valoraciones,
  -- reseñas, vistas, pendientes y seguidores.
  delete from auth.users where id = uid;
end;
$$;

-- Solo usuarios autenticados. `anon` no debe poder ni intentarlo.
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 2. ¿ESTÁ LIBRE ESTE NOMBRE DE USUARIO?
--
--    Se podría comprobar con un select sobre profiles, pero eso permite
--    enumerar usuarios cómodamente. Con una función que solo devuelve
--    true/false damos lo justo.
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.username_disponible(nombre text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.profiles
    where username = lower(trim(nombre))
      and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

revoke all on function public.username_disponible(text) from public;
grant execute on function public.username_disponible(text) to authenticated;


-- ───────────────────────────────────────────────────────────────────────
-- 3. VALIDACIÓN DEL PERFIL EN LA BASE DE DATOS
--
--    Validar solo en el navegador no sirve: cualquiera puede llamar a la
--    API directamente con la anon key. El trigger normaliza y comprueba
--    aunque la petición no venga de nuestra web.
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.validar_perfil()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.username := lower(trim(new.username));

  if new.username !~ '^[a-z0-9_.-]{3,20}$' then
    raise exception 'El nombre de usuario debe tener entre 3 y 20 caracteres: letras, números, guion, punto o guion bajo.';
  end if;

  new.display_name := nullif(trim(coalesce(new.display_name, '')), '');
  new.bio          := nullif(trim(coalesce(new.bio, '')), '');

  if new.display_name is not null and char_length(new.display_name) > 40 then
    raise exception 'El nombre visible no puede pasar de 40 caracteres.';
  end if;
  if new.bio is not null and char_length(new.bio) > 300 then
    raise exception 'La biografía no puede pasar de 300 caracteres.';
  end if;

  -- El id nunca cambia, pase lo que pase
  if TG_OP = 'UPDATE' and new.id <> old.id then
    raise exception 'Operación no permitida';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_validar on public.profiles;
create trigger profiles_validar
  before insert or update on public.profiles
  for each row execute function public.validar_perfil();


-- ───────────────────────────────────────────────────────────────────────
-- 4. COMPROBACIÓN
-- ───────────────────────────────────────────────────────────────────────
select proname, prosecdef as security_definer
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('delete_own_account','username_disponible','validar_perfil');
