// Automatic Boolean analysis. Uses the existing Truth Table as the source of truth.
// No manual expressions. Existing circuit, simulation, truth table and K-map stay unchanged.
(() => {
  'use strict';
  const host = document.querySelector('.circuit-section');
  if (!host || document.querySelector('.algebra-panel')) return;
  const panel = document.createElement('section');
  panel.className = 'algebra-panel';
  panel.innerHTML = `
    <h3>Boolean Algebra &amp; Simplification</h3>
    <div class="algebra-controls"><label for="algebra-output">Output:</label>
      <select id="algebra-output" aria-label="Select circuit output"></select></div>
    <div class="algebra-message" role="status" aria-live="polite">Connect a circuit output and press Run to analyze it.</div>
    <div class="algebra-results" hidden>
      <div class="algebra-top-columns">
        <section class="algebra-canonical-card algebra-result-card" aria-label="Minterms and Maxterms from Truth Table">
          <h4>Minterms &amp; Maxterms</h4>
          <div class="algebra-canonical-summary">
            <div class="algebra-canonical-line"><span class="algebra-canonical-label">Minterms (X = 1)</span><span class="algebra-canonical-minterms"></span></div>
            <div class="algebra-canonical-line"><span class="algebra-canonical-label">Maxterms (X = 0)</span><span class="algebra-canonical-maxterms"></span></div>
          </div>
        </section>
        <section class="algebra-demorgan" aria-label="De Morgan theorem analysis">
          <h4>De Morgan's Theorems (From Circuit)</h4>
          <div class="algebra-demorgan-body"></div>
        </section>
        <section class="algebra-original algebra-result-card" aria-label="Original expression from circuit">
          <h4>Original Expression (From Circuit)</h4>
          <div class="algebra-math algebra-original-formula"></div>
        </section>
      </div>
      <section class="algebra-laws-from-circuit" aria-label="Additional Boolean laws from circuit">
        <h4>Boolean Laws (From Circuit)</h4>
        <div class="algebra-law-cards">
          <article class="algebra-law-card" data-law="distributive"><h5>Distributive Law</h5><div class="algebra-law-detail"></div></article>
          <article class="algebra-law-card" data-law="commutative"><h5>Commutative Law</h5><div class="algebra-law-detail"></div></article>
          <article class="algebra-law-card" data-law="associative"><h5>Associative Law</h5><div class="algebra-law-detail"></div></article>
        </div>
      </section>
      <div class="algebra-two-columns">
        <section class="algebra-method algebra-sop-method">
          <h4>SOP Simplification (Sum of Products)</h4>
          <div class="algebra-table-scroll"><table class="algebra-law-table"><thead><tr><th>Boolean Equation / Steps</th><th>Law Used</th></tr></thead><tbody class="algebra-sop-steps"></tbody></table></div>
          <div class="algebra-final"><strong>Minimal SOP (Final Result)</strong><div class="algebra-math algebra-sop"></div></div>
        </section>
        <section class="algebra-method algebra-pos-method">
          <h4>POS Simplification (Product of Sums)</h4>
          <div class="algebra-table-scroll"><table class="algebra-law-table"><thead><tr><th>Boolean Equation / Steps</th><th>Law Used</th></tr></thead><tbody class="algebra-pos-steps"></tbody></table></div>
          <div class="algebra-final"><strong>Minimal POS (Final Result)</strong><div class="algebra-math algebra-pos"></div></div>
        </section>
      </div>
      <p class="algebra-verified" aria-live="polite"></p>
    </div>`;
  const timing = host.querySelector('.timing-diagram-panel');
  if (timing) timing.insertAdjacentElement('beforebegin', panel);
  else host.append(panel);

  const style = document.createElement('style');
  style.textContent = `
    .algebra-panel{margin-top:18px;padding:17px 20px;border:1px solid #00bfff;border-radius:10px;background:#08152b;box-shadow:0 0 10px rgba(0,191,255,.16);color:#e8f5ff}
    .algebra-panel h3{text-align:center;color:#58c7ff;font-size:19px;margin:0 0 13px}
    .algebra-controls{display:flex;justify-content:center;align-items:center;gap:9px;margin:0 0 14px;color:#b9d6ed}
    .algebra-controls select{background:#10345a;color:white;border:1px solid #28719e;border-radius:5px;padding:6px 12px}
    .algebra-message{text-align:center;color:#a9bacb;margin:12px auto}
    .algebra-top-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:stretch}
    .algebra-top-columns>.algebra-result-card,.algebra-top-columns>.algebra-demorgan{min-width:0;display:flex;flex-direction:column;justify-content:center}
    .algebra-result-card{border:1px solid #174973;background:#061127;border-radius:10px;padding:13px;text-align:center;min-width:0;overflow-x:auto}
    .algebra-result-card h4{color:#58c7ff;margin:0 0 12px;text-align:center}
    .algebra-canonical-summary{display:grid;gap:9px;margin-top:0;padding-top:0;direction:ltr}
    .algebra-canonical-line{display:flex;justify-content:center;align-items:center;gap:7px;flex-wrap:wrap;font-size:13px;line-height:1.5}
    .algebra-canonical-label{color:#58c7ff;font-weight:700;text-align:center}
    .algebra-canonical-minterms,.algebra-canonical-maxterms{color:#e8f5ff;font:700 13px/1.5 Consolas,'Courier New',monospace;overflow-wrap:anywhere}
    @media(max-width:600px){.algebra-canonical-line{gap:5px}}
    .algebra-math{font:700 17px/1.8 Consolas,'Courier New',monospace;color:#f6fbff;direction:ltr;white-space:normal;overflow-wrap:anywhere}
    .algebra-name{color:#39ff14}
    .algebra-overbar{display:inline-block;border-top:2.5px solid currentColor;line-height:1.15;padding-top:2px;vertical-align:middle}
    .algebra-demorgan{margin-top:0;border:1px solid #23567e;border-radius:8px;padding:12px 14px;text-align:center;background:#071c32}
    .algebra-demorgan h4{color:#58c7ff;margin:0 0 8px;font-size:15px}
    .algebra-demorgan-body{color:#cee4f5;font-size:13px}
    .algebra-demorgan-proof{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:12px;font:700 16px/1.7 Consolas,monospace}
    .algebra-demorgan-arrow{color:#58c7ff}
    .algebra-laws-from-circuit{margin-top:15px;border:1px solid #23567e;border-radius:9px;padding:12px;background:#071c32}
    .algebra-laws-from-circuit>h4{text-align:center;color:#58c7ff;margin:0 0 11px;font-size:15px}
    .algebra-law-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .algebra-law-card{background:#08152b;border:1px solid #225078;border-radius:8px;padding:12px 9px;min-width:0;text-align:center}
    .algebra-law-card h5{color:#59caff;margin:0 0 9px;font-size:14px}
    .algebra-law-detail{font-size:12px;line-height:1.7;color:#c7d9e8}
    .algebra-law-example{margin:9px 0 0;border-top:1px solid #244e72;padding-top:9px}
    .algebra-law-example .algebra-math{font-size:14px;overflow-wrap:anywhere}
    .algebra-law-subtitle{font-size:11px;color:#93b5cf}
    @media(max-width:1050px){.algebra-law-cards{grid-template-columns:1fr}}
    .algebra-two-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch;gap:14px;margin-top:16px}
    .algebra-method{display:flex;flex-direction:column;min-width:0;border:1px solid #1875b3;border-radius:10px;overflow:hidden;background:#061127}
    .algebra-method>h4{color:#58c7ff;margin:0;padding:12px 8px;text-align:center;background:#0b3155;font-size:16px}
    .algebra-table-scroll{overflow-x:auto;flex:1}
    .algebra-law-table{border-collapse:collapse;width:100%;table-layout:fixed;color:#e8f5ff}
    .algebra-law-table th{background:#10345a;color:#bceaff;font-size:13px;padding:10px 7px;border:1px solid #27628e}
    .algebra-law-table th:first-child{width:72%}
    .algebra-law-table td{border:1px solid #23567e;padding:10px 8px;vertical-align:middle;text-align:center;background:#081b33}
    .algebra-law-table tr:nth-child(even) td{background:#0b2441}
    .algebra-law-table td.law{font-size:12px;line-height:1.5;color:#d8ecff;overflow-wrap:anywhere}
    .algebra-law-name{font-weight:700;color:#58c7ff;margin-bottom:5px}
    .algebra-law-math{font:700 13px/1.6 Consolas,'Courier New',monospace;white-space:normal;overflow-wrap:anywhere}
    .algebra-law-math .algebra-name{color:#f6fbff}
    /* Match the group identities in Karnaugh Map: Group 1 green, Group 2 pink. */
    .algebra-law-table tr.algebra-group-1{--group-accent:#5bfb4a;--group-tint:rgba(91,251,74,.065)}
    .algebra-law-table tr.algebra-group-2{--group-accent:#f26be9;--group-tint:rgba(242,107,233,.075)}
    .algebra-law-table tr.algebra-group-row td:first-child{box-shadow:inset 4px 0 var(--group-accent);background:linear-gradient(90deg,var(--group-tint),#081b33 60%)}
    .algebra-law-table tr.algebra-group-row:nth-child(even) td:first-child{background:linear-gradient(90deg,var(--group-tint),#0b2441 60%)}
    .algebra-law-table tr.algebra-group-row .algebra-step-number{color:var(--group-accent)}
    .algebra-law-table tr.algebra-group-row .algebra-math>.algebra-name{color:var(--group-accent)}
    .algebra-law-table tr.algebra-group-row .algebra-law-name{color:var(--group-accent)}
    .algebra-law-table tr.algebra-group-row td.law{border-left-color:var(--group-accent)}
    .algebra-law-table .algebra-math{font-size:15px}
    .algebra-step-number{display:block;color:#58c7ff;font-size:11px;font-weight:700;margin-bottom:5px}
    .algebra-final{margin:12px;padding:12px;border:1px solid #39ff75;border-radius:8px;background:#073328;text-align:center}
    .algebra-final strong{color:#abffbd;display:block;margin-bottom:5px;font-size:13px}
    .algebra-final .algebra-math{font-size:18px}
    .algebra-verified{text-align:center;color:#39ff14;margin:15px 0 0;font-size:13px}
    @media(max-width:1050px){.algebra-top-columns{grid-template-columns:1fr}}
    @media(max-width:850px){.algebra-two-columns{grid-template-columns:1fr}}
    @media(max-width:450px){.algebra-panel{padding:12px 8px}.algebra-math{font-size:15px}.algebra-law-table .algebra-math{font-size:13px}}
  `;
  document.head.append(style);

  const dropdown = panel.querySelector('#algebra-output');
  const msg = panel.querySelector('.algebra-message');
  const results = panel.querySelector('.algebra-results');
  const originalNode = panel.querySelector('.algebra-original-formula');
  const mintermsSummaryNode = panel.querySelector('.algebra-canonical-minterms');
  const maxtermsSummaryNode = panel.querySelector('.algebra-canonical-maxterms');
  const mintermsLabel = panel.querySelector('.algebra-canonical-line:first-child .algebra-canonical-label');
  const maxtermsLabel = panel.querySelector('.algebra-canonical-line:last-child .algebra-canonical-label');
  const sopNode = panel.querySelector('.algebra-sop');
  const posNode = panel.querySelector('.algebra-pos');
  const sopStepsNode = panel.querySelector('.algebra-sop-steps');
  const posStepsNode = panel.querySelector('.algebra-pos-steps');
  const verifiedNode = panel.querySelector('.algebra-verified');
  const demorganNode = panel.querySelector('.algebra-demorgan-body');
  const extraLawCards = Object.fromEntries([...panel.querySelectorAll('.algebra-law-card')]
    .map(card => [card.dataset.law, card.querySelector('.algebra-law-detail')]));
  const run = document.getElementById('runBtn');
  let truth = window.__logicTruthData || null;
  let runStarted = false;

  const text = value => document.createTextNode(String(value));
  const el = (tag,cls) => {const node = document.createElement(tag);if(cls)node.className=cls;return node;};
  function bar(content) {const node=el('span','algebra-overbar');node.append(content);return node;}
  function variable(name,negated=false) {
    const node=el('span','algebra-name');node.textContent=name;
    return negated?bar(node):node;
  }
  function formula(parts) {const node=document.createDocumentFragment();parts.forEach(p=>node.append(typeof p==='string'?text(p):p));return node;}
  function expressionNode(gate, incoming, stack=new Set(), pin=0) {
    if(!gate) return null;
    const key = `${gate.__algebraId || (gate.__algebraId = Math.random().toString(36).slice(2))}:${pin}`;
    if(stack.has(key)) return null;
    stack.add(key);
    const type=gate.dataset.type;
    let value;
    if(type==='INPUT'){
      const name=gate.querySelector('svg')?.dataset.label || gate.querySelector('.source-label')?.textContent?.trim();
      value=name?variable(name):null;
    } else if(type==='OUTPUT') {const src=incoming.get(gate)?.get(0);value=expressionNode(src?.gate || src,incoming,stack,src?.pin||0);}
    else {
      const count=type==='NOT'?1:Math.min(16,Math.max(2,Number(gate.dataset.inputs)||2));
      const operands=Array.from({length:count},(_,i)=>{const src=incoming.get(gate)?.get(i);return expressionNode(src?.gate || src,incoming,stack,src?.pin||0);});
      if(operands.some(x=>!x)) value=null;
      else if(type==='ENCODER') {
        const terms=[];
        const bit=Math.log2(operands.length)-1-pin;
        for(let i=0;i<operands.length;i++) if((i>>bit)&1) terms.push(operands[i].cloneNode(true));
        const parts=['('];
        terms.forEach((term,i)=>{if(i)parts.push(' + ');parts.push(term);});
        parts.push(')');value=formula(parts);
      } else if(type==='MUX' || type==='DEMUX') {
        const size=Number(gate.dataset.muxSize)===4?4:2;
        const n=Math.log2(size);
        const enabled=gate.dataset.enable==='1';
        const makeProduct=terms=>formula(['(',...terms.flatMap((term,i)=>i?[' · ',term]:[term]),')']);
        const selectionFactor=(op,selected)=>selected?op.cloneNode(true):bar(op.cloneNode(true));
        if(type==='DEMUX') {
          const factors=[operands[0].cloneNode(true)];
          for(let i=n-1;i>=0;i--)factors.push(selectionFactor(operands[1+i],Boolean(pin&(1<<i))));
          if(enabled)factors.push(operands[1+n].cloneNode(true));
          value=pin>=0&&pin<size?makeProduct(factors):null;
        } else {
          const products=[];
          for(let outputIndex=0;outputIndex<size;outputIndex++){
            const factors=[];
            for(let i=n-1;i>=0;i--)factors.push(selectionFactor(operands[size+i],Boolean(outputIndex&(1<<i))));
            factors.push(operands[outputIndex].cloneNode(true));
            products.push(makeProduct(factors));
          }
          const sum=formula(['(',...products.flatMap((term,i)=>i?[' + ',term]:[term]),')']);
          value=enabled?makeProduct([operands[size+n].cloneNode(true),sum]):sum;
        }
      } else if(type==='DECODER') {
        const enabled=gate.dataset.enable==='1';
        const data=enabled?operands.slice(0,-1):operands;
        const parts=['('];
        data.forEach((op,i)=>{if(i)parts.push(' · ');parts.push(((pin>>(data.length-i-1))&1)?op.cloneNode(true):bar(op.cloneNode(true)));});
        if(enabled)parts.push(' · ',operands.at(-1).cloneNode(true));
        parts.push(')');value=formula(parts);
      } else if(type==='NOT') value=bar(formula(['(',operands[0],')']));
      else if(type==='COMPARATOR') {
        const [a,b]=operands;
        if(pin===0) value=formula(['(',bar(a.cloneNode(true)),' · ',b.cloneNode(true),')']);
        else if(pin===1) value=bar(formula(['(',a.cloneNode(true),' ⊕ ',b.cloneNode(true),')']));
        else if(pin===2) value=formula(['(',a.cloneNode(true),' · ',bar(b.cloneNode(true)),')']);
        else value=null;
      }
      else if(type==='FULL_ADDER' && pin===1) {
        const [a,b,cin]=operands;
        value=formula(['((',a.cloneNode(true),' · ',b.cloneNode(true),') + (',cin.cloneNode(true), ' · (',a.cloneNode(true),' ⊕ ',b.cloneNode(true),')))']);
      } else if(type==='PARALLEL_ADDER') {
        const a0=operands[0], b0=operands[1], a1=operands[2], b1=operands[3], cin=operands[4];
        const clone=x=>x.cloneNode(true);
        const c1=()=>formula(['((',clone(a0),' · ',clone(b0),') + (',clone(cin),' · (',clone(a0),' ⊕ ',clone(b0),')))']);
        if(pin===0) value=formula(['(',clone(a0),' ⊕ ',clone(b0),' ⊕ ',clone(cin),')']);
        else if(pin===1) value=formula(['(',clone(a1),' ⊕ ',clone(b1),' ⊕ ',c1(),')']);
        else value=formula(['((',clone(a1),' · ',clone(b1),') + (',c1(),' · (',clone(a1),' ⊕ ',clone(b1),')))']);
      } else {
        const join=type==='HALF_ADDER' ? (pin===1?' · ':' ⊕ ') : type==='AND'||type==='NAND'?' · ':type==='OR'||type==='NOR'?' + ': ' ⊕ ';
        const arr=['(']; operands.forEach((op,i)=>{if(i)arr.push(join);arr.push(op);});arr.push(')');
        value=(type==='NAND'||type==='NOR'||type==='XNOR')?bar(formula(arr)):formula(arr);
      }
    }
    stack.delete(key);
    return value;
  }
  function outputFormula(index){
    if(typeof drawingArea==='undefined'||typeof connections==='undefined') return null;
    const gates=[...drawingArea.querySelectorAll('.logic-gate')],live=new Set(gates);
    const outputs=gates.filter(g=>g.dataset.type==='OUTPUT');
    const incoming=new Map();
    for(const c of connections){
      if(!live.has(c.fromGate)||!live.has(c.toGate))continue;
      if(!incoming.has(c.toGate))incoming.set(c.toGate,new Map());
      incoming.get(c.toGate).set(Number(c.inputIndex),{gate:c.fromGate,pin:c.outputIndex||0});
    }
    return expressionNode(outputs[index],incoming);
  }
  // Display a genuine De Morgan transformation only if the selected circuit
  // actually contains NAND, NOR or NOT applied to AND / OR.
  function deMorganExample(index) {
    if(typeof drawingArea==='undefined'||typeof connections==='undefined')return null;
    const gates=[...drawingArea.querySelectorAll('.logic-gate')];
    const outputs=gates.filter(g=>g.dataset.type==='OUTPUT');
    const live=new Set(gates), incoming=new Map();
    for(const c of connections){
      if(!live.has(c.fromGate)||!live.has(c.toGate))continue;
      if(!incoming.has(c.toGate))incoming.set(c.toGate,new Map());
      incoming.get(c.toGate).set(Number(c.inputIndex),c.fromGate);
    }
    const seen=new Set();
    function visit(g){
      if(!g||seen.has(g))return null;
      seen.add(g);
      let op=g.dataset.type;
      let inner=g;
      if(op==='NOT'){
        inner=incoming.get(g)?.get(0);
        op=inner?.dataset.type;
      }
      if(['NAND','NOR','AND','OR'].includes(op)){
        const direct=g.dataset.type===op;
        if(direct && (op==='AND'||op==='OR')){
          // AND / OR by themselves are not a De Morgan operation.
        }else{
          const kind=op==='NAND'?'AND':op==='NOR'?'OR':op;
          const count=Math.max(2,Math.min(8,Number(inner?.dataset.inputs)||2));
          const children=Array.from({length:count},(_,i)=>incoming.get(inner)?.get(i));
          if(children.every(Boolean)){
            return {kind,children,incoming};
          }
        }
      }
      for(const source of (incoming.get(g)?.values()||[])){
        const found=visit(source);if(found)return found;
      }
      return null;
    }
    return visit(outputs[index]);
  }
  function showDeMorgan(index) {
    demorganNode.replaceChildren();
    const example=deMorganExample(index);
    if(!example){
      demorganNode.textContent='No De Morgan transformation is needed for this circuit. The law applies when an AND/OR result is negated (for example, NAND or NOR).';
      return;
    }
    const {kind,children,incoming}=example;
    const symbols=children.map(g=>expressionNode(g,incoming));
    if(symbols.some(x=>!x)){
      demorganNode.textContent='De Morgan transformation is unavailable for an incomplete gate.';
      return;
    }
    const join=kind==='AND'?' · ':' + ';
    const opposite=kind==='AND'?' + ':' · ';
    function left(){
      const inner=['('];
      children.forEach((g,i)=>{if(i)inner.push(join);inner.push(expressionNode(g,incoming));});
      inner.push(')');
      return bar(formula(inner));
    }
    function right(){
      const bits=[];
      children.forEach((g,i)=>{
        if(i)bits.push(opposite);
        bits.push(bar(formula(['(',expressionNode(g,incoming),')'])));
      });
      return formula(bits);
    }
    const caption=el('div');caption.textContent=kind==='AND'?'De Morgan: NOT(AND) becomes OR of negated inputs.':'De Morgan: NOT(OR) becomes AND of negated inputs.';
    const proof=el('div','algebra-demorgan-proof');
    proof.append(left(),text(' = '),right());
    demorganNode.append(caption,proof);
  }
  // Extract a structural Boolean expression from the selected circuit. All
  // examples below are equivalence-preserving transformations of this AST;
  // they are NOT scripted examples unrelated to the current connections.
  function circuitAst(outputIndex){
    if(typeof drawingArea==='undefined'||typeof connections==='undefined')return null;
    const gates=[...drawingArea.querySelectorAll('.logic-gate')],live=new Set(gates);
    const outputs=gates.filter(g=>g.dataset.type==='OUTPUT');
    const incoming=new Map();
    for(const c of connections){
      if(!live.has(c.fromGate)||!live.has(c.toGate))continue;
      if(!incoming.has(c.toGate))incoming.set(c.toGate,new Map());
      incoming.get(c.toGate).set(Number(c.inputIndex),c.fromGate);
    }
    function build(g,stack=new Set()){
      if(!g||stack.has(g))return null;
      const next=new Set(stack);next.add(g);
      const op=g.dataset.type;
      if(op==='INPUT'){
        const name=g.querySelector('svg')?.dataset.label||g.querySelector('.source-label')?.textContent?.trim();
        return name?{op:'VAR',name}:null;
      }
      if(op==='OUTPUT')return build(incoming.get(g)?.get(0),next);
      const count=op==='NOT'?1:Math.min(8,Math.max(2,Number(g.dataset.inputs)||2));
      const args=Array.from({length:count},(_,i)=>build(incoming.get(g)?.get(i),next));
      if(args.some(a=>!a))return null;
      if(op==='NOT')return {op:'NOT',args};
      if(op==='NAND'||op==='NOR'||op==='XNOR')return {op:'NOT',args:[{op:op==='NAND'?'AND':op==='NOR'?'OR':'XOR',args}]};
      if(!['AND','OR','XOR'].includes(op))return null;
      return {op,args};
    }
    return build(outputs[outputIndex]);
  }
  const astNode=(op,...args)=>({op,args});
  function astMath(node){
    if(node.op==='VAR')return variable(node.name);
    if(node.op==='NOT')return bar(formula(['(',astMath(node.args[0]),')']));
    const parts=['('],sep=node.op==='AND'?' · ':node.op==='OR'?' + ':' ⊕ ';
    node.args.forEach((child,i)=>{if(i)parts.push(sep);parts.push(astMath(child));});
    parts.push(')');return formula(parts);
  }
  function astValue(node,inputs){
    if(node.op==='VAR')return inputs[node.name];
    if(node.op==='NOT')return 1-astValue(node.args[0],inputs);
    const values=node.args.map(child=>astValue(child,inputs));
    if(node.op==='AND')return Number(values.every(Boolean));
    if(node.op==='OR')return Number(values.some(Boolean));
    return values.reduce((a,b)=>a^b,0);
  }
  // Replace only one matching subtree while keeping all surrounding logic.
  function changeOnce(node,transform){
    const rewritten=transform(node);
    if(rewritten)return {node:rewritten,changed:true};
    if(!node.args)return {node,changed:false};
    for(let i=0;i<node.args.length;i++){
      const child=changeOnce(node.args[i],transform);
      if(child.changed){const args=node.args.slice();args[i]=child.node;return {node:{...node,args},changed:true};}
    }
    return {node,changed:false};
  }
  function lawTransformation(node,kind){
    if(!node)return null;
    let lawFormula='',description='';
    const action=kind==='commutative'?n=>{
      if(!['AND','OR'].includes(n.op)||n.args.length<2)return null;
      const args=n.args.slice();[args[0],args[1]]=[args[1],args[0]];
      return {...n,args};
    }:kind==='associative'?n=>{
      if(!['AND','OR'].includes(n.op)||n.args.length!==2||
         n.args[0].op!==n.op||n.args[0].args.length!==2)return null;
      const [a,b]=n.args[0].args,c=n.args[1];
      return astNode(n.op,a,astNode(n.op,b,c));
    }:n=>{
      if(!['AND','OR'].includes(n.op)||n.args.length!==2)return null;
      const innerOp=n.op==='AND'?'OR':'AND';
      const index=n.args.findIndex(a=>a.op===innerOp && a.args.length>=2);
      if(index===-1)return null;
      const other=n.args[1-index],inside=n.args[index];
      return astNode(innerOp,...inside.args.map(term=>astNode(n.op,other,term)));
    };
    const transformed=changeOnce(node,action);
    if(!transformed.changed)return null;
    if(kind==='distributive'){
      lawFormula='P · (Q + R) = P · Q + P · R';
      description='An AND/OR combination is distributed over its inner operation.';
    }else if(kind==='commutative'){
      lawFormula='P + Q = Q + P;  P · Q = Q · P';
      description='Swapping operands does not change the result.';
    }else{
      lawFormula='(P + Q) + R = P + (Q + R)';
      description='Regrouping connected operations does not change the result.';
    }
    return {before:node,after:transformed.node,lawFormula,description};
  }
  function showAdditionalLaws(index,truthData){
    const ast=circuitAst(index);
    for(const [kind,target] of Object.entries(extraLawCards)){
      target.replaceChildren();
      if(!ast){target.textContent='Connect all gates to view applicable transformations.';continue;}
      const example=lawTransformation(ast,kind);
      if(!example){
        target.textContent='No applicable '+kind+' pattern exists in the selected circuit.';
        continue;
      }
      // Verify both forms against ALL input combinations rather than
      // publishing a plausible-looking but incorrect algebraic derivation.
      const vars=truthData.inputs||[];
      const equivalent=truthData.rows.every((row,i)=>{
        const env=Object.fromEntries(vars.map((name,j)=>[name,Number((i>>(vars.length-1-j))&1)]));
        return astValue(example.before,env)===astValue(example.after,env);
      });
      if(!equivalent){target.textContent='Transformation could not be verified.';continue;}
      const caption=el('div','algebra-law-subtitle');caption.textContent=example.description;
      const lawLine=el('div','algebra-law-subtitle');lawLine.textContent=example.lawFormula;
      const proof=el('div','algebra-law-example');
      const from=el('div','algebra-math'),to=el('div','algebra-math');
      put(from,truthData.outputs[index],astMath(example.before));
      put(to,truthData.outputs[index],astMath(example.after));
      const arrow=el('div','algebra-law-subtitle');arrow.textContent='Equivalent transformation ↓';
      proof.append(from,arrow,to);
      target.append(caption,lawLine,proof);
    }
  }

  function bits(m,n){return m.toString(2).padStart(n,'0');}
  function coverFor(minterms,n){
    if(minterms.length===0)return [];
    if(minterms.length===2**n)return [{pattern:'-'.repeat(n),cells:[...minterms]}];
    const all=[];
    for(let code=0;code<3**n;code++){
      let v=code,pattern='';
      for(let j=0;j<n;j++){pattern=['0','1','-'][v%3]+pattern;v=Math.floor(v/3);}
      const cells=minterms.filter(m=>[...pattern].every((p,j)=>p==='-'||p===bits(m,n)[j]));
      if(cells.length===2**[...pattern].filter(c=>c==='-').length && cells.length)all.push({pattern,cells});
    }
    // Prime implicants only, then exact minimum cover (group count, then literal count).
    const primes=all.filter(a=>!all.some(b=>b.cells.length>a.cells.length&&a.cells.every(m=>b.cells.includes(m))));
    let best=null, bestCost=Infinity;
    function search(chosen,covered){
      if(covered.size===minterms.length){
        const cost=chosen.length*100+chosen.reduce((s,g)=>s+[...g.pattern].filter(c=>c!=='-').length,0);
        if(cost<bestCost){bestCost=cost;best=chosen.slice();}return;
      }
      if(chosen.length*100>=bestCost)return;
      const remaining=minterms.filter(m=>!covered.has(m));
      const target=remaining.reduce((a,b)=>primes.filter(p=>p.cells.includes(a)).length<=primes.filter(p=>p.cells.includes(b)).length?a:b);
      for(const item of primes.filter(p=>p.cells.includes(target))){
        if(chosen.includes(item))continue;
        search([...chosen,item],new Set([...covered,...item.cells]));
      }
    }
    search([],new Set());
    return best||[];
  }
  function mintermNode(m,variables){const nodes=[];bits(m,variables.length).split('').forEach((bit,i)=>{if(i)nodes.push(' · ');nodes.push(variable(variables[i],bit==='0'));});return formula(nodes.length?nodes:['1']);}
  function groupNode(group,variables,kind){
    const nodes=[];
    [...group.pattern].forEach((bit,i)=>{
      if(bit==='-')return;
      if(nodes.length)nodes.push(kind==='POS'?' + ':' · ');
      nodes.push(variable(variables[i],kind==='POS'?bit==='1':bit==='0'));
    });
    if(!nodes.length)return text(kind==='POS'?'0':'1');
    return kind==='POS'?formula(['(',...nodes,')']):formula(nodes);
  }
  function minimized(groups,vars,kind){
    if(!groups.length)return text(kind==='SOP'?'0':'1');
    if(groups.length===1 && groups[0].pattern==='-'.repeat(vars.length))return text(kind==='SOP'?'1':'0');
    const arr=[];groups.forEach((g,i)=>{if(i)arr.push(kind==='SOP'?' + ':' · ');arr.push(groupNode(g,vars,kind));});return formula(arr);
  }
  function canonical(indices,variables,kind){
    if(!indices.length)return text(kind==='SOP'?'0':'1');
    const parts=[];
    indices.forEach((m,i)=>{
      if(i)parts.push(kind==='SOP'?' + ':' · ');
      const pattern={pattern:bits(m,variables.length)};
      parts.push(kind==='SOP'?mintermNode(m,variables):groupNode(pattern,variables,'POS'));
    });
    return formula(parts);
  }
  function put(node,label,equation){node.replaceChildren();node.append(variable(label),text(' = '),equation);}
  // A new math DOM fragment is built for each table cell. Never reuse a fragment.
  function copyMath(make) { return make(); }
  function tableRow(tbody, title, makeEquation, law, label) {
    const tr=el('tr'), equationCell=el('td'), lawCell=el('td','law');
    const groupMatch = title.match(/^(Zero )?Group (\d+):/);
    if (groupMatch) {
      tr.classList.add('algebra-group-row');
      const groupIndex = Number(groupMatch[2]) - 1;
      const kind = groupMatch[1] ? 'POS' : 'SOP';
      if (typeof window.__logicKMapGroupColor === 'function') {
        tr.style.setProperty('--group-accent', window.__logicKMapGroupColor(kind, groupIndex));
        tr.style.setProperty('--group-tint', 'rgba(40, 120, 170, .08)');
      }
    }
    const step=el('span','algebra-step-number'); step.textContent='Step '+(tbody.children.length+1)+' — '+title;
    const math=el('div','algebra-math');put(math,label,copyMath(makeEquation));
    equationCell.append(step,math);
    const lawName=el('div','algebra-law-name'); lawName.textContent=law.name;
    const lawFormula=el('div','algebra-law-math');
    lawFormula.append(law.equation());
    lawCell.append(lawName,lawFormula);
    tr.append(equationCell,lawCell);tbody.append(tr);
  }
  function fixedLiterals(pattern,vars,kind) {
    const nodes=[];
    [...pattern].forEach((bit,i)=>{
      if(bit==='-')return;
      if(nodes.length)nodes.push(kind==='SOP'?' · ':' + ');
      nodes.push(variable(vars[i],kind==='SOP'?bit==='0':bit==='1'));
    });
    return nodes;
  }
  function groupInput(group,vars,kind) {
    const values=group.cells.slice().sort((a,b)=>a-b),items=[];
    for(const [i,index] of values.entries()){
      if(i)items.push(kind==='SOP'?' + ':' · ');
      items.push(kind==='SOP'?mintermNode(index,vars):groupNode({pattern:bits(index,vars.length)},vars,'POS'));
    }
    return formula(items);
  }
  function groupFactored(group,vars,kind,phase) {
    const fixed=fixedLiterals(group.pattern,vars,kind);
    const free=[...group.pattern].flatMap((c,i)=>c==='-'?[vars[i]]:[]);
    if(!free.length)return groupNode(group,vars,kind);
    if(kind==='SOP'){
      const parts=[];
      if(fixed.length)parts.push('(',...fixed,') · ');
      for(const [i,name] of free.entries()){
        if(i)parts.push(' · ');
        if(phase==='factored')parts.push('(',variable(name,true),' + ',variable(name),')');
        else parts.push('1');
      }
      return formula(parts);
    }
    const base=fixed.length?['(',...fixed,')']:['0'];
    const pieces=[];
    for(const [i,name] of free.entries()){
      if(i)pieces.push(' · ');
      if(phase==='factored')pieces.push('(',variable(name,true),' · ',variable(name),')');
      else pieces.push('0');
    }
    return formula([...base,' + ',...pieces]);
  }
  // Each displayed law includes both its name and its actual Boolean identity.
  // The proof rows label which variables are involved in the current transformation.
  function law(name, makeEquation){return {name,equation:makeEquation};}
  function canonicalLaw(kind, indices, outputName){
    if(kind==='SOP') return law('From Truth Table Where '+outputName+' = 1',()=>text(''));
    return law('From Truth Table Where '+outputName+' = 0',()=>text(''));
  }
  function groupingLaw(group, groupName){
    // Display the exact group label and cell count from the K-Map data.
    // Do not hard-code a group number or infer one from a different ordering.
    const cells=group.cells.length;
    return law('From Karnaugh Map',()=>text(`${groupName} (${cells} ${cells===1?'Cell':'Cells'})`));
  }
  function distributiveLaw(kind){
    if(kind==='SOP')return law('Distributive Law',()=>text('PQ + PR = P(Q + R)'));
    return law('Distributive Law',()=>text('(P + Q)(P + R) = P + QR'));
  }
  function complementLaw(kind,group,vars){
    const free=group.pattern.split('').flatMap((x,i)=>x==='-'?[vars[i]]:[]);
    const v=free[0]||'V';
    return kind==='SOP'
      ?law('Complement Law',()=>formula([variable(v), ' + ',variable(v,true),' = 1']))
      :law('Complement Law',()=>formula([variable(v),' · ',variable(v,true),' = 0']));
  }
  function identityLaw(kind){
    return kind==='SOP'
      ? law('Identity Law',()=>text('P · 1 = P'))
      : law('Identity Law',()=>text('P + 0 = P'));
  }
  function coverageLaw(kind, groups){
    return law('Final Simplified Equation',()=>text(''));
  }
  function buildProof(tbody, outputName, indices, groups, vars, kind){
    const type=kind==='SOP'?'Minterms':'Maxterms';
    tableRow(tbody,`Canonical ${kind}`,()=>canonical(indices,vars,kind),canonicalLaw(kind,indices,outputName),outputName);
    if(!indices.length || indices.length===2**vars.length){
      tableRow(tbody,'Constant function',()=>minimized(groups,vars,kind),law('Constant Function',()=>text(kind==='SOP'?'F = 0 or F = 1':'F = 1 or F = 0')),outputName);
      return;
    }
    groups.forEach((group,i)=>{
      // Each equality below is a correct local identity for this full Boolean cube.
      // The final cover row combines these identities with the exact Karnaugh cover.
      if(group.cells.length===1)return;
      const groupName=(kind==='SOP'?'Group ':'Zero Group ')+(i+1);
      tableRow(tbody,`${groupName}: grouped ${type.toLowerCase()}`,()=>groupInput(group,vars,kind),groupingLaw(group,groupName),groupName);
      tableRow(tbody,`${groupName}: factor variables`,()=>groupFactored(group,vars,kind,'factored'),distributiveLaw(kind),groupName);
      tableRow(tbody,`${groupName}: apply complement`,()=>groupFactored(group,vars,kind,'complement'),complementLaw(kind,group,vars),groupName);
      tableRow(tbody,`${groupName}: remove identities`,()=>groupNode(group,vars,kind),identityLaw(kind),groupName);
    });
    tableRow(tbody,`Minimal ${kind} from exact cover`,()=>minimized(groups,vars,kind),coverageLaw(kind,groups),outputName);
  }
  function clear(message){results.hidden=true;msg.hidden=false;msg.textContent=message;}
  function update(){
    if(!runStarted){clear('Connect a circuit output and press Run to analyze it.');return;}
    if(!truth||!truth.outputs?.length){clear('Connect an output and press Run.');return;}
    const index=Math.max(0,Math.min(truth.outputs.length-1,Number(dropdown.value)||0));
    const vars=truth.inputs||[];
    if(vars.length>4){clear('Boolean simplification currently supports up to 4 connected inputs.');return;}
    const values=truth.rows.map(r=>r.outputs[index]);
    if(values.some(x=>x!==0&&x!==1)){clear('Connect all inputs and remove feedback loops before simplifying.');return;}
    const original=outputFormula(index);
    if(!original){clear('A valid, fully connected combinational circuit is required.');return;}
    const ones=[],zeros=[];
    values.forEach((v,i)=>(v===1?ones:zeros).push(i));
    // Reuse the exact K-Map grouping (including its ORDER) so Group 1's
    // green cells and Group 2's pink cells always match the SOP proof.
    // Recompute only for cases that the K-Map does not support (<2 inputs).
    const kmapGroups = typeof window.__logicKMapGetGroups === 'function'
      ? window.__logicKMapGetGroups(index) : null;
    const sop = kmapGroups !== null ? kmapGroups : coverFor(ones,vars.length);
    const posFromMap = typeof window.__logicKMapGetGroups === 'function'
      ? window.__logicKMapGetGroups(index, 'POS') : null;
    const pos = posFromMap !== null ? posFromMap : coverFor(zeros,vars.length);
    const out=truth.outputs[index];
    // Canonical index lists are taken directly from the selected output's truth-table rows.
    // The notation is a compact supplement to the fully expanded SOP/POS tables below.
    mintermsLabel.textContent=`Minterms (${out} = 1)`;
    maxtermsLabel.textContent=`Maxterms (${out} = 0)`;
    mintermsSummaryNode.textContent=`Cases: ${ones.join(', ')}`;
    maxtermsSummaryNode.textContent=`Cases: ${zeros.join(', ')}`;
    // The circuit expression and the truth-table results are computed by separate existing modules.
    // SOP/POS expressions below come exclusively from the published truth-table rows.
    put(originalNode,out,original);
    showDeMorgan(index);
    showAdditionalLaws(index,truth);
    put(sopNode,out,minimized(sop,vars,'SOP'));
    put(posNode,out,minimized(pos,vars,'POS'));
    sopStepsNode.replaceChildren();posStepsNode.replaceChildren();
    buildProof(sopStepsNode,out,ones,sop,vars,'SOP');
    buildProof(posStepsNode,out,zeros,pos,vars,'POS');
    // Explicitly verify the SOP/POS covers across every truth-table row.
    function valueFor(groups,index,kind){
      const covered=groups.some(g=>g.cells.includes(index));
      return kind==='SOP'?Number(covered):Number(!covered);
    }
    const valid=values.every((v,i)=>v===valueFor(sop,i,'SOP')&&v===valueFor(pos,i,'POS'));
    verifiedNode.textContent=valid?`✓ Verified against all ${values.length} truth-table combinations.`:'⚠ Verification failed — check the circuit.';
    verifiedNode.style.color=valid?'#39ff14':'#ffb65c';
    results.hidden=false;msg.hidden=true;
  }
  function choices(){
    const prior=dropdown.value;
    dropdown.replaceChildren();
    (truth?.outputs||[]).forEach((name,i)=>{const option=el('option');option.value=String(i);option.textContent=name;dropdown.append(option);});
    dropdown.value=[...dropdown.options].some(o=>o.value===prior)?prior:'0';
    dropdown.disabled=!truth?.outputs?.length;
  }
  dropdown.addEventListener('change',update);
  document.addEventListener('logic-truth-updated',e=>{truth=e.detail;choices();update();});
  if(run)run.addEventListener('click',()=>{
    // Simulation handler is registered earlier; its click toggles the Run/Stop button.
    runStarted=run.getAttribute('aria-pressed')==='true';
    update();
  });
  choices();update();
})();
