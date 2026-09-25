import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getDatabase, onValue, push, ref, remove, set, update } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyATZ8b5tnEfeXrZtKgBbJb0_Cktz2HLu7Y",
  authDomain: "dios-si-quiere-medellin-2027.firebaseapp.com",
  databaseURL: "https://dios-si-quiere-medellin-2027-default-rtdb.firebaseio.com",
  projectId: "dios-si-quiere-medellin-2027",
  storageBucket: "dios-si-quiere-medellin-2027.firebasestorage.app",
  messagingSenderId: "225419614110",
  appId: "1:225419614110:web:37de5a2ba763c9ed16a88f",
};

const database = getDatabase(initializeApp(firebaseConfig));
const encounterTime = new Date("2027-01-15T20:30:00-05:00").getTime();
const formatter = new Intl.NumberFormat("es-CO");
const names = { mario: "Mario", valery: "Valery" };
const categories = ["planning", "living"];
const filters = { planning: "all", living: "all" };
const status = document.getElementById("sync-status");
const missingLink = document.getElementById("missing-link");
const roomToolbar = document.getElementById("room-toolbar");
const connectionIndicator = document.getElementById("connection-indicator");
const connectionLabel = document.getElementById("connection-label");
const boardsGrid = document.querySelector(".boards-grid");
const boardStatusRow = document.querySelector(".board-status-row");
const undoToast = document.getElementById("undo-toast");

let activeRoom = null;
let activePerson = null;
let unsubscribe = null;
let unsubscribeConnection = null;
let todos = {};
let loading = false;
let connectionKnown = false;
let connectionOnline = false;
let connectionGraceExpired = false;
let connectionGraceTimer = null;
let roomReady = false;
let roomError = false;
let editing = null;
let deleted = null;
let undoTimer = null;

function updateCountdown() {
  const secondsLeft = Math.max(0, Math.ceil((encounterTime - Date.now()) / 1000));
  document.getElementById("weeks").textContent = formatter.format(Math.floor(secondsLeft / 604800));
  document.getElementById("days").textContent = formatter.format(Math.floor(secondsLeft / 86400));
  document.getElementById("hours").textContent = formatter.format(Math.floor(secondsLeft / 3600));
  document.getElementById("seconds").textContent = formatter.format(secondsLeft);
}
updateCountdown();
setInterval(updateCountdown, 1000);

function setStatus(message, tone = "normal") {
  status.textContent = message;
  status.dataset.tone = tone;
  status.hidden = tone !== "error";
}

function renderConnection() {
  let state = "connecting";
  let message = "Conectando con nuestra base de ideas…";
  if (roomError) {
    state = "error";
    message = "No se pudo acceder a nuestras ideas";
  } else if (connectionOnline && roomReady) {
    state = "connected";
    message = "Conectados a nuestra base de ideas y planes";
  } else if (connectionKnown && !connectionOnline && connectionGraceExpired) {
    state = "offline";
    message = "Sin conexión · intentando reconectar";
  }
  connectionIndicator.dataset.state = state;
  connectionLabel.textContent = message;
}

function todoRef(id) {
  return ref(database, `rooms/${activeRoom}/todos/${id}`);
}

function routeFromHash() {
  const match = /^#\/room\/([A-Za-z0-9_-]{8,40})\/(mario|valery)$/.exec(location.hash);
  return match ? { room: match[1], person: match[2] } : null;
}

function closeUndo() {
  clearTimeout(undoTimer);
  undoToast.hidden = true;
  deleted = null;
}

function showUndo(item) {
  clearTimeout(undoTimer);
  deleted = item;
  undoToast.hidden = false;
  undoTimer = setTimeout(closeUndo, 10000);
}

