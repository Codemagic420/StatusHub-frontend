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
    /* ---------- login / logout elements ---------- */

    const loginScreen = document.getElementById("login-screen");
    const appScreen = document.getElementById("app-screen");
    const loginForm = document.getElementById("login-form");
    const loginErrorEl = document.getElementById("login-error");
    const logoutBtn = document.getElementById("logout-btn");
    const userBadgeEl = document.getElementById("user-badge");

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

    /* ---------- existing app elements ---------- */

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

    /* ---------- helpers til status ---------- */

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

    /* ---------- API helpers ---------- */

    async function apiLogin(username, password) {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
            throw new Error("Invalid credentials");
        }

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
            envListEl.innerHTML =
                '<li class="empty-state">Failed to load environments.</li>';
        }
    }

    async function loadPostsForEnvironment(envId) {
        if (!envId) {
            renderPosts([]);
            return;
        }

        try {
            const res = await fetch(
                `${API_BASE}/posts/environment/${encodeURIComponent(envId)}`
            );
            const data = await res.json();
            renderPosts(data);
        } catch (err) {
            console.error("Failed to load posts", err);
            postsListEl.innerHTML =
                '<div class="empty-state">Failed to load posts.</div>';
        }
    }

    async function createPost(payload) {
        const res = await fetch(`${API_BASE}/posts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to delete post");
        }
    }

    async function createEnvironment(payload) {
        const res = await fetch(`${API_BASE}/environments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
            headers: { "Content-Type": "application/json" },
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
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Failed to delete environment");
        }
    }

    /* ---------- render helpers ---------- */

    function updateCurrentEnvironmentHeader(env) {
        if (!env) {
            currentEnvNameEl.textContent = "Select an environment";
            currentEnvStatusEl.textContent = "No environment";
            currentEnvStatusEl.className = "pill pill-muted";
            return;
        }

        currentEnvNameEl.textContent = env.name;
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
                li.className =
                    "env-item" + (env.id === state.currentEnvId ? " active" : "");
                li.dataset.id = env.id;

                li.innerHTML = `
                    <div class="env-main">
                        <div class="env-name">${env.name}</div>
                        <div class="env-status-wrapper">
                            <span class="env-status-dot ${dotClass(env.status)}"></span>
                            <span>${env.status}</span>
                        </div>
                    </div>
                    <button class="env-delete" title="Delete environment">✕</button>
                `;

                li.addEventListener("click", () => {
                    state.currentEnvId = env.id;
                    renderEnvironments();
                    updateCurrentEnvironmentHeader(env);
                    loadPostsForEnvironment(env.id);
                    postFormCard.classList.add("hidden");
                });

                const deleteBtn = li.querySelector(".env-delete");
                deleteBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();

                    if (
                        !confirm(
                            `Delete environment "${env.name}"?\nAll posts for this environment will also be deleted.`
                        )
                    )
                        return;

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

            const created =
                p.createdAt != null ? new Date(p.createdAt).toLocaleString() : "";

            card.innerHTML = `
                <div class="post-header">
                    <div class="post-title">${p.title}</div>
                    <div class="post-actions">
                        <span class="pill pill-small pill-muted">${p.type}</span>
                        <button class="btn btn-ghost btn-small post-delete" title="Delete post">
                            ✕
                        </button>
                    </div>
                </div>
                <div class="post-meta">
                    <span>${created}</span>
                    <span>Environment: ${p.environment?.name ?? "-"}</span>
                </div>
                <div class="post-body">
                    ${p.description}
                </div>
            `;

            const deleteBtn = card.querySelector(".post-delete");
            deleteBtn.addEventListener("click", async (e) => {
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

            postsListEl.appendChild(card);
        });
    }

    /* ---------- UI events: posts & environments ---------- */

    togglePostFormBtn.addEventListener("click", () => {
        if (!state.currentEnvId) return;
        postFormCard.classList.toggle("hidden");
    });

    postCancelBtn.addEventListener("click", () => {
        postForm.reset();
        postFormCard.classList.add("hidden");
    });

    postForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!state.currentEnvId) return;

        const formData = new FormData(postForm);
        const payload = {
            title: formData.get("title"),
            description: formData.get("description"),
            type: formData.get("type"),
            environmentId: state.currentEnvId,
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

    addEnvBtn.addEventListener("click", () => {
        envFormCard.classList.toggle("hidden");
    });

    envCancelBtn.addEventListener("click", () => {
        envCreateForm.reset();
        envFormCard.classList.add("hidden");
    });

    envCreateForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(envCreateForm);
        const payload = {
            name: formData.get("name"),
            status: formData.get("status"),
            solutionName: formData.get("solutionName") || null,
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

    currentEnvStatusEl.addEventListener("click", async () => {
        if (!state.currentEnvId) return;

        const env = state.environments.find(
            (e) => e.id === state.currentEnvId
        );
        if (!env) return;

        const current = (env.status || "OK").toUpperCase();
        const idx = ENV_STATUSES.indexOf(current);
        const nextStatus =
            ENV_STATUSES[(idx + 1 + ENV_STATUSES.length) % ENV_STATUSES.length];

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

    /* ---------- login / logout events ---------- */

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        loginErrorEl.classList.add("hidden");

        const formData = new FormData(loginForm);
        const username = formData.get("username");
        const password = formData.get("password");

        try {
            const data = await apiLogin(username, password);

            authState.isLoggedIn = true;
            authState.username = data.username;
            authState.role = data.role;
            authState.token = data.token;

            userBadgeEl.textContent = `${data.username} (${data.role})`;
            userBadgeEl.classList.remove("hidden");
            logoutBtn.classList.remove("hidden");

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
        logoutBtn.classList.add("hidden");

        state.currentEnvId = null;
        state.environments = [];
        envListEl.innerHTML = "";
        updateCurrentEnvironmentHeader(null);
        renderPosts([]);

        appScreen.classList.add("hidden");
        loginScreen.classList.remove("hidden");
    });

    /* ---------- register UI events ---------- */

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

        const formData = new FormData(registerForm);
        const username = formData.get("username");
        const password = formData.get("password");
        const role = formData.get("role");

        if (!username || !password) {
            registerErrorEl.textContent = "Please fill in all fields.";
            registerErrorEl.classList.remove("hidden");
            return;
        }

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

    /* ---------- change password UI events ---------- */

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

        const formData = new FormData(changePwForm);
        const username = formData.get("username");
        const oldPassword = formData.get("oldPassword");
        const newPassword = formData.get("newPassword");

        if (!username || !oldPassword || !newPassword) {
            changePwErrorEl.textContent = "Please fill in all fields.";
            changePwErrorEl.classList.remove("hidden");
            return;
        }

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

    // ingen auto-login – login screen er default
});
