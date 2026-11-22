/* 鹏城暗码 3D · 主逻辑 */
(function () {
  'use strict';
  var THREE = window.THREE;

  var $ = function (id) { return document.getElementById(id); };
  var G = {
    renderer: null, scene: null, camera: null, clock: null,
    levels: {}, cur: null, curId: '', colliders: [],
    player: { pos: new THREE.Vector3(0, 0, 0), yaw: 0, pitch: 0, vy: 0, eye: 1.62, r: 0.30, stamina: 100, crouch: false },
    keys: {}, hidden: null, playing: false, paused: false, cutscene: false,
    interactables: [], focus: null, flashOn: true, sens: 1, exposure: 1,
    quality: 'mid', menu: true, ready: false, dead: false, ending: false,
    timer: null, hideMask: null, bob: 0, stepAcc: 0, dust: null
  };
  window.GAME = G;

  var ST = {
    chapter: 1, level: 'classroom', phoneRead: false, phoneUsed: false,
    clues: { book: false, badge: false, sticky: false, paper: false, sheet: false },
    codeOk: false, keyTaken: false, hasKey: false, hasLog: false, hasDisk: false,
    hasAxe: false, hasBattery: false, glassBroken: false, bathScare: false,
    alarm: false, nodesAlive: 3, truth: false, gateOpen: false, resetUsed: false,
    nodesImmuneUntil: 0,
    checkpoint: 'classroom', deaths: 0, seenCorridor: false, end: '',
    lockerIndex: -1, throwState: {}
  };
  window.ST = ST;

  var ENDINGS = {
    escape: { no: '01', title: '逃离结局', sub: '补训仍未完成', desc: '你砸开了安全通道，却没能走出楼梯间。空间锚点把你留在了补训的走廊里。' },
    archive: { no: '02', title: '强制归档', sub: '你倒在了核心控制室', desc: '系统没有为你保留最后一节课的下课铃。你的学情记录被补全、盖章、封存。' },
    truth: { no: '03', title: '真相结局', sub: '被保留的一节课', desc: '你带回了梁老师手写的日志。系统第一次没有替你写下结论。' },
    silence: { no: '04', title: '沉默结局', sub: '下课铃没有响', desc: '你砍碎了所有节点，却没有带回能证明“人”的东西。系统停了，那句话还在循环。' },
    noaxe: { no: '05', title: 'Bad Ending', sub: '未挥下的斧头', desc: '你没能破坏任何一个核心节点。系统把这次反抗写进了一份更短的档案。' }
  };

  /* ================= 初始化 ================= */
  function initRenderer() {
    var canvas = $('gl');
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    G.renderer = renderer;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04070a);
    G.scene = scene;

    var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 80);
    camera.rotation.order = 'YXZ';
    scene.add(camera);
    G.camera = camera;

    var hemi = new THREE.HemisphereLight(0x243441, 0x05070a, 0.2);
    scene.add(hemi);
    G.hemi = hemi;

    // 手电
    var flash = new THREE.SpotLight(0xffe9c6, 3.1, 26, 0.62, 0.35, 1.15);
    flash.position.set(0.08, -0.06, 0.02);
    flash.castShadow = true;
    flash.shadow.mapSize.set(1024, 1024);
    flash.shadow.camera.near = 0.15;
    flash.shadow.camera.far = 22;
    flash.shadow.bias = -0.0006;
    camera.add(flash);
    var target = new THREE.Object3D();
    target.position.set(0, 0, -3);
    camera.add(target);
    flash.target = target;
    G.flash = flash;

    // 玩家脚边的微弱补光
    var fill = new THREE.PointLight(0x7c96a0, 0.18, 3.2, 1.4);
    camera.add(fill);

    G.clock = new THREE.Clock();

    // 灰尘
    var count = 420, geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = Math.random() * 3.4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({ color: 0xd9e6e8, size: 0.022, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
    var dust = new THREE.Points(geo, mat);
    dust.frustumCulled = false;
    scene.add(dust);
    G.dust = dust;

    applyQuality('mid');
    window.addEventListener('resize', onResize);
  }

  function onResize() {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  function applyQuality(q) {
    G.quality = q;
    var dpr = window.devicePixelRatio || 1;
    if (q === 'high') {
      G.renderer.setPixelRatio(Math.min(dpr, 2));
      G.flash.castShadow = true;
      G.flash.shadow.mapSize.set(2048, 2048);
    } else if (q === 'low') {
      G.renderer.setPixelRatio(1);
      G.flash.castShadow = false;
    } else {
      G.renderer.setPixelRatio(Math.min(dpr, 1.5));
      G.flash.castShadow = true;
      G.flash.shadow.mapSize.set(1024, 1024);
    }
    if (G.flash.shadow.map) { G.flash.shadow.map.dispose(); G.flash.shadow.map = null; }
    G.renderer.shadowMap.enabled = q !== 'low';
    G.renderer.shadowMap.needsUpdate = true;
  }

  /* ================= 场景装配 ================= */
  function buildAll() {
    G.levels = window.buildLevels();
    Object.keys(G.levels).forEach(function (k) {
      var L = G.levels[k];
      L.group.visible = false;
      G.scene.add(L.group);
    });
    buildRobot();
    buildHunter();
    G.ready = true;
  }

  function buildRobot() {
    var g = new THREE.Group();
    var dark = new THREE.MeshStandardMaterial({ color: 0x2b3133, roughness: 0.5, metalness: 0.65 });
    var headMat = new THREE.MeshStandardMaterial({ color: 0x1d2224, roughness: 0.62, metalness: 0.35 });
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.18, 18), dark);
    base.position.y = 0.2; base.castShadow = true; g.add(base);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.022, 6, 20), new THREE.MeshBasicMaterial({ color: 0x8a1c14 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.11; g.add(ring);
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19, 0.58, 14), dark);
    body.position.y = 0.58; body.castShadow = true; g.add(body);
    // 肩架
    var shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.1, 12), dark);
    shoulder.position.y = 0.9; shoulder.castShadow = true; g.add(shoulder);
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.22, 8), dark);
    mast.position.y = 1.03; g.add(mast);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.24), headMat);
    head.position.y = 1.19; head.castShadow = true; g.add(head);
    // 镜头护罩
    var hood = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.06), headMat);
    hood.position.set(0, 1.19, 0.14); g.add(hood);
    // 侧面支架
    [-1, 1].forEach(function (sx) {
      var br = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.1), dark);
      br.position.set(sx * 0.155, 1.19, 0); g.add(br);
    });
    var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.068, 0.05, 14), new THREE.MeshBasicMaterial({ color: 0x180504 }));
    lens.rotation.x = Math.PI / 2; lens.position.set(0, 1.19, 0.17); g.add(lens);
    var pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    pupil.position.set(0, 1.19, 0.195); g.add(pupil);
    // 镜头外的红色光晕，近看像一颗发红的眼睛
    var halo = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff2a14, transparent: true, opacity: 0.22 }));
    halo.position.set(0, 1.19, 0.21); g.add(halo);
    // 胸口指示灯
    var chest = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0xff3a22 }));
    chest.position.set(0, 0.66, 0.18); g.add(chest);
    // 天线
    var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), dark);
    ant.position.set(0.1, 1.36, -0.02); g.add(ant);
    g.userData.pupil = pupil;
    // 扫描灯
    var scan = new THREE.SpotLight(0xff2f1e, 0.9, 10, 0.4, 0.6, 1.2);
    scan.position.set(0, 1.19, 0.06);
    var st = new THREE.Object3D(); st.position.set(0, 0.1, 3.6);
    g.add(st); scan.target = st;
    scan.castShadow = false;
    g.add(scan);
    g.userData.scan = scan;
    g.userData.body = body;
    g.visible = false;
    G.scene.add(g);
    G.robot = { grp: g, pos: new THREE.Vector3(0, 0, -6), heading: Math.PI, state: 'patrol', wp: 0, dir: 1, alert: 0, lose: 0, lastSeen: new THREE.Vector3(), sawT: 0, speed: 1.25, catchT: 0, visible: false };
  }

  function buildHunter() {
    var g = new THREE.Group();
    var eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2010 }));
    eye.position.y = 1.25; g.add(eye);
    var glow = new THREE.PointLight(0xff2414, 0.7, 5.5, 1.6);
    glow.position.set(0, 1.25, 0.05); g.add(glow);
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.3, 8), new THREE.MeshStandardMaterial({ color: 0x101416, roughness: 0.6, metalness: 0.5 }));
    body.position.y = 0.65; g.add(body);
    g.visible = false;
    G.scene.add(g);
    G.hunter = { grp: g, pos: new THREE.Vector3(0, 0, 0), target: null, speed: 1.9, stun: 0, idle: 0, visible: false };
  }

  /* ================= 关卡切换 ================= */
  function setLevel(id, pos) {
    if (G.cur) G.cur.group.visible = false;
    var L = G.levels[id];
    G.cur = L; G.curId = id;
    ST.level = id;
    L.group.visible = true;
    G.colliders = L.colliders;
    G.scene.fog = new THREE.FogExp2(L.fog.color, L.fog.density);
    G.scene.background = new THREE.Color(L.fog.color);
    G.hemi.color.setHex(L.ambient.sky);
    G.hemi.groundColor.setHex(L.ambient.ground);
    G.hemi.intensity = L.ambient.intensity;
    if (window.AU) AU.setAmbience(L.ambience);

    var sp = pos || L.anchors.spawn || { x: 0, z: 0, yaw: 0 };
    G.player.pos.set(sp.x, 0, sp.z);
    G.player.yaw = sp.yaw || 0;
    G.player.pitch = 0;
    G.player.stamina = 100;
    G.player.crouch = false;
    G.hidden = null;
    G.camera.position.set(sp.x, G.player.eye, sp.z);
    G.camera.rotation.set(0, G.player.yaw, 0);

    G.robot.grp.visible = false; G.robot.visible = false;
    G.hunter.grp.visible = false; G.hunter.visible = false;
    G.robot.grp.scale.set(1, 1, 1);
    G.jumpscare = null;
    G.camera.fov = 70; G.camera.updateProjectionMatrix();
    $('rededge').style.opacity = '0';
    $('hud').style.opacity = '1';
    $('crosshair').style.display = 'block';

    // 切场景时清掉上一幕残留的字幕
    SUB.active = false; SUB.done = null; SUB.lines = []; G.dialog = false;
    clearTimeout(SUB.timer);
    $('subtitle').style.display = 'none';

    setupInteractions(id);
    updateHUD();
  }

  function transitionTo(id, pos, after) {
    if (G.transitioning) return;
    G.transitioning = true;
    G.paused = true;
    $('fade').classList.add('on');
    setTimeout(function () {
      setLevel(id, pos);
      showChapter(G.cur);
      setTimeout(function () {
        $('fade').classList.remove('on');
        G.paused = false;
        G.transitioning = false;
        if (after) after();
      }, 460);
    }, 460);
  }

  function showChapter(L) {
    if (!L.chapter) return;
    $('chNo').textContent = L.chapter;
    $('chTitle').textContent = L.title || '';
    $('chSub').textContent = L.subtitle || '';
    var card = $('chapterCard');
    card.style.display = 'flex';
    card.style.opacity = '1';
    card.style.transition = 'opacity .8s';
    clearTimeout(G.chTimer);
    G.chTimer = setTimeout(function () {
      card.style.opacity = '0';
      setTimeout(function () { card.style.display = 'none'; }, 900);
    }, 2600);
  }

  /* ================= UI ================= */
  function setObjective(t) { $('objText').innerHTML = t; }
  function updateHUD() {
    var names = [];
    if (ST.hasKey) names.push('档案室钥匙');
    if (ST.hasAxe) names.push('消防斧');
    if (ST.hasLog) names.push('教学日志');
    if (ST.hasDisk) names.push('核心数据盘');
    if (ST.hasBattery) names.push('备用电池');
    $('itemText').innerHTML = names.length ? names.join('<br>') : '无';
  }

  function updateBlockHud() {
    var el = $('blockHud');
    if (!el) return;
    if (!ST.hasAxe || G.menu || G.ending) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    var now = performance.now(), txt = $('blockCd'), bar = $('blockBar');
    if (now < G.block.invulnUntil) {
      txt.textContent = '无敌 ' + ((G.block.invulnUntil - now) / 1000).toFixed(1) + 's';
      bar.style.width = '100%';
    } else if (now < G.block.activeUntil) {
      txt.textContent = '格挡中';
      bar.style.width = '100%';
    } else if (now < G.block.readyAt) {
      txt.textContent = '冷却 ' + Math.ceil((G.block.readyAt - now) / 1000) + 's';
      bar.style.width = (100 - (G.block.readyAt - now) / BLOCK_CD * 100).toFixed(0) + '%';
    } else {
      txt.textContent = 'Q · 格挡';
      bar.style.width = '100%';
    }
  }

  var SUB = { lines: [], i: 0, active: false, done: null, timer: 0 };
  function say(lines, done, autoMs) {
    SUB.lines = [];
    for (var i = 0; i < lines.length; i++) {
      if (typeof lines[i] === 'string') SUB.lines.push({ sp: '', tx: lines[i] });
      else SUB.lines.push({ sp: lines[i][0], tx: lines[i][1] });
    }
    SUB.i = 0; SUB.active = true; SUB.done = done || null;
    SUB.auto = autoMs || 0;
    G.dialog = true;
    subRender();
  }
  function subRender() {
    if (!SUB.active) { $('subtitle').style.display = 'none'; return; }
    var l = SUB.lines[SUB.i];
    if (!l) { endSub(); return; }
    $('subtitle').style.display = 'block';
    $('subSp').textContent = l.sp || '';
    $('subSp').style.display = l.sp ? 'block' : 'none';
    $('subTx').textContent = l.tx;
    if (SUB.auto) {
      clearTimeout(SUB.timer);
      // 按字数给足阅读时间：短句至少 3.2 秒，长句最多 8 秒
      var readMs = Math.min(8000, Math.max(3200, 1100 + l.tx.length * 170));
      SUB.timer = setTimeout(function () { advanceSub(); }, Math.max(SUB.auto, readMs));
    }
  }
  function advanceSub() {
    if (!SUB.active) return;
    clearTimeout(SUB.timer);
    SUB.i++;
    if (SUB.i >= SUB.lines.length) endSub();
    else subRender();
  }
  function endSub() {
    SUB.active = false; G.dialog = false;
    $('subtitle').style.display = 'none';
    var d = SUB.done; SUB.done = null;
    if (d) d();
  }

  function toast(txt, ms) {
    var t = $('toast');
    t.textContent = txt;
    t.classList.add('on');
    clearTimeout(G.toastTimer);
    G.toastTimer = setTimeout(function () { t.classList.remove('on'); }, ms || 2400);
  }

  function readNote(title, body, sig) {
    openOverlay('note');
    $('noteTitle').textContent = title;
    $('noteBody').innerHTML = body;
    $('noteSig').textContent = sig || '';
    if (window.AU) AU.noise(0.2, 0.06, 2200, 'bandpass');
  }

  function openOverlay(id) {
    G.paused = true;
    G.overlay = id;
    $(id).style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function closeOverlay(id) {
    $(id).style.display = 'none';
    G.overlay = null;
    if (G.playing && !G.dead && !G.ending) {
      G.paused = false;
      requestLock();
    }
  }

  function showPrompt(txt) {
    if (!txt) { $('prompt').style.display = 'none'; return; }
    $('prompt').style.display = 'block';
    $('promptText').textContent = txt;
  }

  function setTimer(seconds, label, onEnd) {
    G.timer = { end: performance.now() + seconds * 1000, label: label || '', onEnd: onEnd, dur: seconds };
    $('timer').style.display = 'block';
  }
  function clearTimer() { G.timer = null; $('timer').style.display = 'none'; }

  /* ================= 玩家 ================= */
  function requestLock() {
    var c = $('gl');
    if (c.requestPointerLock) c.requestPointerLock();
  }

  function collide(x, z, r) {
    var cols = G.colliders;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true;
    }
    return false;
  }

  function updatePlayer(dt) {
    var p = G.player;
    var fwd = 0, side = 0;
    if (G.keys['w'] || G.keys['arrowup']) fwd += 1;
    if (G.keys['s'] || G.keys['arrowdown']) fwd -= 1;
    if (G.keys['a'] || G.keys['arrowleft']) side -= 1;
    if (G.keys['d'] || G.keys['arrowright']) side += 1;

    if (G.hidden) {
      // 柜子里只能左右微调视角
      return;
    }

    var run = (G.keys['shift']) && p.stamina > 2 && fwd > 0 && !p.crouch;
    p.crouch = !!G.keys['c'];
    var speed = p.crouch ? 1.25 : (run ? 5.0 : 2.45);
    if (run) p.stamina = Math.max(0, p.stamina - dt * 20);
    else p.stamina = Math.min(100, p.stamina + dt * 13);

    var len = Math.hypot(fwd, side);
    if (len > 0) {
      fwd /= len; side /= len;
      var fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      var rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      var dx = (fx * fwd + rx * side) * speed * dt;
      var dz = (fz * fwd + rz * side) * speed * dt;
      var nx = p.pos.x + dx;
      if (!collide(nx, p.pos.z, p.r)) p.pos.x = nx;
      var nz = p.pos.z + dz;
      if (!collide(p.pos.x, nz, p.r)) p.pos.z = nz;

      G.bob += dt * (run ? 11 : (p.crouch ? 4.4 : 7.4));
      G.stepAcc += speed * dt;
      var stride = run ? 1.55 : (p.crouch ? 0.78 : 1.15);
      if (G.stepAcc > stride) {
        G.stepAcc = 0;
        if (window.AU) AU.footstep(run, G.curId === 'bathroom');
        if (G.curId === 'server') hunterHear(p.pos, run ? 9.5 : (p.crouch ? 1.4 : 4.2));
      }
    } else {
      G.bob += dt * 1.2;
    }

    // 体力条
    drawStamina();

    var bobY = Math.sin(G.bob) * (run ? 0.05 : 0.028);
    var bobX = Math.cos(G.bob * 0.5) * (run ? 0.03 : 0.016);
    var eye = p.crouch ? 0.98 : p.eye;
    var shake = 0;
    if (G.cameraShake > 0) {
      G.cameraShake = Math.max(0, G.cameraShake - dt * 1.6);
      shake = G.cameraShake * (Math.random() - 0.5) * 0.06;
    }
    G.camera.position.set(p.pos.x + bobX * 0.2, eye + bobY, p.pos.z);
    G.camera.rotation.set(p.pitch + shake, p.yaw + shake, Math.sin(G.bob * 0.5) * 0.006);
  }

  function drawStamina() {
    if (!G.stamEl) {
      G.stamEl = document.createElement('div');
      G.stamEl.style.cssText = 'position:absolute;left:50%;bottom:24px;transform:translateX(-50%);width:160px;height:2px;background:rgba(255,255,255,.12);z-index:30';
      G.stamEl.innerHTML = '<i style="display:block;height:100%;width:100%;background:#6f8f95;transition:width .1s"></i>';
      $('hud').appendChild(G.stamEl);
    }
    var i = G.stamEl.firstChild;
    i.style.width = G.player.stamina.toFixed(0) + '%';
    i.style.background = G.player.stamina < 22 ? '#a3603a' : '#6f8f95';
    G.stamEl.style.opacity = (G.player.stamina > 97 || G.hidden) ? 0.15 : 0.85;
  }

  function updateCameraOnly() {
    var p = G.player;
    G.camera.rotation.set(p.pitch, p.yaw, 0);
  }

  /* ================= 交互 ================= */
  function addInter(x, z, label, prompt, fn, opt) {
    opt = opt || {};
    var e = {
      pos: new THREE.Vector3(x, opt.y || 1.1, z),
      label: label, prompt: prompt, fn: fn,
      range: opt.range || 1.9, disabled: false, hide: !!opt.hide
    };
    G.interactables.push(e);
    return e;
  }

  function updateFocus() {
    if (G.dialog || G.overlay || G.hidden || G.cutscene) { showPrompt(''); G.focus = null; return; }
    var best = null, bestScore = 1e9;
    var fx = -Math.sin(G.player.yaw), fz = -Math.cos(G.player.yaw);
    for (var i = 0; i < G.interactables.length; i++) {
      var e = G.interactables[i];
      if (e.disabled) continue;
      var dx = e.pos.x - G.player.pos.x, dz = e.pos.z - G.player.pos.z;
      var d = Math.hypot(dx, dz);
      if (d > e.range) continue;
      var dot = 1;
      if (d > 0.2) dot = (dx / d) * fx + (dz / d) * fz;
      if (dot < 0.25) continue;
      // 准心越正中越优先，距离次之
      var score = d * (1 + 1.6 * (1 - dot));
      if (score < bestScore) { bestScore = score; best = e; }
    }
    G.focus = best;
    showPrompt(best ? best.prompt : '');
  }

  function doInteract() {
    if (G.dialog) { advanceSub(); return; }
    if (G.overlay) return;
    if (G.dead || G.ending) return;
    if (G.hidden) { exitHide(); return; }
    if (G.focus && !G.focus.disabled) {
      var f = G.focus;
      G.focus = null;
      f.fn(f);
    }
  }

  /* ================= 躲柜子 ================= */
  function ensureMask() {
    if (G.hideMask) return;
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:25;pointer-events:none;display:none;' +
      'background:repeating-linear-gradient(90deg,rgba(0,0,0,.93) 0 18px,rgba(0,0,0,.38) 18px 26px,rgba(0,0,0,.93) 26px 48px),' +
      'radial-gradient(ellipse at center,rgba(0,0,0,0) 20%,rgba(0,0,0,.92) 62%)';
    document.body.appendChild(m);
    G.hideMask = m;
  }
  function enterHide(idx) {
    var a = G.cur.anchors.locker[idx];
    if (!a) return;
    ensureMask();
    G.lockerKnock = false;
    G.hideMask.style.display = 'block';
    G.hidden = { idx: idx, t: 0 };
    var p = G.player;
    p.pos.set(a.x, 0, a.z);
    p.yaw = -Math.PI / 2;  // 面向东（柜门外）
    p.pitch = 0;
    G.camera.position.set(a.x, 1.59, a.z);
    if (window.AU) AU.locker();
    showPrompt('');
    toast('你躲进了柜子。屏住呼吸。', 1800);
  }
  function exitHide() {
    if (!G.hidden) return;
    var a = G.cur.anchors.locker[G.hidden.idx];
    G.hidden = null;
    if (G.hideMask) G.hideMask.style.display = 'none';
    G.player.pos.set(a.x + 0.45, 0, a.z);
    G.player.yaw = -Math.PI / 2;
    if (window.AU) AU.locker();
  }

  /* ================= 机器人 ================= */
  function placeRobot(x, z, heading, mode) {
    var r = G.robot;
    r.pos.set(x, 0, z);
    r.heading = heading;
    r.state = mode || 'patrol';
    r.alert = 0; r.lose = 0; r.wp = 0; r.dir = 1; r.catchT = 0;
    r.grp.position.set(x, 0, z);
    r.grp.rotation.y = heading;
    r.grp.visible = true;
    r.visible = true;
  }
  // 2D 线段与碰撞盒求交：遮挡视线（墙、柜子、机柜）
  function segBlocked(ax, az, bx, bz) {
    var cols = G.colliders, dx = bx - ax, dz = bz - az;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i], tmin = 0, tmax = 1;
      if (Math.abs(dx) < 1e-6) {
        if (ax < c.x0 || ax > c.x1) continue;
      } else {
        var t1 = (c.x0 - ax) / dx, t2 = (c.x1 - ax) / dx;
        if (t1 > t2) { var tt = t1; t1 = t2; t2 = tt; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      if (Math.abs(dz) < 1e-6) {
        if (az < c.z0 || az > c.z1) continue;
      } else {
        var s1 = (c.z0 - az) / dz, s2 = (c.z1 - az) / dz;
        if (s1 > s2) { var ss = s1; s1 = s2; s2 = ss; }
        tmin = Math.max(tmin, s1); tmax = Math.min(tmax, s2);
        if (tmin > tmax) continue;
      }
      if (tmax > 0.02 && tmin < 0.98) return true;
    }
    return false;
  }
  function robotSees() {
    var r = G.robot, p = G.player;
    if (G.hidden) return false;
    var dx = p.pos.x - r.pos.x, dz = p.pos.z - r.pos.z;
    var d = Math.hypot(dx, dz);
    r.lastD = d;
    if (d > 11.5) return false;
    if (d > 1.2 && segBlocked(r.pos.x, r.pos.z, p.pos.x, p.pos.z)) return false;
    var dot = (dx / (d || 1)) * Math.sin(r.heading) + (dz / (d || 1)) * Math.cos(r.heading);
    return dot > 0.72;
  }
  /* ================= 格挡技能（持斧可用） ================= */
  var BLOCK_CD = 20000, BLOCK_ACTIVE = 900, BLOCK_INVULN = 2000;
  G.block = { readyAt: 0, activeUntil: 0, invulnUntil: 0 };

  function tryBlock() {
    if (!ST.hasAxe) { showToastLine('没有斧子，挡不住。'); return; }
    if (G.dead || G.ending || !G.playing || G.paused) return;
    var now = performance.now();
    if (now < G.block.readyAt) {
      showToastLine('格挡还在冷却（' + Math.ceil((G.block.readyAt - now) / 1000) + ' 秒）');
      return;
    }
    G.block.activeUntil = now + BLOCK_ACTIVE;
    G.block.readyAt = now + BLOCK_CD;
    if (window.AU) AU.beep(420, 0.08, 0.04);
    showToastLine('格挡姿态 · 1 秒内能挡下一次攻击');
  }

  // 返回 true 表示这次伤害被挡掉/免伤
  function blockHit() {
    var now = performance.now();
    if (now < G.block.invulnUntil) return true;
    if (now < G.block.activeUntil) {
      G.block.activeUntil = 0;
      G.block.invulnUntil = now + BLOCK_INVULN;
      if (window.AU) AU.success();
      flashRed();
      showToastLine('格挡成功 · 2 秒无敌');
      return true;
    }
    return false;
  }

  function robotCatch() {
    if (G.dead || G.ending || G.hidden) return;
    var d = Math.hypot(G.player.pos.x - G.robot.pos.x, G.player.pos.z - G.robot.pos.z);
    if (d < 1.0) {
      if (blockHit()) {
        // 被格挡：巡察体被推开，进入搜索
        var r = G.robot;
        var ang = Math.atan2(r.pos.x - G.player.pos.x, r.pos.z - G.player.pos.z);
        r.pos.set(G.player.pos.x + Math.sin(ang) * 4.6, 0, G.player.pos.z + Math.cos(ang) * 4.6);
        r.grp.position.copy(r.pos);
        r.state = 'search'; r.searchT = 0; r.alert = 0; r.lose = 0;
        r.lastSeen.copy(G.player.pos);
        r.grp.userData.scan.intensity = 0.6;
        return;
      }
      G.dead = true; G.paused = true; G.playing = false;
      if (window.AU) AU.stinger();
      flashRed();
      showPrompt('');
      startJumpscare();
      clearTimeout(G.deathTimer);
      G.deathTimer = setTimeout(showDeathPanel, 1250);
    }
  }

  // 被抓住：巡察体贴到脸上，镜头被压下去，然后才弹死亡面板
  function startJumpscare() {
    var p = G.player, r = G.robot;
    p.pitch = -0.2;
    G.jumpscare = { t0: performance.now() };
    r.grp.visible = true; r.visible = true;
    r.grp.scale.set(1.18, 1.05, 1.18);
    r.state = 'chase';
    if (r.grp.userData.scan) r.grp.userData.scan.intensity = 2.6;
    if (r.grp.userData.pupil) r.grp.userData.pupil.material.color.setHex(0xff1a0e);
    $('rededge').style.opacity = 0.9;
    $('hud').style.opacity = '0';
    showPrompt('');
  }

  function updateJumpscare() {
    var p = G.player, r = G.robot, js = G.jumpscare;
    var e = Math.min(1, (performance.now() - js.t0) / 1250);
    var fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    // 巡察体升到脸前，从 1.05 米推到 0.68 米（不穿模）
    var dist = 1.05 - 0.37 * e;
    var lift = 0.3 + 0.06 * e;
    var rx = p.pos.x + fx * dist, rz = p.pos.z + fz * dist;
    r.grp.position.set(rx, lift, rz);
    // 镜头朝 +z，让它正对玩家
    r.heading = p.yaw;
    r.grp.rotation.y = r.heading;
    var shake = 0.03 * (1 - e * 0.5);
    var jx = (Math.random() - 0.5) * shake, jy = (Math.random() - 0.5) * shake;
    G.camera.position.set(p.pos.x + fx * 0.02, 1.54 + jy, p.pos.z + fz * 0.02);
    G.camera.fov = 70 - 18 * e;
    G.camera.updateProjectionMatrix();
    G.camera.lookAt(rx + jx, 1.19 + lift + 0.02 + jy, rz);
    var f = $('flash');
    if (f) f.style.opacity = String(0.2 + 0.45 * (1 - e));
  }

  function showDeathPanel(msg) {
    G.jumpscare = null;
    if (G.robot.grp) G.robot.grp.scale.set(1, 1, 1);
    G.camera.fov = 70; G.camera.updateProjectionMatrix();
    $('flash').style.opacity = '0';
    $('hud').style.opacity = '1';
    $('crosshair').style.display = 'block';
    $('deadText').textContent = msg || '巡察体把你按在了地砖上。\n系统记录：异常滞留 · 已回收。';
    $('dead').style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function updateRobot(dt) {
    var r = G.robot, p = G.player;
    if (!r.visible) return;
    var sees = robotSees();
    if (r.summoned) sees = true;
    if (sees) {
      r.lastSeen.copy(p.pos); r.sawT = performance.now();
      if (r.state === 'patrol') {
        r.state = 'alert'; r.alert = 0;
        if (window.AU) AU.servo(true);
        G.robot.grp.userData.scan.intensity = 1.5;
      }
      if (r.state === 'alert') {
        r.alert += dt;
        if (r.alert > 0.75) { r.state = 'chase'; if (window.AU) AU.alarm(); }
      }
      if (r.state === 'search') r.state = 'chase';
      // 面向玩家
      var hx = p.pos.x - r.pos.x, hz = p.pos.z - r.pos.z;
      var want = Math.atan2(hx, hz);
      r.heading = lerpAngle(r.heading, want, dt * (r.state === 'chase' ? 7 : 3));
    } else if (r.state === 'chase') {
      r.lose += dt;
      if (r.lose > 3.2) { r.state = 'search'; r.searchT = 0; r.lastSeen.copy(p.pos); }
    } else if (r.state === 'alert') {
      // 玩家躲起来后，警戒会衰减：不再傻站着盯柜子
      r.alert += dt;
      if (r.alert > 2.0) { r.state = 'search'; r.searchT = 0; r.lastSeen.copy(p.pos); }
    }

    var speed = r.state === 'chase' ? 3.35 : (r.state === 'alert' ? 0.5 : 1.25);
    var tx = r.pos.x, tz = r.pos.z;
    if (r.state === 'patrol') {
      var wps = G.cur.anchors.robotWaypoints || [-18, -4];
      var target = wps[Math.min(r.wp, wps.length - 1)];
      tz = target;
      tx = 0;
      if (Math.abs(tz - r.pos.z) < 0.25) { r.wp = (r.wp + 1) % wps.length; }
      var wantH = Math.atan2(tx - r.pos.x, tz - r.pos.z);
      r.heading = lerpAngle(r.heading, wantH, dt * 2.4);
    } else if (r.state === 'chase' || r.state === 'alert') {
      tx = r.lastSeen.x; tz = r.lastSeen.z;
      var wantH2 = Math.atan2(tx - r.pos.x, tz - r.pos.z);
      r.heading = lerpAngle(r.heading, wantH2, dt * 6);
    } else if (r.state === 'search') {
      r.searchT += dt;
      tx = r.lastSeen.x; tz = r.lastSeen.z;
      if (Math.hypot(tx - r.pos.x, tz - r.pos.z) < 0.6) {
        r.heading += dt * 1.5;
        // 在柜子旁搜一下就放弃，不再长期蹲守
        if (r.searchT > 2.4) {
          r.state = 'patrol';
          r.wp = r.pos.z < -9 ? 4 : 0;
          if (G.hidden && !G.lockerKnock) {
            G.lockerKnock = true;
            if (window.AU) AU.locker();
            toast('它停在柜门外，敲了两下。然后脚步声走远了。', 3000);
          }
        }
      }
    }

    // 朝向前进
    if (r.state !== 'search') {
      var vx = tx - r.pos.x, vz = tz - r.pos.z;
      var dist = Math.hypot(vx, vz);
      if (dist > 0.05) {
        var step = Math.min(speed * dt, dist);
        var nx = r.pos.x + (Math.sin(r.heading)) * step;
        var nz = r.pos.z + (Math.cos(r.heading)) * step;
        if (!collide(nx, r.pos.z, 0.42)) r.pos.x = nx;
        if (!collide(r.pos.x, nz, 0.42)) r.pos.z = nz;
        r.grp.position.set(r.pos.x, 0, r.pos.z);
        r.grp.rotation.y = r.heading;
      }
    }
    // 悬浮 + LED
    var t = performance.now() * 0.001;
    r.grp.position.y = Math.sin(t * 3.1) * 0.02 + 0.02;
    var pupil = r.grp.userData.pupil;
    pupil.material.color.setHex(r.state === 'patrol' ? 0x8a1a10 : 0xff2a18);
    r.grp.userData.scan.intensity = r.state === 'patrol' ? 0.8 : (r.state === 'alert' ? 1.4 : 1.9);
    robotCatch();
  }

  function lerpAngle(a, b, t) {
    while (b - a > Math.PI) b -= Math.PI * 2;
    while (b - a < -Math.PI) b += Math.PI * 2;
    return a + (b - a) * Math.min(1, t);
  }

  /* ================= 盲眼猎手 ================= */
  function hunterHear(pos, radius) {
    var h = G.hunter;
    if (!h.visible || h.stun > 0) return;
    var d = Math.hypot(pos.x - h.pos.x, pos.z - h.pos.z);
    if (d < radius) {
      h.target = new THREE.Vector3(pos.x, 0, pos.z);
      h.idle = 0;
      if (window.AU) AU.servo(false);
    }
  }
  function updateHunter(dt) {
    var h = G.hunter;
    if (!h.visible) return;
    if (h.stun > 0) {
      h.stun -= dt;
      h.grp.children[1].intensity = 0.15;
      return;
    }
    h.grp.children[1].intensity = 0.7;
    if (h.target) {
      var dx = h.target.x - h.pos.x, dz = h.target.z - h.pos.z;
      var d = Math.hypot(dx, dz);
      if (d < 0.4) {
        h.idle += dt;
        if (h.idle > 2.2) h.target = null;
      } else {
        var nx = h.pos.x + (dx / d) * h.speed * dt;
        var nz = h.pos.z + (dz / d) * h.speed * dt;
        if (!collide(nx, h.pos.z, 0.35)) h.pos.x = nx;
        if (!collide(h.pos.x, nz, 0.35)) h.pos.z = nz;
      }
    } else {
      var t = performance.now() * 0.001;
      h.pos.x += Math.sin(t * 0.4) * 0.15 * dt;
      h.pos.z += Math.cos(t * 0.32) * 0.15 * dt;
    }
    h.grp.position.set(h.pos.x, 0, h.pos.z + 0.1);
    h.grp.lookAt(G.player.pos.x, 0, G.player.pos.z);
    var pd = Math.hypot(G.player.pos.x - h.pos.x, G.player.pos.z - h.pos.z);
    if (pd < 1.1 && !G.hidden && !G.dead) {
      if (window.AU) AU.stinger();
      flashRed();
      G.dead = true; G.paused = true; G.playing = false;
      $('deadText').textContent = '它循着你的脚步过来了。\n在黑暗里，脚步比心跳更响。';
      $('dead').style.display = 'flex';
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  /* ================= 灯光 / 特效 ================= */
  function updateFlicker(dt, t) {
    var L = G.cur;
    if (!L) return;
    for (var i = 0; i < L.flickers.length; i++) {
      var f = L.flickers[i];
      if (!f.light) continue;
      var v = 1;
      if (f.speed) {
        var s = Math.sin(t * f.speed * 2.2 + f.phase);
        v = s > 0.86 ? 0.15 : (0.55 + 0.45 * Math.abs(s));
        if (f.speed > 2 && Math.random() < 0.08) v = 0.06;
      }
      f.light.intensity = f.base * v;
      if (f.mesh && f.mesh.material && f.mesh.material.color) {
        f.mesh.material.color.setHex(f.red ? 0x7a1c14 : 0xbfe9ff);
        f.mesh.material.color.multiplyScalar(0.35 + v * 0.65);
      }
    }
    for (var j = 0; j < L.leds.length; j++) {
      var l = L.leds[j];
      if (l.mesh && l.mesh.material) {
        var on = (Math.sin(t * 2.4 + l.phase) > -0.2);
        l.mesh.material.color.setHex(l.red ? (on ? 0xff3322 : 0x3a0a06) : (on ? 0x63d38f : 0x11231a));
      }
    }
    if (L.beacon && L.beacon.light) {
      var pulse = ST.alarm ? (0.7 + Math.sin(t * 7) * 0.5) : 0;
      L.beacon.light.intensity = Math.max(0, pulse) * 1.8;
    }
  }

  function flashRed() {
    var f = $('flash');
    if (!f) return;
    f.style.opacity = '0.55';
    setTimeout(function () { f.style.opacity = '0'; }, 220);
  }

  /* ================= 核心控制室：Boss 战 ================= */
  var HAZ_R = 1.55;
  var hazRingGeo = new THREE.RingGeometry(0.92, 1.55, 32);
  var hazDiscGeo = new THREE.CircleGeometry(1.55, 32);

  function resetBoss() {
    clearBossHazards();
    G.boss = { active: false, nextAt: 0, enrageUntil: 0, queue: [], hazards: [], count: 0, summoned: false };
  }

  function clearBossHazards() {
    if (!G.boss) return;
    G.boss.queue = [];
    (G.boss.hazards || []).forEach(function (h) {
      if (h.ring.parent) h.ring.parent.remove(h.ring);
      if (h.disc.parent) h.disc.parent.remove(h.disc);
      h.ring.material.dispose(); h.disc.material.dispose();
    });
    G.boss.hazards = [];
  }

  function startBoss() {
    resetBoss();
    G.boss.active = true;
    G.boss.nextAt = performance.now() + 3400;
    if (window.AU) AU.alarm();
    toast('核心开始反击：地面出现红圈就立刻离开原地。有斧子时按 Q 可格挡一次攻击。', 6000);
  }

  function stopBoss() {
    if (!G.boss) return;
    G.boss.active = false;
    clearBossHazards();
    if (G.robot.summoned) {
      G.robot.summoned = false; G.robot.visible = false; G.robot.grp.visible = false;
    }
  }

  function setNodeShields(on) {
    G.levels.core.nodeAnchors.forEach(function (n) {
      if (n.alive) n.shield.visible = !!on;
    });
  }

  function addHazard(x, z, warn) {
    if (!G.boss || !G.cur) return;
    var ringMat = new THREE.MeshBasicMaterial({ color: 0xff3a20, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    var discMat = new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.12, depthWrite: false });
    var ring = new THREE.Mesh(hazRingGeo, ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.05, z); ring.scale.setScalar(0.5);
    var disc = new THREE.Mesh(hazDiscGeo, discMat);
    disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.04, z); disc.scale.setScalar(0.5);
    G.cur.group.add(ring); G.cur.group.add(disc);
    G.boss.hazards.push({ x: x, z: z, r: HAZ_R, t: warn, boomed: false, bt: 0, ring: ring, disc: disc, ringMat: ringMat, discMat: discMat });
  }

  function bossVolley(n, gap, wide) {
    if (!G.boss) return;
    for (var i = 0; i < n; i++) {
      (function (idx) {
        G.boss.queue.push({
          at: performance.now() + idx * gap,
          fn: function () {
            var p = G.player;
            var spread = wide ? 2.8 : 2.0;
            var x = p.pos.x + (Math.random() - 0.5) * spread;
            var z = p.pos.z + (Math.random() - 0.5) * spread;
            x = Math.max(-6.4, Math.min(6.4, x));
            z = Math.max(-5.4, Math.min(5.4, z));
            addHazard(x, z, 1.45);
          }
        });
      })(i);
    }
  }

  function bossSummon() {
    var r = G.robot;
    if (r.visible) return;
    r.summoned = true;
    r.summonEnd = performance.now() + 20000;
    placeRobot(5.6, 4.6, Math.atan2(G.player.pos.x - 5.6, G.player.pos.z - 4.6), 'chase');
    if (window.AU) AU.servo(true);
    toast('核心放出了一台巡察体。', 2600);
  }

  function bossKill(text) {
    if (G.dead) return;
    G.dead = true; G.paused = true; G.playing = false;
    clearBossHazards();
    if (window.AU) AU.stinger();
    flashRed();
    showPrompt('');
    showDeathPanel(text || '核心的冲击波把你掀翻在地。\n系统记录：未完成补训 · 强制归档。');
  }

  function updateBoss(dt) {
    var B = G.boss;
    if (!B || !B.active || G.curId !== 'core') return;
    var now = performance.now();
    if (ST.nodesAlive <= 0) { stopBoss(); return; }

    // 护盾到期
    if (ST.nodesImmuneUntil && now >= ST.nodesImmuneUntil) {
      ST.nodesImmuneUntil = 0;
      setNodeShields(false);
      toast('节点护盾消散。', 1800);
    }
    var enraged = now < B.enrageUntil;
    var core = G.levels.core;
    if (core.coreLight) {
      core.coreLight.intensity = enraged ? (1.6 + Math.sin(now * 0.012) * 0.9) : 1.2;
      core.coreLight.color.setHex(enraged ? 0xff2a10 : 0xff7a38);
    }
    if (core.coreEye) {
      var sc = enraged ? 1.5 + Math.sin(now * 0.02) * 0.4 : 1;
      core.coreEye.scale.setScalar(sc);
    }
    if (core.coreBody && core.coreBody.material) {
      if (enraged) {
        core.coreBody.material.emissive.setHex(0xff1808);
        core.coreBody.material.emissiveIntensity = 0.28 + Math.sin(now * 0.012) * 0.1;
      } else {
        core.coreBody.material.emissive.setHex(0x000000);
        core.coreBody.material.emissiveIntensity = 0;
      }
    }
    if (core.warnRing) core.warnRing.material.opacity = enraged ? 0.55 : 0.28 + Math.sin(now * 0.003) * 0.08;

    // 定时攻击
    if (now >= B.nextAt) {
      B.count++;
      if (B.count % 3 === 0) {
        bossSummon();
      } else if (enraged) {
        bossVolley(4, 480, true);
        B.queue.push({ at: now + 900, fn: function () { bossSummon(); } });
      } else {
        bossVolley(3, 950, false);
      }
      B.nextAt = now + (enraged ? 1400 : 2800);
    }

    // 延迟队列
    for (var q = B.queue.length - 1; q >= 0; q--) {
      if (now >= B.queue[q].at) {
        var fn = B.queue[q].fn;
        B.queue.splice(q, 1);
        fn();
      }
    }

    // 召唤物超时
    if (G.robot.summoned && now >= G.robot.summonEnd) {
      G.robot.summoned = false;
      G.robot.visible = false;
      G.robot.grp.visible = false;
    }

    // 地面预警圈
    var p = G.player;
    for (var i = B.hazards.length - 1; i >= 0; i--) {
      var h = B.hazards[i];
      if (!h.boomed) {
        h.t -= dt;
        var prog = Math.max(0, Math.min(1, 1 - h.t / 1.45));
        var s = 0.55 + 0.45 * prog;
        h.ring.scale.setScalar(s); h.disc.scale.setScalar(s);
        h.ringMat.opacity = 0.35 + 0.35 * Math.abs(Math.sin(now * 0.008));
        if (h.t <= 0) {
          h.boomed = true; h.bt = 0.34;
          h.ring.scale.setScalar(1.15); h.disc.scale.setScalar(1.15);
          h.ringMat.opacity = 0.9; h.discMat.opacity = 0.55;
          if (window.AU) AU.stinger();
          var dd = Math.hypot(p.pos.x - h.x, p.pos.z - h.z);
          if (dd < h.r) {
            if (!blockHit()) {
              bossKill();
              return;
            }
          }
        }
      } else {
        h.bt -= dt;
        h.ringMat.opacity = Math.max(0, h.bt / 0.34) * 0.9;
        h.discMat.opacity = Math.max(0, h.bt / 0.34) * 0.4;
        if (h.bt <= 0) {
          if (h.ring.parent) h.ring.parent.remove(h.ring);
          if (h.disc.parent) h.disc.parent.remove(h.disc);
          h.ringMat.dispose(); h.discMat.dispose();
          B.hazards.splice(i, 1);
        }
      }
    }
  }

  function bossEnrage() {
    var B = G.boss;
    if (!B || !B.active) return;
    var now = performance.now();
    B.enrageUntil = now + 6000;
    B.nextAt = Math.min(B.nextAt, now + 500);
    bossVolley(3, 320, true);
    ST.nodesImmuneUntil = now + 10000;
    setNodeShields(true);
    if (window.AU) AU.alarm();
    flashRed();
    toast('核心暴怒！剩下的节点被护盾罩住 10 秒。', 4200);
  }

  /* ================= 主循环 ================= */
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(0.05, G.clock.getDelta());
    var t = performance.now() * 0.001;

    if (G.menu) {
      // 菜单：走廊缓慢漂移
      if (G.cur) {
        G.player.yaw = Math.sin(t * 0.12) * 0.12;
        G.player.pitch = Math.sin(t * 0.09) * 0.03;
        G.camera.position.set(0, 1.58 + Math.sin(t * 0.6) * 0.01, -0.9);
        G.camera.rotation.set(G.player.pitch, G.player.yaw, 0);
        updateFlicker(dt, t);
      }
    } else if (G.playing && !G.paused) {
      if (G.dialog || G.cutscene) {
        G.camera.rotation.set(G.player.pitch, G.player.yaw, 0);
        updateFlicker(dt, t);
        updateTimer();
        updateDust(dt);
      } else {
        updatePlayer(dt);
        updateRobot(dt);
        updateHunter(dt);
        updateBoss(dt);
        updateBlockHud();
        updateFocus();
        updateFlicker(dt, t);
        updateTimer();
        updateHeartbeat(dt);
        updateDust(dt);
      }
    } else {
      updateFlicker(dt, t);
    }

    if (G.jumpscare) updateJumpscare();

    G.renderer.render(G.scene, G.camera);
  }

  function updateDust(dt) {
    if (!G.dust) return;
    var arr = G.dust.geometry.attributes.position.array;
    var p = G.player.pos;
    for (var i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= dt * 0.08;
      arr[i] += Math.sin(performance.now() * 0.0007 + i) * 0.0006;
      if (arr[i + 1] < 0.1) arr[i + 1] = 3.4;
      // 跟随玩家所在区域
      var dx = arr[i] - p.x, dz = arr[i + 2] - p.z;
      if (dx > 8) arr[i] -= 16; else if (dx < -8) arr[i] += 16;
      if (dz > 8) arr[i + 2] -= 16; else if (dz < -8) arr[i + 2] += 16;
    }
    G.dust.geometry.attributes.position.needsUpdate = true;
  }

  function updateTimer() {
    if (!G.timer) return;
    var left = (G.timer.end - performance.now()) / 1000;
    if (left < 0) left = 0;
    var el = $('timer');
    el.textContent = (G.timer.label ? G.timer.label + ' ' : '') + left.toFixed(1) + 's';
    el.classList.toggle('warn', left < 10);
    $('rededge').style.opacity = left < 12 ? (0.35 + Math.sin(performance.now() * 0.012) * 0.2) : (ST.alarm ? 0.28 : 0);
    if (left <= 0) {
      var cb = G.timer.onEnd; G.timer = null;
      el.style.display = 'none';
      if (cb) cb();
    }
  }

  var HB = 0;
  function updateHeartbeat(dt) {
    var danger = 0;
    if (G.robot.visible) {
      var d = Math.hypot(G.player.pos.x - G.robot.pos.x, G.player.pos.z - G.robot.pos.z);
      if (d < 9) danger = Math.max(danger, (9 - d) / 9);
      if (G.robot.state === 'chase') danger = Math.max(danger, 0.85);
    }
    if (G.hunter.visible) {
      var hd = Math.hypot(G.player.pos.x - G.hunter.pos.x, G.player.pos.z - G.hunter.pos.z);
      if (hd < 7) danger = Math.max(danger, (7 - hd) / 7);
    }
    HB -= dt;
    if (danger > 0.25 && HB <= 0) {
      HB = 1.35 - danger * 0.75;
      if (window.AU) AU.heartbeat(danger > 0.7);
    }
    var edge = Math.max(0, danger - 0.55) * 0.9;
    if (!ST.alarm) $('rededge').style.opacity = edge;
  }

  /* ================= 剧情：第一幕 ================= */
  function startGame() {
    $('menu').style.display = 'none';
    $('ending').style.display = 'none';
    $('dead').style.display = 'none';
    G.menu = false; G.playing = true; G.paused = false; G.dead = false; G.ending = false;
    G.cutscene = false; G.dialog = false; G.stairsReady = false;
    clearTimer();
    ST.chapter = 1; ST.level = 'classroom';
    ST.phoneRead = false; ST.phoneUsed = false; ST.codeOk = false;
    ST.hasKey = false; ST.keyTaken = false; ST.hasLog = false;
    ST.hasDisk = false; ST.hasAxe = false; ST.hasBattery = false; ST.glassBroken = false;
    ST.alarm = false; ST.nodesAlive = 3; ST.truth = false; ST.gateOpen = false;
    ST.nodesImmuneUntil = 0;
    ST.resetUsed = false; ST.bathScare = false; ST.seenCorridor = false;
    ST.clues.book = ST.clues.badge = ST.clues.sticky = ST.clues.paper = ST.clues.sheet = false;
    ST.checkpoint = 'classroom';
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    refreshContinue();
    G.flash.distance = 20; G.flash.intensity = 2.2;
    resetCoreNodes();
    if (window.AU) AU.init();
    setLevel('classroom');
    showChapter(G.cur);
    setObjective('查看自己的手机');
    updateHUD();
    requestLock();
    $('lockHint').style.display = 'block';
    setTimeout(function () { $('lockHint').style.display = 'none'; }, 7000);
    say([
      ['旁白', '22:45。实训中心的服务器还在响，像有人在隔壁很慢地呼吸。'],
      ['张锦鑫', '我趴在键盘上睡着了……脖子像被人拧过。'],
      ['旁白', '整层楼只剩你一个人。至少现在是。']
    ], function () { });
  }

  function resetCoreNodes() {
    if (!G.levels.core) return;
    G.levels.core.nodeAnchors.forEach(function (n) {
      n.alive = true;
      n.hp = n.maxHp || 5;
      if (n.normal) n.normal.visible = true;
      if (n.broken) n.broken.visible = false;
      if (n.top && n.top.material) n.top.material.color.setHex(0xff6a3a);
      if (n.light) n.light.intensity = 0.9;
      if (n.shield) n.shield.visible = false;
    });
    ST.nodesImmuneUntil = 0;
    if (G.block) { G.block.activeUntil = 0; G.block.invulnUntil = 0; G.block.readyAt = 0; }
  }

  function openPhoneUI() {
    if (ST.phoneRead) {
      showToastLine('手机屏幕暗着。充电线还插着，却怎么也亮不起来。');
      return;
    }
    ST.phoneUsed = true;
    openOverlay('phone');
    if (window.AU) AU.beep(1320, 0.08, 0.04);
  }
  function closePhoneUI() {
    closeOverlay('phone');
    if (!ST.phoneRead) {
      ST.phoneRead = true;
      say([
        ['张锦鑫', '嘶……十点四十五了？宿舍十一点半门禁。'],
        ['张锦鑫', '班群这条……补训？什么补训？我不是跑完代码就……'],
        ['张锦鑫', '大家什么时候走的？怎么都没叫我。'],
        ['旁白', '门是锁着的。门禁键盘亮着绿灯，像在等你输点什么。']
      ], function () {
        setObjective('找到四段门禁密码 <span style="color:#8fa2a6">（0/4）</span>');
      });
    }
  }

  function pickupClue(key) {
    if (ST.clues[key]) { toast('这条线索已经记下了。'); return; }
    ST.clues[key] = true;
    var n = 0;
    ['sticky', 'paper', 'sheet', 'book'].forEach(function (k) { if (ST.clues[k]) n++; });
    if (window.AU) AU.success();
    updateHUD();
    if (n >= 4) {
      setObjective('输入门禁密码（键盘在你右边的墙上）');
      say([['张锦鑫', '八、六、零、一。四个数字拼起来了。']], function () { });
    } else {
      setObjective('找到四段门禁密码 <span style="color:#8fa2a6">（' + n + '/4）</span>');
    }
    toast('线索已记录（' + n + '/4）');
  }

  var KP = { code: '', onOk: null };
  function openKeypad() {
    KP.code = '';
    kpRender();
    openOverlay('keypad');
    $('kpSub').textContent = ST.codeOk ? '门禁已解锁' : '请输入四位密码';
    $('kpSub').style.color = '#6b7f83';
  }
  function kpRender() {
    var d = $('kpDisp');
    var s = KP.code.padEnd(4, '_');
    d.textContent = s.split('').join(' ');
    d.classList.remove('bad');
  }
  function kpPress(v) {
    if (v === 'ok') {
      if (KP.code.length < 4) return;
      if (KP.code === '8601') {
        ST.codeOk = true;
        $('kpSub').textContent = '权限通过：J6 班级门禁已解锁';
        $('kpSub').style.color = '#7fd8b0';
        if (window.AU) AU.success();
        setTimeout(function () { closeOverlay('keypad'); onDoorOpen(); }, 700);
      } else {
        if (window.AU) AU.error();
        $('kpDisp').classList.add('bad');
        $('kpSub').textContent = '密码错误 · 请重新输入';
        $('kpSub').style.color = '#d45a4a';
        KP.code = '';
        setTimeout(kpRender, 500);
      }
      return;
    }
    if (v === 'del') { KP.code = KP.code.slice(0, -1); kpRender(); return; }
    if (KP.code.length < 4) {
      KP.code += v;
      kpRender();
      if (window.AU) AU.beep(880 + parseInt(v) * 30, 0.05, 0.035);
    }
  }
  function buildKeypadUI() {
    var grid = $('kpGrid');
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
    keys.forEach(function (k) {
      var b = document.createElement('button');
      if (k === 'del') { b.textContent = '清空'; b.className = 'wide'; }
      else if (k === 'ok') { b.textContent = '确认'; b.className = 'wide ok'; }
      else b.textContent = k;
      b.onclick = function () { kpPress(k); };
      grid.appendChild(b);
    });
  }

  function onDoorOpen() {
    if (window.AU) AU.door(true);
    setObjective('离开实训机房');
    say([
      ['旁白', '门锁“咔”地弹开。走廊的灯只亮了一半。'],
      ['张锦鑫', '走廊里……有轮子压过地砖的声音。']
    ], function () {
      transitionTo('corridor', G.levels.corridor.anchors.spawn, corridorIntro);
    });
  }

  function corridorIntro() {
    if (ST.seenCorridor) {
      setObjective(goalCorridor());
      placeRobot(0, -16, 0, 'patrol');
      return;
    }
    ST.seenCorridor = true;
    G.cutscene = true;
    placeRobot(0, -17, 0, 'patrol');
    say([
      ['张锦鑫', '那是什么……？'],
      ['张锦鑫', '校规里没写过走廊里有巡逻机器人。'],
      ['张锦鑫', '那个底盘，是我们上学期拼过的实训云台。'],
      ['张锦鑫', '谁在上面加了个……摄像头？']
    ], function () {
      G.cutscene = false;
      setObjective(goalCorridor());
      toast('别跑。它会被脚步声吸引。柜子可以躲（E）。', 4200);
    }, 900);
  }

  function goalCorridor() {
    if (!ST.hasKey) return '前往洗手间（东侧第二扇门）';
    return '用钥匙打开档案室（东侧第一扇门）';
  }

  function goBathroom() {
    if (window.AU) AU.door(false);
    transitionTo('bathroom', G.levels.bathroom.anchors.spawn, function () {
      setObjective('找到档案室的钥匙');
      say([
        ['旁白', '门后是洗手间。灯还亮着，水管在墙里咕咕地响。'],
        ['张锦鑫', '镜子上有一道裂缝。']
      ], function () { });
    });
  }

  function takeKey() {
    if (ST.keyTaken) return;
    ST.keyTaken = true; ST.hasKey = true; ST.keyMissing = false;
    updateHUD();
    if (window.AU) { AU.glass(); }
    showToastLine('拿到「档案室钥匙」。铜牌上写着：档案室 B1。');
    setObjective('原路返回走廊，用钥匙打开档案室');
    // 惊吓：第三个隔间门被撞了一下
    setTimeout(function () {
      if (G.curId !== 'bathroom') return;
      if (window.AU) { AU.stinger(); AU.noise(0.5, 0.22, 700, 'lowpass'); }
      G.cameraShake = 0.55;
      flashRed();
      toast('第三个隔间的门被人从里面撞了一下。', 3000);
    }, 1400);
  }

  var SAVE_KEY = 'pcm3d_save_v1';
  function readSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveProgress() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, t: Date.now(), st: JSON.parse(JSON.stringify(ST)) }));
    } catch (e) {}
    refreshContinue();
  }
  function refreshContinue() {
    var b = $('btnContinue');
    if (b) b.style.display = readSave() ? 'block' : 'none';
  }
  function resumeObjective() {
    if (ST.level === 'classroom') return ST.phoneRead ? '找到四段门禁密码' : '查看自己的手机';
    if (ST.level === 'corridor') return goalCorridor();
    if (ST.level === 'bathroom') return ST.keyTaken ? '原路返回走廊，用钥匙打开档案室' : '找到档案室的钥匙';
    if (ST.level === 'archive') return ST.hasDisk ? '带着数据盘离开档案室' : '调查档案室：找到能证明“人”的东西';
    if (ST.level === 'stairs') return '选择：向上是出口，向下是机房';
    if (ST.level === 'server') return '穿过服务器迷宫，前往核心控制室';
    if (ST.level === 'core') return ST.nodesAlive > 0 ? '破坏核心节点（剩余 ' + ST.nodesAlive + ' 个）' : '在主控台插入教学日志，然后打开闸门';
    return '继续补训';
  }
  function continueGame() {
    var s = readSave();
    if (!s || !s.st) { toast('没有找到打卡记录。', 2200); return; }
    Object.assign(ST, s.st);
    if (!G.levels[ST.level]) ST.level = 'classroom';
    $('menu').style.display = 'none';
    $('ending').style.display = 'none';
    $('dead').style.display = 'none';
    $('subtitle').style.display = 'none';
    G.menu = false; G.playing = true; G.paused = false;
    G.dead = false; G.ending = false; G.cutscene = false; G.dialog = false;
    if (window.AU) AU.init();
    setLevel(ST.level);
    showChapter(G.cur);
    updateHUD();
    setObjective(resumeObjective());
    if (ST.hasBattery) { G.flash.distance = 30; G.flash.intensity = 2.8; }
    if (ST.level === 'server') placeHunter(4.2, -4.2);
    if (ST.level === 'corridor') placeRobot(0, -17, 0, 'patrol');
    requestLock();
    $('lockHint').style.display = 'block';
    setTimeout(function () { $('lockHint').style.display = 'none'; }, 7000);
    say([['旁白', '打卡机把记录读了出来。墙上的钟还停在 22:45。']], null);
  }

  function useClock() {
    ST.checkpoint = ST.level;
    saveProgress();
    G.player.stamina = 100;
    if (window.AU) { AU.beep(760, 0.12, 0.05); AU.success(); }
    toast('打卡成功 · 进度已保存（回到主菜单可「继续补训」）', 3200);
    showToastLine('屏幕闪了一下：J6-05 张锦鑫 · 已打卡。时间 22:47。');
  }

  function goArchive() {
    if (!ST.hasKey) {
      say([['张锦鑫', '锁是黄铜的。钥匙不在门上。']], function () { });
      return;
    }
    if (window.AU) AU.door(true);
    transitionTo('archive', G.levels.archive.anchors.spawn, function () {
      setObjective('调查档案室：找到能证明“人”的东西');
      say([
        ['旁白', '铁门在身后合上。这里比走廊冷得多。'],
        ['张锦鑫', 'J6 的档案……全被涂掉了年份。']
      ], function () { });
    });
  }

  function takeAxe() {
    if (ST.hasAxe) return;
    if (!ST.glassBroken) {
      ST.glassBroken = true;
      if (window.AU) AU.glass();
      showToastLine('玻璃碎了。里面是一把生锈的消防斧。');
      return;
    }
    ST.hasAxe = true;
    updateHUD();
    if (window.AU) AU.noise(0.4, 0.12, 800, 'lowpass');
    showToastLine('拿到「生锈的消防斧」。斧刃锈了，但还够重。');
    setObjective('拿到核心数据盘，然后从安全通道离开');
  }

  function readLog() {
    if (!ST.hasLog) {
      ST.hasLog = true;
      updateHUD();
      if (window.AU) AU.noise(0.2, 0.05, 1800, 'bandpass');
    }
    readNote('教学日志 · 梁正明',
      'J6 班第三周。<br>张锦鑫的视觉项目又跑到凌晨。这孩子不肯认输，代码里全是自己改的参数。<br><br>' +
      '今天教务那边又发来《学情优化方案》第 12 版，要求把“长期滞留”的学生标成异常样本。<br>' +
      '我把名单压下来了。压不了多久。<br><br>' +
      '如果他们真的要动他，至少得留下点系统写不出来的东西。<br><br>' +
      '<b>柜子密码 0417（我的工号）。里面是原始记录盘。</b>',
      '——梁正明  10月17日');
    setObjective('用保险箱取出核心数据盘（密码在日志里）');
  }

  function openSafe() {
    if (ST.hasDisk) { showToastLine('保险箱已经空了。'); return; }
    if (!ST.hasLog) {
      say([['张锦鑫', '四位密码。梁老师应该把它写在了什么地方。']], function () { });
      return;
    }
    ST.hasDisk = true;
    updateHUD();
    if (window.AU) { AU.door(true); AU.beep(660, 0.2, 0.05); }
    showToastLine('拿到「核心数据盘」。里面是未经系统复核的原始学情记录。');
    startAlarm();
  }

  function startAlarm() {
    if (ST.alarm) return;
    ST.alarm = true;
    if (window.AU) { AU.alarm(); }
    $('rededge').style.opacity = 0.3;
    setObjective('冲向安全通道！别停');
    setTimer(40, '物理清除倒计时', function () {
      G.dead = true; G.paused = true; G.playing = false;
      $('deadText').textContent = '清除程序完成。\n你的工位被重新分配给了下一个人。';
      $('dead').style.display = 'flex';
      if (document.pointerLockElement) document.exitPointerLock();
    });
    say([
      ['系统广播', '【检测到未授权数据外带。物理清除程序已启动。】'],
      ['张锦鑫', '四十秒。走廊，安全通道。']
    ], function () { }, 700);
    // 巡察体从走廊尽头加速追来
    if (G.curId === 'archive') placeRobot(0, -20, 0, 'chase');
    G.alarmRobot = true;
  }

  function toStairs() {
    if (!ST.hasAxe && !ST.alarm) {
      say([['张锦鑫', '安全通道的门被废弃机柜堵死了。得有东西把它砸开。']], function () { });
      return;
    }
    clearTimer();
    if (window.AU) AU.door(true);
    transitionTo('stairs', G.levels.stairs.anchors.spawn, function () {
      setObjective('选择：向上是出口，向下是机房');
      say([
        ['旁白', '安全通道的铁门在身后合上。外面没有声音。'],
        ['张锦鑫', '上面是出口。下面是机房 B1。'],
        ['张锦鑫', '我的档案还在下面。']
      ], function () { G.stairsReady = true; });
      ST.chapter = 5;
    });
  }

  function goServer() {
    if (!G.stairsReady) return;
    if (window.AU) AU.door(true);
    transitionTo('server', G.levels.server.anchors.spawn, function () {
      setObjective('穿过服务器迷宫，前往核心控制室');
      placeHunter(4.2, -4.2);
      say([
        ['旁白', '机房 B1。这里没有灯，只有服务器在发热。'],
        ['张锦鑫', '空气里全是风扇的味道。'],
        ['系统广播（很远）', '“……请保持安静。”'],
        ['旁白', '黑暗里有什么东西动了一下。它没有眼睛。']
      ], function () {
        toast('它靠声音找你。按 C 蹲行最安静，Shift 会把它引过来。', 5000);
      }, 1200);
      ST.chapter = 6;
    });
  }

  function escapeEnding() {
    if (!G.stairsReady) return;
    if (window.AU) AU.door(true);
    transitionTo('dawn', null, function () {
      ST.end = 'escape';
      G.cutscene = true;
      $('ambience') && 0;
      if (window.AU) AU.setAmbience('dawn');
      say([
        ['旁白', '你推开了上面的铁门。楼梯间外面是操场，天还没亮。'],
        ['张锦鑫', '……出口？'],
        ['旁白', '你走了很久。走廊又出现在你面前，灯只亮了一半。'],
        ['系统广播', '【补训仍未完成。请回到工位。】']
      ], function () { showEnding('escape'); }, 1400);
    });
  }

  function takeBattery() {
    if (ST.hasBattery) return;
    ST.hasBattery = true;
    updateHUD();
    if (window.AU) AU.beep(520, 0.15, 0.05);
    showToastLine('拿到「备用电池」。装进手电，能照得更远。');
    G.flash.distance = 30; G.flash.intensity = 2.8;
  }

  function useReset() {
    if (ST.resetUsed) { showToastLine('按钮已经烧坏了。'); return; }
    ST.resetUsed = true;
    if (window.AU) { AU.alarm(); AU.noise(0.8, 0.18, 500, 'lowpass'); }
    G.hunter.stun = 16;
    showToastLine('紧急重置生效。巡察体原地停住了——大约十六秒。');
  }

  function goCore() {
    if (window.AU) AU.door(true);
    transitionTo('core', G.levels.core.anchors.spawn, function () {
      ST.chapter = 7;
      setObjective(ST.hasAxe ? '用消防斧破坏三个核心节点（每个要劈 5 下）' : '破坏核心节点（需要工具）');
      say([
        ['旁白', '门后没有灯。只有一束暖黄色的光，从机房正中升起来。'],
        ['系统 / 梁老师的声音', '“张锦鑫。补训还没结束。”'],
        ['张锦鑫', '这声音……是梁老师的。但不对。']
      ], function () {
        if (!ST.hasAxe) {
          toast('你没有带能砸开机柜的东西。60 秒后系统会完成归档。', 5000);
          setTimer(60, '归档协议', function () { showEnding('noaxe'); });
        } else {
          setTimer(180, '归档协议', function () { showEnding('archive'); });
          startBoss();
        }
      }, 1400);
    });
  }

  function hitNode(node) {
    if (!node.alive) { showToastLine('这个节点已经暗了。'); return; }
    if (!ST.hasAxe) { showToastLine('徒手砸不开。'); return; }
    if (G.hitting) return;
    var now = performance.now();
    if (now < (ST.nodesImmuneUntil || 0)) {
      showToastLine('节点被护盾罩住，还要 ' + Math.ceil((ST.nodesImmuneUntil - now) / 1000) + ' 秒。');
      return;
    }
    G.hitting = true;
    if (window.AU) { AU.noise(0.25, 0.2, 500, 'lowpass'); AU.glass(); }
    flashRed();
    setTimeout(function () {
      if (!node.alive) { G.hitting = false; return; }
      node.hp--;
      if (node.hp > 0) {
        if (node.top && node.top.material) node.top.material.color.setHex(0xffb08a);
        if (node.light) node.light.intensity = 0.95;
        showToastLine('节点受损 ' + (node.maxHp - node.hp) + ' / ' + node.maxHp + '。再劈 ' + node.hp + ' 下。');
        G.hitting = false;
        return;
      }
      // 彻底破坏：换成破损形态
      node.alive = false;
      if (node.inter) node.inter.disabled = true;
      if (node.normal) node.normal.visible = false;
      if (node.broken) node.broken.visible = true;
      if (node.shield) node.shield.visible = false;
      if (node.light) node.light.intensity = 0;
      ST.nodesAlive--;
      G.hitting = false;
      if (window.AU) AU.alarm();
      if (ST.nodesAlive <= 0) {
        clearTimer();
        stopBoss();
        setNodeShields(false);
        setObjective('在主控台插入教学日志，然后打开闸门');
        say([
          ['系统广播', '【核心节点离线。归档队列强制中止。】'],
          ['张锦鑫', '梁老师……你到底在哪一边？']
        ], function () { }, 1600);
        ST.gateReady = true;
      } else {
        setObjective('破坏核心节点（剩余 ' + ST.nodesAlive + ' 个）');
        toast('节点彻底熄灭。还剩 ' + ST.nodesAlive + ' 个。', 1800);
        bossEnrage();
      }
    }, 320);
  }

  function useConsole() {
    if (ST.nodesAlive > 0) { showToastLine('主控台没有响应。得先让核心停下来。'); return; }
    if (ST.truth) { showToastLine('日志已经插进去了。'); return; }
    if (!ST.hasLog) {
      showToastLine('插槽需要一个能证明“人”的东西。你没有。');
      return;
    }
    ST.truth = true;
    if (window.AU) AU.success();
    setObjective('打开闸门，从安全出口离开');
    say([
      ['张锦鑫', '这是梁老师的教学日志。上面有他给我写的批注。'],
      ['系统 / 梁老师的声音', '“……读取失败。这不是可归档的数据。”'],
      ['张锦鑫', '对。这不是数据。']
    ], function () { }, 1000);
  }

  function openGate() {
    if (!ST.gateReady) { showToastLine('闸门锁着。先让核心停下来。'); return; }
    if (ST.gateOpen) { showToastLine('闸门已经开了。'); return; }
    ST.gateOpen = true;
    if (window.AU) { AU.door(true); AU.noise(1.2, 0.2, 300, 'lowpass'); }
    setObjective('从安全出口离开');
    say([['系统广播（失真）', '“【系统离线。学情归档终止。数据已释放。】”']], function () { }, 900);
  }

  function leaveCore() {
    if (!ST.gateOpen) { showToastLine('闸门还没开，门打不开。'); return; }
    G.playing = false;
    stopBoss();
    transitionTo('dawn', null, function () {
      G.cutscene = true;
      ST.end = ST.truth ? 'truth' : 'silence';
      if (window.AU) AU.setAmbience('dawn');
      if (ST.truth) {
        // 梁老师身影
        var L = G.levels.dawn;
        var teach = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.9, 4, 8), new THREE.MeshStandardMaterial({ color: 0x1a2226, roughness: 0.9 }));
        teach.position.set(0.4, 1.0, -13.5);
        L.group.add(teach);
        say([
          ['旁白', '走廊里的冷白色日光灯亮了。窗外是早上六点。'],
          ['张锦鑫', '他们回来了。补训结束了。'],
          ['梁老师', '张锦鑫。'],
          ['张锦鑫', '老师……您没事吧？'],
          ['梁老师', '机房里的服务器……修起来可能要花点时间。'],
          ['张锦鑫', '（苦笑）只要不用写检查就行。']
        ], function () { showEnding('truth'); }, 2600);
      } else {
        say([
          ['旁白', '走廊里的冷白色日光灯亮了。可广播还在响。'],
          ['系统广播（微弱）', '“请同学们回到工位……请同学们……”'],
          ['张锦鑫', '系统停了，但那句话还在循环。我们真的逃出来了吗？']
        ], function () { showEnding('silence'); }, 2600);
      }
    });
  }

  /* ================= 结局 ================= */
  function readEndings() {
    try { return JSON.parse(localStorage.getItem('pcm3d_endings') || '{}') || {}; } catch (e) { return {}; }
  }
  function unlockEnding(key) {
    try {
      var o = readEndings(); o[key] = Date.now();
      localStorage.setItem('pcm3d_endings', JSON.stringify(o));
    } catch (e) {}
  }
  function showEnding(key) {
    G.ending = true; G.playing = false; G.paused = true;
    clearTimer();
    stopBoss();
    $('subtitle').style.display = 'none';
    var e = ENDINGS[key];
    if (!e) return;
    unlockEnding(key);
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    refreshContinue();
    $('endNo').textContent = 'ENDING ' + e.no;
    $('endTitle').textContent = e.title;
    $('endSub').textContent = e.sub;
    $('endDesc').textContent = e.desc;
    $('ending').classList.toggle('dawn', key === 'truth' || key === 'silence');
    $('ending').style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();
    if (window.AU) AU.stopAmbience();
  }

  function renderEndings() {
    var got = readEndings();
    var html = '';
    Object.keys(ENDINGS).forEach(function (k) {
      var e = ENDINGS[k], on = !!got[k];
      html += '<div class="item ' + (on ? 'on' : '') + '"><div class="n">ENDING ' + e.no + (on ? ' · 已收录' : ' · 未抵达') + '</div>' +
        '<div class="nm">' + e.title + '：' + e.sub + '</div>' +
        '<div class="ds">' + (on ? e.desc : '尚未抵达这个结局。') + '</div></div>';
    });
    $('endItems').innerHTML = html;
  }

  /* ================= 死亡 / 复活 ================= */
  function respawn() {
    $('dead').style.display = 'none';
    G.dead = false; G.paused = false; G.playing = true;
    ST.deaths++;
    if (ST.level === 'archive') {
      ST.alarm = false;
      transitionTo('archive', G.levels.archive.anchors.spawn, function () {
        if (ST.hasDisk) {
          ST.alarm = false;
          startAlarm();
        }
      });
    } else if (ST.level === 'server') {
      transitionTo('server', G.levels.server.anchors.spawn, function () {
        placeHunter(4.2, -4.2);
        setObjective('穿过服务器迷宫，前往核心控制室');
      });
    } else if (ST.level === 'core') {
      transitionTo('core', G.levels.core.anchors.spawn, function () {
        stopBoss();
        clearTimer();
        G.block.invulnUntil = 0;
        if (ST.nodesAlive > 0 && ST.hasAxe) {
          setTimer(180, '归档协议', function () { showEnding('archive'); });
          startBoss();
        }
        if (ST.nodesImmuneUntil && performance.now() < ST.nodesImmuneUntil) setNodeShields(true);
        setObjective(ST.nodesAlive > 0 ? '破坏核心节点（剩余 ' + ST.nodesAlive + ' 个）' : '在主控台插入教学日志，然后打开闸门');
      });
    } else if (ST.level === 'bathroom') {
      transitionTo('bathroom', G.levels.bathroom.anchors.spawn, function () {
        setObjective(ST.keyTaken ? '原路返回走廊，用钥匙打开档案室' : '找到档案室的钥匙');
      });
    } else if (ST.level === 'stairs') {
      transitionTo('stairs', G.levels.stairs.anchors.spawn, function () {
        setObjective('选择：向上是出口，向下是机房');
        G.stairsReady = true;
      });
    } else {
      transitionTo('corridor', G.levels.corridor.anchors.spawn, function () {
        placeRobot(0, -16, 0, 'patrol');
        setObjective(goalCorridor());
      });
    }
    requestLock();
  }

  /* ================= 关卡交互装配 ================= */
  function setupInteractions(id) {
    G.interactables = [];
    var A = G.cur.anchors;
    G.stairsReady = false;

    if (id === 'classroom') {
      addInter(A.phone.x, A.phone.z, '手机', '查看手机', openPhoneUI);
      addInter(A.bag.x, A.bag.z, '书包', '查看书包', function () {
        showToastLine('我的书包。拉链开着，《人工智能导论》不见了。');
      }, { y: 0.5 });
      addInter(A.coffee.x, A.coffee.z, '咖啡', '查看咖啡', function () {
        showToastLine('咖啡已经凉透了。我到底睡了多久？');
      }, { y: 0.8 });
      addInter(A.book.x, A.book.z, '教案', '翻看梁老师的教案', function () {
        pickupClue('book');
        readNote('梁老师的教案',
          '最后一页写得很重，笔尖几乎划破纸：<br><br><b>“偏差值过大。必须进行强制物理归档。”</b><br><br>' +
          '页脚还有一行小字：<br>“门禁密码最后一位——回寝时间的个位数。”<br>' +
          '宿舍十一点半门禁，十一点回寝。个位是 <b>1</b>。',
          '梁正明');
      }, { y: 0.9 });
      addInter(A.badge.x, A.badge.z, '工牌', '捡起工牌', function () {
        showToastLine('梁老师的工牌。照片被刮花，芯片边缘也裂了——怪不得门禁一直认不出它。');
      }, { y: 0.4 });
      addInter(A.sticky.x, A.sticky.z, '便利贴', '读便利贴', function () {
        pickupClue('sticky');
        showToastLine('“第一位是 8。”');
      }, { y: 1.2 });
      addInter(A.fallen.x, A.fallen.z, '碎屏', '查看摔碎的显示器', function () {
        readNote('屏幕碎裂的显示器',
          '屏幕裂成蛛网。里面卡着一张学生证：<br><br><b>张锦鑫 · 24人工智能技术应用 J6 班</b><br><br>' +
          '这是我的学生证。为什么会被砸碎在这里？',
          '');
      }, { y: 1.0 });
      addInter(A.drawer.x, A.drawer.z, '抽屉', '拉开抽屉', function () {
        pickupClue('paper');
        showToastLine('揉皱的废纸：“第二位是班级号（J6）的 6。”');
      }, { y: 0.55 });
      // 考勤表在墙上
      addInter(-5.8, 0.7, '考勤表', '查看考勤表', function () {
        pickupClue('sheet');
        readNote('考勤表 · J6 班',
          '张锦鑫的名字被人用红笔圈了三圈，旁边补了一行小字：<br><br><b>“第三位填 0。”</b><br><br>' +
          '其他人的名字都被黑笔涂掉了。',
          '');
      }, { y: 1.5 });
      addInter(A.clock.x, A.clock.z, '打卡机', '查看打卡机', function () {
        showToastLine('打卡机。绿灯一闪一闪的，时间停在 22:45。');
      }, { y: 1.4 });
      addInter(-5.6, -4.15, '摄像头', '抬头看摄像头', function () {
        showToastLine('摄像头亮着红光。镜头似乎……在跟着我转。');
      }, { y: 2.2, range: 3.0 });
      addInter(A.keypad.x, A.keypad.z, '门禁键盘', '输入门禁密码', function () {
        if (ST.codeOk) { onDoorOpen(); return; }
        openKeypad();
      }, { y: 1.3 });
      addInter(0.9, 4.3, '门', '推门', function () {
        if (ST.codeOk) { onDoorOpen(); return; }
        showToastLine('门被死死锁住了。旁边的键盘亮着绿灯。');
        say([['张锦鑫', '四位密码。屋子里应该藏着四段。']], function () {
          if (!ST.phoneRead) setObjective('查看自己的手机');
        });
      }, { y: 1.2, range: 2.1 });
      addInter(-1.6, -1.2, '空工位', '检查空工位', function () {
        showToastLine('显示器还亮着。代码停在最后一行，光标一直在闪。座位是空的。');
      }, { y: 1.0 });
    }

    if (id === 'corridor') {
      A.locker.forEach(function (p, i) {
        addInter(p.x, p.z, '储物柜', '躲进柜子', function () {
          enterHide(i);
        }, { y: 1.3, range: 1.5 });
      });
      addInter(A.doorArchive.x, A.doorArchive.z, '档案室', ST.hasKey ? '用钥匙开门' : '试着开门', function () {
        goArchive();
      }, { y: 1.2, range: 2.0 });
      addInter(A.doorBath.x, A.doorBath.z, '洗手间', '进入洗手间', function () {
        goBathroom();
      }, { y: 1.2, range: 2.0 });
      addInter(A.doorStair.x, A.doorStair.z, '安全通道', '进入安全通道', function () {
        toStairs();
      }, { y: 1.2, range: 2.0 });
      addInter(A.report.x, A.report.z, '公告栏', '查看阶段评估报告', function () {
        readNote('阶段评估报告（第 3 版）',
          'J6 班 · 出勤异常样本处理<br><br>' +
          '1. 张锦鑫：连续滞留 41 小时，偏差值 0.83，建议强制物理归档。<br>' +
          '2. 其余 35 人：已完成补训，档案已覆盖。<br><br>' +
          '批注（手写）：<span style="color:#7a3a30">“他还不知道。”</span>',
          '教务办');
      }, { y: 1.5 });
      A.bottles.forEach(function (p, i) {
        addInter(p.x, p.z, '玻璃瓶', '踢碎瓶子（制造声音）', function (ent) {
          if (ent.disabled) return;
          ent.disabled = true;
          throwBottle(p.x, p.z, i);
        }, { y: 0.4 });
      });
      addInter(A.edgeNode.x, A.edgeNode.z, '边缘节点', '查看边缘计算节点', function () {
        showToastLine('散热风扇在转。外壳上贴着标签：“J6 实训云台 · 改装”。');
      }, { y: 1.4, range: 2.0 });
    }

    if (id === 'bathroom') {
      addInter(A.mirror.x, A.mirror.z, '镜子', ST.keyTaken ? '查看裂缝' : '检查镜子的裂缝', function () {
        if (ST.keyTaken) { showToastLine('裂缝里已经什么都没有了。'); return; }
        takeKey();
      }, { y: 1.5, range: 2.0 });
      addInter(A.clock.x, A.clock.z, '旧考勤机', '打卡（保存进度）', function () {
        useClock();
      }, { y: 1.4 });
      A.stalls.forEach(function (p, i) {
        addInter(p.x, p.z, '隔间', '推开隔间门', function () {
          if (i === 2 && ST.keyTaken && !ST.bathScare) {
            ST.bathScare = true;
            if (window.AU) { AU.stinger(); }
            G.cameraShake = 0.6;
            flashRed();
            showToastLine('隔间是空的。地上有一双湿脚印，脚尖朝着门。');
          } else {
            showToastLine(i === 2 ? '隔间是空的。地上有一双湿脚印。' : '隔间里只有拖把和水桶。');
          }
        }, { y: 1.2, range: 1.7 });
      });
      addInter(A.mop.x, A.mop.z, '水桶', '查看水桶', function () {
        showToastLine('水是黑的。拖把上缠着几根很长的头发。');
      }, { y: 0.5 });
      addInter(A.exit.x, A.exit.z, '门', '回到走廊', function () {
        if (window.AU) AU.door(false);
        transitionTo('corridor', { x: 0.9, z: -6.4, yaw: Math.PI }, function () {
          setObjective(goalCorridor());
          placeRobot(0, -17, 0, 'patrol');
        });
      }, { y: 1.2, range: 2.0 });
    }

    if (id === 'archive') {
      addInter(A.log.x, A.log.z, '教学日志', '翻看教学日志', function () {
        readLog();
      }, { y: 0.9 });
      addInter(A.safe.x, A.safe.z, '保险箱', '输入保险箱密码', function () {
        openSafe();
      }, { y: 0.7 });
      addInter(A.axe.x, A.axe.z, '消防斧', ST.glassBroken ? '抽出消防斧' : '砸碎玻璃柜', function () {
        takeAxe();
      }, { y: 1.1, range: 2.0 });
      addInter(A.terminal.x, A.terminal.z, '归档终端', '查看归档队列', function () {
        readNote('归档队列 · 核心控制室',
          '第 1 条　J6-01　归档完成<br>第 2 条　J6-02　归档完成<br>第 3 条　J6-03　归档完成<br>' +
          '第 4 条　J6-04　归档完成<br><br><b style="color:#7a2a22">第 5 条　J6-05　张锦鑫　状态：待处理</b><br><br>' +
          '倒计时：<b>41:12:06</b>',
          '');
      }, { y: 1.1 });
      addInter(-3.2, 2.9, '档案盒', '翻看档案盒', function () {
        showToastLine('标签上的年份全被记号笔涂掉了。只有一盒侧面写着：J6-04 · 归档完成。');
      }, { y: 0.6 });
      addInter(A.exit.x, A.exit.z, '门', ST.alarm ? '冲出档案室' : '回到走廊', function () {
        if (window.AU) AU.door(true);
        if (ST.alarm) {
          transitionTo('corridor', { x: 1.0, z: -13.6, yaw: 0 }, function () {
            placeRobot(0, -18.5, 0, 'chase');
            setObjective('冲向安全通道！别停');
            toast('它就在走廊尽头。跑！', 2600);
          });
        } else {
          transitionTo('corridor', { x: 1.0, z: -13.6, yaw: 0 }, function () {
            setObjective(goalCorridor());
            placeRobot(0, -17, 0, 'patrol');
          });
        }
      }, { y: 1.2, range: 2.0 });
    }

    if (id === 'stairs') {
      addInter(A.up.x, A.up.z, '向上的门', '推开安全出口', function () {
        escapeEnding();
      }, { y: 1.2, range: 2.0 });
      addInter(A.down.x, A.down.z, '向下的门', '下到机房 B1', function () {
        goServer();
      }, { y: 1.2, range: 2.0 });
    }

    if (id === 'server') {
      addInter(A.battery.x, A.battery.z, '电池', '捡起备用电池', function () {
        takeBattery();
      }, { y: 0.3, range: 1.6 });
      addInter(A.reset.x, A.reset.z, '重置按钮', '按下紧急重置', function () {
        useReset();
      }, { y: 1.2, range: 1.8 });
      addInter(A.exit.x, A.exit.z, '核心控制室', '进入核心控制室', function () {
        goCore();
      }, { y: 1.2, range: 2.0 });
      addInter(-6.0, 4.0, '服务器', '查看服务器', function () {
        showToastLine('机柜里全是被拆掉标签的硬盘。有一块还在读盘，灯闪得很快。');
      }, { y: 1.2 });
    }

    if (id === 'core') {
      G.levels.core.nodeAnchors.forEach(function (n) {
        n.inter = addInter(n.x, n.z, '核心节点', '用消防斧劈下去', function () {
          hitNode(n);
        }, { y: 1.2, range: 2.2 });
        if (!n.alive && n.inter) n.inter.disabled = true;
      });
      addInter(A.console.x, A.console.z, '主控台', '插入教学日志', function () {
        useConsole();
      }, { y: 1.0, range: 1.9 });
      addInter(A.gate.x, A.gate.z, '闸门', '转开数据闸门', function () {
        openGate();
      }, { y: 1.2, range: 2.0 });
      addInter(A.exit.x, A.exit.z, '安全出口', '推门离开', function () {
        leaveCore();
      }, { y: 1.2, range: 2.0 });
    }
  }

  function placeHunter(x, z) {
    G.hunter.pos.set(x, 0, z);
    G.hunter.target = null;
    G.hunter.stun = 0;
    G.hunter.idle = 0;
    G.hunter.grp.position.set(x, 0, z);
    G.hunter.grp.visible = true;
    G.hunter.visible = true;
  }

  function showToastLine(t) { toast(t, 2600); }

  function throwBottle(x, z, idx) {
    var g = G.cur.group;
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x3c5a4a, roughness: 0.2, transparent: true, opacity: 0.9 }));
    mesh.position.set(G.player.pos.x, 1.4, G.player.pos.z);
    g.add(mesh);
    var dirX = -Math.sin(G.player.yaw), dirZ = -Math.cos(G.player.yaw);
    var dist = 5.5;
    var ex = G.player.pos.x + dirX * dist, ez = G.player.pos.z + dirZ * dist;
    var t0 = performance.now();
    function tick() {
      var t = (performance.now() - t0) / 500;
      if (t >= 1) {
        mesh.position.set(ex, 0.06, ez);
        setTimeout(function () { g.remove(mesh); }, 3000);
        if (window.AU) AU.bottle();
        G.bottleNoise = { x: ex, z: ez, t: performance.now() };
        if (G.robot.visible) {
          G.robot.state = 'search';
          G.robot.lastSeen.set(ex, 0, ez);
          G.robot.searchT = 0;
          G.robot.lose = 0;
        }
        hunterHear(new THREE.Vector3(ex, 0, ez), 12);
        return;
      }
      mesh.position.x = G.player.pos.x + dirX * dist * t;
      mesh.position.z = G.player.pos.z + dirZ * dist * t;
      mesh.position.y = 1.4 + Math.sin(t * Math.PI) * 0.7 - t * 1.3;
      requestAnimationFrame(tick);
    }
    tick();
  }

  /* ================= 菜单 / 设置 ================= */
  function showMenu() {
    G.menu = true; G.playing = false; G.paused = false; G.dead = false; G.ending = false;
    $('pause').style.display = 'none';
    $('dead').style.display = 'none';
    $('ending').style.display = 'none';
    $('menu').style.display = 'flex';
    $('subtitle').style.display = 'none';
    refreshContinue();
    if (G.hideMask) G.hideMask.style.display = 'none';
    if (document.pointerLockElement) document.exitPointerLock();
    setLevel('corridor');
    G.player.yaw = 0;
    G.camera.position.set(0, 1.58, -0.9);
    if (window.AU) { AU.stopAmbience(); AU.setAmbience('corridor'); }
    updateHUD();
  }

  function openPause() {
    if (!G.playing || G.dead || G.ending) return;
    G.paused = true;
    $('pause').style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function closePause() {
    $('pause').style.display = 'none';
    G.paused = false;
    requestLock();
  }

  function setQualityFromUI() {
    var q = $('setQual').value;
    applyQuality(q);
  }

  /* ================= 输入 ================= */
  function bindInput() {
    window.addEventListener('keydown', function (e) {
      var k = e.key.toLowerCase();
      if (k === 'escape') {
        if (G.overlay === 'note') { closeOverlay('note'); return; }
        if (G.overlay === 'phone') { closePhoneUI(); return; }
        if (G.overlay === 'keypad') { closeOverlay('keypad'); return; }
        if ($('settings').style.display === 'flex') { $('settings').style.display = 'none'; return; }
        if ($('endList').style.display === 'flex') { $('endList').style.display = 'none'; return; }
        if (G.playing && !G.dead && !G.ending) {
          if ($('pause').style.display === 'flex') closePause();
          else openPause();
        }
        return;
      }
      if (k === 'f') {
        if (G.playing && !G.paused) {
          G.flashOn = !G.flashOn;
          G.flash.visible = G.flashOn;
          if (window.AU) AU.beep(G.flashOn ? 980 : 640, 0.05, 0.03);
        }
        return;
      }
      if (k === 'q') {
        if (G.overlay || G.dialog || G.dead || G.ending) return;
        tryBlock();
        return;
      }
      if (e.code === 'Space' || k === 'enter') {
        if (G.overlay === 'note') { closeOverlay('note'); return; }
        if (G.dialog) { advanceSub(); return; }
      }
      if (k === 'e' || k === 'enter') {
        if (G.overlay) return;
        if (G.dialog) { advanceSub(); return; }
        doInteract();
        return;
      }
      G.keys[k] = true;
    });
    window.addEventListener('keyup', function (e) {
      G.keys[e.key.toLowerCase()] = false;
    });
    window.addEventListener('mousemove', function (e) {
      if (!G.playing || G.paused || G.dead || G.ending) return;
      if (document.pointerLockElement === null) return;
      var mx = e.movementX || 0, my = e.movementY || 0;
      G.player.yaw -= mx * 0.0022 * G.sens;
      G.player.pitch -= my * 0.0019 * G.sens;
      G.player.pitch = Math.max(-1.3, Math.min(1.3, G.player.pitch));
      if (G.hidden) {
        // 柜子里视角受限
        G.player.yaw = Math.max(-Math.PI / 2 - 0.6, Math.min(-Math.PI / 2 + 0.6, G.player.yaw));
        G.player.pitch = Math.max(-0.5, Math.min(0.5, G.player.pitch));
      }
    });
    document.addEventListener('pointerlockchange', function () {
      if (!document.pointerLockElement && G.playing && !G.paused && !G.dead && !G.ending && !G.overlay) {
        openPause();
      }
    });
    $('gl').addEventListener('click', function () {
      if (G.playing && !G.paused && !document.pointerLockElement) requestLock();
    });
    $('subtitle').addEventListener('click', function () { if (G.dialog) advanceSub(); });
    $('note').addEventListener('click', function () { closeOverlay('note'); });
    $('phone').addEventListener('click', closePhoneUI);
  }

  /* ================= 启动 ================= */
  function boot() {
    try {
      initRenderer();
      buildKeypadUI();
      bindInput();
      buildAll();
      showMenu();
      $('bootBar').style.width = '100%';
      $('bootHint').textContent = '场景已就绪 · 点击进入';
      $('bootStart').style.display = 'inline-block';
      animate();
    } catch (e) {
      $('bootHint').textContent = '加载失败：' + e.message;
      console.error(e);
    }
  }

  function bindUI() {
    $('bootStart').onclick = function () { $('boot').style.display = 'none'; $('menu').style.display = 'flex'; };
    $('btnNew').onclick = function () { $('menu').style.display = 'none'; startGame(); };
    $('btnContinue').onclick = continueGame;
    $('btnEndings').onclick = function () { renderEndings(); $('endList').style.display = 'flex'; };
    $('btnEndListBack').onclick = function () { $('endList').style.display = 'none'; };
    $('btnSettings').onclick = function () { $('settings').style.display = 'flex'; };
    $('btnSetBack').onclick = function () { $('settings').style.display = 'none'; };
    $('setSens').oninput = function () { G.sens = parseFloat(this.value); $('setSensV').textContent = G.sens.toFixed(2); };
    $('setExp').oninput = function () {
      G.exposure = parseFloat(this.value);
      G.renderer.toneMappingExposure = G.exposure;
      $('setExpV').textContent = G.exposure.toFixed(2);
    };
    $('setVol').oninput = function () { if (window.AU) AU.setVolume(parseFloat(this.value)); $('setVolV').textContent = this.value; };
    $('setQual').onchange = setQualityFromUI;
    $('btnResume').onclick = closePause;
    $('btnRestart').onclick = function () { $('pause').style.display = 'none'; G.paused = false; respawn(); };
    $('btnQuit').onclick = function () { $('pause').style.display = 'none'; showMenu(); };
    $('btnDead').onclick = respawn;
    $('btnEndMenu').onclick = function () { showMenu(); };
    $('btnEndAgain').onclick = function () { $('ending').style.display = 'none'; startGame(); };
  }

  window.addEventListener('load', function () {
    bindUI();
    setTimeout(boot, 60);
  });

  // 调试入口（不影响正常游玩）
  GAME.jump = function (id, x, z, yaw) {
    var pos = (x === undefined || x === null) ? undefined : { x: x, z: z || 0, yaw: yaw || 0 };
    transitionTo(id, pos, function () { });
  };
  GAME.setPos = function (x, z, yaw) {
    G.player.pos.set(x, 0, z);
    if (yaw !== undefined) G.player.yaw = yaw;
    G.camera.position.set(x, G.player.eye, z);
  };
  GAME.interact = doInteract;
  GAME.say = say;
  GAME.endings = showEnding;
  GAME.robotAt = function (x, z, heading, mode) { placeRobot(x, z, heading || 0, mode || 'patrol'); };
  GAME.hunterAt = function (x, z) { placeHunter(x, z); };
  GAME.startBoss = startBoss;
  GAME.goCore = goCore;
  GAME.stopBoss = stopBoss;
  GAME.hit = function (i) { if (G.levels.core) hitNode(G.levels.core.nodeAnchors[i]); };
  GAME.blockPress = tryBlock;
  GAME.hazardAt = function (x, z, warn) { addHazard(x, z, warn); };
  GAME.blockHitTest = blockHit;
})();
