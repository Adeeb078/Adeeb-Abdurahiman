/* ==========================================================================
   config.js — the only file you need to edit for personal details.
   ========================================================================== */

export const CONFIG = {
  // Shown and linked in the Contact section. REPLACE with your real details.
  email: 'adeebabdurahiman2004@gmail.com',
  linkedin: 'https://linkedin.com/in/adeebabdurahiman',

  // Contact form endpoint (static-site friendly, no backend needed).
  // 1. Create a free form at https://formspree.io (or any service with the same
  //    JSON POST API, e.g. Web3Forms, Basin, Getform).
  // 2. Paste the endpoint URL here, e.g. 'https://formspree.io/f/abcdwxyz'.
  // Until it is set, the form falls back to opening the visitor's email app
  // with the message pre-filled, so nothing is ever silently dropped.
  formEndpoint: '',

  // GitHub repositories list ("More on GitHub"). Public repos are fetched live
  // from the GitHub API, so new repos appear without editing this site.
  githubUser: 'Adeeb078',
  // Repos to leave out (case-insensitive). Featured projects above are already
  // listed in full, so keep them here to avoid duplicates. Forks are skipped.
  hideRepos: ['github-actions-practice', 'Adeeb078'],
  maxRepos: 8,

  // Timezone for the small clock in the hero.
  timezone: 'Asia/Dubai',
};
