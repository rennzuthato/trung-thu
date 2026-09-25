(() => {
'use strict'

/* ───────── content: edit freely ───────── */

const PHOTOS = [
  { src: 'assets/photo-1.jpg', caption: 'silly selfie owo' },
  { src: 'assets/photo-2.jpg', caption: "it's been a while" },
  { src: 'assets/photo-3.jpg', caption: 'movie date' },
  { src: 'assets/photo-4.jpg', caption: 'Picasso painting', fit: true },
  { src: 'assets/photo-5.jpg', caption: 'yeah 12 hours was something else' },
]

const LINES = [
  { text: 'Oh! you found me.' },
  { text: 'You know what day is today right?' },
  { text: 'Trung thuuuuuu', big: true, start: lightTheTown },
  { text: "ahem, since Ren isn't available right now.", start: ahem },
  { text: 'On behalf of Ren, mình chúc cậu có một ngày Trung thu đáng nhớ.', end: finalWish },
]

/* ───────── helpers ───────── */

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const TAU = Math.PI * 2, DEG = Math.PI / 180
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const rnd = (a, b) => a + Math.random() * (b - a)
const wait = ms => new Promise(r => setTimeout(r, ms))
const Ease = {
  out: t => 1 - Math.pow(1 - t, 3),
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutQuint: t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
}
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)'
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches
const params = new URLSearchParams(location.search)

// tiny tween engine driven by the main loop
const tweens = new Set()
function tween(obj, to, dur, easing = Ease.inOut, delay = 0) {
  return new Promise(resolve => {
    const from = {}
    let t = -delay, started = false
    tweens.add({
      step(dt) {
        t += dt * 1000
        if (t < 0) return false
        if (!started) { started = true; for (const k in to) from[k] = obj[k] }
        const p = Math.min(1, t / dur), e = easing(p)
        for (const k in to) obj[k] = from[k] + (to[k] - from[k]) * e
        if (p >= 1) { resolve(); return true }
        return false
      }
    })
  })
}
function stepTweens(dt) { for (const tw of tweens) if (tw.step(dt)) tweens.delete(tw) }

/* ───────── elements & state ───────── */

const stage = $('#stage'), town = $('#town'), world = $('#world')
const darkCv = $('#dark'), dctx = darkCv.getContext('2d')
const skyEl = $('#sky'), moonEl = $('.s-moon'), cloudEls = $$('.cloud'), fogEl = $('#fog')
const rigEl = $('#rig'), emberHit = $('#ember-hit'), soundNote = $('#sound-note'), gripRing = $('#grip-ring')
const hintEl = $('#hint'), hintA = $('.hint-a'), hintB = $('.hint-b')
const trayEl = $('#tray'), slotEls = $$('.slot'), countEl = $('.count')
const viewer = $('#viewer'), card = $('.card'), cardImg = $('.card img'), cardCap = $('.card figcaption')
const dialog = $('#dialog'), bubble = $('.bubble'), dlgText = $('.dlg-text'), dlgSr = $('#dlg-sr')
const letterBtn = $('.letter-btn'), dlgCreature = $('.dlg-creature')
const peekEl = $('.peek'), letter = $('#letter'), muteBtn = $('#mute')

const STICK = 280   // lantern centre → hand, in lantern units
const DK = 0.5      // darkness canvas resolution

const S = {
  phase: 'intro', t: 0, W: 0, H: 0, m: 0, dpr: 1,
  heat: 0, kick: 0, lastTap: -9, peak: 0, taps: 0, stage: 0, coolHint: false,
  introScale: 6, dotLocal: 1, flameX: 0, flameY: 0,
  ambient: 1, viewing: false, closing: false, found: 0, dragged: false, lastFind: 0, glintT: 2,
  townLit: false, lanternLv: 0, huntReady: false, dlgReady: false, peekC: { x: 0, y: 0 },
}
const rig = { x: 0, y: 0, ls: 0, rot: 0, frame: 0, paper: 0, stick: 0, flare: 0, glowR: 40, flame: 0 }
const light = { r: 0, a: 1 }
const P = { gx: 0, gy: 0, tx: 0, ty: 0, vx: 0, vy: 0, th: 0, om: 0, tas: 0, tasV: 0, drag: false, offX: 0, offY: 0, soft: false, bias: 0 }
const PH = PHOTOS.map((p, i) => ({ ...p, i, found: false, el: null, cx: 0, cy: 0, w: 60, r: 0, charge: 0 }))
const river = []
let L = null
let LN = {}

const gloryScale = () => clamp(S.m * 0.19 / 100, 0.7, 1.9)
const searchScale = () => clamp(S.m * 0.085 / 100, 0.3, 0.8)
const searchLight = () => Math.max(100, S.m * 0.19)

/* ───────── the star lantern (đèn ông sao) ───────── */

// shared star geometry: the paper, facets, frame, glitter, tassels and stick nodes
function starParts() {
  const R = 100, r = 44, P5 = [], I5 = []
  for (let k = 0; k < 5; k++) {
    const a = (-90 + 72 * k) * DEG, b = a + 36 * DEG
    P5.push([R * Math.cos(a), R * Math.sin(a)])
    I5.push([r * Math.cos(b), r * Math.sin(b)])
  }
  const f = p => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`
  let star = `M${f(P5[0])}`
  for (let k = 0; k < 5; k++) star += `L${f(I5[k])}L${f(P5[(k + 1) % 5])}`
  star += 'Z'
  let lit = '', shade = '', ridges = '', glit = ''
  for (let k = 0; k < 5; k++) {
    const pk = P5[k], ik = I5[k], ip = I5[(k + 4) % 5]
    shade += `M0 0L${f(pk)}L${f(ik)}Z`
    lit += `M0 0L${f(ip)}L${f(pk)}Z`
    ridges += `M0 0L${f(pk)}M0 0L${f(ik)}`
    for (const q of [ik, ip]) {
      for (let s = 0.22; s < 0.95; s += 0.24) {
        glit += `<circle class="gl" cx="${lerp(pk[0], q[0], s).toFixed(1)}" cy="${lerp(pk[1], q[1], s).toFixed(1)}" r="1.7" style="animation-delay:${(-Math.random() * 1.8).toFixed(2)}s"/>`
      }
    }
  }
  const TAS = ['#ff4f5e', '#ffd166', '#ff8fab', '#ffd166', '#ff4f5e', '#ffe29a', '#ff6b6b']
  let tas = ''
  for (const k of [1, 2, 3, 4]) {
    const x = (P5[k][0] * 0.97).toFixed(1), y = (P5[k][1] * 0.97).toFixed(1)
    let strands = ''
    for (let j = 0; j < 7; j++) {
      const x0 = (j - 3) * 0.9, len = 46 + Math.random() * 20
      strands += `<path d="M${x0} 2Q${(x0 + (j - 3) * 1.4).toFixed(1)} ${(len * 0.5).toFixed(1)} ${(x0 + (j - 3) * 2.4).toFixed(1)} ${len.toFixed(1)}" stroke="${TAS[j]}"/>`
    }
    tas += `<g class="tassel" data-x="${x}" data-y="${y}" transform="translate(${x} ${y})"><g fill="none" stroke-width="1.7" stroke-linecap="round">${strands}</g><circle r="3.6" fill="#ffcf5a"/></g>`
  }
  let nodes = ''
  for (const y of [96, 152, 208]) nodes += `<rect x="-4.3" y="${y}" width="8.6" height="2.6" rx="1.3" fill="#6b4a1e"/>`
  return { star, lit, shade, ridges, glit, tas, nodes }
}

const PAPER_STOPS = '<stop offset="0" stop-color="#fff6cf"/><stop offset=".2" stop-color="#ffd36e"/><stop offset=".48" stop-color="#ff8a3a"/><stop offset=".78" stop-color="#ee402c"/><stop offset="1" stop-color="#b3122e"/>'
const HALO_STOPS = '<stop offset="0" stop-color="#ffbe6e" stop-opacity=".55"/><stop offset=".4" stop-color="#ff8c3c" stop-opacity=".2"/><stop offset="1" stop-color="#ff6428" stop-opacity="0"/>'
const BAMBOO_STOPS = '<stop offset="0" stop-color="#7a5424"/><stop offset=".45" stop-color="#d8b26a"/><stop offset="1" stop-color="#8a6230"/>'
const stickSVG = (nodes, bamboo) => `<rect x="-3.6" y="36" width="7.2" height="270" rx="3.6" fill="url(#${bamboo})"/>${nodes}
      <rect x="-5.2" y="256" width="10.4" height="46" rx="3.5" fill="#c0283a"/>
      <path d="M-5 264l10 6M-5 274l10 6M-5 284l10 6M-5 294l10 5" stroke="#8f1526" stroke-width="1.4"/>`

// the finished, lit lantern on its stick (for the letter's last scene)
function staticStarSVG() {
  const { star, lit, shade, ridges, glit, tas, nodes } = starParts()
  return `<svg viewBox="-140 -140 280 460" aria-hidden="true">
    <defs>
      <radialGradient id="k-paper" cx="0" cy="6" r="106" gradientUnits="userSpaceOnUse">${PAPER_STOPS}</radialGradient>
      <radialGradient id="k-halo">${HALO_STOPS}</radialGradient>
      <linearGradient id="k-bamboo" x1="0" y1="0" x2="1" y2="0">${BAMBOO_STOPS}</linearGradient>
    </defs>
    <circle r="140" fill="url(#k-halo)"/>
    <g>${stickSVG(nodes, 'k-bamboo')}</g>
    <g>${tas.replace(/class="tassel"/g, 'class="k-tassel"')}</g>
    <path d="${star}" fill="url(#k-paper)"/>
    <path d="${lit}" fill="#fff" opacity=".13"/>
    <path d="${shade}" fill="#5a0010" opacity=".2"/>
    <g fill="none" stroke-linejoin="round" stroke-linecap="round">
      <path d="${ridges}" stroke="#6b3a14" stroke-opacity=".45" stroke-width="1.5"/>
      <path d="${star}" stroke="#5b3714" stroke-width="3.4"/>
    </g>
    <g fill="#fff0b8">${glit}</g>
  </svg>`
}

function buildLantern() {
  const { star, lit, shade, ridges, glit, tas, nodes } = starParts()
  rigEl.innerHTML = `
  <svg id="lantern" viewBox="-160 -160 320 640" width="320" height="640">
    <defs>
      <radialGradient id="g-paper" cx="0" cy="6" r="106" gradientUnits="userSpaceOnUse">${PAPER_STOPS}</radialGradient>
      <radialGradient id="g-halo">${HALO_STOPS}</radialGradient>
      <radialGradient id="g-fglow"><stop offset="0" stop-color="#ffd682" stop-opacity=".9"/><stop offset=".25" stop-color="#ffaa46" stop-opacity=".45"/><stop offset=".6" stop-color="#ff7828" stop-opacity=".12"/><stop offset="1" stop-color="#ff6420" stop-opacity="0"/></radialGradient>
      <radialGradient id="g-dot"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#ffe1a0"/><stop offset="1" stop-color="#ff9a3c" stop-opacity=".6"/></radialGradient>
      <linearGradient id="g-fo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a1f" stop-opacity="0"/><stop offset=".3" stop-color="#ff6a22" stop-opacity=".85"/><stop offset="1" stop-color="#ffb040" stop-opacity=".95"/></linearGradient>
      <linearGradient id="g-fm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc23a" stop-opacity="0"/><stop offset=".32" stop-color="#ffd24d" stop-opacity=".92"/><stop offset="1" stop-color="#ffe89a"/></linearGradient>
      <linearGradient id="g-fc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d8" stop-opacity=".2"/><stop offset=".35" stop-color="#fffbe9"/><stop offset="1" stop-color="#fff3c2"/></linearGradient>
      <filter id="f-soft" x="-60%" y="-40%" width="220%" height="180%"><feGaussianBlur stdDeviation="0.7"/></filter>
      <linearGradient id="g-bamboo" x1="0" y1="0" x2="1" y2="0">${BAMBOO_STOPS}</linearGradient>
    </defs>
    <circle id="l-halo" r="230" fill="url(#g-halo)"/>
    <g id="l-stick">${stickSVG(nodes, 'g-bamboo')}</g>
    <g id="l-tassels">${tas}</g>
    <g id="l-body">
      <path id="l-dark" d="${star}" fill="#2a0c12"/>
      <path id="l-paper" d="${star}" fill="url(#g-paper)"/>
      <path id="l-lit" d="${lit}" fill="#fff"/>
      <path id="l-shade" d="${shade}" fill="#5a0010"/>
      <g id="l-frame" fill="none" stroke-linejoin="round" stroke-linecap="round">
        <path d="${ridges}" stroke="#6b3a14" stroke-opacity=".45" stroke-width="1.5"/>
        <path d="${star}" stroke="#5b3714" stroke-width="3.4"/>
      </g>
      <g id="l-glitter" fill="#fff0b8">${glit}</g>
    </g>
    <rect id="l-candle" x="-4.5" y="11" width="9" height="20" rx="1.5" fill="#f4e7c6"/>
    <g id="l-flame" transform="translate(0 11)">
      <circle id="f-glow" r="60" fill="url(#g-fglow)"/>
      <path id="f-outer" fill="url(#g-fo)" filter="url(#f-soft)"/>
      <path id="f-mid" fill="url(#g-fm)"/>
      <path id="f-core" fill="url(#g-fc)"/>
      <ellipse id="f-blue" cx="0" fill="#7fb0ff"/>
      <circle id="f-dot" cx="0" fill="url(#g-dot)"/>
    </g>
  </svg>`

  LN = {
    halo: $('#l-halo'), stick: $('#l-stick'), tasG: $('#l-tassels'), tassels: $$('.tassel'),
    dark: $('#l-dark'), paper: $('#l-paper'), lit: $('#l-lit'), shade: $('#l-shade'), frame: $('#l-frame'),
    glitter: $('#l-glitter'), candle: $('#l-candle'),
    glow: $('#f-glow'), outer: $('#f-outer'), mid: $('#f-mid'), core: $('#f-core'), blue: $('#f-blue'), dot: $('#f-dot'),
  }
  LN.tassels.forEach(g => { g._x = g.dataset.x; g._y = g.dataset.y })
}

// a candle-flame teardrop with its base at (0, -dy) and its tip leaning by tx
function tear(w, h, tx, dy = 0) {
  const r = w / 2, b = -dy, n = v => v.toFixed(2)
  return `M${n(tx)} ${n(b - h)}C${n(tx * 0.4 + r * 0.95)} ${n(b - h * 0.55)} ${n(r)} ${n(b - r * 1.35)} ${n(r)} ${n(b - r)}` +
    `A${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(b - r)}C${n(-r)} ${n(b - r * 1.35)} ${n(tx * 0.4 - r * 0.95)} ${n(b - h * 0.55)} ${n(tx)} ${n(b - h)}Z`
}

function renderRig() {
  const sc = Math.exp(rig.ls)
  rigEl.style.transform = `translate(${rig.x.toFixed(2)}px, ${rig.y.toFixed(2)}px) rotate(${rig.rot.toFixed(4)}rad) scale(${sc.toFixed(4)})`

  const t = S.t, h0 = S.heat, intro = S.phase === 'intro'
  const n1 = Math.sin(t * 9.7) * 0.5 + Math.sin(t * 15.3 + 1.3) * 0.3 + Math.sin(t * 3.1 + 0.7) * 0.2
  const n2 = Math.sin(t * 12.1 + 2) * 0.5 + Math.sin(t * 19.7) * 0.3 + Math.sin(t * 5.3 + 0.4) * 0.2
  const amp = intro ? 0.25 + 0.75 * h0 : 0.55
  const pulse = intro ? 1 + 0.12 * Math.sin(t * 2.4) * (1 - h0) : 1
  const dotR = S.dotLocal * (1 + 0.8 * h0) * (1 + 0.35 * S.kick) * pulse
  const w = lerp(dotR * 2, 12, smooth(0.06, 1, h0)) * (1 + 0.22 * S.kick + 0.28 * rig.flare)
  const h = w * lerp(1.15, 2.2, smooth(0.08, 0.8, h0)) * (1 + 0.09 * n2 * amp) * (1 + 0.3 * rig.flare)
  const tx = w * 0.3 * n1 * amp
  const fOp = smooth(0.04, 0.3, h0) * rig.flame

  LN.outer.setAttribute('d', tear(w, h, tx))
  LN.mid.setAttribute('d', tear(w * 0.74, h * 0.78, tx * 0.8, w * 0.04))
  LN.core.setAttribute('d', tear(w * 0.46, h * 0.52, tx * 0.55, w * 0.08))
  LN.outer.style.opacity = LN.mid.style.opacity = LN.core.style.opacity = fOp
  LN.blue.setAttribute('cy', (-w * 0.2).toFixed(2))
  LN.blue.setAttribute('rx', (w * 0.26).toFixed(2))
  LN.blue.setAttribute('ry', (w * 0.2).toFixed(2))
  LN.blue.style.opacity = 0.5 * fOp
  LN.dot.setAttribute('r', dotR.toFixed(3))
  LN.dot.setAttribute('cy', (-dotR).toFixed(3))
  LN.dot.style.opacity = (1 - smooth(0.15, 0.45, h0)) * rig.flame
  LN.glow.setAttribute('r', (rig.glowR * (1 + 0.06 * n2 * amp + 0.2 * S.kick)).toFixed(2))
  LN.glow.setAttribute('cy', (-h * 0.4).toFixed(2))
  LN.glow.style.opacity = rig.flame

  LN.halo.style.opacity = rig.paper * (0.9 + 0.1 * n2)
  LN.dark.style.opacity = rig.frame * (1 - rig.paper)
  LN.paper.style.opacity = rig.paper * (0.94 + 0.06 * n1)
  LN.lit.style.opacity = 0.13 * rig.frame
  LN.shade.style.opacity = 0.2 * rig.frame
  LN.frame.style.opacity = rig.frame
  LN.glitter.style.opacity = rig.paper
  LN.tasG.style.opacity = rig.frame
  LN.candle.style.opacity = rig.frame * 0.55
  LN.stick.style.opacity = rig.stick > 0.001 ? 1 : 0
  LN.stick.setAttribute('transform', `matrix(1 0 0 ${rig.stick.toFixed(4)} 0 ${(36 - 36 * rig.stick).toFixed(3)})`)
  const ta = P.tas / DEG
  LN.tassels.forEach((g, i) => g.setAttribute('transform', `translate(${g._x} ${g._y}) rotate(${(ta + Math.sin(t * 1.7 + i) * 2).toFixed(2)})`))

  S.flameX = rig.x
  S.flameY = rig.y + (11 - h * 0.45) * sc
}

/* ───────── scene placement ───────── */

const CLOUDS = [
  { dx: -1.1, dy: 0.35, w: 3.8, h: 1.4, dir: -1 },
  { dx: 1.0, dy: -0.25, w: 3.4, h: 1.2, dir: 1 },
  { dx: 0.15, dy: 0.1, w: 2.8, h: 1.3, dir: 1 },
  { dx: -0.5, dy: -0.55, w: 2.6, h: 1.0, dir: -1 },
]

const FLOAT_COLORS = ['#e0283c', '#f26b1d', '#f7b32b', '#e84a8a', '#d9432e', '#f26b1d']

// a round silk lantern floating on a little wooden raft
function floaterSVG(c = FLOAT_COLORS[Math.floor(Math.random() * FLOAT_COLORS.length)]) {
  return `<svg class="floater" viewBox="-40 -62 80 86" aria-hidden="true">
    <ellipse cx="0" cy="17" rx="30" ry="6" fill="url(#waterGlow)"/>
    <circle cx="0" cy="-20" r="38" fill="url(#candleGlow)" opacity=".42"/>
    <path d="M-25 5h50l-4 8h-42z" fill="#4a2e1a"/>
    <path d="M-25 5h50" stroke="#8a6038" stroke-width="2" stroke-linecap="round"/>
    <path d="M-12 6v6M0 6v6M12 6v6" stroke="#2e1c10" stroke-width="1.2"/>
    <rect x="-3" y="1" width="6" height="5" fill="#2e1c10"/>
    <ellipse cx="0" cy="-19" rx="17" ry="20" fill="${c}"/>
    <ellipse cx="0" cy="-19" rx="17" ry="20" fill="url(#lanternLight)"/>
    <path d="M-8-38.5Q-15-19-8 .5M8-38.5Q15-19 8 .5M0-39V1" stroke="rgba(90,20,10,.3)" stroke-width="1.1" fill="none"/>
    <rect x="-8" y="-43" width="16" height="5" rx="1.5" fill="#b8862d"/>
    <rect x="-8" y="-.5" width="16" height="4.5" rx="1.5" fill="#b8862d"/>
    <path d="M-5-43Q0-50 5-43" stroke="#b8862d" stroke-width="1.6" fill="none"/>
  </svg>`
}

function raftSVG() {
  return `<svg class="raft-svg" viewBox="-40 -8 80 26" aria-hidden="true">
    <ellipse cx="0" cy="12" rx="36" ry="5" fill="url(#waterGlow)"/>
    <path d="M-34 0h68l-5 9h-58z" fill="#4a2e1a"/>
    <path d="M-34 0h68" stroke="#8a6038" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M-20 1v7M-6 1v7M8 1v7M22 1v7" stroke="#2e1c10" stroke-width="1.2"/>
  </svg>`
}

// big out-of-focus lanterns hanging in the foreground corners
const BOKEH = [
  { fx: 1, dx: -0.05, top: -0.03, s: 0.17, b: 5, c: '#e0283c' },
  { fx: 1, dx: -0.2, top: -0.1, s: 0.1, b: 3, c: '#f26b1d' },
  { fx: 0, dx: 0.03, top: -0.07, s: 0.13, b: 5, c: '#f7b32b' },
]

const lanternClass = () => (S.lanternLv >= 1 ? ' glow on' : S.lanternLv > 0 ? ' glow' : '')

function placeWorld() {
  $$('.silk', world).forEach(n => n.remove())
  const frag = document.createDocumentFragment()
  for (const ln of L.lanterns) {
    const el = document.createElement('div')
    el.className = 'silk' + lanternClass()
    el.style.cssText = `left:${ln.x.toFixed(1)}px;top:${ln.y.toFixed(1)}px;--s:${ln.s.toFixed(1)}px;--c:${ln.c};--dl:${(-Math.random() * 5).toFixed(2)}s`
    el.innerHTML = '<i class="cap t"></i><b></b><i class="cap bo"></i><i class="tas"></i>'
    frag.appendChild(el)
    ln.el = el
    ln.lit = S.lanternLv
  }
  world.prepend(frag)

  $$('.bokeh', skyEl).forEach(n => n.remove())
  for (const b of BOKEH) {
    const el = document.createElement('div')
    el.className = 'bokeh'
    el.style.cssText = `left:${(b.fx * S.W + b.dx * S.m).toFixed(1)}px;top:${(b.top * S.m).toFixed(1)}px;--s:${(b.s * S.m).toFixed(1)}px;--c:${b.c};--b:${b.b}px`
    skyEl.appendChild(el)
  }

  PH.forEach((p, i) => {
    const d = L.photos[i]
    if (!p.el) {
      p.el = document.createElement('div')
      p.el.innerHTML = `${raftSVG()}<div class="snap"><img src="${p.src}" alt="" decoding="async"></div><i></i><i class="r"></i>`
      world.appendChild(p.el)
    }
    p.el.className = `photo ${d.kind}${p.found ? ' found' : ''}${p.fit ? ' fit' : ''}`
    p.el.style.cssText = `left:${d.x.toFixed(1)}px;top:${d.y.toFixed(1)}px;--w:${d.w}px;--r:${d.r}deg`
    p.w = d.w; p.r = d.r; p.cx = d.x
    p.cy = d.kind === 'hang' ? d.y + d.w * 0.6 : d.kind === 'raft' ? d.y - d.w * 0.12 : d.y
    p.vis = -1
  })

  const pk = L.peek
  Object.assign(peekEl.style, { left: `${pk.x - pk.w / 2}px`, top: `${pk.y - pk.w * 0.5}px`, width: `${pk.w}px`, height: `${pk.w * 0.5}px` })
  S.peekC = { x: pk.x, y: pk.y - pk.w * 0.24 }

  const mo = L.moon
  Object.assign(moonEl.style, { left: `${mo.x - mo.r}px`, top: `${mo.y - mo.r}px`, width: `${mo.r * 2}px`, height: `${mo.r * 2}px` })
  CLOUDS.forEach((c, i) => {
    const el = cloudEls[i]
    Object.assign(el.style, { left: `${mo.x + (c.dx - c.w / 2) * mo.r}px`, top: `${mo.y + (c.dy - c.h / 2) * mo.r}px`, width: `${c.w * mo.r}px`, height: `${c.h * mo.r}px` })
    el.style.setProperty('--part', `${c.dir * mo.r * 5}px`)
  })
  river.forEach(hd => { hd.w = 0 })
}

/* ───────── darkness ───────── */

// a soft round opening in the darkness (sy > 1 stretches it into a water reflection)
function hole(c, x, y, r, a, sy = 1) {
  if (r < 1 || a < 0.01) return
  x *= DK; y *= DK; r *= DK
  c.save()
  c.translate(x, y)
  if (sy !== 1) c.scale(1, sy)
  const g = c.createRadialGradient(0, 0, 0, 0, 0, r)
  g.addColorStop(0, `rgba(0,0,0,${a})`)
  g.addColorStop(0.35, `rgba(0,0,0,${a * 0.85})`)
  g.addColorStop(0.7, `rgba(0,0,0,${a * 0.35})`)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill()
  c.restore()
}

// the town's lanterns barely move, so their light pools are drawn once into a mask
// and only redrawn while their brightness is changing
const maskCv = document.createElement('canvas'), mctx = maskCv.getContext('2d')
let maskSig = ''
function staticLights() {
  let sum = 0
  for (const ln of L.lanterns) sum += ln.lit
  const sig = `${darkCv.width}x${darkCv.height}:${L.lanterns.length}:${sum.toFixed(2)}`
  if (sig !== maskSig) {
    maskSig = sig
    maskCv.width = darkCv.width; maskCv.height = darkCv.height
    mctx.clearRect(0, 0, maskCv.width, maskCv.height)
    for (const ln of L.lanterns) {
      if (ln.lit > 0.01) hole(mctx, ln.x, ln.y + ln.s * 0.8, ln.s * (1.9 + 1.5 * ln.lit), Math.min(1, 0.3 + 0.65 * ln.lit))
    }
    const lv = L.lanterns.length ? sum / L.lanterns.length : 0
    const water = S.H - L.riverTop
    for (const f of L.far) hole(mctx, f.x, f.y, f.r, Math.min(0.9, lv * 1.6))
    for (const b of L.bank) hole(mctx, b.x, L.riverTop + water * 0.17, S.m * 0.05, Math.min(0.8, lv * 1.3), (water * 0.2) / (S.m * 0.05))
  }
  dctx.drawImage(maskCv, 0, 0)
}

function renderDark() {
  const w = darkCv.width, h = darkCv.height
  dctx.globalCompositeOperation = 'source-over'
  dctx.clearRect(0, 0, w, h)
  dctx.fillStyle = `rgba(4,6,13,${S.ambient.toFixed(3)})`
  dctx.fillRect(0, 0, w, h)
  dctx.globalCompositeOperation = 'destination-out'
  if (L) staticLights()
  const fl = 1 + 0.025 * Math.sin(S.t * 13) + 0.02 * Math.sin(S.t * 7.7)
  hole(dctx, rig.x, rig.y, light.r * fl, light.a)
  for (const p of PH) if (p.found) hole(dctx, p.cx, p.cy, p.w * 1.1, 0.7)
  for (const hd of river) if (hd.lit > 0.01) hole(dctx, hd.x, hd.y, hd.size * 2.4, 0.85 * hd.lit)
}

/* ───────── hints ───────── */

let hintTimer = 0, hintSeq = 0
function hint(a, b, autoHide = 0) {
  const my = ++hintSeq
  clearTimeout(hintTimer)
  const wasHidden = hintEl.classList.contains('out')
  hintEl.classList.add('out')
  hintTimer = setTimeout(() => {
    if (my !== hintSeq) return
    hintA.textContent = a || ''
    hintB.textContent = b || ''
    if (a || b) hintEl.classList.remove('out')
    if (autoHide) hintTimer = setTimeout(() => { if (my === hintSeq) hintEl.classList.add('out') }, autoHide)
  }, wasHidden ? 30 : 380)
}
function hintOut() { ++hintSeq; clearTimeout(hintTimer); hintEl.classList.add('out') }

/* ───────── 1. the little dot ───────── */

function introLayout() {
  S.introScale = gloryScale() * 6
  S.dotLocal = 5 / S.introScale
  rig.ls = Math.log(S.introScale)
  rig.x = S.W / 2
  rig.y = S.H * 0.47 - 11 * S.introScale + 5
  rig.glowR = 34 / S.introScale
  emberHit.style.left = `${S.W / 2}px`
  emberHit.style.top = `${S.H * 0.47}px`
}

const INTRO_HINTS = [
  ['', 'spam the spark'],
  ['', 'spam faster'],
  ['', 'nhanh lên coi'],
  ['', 'nhanh lên coi!!!'],
]
const COOL_HINT = 'oh you gonna let it go now?'

function tapEmber() {
  if (S.phase !== 'intro') return
  Sound.unlock()
  Sound.windStart()
  Sound.fireStart()
  emberHit.classList.add('tapped')
  soundNote.classList.add('gone')
  S.heat = Math.min(1, S.heat + 0.075)
  S.kick = 1
  S.lastTap = S.t
  S.peak = Math.max(S.peak, S.heat)
  S.taps++
  Sound.tap(S.heat)
  FX.embers(S.flameX, S.flameY, Math.round(3 + S.heat * 12), 0.6 + S.heat * 0.8)
  const st = S.heat > 0.8 ? 3 : S.heat > 0.45 ? 2 : S.taps > 1 ? 1 : 0
  if (st > S.stage) { S.stage = st; S.coolHint = false; hint(...INTRO_HINTS[st]) }
  if (S.heat >= 1) ignite()
}

function updateIntro(dt) {
  if (S.t - S.lastTap > 0.45) S.heat = Math.max(0, S.heat - 0.075 * dt)
  S.kick *= Math.exp(-dt * 7)
  rig.glowR = (34 + S.heat * S.m * 0.55) / S.introScale
  Sound.fireLevel(S.heat)
  if (S.peak > 0.3 && S.heat < S.peak - 0.15 && !S.coolHint) {
    S.coolHint = true
    S.stage = 1
    S.peak = S.heat
    hint('', COOL_HINT)
  }
  if (S.heat > 0.3 && Math.random() < S.heat * dt * 8) FX.embers(S.flameX, S.flameY, 1, 0.3 + S.heat * 0.3)
}

/* ───────── 2. ignite → the lantern appears ───────── */

async function ignite() {
  S.phase = 'ignite'
  emberHit.hidden = true
  hintOut()
  Sound.ignite()
  FX.flash(S.flameX, S.flameY, S.m * 0.7)
  FX.burst(S.flameX, S.flameY, 70, FX.EMBER, 420)
  rig.flare = 1
  tween(rig, { flare: 0 }, 900, Ease.out)
  await wait(420)

  const gs = gloryScale()
  // the camera pulls back: flame → candle inside a star lantern
  tween(rig, { ls: Math.log(gs), y: S.H * 0.44 }, REDUCED ? 1200 : 2600, Ease.inOutQuint)
  tween(rig, { glowR: 70 }, 2000, Ease.inOut)
  tween(rig, { frame: 1 }, 1400, Ease.out, 500)
  tween(rig, { paper: 1 }, 1700, Ease.out, 1150)
  setTimeout(() => Sound.lanternLit(), 1150)
  S.ambient = 0.965
  town.style.transformOrigin = `${S.W / 2}px ${S.H * 0.47}px`
  if (!REDUCED) town.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 3000, easing: EASE_IN_OUT })
  setTimeout(() => { town.classList.add('on'); skyEl.classList.add('on'); fogEl.classList.add('thin') }, 700)
  tween(light, { r: S.m * 0.62 }, 2800, Ease.out, 900)
  setTimeout(() => Sound.fireLevel(0.2), 1600)
  // the town's lanterns catch the light one by one, rippling outwards from yours
  setTimeout(() => glowTown(rig.x, rig.y), 1300)
  await wait(2900)

  S.phase = 'glory'
  hint('một điều ước vừa được thắp lên', '✦ đèn đã sáng ✦')
  FX.sparkles(rig.x, rig.y, 26, 120 * gs, FX.GOLD)
  Sound.sparkle(10, 1)
  await wait(2000)

  // a bamboo stick slides out and the lantern settles into your hand
  hintOut()
  tween(rig, { stick: 1 }, 800, Ease.out)
  await wait(450)
  const ss = searchScale(), start = startSpot(ss)
  tween(rig, { ls: Math.log(ss), x: start.x, y: start.y - STICK * ss }, 1200, Ease.inOut)
  tween(light, { r: searchLight() }, 1200, Ease.inOut)
  tween(S, { ambient: SEARCH_DARK }, 1200, Ease.inOut)
  Sound.fireStop(3)
  await wait(1250)
  beginSearch(start)
}

const SEARCH_DARK = 0.9

function glowTown(cx, cy, instant = false) {
  S.lanternLv = 0.5
  const ls = [...L.lanterns].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))
  ls.forEach((ln, i) => {
    const go = () => {
      if (ln.el) ln.el.classList.add('glow')
      tween(ln, { lit: 0.5 }, instant ? 1 : 700, Ease.out)
      if (!instant && i % 9 === 0) Sound.softBell(Math.floor(i / 9))
    }
    if (instant) go(); else setTimeout(go, i * 28)
  })
  spawnRiver(S.m < 500 ? 5 : 7, 0.6, instant)
}

// where the hand starts: the spot whose lantern is furthest from every hidden photo
function startSpot(ss) {
  const ls = STICK * ss
  const cands = [[0.5, 0.36], [0.5, 0.45], [0.62, 0.4], [0.4, 0.42], [0.55, 0.3], [0.45, 0.52]]
  let best = null, bd = -1
  for (const [fx, fy] of cands) {
    const x = S.W * fx, y = S.H * fy
    const d = Math.min(...PH.map(p => Math.hypot(p.cx - x, p.cy - y)))
    if (d > bd) { bd = d; best = { x, y: y + ls } }
  }
  return best
}

function beginSearch(start) {
  P.gx = P.tx = start.x; P.gy = P.ty = start.y
  P.vx = P.vy = P.th = P.om = P.tas = P.tasV = 0
  S.phase = 'search'
  S.lastFind = S.t
  trayEl.classList.add('show')
  if (!S.dragged) gripRing.classList.add('show')
  hint('giữ & kéo cây đèn để soi đường', 'tìm 5 mảnh ký ức đang trốn trong bóng tối')
}

/* ───────── 3. search with the lantern ───────── */

function updatePhysics(dt) {
  const k = 1 - Math.exp(-dt * (P.soft ? 5 : 18))
  const nx = P.gx + (P.tx - P.gx) * k, ny = P.gy + (P.ty - P.gy) * k
  const pvx = P.vx
  P.vx = lerp(P.vx, (nx - P.gx) / dt, 0.35)
  P.vy = lerp(P.vy, (ny - P.gy) / dt, 0.35)
  const ax = clamp((P.vx - pvx) / dt, -30000, 30000)
  P.gx = nx; P.gy = ny

  // the stick leans against the motion, the lantern springs back
  const idle = Math.sin(S.t * 1.1) * 0.035 + Math.sin(S.t * 0.53) * 0.02
  const target = P.bias + clamp(-P.vx * 0.0011, -0.55, 0.55) + idle
  P.om += (90 * (target - P.th) - 9 * P.om) * dt
  P.th += P.om * dt
  // tassels hang with gravity and swing behind
  P.tasV += (70 * (-P.th - P.tas) - 5 * P.tasV + ax * 0.0025) * dt
  P.tas = clamp(P.tas + P.tasV * dt, -1.3, 1.3)

  const ls = STICK * Math.exp(rig.ls)
  rig.x = P.gx + Math.sin(P.th) * ls
  rig.y = P.gy - Math.cos(P.th) * ls
  rig.rot = P.th
}

// hidden things only materialise when the lantern is right on them: a faint ghost
// up close, then solid as you hold the light there
const HOLD = 0.8   // seconds the lantern has to linger on a photo to collect it
function updateVisibility() {
  if (!L) return
  const on = S.phase === 'search' || S.phase === 'hunt' || S.phase === 'dialogue'
  const near = (x, y) => (on ? smooth(light.r * 0.7, light.r * 0.28, Math.hypot(x - rig.x, y - rig.y)) : 0)
  for (const p of PH) {
    const v = p.found || S.townLit ? 1 : Math.max(near(p.cx, p.cy) * 0.4, p.charge)
    if (Math.abs(v - p.vis) > 0.005) { p.vis = v; p.el.style.opacity = v.toFixed(3) }
  }
  peekEl.style.setProperty('--vis', near(S.peekC.x, S.peekC.y).toFixed(3))
}

// a rare nudge, and only once they've been stuck for a while
function glints(dt) {
  S.glintT -= dt
  if (S.glintT > 0) return
  S.glintT = 5
  const since = S.t - S.lastFind
  if (since < 30) return
  const left = PH.filter(p => !p.found)
  if (!left.length) return
  const p = left[Math.floor(Math.random() * left.length)]
  FX.glint(p.cx + rnd(-0.3, 0.3) * p.w, p.cy + rnd(-0.3, 0.3) * p.w, FX.GOLD, Math.min(9, 4 + (since - 30) * 0.1))
}

function checkFinds(dt) {
  const reach = light.r * 0.3
  for (const p of PH) {
    if (p.found) continue
    if (Math.hypot(p.cx - rig.x, p.cy - rig.y) < reach + p.w * 0.1) {
      p.charge = Math.min(1, p.charge + dt / HOLD)
      if (Math.random() < dt * 6) FX.glint(p.cx + rnd(-0.4, 0.4) * p.w, p.cy + rnd(-0.4, 0.4) * p.w, FX.GOLD, 4 + p.charge * 4)
      if (p.charge >= 1) { foundPhoto(p); return }
    } else {
      p.charge = Math.max(0, p.charge - dt * 1.5)
    }
  }
  if (S.huntReady && Math.hypot(S.peekC.x - rig.x, S.peekC.y - rig.y) < light.r * 0.35 + L.peek.w * 0.15) foundCreature()
}

async function foundPhoto(p) {
  p.found = true
  S.viewing = true
  P.drag = false
  S.lastFind = S.t
  S.found++
  p.el.classList.add('found')
  countEl.textContent = `${S.found} / 5`
  Sound.chime()
  FX.sparkles(p.cx, p.cy, 26, p.w * 0.7, FX.GOLD)
  hintOut()

  cardImg.src = p.src
  cardImg.alt = p.caption
  cardCap.textContent = p.caption
  try { await cardImg.decode() } catch (e) { /* show it anyway */ }
  card.style.opacity = ''
  viewer.classList.add('open')
  const to = card.getBoundingClientRect(), from = p.el.querySelector('.snap').getBoundingClientRect()
  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  card.getAnimations().forEach(a => a.cancel())
  card.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}) rotate(${p.r}deg)`, opacity: 0.4 },
    { transform: 'translate(0, 0) scale(1) rotate(-1.5deg)', opacity: 1 },
  ], { duration: REDUCED ? 200 : 640, easing: EASE_OUT, fill: 'both' })
  S.viewerAt = performance.now()
  S.viewerP = p
  setTimeout(() => { if (S.viewerP === p) viewer.classList.add('hinted') }, 1100)
}

