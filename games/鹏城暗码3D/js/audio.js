/* 鹏城暗码 3D · 程序化音频（WebAudio，无外部音频文件） */
(function () {
  'use strict';

  var AU = window.AU = {
    ctx: null, master: null, busAmb: null, ready: false, muted: false,
    volume: 0.75, ambNodes: [], ambType: '', fear: 0
  };

  function ctx() {
    if (!AU.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      AU.ctx = new AC();
      AU.master = AU.ctx.createGain();
      AU.master.gain.value = AU.volume;
      AU.master.connect(AU.ctx.destination);
      AU.busAmb = AU.ctx.createGain();
      AU.busAmb.gain.value = 0.55;
      AU.busAmb.connect(AU.master);
    }
    return AU.ctx;
  }

  AU.init = function () {
    var c = ctx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    AU.ready = true;
  };

  AU.setVolume = function (v) {
    AU.volume = v;
    if (AU.master) AU.master.gain.value = v;
  };

  function now() { return AU.ctx ? AU.ctx.currentTime : 0; }

  function env(g, t0, a, d, peak) {
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  function noiseBuffer(sec) {
    var c = ctx();
    var len = Math.floor(c.sampleRate * sec);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  AU.noise = function (dur, gain, freq, type, q) {
    var c = ctx(); if (!c) return;
    var src = c.createBufferSource();
    src.buffer = noiseBuffer(Math.max(0.05, dur));
    var f = c.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = freq || 900;
    f.Q.value = q || 1;
    var g = c.createGain();
    var t0 = now();
    env(g, t0, 0.008, dur, gain || 0.2);
    src.connect(f); f.connect(g); g.connect(AU.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  };

  AU.tone = function (freq, dur, gain, type, slideTo) {
    var c = ctx(); if (!c) return;
    var o = c.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now() + dur);
    var g = c.createGain();
    var t0 = now();
    env(g, t0, 0.01, dur, gain || 0.15);
    o.connect(g); g.connect(AU.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  };

  AU.footstep = function (run, surface) {
    var c = ctx(); if (!c) return;
    var t0 = now();
    var src = c.createBufferSource();
    src.buffer = noiseBuffer(0.12);
    var f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = surface === 'water' ? 1800 : (run ? 1200 : 850);
    f.Q.value = 0.7;
    var g = c.createGain();
    env(g, t0, 0.004, run ? 0.10 : 0.13, run ? 0.13 : 0.075);
    src.connect(f); f.connect(g); g.connect(AU.master);
    src.start(t0); src.stop(t0 + 0.16);
    // 低频脚步冲击
    var o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(run ? 92 : 74, t0);
    o.frequency.exponentialRampToValueAtTime(42, t0 + 0.10);
    var og = c.createGain();
    env(og, t0, 0.005, 0.10, run ? 0.09 : 0.05);
    o.connect(og); og.connect(AU.master);
    o.start(t0); o.stop(t0 + 0.16);
  };

  AU.door = function (heavy) {
    AU.noise(heavy ? 0.9 : 0.5, heavy ? 0.16 : 0.08, heavy ? 420 : 900, 'lowpass');
    AU.tone(heavy ? 62 : 110, 0.5, 0.05, 'sawtooth', 40);
    setTimeout(function () { AU.tone(140, 0.12, 0.06, 'square', 90); }, 260);
  };

  AU.locker = function () {
    AU.noise(0.22, 0.12, 2600, 'bandpass', 3);
    setTimeout(function () { AU.noise(0.16, 0.07, 1500, 'bandpass', 2); }, 180);
  };

  AU.glass = function () {
    AU.noise(0.55, 0.2, 4200, 'highpass');
    for (var i = 0; i < 6; i++) {
      setTimeout(function () { AU.tone(1600 + Math.random() * 2600, 0.18, 0.05, 'triangle'); }, i * 40 + Math.random() * 40);
    }
  };

  AU.bottle = function () {
    AU.noise(0.18, 0.25, 3200, 'highpass');
    setTimeout(function () { AU.tone(780, 0.25, 0.06, 'triangle', 300); }, 90);
  };

  AU.beep = function (freq, dur, gain) {
    AU.tone(freq || 880, dur || 0.08, gain || 0.06, 'square');
  };

  AU.error = function () {
    AU.tone(220, 0.14, 0.09, 'square');
    setTimeout(function () { AU.tone(150, 0.22, 0.09, 'square'); }, 140);
  };

  AU.success = function () {
    AU.tone(660, 0.1, 0.05, 'sine');
    setTimeout(function () { AU.tone(990, 0.18, 0.05, 'sine'); }, 110);
  };

  AU.stinger = function () {
    var c = ctx(); if (!c) return;
    var t0 = now();
    var src = c.createBufferSource();
    src.buffer = noiseBuffer(1.4);
    var f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.setValueAtTime(1800, t0);
    f.frequency.exponentialRampToValueAtTime(200, t0 + 1.2);
    f.Q.value = 1.2;
    var g = c.createGain();
    env(g, t0, 0.01, 1.3, 0.22);
    src.connect(f); f.connect(g); g.connect(AU.master);
    src.start(t0); src.stop(t0 + 1.5);
    AU.tone(120, 1.1, 0.12, 'sawtooth', 32);
  };

  AU.heartbeat = function (strong) {
    AU.tone(strong ? 52 : 46, 0.16, strong ? 0.11 : 0.07, 'sine', 30);
    setTimeout(function () { AU.tone(strong ? 48 : 40, 0.20, strong ? 0.08 : 0.05, 'sine', 26); }, 150);
  };

  AU.alarm = function () {
    var c = ctx(); if (!c) return;
    for (var i = 0; i < 4; i++) {
      setTimeout((function (k) {
        return function () { AU.tone(k % 2 ? 620 : 880, 0.22, 0.07, 'square'); };
      })(i), i * 260);
    }
  };

  AU.servo = function (near) {
    AU.tone(near ? 340 : 260, 0.14, 0.035, 'sawtooth', near ? 380 : 300);
    AU.noise(0.12, 0.035, 1400, 'bandpass', 2);
  };

  AU.static = function () { AU.noise(0.35, 0.09, 2600, 'highpass'); };

  AU.thunder = function () {
    AU.noise(2.2, 0.2, 260, 'lowpass');
    setTimeout(function () { AU.noise(1.4, 0.12, 180, 'lowpass'); }, 400);
  };

  /* ---------- 环境音：按场景切换 ---------- */
  AU.stopAmbience = function () {
    AU.ambNodes.forEach(function (n) {
      try { if (n.stop) n.stop(); else if (n.gain) n.gain.disconnect(); } catch (e) {}
      try { n.disconnect && n.disconnect(); } catch (e) {}
    });
    AU.ambNodes = [];
    AU.ambType = '';
  };

  AU.setAmbience = function (type) {
    var c = ctx(); if (!c) return;
    if (AU.ambType === type) return;
    AU.stopAmbience();
    AU.ambType = type;
    var t0 = now();
    var bus = AU.busAmb;

    function drone(freq, gain, detune) {
      var o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      o.detune.value = detune || 0;
      var g = c.createGain();
      g.gain.value = gain;
      o.connect(g); g.connect(bus);
      o.start(t0);
      AU.ambNodes.push(o, g);
    }

    function air(gain, freq) {
      var src = c.createBufferSource();
      src.buffer = noiseBuffer(2);
      src.loop = true;
      var f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = freq || 700;
      var g = c.createGain(); g.gain.value = gain;
      src.connect(f); f.connect(g); g.connect(bus);
      src.start(t0);
      AU.ambNodes.push(src, g, f);
    }

    if (type === 'classroom') {
      drone(56, 0.05); drone(112, 0.02, 7);
      air(0.05, 520);
    } else if (type === 'corridor') {
      drone(48, 0.06); drone(96, 0.025, 5);
      air(0.07, 420);
    } else if (type === 'bathroom') {
      drone(60, 0.04); air(0.06, 1400);
      // 滴水
      var drop = function () {
        AU.tone(1250 + Math.random() * 500, 0.18, 0.03, 'sine', 700);
        AU.ambNodes.push({ timer: setTimeout(drop, 2200 + Math.random() * 4200) });
      };
      drop();
    } else if (type === 'archive') {
      drone(42, 0.06); air(0.05, 380);
    } else if (type === 'server') {
      drone(38, 0.07); drone(76, 0.03, 9);
      air(0.09, 900);
      var fan = function () {
        AU.noise(0.25, 0.03, 2400, 'bandpass', 1.4);
        AU.ambNodes.push({ timer: setTimeout(fan, 900 + Math.random() * 900) });
      };
      fan();
    } else if (type === 'core') {
      drone(34, 0.1); drone(68, 0.04, 3);
      air(0.05, 300);
    } else if (type === 'dawn') {
      drone(196, 0.02); drone(294, 0.012, 6);
      air(0.04, 1500);
    }
    // 清理定时器
    AU.ambNodes.forEach(function (n) { if (n && n.timer) n.__timer = n.timer; });
  };

  AU.stopAll = function () {
    AU.stopAmbience();
    if (AU.master) AU.master.gain.value = AU.volume;
  };
})();
