/* repos.js — "More on GitHub": fetches public repos live from the GitHub API. */
import { CONFIG } from './config.js';

const CACHE_KEY = 'gh-repos-v1';
const CACHE_MS = 10 * 60 * 1000; // 10 minutes, keeps well under the anonymous rate limit

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

function readCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    if (c && c.user === CONFIG.githubUser && Date.now() - c.t < CACHE_MS) return c.data;
  } catch { /* ignore */ }
  return null;
}
function writeCache(data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ user: CONFIG.githubUser, t: Date.now(), data })); } catch { /* ignore */ }
}

async function fetchRepos(signal) {
  const cached = readCache();
  if (cached) return cached;
  const url = `https://api.github.com/users/${encodeURIComponent(CONFIG.githubUser)}/repos?per_page=100&sort=pushed`;
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' }, signal });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  writeCache(data);
  return data;
}

function render(list, repos) {
  const hidden = new Set(CONFIG.hideRepos.map((n) => n.toLowerCase()));
  const items = repos
    .filter((r) => !r.fork && !r.archived && !hidden.has(r.name.toLowerCase()))
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
    .slice(0, CONFIG.maxRepos);

  list.replaceChildren();
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'repo-list__note';
    li.textContent = 'No other public repositories to show yet.';
    list.append(li);
    return;
  }

  items.forEach((r, i) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'repo';
    a.href = r.html_url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.dataset.cursor = 'Open';
    a.style.setProperty('--i', i);

    const name = document.createElement('span');
    name.className = 'repo__name';
    name.textContent = r.name;

    const desc = document.createElement('span');
    desc.className = 'repo__desc' + (r.description ? '' : ' repo__desc--empty');
    desc.textContent = r.description || 'No description yet';

    const lang = document.createElement('span');
    lang.className = 'repo__lang';
    lang.textContent = r.language || '';

    const date = document.createElement('span');
    date.className = 'repo__date';
    date.textContent = 'Updated ' + fmtDate(r.pushed_at);

    a.append(name, desc, lang, date);
    li.append(a);
    list.append(li);
  });
}

export function initRepos() {
  const list = document.getElementById('repo-list');
  if (!list || !CONFIG.githubUser) return;
  const ctrl = new AbortController();

  const fail = () => {
    list.replaceChildren();
    const li = document.createElement('li');
    li.className = 'repo-list__note';
    li.append('Could not load repositories right now. ');
    const a = document.createElement('a');
    a.className = 'link';
    a.href = `https://github.com/${encodeURIComponent(CONFIG.githubUser)}?tab=repositories`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'View them on GitHub';
    li.append(a);
    list.append(li);
  };

  fetchRepos(ctrl.signal)
    .then((data) => render(list, data))
    .catch((err) => { if (err.name !== 'AbortError') fail(); })
    .finally(() => list.setAttribute('aria-busy', 'false'));

  return { destroy: () => ctrl.abort() };
}
