//Alert

function showToast(type, title, message, duration = 3500) {
  const icons = { warning:{cls:'warn',icon:'⚠'}, error:{cls:'err',icon:'✕'}, success:{cls:'ok',icon:'✓'}, info:{cls:'inf',icon:'ℹ'} };
  const { cls, icon } = icons[type] || icons.info;
  const tc = document.getElementById('toast-container')
    || (() => { const d = document.createElement('div'); d.id='toast-container'; document.body.appendChild(d); return d; })();
  const t = document.createElement('div');
  t.className = ('socum-toast ' + (type === 'warning' ? '' : type)).trim();
  t.innerHTML = `<span class="toast-icon ${cls}" aria-hidden="true">${icon}</span><div class="toast-body"><div class="toast-title">${title}</div><div class="toast-msg">${message}</div></div><button class="toast-close" aria-label="Close">✕</button><div class="toast-progress"></div>`;
  tc.appendChild(t);
  const close = () => { t.classList.add('hiding'); t.addEventListener('animationend',()=>t.remove(),{once:true}); };
  t.querySelector('.toast-close').onclick = close;
  setTimeout(close, duration);
}


// ثوابت وhelpers أساسية — لازم تكون فوق كل حاجة
//
// Backend base URL for REST + WebSocket/SockJS: API_BASE becomes `${origin}/api`.
//
// Deploy (Render / Railway): set your public HTTPS API origin once:
//   1) Below: API_ORIGIN_OVERRIDE = "https://your-service.onrender.com" (no trailing slash, no /api).
//   2) Or inject before this script loads: window.__RAFIQ_API_ORIGIN__ = "https://your-service.up.railway.app"
// Local dev: leave both empty/falsy → defaults to http://localhost:8080
const API_ORIGIN_OVERRIDE =
  ""; // e.g. "https://YOUR-API-HOST.onrender.com" — see DEPLOYMENT.md

const API_ORIGIN = (() => {
  const w =
    typeof window !== "undefined" &&
    typeof window.__RAFIQ_API_ORIGIN__ === "string" &&
    window.__RAFIQ_API_ORIGIN__.trim() !== ""
      ? window.__RAFIQ_API_ORIGIN__.trim().replace(/\/$/, "")
      : "";
  const o =
    typeof API_ORIGIN_OVERRIDE === "string" && API_ORIGIN_OVERRIDE.trim() !== ""
      ? API_ORIGIN_OVERRIDE.trim().replace(/\/$/, "")
      : "";
  // If we are served from the same backend, window.location.origin is our API origin.
  return w || o || (typeof window !== "undefined" ? window.location.origin : "http://localhost:8080");
})();

const API_BASE = `${API_ORIGIN}/api`;
function getAuthUser() {
  return JSON.parse(sessionStorage.getItem("authUser"));
}

function getBackendOrigin() {
  return API_BASE.replace(/\/api\/?$/, "");
}

/** Matches server PasswordPolicy.validateOrNull (signup + password change + reset). */
function getPasswordPolicyError(password) {
  const p = password == null ? "" : String(password);
  if (!p.trim()) return "Password is required.";
  if (p.indexOf("\0") >= 0) return "Password contains invalid characters.";
  if (p.length > 128) return "Password is too long.";
  if (p.length < 9) {
    return "Use at least 9 characters (more than 8), with upper & lower case letters, a number, and a symbol.";
  }
  if (!/\p{Lu}/u.test(p)) return "Include at least one uppercase letter.";
  if (!/\p{Ll}/u.test(p)) return "Include at least one lowercase letter.";
  if (!/\p{N}/u.test(p)) return "Include at least one number.";
  if (!/^.*[^\p{L}\p{N}\s].*$/u.test(p)) {
    return "Include at least one symbol (e.g. ! @ # %).";
  }
  return null;
}
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const requestUrl = typeof input === "string" ? input : input?.url || "";
  const isBackendRequest =
    requestUrl.startsWith(API_BASE) ||
    requestUrl.startsWith(getBackendOrigin());

  if (!isBackendRequest) {
    return originalFetch(input, init);
  }

  const headers = new Headers(
    init?.headers ||
      (input instanceof Request ? input.headers : undefined) ||
      {},
  );
  headers.set("ngrok-skip-browser-warning", "true");

  return originalFetch(input, {
    ...init,
    headers,
  });
};

// SockJS/STOMP use XMLHttpRequest, not fetch — ngrok's HTML warning page breaks those XHRs unless this header is set.
(function installNgrokSkipWarningOnXhr() {
  if (typeof XMLHttpRequest === "undefined") return;
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__rafiqXhrUrl = typeof url === "string" ? url : "";
    return origOpen.apply(this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    const url = this.__rafiqXhrUrl || "";
    const backend = getBackendOrigin();
    const hitsNgrok =
      url.includes("ngrok-free.dev") ||
      url.includes("ngrok.io") ||
      url.includes("ngrok.app");
    const hitsBackend =
      backend && (url.startsWith(backend) || url.startsWith(`${backend}/`));
    if (hitsNgrok || hitsBackend) {
      try {
        this.setRequestHeader("ngrok-skip-browser-warning", "true");
      } catch (_) {
        /* wrong readyState or header locked */
      }
    }
    return origSend.apply(this, args);
  };
})();

// <img>/<audio>/<video> plain src= requests do NOT use patched fetch/XHR, so ngrok can return
// its HTML warning page instead of bytes — media works on the host only. Load via fetch then blob: URLs.
let chatMediaBlobUrls = [];
let feedMediaBlobUrls = [];
let navAvatarBlobUrl = null;
const profilePageBlobUrls = [];

function revokeChatBackendBlobUrls() {
  chatMediaBlobUrls.forEach(evictBlobUrlFromCacheAndRevoke);
  chatMediaBlobUrls.length = 0;
}

function revokeFeedBackendBlobUrls() {
  feedMediaBlobUrls.forEach(evictBlobUrlFromCacheAndRevoke);
  feedMediaBlobUrls.length = 0;
}

function revokeProfilePageBlobUrls() {
  profilePageBlobUrls.forEach(evictBlobUrlFromCacheAndRevoke);
  profilePageBlobUrls.length = 0;
}

function revokeNavAvatarBlobUrl() {
  if (navAvatarBlobUrl) {
    evictBlobUrlFromCacheAndRevoke(navAvatarBlobUrl);
    navAvatarBlobUrl = null;
  }
}

function toAbsoluteBackendMediaUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("/")) return `${getBackendOrigin()}${url}`;
  return url;
}

function shouldHydrateBackendMediaUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (url.startsWith("blob:") || url.startsWith("data:")) return false;
  const abs = url.startsWith("/") ? getBackendOrigin() + url : url;
  const origin = getBackendOrigin();
  return (
    abs.startsWith(origin) ||
    abs.startsWith(API_BASE) ||
    abs.includes("ngrok-free.dev") ||
    abs.includes("ngrok.io") ||
    abs.includes("ngrok.app")
  );
}

const backendBlobUrlByKey = new Map();
const MAX_BACKEND_BLOB_CACHE = 96;

function canonicalBlobCacheKey(absoluteUrl) {
  try {
    const u = new URL(absoluteUrl);
    u.searchParams.delete("ts");
    return `${u.origin}${u.pathname}${u.search}`;
  } catch {
    return absoluteUrl;
  }
}

function evictBlobUrlFromCacheAndRevoke(blobUrl) {
  if (!blobUrl || !String(blobUrl).startsWith("blob:")) return;
  for (const [k, v] of backendBlobUrlByKey.entries()) {
    if (v === blobUrl) {
      backendBlobUrlByKey.delete(k);
      URL.revokeObjectURL(blobUrl);
      return;
    }
  }
  URL.revokeObjectURL(blobUrl);
}

async function fetchBackendBlobUrl(absoluteUrl) {
  const key = canonicalBlobCacheKey(absoluteUrl);
  const cached = backendBlobUrlByKey.get(key);
  if (cached) return cached;

  const res = await fetch(absoluteUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);

  while (backendBlobUrlByKey.size >= MAX_BACKEND_BLOB_CACHE) {
    const oldestKey = backendBlobUrlByKey.keys().next().value;
    const oldUrl = backendBlobUrlByKey.get(oldestKey);
    backendBlobUrlByKey.delete(oldestKey);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
  }
  backendBlobUrlByKey.set(key, blobUrl);
  return blobUrl;
}

