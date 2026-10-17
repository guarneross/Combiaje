# Cómo agregar una ruta que conoces

Esto convierte lo que traes en la cabeza en un trazo que sigue calles de
verdad. Toma unos 15 minutos por sentido la primera vez.

## La receta corta

```bash
pnpm ruta:nueva ruta-72-centro-la-margarita 72 "Centro – La Margarita"
#   dibuja ida.geojson y vuelta.geojson en geojson.io y guárdalos en esa carpeta
pnpm rutas     # pega los puntos a las calles
pnpm dev       # míralo
git add -A && git commit -m "Ruta 72" && git push    # queda en línea en ~2 min
```

Lo demás de este documento es el detalle: dónde poner los puntos, qué hacer
cuando el trazo sale con rodeos, y qué significa cada campo.

**No dibujes el recorrido completo a mano.** Marcas unos cuantos puntos de paso
y un motor de ruteo calcula el camino real entre ellos, respetando sentidos
únicos y vueltas prohibidas. Dibujar a mano produce líneas que cortan esquinas
y atraviesan manzanas.

---

## Dos formas de conseguir el trazo

|                     | **Dibujarlo** (geojson.io) | **Grabarlo** (subiéndote al camión) |
| ------------------- | -------------------------- | ----------------------------------- |
| Qué necesitas       | Memoria y una computadora  | Una hora y pasaje                   |
| Archivo             | `ida.geojson`              | `ida.gpx`                           |
| Qué tan fiel es     | Lo que recuerdas           | Por dónde pasó de verdad            |
| `status` que merece | `draft`                    | Candidato a `published`             |

Las dos entran por la misma puerta: `pnpm rutas`. Si existen las dos para el
mismo sentido, **gana la grabación**: es la realidad medida, no la memoria.
Y el origen del dato pasa solo a `gps`, que es lo que la ficha le enseña a la
gente.

Dibujar sirve para empezar hoy. Grabar es lo que convierte a Combiaje en algo
que nadie más tiene. La sección **«Grabarla a bordo»**, más abajo, explica cómo.

---

## Paso 1 · Marca los puntos de paso

Abre **<https://geojson.io>**. No necesitas cuenta.

1. Cambia el mapa base a **OSM** (menú arriba a la derecha) para ver nombres de
   calles.
2. Acércate a Puebla y busca el inicio de la ruta.
3. Elige la herramienta de **línea** (el icono de polilínea, arriba a la
   derecha).
4. **Haz clic en orden, siguiendo el recorrido**, de la terminal de origen a la
   de destino.

Cuántos puntos: **uno por cada vuelta o decisión**, no uno cada cuadra. Diez a
veinticinco puntos suelen bastar para una ruta completa. En un tramo recto de
dos kilómetros, dos puntos sobran.

### Dónde NO poner un punto

Esto es lo que más rodeos falsos causa, y vale la pena aprenderlo de una vez:

- **Nunca justo en una esquina donde la ruta da vuelta.** Pon uno unos metros
  antes del crucero y otro unos metros después, sobre la calle de salida. Un
  punto encima del crucero deja al motor sin saber por dónde entrar y salir.
- **Nunca sobre un puente, un distribuidor o un paso a desnivel.** Ahí hay
  varias calles encimadas y el punto se pega a la lateral en vez de al puente.
  Pon uno antes de subir y otro después de bajar, y deja que el motor resuelva
  el puente.
- **Cuidado en avenidas con camellón.** Los dos sentidos son calles distintas:
  si el punto cae del lado contrario, el motor da la vuelta a la manzana para
  tocarlo.

Si algo sale con un rodeo, el script te dice **exactamente qué punto moverlo**,
con sus coordenadas.

5. Doble clic para terminar la línea.
6. **Save → GeoJSON**. Te descarga un archivo.

## Paso 2 · Guárdalo en el proyecto

Crea la carpeta con un comando, para no copiar `_ejemplo/` ni acordarte de
borrar sus comentarios:

```bash
pnpm ruta:nueva ruta-72-centro-la-margarita 72 "Centro – La Margarita"
```

Eso deja `ruta.json` listo, con un **color que no esté usando otra ruta** y la
denominación vigente ya llenada. Luego metes ahí los dos GeoJSON:

