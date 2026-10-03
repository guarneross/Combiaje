# Licencias de Combiaje

Combiaje tiene **dos licencias distintas**, porque son dos cosas distintas.

## El código: AGPL-3.0-only

Todo el software de este repositorio está bajo la GNU Affero General Public
License v3, cuyo texto completo está en [`LICENSE`](./LICENSE).

En corto: cualquiera puede usarlo, estudiarlo y modificarlo, pero si lo ofrece
como servicio por red tiene que publicar su código con la misma licencia. Eso
impide que alguien tome este trabajo y lo cierre en un producto propio.

El titular de los derechos conserva la posibilidad de otorgar **licencias
comerciales aparte** a quien no quiera cumplir la AGPL.

## Los datos: ODbL-1.0

El dataset de rutas, paradas y trazos se publica bajo la
[Open Database License v1.0](https://opendatacommons.org/licenses/odbl/1-0/).

Parte del dataset deriva de **OpenStreetMap**, también bajo ODbL. La
atribución a OpenStreetMap es obligatoria y aparece visible en el mapa.

La procedencia se registra ruta por ruta en la columna `data_source`
(`osm | manual | gps | official`). No es un metadato de calidad: es la frontera
entre lo que deriva de OSM y lo que es creación propia. Ver
`docs/datos/01-como-trazar-rutas.md`.

## Lo que no está cubierto por ninguna de las dos

- **El nombre «Combiaje», el logotipo y la identidad visual.** Son del autor y
  no se licencian con el código ni con los datos.
- **Las calificaciones y los comentarios de la comunidad**, que son contenido
  de sus autores y se rigen por los términos de uso del sitio.

## Atribución

> Mapa © colaboradores de Combiaje · Datos de rutas bajo ODbL ·
> Base cartográfica © colaboradores de OpenStreetMap

## Independencia

Combiaje es un proyecto ciudadano independiente. No está afiliado a RUTA, al
Ayuntamiento de Puebla, al Gobierno del Estado ni a ninguna concesionaria, y no
usa sus logotipos ni su identidad.