function escapeUrlAttr(url) {
  return String(url ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function escapeHtmlLite(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function backendMediaSrcAttr(url) {
  if (!url) return `src=""`;
  const abs = toAbsoluteBackendMediaUrl(url);
  if (shouldHydrateBackendMediaUrl(url)) {
    return `data-backend-src="${encodeURIComponent(abs)}" src=""`;
  }
  return `src="${escapeUrlAttr(abs)}"`;
}

async function hydrateBackendMediaIn(root, registerBlob) {
  if (!root) return;
  const reg =
    registerBlob ||
    ((u) => {
      chatMediaBlobUrls.push(u);
    });

  const srcNodes = Array.from(root.querySelectorAll("[data-backend-src]"));
  await Promise.all(
    srcNodes.map(async (el) => {
      const enc = el.getAttribute("data-backend-src");
      if (!enc) return;
      let raw;
      try {
        raw = decodeURIComponent(enc);
      } catch {
        return;
      }
      const absolute = toAbsoluteBackendMediaUrl(raw);
      if (!shouldHydrateBackendMediaUrl(raw)) {
        el.removeAttribute("data-backend-src");
        if ("src" in el) el.src = absolute;
        return;
      }
      try {
        const blobUrl = await fetchBackendBlobUrl(absolute);
        el.removeAttribute("data-backend-src");
        if ("src" in el) {
          el.src = blobUrl;
          reg(blobUrl);
        }
      } catch (e) {
        console.warn("Backend media load failed", absolute, e);
      }
    }),
  );

  const fileAnchors = Array.from(root.querySelectorAll("a[data-backend-file]"));
  await Promise.all(
    fileAnchors.map(async (a) => {
      const enc = a.getAttribute("data-backend-file");
      if (!enc) return;
      let raw;
      try {
        raw = decodeURIComponent(enc);
      } catch {
        return;
      }
      const absolute = toAbsoluteBackendMediaUrl(raw);
      if (!shouldHydrateBackendMediaUrl(raw)) {
        a.setAttribute("href", absolute);
        a.removeAttribute("data-backend-file");
        return;
      }
      try {
        const blobUrl = await fetchBackendBlobUrl(absolute);
        a.setAttribute("href", blobUrl);
        a.removeAttribute("data-backend-file");
        reg(blobUrl);
      } catch (e) {
        console.warn("Backend file link failed", absolute, e);
      }
    }),
  );
}

async function applyBackendBlobToImage(imgEl, url, registerBlob) {
  if (!imgEl || !url) return;
  const abs = toAbsoluteBackendMediaUrl(url);
  if (!shouldHydrateBackendMediaUrl(url)) {
    imgEl.src = abs;
    return;
  }
  try {
    const blobUrl = await fetchBackendBlobUrl(abs);
    registerBlob(blobUrl);
    imgEl.src = blobUrl;
  } catch (e) {
    console.warn("Image blob load failed", e);
    imgEl.src = "images/default.png";
  }
}

async function applyBackendBlobToCover(coverEl, url, registerBlob) {
  if (!coverEl || !url) return;
  const abs = toAbsoluteBackendMediaUrl(url);
  if (!shouldHydrateBackendMediaUrl(url)) {
    coverEl.style.backgroundImage = `url("${escapeUrlAttr(abs)}")`;
    return;
  }
  try {
    const b = await fetchBackendBlobUrl(abs);
    registerBlob(b);
    coverEl.style.backgroundImage = `url("${escapeUrlAttr(b)}")`;
  } catch (e) {
    console.warn("Cover blob load failed", e);
    coverEl.style.backgroundImage = "none";
  }
}

async function refreshProfilePageMedia() {
  revokeProfilePageBlobUrls();
  const profileImage = document.getElementById("profileImage");
  const cover = document.getElementById("cover");
  const user = getAuthUser();
  if (profileImage && user?.id) {
    await applyBackendBlobToImage(
      profileImage,
      getStoredProfileField("image", "images/default.png"),
      (u) => profilePageBlobUrls.push(u),
    );
  } else if (profileImage) {
    profileImage.src = "images/default.png";
  }
  if (cover && user?.id) {
    const c = getStoredProfileField("cover");
    if (c) {
      await applyBackendBlobToCover(cover, c, (u) =>
        profilePageBlobUrls.push(u),
      );
    } else {
      cover.style.backgroundImage = "none";
    }
  }
}

let userChatStateCache = null;
let userChatStatePromise = null;

function getDefaultUserChatState() {
  return {
    chatBackgrounds: {},
    aiHistory: [],
  };
}

async function loadUserChatState(force = false) {
  const user = getAuthUser();
  if (!user?.id) {
    userChatStateCache = getDefaultUserChatState();
    return userChatStateCache;
  }

  if (!force && userChatStateCache) {
    return userChatStateCache;
  }

  if (!force && userChatStatePromise) {
    return userChatStatePromise;
  }

  userChatStatePromise = (async () => {
    try {
      const response = await fetch(
        `${API_BASE}/users/${user.id}/preferences?ts=${Date.now()}`,
        {
          cache: "no-store",
          headers: { userId: String(user.id) },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load user preferences");
      }

      const data = await response.json();
      userChatStateCache = {
        ...getDefaultUserChatState(),
        ...data,
        chatBackgrounds: data.chatBackgrounds || {},
        aiHistory: Array.isArray(data.aiHistory) ? data.aiHistory : [],
      };
    } catch (error) {
      userChatStateCache = getDefaultUserChatState();
    } finally {
      userChatStatePromise = null;
    }

    return userChatStateCache;
  })();

  return userChatStatePromise;
}

async function saveUserChatState(state) {
  const user = getAuthUser();
  if (!user?.id) {
    return getDefaultUserChatState();
  }

  const payload = {
    chatBackgrounds: state?.chatBackgrounds || {},
    aiHistory: Array.isArray(state?.aiHistory) ? state.aiHistory : [],
  };

  const response = await fetch(`${API_BASE}/users/${user.id}/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      userId: String(user.id),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const saved = await response.json();
  userChatStateCache = {
    ...getDefaultUserChatState(),
    ...saved,
    chatBackgrounds: saved.chatBackgrounds || {},
    aiHistory: Array.isArray(saved.aiHistory) ? saved.aiHistory : [],
  };
  return userChatStateCache;
}

async function updateUserChatState(mutator) {
  const current = await loadUserChatState();
  const draft = {
    chatBackgrounds: { ...(current.chatBackgrounds || {}) },
    aiHistory: Array.isArray(current.aiHistory)
      ? current.aiHistory.map((item) => ({ ...item }))
      : [],
  };

  await mutator(draft);
  return saveUserChatState(draft);
}

function playButtonClickSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const audioContext = new AudioCtx();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(620, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      420,
      audioContext.currentTime + 0.06,
    );
    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.03,
      audioContext.currentTime + 0.01,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.08,
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.09);
    setTimeout(() => audioContext.close().catch(() => {}), 150);
  } catch (error) {
    // Ignore audio failures so UI actions still work.
  }
}

function shouldPlayGenericClickSound(target) {
  if (!target) return false;
  const clickable = target.closest(
    "button, a, input[type='button'], input[type='submit']",
  );
  if (!clickable) return false;
  if (clickable.id === "closeAlertBtn") return false;
  if (clickable.closest(".notif-actions")) return false;
  return true;
}

document.addEventListener("click", function (event) {
  if (!shouldPlayGenericClickSound(event.target)) return;
  playButtonClickSound();
});

// بداية الداتا
// تحميل الداتا
let tasks = [];
let notifications = [];
let lastNotifCount = 0;
let notificationRealtimeStarted = false;
let appInitialized = false;
let appRefreshTimer = null;
/** Throttles automatic /posts polling from refreshData (explicit reloads ignore this). */
let lastAutoPostsFetchAt = 0;
const AUTO_POSTS_POLL_MIN_MS = 45000;
let employees = [];
let rooms = [];
let currentRoom = null;
if (currentRoom === undefined) currentRoom = null;

// حفظ الداتا
function saveAll() {
  // Main project data is stored in the backend database.
}
// نهاية الداتا

// ========================================================================
// ========================================================================
// ========================================================================

// بداية الناف بار
const navbar = document.querySelector(".navbar");
if (navbar) {
  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 50);
  });
}

// جزء التاسكات
// --- 2. التشغيل عند تحميل الصفحة ---
document.addEventListener("DOMContentLoaded", () => {
  void initApp();
});

function refreshData() {
  const user = getAuthUser();
  if (!user || !user.id) return;

  if (
    document.getElementById("taskList") ||
    document.getElementById("totalTasks") ||
    document.getElementById("statisticsPage")
  )
    loadTasksFromServer();
  if (document.getElementById("notifBadge")) loadNotifications();

  if (document.getElementById("empList")) loadEmployeesFromServer();
  if (
    document.getElementById("totalEmployees") ||
    document.getElementById("statsEmployeesCount")
  )
    loadEmployeeSummary();
  const shouldPausePostsRefresh =
    typeof window.shouldPausePostsRefresh === "function" &&
    window.shouldPausePostsRefresh();
  if (
    document.getElementById("postList") &&
    typeof window.loadPostsFromServer === "function" &&
    !shouldPausePostsRefresh
  ) {
    const now = Date.now();
    if (
      !lastAutoPostsFetchAt ||
      now - lastAutoPostsFetchAt >= AUTO_POSTS_POLL_MIN_MS
    ) {
      lastAutoPostsFetchAt = now;
      void window.loadPostsFromServer();
    }
  }
  startNotificationRealtime();
}

async function loadTasksFromServer() {
  const user = getAuthUser();
  try {
    const res = await fetch(`${API_BASE}/tasks`, {
      headers: { userId: String(user.id) },
    });
    if (res.ok) {
      const serverTasks = await res.json();
      const overviewTasks =
        isManagerUser(user) && !serverTasks.length
          ? await loadTaskOverviewForManager()
          : [];
      tasks = mergeTaskLists(
        overviewTasks.length ? overviewTasks : serverTasks,
        getCachedManagerTasks(user),
      );
      cacheManagerTasks(user);
      renderTasks();
      updateDashboard();
    } else if (isManagerUser(user)) {
      tasks = mergeTaskLists(
        await loadTaskOverviewForManager(),
        getCachedManagerTasks(user),
      );
      renderTasks();
      updateDashboard();
    }
  } catch (e) {
    if (isManagerUser(user)) {
      tasks = mergeTaskLists(
        await loadTaskOverviewForManager(),
        getCachedManagerTasks(user),
      );
      renderTasks();
      updateDashboard();
    }
    console.error("Error fetching tasks:", e);
  }
}

async function loadTaskOverviewForManager() {
  try {
    const res = await fetch(`${API_BASE}/tasks/overview`);
    return res.ok ? await res.json() : [];
  } catch (error) {
    console.error("Error loading manager task overview:", error);
    return [];
  }
}

function mergeTaskLists(primary = [], secondary = []) {
  const merged = [];
  const seen = new Set();

  [...primary, ...secondary].forEach((task) => {
    if (!task) return;
    const key = task.id
      ? `id:${task.id}`
      : `${task.title || ""}|${task.deadline || ""}|${task.assignedToStaffId || task.assignedTo?.staffId || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(task);
  });

  return merged;
}

function getManagerTaskCacheKey(user = getAuthUser()) {
  return user?.id ? `manager_tasks_${user.id}` : "";
}

function getCachedManagerTasks(user = getAuthUser()) {
  if (!isManagerUser(user)) return [];
  const key = getManagerTaskCacheKey(user);
  if (!key) return [];

  try {
    return JSON.parse(sessionStorage.getItem(key) || "[]");
  } catch (error) {
    return [];
  }
}

function cacheManagerTasks(user = getAuthUser()) {
  if (!isManagerUser(user)) return;
  const key = getManagerTaskCacheKey(user);
  if (!key) return;
  sessionStorage.setItem(key, JSON.stringify(tasks.filter(Boolean)));
}

function upsertTaskLocally(task) {
  if (!task) return;
  const user = getAuthUser();
  const normalizedTask = {
    ...task,
    assignedBy: task.assignedBy || {
      id: user?.id,
      name: user?.name || "Manager",
    },
  };
  const existingIndex = tasks.findIndex(
    (item) =>
      item.id &&
      normalizedTask.id &&
      Number(item.id) === Number(normalizedTask.id),
  );
  if (existingIndex >= 0) {
    tasks[existingIndex] = { ...tasks[existingIndex], ...normalizedTask };
  } else {
    tasks.unshift(normalizedTask);
  }
  cacheManagerTasks(user);
  renderTasks();
  updateDashboard();
}

function renderTasks() {
  const list = document.getElementById("taskList");
  if (!list) return;

  const user = getAuthUser();
  const canManageTasks = [
    "MANAGER",
    "ADMIN",
    "ROLE_MANAGER",
    "ROLE_ADMIN",
    "TEAM_LEADER",
  ].includes(normalizeUserRole(user));
  const taskFilter = getCurrentTaskFilter();
  const assigneeFilter = getCurrentAssigneeFilter();
  const filteredTasks = tasks
    .map((task, index) => ({ task, index }))
    .filter(
      ({ task }) =>
        taskFilter === "all" || normalizeTaskStatus(task) === taskFilter,
    )
    .filter(
      ({ task }) =>
        !assigneeFilter || taskMatchesAssignee(task, assigneeFilter),
    );

  renderTaskFilters();
  renderActiveTaskScope();

  if (!filteredTasks.length) {
    list.innerHTML = `<div class='empty-tasks'>${tasks.length ? "No tasks match this filter." : "You have not been assigned any task yet."}</div>`;
    return;
  }

  list.innerHTML = "";

  filteredTasks.forEach(({ task: t, index: i }) => {
    const status = normalizeTaskStatus(t);
    const li = document.createElement("li");
    li.className = `task-card ${status === "completed" ? "task-done" : ""}`;

    const isAssignedToMe = Number(t.assignedTo?.id) === Number(user?.id);
    let actions = "";

    if (isAssignedToMe) {
      const seenStatus = t.isSeenByStaff
        ? `<span class="badge-seen"><i class="fas fa-check-double"></i> Seen</span>`
        : `<button onclick="markTaskAsSeen('${t.id}')" class="btn-seen" type="button">Mark as read</button>`;

      actions += `
                ${seenStatus}
                <label class="checkbox-container">
                    <input type="checkbox" ${status === "completed" ? "checked" : ""} onchange="markTaskComplete(${i}, this.checked)">
                    <span class="checkmark"></span> Done
                </label>`;
    }

    if (canManageTasks) {
      actions += `<button onclick="deleteTask(${i})" class="btn-delete" type="button" aria-label="Delete task"><i class="fas fa-trash"></i></button>`;
    }

    const actionsHtml = actions
      ? `<div class="task-actions">${actions}</div>`
      : "";

    li.innerHTML = `
            <div class="task-main">
                <div class="task-header">
                    <h4>${escapeHtml(t.title || "Untitled task")}</h4>
                    <span class="status-pill ${status}">${formatTaskStatus(status)}</span>
                </div>
                <p>${escapeHtml(t.description || "There is no description for this task.")}</p>
                <div class="task-footer">
                    <span><i class="fas fa-user-edit"></i> From: ${escapeHtml(t.assignedBy?.name || "Manager")}</span>
                    <span><i class="fas fa-user-check"></i> To: ${escapeHtml(t.assignedTo?.name || "-")}</span>
                    <span><i class="fas fa-calendar-alt"></i> ${formatTaskDate(t.deadline)}</span>
                </div>
            </div>
            ${actionsHtml}
        `;
    list.appendChild(li);
  });
}

async function loadNotifications() {
  const user = getAuthUser();
  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { userId: String(user.id) },
    });
    if (res.ok) {
      notifications = await res.json();
      const unread = notifications.filter((n) => !n.isRead).length;
      if (unread > lastNotifCount) triggerNotifEffect();
      lastNotifCount = unread;
      updateNotifUI();
    }
  } catch (e) {
    console.error("Error fetching notifications:", e);
  }
}

function updateNotifUI() {
  const badge = document.getElementById("notifBadge");
  const list = document.getElementById("notifList");
  if (!badge || !list) return;

  const unread = notifications.filter((n) => !isNotificationRead(n)).length;
  badge.innerText = unread;
  badge.style.display = unread > 0 ? "flex" : "none";
  const bell = document.getElementById("bellIcon");
  if (bell) bell.classList.toggle("has-unread", unread > 0);

  list.innerHTML = notifications.length
    ? ""
    : "<li class='empty-notif'>There are no notifications currently available.</li>";

  notifications.slice(0, 10).forEach((n) => {
    const li = document.createElement("li");
    li.className = `notif-item ${isNotificationRead(n) ? "" : "unread"}`;
    li.innerHTML = `
            <div class="notif-content">
                <strong>${n.title}</strong>
                <p>${n.message || n.content}</p>
                <small>${n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</small>
            </div>
        `;
    li.onclick = () => handleNotifClick(n.id);
    list.appendChild(li);
  });
}

function isNotificationRead(notification) {
  return Boolean(notification?.read || notification?.isRead);
}

function triggerNotifEffect() {
  const bell = document.getElementById("bellIcon");
  if (bell) bell.classList.add("shake-bell");
  playNotificationSound();
  setTimeout(() => bell && bell.classList.remove("shake-bell"), 1000);
}

async function loadEmployeeSummary() {
  const totalEmployees = document.getElementById("totalEmployees");
  if (!totalEmployees) return;
  try {
    const res = await fetch(`${API_BASE}/users/employees/summary`);
    if (res.ok) {
      const summary = await res.json();
      totalEmployees.innerText = summary.developerCount || 0;
    }
  } catch (e) {
    console.error("Error loading summary");
  }
}

async function loadEmployeesFromServer() {
  const box = document.getElementById("empList");
  const user = getAuthUser();
  if (!box || !user?.id) return;

  try {
    const res = await fetch(`${API_BASE}/users/employees`, {
      headers: { userId: String(user.id) },
    });
    if (res.ok) {
      employees = await res.json();
      renderEmployees();
    } else {
      box.innerHTML = "<p>Access Denied.</p>";
    }
  } catch (e) {
    console.error("Error fetching employees");
  }
}

function renderEmployees() {
  const box = document.getElementById("empList");
  if (!box) return;
  const user = getAuthUser();
  const isManager = user?.role?.toUpperCase() === "MANAGER";

  box.innerHTML = "";
  employees.forEach((e, i) => {
    const div = document.createElement("div");
    div.className = "emp-card";
    div.innerHTML = `
            <h3>${e.name}</h3>
            <p>Staff ID: ${e.staffId || "-"}</p>
            <p>Role: ${e.role || "-"}</p>
            ${isManager ? `<button onclick="deleteEmp(${i})" class="remove-btn">Remove</button>` : ""}
            ${isManager && e.role === "DEVELOPER" ? `<button onclick="promoteToTeamLeader(${i})" class="btn-seen">Make Team Leader</button>` : ""}
        `;
    box.appendChild(div);
  });
}

// --- 6. وظائف مساعدة (Helpers) ---

function toggleNotifDropdown() {
  const drop = document.getElementById("notifDropdown");
  if (drop) drop.classList.toggle("show-notif");
}

async function handleNotifClick(notifId) {
  const notification = notifications.find(
    (item) => Number(item.id) === Number(notifId),
  );
  if (isPostNotification(notification)) {
    await markNotifRead(notifId);
    window.location.href = "profile.html?tab=posts";
    return;
  }

  await markNotifRead(notifId);
  window.location.href = "tasks.html";
}

async function markTaskAsSeen(taskId) {
  const user = getAuthUser();
  const res = await fetch(`${API_BASE}/tasks/${taskId}/mark-seen`, {
    method: "POST",
    headers: { userId: String(user.id) },
  });
  if (res.ok) {
    await loadTasksFromServer();
    await loadNotifications();
  }
}

async function markTaskComplete(index, isChecked) {
  const user = getAuthUser();
  const task = tasks[index];
  if (!user?.id || !task?.id) return;

  const previousStatus = task.status;
  const status = isChecked ? "completed" : "pending";

  task.status = status;
  cacheManagerTasks(user);
  renderTasks();
  updateDashboard();

  try {
    const res = await fetch(
      `${API_BASE}/tasks/${task.id}/status?status=${status}`,
      {
        method: "PATCH",
        headers: { userId: String(user.id) },
      },
    );

    if (!res.ok) {
      task.status = previousStatus;
      cacheManagerTasks(user);
      renderTasks();
      updateDashboard();
      showToast('error','Update failed', await res.text());
      return;
    }

    const savedTask = await res.json();
    tasks[index] = { ...task, ...savedTask };
    cacheManagerTasks(user);
    await loadTasksFromServer();
    await loadNotifications();
  } catch (error) {
    task.status = previousStatus;
    cacheManagerTasks(user);
    renderTasks();
    updateDashboard();
    console.error("Error updating task status:", error);
    showToast('error','Update failed','Could not update task status. Please try again.');
  }
}

function updateNotifUI() {
  const badge = document.getElementById("notifBadge");
  const unread = notifications.filter((n) => !isNotificationRead(n)).length;

  if (badge) {
    badge.innerText = unread;
    badge.style.display = unread > 0 ? "flex" : "none";
  }

  const bell = document.getElementById("bellIcon");
  if (bell) bell.classList.toggle("has-unread", unread > 0);

  renderBellNotifications(document.getElementById("notifList"));
  renderTaskNotificationsPanel();
}

function triggerNotifEffect() {
  const bell = document.getElementById("bellIcon");
  if (bell) bell.classList.add("shake-bell");
  playNotificationSound();
  setTimeout(() => bell && bell.classList.remove("shake-bell"), 1000);
}

function playNotificationSound() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const audioContext = new AudioCtx();
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + 0.55,
  );
  gain.connect(audioContext.destination);

  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(audioContext.currentTime + index * 0.12);
    oscillator.stop(audioContext.currentTime + index * 0.12 + 0.22);
  });

  setTimeout(() => audioContext.close().catch(() => {}), 700);
}