```
data/rutas/ruta-72-centro-la-margarita/
├─ ruta.json        ← lo creó el comando; revisa tarifa y concesionaria
├─ ida.geojson      ← lo que descargaste
└─ vuelta.geojson   ← el sentido contrario, trazado aparte
```

Los nombres `ida.geojson` y `vuelta.geojson` **son exactos**: el script busca
esos dos y nada más. Si solo tienes uno, no pasa nada —la ficha avisa que falta
el regreso—, pero una ruta sin vuelta sirve a medias.

El nombre de la carpeta es el `slug`: minúsculas, números y guiones. Es lo que
va a salir en la URL (`/rutas/ruta-72-centro-la-margarita`).

> `ruta.json` es **uno por ruta**, no uno por sentido. Lo que cambia entre ida
> y vuelta es el GeoJSON; el número, el nombre, el color y la tarifa son los
> mismos.

> **Ida y vuelta son dos trazos distintos, no uno invertido.** En el centro de
> Puebla, con calles de un solo sentido, el camión regresa por otra calle.
> Trázalos por separado o la ruta de regreso será falsa.

## Paso 3 · Pégalo a las calles

```bash
pnpm rutas
```

Eso lee todas las carpetas de `data/rutas/`, le pide a un motor de ruteo el
recorrido real por calles, y escribe el resultado donde la aplicación lo lee.
Guarda el resultado en caché: si vuelves a correrlo sin cambiar nada, no pide
nada a la red.

Te avisa si algo se ve mal: una ruta demasiado corta o larga, un salto de más
de 500 m entre puntos seguidos, o puntos fuera del área metropolitana.

## Paso 4 · Míralo

```bash
pnpm dev
```

**En cuanto exista al menos una ruta trazada, la aplicación deja de usar las
diez simuladas y usa solo las tuyas.** Así ves exactamente lo que es real.

Si el trazo se desvía, vuelve a geojson.io, agrega o mueve un punto donde se
equivocó, guarda otra vez y corre `pnpm rutas`.

## Paso 5 · Publícalo

```bash
git add -A
git commit -m "Ruta 72 Centro – La Margarita"
git push
```

El push dispara el despliegue solo y en un par de minutos la ruta está en
**combiaje.joscian.com**. No hay que tocar el panel de Hostinger.

Lo que de verdad viaja es `apps/web/src/datos/rutas-reales.json`, que
genera `pnpm rutas`. **Si lo olvidas en el commit, la ruta no aparece en línea
aunque se vea perfecta en tu máquina.** Por eso el `git add -A`.

---

## Grabarla a bordo

Te subes al camión con el teléfono grabando y bajas con el recorrido real.

### Qué aplicación

Cualquiera que exporte **GPX**. En Android sirven **GPS Logger**, **Geo
Tracker** u **OsmAnd**; en iPhone, **MyTracks** o **Open GPX Tracker**. No uses
una de ejercicio que solo exporte a su propia nube.

Configúrala así antes de salir:

- **Un punto cada 1 o 2 segundos**, o cada 5 metros. Lo que ofrezca.
- **Precisión alta / GPS, no «ahorro de batería»**. Esa opción usa las antenas
  del celular y el trazo sale a cuadras de distancia.
- **Que siga grabando con la pantalla apagada.** Casi todas lo piden como
  permiso aparte; si no se lo das, se detiene al guardar el teléfono.

### En el camión

1. **Empieza a grabar al subirte**, no antes. Si grabas tu caminata a la
   parada, esa caminata queda dentro del recorrido de la ruta.
2. **Siéntate junto a la ventana.** En medio del pasillo, rodeado de gente y
   lámina, el GPS se degrada bastante.
3. **Un sentido por archivo.** Llegas a la terminal, detienes la grabación y
   guardas. Para el regreso, empiezas una grabación nueva.
4. **Detén la grabación al bajarte.**

El teléfono en la mano o junto al vidrio. En la bolsa del pantalón también
funciona, pero peor.

### Lo que solo puedes averiguar ahí arriba

El recorrido es la mitad de lo que traes del viaje. Anota también:

- **La tarifa exacta**, y si cambia con estudiante o tercera edad.
- **El nombre de la concesionaria**, rotulado en la puerta o en el costado.
- **El número de la unidad**, el que va pintado grande.
- **El número y los colores nuevos de la SMT**, si ya los trae el parabrisas.
  Eso va a `denominaciones` y es lo que nadie más está guardando.
