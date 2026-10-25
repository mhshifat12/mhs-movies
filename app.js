/*
 M_H_S Movies frontend
 1) Replace SUPABASE_URL and SUPABASE_ANON_KEY with your own Supabase Project URL
    and publishable/anon key. Never use a service_role secret key in browser code.
 2) Expected movies columns: id, title, description, poster_url, drive_file_id,
    subtitle_url, category, created_at.
 3) Secure admin login and write access require Supabase Auth + RLS policies.
*/
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
const TABLE_NAME = "movies";

const demoMovies = [
  { id:"demo-1", title:"Midnight Run", description:"A late-night journey through a city full of secrets.", category:"Action", poster_url:"", drive_file_id:"", subtitle_url:"", created_at:"2026-01-03" },
  { id:"demo-2", title:"Beyond the Horizon", description:"A young explorer follows a signal beyond the known world.", category:"Drama", poster_url:"", drive_file_id:"", subtitle_url:"", created_at:"2026-01-02" },
  { id:"demo-3", title:"Shadow Protocol", description:"One choice changes the fate of an entire team.", category:"Action", poster_url:"", drive_file_id:"", subtitle_url:"", created_at:"2026-01-01" },
  { id:"demo-4", title:"Anime: New Dawn", description:"A new power awakens when hope seems lost.", category:"Anime", poster_url:"", drive_file_id:"", subtitle_url:"", created_at:"2025-12-30" },
  { id:"demo-5", title:"The Last Laugh", description:"An unexpected friendship turns an ordinary week upside down.", category:"Comedy", poster_url:"", drive_file_id:"", subtitle_url:"", created_at:"2025-12-29" }
];

