// ==UserScript==
// @name         GitLab MR Helper
// @namespace    https://github.com/Cerzat43/gitlab-mr-helper
// @version      0.2.1
// @description  Marque les MRs comme vues (grisées), remet en avant celles qui ont bougé depuis, et met en retrait les vôtres.
// @author       Cerzat43
// @homepageURL  https://github.com/Cerzat43/gitlab-mr-helper
// @supportURL   https://github.com/Cerzat43/gitlab-mr-helper/issues
// @downloadURL  https://raw.githubusercontent.com/Cerzat43/gitlab-mr-helper/main/gitlab-mr-helper.user.js
// @updateURL    https://raw.githubusercontent.com/Cerzat43/gitlab-mr-helper/main/gitlab-mr-helper.user.js
// @match        https://gitlab.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

'use strict';

/* ------------------------------------------------------------------ *
 * Couche logique pure (testable sans navigateur)
 * ------------------------------------------------------------------ */

// Vrai uniquement sur les listes de MRs (projet, groupe, dashboard),
// jamais sur une page de détail de MR. Tolère un pathname seul, un
// pathname avec query/fragment (ex. ?sort=created_date), ou une URL
// absolue : on isole le pathname avant de tester.
function isMrListUrl(pathname) {
  let path = pathname;
  try { path = new URL(pathname, 'http://x').pathname; } catch (e) { /* on garde tel quel */ }
  return /\/-\/merge_requests\/?$/.test(path)
    || /^\/dashboard\/merge_requests\/?$/.test(path);
}

