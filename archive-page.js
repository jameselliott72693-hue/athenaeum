(function () {
  const D = window.AthenaeumDocket;
  const $ = (id) => document.getElementById(id);

  function applyTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    const button = $("theme");
    if (!button) return;
    button.textContent = dark ? "Light" : "Dark";
    button.setAttribute("aria-pressed", dark ? "true" : "false");
    try { localStorage.setItem("athenaeum.theme", dark ? "dark" : "light"); } catch (err) { /* ignore */ }
  }

  async function boot() {
    const theme = (() => { try { return localStorage.getItem("athenaeum.theme"); } catch (err) { return null; } })();
    const prefer = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(theme === "dark" || theme === "light" ? theme : prefer);
    $("theme").addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
    const [indexRes, archiveRes] = await Promise.all([
      fetch("docket/index.json"),
      fetch("docket/archive.json")
    ]);
    if (!indexRes.ok) throw new Error("missing docket index");
    const index = await indexRes.json();
    let stored = [];
    if (archiveRes.ok) {
      const archive = await archiveRes.json();
      stored = (archive && archive.nights) || [];
    }
    const nights = D.archivedNights(index.nights || [], stored);
    const host = $("archive");
    host.removeAttribute("aria-busy");
    host.innerHTML = `<p class="kicker">Older nights</p>
      <h2>The archive</h2>
      <p class="lede">Nights older than 30 days leave the menu and stay here. Each one still opens.</p>
      ${D.archiveListHtml(nights)}`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    boot().catch((err) => {
      const host = $("archive");
      if (host) host.innerHTML = `<p class="err">The archive could not be loaded. Open this page through the site, not as a loose file.</p>`;
      console.error(err);
    });
  });
})();