function connectFromRoute() {
  if (unsubscribe) unsubscribe();
  if (unsubscribeConnection) unsubscribeConnection();
  clearTimeout(connectionGraceTimer);
  connectionGraceTimer = null;
  unsubscribe = null;
  unsubscribeConnection = null;
  activeRoom = null;
  activePerson = null;
  todos = {};
  loading = false;
  connectionKnown = false;
  connectionOnline = false;
  connectionGraceExpired = false;
  roomReady = false;
  roomError = false;
  editing = null;
  closeUndo();
  renderConnection();

  const route = routeFromHash();
  if (route) {
    activeRoom = route.room;
    activePerson = route.person;
    loading = true;
  }
  missingLink.hidden = Boolean(route);
  boardsGrid.hidden = !route;
  boardStatusRow.hidden = !route;
  roomToolbar.hidden = !route;
  document.querySelectorAll(".add-preview").forEach((button) => { button.hidden = !route; });
  document.querySelectorAll(".task-form").forEach((form) => { form.hidden = true; });
  renderBoards();

  if (!route) {
    missingLink.textContent = location.hash ? "Este enlace no abre los planes. Pide el enlace personal correcto." : "Abre tu enlace personal para ver los planes compartidos.";
    return;
  }

  const identity = document.getElementById("room-identity");
  if (activePerson === "valery") {
    identity.replaceChildren(
      document.createTextNode("Estás escribiendo como "),
      element("span", "identity-accent", "Valery"),
      document.createTextNode(", el amor de la vida de "),
      element("span", "identity-accent", "Mario"),
      document.createTextNode("."),
    );
  } else {
    identity.replaceChildren(
      document.createTextNode("Estás escribiendo como "),
      element("span", "identity-accent", "Mario"),
    );
  }
  setStatus("Conectando las listas compartidas…");
  const room = activeRoom;
  connectionGraceTimer = setTimeout(() => {
    if (room !== activeRoom) return;
    connectionGraceExpired = true;
    renderConnection();
  }, 4000);
  unsubscribeConnection = onValue(ref(database, ".info/connected"), (snapshot) => {
    if (room !== activeRoom) return;
    connectionKnown = true;
    connectionOnline = snapshot.val() === true;
    if (connectionOnline) {
      connectionGraceExpired = true;
      clearTimeout(connectionGraceTimer);
      connectionGraceTimer = null;
    }
    renderConnection();
  });
  unsubscribe = onValue(ref(database, `rooms/${room}/todos`), (snapshot) => {
    if (room !== activeRoom) return;
    todos = snapshot.val() || {};
    loading = false;
    roomReady = true;
    roomError = false;
    renderBoards();
    renderConnection();
    setStatus("Sincronizado en tiempo real · Tus ideas aparecerán también en el otro dispositivo.");
  }, () => {
    if (room === activeRoom) {
      loading = false;
      roomReady = false;
      roomError = true;
      renderBoards();
      renderConnection();
      setStatus("No pudimos abrir esta sala. Revisa el código o la conexión e inténtalo de nuevo.", "error");
    }
  });
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function actionButton(label, action, className = "") {
  const button = element("button", className, label);
  button.type = "button";
  button.dataset.action = action;
  return button;
}

function makeTaskCard(id, task) {
  const card = element("article", `task${task.completed ? " is-complete" : ""}`);
  card.dataset.id = id;
  const check = actionButton(task.completed ? "✓" : "", "toggle", "task-check");
  check.setAttribute("aria-label", task.completed ? `Marcar «${task.title}» como pendiente` : `Marcar «${task.title}» como hecha`);
  check.setAttribute("aria-pressed", String(Boolean(task.completed)));
  card.append(check);
  const content = element("div", "task-content");
  content.append(element("h4", "", task.title || "Idea sin título"));
  if (task.note) content.append(element("p", "", task.note));
  const author = element("span", "task-author", "Añadido por ");
  author.append(element("strong", "", task.createdBy || "alguien"));
  content.append(author);
  card.append(content);
  const actions = element("div", "task-actions");
  actions.append(actionButton("Editar", "edit"), actionButton("Eliminar", "delete", "task-delete"));
  card.append(actions);
  return card;
}

function labeledField(text, input) {
  const label = element("label", "edit-label", text);
  label.append(input);
  return label;
}

function makeEditCard(id, task) {
  const card = element("article", "task task-editing");
  card.dataset.id = id;
  const form = element("form", "edit-form");
  form.dataset.editId = id;
  const title = element("input");
  title.name = "title";
  title.type = "text";
  title.required = true;
  title.maxLength = 160;
  title.value = editing?.title ?? task.title;
  const note = element("textarea");
  note.name = "note";
  note.maxLength = 1000;
  note.rows = 2;
  note.value = editing?.note ?? task.note ?? "";
  form.append(labeledField("Título", title), labeledField("Nota opcional", note));
  const actions = element("div", "form-actions");
  actions.append(actionButton("Cancelar", "cancel-edit", "form-cancel"));
  const save = element("button", "form-submit", "Guardar cambios");
  save.type = "submit";
  actions.append(save);
  form.append(actions);
  card.append(form);
  return card;
}

function renderBoard(category) {
  const list = document.getElementById(`${category}-list`);
  const all = Object.entries(todos)
    .filter(([, task]) => task && task.category === category)
    .sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));
  const count = all.length;
  document.getElementById(`${category}-count`).textContent = `${count} ${count === 1 ? "idea" : "ideas"}`;
  const visible = all.filter(([, task]) => filters[category] === "all" || (filters[category] === "done" ? task.completed : !task.completed));
  const nodes = visible.map(([id, task]) => editing?.id === id ? makeEditCard(id, task) : makeTaskCard(id, task));
  if (!nodes.length) {
    let message = "Todavía no hay ideas. La primera puede ser tuya ♡";
    if (!activeRoom) message = "Abre tu enlace personal para ver las ideas compartidas.";
    else if (loading) message = "Cargando ideas compartidas…";
    else if (filters[category] === "pending") message = "No hay ideas pendientes por ahora.";
    else if (filters[category] === "done") message = "Aún no hay ideas hechas.";
    nodes.push(element("p", "task-empty", message));
  }
  list.replaceChildren(...nodes);
}