// Extrait le premier segment de chemin d'un href (= username GitLab).
// Accepte un chemin relatif (/alice) ou une URL absolue (https://gitlab.com/alice).
// Renvoie null si l'href est vide ou null.
function usernameFromHref(href) {
  if (!href) return null;
  let path = href;
  try { path = new URL(href).pathname; } catch (e) { /* chemin relatif : on garde href tel quel */ }
  const match = path.match(/^\/?([^/?#]+)/);
  return match ? match[1] : null;
}

// Labels qui empêchent une MR d'être considérée « prête à merger » :
// tout label scoped « Status::… » et le label « Don't merge ». Les libellés
// webedia portent souvent un préfixe décoratif (ex. « ✗ Don't merge »,
// « Status::📁 Needs review ») : on retire les caractères non-alphabétiques
// de tête avant de tester. Apostrophe droite/typographique/absente tolérées.
// Les autres labels (catégorie, Deploy::…) ne bloquent pas.
function isBlockingLabel(name) {
  if (!name) return false;
  const n = String(name).replace(/^[^\p{L}]+/u, '').toLowerCase();
  return n.startsWith('status::') || /^don['’]?t\s+merge/.test(n);
}

// Détermine l'état visuel d'une MR. Priorité : ready > seen/changed > mine > neutral.
//   - 'ready'   : approuvée ET sans aucun label bloquant -> prête à merger (vert)
//   - le marquage « vue » mémorise le jeton de dernière activité (updateToken) :
//       jeton identique -> 'seen' (rien n'a bougé, on grise)
//       jeton différent -> 'changed' (activité depuis la dernière vue, mise en avant ambre)
//   - 'mine'    : l'utilisateur courant est l'auteur (en retrait)
//   - 'neutral' : aucun des cas ci-dessus
// - mr          : { key, author, updateToken, approved, labels: [string] }
// - currentUser : username de l'utilisateur courant, ou null si inconnu
// - seenMap     : objet { cléMR: updateToken mémorisé }
function classifyMr(mr, currentUser, seenMap) {
  if (mr.approved && !(mr.labels || []).some(isBlockingLabel)) return 'ready';
  if (mr.key && seenMap && mr.key in seenMap) {
    return seenMap[mr.key] === mr.updateToken ? 'seen' : 'changed';
  }
  if (currentUser && mr.author === currentUser) return 'mine';
  return 'neutral';
}

// Crée un store des MRs vues au-dessus d'un adaptateur de stockage.
// La valeur mémorisée par MR est son jeton de dernière activité (updateToken).
// storage : { get(key, default), set(key, value) }
function createSeenStore(storage) {
  const STORAGE_KEY = 'seenMrs';
  const load = () => storage.get(STORAGE_KEY, {}) || {};
  const save = (map) => storage.set(STORAGE_KEY, map);
  return {
    all: () => load(),
    isSeen: (mrKey) => mrKey in load(),
    count: () => Object.keys(load()).length,
    markSeen: (mrKey, token) => { const m = load(); m[mrKey] = token; save(m); },
    unmarkSeen: (mrKey) => { const m = load(); delete m[mrKey]; save(m); },
    // toggle sensible au jeton : même jeton -> on désélectionne ; jeton
    // différent (la MR a bougé) -> on ré-acquitte avec le nouveau jeton.
    toggle: (mrKey, token) => {
      const m = load();
      if (m[mrKey] === token) { delete m[mrKey]; save(m); return false; }
      m[mrKey] = token; save(m); return true;
    },
    clear: () => save({}),
  };
}

/* ------------------------------------------------------------------ *
 * Couche navigateur (vérifiée manuellement sur gitlab.com)
 * ------------------------------------------------------------------ */

// Adaptateur branchant le store sur le stockage Tampermonkey.
const gmStorage = {
  get: (key, def) => GM_getValue(key, def),
  set: (key, value) => GM_setValue(key, value),
};

// Détecte le username de l'utilisateur connecté.
// 1) objet gon injecté par GitLab ; 2) fallback sur le menu utilisateur ;
// 3) null si rien n'est trouvé (les états mine/review sont alors désactivés).
function detectCurrentUser() {
  try {
    const g = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).gon;
    if (g && g.current_username) return g.current_username;
  } catch (e) { /* gon inaccessible : on tente le fallback */ }

  const menu = document.querySelector(
    '[data-testid="user-menu-toggle"], .header-user-dropdown-toggle'
  );
  if (menu) {
    const href = menu.getAttribute('href')
      || (menu.querySelector('a') && menu.querySelector('a').getAttribute('href'));
    const fromHref = usernameFromHref(href);
    if (fromHref) return fromHref;
  }
  return null;
}

// Sélecteurs dépendant du markup GitLab, centralisés pour faciliter
// les mises à jour. Validés sur gitlab.com (le 1er de chaque liste est
// celui réellement observé ; les suivants sont des replis défensifs).
const SELECTORS = {
  listContainer: 'ul.issuable-list, ul.mr-list, [data-testid="issuable-list"]',
  row: 'li.merge-request, li.issuable-row, [data-testid="issuable-item"]',
  titleLink: '[data-testid="issuable-title-link"], .merge-request-title-text a, a.title',
  authorLink: '[data-testid="issuable-author"], .author-link',
  // Horodatage de dernière activité : un bouton dont le title/aria-label
  // porte la date absolue (texte visible = relatif « mis à jour il y a … »).
  timestamp: '[data-testid="issuable-timestamp"]',
  // Approbation : le widget porte une icône check-circle (approuvée) ou
  // approval-solid (approuvée, dont par l'utilisateur courant). dash-circle =
  // non approuvée. On considère les deux premières comme « approuvée ».
  approvedIcon: '[data-testid="mr-approvals"] [data-testid="check-circle-icon"], [data-testid="mr-approvals"] [data-testid="approval-solid-icon"]',
  // Labels de la ligne (un lien par label).
  label: 'a.gl-label-link, a[href*="label_name"]',
};

// Lit le jeton de dernière activité d'une ligne : la date absolue portée par
// le title/aria-label de l'horodatage. Sert de marqueur de version opaque
// (comparaison de chaînes, pas de parsing de date). null si introuvable.
function updateTokenFromRow(row) {
  const el = row.querySelector(SELECTORS.timestamp);
  if (!el) return null;
  return el.getAttribute('title') || el.getAttribute('aria-label') || null;
}

// Liste les noms exacts des labels d'une ligne. Le nom complet (incl. le
// scope « Status::… ») est lu depuis le paramètre `label_name[]` du href du
// lien, plus fiable que le texte affiché ; repli sur le texte normalisé.
function labelNamesFromRow(row) {
  return Array.from(row.querySelectorAll(SELECTORS.label)).map((a) => {
    try {
      const fromQuery = new URL(a.getAttribute('href') || '', location.origin)
        .searchParams.get('label_name[]');
      if (fromQuery) return fromQuery;
    } catch (e) { /* href non parsable : on retombe sur le texte */ }
    return (a.textContent || '').replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
}

// Extrait les données d'une ligne de MR. Renvoie null si le markup est
// inattendu (la ligne sera alors ignorée sans casser les autres).
function parseRow(row) {
  const titleLink = row.querySelector(SELECTORS.titleLink);
  if (!titleLink || !titleLink.getAttribute('href')) return null;

  // href pathologique (#, javascript:, vide résolu) -> on ignore la ligne
  // plutôt que de stocker une clé inutile comme "/".
  let key;
  try {
    key = new URL(titleLink.href, location.origin).pathname;
  } catch (e) {
    return null;
  }
  if (!key || key === '/') return null;

  const authorLink = row.querySelector(SELECTORS.authorLink);
  const author = authorLink ? usernameFromHref(authorLink.getAttribute('href')) : null;

  return {
    key,
    author,
    updateToken: updateTokenFromRow(row),
    approved: Boolean(row.querySelector(SELECTORS.approvedIcon)),
    labels: labelNamesFromRow(row),
  };
}

// Injecte la feuille de style une seule fois.
function injectStyles() {
  if (document.getElementById('mrh-styles')) return;
  const style = document.createElement('style');
  style.id = 'mrh-styles';
  style.textContent = `
    [data-mrh-state="seen"]    { opacity: .45; filter: grayscale(.6); }
    /* « ready » = approuvée + sans label -> prête à merger (vert). */
    [data-mrh-state="ready"]   { border-left: 3px solid #108548 !important;
                                 background: rgba(16,133,72,.10); }
    /* « changed » = activité depuis la dernière vue -> mise en avant (ambre). */
    [data-mrh-state="changed"] { border-left: 3px solid #c17d10 !important;
                                 background: rgba(193,125,16,.10); }
    /* « mine » = mes propres MRs : en retrait + accent pointillé distinct. */
    [data-mrh-state="mine"]    { opacity: .6;
                                 border-left: 3px dashed var(--gl-border-color-strong, #b3b3b3) !important; }
    .mrh-eye {
      cursor: pointer; border: 0; background: transparent; font-size: 16px;
      line-height: 1; padding: 2px 6px; margin-left: 8px; opacity: .55;
    }
    .mrh-eye:hover { opacity: 1; }
    .mrh-eye[data-seen="1"] { opacity: 1; }
    /* Couleurs via les design tokens GitLab (--gl-*) : s'adaptent au thème
       clair/sombre. Les valeurs en repli servent si les tokens sont absents. */
    .mrh-bar {
      display: flex; align-items: center; gap: 12px;
      padding: 6px 12px; margin: 8px 0; font-size: 13px;
      color: var(--gl-text-color-default, #303030);
      background: var(--gl-background-color-subtle, #fafafa);
      border: 1px solid var(--gl-border-color-default, #dbdbdb);
      border-radius: 4px;
    }
    .mrh-bar button {
      cursor: pointer; padding: 3px 10px; border-radius: 4px;
      color: var(--gl-text-color-default, #303030);
      background: var(--gl-background-color-default, #fff);
      border: 1px solid var(--gl-border-color-default, #dbdbdb);
    }
    .mrh-bar button:hover {
      background: var(--gl-background-color-strong, #ececef);
    }
  `;
  document.head.appendChild(style);
}

// Pose l'état visuel sur la ligne (no-op si déjà à jour, pour ne pas
// déclencher inutilement le MutationObserver).
function applyState(row, state) {
  if (row.dataset.mrhState !== state) row.dataset.mrhState = state;
}

// Ajoute le bouton œil (une seule fois) sauf sur les MRs de l'utilisateur.
function ensureEyeButton(row, mr, store, currentUser, rerender) {
  if (currentUser && mr.author === currentUser) return;
  let btn = row.querySelector('.mrh-eye');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mrh-eye';
    btn.textContent = '\u{1F441}'; // 👁
    btn.title = 'Marquer comme vue / annuler (re-cliquer après une nouvelle activité ré-acquitte)';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      store.toggle(mr.key, mr.updateToken);
      rerender();
    });
    const titleLink = row.querySelector(SELECTORS.titleLink);
    (titleLink && titleLink.parentElement ? titleLink.parentElement : row).appendChild(btn);
  }
  btn.dataset.seen = store.isSeen(mr.key) ? '1' : '0';
}

// Traite une ligne : extraction -> classification -> décoration.
function processRow(row, store, currentUser, rerender) {
  let mr;
  try {
    mr = parseRow(row);
  } catch (e) {
    return; // markup inattendu : on ignore cette ligne
  }
  if (!mr || !mr.key) return;
  applyState(row, classifyMr(mr, currentUser, store.all()));
  ensureEyeButton(row, mr, store, currentUser, rerender);
}

// Traite toutes les lignes visibles.
function processList(store, currentUser) {
  const rerender = () => processList(store, currentUser);
  document.querySelectorAll(SELECTORS.row).forEach((row) => {
    processRow(row, store, currentUser, rerender);
  });
}

// Met à jour le compteur de MRs vues (no-op si inchangé).
function updateBar(store) {
  const count = document.querySelector('.mrh-count');
  if (!count) return;
  const text = `${store.count()} MR(s) marquée(s) vue(s)`;
  if (count.textContent !== text) count.textContent = text;
}

// Injecte la barre (une seule fois) au-dessus de la liste, puis la met à jour.
function ensureResetBar(store, currentUser) {
  let bar = document.querySelector('.mrh-bar');
  if (!bar) {
    const anchor = document.querySelector(SELECTORS.listContainer);
    if (!anchor || !anchor.parentNode) return; // liste pas encore montée

    bar = document.createElement('div');
    bar.className = 'mrh-bar';

    const count = document.createElement('span');
    count.className = 'mrh-count';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Réinitialiser les vues';
    btn.addEventListener('click', () => {
      if (window.confirm('Réinitialiser toutes les MRs marquées vues ?')) {
        store.clear();
        processList(store, currentUser);
        updateBar(store);
      }
    });

    bar.append(count, btn);
    anchor.parentNode.insertBefore(bar, anchor);
  }
  updateBar(store);
}

// Regroupe les appels rapprochés en un seul (anti-rebond).
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Point d'entrée navigateur.
function main() {
  if (!isMrListUrl(location.pathname)) return;

  const currentUser = detectCurrentUser();
  const store = createSeenStore(gmStorage);
  injectStyles();

  const run = () => {
    ensureResetBar(store, currentUser);
    processList(store, currentUser);
  };

  // La liste est rendue/re-rendue par Vue.js (filtres, onglets, pagination).
  // On ne surveille que childList (ajouts/retraits de lignes) : nos propres
  // changements d'attributs ne re-déclenchent donc pas l'observer, et les
  // gardes d'idempotence évitent toute boucle.
  const observer = new MutationObserver(debounce(run, 150));
  observer.observe(document.body, { childList: true, subtree: true });

  run();
}

/* ------------------------------------------------------------------ *
 * Export (tests Node) / Bootstrap (navigateur)
 * ------------------------------------------------------------------ */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isMrListUrl, usernameFromHref, classifyMr, createSeenStore, isBlockingLabel };
} else if (typeof window !== 'undefined') {
  main();
}
