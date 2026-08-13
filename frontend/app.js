'use strict';

/* ════════════════════════════════════════════════════════
   Constants & Configuration
════════════════════════════════════════════════════════ */

const STATES = [
  { key: 'code_ready', label: 'Code & Examples Ready',      icon: '📝' },
  { key: 'recorded',   label: 'Recorded',                   icon: '🎬' },
  { key: 'editing',    label: 'Editing in Progress',        icon: '✂️' },
  { key: 'uploaded',   label: 'Uploaded (Pending Verify)',  icon: '☁️' },
  { key: 'published',  label: 'Verified & Published',       icon: '✅' },
];

const STATE_KEYS = STATES.map(s => s.key);

// Which stages each role is permitted to advance a card from
const ROLE_CONFIG = {
  Admin:    { color: '#f85149', label: 'Admin',        canAdvance: ['code_ready', 'recorded', 'editing', 'uploaded'] },
  Content:  { color: '#58a6ff', label: 'Content Team', canAdvance: ['code_ready'] },
  Editor:   { color: '#bc8cff', label: 'Video Editor', canAdvance: ['recorded', 'editing'] },
  Uploader: { color: '#3fb950', label: 'Uploader',     canAdvance: ['uploaded'] },
};

/* ════════════════════════════════════════════════════════
   Mock Data Store
════════════════════════════════════════════════════════ */

let tasks = [
  {
    id: 1,
    title: 'Introduction to Spring Boot',
    assignedRole: 'Content',
    state: 'code_ready',
    description: 'Cover project setup, auto-configuration, and starter dependencies.',
    createdAt: '2026-05-01',
  },
  {
    id: 2,
    title: 'REST API with Spring MVC',
    assignedRole: 'Editor',
    state: 'recorded',
    description: 'Build a full CRUD REST API using @RestController and ResponseEntity.',
    createdAt: '2026-05-03',
  },
  {
    id: 3,
    title: 'Spring Security — JWT Auth',
    assignedRole: 'Editor',
    state: 'editing',
    description: 'Implement JWT-based authentication and role-based authorization.',
    createdAt: '2026-05-05',
  },
  {
    id: 4,
    title: 'Hibernate & JPA Deep Dive',
    assignedRole: 'Uploader',
    state: 'uploaded',
    description: 'Entity mapping, relationships, JPQL queries, and transaction management.',
    createdAt: '2026-05-08',
  },
  {
    id: 5,
    title: 'Microservices with Spring Cloud',
    assignedRole: 'Admin',
    state: 'published',
    description: 'Service discovery, API gateway, config server, and circuit breaker patterns.',
    createdAt: '2026-05-10',
  },
];

let currentRole = 'Admin';
let nextId = 6;
let draggedTaskId = null;

/* ════════════════════════════════════════════════════════
   Mock API  —  drop-in replaceable with real fetch() calls
   Philosophy: "Done vs. Verified" — every call is awaited
   and every failure is caught and surfaced, never silently swallowed.
════════════════════════════════════════════════════════ */

/**
 * Simulates a fetch() call to the Spring Boot backend.
 * Currently rejects all requests — backend not yet connected.
 * Replace this function body with real fetch() once the API is running.
 */
function mockFetch(url, options = {}) {
  return fetch(`http://localhost:8000${url}`, options).then(async (response) => {
    let data = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    }
    return { ok: response.ok, status: response.status, data };
  });
}

/** High-level API wrapper.  Each method is "verified" — errors are never silent. */
const api = {
  async getTasks() {
    try {
      const res = await mockFetch('/api/tasks');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      return res.data;
    } catch (err) {
      showToast(`Failed to load tasks: ${err.message}`, 'error');
      return structuredClone(tasks); // graceful degradation
    }
  },

  async createTask(payload) {
    const res = await mockFetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    return res.data;
  },

  async updateTask(id, updates) {
    const res = await mockFetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    return res.data;
  },

  async deleteTask(id) {
    const res = await mockFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    return true;
  },
};

/* ════════════════════════════════════════════════════════
   Utility Helpers
════════════════════════════════════════════════════════ */

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Double rAF ensures the transition fires after the element is painted
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast-show')));

  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3200);
}

function escapeHtml(str) {
  const el = document.createElement('div');
  el.textContent = str ?? '';
  return el.innerHTML;
}

function getNextStateKey(stateKey) {
  const idx = STATE_KEYS.indexOf(stateKey);
  return idx >= 0 && idx < STATE_KEYS.length - 1 ? STATE_KEYS[idx + 1] : null;
}

