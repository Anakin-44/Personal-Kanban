let appState = JSON.parse(localStorage.getItem("zen_pro_state")) || {
  currentWorkspace: "default",
  workspaces: {
    default: { name: "⛩️ Main Project", tasks: [] },
    personal: { name: "🎋 Personal Sprints", tasks: [] },
  },
};

let transientSubtasks = [];
let timerIntervals = {};

if (localStorage.getItem("zen_theme") === "dark")
  document.documentElement.setAttribute("data-theme", "dark");

function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (isDark) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("zen_theme", "light");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("zen_theme", "dark");
  }
}

function syncState() {
  localStorage.setItem("zen_pro_state", JSON.stringify(appState));
  renderWorkspaceControls();
  renderBoardMatrix();
}

// WORKSPACE SWITCHER CONTROLS
function switchWorkspace(id) {
  // Stop any running timers before jumping workspaces safely
  Object.keys(timerIntervals).forEach((taskId) => stopCardTimer(taskId));
  appState.currentWorkspace = id;
  syncState();
}

function createNewWorkspace() {
  const title = prompt("Enter Workspace Identity Title:");
  if (!title || !title.trim()) return;
  const id = "ws_" + Date.now();
  appState.workspaces[id] = { name: title.trim(), tasks: [] };
  appState.currentWorkspace = id;
  syncState();
}

function renderWorkspaceControls() {
  const bar = document.getElementById("workspaceTabs");
  bar.innerHTML = "";
  Object.keys(appState.workspaces).forEach((id) => {
    const btn = document.createElement("button");
    btn.className = `workspace-tab ${appState.currentWorkspace === id ? "active" : ""}`;
    btn.textContent = appState.workspaces[id].name;
    btn.onclick = () => switchWorkspace(id);
    bar.appendChild(btn);
  });
  const addBtn = document.createElement("button");
  addBtn.className = "workspace-tab";
  addBtn.textContent = "+ New Space";
  addBtn.onclick = createNewWorkspace;
  bar.appendChild(addBtn);
}

// TASK DIALOG FORM SUB-SYSTEM INJECTIONS
function openModal() {
  transientSubtasks = [];
  document.getElementById("subtaskChips").innerHTML = "";
  document.getElementById("taskModal").classList.add("active");
  document.getElementById("titleInput").focus();
}

function closeModal() {
  document.getElementById("taskModal").classList.remove("active");
  document.getElementById("taskForm").reset();
}

function injectSubtaskChip() {
  const input = document.getElementById("subtaskSubInput");
  const txt = input.value.trim();
  if (!txt) return;
  transientSubtasks.push({
    id: "sub_" + Date.now() + Math.random(),
    text: txt,
    done: false,
  });
  input.value = "";
  renderFormSubtaskChips();
}

function renderFormSubtaskChips() {
  const container = document.getElementById("subtaskChips");
  container.innerHTML = "";
  transientSubtasks.forEach((st, idx) => {
    const chip = document.createElement("div");
    chip.className = "subtask-chip";
    chip.innerHTML = `<span>${escapeHTML(st.text)}</span><remove onclick="removeTransientSubtask(${idx})">&times;</remove>`;
    container.appendChild(chip);
  });
}

function removeTransientSubtask(idx) {
  transientSubtasks.splice(idx, 1);
  renderFormSubtaskChips();
}

function saveComplexTask(e) {
  e.preventDefault();
  const title = document.getElementById("titleInput").value.trim();
  const desc = document.getElementById("descInput").value.trim();
  const priority = document.getElementById("priorityInput").value;

  const newTask = {
    id: "task_" + Date.now(),
    title,
    desc,
    priority,
    status: "todo",
    subtasks: [...transientSubtasks],
    secondsTracked: 0,
  };

  appState.workspaces[appState.currentWorkspace].tasks.push(newTask);
  syncState();
  closeModal();
}