function getSortedNotifications() {
  return [...notifications].sort((a, b) => {
    if (isNotificationRead(a) !== isNotificationRead(b))
      return isNotificationRead(a) ? 1 : -1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

function isTaskAssignmentNotification(notification) {
  return (
    notification?.taskId &&
    String(notification?.title || "")
      .toLowerCase()
      .includes("assigned")
  );
}

function isPostNotification(notification) {
  return String(notification?.type || "").toUpperCase() === "POST";
}

function renderNotificationReadButton(notification) {
  if (isPostNotification(notification)) return "";
  if (isNotificationRead(notification))
    return "<span class='notif-read-state'>Read</span>";
  if (isTaskAssignmentNotification(notification)) {
    return `<button type="button" onclick="markTaskNotificationRead(event, ${notification.id}, ${notification.taskId})">Read</button>`;
  }
  return `<button type="button" onclick="markNotificationReadOnly(event, ${notification.id})">Read</button>`;
}

function renderBellNotifications(list) {
  if (!list) return;

  const sorted = getSortedNotifications();
  list.innerHTML = sorted.length
    ? ""
    : "<li class='empty-notif'>No notifications yet.</li>";

  sorted.slice(0, 10).forEach((n) => {
    const li = document.createElement("li");
    li.className = `notif-item ${isNotificationRead(n) ? "" : "unread"}`;
    const actions = renderNotificationReadButton(n);
    li.innerHTML = `
            <div class="notif-content">
                <strong>${n.title || "Notification"}</strong>
                <p>${n.content || n.message || ""}</p>
                <small>${n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</small>
            </div>
            ${actions ? `<div class="notif-actions">${actions}</div>` : ""}
        `;
    li.onclick = () => handleNotifClick(n.id);
    list.appendChild(li);
  });
}

function renderTaskNotificationsPanel() {
  const list = document.getElementById("notificationList");
  if (!list) return;

  const sorted = getSortedNotifications();
  if (!sorted.length) {
    list.innerHTML = "<p class='empty-panel-state'>No notifications yet.</p>";
    return;
  }

  list.innerHTML = sorted
    .map(
      (n) => `
        <div class="notification-item${isNotificationRead(n) ? "" : " unread"}" id="notif-${n.id}">
            <div>
                <strong>${n.title || "Notification"}</strong>
                <p>${n.content || n.message || ""}</p>
                <div class="notif-time">${n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</div>
            </div>
            ${renderNotificationReadButton(n) ? `<div class="notification-row-actions">${renderNotificationReadButton(n)}</div>` : ""}
        </div>
    `,
    )
    .join("");
}

async function markNotificationReadOnly(event, notifId) {
  if (event) event.stopPropagation();
  await markNotifRead(notifId);
}

async function markTaskNotificationRead(event, notifId, taskId) {
  if (event) event.stopPropagation();
  const readOk = await markNotifRead(notifId);
  if (!readOk && taskId) await markTaskAsSeen(taskId);
}

async function markAllNotificationsRead(event) {
  if (event) event.stopPropagation();
  const user = getAuthUser();
  if (!user?.id) return;

  const previous = notifications.map((n) => ({ ...n }));
  const unreadNotifications = notifications.filter(
    (n) => !isNotificationRead(n),
  );
  notifications = notifications.map((n) => ({
    ...n,
    read: true,
    isRead: true,
  }));
  updateNotifUI();

  const results = await Promise.all(
    unreadNotifications.map((n) =>
      fetch(`${API_BASE}/notifications/${n.id}/read`, {
        method: "PATCH",
        headers: { userId: String(user.id) },
      }),
    ),
  );

  if (results.every((response) => response.ok)) {
    await loadNotifications();
  } else {
    notifications = previous;
    updateNotifUI();
    showToast('error','Failed','Could not mark all notifications as read. Please try again.');
  }
}

async function clearAllNotifications(event) {
  if (event) event.stopPropagation();
  const user = getAuthUser();
  if (!user?.id) return;
  if (!confirm("Clear all notifications?")) return;

  const previous = [...notifications];
  notifications = [];
  updateNotifUI();

  const response = await fetch(`${API_BASE}/notifications/clear`, {
    method: "DELETE",
    headers: { userId: String(user.id) },
  });
  if (response.ok) {
    await loadNotifications();
  } else {
    notifications = previous;
    updateNotifUI();
    alert(
      "Clear is not available on the running backend yet. Restart the Spring Boot server, then try again.",
    );
  }
}

async function addTask() {
  const user = getAuthUser();
  if (!user?.id) return;

  const titleInput = document.getElementById("taskTitle");
  const descInput = document.getElementById("taskDesc");
  const assigneeInput = document.getElementById("taskAssigneeStaffId");
  const deadlineInput = document.getElementById("taskDeadline");

  const title = titleInput?.value.trim();
  const assignedToStaffId = assigneeInput?.value.trim();
  const deadline = deadlineInput?.value;

  if (!title || !assignedToStaffId || !deadline) {
    showToast('warning','Missing fields','Title, assigned Staff ID, and deadline are required.');
    return;
  }

  const response = await fetch(`${API_BASE}/tasks/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      userId: String(user.id),
    },
    body: JSON.stringify({
      title,
      description: descInput?.value.trim() || "",
      assignedToStaffId,
      deadline,
      status: "pending",
    }),
  });

  if (!response.ok) {
    showToast('error','Delete failed', await response.text());
    return;
  }

  const savedTask = await response.json();
  upsertTaskLocally(savedTask);

  if (titleInput) titleInput.value = "";
  if (descInput) descInput.value = "";
  if (assigneeInput) assigneeInput.value = "";
  if (deadlineInput) deadlineInput.value = "";
  await loadTasksFromServer();
  await loadNotifications();
  triggerNotifEffect();
}

async function deleteTask(index) {
  const user = getAuthUser();
  const task = tasks[index];
  if (!user?.id || !task?.id) return;
  if (!confirm("Delete this task?")) return;

  const response = await fetch(`${API_BASE}/tasks/${task.id}`, {
    method: "DELETE",
    headers: { userId: String(user.id) },
  });

  if (!response.ok) {
    showToast('error','Task creation failed', await response.text());
    return;
  }

  await loadTasksFromServer();
}

// جزء الموظفين
async function loadEmployeeSummary() {
  const totalEmployees = document.getElementById("totalEmployees");
  const statsEmployees = document.getElementById("statsEmployeesCount");
  if (!totalEmployees && !statsEmployees) return;
  const response = await fetch(`${API_BASE}/users/employees/summary`);
  if (!response.ok) return;
  const summary = await response.json();
  employees = Array.from({ length: summary.developerCount || 0 });
  if (totalEmployees) totalEmployees.innerText = summary.developerCount || 0;
  if (statsEmployees) statsEmployees.innerText = summary.developerCount || 0;
  updateDashboard();
}

async function loadEmployeesFromServer() {
  const user = getAuthUser();
  const box = document.getElementById("empList");
  if (!box || !user?.id) return;

  const response = await fetch(`${API_BASE}/users/employees`, {
    headers: { userId: user.id },
  });

  if (!response.ok) {
    box.innerHTML = "<p>Only Manager can manage employees.</p>";
    return;
  }

  employees = await response.json();
  renderEmployees();
}

async function deleteEmp(i) {
  const user = getAuthUser();
  const employee = employees[i];
  if (!user?.id || !employee?.id) return;
  if (!confirm(`Remove ${employee.name} from the company?`)) return;

  const response = await fetch(`${API_BASE}/users/employees/${employee.id}`, {
    method: "DELETE",
    headers: { userId: user.id },
  });

  if (!response.ok) {
    showToast('error','Delete failed', await response.text());
    return;
  }

  await loadEmployeesFromServer();
  await loadEmployeeSummary();
}

async function promoteToTeamLeader(i) {
  const user = getAuthUser();
  const employee = employees[i];
  if (!user?.id || !employee?.id) return;

  const response = await fetch(
    `${API_BASE}/users/employees/${employee.id}/promote-team-leader`,
    {
      method: "PUT",
      headers: { userId: user.id },
    },
  );

  if (!response.ok) {
    showToast('error','Remove failed', await response.text());
    return;
  }

  const updatedEmployee = await response.json();

  // If the promoted employee is the currently logged-in user,
  // update sessionStorage with the NEW role AND NEW staffId from the server response
  if (employee.id === user.id) {
    const updatedUser = {
      ...user,
      role: updatedEmployee.role || "TEAM_LEADER",
      staffId: updatedEmployee.staffId || user.staffId,
    };
    sessionStorage.setItem("authUser", JSON.stringify(updatedUser));
    applyTaskRoleControls(); // show task input form immediately
    alert(
      "You have been promoted to Team Leader!\nYour new Staff ID has been sent to your email: " +
        updatedEmployee.staffId,
    );
  } else {
    alert(
      employee.name +
        " has been promoted to Team Leader. A new Staff ID has been sent to their email.",
    );
  }

  await loadEmployeesFromServer();
  await loadEmployeeSummary();
}

function renderEmployees() {
  const box = document.getElementById("empList");
  if (!box) return;
  const user = getAuthUser();
  const canManageEmployees = user?.role?.toUpperCase() === "MANAGER";

  box.innerHTML = "";

  employees.forEach((e, i) => {
    const div = document.createElement("div");
    div.className = "emp-card";

    div.innerHTML = `
            <h3>${e.name}</h3>
            <p>Staff ID: ${e.staffId || "-"}</p>
            <p>Email: ${e.email || "-"}</p>
            <p>Role: ${e.role || "-"}</p>
            ${canManageEmployees ? `<button onclick="deleteEmp(${i})">Remove</button>` : ""}
            ${canManageEmployees && e.role === "DEVELOPER" ? `<button onclick="promoteToTeamLeader(${i})">Make Team Leader</button>` : ""}
        `;

    box.appendChild(div);
  });
}

// نهاية الناف بار

// ========================================================================
// ========================================================================
// ========================================================================

// بداية الداشبورد

// تحديث الداتا اللي ظاهرة في الداشبورد
function updateDashboard() {
  const user = getAuthUser();
  const manager = isManagerUser(user);
  const createdByMe = getTasksCreatedBy(user);
  const managerTasks = getManagerTaskScope(user, createdByMe);
  const performanceTasks = manager ? managerTasks : tasks;
  const metrics = getTaskMetrics(tasks);
  const performanceMetrics = getTaskMetrics(performanceTasks);
  const {
    total,
    completed,
    inProgress,
    pending,
    completedPercent,
    progressPercent,
    pendingPercent,
  } = metrics;

  setText("totalTasks", total);
  setText("completedTasks", completed);
  setText("pendingTasks", pending);
  setText("completionRate", `${performanceMetrics.completionPercent}%`);
  setText("completedTasksPercent", `${completedPercent}% of total`);
  setText("pendingTasksPercent", `${pendingPercent}% of total`);
  setBarWidth("completionBar", performanceMetrics.completionPercent);
  setText(
    "performanceTitle",
    manager ? "Manager Performance" : "Completion Rate",
  );
  setText(
    "performanceSummary",
    manager
      ? `${performanceMetrics.completed} completed replies from ${performanceMetrics.total} active manager tasks.`
      : `${performanceMetrics.completed} completed tasks from ${performanceMetrics.total} assigned tasks.`,
  );
  renderManagerPerformanceMeta(manager, performanceMetrics);

  setText("statsTotalTasks", total);
  setText("statsCompletedTasks", completed);
  setText("statsProgressTasks", inProgress);
  setText("statsPendingTasks", pending);
  setText("statsCompletionRate", `${performanceMetrics.completionPercent}%`);
  setText(
    "statsSummary",
    total
      ? getStatsSummary(
          manager,
          metrics,
          performanceMetrics,
          getCreatedTaskCountForDisplay(manager, createdByMe),
        )
      : "No task data loaded yet.",
  );
  setBarWidth("statsCompletionBar", performanceMetrics.completionPercent);
  setBarWidth("completedStatusBar", completedPercent);
  setBarWidth("progressStatusBar", progressPercent);
  setBarWidth("pendingStatusBar", pendingPercent);
  setText("completedStatusPercent", `${completedPercent}%`);
  setText("progressStatusPercent", `${progressPercent}%`);
  setText("pendingStatusPercent", `${pendingPercent}%`);
  setText(
    "statsCreatedByMe",
    getCreatedTaskCountForDisplay(manager, createdByMe),
  );
  setText("statsEmployeesCount", getEmployeeCount());
  toggleManagerStats(manager);

  const e = document.getElementById("totalEmployees");
  const employeeStat = document.getElementById("employeesStat");

  if (e && employees.length > 0) e.innerText = employees.length;
  if (employeeStat) {
    employeeStat.style.cursor = manager ? "pointer" : "default";
    employeeStat.title = manager ? "Manage employees" : "";
    employeeStat.onclick = manager
      ? () => (window.location.href = "employees.html")
      : () => (window.location.href = "statistics.html");
  }

  bindDashboardStatLinks();
  renderTaskFilters();
  renderRecentTaskPreview();
  renderAssigneeStats();
  renderTaskChart(manager, managerTasks);
  updateStatisticsPrintTitle(manager);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.innerText = value;
}

function setBarWidth(id, percent) {
  const element = document.getElementById(id);
  if (element) element.style.width = `${Math.max(0, Math.min(percent, 100))}%`;
}

function isManagerUser(user = getAuthUser()) {
  return ["MANAGER", "ADMIN", "ROLE_MANAGER", "ROLE_ADMIN"].includes(
    normalizeUserRole(user),
  );
}

function normalizeUserRole(user = getAuthUser()) {
  return String(user?.role || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function taskCreatedBy(task, user) {
  if (!user?.id) return false;
  const assignedBy = task?.assignedBy || {};
  return (
    Number(assignedBy.id ?? task?.assignedById) === Number(user.id) ||
    String(assignedBy.staffId || task?.assignedByStaffId || "") ===
      String(user.staffId || "")
  );
}

function getTasksCreatedBy(user = getAuthUser()) {
  return tasks.filter((task) => taskCreatedBy(task, user));
}

function getManagerTaskScope(
  user = getAuthUser(),
  createdByMe = getTasksCreatedBy(user),
) {
  if (!isManagerUser(user)) return tasks;
  return tasks;
}

function getCreatedTaskCountForDisplay(manager, createdByMe) {
  return createdByMe.length;
}

function getEmployeeCount() {
  const totalEmployeesElement = document.getElementById("totalEmployees");
  const fromElement = Number(totalEmployeesElement?.innerText || 0);
  return employees.length || fromElement || 0;
}

function getStatsSummary(
  manager,
  allMetrics,
  performanceMetrics,
  createdCount,
) {
  if (manager) {
    return `${allMetrics.completed} completed from ${allMetrics.total} company tasks. ${allMetrics.pending} tasks are still pending, and ${createdCount} were created by you.`;
  }

  return `${performanceMetrics.completed} completed from ${performanceMetrics.total} assigned tasks. The completion bar is ${performanceMetrics.completionPercent}%.`;
}

function renderManagerPerformanceMeta(manager, performanceMetrics) {
  const box = document.getElementById("managerPerformanceMeta");
  if (!box) return;

  if (!manager) {
    box.innerHTML = "";
    box.classList.remove("show");
    return;
  }

  box.classList.add("show");
  box.innerHTML = `
        <span><strong>${performanceMetrics.total}</strong> Managed</span>
        <span><strong>${performanceMetrics.completed}</strong> Finished replies</span>
        <span><strong>${performanceMetrics.pending}</strong> Waiting</span>
    `;
}

function toggleManagerStats(manager) {
  document.querySelectorAll(".manager-stat").forEach((card) => {
    card.style.display = manager ? "block" : "none";
  });
}

function normalizeTaskStatus(taskOrStatus) {
  const raw =
    typeof taskOrStatus === "string" ? taskOrStatus : taskOrStatus?.status;
  const status = String(raw || "pending")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  if (status === "done" || status === "complete") return "completed";
  if (status === "progress" || status === "inprogress") return "in_progress";
  if (
    status === "completed" ||
    status === "in_progress" ||
    status === "pending"
  )
    return status;
  return "pending";
}

function formatTaskStatus(status) {
  const normalized = normalizeTaskStatus(status);
  if (normalized === "in_progress") return "In Progress";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getTaskMetrics(sourceTasks = tasks) {
  const total = sourceTasks.length;
  const completed = sourceTasks.filter(
    (task) => normalizeTaskStatus(task) === "completed",
  ).length;
  const inProgress = sourceTasks.filter(
    (task) => normalizeTaskStatus(task) === "in_progress",
  ).length;
  const pending = Math.max(total - completed - inProgress, 0);
  const percent = (count) => (total ? Math.round((count / total) * 100) : 0);

  return {
    total,
    completed,
    inProgress,
    pending,
    completionPercent: percent(completed),
    completedPercent: percent(completed),
    progressPercent: percent(inProgress),
    pendingPercent: percent(pending),
  };
}

function getWeekBuckets(sourceTasks) {
  const today = new Date();
  const buckets = [];

  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      total: 0,
      completed: 0,
    });
  }

  sourceTasks.forEach((task) => {
    const taskDate = new Date(task.deadline || Date.now());
    if (Number.isNaN(taskDate.getTime())) return;
    const key = taskDate.toISOString().slice(0, 10);
    const bucket = buckets.find((item) => item.key === key);
    if (!bucket) return;
    bucket.total += 1;
    if (normalizeTaskStatus(task) === "completed") bucket.completed += 1;
  });

  return buckets;
}

function renderTaskChart(manager, managerTasks) {
  const chart = document.getElementById("taskChart");
  if (!chart) return;

  const source = tasks;
  const buckets = getWeekBuckets(source);
  const hasWeeklyData = buckets.some((bucket) => bucket.total > 0);
  const maxValue = Math.max(
    ...buckets.map((bucket) => Math.max(bucket.total, bucket.completed)),
    1,
  );
  setText(
    "chartTitle",
    manager ? "Company Weekly Task Pace" : "Your Weekly Task Pace",
  );

  if (source.length && !hasWeeklyData) {
    renderStatusChart(chart, source, manager);
    return;
  }

  chart.innerHTML = buckets
    .map((bucket) => {
      const totalHeight = Math.max(
        (bucket.total / maxValue) * 100,
        bucket.total ? 12 : 4,
      );
      const completedHeight = Math.max(
        (bucket.completed / maxValue) * 100,
        bucket.completed ? 12 : 4,
      );
      return `
            <div class="chart-day">
                <div class="chart-bars">
                    <span class="chart-bar total" style="height: ${totalHeight}%"></span>
                    <span class="chart-bar completed" style="height: ${completedHeight}%"></span>
                </div>
                <strong>${bucket.label}</strong>
                <small>${bucket.completed}/${bucket.total}</small>
            </div>
        `;
    })
    .join("");
}

function renderStatusChart(chart, source, manager) {
  const metrics = getTaskMetrics(source);
  const rows = [
    {
      label: "Completed",
      value: metrics.completed,
      percent: metrics.completedPercent,
      status: "completed",
    },
    {
      label: "In Progress",
      value: metrics.inProgress,
      percent: metrics.progressPercent,
      status: "in_progress",
    },
    {
      label: "Pending",
      value: metrics.pending,
      percent: metrics.pendingPercent,
      status: "pending",
    },
  ];

  setText("chartTitle", manager ? "Manager Task Status" : "Your Task Status");
  chart.innerHTML = rows
    .map(
      (row) => `
        <button type="button" class="chart-status-row" onclick="goToTasksByStatus('${row.status}')">
            <span>${row.label}</span>
            <div class="progress-track"><span style="width: ${row.percent}%"></span></div>
            <strong>${row.value}</strong>
        </button>
    `,
    )
    .join("");
}

function getCurrentTaskFilter() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("status");
  if (!raw || raw === "all") return "all";
  return normalizeTaskStatus(raw);
}

function getCurrentAssigneeFilter() {
  return new URLSearchParams(window.location.search).get("assignee");
}

function taskMatchesAssignee(task, assigneeFilter) {
  const assignee = task.assignedTo || {};
  const rawValues = [
    assignee.id,
    assignee.staffId,
    assignee.name,
    assignee.email,
  ].filter(Boolean);
  const values = (rawValues.length ? rawValues : ["unassigned"])
    .filter(Boolean)
    .map((value) => String(value));
  return values.includes(String(assigneeFilter));
}

function setTaskFilter(status) {
  const normalized = status === "all" ? "all" : normalizeTaskStatus(status);
  const url = new URL(window.location.href);
  if (normalized === "all") {
    url.searchParams.delete("status");
  } else {
    url.searchParams.set("status", normalized);
  }
  window.history.replaceState({}, "", url);
  renderTasks();
}

function renderActiveTaskScope() {
  const scope = document.getElementById("activeTaskScope");
  if (!scope) return;

  const assigneeFilter = getCurrentAssigneeFilter();
  if (!assigneeFilter) {
    scope.innerHTML = "";
    scope.classList.remove("show");
    return;
  }

  const task = tasks.find((item) => taskMatchesAssignee(item, assigneeFilter));
  const name = task?.assignedTo?.name || "Unassigned";
  scope.classList.add("show");
  scope.innerHTML = `
        <span>Showing tasks for <strong>${escapeHtml(name)}</strong></span>
        <button type="button" onclick="clearAssigneeFilter()">Show everyone</button>
    `;
}

function clearAssigneeFilter() {
  const url = new URL(window.location.href);
  url.searchParams.delete("assignee");
  window.history.replaceState({}, "", url);
  renderTasks();
}

function renderTaskFilters() {
  if (!document.querySelector("[data-task-filter-button]")) return;

  const assigneeFilter = getCurrentAssigneeFilter();
  const scopedTasks = assigneeFilter
    ? tasks.filter((task) => taskMatchesAssignee(task, assigneeFilter))
    : tasks;
  const metrics = getTaskMetrics(scopedTasks);
  setText("filterAllCount", metrics.total);
  setText("filterPendingCount", metrics.pending);
  setText("filterProgressCount", metrics.inProgress);
  setText("filterCompletedCount", metrics.completed);

  const current = getCurrentTaskFilter();
  document.querySelectorAll("[data-task-filter-button]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.taskFilterButton === current,
    );
  });
}

function bindDashboardStatLinks() {
  document.querySelectorAll("[data-task-filter]").forEach((card) => {
    card.onclick = () => goToTasksByStatus(card.dataset.taskFilter || "all");
  });
}

function goToTasksByStatus(status) {
  const normalized = status === "all" ? "all" : normalizeTaskStatus(status);
  const target =
    normalized === "all"
      ? "tasks.html"
      : `tasks.html?status=${encodeURIComponent(normalized)}`;
  window.location.href = target;
}

function goToTasksByAssignee(assigneeId) {
  window.location.href = `tasks.html?assignee=${encodeURIComponent(assigneeId || "unassigned")}`;
}

function updateStatisticsPrintTitle(manager) {
  const page = document.getElementById("statisticsPage");
  if (!page) return;
  page.dataset.reportTitle = manager
    ? "Manager Statistics Report"
    : "Employee Statistics Report";
}

function exportStatisticsPdf() {
  const page = document.getElementById("statisticsPage");
  if (!page) return;

  const oldTitle = document.title;
  document.title = page.dataset.reportTitle || "Statistics Report";
  window.print();
  setTimeout(() => {
    document.title = oldTitle;
  }, 500);
}

function formatTaskDate(value) {
  if (!value) return "No deadline";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No deadline";
  return date.toLocaleDateString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderRecentTaskPreview() {
  const preview = document.getElementById("recentTaskPreview");
  if (!preview) return;

  if (!tasks.length) {
    preview.innerHTML = "No tasks loaded yet.";
    return;
  }

  const user = getAuthUser();
  const manager = isManagerUser(user);
  const activeTasks = tasks.filter(
    (task) => normalizeTaskStatus(task) !== "completed",
  );
  const focusTask = [...(activeTasks.length ? activeTasks : tasks)].sort(
    (a, b) => getTaskTime(a.deadline) - getTaskTime(b.deadline),
  )[0];
  const status = normalizeTaskStatus(focusTask);

  setText("focusTitle", manager ? "Needs Follow-up" : "Next Priority");
  preview.innerHTML = `
        <button type="button" class="focus-task-link" onclick="goToTasksByStatus('${status}')">
            <strong>${escapeHtml(focusTask.title || "Untitled task")}</strong>
            <span>${escapeHtml(focusTask.description || "There is no description for this task.")}</span>
            <small>${formatTaskStatus(status)} - ${formatTaskDate(focusTask.deadline)}</small>
        </button>
    `;
}

function getTaskTime(value) {
  const date = new Date(value || "2999-12-31");
  return Number.isNaN(date.getTime())
    ? Number.MAX_SAFE_INTEGER
    : date.getTime();
}

function renderAssigneeStats() {
  const list = document.getElementById("assigneeStatsList");
  if (!list) return;

  const user = getAuthUser();
  const manager = isManagerUser(user);

  if (!tasks.length) {
    list.innerHTML = "No task data loaded yet.";
    return;
  }

  if (!manager) {
    const metrics = getTaskMetrics(tasks);
    list.innerHTML = `
            <div class="assignee-self-card">
                <strong>${escapeHtml(user?.name || "Your progress")}</strong>
                <span>${metrics.completed} completed from ${metrics.total} assigned tasks.</span>
                <b>${metrics.completionPercent}%</b>
                <div class="progress-track"><span style="width: ${metrics.completionPercent}%"></span></div>
            </div>
        `;
    return;
  }

  const grouped = new Map();
  tasks.forEach((task) => {
    const assigneeId =
      task.assignedTo?.id ||
      task.assignedTo?.staffId ||
      task.assignedTo?.name ||
      "unassigned";
    const assigneeName = task.assignedTo?.name || "Unassigned";
    if (!grouped.has(assigneeId))
      grouped.set(assigneeId, { name: assigneeName, tasks: [] });
    grouped.get(assigneeId).tasks.push(task);
  });

  list.innerHTML = "";
  grouped.forEach((group, assigneeId) => {
    const metrics = getTaskMetrics(group.tasks);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "assignee-stat-row";
    row.onclick = () => goToTasksByAssignee(assigneeId);
    row.innerHTML = `
            <span>
                <strong>${escapeHtml(group.name)}</strong>
                <small>${metrics.completed} of ${metrics.total} tasks completed</small>
            </span>
            <b>${metrics.completionPercent}%</b>
            <div class="progress-track"><span style="width: ${metrics.completionPercent}%"></span></div>
        `;
    list.appendChild(row);
  });
}

// بداية جزء الرومات
// بنعمل الروم من الباك اند الأول عشان تاخد id حقيقي
async function addRoom() {
  const user = getAuthUser();
  if (!user || user.role?.toUpperCase() !== "MANAGER") {
    showToast('error','Access denied','Only managers can create rooms.');
    return;
  }
  let name = prompt("Room name?");
  if (!name?.trim()) return;

  const roomName = name.trim();

  if (user?.id) {
    try {
      const response = await fetch(`${API_BASE}/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          userId: user.id,
        },
        body: JSON.stringify({
          name: roomName,
          type: "CHAT",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to create room");
      }

      const createdRoom = await response.json();
      rooms.push({
        id: createdRoom.id,
        name: createdRoom.name,
        type: createdRoom.type,
        active: createdRoom.active,
        messages: [],
      });

      saveAll();
      renderRooms();
      return;
    } catch (error) {
      showToast('error','Room creation failed', error.message || 'Could not create room on server.');
    }
  }
}

// عرض الرومات
function renderRooms() {
  const list = document.getElementById("roomList");
  if (!list) return;
  const user = getAuthUser();
  const canManageRooms = user?.role?.toUpperCase() === "MANAGER";

  list.innerHTML = "";

  rooms.forEach((room, i) => {
    const div = document.createElement("div");
    div.className = "room";

    if (i === currentRoom) {
      div.classList.add("active-room");
    }

    div.innerHTML = `
            <span class="room-name">${room.name}</span>
            <button class="delete-room">🗑</button>
        `;

    div.querySelector(".room-name").onclick = () => openRoom(i);

    div.querySelector(".delete-room").onclick = (e) => {
      e.stopPropagation();

      rooms.splice(i, 1);

      if (currentRoom === i) {
        currentRoom = null;
        clearChatUI();
      } else if (currentRoom > i) {
        currentRoom--;
      }

      saveAll();
      renderRooms();
      void renderMessages();
    };

    list.appendChild(div);
  });

  list.querySelectorAll(".delete-room").forEach((button, index) => {
    button.style.display = canManageRooms ? "" : "none";
    button.onclick = async (event) => {
      event.stopPropagation();
      if (!canManageRooms) return;

      const room = rooms[index];
      if (!room?.id) return;
      if (!confirm("Delete this room from the database?")) return;

      const response = await fetch(`${API_BASE}/rooms/${room.id}`, {
        method: "DELETE",
        headers: { userId: user.id },
      });

      if (!response.ok) {
        showToast('error','Promotion failed', await response.text());
        return;
      }

      rooms.splice(index, 1);
      if (currentRoom === index) {
        currentRoom = null;
        clearChatUI();
      } else if (currentRoom > index) {
        currentRoom--;
      }
      renderRooms();
      void renderMessages();
    };
  });
}

// فتح الروم
// بنحمّل الرسايل القديمة وأعضاء الروم قبل ما نظهرها
async function openRoom(i) {
  if (!rooms[i]) return;

  currentRoom = i;
  saveAll();

  document.getElementById("roomTitle").innerText = rooms[i].name;
  document.getElementById("activeRoomName").innerText = rooms[i].name;

  await loadMessagesFromServer(i);

  renderRooms();
  await renderMessages();
  updateRoomInfo();
  loadRoomMembers();

  if (typeof connect === "function" && rooms[i].id) {
    connect(rooms[i].id).catch((err) =>
      console.warn("Chat WebSocket (non-fatal):", err),
    );
  }
  //دا انا ضيفته يا اخواتي اخوكم F4RAG
  loadChatSettings();
}

// تنظيف الواجهة
function clearChatUI() {
  const t = document.getElementById("roomTitle");
  const a = document.getElementById("activeRoomName");
  const c = document.getElementById("chatBox");

  if (t) t.innerText = "Select a room";
  if (a) a.innerText = "No room selected";
  if (c) c.innerHTML = "";
  renderMemberList([]);
}
// نهاية جزء الرومات
// نهاية الداشبورد

// ========================================================================
// ========================================================================
// ========================================================================

// بداية الرسايل
// لو الروم على السيرفر بنبعت بـ WebSocket وإلا نرجع للحفظ المحلي
async function sendMessage() {
  const input = document.getElementById("msgInput");
  const user = getAuthUser();
  const room = rooms[currentRoom];

  if (!input?.value.trim()) return;
  if (currentRoom === null) return;
  if (!room) return;

  const content = input.value.trim();

  if (!room.id || !user?.id) {
    alert(
      "Chat is not connected to the database yet. Please reopen the room and try again.",
    );
    return;
  }

  if (typeof stompClient === "undefined" || typeof connect !== "function") {
    alert(
      "Chat is not connected to the database yet. Please reopen the room and try again.",
    );
    return;
  }

  try {
    await connect(room.id);
  } catch (err) {
    console.error("Chat STOMP connect failed:", err);
    alert(
      "Could not connect live chat to the server. Check that the backend is reachable at:\n" +
        API_ORIGIN +
        "\n(VPN/network), then reopen the room.\n\n" +
        (err?.message || ""),
    );
    return;
  }

  if (!stompClient?.connected) {
    alert(
      "Chat is not connected to the database yet. Please reopen the room and try again.",
    );
    return;
  }

  stompClient.send(
    "/app/chat.sendMessage",
    {},
    JSON.stringify({
      content: content,
      senderName: user.name,
      senderId: user.id,
      roomId: room.id,
      type: "CHAT",
    }),
  );

  input.value = "";
}

async function renderMessages() {
  const box = document.getElementById("chatBox");
  if (!box) return;

  revokeChatBackendBlobUrls();
  box.innerHTML = "";

  if (currentRoom === null) return;

  rooms[currentRoom].messages.forEach((m) => {
    const div = document.createElement("div");
    div.className = "message";

    let content = "";

    if (m.type === "text") {
      const senderLabel = m.senderName
        ? `<div class="msg-sender">${m.senderName}</div>`
        : "";
      content = `${senderLabel}<div class="msg-text">${m.data}</div>`;
    } else if (m.type === "image") {
      content = `<img ${backendMediaSrcAttr(m.data)} style="max-width:200px;border-radius:10px;">`;
    } else if (m.type === "video") {
      content = `<video class="msg-video" ${backendMediaSrcAttr(m.data)} controls style="max-width:200px;border-radius:10px;"></video>`;
    } else if (m.type === "audio") {
      content = `
    <div class="vm-msg">

        <button class="vm-play">▶</button>

        <audio ${backendMediaSrcAttr(m.data)} preload="metadata"></audio>

        <div class="vm-wave" onclick="vmSeek(event, this)">
            <div class="vm-progress"></div>
            ${generateFakeWave()}
        </div>

        <div class="vm-meta">
            <span class="vm-time">0:00 / ${m.duration || "0:00"}</span>

            <select onchange="vmChangeSpeed(this)">
                <option value="1">1x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
            </select>
        </div>

    </div>
    `;
    } else if (m.type === "file") {
      const abs = toAbsoluteBackendMediaUrl(m.data);
      if (shouldHydrateBackendMediaUrl(m.data)) {
        content = `<a data-backend-file="${encodeURIComponent(abs)}" href="#" download="${escapeHtmlLite(m.name)}"> ${escapeHtmlLite(m.name)}</a>`;
      } else {
        content = `<a href="${escapeUrlAttr(abs)}" download="${escapeHtmlLite(m.name)}"> ${escapeHtmlLite(m.name)}</a>`;
      }
    }

    div.innerHTML = `
            ${content}
            <div class="msg-time">${m.time || ""}</div>
        `;

    box.appendChild(div);
  });

  await hydrateBackendMediaIn(box, (u) => chatMediaBlobUrls.push(u));
  box.scrollTop = box.scrollHeight;
}

function updateRoomInfo() {
  if (currentRoom === null || !rooms[currentRoom]) return;

  const msg = document.getElementById("msgCount");
  if (msg) msg.innerText = rooms[currentRoom].messages.length;
}

async function loadMessagesFromServer(roomIndex = currentRoom) {
  const user = getAuthUser();
  const room = rooms[roomIndex];

  if (!room || !room.id || !user?.id) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/messages/room/${room.id}`, {
      headers: {
        userId: user.id,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load old messages");
    }

    const serverMessages = await response.json();
    room.messages = serverMessages.map((message) => ({
      type: "text",
      data: message.content,
      senderName: message.senderName || "Unknown",
      time: message.time || "",
    }));

    const fileResponse = await fetch(`${API_BASE}/files/room/${room.id}`, {
      headers: {
        userId: user.id,
      },
    });

    if (fileResponse.ok) {
      const serverFiles = await fileResponse.json();
      serverFiles.forEach((file) => {
        const fileUrl = `${API_BASE}/files/${file.id}/download`;
        if (file.fileType?.startsWith("image/")) {
          room.messages.push({ type: "image", data: fileUrl, time: "" });
        } else if (file.fileType?.startsWith("video/")) {
          room.messages.push({ type: "video", data: fileUrl, time: "" });
        } else if (file.fileType?.startsWith("audio/")) {
          room.messages.push({ type: "audio", data: fileUrl, time: "" });
        } else {
          room.messages.push({
            type: "file",
            name: file.fileName,
            data: fileUrl,
            time: "",
          });
        }
      });
    }

    saveAll();
  } catch (error) {
    console.error(error);
  }
}

function renderMemberList(members) {
  const list = document.getElementById("memberList");
  if (!list) return;

  list.innerHTML = "";

  if (!members || members.length === 0) {
    list.innerHTML = "<li>No members</li>";
    return;
  }

  const user = getAuthUser();
  const isManager = user?.role?.toUpperCase() === "MANAGER";

  members.forEach((member) => {
    const li = document.createElement("li");
    li.innerHTML = `
            <span>${member.name} (${member.role})</span>
            ${isManager ? `<button type="button" onclick="removeMember(${member.id})">Remove</button>` : ""}
        `;
    list.appendChild(li);
  });
}

// سحب أعضاء الروم من الباك اند
async function loadRoomMembers() {
  const user = getAuthUser();
  const room = rooms[currentRoom];

  if (!room || !room.id) {
    renderMemberList([]);
    return;
  }

  if (!user?.id) {
    renderMemberList([]);
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/rooms/${room.id}/members`, {
      headers: {
        userId: user.id,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load members");
    }

    const members = await response.json();
    renderMemberList(members);
  } catch (error) {
    renderMemberList([]);
  }
}

// إضافة عضو للروم عن طريق الـ staff id
async function promptAddMember() {
  const room = rooms[currentRoom];
  const user = getAuthUser();

  if (!user || user.role?.toUpperCase() !== "MANAGER") {
    showToast('error','Access denied','Only managers can add members to a room.');
    return;
  }

  if (!room || !room.id) {
    showToast('warning','No room','Please select a saved server room first.');
    return;
  }

  if (!user?.id) {
    showToast('warning','Not logged in','Please login first.');
    return;
  }

  const staffId = prompt("Enter member staff ID:");
  if (!staffId?.trim()) return;

  try {
    const response = await fetch(
      `${API_BASE}/rooms/${room.id}/members/by-staff/${encodeURIComponent(staffId.trim())}`,
      {
        method: "POST",
        headers: {
          userId: user.id,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to add member");
    }

    const members = await response.json();
    renderMemberList(members);
  } catch (error) {
    showToast('error','Failed', error.message || 'Failed to add member.');
  }
}

// حذف عضو من الروم عن طريق الـ API
async function removeMember(memberId) {
  const room = rooms[currentRoom];
  const user = getAuthUser();

  if (!user || user.role?.toUpperCase() !== "MANAGER") {
    showToast('error','Access denied','Only managers can remove members from a room.');
    return;
  }

  if (!room || !room.id || !user?.id) {
    showToast('warning','Not available','Room membership is only available for saved server rooms.');
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE}/rooms/${room.id}/members/${memberId}`,
      {
        method: "DELETE",
        headers: {
          userId: user.id,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to remove member");
    }

    const members = await response.json();
    renderMemberList(members);
  } catch (error) {
    showToast('error','Failed', error.message || 'Failed to remove member.');
  }
}

// تحميل رومات الباك اند أول ما الصفحة تفتح
async function loadRoomsFromServer() {
  const user = getAuthUser();
  if (!user?.id) return false;

  try {
    const response = await fetch(`${API_BASE}/rooms`, {
      headers: {
        userId: user.id,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load rooms");
    }

    const serverRooms = await response.json();
    rooms = serverRooms.map((room) => ({
      id: room.id,
      name: room.name,
      type: room.type,
      active: room.active,
      messages: [],
    }));
    saveAll();
    return true;
  } catch (error) {
    return false;
  }
}

async function clearChat() {
  if (currentRoom === null) return;
  const user = getAuthUser();
  const room = rooms[currentRoom];

  if (!user || user.role?.toUpperCase() !== "MANAGER") {
    showToast('error','Access denied','Only managers can clear the chat.');
    return;
  }

  if (!user?.id || !room?.id) return;
  if (!confirm("Clear this room chat from the database?")) return;

  const messageResponse = await fetch(`${API_BASE}/messages/room/${room.id}`, {
    method: "DELETE",
    headers: { userId: user.id },
  });
  if (!messageResponse.ok) {
    alert(await messageResponse.text());
    return;
  }

  const fileResponse = await fetch(`${API_BASE}/files/room/${room.id}`, {
    method: "DELETE",
    headers: { userId: user.id },
  });
  if (!fileResponse.ok) {
    alert(await fileResponse.text());
    return;
  }

  rooms[currentRoom].messages = [];
  await renderMessages();
  updateRoomInfo();
}
// نهاية الرسايل

// ========================================================================
// ========================================================================
// ========================================================================

// handler (الجزء اللي في الروم يا كريم لما بنرسل الفايلات و كدا يعني) Start
async function uploadRoomFile(file) {
  const user = getAuthUser();
  const room = rooms[currentRoom];

  if (!file || currentRoom === null || !user?.id || !room?.id) {
    throw new Error(
      "Room file upload requires a logged-in user and a saved room.",
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("roomId", room.id);

  const response = await fetch(`${API_BASE}/files/upload`, {
    method: "POST",
    headers: { userId: user.id },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

async function handleFile(e) {
  const file = e.target.files[0];
  if (!file || currentRoom === null) return;
  try {
    await uploadRoomFile(file);
  } catch (error) {
    showToast('error','Upload failed', error.message || 'File upload failed.');
  } finally {
    e.target.value = "";
  }
}

let zegoCallInstance = null;

// تشغيل مكالمة الفيديو من خلال الـ session اللي الباك اند بيرجعها
async function startCall() {
  const user = getAuthUser();
  const room = rooms[currentRoom];

  if (currentRoom === null || !room) {
    showToast('warning','No room selected','Please select a room first.');
    return;
  }

  if (!room.id) {
    showToast('warning','Server room required','Please use a saved server room for video calls.');
    return;
  }

  if (!user?.id) {
   showToast('warning','Not logged in','Please login first.');
    return;
  }

  if (typeof ZegoUIKitPrebuilt === "undefined") {
    showToast('error','SDK error','Video call SDK failed to load.');
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE}/rooms/${room.id}/video-call-session`,
      {
        method: "POST",
        headers: {
          userId: user.id,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to start call session");
    }

    const callSession = await response.json();
    const overlay = document.getElementById("zegoCallOverlay");
    const root = document.getElementById("zegoCallRoot");

    if (!overlay || !root) {
      throw new Error("Call container is missing");
    }

    root.innerHTML = "";
    overlay.style.display = "block";

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
      Number(callSession.appId),
      callSession.token,
      callSession.roomId,
      callSession.userId,
      callSession.userName,
    );

    zegoCallInstance = ZegoUIKitPrebuilt.create(kitToken);
    zegoCallInstance.joinRoom({
      container: root,
      sharedLinks: [
        {
          name: "Room call",
          url: window.location.href,
        },
      ],
      showPreJoinView: true,
      turnOnCameraWhenJoining: true,
      turnOnMicrophoneWhenJoining: true,
      showScreenSharingButton: false,
      scenario: {
        mode: ZegoUIKitPrebuilt.GroupCall,
      },
      onLeaveRoom: () => {
        overlay.style.display = "none";
        root.innerHTML = "";
        zegoCallInstance = null;
      },
    });
  } catch (error) {
    showToast('error','Call failed', error.message || 'Unable to start the video call.');
  }
}

//دا مثلا الحتة بتاعت الساعة و كدا اللي بتظهر في الرسالة
function getTime12h() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
// handler End

// ========================================================================
// ========================================================================
// ========================================================================

// دا انا عدلت عاليه علشان لما بتعمل ريلود بيبوظ
// بداية الدارك مود

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("darkToggle");
  const widget = document.getElementById("themeWidget");

  // استعادة الثيم (Dark/Light) من الذاكرة
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    if (toggle) toggle.checked = true;
  }

  //  استعادة مكان الزرار (Position) من الذاكرة
  const savedPos = JSON.parse(localStorage.getItem("widgetPos"));
  if (savedPos && widget) {
    widget.style.left = savedPos.left;
    widget.style.top = savedPos.top;
    widget.style.position = "fixed";
  }

  //  حفظ الثيم عند التغيير
  if (toggle) {
    toggle.onchange = () => {
      if (toggle.checked) {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", "light");
      }
    };
  }

  // سحب وتحريك الزرار مع حفظ مكانه
  if (widget) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    widget.style.position = "fixed";

    widget.addEventListener("mousedown", (e) => {
      isDragging = true;
      const rect = widget.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      widget.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      // حساب الإحداثيات الجديدة
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;

      widget.style.left = x + "px";
      widget.style.top = y + "px";
    });

    document.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      widget.style.cursor = "grab";

      // حفظ الإحداثيات في الـ LocalStorage عند ترك الماوس
      const position = {
        left: widget.style.left,
        top: widget.style.top,
      };
      localStorage.setItem("widgetPos", JSON.stringify(position));
    });
  }

  // لو عندك دوال تانية زي initApp
  if (typeof initApp === "function") initApp();
});

