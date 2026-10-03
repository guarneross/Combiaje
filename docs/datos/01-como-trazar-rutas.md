# Cómo trazar las rutas

> Este documento lo escribió el chat de **Frontend** tras investigar las
> opciones, pero el dueño del tema es **Datos / GIS**. Que lo tome, lo corrija
> y lo haga suyo.

El dataset no existe. Construirlo es ~35 % del esfuerzo del proyecto y es lo
único que Google Maps y Moovit no tienen para el transporte concesionado de
Puebla. Es lo valioso.

---

## Paso 0 · La tarea bloqueante: medir qué hay en OpenStreetMap

**Nadie debería escribir más código hasta que alguien corra esto.** El
resultado decide si el hito 1 arranca con rutas regaladas o desde cero.

Entra a <https://overpass-turbo.eu>, pega esto y dale «Ejecutar»:

```overpassql
[out:json][timeout:120];
{{geocodeArea:"Puebla de Zaragoza"}}->.a;
(
  relation(area.a)["type"="route"]["route"~"bus|trolleybus|share_taxi"];
);
out body geom;
```

### Cómo leer el resultado

No basta con contar relaciones. Lo que importa es **cuántas tienen geometría
completa y continua**:

| Qué mirar | Por qué |
|---|---|
| Número total de relaciones | Cuántas rutas alguien ya empezó a mapear |
| Cuántas tienen `members` con geometría | Una relación sin tramos no sirve de nada |
| Si los tramos están **en orden y sin huecos** | Lo más común: vienen desordenados o con saltos. Hay que reconstruirlos |
| Si traen `ref` (número) y `name` | Sin eso hay que adivinar de qué ruta se trata |
| Si distinguen ida y vuelta (`direction` o dos relaciones) | Si no, falta la mitad del trabajo |

Anota el número y pégalo en la bitácora del proyecto. Con ese dato se decide
el alcance real del hito 1.

> El trabajo de reconstruir relaciones desordenadas en LineStrings continuas es
> exactamente la «historia técnica» del rol de Datos/GIS que pide el plan
> maestro §10. Vale la pena hacerlo bien y medirlo.

---

## El error que hay que evitar: dibujar a mano alzada

La tentación es trazar el recorrido clic por clic sobre el mapa. **No.** Una
línea dibujada a mano corta esquinas y no sigue calles, y eso rompe tres cosas
que no se notan hasta que ya hay 40 rutas cargadas:

1. Las distancias salen mal y `/nearby` ordena mal los resultados.
2. `ST_LineLocatePoint` —el que decide si una ruta te sirve en el sentido
   correcto— devuelve posiciones falsas.
3. Se ve mal a zoom alto, justo donde alguien decide si confía en la app.

**Lo correcto es pegar el trazo a la red de calles.** Marcas de 5 a 15 puntos
de paso y un motor de ruteo calcula el recorrido real entre ellos.

### Motores libres y sin llave

| Motor | Para qué | Nota |
|---|---|---|
| **OSRM** | Pegar puntos de paso a calles | Más fácil de levantar. El servidor público de demostración **prohíbe el uso intensivo** y puede cortar el acceso sin aviso: sirve para los primeros trazos, no para un flujo diario |
| **Valhalla** | *Map matching* de grabaciones GPS (`trace_route`) | Más trabajo de montar, pero es la pieza central del método de grabación. Acepta `shape` o `encoded_polyline`; recomienda **un punto por segundo** |

Para M2 se autohospeda en Docker con un recorte de OSM de Puebla (bajar el
`.osm.pbf` de México de Geofabrik y recortarlo con `osmium` al recuadro
metropolitano). Cabe en menos de 1 GB de RAM. Eso es trabajo de DevOps.

---

## Las tres fuentes, con el esfuerzo real

### A · OpenStreetMap

Gratis, licencia ODbL, ya está ahí. Cobertura desconocida hasta el paso 0.
Costo: una hora de consulta + lo que cueste normalizar.

### B · Grabar el recorrido viajando — la fuente de verdad

Te subes al camión con un grabador de GPX y te bajas en la terminal.

Detalles que importan:

- **Usa una app nativa de registro GPX, no el navegador.** La API de
  geolocalización del navegador se muere cuando se bloquea la pantalla, y iOS
  Safari suspende las pestañas en segundo plano: un recorrido de 45 minutos no
  sobrevive. OsmAnd, Geo Tracker o GPS Logger en Android sirven.
