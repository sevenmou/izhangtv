/* 鹏城暗码 3D · 程序化贴图（无外部素材，全部 Canvas 生成） */
(function () {
  'use strict';
  var THREE = window.THREE;

  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function grain(ctx, w, h, amt, seed, alpha) {
    var d = ctx.getImageData(0, 0, w, h), p = d.data, r = rng(seed || 7);
    for (var i = 0; i < p.length; i += 4) {
      var n = (r() - 0.5) * amt * 2;
      p[i] += n; p[i + 1] += n; p[i + 2] += n;
    }
    ctx.putImageData(d, 0, 0);
  }

  function blotches(ctx, w, h, colors, count, seed, maxR) {
    var r = rng(seed || 11);
    for (var i = 0; i < count; i++) {
      var x = r() * w, y = r() * h, rad = (0.05 + r() * 0.35) * (maxR || w);
      var g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      var c = colors[Math.floor(r() * colors.length)];
      g.addColorStop(0, c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    }
  }

  function streaks(ctx, w, h, color, count, seed, alpha) {
    var r = rng(seed || 13);
    for (var i = 0; i < count; i++) {
      var x = r() * w, len = h * (0.2 + r() * 0.8), wid = 1 + r() * 3;
      var g = ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, color.replace('%A', (alpha || 0.18).toFixed(2)));
      g.addColorStop(1, color.replace('%A', '0'));
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, wid, len);
    }
  }

  function scratches(ctx, w, h, color, count, seed) {
    var r = rng(seed || 17);
    ctx.strokeStyle = color;
    for (var i = 0; i < count; i++) {
      ctx.globalAlpha = 0.05 + r() * 0.18;
      ctx.lineWidth = 0.6 + r() * 1.2;
      var x = r() * w, y = r() * h, l = 6 + r() * (w * 0.25), a = r() * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function grid(ctx, w, h, n, color, lw) {
    ctx.strokeStyle = color; ctx.lineWidth = lw || 2;
    for (var i = 0; i <= n; i++) {
      var x = (w / n) * i, y = (h / n) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  function wrap(cv) {
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  var canvasCache = {};
  function cached(key, fn) { if (!canvasCache[key]) canvasCache[key] = fn(); return canvasCache[key]; }

  function wallCanvas() {
    return cached('wall', function () {
      var S = 256, c = mk(S), x = c.getContext('2d');
      x.fillStyle = '#5a615d'; x.fillRect(0, 0, S, S);
      blotches(x, S, S, ['rgba(30,36,32,0.20)', 'rgba(96,104,96,0.16)', 'rgba(20,24,22,0.12)'], 26, 3, S);
      streaks(x, S, S, 'rgba(22,28,26,%A)', 18, 5, 0.16);
      // 踢脚线附近的脏污
      var g = x.createLinearGradient(0, S * 0.72, 0, S);
      g.addColorStop(0, 'rgba(12,15,14,0)'); g.addColorStop(1, 'rgba(12,15,14,0.38)');
      x.fillStyle = g; x.fillRect(0, S * 0.72, S, S * 0.28);
      scratches(x, S, S, '#1b201d', 26, 21);
      grain(x, S, S, 9, 9);
      return c;
    });
  }

  function floorCanvas() {
    return cached('floor', function () {
      var S = 512, c = mk(S), x = c.getContext('2d');
      x.fillStyle = '#3c4142'; x.fillRect(0, 0, S, S);
      // 600x600 地砖
      var n = 2;
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        var g = x.createLinearGradient(i * S / n, j * S / n, (i + 1) * S / n, (j + 1) * S / n);
        g.addColorStop(0, 'rgba(72,78,79,0.35)'); g.addColorStop(1, 'rgba(48,52,53,0.35)');
        x.fillStyle = g; x.fillRect(i * S / n + 2, j * S / n + 2, S / n - 4, S / n - 4);
      }
      grid(x, S, S, n, 'rgba(22,26,27,0.85)', 3);
      blotches(x, S, S, ['rgba(20,24,25,0.20)', 'rgba(80,86,84,0.12)', 'rgba(60,50,40,0.10)'], 30, 8, S * 0.4);
      scratches(x, S, S, '#202526', 40, 31);
      grain(x, S, S, 7, 12);
      return c;
    });
  }

  function concreteCanvas() {
    return cached('concrete', function () {
      var S = 256, c = mk(S), x = c.getContext('2d');
      x.fillStyle = '#4a4d4c'; x.fillRect(0, 0, S, S);
      blotches(x, S, S, ['rgba(30,33,32,0.22)', 'rgba(92,95,90,0.14)'], 24, 14, S * 0.5);
      for (var i = 0; i < 14; i++) {
        x.strokeStyle = 'rgba(28,30,29,0.35)'; x.lineWidth = 1;
        x.beginPath();
        var y0 = Math.random() * S;
        x.moveTo(0, y0);
        for (var k = 1; k <= 6; k++) x.lineTo(k * S / 6, y0 + (Math.random() - 0.5) * 12);
        x.stroke();
      }
      grain(x, S, S, 10, 18);
      return c;
    });
  }

  function metalCanvas() {
    return cached('metal', function () {
      var S = 256, c = mk(S), x = c.getContext('2d');
      x.fillStyle = '#4c5356'; x.fillRect(0, 0, S, S);
      var r = rng(23);
      for (var i = 0; i < 160; i++) {
        x.strokeStyle = 'rgba(255,255,255,' + (0.02 + r() * 0.05) + ')';
        x.lineWidth = 0.6;
        var y = r() * S; x.beginPath(); x.moveTo(0, y); x.lineTo(S, y); x.stroke();
      }
      blotches(x, S, S, ['rgba(24,28,30,0.25)', 'rgba(120,104,80,0.10)'], 16, 25, S * 0.35);
      scratches(x, S, S, '#c9d2d2', 18, 26);
      grain(x, S, S, 6, 27);
      return c;
    });
  }

  function lockerCanvas() {
    return cached('locker', function () {
      var S = 256, c = mk(S), x = c.getContext('2d');
      x.fillStyle = '#4f5b58'; x.fillRect(0, 0, S, S);
      var g = x.createLinearGradient(0, 0, S, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(0.5, 'rgba(0,0,0,0.06)'); g.addColorStop(1, 'rgba(255,255,255,0.04)');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      blotches(x, S, S, ['rgba(74,52,32,0.16)', 'rgba(24,28,26,0.22)'], 22, 28, S * 0.3);
      // 通风格栅
      for (var i = 0; i < 8; i++) {
        x.fillStyle = 'rgba(10,13,13,0.55)';
        x.fillRect(S * 0.16, S * 0.08 + i * 8, S * 0.68, 3);
      }
      grain(x, S, S, 7, 29);
      return c;
    });
  }

  function woodCanvas() {
    return cached('wood', function () {
      var S = 256, c = mk(S), x = c.getContext('2d');
      x.fillStyle = '#503934'; x.fillRect(0, 0, S, S);
      var r = rng(33);
      for (var i = 0; i < 60; i++) {
        x.strokeStyle = 'rgba(' + (20 + r() * 30) + ',' + (12 + r() * 20) + ',' + (10 + r() * 16) + ',0.35)';
        x.lineWidth = 1 + r() * 3;
        var y = r() * S;
        x.beginPath(); x.moveTo(0, y);
        for (var k = 1; k <= 8; k++) x.lineTo(k * S / 8, y + Math.sin(k * 1.4 + r() * 3) * 4);
        x.stroke();
      }
      blotches(x, S, S, ['rgba(20,14,12,0.22)', 'rgba(120,92,70,0.10)'], 14, 36, S * 0.4);
      grain(x, S, S, 5, 37);
      return c;
    });
  }

  function ceilingCanvas() {
    return cached('ceiling', function () {
      var S = 256, c = mk(S), x = c.getContext('2d');
      x.fillStyle = '#8d8f88'; x.fillRect(0, 0, S, S);
      blotches(x, S, S, ['rgba(40,42,38,0.16)', 'rgba(120,118,108,0.12)', 'rgba(70,66,52,0.10)'], 20, 41, S * 0.5);
      grid(x, S, S, 2, 'rgba(58,60,56,0.55)', 2);
      grain(x, S, S, 8, 43);
      return c;
    });
  }

  function screenCanvas() {
    return cached('screen', function () {
      var S = 256, c = mk(S), x = c.getContext('2d');
      x.fillStyle = '#050d14'; x.fillRect(0, 0, S, S);
      var r = rng(47);
      x.font = '9px monospace';
      for (var i = 0; i < 22; i++) {
        var w = 30 + r() * 180;
        x.fillStyle = ['rgba(96,170,186,0.55)', 'rgba(70,120,140,0.4)', 'rgba(190,120,90,0.35)'][Math.floor(r() * 3)];
        x.fillRect(14, 14 + i * 10, w, 2.2);
      }
      x.fillStyle = 'rgba(120,200,210,0.75)';
      x.fillRect(14, S - 26, S - 28, 1);
      var g = x.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, 'rgba(140,200,220,0.10)'); g.addColorStop(0.6, 'rgba(20,40,60,0)');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      return c;
    });
  }

  function paperCanvas() {
    return cached('paper', function () {
      var S = 256, c = mk(S), x = c.getContext('2d');
      x.fillStyle = '#d7d0be'; x.fillRect(0, 0, S, S);
      var r = rng(53);
      x.fillStyle = 'rgba(40,44,44,0.55)';
      for (var i = 0; i < 18; i++) {
        var y = 16 + i * 12;
        x.fillRect(18, y, 30 + r() * (S - 50), 1.6);
      }
      x.fillStyle = 'rgba(120,70,50,0.25)'; x.fillRect(0, S * 0.82, S, 2);
      blotches(x, S, S, ['rgba(120,96,60,0.10)', 'rgba(60,52,40,0.08)'], 10, 55, S * 0.35);
      grain(x, S, S, 8, 57);
      return c;
    });
  }

  function mirrorCanvas() {
    return cached('mirror', function () {
      var S = 256, c = mk(S), x = c.getContext('2d');
      var g = x.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, '#6f7f84'); g.addColorStop(0.45, '#2e3a3e'); g.addColorStop(1, '#161d20');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      x.fillStyle = 'rgba(220,235,235,0.16)'; x.fillRect(S * 0.1, 0, S * 0.12, S);
      x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(S * 0.62, 0, S * 0.05, S);
      return c;
    });
  }

  function blackboardCanvas() {
    return cached('board', function () {
      var S = 256, c = mk(S), x = c.getContext('2d');
      x.fillStyle = '#1f2b28'; x.fillRect(0, 0, S, S);
      blotches(x, S, S, ['rgba(200,210,200,0.06)', 'rgba(10,14,12,0.20)'], 22, 61, S * 0.5);
      x.strokeStyle = 'rgba(220,225,215,0.10)'; x.lineWidth = 1;
      for (var i = 0; i < 6; i++) {
        x.beginPath();
        x.moveTo(20, 40 + i * 18);
        x.lineTo(20 + Math.random() * 170, 40 + i * 18 + Math.random() * 8);
        x.stroke();
      }
      grain(x, S, S, 6, 63);
      return c;
    });
  }

  function rustCanvas() {
    return cached('rust', function () {
      var S = 128, c = mk(S), x = c.getContext('2d');
      x.fillStyle = '#5b4636'; x.fillRect(0, 0, S, S);
      blotches(x, S, S, ['rgba(120,72,40,0.35)', 'rgba(40,28,20,0.35)', 'rgba(150,96,50,0.25)'], 30, 67, S * 0.3);
      grain(x, S, S, 14, 69);
      return c;
    });
  }

  function windowCanvas() {
    return cached('window', function () {
      var S = 256, c = mk(S), x = c.getContext('2d');
      var g = x.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, '#0a1119'); g.addColorStop(0.6, '#0c1620'); g.addColorStop(1, '#050a0e');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      var r = rng(71);
      for (var i = 0; i < 40; i++) {
        x.fillStyle = 'rgba(190,200,170,' + (0.06 + r() * 0.24) + ')';
        x.fillRect(r() * S, S * 0.55 + r() * S * 0.35, 1 + r() * 3, 1 + r() * 2);
      }
      // 雨痕
      for (var k = 0; k < 26; k++) {
        x.fillStyle = 'rgba(160,190,200,' + (0.03 + r() * 0.09) + ')';
        x.fillRect(r() * S, 0, 1, S * (0.2 + r() * 0.6));
      }
      return c;
    });
  }

  function signCanvas(text, opt) {
    opt = opt || {};
    var w = opt.w || 512, h = opt.h || 256;
    var c = mk(w, h), x = c.getContext('2d');
    x.fillStyle = opt.bg || '#1a252a'; x.fillRect(0, 0, w, h);
    if (opt.border !== false) {
      x.strokeStyle = opt.fg || '#c8d4d6'; x.lineWidth = 6;
      x.strokeRect(8, 8, w - 16, h - 16);
    }
    x.fillStyle = opt.fg || '#c8d4d6';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    var fs = opt.size || Math.floor(h * 0.42);
    x.font = (opt.weight || '600') + ' ' + fs + 'px "Microsoft YaHei","SimHei",sans-serif';
    x.fillText(text, w / 2, h / 2 + (opt.dy || 0));
    if (opt.sub) {
      x.font = '400 ' + Math.floor(fs * 0.42) + 'px "Microsoft YaHei",sans-serif';
      x.fillStyle = opt.subColor || 'rgba(200,212,214,0.7)';
      x.fillText(opt.sub, w / 2, h / 2 + fs * 0.72);
    }
    blotches(x, w, h, ['rgba(10,14,16,0.14)', 'rgba(140,120,80,0.08)'], 12, 73, w * 0.4);
    grain(x, w, h, 6, 75);
    return c;
  }

  function posterCanvas() {
    return cached('poster', function () {
      var w = 256, h = 384, c = mk(w, h), x = c.getContext('2d');
      x.fillStyle = '#cfc6ad'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#8d2b25'; x.fillRect(0, 0, w, 54);
      x.fillStyle = '#efe7d2';
      x.font = '700 28px "Microsoft YaHei",sans-serif';
      x.textAlign = 'center'; x.fillText('学情优化', w / 2, 37);
      x.fillStyle = '#3a3a34';
      x.font = '400 15px "Microsoft YaHei",sans-serif';
      var lines = ['一、按时完成补训任务', '二、不得离开工位', '三、异常滞留者', '   按流程物理归档'];
      for (var i = 0; i < lines.length; i++) x.fillText(lines[i], w / 2, 100 + i * 34);
      x.strokeStyle = '#8d2b25'; x.lineWidth = 3; x.strokeRect(12, 12, w - 24, h - 24);
      blotches(x, w, h, ['rgba(90,70,40,0.10)', 'rgba(40,40,30,0.10)'], 10, 77, w * 0.3);
      grain(x, w, h, 7, 79);
      return c;
    });
  }

  function foldersCanvas() {
    return cached('folders', function () {
      var w = 1024, h = 128, c = mk(w, h), x = c.getContext('2d');
      x.fillStyle = '#0b0c0c'; x.fillRect(0, 0, w, h);
      var cols = ['#cdbf9c', '#a97c5e', '#8d9a9e', '#b6ac8d', '#bda676', '#7f8b74', '#cbb897'];
      var px = 0, i = 0;
      while (px < w) {
        var wd = 12 + ((i * 37) % 20);
        x.fillStyle = cols[i % cols.length]; x.fillRect(px, 0, wd - 2, h);
        x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(px, 0, 2, h);
        x.fillStyle = 'rgba(0,0,0,0.30)'; x.fillRect(px + wd - 3, 0, 3, h);
        // 标签色块
        if (i % 3 === 0) { x.fillStyle = 'rgba(120,40,30,0.35)'; x.fillRect(px + 3, h * 0.28, Math.max(4, wd - 10), h * 0.1); }
        px += wd; i++;
      }
      var g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.22, 'rgba(0,0,0,0)');
      g.addColorStop(0.86, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0.65)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      grain(x, w, h, 6, 101);
      return c;
    });
  }

  window.TEX = {
    wall: function () { return wrap(wallCanvas()); },
    floor: function () { return wrap(floorCanvas()); },
    concrete: function () { return wrap(concreteCanvas()); },
    metal: function () { return wrap(metalCanvas()); },
    locker: function () { return wrap(lockerCanvas()); },
    wood: function () { return wrap(woodCanvas()); },
    ceiling: function () { return wrap(ceilingCanvas()); },
    screen: function () { return wrap(screenCanvas()); },
    paper: function () { return wrap(paperCanvas()); },
    mirror: function () { return wrap(mirrorCanvas()); },
    board: function () { return wrap(blackboardCanvas()); },
    rust: function () { return wrap(rustCanvas()); },
    window: function () { return wrap(windowCanvas()); },
    poster: function () { return wrap(posterCanvas()); },
    folders: function () { return wrap(foldersCanvas()); },
    sign: function (text, opt) { return wrap(signCanvas(text, opt)); },
    hazard: function () {
      var c = mk(128), x = c.getContext('2d');
      x.fillStyle = '#b08a2a'; x.fillRect(0, 0, 128, 128);
      x.fillStyle = '#15181a';
      for (var i = -2; i < 6; i++) {
        x.beginPath();
        x.moveTo(i * 32, 0); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 + 16 + 128, 128); x.lineTo(i * 32 + 128, 128);
        x.closePath(); x.fill();
      }
      grain(x, 128, 128, 8, 81);
      return wrap(c);
    }
  };
})();