function renderBoards() {
  categories.forEach(renderBoard);
}

document.querySelectorAll(".board").forEach((board) => {
  const category = board.dataset.category;
  board.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      filters[category] = button.dataset.filter;
      board.querySelectorAll(".filter-button").forEach((filterButton) => {
        const active = filterButton === button;
        filterButton.classList.toggle("is-active", active);
        filterButton.setAttribute("aria-pressed", String(active));
      });
      renderBoard(category);
    });
  });

  const addButton = board.querySelector(".add-preview");
  const form = board.querySelector(".task-form");
  addButton.addEventListener("click", () => {
    if (!activeRoom) return;
    addButton.hidden = true;
    form.hidden = false;
    form.elements.title.focus();
  });
  form.querySelector(".form-cancel").addEventListener("click", () => {
    form.reset();
    form.hidden = true;
    addButton.hidden = false;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeRoom) return;
    const title = form.elements.title.value.trim();
    if (!title) return;
    const note = form.elements.note.value.trim();
    const now = Date.now();
    const task = { title, category, completed: false, createdBy: names[activePerson], createdAt: now, updatedAt: now };
    if (note) task.note = note;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await set(push(ref(database, `rooms/${activeRoom}/todos`)), task);
      form.reset();
      form.hidden = true;
      addButton.hidden = false;
    } catch {
      setStatus("No se pudo guardar la idea. Comprueba la conexión e inténtalo otra vez.", "error");
    } finally {
      submit.disabled = false;
    }
  });

  const list = board.querySelector(".task-list");
  list.addEventListener("input", (event) => {
    if (!editing || !event.target.name) return;
    if (event.target.name === "title" || event.target.name === "note") editing[event.target.name] = event.target.value;
  });
  list.addEventListener("submit", async (event) => {
    const editForm = event.target.closest(".edit-form");
    if (!editForm) return;
    event.preventDefault();
    const id = editForm.dataset.editId;
    const title = editForm.elements.title.value.trim();
    if (!title || !todos[id]) return;
    const note = editForm.elements.note.value.trim();
    const save = editForm.querySelector('[type="submit"]');
    save.disabled = true;
    try {
      await update(todoRef(id), { title, note: note || null, updatedAt: Date.now() });
      editing = null;
      renderBoards();
    } catch {
      setStatus("No se pudieron guardar los cambios. Inténtalo de nuevo.", "error");
      save.disabled = false;
    }
  });
  list.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    const card = button?.closest(".task[data-id]");
    if (!card || !activeRoom) return;
    const id = card.dataset.id;
    const task = todos[id];
    if (!task && button.dataset.action !== "cancel-edit") return;
    switch (button.dataset.action) {
      case "toggle":
        button.disabled = true;
        try { await update(todoRef(id), { completed: !task.completed, updatedAt: Date.now() }); }
        catch { setStatus("No se pudo cambiar el estado de la idea.", "error"); button.disabled = false; }
        break;
      case "edit":
        editing = { id, title: task.title, note: task.note || "" };
        renderBoards();
        document.querySelector(`.task[data-id="${id}"] .edit-form input`).focus();
        break;
      case "cancel-edit":
        editing = null;
        renderBoards();
        break;
      case "delete":
        button.disabled = true;
        try {
          await remove(todoRef(id));
          if (editing?.id === id) editing = null;
          showUndo({ id, task });
        } catch { setStatus("No se pudo eliminar la idea. Inténtalo de nuevo.", "error"); button.disabled = false; }
        break;
    }
  });
});

document.getElementById("undo-button").addEventListener("click", async () => {
  if (!deleted || !activeRoom) return;
  const { id, task } = deleted;
  const button = document.getElementById("undo-button");
  button.disabled = true;
  try { await set(todoRef(id), task); closeUndo(); }
  catch { setStatus("No se pudo recuperar la idea. Inténtalo de nuevo.", "error"); }
  finally { button.disabled = false; }
});

window.addEventListener("hashchange", connectFromRoute);
connectFromRoute();