// BOARD RENDER AND VALUE METRICS CALCULATOR PIPELINES
function renderBoardMatrix() {
  const lists = {
    todo: document.getElementById("l-todo"),
    inprogress: document.getElementById("l-inprogress"),
    review: document.getElementById("l-review"),
    done: document.getElementById("l-done"),
  };
  Object.values(lists).forEach((l) => (l.innerHTML = ""));
  const counts = { todo: 0, inprogress: 0, review: 0, done: 0 };
  let globalTotalSeconds = 0;

  const currentTasks = appState.workspaces[appState.currentWorkspace].tasks;

  currentTasks.forEach((task) => {
    counts[task.status]++;
    globalTotalSeconds += task.secondsTracked;

    const card = document.createElement("div");
    card.className = "card";
    card.id = task.id;

    // Build subtask checklist nodes segment
    let subtasksHTML = "";
    if (task.subtasks && task.subtasks.length > 0) {
      subtasksHTML = `<div class="subtasks-wrapper">`;
      task.subtasks.forEach((st) => {
        subtasksHTML += `
                            <div class="subtask-item ${st.done ? "done" : ""}">
                                <input type="checkbox" ${st.done ? "checked" : ""} onclick="toggleSubtaskComplete('${task.id}', '${st.id}')">
                                <span>${escapeHTML(st.text)}</span>
                            </div>`;
      });
      subtasksHTML += `</div>`;
    }

    // Setup state migration link matrices options
    const routes = [
      { k: "todo", l: "未着手 To Do" },
      { k: "inprogress", l: "進行中 Progress" },
      { k: "review", l: "確認中 Review" },
      { k: "done", l: "完了 Done" },
    ];
    let routesHTML = "";
    routes.forEach((r) => {
      if (r.k !== task.status) {
        routesHTML += `<button class="move-option" onclick="migrateTaskStatus('${task.id}','${r.k}')">➔ ${r.l}</button>`;
      }
    });

    const isTimerRunning = !!timerIntervals[task.id];

    card.innerHTML = `
                    <div class="card-header">
                        <div class="card-title">${escapeHTML(task.title)}</div>
                        <button class="delete-task" onclick="purgeTask('${task.id}')">&times;</button>
                    </div>
                    ${task.desc ? `<div class="card-desc">${escapeHTML(task.desc)}</div>` : ""}
                    ${subtasksHTML}
                    <div class="timer-module">
                        <span class="timer-display" id="t-disp-${task.id}">${formatTimeMetric(task.secondsTracked)}</span>
                        <button class="timer-btn ${isTimerRunning ? "running" : ""}" onclick="toggleCardTimer('${task.id}')">
                            ${isTimerRunning ? "⏸ Stop Focus" : "▶ Focus"}
                        </button>
                    </div>
                    <div class="card-footer">
                        <span class="hanko-badge badge-${task.priority}">${task.priority}</span>
                        <div class="move-menu-container">
                            <button class="move-trigger" onclick="openDropdownOverlay(event, '${task.id}')">Move ▾</button>
                            <div class="move-dropdown" id="drop-${task.id}">${routesHTML}</div>
                        </div>
                    </div>
                `;
    lists[task.status].appendChild(card);
  });

  // Refresh Dynamic Performance Metric Displays
  document.getElementById("b-todo").textContent = counts.todo;
  document.getElementById("b-inprogress").textContent = counts.inprogress;
  document.getElementById("b-review").textContent = counts.review;
  document.getElementById("b-done").textContent = counts.done;

  const totalActive = currentTasks.length;
  document.getElementById("m-total").textContent = totalActive;
  document.getElementById("m-done").textContent = counts.done;
  document.getElementById("m-progress").textContent =
    totalActive > 0
      ? Math.round((counts.done / totalActive) * 100) + "%"
      : "0%";
  document.getElementById("m-time").textContent =
    formatTimeMetric(globalTotalSeconds);
}

// MUTATION PIPELINE INTERACTIVE CONTROLS
function migrateTaskStatus(taskId, newStatus) {
  const tasksList = appState.workspaces[appState.currentWorkspace].tasks;
  const idx = tasksList.findIndex((t) => t.id === taskId);
  if (idx !== -1) {
    tasksList[idx].status = newStatus;
    if (newStatus === "done") stopCardTimer(taskId); // Stop timers automatically if completed
    syncState();
  }
}

function toggleSubtaskComplete(taskId, subtaskId) {
  const tasksList = appState.workspaces[appState.currentWorkspace].tasks;
  const tIdx = tasksList.findIndex((t) => t.id === taskId);
  if (tIdx !== -1) {
    const stIdx = tasksList[tIdx].subtasks.findIndex(
      (st) => st.id === subtaskId,
    );
    if (stIdx !== -1) {
      tasksList[tIdx].subtasks[stIdx].done =
        !tasksList[tIdx].subtasks[stIdx].done;
      syncState();
    }
  }
}

function purgeTask(taskId) {
  stopCardTimer(taskId);
  let tasksList = appState.workspaces[appState.currentWorkspace].tasks;
  appState.workspaces[appState.currentWorkspace].tasks = tasksList.filter(
    (t) => t.id !== taskId,
  );
  syncState();
}

// REAL-TIME POMODORO ACCUMULATOR CONTROL ENGINE
function toggleCardTimer(taskId) {
  if (timerIntervals[taskId]) {
    stopCardTimer(taskId);
  } else {
    const tasksList = appState.workspaces[appState.currentWorkspace].tasks;
    const task = tasksList.find((t) => t.id === taskId);
    if (!task || task.status === "done") return;

    // Add real-time clock tickers
    timerIntervals[taskId] = setInterval(() => {
      task.secondsTracked++;
      // Instantly patch DOM display to avoid triggering heavy context re-renders every second
      const display = document.getElementById(`t-disp-${taskId}`);
      if (display) display.textContent = formatTimeMetric(task.secondsTracked);
    }, 1000);

    renderBoardMatrix(); // Refresh button visuals
  }
}

function stopCardTimer(taskId) {
  if (timerIntervals[taskId]) {
    clearInterval(timerIntervals[taskId]);
    delete timerIntervals[taskId];
    // Save current accumulated seconds into storage state block cleanly
    localStorage.setItem("zen_pro_state", JSON.stringify(appState));
    renderBoardMatrix();
  }
}

function openDropdownOverlay(e, id) {
  e.stopPropagation();
  document.querySelectorAll(".move-dropdown").forEach((d) => {
    if (d.id !== "drop-" + id) d.classList.remove("active");
  });
  document.getElementById("drop-" + id).classList.toggle("active");
}

window.addEventListener("click", () => {
  document
    .querySelectorAll(".move-dropdown")
    .forEach((d) => d.classList.remove("active"));
});

function formatTimeMetric(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hrs > 0 ? String(hrs).padStart(2, "0") + ":" : ""}${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function escapeHTML(str) {
  return str.replace(
    /[&<>'"]/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[m] || m,
  );
}

document.addEventListener("DOMContentLoaded", () => {
  renderWorkspaceControls();
  renderBoardMatrix();
});
