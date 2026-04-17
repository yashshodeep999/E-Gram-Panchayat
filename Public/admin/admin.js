const BACKEND = "http://localhost:5000";

function requireAuth() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "ADMIN") {
    alert("Please login as Admin first!");
    window.location.href = "admin-login.html";
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  window.location.href = "admin-login.html";
}

async function addMember() {
  if (!requireAuth()) return;

  const token = localStorage.getItem("token");
  const msg = document.getElementById("msg");
  msg.className = "";
  msg.textContent = "";

  const name = document.getElementById("name").value.trim();
  const position = document.getElementById("position").value.trim();
  const bio = document.getElementById("bio").value.trim();
  const imageFile = document.getElementById("image").files[0];

  if (!name || !position || !bio) {
    msg.className = "text-danger";
    msg.textContent = "Please fill all fields.";
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("position", position);
  formData.append("bio", bio);
  if (imageFile) formData.append("image", imageFile);

  try {
    const res = await fetch(`${BACKEND}/members`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      msg.className = "text-danger";
      msg.textContent = data.msg || data.error || "Failed to add member";
      return;
    }

    msg.className = "text-success";
    msg.textContent = "Member added ✅";

    document.getElementById("name").value = "";
    document.getElementById("position").value = "";
    document.getElementById("bio").value = "";
    document.getElementById("image").value = "";

    loadMembers();
  } catch (err) {
    msg.className = "text-danger";
    msg.textContent = "Backend not reachable.";
  }
}

function openEditModal(id, name, position, bio) {
  document.getElementById("editId").value = id;
  document.getElementById("editName").value = name || "";
  document.getElementById("editPosition").value = position || "";
  document.getElementById("editBio").value = bio || "";
  document.getElementById("editImage").value = ""; // clear file
  document.getElementById("editMsg").textContent = "";

  const modal = new bootstrap.Modal(document.getElementById("editModal"));
  modal.show();
}

async function updateMember() {
  if (!requireAuth()) return;

  const token = localStorage.getItem("token");
  const id = document.getElementById("editId").value;

  const name = document.getElementById("editName").value.trim();
  const position = document.getElementById("editPosition").value.trim();
  const bio = document.getElementById("editBio").value.trim();
  const imageFile = document.getElementById("editImage").files[0];

  const msg = document.getElementById("editMsg");
  msg.className = "";
  msg.textContent = "";

  if (!name || !position || !bio) {
    msg.className = "text-danger";
    msg.textContent = "Please fill all fields.";
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("position", position);
  formData.append("bio", bio);

  // ✅ IMPORTANT
  if (imageFile) formData.append("image", imageFile);

  try {
    const res = await fetch(`${BACKEND}/members/${id}`, {
      method: "PUT",
      headers: { Authorization: "Bearer " + token },
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      msg.className = "text-danger";
      msg.textContent = data.msg || data.error || "Update failed";
      return;
    }

    msg.className = "text-success";
    msg.textContent = "Member updated ✅";

    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById("editModal")).hide();
      loadMembers();
    }, 400);
  } catch (err) {
    msg.className = "text-danger";
    msg.textContent = "Backend not reachable.";
  }
}

async function deleteMember(id) {
  if (!requireAuth()) return;

  const token = localStorage.getItem("token");
  if (!confirm("Are you sure you want to delete this member?")) return;

  try {
    const res = await fetch(`${BACKEND}/members/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.msg || data.error || "Delete failed");
      return;
    }

    alert("Member deleted ✅");
    loadMembers();
  } catch (err) {
    alert("Backend not reachable.");
  }
}

async function loadMembers() {
  const membersDiv = document.getElementById("members");
  membersDiv.innerHTML = "";

  const res = await fetch(`${BACKEND}/members`);
  const members = await res.json();

  if (!members.length) {
    membersDiv.innerHTML = `<p class="text-muted">No members found.</p>`;
    return;
  }

  members.forEach((m) => {
    const imgUrl = m.image ? `${BACKEND}/uploads/${m.image}?t=${Date.now()}` : "";

    membersDiv.innerHTML += `
      <div class="col-md-4">
        <div class="card h-100 shadow-sm">
          ${imgUrl ? `<img src="${imgUrl}" class="card-img-top" style="height:220px; object-fit:cover;">` : ""}
          <div class="card-body">
            <h5 class="card-title">${m.name || ""}</h5>
            <p class="text-muted mb-1">${m.position || ""}</p>
            <p class="card-text">${m.bio || ""}</p>

            <div class="d-flex gap-2 mt-3">
              <button class="btn btn-outline-dark w-50"
                onclick="openEditModal('${m._id}', ${JSON.stringify(m.name)}, ${JSON.stringify(m.position)}, ${JSON.stringify(m.bio)})">
                Edit
              </button>
              <button class="btn btn-outline-danger w-50" onclick="deleteMember('${m._id}')">Delete</button>
            </div>
          </div>
        </div>
      </div>
    `;
  });
}

// ✅ expose for onclick buttons
window.addMember = addMember;
window.loadMembers = loadMembers;
window.updateMember = updateMember;
window.deleteMember = deleteMember;
window.openEditModal = openEditModal;
window.logout = logout;
