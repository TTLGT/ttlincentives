# Fotos de los brokers

Las fotos van **aqui, dentro del repositorio**. Los links de Google Drive no
sirven como origen de imagen en un sitio web: Drive no entrega el archivo, sino
una pagina, asi que la foto sale rota. Por eso se bajan y se suben al repo.

## Como agregarlas

1. Abri la carpeta de Drive **"📷 Fotos de Empleados"**.
2. Descarga la foto del broker.
3. Recortala **cuadrada** y cambiale el tamanio a **400 x 400 px**.
4. Guardala en esta carpeta con el **id del broker** como nombre y extension
   `.jpg`, en minusculas.

Ejemplo: la foto de ALEX FLORES va como `alex-flores.jpg`.

## Nombres exactos de los 25 archivos

```
alexis-garcia.jpg
alex-flores.jpg
andrew-galicia.jpg
bryan-guerra.jpg
james-pena.jpg
javi-duran.jpg
joe-ayala.jpg
jonathan-suazo.jpg
josh-sarceno.jpg
lis-rodriguez.jpg
marv-linares.jpg
mary-gaytan.jpg
saul-escobar.jpg
viny-catalan.jpg
yari-gonzalez.jpg
edvin-paredes.jpg
gus-mendez.jpg
nery-mendez.jpg
oliver-centeno.jpg
gabe-mendez.jpg
juan-diaz.jpg
charly-molina.jpg
joseph-ruano.jpg
marvin-guarchaj.jpg
kevin-romero.jpg
```

Los ids salen de `data/members.json`. Si el nombre del archivo no coincide
exactamente con el id, la foto no se muestra.

## Si todavia no hay fotos

No pasa nada. Mientras falte una foto, el sitio dibuja un circulo azul marino
con las iniciales del broker. **El tablero se ve terminado con cero fotos**, asi
que se pueden ir agregando de a poco.

## Despues de agregarlas

```bash
git add public/photos
git commit -m "Fotos de brokers"
git push
```

El workflow de GitHub Actions publica el sitio solo.

## Peso

Una foto de 400x400 en JPG deberia pesar menos de 100 KB. Si pesan mucho mas,
comprimilas antes de subirlas: son 25 y todas se cargan en la TV de la oficina.
