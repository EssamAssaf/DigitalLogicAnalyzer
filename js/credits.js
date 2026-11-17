// Project credits — displayed after the Timing Diagram.
// Load this script after js/timing-diagram.js.
(() => {
  'use strict';
  if (document.getElementById('project-credits')) return;

  const style = document.createElement('style');
  style.textContent = `
    :is(#project-credits, .dla-help-credits) {
      box-sizing: border-box;
      position: relative;
      width: 100%;
      max-width: none;
      margin: 18px 0 0;
      padding: 16px 20px;
      color: #ffffff;
      background: #07152e;
      border: 1px solid #00bfff;
      border-radius: 10px;
      text-align: center;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.2;
      overflow-wrap: anywhere;
      box-shadow: 0 0 12px rgba(0,191,255,.3);
    }
    :is(#project-credits, .dla-help-credits) .credits-university-logo {
      display: block;
      width: 78px;
      max-width: 45%;
      height: auto;
      margin: 0 auto 7px;
      object-fit: contain;
    }
    :is(#project-credits, .dla-help-credits) .credits-heading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      margin: 9px auto 5px;
      font-size: 15px;
      font-weight: 700;
    }
    :is(#project-credits, .dla-help-credits) .credits-heading::before,
    :is(#project-credits, .dla-help-credits) .credits-heading::after {
      content: '';
      display: block;
      height: 1px;
      width: min(21%, 180px);
      background: #00bfff;
    }
    :is(#project-credits, .dla-help-credits) .credits-heading span {
      background: #123b65;
      color: #fff;
      border-radius: 14px;
      padding: 4px 18px;
      white-space: nowrap;
    }
    :is(#project-credits, .dla-help-credits) .credits-name {
      font-size: clamp(17px, 2vw, 21px);
      font-weight: 700;
      margin: 3px 0;
    }
    :is(#project-credits, .dla-help-credits) .credits-line { font-size: 14px; margin: 4px 0; }
    :is(#project-credits, .dla-help-credits) .credits-degree {
      display: inline-block;
      max-width: 100%;
      padding: 5px 12px;
      border-radius: 19px;
      background: #101b3a;
      border: 1px solid #8a2be2;
      font-size: 13px;
      font-weight: 700;
    }
    :is(#project-credits, .dla-help-credits) .credits-university,
    :is(#project-credits, .dla-help-credits) .credits-supervisor {
      font-size: 15px;
      font-weight: 700;
      margin: 5px 0 3px;
    }
    :is(#project-credits, .dla-help-credits) .credits-supervisor {
      display: inline-block;
      border-radius: 15px;
      padding: 5px 15px;
      color: #fff;
      background: #65126f;
    }
    :is(#project-credits, .dla-help-credits) .credits-copyright {
      position: absolute;
      right: 16px;
      bottom: 9px;
      margin: 0;
      font-size: 12px;
      color: #afc4d8;
      text-align: right;
      line-height: 1.2;
    }
    :is(#project-credits, .dla-help-credits) a { color: #58c7ff; text-decoration: underline; }
    :is(#project-credits, .dla-help-credits) a:focus-visible { outline: 3px solid #00bfff; outline-offset: 3px; }
    @media (max-width: 600px) {
      :is(#project-credits, .dla-help-credits) { padding: 12px 10px; }
      :is(#project-credits, .dla-help-credits) .credits-copyright { right: 10px; bottom: 5px; font-size: 10px; }
      :is(#project-credits, .dla-help-credits) .credits-line, :is(#project-credits, .dla-help-credits) .credits-degree { font-size: 12px; }
      :is(#project-credits, .dla-help-credits) .credits-heading { font-size: 13px; gap: 6px; }
      :is(#project-credits, .dla-help-credits) .credits-heading span { padding: 4px 10px; }
    }
    @media print {
      :is(#project-credits, .dla-help-credits) { box-shadow: none; break-inside: avoid; page-break-inside: avoid; }
      :is(#project-credits, .dla-help-credits) .credits-heading span,
      :is(#project-credits, .dla-help-credits) .credits-supervisor { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
  document.head.appendChild(style);

  const credits = document.createElement('footer');
  credits.id = 'project-credits';
  credits.setAttribute('aria-label', 'Project preparation and supervision credits');
  credits.innerHTML = `
    <img class="credits-university-logo"
         src="assets/caluni-logo.png"
         alt="CalUni — California University of Science and Technology">
    <div class="credits-heading"><span>Prepared By</span></div>
    <p class="credits-name">Essam Mohamed Al-Assaf</p>
    <p class="credits-line"><a href="mailto:eax78x@gmail.com">eax78x@gmail.com</a></p>
    <p class="credits-line"><span class="credits-degree">Bachelor of Engineering in Information Technology and Artificial Intelligence</span></p>
    <p class="credits-university">California University of Science and Technology</p>
    <p class="credits-line"><a href="https://caluni.edu.eu" target="_blank" rel="noopener noreferrer">https://caluni.edu.eu</a></p>
    <div class="credits-heading"><span>Supervised By</span></div>
    <p class="credits-line">Dean of the College</p>
    <p class="credits-supervisor">Dr. Ali Karabash</p>
    <p class="credits-copyright">© All Rights Reserved</p>
  `;
  // Keep the credits INSIDE the same main cyan frame as the circuit and results.
  const section = document.querySelector('.circuit-section');
  const timing = section?.querySelector('.timing-diagram-panel');
  if (timing) timing.insertAdjacentElement('afterend', credits);
  else if (section) section.appendChild(credits);
  else document.body.appendChild(credits);
})();