function canCurrentRoleAdvance(task) {
  return ROLE_CONFIG[currentRole]?.canAdvance.includes(task.state) ?? false;
}

/* ════════════════════════════════════════════════════════
   Rendering
════════════════════════════════════════════════════════ */

async function renderBoard() {
  tasks = await api.getTasks();

  const board = document.getElementById('board');
  board.innerHTML = '';

  STATES.forEach(state => {
    const columnTasks = tasks.filter(t => t.state === state.key);
    board.appendChild(buildColumn(state, columnTasks));
  });

  renderStats();
}

function buildColumn(state, columnTasks) {
  const col = document.createElement('div');
  col.className = 'column';
  col.setAttribute('role', 'listitem');
  col.dataset.state = state.key;

  const header = document.createElement('div');
  header.className = 'column-header';
  header.innerHTML = `
    <h3 class="column-title">${escapeHtml(state.label)}</h3>
    <span class="column-count">${columnTasks.length}</span>
  `;

  const body = document.createElement('div');
  body.className = 'column-body';
  body.id = `col-${state.key}`;

  if (columnTasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'column-empty';
    empty.innerHTML = `<span class="column-empty-icon">${state.icon}</span><span>No tasks here</span>`;
    body.appendChild(empty);
  } else {
    columnTasks.forEach(task => body.appendChild(buildCard(task)));
  }

  // Drag-and-drop: column as drop target
  body.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    body.classList.add('drag-over');
  });

  body.addEventListener('dragleave', e => {
    if (!body.contains(e.relatedTarget)) body.classList.remove('drag-over');
  });

  body.addEventListener('drop', async e => {
    e.preventDefault();
    body.classList.remove('drag-over');

    if (draggedTaskId === null) return;
    const task = tasks.find(t => t.id === draggedTaskId);
    if (!task || task.state === state.key) return;

    if (currentRole !== 'Admin') {
      showToast('Only Admin can drag cards freely. Use "Move Forward →" instead.', 'error');
      return;
    }

    try {
      await api.updateTask(task.id, { state: state.key });
      const label = state.label;
      showToast(`"${task.title}" moved to ${label}`, 'success');
      renderBoard();
    } catch (err) {
      showToast(`Could not move task: ${err.message}`, 'error');
    } finally {
      draggedTaskId = null;
    }
  });

  col.appendChild(header);
  col.appendChild(body);
  return col;
}

function buildCard(task) {
  const nextKey    = getNextStateKey(task.state);
  const canAdvance = canCurrentRoleAdvance(task);

  const card = document.createElement('article');
  card.className = 'card';
  card.draggable = true;
  card.dataset.id = task.id;
  card.setAttribute('role', 'article');

  const advanceBtn = nextKey && canAdvance
    ? `<button class="btn-advance-full" data-action="advance" aria-label="Move to next stage">Move Forward</button>`
    : '';

  card.innerHTML = `
    <div class="card-top">
      <h4 class="card-title">${escapeHtml(task.title)}</h4>
      <div class="card-icons">
        <button class="btn-icon btn-edit-icon" data-action="view" title="Edit task" aria-label="Edit task">&#x270E;</button>
        <button class="btn-icon btn-delete-icon" data-action="delete" title="Delete task" aria-label="Delete task">&#x2715;</button>
      </div>
    </div>
    <p class="card-description">${escapeHtml(task.description)}</p>
    <div class="card-date">${escapeHtml(task.createdAt)}</div>
    ${advanceBtn}
  `;

  // Drag events
  card.addEventListener('dragstart', e => {
    draggedTaskId = task.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(task.id));
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    draggedTaskId = null;
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  // Delegated button handler
  card.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'view')    openModal(task.id);
    if (action === 'advance') advanceTask(task.id);
    if (action === 'delete')  deleteTask(task.id);
  });

  return card;
}

function renderStats() {
  const el = document.getElementById('stats');
  if (!el) return;

  const total     = tasks.length;
  const published = tasks.filter(t => t.state === 'published').length;
  const active    = tasks.filter(t => !['code_ready', 'published'].includes(t.state)).length;
  const backlog   = total - published - active;

  el.innerHTML = `
    <span class="stat"><span class="stat-num">${total}</span> Total</span>
    <span class="stat"><span class="stat-num">${published}</span> Published</span>
    <span class="stat"><span class="stat-num">${active}</span> Active</span>
    <span class="stat"><span class="stat-num">${backlog}</span> Backlog</span>
  `;
}

