/* 鹏城暗码 3D · 关卡构建（全部程序化几何，无模型文件） */
(function () {
  'use strict';
  var THREE = window.THREE;

  var texBase = {}, matCache = {};
  function baseTex(kind) {
    if (!texBase[kind]) {
      var fn = window.TEX[kind];
      texBase[kind] = fn ? fn() : window.TEX.concrete();
    }
    return texBase[kind];
  }

  var MATPARAM = {
    wall: { roughness: 0.94, metalness: 0.02 },
    floor: { roughness: 0.72, metalness: 0.08 },
    concrete: { roughness: 0.95, metalness: 0.02 },
    metal: { roughness: 0.48, metalness: 0.62 },
    locker: { roughness: 0.56, metalness: 0.42 },
    wood: { roughness: 0.74, metalness: 0.04 },
    ceiling: { roughness: 0.96, metalness: 0.0 },
    paper: { roughness: 0.9, metalness: 0.0 },
    mirror: { roughness: 0.06, metalness: 0.95 },
    board: { roughness: 0.88, metalness: 0.02 },
    rust: { roughness: 0.9, metalness: 0.25 },
    folders: { roughness: 0.92, metalness: 0.0 },
    window: { roughness: 0.25, metalness: 0.1 }
  };

  function M(kind, rx, ry) {
    var key = kind + '|' + (rx || 1) + '|' + (ry || 1);
    if (matCache[key]) return matCache[key];
    var t = baseTex(kind).clone();
    t.needsUpdate = true;
    t.repeat.set(rx || 1, ry || 1);
    var p = MATPARAM[kind] || MATPARAM.concrete;
    var m = new THREE.MeshStandardMaterial({
      map: t, roughness: p.roughness, metalness: p.metalness
    });
    if (kind === 'window') {
      m.emissive = new THREE.Color(0x2c5270);
      m.emissiveMap = t;
      m.emissiveIntensity = 1.35;
    }
    matCache[key] = m;
    return m;
  }

  function basic(color, opts) {
    return new THREE.MeshBasicMaterial(Object.assign({ color: color }, opts || {}));
  }

  function addBox(parent, w, h, d, mat, x, y, z, ry) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function addPlane(parent, w, h, mat, x, y, z, rx, ry) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx || 0, ry || 0, 0);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function addCyl(parent, rt, rb, h, mat, x, y, z, seg) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function solid(level, mesh, pad) {
    mesh.updateMatrixWorld(true);
    var b = new THREE.Box3().setFromObject(mesh);
    level.colliders.push({
      x0: b.min.x - (pad || 0), x1: b.max.x + (pad || 0),
      z0: b.min.z - (pad || 0), z1: b.max.z + (pad || 0)
    });
  }

  function room(level, x0, z0, x1, z1, h, opt) {
    opt = opt || {};
    var g = level.group;
    var w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    var floor = addPlane(g, w, d, M('floor', Math.max(1, w / 2.4), Math.max(1, d / 2.4)), cx, 0.01, cz, -Math.PI / 2, 0);
    floor.receiveShadow = true;
    if (opt.ceiling !== false) {
      addPlane(g, w, d, M('ceiling', Math.max(1, w / 3), Math.max(1, d / 3)), cx, h, cz, Math.PI / 2, 0);
    }
    var t = 0.2;
    var wallMat = opt.wallMat || M('wall', Math.max(1, w / 2.5), 1.4);
    // 北 / 南
    addBox(g, w + t * 2, h, t, wallMat, cx, h / 2, z0 - t / 2);
    addBox(g, w + t * 2, h, t, wallMat, cx, h / 2, z1 + t / 2);
    // 西 / 东
    addBox(g, t, h, d, wallMat, x0 - t / 2, h / 2, cz);
    addBox(g, t, h, d, wallMat, x1 + t / 2, h / 2, cz);
    level.colliders.push(
      { x0: x0 - 2, x1: x1 + 2, z0: z0 - 0.6, z1: z0 + 0.02 },
      { x0: x0 - 2, x1: x1 + 2, z0: z1 - 0.02, z1: z1 + 0.6 },
      { x0: x0 - 0.6, x1: x0 + 0.02, z0: z0 - 2, z1: z1 + 2 },
      { x0: x1 - 0.02, x1: x1 + 0.6, z0: z0 - 2, z1: z1 + 2 }
    );
    // 踢脚线
    var skirtMat = basic(0x1a1f21);
    addBox(g, w, 0.10, 0.03, skirtMat, cx, 0.05, z0 + 0.02);
    addBox(g, w, 0.10, 0.03, skirtMat, cx, 0.05, z1 - 0.02);
    addBox(g, 0.03, 0.10, d, skirtMat, x0 + 0.02, 0.05, cz);
    addBox(g, 0.03, 0.10, d, skirtMat, x1 - 0.02, 0.05, cz);
    return { w: w, d: d, cx: cx, cz: cz, h: h };
  }

  function lamp(level, x, y, z, opt) {
    opt = opt || {};
    var g = level.group;
    var len = opt.len || 1.25;
    addBox(g, len, 0.07, 0.16, M('metal', 1, 1), x, y + 0.04, z);
    var diff = addPlane(g, len - 0.1, 0.13, basic(opt.color || 0xbfe9ff), x, y - 0.006, z, Math.PI / 2, 0);
    diff.castShadow = false;
    // 灯下的空气感已关闭，避免几何感太强的光锥
    var light = null;
    var inten = (opt.intensity || 0.55) * 1.9;
    if (opt.light !== false) {
      light = new THREE.PointLight(opt.lightColor || 0xbcd8ee, inten, opt.distance || 7, 1.4);
      light.position.set(x, y - 0.12, z);
      level.group.add(light);
    }
    var fl = { light: light, mesh: diff, base: inten, phase: Math.random() * 9, speed: opt.speed || 0, baseOpacity: 0.022, cone: null, color: opt.color || 0xbfe9ff };
    level.flickers.push(fl);
    return fl;
  }

  function doorMesh(level, x, z, ry, w, h, opt) {
    opt = opt || {};
    var g = level.group;
    var frameMat = M('metal', 1, 1);
    var slab = addBox(g, w, h, 0.07, opt.glass ? M('metal', 1, 1) : M('wood', 1, 1), x + Math.sin(ry) * 0.02, h / 2, z + Math.cos(ry) * 0.02, ry);
    if (opt.glass) {
      var gl = addPlane(g, w - 0.16, h * 0.5, basic(0x0d171c, { transparent: true, opacity: 0.85 }), x, h * 0.66, z, 0, ry);
      gl.position.x += Math.sin(ry) * 0.05;
      gl.position.z += Math.cos(ry) * 0.05;
    }
    // 门框
    var fw = w + 0.16;
    addBox(g, 0.1, h + 0.1, 0.16, frameMat, x - Math.cos(ry) * fw / 2, (h + 0.1) / 2, z + Math.sin(ry) * fw / 2, ry);
    addBox(g, 0.1, h + 0.1, 0.16, frameMat, x + Math.cos(ry) * fw / 2, (h + 0.1) / 2, z - Math.sin(ry) * fw / 2, ry);
    addBox(g, fw + 0.1, 0.1, 0.16, frameMat, x, h + 0.08, z, ry);
    // 把手
    var hx = x + Math.cos(ry) * (w / 2 - 0.14), hz = z - Math.sin(ry) * (w / 2 - 0.14);
    addCyl(g, 0.035, 0.035, 0.16, M('metal', 1, 1), hx, 1.05, hz);
    if (opt.sign) {
      var signTex = window.TEX.sign(opt.sign, { bg: opt.signBg || '#16232a', fg: opt.signFg || '#cbd8da', w: 512, h: 160, size: 64 });
      var plate = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.31), new THREE.MeshBasicMaterial({ map: signTex }));
      plate.position.set(x, h + 0.35, z + Math.cos(ry) * 0.09);
      plate.rotation.y = ry;
      level.group.add(plate);
    }
    solid(level, slab, 0.02);
    return slab;
  }

  function desk(level, x, z, ry, withPc) {
    var g = level.group;
    var top = addBox(g, 1.35, 0.06, 0.68, M('wood', 1.2, 1), x, 0.75, z, ry);
    addBox(g, 1.1, 0.62, 0.5, M('wood', 1, 1), x, 0.42, z, ry);
    addBox(g, 0.04, 0.12, 0.6, M('metal', 1, 1), x, 0.69, z, ry);
    if (withPc !== false) {
      var mx = x + Math.cos(ry) * 0.02, mz = z - Math.sin(ry) * 0.02;
      addBox(g, 0.06, 0.28, 0.06, M('metal', 1, 1), mx, 0.94, mz, ry);
      var mon = addBox(g, 0.62, 0.38, 0.05, M('metal', 1, 1), mx, 1.16, mz, ry);
      var scr = addPlane(g, 0.55, 0.31, new THREE.MeshBasicMaterial({ map: baseTex('screen') }), mx, 1.16, mz, 0, ry);
      scr.position.x += Math.sin(ry) * 0.03;
      scr.position.z += Math.cos(ry) * 0.03;
      addBox(g, 0.42, 0.02, 0.14, M('metal', 1, 1), mx, 0.79, mz, ry);
      // 主机
      addBox(g, 0.2, 0.45, 0.45, M('metal', 1, 1), x + Math.cos(ry) * 0.5, 0.24, z - Math.sin(ry) * 0.5, ry);
    }
    solid(level, top, 0.02);
    return top;
  }

  function chair(level, x, z, ry) {
    var g = level.group;
    addBox(g, 0.44, 0.05, 0.44, M('metal', 1, 1), x, 0.46, z, ry);
    addBox(g, 0.42, 0.42, 0.05, M('metal', 1, 1), x + Math.sin(ry) * 0.2, 0.72, z + Math.cos(ry) * 0.2, ry);
    addCyl(g, 0.04, 0.04, 0.44, M('metal', 1, 1), x, 0.24, z, 6);
    for (var i = 0; i < 5; i++) {
      var a = i / 5 * Math.PI * 2;
      addBox(g, 0.3, 0.04, 0.05, M('metal', 1, 1), x + Math.cos(a) * 0.16, 0.03, z + Math.sin(a) * 0.16, a);
    }
  }

  function locker(level, x, z, ry, no) {
    var g = level.group;
    var body = addBox(g, 0.86, 1.98, 0.5, M('locker', 1, 1), x, 0.99, z, ry);
    // 门缝
    addBox(g, 0.02, 1.9, 0.02, basic(0x0b0f0f), x + Math.cos(ry) * 0.0, 0.99, z + Math.sin(ry) * 0.0, ry);
    var handle = addBox(g, 0.03, 0.14, 0.03, M('metal', 1, 1), x + Math.cos(ry) * 0.3, 1.05, z - Math.sin(ry) * 0.3, ry);
    if (no) {
      var t = window.TEX.sign(no, { bg: '#1b2422', fg: '#b9c6c4', w: 128, h: 128, size: 64, border: false });
      var pl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: t }));
      pl.position.set(x + Math.cos(ry) * 0.2, 1.82, z - Math.sin(ry) * 0.2);
      pl.rotation.y = ry;
      g.add(pl);
    }
    solid(level, body, 0.06);
    return body;
  }

  function rack(level, x, z, opt) {
    opt = opt || {};
    var g = level.group;
    var body = addBox(g, 0.92, opt.h || 2.15, 1.0, M('metal', 1, 2), x, (opt.h || 2.15) / 2, z);
    // 前面板
    addBox(g, 0.78, (opt.h || 2.15) - 0.2, 0.03, basic(0x11171a), x, (opt.h || 2.15) / 2, z + 0.52);
    // LED 带
    var ledMat = basic(opt.dead ? 0x2a1710 : 0x63d38f);
    for (var i = 0; i < 9; i++) {
      addBox(g, 0.35, 0.012, 0.012, ledMat, x - 0.1, 0.4 + i * 0.18, z + 0.545);
    }
    // 风扇
    addCyl(g, 0.12, 0.12, 0.03, basic(0x0a0f11), x + 0.24, 1.5, z + 0.52, 10);
    solid(level, body, 0.05);
    level.leds.push({ mesh: ledMat, phase: Math.random() * 10, dead: !!opt.dead });
    if (opt.glow !== false && !opt.dead) {
      var l = new THREE.PointLight(0x5fe8a0, 0.10, 1.7, 1.8);
      l.position.set(x, 1.4, z + 0.65);
      level.group.add(l);
    }
    return body;
  }

  function paperStack(level, x, z, n, ry) {
    for (var i = 0; i < n; i++) {
      var s = addBox(level.group, 0.21, 0.004, 0.29, M('paper', 1, 1), x + (Math.random() - 0.5) * 0.3, 0.012 + i * 0.006, z + (Math.random() - 0.5) * 0.3, ry + (Math.random() - 0.5) * 0.6);
      s.castShadow = false;
    }
  }

  function cables(level, x0, z0, x1, z1, y, color) {
    var g = level.group;
    var mat = basic(color || 0x181c1d);
    var seg = 5;
    for (var i = 0; i < seg; i++) {
      var ax = x0 + (x1 - x0) * (i / seg), az = z0 + (z1 - z0) * (i / seg);
      var bx = x0 + (x1 - x0) * ((i + 1) / seg), bz = z0 + (z1 - z0) * ((i + 1) / seg);
      var len = Math.hypot(bx - ax, bz - az);
      var m = addBox(g, len || 0.1, 0.035, 0.05, mat, (ax + bx) / 2, y, (az + bz) / 2, Math.atan2(-(bz - az), bx - ax));
      m.castShadow = false;
    }
  }

  function stain(level, x, z, w, d, ry, color) {
    var cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    var c = cv.getContext('2d');
    var g2 = c.createRadialGradient(64, 64, 4, 64, 64, 62);
    g2.addColorStop(0, color || 'rgba(8,10,11,0.55)');
    g2.addColorStop(0.6, 'rgba(8,10,11,0.25)');
    g2.addColorStop(1, 'rgba(8,10,11,0)');
    c.fillStyle = g2; c.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    var p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    p.rotation.set(-Math.PI / 2, 0, ry || 0);
    p.position.set(x, 0.015, z);
    level.group.add(p);
  }

  function newLevel(id, ambience) {
    return {
      id: id, group: new THREE.Group(), colliders: [], flickers: [], leds: [],
      anchors: {}, ambience: ambience, fog: null, ambient: null, points: [],
      spawn: null, chapter: '', title: '', subtitle: '',
      haze: 0
    };
  }

  /* ================= 第一幕：实训机房 ================= */
  function buildClassroom() {
    var L = newLevel('classroom', 'classroom');
    L.chapter = 'CHAPTER 01'; L.title = '最后一班补训'; L.subtitle = '人工智能实训中心 · J6 班';
    L.fog = { color: 0x05080b, density: 0.045 };
    L.ambient = { sky: 0x243441, ground: 0x05070a, intensity: 0.22 };
    var r = room(L, -6, -4.5, 6, 4.5, 3.6);
    var g = L.group;

    // 窗户（东墙）
    for (var wi = 0; wi < 3; wi++) {
      var wz = -2.7 + wi * 2.3;
      addPlane(g, 2.0, 1.35, M('window', 1, 1), 5.94, 1.95, wz, 0, -Math.PI / 2);
      addBox(g, 0.06, 0.1, 2.1, M('metal', 1, 1), 5.88, 1.28, wz);
      addBox(g, 0.06, 0.1, 2.1, M('metal', 1, 1), 5.88, 2.62, wz);
      addBox(g, 0.06, 1.45, 0.1, M('metal', 1, 1), 5.88, 1.95, wz - 1.0);
      addBox(g, 0.06, 1.45, 0.1, M('metal', 1, 1), 5.88, 1.95, wz + 1.0);
    }
    // 黑板
    addPlane(g, 4.6, 1.9, M('board', 2, 1), 0, 2.15, -4.38, 0, 0);
    addBox(g, 4.8, 0.1, 0.12, M('metal', 1, 1), 0, 3.12, -4.3);
    addBox(g, 4.8, 0.1, 0.18, M('metal', 1, 1), 0, 1.16, -4.3);

    // 课桌两排
    var desksX = [-3.9, -1.6, 1.2, 3.7], desksZ = [-1.2, 1.7];
    for (var i = 0; i < desksX.length; i++) {
      for (var j = 0; j < desksZ.length; j++) {
        desk(L, desksX[i], desksZ[j], 0, true);
        chair(L, desksX[i], desksZ[j] + 0.62, 0);
      }
    }
    // 教师主控台
    addBox(g, 1.9, 0.86, 0.78, M('wood', 1, 1), 0, 0.43, -3.86);
    addBox(g, 2.0, 0.06, 0.88, M('wood', 1.2, 1), 0, 0.88, -3.86);
    solid(L, g.children[g.children.length - 2], 0.02);
    addBox(g, 0.6, 0.36, 0.05, M('metal', 1, 1), 0, 1.18, -3.9, 0);
    addPlane(g, 0.54, 0.3, new THREE.MeshBasicMaterial({ map: baseTex('screen') }), 0, 1.18, -3.87, 0, 0);
    addBox(g, 0.36, 0.02, 0.14, M('metal', 1, 1), 0, 0.93, -3.7);

    // 天花板日光灯
    lamp(L, -3.2, 3.38, 0.2, { len: 1.5, intensity: 0.62, distance: 9 });
    lamp(L, 0.2, 3.38, -1.6, { len: 1.5, intensity: 0.55, distance: 9, speed: 0.9 });
    lamp(L, 3.6, 3.38, 1.1, { len: 1.5, intensity: 0.5, distance: 8 });

    // 门 + 门禁键盘（南墙）
    doorMesh(L, 0.9, 4.4, Math.PI, 1.02, 2.15, { sign: '实训机房 J6', signBg: '#142026' });
    addBox(g, 0.18, 0.3, 0.05, M('metal', 1, 1), 1.72, 1.35, 4.36);
    var keyPad = addBox(g, 0.14, 0.1, 0.02, basic(0x5fd0a0), 1.72, 1.4, 4.33);
    L.anchors.keypad = { x: 1.72, y: 1.35, z: 4.32 };

    // 西墙考勤表 / 工具柜 / 监控
    addPlane(g, 1.15, 0.8, M('paper', 1, 1), -5.92, 1.62, 0.7, 0, Math.PI / 2);
    addBox(g, 1.25, 0.05, 0.05, M('wood', 1, 1), -5.9, 2.05, 0.7, 0);
    addBox(g, 0.9, 1.95, 0.55, M('locker', 1, 1), -5.45, 0.98, 1.75);
    solid(L, g.children[g.children.length - 1], 0.04);
    addBox(g, 0.25, 0.16, 0.3, basic(0x1a1f22), -5.6, 3.3, -4.1);
    addBox(g, 0.1, 0.1, 0.12, basic(0x090c0e), -5.6, 3.3, -3.94);
    // 监控红点
    L.leds.push({ mesh: basic(0xff3322), phase: 0, red: true });

    // 打卡机
    addBox(g, 0.28, 0.42, 0.12, M('metal', 1, 1), 2.55, 1.45, 4.32);
    var clockLed = addBox(g, 0.16, 0.1, 0.02, basic(0x58d38a), 2.55, 1.5, 4.25);
    L.anchors.clock = { x: 2.55, y: 1.4, z: 4.2 };

    // 桌面道具
    var myDesk = { x: 1.2, z: 1.7 };
    addBox(g, 0.09, 0.12, 0.09, M('metal', 1, 1), myDesk.x + 0.5, 0.83, myDesk.z - 0.1);
    addBox(g, 0.07, 0.11, 0.012, basic(0x93b7c4), myDesk.x + 0.5, 0.9, myDesk.z - 0.06);
    L.anchors.phone = { x: myDesk.x + 0.5, y: 0.82, z: myDesk.z - 0.1 };
    L.anchors.spawn = { x: 2.75, z: 2.95, yaw: 0.18 };
    L.anchors.drawer = { x: myDesk.x - 0.45, y: 0.5, z: myDesk.z + 0.18 };
    L.anchors.coffee = { x: -0.78, y: 0.93, z: -3.56 };
    addCyl(g, 0.045, 0.035, 0.1, M('paper', 1, 1), -0.78, 0.94, -3.56);

    // 书包
    addBox(g, 0.36, 0.32, 0.22, M('locker', 1, 1), 0.45, 0.2, 2.85, 0.2);
    addBox(g, 0.1, 0.22, 0.05, M('locker', 1, 1), 0.36, 0.2, 2.75, 0.2);
    L.anchors.bag = { x: 0.45, y: 0.2, z: 2.85 };

    // 教案 / 工牌
    addBox(g, 0.32, 0.02, 0.24, M('paper', 1, 1), -0.35, 0.9, -3.8);
    L.anchors.book = { x: -0.35, y: 0.9, z: -3.8 };
    addBox(g, 0.09, 0.012, 0.06, M('paper', 1, 1), -1.0, 0.012, -3.1, 0.4);
    L.anchors.badge = { x: -1.0, y: 0.06, z: -3.1 };

    // 便利贴（左后排显示器边缘）
    addBox(g, 0.12, 0.001, 0.12, basic(0xd9cf6a), -1.85, 1.36, -1.16, 0.2);
    L.anchors.sticky = { x: -1.85, y: 1.3, z: -1.16 };

    // 摔碎的显示器 + 学生证（压在最后一张桌子上）
    addBox(g, 0.7, 0.42, 0.06, M('metal', 1, 1), 3.72, 1.0, 1.55, -0.5);
    addPlane(g, 0.6, 0.34, new THREE.MeshBasicMaterial({ color: 0x0a1014 }), 3.72, 1.0, 1.52, 0, -0.5 + Math.PI);
    addPlane(g, 0.24, 0.17, M('paper', 1, 1), 4.15, 0.02, 0.1, -Math.PI / 2, 0.5);
    L.anchors.fallen = { x: 3.72, y: 1.0, z: 1.55 };

    // 墙上的海报
    addPlane(g, 0.8, 1.2, M('poster', 1, 1), 5.9, 1.7, 3.1, 0, -Math.PI / 2);

    // 地上的线缆
    cables(L, 0.1, -3.4, 1.4, 0.9, 0.06, 0x14181a);
    cables(L, -0.2, -3.3, -2.3, 1.4, 0.05, 0x1a1f22);

    // 角落的拖痕
    stain(L, 4.3, -3.6, 1.4, 0.5, 0.4);

    return L;
  }

  /* ================= 第二幕：走廊 ================= */
  function buildCorridor() {
    var L = newLevel('corridor', 'corridor');
    L.chapter = 'CHAPTER 02'; L.title = '巡察体'; L.subtitle = '教学楼三层 · 东走廊';
    L.fog = { color: 0x04070a, density: 0.055 };
    L.ambient = { sky: 0x1b2832, ground: 0x040608, intensity: 0.16 };
    var r = room(L, -2.3, -20, 2.3, 0.2, 3.05, { wallMat: M('wall', 2, 1.3) });
    var g = L.group;

    // 灯
    lamp(L, 0, 2.82, -1.6, { len: 1.4, intensity: 0.5, distance: 7 });
    lamp(L, 0, 2.82, -5.2, { len: 1.4, intensity: 0.42, distance: 6.5, speed: 2.2 });
    lamp(L, 0, 2.82, -8.8, { len: 1.4, intensity: 0.34, distance: 6, speed: 0.6 });
    lamp(L, 0, 2.82, -12.4, { len: 1.4, intensity: 0.3, distance: 5.5, speed: 1.6 });
    lamp(L, 0, 2.82, -16.2, { len: 1.4, intensity: 0.22, distance: 5, speed: 3.0 });
    lamp(L, 0, 2.82, -19.2, { len: 1.4, intensity: 0.16, distance: 4 });

    // 柜子（西墙）
    var no = 1;
    [-3.2, -6.0, -8.8, -11.6, -15.2, -18.2].forEach(function (z) {
      locker(L, -2.0, z, Math.PI / 2, ('0' + (no++)).slice(-2));
    });
    L.anchors.locker = [
      { x: -1.62, z: -3.2 }, { x: -1.62, z: -6.0 }, { x: -1.62, z: -8.8 },
      { x: -1.62, z: -11.6 }, { x: -1.62, z: -15.2 }, { x: -1.62, z: -18.2 }
    ];

    // 三扇门（东墙）
    doorMesh(L, 2.16, -14.0, -Math.PI / 2, 1.02, 2.15, { sign: '档案室 B1', signBg: '#1b2422' });
    doorMesh(L, 2.16, -8.0, -Math.PI / 2, 1.02, 2.15, { sign: '洗手间', signBg: '#18262a' });
    doorMesh(L, 2.16, -2.0, -Math.PI / 2, 1.02, 2.15, { sign: '安全通道', signBg: '#232420', signFg: '#d3b46a' });
    L.anchors.doorArchive = { x: 2.05, z: -14.0 };
    L.anchors.doorBath = { x: 2.05, z: -8.0 };
    L.anchors.doorStair = { x: 2.05, z: -2.0 };

    // 公告栏
    addPlane(g, 1.1, 0.8, M('paper', 1, 1), 2.16, 1.6, -18.6, 0, -Math.PI / 2);
    addBox(g, 1.2, 0.06, 0.06, M('wood', 1, 1), 2.12, 2.03, -18.6);
    L.anchors.report = { x: 2.05, y: 1.6, z: -18.6 };

    // 边缘计算节点立柱
    var edgeBody = addBox(g, 0.46, 2.25, 0.46, M('metal', 1, 1), 1.55, 1.12, -10.4);
    addBox(g, 0.5, 0.06, 0.5, M('metal', 1, 1), 1.55, 2.28, -10.4);
    addBox(g, 0.03, 0.03, 0.3, basic(0x58d9a0), 1.34, 1.9, -10.4);
    L.anchors.edgeNode = { x: 1.55, z: -10.4 };
    addCyl(g, 0.05, 0.05, 1.9, M('metal', 1, 1), 1.55, 0.95, -10.4, 6);
    solid(L, edgeBody, 0.05);

    // 散落的玻璃瓶
    [[0.7, -5.3], [-1.15, -11.2], [1.1, -16.8]].forEach(function (p) {
      addCyl(g, 0.045, 0.05, 0.22, new THREE.MeshStandardMaterial({ color: 0x3c5a4a, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }), p[0], 0.11, p[1], 8);
      addCyl(g, 0.02, 0.02, 0.1, basic(0x2c4438), p[0], 0.27, p[1], 6);
    });
    L.anchors.bottles = [{ x: 0.7, z: -5.3 }, { x: -1.15, z: -11.2 }, { x: 1.1, z: -16.8 }];

    // 管道 / 线槽
    cables(L, 0.9, -19.9, 0.9, -0.1, 2.62, 0x1d2528);
    var p1 = addCyl(g, 0.07, 0.07, 19.6, M('rust', 1, 4), -2.05, 2.55, -10, 8);
    p1.rotation.x = Math.PI / 2;
    var p2 = addCyl(g, 0.05, 0.05, 19.6, M('rust', 1, 4), -1.78, 2.62, -10, 8);
    p2.rotation.x = Math.PI / 2;

    // 地上的水渍 / 拖痕
    stain(L, -1.0, -13.2, 1.3, 0.5, 0.2);
    stain(L, 0.6, -7.2, 1.8, 0.7, 1.2);
    stain(L, 2.0, -13.3, 1.0, 1.0, 0.3);

    // 湿滑警示牌
    addBox(g, 0.28, 0.5, 0.03, new THREE.MeshBasicMaterial({ map: window.TEX.hazard() }), -1.5, 0.25, -7.4, 0.3);

    L.anchors.spawn = { x: 0, z: -0.7, yaw: 0 };
    L.anchors.robotWaypoints = [-18.5, -13.5, -9.0, -4.5, -1.6];
    return L;
  }

  /* ================= 第三幕：洗手间 ================= */
  function buildBathroom() {
    var L = newLevel('bathroom', 'bathroom');
    L.chapter = 'CHAPTER 03'; L.title = '安全屋'; L.subtitle = '三层洗手间 · 灯还亮着';
    L.fog = { color: 0x050809, density: 0.05 };
    L.ambient = { sky: 0x2b3a3c, ground: 0x050708, intensity: 0.2 };
    var r = room(L, -3.5, -3.5, 3.5, 3.5, 3.0, { wallMat: M('wall', 2, 1.2) });
    var g = L.group;
    var lam = new THREE.MeshStandardMaterial({ color: 0x4d5a55, roughness: 0.5, metalness: 0.32 });

    // 潮湿地面反光
    addPlane(g, 6.8, 6.8, new THREE.MeshStandardMaterial({ color: 0x3b4446, roughness: 0.22, metalness: 0.25 }), 0, 0.02, 0, -Math.PI / 2, 0);

    // 隔间（北墙）
    for (var i = 0; i < 3; i++) {
      var x0 = -2.5 + i * 1.7;
      addBox(g, 0.07, 2.2, 1.25, lam, x0, 1.1, -2.85);
      addBox(g, 0.6, 2.2, 0.07, lam, x0 + 0.85, 1.1, -3.45);
      addBox(g, 1.55, 0.06, 1.25, lam, x0 + 0.8, 2.2, -2.85);
      addBox(g, 0.62, 1.9, 0.04, lam, x0 + 0.55, 1.0, -2.25);
      addBox(g, 0.05, 0.16, 0.05, M('metal', 1, 1), x0 + 0.28, 1.05, -2.2);
      solid(L, g.children[g.children.length - 1], 0.02);
    }
    addBox(g, 3.4, 0.07, 0.07, M('metal', 1, 1), 0.06, 2.25, -2.2);
    L.anchors.stalls = [{ x: -1.8, z: -2.4 }, { x: -0.1, z: -2.4 }, { x: 1.6, z: -2.4 }];

    // 洗手台 + 镜子
    addBox(g, 0.55, 0.85, 3.2, M('concrete', 1, 2), -3.15, 0.42, -0.2);
    for (var s = 0; s < 3; s++) {
      addCyl(g, 0.22, 0.18, 0.09, M('metal', 1, 1), -3.0, 0.86, -1.5 + s * 1.1, 12);
      addCyl(g, 0.02, 0.02, 0.1, M('metal', 1, 1), -3.0, 0.96, -1.5 + s * 1.1, 6);
    }
    var mir = addPlane(g, 2.6, 1.5, M('mirror', 1, 1), -3.42, 1.72, -0.2, 0, Math.PI / 2);
    L.anchors.mirror = { x: -3.2, y: 1.55, z: 0.3 };

    // 旧考勤机
    addBox(g, 0.34, 0.5, 0.14, M('metal', 1, 1), 2.35, 1.4, 3.28);
    addBox(g, 0.2, 0.12, 0.02, basic(0x63d8a3), 2.35, 1.48, 3.2);
    L.anchors.clock = { x: 2.35, y: 1.4, z: 3.15 };

    // 门（南墙）
    doorMesh(L, 0, 3.45, 0, 1.02, 2.15, { sign: '洗手间' });
    L.anchors.exit = { x: 0, z: 3.2 };

    // 灯管
    lamp(L, -1.2, 2.86, 0.6, { len: 1.5, intensity: 0.55, distance: 7, speed: 1.4, color: 0xcfe8f2 });
    lamp(L, 1.6, 2.86, -1.2, { len: 1.5, intensity: 0.4, distance: 6, speed: 0.3 });

    // 杂物
    addBox(g, 0.3, 0.34, 0.3, new THREE.MeshStandardMaterial({ color: 0x8a8b46, roughness: 0.7 }), 2.2, 0.17, -2.4, 0.2);
    addCyl(g, 0.03, 0.03, 1.1, M('metal', 1, 1), 2.2, 0.75, -2.4, 6);
    addBox(g, 0.5, 0.08, 0.1, basic(0x2f4a3d), 2.2, 0.33, -2.4);
    L.anchors.mop = { x: 2.2, z: -2.4 };

    addCyl(g, 0.045, 0.05, 0.22, new THREE.MeshStandardMaterial({ color: 0x3c5a4a, roughness: 0.2, transparent: true, opacity: 0.85 }), 2.85, 0.11, 1.2, 8);
    L.anchors.bottles = [{ x: 2.85, z: 1.2 }];

    // 墙上的水渍
    stain(L, -2.6, -1.1, 1.6, 0.6, 0.1);
    stain(L, 1.6, 2.8, 0.9, 1.2, 0.5);

    L.anchors.spawn = { x: 0, z: 2.6, yaw: 0 };
    return L;
  }

  /* ================= 第四幕：档案室 ================= */
  function buildArchive() {
    var L = newLevel('archive', 'archive');
    L.chapter = 'CHAPTER 04'; L.title = '归档完成'; L.subtitle = 'B1 档案室 · 温度 14°C';
    L.fog = { color: 0x07090a, density: 0.062 };
    L.ambient = { sky: 0x233029, ground: 0x040605, intensity: 0.15 };
    var r = room(L, -4.5, -4, 4.5, 4, 3.2, { wallMat: M('wall', 2, 1.3) });
    var g = L.group;

    // 档案架（北墙 + 西墙）：开放式钢架，一格格塞满卷宗
    var folderMats = [];
    for (var fi = 0; fi < 4; fi++) {
      var fm = M('paper', 1, 1).clone();
      fm.color = new THREE.Color([0xcfc3a4, 0xa9846a, 0x8f9aa0, 0xb8b09a][fi]);
      folderMats.push(fm);
    }
    function shelf(x, z, w, ry) {
      var cos = Math.cos(ry), sin = Math.sin(ry);
      function P(lx, lz) { return { x: x + lx * cos + lz * sin, z: z - lx * sin + lz * cos }; }
      var back = P(0, -0.2), side1 = P(-w / 2 + 0.04, 0), side2 = P(w / 2 - 0.04, 0);
      addBox(g, w, 2.15, 0.04, M('metal', 1, 1), back.x, 1.1, back.z, ry);
      addBox(g, 0.07, 2.2, 0.46, M('metal', 1, 1), side1.x, 1.1, side1.z, ry);
      addBox(g, 0.07, 2.2, 0.46, M('metal', 1, 1), side2.x, 1.1, side2.z, ry);
      for (var k = 0; k < 5; k++) {
        var bd = P(0, 0.03);
        addBox(g, w - 0.1, 0.05, 0.45, M('metal', 1, 1), bd.x, 0.2 + k * 0.48, bd.z, ry);
        if (k === 4) continue;
        // 一整排卷宗（贴图一次搞定，省 draw call）
        var fp = P(0, 0.245);
        addPlane(g, w - 0.16, 0.34, M('folders', 1, 1), fp.x, 0.4 + k * 0.48, fp.z, 0, ry);
        // 几盒探出架外的档案，制造立体感
        for (var b = 0; b < 3; b++) {
          var lx2 = -w / 2 + 0.55 + b * (w - 1.1) / 2;
          var pf = P(lx2, 0.04);
          addBox(g, 0.24, 0.3, 0.4, folderMats[(k * 3 + b) % 4], pf.x, 0.38 + k * 0.48, pf.z, ry + (b % 2 ? 0.05 : -0.04));
        }
      }
      var whole = P(0, -0.02);
      var ex = Math.abs(cos) * w / 2 + Math.abs(sin) * 0.25;
      var ez = Math.abs(sin) * w / 2 + Math.abs(cos) * 0.25;
      L.colliders.push({ x0: whole.x - ex, x1: whole.x + ex, z0: whole.z - ez, z1: whole.z + ez });
    }
    shelf(0, -3.65, 6.6, 0);
    shelf(-4.15, -1.0, 4.4, Math.PI / 2);

    // 保险箱
    var safe = addBox(g, 0.72, 0.75, 0.6, M('metal', 1, 1), 3.05, 0.55, -2.75);
    addPlane(g, 0.6, 0.55, M('metal', 1, 1), 3.05, 0.6, -2.44, 0, 0);
    addCyl(g, 0.11, 0.11, 0.05, M('metal', 1, 1), 3.05, 0.62, -2.4, 12);
    L.anchors.safe = { x: 3.05, y: 0.6, z: -2.35 };

    // 破损玻璃柜 / 消防斧
    addBox(g, 1.1, 0.06, 0.6, M('metal', 1, 1), 3.55, 1.55, 2.15);
    addBox(g, 1.1, 1.5, 0.06, M('metal', 1, 1), 3.55, 0.75, 2.45);
    addBox(g, 1.05, 1.35, 0.03, basic(0x7fa3a8, { transparent: true, opacity: 0.28 }), 3.5, 0.72, 2.12);
    // 斧头
    addCyl(g, 0.028, 0.028, 0.85, M('wood', 1, 1), 3.5, 0.75, 2.1, 6);
    addBox(g, 0.26, 0.2, 0.03, M('rust', 1, 1), 3.5, 1.1, 2.1, 0);
    L.anchors.axe = { x: 3.5, y: 1.0, z: 2.1 };

    // 办公桌 + 教学日志
    addBox(g, 1.2, 0.06, 0.62, M('wood', 1, 1), -0.4, 0.76, -0.9);
    addBox(g, 1.0, 0.7, 0.5, M('wood', 1, 1), -0.4, 0.38, -0.9);
    addBox(g, 0.34, 0.025, 0.26, M('paper', 1, 1), -0.45, 0.8, -0.88, 0.15);
    L.anchors.log = { x: -0.45, y: 0.8, z: -0.88 };

    // 归档终端
    addBox(g, 0.7, 0.9, 0.4, M('metal', 1, 1), 1.6, 0.45, -3.2);
    addBox(g, 0.56, 0.4, 0.05, M('metal', 1, 1), 1.6, 1.18, -3.18);
    addPlane(g, 0.5, 0.34, new THREE.MeshBasicMaterial({ map: baseTex('screen') }), 1.6, 1.18, -3.14, 0, 0);
    L.anchors.terminal = { x: 1.6, y: 1.1, z: -3.05 };
    L.screenMat = g.children[g.children.length - 1].material;

    // 档案盒 / 散落纸张
    for (var i = 0; i < 7; i++) {
      addBox(g, 0.3, 0.22, 0.38, M('paper', 1, 1), -3.2 + Math.random() * 6.4, 0.11, 2.9 + Math.random() * 0.5, Math.random() * 3);
    }
    paperStack(L, 0.8, 1.6, 12, 0.4);
    paperStack(L, -2.2, 2.1, 9, 1.2);

    // 警报灯（默认灭）
    var beacon = addBox(g, 0.18, 0.12, 0.18, basic(0x40100c), 0, 3.08, 0);
    var beaconLight = new THREE.PointLight(0xff2a1a, 0, 14, 1.4);
    beaconLight.position.set(0, 2.9, 0);
    g.add(beaconLight);
    L.beacon = { mesh: beacon, light: beaconLight };

    // 灯
    lamp(L, -2.6, 3.02, 0.6, { len: 1.3, intensity: 0.4, distance: 6, speed: 0.8 });
    lamp(L, 1.8, 3.02, -0.5, { len: 1.3, intensity: 0.3, distance: 5, speed: 2.4 });

    // 门（南墙）
    doorMesh(L, -2.0, 3.92, 0, 1.02, 2.15, { sign: '档案室 B1' });
    L.anchors.exit = { x: -2.0, z: 3.7 };
    L.anchors.spawn = { x: -2.0, z: 3.2, yaw: 0 };
    return L;
  }

  /* ================= 第五幕：楼梯间 ================= */
  function buildStairwell() {
    var L = newLevel('stairs', 'archive');
    L.chapter = 'CHAPTER 05'; L.title = '两扇门'; L.subtitle = '安全通道 · 应急照明';
    L.fog = { color: 0x030506, density: 0.075 };
    L.ambient = { sky: 0x182226, ground: 0x020304, intensity: 0.12 };
    var r = room(L, -3, -6, 3, 4, 4.2, { wallMat: M('concrete', 2, 2) });
    var g = L.group;

    // 向上 / 向下的台阶视觉
    for (var i = 0; i < 6; i++) {
      addBox(g, 2.4, 0.16, 0.32, M('concrete', 1, 1), 0, 0.08 + i * 0.16, -0.8 - i * 0.34);
    }
    for (var j = 0; j < 5; j++) {
      addBox(g, 2.2, 0.16, 0.32, M('concrete', 1, 1), 0, -0.08 - j * 0.16, 2.4 + j * 0.28);
    }
    // 扶手
    addCyl(g, 0.03, 0.03, 3.2, M('rust', 1, 2), -1.1, 1.3, -1.6, 6).rotation.x = Math.PI / 2 - 0.4;
    // 门：出口（北）/ 机房（东）
    doorMesh(L, 0, -5.92, 0, 1.02, 2.2, { sign: '安全出口', signBg: '#1d2b22', signFg: '#7fd8a8' });
    doorMesh(L, 2.92, -2.0, -Math.PI / 2, 1.02, 2.2, { sign: '机房 B1', signBg: '#242018', signFg: '#d9b06a' });
    L.anchors.up = { x: 0, y: 1.2, z: -5.7 };
    L.anchors.down = { x: 2.7, y: 1.2, z: -2.0 };

    // 应急灯
    var em = addBox(g, 0.14, 0.1, 0.14, basic(0x74d69a), -2.0, 2.9, 1.4);
    var emLight = new THREE.PointLight(0x5fd694, 0.5, 8, 1.5);
    emLight.position.set(-1.7, 2.8, 1.4);
    g.add(emLight);
    L.flickers.push({ light: emLight, mesh: em, base: 0.5, phase: 0, speed: 0.4 });

    // 墙上喷字
    addPlane(g, 1.2, 0.35, new THREE.MeshBasicMaterial({ map: window.TEX.sign('B1 →', { bg: '#0b1214', fg: '#c9b168', w: 512, h: 160, size: 90, border: false }) }), 0.6, 1.8, -5.9, 0, 0);

    L.anchors.spawn = { x: 0, z: 3.2, yaw: 0 };
    return L;
  }

  /* ================= 第六幕：服务器迷宫 ================= */
  function buildServer() {
    var L = newLevel('server', 'server');
    L.chapter = 'CHAPTER 06'; L.title = '盲区'; L.subtitle = '地下一层 · 边缘计算机房';
    L.fog = { color: 0x030608, density: 0.09 };
    L.ambient = { sky: 0x122024, ground: 0x020304, intensity: 0.16 };
    var r = room(L, -7, -6, 7, 6, 3.4, { wallMat: M('concrete', 2, 1.6) });
    var g = L.group;

    var rackX = [-3.6, 0, 3.6], rackZ = [-4.2, -1.7, 0.8, 3.2];
    var seed = 0;
    for (var i = 0; i < rackX.length; i++) {
      for (var j = 0; j < rackZ.length; j++) {
        seed++;
        if (seed === 2 || seed === 7 || seed === 11) continue; // 留出走道
        rack(L, rackX[i], rackZ[j], { dead: (seed === 5 || seed === 9), h: 2.05 + (seed % 3) * 0.1 });
      }
    }
    // 地面线缆 / 硬盘
    cables(L, -6.4, 5.4, 6.2, 5.4, 0.05, 0x141a1c);
    cables(L, -6.4, -5.4, 6.2, -5.4, 0.05, 0x141a1c);
    for (var k = 0; k < 9; k++) {
      addBox(g, 0.18, 0.03, 0.12, M('metal', 1, 1), -5.5 + Math.random() * 10, 0.02, -4.8 + Math.random() * 9.4, Math.random() * 3);
    }

    // 备用电池
    addBox(g, 0.18, 0.12, 0.12, M('metal', 1, 1), -4.9, 0.07, 2.3);
    addBox(g, 0.12, 0.02, 0.08, basic(0xd8c04a), -4.9, 0.14, 2.3);
    L.anchors.battery = { x: -4.9, y: 0.12, z: 2.3 };

    // 紧急重置按钮
    addBox(g, 0.4, 0.5, 0.16, M('metal', 1, 1), -6.55, 1.2, 0.2, Math.PI / 2);
    addCyl(g, 0.07, 0.07, 0.06, basic(0xc04a38), -6.4, 1.25, 0.2, 10).rotation.z = Math.PI / 2;
    L.anchors.reset = { x: -6.35, y: 1.2, z: 0.2 };

    // 红色应急灯
    for (var e = 0; e < 3; e++) {
      var px = -4.5 + e * 4.5;
      var b = addBox(g, 0.14, 0.1, 0.14, basic(0x7a1c14), px, 3.1, 4.6);
      var pl = new THREE.PointLight(0xff2a18, 0.45, 9, 1.5);
      pl.position.set(px, 2.95, 4.6);
      g.add(pl);
      L.flickers.push({ light: pl, mesh: b, base: 0.45, phase: e * 2, speed: 0.5, red: true });
    }

    // 通道顶部应急照明（冷白，只照亮走道）
    lamp(L, -1.8, 3.28, 1.6, { len: 1.2, intensity: 0.22, distance: 6, color: 0xbcd6dc, speed: 6.5 });
    lamp(L, 1.8, 3.28, -2.2, { len: 1.2, intensity: 0.2, distance: 6, color: 0xbcd6dc, speed: 4.2 });

    // 出口门（北墙）
    doorMesh(L, 5.5, -5.92, 0, 1.02, 2.2, { sign: '核心控制室', signBg: '#2a1a16', signFg: '#e0a08a' });
    L.anchors.exit = { x: 5.5, y: 1.2, z: -5.65 };
    L.anchors.spawn = { x: -5.6, z: 5.2, yaw: -0.82 };
    return L;
  }

  /* ================= 第七幕：核心控制室 ================= */
  function buildCore() {
    var L = newLevel('core', 'core');
    L.chapter = 'CHAPTER 07'; L.title = '最后一课'; L.subtitle = '核心控制室 · 权限层：教师';
    L.fog = { color: 0x050407, density: 0.05 };
    L.ambient = { sky: 0x241a1a, ground: 0x040304, intensity: 0.14 };
    var r = room(L, -5, -4, 5, 4, 4.2, { wallMat: M('metal', 3, 2), ceiling: false });
    var g = L.group;
    addPlane(g, 10, 8, M('floor', 4, 3), 0, 0.01, 0, -Math.PI / 2, 0);
    addPlane(g, 10, 8, new THREE.MeshBasicMaterial({ color: 0x080a0c }), 0, 4.2, 0, Math.PI / 2, 0);

    // 中央核心
    var coreMat = new THREE.MeshStandardMaterial({ color: 0x4a5153, roughness: 0.5, metalness: 0.55 });
    var coreBody = addCyl(g, 0.78, 0.94, 2.5, coreMat, 0, 1.25, 0, 28);
    addCyl(g, 1.0, 1.0, 0.1, M('metal', 2, 1), 0, 0.05, 0, 20);
    addCyl(g, 0.99, 0.99, 0.07, basic(0xff8a4a, { transparent: true, opacity: 0.55 }), 0, 1.9, 0, 20);
    addCyl(g, 0.99, 0.99, 0.07, basic(0xff8a4a, { transparent: true, opacity: 0.55 }), 0, 0.75, 0, 20);
    // 竖向肋条
    for (var cr = 0; cr < 8; cr++) {
      var ang = cr / 8 * Math.PI * 2;
      addBox(g, 0.09, 2.3, 0.16, M('metal', 1, 1), Math.sin(ang) * 0.86, 1.25, Math.cos(ang) * 0.86, ang);
    }
    // 正面散热光带
    addPlane(g, 0.3, 1.5, new THREE.MeshBasicMaterial({ color: 0xff7a44, transparent: true, opacity: 0.42 }), 0, 1.3, 0.95, 0, 0);
    addCyl(g, 0.62, 0.78, 0.14, coreMat, 0, 2.52, 0, 20);
    addCyl(g, 0.3, 0.38, 0.22, basic(0x221612), 0, 2.69, 0, 12);
    solid(L, coreBody, 0.12);
    var coreLight = new THREE.PointLight(0xff8a48, 1.2, 12, 1.5);
    coreLight.position.set(0, 2.1, 0);
    g.add(coreLight);
    L.coreLight = coreLight;
    L.anchors.core = { x: 0, z: 0 };

    // 三个核心节点
    L.nodeAnchors = [];
    [[0, -2.6], [2.6, 1.3], [-2.6, 1.3]].forEach(function (p, i) {
      addCyl(g, 0.22, 0.28, 1.5, M('metal', 1, 1), p[0], 0.75, p[1], 10);
      var top = addCyl(g, 0.24, 0.24, 0.1, basic(0xff6a3a), p[0], 1.56, p[1], 10);
      var pl = new THREE.PointLight(0xff5a2a, 0.5, 4.5, 1.5);
      pl.position.set(p[0], 1.6, p[1]);
      g.add(pl);
      L.nodeAnchors.push({ x: p[0], y: 1.1, z: p[1], mesh: top, light: pl, alive: true, idx: i });
    });

    // 教师主控台
    addBox(g, 1.8, 0.9, 0.8, M('metal', 1, 1), -3.4, 0.45, -2.2);
    addBox(g, 1.9, 0.06, 0.9, M('metal', 1, 1), -3.4, 0.92, -2.2);
    addBox(g, 0.8, 0.5, 0.04, M('metal', 1, 1), -3.4, 1.3, -2.55);
    addPlane(g, 0.72, 0.42, new THREE.MeshBasicMaterial({ map: baseTex('screen') }), -3.4, 1.3, -2.52, 0, 0);
    addBox(g, 0.2, 0.03, 0.03, basic(0x62d8b0), -3.4, 0.94, -2.0);
    L.anchors.console = { x: -3.4, y: 0.95, z: -2.0 };

    // 闸门（东墙）
    addBox(g, 1.4, 2.6, 0.12, M('metal', 2, 2), 4.88, 1.3, -1.5, -Math.PI / 2);
    addCyl(g, 0.35, 0.35, 0.12, M('rust', 1, 1), 4.8, 1.2, -1.5, 12).rotation.z = Math.PI / 2;
    L.anchors.gate = { x: 4.7, y: 1.2, z: -1.5 };

    // 安全出口（东墙，南侧）
    addBox(g, 1.1, 2.2, 0.12, basic(0x183a24), 4.88, 1.1, 2.3, -Math.PI / 2);
    addPlane(g, 1.0, 2.1, new THREE.MeshBasicMaterial({ map: window.TEX.sign('安全出口', { bg: '#1f4a2c', fg: '#9ff0bc', w: 512, h: 1024, size: 150, border: false }) }), 4.82, 1.1, 2.3, 0, -Math.PI / 2);
    L.anchors.exit = { x: 4.7, y: 1.2, z: 2.3 };

    // 大屏
    for (var s = 0; s < 2; s++) {
      addPlane(g, 3.4, 1.5, new THREE.MeshBasicMaterial({ map: baseTex('screen') }), -1.9 + s * 3.8, 2.9, -3.94, 0, 0);
    }
    addBox(g, 10, 0.3, 0.2, M('metal', 1, 1), 0, 3.9, -4.0);

    // 天花板红光
    var red = new THREE.PointLight(0xff2a18, 0.35, 12, 1.5);
    red.position.set(0, 3.8, 0);
    g.add(red);
    L.redLight = red;

    L.anchors.spawn = { x: 0, z: 3.4, yaw: 0 };
    return L;
  }

  /* ================= 第七幕（战斗版）：更大的核心控制室 ================= */
  function buildCoreArena() {
    var L = newLevel('core', 'core');
    L.chapter = 'CHAPTER 07'; L.title = '最后一课'; L.subtitle = '核心控制室 · 权限层：教师';
    L.fog = { color: 0x050407, density: 0.042 };
    L.ambient = { sky: 0x241a1a, ground: 0x040304, intensity: 0.16 };
    var r = room(L, -7, -6, 7, 6, 4.6, { wallMat: M('metal', 3, 2) });
    var g = L.group;

    // 地面：中心警戒环 + 四角指示灯
    addPlane(g, 6.8, 6.8, M('concrete', 4, 4), 0, 0.015, 0, -Math.PI / 2, 0);
    addPlane(g, 6.8, 6.8, new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.28, depthWrite: false }), 0, 0.022, 0, -Math.PI / 2, 0);
    var ringMat = new THREE.MeshBasicMaterial({ color: 0x8a2418, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    var warnRing = new THREE.Mesh(new THREE.RingGeometry(3.1, 3.35, 48), ringMat);
    warnRing.rotation.x = -Math.PI / 2; warnRing.position.y = 0.06; g.add(warnRing);
    L.warnRing = warnRing;

    // 中央核心（Boss 本体）
    var coreMat = new THREE.MeshStandardMaterial({ color: 0x454c4e, roughness: 0.46, metalness: 0.6 });
    L.coreGroup = new THREE.Group(); g.add(L.coreGroup);
    var cg = L.coreGroup;
    var coreBody = addCyl(cg, 0.82, 1.0, 2.5, coreMat, 0, 1.3, 0, 28);
    coreMat.emissive = new THREE.Color(0x000000);
    L.coreBody = coreBody;
    addCyl(cg, 1.15, 1.2, 0.16, M('metal', 2, 1), 0, 0.08, 0, 24);
    addCyl(cg, 1.06, 1.06, 0.08, basic(0xff6a34, { transparent: true, opacity: 0.6 }), 0, 1.75, 0, 24);
    addCyl(cg, 1.02, 1.02, 0.08, basic(0xff6a34, { transparent: true, opacity: 0.45 }), 0, 0.7, 0, 24);
    addCyl(cg, 0.66, 0.82, 0.16, coreMat, 0, 2.58, 0, 20);
    addCyl(cg, 0.3, 0.4, 0.26, basic(0x241410), 0, 2.76, 0, 12);
    // 正面竖向散热缝
    for (var cf = 0; cf < 3; cf++) {
      addBox(cg, 0.07, 1.6, 0.03, basic(0xff8a4a, { transparent: true, opacity: 0.5 }), -0.26 + cf * 0.26, 1.35, 0.97);
    }
    solid(L, coreBody, 0.14);
    var coreLight = new THREE.PointLight(0xff7a38, 1.3, 16, 1.5);
    coreLight.position.set(0, 2.3, 0);
    cg.add(coreLight);
    L.coreLight = coreLight;
    // 核心的红色扫视眼
    var coreEye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff2a16 }));
    coreEye.position.set(0, 2.95, 0.33);
    cg.add(coreEye);
    L.coreEye = coreEye;
    L.anchors.core = { x: 0, z: 0 };

    // 三个核心节点（每个 5 下；有破损形态与护盾球）
    L.nodeAnchors = [];
    [[0, -4.7], [4.8, 1.8], [-4.8, 1.8]].forEach(function (p, i) {
      var grp = new THREE.Group();
      grp.position.set(p[0], 0, p[1]);
      g.add(grp);
      // 正常
      var normal = new THREE.Group(); grp.add(normal);
      var body = addCyl(normal, 0.27, 0.34, 1.6, M('metal', 1, 1), 0, 0.8, 0, 12);
      var top = addCyl(normal, 0.3, 0.3, 0.12, basic(0xff6a3a), 0, 1.68, 0, 12);
      var pl = new THREE.PointLight(0xff5a2a, 0.9, 5.5, 1.5);
      pl.position.set(0, 1.2, 0); normal.add(pl);
      addBox(normal, 0.46, 0.06, 0.46, M('metal', 1, 1), 0, 0.03, 0);
      // 破损
      var broken = new THREE.Group(); broken.visible = false; grp.add(broken);
      // 断掉的立柱：留一截歪斜的残根，旁边躺着上半截
      var stump = addCyl(broken, 0.25, 0.31, 0.62, M('metal', 1, 1), 0.06, 0.3, 0, 10);
      stump.rotation.z = 0.28;
      var fall = addCyl(broken, 0.22, 0.26, 1.15, M('metal', 1, 1), 0.95, 0.24, 0.3, 10);
      fall.rotation.z = 1.42;
      var topFallen = addCyl(broken, 0.28, 0.28, 0.1, basic(0x5a2a1e), 1.42, 0.2, 0.34, 10);
      topFallen.rotation.z = 1.42;
      addBox(broken, 0.26, 0.18, 0.32, M('rust', 1, 1), 0.55, 0.09, -0.28, 0.5);
      addBox(broken, 0.18, 0.1, 0.22, M('metal', 1, 1), -0.34, 0.06, -0.18, 1.1);
      addBox(broken, 0.12, 0.12, 0.12, M('rust', 1, 1), 0.14, 0.07, 0.55, 0.8);
      addBox(broken, 0.2, 0.05, 0.16, M('rust', 1, 1), -0.15, 0.03, 0.35, 0.3);
      var ember = new THREE.PointLight(0xff3a1a, 0.35, 3.5, 1.6);
      ember.position.set(0.3, 0.35, 0.1); broken.add(ember);
      // 护盾
      var shield = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0x58d9c0, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
      shield.position.y = 0.85; shield.visible = false; grp.add(shield);

      L.nodeAnchors.push({
        x: p[0], y: 1.1, z: p[1], grp: grp, body: body, top: top, light: pl,
        normal: normal, broken: broken, shield: shield, ember: ember,
        alive: true, hp: 5, maxHp: 5, idx: i
      });
    });

    // 教师主控台（西侧）
    addBox(g, 2.0, 0.9, 0.85, M('metal', 1, 1), -4.3, 0.45, -3.9);
    addBox(g, 2.1, 0.06, 0.95, M('metal', 1, 1), -4.3, 0.92, -3.9);
    addBox(g, 0.9, 0.52, 0.05, M('metal', 1, 1), -4.3, 1.32, -4.3);
    addPlane(g, 0.8, 0.44, new THREE.MeshBasicMaterial({ map: baseTex('screen') }), -4.3, 1.32, -4.27, 0, 0);
    addBox(g, 0.22, 0.03, 0.03, basic(0x62d8b0), -4.3, 0.94, -3.55);
    L.anchors.console = { x: -4.3, y: 0.95, z: -3.55 };

    // 数据闸门（东墙偏北）
    addBox(g, 1.6, 2.8, 0.14, M('metal', 2, 2), 6.86, 1.4, -2.2, -Math.PI / 2);
    addCyl(g, 0.4, 0.4, 0.14, M('rust', 1, 1), 6.76, 1.3, -2.2, 14).rotation.z = Math.PI / 2;
    addCyl(g, 0.16, 0.16, 0.1, basic(0xc0392b), 6.7, 2.2, -2.2, 10).rotation.z = Math.PI / 2;
    L.anchors.gate = { x: 6.7, y: 1.2, z: -2.2 };

    // 安全出口（东墙偏南）
    addBox(g, 1.2, 2.3, 0.14, basic(0x183a24), 6.86, 1.15, 2.9, -Math.PI / 2);
    addPlane(g, 1.1, 2.2, new THREE.MeshBasicMaterial({ map: window.TEX.sign('安全出口', { bg: '#1f4a2c', fg: '#9ff0bc', w: 512, h: 1024, size: 150, border: false }) }), 6.78, 1.15, 2.9, 0, -Math.PI / 2);
    L.anchors.exit = { x: 6.7, y: 1.2, z: 2.9 };

    // 北墙大屏
    for (var s = 0; s < 2; s++) {
      addPlane(g, 3.6, 1.6, new THREE.MeshBasicMaterial({ map: baseTex('screen') }), -2.4 + s * 4.8, 3.0, -5.94, 0, 0);
    }
    addBox(g, 14, 0.3, 0.2, M('metal', 1, 1), 0, 4.1, -6.0);

    // 四角机柜，给场地一点参照物
    [[-5.6, 4.4], [5.6, 4.4], [-5.6, -5.0], [5.6, -5.0]].forEach(function (q) {
      addBox(g, 1.3, 1.9, 0.9, M('metal', 1, 1), q[0], 0.95, q[1]);
      addPlane(g, 1.2, 0.12, basic(0x2f6a55), q[0], 1.6, q[1] + (q[1] > 0 ? -0.46 : 0.46), 0, 0);
    });

    // 天花板红光
    var red = new THREE.PointLight(0xff2a18, 0.45, 16, 1.5);
    red.position.set(0, 4.2, 0);
    g.add(red);
    L.redLight = red;

    L.anchors.spawn = { x: 0, z: 5.0, yaw: 0 };
    return L;
  }

  /* ================= 天亮走廊（结局演出） ================= */
  function buildDawn() {
    var L = newLevel('dawn', 'dawn');
    L.fog = { color: 0x101418, density: 0.02 };
    L.ambient = { sky: 0x8fa4b2, ground: 0x2a2f33, intensity: 1.1 };
    var r = room(L, -2.3, -18, 2.3, 0.2, 3.2, { wallMat: M('wall', 2, 1.3) });
    var g = L.group;

    // 晨光窗户
    for (var i = 0; i < 4; i++) {
      addPlane(g, 1.6, 1.5, new THREE.MeshBasicMaterial({ color: 0xd6e2e8 }), -2.24, 1.9, -3.5 - i * 4.2, 0, Math.PI / 2);
      var dl = new THREE.PointLight(0xfff2d6, 0.85, 8, 1.2);
      dl.position.set(-1.4, 2.0, -3.5 - i * 4.2);
      g.add(dl);
    }
    lamp(L, 0, 3.05, -1.6, { len: 1.4, intensity: 0.4, distance: 8, lightColor: 0xeaf4ff });
    lamp(L, 0, 3.05, -9.0, { len: 1.4, intensity: 0.4, distance: 8, lightColor: 0xeaf4ff });
    L.anchors.teacher = { x: 0, y: 0, z: -13.5 };
    L.anchors.spawn = { x: 0, z: 0.1, yaw: 0 };
    return L;
  }

  var builders = {
    classroom: buildClassroom,
    corridor: buildCorridor,
    bathroom: buildBathroom,
    archive: buildArchive,
    stairs: buildStairwell,
    server: buildServer,
    core: buildCoreArena,
    dawn: buildDawn
  };

  window.buildLevels = function () {
    var out = {};
    Object.keys(builders).forEach(function (k) { out[k] = builders[k](); });
    return out;
  };
  window.LEVEL_MAT = M;
})();
