/* Runs before first paint so the saved theme never flashes. Defaults to dark. */
(function () {
  var t = 'dark';
  try { if (localStorage.getItem('theme') === 'light') t = 'light'; } catch (e) {}
  document.documentElement.dataset.theme = t;
})();
