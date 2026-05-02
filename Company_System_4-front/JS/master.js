// ثوابت وhelpers أساسية — لازم تكون فوق كل حاجة
const API_BASE = "http://localhost:8080/api";
function getAuthUser() {
    return JSON.parse(sessionStorage.getItem("authUser"));
}

// بداية الداتا
// تحميل الداتا
let tasks = [];
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
async function addTask() {
    const user = getAuthUser();
    const title = document.getElementById("taskTitle").value;
    const description = document.getElementById("taskDesc")?.value || "";
    const assignedToStaffId = document.getElementById("taskAssigneeStaffId")?.value || "";
    const deadline = document.getElementById("taskDeadline")?.value || "";

    if (!assignedToStaffId) {
        alert("Assigned Staff ID is required.");
        return;
    }

    if (!deadline) {
        alert("Task deadline is required.");
        return;
    }

    const taskData = {
        title: title,
        description: description,
        deadline: deadline,
        status: "pending",
        assignedToStaffId: assignedToStaffId.trim()
    };

    const response = await fetch(`${API_BASE}/tasks/create`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'userId': user.id // بنبعت الـ userId عشان الباك اند يعرف مين اللي بعت
        },
        body: JSON.stringify(taskData)
    });

    if (response.ok) {
        const savedTask = await response.json();
        tasks.push(savedTask);
        renderTasks();
        updateDashboard();
        alert("Task saved in Database!");
    } else {
        alert(await response.text());
    }
}

async function loadTasksFromServer() {
    const user = getAuthUser();
    if (!user?.id) return;

    const response = await fetch(`${API_BASE}/tasks`, {
        headers: { "userId": user.id }
    });
    if (!response.ok) return;
    tasks = await response.json();
    renderTasks();
    updateDashboard();
}

async function toggleTask(i) {
    const user = getAuthUser();
    const task = tasks[i];
    if (!user?.id || !task?.id) return;

    const nextStatus = task.status === "completed" ? "pending" : "completed";
    const response = await fetch(`${API_BASE}/tasks/${task.id}/status?status=${encodeURIComponent(nextStatus)}`, {
        method: "PATCH",
        headers: { "userId": user.id }
    });

    if (response.ok) {
        tasks[i] = await response.json();
        renderTasks();
        updateDashboard();
    }
}

async function deleteTask(i) {
    const user = getAuthUser();
    const task = tasks[i];
    if (!user?.id || !task?.id) return;

    const response = await fetch(`${API_BASE}/tasks/${task.id}`, {
        method: "DELETE",
        headers: { "userId": user.id }
    });

    if (response.ok) {
        tasks.splice(i, 1);
        renderTasks();
        updateDashboard();
    }
}

function renderTasks() {
    const list = document.getElementById("taskList");
    if (!list) return;
    list.innerHTML = "";

    const user = getAuthUser();
    const role = user?.role?.toUpperCase();
    const isManager    = role === "MANAGER";
    const isTeamLeader = role === "TEAM_LEADER";
    const isDeveloper  = role === "DEVELOPER";

    if (!tasks.length) {
        list.innerHTML = "<li style='color:#aaa;padding:10px 0'>No tasks yet.</li>";
        return;
    }

    tasks.forEach((t, i) => {
        const li = document.createElement("li");
        li.className = "task-item" + (t.status === "completed" ? " done" : "");

        const deadlineStr = t.deadline
            ? "Deadline: " + new Date(t.deadline).toLocaleString()
            : "";

        const assignedByName = t.assignedBy?.name || "";
        const assignedToName = t.assignedTo?.name || "";

        const statusBadge = `<span style="font-size:11px;padding:2px 8px;border-radius:20px;margin-top:4px;display:inline-block;
            background:${t.status==="completed"?"#e8f5e9":t.status==="in_progress"?"#e3f2fd":"#fff3e0"};
            color:${t.status==="completed"?"#2e7d32":t.status==="in_progress"?"#1565c0":"#e65100"}">
            ${t.status || "pending"}</span>`;

        let actionsHtml = "";

        if (isDeveloper) {
            const checked = t.status === "completed" ? "checked" : "";
            actionsHtml = `<div style="display:flex;align-items:center;gap:6px;margin-top:6px">
                <input type="checkbox" id="task-chk-${i}" ${checked}
                    onchange="markTaskComplete(${i}, this.checked)"
                    style="width:16px;height:16px;cursor:pointer;accent-color:#4caf50">
                <label for="task-chk-${i}" style="font-size:13px;cursor:pointer">Mark complete</label>
            </div>`;
        } else if (isTeamLeader) {
            // Use == (not ===) because user.id from sessionStorage may be string while task id is number
            const isAssignedToMe = t.assignedTo?.id == user.id;
            const iSentThis      = t.assignedBy?.id == user.id;
            const checked = t.status === "completed" ? "checked" : "";
            actionsHtml = `<div class="task-actions">`;
            if (isAssignedToMe) {
                actionsHtml += `<div style="display:flex;align-items:center;gap:6px;margin-top:6px">
                    <input type="checkbox" id="task-chk-${i}" ${checked}
                        onchange="markTaskComplete(${i}, this.checked)"
                        style="width:16px;height:16px;cursor:pointer;accent-color:#4caf50">
                    <label for="task-chk-${i}" style="font-size:13px;cursor:pointer">Mark complete</label>
                </div>`;
            }
            if (iSentThis) {
                actionsHtml += `<button onclick="deleteTask(${i})" class="remove-btn">Delete</button>`;
            }
            actionsHtml += `</div>`;
        } else if (isManager) {
            actionsHtml = `<div class="task-actions">
                <button onclick="deleteTask(${i})" class="remove-btn">Delete</button>
            </div>`;
        }

        li.innerHTML = `
            <div style="flex:1">
                <h3>${t.title}</h3>
                <p style="margin:0 0 4px;font-size:13px;color:#666">${t.description || ""}</p>
                ${statusBadge}
                <div style="font-size:11px;color:#aaa;margin-top:3px">
                    ${assignedByName ? "From: <b>" + assignedByName + "</b>" : ""}
                    ${assignedToName ? " &rarr; To: <b>" + assignedToName + "</b>" : ""}
                </div>
                <small style="font-size:12px;color:#999">${deadlineStr}</small>
            </div>
            ${actionsHtml}
        `;

        list.appendChild(li);
    });
}