/* ════════════════════════════════════════════════════════
   Task Actions
════════════════════════════════════════════════════════ */

async function advanceTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  if (!canCurrentRoleAdvance(task)) {
    showToast(`Your role (${ROLE_CONFIG[currentRole]?.label}) cannot advance this task.`, 'error');
    return;
  }

  const nextKey = getNextStateKey(task.state);
  if (!nextKey) {
    showToast('This task is already in the final stage.', 'info');
    return;
  }

  try {
    await api.updateTask(taskId, { state: nextKey });
    const nextLabel = STATES.find(s => s.key === nextKey).label;
    showToast(`"${task.title}" → ${nextLabel}`, 'success');
    renderBoard();
  } catch (err) {
    showToast(`Could not advance task: ${err.message}`, 'error');
  }
}

async function deleteTask(taskId) {
  if (currentRole !== 'Admin') {
    showToast('Only Admin can delete tasks.', 'error');
    return;
  }

  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  if (!window.confirm(`Delete "${task.title}"?\n\nThis action cannot be undone.`)) return;

  try {
    await api.deleteTask(taskId);
    showToast('Task deleted.', 'info');
    renderBoard();
  } catch (err) {
    showToast(`Could not delete task: ${err.message}`, 'error');
  }
}

/* ════════════════════════════════════════════════════════
   Modal — Add / Edit
════════════════════════════════════════════════════════ */

function openModal(taskId = null) {
  const modal     = document.getElementById('modal');
  const titleEl   = document.getElementById('modal-title');
  const form      = document.getElementById('task-form');
  const stateSelect = form.elements['task-state'];

  form.reset();
  delete form.dataset.editId;

  if (taskId !== null) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    titleEl.textContent                       = 'Edit Video Task';
    form.elements['task-title'].value         = task.title;
    form.elements['task-description'].value   = task.description;
    form.elements['task-role'].value          = task.assignedRole;
    stateSelect.value                         = task.state;
    stateSelect.disabled                      = currentRole !== 'Admin';
    form.dataset.editId                       = taskId;
  } else {
    titleEl.textContent      = 'Add New Video Task';
    stateSelect.value        = 'code_ready';
    stateSelect.disabled     = currentRole !== 'Admin';
  }

  modal.classList.add('modal-open');
  // Shift focus into the first input for accessibility
  setTimeout(() => form.elements['task-title'].focus(), 50);
}

function closeModal() {
  document.getElementById('modal').classList.remove('modal-open');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;

  const title = form.elements['task-title'].value.trim();
  if (!title) {
    showToast('A video title is required.', 'error');
    form.elements['task-title'].focus();
    return;
  }

  const payload = {
    title,
    description:  form.elements['task-description'].value.trim(),
    assignedRole: form.elements['task-role'].value,
    state:        form.elements['task-state'].value,
  };

  const editId = form.dataset.editId ? parseInt(form.dataset.editId, 10) : null;

  try {
    if (editId !== null) {
      await api.updateTask(editId, payload);
      showToast('Task updated.', 'success');
    } else {
      await api.createTask(payload);
      showToast('New video task created!', 'success');
    }
    closeModal();
    renderBoard();
  } catch (err) {
    showToast(`Save failed: ${err.message}`, 'error');
  }
}

/* ════════════════════════════════════════════════════════
   Keyboard shortcuts
════════════════════════════════════════════════════════ */

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    openModal();
  }
});

/* ════════════════════════════════════════════════════════
   Initialisation
════════════════════════════════════════════════════════ */

function init() {
  // Role switcher
  const roleSelect = document.getElementById('roleSelect');
  roleSelect.addEventListener('change', e => {
    currentRole = e.target.value;
    const config = ROLE_CONFIG[currentRole];
    const indicator = document.getElementById('role-indicator');
    indicator.textContent  = config.label;
    indicator.style.color  = config.color;
    renderBoard();
    showToast(`Switched to ${config.label}`, 'info');
  });

  // FAB — add task
  document.getElementById('fab').addEventListener('click', () => openModal());

  // Modal close controls
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
  });

  // Form submission
  document.getElementById('task-form').addEventListener('submit', handleFormSubmit);

  // Kick off first render
  renderBoard();
  showToast('Telusko Workflow Engine ready.', 'info');
}
document.addEventListener('DOMContentLoaded', init);
