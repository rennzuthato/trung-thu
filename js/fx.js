/* Particle layer: embers, sparkles, hearts and fireworks, drawn additively on one canvas
   that sits above everything else. */
const FX = (() => {
  const cv = document.getElementById('fx')
  const ctx = cv.getContext('2d')
  let W = 0, H = 0, dpr = 1
  const ps = []
  const MAX = 900
  const sprites = new Map()
  const TAU = Math.PI * 2
  const rnd = (a, b) => a + Math.random() * (b - a)
  const pick = a => a[Math.floor(Math.random() * a.length)]

  const GOLD = ['255,214,120', '255,236,180', '255,190,90']
  const EMBER = ['255,190,90', '255,140,50', '255,226,150', '255,110,40']
  const BLUE = ['120,210,255', '180,235,255', '90,180,240']
  const PINK = ['255,120,160', '255,170,200', '255,90,130']
  const FIRE = [['255,110,90', '255,200,160'], ['255,210,100', '255,245,200'], ['140,220,255', '220,245,255'], ['255,130,200', '255,210,235'], ['170,255,170', '230,255,220']]

  function resize(w, h, d) {
    W = w; H = h; dpr = Math.min(d, 1.5)
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
  }

  function sprite(c) {
    if (sprites.has(c)) return sprites.get(c)
    const s = document.createElement('canvas'); s.width = s.height = 64
    const g = s.getContext('2d')
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    rg.addColorStop(0, 'rgba(255,255,255,1)')
    rg.addColorStop(0.16, `rgba(${c},1)`)
    rg.addColorStop(0.42, `rgba(${c},.32)`)
    rg.addColorStop(1, `rgba(${c},0)`)
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64)
    sprites.set(c, s)
    return s
  }

  function add(p) {
    if (ps.length >= MAX) ps.shift()
    p.max = p.life
    ps.push(p)
    return p
  }

  function embers(x, y, n, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rnd(-1.1, 1.1)
      const sp = rnd(60, 260) * power
      add({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 140, drag: 0.985, life: rnd(0.45, 1.2), size: rnd(1, 2.4), c: pick(EMBER) })
    }
  }

  function burst(x, y, n, colors = EMBER, speed = 320) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = rnd(0.3, 1) * speed
      add({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60, drag: 0.975, life: rnd(0.6, 1.5), size: rnd(1.2, 2.8), c: pick(colors) })
    }
  }

  function sparkles(x, y, n, radius = 40, colors = GOLD) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * radius
      add({ type: 'star', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: rnd(-12, 12), vy: rnd(-40, -8), g: 0, drag: 0.98, life: rnd(0.6, 1.5), size: rnd(4, 11), c: pick(colors), spin: rnd(-2, 2), rot: Math.random() * TAU })
    }
  }

  function hearts(x, y, n) {
    for (let i = 0; i < n; i++) {
      add({ type: 'heart', x: x + rnd(-40, 40), y: y + rnd(-10, 20), vx: rnd(-40, 40), vy: rnd(-120, -50), g: -8, drag: 0.985, life: rnd(1.6, 2.6), size: rnd(8, 16), c: pick(PINK), rot: rnd(-0.4, 0.4), wob: Math.random() * TAU })
    }
  }

  function firework(x, y) {
    const [c1, c2] = pick(FIRE)
    const n = 70
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd(-0.05, 0.05), sp = rnd(170, 240)
      add({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 90, drag: 0.972, life: rnd(1.1, 1.8), size: rnd(1.4, 2.4), c: Math.random() < 0.7 ? c1 : c2, twinkle: Math.random() < 0.4 })
    }
    add({ type: 'ring', x, y, vx: 0, vy: 0, g: 0, drag: 1, life: 0.6, size: 20, c: c2 })
    add({ type: 'glow', x, y, vx: 0, vy: 0, g: 0, drag: 1, life: 0.5, size: 160, c: c1 })
  }

  function glint(x, y, colors = GOLD, size = 8) {
    add({ type: 'star', x, y, vx: 0, vy: -6, g: 0, drag: 1, life: 1.1, size, c: pick(colors), spin: 1.2, rot: 0 })
  }

  function flash(x, y, size, c = '255,214,140') {
    add({ type: 'glow', x, y, vx: 0, vy: 0, g: 0, drag: 1, life: 0.8, size, c })
  }

  // a firework shell climbing to (x, y) over `dur` seconds
  function rocket(x, y, fromY, dur) {
    add({ type: 'spark', x: x + rnd(-30, 30), y: fromY, vx: 0, vy: (y - fromY) / dur, g: 0, drag: 1, life: dur, size: 2, c: '255,224,170' })
  }

  let bloom = null
  function setBloom(b) { bloom = b }

  function update(dt) {
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.life -= dt
      if (p.life <= 0) { ps.splice(i, 1); continue }
      const k = Math.pow(p.drag, dt * 60)
      p.vx *= k; p.vy *= k
      p.vy += p.g * dt
      p.x += p.vx * dt; p.y += p.vy * dt
      if (p.spin) p.rot += p.spin * dt
    }
  }

  function starPath(x, y, r, rot) {
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = rot + (i * Math.PI) / 4
      const rr = i % 2 === 0 ? r : r * 0.22
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    }
    ctx.closePath()
  }

  function heartPath(x, y, s) {
    ctx.beginPath()
    ctx.moveTo(x, y + s * 0.3)
    ctx.bezierCurveTo(x, y, x - s * 0.5, y - s * 0.05, x - s * 0.5, y + s * 0.3)
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.62, x - s * 0.1, y + s * 0.8, x, y + s)
    ctx.bezierCurveTo(x + s * 0.1, y + s * 0.8, x + s * 0.5, y + s * 0.62, x + s * 0.5, y + s * 0.3)
    ctx.bezierCurveTo(x + s * 0.5, y - s * 0.05, x, y, x, y + s * 0.3)
    ctx.closePath()
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'lighter'

    if (bloom && bloom.a > 0.001) {
      const g = ctx.createRadialGradient(bloom.x, bloom.y, 0, bloom.x, bloom.y, bloom.r)
      g.addColorStop(0, `rgba(255,170,90,${0.22 * bloom.a})`)
      g.addColorStop(0.5, `rgba(255,120,50,${0.08 * bloom.a})`)
      g.addColorStop(1, 'rgba(255,100,40,0)')
      ctx.fillStyle = g
      ctx.fillRect(bloom.x - bloom.r, bloom.y - bloom.r, bloom.r * 2, bloom.r * 2)
    }

    let hasHearts = false
    for (const p of ps) {
      const k = p.life / p.max
      const a = Math.min(1, (1 - k) * 10) * Math.pow(k, 0.6)
      if (p.type === 'spark') {
        const tw = p.twinkle ? 0.5 + 0.5 * Math.sin(t * 40 + p.x) : 1
        ctx.strokeStyle = `rgba(${p.c},${a * tw})`
        ctx.lineWidth = p.size
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035)
        ctx.stroke()
        const s = p.size * 7
        ctx.globalAlpha = a * 0.55 * tw
        ctx.drawImage(sprite(p.c), p.x - s / 2, p.y - s / 2, s, s)
        ctx.globalAlpha = 1
      } else if (p.type === 'star') {
        const tw = 0.65 + 0.35 * Math.sin(t * 14 + p.rot * 5)
        const r = p.size * (0.4 + 0.6 * Math.sin(Math.PI * (1 - k))) * tw
        ctx.fillStyle = `rgba(${p.c},${a})`
        starPath(p.x, p.y, r, p.rot)
        ctx.fill()
        ctx.globalAlpha = a * 0.7
        ctx.drawImage(sprite(p.c), p.x - r * 1.6, p.y - r * 1.6, r * 3.2, r * 3.2)
        ctx.globalAlpha = 1
      } else if (p.type === 'ring') {
        ctx.strokeStyle = `rgba(${p.c},${a * 0.6})`
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (1 - k) * 90, 0, TAU); ctx.stroke()
      } else if (p.type === 'glow') {
        const s = p.size * (0.6 + (1 - k) * 0.6)
        ctx.globalAlpha = a * 0.5
        ctx.drawImage(sprite(p.c), p.x - s, p.y - s, s * 2, s * 2)
        ctx.globalAlpha = 1
      } else if (p.type === 'heart') hasHearts = true
    }

    if (hasHearts) {
      ctx.globalCompositeOperation = 'source-over'
      for (const p of ps) {
        if (p.type !== 'heart') continue
        const k = p.life / p.max
        const a = Math.min(1, (1 - k) * 8) * Math.min(1, k * 2.5)
        ctx.save()
        ctx.translate(p.x + Math.sin(t * 3 + p.wob) * 6, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = `rgba(${p.c},${a})`
        heartPath(0, -p.size / 2, p.size)
        ctx.fill()
        ctx.restore()
      }
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  return { resize, embers, burst, sparkles, hearts, firework, glint, flash, rocket, update, draw, setBloom, GOLD, BLUE, PINK, EMBER, get count() { return ps.length } }
})()
