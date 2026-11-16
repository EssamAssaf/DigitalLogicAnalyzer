// Two-bit ripple-carry Parallel Adder: A0,B0,A1,B1,Cin => S0,S1,Cout.
// A0/B0 are the least-significant bits. All pins have fixed logical roles.
(() => {
  'use strict';
  function evaluate(bits, pin) {
    if (bits.length !== 5 || bits.some(bit => bit !== 0 && bit !== 1)) return null;
    const [a0, b0, a1, b1, cin] = bits;
    const c1 = (a0 & b0) | (cin & (a0 ^ b0));
    if (pin === 0) return a0 ^ b0 ^ cin;
    if (pin === 1) return a1 ^ b1 ^ c1;
    if (pin === 2) return (a1 & b1) | (c1 & (a1 ^ b1));
    return null;
  }
  function expression(inputs, pin) {
    if (inputs.length !== 5) return '?';
    const [a0,b0,a1,b1,cin] = inputs;
    const c1 = `((${a0} · ${b0}) + (${cin} · (${a0} ⊕ ${b0})))`;
    if (pin === 0) return `(${a0} ⊕ ${b0} ⊕ ${cin})`;
    if (pin === 1) return `(${a1} ⊕ ${b1} ⊕ ${c1})`;
    if (pin === 2) return `((${a1} · ${b1}) + (${c1} · (${a1} ⊕ ${b1})))`;
    return '?';
  }
  window.parallelAdderLogic = {evaluate, expression};
  const button = document.getElementById('addParallelAdder');
  const choices = document.getElementById('adderChoices');
  const category = document.getElementById('adderCategory');
  if (!button || !choices || !category) return;
  button.addEventListener('click', () => {
    const width = 210, height = 180;
    const position = window.advancedComponentPlacement.findSpace(width, height);
    if (!position) {
      alert("No free space is available for this component. Move existing components or enlarge the drawing area.");
      return;
    }
    const {x, y} = position;
    const gate = document.createElement('div');
    gate.className = 'logic-gate advanced-gate parallel-adder-gate';
    gate.dataset.type = 'PARALLEL_ADDER';
    gate.dataset.inputs = '5';
    gate.dataset.bits = '2';
    gate.style.left = `${x}px`;
    gate.style.top = `${y}px`;
    const pins = ['A0','B0','A1','B1','Cin'];
    const names = ['S0','S1','Cout'];
    const inputPins = pins.map((label,i) => {
      const cy = 30 + i*29;
      return `<path d="M2 ${cy} H22" stroke="#00ffff" stroke-width="2" />
        <text x="29" y="${cy+4}" fill="#f3f5ff" font-size="12">${label}</text>
        <circle class="input-pin" data-pin="${i}" cx="2" cy="${cy}" r="4" fill="#00ffff"/>`;
    }).join('');
    const outputPins = names.map((label,i) => {
      const cy = 50 + i*43;
      return `<path d="M188 ${cy} H208" stroke="#39ff14" stroke-width="2" />
        <text x="181" y="${cy+4}" fill="#f3f5ff" font-size="12" text-anchor="end">${label}</text>
        <circle class="output-pin" data-output="${i}" cx="208" cy="${cy}" r="4" fill="#39ff14"/>`;
    }).join('');
    gate.innerHTML = `<svg viewBox="0 0 210 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Two-bit Parallel Adder: five inputs and three outputs">
      <rect x="22" y="9" width="166" height="162" rx="11" fill="#180b38" stroke="#b026ff" stroke-width="2.5"/>
      <g font-family="Arial,sans-serif" font-weight="bold" font-size="13" text-anchor="middle" fill="#fff">
      <text x="108" y="82">Parallel</text><text x="108" y="99">Adder</text><text x="108" y="116" font-size="10">2-bit</text></g>
      ${inputPins}${outputPins}</svg>`;
    const before = typeof captureCircuitState === 'function' ? captureCircuitState() : null;
    drawingArea.appendChild(gate);
    if (before && typeof recordCircuitChange === 'function') recordCircuitChange(before);
    choices.hidden = true;
    category.setAttribute('aria-expanded', 'false');
  });
})();
