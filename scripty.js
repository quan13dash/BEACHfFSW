const API_URL = "https://beachffswapi.vercel.app/api";
const fallbackApis = [
	{ id:"payments", name:"Payments", icon:"$", description:"Channel contender", count:2400000, roundcount:2400000, views:0, videos:0 },
	{ id:"identity", name:"Identity", icon:"◎", description:"Channel contender", count:891000, roundcount:891000, views:0, videos:0 }
];
const list = document.querySelector("#leaderboard-list");
const leaderboard = document.querySelector("#leaderboard-view");
const details = document.querySelector("#details");
let APIs = [];
let loading = false;
let activeProfileId = null;
const displayedCounts = new Map();
let abbreviateViews = localStorage.getItem("abbreviate-views") === "true";
let bannerBlurEnabled = localStorage.getItem("banner-blur") === "true";

function getCountKey(prefix, id) { return `${prefix}:${id}`; }
function formatNumber(value) { return new Intl.NumberFormat("en", { notation:"compact", maximumFractionDigits:1 }).format(value); }
function formatViews(value) { return abbreviateViews ? formatNumber(value) : new Intl.NumberFormat("en").format(value); }
function updateOdometerCount(element, newValue, key) {
	const previousValue = displayedCounts.get(key) ?? 0;
	if (!Number.isFinite(newValue)) return;
	displayedCounts.set(key, newValue);
	if (typeof Odometer === "undefined") {
		element.textContent = newValue;
		return;
	}
	element.textContent = previousValue;
	element.odometer = new Odometer({ el:element, value:previousValue, format:"(,ddd)", theme:"default" });
	element.odometer.update(newValue);
}
function animateCounts() {
	document.querySelectorAll(".odometer").forEach(element => {
		if (element.dataset.odometerReady === "true") return;
		const key = element.dataset.countKey;
		if (!key) return;
		updateOdometerCount(element, Number(element.dataset.value), key);
		element.dataset.odometerReady = "true";
	});
}
function normalizeApi(item, index) {
	const image = typeof item.image === "string" && !item.image.includes("example.com") ? item.image : null;
	const banner = typeof item.banner === "string" && !item.banner.includes("example.com") ? item.banner : null;
	return { id:item.id || item.slug || `channel-${index}`, name:item.name || item.title || `Channel ${index + 1}`, username:item.username || "", icon:item.icon || "↗", description:item.description || "Channel", country:item.country || "", contenttype:item.contenttype || "", count:Number(item.count ?? item.requests ?? 0), roundcount:Number(item.roundcount ?? item.count ?? 0), views:Number(item.views ?? 0), videos:Number(item.videos ?? 0), image, banner };
}
function renderLeaderboard(items) {
	const query = document.querySelector("#search").value.toLowerCase();
	const filtered = items.filter(api => `${api.name} ${api.description}`.toLowerCase().includes(query)).sort((a, b) => b.count - a.count);
	document.querySelector("#api-count").textContent = filtered.length;
	list.innerHTML = filtered.length ? filtered.map((api, index) => `<article class="leaderboard-row ${index < 3 ? `podium-${index + 1}` : ""}" data-api="${api.id}" tabindex="0"><span class="rank ${index < 3 ? `podium-rank-${index + 1}` : ""}">${index === 0 ? "♛" : `#${index + 1}`}</span><div class="api-name"><div class="api-icon">${api.image ? `<img src="${api.image}" alt="">` : api.icon}</div><div class="api-copy"><strong>${api.name}</strong><small>${api.username ? `@${api.username}` : index === 0 ? "Current leader" : index < 3 ? "On the podium" : "In the running"}</small></div></div><div class="row-value"><strong><span class="odometer" data-value="${api.roundcount}" data-count-key="${getCountKey("leaderboard", api.id)}">0</span></strong></div><div class="row-value"><strong>${formatViews(api.views)}</strong></div><div class="row-value"><strong>${formatNumber(api.videos)}</strong></div><span class="status">Competing</span></article>`).join("") : "<div class=\"empty-state\">No channels match your search.</div>";
	animateCounts();
	document.querySelectorAll(".leaderboard-row").forEach(row => {
		row.addEventListener("click", () => showDetails(row.dataset.api));
		row.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") showDetails(row.dataset.api); });
	});
}
function applyBannerBlur() {
	const heroes = document.querySelectorAll(".profile-hero");
	heroes.forEach(hero => hero.classList.toggle("banner-blur", bannerBlurEnabled));
}
function showDetails(id) {
	const api = APIs.find(item => item.id === id); if (!api) return;
	activeProfileId = id;
	const standing = APIs.slice().sort((a, b) => b.count - a.count).findIndex(item => item.id === api.id) + 1;
	details.innerHTML = `<button class="back-button" type="button" id="back">← Back to standings</button><div class="profile-hero ${standing <= 3 ? `podium-profile-${standing}` : ""} ${bannerBlurEnabled ? "banner-blur" : ""}" ${api.banner ? `style="--profile-banner:url('${api.banner}')"` : ""}><div class="detail-head"><div class="detail-title"><div class="profile-image">${api.image ? `<img src="${api.image}" alt="${api.name} profile picture">` : api.icon}</div><div><p class="kicker">Channel profile</p><h1>${api.name}</h1><p>${api.username ? `@${api.username}` : ""}</p></div></div></div></div><div class="metrics"><div class="metric" style="grid-column:span 2;background:var(--green-soft);border-color:var(--green)"><div class="metric-label">Current subscribers</div><div class="metric-value" style="font-size:clamp(44px,8vw,82px);line-height:.9;color:var(--green)"><span class="odometer" data-value="${api.roundcount}" data-count-key="${getCountKey("profile", api.id)}">0</span></div><div class="metric-trend">Unabbreviated</div></div><div class="metric"><div class="metric-label">Standing</div><div class="metric-value">#${standing}</div><div class="metric-trend">In ${APIs.length} channels</div></div><div class="metric"><div class="metric-label">Views</div><div class="metric-value">${formatViews(api.views)}</div><div class="metric-trend">All time</div></div><div class="metric"><div class="metric-label">Videos</div><div class="metric-value">${formatNumber(api.videos)}</div><div class="metric-trend">Include shorts & streams</div></div></div><div class="analytics-grid"><div class="chart-panel"><div class="panel-heading"><h2>Channel profile</h2><span>${api.contenttype || "Live contender"}</span></div><div class="chart-labels"><span>Description</span><strong>${api.description}</strong></div></div><div class="activity-panel"><div class="panel-heading"><h2>About this channel</h2></div><div class="activity-list"><div class="activity"><strong>Country</strong><span>${api.country || "Not provided"}</span></div><div class="activity"><strong>Content type</strong><span>${api.contenttype || "Not provided"}</span></div></div></div></div>`;
	applyBannerBlur();
	animateCounts();
	leaderboard.classList.add("hidden"); details.classList.add("visible"); document.querySelector("#crumb").textContent = api.name; document.querySelector("#back").addEventListener("click", showLeaderboard); window.scrollTo({ top:0, behavior:"smooth" });
}
function showLeaderboard() { activeProfileId = null; details.classList.remove("visible"); leaderboard.classList.remove("hidden"); document.querySelector("#crumb").textContent = "Live leaderboard"; }
async function loadApis() {
	if (loading) return;
	loading = true;
	try {
		const response = await fetch(API_URL); if (!response.ok) throw new Error("API unavailable");
		const payload = await response.json(); const ids = Array.isArray(payload) ? payload : payload.data || payload.apis || payload.results || [];
		APIs = (await Promise.all(ids.map(async (id, index) => { const detail = await fetch(`${API_URL}/${encodeURIComponent(id)}.json`); if (!detail.ok) throw new Error("Record unavailable"); return normalizeApi(await detail.json(), index); }))).sort((a, b) => b.count - a.count);
	} catch (error) { APIs = fallbackApis.map(normalizeApi).sort((a, b) => b.count - a.count); }
	renderLeaderboard(APIs);
	if (activeProfileId && details.classList.contains("visible")) showDetails(activeProfileId);
	loading = false;
}
document.querySelector("#search").addEventListener("input", () => renderLeaderboard(APIs));
document.querySelector("#refresh-button").addEventListener("click", loadApis);
const themeToggle = document.querySelector("#theme-toggle");
function setTheme(theme) {
	document.body.classList.toggle("dark-mode", theme === "dark");
	themeToggle.checked = theme === "dark";
	localStorage.setItem("arena-theme", theme);
}
themeToggle.addEventListener("change", () => setTheme(themeToggle.checked ? "dark" : "light"));
setTheme(localStorage.getItem("arena-theme") || "light");
const leaderboardNav = document.querySelector("#leaderboard-nav");
const settingsNav = document.querySelector("#settings-nav");
const settingsPanel = document.querySelector("#settings-panel");
function showView(view) {
	const settingsVisible = view === "settings";
	settingsPanel.classList.toggle("visible", settingsVisible);
	leaderboard.classList.toggle("hidden", settingsVisible);
	details.classList.remove("visible");
	leaderboardNav.classList.toggle("active", !settingsVisible);
	settingsNav.classList.toggle("active", settingsVisible);
	document.querySelector("#crumb").textContent = settingsVisible ? "Settings" : "Live leaderboard";
}
leaderboardNav.addEventListener("click", () => showView("leaderboard"));
settingsNav.addEventListener("click", () => showView("settings"));
const abbreviateToggle = document.querySelector("#abbreviate-views");
abbreviateToggle.checked = abbreviateViews;
abbreviateToggle.addEventListener("change", () => {
	abbreviateViews = abbreviateToggle.checked;
	localStorage.setItem("abbreviate-views", abbreviateViews);
	renderLeaderboard(APIs);
});
const bannerBlurToggle = document.querySelector("#banner-blur");
if (bannerBlurToggle) {
	bannerBlurToggle.checked = bannerBlurEnabled;
	bannerBlurToggle.addEventListener("change", () => {
		bannerBlurEnabled = bannerBlurToggle.checked;
		localStorage.setItem("banner-blur", bannerBlurEnabled);
		applyBannerBlur();
		if (activeProfileId && details.classList.contains("visible")) {
			showDetails(activeProfileId);
		}
	});
}
loadApis();
setInterval(loadApis, 20000);
