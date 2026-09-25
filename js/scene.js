/* Procedural Hội An riverside at night, drawn once per resize onto a canvas.
   build() returns a layout with anchor points for the DOM things that live in the
   scene: silk lanterns, the hidden photos and the creature's hiding spot. */
const Scene = (() => {
  const cv = document.getElementById('scene')
  const ctx = cv.getContext('2d')
  const TAU = Math.PI * 2
  const lerp = (a, b, t) => a + (b - a) * t

  const WALLS = ['#d9a441', '#e2b24e', '#cf9535', '#dcae52', '#c98a3a', '#e6c77e', '#86a99a']
  const SILK = ['#e0283c', '#e0283c', '#f7b32b', '#f26b1d', '#f26b1d', '#e84a8a', '#8a4fd0', '#2aa876', '#2f7fd6']
  const BOUGAIN = ['#d6337f', '#e0529c', '#c2186b', '#f06bb5', '#b8126a']
  const LEAF = ['#1d4a2c', '#25603a', '#163b23', '#2f6e44', '#1f5532']

  let R, u, m

  function rng(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const pick = a => a[Math.floor(R() * a.length)]

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16)
    const f = amt < 0 ? 0 : 255, p = Math.abs(amt)
    const r = Math.round(lerp(n >> 16, f, p)), g = Math.round(lerp((n >> 8) & 255, f, p)), b = Math.round(lerp(n & 255, f, p))
    return `rgb(${r},${g},${b})`
  }

  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill() }

  const strAt = (s, t) => ({ x: lerp(s.x0, s.x1, t), y: lerp(s.y0, s.y1, t) + s.sag * 4 * t * (1 - t) })

  function build(W, H, dpr) {
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    R = rng(915)
    m = Math.min(W, H); u = m / 700
    const portrait = H > W
    const horizon = Math.round(H * (portrait ? 0.63 : 0.66))
    const bankH = Math.max(10, m * 0.028)
    const riverTop = horizon + bankH
    const L = { W, H, m, portrait, horizon, riverTop, houses: [], lanterns: [], photos: [] }

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizon)
    sky.addColorStop(0, '#090c22'); sky.addColorStop(0.55, '#141836'); sky.addColorStop(1, '#2a2446')
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon)
    for (let i = 0, n = Math.round(W * H / 7000); i < n; i++) {
      ctx.fillStyle = `rgba(255,244,220,${0.15 + R() * 0.5})`
      const s = R() < 0.1 ? 1.8 : 1.1
      ctx.fillRect(R() * W, R() * horizon * 0.75, s, s)
    }
    L.moon = { x: W * (portrait ? 0.24 : 0.2), y: H * (portrait ? 0.12 : 0.15), r: m * (portrait ? 0.085 : 0.075) }

    // far rooftops across the river bend, each with a little lantern under its eave
    L.far = []
    let x = -20 * u
    while (x < W) {
      const fw = m * (0.07 + R() * 0.09), fh = m * (portrait ? 0.4 : 0.34) + R() * m * 0.12
      const top = horizon - fh
      ctx.fillStyle = '#1e1933'; ctx.fillRect(x, top, fw, fh)
      roofPoly(x, top, fw, fw * 0.22, fw * 0.08)
      ctx.fillStyle = '#17132a'; ctx.fill()
      if (R() < 0.35) { ctx.fillStyle = 'rgba(255,190,110,.16)'; ctx.fillRect(x + fw * 0.4, top + fh * 0.3, fw * 0.14, fh * 0.08) }
      if (R() < 0.8) {
        const lx = x + fw * (0.2 + R() * 0.6), ly = top + 7 * u, lr = Math.max(2, 3.2 * u)
        ctx.fillStyle = pick(SILK); circle(lx, ly, lr)
        L.far.push({ x: lx, y: ly, r: lr * 6 })
      }
      x += fw + R() * m * 0.02
    }

    // the row of old yellow houses on the bank
    x = -m * 0.05
    while (x < W + m * 0.02) {
      const w = m * (0.26 + R() * 0.12)
      const h = Math.min(horizon - H * 0.3, m * (portrait ? 0.3 + R() * 0.14 : 0.25 + R() * 0.1))
      L.houses.push({ x, w, h, top: horizon - h, color: pick(WALLS), two: R() < 0.82, bougain: R() < 0.45, bLeft: R() < 0.5, eave: [] })
      x += w + (R() < 0.3 ? m * (0.01 + R() * 0.02) : 0)
    }
    const posterX = W * (portrait ? 0.2 : 0.16), doorX = W * (portrait ? 0.6 : 0.52)
    const within = (h, px) => h.x <= px && h.x + h.w >= px
    const poster = L.houses.find(h => within(h, posterX)) || L.houses[0]
    Object.assign(poster, { poster: true, two: true, bougain: false })
    const doorHouse = L.houses.find(h => within(h, doorX) && !h.poster) || L.houses[Math.min(2, L.houses.length - 1)]
    L.houses.forEach(h => drawHouse(h, horizon))

    // riverbank stones
    ctx.fillStyle = '#35333f'; ctx.fillRect(0, horizon, W, bankH)
    ctx.fillStyle = '#4c4957'; ctx.fillRect(0, horizon, W, Math.max(1.5, 2 * u))
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, horizon + bankH / 2); ctx.lineTo(W, horizon + bankH / 2); ctx.stroke()
    for (let row = 0; row < 2; row++) {
      for (let bx = (row ? 13 : 0) * u; bx < W; bx += 26 * u) {
        ctx.beginPath(); ctx.moveTo(bx, horizon + row * bankH / 2); ctx.lineTo(bx, horizon + (row + 1) * bankH / 2); ctx.stroke()
      }
    }

    // lantern posts along the riverbank promenade
    const tree = { x: W - m * 0.06, cx: W - m * 0.14, cy: lerp(H * 0.12, horizon, 0.45), rx: m * 0.21, ry: m * 0.15 }
    const poleX = W * (portrait ? 0.44 : 0.4)
    const doorPhotoX = doorHouse.door.x + doorHouse.door.w * 0.5
    const pw = Math.round(Math.max(50, Math.min(100, m * 0.115)))
    const bank = []
    const postH = m * 0.12, arm = m * 0.028
    for (let bx = m * 0.1; bx < W - m * 0.04; bx += Math.max(70, m * 0.2)) {
      if (Math.abs(bx + arm - doorPhotoX) < pw * 0.8 || Math.abs(bx - poleX) < m * 0.05 || Math.abs(bx - tree.x) < m * 0.07) continue
      drawPost(bx, horizon - postH, horizon, arm)
      bank.push({ x: bx + arm, y: horizon - postH + 2 * u, c: pick(SILK) })
    }

    // bougainvillea tree on the right
    drawTree(tree, horizon)
    L.tree = tree

    // festival strings: one sagging across the whole bank, one tied to a bamboo pole
    const strA = { x0: -W * 0.02, y0: H * (portrait ? 0.24 : 0.25), x1: W * 1.02, y1: H * (portrait ? 0.2 : 0.21), sag: H * (portrait ? 0.06 : 0.085) }
    const strB = { x0: poleX, y0: H * (portrait ? 0.1 : 0.11), x1: W * 1.02, y1: H * (portrait ? 0.075 : 0.08), sag: H * 0.045 }
    drawPole(poleX, strB.y0 - 6 * u, horizon)
    drawString(strA); drawString(strB)

    // river
    const water = ctx.createLinearGradient(0, riverTop, 0, H)
    water.addColorStop(0, '#16323c'); water.addColorStop(1, '#07161c')
    ctx.fillStyle = water; ctx.fillRect(0, riverTop, W, H - riverTop)
    reflect(horizon, riverTop, H, dpr)
    const deep = ctx.createLinearGradient(0, riverTop, 0, H)
    deep.addColorStop(0, 'rgba(6,18,24,.2)'); deep.addColorStop(1, 'rgba(4,12,16,.75)')
    ctx.fillStyle = deep; ctx.fillRect(0, riverTop, W, H - riverTop)
    for (let i = 0, n = W * (H - riverTop) / 900; i < n; i++) {
      const f = Math.pow(R(), 1.3), y = riverTop + f * (H - riverTop)
      ctx.fillStyle = `rgba(190,220,230,${0.03 + R() * 0.06})`
      ctx.fillRect(R() * W, y, (8 + R() * 40) * u * (0.5 + f), Math.max(1, u))
    }
    // the promenade lanterns shimmer on the water
    bank.forEach(b => reflectLight(b.x, b.c, riverTop, H))
    L.bank = bank

    // wooden boat with the painted eye
    const boat = drawBoat(W * (portrait ? 0.66 : 0.63), riverTop + (H - riverTop) * 0.42, m * (portrait ? 0.44 : 0.32))
    L.boat = boat
    const peekW = Math.max(70, Math.min(150, m * 0.2))
    const px = boat.x - boat.len * 0.14
    L.peek = { x: px, y: boat.gunY(px) + 2 * u, w: peekW }
    const sternX = boat.x - boat.len * 0.36, sternTop = boat.gunY(sternX) - m * 0.1
    drawPost(sternX, sternTop, boat.gunY(sternX), -m * 0.026)

    // photos
    L.pw = pw
    L.photos.push({ kind: 'wall', x: Math.max(pw * 0.8, poster.posterAt.x), y: poster.posterAt.y, w: pw, r: -5 })
    const s2 = strAt(strA, (W * (portrait ? 0.36 : 0.33) - strA.x0) / (strA.x1 - strA.x0))
    L.photos.push({ kind: 'hang', x: s2.x, y: s2.y + 2, w: pw, r: 4 })
    L.photos.push({ kind: 'raft', x: W * (portrait ? 0.24 : 0.2), y: riverTop + (H - riverTop) * (portrait ? 0.52 : 0.5), w: pw, r: -3 })
    L.photos.push({ kind: 'tree', x: tree.cx - tree.rx * 0.3, y: tree.cy + tree.ry * 0.15, w: pw, r: 9 })
    const d = doorHouse.door
    L.photos.push({ kind: 'door', x: d.x + d.w * 0.5, y: d.y + d.h * 0.52, w: Math.round(pw * 0.9), r: -2 })

    // silk lanterns everywhere: both strings, every eave, the tree, the promenade, the boat
    const addLantern = (x, y, s, c = pick(SILK)) => L.lanterns.push({ x, y, s, c })
    const nA = Math.max(7, Math.floor(W / (m * 0.085)))
    for (let i = 0; i < nA; i++) {
      const p = strAt(strA, (i + 0.5) / nA)
      if (Math.abs(p.x - s2.x) < pw * 0.8) continue
      addLantern(p.x, p.y + 1, m * (0.042 + R() * 0.02))
    }
    const nB = Math.max(5, Math.floor((strB.x1 - strB.x0) / (m * 0.075)))
    for (let i = 0; i < nB; i++) {
      const p = strAt(strB, 0.06 + (i + 0.5) / nB * 0.9)
      addLantern(p.x, p.y + 1, m * (0.038 + R() * 0.018))
    }
    L.houses.forEach(h => h.eave.forEach(e => {
      if (h.poster && e.x < h.x + h.w * 0.5) return
      addLantern(e.x, e.y, m * (0.04 + R() * 0.012))
    }))
    for (let i = 0; i < 4; i++) {
      const lx = tree.cx + (i - 1.5) * tree.rx * 0.42
      if (Math.abs(lx - L.photos[3].x) < pw * 0.7) continue
      addLantern(lx, tree.cy + tree.ry * (0.55 + (i % 2) * 0.2), m * 0.04)
    }
    bank.forEach(b => addLantern(b.x, b.y, m * 0.042, b.c))
    addLantern(sternX - m * 0.026, sternTop + 2 * u, m * 0.036)
    return L
  }

  function roofPoly(x, top, w, rh, ov) {
    ctx.beginPath()
    ctx.moveTo(x - ov, top + 1); ctx.lineTo(x + w + ov, top + 1)
    ctx.lineTo(x + w - w * 0.12, top - rh); ctx.lineTo(x + w * 0.12, top - rh)
    ctx.closePath()
  }

  function drawHouse(hs, hz) {
    const { x, w, h, top, color } = hs
    const g = ctx.createLinearGradient(0, top, 0, hz)
    g.addColorStop(0, shade(color, -0.45)); g.addColorStop(0.1, shade(color, -0.1)); g.addColorStop(0.5, color); g.addColorStop(1, shade(color, -0.25))
    ctx.fillStyle = g; ctx.fillRect(x, top, w, h)
    for (let i = 0; i < 8; i++) {
      const bx = x + R() * w, by = top + R() * h, br = (8 + R() * 26) * u
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, br)
      rg.addColorStop(0, 'rgba(60,35,10,0.16)'); rg.addColorStop(1, 'rgba(60,35,10,0)')
      ctx.fillStyle = rg; ctx.fillRect(bx - br, by - br, br * 2, br * 2)
    }
    ctx.fillStyle = 'rgba(50,30,10,0.12)'
    for (let i = 0; i < 6; i++) ctx.fillRect(x + R() * w, top, (1 + R() * 2) * u, h * (0.1 + R() * 0.3))
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(x, top, 3 * u, h); ctx.fillRect(x + w - 3 * u, top, 3 * u, h)

    const midY = hs.two ? top + h * 0.46 : top + h * 0.28
    if (hs.two) {
      if (hs.poster) {
        drawWindow(x + w * 0.6, top + h * 0.1, w * 0.26, h * 0.26)
        hs.posterAt = { x: x + w * 0.29, y: top + h * 0.24 }
      } else if (w > m * 0.31) {
        drawWindow(x + w * 0.14, top + h * 0.1, w * 0.26, h * 0.26)
        drawWindow(x + w * 0.6, top + h * 0.1, w * 0.26, h * 0.26)
      } else {
        drawWindow(x + w * 0.33, top + h * 0.1, w * 0.34, h * 0.26)
      }
      drawAwning(x - w * 0.03, midY, w * 1.06, h * 0.08)
    }
    const dw = w * 0.64, dh = (hz - midY) * 0.8, dx = x + (w - dw) / 2, dy = hz - dh
    drawDoors(dx, dy, dw, dh)
    hs.door = { x: dx, y: dy, w: dw, h: dh }
    drawRoof(x, top, w)
    hs.eave.push({ x: x + w * 0.22, y: top + 3 * u }, { x: x + w * 0.78, y: top + 3 * u })
    if (hs.bougain) drawBougain(hs.bLeft ? x + w * 0.04 : x + w * 0.96, top - 2 * u, w * 0.3, h * (0.35 + R() * 0.3))
  }

  function drawWindow(wx, wy, ww, wh) {
    ctx.fillStyle = '#3a2314'; ctx.fillRect(wx - 3 * u, wy - 3 * u, ww + 6 * u, wh + 6 * u)
    ctx.fillStyle = '#140c08'; ctx.fillRect(wx, wy, ww, wh)
    const sw = ww / 2
    for (let k = 0; k < 2; k++) {
      const sx = wx + k * sw
      ctx.fillStyle = '#2f6b5e'; ctx.fillRect(sx + u, wy + u, sw - 2 * u, wh - 2 * u)
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      for (let yy = wy + 4 * u; yy < wy + wh - 2 * u; yy += 4 * u) ctx.fillRect(sx + 3 * u, yy, sw - 6 * u, 1.4 * u)
    }
    ctx.fillStyle = '#4a2c18'; ctx.fillRect(wx - 5 * u, wy + wh + 2 * u, ww + 10 * u, 3 * u)
  }

  function drawAwning(ax, ay, aw, ah) {
    ctx.beginPath()
    ctx.moveTo(ax, ay); ctx.lineTo(ax + aw, ay); ctx.lineTo(ax + aw - aw * 0.03, ay - ah); ctx.lineTo(ax + aw * 0.03, ay - ah)
    ctx.closePath()
    const g = ctx.createLinearGradient(0, ay - ah, 0, ay)
    g.addColorStop(0, '#4d1f14'); g.addColorStop(1, '#7a3322')
    ctx.fillStyle = g; ctx.fill()
    ctx.save(); ctx.clip()
    ctx.strokeStyle = 'rgba(30,10,5,.45)'; ctx.lineWidth = 1.3 * u
    for (let lx = ax; lx < ax + aw; lx += 5 * u) { ctx.beginPath(); ctx.moveTo(lx, ay); ctx.lineTo(lx, ay - ah); ctx.stroke() }
    ctx.restore()
    const sg = ctx.createLinearGradient(0, ay, 0, ay + 10 * u)
    sg.addColorStop(0, 'rgba(0,0,0,.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = sg; ctx.fillRect(ax + aw * 0.03, ay, aw * 0.94, 10 * u)
    ctx.fillStyle = '#3a1d10'; ctx.fillRect(ax, ay - u, aw, 2.5 * u)
  }

  function drawDoors(dx, dy, dw, dh) {
    ctx.fillStyle = '#2e1a0e'; ctx.fillRect(dx - 4 * u, dy - 4 * u, dw + 8 * u, dh + 4 * u)
    const g = ctx.createLinearGradient(dx, 0, dx + dw, 0)
    g.addColorStop(0, '#5a3520'); g.addColorStop(0.5, '#6b4128'); g.addColorStop(1, '#4e2d1a')
    ctx.fillStyle = g; ctx.fillRect(dx, dy, dw, dh)
    ctx.fillStyle = 'rgba(20,10,5,.5)'
    for (let i = 1; i < 6; i++) ctx.fillRect(dx + dw * i / 6 - 0.7 * u, dy, 1.4 * u, dh)
    ctx.fillStyle = '#24140a'; ctx.fillRect(dx, dy, dw, dh * 0.16)
    ctx.strokeStyle = 'rgba(160,110,60,.35)'; ctx.lineWidth = u
    for (let lx = dx + 5 * u; lx < dx + dw; lx += 7 * u) { ctx.beginPath(); ctx.moveTo(lx, dy); ctx.lineTo(lx, dy + dh * 0.16); ctx.stroke() }
    ctx.fillStyle = '#1a0e06'; ctx.fillRect(dx + dw / 2 - u, dy + dh * 0.16, 2 * u, dh * 0.84)
    // "door eyes" (mắt cửa) above the entrance
    const er = Math.max(2.5, dw * 0.045)
    for (const ex of [dx + dw * 0.36, dx + dw * 0.64]) {
      ctx.fillStyle = '#1c0f07'; circle(ex, dy - er * 1.9, er)
      ctx.strokeStyle = '#a07a3c'; ctx.lineWidth = 1.2 * u; ctx.stroke()
      ctx.fillStyle = '#c9a15a'; circle(ex, dy - er * 1.9, er * 0.35)
    }
  }

  function drawRoof(x, top, w) {
    const ov = w * 0.07, rh = w * 0.2, inset = w * 0.1
    ctx.beginPath()
    ctx.moveTo(x - ov, top + 2 * u); ctx.lineTo(x + w + ov, top + 2 * u)
    ctx.lineTo(x + w - inset, top - rh); ctx.lineTo(x + inset, top - rh)
    ctx.closePath()
    const g = ctx.createLinearGradient(0, top - rh, 0, top)
    g.addColorStop(0, '#4a1c13'); g.addColorStop(1, '#7c3423')
    ctx.fillStyle = g; ctx.fill()
    ctx.save(); ctx.clip()
    ctx.strokeStyle = 'rgba(25,8,4,.5)'; ctx.lineWidth = 1.6 * u
    const cx = x + w / 2
    for (let lx = x - ov; lx <= x + w + ov; lx += 5.5 * u) {
      ctx.beginPath(); ctx.moveTo(lx, top + 2 * u); ctx.lineTo(cx + (lx - cx) * 0.82, top - rh); ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(255,200,150,.07)'; ctx.lineWidth = u
    for (let yy = top - rh + 6 * u; yy < top; yy += 6 * u) { ctx.beginPath(); ctx.moveTo(x - ov, yy); ctx.lineTo(x + w + ov, yy); ctx.stroke() }
    ctx.restore()
    ctx.fillStyle = '#3d160e'; ctx.fillRect(x + inset - 3 * u, top - rh - 4 * u, w - inset * 2 + 6 * u, 5 * u)
    ctx.strokeStyle = '#3d160e'; ctx.lineWidth = 3 * u; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(x + inset - 2 * u, top - rh - 2 * u); ctx.quadraticCurveTo(x + inset - 8 * u, top - rh - 3 * u, x + inset - 9 * u, top - rh - 9 * u); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x + w - inset + 2 * u, top - rh - 2 * u); ctx.quadraticCurveTo(x + w - inset + 8 * u, top - rh - 3 * u, x + w - inset + 9 * u, top - rh - 9 * u); ctx.stroke()
    ctx.fillStyle = '#2c0f08'; ctx.fillRect(x - ov, top, w + ov * 2, 3 * u)
    const sg = ctx.createLinearGradient(0, top + 3 * u, 0, top + 16 * u)
    sg.addColorStop(0, 'rgba(0,0,0,.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = sg; ctx.fillRect(x, top + 3 * u, w, 13 * u)
  }

  function drawBougain(ax, ay, bw, bh) {
    for (let i = 0; i < 110; i++) {
      const t = Math.pow(R(), 0.8)
      const spread = bw * (1 - t * 0.7) * 0.5
      ctx.fillStyle = R() < 0.3 ? pick(LEAF) : pick(BOUGAIN)
      circle(ax + (R() - 0.5) * 2 * spread, ay + t * bh, (1.8 + R() * 3) * u)
    }
  }

  function drawTree(t, hz) {
    ctx.fillStyle = '#261810'
    ctx.beginPath()
    ctx.moveTo(t.x - m * 0.03, hz)
    ctx.bezierCurveTo(t.x - m * 0.02, hz - (hz - t.cy) * 0.4, t.cx - m * 0.03, t.cy + t.ry * 0.8, t.cx - m * 0.01, t.cy + t.ry * 0.2)
    ctx.lineTo(t.cx + m * 0.02, t.cy + t.ry * 0.2)
    ctx.bezierCurveTo(t.cx + m * 0.01, t.cy + t.ry * 0.8, t.x + m * 0.015, hz - (hz - t.cy) * 0.4, t.x + m * 0.03, hz)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#261810'; ctx.lineCap = 'round'
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.5
      ctx.lineWidth = (6 - i * 0.5) * u
      ctx.beginPath()
      ctx.moveTo(t.cx, t.cy + t.ry * 0.2)
      ctx.quadraticCurveTo(t.cx + Math.cos(a) * t.rx * 0.3, t.cy + Math.sin(a) * t.ry * 0.2, t.cx + Math.cos(a) * t.rx * 0.7, t.cy + Math.sin(a) * t.ry * 0.6)
      ctx.stroke()
    }
    for (let i = 0; i < 70; i++) {
      const a = R() * TAU, d = Math.sqrt(R())
      ctx.fillStyle = pick(LEAF)
      circle(t.cx + Math.cos(a) * d * t.rx, t.cy + Math.sin(a) * d * t.ry, m * (0.025 + R() * 0.035))
    }
    for (let i = 0; i < 260; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * 1.02
      let py = t.cy + Math.sin(a) * d * t.ry
      if (R() < 0.25) py += R() * t.ry * 0.8
      ctx.globalAlpha = 0.85 + R() * 0.15
      ctx.fillStyle = pick(BOUGAIN)
      circle(t.cx + Math.cos(a) * d * t.rx, py, (1.6 + R() * 2.6) * u)
    }
    ctx.globalAlpha = 1
  }

  function drawPole(px, top, hz) {
    const g = ctx.createLinearGradient(px - 3 * u, 0, px + 3 * u, 0)
    g.addColorStop(0, '#5e4220'); g.addColorStop(0.5, '#a88450'); g.addColorStop(1, '#5a3e1c')
    ctx.fillStyle = g; ctx.fillRect(px - 2.5 * u, top, 5 * u, hz - top)
    ctx.fillStyle = 'rgba(40,25,10,.8)'
    for (let y = top + 30 * u; y < hz; y += 34 * u) ctx.fillRect(px - 3 * u, y, 6 * u, 1.6 * u)
    ctx.fillStyle = '#c0283a'
    ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px + 18 * u, top + 6 * u); ctx.lineTo(px, top + 12 * u); ctx.closePath(); ctx.fill()
  }

  // a thin iron lantern post with an arm to hang from
  function drawPost(px, top, base, arm) {
    ctx.strokeStyle = '#1b120c'; ctx.lineWidth = Math.max(1.5, 2.4 * u); ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(px, base); ctx.lineTo(px, top); ctx.lineTo(px + arm, top); ctx.stroke()
    ctx.fillStyle = '#1b120c'
    ctx.fillRect(px - 3 * u, base - 4 * u, 6 * u, 5 * u)
    circle(px, top, 2 * u)
  }

  // a broken streak of lantern colour on the water
  function reflectLight(x, color, riverTop, H) {
    const len = (H - riverTop) * 0.34
    ctx.fillStyle = color
    for (let i = 0; i < 14; i++) {
      const k = i / 14, w = (12 - i * 0.55) * u * (0.6 + R() * 0.8)
      ctx.globalAlpha = 0.5 * (1 - k)
      ctx.fillRect(x - w / 2 + (R() - 0.5) * 5 * u, riverTop + 3 * u + k * len, w, Math.max(1.2, 2 * u))
    }
    ctx.globalAlpha = 1
  }

  function drawString(s) {
    ctx.strokeStyle = '#1a1210'; ctx.lineWidth = Math.max(1, 1.4 * u)
    ctx.beginPath()
    for (let i = 0; i <= 40; i++) { const p = strAt(s, i / 40); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y) }
    ctx.stroke()
  }

  // mirror everything above the bank into the water
  function reflect(hz, riverTop, H, dpr) {
    const srcH = Math.min(hz, (H - riverTop) / 0.6)
    const tmp = document.createElement('canvas')
    tmp.width = cv.width; tmp.height = Math.max(1, Math.round(srcH * dpr))
    tmp.getContext('2d').drawImage(cv, 0, Math.round((hz - srcH) * dpr), cv.width, tmp.height, 0, 0, cv.width, tmp.height)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 0.26
    ctx.translate(0, riverTop * dpr)
    ctx.scale(1, -0.6)
    ctx.drawImage(tmp, 0, -tmp.height)
    ctx.restore()
  }

  function drawBoat(bx, by, bl) {
    const hh = bl * 0.12
    const hull = () => {
      ctx.beginPath()
      ctx.moveTo(bx - bl / 2, by - hh * 0.9)
      ctx.quadraticCurveTo(bx - bl * 0.34, by + hh * 1.15, bx, by + hh)
      ctx.quadraticCurveTo(bx + bl * 0.34, by + hh * 1.05, bx + bl / 2, by - hh * 1.25)
      ctx.quadraticCurveTo(bx + bl * 0.22, by - hh * 0.05, bx, by)
      ctx.quadraticCurveTo(bx - bl * 0.25, by - hh * 0.02, bx - bl / 2, by - hh * 0.9)
      ctx.closePath()
    }
    ctx.save()
    ctx.translate(0, 2 * (by + hh * 0.9)); ctx.scale(1, -1)
    hull(); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill()
    ctx.restore()
    hull()
    const g = ctx.createLinearGradient(0, by - hh, 0, by + hh)
    g.addColorStop(0, '#7a4a2a'); g.addColorStop(1, '#2a170c')
    ctx.fillStyle = g; ctx.fill()
    ctx.save(); hull(); ctx.clip()
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = u
    for (let k = 1; k < 4; k++) {
      ctx.beginPath()
      ctx.moveTo(bx - bl / 2, by - hh * 0.9 + k * hh * 0.5)
      ctx.quadraticCurveTo(bx, by + k * hh * 0.45 - hh * 0.3, bx + bl / 2, by - hh * 1.25 + k * hh * 0.5)
      ctx.stroke()
    }
    ctx.restore()
    const gun = () => {
      ctx.beginPath()
      ctx.moveTo(bx + bl / 2, by - hh * 1.25)
      ctx.quadraticCurveTo(bx + bl * 0.22, by - hh * 0.05, bx, by)
      ctx.quadraticCurveTo(bx - bl * 0.25, by - hh * 0.02, bx - bl / 2, by - hh * 0.9)
    }
    ctx.strokeStyle = '#b23a2e'; ctx.lineWidth = 3 * u; gun(); ctx.stroke()
    ctx.save(); ctx.translate(0, 3.5 * u); ctx.strokeStyle = '#2e7d6f'; ctx.lineWidth = 1.5 * u; gun(); ctx.stroke(); ctx.restore()
    const ex = bx + bl * 0.36, ey = by - hh * 0.28
    ctx.fillStyle = '#f3ead6'; ctx.beginPath(); ctx.ellipse(ex, ey, 7 * u, 4 * u, -0.15, 0, TAU); ctx.fill()
    ctx.strokeStyle = '#b23a2e'; ctx.lineWidth = 1.4 * u; ctx.stroke()
    ctx.fillStyle = '#111'; circle(ex + u, ey, 2.4 * u)

    // y of the gunwale (stern half) for an x, sampled from the quadratic
    const gunY = qx => {
      let best = by, bd = Infinity
      for (let i = 0; i <= 60; i++) {
        const t = i / 60, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t
        const x = a * bx + b * (bx - bl * 0.25) + c * (bx - bl / 2)
        const y = a * by + b * (by - hh * 0.02) + c * (by - hh * 0.9)
        if (Math.abs(x - qx) < bd) { bd = Math.abs(x - qx); best = y }
      }
      return best
    }
    return { x: bx, y: by, len: bl, gunY }
  }

  return { build }
})()
