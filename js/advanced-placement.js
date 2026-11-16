// Shared collision-free positioning for advanced components.
// Keeps the current canvas/sidebar design unchanged.
(() => {
  "use strict";
  const area = document.getElementById("drawingArea");
  const GRID = 20;
  function overlaps(a,b,margin=0) {
    return a.x < b.x+b.width+margin && a.x+a.width+margin > b.x &&
      a.y < b.y+b.height+margin && a.y+a.height+margin > b.y;
  }
  function bounds(gate) {
    return {x:parseFloat(gate.style.left)||0,y:parseFloat(gate.style.top)||0,
      width:gate.offsetWidth,height:gate.offsetHeight};
  }
  function isFree(candidate, excluded=new Set(), margin=0) {
    return [...area.querySelectorAll('.logic-gate')].every(g =>
      excluded.has(g) || !overlaps(candidate,bounds(g),margin));
  }
  function findSpace(width,height) {
    if (width > area.clientWidth || height > area.clientHeight) return null;
    const centerX = Math.round((area.clientWidth-width)/2/GRID)*GRID;
    const centerY = Math.round((area.clientHeight-height)/2/GRID)*GRID;
    const options=[];
    for(let y=0;y<=area.clientHeight-height;y+=GRID) {
      for(let x=0;x<=area.clientWidth-width;x+=GRID) {
        options.push({x,y,width,height,dist:(x-centerX)**2+(y-centerY)**2});
      }
    }
    options.sort((a,b)=>a.dist-b.dist);
    return options.find(pos=>isFree(pos, new Set(), 4)) || null;
  }
  window.advancedComponentPlacement={findSpace,isFree,overlaps,bounds};
})();
