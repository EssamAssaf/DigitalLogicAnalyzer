// =====================================
// ROTATE LOGIC GATES
// =====================================

document.getElementById("rotateGate").addEventListener(
    "click",
    () => {

        if (!selectedGate) return;

        const gate = selectedGate;

        const svg = gate.querySelector("svg");

        // Get current rotation
        let rotation = Number(gate.dataset.rotation || 0);

        // Rotate 90 degrees clockwise
        rotation = (rotation + 90) % 360;

        // Save rotation
        gate.dataset.rotation = rotation;

        // Rotate gate shape and connection pins together
        svg.style.transformOrigin = "center center";

        svg.style.transform = `rotate(${rotation}deg)`;

        // Keep rotated gate visible
        svg.style.overflow = "visible";

        // INPUT and OUTPUT labels must remain readable when the component turns.
        // Rotate the entire SVG (frame + pins), then counter-rotate only its text.
        // The frame and connection pins continue to rotate and update normally.
        if (gate.dataset.type === "INPUT" || gate.dataset.type === "OUTPUT") {
            svg.querySelectorAll("text").forEach(label => {
                label.style.transformBox = "fill-box";
                label.style.transformOrigin = "center center";
                label.style.transform = `rotate(${-rotation}deg)`;
            });
        }

        // Update connected wires
        updateWires();

        // Hide context menu
        gateContextMenu.style.display = "none";

    }
);
