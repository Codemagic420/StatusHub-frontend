const API_BASE = "http://localhost:8080/api";

let state = {
    environments: [],
    currentEnvId: null,
};

document.addEventListener("DOMContentLoaded", () => {
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

    function statusClass(status) {
        switch ((status || "").toUpperCase()) {
            case "OK":
                return "pill-ok";
            case "ISSUES":
                return "pill-issues";
            case "FREEZE":
                return "pill-freeze";
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
            default:
                return "";
        }
    }

    function renderEnvironments() {
        envListEl.innerHTML = "";

        if (state.environments.length === 0) {
            envListEl.innerHTML =
                '<li class="empty-state">No environments yet. Create one to get started.</li>';
            return;
        }

        state.environments.forEach((env) => {
            const li = document.createElement("li");
            li.className =
                "env-item" + (env.id === state.currentEnvId ? " active" : "");
            li.dataset.id = env.id;

            li.innerHTML = `
                <div class="env-name">${env.name}</div>
                <div class="env-status-wrapper">
                    <span class="env-status-dot ${dotClass(env.status)}"></span>
                    <span>${env.status}</span>
                </div>
            `;

            li.addEventListener("click", () => {
                state.currentEnvId = env.id;
                renderEnvironments();
                updateCurrentEnvironmentHeader(env);
                loadPostsForEnvironment(env.id);
                postFormCard.classList.add("hidden");
            });

            envListEl.appendChild(li);
        });
    }

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
                    <span class="pill pill-small pill-muted">${p.type}</span>
                </div>
                <div class="post-meta">
                    <span>${created}</span>
                    <span>Environment: ${p.environment?.name ?? "-"}</span>
                </div>
                <div class="post-body">
                    ${p.description}
                </div>
            `;

            postsListEl.appendChild(card);
        });
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

    loadEnvironments();
});