// نهاية الدارك مود

// ========================================================================
// ========================================================================
// ========================================================================

// بداية التهيئة
// بنجهز رومات السيرفر قبل ما نرسم الصفحة
async function initApp() {
  if (appInitialized) return;
  appInitialized = true;

  await loadRoomsFromServer();
  await loadTasksFromServer();
  await loadEmployeeSummary();
  await loadEmployeesFromServer();
  renderRooms();
  updateDashboard();
  applyTaskRoleControls();
  applyRoomRoleControls();
  initNotifications();

  if (currentRoom !== null && rooms[currentRoom]) {
    openRoom(currentRoom);
  } else {
    clearChatUI();
  }

  void refreshData();

  if (!appRefreshTimer) {
    appRefreshTimer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refreshData();
    }, 20000);
  }
}

function applyRoomRoleControls() {
  const user = getAuthUser();
  const canManageRooms = user?.role?.toUpperCase() === "MANAGER";
  document
    .querySelectorAll(".member-actions, .right .danger, .manager-only")
    .forEach((element) => {
      element.style.display = canManageRooms ? "" : "none";
    });
}

function applyTaskRoleControls() {
  const user = getAuthUser();
  const canCreateTasks = ["MANAGER", "TEAM_LEADER"].includes(
    user?.role?.toUpperCase(),
  );
  const taskInput = document.querySelector(".task-input");
  if (taskInput) {
    taskInput.style.display = canCreateTasks ? "" : "none";
  }
  // Re-render task list so action buttons reflect the new role immediately
  if (tasks.length) renderTasks();
}

