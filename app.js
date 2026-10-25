
/* M_H_S Movies - Complete Frontend JavaScript
   Use your Supabase Project URL and Publishable key.
   Never put a service_role or secret key in this file.
*/

const SUPABASE_URL = "https://dsjckskodinqaxtqnlvf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_HjM_P0RM8UY1xPjHr9cqfA_hkUL-j-F";
const TABLE_NAME = "movies";

const $ = (selector) => document.querySelector(selector);

const movieGrid = $("#movieGrid");
const emptyState = $("#emptyState");
const searchInput = $("#searchInput");
const sortSelect = $("#sortSelect");
const connectionStatus = $("#connectionStatus");
const configNotice = $("#configNotice");
const adminForm = $("#adminLoginForm");
const adminMessage = $("#adminMessage");

let supabaseClient = null;
let movies = [];
let activeCategory = "All";
let adminVerified = false;
let realtimeChannel = null;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function driveFileId(value = "") {
  const raw = String(value).trim();
  if (!raw) return "";
  const match =
    raw.match(/\/file\/d\/([^/?]+)/) ||
    raw.match(/[?&]id=([^&]+)/);
  return match ? match[1] : raw;
}

function placeholderMarkup(title) {
  const initials = String(title || "M_H_S")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();

  return `<div class="poster-placeholder">
    <div class="poster-symbol">${escapeHtml(initials || "M")}</div>
    <span>M_H_S MOVIES</span>
  </div>`;
}

function renderMovies() {
  if (!movieGrid) return;

  const query = searchInput.value.trim().toLowerCase();

  let filtered = movies.filter((movie) => {
    const category = String(movie.category || "Other");
    const matchesCategory =
      activeCategory === "All" ||
      category.toLowerCase() === activeCategory.toLowerCase();

    const searchable =
      `${movie.title || ""} ${movie.description || ""} ${category}`
        .toLowerCase();

    return matchesCategory && searchable.includes(query);
  });

  if (sortSelect.value === "az") {
    filtered.sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""))
    );
  } else {
    filtered.sort(
      (a, b) =>
        new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
  }

  $("#movieCount").textContent = String(movies.length);

  movieGrid.innerHTML = filtered.map((movie) => {
    const title = escapeHtml(movie.title || "Untitled movie");
    const category = escapeHtml(movie.category || "Other");
    const poster = String(movie.poster_url || "").trim();

    const posterMarkup = poster
      ? `<img src="${escapeHtml(poster)}"
          alt="${title} poster"
          loading="lazy"
          onerror="this.style.display='none'">`
      : placeholderMarkup(movie.title);

    const year = movie.release_year
      ? escapeHtml(movie.release_year)
      : "";

    return `<article class="movie-card"
        tabindex="0"
        role="button"
        aria-label="Open ${title}"
        data-movie-id="${escapeHtml(movie.id)}">
      <div class="poster">
        ${posterMarkup}
        <span class="poster-badge">${category}</span>
        <div class="play-overlay"><span>▶</span></div>
      </div>
      <div class="movie-info">
        <h3 class="movie-title">${title}</h3>
        <div class="movie-meta">
          <span class="movie-category">${category}</span>
          <span>${year}</span>
        </div>
      </div>
    </article>`;
  }).join("");

  emptyState.classList.toggle("hidden", filtered.length !== 0);
  movieGrid.classList.toggle("hidden", filtered.length === 0);
}

async function loadMovies() {
  if (!supabaseClient) {
    connectionStatus.textContent = "Configuration needed";
    configNotice.classList.remove("hidden");
    configNotice.querySelector("span").textContent =
      "Check your Supabase URL and Publishable key in app.js.";
    movies = [];
    renderMovies();
    return;
  }

  connectionStatus.textContent = "Loading...";

  try {
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    movies = data || [];
    connectionStatus.textContent = "Connected";
    configNotice.classList.add("hidden");
    renderMovies();
  } catch (error) {
    console.error("Could not load movies:", error);
    connectionStatus.textContent = "Connection issue";
    configNotice.classList.remove("hidden");
    configNotice.querySelector("span").textContent =
      `Database error: ${error.message}. Check your table and SELECT policy.`;
    movies = [];
    renderMovies();
  }
}