// Developer / TeamLeader marks task as complete via checkbox
async function markTaskComplete(i, isChecked) {
    const user = getAuthUser();
    const task = tasks[i];
    if (!user?.id || !task?.id) return;

    const newStatus = isChecked ? "completed" : "pending";
    const response = await fetch(`${API_BASE}/tasks/${task.id}/status?status=${encodeURIComponent(newStatus)}`, {
        method: "PATCH",
        headers: { "userId": user.id }
    });

    if (response.ok) {
        tasks[i] = await response.json();
        renderTasks();
        updateDashboard();
    } else {
        alert(await response.text());
        // revert checkbox
        const chk = document.getElementById("task-chk-" + i);
        if (chk) chk.checked = !isChecked;
    }
}


// جزء الموظفين
async function loadEmployeeSummary() {
    const totalEmployees = document.getElementById("totalEmployees");
    if (!totalEmployees) return;
    const response = await fetch(`${API_BASE}/users/employees/summary`);
    if (!response.ok) return;
    const summary = await response.json();
    employees = Array.from({ length: summary.developerCount || 0 });
    totalEmployees.innerText = summary.developerCount || 0;
}

async function loadEmployeesFromServer() {
    const user = getAuthUser();
    const box = document.getElementById("empList");
    if (!box || !user?.id) return;

    const response = await fetch(`${API_BASE}/users/employees`, {
        headers: { "userId": user.id }
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
        headers: { "userId": user.id }
    });

    if (!response.ok) {
        alert(await response.text());
        return;
    }

    await loadEmployeesFromServer();
    await loadEmployeeSummary();
}