function startNotificationRealtime() {
  if (notificationRealtimeStarted) return;
  if (typeof SockJS === "undefined" || typeof Stomp === "undefined") return;
  const user = getAuthUser();
  if (!user?.id) return;

  notificationRealtimeStarted = true;
  const socket = new SockJS(`${getBackendOrigin()}/ws-office`);
  const eventClient = Stomp.over(socket);
  eventClient.debug = null;
  eventClient.connect(
    {},
    () => {
      eventClient.subscribe("/topic/events", (msg) => {
        const event = JSON.parse(msg.body);
        const currentUser = getAuthUser();
        const isForMe =
          !event.recipientId ||
          Number(event.recipientId) === Number(currentUser?.id);
        const isTaskEvent = [
          "task_assigned",
          "task_completed_sound",
          "task_seen",
          "notifications_changed",
          "notification_created",
        ].includes(event.event);
        const shouldRefresh =
          isTaskEvent && (isForMe || isManagerUser(currentUser));
        if (shouldRefresh) {
          triggerNotifEffect();
          loadNotifications();
          if (event.type !== "POST") loadTasksFromServer();
        }
      });
    },
    () => {
      notificationRealtimeStarted = false;
    },
  );
}

async function initNotifications() {
  await loadNotifications();
  startNotificationRealtime();
}

async function loadNotifications() {
  const user = getAuthUser();
  const list = document.getElementById("notificationList");
  if (!user?.id) return;

  const response = await fetch(`${API_BASE}/notifications`, {
    headers: { userId: user.id },
  });
  if (!response.ok) return;

  const oldUnread = notifications.filter((n) => !isNotificationRead(n)).length;
  notifications = await response.json();
  const newUnread = notifications.filter((n) => !isNotificationRead(n)).length;
  if (newUnread > oldUnread) triggerNotifEffect();

  updateNotifUI();
  return;

  if (!list) return;
  if (!notifications.length) {
    list.innerHTML = "<p style='color:#aaa'>No notifications yet.</p>";
    return;
  }

  // Sort: unread first, then by time descending
  notifications.sort((a, b) => {
    if (isNotificationRead(a) !== isNotificationRead(b))
      return isNotificationRead(a) ? 1 : -1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  list.innerHTML = notifications
    .map((n) => {
      const timeStr = n.createdAt ? new Date(n.createdAt).toLocaleString() : "";
      const unreadClass = isNotificationRead(n) ? "" : " unread";
      const markBtn = isNotificationRead(n)
        ? ""
        : `<button class="mark-read-btn" onclick="markNotifRead(${n.id})">✓ Read</button>`;

      return `<div class="notification-item${unreadClass}" id="notif-${n.id}">
            ${markBtn}
            <strong>${n.title}</strong>
            <p>${n.content}</p>
            <div class="notif-time">${timeStr}</div>
        </div>`;
    })
    .join("");
}

async function markNotifRead(notifId) {
  const user = getAuthUser();
  if (!user?.id) return false;
  const response = await fetch(`${API_BASE}/notifications/${notifId}/read`, {
    method: "PATCH",
    headers: { userId: user.id },
  });
  if (response.ok) {
    const el = document.getElementById("notif-" + notifId);
    if (el) {
      el.classList.remove("unread");
      const btn = el.querySelector(".mark-read-btn");
      if (btn) btn.remove();
    }
    await loadNotifications();
    await loadTasksFromServer();
    return true;
  }
  showToast('error','Clear failed', await response.text());
  return false;
}

function playTaskCompletedSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.15;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.25);
}

// نهاية التهيئة

// ========================================================================
// ========================================================================
// ========================================================================

// profile Start

function getStoredProfileField(field, fallback = "") {
  const user = getAuthUser();
  if (!user) return fallback;

  if (field === "name") return user.name || fallback;
  if (field === "email") return user.email || fallback;
  if (field === "image")
    return `${API_BASE}/users/${user.id}/profile-photo?ts=${Date.now()}`;
  if (field === "cover")
    return `${API_BASE}/users/${user.id}/cover-photo?ts=${Date.now()}`;

  return fallback;
}

function setStoredProfileField(field, value) {
  const user = getAuthUser();
  if (!user) return;
  if (field === "name" || field === "email") {
    user[field] = value;
    sessionStorage.setItem("authUser", JSON.stringify(user));
  }
}

async function uploadUserImage(endpoint, file) {
  const user = getAuthUser();
  if (!user?.id || !file) return null;
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}/users/${user.id}/${endpoint}`, {
    method: "POST",
    headers: { userId: user.id },
    body: formData,
  });
  if (!response.ok) {
    showToast('error','Clear failed', await response.text());
    return null;
  }
  return response.json();
}

async function removeStoredProfileField(field) {
  const user = getAuthUser();
  if (!user?.id) return false;
  const endpoint = field === "cover" ? "cover-photo" : "profile-photo";
  const response = await fetch(`${API_BASE}/users/${user.id}/${endpoint}`, {
    method: "DELETE",
    headers: { userId: user.id },
  });
  if (!response.ok) {
    showToast('error','Save failed', await response.text());
    return false;
  }
  return true;
}

document.addEventListener("DOMContentLoaded", function () {
  const nameInput = document.getElementById("nameInput");
  const emailInput = document.getElementById("emailInput");
  const displayName = document.getElementById("displayName");

  const profileImage = document.getElementById("profileImage");
  const imageInput = document.getElementById("imageInput");

  const cover = document.getElementById("cover");
  const coverInput = document.getElementById("coverInput");

  const cameraBtn = document.getElementById("cameraBtn");
  const uploadMenu = document.getElementById("uploadMenu");

  //دا يا كريم كود معقد كدا شات عملوا ليا علشان لما نبعت بس الصورة تفضل متخزنة فهمني فبيضغتها حاولل انت بقي ترفعها عل الداتا بيز
  function compressImage(file, callback) {
    const reader = new FileReader();

    reader.onload = function (e) {
      const img = new Image();
      img.src = e.target.result;

      img.onload = function () {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const MAX_WIDTH = 300;
        const scale = MAX_WIDTH / img.width;

        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const compressed = canvas.toDataURL("image/jpeg", 0.6);

        callback(compressed);
      };
    };

    reader.readAsDataURL(file);
  }

  //الاسم و كدا اللي في البروفايل

  if (displayName) {
    displayName.innerText = getStoredProfileField("name", "Your Name");
    if (nameInput) nameInput.value = getStoredProfileField("name", "");
    if (emailInput) emailInput.value = getStoredProfileField("email", "");
  }

  if (profileImage || cover) {
    void refreshProfilePageMedia();
  }

  //تغيير الكافر و كدا يعني
  if (cameraBtn) {
    cameraBtn.onclick = () => {
      if (uploadMenu) {
        uploadMenu.style.display =
          uploadMenu.style.display === "block" ? "none" : "block";
      }
    };
  }

  const chooseProfile = document.getElementById("chooseProfile");
  if (chooseProfile) {
    chooseProfile.onclick = () => {
      imageInput.click();
      if (uploadMenu) uploadMenu.style.display = "none";
    };
  }

  const chooseCover = document.getElementById("chooseCover");
  if (chooseCover) {
    chooseCover.onclick = () => {
      if (coverInput) coverInput.click();
      if (uploadMenu) uploadMenu.style.display = "none";
    };
  }

  if (imageInput) {
    imageInput.onchange = async function () {
      const file = this.files[0];
      if (!file) return;

      const savedUser = await uploadUserImage("profile-photo", file);
      if (savedUser && profileImage) {
        sessionStorage.setItem("authUser", JSON.stringify(savedUser));
        await refreshProfilePageMedia();
        void loadNavbarProfile();
      }
    };
  }

  if (coverInput) {
    coverInput.onchange = async function () {
      const file = this.files[0];
      if (!file) return;

      const savedUser = await uploadUserImage("cover-photo", file);
      if (savedUser && cover) {
        sessionStorage.setItem("authUser", JSON.stringify(savedUser));
        await refreshProfilePageMedia();
      }
    };
  }
});

async function saveProfile() {
  const name = document.getElementById("nameInput").value;
  const email = document.getElementById("emailInput").value;
  const user = getAuthUser();
  if (!user?.id) {
    showToast('warning','Not logged in','Please login first.');
    return;
  }

  const response = await fetch(`${API_BASE}/users/${user.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      userId: user.id,
    },
    body: JSON.stringify({ name, email }),
  });

  if (!response.ok) {
    showToast('error','Upload failed', await response.text());
    return;
  }

  const savedUser = await response.json();
  sessionStorage.setItem("authUser", JSON.stringify(savedUser));
  setStoredProfileField("name", savedUser.name);
  setStoredProfileField("email", savedUser.email);
  document.getElementById("displayName").innerText = name;

  showToast('success','Saved!','Your profile has been saved to the database.');
}

// =====================
// TABS
// =====================
function showTab(id) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ========================================================================
// ========================================================================
// ========================================================================

// youssef wael was here
// the commented function only uses local storage with no back end
// no video or pic support in case anything fails

// //posts Start
// //الحتة دي لسه تعتبر ستاتك و غامضة اوي اصلا ف سيبك منها سيبها استاتك كدا
// document.addEventListener("DOMContentLoaded", function () {

//     const authUser = getAuthUser();
//     let posts = [];
//     let currentUserId = authUser?.id || null;

//     function getCurrentUser() {
//         return getAuthUser() || { id: currentUserId || Date.now(), name: "You" };
//     }

//     window.addPost = function () {
//         const input = document.getElementById("postInput");
//         if (!input.value.trim()) return;

//         const user = getCurrentUser();

//         const post = {
//             id: Date.now(),
//             userId: user.id,
//             userName: user.name,
//             text: input.value,
//             likes: [],
//             comments: []
//         };

//         posts.unshift(post);

//         input.value = "";

//         renderFeed();
//     };

//     window.likePost = function (postId) {
//         const post = posts.find(p => p.id == postId);
//         if (!post) return;

//         const userId = currentUserId;

//         if (post.likes.includes(userId)) {
//             post.likes = post.likes.filter(id => id != userId);
//         } else {
//             post.likes.push(userId);
//         }

//         renderFeed();
//     };

//     // ================= COMMENT =================
//     window.addComment = function (postId, input) {
//         const post = posts.find(p => p.id == postId);
//         if (!post) return;

//         if (!input.value.trim()) return;

//         post.comments.push({
//             userId: currentUserId,
//             text: input.value
//         });

//         input.value = "";

//         renderFeed();
//     };

//     function renderFeed() {

//         const list = document.getElementById("postList");
//         if (!list) return;
//         list.innerHTML = "";

//         posts.forEach(post => {

//             const liked = post.likes.includes(currentUserId);

//             list.innerHTML += `
//                 <div class="post">

//                     <div class="post-header">
//                         ${post.userName}
//                     </div>

//                     <div class="post-text">
//                         ${post.text}
//                     </div>

//                     <div class="post-actions">

//                         <button onclick="likePost(${post.id})"
//                             style="color:${liked ? '#0a66c2' : '#555'}">
//                             ❤️ Like (${post.likes.length})
//                         </button>

//                         <button onclick="toggleComment(${post.id})">
//                             💬 Comment (${post.comments.length})
//                         </button>

//                     </div>

//                     <div class="comment-box" id="comment-${post.id}" style="display:none;">

//                         <input type="text"
//                             placeholder="Write comment..."
//                             onkeydown="if(event.key==='Enter') addComment(${post.id}, this)">

//                         <div>
//                             ${post.comments.map(c => `
//                                 <p>💬 ${c.text}</p>
//                             `).join("")}
//                         </div>

//                     </div>

//                 </div>
//             `;
//         });
//     }

//     window.toggleComment = function (id) {
//         const box = document.getElementById(`comment-${id}`);
//         if (!box) return;

//         box.style.display = box.style.display === "block" ? "none" : "block";
//     };

//     renderFeed();
// });
// //posts Start
// profile End