- Dónde arranca y dónde termina de verdad, que casi nunca es donde uno cree.

Una foto del parabrisas y otra del costado te resuelven casi todo esto.

### De vuelta en la computadora

Pasa el `.gpx` a la carpeta de la ruta con **ese nombre exacto**:

```
data/rutas/ruta-72-centro-la-margarita/
├─ ruta.json
├─ ida.gpx        ← la grabación de ida
└─ vuelta.gpx     ← la grabación de regreso
```

Y corre `pnpm rutas` como siempre.

Una grabación de 40 minutos trae unos 2 400 puntos. El script **la adelgaza
solo**, a uno cada 60 metros: los servidores públicos de ruteo no aceptan más
de 100 coordenadas, y de paso se va la maraña que deja el GPS cuando el camión
está parado en un semáforo. Te dice cuántos puntos quedaron.

Después deja `metodo` en `"match"`: una traza real pegada a calles queda
excelente, porque el emparejador fue diseñado exactamente para esto. Si el GPS
se perdió en un tramo —bajo un puente, entre edificios altos— lo vas a ver en
el mapa, y ahí sí vale cambiar a `"crudo"` o regrabar ese pedazo.

> **La grabación no vuelve verificada la ruta por sí sola.** `published` pide
> que alguien confirme que el recorrido es el de siempre y no el desvío de ese
> día por una obra. Tú ibas a bordo: tú decides.

## Los tres métodos

En `ruta.json`, el campo `metodo` decide qué se hace con tus puntos:

| `metodo`                  | Qué hace                                                       | Cuándo usarlo                                                |
| ------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| `"match"` _(por omisión)_ | Pregunta **por qué calles pasó tu línea**, penalizando desvíos | Siempre, de entrada                                          |
| `"crudo"`                 | Usa tu línea tal cual, sin tocar ningún motor                  | Cuando el motor se empeña en equivocarse, o para ver algo ya |
| `"ruta"`                  | Planea el camino más rápido entre tus puntos                   | Casi nunca. Inventa desvíos por avenidas                     |

**La diferencia entre `match` y `ruta` es la pregunta que se hace.** `ruta`
responde «cómo llego de A a B más rápido en coche»: por eso se va por la
autopista y hace vueltas en U para alcanzar un punto mal puesto. `match`
responde «¿por qué calles va esta línea?», y alejarse de tu trazo le cuesta,
así que no puede inventar rodeos.

### Cuando `match` no alcanza

Si te dice **confianza baja**, **se partió en pedazos**, o simplemente sale
mal, no te pelees con él. Pon:

```json
"metodo": "crudo"
```

Tu línea tal cual. Las esquinas quedan achaflanadas y la línea no cae
exactamente sobre el eje de la calle, pero **es exactamente el recorrido que
dibujaste**, y a los niveles de zoom que la gente usa casi no se nota. Un trazo
crudo correcto vale infinitamente más que uno pegado a calles equivocadas.

Para que el modo crudo se vea bien, dibuja más denso en las vueltas: un punto
cada 30 o 40 metros al dar vuelta, y los tramos rectos como estén.

## Si ya tienes el trazo hecho en otra herramienta

Si exportaste un recorrido que **ya sigue las calles** —de una grabación GPS
pegada a calles, o de un planificador de rutas—, pon en `ruta.json`:

```json
"yaTrazado": true
```

El script lo usa tal cual, sin volver a pedir nada.

## Sobre la licencia

El motor de ruteo usa datos de OpenStreetMap, así que la geometría resultante
queda bajo **ODbL**. Es la decisión que ya tomó el proyecto para la capa de
geometría. Las calificaciones, las tarifas y la analítica de uso siguen siendo
propias. Ver `combiaje/20-modelo-de-negocio.md` §2.

## Antes de pasar una ruta a `published`

- [ ] Alguien la recorrió en camión y confirmó que el trazo es correcto.
- [ ] Ida y vuelta tienen longitudes parecidas (diferencia menor al 25 %).
- [ ] El script no soltó ninguna advertencia.
- [ ] La tarifa está verificada, o está en `null`.

Mientras tanto se queda en `draft`, que es lo honesto.
