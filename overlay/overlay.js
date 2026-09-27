const DEFAULT_API_URL = "https://beachffswapi.vercel.app/api";
const LCEDIT_API_URL = "https://beachffswlcedit.quan13dash.workers.dev/api/";
const requestedServer = new URLSearchParams(window.location.search).get("server");
const API_URL = (requestedServer === "lcedit" ? LCEDIT_API_URL : DEFAULT_API_URL).replace(/\/+$/, "");
const REFRESH_INTERVAL = 15000;
const leaderboard = document.querySelector("#leaderboard");
const displayedCounts = new Map();
const gainHistory = new Map();
const fireStates = new Map();
let fetchCount = 0;

const FIRE_TIERS = [
  { name: "Rainbow ring", threshold: 200000, image: "https://i.ibb.co/xKdVkYzV/rainring.gif", color: "#FFFFFF" },
  { name: "Rainbow", threshold: 100000, image: "https://i.ibb.co/HDpH0YJ2/rainbowmdm.gif", color: "#FFFFFF" },
  { name: "Purple", threshold: 75000, image: "https://i.ibb.co/Cp16dWXC/Purpleflamemdm.gif", color: "#FFFFFF" },
  { name: "Blue", threshold: 50000, image: "https://i.ibb.co/zWzJwGqc/blueflamemdm.gif", color: "#FFFFFF" },
  { name: "Green", threshold: 35000, image: "https://i.ibb.co/Y7dmJxmJ/greenflame.gif", color: "#FFFFFF" },
  { name: "Red", threshold: 20000, image: "https://i.ibb.co/kVxBm84Q/redflame.gif", color: "#FFFFFF" },
  { name: "Yellow", threshold: 15000, image: "https://i.ibb.co/b5mw2kqc/yellowflame.gif", color: "#FFFFFF" },
  { name: "Dark", threshold: 10000, image: "https://i.ibb.co/YT04hFKn/mediumbigflamemdm.gif", color: "#FFFFFF" },
  { name: "Orange", threshold: 5000, image: "https://i.ibb.co/tw5fVtpx/mediumflamemdm.gif", color: "#FFFFFF" },
  { name: "Full", threshold: 2000, image: "https://i.ibb.co/LDCFxrFv/2kbar.png", color: "#864A29" },
  { name: "Half", threshold: 1000, image: "https://i.ibb.co/svsgSC4S/image.png", color: "#986A2E" }
];
const BLOOD_FIRE = { name: "Blood", image: "https://i.ibb.co/M5p7RYr5/9tndnw.gif", color: "#FFFFFF" };

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", "\"":"&quot;" }[character]));
}

function normalizeApi(item, index) {
  const source = typeof item === "string" ? { id: item } : item || {};
  const image = typeof source.image === "string" && !source.image.includes("example.com") ? source.image : "";
  const banner = typeof source.banner === "string" && !source.banner.includes("example.com") ? source.banner : "";
  return {
    id: source.id || source.slug || `channel-${index}`,
    roundcount: Number(source.roundcount ?? 0),
    name: source.name || source.title || source.id || `Channel ${index + 1}`,
    image,
    banner,
    icon: source.icon || "↗"
  };
}

function updateGainHistory(items) {
  items.forEach(api => {
    const previous = gainHistory.get(api.id);
    if (previous) {
      const gains = previous.gains;
      gains.push(api.roundcount - previous.count);
      if (gains.length > 10) gains.shift();
      previous.count = api.roundcount;
    } else {
      gainHistory.set(api.id, { count: api.roundcount, gains: [] });
    }
  });
}

function getFireFor(api) {
  const history = gainHistory.get(api.id);
  const averageGain = history?.gains.length ? history.gains.reduce((sum, gain) => sum + gain, 0) / history.gains.length : 0;
  const hourlyGain = averageGain * 60;
  if (hourlyGain <= -1) return { ...BLOOD_FIRE, hourlyGain };
  const tier = FIRE_TIERS.find(candidate => hourlyGain >= candidate.threshold);
  return tier ? { ...tier, hourlyGain } : null;
}

function updateFireStates(items) {
  if (fetchCount !== 1 && fetchCount % 4 !== 0) return;
  items.forEach(api => fireStates.set(api.id, getFireFor(api)));
}

function render(items) {
  const top50 = items.sort((a, b) => b.roundcount - a.roundcount).slice(0, 50);
  leaderboard.innerHTML = top50.map((api, index) => {
    const previous = displayedCounts.get(api.id) ?? api.roundcount;
    displayedCounts.set(api.id, api.roundcount);
    const bannerStyle = api.banner ? ` style="--banner-image:url('${escapeHtml(api.banner)}')"` : "";
    const visual = api.image ? `<img src="${escapeHtml(api.image)}" alt="">` : `<span>${escapeHtml(api.icon)}</span>`;
    const fire = fireStates.get(api.id);
    const fireMarkup = fire ? `<span class="fire-visual" title="${escapeHtml(fire.name)} fire"><img src="${fire.image}" alt="${escapeHtml(fire.name)} fire"></span>` : "";
    const medalClass = index === 0 ? "medal-gold" : index === 1 ? "medal-silver" : index === 2 ? "medal-bronze" : "";
    return `<article class="entry ${medalClass}"${bannerStyle}><span class="rank-wrap">${fireMarkup}<span class="rank" style="--rank-color:${fire?.color || "#858d89"}">${index + 1}</span></span><div class="channel-visual">${visual}</div><div class="channel-info"><strong>${escapeHtml(api.name)}</strong><span class="count" data-from="${previous}" data-to="${api.roundcount}" title="${escapeHtml(api.name)}">${previous}</span></div></article>`;
  }).join("");
  animateCounts();
}

function animateCounts() {
  document.querySelectorAll(".count[data-from]").forEach(element => {
    const from = Number(element.dataset.from);
    const to = Number(element.dataset.to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return;
    if (typeof Odometer === "undefined") {
      element.textContent = to.toLocaleString("en-US");
      return;
    }
    element.textContent = from;
    element.odometer = new Odometer({ el: element, value: from, format: "(,ddd)", theme: "default" });
    element.odometer.update(to);
  });
}

async function loadLeaderboard() {
  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("API unavailable");
    const payload = await response.json();
    const ids = Array.isArray(payload) ? payload : payload.data || payload.apis || payload.results || [];
    const records = await Promise.all(ids.map(async (item, index) => {
      const id = typeof item === "string" ? item : item.id || item.slug;
      if (!id) return normalizeApi(item, index);
      const detail = await fetch(`${API_URL}/${encodeURIComponent(id)}.json`, { cache: "no-store" });
      if (!detail.ok) throw new Error("Record unavailable");
      return normalizeApi(await detail.json(), index);
    }));
    fetchCount += 1;
    updateGainHistory(records);
    updateFireStates(records);
    render(records);
  } catch {
    if (!leaderboard.children.length) {
      render([]);
    }
  }
}

render([]);
loadLeaderboard();
setInterval(loadLeaderboard, REFRESH_INTERVAL);

function updateUtcClock() {
  const clock = document.querySelector("#utc-clock");
  if (!clock) return;
  clock.textContent = `UTC ${new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date())}`;
}

updateUtcClock();
setInterval(updateUtcClock, 1000);
