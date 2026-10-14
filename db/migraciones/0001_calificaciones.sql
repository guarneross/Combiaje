-- ---------------------------------------------------------------------------
-- 0001 · Calificaciones de la comunidad
--
-- Se aplica una vez, pegándola en el editor SQL de Supabase.
-- Es idempotente: se puede correr dos veces sin romper nada.
--
-- QUÉ VIVE AQUÍ Y QUÉ NO
--
-- En esta base **solo vive lo que escribe la comunidad**. Las rutas, sus
-- trazos y las concesionarias siguen viniendo de `data/rutas/` y del JSON que
-- genera `pnpm rutas`, versionado en git.
--
-- La razón es concreta: la capa gratuita de Supabase pausa el proyecto por
-- inactividad. Si el mapa dependiera de esta base, el sitio se caería solo
-- cada tanto. Así, si la base no responde, el mapa y las rutas siguen en pie y
-- lo único que se degrada son las calificaciones.
--
-- Por eso `route_slug` es texto y no una llave foránea: la ruta no está en
-- esta base. El slug es estable —es la URL pública de la ruta— y el Route
-- Handler valida que exista antes de escribir. Cuando las rutas se muden a
-- Postgres (hito S3, con el editor de trazos), aquí se agrega la llave.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- ratings
--
-- Una fila por persona y por ruta. Volver a calificar **actualiza** la
-- calificación anterior en vez de agregar otra: una persona, una opinión.
--
-- Las cinco dimensiones son opcionales a propósito. El formulario mínimo es
-- una sola cosa —las estrellas— porque quien está parado en la esquina con
-- prisa no llena cinco controles, y cinco controles obligatorios se traducen
-- en cero calificaciones. Quien quiera dar el detalle lo da; con esa minoría
-- basta para que los promedios por dimensión signifiquen algo.
--
-- `vehicle_number` es texto libre y NO hay tabla `vehicles`. El plan la tenía
-- colgando de `routes`, lo cual es falso: una unidad anda hoy en un recorrido
-- y mañana en otro. En vez de corregir esa tabla, se pospone: mientras el
-- selector de unidad sea opcional y no exista la pantalla `/unidades`, una
-- tabla aparte no compra nada, y así es imposible volver a atar una unidad a
-- una ruta por accidente. El día que haya suficientes calificaciones para que
-- buscar por unidad valga la pena, se crea `vehicles` colgando de la
-- concesionaria y se rellena desde esta columna.
-- ---------------------------------------------------------------------------
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),

  -- Quién. Con sesión anónima de Supabase esto es un usuario de verdad, con
  -- su propio id, aunque nunca haya dado un correo.
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Qué ruta. Es el slug público: `ruta-21-canal-rincon`.
  route_slug text not null check (route_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  -- Lo único obligatorio.
  overall smallint not null check (overall between 1 and 5),

  -- Las cinco dimensiones, todas opcionales.
  safety smallint check (safety between 1 and 5),
  cleanliness smallint check (cleanliness between 1 and 5),
  driver smallint check (driver between 1 and 5),
  driving smallint check (driving between 1 and 5),
  frequency smallint check (frequency between 1 and 5),

  -- El número económico pintado en la unidad, si lo recuerda.
  vehicle_number text check (
    vehicle_number is null
    or (char_length(btrim(vehicle_number)) between 1 and 16)
  ),

  comment text check (comment is null or char_length(comment) <= 500),

  -- Moderación mínima. El plan solo descartó la cola con roles —mientras el
  -- moderador sea una sola persona, un botón de reportar y un correo bastan—,
  -- pero esta columna cuesta tres líneas hoy y una migración mañana. Esconder
  -- un comentario es un UPDATE.
  status text not null default 'visible'
    check (status in ('visible', 'flagged', 'hidden')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Una persona, una calificación por ruta. Volver a calificar la actualiza.
  --
  -- ⚠️ Esto se aparta del plan maestro, que tenía un índice único por semana
  -- (`ratings_one_per_week`) y por lo tanto permitía varias filas de la misma
  -- persona para la misma ruta. Se cambió a propósito: con el índice semanal,
  -- quien usa una ruta todos los días podía acumular cincuenta votos y mover
  -- el promedio él solo, y «mi calificación» dejaba de tener una respuesta.
  -- Una persona, una opinión, siempre corregible.
  constraint ratings_una_por_persona_y_ruta unique (user_id, route_slug)
);

-- La consulta que se hace en cada ficha de ruta.
create index if not exists ratings_route_slug_idx on public.ratings (route_slug);

-- Para «¿en qué recorridos se ha visto esta unidad?», que es un dato que hoy
-- no tiene nadie. Parcial: la mayoría de las filas no va a traer unidad.
create index if not exists ratings_vehicle_number_idx
  on public.ratings (vehicle_number)
  where vehicle_number is not null;

-- ---------------------------------------------------------------------------
-- updated_at al día, sin confiar en que la aplicación se acuerde
-- ---------------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ratings_tocar_updated_at on public.ratings;
create trigger ratings_tocar_updated_at
  before update on public.ratings
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- route_rating_stats · los promedios que pide el contrato
--
-- `avg()` ignora los nulos, así que una dimensión que nadie ha calificado sale
-- en `null` y no en cero. Eso es deliberado y está en el contrato: un promedio
-- de cero es mentira; la ausencia de datos no lo es.
--
-- El promedio bayesiano (C = 20, m = 3.5) es el que sirve para ordenar: evita
-- que una ruta con una sola calificación de cinco estrellas le gane a una con
-- doscientas de cuatro y media.
-- ---------------------------------------------------------------------------
create or replace view public.route_rating_stats as
select
  route_slug,
  count(*)::int                                             as ratings_count,
  round(avg(overall)::numeric, 2)::float8                   as avg_overall,
  round(avg(safety)::numeric, 2)::float8                    as avg_safety,
  round(avg(cleanliness)::numeric, 2)::float8               as avg_cleanliness,
  round(avg(driver)::numeric, 2)::float8                    as avg_driver,
  round(avg(driving)::numeric, 2)::float8                   as avg_driving,
  round(avg(frequency)::numeric, 2)::float8                 as avg_frequency,
  round(
    ((count(*) * avg(overall) + 20 * 3.5) / (count(*) + 20))::numeric, 3
  )::float8                                                 as bayesian_score
from public.ratings
where status = 'visible'
group by route_slug;

-- ---------------------------------------------------------------------------
-- Seguridad a nivel de fila
--
-- La aplicación escribe a través de sus propios Route Handlers, no desde el
-- navegador. Esto es la segunda línea: si la llave pública se filtrara, lo
-- peor que alguien podría hacer es calificar como sí mismo.
-- ---------------------------------------------------------------------------
alter table public.ratings enable row level security;

drop policy if exists "cualquiera puede leer calificaciones" on public.ratings;
create policy "cualquiera puede leer calificaciones"
  on public.ratings for select
  using (status = 'visible' or auth.uid() = user_id);

drop policy if exists "cada quien escribe la suya" on public.ratings;
create policy "cada quien escribe la suya"
  on public.ratings for insert
  with check (auth.uid() = user_id);

drop policy if exists "cada quien corrige la suya" on public.ratings;
create policy "cada quien corrige la suya"
  on public.ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cada quien borra la suya" on public.ratings;
create policy "cada quien borra la suya"
  on public.ratings for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Permisos para la API de datos de Supabase
--
-- `anon` es quien todavía no tiene sesión; `authenticated` incluye a los
-- usuarios anónimos de Supabase, que son usuarios de verdad con su propio id.
-- Las políticas de arriba son las que de verdad deciden qué fila toca cada
-- quien; esto solo abre la puerta.
-- ---------------------------------------------------------------------------
grant select on public.route_rating_stats to anon, authenticated;
grant select on public.ratings to anon;
grant select, insert, update, delete on public.ratings to authenticated;

-- ---------------------------------------------------------------------------
-- Mantenimiento: usuarios anónimos viejos
--
-- Supabase no los limpia solo, y cada uno ocupa una fila en `auth.users`. Esto
-- borra los que llevan más de un año sin volver **y que nunca calificaron**;
-- los que sí dejaron una calificación se conservan, porque borrarlos se
-- llevaría su opinión por delante (`on delete cascade`).
--
-- Correr a mano cada tanto desde el editor SQL. No es un cron: con el tamaño
-- que tiene esto hoy, automatizarlo sería inventarse trabajo.
--
--   delete from auth.users u
--   where u.is_anonymous
--     and u.created_at < now() - interval '1 year'
--     and not exists (select 1 from public.ratings r where r.user_id = u.id);
-- ---------------------------------------------------------------------------