window.previewPostMedia = function (input) {
  const file = input.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith("video/");
  const preview = document.getElementById("postMediaPreview");
  const img = document.getElementById("postImgPreview");
  const vid = document.getElementById("postVidPreview");
  if (img) {
    img.style.display = isVideo ? "none" : "block";
    img.src = isVideo ? "" : url;
  }
  if (vid) {
    vid.style.display = isVideo ? "block" : "none";
    vid.src = isVideo ? url : "";
  }
  if (preview) preview.style.display = "block";
};

window.clearPostMedia = function () {
  const input = document.getElementById("postMediaInput");
  const preview = document.getElementById("postMediaPreview");
  const img = document.getElementById("postImgPreview");
  const vid = document.getElementById("postVidPreview");
  if (input) input.value = "";
  if (img) {
    img.src = "";
    img.style.display = "none";
  }
  if (vid) {
    vid.src = "";
    vid.style.display = "none";
  }
  if (preview) preview.style.display = "none";
};

//posts Start
document.addEventListener("DOMContentLoaded", function () {
  const openCommentPostIds = new Set();
  window.shouldPausePostsRefresh = function () {
    return openCommentPostIds.size > 0;
  };

  function getCurrentUser() {
    const user = getAuthUser();
    return user && user.id ? user : null;
  }

  function getPostHeaders() {
    const user = getCurrentUser();
    return user ? { userId: String(user.id) } : null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function normalizePostMediaUrl(url) {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `${getBackendOrigin()}${url}`;
    return `${API_BASE}/${url.replace(/^\/+/, "")}`;
  }

  window.loadPostsFromServer = async function () {
    const headers = getPostHeaders();
    if (!headers) {
      await renderFeed([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/posts`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const posts = await response.json();
      await renderFeed(posts);
    } catch (error) {
      console.error("Error loading posts:", error);
      await renderFeed([]);
    }
  };

  window.addPost = function () {
    addPostToServer();
  };

  async function addPostToServer() {
    const input = document.getElementById("postInput");
    const fileEl = document.getElementById("postMediaInput");
    const caption = (input?.value || "").trim();
    const file = fileEl?.files[0] || null;
    const headers = getPostHeaders();

    if (!caption && !file) return;
    if (!headers) {
      alert("You need to log in before creating a post.");
      return;
    }

    const formData = new FormData();
    if (caption) formData.append("caption", caption);
    if (file) formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE}/posts`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      if (input) input.value = "";
      window.clearPostMedia();
      await window.loadPostsFromServer();
    } catch (error) {
      console.error("Error creating post:", error);
      alert(error.message || "Could not publish the post. Please try again.");
    }
  }

  window.likePost = async function (postId, liked) {
    const headers = getPostHeaders();
    if (!headers) {
      alert("You need to log in before liking posts.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/posts/${postId}/likes`, {
        method: liked ? "DELETE" : "POST",
        headers,
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      await window.loadPostsFromServer();
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  window.addComment = async function (postId, inputEl) {
    const text = inputEl.value.trim();
    const headers = getPostHeaders();
    if (!text) return;
    if (!headers) {
      alert("You need to log in before commenting.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      inputEl.value = "";
      await window.loadPostsFromServer();
    } catch (error) {
      console.error("Error adding comment:", error);
      alert(error.message || "Could not add the comment.");
    }
  };

  window.deletePost = async function (postId) {
    const headers = getPostHeaders();
    if (!headers) {
      alert("You need to log in before deleting posts.");
      return;
    }
    if (!confirm("Delete this post?")) return;

    try {
      const response = await fetch(`${API_BASE}/posts/${postId}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      openCommentPostIds.delete(String(postId));
      await window.loadPostsFromServer();
    } catch (error) {
      console.error("Error deleting post:", error);
      alert(error.message || "Could not delete the post.");
    }
  };

  window.deleteComment = async function (postId, commentIndex) {
    const headers = getPostHeaders();
    if (!headers) {
      alert("You need to log in before deleting comments.");
      return;
    }
    if (!confirm("Delete this comment?")) return;

    try {
      const response = await fetch(
        `${API_BASE}/posts/${postId}/comments/${commentIndex}`,
        {
          method: "DELETE",
          headers,
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      openCommentPostIds.add(String(postId));
      await window.loadPostsFromServer();
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert(error.message || "Could not delete the comment.");
    }
  };

  window.toggleComment = function (postId) {
    const box = document.getElementById(`comments-${postId}`);
    if (!box) return;
    box.classList.toggle("open");
    if (box.classList.contains("open")) {
      openCommentPostIds.add(String(postId));
    } else {
      openCommentPostIds.delete(String(postId));
    }
  };

  function timeAgo(date) {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return new Date(date).toLocaleDateString();
  }

  async function renderFeed(posts) {
    const list = document.getElementById("postList");
    if (!list) return;

    revokeFeedBackendBlobUrls();
    list.innerHTML = "";

    if (!Array.isArray(posts) || !posts.length) {
      list.innerHTML = `<div class="post-card"><div class="post-caption">No posts yet. Be the first to share something.</div></div>`;
      return;
    }

    posts.forEach((post) => {
      const liked = Boolean(post.likedByCurrentUser);
      const initials = (post.userName || "?")
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
      const mediaUrl = normalizePostMediaUrl(post.mediaUrl);
      const mediaHtml = mediaUrl
        ? (post.mediaType || "").startsWith("video/")
          ? `<video class="post-media" controls ${backendMediaSrcAttr(mediaUrl)}></video>`
          : `<img class="post-media" ${backendMediaSrcAttr(mediaUrl)} alt="post image">`
        : "";

      const avatarUrl = post.userAvatar
        ? normalizePostMediaUrl(post.userAvatar)
        : null;
      const avatarHtml = avatarUrl
        ? `<img class="post-avatar-img" ${backendMediaSrcAttr(avatarUrl)} alt=""
                                onload="this.style.display='block';var i=document.getElementById('initials-${post.id}');if(i)i.style.display='none';"
                                onerror="this.style.display='none';"
                                style="display:none;position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover;">`
        : "";

      const postDeleteHtml = post.canDelete
        ? `<button class="post-delete-btn" onclick="deletePost(${post.id})" title="Delete post" type="button"><i class="fa fa-trash"></i></button>`
        : "";

      const commentsHtml = (post.comments || [])
        .map(
          (c) =>
            `<div class="post-comment-item">
                    <div class="post-comment-text"><strong>${escapeHtml(c.userName || "User")}:</strong> ${escapeHtml(c.text || "")}</div>
                    ${c.canDelete ? `<button class="post-comment-delete-btn" onclick="deleteComment(${post.id}, ${c.index})" title="Delete comment" type="button"><i class="fa fa-trash"></i></button>` : ""}
                </div>`,
        )
        .join("");

      list.innerHTML += `
            <div class="post-card">
                <div class="post-card-header">
                    <div class="post-header-meta">
                        <div class="post-avatar-circle" style="position:relative;">
                            <span id="initials-${post.id}">${initials}</span>
                            ${avatarHtml}
                        </div>
                        <div>
                            <div class="post-author-name">${escapeHtml(post.userName)}</div>
                            <div class="post-time">${timeAgo(post.timestamp || Date.now())}</div>
                        </div>
                    </div>
                    ${postDeleteHtml}
                </div>

                ${post.caption ? `<div class="post-caption">${escapeHtml(post.caption)}</div>` : ""}
                ${mediaHtml}

                <div class="post-actions-bar">
                    <button class="post-action-btn ${liked ? "liked" : ""}" onclick="likePost(${post.id}, ${liked})">
                        <i class="fa ${liked ? "fa-solid fa-heart" : "fa-regular fa-heart"}"></i>
                        ${post.likeCount > 0 ? post.likeCount + " " : ""}Like
                    </button>
                    <button class="post-action-btn" onclick="toggleComment(${post.id})">
                        <i class="fa-regular fa-comment"></i>
                        ${post.commentCount > 0 ? post.commentCount + " " : ""}Comment
                    </button>
                </div>

                <div class="post-comment-section" id="comments-${post.id}">
                    <div class="post-comment-input-row">
                        <input type="text" placeholder="Write a comment…"
                            onkeydown="if(event.key==='Enter') addComment(${post.id}, this)">
                        <button class="post-comment-send-btn"
                            onclick="addComment(${post.id}, this.previousElementSibling)">
                            <i class="fa fa-paper-plane"></i>
                        </button>
                    </div>
                    <div class="post-comment-list">${commentsHtml}</div>
                </div>
            </div>`;
    });

    openCommentPostIds.forEach((postId) => {
      const box = document.getElementById(`comments-${postId}`);
      if (box) {
        box.classList.add("open");
      }
    });

    await hydrateBackendMediaIn(list, (u) => feedMediaBlobUrls.push(u));
  }

  window.loadPostsFromServer();
});
//posts End

// ========================================================================
// ========================================================================
// ========================================================================

//load the picture in navbar Start

// بنجيب بيانات الناف بار من تخزين خاص بكل يوزر
async function loadNavbarProfile() {
  revokeNavAvatarBlobUrl();
  const name = getStoredProfileField("name", "Guest");
  const image = getStoredProfileField("image", "");

  const nameEl = document.getElementById("navUserName");
  const imgEl = document.getElementById("navUserAvatar");

  if (nameEl) {
    nameEl.innerText = name;
  }
  if (!imgEl) return;

  if (!image) {
    imgEl.src = "images/default.png";
    return;
  }

  try {
    const abs = toAbsoluteBackendMediaUrl(image);
    if (!shouldHydrateBackendMediaUrl(image)) {
      imgEl.src = abs;
    } else {
      navAvatarBlobUrl = await fetchBackendBlobUrl(abs);
      imgEl.src = navAvatarBlobUrl;
    }
  } catch (e) {
    console.warn("Nav avatar load failed", e);
    imgEl.src = "images/default.png";
  }
}

void loadNavbarProfile();

//load the picture in navbar End

// Record  End

let vmRecorder;
let vmChunks = [];
let vmStream;
let vmAudioCtx;
let vmAnalyser;
let vmDataArray;
let vmAnimationId;
let vmRecording = false;

let smoothedScale = 1;

const recordBtn = document.getElementById("recordBtn");

if (recordBtn) {
  recordBtn.addEventListener("click", async () => {
    if (!vmRecording) {
      await startRecording();
    } else {
      stopRecording();
    }
  });
}

async function startRecording() {
  if (currentRoom === null) {
    showToast('warning','No room','Select a room first.');
    return;
  }

  vmStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  vmRecorder = new MediaRecorder(vmStream);
  vmChunks = [];

  vmRecorder.ondataavailable = (e) => vmChunks.push(e.data);

  vmRecorder.onstop = () => {
    const blob = new Blob(vmChunks, { type: "audio/webm" });
    const url = URL.createObjectURL(blob);
    saveVoiceMessage(blob, url);
  };

  vmRecorder.start();
  vmRecording = true;

  recordBtn.classList.add("recording");

  startAudioMeter(vmStream);
}

function stopRecording() {
  vmRecording = false;

  recordBtn.classList.remove("recording");

  if (vmRecorder && vmRecorder.state !== "inactive") {
    vmRecorder.stop();
  }

  if (vmStream) {
    vmStream.getTracks().forEach((t) => t.stop());
  }

  cancelAnimationFrame(vmAnimationId);

  vmRecorder.onstop = () => {
    const blob = new Blob(vmChunks, { type: "audio/webm" });
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);

    audio.onloadedmetadata = () => {
      const duration = formatTime(audio.duration);
      saveVoiceMessage(blob, url, duration);
    };
  };
}

function startAudioMeter(stream) {
  vmAudioCtx = new AudioContext();
  const source = vmAudioCtx.createMediaStreamSource(stream);

  vmAnalyser = vmAudioCtx.createAnalyser();
  vmAnalyser.fftSize = 256;

  source.connect(vmAnalyser);

  vmDataArray = new Uint8Array(vmAnalyser.frequencyBinCount);

  function animate() {
    vmAnalyser.getByteFrequencyData(vmDataArray);

    let avg = vmDataArray.reduce((a, b) => a + b) / vmDataArray.length;
    let targetScale = 1 + avg / 200;
    smoothedScale += (targetScale - smoothedScale) * 0.15;
    recordBtn.style.transform = `scale(${smoothedScale})`;

    drawLiveWave(vmDataArray);

    vmAnimationId = requestAnimationFrame(animate);
  }

  animate();
}

async function saveVoiceMessage(blob, url, duration) {
  if (!blob) return;

  try {
    const voiceFile = new File([blob], `voice-note-${Date.now()}.webm`, {
      type: blob.type || "audio/webm",
    });

    await uploadRoomFile(voiceFile);
  } catch (error) {
    console.error(error);
    showToast('error','Upload failed', error.message || 'Voice note upload failed.');
  } finally {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}

function vmTogglePlay(btn) {
  const audio = btn.nextElementSibling;

  if (audio.paused) {
    audio.play();
    btn.innerText = "❚❚";
  } else {
    audio.pause();
    btn.innerText = "▶";
  }

  audio.onended = () => {
    btn.innerText = "▶";
  };
}

function generateFakeWave() {
  let wave = "";
  for (let i = 0; i < 25; i++) {
    wave += `<span style="height:${Math.random() * 15 + 5}px"></span>`;
  }
  return wave;
}

function vmChangeSpeed(select) {
  const audio = select.parentElement.parentElement.querySelector("audio");
  audio.playbackRate = select.value;
}

function formatTime(sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" + s : s}`;
}

document.addEventListener("click", function (e) {
  if (e.target.classList.contains("vm-play")) {
    const audio = e.target.nextElementSibling;
    const container = e.target.closest(".vm-msg");
    const progress = container.querySelector(".vm-progress");
    const timeText = container.querySelector(".vm-time");

    if (audio.paused) {
      audio.play();
      e.target.innerText = "❚❚";
    } else {
      audio.pause();
      e.target.innerText = "▶";
    }

    audio.ontimeupdate = () => {
      const percent = (audio.currentTime / audio.duration) * 100;
      progress.style.width = percent + "%";

      const current = formatTime(audio.currentTime);
      const total = formatTime(audio.duration);

      timeText.innerText = `${current} / ${total}`;
    };

    audio.onended = () => {
      e.target.innerText = "▶";
      progress.style.width = "0%";
    };
  }
});

function vmSeek(e, wave) {
  const audio = wave.parentElement.querySelector("audio");
  const rect = wave.getBoundingClientRect();

  const percent = (e.clientX - rect.left) / rect.width;

  audio.currentTime = percent * audio.duration;
}

// Record End

/* 

       تحت الكمنت ده هتلاقي الربط 
        متلعبش فيه

*/

// بنخزن بيانات أول خطوة من اللوجين بين صفحة اللوجين وصفحة الـ OTP
function getPendingLoginVerification() {
  return JSON.parse(sessionStorage.getItem("pendingLoginVerification"));
}

function setPendingLoginVerification(data) {
  sessionStorage.setItem("pendingLoginVerification", JSON.stringify(data));
}

function clearPendingLoginVerification() {
  sessionStorage.removeItem("pendingLoginVerification");
}

function getPendingPasswordReset() {
  return JSON.parse(sessionStorage.getItem("pendingPasswordReset"));
}

function setPendingPasswordReset(data) {
  sessionStorage.setItem("pendingPasswordReset", JSON.stringify(data));
}

function clearPendingPasswordReset() {
  sessionStorage.removeItem("pendingPasswordReset");
}

async function readApiError(response) {
  const rawText = await response.text();

  if (!rawText) return "Request failed.";

  try {
    const data = JSON.parse(rawText);
    return data.message || data.error || rawText;
  } catch (error) {
    return rawText;
  }
}

/** Shown when fetch() throws (tunnel down, wrong API_BASE, DNS, CORS, offline). */
function describeNetworkFetchFailure(error) {
  const detail = error?.message ? String(error.message) : "Unknown error";
  return (
    `${detail}\n\n` +
    `Cannot reach API at:\n${API_BASE}\n\n` +
    `Fix: run the backend at ${API_ORIGIN}, or set JS/rafiq-deploy-config.js (window.__RAFIQ_API_ORIGIN__), or API_ORIGIN_OVERRIDE in this file. See DEPLOYMENT.md.`
  );
}

function handleOAuthLoginRedirect() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("oauth") !== "success") return false;

  const id = params.get("id");
  const name = params.get("name");
  const email = params.get("email");
  const role = params.get("role");
  const staffId = params.get("staffId");

  if (!id || !email) return false;

  const authUser = {
    id: Number(id),
    name: name || "",
    email: email,
    role: role || "DEVELOPER",
    staffId: staffId || "",
  };

  sessionStorage.setItem("authUser", JSON.stringify(authUser));
  document.documentElement.classList.add("logged-in");

  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
  window.location.href = "dashboard.html";
  return true;
}

// بداية اللوجين بـ Google أو GitHub من صفحة اللوجين
function startSocialLogin(provider) {
  if (!provider) return;
  window.location.href = `${getBackendOrigin()}/oauth2/authorization/${encodeURIComponent(provider)}`;
}

// بداية لوجين الـ OTP: نراجع البيانات وبعدين نروح لصفحة الكود
async function loginToServer(email, password, username, staffId) {
  const params = new URLSearchParams();
  params.append("email", email);
  params.append("password", password);
  params.append("username", username);
  params.append("staffId", staffId);

  try {
    const response = await fetch(
      `${API_BASE}/auth/login/initiate?${params.toString()}`,
      {
        method: "POST",
      },
    );

    if (response.ok) {
      const data = await response.json();
      setPendingLoginVerification({
        email,
        password,
        username,
        staffId,
        user: {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          staffId: data.staffId,
        },
        deliveryTarget: data.deliveryTarget,
        message: data.message,
      });
      window.location.href = "twofactor.html";
    } else {
      const errorMsg = await readApiError(response);
      showToast('error','Login failed', errorMsg);
    }
  } catch (error) {
    console.error("login/initiate:", error);
    showToast('error','Connection error','Cannot reach server. Check that the backend is running.');
  }
}

async function triggerLogin() {
  const email = document.getElementById("loginEmail").value;
  const username = document.getElementById("loginUsername").value;
  const staffId = document.getElementById("loginStaffId").value;
  const password = document.getElementById("loginPassword").value;

  if (!email || !username || !staffId || !password) {
    showToast('warning','Missing fields','Please fill all 4 fields.');
    return;
  }
  await loginToServer(email, password, username, staffId);
}

async function triggerRegister() {
  const name = document.getElementById("regName").value;
  const email = document.getElementById("regEmail").value;
  const role = document.getElementById("regRole").value;
  const password = document.getElementById("regPass").value;

  if (!name || !email || !role || !password) {
    showToast('warning','Missing fields','Please fill all registration fields.');
    return;
  }

  const pwdErr = getPasswordPolicyError(password);
  if (pwdErr) {
    showToast("warning", "Password requirements", pwdErr);
    return;
  }

  const userData = { name, email, role, password, active: true };

  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    if (response.ok) {
      showToast('success','Registered!','Check your email for your Staff ID.');
      location.reload();
    } else {
      const errorMsg = await readApiError(response);
      showToast('error','Registration failed', errorMsg);
    }
  } catch (err) {
    console.error("auth/register:", err);
    alert(
      "Error connecting to server.\n\n" + describeNetworkFetchFailure(err),
    );
  }
}

//ملهاش علاقه بالربط

function updateNavbarState() {
  const user = getAuthUser();

  const LOGBT =
    document.querySelector(".login_button") ||
    document.querySelector("a[href='login.html']");
  const SIGNUPBT =
    document.querySelector(".signup_button") ||
    document.querySelector("a[href='signup.html']");

  if (user) {
    if (LOGBT) LOGBT.style.display = "none";
    if (SIGNUPBT) SIGNUPBT.style.display = "none";

    const nav = document.querySelector(".nav-links");
    if (nav && !document.getElementById("logoutBtn")) {
      const logoutLi = document.createElement("li");
      logoutLi.innerHTML = `<a href="#" id="logoutBtn" onclick="logout()" style="color: #fdbd41;">Logout</a>`;
      nav.appendChild(logoutLi);
    }
  }
}

function logout() {
  sessionStorage.removeItem("authUser");
  clearPendingLoginVerification();
  clearPendingPasswordReset();
  window.location.href = "login.html";
}
document.addEventListener("DOMContentLoaded", updateNavbarState);

document.addEventListener("DOMContentLoaded", function () {
  handleOAuthLoginRedirect();
});

function setOtpStatus(message, isError) {
  const statusEl = document.getElementById("otpStatus");
  if (!statusEl) return;

  statusEl.textContent = message || "";
  statusEl.classList.remove("error", "success");
  if (message) {
    statusEl.classList.add(isError ? "error" : "success");
  }
}

function initializeEmailOtpPage() {
  const codeInput = document.getElementById("otpCode");
  if (!codeInput) return;

  const pending = getPendingLoginVerification();
  if (!pending?.user?.id) {
    window.location.href = "login.html";
    return;
  }

  const userNameEl = document.getElementById("otpUserName");
  const deliveryEl = document.getElementById("otpDeliveryTarget");
  const descriptionEl = document.getElementById("otpDescription");

  if (userNameEl) userNameEl.textContent = pending.user.name || "-";
  if (deliveryEl)
    deliveryEl.textContent =
      pending.deliveryTarget || pending.user.email || "-";
  if (descriptionEl && pending.message) {
    descriptionEl.textContent =
      pending.message + ". Check your inbox for the 5-digit verification code.";
  }
}

async function submitEmailOtp() {
  const pending = getPendingLoginVerification();
  if (!pending) {
    window.location.href = "login.html";
    return;
  }

  const otpCode = (document.getElementById("otpCode")?.value || "").trim();
  const submitBtn = document.getElementById("otpSubmitBtn");

  if (!otpCode) {
    setOtpStatus("Enter the 5-digit code from your email.", true);
    return;
  }

  const params = new URLSearchParams();
  params.append("email", pending.email);
  params.append("password", pending.password);
  params.append("username", pending.username);
  params.append("staffId", pending.staffId);
  params.append("otpCode", otpCode);

  try {
    if (submitBtn) submitBtn.disabled = true;
    setOtpStatus("Verifying your code...", false);

    const response = await fetch(
      `${API_BASE}/auth/login/verify?${params.toString()}`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    const user = await response.json();
    sessionStorage.setItem("authUser", JSON.stringify(user));
    clearPendingLoginVerification();
    setOtpStatus("Success. Redirecting to your dashboard...", false);
    window.location.href = "dashboard.html";
  } catch (error) {
    setOtpStatus(error.message || "Could not verify the login code.", true);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function cancelEmailOtpFlow() {
  const pending = getPendingLoginVerification();
  clearPendingLoginVerification();

  if (pending?.email) {
    try {
      await fetch(
        `${API_BASE}/auth/login/cancel?email=${encodeURIComponent(pending.email)}`,
        {
          method: "POST",
        },
      );
    } catch (error) {}
  }

  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", function () {
  initializeEmailOtpPage();
});

function setResetPasswordStatus(message, isError) {
  const statusEl = document.getElementById("resetStatus");
  if (!statusEl) return;

  statusEl.textContent = message || "";
  statusEl.classList.remove("error", "success");
  if (message) {
    statusEl.classList.add(isError ? "error" : "success");
  }
}

function updateForgotPasswordStep(step) {
  const steps = [
    {
      key: "request",
      panelId: "resetStepRequest",
      badgeId: "resetStepRequestBadge",
    },
    {
      key: "verify",
      panelId: "resetStepVerify",
      badgeId: "resetStepVerifyBadge",
    },
    {
      key: "password",
      panelId: "resetStepPassword",
      badgeId: "resetStepPasswordBadge",
    },
  ];

  steps.forEach((item) => {
    const panel = document.getElementById(item.panelId);
    const badge = document.getElementById(item.badgeId);
    const isActive = item.key === step;

    if (panel) {
      panel.classList.toggle("auth-panel-hidden", !isActive);
    }

    if (badge) {
      badge.classList.toggle("is-active", isActive);
    }
  });
}

function initializeForgotPasswordPage() {
  const emailInput = document.getElementById("resetEmail");
  if (!emailInput) return;

  const pending = getPendingPasswordReset();
  const deliveryTargetEl = document.getElementById("resetDeliveryTarget");

  if (pending?.email) {
    emailInput.value = pending.email;
  }

  if (deliveryTargetEl && pending?.deliveryTarget) {
    deliveryTargetEl.textContent = pending.deliveryTarget;
  }

  if (pending?.verified) {
    updateForgotPasswordStep("password");
    setResetPasswordStatus("Code verified. Set your new password now.", false);
  } else if (pending?.email) {
    updateForgotPasswordStep("verify");
  } else {
    updateForgotPasswordStep("request");
  }
}

async function requestPasswordResetCode() {
  const emailInput = document.getElementById("resetEmail");
  const requestBtn = document.getElementById("resetRequestBtn");
  const email = (emailInput?.value || "").trim();

  if (!email) {
    setResetPasswordStatus("Enter the email linked to your account.", true);
    return;
  }

  try {
    if (requestBtn) requestBtn.disabled = true;
    setResetPasswordStatus("Sending your reset code...", false);

    const response = await fetch(
      `${API_BASE}/auth/forgot-password/request?email=${encodeURIComponent(email)}`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    const data = await response.json();
    setPendingPasswordReset({
      email,
      deliveryTarget: data.deliveryTarget,
      verified: false,
    });

    const deliveryTargetEl = document.getElementById("resetDeliveryTarget");
    if (deliveryTargetEl) {
      deliveryTargetEl.textContent = data.deliveryTarget || email;
    }

    updateForgotPasswordStep("verify");
    setResetPasswordStatus(
      data.message || "We sent a password reset code to your email.",
      false,
    );
  } catch (error) {
    setResetPasswordStatus(
      error.message || "Could not send the reset code.",
      true,
    );
  } finally {
    if (requestBtn) requestBtn.disabled = false;
  }
}

async function verifyPasswordResetCode() {
  const pending = getPendingPasswordReset();
  const verifyBtn = document.getElementById("resetVerifyBtn");
  const otpCode = (document.getElementById("resetOtpCode")?.value || "").trim();

  if (!pending?.email) {
    updateForgotPasswordStep("request");
    setResetPasswordStatus("Start by entering your email address first.", true);
    return;
  }

  if (!otpCode) {
    setResetPasswordStatus("Enter the 5-digit code from your email.", true);
    return;
  }

  try {
    if (verifyBtn) verifyBtn.disabled = true;
    setResetPasswordStatus("Verifying your reset code...", false);

    const params = new URLSearchParams();
    params.append("email", pending.email);
    params.append("otpCode", otpCode);

    const response = await fetch(
      `${API_BASE}/auth/forgot-password/verify?${params.toString()}`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    setPendingPasswordReset({
      ...pending,
      otpCode,
      verified: true,
    });

    updateForgotPasswordStep("password");
    setResetPasswordStatus(
      "Code verified. You can set a new password now.",
      false,
    );
  } catch (error) {
    setResetPasswordStatus(
      error.message || "Could not verify the reset code.",
      true,
    );
  } finally {
    if (verifyBtn) verifyBtn.disabled = false;
  }
}

async function submitForgotPasswordReset() {
  const pending = getPendingPasswordReset();
  const submitBtn = document.getElementById("resetSubmitBtn");
  const newPassword = document.getElementById("resetNewPassword")?.value || "";
  const confirmPassword =
    document.getElementById("resetConfirmPassword")?.value || "";

  if (!pending?.email || !pending?.verified || !pending?.otpCode) {
    updateForgotPasswordStep("request");
    setResetPasswordStatus(
      "Restart the reset flow and verify your code first.",
      true,
    );
    return;
  }

  if (!newPassword || !confirmPassword) {
    setResetPasswordStatus("Enter and confirm your new password.", true);
    return;
  }

  if (newPassword !== confirmPassword) {
    setResetPasswordStatus(
      "The new password confirmation does not match.",
      true,
    );
    return;
  }

  const resetPwdErr = getPasswordPolicyError(newPassword);
  if (resetPwdErr) {
    setResetPasswordStatus(resetPwdErr, true);
    return;
  }

  try {
    if (submitBtn) submitBtn.disabled = true;
    setResetPasswordStatus("Updating your password...", false);

    const response = await fetch(`${API_BASE}/auth/forgot-password/reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: new URLSearchParams({
        email: pending.email,
        otpCode: pending.otpCode,
        newPassword,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    clearPendingPasswordReset();
    setResetPasswordStatus(
      "Password updated successfully. Redirecting to sign in...",
      false,
    );
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);
  } catch (error) {
    setResetPasswordStatus(
      error.message || "Could not reset your password.",
      true,
    );
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function openChangePasswordPage() {
  const user = getAuthUser();
  if (!user?.id) {
    alert("Please login first.");
    window.location.href = "login.html";
    return;
  }

  window.location.href = "change-password.html";
}

function setChangePasswordStatus(message, isError) {
  const statusEl = document.getElementById("changePasswordStatus");
  if (!statusEl) return;

  statusEl.textContent = message || "";
  statusEl.classList.remove("error", "success");
  if (message) {
    statusEl.classList.add(isError ? "error" : "success");
  }
}

function initializeChangePasswordPage() {
  const emailEl = document.getElementById("changePasswordEmail");
  if (!emailEl) return;

  const user = getAuthUser();
  if (!user?.id) {
    window.location.href = "login.html";
    return;
  }

  emailEl.textContent = user.email || "your account";
}

async function submitChangePassword() {
  const user = getAuthUser();
  const submitBtn = document.getElementById("changePasswordBtn");
  const currentPassword =
    document.getElementById("currentPassword")?.value || "";
  const newPassword = document.getElementById("newPassword")?.value || "";
  const confirmPassword =
    document.getElementById("confirmNewPassword")?.value || "";

  if (!user?.id) {
    window.location.href = "login.html";
    return;
  }

  if (!currentPassword || !newPassword || !confirmPassword) {
    setChangePasswordStatus(
      "Fill in the current password and the new password fields.",
      true,
    );
    return;
  }

  if (newPassword !== confirmPassword) {
    setChangePasswordStatus(
      "The new password confirmation does not match.",
      true,
    );
    return;
  }

  const changePwdErr = getPasswordPolicyError(newPassword);
  if (changePwdErr) {
    setChangePasswordStatus(changePwdErr, true);
    return;
  }

  try {
    if (submitBtn) submitBtn.disabled = true;
    setChangePasswordStatus("Saving your new password...", false);

    const response = await fetch(
      `${API_BASE}/users/${user.id}/change-password`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          userId: user.id,
        },
        body: new URLSearchParams({
          currentPassword,
          newPassword,
        }).toString(),
      },
    );

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    const updatedUser = await response.json();
    sessionStorage.setItem("authUser", JSON.stringify(updatedUser));
    setChangePasswordStatus(
      "Password changed successfully. Redirecting to settings...",
      false,
    );
    setTimeout(() => {
      window.location.href = "settings.html";
    }, 1200);
  } catch (error) {
    setChangePasswordStatus(
      error.message || "Could not change your password.",
      true,
    );
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function deleteCurrentAccount() {
  const user = getAuthUser();
  if (!user?.id) {
    alert("Please login first.");
    window.location.href = "login.html";
    return;
  }

  const confirmation = prompt(
    "Type DELETE to permanently remove your account.",
  );
  if (confirmation !== "DELETE") {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/users/${user.id}`, {
      method: "DELETE",
      headers: {
        userId: user.id,
      },
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    sessionStorage.removeItem("authUser");
    clearPendingLoginVerification();
    clearPendingPasswordReset();
    alert("Your account has been deleted.");
    window.location.href = "login.html";
  } catch (error) {
    showToast('error','Delete failed', error.message || 'Could not delete the account.');
  }
}

document.addEventListener("DOMContentLoaded", function () {
  initializeForgotPasswordPage();
  initializeChangePasswordPage();
});

async function removeProfilePhoto() {
  if (confirm("Are you sure you want to remove your profile photo?")) {
    const removed = await removeStoredProfileField("image");
    if (!removed) return;

    revokeProfilePageBlobUrls();
    revokeNavAvatarBlobUrl();

    const profileImage = document.getElementById("profileImage");
    const navAvatar = document.getElementById("navUserAvatar");

    if (profileImage) profileImage.src = "images/default.png";
    if (navAvatar) navAvatar.src = "images/default.png";

    showToast('success','Done','Profile photo removed.');
  }
}

async function removeCoverPhoto() {
  if (confirm("Are you sure you want to remove your cover photo?")) {
    const removed = await removeStoredProfileField("cover");
    if (!removed) return;

    revokeProfilePageBlobUrls();

    const cover = document.getElementById("cover");
    if (cover) cover.style.backgroundImage = "none";

    void refreshProfilePageMedia();

    alert("Cover photo removed.");
  }
}

//من هنا هضيف حبت حاجات بعد ما انتوا خلاص خلصتوا الباك

document.addEventListener("DOMContentLoaded", () => {
  const backToTop = document.getElementById("backToTop");
  if (!backToTop) return;

  window.addEventListener("scroll", () => {
    if (window.pageYOffset > 500) {
      backToTop.classList.add("active");
    } else {
      backToTop.classList.remove("active");
    }
  });

  backToTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
});

//our work section in the home
const filterButtons = document.querySelectorAll(".filter-btn");
const workItems = document.querySelectorAll(".work-item");

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    const filterValue = button.getAttribute("data-filter");

    workItems.forEach((item) => {
      if (
        filterValue === "all" ||
        item.getAttribute("data-category") === filterValue
      ) {
        item.style.display = "block";
        setTimeout(() => (item.style.opacity = "1"), 10);
      } else {
        item.style.opacity = "0";
        setTimeout(() => (item.style.display = "none"), 400);
      }
    });
  });
});

//fun facts
const counters = document.querySelectorAll(".counter");

const runCounter = () => {
  counters.forEach((counter) => {
    const updateCount = () => {
      const target = +counter.getAttribute("data-target");
      const count = +counter.innerText;
      const speed = 200;
      const inc = target / speed;

      if (count < target) {
        counter.innerText = Math.ceil(count + inc);
        setTimeout(updateCount, 15);
      } else {
        counter.innerText = target.toLocaleString();
      }
    };
    updateCount();
  });
};

const observer = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting) {
      runCounter();
      observer.disconnect();
    }
  },
  { threshold: 0.5 },
);

const factsPremiumSection = document.querySelector(".facts-premium-section");
if (factsPremiumSection) {
  observer.observe(factsPremiumSection);
}

//contact US

var form = document.querySelector(".pro-form");

async function handleSubmit(event) {
  event.preventDefault();
  var status = document.createElement("p");
  status.style.marginTop = "10px";
  status.style.fontWeight = "bold";

  var data = new FormData(event.target);

  fetch(event.target.action, {
    method: form.method,
    body: data,
    headers: {
      Accept: "application/json",
    },
  })
    .then((response) => {
      if (response.ok) {
        status.innerHTML = "Thanks! Your message has been sent successfully.";
        status.style.color = "#fdbd41";
        form.reset();
        form.appendChild(status);
      } else {
        response.json().then((data) => {
          if (Object.hasOwn(data, "errors")) {
            status.innerHTML = data["errors"]
              .map((error) => error["message"])
              .join(", ");
          } else {
            status.innerHTML = "Oops! There was a problem submitting your form";
          }
          status.style.color = "red";
          form.appendChild(status);
        });
      }
    })
    .catch((error) => {
      status.innerHTML = "Oops! There was a problem submitting your form";
      status.style.color = "red";
      form.appendChild(status);
    });
}

form.addEventListener("submit", handleSubmit);

//settings in the room tab

function toggleSettingsMenu() {
  const menu = document.getElementById("settingsMenu");
  if (menu) {
    const isVisible = menu.style.display === "block";
    menu.style.display = isVisible ? "none" : "block";
  }
}

function applyBackground(imgSource) {
  const chatBox = document.getElementById("chatBox");
  if (chatBox) {
    chatBox.style.backgroundImage = `url('${imgSource}')`;
    chatBox.style.backgroundSize = "cover";
    chatBox.style.backgroundPosition = "center";
    chatBox.style.backgroundRepeat = "no-repeat";
  }
}

async function loadChatSettings() {
  if (currentRoom !== null && rooms[currentRoom]) {
    const roomId = rooms[currentRoom].id;
    const state = await loadUserChatState();
    const savedBg = state.chatBackgrounds?.[String(roomId)];

    if (savedBg) {
      applyBackground(savedBg);
    } else {
      applyBackground("images/three.jpg");
    }
  }
}

function applyAndSaveBg() {
  const bgInput = document.getElementById("bgUrlInput");
  const url = bgInput.value.trim();

  if (currentRoom === null || !rooms[currentRoom]) {
    showToast('warning','No room','Please select a room first!');
    return;
  }

  if (url === "") {
    showToast('warning','Invalid URL','Please paste a valid image URL.');
    return;
  }

  const roomId = rooms[currentRoom].id;
  applyBackground(url);
  updateUserChatState((draft) => {
    draft.chatBackgrounds[String(roomId)] = url;
  }).catch((error) => {
    console.error("Could not save chat background:", error);
    showToast('error','Failed','Could not save room background.');
  });

  toggleSettingsMenu();
  bgInput.value = "";
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast('warning','Wrong file type','Please select an image file.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const base64Image = e.target.result;

    if (currentRoom !== null && rooms[currentRoom]) {
      const roomId = rooms[currentRoom].id;
      applyBackground(base64Image);
      updateUserChatState((draft) => {
        draft.chatBackgrounds[String(roomId)] = base64Image;
      }).catch((error) => {
        console.error("Could not save chat background image:", error);
        alert("Could not save room background image.");
      });
    }
    toggleSettingsMenu();
  };
  reader.readAsDataURL(file);
}

function resetDefaultBg() {
  if (currentRoom !== null && rooms[currentRoom]) {
    const roomId = rooms[currentRoom].id;
    updateUserChatState((draft) => {
      delete draft.chatBackgrounds[String(roomId)];
    })
      .then(() => {
        loadChatSettings();
        showToast('success','Reset','Restored to default background.');
        toggleSettingsMenu();
      })
      .catch((error) => {
        console.error("Could not reset chat background:", error);
        showToast('error','Failed','Could not reset room background.');
      });
  }
}

window.addEventListener("click", function (e) {
  const wrapper = document.querySelector(".settings-wrapper");
  const menu = document.getElementById("settingsMenu");
  if (wrapper && !wrapper.contains(e.target)) {
    if (menu) menu.style.display = "none";
  }
});

// // AI CHATBOT SECTION

(function () {
  const launcher = document.getElementById("socum-ai-launcher");
  const windowEl = document.getElementById("socum-ai-window");
  const closeBtn = document.getElementById("socum-close-chat");
  const chatBody = document.getElementById("socum-chat-body");
  const inputField = document.getElementById("socum-chat-input");
  const sendBtn = document.getElementById("socum-send-btn");

  let history = [];

  function addMsg(role, text) {
    if (!chatBody) return;
    const div = document.createElement("div");
    div.className = `socum-msg ${role === "user" ? "socum-user" : "socum-bot"}`;
    div.textContent = text;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  async function init() {
    const state = await loadUserChatState();
    history = Array.isArray(state.aiHistory) ? state.aiHistory : [];
    chatBody.innerHTML =
      '<div class="socum-msg socum-bot">أهلاً بك! أنا مساعد Socum الذكي، كيف يمكنني خدمتك اليوم؟</div>';
    history.forEach((m) => addMsg(m.role, m.text));
  }

  if (launcher)
    launcher.onclick = () => windowEl.classList.toggle("socum-hidden");
  if (closeBtn) closeBtn.onclick = () => windowEl.classList.add("socum-hidden");

  async function handleSend() {
    const val = inputField.value.trim();
    if (!val) return;

    addMsg("user", val);
    inputField.value = "";

    addMsg("bot", "Thinking...");
    const lastMsg = chatBody.lastElementChild;

    try {
      const authUser = getAuthUser();
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: val, userId: authUser?.id ?? null }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        lastMsg.textContent = `خطأ من السيرفر (${res.status}): ${errorText}`;
        return;
      }

      const data = await res.json();

      if (data.reply) {
        const answer = data.reply;
        lastMsg.textContent = answer;

        history.push({ role: "user", text: val });
        history.push({ role: "bot", text: answer });
        updateUserChatState((draft) => {
          draft.aiHistory = history.slice(-50);
        }).catch((error) => {
          console.error("Could not save AI chat history:", error);
        });
      } else {
        lastMsg.textContent = "السيرفر رد بشكل غير متوقع.";
      }
    } catch (e) {
      lastMsg.textContent = "لا يمكن الوصول لسيرفر الـ Backend. تأكد أنه يعمل.";
      console.error(e);
    }
  }

  if (sendBtn) sendBtn.onclick = handleSend;
  if (inputField)
    inputField.onkeypress = (e) => {
      if (e.key === "Enter") handleSend();
    };

  init();
})();

//الاذان هنا يا اخواتيييي و جزء الصلوات كلوا

document.addEventListener("DOMContentLoaded", () => {
  const prayerBtn = document.getElementById("prayerBtn");
  const prayerTab = document.getElementById("prayerTab");
  const audio = document.getElementById("prayerAudio");
  const alertBox = document.getElementById("customPrayerAlert");
  const closeAlertBtn = document.getElementById("closeAlertBtn");

  let lastTriggeredPrayer = "";

  if (Notification.permission !== "granted") Notification.requestPermission();

  prayerBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    prayerTab.classList.toggle("active");
  });

  closeAlertBtn.addEventListener("click", () => {
    alertBox.classList.remove("show");
    audio.pause();
    audio.currentTime = 0;
  });

  function format12Hour(time24) {
    if (!time24) return "--:--";
    let [hours, minutes] = time24.split(":");
    hours = parseInt(hours);
    const modifier = hours >= 12 ? "م" : "ص";
    hours = hours % 12 || 12;
    return `${hours.toString().padStart(2, "0")}:${minutes} ${modifier}`;
  }

  async function getPrayerTimes() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          fetchData(
            `https://api.aladhan.com/v1/timings?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&method=1`,
          );
        },
        async () => {
          fetchData(
            "https://api.aladhan.com/v1/timingsByCity?city=Giza&country=Egypt&method=1",
          );
        },
      );
    } else {
      fetchData(
        "https://api.aladhan.com/v1/timingsByCity?city=Giza&country=Egypt&method=1",
      );
    }
  }

  async function fetchData(url) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      updateUI(data.data);
    } catch (err) {
      console.error("Error", err);
    }
  }

  function updateUI(data) {
    const timings = data.timings;
    document.getElementById("hijriDay").innerText = data.date.hijri.day;
    document.getElementById("hijriMonth").innerText = data.date.hijri.month.ar;

    const prayerMap = {
      Fajr: "الفجر",
      Sunrise: "الشروق",
      Dhuhr: "الظهر",
      Asr: "العصر",
      Maghrib: "المغرب",
      Isha: "العشاء",
    };
    Object.keys(prayerMap).forEach((key) => {
      const el = document.getElementById(`time-${key}`);
      if (el) el.innerText = format12Hour(timings[key]);
    });
    startCountdown(timings);
  }

  function startCountdown(timings) {
    const prayers = [
      { id: "Fajr", name: "الفجر", time: timings.Fajr },
      { id: "Sunrise", name: "الشروق", time: timings.Sunrise },
      { id: "Dhuhr", name: "الظهر", time: timings.Dhuhr },
      { id: "Asr", name: "العصر", time: timings.Asr },
      { id: "Maghrib", name: "المغرب", time: timings.Maghrib },
      { id: "Isha", name: "العشاء", time: timings.Isha },
    ];

    setInterval(() => {
      const now = new Date();
      const currentTimeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      let next = null;

      for (let p of prayers) {
        const [h, m] = p.time.split(":");
        const pDate = new Date();
        pDate.setHours(h, m, 0);
        if (pDate > now) {
          next = { ...p, date: pDate };
          break;
        }
      }

      if (!next) {
        const [h, m] = prayers[0].time.split(":");
        const pDate = new Date();
        pDate.setDate(pDate.getDate() + 1);
        pDate.setHours(h, m, 0);
        next = { ...prayers[0], date: pDate };
      }

      document.getElementById("nextPrayerName").innerText = next.name;
      document.getElementById("nextPrayerTime").innerText = format12Hour(
        next.time,
      );

      const diff = next.date - now;
      const h = Math.floor(diff / 3600000)
        .toString()
        .padStart(2, "0");
      const m = Math.floor((diff % 3600000) / 60000)
        .toString()
        .padStart(2, "0");
      const s = Math.floor((diff % 60000) / 1000)
        .toString()
        .padStart(2, "0");
      document.getElementById("nextPrayerTimeLeft").innerText =
        `${h}:${m}:${s}`;

      document
        .querySelectorAll(".p-item")
        .forEach((el) => el.classList.remove("active"));
      document.getElementById(`item-${next.id}`)?.classList.add("active");

      prayers.forEach((p) => {
        if (currentTimeStr === p.time && lastTriggeredPrayer !== p.id) {
          lastTriggeredPrayer = p.id;

          document.getElementById("alertPrayerNameAr").innerText =
            (p.id === "Sunrise" ? "وقت " : "أذان ") + p.name;
          alertBox.classList.add("show");
          console.log("التنبيه يعمل الآن لـ: " + p.name);

          if (p.id !== "Sunrise") {
            audio.play().catch((e) => console.log("test"));
          }
        }
      });

      if (now.getSeconds() === 0) {
        if (now.getHours() === 0 && now.getMinutes() === 0) getPrayerTimes();
      }
    }, 1000);
  }

  getPrayerTimes();
});

