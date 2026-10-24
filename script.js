const SITE_CONFIG = {
  serverIp: "play.redeplaystex.com:7777",
  discordUrl: "https://discord.gg/B2gHbcpqfA",
  instagramUrl: "",
  youtubeUrl: "",
  statusApiUrl: "https://rede-play-stex-api.vinny-fernandessoares.workers.dev/api/server/status",
  localStatusApiUrl: "http://127.0.0.1:3031/api/server/status",
  statusRefreshMs: 15_000,
};

const header = document.querySelector(".site-header");
const menuButton = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");
const toast = document.querySelector(".toast");
let toastTimer;

document.querySelectorAll("[data-server-ip]").forEach((element) => {
  element.textContent = SITE_CONFIG.serverIp;
});

document.querySelectorAll("[data-toast-ip]").forEach((element) => {
  element.textContent = SITE_CONFIG.serverIp;
});

document.querySelectorAll(".discord-link").forEach((link) => {
  if (link.getAttribute("href") !== "#comunidade") {
    link.href = SITE_CONFIG.discordUrl;
  }
});

const socialNetworks = {
  discord: { name: "Discord", url: SITE_CONFIG.discordUrl },
  instagram: { name: "Instagram", url: SITE_CONFIG.instagramUrl },
  youtube: { name: "YouTube", url: SITE_CONFIG.youtubeUrl },
};

document.querySelectorAll("[data-social-link]").forEach((link) => {
  const network = socialNetworks[link.dataset.socialLink];
  if (!network?.url) return;

  link.href = network.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = network.name;
  link.setAttribute("aria-label", `${network.name} da Rede Play Stex (abre em nova aba)`);
  link.removeAttribute("aria-disabled");
  link.removeAttribute("tabindex");
});

document.querySelector("[data-current-year]").textContent = new Date().getFullYear();

const showToast = () => {
  clearTimeout(toastTimer);
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
};

const copyServerIp = async () => {
  try {
    await navigator.clipboard.writeText(SITE_CONFIG.serverIp);
  } catch {
    const input = document.createElement("textarea");
    input.value = SITE_CONFIG.serverIp;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  showToast();
};

document.querySelectorAll(".copy-ip").forEach((button) => {
  button.addEventListener("click", copyServerIp);
});

menuButton.addEventListener("click", () => {
  const open = mainNav.classList.toggle("open");
  document.body.classList.toggle("menu-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
});

mainNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    document.body.classList.remove("menu-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Abrir menu");
  });
});

const updateHeader = () => {
  header.classList.toggle("scrolled", window.scrollY > 24);
};

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
