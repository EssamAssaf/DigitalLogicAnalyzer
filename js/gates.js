const drawingArea = document.getElementById("drawingArea");

const gateButtons = document.querySelectorAll(
    ".components-panel .gate-option"
);

// =====================================
// GATE GEOMETRY
// =====================================

const gateShapes = {

    AND: `
        <path d="M20 10 H50 A30 30 0 0 1 50 70 H20 Z"/>
    `,

    OR: `
        <path d="M20 10 Q45 40 20 70 Q75 70 90 40 Q75 10 20 10 Z"/>
    `,

    NOT: `
        <path d="M20 10 L80 40 L20 70 Z"/>
        <circle cx="86" cy="40" r="6"/>
    `,

    NAND: `
        <path d="M20 10 H45 A30 30 0 0 1 45 70 H20 Z"/>
        <circle cx="81" cy="40" r="6"/>
    `,

    NOR: `
        <path d="M20 10 Q45 40 20 70 Q70 70 80 40 Q70 10 20 10 Z"/>
        <circle cx="86" cy="40" r="6"/>
    `,

    XOR: `
        <path d="M12 10 Q37 40 12 70"/>
        <path d="M20 10 Q45 40 20 70 Q75 70 90 40 Q75 10 20 10 Z"/>
    `,

    XNOR: `
        <path d="M12 10 Q37 40 12 70"/>
        <path d="M20 10 Q45 40 20 70 Q65 70 80 40 Q65 10 20 10 Z"/>
        <circle cx="86" cy="40" r="6"/>
    `
};

// =====================================
// CONNECTION PIN POSITIONS
// =====================================

const gatePins = {

    AND: {
        inputs: [[20, 25], [20, 55]],
        output: [80, 40]
    },

    OR: {
        inputs: [[20, 25], [20, 55]],
        output: [90, 40]
    },

    NOT: {
        inputs: [[20, 40]],
        output: [92, 40]
    },

    NAND: {
        inputs: [[20, 25], [20, 55]],
        output: [87, 40]
    },

    NOR: {
        inputs: [[20, 25], [20, 55]],
        output: [92, 40]
    },

    XOR: {
        inputs: [[12, 25], [12, 55]],
        output: [90, 40]
    },

    XNOR: {
        inputs: [[12, 25], [12, 55]],
        output: [92, 40]
    }
};

// =====================================
// CREATE CONNECTION PINS
// =====================================

function createPins(gateType) {

    const pins = gatePins[gateType];

    let svgPins = "";

    pins.inputs.forEach(([x, y], index) => {

        svgPins += `
            <circle
                class="input-pin"
                data-pin="${index}"
                cx="${x}"
                cy="${y}"
                r="3"
                fill="#00ffff"
                stroke="none"
            />
        `;

    });

    svgPins += `
        <circle
            class="output-pin"
            cx="${pins.output[0]}"
            cy="${pins.output[1]}"
            r="3"
            fill="#39ff14"
            stroke="none"
        />
    `;

    return svgPins;
}

// =====================================
// ADD LOGIC GATES
// =====================================

// =====================================
// ADD LOGIC GATES - ORGANIZED PLACEMENT
// =====================================

const GATE_WIDTH = 80;
const GATE_HEIGHT = 60;

const GATE_START_X = 12;
const GATE_START_Y = 12;
const GATE_SPACING = 70;

