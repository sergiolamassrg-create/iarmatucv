// iArmatuCV: interacciones de demostración, sin dependencias
const themeButton = document.getElementById('themeToggle');
const themeIcon = themeButton.querySelector('use');
const toast = document.getElementById('toast');
const dialog = document.getElementById('demoDialog');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}
function setTheme(dark) {
  document.body.classList.toggle('dark-mode', dark);
  themeButton.setAttribute('aria-pressed', String(dark));
  themeButton.setAttribute('aria-label', dark ? 'Activar modo claro' : 'Activar modo oscuro');
  themeIcon.setAttribute('href', dark ? '#icon-moon' : '#icon-sun');
  document.querySelector('meta[name="theme-color"]').content = dark ? '#10162e' : '#ffffff';
  try { localStorage.setItem('iarmatucv-theme', dark ? 'dark' : 'light'); } catch (_) {}
}
let savedTheme = null;
try { savedTheme = localStorage.getItem('iarmatucv-theme'); } catch (_) {}
setTheme(savedTheme === 'dark');
themeButton.addEventListener('click', () => setTheme(!document.body.classList.contains('dark-mode')));
const selectionHint = document.getElementById('selectionHint');
const cards = [...document.querySelectorAll('.template-card')];
function selectCard(card) {
  cards.forEach(item => {
    const selected = item === card;
    item.classList.toggle('selected', selected);
    item.setAttribute('aria-pressed', String(selected));
  });
  const label = card.querySelector(':scope > span').textContent;
  selectionHint.innerHTML = 'Seleccionaste: <strong></strong>. Tocá otra plantilla para explorarla.';
  selectionHint.querySelector('strong').textContent = label;
  showToast(`Plantilla «${label}» seleccionada`);
}
cards.forEach(card => {
  card.addEventListener('click', () => selectCard(card));
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCard(card); }
  });
});
document.querySelectorAll('[data-demo]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    const login = link.dataset.demo === 'login';
    document.getElementById('demoTitle').textContent = login ? 'Inicio de sesión' : 'Creá tu CV con IA';
    document.getElementById('demoText').textContent = login
      ? 'La autenticación todavía no está implementada. Este botón muestra cómo responderá la interfaz.'
      : 'Esta es una demostración visual. En la próxima etapa conectaremos el asistente de IA y la creación real del CV.';
    dialog.showModal();
  });
});
document.getElementById('dialogClose').addEventListener('click', () => dialog.close());
document.getElementById('dialogOk').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
const navLinks = [...document.querySelectorAll('.main-nav a')];
navLinks.forEach(link => link.addEventListener('click', () => {
  navLinks.forEach(a => a.classList.toggle('active', a === link));
}));
