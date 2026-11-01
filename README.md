# TODO list

Página en español para contar los días hasta nuestro próximo encuentro y planear juntos el viaje a Medellín. Es una web estática: GitHub Pages sirve los archivos y Firebase Realtime Database sincroniza las ideas en tiempo real.

## Publicar en GitHub Pages

1. En este repositorio, abre **Settings → Pages**.
2. En **Build and deployment**, elige **Deploy from a branch**.
3. Selecciona la rama **main**, carpeta **/ (root)** y pulsa **Save**.
4. Cuando GitHub termine, la página base estará en `https://mariosyb.github.io/val-todo-list-med/`.

No hace falta npm, React ni configurar GitHub Actions. Cada nuevo commit enviado a `main` actualizará la página.

## Enlaces personales

Ambos enlaces comparten la misma sala y las mismas listas; el último segmento indica el nombre que aparecerá como autor de las ideas nuevas:

```text
https://mariosyb.github.io/val-todo-list-med/#/room/CODIGO_DE_SALA/mario
https://mariosyb.github.io/val-todo-list-med/#/room/CODIGO_DE_SALA/valery
```

Reemplaza `CODIGO_DE_SALA` por el código real. **No lo guardes en este repositorio público.** La página base, sin enlace personal, muestra el contador pero no abre las listas.

Para recuperar el código en el futuro, ve a **Firebase Console → proyecto `dios-si-quiere-medellin-2027` → Realtime Database → Reglas**. Bajo `rooms` encontrarás la clave literal de la sala. Si ya hay ideas, también aparece en **Datos → rooms**.

Los enlaces no son un inicio de sesión: quien tenga uno puede acceder a la sala y elegir el nombre del enlace que use. Por eso conviene compartirlos solo entre nosotros. La configuración web de Firebase en `script.js` es pública por diseño; las reglas de Realtime Database son las que limitan el acceso a los datos.

## Qué incluye

- Cuenta regresiva en vivo hasta el **15 de enero de 2027 a las 20:30, hora de Panamá**. Es una estimación del momento de vernos cara a cara.
- Listas **Por planear** y **Por vivir en Medellín**.
- Sección **Nuestro menú** con platos por cocinar y una lista **Para el mercado** con ingredientes, cantidades y notas.
- Añadir, editar, marcar como hecha, filtrar y eliminar ideas; se puede deshacer una eliminación durante diez segundos.
- Sincronización entre dispositivos e indicación visible de conexión.
- Nombre del autor de cada idea según su enlace personal.
- Secciones y listas plegables; cada navegador recuerda cuáles prefieres dejar cerradas.

Las ideas se guardan en **Firebase Console → Realtime Database → Datos → `rooms/CODIGO_DE_SALA/todos`**. No están guardadas en GitHub.

## Habilitar el menú en Firebase

Las cuatro listas comparten el mismo formato y la misma ruta de datos. Antes de publicar la versión con menú, abre **Realtime Database → Reglas** y busca la validación de `category` dentro de `rooms → CODIGO_DE_SALA → todos → $todoId` (el nombre de la variable puede ser diferente). Debe permitir estas cuatro categorías:

```json
"category": {
  ".validate": "newData.isString() && (newData.val() === 'planning' || newData.val() === 'living' || newData.val() === 'menu' || newData.val() === 'shopping')"
}
```

Conserva el código de sala y las demás reglas actuales. Publica las reglas y comprueba que se puede añadir un plato y un ingrediente. Esto no modifica ni elimina las ideas existentes.

## Probar antes de compartir

Abre el enlace de Mario y el de Valery en dos dispositivos. Comprueba que ambos ven la misma idea, que el nombre del autor es correcto y que editar, completar y eliminar se reflejan en los dos. Revisa también el contador y el diseño en móvil.

Para ver la web localmente desde la raíz del repositorio:

```bash
python3 -m http.server 3000
```

Después abre `http://127.0.0.1:3000/` con uno de los enlaces personales locales.