- **Un punto por segundo**, que es la densidad que pide el *map matching*.
- **Ida y vuelta son dos grabaciones distintas, no una invertida.** En el centro
  de Puebla, con calles de un solo sentido, el camión regresa por otra calle.
  *(Los datos simulados de `apps/web/src/mocks` sí invierten la ida: está bien
  para desarrollar interfaz y estaría muy mal en el dataset real.)*
- **Graba siempre en el orden del recorrido.** Es lo que hace que el sentido
  quede bien y que el planificador no sugiera rutas al revés.

**Regalo que viene de aquí**: las marcas de tiempo del GPX dan la **velocidad
real por tramo**. Eso alimenta después al planificador y a la dimensión de
«frecuencia» de las calificaciones. Ninguna plataforma grande tiene eso para el
concesionado poblano.

Costo: lo que dure el viaje + ~10 minutos de procesamiento. Diez rutas, ida y
vuelta, entre cuatro personas: **15–20 horas de campo**.

### C · Trazar con conocimiento local

Alguien que usa la ruta a diario marca sus puntos de paso en 10–20 minutos por
sentido. Se guarda con `data_source: 'manual'` y `status: 'draft'` hasta que
alguien la verifique en campo.

También es legítimo **leer el parabrisas**: los camiones traen rotuladas las
calles principales. Es un letrero público.

---

## El plan recomendado para las 10 rutas del hito 1

1. Correr la consulta de Overpass. Una hora. Bloqueante.
2. Elegir el corredor (CAPU ↔ Centro ↔ Angelópolis) y listar sus rutas.
3. **Viajar y grabar 2 o 3 rutas completas.** No por cobertura, sino para tener
   verdad de campo contra la cual medir los trazos hechos de memoria.
4. Trazar las otras 7 con puntos de paso + ruteo, desde conocimiento local.
5. **Comparar.** Si los trazos de memoria quedan a menos de ~50 m de los
   grabados, el método barato sirve y se escala a M2. Si no, hay que viajar
   todas.

El paso 5 convierte esto en una decisión con dato en vez de una apuesta, y se
cuenta muy bien en una entrevista.

---

## Validación antes de publicar

Ninguna ruta pasa a `status: 'published'` sin esto:

- [ ] Longitud entre 3 y 40 km.
- [ ] Sin saltos mayores a 500 m entre puntos consecutivos.
- [ ] Completamente dentro del recuadro metropolitano
      `[-98.42, 18.89, -98.03, 19.17]`.
- [ ] Empieza y termina cerca de una terminal o punto de referencia conocido.
- [ ] Ida y vuelta de longitud parecida (diferencia < 25 %).
- [ ] `ST_LineLocatePoint` creciente a lo largo del recorrido.
- [ ] Revisada por otra persona del equipo.

---

## Lo legal

- Se importa **solo** de OSM (ODbL) y de fuentes oficiales abiertas, con
  atribución siempre visible.
- **Nada de descargar ni automatizar extracción** de El Rutero, Rutadirecta ni
  Moovit. Mirarlos como humano para saber *qué rutas existen* es como mirar un
  letrero en la calle: el número de una ruta es un hecho, no una obra. Su
  archivo de geometría es suyo, y hay que trazar el propio.
- Lo que genere Combiaje se publica bajo **ODbL**, y eso se declara en el sitio.

---

## El editor interno (hito M2)

Lo construye Frontend, en `apps/web` bajo `/admin/trazar`, protegido por rol:
mismo despliegue, misma sesión, reutilizando `<CombiajeMap>`.

Qué hará: clic para poner puntos de paso con pegado automático a calles;
arrastrar para corregir, con deshacer; soltar un GPX encima y que lo pegue
solo; panel de metadatos; validación en vivo con la lista de arriba; guardar
como borrador hacia la cola de moderación.

`POST /contributions/routes` y `/moderation/:id/approve` ya existen en el
contrato, así que el flujo cabe sin inventar endpoints. Falta definir dos
cosas, marcadas en `docs/frontend/04-contrato.md`:

- **⚠️ El cuerpo de `POST /contributions/routes`.**
- **⚠️ Un endpoint de pegado a calles** (`POST /match`) que el backend proxee
  hacia OSRM o Valhalla, en vez de que el navegador le pegue directo: una sola
  URL, un solo motor para el editor y para los scripts, y control del límite de
  peticiones.
