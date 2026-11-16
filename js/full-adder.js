// Full Adder: exactly three inputs (A, B, Cin) and two outputs (S, Cout).
// S = A XOR B XOR Cin; Cout = A*B OR (Cin*(A XOR B)).
(() => {
  "use strict";
  const add = document.getElementById("addFullAdder");
  const choices = document.getElementById("adderChoices");
  const category = document.getElementById("adderCategory");
  if (!add || !choices || !category) return;
  add.addEventListener("click", () => {
    const width = 180, height = 120;
    const position = window.advancedComponentPlacement.findSpace(width, height);
    if (!position) {
      alert("No free space is available for this component. Move existing components or enlarge the drawing area.");
      return;
    }
    const {x, y} = position;
    const gate = document.createElement("div");
    gate.className = "logic-gate advanced-gate";
    gate.dataset.type = "FULL_ADDER";
    gate.dataset.inputs = "3";
    gate.style.left = `${x}px`;
    gate.style.top = `${y}px`;
    gate.innerHTML = `<svg viewBox="0 0 180 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Full Adder: inputs A B Cin, outputs SUM Cout">
      <rect x="18" y="8" width="144" height="104" rx="10" fill="#180b38" stroke="#b026ff" stroke-width="2.5"/>
      <g stroke="#00ffff" stroke-width="2"><path d="M2 30 H18 M2 60 H18 M2 90 H18"/></g>
      <g stroke="#39ff14" stroke-width="2"><path d="M162 43 H178 M162 80 H178"/></g>
      <g fill="#f3f5ff" font-family="Arial,sans-serif" font-size="12">
        <text x="90" y="53" font-weight="bold" text-anchor="middle">Full</text>
        <text x="90" y="68" font-weight="bold" text-anchor="middle">Adder</text>
        <text x="26" y="34">A</text><text x="26" y="64">B</text><text x="26" y="94">Cin</text>
        <text x="152" y="47" text-anchor="end" font-size="11">SUM</text><text x="152" y="84" text-anchor="end">Cout</text>
      </g>
      <circle class="input-pin" data-pin="0" cx="2" cy="30" r="4" fill="#00ffff"/>
      <circle class="input-pin" data-pin="1" cx="2" cy="60" r="4" fill="#00ffff"/>
      <circle class="input-pin" data-pin="2" cx="2" cy="90" r="4" fill="#00ffff"/>
      <circle class="output-pin" data-output="0" cx="178" cy="43" r="4" fill="#39ff14"/>
      <circle class="output-pin" data-output="1" cx="178" cy="80" r="4" fill="#39ff14"/>
    </svg>`;
    const before = typeof captureCircuitState === "function" ? captureCircuitState() : null;
    drawingArea.appendChild(gate);
    if (before && typeof recordCircuitChange === "function") recordCircuitChange(before);
    choices.hidden = true;
    category.setAttribute("aria-expanded", "false");
  });
})();
