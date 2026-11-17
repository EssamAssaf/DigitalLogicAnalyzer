// Main toolbar — preserves the existing editor, wire model and analyzers.
// Save/Open uses a standalone JSON circuit file (not browser localStorage).
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  class ToolbarManager {
    constructor() {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.accept = '.dla.json,application/json,.json';
      this.fileInput.hidden = true;
      document.body.appendChild(this.fileInput);
      this.fileInput.addEventListener('change', () => this.openSelectedFile());
      $('newBtn')?.addEventListener('click', () => this.newCircuit());
      $('saveBtn')?.addEventListener('click', () => this.saveCircuit());
      $('openBtn')?.addEventListener('click', () => {this.fileInput.value=''; this.fileInput.click();});
      $('printBtn')?.addEventListener('click', () => window.dlaPrintReport?.());
      $('exportBtn')?.addEventListener('click', () => this.exportPdf());
      $('helpBtn')?.addEventListener('click', () => this.showHelp());
      this.addPrintStyles();
    }

    readCircuit() {
      const gates = [...drawingArea.querySelectorAll('.logic-gate')];
      const ids = new Map(gates.map((gate, i) => [gate, i]));
      const allOpen = window.__dlaGetOpenWires?.() || [];
      const connectionIds = new Map(connections.map((connection, i) => [connection, i]));
      const openIds = new Map(allOpen.map((wire, i) => [wire, i]));
      const points = pts => Array.isArray(pts) ? pts.map(p => ({x:Number(p.x), y:Number(p.y)})) : null;
      return {
        format: 'DigitalLogicAnalyzer', version: 1,
        gates: gates.map(gate => ({html:gate.outerHTML})),
        connections: connections.filter(c => ids.has(c.fromGate) && ids.has(c.toGate)).map(c => ({
          from:ids.get(c.fromGate), to:ids.get(c.toGate),
          inputIndex:Number(c.inputIndex) || 0,outputIndex:Number(c.outputIndex) || 0,
          bends:points(c.bends),routePoints:points(c.routePoints),
          startDirection:c.startDirection || '',endDirection:c.endDirection || '',
          color:c.line?.dataset.wireColor || c.line?.getAttribute('stroke') || '#00ffff',
          openBranch:c.openBranch ? {
            wire:openIds.get(c.openBranch.wire),
            segment:c.openBranch.segment || 0,
            ratio:c.openBranch.ratio || 0
          } : null
        })),
        openWires: allOpen.filter(w => ids.has(w.sourceGate)).map(w => ({
          sourceGate:ids.get(w.sourceGate),sourceKind:w.sourceKind,
          sourceIndex:Number(w.sourceIndex)||0,vertices:points(w.vertices),
          color:w.color || '#00ffff',diagonal:w.line?.dataset.diagonalWire==='true',
          parentWire:openIds.has(w.parentWire) ? openIds.get(w.parentWire) : null,
          parentConnection:connectionIds.has(w.parentConnection) ? connectionIds.get(w.parentConnection) : null,
          parentSegment:Number(w.parentSegment)||0,parentRatio:Number(w.parentRatio)||0
        })),
        inputs:window.__dlaGetInputStates?.() || [],
        outputs:window.__dlaGetOutputNames?.() || []
      };
    }

    clearCircuit() {
      if (typeof cancelCurrentWire === 'function') cancelCurrentWire();
      window.__dlaClearOpenWires?.();
      if (typeof clearCanvasSelection === 'function') clearCanvasSelection();
      drawingArea.querySelectorAll('.logic-gate').forEach(g => g.remove());
      for (const connection of connections) {
        connection.line?.remove();
        connection.openBranch?.dot?.remove();
      }
      connections.length = 0;
      wireLayer.querySelectorAll('.wire-confirmed-junction').forEach(dot => dot.remove());
      if (typeof updateWires === 'function') updateWires();
    }

    newCircuit() {
      const hasContent = drawingArea.querySelector('.logic-gate') || connections.length || window.__dlaGetOpenWires?.().length;
      if (hasContent && !window.confirm('Create a new circuit? Unsaved changes will be lost.')) return;
      this.clearCircuit();
      window.__dlaSetInputStates?.(['A','B','C','D','E','F','G'].map(key => ({key,label:key,value:key==='A'?1:0})));
      window.__dlaSetOutputNames?.(['X','Y','Z','W','V','U']);
      // A new document starts with fresh Undo / Redo history.
      if (typeof undoStack !== 'undefined') undoStack.length = 0;
      if (typeof redoStack !== 'undefined') redoStack.length = 0;
      if (typeof updateHistoryButtons === 'function') updateHistoryButtons();
      document.dispatchEvent(new CustomEvent('dla-circuit-opened'));
    }

    saveCircuit() {
      try {
        const data = JSON.stringify(this.readCircuit(), null, 2);
        const blob = new Blob([data], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;link.download = 'DigitalLogicCircuit.dla.json';
        document.body.appendChild(link);link.click();link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } catch(error) {
        console.error('Could not save circuit',error);
        window.alert('Could not save the circuit. See the browser console.');
      }
    }

    async openSelectedFile() {
      const file = this.fileInput.files?.[0];
      if (!file) return;
      try {
        if (file.size > 12_000_000) throw new Error('Circuit file is too large.');
        const data = JSON.parse(await file.text());
        if (!data || data.format !== 'DigitalLogicAnalyzer' || data.version !== 1 ||
            !Array.isArray(data.gates) || !Array.isArray(data.connections) || !Array.isArray(data.openWires)) {
          throw new Error('Not a compatible Digital Logic Analyzer circuit file.');
        }
        if (data.gates.length > 500 || data.connections.length > 4000 || data.openWires.length > 4000) {
          throw new Error('Circuit exceeds the supported component limit.');
        }
        const importedGates = data.gates.map(item => {
          const temp = document.createElement('template');
          temp.innerHTML = String(item.html || '').trim();
          const gate = temp.content.firstElementChild;
          if (!gate?.classList.contains('logic-gate') || gate.querySelector('script,iframe,object,embed')) {
            throw new Error('Invalid gate markup in circuit file.');
          }
          for (const el of [gate, ...gate.querySelectorAll('*')]) {
            for (const attr of [...el.attributes]) if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
          }
          return gate;
        });
        for (const c of data.connections) {
          if (!Number.isInteger(c.from) || !Number.isInteger(c.to) || !importedGates[c.from] || !importedGates[c.to]) {
            throw new Error('Circuit contains invalid wire references.');
          }
        }
        if ((drawingArea.querySelector('.logic-gate') || connections.length || window.__dlaGetOpenWires?.().length) &&
          !window.confirm('Open this circuit? Unsaved changes will be lost.')) return;
        this.clearCircuit();
        importedGates.forEach(gate => drawingArea.appendChild(gate));
        const restoredConnections = [];
        for (const item of data.connections) {
          const fromGate = importedGates[item.from], toGate = importedGates[item.to];
          const outputPin = fromGate.querySelector(`.output-pin[data-output="${item.outputIndex||0}"]`) || fromGate.querySelector('.output-pin');
          const inputPin = toGate.querySelector(`.input-pin[data-pin="${item.inputIndex}"]`);
          if (!outputPin || !inputPin) continue;
          const line = createWire(getPinPosition(outputPin), getPinPosition(inputPin), item.bends || []);
          if (/^#[\da-fA-F]{6}$/.test(item.color || '')) {
            line.dataset.wireColor = item.color;
            line.setAttribute('stroke',item.color);
            line.style.filter = `drop-shadow(0 0 5px ${item.color})`;
          }
          const connection = {
            fromGate,toGate,inputIndex:Number(item.inputIndex)||0,outputIndex:Number(item.outputIndex)||0,
            bends:item.bends || [],line,
            startDirection:item.startDirection || '',endDirection:item.endDirection || ''
          };
          if (Array.isArray(item.routePoints)) connection.routePoints=item.routePoints.map(p=>({x:p.x,y:p.y}));
          connections.push(connection);
          restoredConnections.push(connection);
        }
        window.__dlaRestoreOpenWires?.(data.openWires, importedGates, restoredConnections);
        const opened = window.__dlaGetOpenWires?.() || [];
        data.connections.forEach((item,i) => {
          const connection=restoredConnections[i];
          const saved=item.openBranch;
          if (!connection || !saved || !Number.isInteger(saved.wire) || !opened[saved.wire]) return;
          const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
          dot.classList.add('wire-confirmed-junction');
          dot.setAttribute('r','4.5');dot.setAttribute('fill',opened[saved.wire].color);
          dot.style.pointerEvents='none';
          wireLayer.appendChild(dot);
          connection.openBranch={wire:opened[saved.wire],segment:saved.segment||0,ratio:saved.ratio||0,dot};
        });
        window.__dlaSetInputStates?.(data.inputs);
        window.__dlaSetOutputNames?.(data.outputs);
        updateWires();
        if (typeof undoStack !== 'undefined') undoStack.length=0;
        if (typeof redoStack !== 'undefined') redoStack.length=0;
        if (typeof updateHistoryButtons === 'function') updateHistoryButtons();
        document.dispatchEvent(new CustomEvent('dla-circuit-opened'));
      } catch(error) {
        console.error('Could not open circuit', error);
        window.alert(error?.message || 'Could not open the circuit file.');
      } finally {this.fileInput.value='';}
    }

    exportPdf() {
      if (typeof window.dlaExportColoredPdf !== 'function') {
        window.alert('PDF export is unavailable.');
        return;
      }
      return window.dlaExportColoredPdf();
    }

    showHelp() {
      if (!this.helpDialog) {
        const dialog=document.createElement('dialog');
        dialog.className='dla-help-dialog';
        dialog.innerHTML=`<h2>Digital Logic Analyzer — Help</h2>
          <p><strong>Components:</strong> Add inputs, gates and advanced components from their panels.</p>
          <p><strong>Wires:</strong> Click an output pin and then an input pin. Double-click a wire to branch. Use Enter to leave an open wire and Escape to cancel drawing.</p>
          <p><strong>Editing:</strong> Select objects on the canvas, right-click for options, and use Ctrl+Z / Ctrl+Y for Undo / Redo.</p>
          <p><strong>Files:</strong> Save downloads a <code>.dla.json</code> circuit file; Open restores one. New clears the canvas.</p>
          <p><strong>Run:</strong> Start or stop simulation. Unknown output is displayed as a dash.</p>
          <p><strong>Print:</strong> Click a report frame to preview and print it in black and white. <strong>Export PDF:</strong> Download all seven report frames as one black-and-white PDF.</p>
          <form method="dialog"><button type="submit">Close</button></form>`;
        document.body.appendChild(dialog);
        this.helpDialog=dialog;
      }
      this.helpDialog.showModal();
    }

    addPrintStyles() {
      const style=document.createElement('style');
      style.textContent=`
        .dla-help-dialog{max-width:650px;width:min(90vw,650px);border:1px solid #00bfff;
          border-radius:12px;background:#07152e;color:#f0f8ff;padding:24px;
          box-shadow:0 0 25px #00bfff50;font:15px/1.5 Arial,sans-serif}
        .dla-help-dialog::backdrop{background:#000a}
        .dla-help-dialog h2{color:#43c8ff;margin-top:0}
        .dla-help-dialog button{background:#124171;color:white;border:1px solid #00bfff;
          border-radius:6px;padding:9px 24px;cursor:pointer}
        .dla-help-dialog form{text-align:right}

      `;
      document.head.appendChild(style);
    }
  }
  window.dlaToolbarManager = new ToolbarManager();
})();