const $ = (selector) => document.querySelector(selector);
const movieGrid = $("#movieGrid");
const emptyState = $("#emptyState");
const searchInput = $("#searchInput");
const sortSelect = $("#sortSelect");
const connectionStatus = $("#connectionStatus");
const configNotice = $("#configNotice");
let movies = [...demoMovies];
let activeCategory = "All";
let supabaseClient = null;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
}
function driveFileId(value = "") {
  const raw = String(value).trim();
  if (!raw) return "";
  const match = raw.match(/\/file\/d\/([^/?]+)/) || raw.match(/[?&]id=([^&]+)/);
  return match ? match[1] : raw;
}
function toDrivePreview(value = "") {
  const id = driveFileId(value);
  return id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview` : "";
}
function placeholderMarkup(title) {
  const initials = String(title || "M_H_S").trim().split(/\s+/).slice(0,2).map(w=>w[0]||"").join("").toUpperCase();
  return `<div class="poster-placeholder"><div class="poster-symbol">${escapeHtml(initials || "M")}</div><span>M_H_S MOVIES</span></div>`;
}
function renderMovies() {
  const query = searchInput.value.trim().toLowerCase();
  let filtered = movies.filter(movie => {
    const matchesCategory = activeCategory === "All" || String(movie.category || "Other").toLowerCase() === activeCategory.toLowerCase();
    const text = `${movie.title || ""} ${movie.description || ""} ${movie.category || ""}`.toLowerCase();
    return matchesCategory && text.includes(query);
  });
  if (sortSelect.value === "az") filtered.sort((a,b) => String(a.title).localeCompare(String(b.title)));
  else filtered.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  $("#movieCount").textContent = String(movies.length);
  movieGrid.innerHTML = filtered.map(movie => {
    const title = escapeHtml(movie.title || "Untitled movie");
    const category = escapeHtml(movie.category || "Other");
    const poster = String(movie.poster_url || "").trim();
    const posterMarkup = poster
      ? `<img src="${escapeHtml(poster)}" alt="${title} poster" loading="lazy" onerror="this.remove();this.parentElement.insertAdjacentHTML('afterbegin', ${JSON.stringify(placeholderMarkup(movie.title))})">`
      : placeholderMarkup(movie.title);
    const year = movie.release_year ? escapeHtml(movie.release_year) : "";
    return `<article class="movie-card" tabindex="0" role="button" aria-label="Open ${title}" data-movie-id="${escapeHtml(movie.id)}">
      <div class="poster">${posterMarkup}<span class="poster-badge">${category}</span><div class="play-overlay"><span>▶</span></div></div>
      <div class="movie-info"><h3 class="movie-title">${title}</h3><div class="movie-meta"><span class="movie-category">${category}</span><span>${year}</span></div></div>
    </article>`;
  }).join("");
  emptyState.classList.toggle("hidden", filtered.length !== 0);
  movieGrid.classList.toggle("hidden", filtered.length === 0);
}
async function loadMovies() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) {
    connectionStatus.textContent = "Demo mode";
    configNotice.classList.remove("hidden");
    renderMovies();
    return;
  }
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabaseClient.from(TABLE_NAME).select("*").order("created_at", {ascending:false});
    if (error) throw error;
    movies = data || [];
    connectionStatus.textContent = "Connected";
    configNotice.classList.add("hidden");
    renderMovies();
    // Realtime updates require enabling Supabase Realtime for the movies table.
    supabaseClient.channel("movies-live")
      .on("postgres_changes", {event:"*", schema:"public", table:TABLE_NAME}, () => loadMovies())
      .subscribe();
  } catch (error) {
    console.error("Could not load movies:", error);
    connectionStatus.textContent = "Connection issue";
    configNotice.classList.remove("hidden");
    configNotice.querySelector("span").textContent = `Could not load database: ${error.message}. Check the table name, columns, API keys, and SELECT policy.`;
    movies = [...demoMovies];
    renderMovies();
  }
}
function openPlayer(movie) {
  if (!movie) return;
  $("#playerTitle").textContent = movie.title || "Untitled movie";
  const video = $("#videoPlayer");
  const fallback = $("#driveFallback");
  const driveLink = String(movie.drive_file_id || "").trim();
  const subtitle = String(movie.subtitle_url || "").trim();
  const id = driveFileId(driveLink);
  video.pause();
  video.removeAttribute("src");
  video.querySelectorAll("source, track").forEach(el => el.remove());
  video.load();
  fallback.classList.add("hidden");
  video.classList.remove("hidden");
  $("#subtitleStatus").textContent = subtitle ? "Subtitle track added. Open player captions/CC controls to select it." : "No separate subtitle track was added for this movie.";
  if (!id) {
    fallback.classList.remove("hidden");
    video.classList.add("hidden");
    $("#driveOpenLink").href = "#";
    $("#driveOpenLink").onclick = e => e.preventDefault();
  } else {
    // Drive preview embed is more reliable than treating a Drive share URL as a raw MP4.
    // Use the preview iframe fallback because Google Drive doesn't guarantee a direct media URL.
    fallback.classList.remove("hidden");
    video.classList.add("hidden");
    $("#driveOpenLink").href = toDrivePreview(id);
    $("#driveOpenLink").onclick = null;
    $("#subtitleStatus").textContent = "Google Drive preview opens separately. Separate CC tracks work only when the video is available as a direct media source.";
  }
  $("#playerModal").showModal();
}
movieGrid.addEventListener("click", event => {
  const card = event.target.closest("[data-movie-id]");
  if (card) openPlayer(movies.find(m => String(m.id) === card.dataset.movieId));
});
movieGrid.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-movie-id]");
  if (card) { event.preventDefault(); openPlayer(movies.find(m => String(m.id) === card.dataset.movieId)); }
});
searchInput.addEventListener("input", renderMovies);
sortSelect.addEventListener("change", renderMovies);
$("#categoryRow").addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  document.querySelectorAll("[data-category]").forEach(chip => chip.classList.toggle("active", chip === button));
  renderMovies();
});
document.querySelectorAll("[data-category-link]").forEach(link => link.addEventListener("click", () => {
  activeCategory = link.dataset.categoryLink;
  document.querySelectorAll("[data-category]").forEach(chip => chip.classList.toggle("active", chip.dataset.category === activeCategory));
  renderMovies();
}));
$("#resetFiltersBtn").addEventListener("click", () => {
  searchInput.value = "";
  activeCategory = "All";
  document.querySelectorAll("[data-category]").forEach(chip => chip.classList.toggle("active", chip.dataset.category === "All"));
  renderMovies();
});
$("#heroInfoBtn").addEventListener("click", () => $("#infoModal").showModal());
$("#adminOpenBtn").addEventListener("click", () => {
  $("#adminMessage").textContent = supabaseClient ? "Admin sign-in wiring is the next setup step." : "Configure Supabase first; do not use a hard-coded password.";
  $("#adminModal").showModal();
});
$("#adminLoginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const message = $("#adminMessage");
  if (!supabaseClient) {
    message.textContent = "Supabase is not configured yet. Add the project URL and anon/publishable key in app.js.";
    return;
  }
  message.textContent = "Authentication setup is not enabled in this frontend yet. Configure Supabase Auth and admin access policies before adding movies.";
  // Intentionally no fake client-side password check. Add supabaseClient.auth.signInWithPassword
  // after enabling Supabase Auth and assigning admin-only database permissions.
});
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
  const dialog = document.getElementById(button.dataset.close);
  if (dialog?.open) dialog.close();
}));
document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
}));
$("#year").textContent = new Date().getFullYear();
loadMovies();
