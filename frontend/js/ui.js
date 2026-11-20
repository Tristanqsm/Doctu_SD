export function initLiquidCanvas() {
  if (document.querySelector('.liquid-canvas')) return;
  const canvas = document.createElement('div');
  canvas.className = 'liquid-canvas';
  canvas.innerHTML =
    '<div class="liquid-orb orb-1"></div>' +
    '<div class="liquid-orb orb-2"></div>' +
    '<div class="liquid-orb orb-3"></div>';
  document.body.insertBefore(canvas, document.body.firstChild);
}

export function bindCardGlow() {
  document.querySelectorAll('.card, .glass-feature-card').forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', e.clientX - rect.left + 'px');
      card.style.setProperty('--mouse-y', e.clientY - rect.top + 'px');
    });
  });
}

export function showToast(text, type) {
  const toastType = type || 'alert-info';
  let container = document.querySelector('.alert-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'alert-container';
    document.body.appendChild(container);
  }

  const icon = toastType === 'alert-danger' ? '!' : '✓';
  const el = document.createElement('div');
  el.className = 'alert ' + toastType;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'alert-icon';
  iconSpan.textContent = icon;

  const textSpan = document.createElement('span');
  textSpan.textContent = text;

  el.appendChild(iconSpan);
  el.appendChild(textSpan);
  container.appendChild(el);

  const hide = function () {
    if (!el.parentNode) return;
    el.style.transition = 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-25px) scale(0.88)';
    setTimeout(function () {
      if (el.parentNode) el.remove();
    }, 350);
  };

  el.addEventListener('click', hide);
  setTimeout(hide, 3800);
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, function (ch) {
    if (ch === '&') return '&';
    if (ch === '<') return '<';
    if (ch === '>') return '>';
    if (ch === '"') return '"';
    return ''';
  });
}