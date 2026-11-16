// Position every advanced component menu directly below its own category button.
// Keep this isolated from component logic and the stable analysis panels.
(() => {
  'use strict';
  const ribbon = document.querySelector('.advanced-ribbon');
  if (!ribbon) return;

  function alignOpenMenus() {
    const ribbonRect = ribbon.getBoundingClientRect();
    ribbon.querySelectorAll('.advanced-tab[aria-controls]').forEach(tab => {
      const menu = document.getElementById(tab.getAttribute('aria-controls'));
      if (!menu || menu.hidden) return;
      const tabRect = tab.getBoundingClientRect();
      // Exactly match the parent category button width.
      const width = tabRect.width;
      menu.style.width = `${width}px`;
      // Align to the clicked tab, but prevent dropdown overflow at narrow sizes.
      const target = tabRect.left - ribbonRect.left;
      const maxLeft = Math.max(0, ribbon.clientWidth - width);
      menu.style.left = `${Math.max(0, Math.min(target, maxLeft))}px`;
      menu.style.top = `${tabRect.bottom - ribbonRect.top + 5}px`;
    });
  }

  // Category modules toggle their menus on the button; document bubbling runs afterward.
  document.addEventListener('click', alignOpenMenus);
  window.addEventListener('resize', alignOpenMenus);
})();
