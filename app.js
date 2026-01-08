const API_BASE = "http://localhost:8080/api";
const ENV_STATUSES = ["OK", "ISSUES", "FREEZE", "DOWN"];

const state = {
    environments: [],
    currentEnvId: null,
};

const authState = {
    isLoggedIn: false,
    username: null,
    role: null,
    token: null,
};

document.addEventListener("DOMContentLoaded", () => {
    /* ---------- login / logout ---------- */

    const loginScreen = document.getElementById("login-screen");
    const appScreen = document.getElementById("app-screen");
    const loginForm = document.getElementById("login-form");
    const loginErrorEl = document.getElementById("login-error");
    const logoutBtn = document.getElementById("logout-btn");
    const userBadgeEl = document.getElementById("user-badge");
    const roleBadgeEl = document.getElementById("role-badge");

    const showRegisterBtn = document.getElementById("show-register");
    const registerCard = document.getElementById("register-card");
    const registerForm = document.getElementById("register-form");
    const registerErrorEl = document.getElementById("register-error");
    const registerSuccessEl = document.getElementById("register-success");

    const showChangePwBtn = document.getElementById("show-change-password");
    const changePwCard = document.getElementById("change-password-card");
    const changePwForm = document.getElementById("change-password-form");
    const changePwErrorEl = document.getElementById("change-password-error");
    const changePwSuccessEl = document.getElementById("change-password-success");

    /* ---------- app elements ---------- */

    const envListEl = document.getElementById("env-list");
    const currentEnvNameEl = document.getElementById("current-env-name");
    const currentEnvStatusEl = document.getElementById("current-env-status");
    const postsListEl = document.getElementById("posts-list");

    const togglePostFormBtn = document.getElementById("toggle-post-form");
    const postFormCard = document.getElementById("post-form-card");
    const postForm = document.getElementById("post-form");
    const postCancelBtn = document.getElementById("post-cancel");

    const envFormCard = document.getElementById("env-form");
    const envCreateForm = document.getElementById("env-create-form");
    const addEnvBtn = document.getElementById("add-env-btn");
    const envCancelBtn = document.getElementById("env-cancel");

    /* ---------- role helpers ---------- */

    function isAdmin() {
        return (authState.role || "").toUpperCase() === "ADMIN";
    }

    function applyRoleVisibility() {
        const adminEls = document.querySelectorAll(".admin-only");

        adminEls.forEach((el) => {
            if (isAdmin()) el.classList.remove("hidden");
            else el.classList.add("hidden");
        });

        // status pill: only clickable for admin
        currentEnvStatusEl.style.cursor = isAdmin() ? "pointer" : "default";
        currentEnvStatusEl.title = isAdmin()
            ? "Click to cycle status"
            : "Only ADMIN can change status";
    }

    function authHeaders() {
        return {
            "X-Role": authState.role || "VIEWER",
            "X-User": authState.username || "anonymous",
        };
    }

    /* ---------- status helpers ---------- */

    function statusClass(status) {
        switch ((status || "").toUpperCase()) {
            case "OK":
                return "pill-ok";
            case "ISSUES":
                return "pill-issues";
            case "FREEZE":
                return "pill-freeze";
            case "DOWN":
                return "pill-down";
            default:
                return "pill-muted";
        }
    }

    function dotClass(status) {
        switch ((status || "").toUpperCase()) {
            case "OK":
                return "status-ok";
            case "ISSUES":
                return "status-issues";
            case "FREEZE":
                return "status-freeze";
            case "DOWN":
                return "status-down";
            default:
                return "";
        }
    }

    /* ---------- API: auth ---------- */

    async function apiLogin(username, password) {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        if (!res.ok) throw new Error("Invalid credentials");
        return res.json();
    }

    async function apiChangePassword(username, oldPassword, newPassword) {
        const res = await fetch(`${API_BASE}/auth/change-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, oldPassword, newPassword }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to change password");
        }
        return res.text();
    }

    async function apiRegisterUser(username, password, role) {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, role }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to create user");
        }
        return res.text();
    }

    /* ---------- API: environments ---------- */

    async function loadEnvironments() {
        try {
            const res = await fetch(`${API_BASE}/environments`);
            const data = await res.json();
            state.environments = data;
            renderEnvironments();

            if (state.environments.length > 0 && !state.currentEnvId) {
                const first = state.environments[0];
                state.currentEnvId = first.id;
                updateCurrentEnvironmentHeader(first);
                renderEnvironments();
                loadPostsForEnvironment(first.id);
            }

            if (
                state.currentEnvId &&
                !state.environments.some((e) => e.id === state.currentEnvId)
            ) {
                state.currentEnvId = null;
                updateCurrentEnvironmentHeader(null);
                renderPosts([]);
            }
        } catch (err) {
            console.error("Failed to load environments", err);
            envListEl.innerHTML = '<li class="empty-state">Failed to load environments.</li>';
        }
    }

    async function createEnvironment(payload) {
        const res = await fetch(`${API_BASE}/environments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders(),
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to create environment");
        }
        return res.json();
    }

    async function updateEnvironment(id, payload) {
        const res = await fetch(`${API_BASE}/environments/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders(),
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to update environment");
        }
        return res.json();
    }

    async function deleteEnvironment(id) {
        const res = await fetch(`${API_BASE}/environments/${id}`, {
            method: "DELETE",
            headers: { ...authHeaders() },
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to delete environment");
        }
    }

    /* ---------- API: posts ---------- */

    async function loadPostsForEnvironment(envId) {
        if (!envId) {
            renderPosts([]);
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/posts/environment/${encodeURIComponent(envId)}`);
            const data = await res.json();
            renderPosts(data);
        } catch (err) {
            console.error("Failed to load posts", err);
            postsListEl.innerHTML = '<div class="empty-state">Failed to load posts.</div>';
        }
    }

    async function createPost(payload) {
        const res = await fetch(`${API_BASE}/posts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders(),
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to create post");
        }
        return res.json();
    }

    async function deletePost(id) {
        const res = await fetch(`${API_BASE}/posts/${id}`, {
            method: "DELETE",
            headers: { ...authHeaders() },
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to delete post");
        }
    }

    /* ---------- API: comments ---------- */

    async function loadComments(postId) {
        const res = await fetch(`${API_BASE}/posts/${postId}/comments`);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to load comments");
        }
        return res.json();
    }

    async function addComment(postId, payload) {
        const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders(), // ikke krævet for create, men ok
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to add comment");
        }
        return res.json();
    }

    async function deleteComment(commentId) {
        const res = await fetch(`${API_BASE}/comments/${commentId}`, {
            method: "DELETE",
            headers: { ...authHeaders() },
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to delete comment");
        }
    }

    /* ---------- render ---------- */

    function updateCurrentEnvironmentHeader(env) {
        if (!env) {
            currentEnvNameEl.textContent = "Select an environment";
            currentEnvStatusEl.textContent = "No environment";
            currentEnvStatusEl.className = "pill pill-muted";
            return;
        }

        const label = env.solutionName ? `${env.solutionName} • ${env.name}` : env.name;
        currentEnvNameEl.textContent = label;

        currentEnvStatusEl.textContent = env.status;
        currentEnvStatusEl.className = `pill ${statusClass(env.status)}`;
    }

    function renderEnvironments() {
        envListEl.innerHTML = "";

        if (state.environments.length === 0) {
            envListEl.innerHTML =
                '<li class="empty-state">No environments yet. Create one to get started.</li>';
            return;
        }

        const groups = new Map();
        for (const env of state.environments) {
            const key =
                env.solutionName && env.solutionName.trim().length > 0
                    ? env.solutionName.trim()
                    : "UNASSIGNED";
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(env);
        }

        const solutionNames = Array.from(groups.keys()).sort((a, b) => {
            if (a === "UNASSIGNED") return 1;
            if (b === "UNASSIGNED") return -1;
            return a.localeCompare(b);
        });

        solutionNames.forEach((solutionName) => {
            const header = document.createElement("li");
            header.className = "solution-header";
            header.textContent = solutionName;
            envListEl.appendChild(header);

            const envs = groups.get(solutionName);

            envs.forEach((env) => {
                const li = document.createElement("li");
                li.className = "env-item" + (env.id === state.currentEnvId ? " active" : "");
                li.dataset.id = env.id;

                const deleteButtonHtml = isAdmin()
                    ? `<button class="env-delete" title="Delete environment">✕</button>`
                    : "";

                li.innerHTML = `
                    <div class="env-main">
                        <div class="env-name">${env.name}</div>
                        <div class="env-status-wrapper">
                            <span class="env-status-dot ${dotClass(env.status)}"></span>
                            <span>${env.status}</span>
                        </div>
                    </div>
                    ${deleteButtonHtml}
                `;

                li.addEventListener("click", () => {
                    state.currentEnvId = env.id;
                    renderEnvironments();
                    updateCurrentEnvironmentHeader(env);
                    loadPostsForEnvironment(env.id);
                    postFormCard.classList.add("hidden");
                });

                if (isAdmin()) {
                    const deleteBtn = li.querySelector(".env-delete");
                    deleteBtn.addEventListener("click", async (e) => {
                        e.stopPropagation();

                        if (!confirm(`Delete environment "${env.name}"?\nAll posts/comments will be deleted too.`)) return;

                        try {
                            await deleteEnvironment(env.id);
                            if (state.currentEnvId === env.id) {
                                state.currentEnvId = null;
                                updateCurrentEnvironmentHeader(null);
                                renderPosts([]);
                            }
                            await loadEnvironments();
                        } catch (err) {
                            console.error(err);
                            alert("Could not delete environment.");
                        }
                    });
                }

                envListEl.appendChild(li);
            });
        });
    }

    function renderPosts(posts) {
        postsListEl.innerHTML = "";

        if (!state.currentEnvId) {
            postsListEl.innerHTML =
                '<div class="empty-state"><p>Select an environment to see posts.</p></div>';
            return;
        }

        if (!posts || posts.length === 0) {
            postsListEl.innerHTML =
                '<div class="empty-state"><p>No posts for this environment yet.</p></div>';
            return;
        }

        posts.forEach((p) => {
            const card = document.createElement("article");
            card.className = "post-card";

            const created = p.createdAt ? new Date(p.createdAt).toLocaleString() : "";
            const responsible = p.createdBy ? p.createdBy : "unknown";

            const deleteBtnHtml = isAdmin()
                ? `<button class="btn btn-ghost btn-small post-delete" title="Delete post">✕</button>`
                : "";

            card.innerHTML = `
                <div class="post-header">
                    <div class="post-title">${p.title}</div>
                    <div class="post-actions">
                        <span class="pill pill-small pill-muted">${p.type}</span>
                        ${deleteBtnHtml}
                    </div>
                </div>

                <div class="post-meta">
                    <span>${created}</span>
                    <span>Responsible: ${responsible}</span>
                    <span>Environment: ${p.environment?.name ?? "-"}</span>
                </div>

                <div class="post-body">${p.description}</div>

                <div class="comments-wrap">
                    <div class="comments-header">
                        <div class="comments-title">Comments</div>
                        <button class="btn btn-ghost btn-small comments-toggle">Show</button>
                    </div>

                    <div class="comments-body hidden">
                        <div class="comment-list"></div>

                        <form class="comment-form">
                            <input class="comment-input" type="text" name="text" placeholder="Write a comment..." required />
                            <button type="submit" class="btn btn-primary btn-small">Send</button>
                        </form>
                    </div>
                </div>
            `;

            // delete post (ADMIN only)
            if (isAdmin()) {
                const del = card.querySelector(".post-delete");
                del.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (!confirm("Delete this post?")) return;

                    try {
                        await deletePost(p.id);
                        await loadPostsForEnvironment(state.currentEnvId);
                    } catch (err) {
                        console.error(err);
                        alert("Could not delete post.");
                    }
                });
            }

            // comments: toggle + load + add + (admin delete)
            const toggleBtn = card.querySelector(".comments-toggle");
            const bodyEl = card.querySelector(".comments-body");
            const listEl = card.querySelector(".comment-list");
            const formEl = card.querySelector(".comment-form");

            let isOpen = false;
            let loadedOnce = false;

            toggleBtn.addEventListener("click", async () => {
                isOpen = !isOpen;
                toggleBtn.textContent = isOpen ? "Hide" : "Show";
                bodyEl.classList.toggle("hidden", !isOpen);

                if (isOpen && !loadedOnce) {
                    try {
                        const comments = await loadComments(p.id);
                        renderComments(listEl, comments);
                        loadedOnce = true;
                    } catch (err) {
                        console.error(err);
                        listEl.innerHTML = `<div class="empty-state">Could not load comments.</div>`;
                    }
                }
            });

            formEl.addEventListener("submit", async (e) => {
                e.preventDefault();

                const fd = new FormData(formEl);
                const text = fd.get("text");

                if (!text || String(text).trim().length === 0) return;

                try {
                    await addComment(p.id, {
                        text: String(text).trim(),
                        author: authState.username || "unknown",
                    });

                    formEl.reset();

                    // refresh comments (simple + stable)
                    const comments = await loadComments(p.id);
                    renderComments(listEl, comments);
                    loadedOnce = true;
                } catch (err) {
                    console.error(err);
                    alert("Could not add comment.");
                }
            });

            postsListEl.appendChild(card);
        });
    }

    function renderComments(listEl, comments) {
        listEl.innerHTML = "";

        if (!comments || comments.length === 0) {
            listEl.innerHTML = `<div class="empty-state">No comments yet.</div>`;
            return;
        }

        comments.forEach((c) => {
            const item = document.createElement("div");
            item.className = "comment-item";

            const created = c.createdAt ? new Date(c.createdAt).toLocaleString() : "";
            const author = c.author || "unknown";

            const delBtnHtml = isAdmin()
                ? `<div class="comment-actions">
                        <button class="btn btn-ghost comment-delete" title="Delete comment">Delete</button>
                   </div>`
                : "";

            item.innerHTML = `
                <div class="comment-meta">
                    <span>${author}</span>
                    <span>${created}</span>
                </div>
                <div class="comment-text">${escapeHtml(c.text)}</div>
                ${delBtnHtml}
            `;

            if (isAdmin()) {
                const del = item.querySelector(".comment-delete");
                del.addEventListener("click", async () => {
                    if (!confirm("Delete this comment?")) return;
                    try {
                        await deleteComment(c.id);
                        // remove from UI
                        item.remove();
                        if (listEl.children.length === 0) {
                            listEl.innerHTML = `<div class="empty-state">No comments yet.</div>`;
                        }
                    } catch (err) {
                        console.error(err);
                        alert("Could not delete comment.");
                    }
                });
            }

            listEl.appendChild(item);
        });
    }

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text == null ? "" : String(text);
        return div.innerHTML;
    }

    /* ---------- UI events ---------- */

    // ADMIN: toggle post form
    togglePostFormBtn.addEventListener("click", () => {
        if (!state.currentEnvId) return;
        postFormCard.classList.toggle("hidden");
    });

    postCancelBtn.addEventListener("click", () => {
        postForm.reset();
        postFormCard.classList.add("hidden");
    });

    // ADMIN: create post (with createdBy)
    postForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!state.currentEnvId) return;

        const fd = new FormData(postForm);
        const payload = {
            title: fd.get("title"),
            description: fd.get("description"),
            type: fd.get("type"),
            environmentId: state.currentEnvId,
            createdBy: authState.username, // Responsible
        };

        try {
            await createPost(payload);
            postForm.reset();
            postFormCard.classList.add("hidden");
            await loadPostsForEnvironment(state.currentEnvId);
        } catch (err) {
            console.error(err);
            alert("Could not create post.");
        }
    });

    // ADMIN: toggle env form
    addEnvBtn.addEventListener("click", () => {
        if (!isAdmin()) return;
        envFormCard.classList.toggle("hidden");
    });

    envCancelBtn.addEventListener("click", () => {
        envCreateForm.reset();
        envFormCard.classList.add("hidden");
    });

    // ADMIN: create environment
    envCreateForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!isAdmin()) return;

        const fd = new FormData(envCreateForm);
        const payload = {
            name: fd.get("name"),
            status: fd.get("status"),
            solutionName: fd.get("solutionName") || null,
        };

        try {
            const created = await createEnvironment(payload);
            envCreateForm.reset();
            envFormCard.classList.add("hidden");
            state.environments.push(created);
            state.currentEnvId = created.id;
            renderEnvironments();
            updateCurrentEnvironmentHeader(created);
            await loadPostsForEnvironment(created.id);
        } catch (err) {
            console.error(err);
            alert("Could not create environment.");
        }
    });

    // ADMIN: cycle env status
    currentEnvStatusEl.addEventListener("click", async () => {
        if (!isAdmin()) return;
        if (!state.currentEnvId) return;

        const env = state.environments.find((e) => e.id === state.currentEnvId);
        if (!env) return;

        const current = (env.status || "OK").toUpperCase();
        const idx = ENV_STATUSES.indexOf(current);
        const nextStatus = ENV_STATUSES[(idx + 1 + ENV_STATUSES.length) % ENV_STATUSES.length];

        try {
            const updated = await updateEnvironment(env.id, {
                name: env.name,
                status: nextStatus,
                solutionName: env.solutionName,
            });

            env.status = updated.status;
            updateCurrentEnvironmentHeader(env);
            renderEnvironments();
        } catch (err) {
            console.error(err);
            alert("Could not update environment status.");
        }
    });

    /* ---------- login events ---------- */

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        loginErrorEl.classList.add("hidden");

        const fd = new FormData(loginForm);
        const username = fd.get("username");
        const password = fd.get("password");

        try {
            const data = await apiLogin(username, password);

            authState.isLoggedIn = true;
            authState.username = data.username;
            authState.role = data.role;
            authState.token = data.token;

            userBadgeEl.textContent = data.username;
            userBadgeEl.classList.remove("hidden");

            roleBadgeEl.textContent = data.role;
            roleBadgeEl.classList.remove("hidden");

            logoutBtn.classList.remove("hidden");

            applyRoleVisibility();

            loginScreen.classList.add("hidden");
            appScreen.classList.remove("hidden");

            await loadEnvironments();
        } catch (err) {
            console.error(err);
            loginErrorEl.classList.remove("hidden");
        }
    });

    logoutBtn.addEventListener("click", () => {
        authState.isLoggedIn = false;
        authState.username = null;
        authState.role = null;
        authState.token = null;

        userBadgeEl.classList.add("hidden");
        roleBadgeEl.classList.add("hidden");
        logoutBtn.classList.add("hidden");

        state.currentEnvId = null;
        state.environments = [];
        envListEl.innerHTML = "";
        updateCurrentEnvironmentHeader(null);
        renderPosts([]);

        appScreen.classList.add("hidden");
        loginScreen.classList.remove("hidden");
    });

    /* ---------- register UI ---------- */

    showRegisterBtn.addEventListener("click", () => {
        const isHidden = registerCard.classList.contains("hidden");
        if (isHidden) {
            registerCard.classList.remove("hidden");
            changePwCard.classList.add("hidden");
        } else {
            registerCard.classList.add("hidden");
        }
        registerErrorEl.classList.add("hidden");
        registerSuccessEl.classList.add("hidden");
    });

    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        registerErrorEl.classList.add("hidden");
        registerSuccessEl.classList.add("hidden");

        const fd = new FormData(registerForm);
        const username = fd.get("username");
        const password = fd.get("password");
        const role = fd.get("role");

        try {
            await apiRegisterUser(username, password, role);
            registerSuccessEl.textContent = "User created successfully.";
            registerSuccessEl.classList.remove("hidden");
            registerForm.reset();
        } catch (err) {
            console.error(err);
            registerErrorEl.textContent = err.message || "Could not create user.";
            registerErrorEl.classList.remove("hidden");
        }
    });

    /* ---------- change password UI ---------- */

    showChangePwBtn.addEventListener("click", () => {
        const isHidden = changePwCard.classList.contains("hidden");
        if (isHidden) {
            changePwCard.classList.remove("hidden");
            registerCard.classList.add("hidden");
        } else {
            changePwCard.classList.add("hidden");
        }
        changePwErrorEl.classList.add("hidden");
        changePwSuccessEl.classList.add("hidden");
    });

    changePwForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        changePwErrorEl.classList.add("hidden");
        changePwSuccessEl.classList.add("hidden");

        const fd = new FormData(changePwForm);
        const username = fd.get("username");
        const oldPassword = fd.get("oldPassword");
        const newPassword = fd.get("newPassword");

        try {
            await apiChangePassword(username, oldPassword, newPassword);
            changePwSuccessEl.textContent = "Password updated successfully.";
            changePwSuccessEl.classList.remove("hidden");
            changePwForm.reset();
        } catch (err) {
            console.error(err);
            changePwErrorEl.textContent = err.message || "Could not change password.";
            changePwErrorEl.classList.remove("hidden");
        }
    });

    // default: show login only
    applyRoleVisibility();
});
