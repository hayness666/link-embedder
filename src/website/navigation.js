// A disclosure, not an ARIA menu: normal links keep normal keyboard behavior.
const header = document.querySelector('.site-header');
const toggle = header?.querySelector('.nav-toggle');
const nav = header?.querySelector('#main-navigation');
if (header && toggle && nav) {
  const mobile = window.matchMedia('(max-width: 700px)');
  const setOpen = open => {
    header.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target) || event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('focusin', event => {
    if (!header.contains(event.target)) setOpen(false);
  });
  mobile.addEventListener('change', () => {
    if (mobile.matches && nav.contains(document.activeElement)) toggle.focus();
    if (!mobile.matches && document.activeElement === toggle) nav.querySelector('a').focus();
    setOpen(false);
  });
  window.addEventListener('pageshow', () => setOpen(false));
  toggle.hidden = false;
  header.classList.add('nav-ready');
}
