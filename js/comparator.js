// 1-bit magnitude Comparator: ordered outputs A<B, A=B, A>B.
// Matches the instructor's truth table: NOT/AND/XNOR implementation.
(() => {
  "use strict";
  const category = document.getElementById("comparatorCategory");
  const choices = document.getElementById("comparatorChoices");
  const add = document.getElementById("addComparator");
  const other = document.getElementById("adderChoices");
  const otherCategory = document.getElementById("adderCategory");
  if (!category || !choices || !add) return;
  category.addEventListener("click", () => {
    const show = choices.hidden;
    choices.hidden = !show;
    category.setAttribute("aria-expanded", String(show));
    if (other) other.hidden = true;
    if (otherCategory) otherCategory.setAttribute("aria-expanded", "false");
  });
  if (otherCategory) otherCategory.addEventListener("click", () => {
    choices.hidden = true;
    category.setAttribute("aria-expanded", "false");
  });
  add.addEventListener("click", () => {
    const width = 180, height = 126;
    const position = window.advancedComponentPlacement.findSpace(width, height);
    if (!position) {
      alert("No free space is available for this component. Move existing components or enlarge the drawing area.");
      return;
    }
    const gate = document.createElement("div");
    gate.className = "logic-gate advanced-gate comparator-gate";
    gate.dataset.type = "COMPARATOR";
    gate.dataset.inputs = "2";
    gate.style.left = `${position.x}px`;
    gate.style.top = `${position.y}px`;
    gate.innerHTML = `<svg viewBox="0 0 180 126" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="One-bit Comparator: inputs A and B; outputs A less than B, A equals B, A greater than B">
      <rect x="18" y="8" width="144" height="110" rx="10" fill="#180b38" stroke="#b026ff" stroke-width="2.5"/>
      <g stroke="#00ffff" stroke-width="2"><path d="M2 43 H18 M2 85 H18"/></g>
      <g stroke="#39ff14" stroke-width="2"><path d="M162 29 H178 M162 63 H178 M162 97 H178"/></g>
      <g fill="#f3f5ff" font-family="Arial,sans-serif" font-size="12">
        <text x="90" y="65" text-anchor="middle" font-size="12" font-weight="bold">Comparator</text>
        <text x="27" y="47">A</text><text x="27" y="89">B</text>
        <text x="152" y="33" text-anchor="end">A&lt;B</text>
        <text x="152" y="67" text-anchor="end">A=B</text>
        <text x="152" y="101" text-anchor="end">A&gt;B</text>
      </g>
      <circle class="input-pin" data-pin="0" cx="2" cy="43" r="4" fill="#00ffff"/>
      <circle class="input-pin" data-pin="1" cx="2" cy="85" r="4" fill="#00ffff"/>
      <circle class="output-pin" data-output="0" cx="178" cy="29" r="4" fill="#39ff14"/>
      <circle class="output-pin" data-output="1" cx="178" cy="63" r="4" fill="#39ff14"/>
      <circle class="output-pin" data-output="2" cx="178" cy="97" r="4" fill="#39ff14"/>
    </svg>`;
    const before = typeof captureCircuitState === "function" ? captureCircuitState() : null;
    drawingArea.appendChild(gate);
    if (before && typeof recordCircuitChange === "function") recordCircuitChange(before);
    choices.hidden = true;
    category.setAttribute("aria-expanded", "false");
  });
})();
