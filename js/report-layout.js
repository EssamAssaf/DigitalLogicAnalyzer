// v45 — click-to-select printable frames; monochrome print and PDF report.
// This module does not change circuit state, wires, analyzer data or screen layout.
(() => {
  'use strict';
  const FRAME_DEFS = [
    {id:'circuit', title:'Circuit Design Area', selector:'.circuit-canvas-column > .drawing-area', landscape:true},
    {id:'equations', title:'Boolean Equations', selector:'.boolean-equation-panel', landscape:true},
    {id:'truth', title:'Truth Table', selector:'.truth-table-panel', landscape:true},
    {id:'kmap', title:'Karnaugh Map (K-Map)', selector:'.kmap-panel', landscape:true},
    {id:'laws', title:'Boolean Algebra & Simplification', selector:'.algebra-overview-frame', landscape:true},
    {id:'sop', title:'SOP Simplification (Sum of Products)', selector:'.algebra-sop-method', landscape:false},
    {id:'pos', title:'POS Simplification (Product of Sums)', selector:'.algebra-pos-method', landscape:false},
    {id:'timing', title:'Timing Diagram', selector:'.timing-diagram-panel', landscape:true}
  ];
  let selecting=false, hovered=null, preview=null, currentPrint=null;
  const $=(sel,where=document)=>where.querySelector(sel);

  // Give the Boolean-law cards their own selectable outline without restructuring
  // the rest of the analysis pipeline or breaking any existing selectors.
  function makeAlgebraFrame() {
    const results=$('.algebra-results');
    if (!results || results.querySelector('.algebra-overview-frame')) return;
    const top=$('.algebra-top-columns',results);
    const laws=$('.algebra-laws-from-circuit',results);
    if (!top || !laws) return;
    const frame=document.createElement('section');
    frame.className='algebra-overview-frame';
    frame.setAttribute('aria-label','Boolean algebra laws and original expression');
    frame.append(top,laws);
    results.insertBefore(frame, results.firstChild);
  }
  makeAlgebraFrame();

  const styles=document.createElement('style');
  styles.textContent=`
    .algebra-overview-frame{border:1px solid #00bfff;border-radius:10px;
      padding:15px;background:#08152b;margin-top:10px;min-width:0}
    .dla-frame-selecting,.dla-frame-selecting *{cursor:crosshair!important}
    .dla-frame-selecting .dla-print-hover{outline:4px solid #5bfb4a!important;
      outline-offset:3px!important;border-radius:12px!important;box-shadow:0 0 20px #5bfb4a99!important}
    .dla-select-banner{position:fixed;top:10px;left:50%;transform:translateX(-50%);
      background:#082746;border:1px solid #5bfb4a;border-radius:9px;
      color:#fff;padding:12px 20px;z-index:2147483640;font:600 15px Arial;
      box-shadow:0 6px 22px #0008;pointer-events:none;text-align:center}
    .dla-report-modal{position:fixed;inset:0;z-index:2147483641;background:#000b;
      display:flex;justify-content:center;align-items:center;padding:16px}
    .dla-modal-content{background:#07152e;color:white;border:1px solid #00bfff;
      border-radius:12px;width:min(96vw,1150px);max-height:95vh;overflow:auto;
      box-shadow:0 12px 35px #000b;padding:16px;font:15px Arial}
    .dla-modal-controls{display:flex;align-items:center;justify-content:space-between;
      gap:12px;flex-wrap:wrap;margin-bottom:12px}
    .dla-modal-controls button{background:#10345a;color:#fff;border:1px solid #00bfff;
      padding:10px 18px;border-radius:7px;cursor:pointer}
    .dla-modal-controls button:focus-visible{outline:3px solid #5bfb4a}
    .dla-preview-surface{overflow:auto;max-height:72vh;background:#bbb;padding:14px;}
    .dla-preview-page{margin:auto;background:white;position:relative;overflow:hidden;
      box-shadow:0 2px 12px #0007;max-width:none!important;}
    .dla-report-page{box-sizing:border-box;background:white;color:#000;position:relative;overflow:hidden}
    .dla-report-page *{box-sizing:border-box}
    .dla-report-content{position:absolute;transform-origin:top left;margin:0!important;
      max-width:none!important;min-width:0;}
    .dla-report-page .advanced-ribbon,.dla-report-page .kmap-controls,
    .dla-report-page .algebra-controls{display:none!important}
    .dla-report-page .algebra-overview-frame{margin:0!important}
    /* Screenshots are no longer rasterized as dark UI: all paper output is ink-saving. */
    .dla-report-page,.dla-report-page *{color:#000!important;
      background-color:transparent!important;background-image:none!important;
      text-shadow:none!important;box-shadow:none!important;filter:none!important}
    .dla-report-page{background:white!important}
    .dla-report-page .drawing-area{background:white!important;background-image:none!important;
      border:1px solid #444!important}
    /* v46: keep all drawing symbols readable on white paper. */
    .dla-report-page .drawing-area > .logic-gate svg{filter:none!important}
    .dla-report-page .drawing-area .logic-gate svg g{fill:#fff!important;stroke:#000!important}
    .dla-report-page .drawing-area .logic-gate svg :is(path,circle,rect,polygon,ellipse){stroke:#000!important}
    .dla-report-page .drawing-area .logic-gate svg :is(text,tspan){fill:#000!important;stroke:none!important}
    .dla-report-page .drawing-area .logic-gate svg :is(.input-pin,.output-pin){fill:#fff!important;stroke:#000!important}
    .dla-report-page .drawing-area .logic-gate svg :is(.source-label,.output-label){fill:#000!important;stroke:none!important}
    .dla-report-page .drawing-area .logic-gate{filter:none!important}
    .dla-report-page .algebra-final,.dla-report-page .algebra-final *{border-color:#222!important}
    .dla-report-page .algebra-method .algebra-final{outline:none!important}
    /* The timing printout has ONE rounded outline, around its waveform chart. */
    .dla-report-page .timing-diagram-panel{border:none!important;padding:0!important;
      margin:0!important;display:flex!important;flex-direction:column!important;
      align-items:center!important;justify-content:center!important;gap:16px!important}
    .dla-report-page .timing-diagram-body{width:100%!important;display:flex!important;
      justify-content:center!important;align-items:center!important}
    .dla-report-page .timing-diagram-scroll{background:#fff!important;display:flex!important;
      justify-content:center!important;align-items:center!important;
      border:1px solid #555!important;border-radius:10px!important;
      width:100%!important;padding:12px!important;overflow:visible!important}
    .dla-report-page .timing-diagram-panel h3{margin:0!important}
    .dla-report-page .timing-diagram-note{text-align:center!important;margin:0!important}
    .dla-report-page .timing-diagram-svg{display:block!important;max-width:100%!important;height:auto!important;
      background:#fff!important;filter:none!important}
    .dla-report-page .timing-diagram-svg rect{fill:#fff!important;stroke:none!important}
    .dla-report-page .timing-diagram-svg line{stroke:#d4d4d4!important}
    .dla-report-page .timing-diagram-svg path{stroke:#000!important;fill:none!important;stroke-width:3.2!important}
    .dla-report-page .timing-diagram-svg text{fill:#000!important;stroke:none!important}
    .dla-report-page .drawing-area > p{color:#777!important}
    .dla-report-page :is(input,select,button){border-color:#555!important}
    .dla-report-page :is(table,td,th,section,article,.algebra-overview-frame){border-color:#555!important}
    .dla-report-page svg path,.dla-report-page svg line,
    .dla-report-page svg polyline,.dla-report-page svg polygon,
    .dla-report-page svg circle,.dla-report-page svg rect,
    .dla-report-page svg ellipse{stroke:#000!important;filter:none!important}
    .dla-report-page svg text,.dla-report-page svg tspan{fill:#000!important}
    .dla-report-page .wire-layer path,.dla-report-page .wire-layer line{stroke:#000!important}
    .dla-report-page .logic-gate{background:transparent!important;border-color:#000!important}
    .dla-report-page .algebra-overbar{border-color:#000!important}
    .dla-report-page .kmap-group-outline{stroke:#000!important;fill:none!important}
    .dla-report-page .algebra-law-table tr.algebra-group-row td:first-child{box-shadow:none!important}
    .dla-report-page .algebra-table-scroll{overflow:visible!important}
    .dla-report-page .algebra-two-columns{display:block!important}
    .dla-report-page .algebra-method{width:100%!important;max-width:none!important}
    .dla-report-page .algebra-law-cards{grid-template-columns:repeat(3,minmax(0,1fr))!important}
    .dla-report-page .algebra-top-columns{grid-template-columns:repeat(3,minmax(0,1fr))!important}
    .dla-report-page .kmap-content{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    .dla-print-root{display:none}
    @media print {
      @page{size:A4 landscape;margin:0}
      body.dla-printing > *:not(.dla-print-root){display:none!important}
      html,body,body.dla-printing{margin:0!important;padding:0!important;background:#fff!important}
      body.dla-printing > .dla-print-root{display:block!important;position:static!important}
      .dla-print-root .dla-report-page{display:block!important;margin:0!important;
        padding:0!important;box-shadow:none!important;break-after:auto!important}
    }
  `;
  document.head.append(styles);

  function copySvgSizes(from,to) {
    const a=[from,...from.querySelectorAll('svg')];
    const b=[to,...to.querySelectorAll('svg')];
    for(let i=0;i<Math.min(a.length,b.length);i++) {
      if(!(a[i] instanceof SVGSVGElement)|| !(b[i] instanceof SVGSVGElement))continue;
      const r=a[i].getBoundingClientRect();
      if(r.width>0&&r.height>0){b[i].setAttribute('width',String(r.width));b[i].setAttribute('height',String(r.height));
        b[i].style.width=r.width+'px';b[i].style.height=r.height+'px';}
    }
  }
  // Print-only repairs for shapes that use hard-coded dark SVG fills.
  // These styles and attributes touch CLONES, never the user's live circuit.
  function prepareMonochromeCopy(copy,def,sourceW) {
    copy.querySelectorAll('.algebra-final').forEach(el=>{
      el.style.borderColor='#222';
      el.style.boxShadow='none';
    });
    if(def.id==='circuit') {
      copy.querySelectorAll('.logic-gate svg').forEach(svg=>{
        svg.style.filter='none';
        svg.querySelectorAll('g').forEach(g=>{
          g.style.fill='#fff';g.style.stroke='#000';
        });
        svg.querySelectorAll('text,tspan').forEach(t=>{
          t.style.fill='#000';t.style.stroke='none';
        });
      });
      copy.querySelectorAll('.logic-gate svg rect').forEach(r=>{
        // Input / output badges are outlines, not black solid boxes.
        r.style.fill='#fff';r.style.stroke='#000';
      });
    }
    if(def.id==='timing') {
      // Use print-specific dimensions instead of scaling the entire 1800px screen section.
      // No changes to the live timing diagram in the editor.
      copy.style.width='960px';copy.style.height='560px';
      const svg=copy.querySelector('.timing-diagram-svg');
      if(svg){
        const view=svg.viewBox.baseVal;
        const newWidth=800;
        const ratio=view.width>0?view.height/view.width:0.55;
        svg.setAttribute('width',String(newWidth));
        svg.setAttribute('height',String(newWidth*ratio));
        svg.style.width=newWidth+'px';
        svg.style.height=(newWidth*ratio)+'px';
        svg.style.margin='0 auto';
        svg.querySelectorAll('rect').forEach(r=>{r.setAttribute('fill','#ffffff');r.style.fill='#fff'});
        svg.querySelectorAll('line').forEach(l=>{l.setAttribute('stroke','#d1d5db');l.style.stroke='#d1d5db'});
        svg.querySelectorAll('path').forEach(path=>{
          path.setAttribute('stroke','#000');path.setAttribute('stroke-width','3.2');
          path.style.stroke='#000';path.style.fill='none';
        });
        svg.querySelectorAll('text').forEach(t=>{t.setAttribute('fill','#000');t.style.fill='#000'});
      }
      const scroll=copy.querySelector('.timing-diagram-scroll');
      if(scroll){scroll.style.background='#fff';scroll.style.display='flex';scroll.style.justifyContent='center';scroll.style.alignItems='center';scroll.style.overflow='visible';}
      copy.style.border='none';copy.style.padding='0';
    }
  }
  function frameSource(def){return $(def.selector,$('.circuit-section')||document);}
  function sourceSize(src) {
    const rect=src.getBoundingClientRect();
    return {width:Math.max(250,Math.ceil(rect.width),src.scrollWidth),
      height:Math.max(120,Math.ceil(rect.height),src.scrollHeight)};
  }
  // A report page contains only ONE selected, full frame — never a chopped viewport.
  // Long SOP/POS tables use portrait A4 automatically for much better readability.
  function buildPage(def, scaleForPreview=false) {
    const src=frameSource(def);
    if(!src || !src.getClientRects().length || src.closest('[hidden]'))return null;
    let {width:sourceW,height:sourceH}=sourceSize(src);
    if(def.id==='timing'){sourceW=960;sourceH=560;}
    const pageW=def.landscape?1123:794;
    const pageH=def.landscape?794:1123;
    const margin=32;
    const page=document.createElement('div');
    page.className='dla-report-page';
    page.style.width=pageW+'px';page.style.height=pageH+'px';
    page.dataset.pageW=pageW;page.dataset.pageH=pageH;
    page.dataset.title=def.title;
    const copy=src.cloneNode(true);
    copy.id='';copy.classList.add('dla-report-content');
    copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
    copySvgSizes(src,copy);
    prepareMonochromeCopy(copy,def,sourceW);
    // Keep SVG wires and absolutely placed gates in the SAME coordinates.
    copy.style.width=sourceW+'px';copy.style.height=sourceH+'px';
    copy.style.maxWidth='none';copy.style.overflow='visible';
    if(def.id==='circuit'){
      const srcDrawing=src.matches('.drawing-area')?src:$('.drawing-area',src);
      const clonedDrawing=copy.matches('.drawing-area')?copy:$('.drawing-area',copy);
      if(srcDrawing&&clonedDrawing){clonedDrawing.style.width=srcDrawing.offsetWidth+'px';
        clonedDrawing.style.height=srcDrawing.offsetHeight+'px';}
      copy.querySelector('.advanced-ribbon')?.remove();
    }
    page.append(copy);
    const factor=Math.min((pageW-margin*2)/sourceW,(pageH-margin*2)/sourceH);
    copy.style.transform=`scale(${factor})`;
    copy.style.left=((pageW-sourceW*factor)/2)+'px';
    copy.style.top=((pageH-sourceH*factor)/2)+'px';
    return page;
  }
  function startSelection(){
    if(selecting)return;
    selecting=true;
    document.body.classList.add('dla-frame-selecting');
    const banner=document.createElement('div');banner.className='dla-select-banner';
    banner.id='dlaSelectBanner';banner.textContent='PRINT — Click inside a highlighted frame to preview it. Press Esc to cancel.';
    document.body.append(banner);
  }
  function stopSelection(){
    selecting=false;document.body.classList.remove('dla-frame-selecting');
    document.getElementById('dlaSelectBanner')?.remove();
    hovered?.classList.remove('dla-print-hover');hovered=null;
  }
  function getSelectable(target){
    if(!(target instanceof Element))return null;
    for(const def of FRAME_DEFS){const el=target.closest(def.selector);
      if(el&&el.getClientRects().length&&!el.closest('[hidden]'))return {def,el};}
    return null;
  }
  document.addEventListener('pointermove',e=>{
    if(!selecting)return;
    const item=getSelectable(e.target);if(hovered===item?.el)return;
    hovered?.classList.remove('dla-print-hover');hovered=item?.el||null;
    hovered?.classList.add('dla-print-hover');
  },true);
  for(const eventType of ['pointerdown','pointerup','click','dblclick','contextmenu']) {
    document.addEventListener(eventType,e=>{
      if(!selecting)return;
      if(eventType==='click') {
        const item=getSelectable(e.target);
        if(item){stopSelection();showPreview(item.def);}
      }
      e.preventDefault();e.stopImmediatePropagation();
    },true);
  }
  document.addEventListener('keydown',e=>{if(selecting&&e.key==='Escape'){stopSelection();e.preventDefault();}},true);

  function showPreview(def){
    const page=buildPage(def);if(!page){alert('This frame is empty or not visible.');return;}
    const overlay=document.createElement('div');overlay.className='dla-report-modal';
    const inner=document.createElement('div');inner.className='dla-modal-content';
    const controls=document.createElement('div');controls.className='dla-modal-controls';
    const title=document.createElement('strong');title.textContent='Print Preview — '+def.title;
    const actions=document.createElement('div');
    const close=document.createElement('button');close.type='button';close.textContent='Cancel';
    const print=document.createElement('button');print.type='button';print.textContent='Print';
    actions.append(close,print);controls.append(title,actions);
    const display=document.createElement('div');display.className='dla-preview-surface';
    const fit=document.createElement('div');fit.className='dla-preview-page';
    const ratio=Math.min(1,(Math.min(window.innerWidth-110,1040))/Number(page.dataset.pageW));
    fit.style.width=Number(page.dataset.pageW)*ratio+'px';fit.style.height=Number(page.dataset.pageH)*ratio+'px';
    page.style.transform=`scale(${ratio})`;page.style.transformOrigin='top left';fit.append(page);
    display.append(fit);inner.append(controls,display);overlay.append(inner);document.body.append(overlay);preview=overlay;
    function exit(){overlay.remove();preview=null;}
    close.addEventListener('click',exit);
    overlay.addEventListener('click',e=>{if(e.target===overlay)exit();});
    print.addEventListener('click',()=>{
      const sheet=buildPage(def);
      if(!sheet){alert('The selected frame is no longer available.');return;}
      exit();currentPrint?.remove();currentPrint=document.createElement('div');
      currentPrint.className='dla-print-root';currentPrint.append(sheet);
      document.body.append(currentPrint);document.body.classList.add('dla-printing');
      // Actual dimensions (A4 fit) follow one printed page, not scroll fragments.
      const printCss=document.createElement('style');printCss.id='dla-print-dimensions';
      const landscape=def.landscape;
      printCss.textContent=`@media print{@page{size:A4 ${landscape?'landscape':'portrait'};margin:0}
        .dla-print-root .dla-report-page{width:${landscape?'297mm':'210mm'}!important;
        height:${landscape?'210mm':'297mm'}!important;}
        .dla-print-root .dla-report-content{transform:${sheet.firstElementChild.style.transform}!important;}}`;
      document.head.append(printCss);
      setTimeout(()=>window.print(),150);
    });
  }
  window.addEventListener('afterprint',()=>{
    currentPrint?.remove();currentPrint=null;document.body.classList.remove('dla-printing');
    document.getElementById('dla-print-dimensions')?.remove();
  });
  window.dlaPrintReport=startSelection;
  window.dlaReportFrames=FRAME_DEFS;
  window.dlaBuildReportPage=buildPage;
})();