gateButtons.forEach((button, index) => {

    button.addEventListener("click", () => {

        const gateType = button.textContent.trim();

        // Position next to the components panel
        const x = GATE_START_X;
        const y = GATE_START_Y + index * GATE_SPACING;

        // Check whether the position is occupied
        const occupied = Array.from(
            drawingArea.querySelectorAll(".logic-gate")
        ).some(existingGate => {

            const existingX = parseFloat(
                existingGate.style.left
            );

            const existingY = parseFloat(
                existingGate.style.top
            );

            const existingWidth = existingGate.offsetWidth;
            const existingHeight = existingGate.offsetHeight;

            return (
                x < existingX + existingWidth &&
                x + GATE_WIDTH > existingX &&
                y < existingY + existingHeight &&
                y + GATE_HEIGHT > existingY
            );
        });

        // Do not create another gate until space is free
        if (occupied) {
            return;
        }

        // Create the selected gate
        const gate = document.createElement("div");

        gate.className = "logic-gate";

        gate.dataset.type = gateType;

        gate.dataset.inputs =
            gateType === "NOT" ? 1 : 2;

        gate.innerHTML = `
            <svg
                viewBox="0 0 110 80"
                xmlns="http://www.w3.org/2000/svg"
            >
                <g
                    fill="#180b38"
                    stroke="#b026ff"
                    stroke-width="3"
                    stroke-linejoin="round"
                >
                    ${gateShapes[gateType]}
                </g>

                ${createPins(gateType)}
            </svg>
        `;

        gate.style.left = x + "px";
        gate.style.top = y + "px";

        drawingArea.appendChild(gate);

        updateGateInputs(gate);

    });

});

// =====================================
// GATE CONTEXT MENU
// =====================================

const gateContextMenu = document.createElement("div");

gateContextMenu.className = "gate-context-menu";

gateContextMenu.innerHTML = `
    <button id="convertComponent" style="display:none">Convert</button>
    <button id="convertMasterSlave" style="display:none">Convert to Slave</button>
    <button id="toggleMuxEnable" style="display:none">Add Enable</button>
    <button id="toggleLatchEnable" style="display:none">Add Enable</button>
    <button id="toggleFlipFlopEnable" style="display:none">Add Enable</button>
    <button id="toggleFlipFlopEdge" style="display:none">Clock Edge: Falling</button>
    <button id="addInput">+ Add Input</button>
    <button id="removeInput">- Remove Input</button>
    <button id="rotateGate">Rotate Gate</button>
    <button id="deleteGate">Delete Gate</button>
`;

document.body.appendChild(gateContextMenu);

let selectedGate = null;

// =====================================
// SHOW CONTEXT MENU
// =====================================

drawingArea.addEventListener("contextmenu", (event) => {

    const gate = event.target.closest(".logic-gate");

    if (!gate) return;

    event.preventDefault();

    selectedGate = gate;
    const isSourceInput = gate.dataset.type === "INPUT" || gate.dataset.type === "OUTPUT" || gate.dataset.type === "HALF_ADDER" || gate.dataset.type === "FULL_ADDER" || gate.dataset.type === "PARALLEL_ADDER" || gate.dataset.type === "COMPARATOR" || gate.dataset.type === "ENCODER" || gate.dataset.type === "DECODER" || gate.dataset.type === "MUX" || gate.dataset.type === "DEMUX" || gate.dataset.type === "LATCH" || gate.dataset.type === "FLIP_FLOP" || gate.dataset.type === "CLOCK";
    gateContextMenu.querySelector("#addInput").style.display = isSourceInput ? "none" : "";
    gateContextMenu.querySelector("#removeInput").style.display = isSourceInput ? "none" : "";

    gateContextMenu.querySelector("#toggleMuxEnable").style.display = ["MUX", "DEMUX", "DECODER"].includes(gate.dataset.type) ? "" : "none";
    gateContextMenu.querySelector("#toggleMuxEnable").textContent = gate.dataset.enable === "1" ? "Remove Enable" : "Add Enable";
    gateContextMenu.querySelector("#toggleLatchEnable").style.display = (gate.dataset.type === "LATCH" && !gate.dataset.masterSlaveRole) ? "" : "none";
    gateContextMenu.querySelector("#toggleLatchEnable").textContent = gate.dataset.enable === "1" ? "Remove Enable" : "Add Enable";
    gateContextMenu.querySelector("#toggleFlipFlopEnable").style.display = gate.dataset.type === "FLIP_FLOP" ? "" : "none";
    gateContextMenu.querySelector("#toggleFlipFlopEnable").textContent = gate.dataset.enable === "1" ? "Remove Enable" : "Add Enable";
    gateContextMenu.querySelector("#toggleFlipFlopEdge").style.display = gate.dataset.type === "FLIP_FLOP" ? "" : "none";
    gateContextMenu.querySelector("#toggleFlipFlopEdge").textContent = gate.dataset.edge === "rising" ? "Clock Edge: Rising" : "Clock Edge: Falling";
    gateContextMenu.querySelector("#convertComponent").style.display = ["ENCODER", "DECODER", "MUX", "DEMUX"].includes(gate.dataset.type) ? "" : "none";
    const msButton=gateContextMenu.querySelector("#convertMasterSlave");
    msButton.style.display = gate.dataset.masterSlaveRole ? "" : "none";
    msButton.textContent = gate.dataset.masterSlaveRole === "Slave" ? "Convert to Master" : "Convert to Slave";

    gateContextMenu.style.display = "block";

    gateContextMenu.style.left = event.pageX + "px";

    gateContextMenu.style.top = event.pageY + "px";

});