async function closeViewer() {
  const p = S.viewerP
  if (!p || S.closing || performance.now() - S.viewerAt < 450) return
  S.closing = true
  const slot = slotEls[S.found - 1]
  const to = slot.getBoundingClientRect(), from = card.getBoundingClientRect()
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  card.getAnimations().forEach(a => a.cancel())
  viewer.classList.remove('hinted', 'open')
  const fly = card.animate([
    { transform: 'translate(0, 0) scale(1) rotate(-1.5deg)', opacity: 1 },
    { transform: `translate(${dx}px, ${dy}px) scale(${to.width / from.width}) rotate(0deg)`, opacity: 0.25 },
  ], { duration: REDUCED ? 200 : 560, easing: EASE_IN_OUT, fill: 'both' })
  await fly.finished.catch(() => {})
  card.style.opacity = '0'
  card.getAnimations().forEach(a => a.cancel())

  slot.style.backgroundImage = `url("${p.src}")`
  slot.textContent = ''
  slot.classList.add('filled')
  slot.animate([{ transform: 'scale(.85)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 420, easing: EASE_OUT })
  const r = slot.getBoundingClientRect()
  FX.sparkles(r.left + r.width / 2, r.top + r.height / 2, 10, 22, FX.GOLD)
  Sound.sparkle(4, 0.3)

  S.viewing = false
  S.closing = false
  S.viewerP = null
  const left = 5 - S.found
  if (left > 0) hint('', left === 1 ? 'còn 1 mảnh cuối cùng ✦' : `còn ${left} mảnh nữa ✦`, 2600)
  else startHunt()
}

/* ───────── 4. someone is hiding ───────── */

async function startHunt() {
  S.phase = 'hunt'
  hint('', 'tìm doraemon đi')
  await wait(1400)
  peekEl.classList.add('here')
  Sound.giggle()
  S.huntReady = true
  S.huntAt = S.t
  S.twinkle = setInterval(() => { if (S.t - S.huntAt > 12) FX.glint(S.peekC.x + rnd(-20, 20), S.peekC.y + rnd(-14, 6), FX.BLUE, 6) }, 4000)
  S.giggles = setInterval(() => Sound.giggle(0.025), 8000)
}

async function foundCreature() {
  if (S.phase !== 'hunt') return
  S.phase = 'dialogue'
  S.huntReady = false
  clearInterval(S.twinkle)
  clearInterval(S.giggles)
  P.drag = false
  gripRing.classList.remove('show')
  Sound.pop()
  FX.sparkles(S.peekC.x, S.peekC.y, 30, 50, [...FX.BLUE, ...FX.GOLD])
  hintOut()
  trayEl.classList.remove('show')

  const pr = $('img', peekEl).getBoundingClientRect()
  peekEl.classList.remove('here')
  peekEl.style.transition = 'none'
  peekEl.style.visibility = 'hidden'
  dialog.classList.add('open')
  const cr = dlgCreature.getBoundingClientRect()
  const sx = pr.width / cr.width
  const dx = pr.left + pr.width / 2 - (cr.left + cr.width / 2)
  const dy = pr.top + pr.height / 2 - (cr.top + cr.height / 2)
  const peakY = Math.min(dy, 0) - S.H * 0.16
  const jump = dlgCreature.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(${sx})`, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' },
    { transform: `translate(${dx * 0.45}px, ${peakY}px) scale(${lerp(sx, 1, 0.6)}) rotate(-10deg)`, easing: 'cubic-bezier(0.32, 0, 0.67, 0)', offset: 0.45 },
    { transform: 'translate(0, 0) scale(1.08, 0.9)', easing: EASE_OUT, offset: 0.82 },
    { transform: 'translate(0, 0) scale(1)' },
  ], { duration: REDUCED ? 300 : 1100 })
  await jump.finished.catch(() => {})
  dlgCreature.classList.add('idle')
  // the creature takes the lantern
  P.soft = true
  parkLantern()
  await wait(350)
  nextLine()
}

function parkLantern() {
  const r = dlgCreature.getBoundingClientRect()
  P.tx = r.left + r.width * 0.09
  P.ty = r.top + r.height * 0.64
  P.bias = -0.32
}

/* ───────── 5. dialogue ───────── */

let typing = false, skipType = false, li = -1

async function nextLine() {
  if (typing) { skipType = true; return }
  if (li >= LINES.length - 1) return
  li++
  const ln = LINES[li]
  S.dlgReady = true
  bubble.classList.remove('ready')
  bubble.classList.toggle('big', !!ln.big)
  dialog.classList.add('talking')
  if (ln.start) ln.start()
  await typeText(ln)
  if (ln.end) ln.end()
  if (li < LINES.length - 1) bubble.classList.add('ready')
}

async function typeText(ln) {
  typing = true
  skipType = false
  const text = ln.text.normalize('NFC')
  const chars = Array.from(text)
  dlgText.textContent = ''
  dlgSr.textContent = text
  const spans = chars.map((ch, i) => {
    const s = document.createElement('span')
    s.className = ch === ' ' ? 'ch sp' : 'ch'
    s.textContent = ch
    s.style.setProperty('--i', i)
    dlgText.appendChild(s)
    return s
  })
  dlgCreature.classList.remove('idle')
  dlgCreature.classList.add('talk')
  let us = 0
  for (let i = 0; i < spans.length; i++) {
    if (skipType) { for (let j = i; j < spans.length; j++) spans[j].classList.add('on'); break }
    spans[i].classList.add('on')
    const ch = chars[i]
    if (ch.trim()) {
      let pitch = 1
      if (ln.big && ch === 'u') pitch = 1 + ++us * 0.12
      if (ln.big || i % 2 === 0) Sound.blip(pitch)
    }
    let d = ln.big ? 105 : 34
    if (',;'.includes(ch)) d = 170
    else if ('.!?'.includes(ch)) d = 280
    await wait(d)
  }
  dlgCreature.classList.remove('talk')
  dlgCreature.classList.add('idle')
  typing = false
}

function lightTheTown() {
  if (S.townLit) return
  S.townLit = true
  Sound.windStop()
  Sound.celebrate()
  tween(S, { ambient: 0.4 }, 3200, Ease.inOut)
  skyEl.classList.add('clear')
  fogEl.classList.remove('thin')
  fogEl.classList.add('gone')
  S.lanternLv = 1
  const ls = [...L.lanterns].sort((a, b) => a.x - b.x)
  ls.forEach((ln, i) => setTimeout(() => {
    if (ln.el) ln.el.classList.add('glow', 'on')
    tween(ln, { lit: 1 }, 800, Ease.out)
    if (i % 6 === 0) Sound.softBell(Math.floor(i / 6))
  }, 250 + i * 35))
  river.forEach(hd => tween(hd, { lit: 1 }, 1500, Ease.out))
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const x = S.W * rnd(0.12, 0.88), y = S.H * rnd(0.07, 0.28)
      FX.rocket(x, y, S.H * 0.7, 0.75)
      setTimeout(() => FX.firework(x, y), 750)
      Sound.firework((x / S.W - 0.5) * 1.2)
    }, 500 + i * 650 + Math.random() * 200)
  }
  spawnRiver(S.m < 500 ? 4 : 6, 1)
  setTimeout(() => Sound.musicStart(0.9), 2200)
  if (!REDUCED) {
    dlgCreature.animate([
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(-26px) scale(1.04, .96) rotate(-4deg)', offset: 0.35 },
      { transform: 'translateY(0) scale(1.06, .92)', offset: 0.7 },
      { transform: 'translateY(0) scale(1)' },
    ], { duration: 700, easing: EASE_OUT, iterations: 2 })
  }
}

function ahem() {
  Sound.ahem()
  dlgCreature.animate([
    { transform: 'scale(1)' },
    { transform: 'scale(.95, 1.05) rotate(-3deg)', offset: 0.3 },
    { transform: 'scale(1.02, .98) rotate(2deg)', offset: 0.6 },
    { transform: 'scale(1)' },
  ], { duration: 600, easing: EASE_OUT })
}

function finalWish() {
  const r = dlgCreature.getBoundingClientRect()
  FX.hearts(r.left + r.width / 2, r.top + r.height * 0.3, 14)
  FX.sparkles(r.left + r.width / 2, r.top + r.height * 0.4, 20, r.width * 0.5, FX.GOLD)
  Sound.sparkle(14, 1.4)
  setTimeout(() => {
    letterBtn.classList.add('shown')
    requestAnimationFrame(() => letterBtn.classList.add('show'))
    letterBtn.focus({ preventScroll: true })
  }, 900)
}

// floating lanterns drifting down the river
function spawnRiver(n, level, instant = false) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div')
    el.className = 'hoadang'
    el.innerHTML = floaterSVG()
    el.style.opacity = '0'
    world.appendChild(el)
    const v = Math.random()
    const hd = { el, u: Math.random(), v: 0.12 + v * 0.8, s: lerp(0.05, 0.085, v), sp: lerp(0.006, 0.016, v), ph: Math.random() * TAU, lit: 0, x: 0, y: 0, size: 0, w: 0 }
    river.push(hd)
    if (instant) hd.lit = level
    else setTimeout(() => tween(hd, { lit: level }, 1200, Ease.out), 600 + i * 180)
  }
}

function updateRiver(dt) {
  for (const hd of river) {
    hd.u += hd.sp * dt
    if (hd.u > 1.1) hd.u = -0.1
    hd.size = hd.s * S.m
    if (hd.w !== hd.size) { hd.w = hd.size; hd.el.style.width = `${hd.size}px` }
    hd.x = hd.u * S.W
    hd.y = L.riverTop + hd.v * (S.H - L.riverTop) + Math.sin(S.t * 1.4 + hd.ph) * 2
    hd.el.style.transform = `translate(${(hd.x - hd.size / 2).toFixed(1)}px, ${(hd.y - hd.size * 0.6).toFixed(1)}px)`
    hd.el.style.opacity = Math.min(1, hd.lit * 2).toFixed(3)
  }
}

/* ───────── 6. the letter ───────── */

async function openLetter() {
  if (S.phase === 'letter') return
  S.phase = 'letter'
  letterBtn.disabled = true
  Sound.sparkle(10, 0.8)
  Sound.musicStart(0.9)
  dialog.classList.remove('open')
  stage.animate([
    { opacity: 1, transform: 'none' },
    { opacity: 0, transform: 'translateY(6vh) scale(1.03)' },
  ], { duration: REDUCED ? 600 : 1600, easing: EASE_IN_OUT, fill: 'forwards' })
  FX.setBloom(null)
  initLetter()
  letter.scrollTop = 0
  letter.classList.add('show')
  letter.focus({ preventScroll: true })
  await wait(1700)
  stage.style.display = 'none'
}

const Stars = (() => {
  const cv = $('#stars'), ctx = cv.getContext('2d')
  let W = 0, H = 0, dpr = 1, list = [], shoot = null, nextShoot = 5
  function resize() {
    W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2)
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
    list = Array.from({ length: Math.round(W * H / 4200) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 0.4 + Math.random() * 1.1, p: Math.random() * TAU, s: 0.6 + Math.random() * 2 }))
  }
  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    for (const s of list) {
      ctx.fillStyle = `rgba(255,244,220,${(0.25 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.s + s.p))).toFixed(3)})`
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill()
    }
    if (!shoot && t > nextShoot && !REDUCED) { shoot = { x: W * rnd(0.3, 0.95), y: H * rnd(0.05, 0.35), t0: t }; nextShoot = t + rnd(7, 15) }
    if (shoot) {
      const k = (t - shoot.t0) / 0.9
      if (k >= 1) shoot = null
      else {
        const len = Math.min(W, H) * 0.25, x = shoot.x - k * len * 1.4, y = shoot.y + k * len * 0.55
        const g = ctx.createLinearGradient(x, y, x + len * 0.5, y - len * 0.2)
        g.addColorStop(0, `rgba(255,250,230,${((1 - k) * 0.9).toFixed(3)})`)
        g.addColorStop(1, 'rgba(255,250,230,0)')
        ctx.strokeStyle = g; ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len * 0.5, y - len * 0.2); ctx.stroke()
      }
    }
  }
  return { resize, draw }
})()

function buildFarBank() {
  const svg = $('.far-bank')
  const COLORS = ['#ff5a4a', '#ffc05a', '#ff8a3a', '#ff6fa0']
  let d = 'M0 220', lights = '', x = 0
  while (x < 2000) {
    const w = 60 + Math.random() * 90, h = 70 + Math.random() * 70, top = 220 - h, rh = w * 0.22
    d += `L${x.toFixed(0)} ${top.toFixed(0)}L${(x + w * 0.12).toFixed(0)} ${(top - rh).toFixed(0)}L${(x + w * 0.88).toFixed(0)} ${(top - rh).toFixed(0)}L${(x + w).toFixed(0)} ${top.toFixed(0)}`
    if (Math.random() < 0.75) {
      const cx = (x + w * (0.25 + Math.random() * 0.5)).toFixed(0), cy = (top + 12 + Math.random() * 20).toFixed(0), c = COLORS[Math.floor(Math.random() * COLORS.length)]
      lights += `<circle cx="${cx}" cy="${cy}" r="14" fill="${c}" opacity=".18"/><circle cx="${cx}" cy="${cy}" r="4.5" fill="${c}"/>`
    }
    x += w + Math.random() * 12
  }
  svg.innerHTML = `<path d="${d}L2000 220Z" fill="#0a0f24"/>${lights}`
}

function initLetter() {
  Stars.resize()
  buildFarBank()
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
  }), { root: letter, threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
  $$('.reveal', letter).forEach(el => io.observe(el))

  const drift = $('.l-drift')
  for (let i = 0; i < 12; i++) {
    const d = Math.random()
    const el = document.createElement('div')
    el.className = 'hd'
    el.style.cssText = `--y:${(30 + d * 55).toFixed(1)}%;--s:${Math.round(30 + d * 46)}px;--d:${Math.round(70 - d * 30)}s;--dl:${(-Math.random() * 70).toFixed(1)}s;--x:${Math.round(Math.random() * 90)};opacity:${(0.55 + d * 0.45).toFixed(2)};z-index:${d > 0.6 ? 8 : 2}`
    el.innerHTML = floaterSVG()
    drift.appendChild(el)
  }
  $('.k-lantern').innerHTML = staticStarSVG()

  const kotoba = $('.kotoba')
  const io2 = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return
    io2.disconnect()
    kotoba.classList.add('show')
    Sound.pop()
    setTimeout(() => Sound.sparkle(14, 1.4), 200)
    const b = $('.k-bubble').getBoundingClientRect()
    FX.hearts(b.left + b.width / 2, b.top + b.height / 2, 14)
    FX.sparkles(b.left + b.width / 2, b.top + b.height / 2, 18, b.width * 0.6, FX.GOLD)
    setTimeout(() => $('.l-river-hint').classList.add('show'), 3500)
  }, { root: letter, threshold: 0.6 })
  io2.observe(kotoba)
  $('.l-river').addEventListener('click', releaseLantern)
}

function releaseLantern(e) {
  const r = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - r.left, y = e.clientY - r.top
  if (y < r.height * 0.27) return
  const size = Math.round(lerp(34, 72, clamp((y / r.height - 0.27) / 0.6, 0, 1)))
  const el = document.createElement('div')
  el.className = 'hd released'
  el.style.cssText = `left:${x - size / 2}px;top:${y - size * 0.6}px;width:${size}px;z-index:9`
  el.innerHTML = floaterSVG()
  $('.l-drift').appendChild(el)
  const rise = Math.max(0, y - r.height * 0.3)
  el.animate([
    { transform: 'translate(0, 6px) scale(.9)', opacity: 0 },
    { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.06 },
    { transform: `translate(${Math.round(innerWidth * 0.35)}px, ${-rise}px) scale(.4)`, opacity: 0 },
  ], { duration: 18000, easing: 'linear' }).finished.then(() => el.remove()).catch(() => {})
  Sound.softBell(Math.floor(Math.random() * 6))
  Sound.sparkle(3, 0.4)
  FX.sparkles(e.clientX, e.clientY - size * 0.3, 8, 24, FX.GOLD)
}

/* ───────── input ───────── */

stage.addEventListener('pointerdown', e => {
  Sound.unlock()
  if (S.phase === 'intro') { tapEmber(); return }
  if ((S.phase === 'search' || S.phase === 'hunt') && !S.viewing) {
    P.drag = true
    P.offX = P.gx - e.clientX
    P.offY = P.gy - e.clientY
    try { stage.setPointerCapture(e.pointerId) } catch (err) { /* ignore */ }
    if (!S.dragged) { S.dragged = true; gripRing.classList.remove('show') }
  }
})
stage.addEventListener('pointermove', e => {
  if (!P.drag) return
  const ls = STICK * Math.exp(rig.ls)
  P.tx = clamp(e.clientX + P.offX, 6, S.W - 6)
  P.ty = clamp(e.clientY + P.offY, ls + 10, S.H + ls - 10)
})
const endDrag = () => { P.drag = false }
stage.addEventListener('pointerup', endDrag)
stage.addEventListener('pointercancel', endDrag)
stage.addEventListener('lostpointercapture', endDrag)

viewer.addEventListener('pointerdown', e => { e.stopPropagation(); closeViewer() })

dialog.addEventListener('pointerdown', e => {
  if (!dialog.classList.contains('open') || !S.dlgReady) return
  if (e.target.closest('.letter-btn')) return
  if (letterBtn.classList.contains('shown')) openLetter()
  else nextLine()
})
letterBtn.addEventListener('click', openLetter)

addEventListener('keydown', e => {
  const k = e.key
  if (S.phase === 'intro' && (k === ' ' || k === 'Enter')) {
    e.preventDefault(); Sound.unlock(); tapEmber()
  } else if (S.viewing && (k === ' ' || k === 'Enter' || k === 'Escape')) {
    e.preventDefault(); closeViewer()
  } else if ((S.phase === 'search' || S.phase === 'hunt') && k.startsWith('Arrow') && !S.viewing) {
    e.preventDefault()
    const st = 24, ls = STICK * Math.exp(rig.ls)
    if (k === 'ArrowLeft') P.tx -= st
    if (k === 'ArrowRight') P.tx += st
    if (k === 'ArrowUp') P.ty -= st
    if (k === 'ArrowDown') P.ty += st
    P.tx = clamp(P.tx, 6, S.W - 6)
    P.ty = clamp(P.ty, ls + 10, S.H + ls - 10)
    if (!S.dragged) { S.dragged = true; gripRing.classList.remove('show') }
  } else if (S.phase === 'dialogue' && S.dlgReady && (k === ' ' || k === 'Enter') && document.activeElement !== letterBtn) {
    e.preventDefault()
    if (letterBtn.classList.contains('shown')) openLetter()
    else nextLine()
  }
})

;['pointerup', 'touchend', 'keydown', 'click'].forEach(ev => addEventListener(ev, () => Sound.unlock(), { passive: true }))

muteBtn.addEventListener('click', () => {
  const m = !Sound.muted
  Sound.setMuted(m)
  muteBtn.setAttribute('aria-pressed', String(m))
  muteBtn.setAttribute('aria-label', m ? 'Bật âm thanh' : 'Tắt âm thanh')
})

/* ───────── layout & loop ───────── */

function onResize() {
  if (innerWidth < 50 || innerHeight < 50) return   // hidden / collapsed window
  S.W = innerWidth; S.H = innerHeight; S.m = Math.min(S.W, S.H)
  S.dpr = Math.min(devicePixelRatio || 1, 2)
  FX.resize(S.W, S.H, S.dpr)
  if (S.phase === 'letter') { Stars.resize(); return }
  darkCv.width = Math.ceil(S.W * DK)
  darkCv.height = Math.ceil(S.H * DK)
  L = Scene.build(S.W, S.H, S.dpr)
  placeWorld()
  if (S.phase === 'intro') introLayout()
  else if (S.phase === 'search' || S.phase === 'hunt') {
    const ls = STICK * searchScale()
    rig.ls = Math.log(searchScale())
    light.r = searchLight()
    P.tx = P.gx = clamp(P.tx, 6, S.W - 6)
    P.ty = P.gy = clamp(P.ty, ls + 10, S.H + ls - 10)
  } else if (S.phase === 'dialogue') requestAnimationFrame(parkLantern)
}
let rz = 0
addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(onResize) })

let last = 0
function frame(now) {
  // tweens follow the wall clock so the choreography stays in sync with its timers;
  // physics gets a capped step so a slow frame can't blow the springs up
  const real = Math.min(0.25, Math.max(0.001, (now - last) / 1000))
  const dt = Math.min(0.05, real)
  last = now
  S.t += dt
  stepTweens(real)
  if (S.phase !== 'letter') {
    if (S.phase === 'intro') updateIntro(dt)
    if (S.phase === 'search' || S.phase === 'hunt' || S.phase === 'dialogue') updatePhysics(dt)
    if ((S.phase === 'search' || S.phase === 'hunt') && !S.viewing) { checkFinds(dt); glints(dt) }
    if (river.length) updateRiver(dt)
    updateVisibility()
    renderRig()
    renderDark()
    if (gripRing.classList.contains('show')) gripRing.style.translate = `${P.gx.toFixed(1)}px ${P.gy.toFixed(1)}px`
    FX.setBloom(rig.paper > 0.01 ? { x: rig.x, y: rig.y, r: light.r * 0.95, a: rig.paper } : null)
  } else {
    Stars.draw(S.t)
  }
  FX.update(dt)
  FX.draw(S.t)
}
function loop(now) { frame(now); requestAnimationFrame(loop) }

/* ───────── start ───────── */

buildLantern()
hintEl.classList.add('out')
tween(rig, { flame: 1 }, 1400, Ease.out, 300)
setTimeout(() => { if (S.phase === 'intro' && S.taps === 0) hint(...INTRO_HINTS[0]) }, 1100)

// wait for a real viewport (a page opened in a collapsed/hidden frame reports ~0×0)
function boot() {
  if (innerWidth < 50 || innerHeight < 50) { setTimeout(boot, 120); return }
  onResize()
  skipAhead(params.get('skip'))
}

// preview shortcuts: ?skip=search | hunt | dialog | letter   (?debug lifts the darkness)
function skipAhead(skip) {
  if (skip === 'search' || skip === 'hunt' || skip === 'dialog') {
    emberHit.hidden = true
    soundNote.classList.add('gone')
    S.heat = 1
    Object.assign(rig, { frame: 1, paper: 1, stick: 1, glowR: 70, flame: 1, ls: Math.log(searchScale()) })
    town.classList.add('on'); skyEl.classList.add('on'); fogEl.classList.add('thin')
    light.r = searchLight()
    S.ambient = params.has('debug') ? 0.15 : SEARCH_DARK
    glowTown(0, 0, true)
    const ss = searchScale(), start = startSpot(ss)
    rig.x = start.x; rig.y = start.y - STICK * ss
    beginSearch(start)
    if (skip !== 'search') {
      PH.forEach((p, i) => {
        p.found = true
        p.el.classList.add('found')
        slotEls[i].style.backgroundImage = `url("${p.src}")`
        slotEls[i].textContent = ''
        slotEls[i].classList.add('filled')
      })
      S.found = 5
      countEl.textContent = '5 / 5'
      startHunt()
      if (skip === 'dialog') setTimeout(foundCreature, 1700)
    }
  } else if (skip === 'letter') {
    emberHit.hidden = true
    S.phase = 'dialogue'
    openLetter()
    addEventListener('pointerdown', () => { Sound.unlock(); setTimeout(() => Sound.musicStart(0.9), 100) }, { once: true })
  }
}

boot()
last = performance.now()
// ?drive runs the loop on a timer (for previews where the page isn't painting)
if (params.has('drive')) setInterval(() => frame(performance.now()), 16)
else requestAnimationFrame(loop)
})()