function openPlayer(movie) {
  if (!movie) return;

  $("#playerTitle").textContent = movie.title || "Untitled movie";

  const video = $("#videoPlayer");
  const fallback = $("#driveFallback");
  const id = driveFileId(movie.drive_file_id || "");
  const subtitle = String(movie.subtitle_url || "").trim();

  video.pause();
  video.removeAttribute("src");
  video.querySelectorAll("source, track").forEach((element) => {
    element.remove();
  });
  video.load();

  fallback.classList.remove("hidden");
  video.classList.add("hidden");

  if (id) {
    $("#driveOpenLink").href =
      `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
    $("#driveOpenLink").onclick = null;
    $("#subtitleStatus").textContent = subtitle
      ? "Google Drive preview opens separately. A separate subtitle track needs a compatible direct video source."
      : "Google Drive preview opens separately.";
  } else {
    $("#driveOpenLink").href = "#";
    $("#driveOpenLink").onclick = (event) => event.preventDefault();
    $("#subtitleStatus").textContent = "No video link has been added.";
  }

  $("#playerModal").showModal();
}

function showAdminMessage(message) {
  adminMessage.textContent = message;
}

function resetAdminUI(message = "") {
  adminVerified = false;
  $("#adminPanel")?.remove();
  adminForm.classList.remove("hidden");
  if (message) showAdminMessage(message);
}

async function verifyAdmin(user) {
  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    await supabaseClient.auth.signOut();
    resetAdminUI("This account is not authorized as an admin.");
    return false;
  }

  adminVerified = true;
  adminForm.classList.add("hidden");
  $("#adminPanel")?.remove();

  adminForm.insertAdjacentHTML("afterend", `
    <div id="adminPanel" class="form-stack">
      <p class="muted">Signed in as ${escapeHtml(user.email || "admin")}</p>

      <form id="addMovieForm" class="form-stack">
        <label>Movie title
          <input name="title" required maxlength="180">
        </label>

        <label>Description
          <textarea name="description" rows="3"></textarea>
        </label>

        <label>Category
          <input name="category" placeholder="Action, Anime, Drama">
        </label>

        <label>Poster URL
          <input name="poster_url" type="url">
        </label>

        <label>Google Drive file link or file ID
          <input name="drive_file_id" required>
        </label>

        <label>Subtitle URL (optional)
          <input name="subtitle_url" type="url"
            placeholder="Direct .vtt URL">
        </label>

        <button class="primary-button full-width" type="submit">
          Add movie
        </button>
        <p id="addMovieMessage" class="form-message" role="status"></p>
      </form>

      <button id="adminSignOutBtn"
        class="secondary-button full-width" type="button">
        Sign out
      </button>
    </div>
  `);

  $("#addMovieForm").addEventListener("submit", addMovie);
  $("#adminSignOutBtn").addEventListener("click", signOutAdmin);

  return true;
}

async function addMovie(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const message = $("#addMovieMessage");
  const button = form.querySelector('button[type="submit"]');

  if (!supabaseClient || !adminVerified) {
    message.textContent = "Please sign in with an authorized admin account.";
    return;
  }

  const fields = new FormData(form);
  const title = String(fields.get("title") || "").trim();
  const driveLink = String(fields.get("drive_file_id") || "").trim();

  if (!title || !driveLink) {
    message.textContent = "Movie title and Drive link are required.";
    return;
  }

  const movie = {
    title,
    description: String(fields.get("description") || "").trim(),
    category: String(fields.get("category") || "Other").trim() || "Other",
    poster_url: String(fields.get("poster_url") || "").trim(),
    drive_file_id: driveFileId(driveLink),
    subtitle_url: String(fields.get("subtitle_url") || "").trim()
  };

  button.disabled = true;
  message.textContent = "Adding movie...";

  try {
    const { error } = await supabaseClient
      .from(TABLE_NAME)
      .insert(movie);

    if (error) throw error;

    message.textContent = "Movie added successfully!";
    form.reset();
    await loadMovies();
  } catch (error) {
    console.error("Add movie error:", error);
    message.textContent = `Could not add movie: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

async function signOutAdmin() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    resetAdminUI("You have signed out.");
  } catch (error) {
    showAdminMessage(`Sign-out error: ${error.message}`);
  }
}

async function openAdmin() {
  $("#adminModal").showModal();

  if (!supabaseClient) {
    showAdminMessage("Supabase configuration is missing.");
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (data.session?.user) {
      await verifyAdmin(data.session.user);
    } else {
      resetAdminUI("Sign in with your admin email and password.");
    }
  } catch (error) {
    showAdminMessage(`Could not check session: ${error.message}`);
  }
}

async function loginAdmin(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showAdminMessage("Supabase is not configured.");
    return;
  }

  const email = $("#adminEmail").value.trim();
  const password = $("#adminPassword").value;

  showAdminMessage("Signing in...");

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const authorized = await verifyAdmin(data.user);

    if (authorized) {
      $("#adminPassword").value = "";
      showAdminMessage("Admin login successful.");
    }
  } catch (error) {
    console.error("Login error:", error);
    showAdminMessage(`Login failed: ${error.message}`);
  }
}

/* Search, sorting and category controls */
movieGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-movie-id]");
  if (card) {
    openPlayer(
      movies.find((movie) => String(movie.id) === card.dataset.movieId)
    );
  }
});

movieGrid.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;

  const card = event.target.closest("[data-movie-id]");
  if (!card) return;

  event.preventDefault();
  openPlayer(
    movies.find((movie) => String(movie.id) === card.dataset.movieId)
  );
});

searchInput.addEventListener("input", renderMovies);
sortSelect.addEventListener("change", renderMovies);

$("#categoryRow").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;

  activeCategory = button.dataset.category;
  document.querySelectorAll("[data-category]").forEach((chip) => {
    chip.classList.toggle("active", chip === button);
  });

  renderMovies();
});

document.querySelectorAll("[data-category-link]").forEach((link) => {
  link.addEventListener("click", () => {
    activeCategory = link.dataset.categoryLink;

    document.querySelectorAll("[data-category]").forEach((chip) => {
      chip.classList.toggle(
        "active",
        chip.dataset.category === activeCategory
      );
    });

    renderMovies();
  });
});

$("#resetFiltersBtn").addEventListener("click", () => {
  searchInput.value = "";
  activeCategory = "All";

  document.querySelectorAll("[data-category]").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.category === "All");
  });

  renderMovies();
});

$("#heroInfoBtn").addEventListener("click", () => {
  $("#infoModal").showModal();
});

$("#adminOpenBtn").addEventListener("click", openAdmin);
adminForm.addEventListener("submit", loginAdmin);

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialog = document.getElementById(button.dataset.close);
    if (dialog?.open) dialog.close();
  });
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

/* Start the website */
$("#year").textContent = new Date().getFullYear();

if (
  SUPABASE_URL !== "YOUR_SUPABASE_PROJECT_URL" &&
  SUPABASE_ANON_KEY !== "YOUR_SUPABASE_PUBLISHABLE_KEY" &&
  window.supabase
) {
  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}

loadMovies();