// =====================================
// HIDE CONTEXT MENU
// =====================================

document.addEventListener("click", (event) => {

    if (!gateContextMenu.contains(event.target)) {

        gateContextMenu.style.display = "none";

    }

});

// =====================================
// UPDATE GATE INPUT PINS
// =====================================

function updateGateInputs(gate) {

    const gateType = gate.dataset.type;

    if (gateType === "NOT" || gateType === "INPUT" || gateType === "OUTPUT") return;

    const inputCount = Number(gate.dataset.inputs || 2);

    const svg = gate.querySelector("svg");

    svg.querySelectorAll(".input-pin").forEach(pin => {

        pin.remove();

    });

    const svgNS = "http://www.w3.org/2000/svg";

    for (let i = 0; i < inputCount; i++) {

        // Equal input spacing

        const y =
            10 + (60 * (i + 1) / (inputCount + 1));

        let x = 20;

        if (
            gateType === "OR" ||
            gateType === "NOR"
        ) {

            const t = (y - 10) / 60;

            x = 20 + 50 * t * (1 - t);

        }

        if (
            gateType === "XOR" ||
            gateType === "XNOR"
        ) {

            const t = (y - 10) / 60;

            x = 12 + 50 * t * (1 - t);

        }

        const pin = document.createElementNS(
            svgNS,
            "circle"
        );

        pin.setAttribute("cx", x);

        pin.setAttribute("cy", y);

        pin.setAttribute("r", "3");

        pin.setAttribute("fill", "#00ffff");

        pin.setAttribute("class", "input-pin");

        pin.setAttribute("data-pin", i);

        svg.appendChild(pin);

    }

}

// =====================================
// ADD INPUT
// =====================================

document.getElementById("addInput").addEventListener(
    "click",
    () => {

        if (!selectedGate) return;

        if (selectedGate.dataset.type === "NOT") {

            alert("NOT gate supports only one input.");

            return;

        }

        let count = Number(
            selectedGate.dataset.inputs || 2
        );

        if (count >= 8) {

            alert("Maximum number of inputs is 8.");

            return;

        }

        selectedGate.dataset.inputs = count + 1;

        updateGateInputs(selectedGate);

        gateContextMenu.style.display = "none";

    }
);

// =====================================
// REMOVE INPUT
// =====================================

document.getElementById("removeInput").addEventListener(
    "click",
    () => {

        if (!selectedGate) return;

        if (selectedGate.dataset.type === "NOT") {

            alert("NOT gate supports only one input.");

            return;

        }

        let count = Number(
            selectedGate.dataset.inputs || 2
        );

        if (count <= 2) {

            alert("Minimum number of inputs is 2.");

            return;

        }

        selectedGate.dataset.inputs = count - 1;

        updateGateInputs(selectedGate);

        gateContextMenu.style.display = "none";

    }
);