// youssef wael was here

/**
 * populateStunningProfileData
 * Maps user, task, and room data to the redesigned Profile UI.
 */
// the data in the profile ui

function populateStunningProfileData() {
  const user = getAuthUser();
  if (!user) return;

  const elId = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  // role and staff id are now dynamic
  elId(
    "introRole",
    user.role
      ? user.role.charAt(0).toUpperCase() +
          user.role.slice(1).toLowerCase().replace("_", " ")
      : "Developer",
  );
  elId("introStaffId", "Staff ID: " + (user.staffId || "N/A"));
  elId("displayEmail", user.email || "");

  // fill name/email inputs
  const nameInp = document.getElementById("nameInput");
  const emailInp = document.getElementById("emailInput");
  if (nameInp) nameInp.value = user.name || "";
  if (emailInp) emailInp.value = user.email || "";

  // staff id read-only field
  const staffEl = document.getElementById("staffIdDisplay");
  if (staffEl) staffEl.value = user.staffId || "";

  // metrics
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  elId("completedTasksCount", completedTasks);
  if (tasks.length > 0) {
    elId(
      "activityScore",
      Math.round((completedTasks / tasks.length) * 100) + "%",
    );
  }
  elId("teamRoomsCount", rooms.length);

  // social links — load from localStorage
  loadSocialLinks();
}

