/** Lightweight overhead low-poly shoreline, visible before WebGL finishes loading. */
export function SplashBeach(){
 return <svg className="splash-beach" viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
   <linearGradient id="mini-ocean" x2="1" y2="1"><stop stopColor="#103747"/><stop offset="1" stopColor="#26798b"/></linearGradient>
   <g id="mini-palm"><path d="M0 4L10 70L19 73L10 2Z" fill="#876f42"/><path d="M5 0L-72 -33L-38 -37Z" fill="#729b41"/><path d="M5 0L-48 -72L-12 -45Z" fill="#92b64e"/><path d="M5 0L32 -75L33 -35Z" fill="#779c3c"/><path d="M5 0L78 -30L43 -5Z" fill="#a1b951"/><path d="M5 0L66 35L28 31Z" fill="#60853b"/><path d="M5 0L-43 49L-29 13Z" fill="#90a646"/></g>
  </defs>
  <path fill="url(#mini-ocean)" d="M0 0H1440V1000H0Z"/>
  <g opacity=".22" fill="#479caf"><path d="M0 0L490 0L235 260Z"/><path d="M1440 0L1190 270L1010 0Z"/><path d="M870 1000L1140 650L1440 1000Z"/><path d="M0 500L170 780L0 1000Z"/></g>
  <path fill="#348f9d" d="M-70 250L170 148L329 171L455 302L510 479L712 593L908 667L1056 772L1510 805V1060H-70Z"/>
  <path fill="#5bc2bc" d="M-60 307L150 212L304 222L404 342L465 510L683 649L899 722L1040 827L1500 863V1050H-60Z"/>
  <path fill="#a2ded0" d="M-50 341L161 251L277 259L364 370L421 540L658 687L879 751L1008 859L1490 906V1040H-50Z"/>
  <path fill="#edf2cf" d="M-40 368L157 276L260 290L336 396L399 565L636 711L864 781L999 884L1480 925V1040H-40Z"/>
  <path fill="#ecd9a7" d="M-20 391L156 300L242 310L319 413L381 583L620 731L851 805L987 908L1460 950V1040H-20Z"/>
  <g fill="#f4e5bf"><path d="M0 400L240 313L185 610Z"/><path d="M185 610L382 585L620 735L433 950Z"/><path d="M620 735L850 805L987 910L720 1000Z"/><path d="M0 740L185 610L433 950L0 1000Z"/></g>
  <path fill="#a5b967" d="M0 616L121 488L243 549L286 715L474 865L731 1000H0Z"/>
  <g fill="#bbca7b"><path d="M0 618L120 490L70 808Z"/><path d="M70 808L244 550L286 716Z"/><path d="M70 808L476 867L731 1000H0Z"/></g>
  <g opacity=".16" fill="#284837"><ellipse cx="179" cy="501" rx="84" ry="30"/><ellipse cx="322" cy="777" rx="85" ry="34"/><ellipse cx="623" cy="919" rx="85" ry="30"/></g>
  <use href="#mini-palm" transform="translate(158 425) rotate(-18)"/><use href="#mini-palm" transform="translate(270 672) rotate(25) scale(1.2)"/><use href="#mini-palm" transform="translate(579 836) rotate(-30)"/>
  <g fill="#899b94"><path d="M1090 779L1110 753L1143 764L1151 790L1119 806Z"/><path d="M1139 814L1153 795L1175 810L1166 834Z"/><path d="M341 213L357 194L382 207L372 232Z"/></g>
  <g fill="#c1d1bb"><path d="M1110 753L1143 764L1118 779L1090 779Z"/><path d="M357 194L382 207L356 216Z"/></g>
  <g fill="none" stroke="#d7f3e4" strokeWidth="3" opacity=".44"><path d="M78 232L153 198L230 203"/><path d="M500 575L550 610L605 635"/><path d="M867 691L929 717L978 755"/><path d="M1100 745L1074 770L1086 805"/></g>
 </svg>;
}
