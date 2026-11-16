// Half Adder: fixed two-input, two-output component.
// R = A XOR B; E = A AND B. No arbitrary pin count changes are permitted.
(() => {
  "use strict";
  const category = document.getElementById("adderCategory");
  const choices = document.getElementById("adderChoices");
  const add = document.getElementById("addHalfAdder");
  if (!category || !choices || !add) return;
  category.addEventListener("click", () => {
    choices.hidden = !choices.hidden;
    category.setAttribute("aria-expanded", String(!choices.hidden));
  });
  add.addEventListener("click", () => {
    const width = 160, height = 100;
    const position = window.advancedComponentPlacement.findSpace(width, height);
    if (!position) {
      alert("No free space is available for this component. Move existing components or enlarge the drawing area.");
      return;
    }
    const {x, y} = position;
    const gate = document.createElement("div");
    gate.className = "logic-gate advanced-gate";
    gate.dataset.type = "HALF_ADDER";
    gate.dataset.inputs = "2";
    gate.style.left = `${x}px`;
    gate.style.top = `${y}px`;
    gate.innerHTML = `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Half Adder: inputs A B, outputs R E">
      <g fill="#180b38" stroke="#b026ff" stroke-width="2.5"><rect x="18" y="8" width="124" height="84" rx="10"/></g>
      <g stroke="#00ffff" stroke-width="2"><path d="M2 34 H18 M2 66 H18"/></g>
      <g stroke="#39ff14" stroke-width="2"><path d="M142 34 H158 M142 66 H158"/></g>
      <g fill="#f3f5ff" font-family="Arial,sans-serif" font-size="13" text-anchor="middle">
        <text x="80" y="48" font-weight="bold">Half</text><text x="80" y="63" font-weight="bold">Adder</text>
        <text x="28" y="38">A</text><text x="28" y="70">B</text>
        <text x="132" y="38">R</text><text x="132" y="70">E</text>
      </g>
      <circle class="input-pin" data-pin="0" cx="2" cy="34" r="4" fill="#00ffff" />
      <circle class="input-pin" data-pin="1" cx="2" cy="66" r="4" fill="#00ffff" />
      <circle class="output-pin" data-output="0" cx="158" cy="34" r="4" fill="#39ff14" />
      <circle class="output-pin" data-output="1" cx="158" cy="66" r="4" fill="#39ff14" />
    </svg>`;
    const before = typeof captureCircuitState === "function" ? captureCircuitState() : null;
    drawingArea.appendChild(gate);
    if (before && typeof recordCircuitChange === "function") recordCircuitChange(before);
    choices.hidden = true;
    category.setAttribute("aria-expanded", "false");
  });
})();