async function promoteToTeamLeader(i) {
    const user = getAuthUser();
    const employee = employees[i];
    if (!user?.id || !employee?.id) return;

    const response = await fetch(`${API_BASE}/users/employees/${employee.id}/promote-team-leader`, {
        method: "PUT",
        headers: { "userId": user.id }
    });

    if (!response.ok) {
        alert(await response.text());
        return;
    }

    const updatedEmployee = await response.json();

    // If the promoted employee is the currently logged-in user,
    // update sessionStorage with the NEW role AND NEW staffId from the server response
    if (employee.id === user.id) {
        const updatedUser = {
            ...user,
            role: updatedEmployee.role || "TEAM_LEADER",
            staffId: updatedEmployee.staffId || user.staffId
        };
        sessionStorage.setItem("authUser", JSON.stringify(updatedUser));
        applyTaskRoleControls();  // show task input form immediately
        alert("You have been promoted to Team Leader!\nYour new Staff ID has been sent to your email: " + updatedEmployee.staffId);
    } else {
        alert(employee.name + " has been promoted to Team Leader. A new Staff ID has been sent to their email.");
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
    const t = document.getElementById("totalTasks");
    const e = document.getElementById("totalEmployees");
    const c = document.getElementById("completedTasks");
    const employeeStat = document.getElementById("employeesStat");
    const user = getAuthUser();
    const canManageEmployees = user?.role?.toUpperCase() === "MANAGER";

    if (t) t.innerText = tasks.length;
    if (e) e.innerText = employees.length;
    if (c) c.innerText = tasks.filter(x => x.status === "completed").length;
    if (employeeStat) {
        employeeStat.style.cursor = canManageEmployees ? "pointer" : "default";
        employeeStat.title = canManageEmployees ? "Manage employees" : "";
        employeeStat.onclick = canManageEmployees ? () => window.location.href = "employees.html" : null;
    }
}


// بداية جزء الرومات
// بنعمل الروم من الباك اند الأول عشان تاخد id حقيقي
async function addRoom() {
    const user = getAuthUser();
    if (!user || user.role?.toUpperCase() !== "MANAGER") {
        alert("Only managers can create rooms.");
        return;
    }
    let name = prompt("Room name?");
    if (!name?.trim()) return;

    const roomName = name.trim();

    if (user?.id) {
        try {
            const response = await fetch(`${API_BASE}/rooms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'userId': user.id
                },
                body: JSON.stringify({
                    name: roomName,
                    type: 'CHAT'
                })
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
                messages: []
            });

            saveAll();
            renderRooms();
            return;
        } catch (error) {
            alert(error.message || "Could not create room on server.");
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
            renderMessages();
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
                headers: { "userId": user.id }
            });

            if (!response.ok) {
                alert(await response.text());
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
            renderMessages();
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
    renderMessages();
    updateRoomInfo();
    loadRoomMembers();

    if (typeof connect === "function" && rooms[i].id) {
        connect(rooms[i].id);
    }
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
function sendMessage() {
    const input = document.getElementById("msgInput");
    const user = getAuthUser();
    const room = rooms[currentRoom];

    if (!input?.value.trim()) return;
    if (currentRoom === null) return;
    if (!room) return;

    const content = input.value.trim();

    if (room.id && user?.id && typeof stompClient !== "undefined" && stompClient?.connected) {
        stompClient.send("/app/chat.sendMessage", {}, JSON.stringify({
            content: content,
            senderName: user.name,
            senderId: user.id,
            roomId: room.id,
            type: "CHAT"
        }));

        input.value = "";
        return;
    }

    alert("Chat is not connected to the database yet. Please reopen the room and try again.");
}

function renderMessages() {
    const box = document.getElementById("chatBox");
    if (!box) return;

    box.innerHTML = "";

    if (currentRoom === null) return;

    rooms[currentRoom].messages.forEach(m => {
        const div = document.createElement("div");
        div.className = "message";

        let content = "";

        if (m.type === "text") {
            const senderLabel = m.senderName ? `<div class="msg-sender">${m.senderName}</div>` : "";
            content = `${senderLabel}<div class="msg-text">${m.data}</div>`;
        }

        else if (m.type === "image") {
            content = `<img src="${m.data}" style="max-width:200px;border-radius:10px;">`;
        }

        else if (m.type === "video") {
            content = `<video src="${m.data}" controls style="max-width:200px;border-radius:10px;"></video>`;
        }

       else if (m.type === "audio") {

    content = `
    <div class="vm-msg">

        <button class="vm-play">▶</button>

        <audio src="${m.data}"></audio>

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
}

        else if (m.type === "file") {
            content = `<a href="${m.data}" download="${m.name}"> ${m.name}</a>`;
        }

        div.innerHTML = `
            ${content}
            <div class="msg-time">${m.time || ""}</div>
        `;

        box.appendChild(div);
    });

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
                'userId': user.id
            }
        });

        if (!response.ok) {
            throw new Error("Failed to load old messages");
        }

        const serverMessages = await response.json();
        room.messages = serverMessages.map(message => ({
            type: "text",
            data: message.content,
            senderName: message.senderName || "Unknown",
            time: message.time || ""
        }));

        const fileResponse = await fetch(`${API_BASE}/files/room/${room.id}`, {
            headers: {
                'userId': user.id
            }
        });

        if (fileResponse.ok) {
            const serverFiles = await fileResponse.json();
            serverFiles.forEach(file => {
                const fileUrl = `${API_BASE}/files/${file.id}/download`;
                if (file.fileType?.startsWith("image/")) {
                    room.messages.push({ type: "image", data: fileUrl, time: "" });
                } else if (file.fileType?.startsWith("video/")) {
                    room.messages.push({ type: "video", data: fileUrl, time: "" });
                } else if (file.fileType?.startsWith("audio/")) {
                    room.messages.push({ type: "audio", data: fileUrl, time: "" });
                } else {
                    room.messages.push({ type: "file", name: file.fileName, data: fileUrl, time: "" });
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

    members.forEach(member => {
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
                'userId': user.id
            }
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
        alert("Only managers can add members to a room.");
        return;
    }

    if (!room || !room.id) {
        alert("Please select a saved server room first.");
        return;
    }

    if (!user?.id) {
        alert("Please login first.");
        return;
    }

    const staffId = prompt("Enter member staff ID:");
    if (!staffId?.trim()) return;

    try {
        const response = await fetch(`${API_BASE}/rooms/${room.id}/members/by-staff/${encodeURIComponent(staffId.trim())}`, {
            method: 'POST',
            headers: {
                'userId': user.id
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Failed to add member");
        }

        const members = await response.json();
        renderMemberList(members);
    } catch (error) {
        alert(error.message || "Failed to add member");
    }
}

// حذف عضو من الروم عن طريق الـ API
async function removeMember(memberId) {
    const room = rooms[currentRoom];
    const user = getAuthUser();

    if (!user || user.role?.toUpperCase() !== "MANAGER") {
        alert("Only managers can remove members from a room.");
        return;
    }

    if (!room || !room.id || !user?.id) {
        alert("Room membership is only available for saved server rooms.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/rooms/${room.id}/members/${memberId}`, {
            method: 'DELETE',
            headers: {
                'userId': user.id
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Failed to remove member");
        }

        const members = await response.json();
        renderMemberList(members);
    } catch (error) {
        alert(error.message || "Failed to remove member");
    }
}

// تحميل رومات الباك اند أول ما الصفحة تفتح
async function loadRoomsFromServer() {
    const user = getAuthUser();
    if (!user?.id) return false;

    try {
        const response = await fetch(`${API_BASE}/rooms`, {
            headers: {
                'userId': user.id
            }
        });

        if (!response.ok) {
            throw new Error("Failed to load rooms");
        }

        const serverRooms = await response.json();
        rooms = serverRooms.map(room => ({
            id: room.id,
            name: room.name,
            type: room.type,
            active: room.active,
            messages: []
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
        alert("Only managers can clear the chat.");
        return;
    }

    if (!user?.id || !room?.id) return;
    if (!confirm("Clear this room chat from the database?")) return;

    const messageResponse = await fetch(`${API_BASE}/messages/room/${room.id}`, {
        method: "DELETE",
        headers: { "userId": user.id }
    });
    if (!messageResponse.ok) {
        alert(await messageResponse.text());
        return;
    }

    const fileResponse = await fetch(`${API_BASE}/files/room/${room.id}`, {
        method: "DELETE",
        headers: { "userId": user.id }
    });
    if (!fileResponse.ok) {
        alert(await fileResponse.text());
        return;
    }

    rooms[currentRoom].messages = [];
    renderMessages();
    updateRoomInfo();
}
// نهاية الرسايل




            // ========================================================================
            // ========================================================================
            // ========================================================================



// handler (الجزء اللي في الروم يا كريم لما بنرسل الفايلات و كدا يعني) Start
async function handleFile(e) {   
    const file = e.target.files[0];   
    if (!file || currentRoom === null) return;
    const user = getAuthUser();
    const room = rooms[currentRoom];
    if (!user?.id || !room?.id) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("roomId", room.id);
    const response = await fetch(`${API_BASE}/files/upload`, {
        method: "POST",
        headers: { "userId": user.id },
        body: formData
    });
    if (!response.ok) {
        alert(await response.text());
        e.target.value = "";
        return;
    }

    const savedFile = await response.json();
    const fileUrl = `${API_BASE}/files/${savedFile.id}/download`;
    let message;
    if (savedFile.fileType.startsWith("image/")) {
        message = { type: "image", data: fileUrl, time: getTime12h() };
    } else if (savedFile.fileType.startsWith("video/")) {
        message = { type: "video", data: fileUrl, time: getTime12h() };
    } else if (savedFile.fileType.startsWith("audio/")) {
        message = { type: "audio", data: fileUrl, time: getTime12h() };
    } else {
        message = { type: "file", name: savedFile.fileName, data: fileUrl, time: getTime12h() };
    }
    rooms[currentRoom].messages.push(message);
    renderMessages();
    updateRoomInfo();

    e.target.value = "";   
}

let zegoCallInstance = null;

// تشغيل مكالمة الفيديو من خلال الـ session اللي الباك اند بيرجعها
async function startCall() {
    const user = getAuthUser();
    const room = rooms[currentRoom];

    if (currentRoom === null || !room) {
        alert("Please select a room first");
        return;
    }

    if (!room.id) {
        alert("Please use a saved server room for video calls.");
        return;
    }

    if (!user?.id) {
        alert("Please login first.");
        return;
    }

    if (typeof ZegoUIKitPrebuilt === "undefined") {
        alert("Video call SDK failed to load.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/rooms/${room.id}/video-call-session`, {
            method: "POST",
            headers: {
                userId: user.id
            }
        });

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
            callSession.userName
        );

        zegoCallInstance = ZegoUIKitPrebuilt.create(kitToken);
        zegoCallInstance.joinRoom({
            container: root,
            sharedLinks: [{
                name: "Room call",
                url: window.location.href
            }],
            showPreJoinView: true,
            turnOnCameraWhenJoining: true,
            turnOnMicrophoneWhenJoining: true,
            showScreenSharingButton: false,
            scenario: {
                mode: ZegoUIKitPrebuilt.GroupCall
            },
            onLeaveRoom: () => {
                overlay.style.display = "none";
                root.innerHTML = "";
                zegoCallInstance = null;
            }
        });
    } catch (error) {
        alert(error.message || "Unable to start the video call");
    }
}



//دا مثلا الحتة بتاعت الساعة و كدا اللي بتظهر في الرسالة 
function getTime12h() {
    return new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}
// handler End

            // ========================================================================
            // ========================================================================
            // ========================================================================




// بداية الدارك مود
document.addEventListener("DOMContentLoaded", () => {

    const toggle = document.getElementById("darkToggle");

    if (toggle) {
        toggle.onchange = () => {
            if (toggle.checked) {
                document.documentElement.setAttribute("data-theme", "dark");
            } else {
                document.documentElement.removeAttribute("data-theme");
            }
        };
    }

    // سحب وتحريك زرار الدارك مود
    const widget = document.getElementById("themeWidget");

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
        });

        document.addEventListener("mousemove", (e) => {
            if (!isDragging) return;

            widget.style.left = (e.clientX - offsetX) + "px";
            widget.style.top = (e.clientY - offsetY) + "px";
        });

        document.addEventListener("mouseup", () => {
            if (!isDragging) return;

            isDragging = false;
        });
    }

    initApp();
});
// نهاية الدارك مود


            // ========================================================================
            // ========================================================================
            // ========================================================================


// بداية التهيئة
// بنجهز رومات السيرفر قبل ما نرسم الصفحة
async function initApp() {
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
}

function applyRoomRoleControls() {
    const user = getAuthUser();
    const canManageRooms = user?.role?.toUpperCase() === "MANAGER";
    document.querySelectorAll(".member-actions, .right .danger, .manager-only").forEach(element => {
        element.style.display = canManageRooms ? "" : "none";
    });
}

function applyTaskRoleControls() {
    const user = getAuthUser();
    const canCreateTasks = ["MANAGER", "TEAM_LEADER"].includes(user?.role?.toUpperCase());
    const taskInput = document.querySelector(".task-input");
    if (taskInput) {
        taskInput.style.display = canCreateTasks ? "" : "none";
    }
    // Re-render task list so action buttons reflect the new role immediately
    if (tasks.length) renderTasks();
}

async function initNotifications() {
    await loadNotifications();
    if (typeof SockJS === "undefined" || typeof Stomp === "undefined") return;
    const socket = new SockJS("http://localhost:8080/ws-office");
    const eventClient = Stomp.over(socket);
    eventClient.debug = null;
    eventClient.connect({}, () => {
        // Real-time task completion event
        eventClient.subscribe("/topic/events", (msg) => {
            const event = JSON.parse(msg.body);
            if (event.event === "task_completed_sound") {
                playTaskCompletedSound();
                loadNotifications();
                loadTasksFromServer(); // refresh task list so assigners see updated status
            }
        });

        // Personal WebSocket notifications (sent by backend to /queue/notifications)
        const user = getAuthUser();
        if (user?.email) {
            eventClient.subscribe("/user/" + user.email + "/queue/notifications", () => {
                loadNotifications();
            });
        }
    });
}

async function loadNotifications() {
    const user = getAuthUser();
    const list = document.getElementById("notificationList");
    if (!list || !user?.id) return;

    const response = await fetch(`${API_BASE}/notifications`, {
        headers: { "userId": user.id }
    });
    if (!response.ok) return;

    const notifications = await response.json();
    if (!notifications.length) {
        list.innerHTML = "<p style='color:#aaa'>No notifications yet.</p>";
        return;
    }

    const role = user?.role?.toUpperCase();

    // Sort: unread first, then by time descending
    notifications.sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    list.innerHTML = notifications.map(n => {
        const timeStr = n.createdAt
            ? new Date(n.createdAt).toLocaleString()
            : "";
        const unreadClass = n.read ? "" : " unread";
        const markBtn = n.read
            ? ""
            : `<button class="mark-read-btn" onclick="markNotifRead(${n.id})">✓ Read</button>`;

        return `<div class="notification-item${unreadClass}" id="notif-${n.id}">
            ${markBtn}
            <strong>${n.title}</strong>
            <p>${n.content}</p>
            <div class="notif-time">${timeStr}</div>
        </div>`;
    }).join("");
}

async function markNotifRead(notifId) {
    const user = getAuthUser();
    if (!user?.id) return;
    const response = await fetch(`${API_BASE}/notifications/${notifId}/read`, {
        method: "PATCH",
        headers: { "userId": user.id }
    });
    if (response.ok) {
        const el = document.getElementById("notif-" + notifId);
        if (el) {
            el.classList.remove("unread");
            const btn = el.querySelector(".mark-read-btn");
            if (btn) btn.remove();
        }
    }
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
    if (field === "image") return `${API_BASE}/users/${user.id}/profile-photo?ts=${Date.now()}`;
    if (field === "cover") return `${API_BASE}/users/${user.id}/cover-photo?ts=${Date.now()}`;

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
        headers: { "userId": user.id },
        body: formData
    });
    if (!response.ok) {
        alert(await response.text());
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
        headers: { "userId": user.id }
    });
    if (!response.ok) {
        alert(await response.text());
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

    if (displayName) 
    {
        displayName.innerText = getStoredProfileField("name", "Your Name");
        if(nameInput) nameInput.value = getStoredProfileField("name", "");
        if(emailInput) emailInput.value = getStoredProfileField("email", "");
    }

    if (profileImage) {
        profileImage.src = getStoredProfileField("image", profileImage.src);
    }

    const savedCover = getStoredProfileField("cover");
    if (cover && savedCover) {
        cover.style.backgroundImage = `url(${savedCover})`;
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

    
    if (imageInput) 
    {
        imageInput.onchange = async function () 
        {
            const file = this.files[0];
            if (!file) return;
            const savedUser = await uploadUserImage("profile-photo", file);
            if (savedUser && profileImage) {
                profileImage.src = getStoredProfileField("image", "images/default.png");
                sessionStorage.setItem("authUser", JSON.stringify(savedUser));
            }
        };
    }

    if (coverInput) 
    {
        coverInput.onchange = async function () 
        {
            const file = this.files[0];
            if (!file) return;
            const savedUser = await uploadUserImage("cover-photo", file);
            if (savedUser && cover) {
                cover.style.backgroundImage = `url(${getStoredProfileField("cover")})`;
                sessionStorage.setItem("authUser", JSON.stringify(savedUser));
            }
        };
    }

});



async function saveProfile() {

    const name = document.getElementById("nameInput").value;
    const email = document.getElementById("emailInput").value;
    const user = getAuthUser();
    if (!user?.id) {
        alert("Please login first.");
        return;
    }

    const response = await fetch(`${API_BASE}/users/${user.id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "userId": user.id
        },
        body: JSON.stringify({ name, email })
    });

    if (!response.ok) {
        alert(await response.text());
        return;
    }

    const savedUser = await response.json();
    sessionStorage.setItem("authUser", JSON.stringify(savedUser));
    setStoredProfileField("name", savedUser.name);
    setStoredProfileField("email", savedUser.email);
    document.getElementById("displayName").innerText = name;

    alert("Saved in database");
}


// =====================
// TABS
// =====================
function showTab(id) {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.getElementById(id).classList.add("active");
}




            // ========================================================================
            // ========================================================================
            // ========================================================================




//posts Start 
//الحتة دي لسه تعتبر ستاتك و غامضة اوي اصلا ف سيبك منها سيبها استاتك كدا 
document.addEventListener("DOMContentLoaded", function () {

    const authUser = getAuthUser();
    let posts = [];
    let currentUserId = authUser?.id || null;

    function getCurrentUser() {
        return getAuthUser() || { id: currentUserId || Date.now(), name: "You" };
    }

    
    window.addPost = function () {
        const input = document.getElementById("postInput");
        if (!input.value.trim()) return;

        const user = getCurrentUser();

        const post = {
            id: Date.now(),
            userId: user.id,
            userName: user.name,
            text: input.value,
            likes: [],
            comments: []
        };

        posts.unshift(post);

        input.value = "";

        renderFeed();
    };

    
    window.likePost = function (postId) {
        const post = posts.find(p => p.id == postId);
        if (!post) return;

        const userId = currentUserId;

        if (post.likes.includes(userId)) {
            post.likes = post.likes.filter(id => id != userId);
        } else {
            post.likes.push(userId);
        }

        renderFeed();
    };

    // ================= COMMENT =================
    window.addComment = function (postId, input) {
        const post = posts.find(p => p.id == postId);
        if (!post) return;

        if (!input.value.trim()) return;

        post.comments.push({
            userId: currentUserId,
            text: input.value
        });

        input.value = "";

        renderFeed();
    };


    function renderFeed() {

        const list = document.getElementById("postList");
        if (!list) return;
        list.innerHTML = "";

        posts.forEach(post => {

            const liked = post.likes.includes(currentUserId);

            list.innerHTML += `
                <div class="post">

                    <div class="post-header">
                        ${post.userName}
                    </div>

                    <div class="post-text">
                        ${post.text}
                    </div>

                    <div class="post-actions">

                        <button onclick="likePost(${post.id})"
                            style="color:${liked ? '#0a66c2' : '#555'}">
                            ❤️ Like (${post.likes.length})
                        </button>

                        <button onclick="toggleComment(${post.id})">
                            💬 Comment (${post.comments.length})
                        </button>

                    </div>

                    <div class="comment-box" id="comment-${post.id}" style="display:none;">

                        <input type="text"
                            placeholder="Write comment..."
                            onkeydown="if(event.key==='Enter') addComment(${post.id}, this)">

                        <div>
                            ${post.comments.map(c => `
                                <p>💬 ${c.text}</p>
                            `).join("")}
                        </div>

                    </div>

                </div>
            `;
        });
    }

    
    window.toggleComment = function (id) {
        const box = document.getElementById(`comment-${id}`);
        if (!box) return;

        box.style.display = box.style.display === "block" ? "none" : "block";
    };

   
    renderFeed();
});
//posts Start 
// profile End



            // ========================================================================
            // ========================================================================
            // ========================================================================



//load the picture in navbar Start

// بنجيب بيانات الناف بار من تخزين خاص بكل يوزر
function loadNavbarProfile() {
    const name = getStoredProfileField("name", "Guest");
    const image = getStoredProfileField("image", "");

    const nameEl = document.getElementById("navUserName");
    const imgEl = document.getElementById("navUserAvatar");

    if (nameEl) 
    {
        nameEl.innerText = name;
    }
    if (imgEl) 
    {
        imgEl.src = image || "images/default.png";
    }

    if (imgEl && image) 
    {
        imgEl.src = image;
    } 
    else if (imgEl) 
    {
        imgEl.src = "images/default.png"; // دي اي صورة كدا بس لما بتحط صورة بقي هي اللي بتظهر فعلا
    }
}

loadNavbarProfile();

//load the picture in navbar End


// بداية التسجيل الصوتي



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
        alert("Select a room first");
        return;
    }

    vmStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    vmRecorder = new MediaRecorder(vmStream);
    vmChunks = [];

    vmRecorder.ondataavailable = e => vmChunks.push(e.data);

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
        vmStream.getTracks().forEach(t => t.stop());
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
        let targetScale = 1 + (avg / 200);
        smoothedScale += (targetScale - smoothedScale) * 0.15;
        recordBtn.style.transform = `scale(${smoothedScale})`;

        drawLiveWave(vmDataArray);

        vmAnimationId = requestAnimationFrame(animate);
    }

    animate();
}

function saveVoiceMessage(blob, url, duration) {

    const time = getTime12h();

    const message = {
        type: "audio",
        data: url,
        duration: duration,
        time: time
    };

    rooms[currentRoom].messages.push(message);

    saveAll();
    renderMessages();
    updateRoomInfo();
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


// نهاية التسجيل


/* 

       تحت الكمنت ده هتلاقي الربط 
        متلعبش فيه

*/




// بنخزن بيانات أول خطوة من اللوجين بين صفحة اللوجين وصفحة الـ OTP
function getPendingLoginVerification()
{
    return JSON.parse(sessionStorage.getItem("pendingLoginVerification"));
}

function setPendingLoginVerification(data)
{
    sessionStorage.setItem("pendingLoginVerification", JSON.stringify(data));
}

function clearPendingLoginVerification()
{
    sessionStorage.removeItem("pendingLoginVerification");
}

async function readApiError(response)
{
    const rawText = await response.text();

    if (!rawText) return "Request failed.";

    try
    {
        const data = JSON.parse(rawText);
        return data.message || data.error || rawText;
    }
    catch (error)
    {
        return rawText;
    }
}

function handleOAuthLoginRedirect()
{
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
        staffId: staffId || ""
    };

    sessionStorage.setItem("authUser", JSON.stringify(authUser));
    document.documentElement.classList.add("logged-in");

    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);
    window.location.href = "dashboard.html";
    return true;
}

// بداية اللوجين بـ Google أو GitHub من صفحة اللوجين
function startSocialLogin(provider)
{
    if (!provider) return;
    window.location.href = `http://localhost:8080/oauth2/authorization/${encodeURIComponent(provider)}`;
}

// بداية لوجين الـ OTP: نراجع البيانات وبعدين نروح لصفحة الكود
async function loginToServer(email, password, username, staffId) 
{
    const params = new URLSearchParams();
    params.append('email', email);
    params.append('password', password);
    params.append('username', username);
    params.append('staffId', staffId);

    try 
    {
        const response = await fetch(`${API_BASE}/auth/login/initiate?${params.toString()}`, 
        {
            method: 'POST'
        });

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
                    staffId: data.staffId
                },
                deliveryTarget: data.deliveryTarget,
                message: data.message
            });
            window.location.href = "twofactor.html";
        } 
        else 
        {
            const errorMsg = await readApiError(response);
            alert("Login Failed: " + errorMsg);
        }
    } 
    catch (error) 
    {
        alert("Server connection error.");
    }
}