function loadSocialLinks() {
  renderProfileSocialLinks({});
}

function renderProfileSocialLinks(links = {}) {
  const safeLinks = links || {};

  const github = document.getElementById("linkGithub");
  const twitter = document.getElementById("linkTwitter");
  const linkedin = document.getElementById("linkLinkedin");

  if (github) {
    github.href = safeLinks.github || "#";
    github.target = safeLinks.github ? "_blank" : "_self";
    github.rel = "noopener noreferrer";
    github.style.opacity = safeLinks.github ? "1" : "0.5";
  }
  if (twitter) {
    twitter.href = safeLinks.twitter || "#";
    twitter.target = safeLinks.twitter ? "_blank" : "_self";
    twitter.rel = "noopener noreferrer";
    twitter.style.opacity = safeLinks.twitter ? "1" : "0.5";
  }
  if (linkedin) {
    linkedin.href = safeLinks.linkedin || "#";
    linkedin.target = safeLinks.linkedin ? "_blank" : "_self";
    linkedin.rel = "noopener noreferrer";
    linkedin.style.opacity = safeLinks.linkedin ? "1" : "0.5";
  }

  const gi = document.getElementById("linkGithubInput");
  const ti = document.getElementById("linkTwitterInput");
  const li = document.getElementById("linkLinkedinInput");
  if (gi) gi.value = safeLinks.github || "";
  if (ti) ti.value = safeLinks.twitter || "";
  if (li) li.value = safeLinks.linkedin || "";
}

function saveSocialLinks() {
  return saveProfileExtended();
}

function ensureHttps(url) {
  if (!url) return "";
  url = url.trim();
  if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
    return "https://" + url;
  }
  return url;
}

// youssef wael was here

// ============================================================
// PROFILE EXTENDED — bio, skills, experience
// ============================================================

/*
    loadProfileExtended()
    Fetches /api/users/{id}/profile-extended from the backend,
    then populates:
      - About tab display elements (bio, skills, experience)
      - Edit tab input fields (so the user sees their current values)
*/
// ADDS to owhat load profile does using same logic

async function loadProfileExtended() {
  const user = getAuthUser();
  if (!user?.id) return;

  try {
    const response = await fetch(
      `${API_BASE}/users/${user.id}/profile-extended?ts=${Date.now()}`,
      {
        cache: "no-store",
        headers: { userId: user.id },
      },
    );

    if (!response.ok) return;

    const data = await response.json();

    // -- bio --
    const bioEl = document.getElementById("profileBio");
    if (bioEl) bioEl.textContent = data.bio || "—";

    // -- skills --
    const skillsWrap = document.getElementById("profileSkillsDisplay");
    if (skillsWrap) {
      skillsWrap.innerHTML = data.skills?.length
        ? data.skills
            .map((s) => `<span class="skill-pill">${s.trim()}</span>`)
            .join("")
        : `<span style="opacity:0.5;font-size:13px;">No skills added yet.</span>`;
    }

    // -- experience --
    const expList = document.getElementById("profileExpDisplay");
    if (expList) {
      expList.innerHTML = data.experiences?.length
        ? data.experiences
            .map(
              (e) => `
                    <div class="exp-entry">
                        <div class="exp-dot"></div>
                        <div>
                            <strong>${e.role || ""}</strong>
                            <span>${e.years || ""}</span>
                        </div>
                    </div>`,
            )
            .join("")
        : `<span style="opacity:0.5;font-size:13px;">No experience added yet.</span>`;
    }

    // -- pre-fill edit inputs --
    const bioInput = document.getElementById("bioInput");
    if (bioInput) bioInput.value = data.bio || "";

    const skillsInput = document.getElementById("skillsInput");
    if (skillsInput) skillsInput.value = (data.skills || []).join(", ");

    const exp = data.experiences || [];
    ["exp1", "exp2", "exp3"].forEach((prefix, i) => {
      const roleEl = document.getElementById(`${prefix}Role`);
      const yearsEl = document.getElementById(`${prefix}Years`);
      if (roleEl) roleEl.value = exp[i]?.role || "";
      if (yearsEl) yearsEl.value = exp[i]?.years || "";
    });

    // -- social links --
    const links = data.socialLinks || {};

    renderProfileSocialLinks(links);
  } catch (err) {
    console.error("loadProfileExtended error:", err);
  }
}

/*
    saveProfileExtended()
    Reads bio, skills, and up to 3 experience entries from the Edit tab,
    then PUTs them to /api/users/{id}/profile-extended.
    On success it re-renders the About tab live without a page reload.
*/
// ADDS to what save profile does using same logic

async function saveProfileExtended() {
  const user = getAuthUser();
  if (!user?.id) {
    alert("Please login first.");
    return;
  }

  const bio = document.getElementById("bioInput")?.value.trim() || "";

  const skillsRaw = document.getElementById("skillsInput")?.value || "";
  const skills = skillsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const experiences = ["exp1", "exp2", "exp3"]
    .map((prefix) => ({
      role: document.getElementById(`${prefix}Role`)?.value.trim() || "",
      years: document.getElementById(`${prefix}Years`)?.value.trim() || "",
    }))
    .filter((e) => e.role);

  const socialLinks = {
    github:
      ensureHttps(document.getElementById("linkGithubInput")?.value) || "",
    twitter:
      ensureHttps(document.getElementById("linkTwitterInput")?.value) || "",
    linkedin:
      ensureHttps(document.getElementById("linkLinkedinInput")?.value) || "",
  };

  const payload = { bio, skills, experiences, socialLinks };

  try {
    const response = await fetch(
      `${API_BASE}/users/${user.id}/profile-extended`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          userId: user.id,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      showToast('error','Remove failed', await response.text());
      return;
    }

    await loadProfileExtended();
    showToast('success','Saved!','Your About Me has been saved.');
  } catch (err) {
    showToast('error','Save failed','Could not save. Make sure the server is running.');
    console.error(err);
  }
}

// end of profile page
// notafictions posts

document.addEventListener("DOMContentLoaded", () => {
  if (
    !document.getElementById("profileBio") &&
    !document.getElementById("bioInput")
  )
    return;//t
  populateStunningProfileData();
  loadProfileExtended();
});
