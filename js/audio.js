/* Tiny synthesized sound kit. No audio files: every sparkle, chime and blip is generated
   with Web Audio, so the page stays light and works offline. */
const Sound = (() => {
  let ctx = null, master = null, wet = null, noise = null
  let muted = false
  let wind = null, music = null, fire = null

  const midi = n => 440 * Math.pow(2, (n - 69) / 12)
  const PENTA = [0, 2, 4, 7, 9]
  const penta = (base, step) => base + PENTA[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5)
  const rnd = (a, b) => a + Math.random() * (b - a)

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return }
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4
    comp.attack.value = 0.004; comp.release.value = 0.2
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.9
    master.connect(comp); comp.connect(ctx.destination)

    const conv = ctx.createConvolver()
    conv.buffer = impulse(3.2, 2.6)
    wet = ctx.createGain(); wet.gain.value = 0.5
    wet.connect(conv); conv.connect(master)

    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1

    document.addEventListener('visibilitychange', () => {
      if (!ctx) return
      if (document.hidden) ctx.suspend(); else ctx.resume()
    })
  }

  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec)
    const b = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return b
  }

  const live = () => !!ctx && ctx.state === 'running'
  const now = () => ctx.currentTime

  // connect a voice to the master bus with a pan and a reverb send
  function route(node, pan = 0, rev = 0.25, bus = master) {
    let out = node
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner()
      p.pan.value = Math.max(-1, Math.min(1, pan))
      node.connect(p); out = p
    }
    out.connect(bus)
    if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; out.connect(s); s.connect(wet) }
  }

  function env(g, t, attack, peak, dur) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  }

  function tone({ freq, type = 'sine', t = now(), attack = 0.005, dur = 0.5, vol = 0.1, pan = 0, rev = 0.25, slideTo = 0, slideTime = 0.1, bus }) {
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + slideTime)
    env(g, t, attack, vol, dur)
    o.connect(g); route(g, pan, rev, bus)
    o.start(t); o.stop(t + dur + 0.05)
  }

  function bell(freq, t = now(), vol = 0.08, dur = 1.4, pan = 0, rev = 0.35, bus) {
    tone({ freq, t, vol, dur, pan, rev, bus })
    tone({ freq: freq * 2, t, vol: vol * 0.3, dur: dur * 0.5, pan, rev, bus })
    tone({ freq: freq * 3.01, t, vol: vol * 0.1, dur: dur * 0.25, pan, rev, bus })
  }

  function hiss({ t = now(), dur = 0.03, vol = 0.1, type = 'highpass', freq = 2000, q = 0.7, pan = 0, rev = 0.1 }) {
    const s = ctx.createBufferSource(); s.buffer = noise
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q
    const g = ctx.createGain(); env(g, t, 0.002, vol, dur)
    s.connect(f); f.connect(g); route(g, pan, rev)
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02)
  }

  function blipAt(t, pitch = 1, vol = 0.045) {
    const f = 520 * pitch * rnd(0.94, 1.06)
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain()
    o.type = 'square'
    o.frequency.setValueAtTime(f, t)
    o.frequency.exponentialRampToValueAtTime(f * 1.08, t + 0.05)
    lp.type = 'lowpass'; lp.frequency.value = 1700
    env(g, t, 0.004, vol, 0.075)
    o.connect(lp); lp.connect(g); route(g, 0, 0.12)
    o.start(t); o.stop(t + 0.1)
  }

  // one pop of burning wood: mostly bright snaps, sometimes a deeper knock
  function crackle(t, level) {
    const bright = Math.random() < 0.72
    hiss({
      t, dur: rnd(0.004, 0.02), vol: rnd(0.03, 0.12) * (0.4 + level),
      type: 'bandpass', freq: bright ? rnd(1800, 6000) : rnd(380, 1100), q: rnd(1.2, 4),
      pan: rnd(-0.5, 0.5), rev: 0.08,
    })
  }

  const api = {
    unlock,
    get muted() { return muted },
    setMuted(m) {
      muted = m
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, now(), 0.05)
    },

    // each tap on the ember: a puff of flame catching (fwoomp) plus a spray of crackles
    tap(heat) {
      if (!live()) return
      const t = now()
      const s = ctx.createBufferSource(); s.buffer = noise
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.7
      f.frequency.setValueAtTime(220, t)
      f.frequency.exponentialRampToValueAtTime(900 + heat * 1100, t + 0.12)
      f.frequency.exponentialRampToValueAtTime(320, t + 0.45)
      const g = ctx.createGain(); env(g, t, 0.025, 0.14 + heat * 0.2, 0.5)
      s.connect(f); f.connect(g); route(g, rnd(-0.15, 0.15), 0.25)
      s.start(t, Math.random()); s.stop(t + 0.55)
      tone({ freq: 95, slideTo: 48, slideTime: 0.2, vol: 0.07 + heat * 0.1, dur: 0.28, rev: 0.1 })
      for (let i = 0; i < 3 + heat * 8; i++) crackle(t + Math.random() * 0.3, 0.4 + heat)
    },

    // a burning bed under the taps: low roar + random crackles, louder as the heat rises
    fireStart() {
      if (!live() || fire) return
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = 0.4
      const flick = ctx.createOscillator(); flick.frequency.value = 4.7
      const flickAmt = ctx.createGain(); flickAmt.gain.value = 220
      flick.connect(flickAmt); flickAmt.connect(lp.frequency)
      const g = ctx.createGain(); g.gain.value = 0.0001
      s.connect(hp); hp.connect(lp); lp.connect(g); route(g, 0, 0.15)
      s.start(); flick.start()
      fire = { s, flick, g, level: 0, timer: 0 }
      const tick = () => {
        if (!fire) return
        if (ctx.state === 'running' && Math.random() < 0.15 + fire.level * 0.85) {
          const n = 1 + Math.floor(Math.random() * (1 + fire.level * 4))
          for (let i = 0; i < n; i++) crackle(now() + Math.random() * 0.08, fire.level)
        }
        fire.timer = setTimeout(tick, 60 + Math.random() * 90)
      }
      tick()
    },
    fireLevel(level) {
      if (!fire || Math.abs(level - fire.level) < 0.01) return
      fire.level = level
      fire.g.gain.setTargetAtTime(0.0001 + level * 0.15, now(), 0.15)
    },
    fireStop(fadeSec = 2) {
      if (!fire) return
      const f = fire; fire = null
      clearTimeout(f.timer)
      f.g.gain.setTargetAtTime(0.0001, now(), fadeSec / 3)
      setTimeout(() => { try { f.s.stop(); f.flick.stop() } catch (e) {} }, fadeSec * 1000 + 500)
    },

    ignite() {
      if (!live()) return
      const t = now()
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9
      f.frequency.setValueAtTime(250, t)
      f.frequency.exponentialRampToValueAtTime(2600, t + 0.45)
      f.frequency.exponentialRampToValueAtTime(500, t + 1.8)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.28)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9)
      s.connect(f); f.connect(g); route(g, 0, 0.4)
      s.start(t); s.stop(t + 2)
      tone({ freq: 120, slideTo: 42, slideTime: 0.6, vol: 0.35, dur: 0.9, rev: 0.2 })
      for (let i = 0; i < 18; i++) hiss({ t: t + 0.1 + Math.random() * 1.3, dur: 0.015, vol: rnd(0.05, 0.12), freq: 3000, pan: rnd(-0.6, 0.6) })
    },

    lanternLit() {
      if (!live()) return
      const t = now();
      [48, 55, 60, 64, 67, 72].forEach((n, i) => tone({ freq: midi(n), t: t + i * 0.07, attack: 0.5, dur: 3.4, vol: 0.045, rev: 0.6, pan: (i - 2.5) * 0.15 }))
      api.sparkle(12, 1.4)
    },

    sparkle(n = 8, spread = 0.7, base = 84) {
      if (!live()) return
      const t = now()
      for (let i = 0; i < n; i++) bell(midi(penta(base, Math.floor(Math.random() * 8))), t + Math.random() * spread, rnd(0.018, 0.04), rnd(0.5, 1.1), rnd(-0.7, 0.7), 0.5)
    },

    chime() {
      if (!live()) return
      const t = now();
      [0, 2, 4, 5, 7].forEach((s, i) => bell(midi(penta(72, s)), t + i * 0.075, 0.06, 1.6, (i - 2) * 0.2, 0.45))
      api.sparkle(8, 0.9)
    },

    softBell(step = 0) {
      if (!live()) return
      bell(midi(penta(79, step)), now(), 0.03, 1.4, rnd(-0.6, 0.6), 0.6)
    },

    pop() {
      if (!live()) return
      tone({ freq: 260, slideTo: 900, slideTime: 0.1, vol: 0.18, dur: 0.22, rev: 0.2 })
      tone({ freq: 520, slideTo: 1400, slideTime: 0.08, type: 'triangle', vol: 0.04, dur: 0.15 })
    },

    blip(pitch = 1) { if (live()) blipAt(now(), pitch) },

    giggle(vol = 0.04) {
      if (!live()) return
      const t = now();
      [1.3, 1.55, 1.4, 1.75].forEach((p, i) => blipAt(t + i * 0.075, p, vol))
    },

    ahem() {
      if (!live()) return
      const t = now()
      tone({ freq: 190, slideTo: 150, slideTime: 0.15, type: 'triangle', vol: 0.12, dur: 0.18, t })
      tone({ freq: 165, slideTo: 120, slideTime: 0.2, type: 'triangle', vol: 0.12, dur: 0.26, t: t + 0.22 })
      hiss({ t: t + 0.2, dur: 0.12, vol: 0.05, type: 'lowpass', freq: 900 })
    },

    firework(pan = 0) {
      if (!live()) return
      const t = now()
      tone({ freq: 500, slideTo: 1500, slideTime: 0.7, vol: 0.015, dur: 0.75, pan, rev: 0.3, t })
      const b = t + 0.75
      tone({ freq: 90, slideTo: 38, slideTime: 0.5, vol: 0.22, dur: 0.6, pan, rev: 0.4, t: b })
      hiss({ t: b, dur: 0.5, vol: 0.14, type: 'lowpass', freq: 1400, pan, rev: 0.4 })
      for (let i = 0; i < 22; i++) hiss({ t: b + 0.1 + Math.random() * 1.2, dur: 0.012, vol: rnd(0.03, 0.08), freq: 4000, pan: pan + rnd(-0.3, 0.3), rev: 0.3 })
    },

    celebrate() {
      if (!live()) return
      const t = now()
      const run = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      run.forEach((s, i) => bell(midi(penta(72, s)), t + i * 0.06, 0.045, 1.4, (i / run.length - 0.5) * 1.2, 0.5))
      api.sparkle(18, 2)
    },

    windStart() {
      if (!live() || wind) return
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.6
      const gust = ctx.createOscillator(); gust.frequency.value = 0.07
      const gustAmt = ctx.createGain(); gustAmt.gain.value = 220
      gust.connect(gustAmt); gustAmt.connect(lp.frequency)
      const body = ctx.createGain(); body.gain.value = 0.055
      const swell = ctx.createOscillator(); swell.frequency.value = 0.11
      const swellAmt = ctx.createGain(); swellAmt.gain.value = 0.025
      swell.connect(swellAmt); swellAmt.connect(body.gain)
      const fade = ctx.createGain()
      fade.gain.setValueAtTime(0.0001, now())
      fade.gain.exponentialRampToValueAtTime(1, now() + 4)
      s.connect(lp); lp.connect(body); body.connect(fade); fade.connect(master)
      s.start(); gust.start(); swell.start()
      wind = { s, gust, swell, fade }
    },

    windStop() {
      if (!wind) return
      const w = wind; wind = null
      w.fade.gain.setTargetAtTime(0.0001, now(), 0.9)
      setTimeout(() => { try { w.s.stop(); w.gust.stop(); w.swell.stop() } catch (e) {} }, 5000)
    },

    // gentle generative music box: I–vi–IV–V arpeggios with a pentatonic melody on top
    musicStart(level = 1) {
      if (!ctx || music) return
      const bus = ctx.createGain()
      bus.gain.setValueAtTime(0.0001, now())
      bus.gain.exponentialRampToValueAtTime(0.85 * level, now() + 4)
      bus.connect(master)
      const send = ctx.createGain(); send.gain.value = 0.55
      bus.connect(send); send.connect(wet)

      const chords = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]]
      const scale = [72, 74, 76, 79, 81, 84, 86, 88]
      const pattern = [0, 1, 2, 3, 2, 1]
      const eighth = 60 / 72 / 2
      let step = 0, mel = 2, next = now() + 0.4

      const note = (f, t, vol, dur) => {
        tone({ freq: f, t, vol, dur, attack: 0.004, rev: 0, bus })
        tone({ freq: f * 4, t, vol: vol * 0.12, dur: dur * 0.2, attack: 0.002, rev: 0, bus })
      }
      const tick = () => {
        if (!ctx || ctx.state !== 'running') { next = now() + 0.2; return }
        while (next < now() + 0.5) {
          const bar = Math.floor(step / 6) % 4, i = step % 6, ch = chords[bar]
          note(midi(ch[pattern[i]]), next, 0.028, 1.6)
          if (i === 0) note(midi(ch[0] - 12), next, 0.035, 2.6)
          if (i === 0 || i === 3) {
            if (i === 0) {
              // land on a chord tone near the current melody note
              let best = mel, bd = 99
              scale.forEach((n, k) => { if (ch.some(c => (n - c) % 12 === 0) && Math.abs(k - mel) < bd) { bd = Math.abs(k - mel); best = k } })
              mel = best
            } else {
              mel = Math.max(0, Math.min(scale.length - 1, mel + (Math.random() < 0.5 ? -1 : 1)))
            }
            if (Math.random() < 0.85) note(midi(scale[mel]), next, 0.045, 2)
          }
          step++; next += eighth
        }
      }
      const timer = setInterval(tick, 120)
      tick()
      music = { bus, timer }
    }
  }
  return api
})()