async function triggerLogin() 
{
    const email = document.getElementById("loginEmail").value;
    const username = document.getElementById("loginUsername").value;
    const staffId = document.getElementById("loginStaffId").value;
    const password = document.getElementById("loginPassword").value;

    if (!email || !username || !staffId || !password) 
    {
        alert("Please fill all 4 fields");
        return;
    }
    await loginToServer(email, password, username, staffId);
}

async function triggerRegister() 
{
    const name = document.getElementById("regName").value;
    const email = document.getElementById("regEmail").value;
    const role = document.getElementById("regRole").value;
    const password = document.getElementById("regPass").value;

    const userData = { name, email, role, password, active: true };

    try 
    {
        const response = await fetch(`${API_BASE}/auth/register`, 
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        if (response.ok) 
        {
            alert("Registration Successful! Check your email for your Staff ID.");
            location.reload();
        } 
        else 
        {
            alert("Registration failed.");
        }
    }
    catch (err) 
    {
        alert("Error connecting to server.");
    }
}

//ملهاش علاقه بالربط

function updateNavbarState() 
{
    const user = getAuthUser();
    
    const LOGBT = document.querySelector(".login_button") || document.querySelector("a[href='login.html']");
    const SIGNUPBT = document.querySelector(".signup_button") || document.querySelector("a[href='signup.html']");
    
    if (user) 
    {
        if (LOGBT) LOGBT.style.display = "none";
        if (SIGNUPBT) SIGNUPBT.style.display = "none";

        const nav = document.querySelector(".nav-links");
        if (nav && !document.getElementById("logoutBtn")) 
        {
            const logoutLi = document.createElement("li");
            logoutLi.innerHTML = `<a href="#" id="logoutBtn" onclick="logout()" style="color: #fdbd41;">Logout</a>`;
            nav.appendChild(logoutLi);
        }
    }
}

function logout() 
{
    sessionStorage.removeItem("authUser");
    window.location.href = "login.html";
}
document.addEventListener("DOMContentLoaded", updateNavbarState);

document.addEventListener("DOMContentLoaded", function () {
    handleOAuthLoginRedirect();
});

function setOtpStatus(message, isError)
{
    const statusEl = document.getElementById("otpStatus");
    if (!statusEl) return;

    statusEl.textContent = message || "";
    statusEl.classList.remove("error", "success");
    if (message) {
        statusEl.classList.add(isError ? "error" : "success");
    }
}

function initializeEmailOtpPage()
{
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
    if (deliveryEl) deliveryEl.textContent = pending.deliveryTarget || pending.user.email || "-";
    if (descriptionEl && pending.message) {
        descriptionEl.textContent = pending.message + ". Check your inbox for the 5-digit verification code.";
    }
}

async function submitEmailOtp()
{
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
    params.append('email', pending.email);
    params.append('password', pending.password);
    params.append('username', pending.username);
    params.append('staffId', pending.staffId);
    params.append('otpCode', otpCode);

    try
    {
        if (submitBtn) submitBtn.disabled = true;
        setOtpStatus("Verifying your code...", false);

        const response = await fetch(`${API_BASE}/auth/login/verify?${params.toString()}`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(await readApiError(response));
        }

        const user = await response.json();
        sessionStorage.setItem("authUser", JSON.stringify(user));
        clearPendingLoginVerification();
        setOtpStatus("Success. Redirecting to your dashboard...", false);
        window.location.href = "dashboard.html";
    }
    catch (error)
    {
        setOtpStatus(error.message || "Could not verify the login code.", true);
    }
    finally
    {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function cancelEmailOtpFlow()
{
    const pending = getPendingLoginVerification();
    clearPendingLoginVerification();

    if (pending?.email) {
        try {
            await fetch(`${API_BASE}/auth/login/cancel?email=${encodeURIComponent(pending.email)}`, {
                method: 'POST'
            });
        } catch (error) {
        }
    }

    window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", function () {
    initializeEmailOtpPage();
});

async function removeProfilePhoto() 
{
    if (confirm("Are you sure you want to remove your profile photo?")) 
    {
        const removed = await removeStoredProfileField("image");
        if (!removed) return;
        
        const profileImage = document.getElementById("profileImage");
        const navAvatar = document.getElementById("navUserAvatar");

        if (profileImage) profileImage.src = "images/default.png"; 
        if (navAvatar) navAvatar.src = "images/default.png";
        
        alert("Profile photo removed.");
    }
}

async function removeCoverPhoto() 
{
    if (confirm("Are you sure you want to remove your cover photo?")) 
    {
        const removed = await removeStoredProfileField("cover");
        if (!removed) return;
        
        const cover = document.getElementById("cover");
        if (cover) cover.style.backgroundImage = "none";
        
        alert("Cover photo removed.");
    }
}
