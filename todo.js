/* To-Do List: state-driven rendering, CRUD, filters, localStorage, event delegation */
(function () {
  "use strict";

  var KEY = "todo.tasks.v1";
  var FILTER_KEY = "todo.filter.v1";

  var els = {
    form: document.getElementById("add-form"),
    input: document.getElementById("new-task"),
    list: document.getElementById("task-list"),
    filters: document.getElementById("filters"),
    clear: document.getElementById("clear-done"),
    count: document.getElementById("count"),
    empty: document.getElementById("empty"),
    status: document.getElementById("todo-status")
  };

  /* ---------- State ---------- */
  var state = { tasks: loadTasks(), filter: loadFilter(), editingId: null };

  function isValid(t) {
    return t && typeof t.id === "string" && typeof t.text === "string" && typeof t.done === "boolean";
  }
  function loadTasks() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(raw) ? raw.filter(isValid) : [];
    } catch (e) { return []; }
  }
  function loadFilter() {
    try {
      var f = localStorage.getItem(FILTER_KEY);
      return f === "active" || f === "completed" ? f : "all";
    } catch (e) { return "all"; }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state.tasks));
      localStorage.setItem(FILTER_KEY, state.filter);
    } catch (e) {
      say("Changes could not be saved because browser storage is unavailable.");
    }
  }
  function say(msg) { els.status.textContent = msg; }

  /* ---------- CRUD ---------- */
  function createTask(text) {
    state.tasks.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), text: text, done: false });
    say("Task added.");
  }
  function toggleTask(id) {
    state.tasks.forEach(function (t) { if (t.id === id) t.done = !t.done; });
  }
  function updateTask(id, text) {
    state.tasks.forEach(function (t) { if (t.id === id) t.text = text; });
    say("Task updated.");
  }
  function deleteTask(id) {
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    say("Task deleted.");
  }
  function clearCompleted() {
    var n = state.tasks.filter(function (t) { return t.done; }).length;
    state.tasks = state.tasks.filter(function (t) { return !t.done; });
    say(n + (n === 1 ? " completed task cleared." : " completed tasks cleared."));
  }

  /* ---------- Rendering (builds DOM with createElement, never innerHTML) ---------- */
  function el(tag, props, text) {
    var node = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) { node.setAttribute(k, props[k]); });
    if (text) node.textContent = text;
    return node;
  }
  function visibleTasks() {
    return state.tasks.filter(function (t) {
      return state.filter === "all" || (state.filter === "active" ? !t.done : t.done);
    });
  }
  function buildItem(t) {
    var li = el("li", { "class": "task" + (t.done ? " done" : ""), "data-id": t.id });
    if (state.editingId === t.id) {
      var edit = el("input", { type: "text", "class": "edit", maxlength: "200", "aria-label": "Edit task text" });
      edit.value = t.text;
      li.append(edit,
        el("button", { type: "button", "data-action": "save" }, "Save"),
        el("button", { type: "button", "data-action": "cancel" }, "Cancel"));
    } else {
      var cbId = "cb-" + t.id;
      var cb = el("input", { type: "checkbox", id: cbId, "data-action": "toggle" });
      cb.checked = t.done;
      li.append(cb,
        el("label", { "for": cbId }, t.text),
        el("button", { type: "button", "data-action": "edit", "aria-label": "Edit task: " + t.text }, "Edit"),
        el("button", { type: "button", "class": "danger", "data-action": "delete", "aria-label": "Delete task: " + t.text }, "Delete"));
    }
    return li;
  }
  function render() {
    var shown = visibleTasks();
    els.list.replaceChildren.apply(els.list, shown.map(buildItem));

    var active = state.tasks.filter(function (t) { return !t.done; }).length;
    var doneCount = state.tasks.length - active;
    els.count.textContent = active + (active === 1 ? " task left" : " tasks left") + " of " + state.tasks.length;
    els.clear.disabled = doneCount === 0;

    Array.prototype.forEach.call(els.filters.querySelectorAll("[data-filter]"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-filter") === state.filter));
    });

    var msg = "";
    if (!shown.length) {
      msg = !state.tasks.length ? "No tasks yet. Add your first task above."
        : state.filter === "active" ? "No active tasks. Nice work!" : "No completed tasks yet.";
    }
    els.empty.textContent = msg;
    els.empty.hidden = !msg;

    if (state.editingId) {
      var field = els.list.querySelector("input.edit");
      if (field) { field.focus(); field.select(); }
    }
  }
  function commit() { save(); render(); }

  /* ---------- Delegated event listeners ---------- */
  function idOf(node) { return node.closest("li").getAttribute("data-id"); }

  els.form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = els.input.value.trim();
    if (!text) { say("Type a task before adding it."); els.input.focus(); return; }
    createTask(text);
    els.input.value = "";
    commit();
    els.input.focus();
  });

  els.list.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-action]");
    if (!btn) return;
    var id = idOf(btn), action = btn.getAttribute("data-action");
    if (action === "delete") { deleteTask(id); }
    else if (action === "edit") { state.editingId = id; }
    else if (action === "cancel") { state.editingId = null; }
    else if (action === "save") { saveEdit(btn.closest("li")); return; }
    commit();
  });

  els.list.addEventListener("change", function (e) {
    if (e.target.getAttribute("data-action") === "toggle") {
      toggleTask(idOf(e.target));
      commit();
    }
  });

  els.list.addEventListener("keydown", function (e) {
    if (!e.target.classList.contains("edit")) return;
    if (e.key === "Enter") { e.preventDefault(); saveEdit(e.target.closest("li")); }
    if (e.key === "Escape") { state.editingId = null; commit(); }
  });

  function saveEdit(li) {
    var text = li.querySelector("input.edit").value.trim();
    if (!text) { say("A task cannot be empty. Edit the text or press Cancel."); li.querySelector("input.edit").focus(); return; }
    updateTask(li.getAttribute("data-id"), text);
    state.editingId = null;
    commit();
  }

  els.filters.addEventListener("click", function (e) {
    var b = e.target.closest("[data-filter]");
    if (!b) return;
    state.filter = b.getAttribute("data-filter");
    state.editingId = null;
    commit();
  });

  els.clear.addEventListener("click", function () { clearCompleted(); commit(); });

  /* Keep several open tabs in sync */
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) { state.tasks = loadTasks(); state.editingId = null; render(); }
  });

  render();
})();
