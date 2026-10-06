# Cómo agregar una ruta que conoces

Esto convierte lo que traes en la cabeza en un trazo que sigue calles de
verdad. Toma unos 15 minutos por sentido la primera vez.

**No dibujes el recorrido completo a mano.** Marcas unos cuantos puntos de paso
y un motor de ruteo calcula el camino real entre ellos, respetando sentidos
únicos y vueltas prohibidas. Dibujar a mano produce líneas que cortan esquinas
y atraviesan manzanas.

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

Crea una carpeta con el identificador de la ruta y mete ahí los archivos:

```
data/rutas/ruta-72-centro-la-margarita/
├─ ruta.json        ← copia _ejemplo/ruta.json y edítalo
├─ ida.geojson      ← lo que descargaste
└─ vuelta.geojson   ← el sentido contrario, trazado aparte
```

El nombre de la carpeta es el `slug`: minúsculas, números y guiones. Es lo que
va a salir en la URL (`/rutas/ruta-72-centro-la-margarita`).

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

---

## Los tres métodos

En `ruta.json`, el campo `metodo` decide qué se hace con tus puntos:

| `metodo` | Qué hace | Cuándo usarlo |
|---|---|---|
| `"match"` *(por omisión)* | Pregunta **por qué calles pasó tu línea**, penalizando desvíos | Siempre, de entrada |
| `"crudo"` | Usa tu línea tal cual, sin tocar ningún motor | Cuando el motor se empeña en equivocarse, o para ver algo ya |
| `"ruta"` | Planea el camino más rápido entre tus puntos | Casi nunca. Inventa desvíos por avenidas |

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
