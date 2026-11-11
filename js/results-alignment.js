// Layout-only update: center equations, the timing chart and explanatory notes.
// Load after timing-diagram.js. Does not alter calculations or signal paths.
(() => {
  'use strict';
  if (document.getElementById('results-alignment-styles')) return;
  const style = document.createElement('style');
  style.id = 'results-alignment-styles';
  style.textContent = `
    /* Keep each equation centered without changing its overline notation. */
    .boolean-equation-panel .boolean-equation-row {
      text-align: center !important;
    }
    /* Center the timing plot when it fits; allow natural left-start scrolling
       when the diagram becomes wider than its container. */
    .timing-diagram-panel .timing-diagram-scroll {
      display: flex;
      justify-content: safe center;
      overflow-x: auto;
    }
    .timing-diagram-panel .timing-diagram-svg {
      flex: 0 0 auto;
      margin-inline: auto;
      max-width: none;
    }
    /* Center the three descriptive notes under each result section. */
    .boolean-equation-panel .boolean-equation-note,
    .truth-table-panel .truth-table-note,
    .timing-diagram-panel .timing-diagram-note {
      text-align: center !important;
    }
  `;
  document.head.appendChild(style);
})();
